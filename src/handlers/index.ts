import { setTimeout as sleep } from 'node:timers/promises';
import { HandlerDispatcher, toTakaroPlayer, type HandlerContext } from './dispatcher.js';
import type { CommandOutput } from '../ws/protocol.js';
import { logger } from '../logger.js';

export function registerAllHandlers(ctx: HandlerContext): HandlerDispatcher {
  const d = new HandlerDispatcher(ctx);

  d.register('testReachability', () => ({ connectable: true, reason: null }));

  d.register('getPlayers', () => ctx.players.list().map(toTakaroPlayer));

  d.register('getPlayer', (args) => {
    const p = ctx.players.bySteamId(args?.steamId || args?.gameId || '');
    return p ? toTakaroPlayer(p) : null;
  });

  d.register('getPlayerLocation', (args) => {
    const p = ctx.players.bySteamId(args?.steamId || args?.gameId || '');
    if (p?.lastKnownPosition) return p.lastKnownPosition;
    return { x: 0, y: 0, z: 0 };
  });

  d.register('getPlayerInventory', () => []);

  d.register('listBans', () => {
    return ctx.bans.list().map((b) => ({
      // BanDTO shape: player + ...metadata. Steam ID unknown unless we've cached it.
      player: { gameId: b.accountId, name: b.characterName || b.displayName },
      until: null,
      reason: '',
    }));
  });

  d.register('listItems', () => []);
  d.register('listEntities', () => []);
  d.register('listLocations', () => []);
  d.register('getMapInfo', () => ({ enabled: false, mapBlockSize: 0, maxZoom: 0, mapSizeX: 0, mapSizeY: 0, mapSizeZ: 0 }));
  d.register('getMapTile', () => null);

  d.register('executeConsoleCommand', async (args, c): Promise<CommandOutput> => {
    const raw = String(args?.command || '').trim();
    const cmd = raw.toLowerCase();
    logger.info(`executeConsoleCommand: ${raw}`);

    if (cmd === 'help' || cmd === '?' || cmd === '') {
      return {
        rawResult: [
          'Bridge admin commands (typed in this Takaro console):',
          '  help            show this list',
          '  players         list currently online players',
          '  bans            list banned accounts',
          '  shutdown        graceful Ctrl+C shutdown of enshrouded_server.exe',
          '  restart         graceful shutdown then start',
          '  backup          create a timestamped savegame backup',
          '  update          run SteamCMD app_update and report whether the exe changed',
          '  cache           show how many steamId<->accountIDHash mappings the bridge knows',
          '',
          'Anything else is acked silently. Enshrouded itself has no native server console,',
          'so plain in-game commands (e.g. /kick, /ban) must be typed by an admin in chat.',
        ].join('\n'),
        success: true,
      };
    }

    if (cmd === 'shutdown' || cmd === 'stop') {
      setTimeout(() => {
        c.lifecycle.stop().catch((e) => logger.error(`shutdown error: ${(e as Error).message}`));
      }, 0);
      return { rawResult: 'Shutdown initiated (CTRL_C_EVENT). Watch bridge log for graceful save + exit.', success: true };
    }

    if (cmd === 'restart') {
      setTimeout(() => {
        c.lifecycle.restart().catch((e) => logger.error(`restart error: ${(e as Error).message}`));
      }, 0);
      return { rawResult: 'Restart initiated.', success: true };
    }

    if (cmd === 'players' || cmd === 'who') {
      const list = c.players.list();
      const lines = list.length
        ? list.map((p) => `  ${p.characterName.padEnd(24)}  steam:${p.steamId}`).join('\n')
        : '  (no players online)';
      return { rawResult: `${list.length} player(s):\n${lines}`, success: true };
    }

    if (cmd === 'bans') {
      const list = c.bans.list();
      const lines = list.length
        ? list
            .map((b) => `  ${b.displayName.padEnd(24)} char='${b.characterName}' accountId=${b.accountId}`)
            .join('\n')
        : '  (no bans)';
      return { rawResult: `${list.length} ban(s):\n${lines}`, success: true };
    }

    if (cmd === 'backup') {
      const result = await c.backups.backup();
      return result.ok
        ? { rawResult: `Backup created: ${result.path}`, success: true }
        : { rawResult: `Backup failed: ${result.error}`, success: false, errorMessage: result.error };
    }

    if (cmd === 'cache') {
      const sz = c.steamHash.size();
      return {
        rawResult: `steam-hash-cache: ${sz.byCharacterName} character->hash, ${sz.bySteamId} steam->hash mappings`,
        success: true,
      };
    }

    return { rawResult: raw, success: true };
  });

  d.register('shutdown', async () => {
    // Respond to Takaro immediately, then perform the actual shutdown asynchronously
    // (mirrors the astroneer-bridge pattern). Otherwise the request times out while
    // the game is saving.
    setTimeout(() => {
      ctx.lifecycle.stop().catch((e) => logger.error(`shutdown error: ${(e as Error).message}`));
    }, 0);
    return { success: true };
  });

  d.register('banPlayer', async (args) => {
    // Args shape per Takaro: { player: { gameId | steamId }, reason, expiresAt, ... }
    const steamId = String(args?.player?.gameId || args?.player?.steamId || args?.steamId || '');
    if (!steamId) return { success: false, message: 'no steamId provided' };

    const live = ctx.players.bySteamId(steamId);
    const characterName = live?.characterName || args?.player?.name || 'unknown';

    const hash = ctx.steamHash.hashForSteamId(steamId);
    if (!hash) {
      logger.warn(
        `banPlayer: no accountIDHash known for steam:${steamId}. ` +
          `Use in-game admin /ban once for this player so the save parser can capture the mapping.`,
      );
      return { success: false, message: 'accountIDHash unknown for this steam id; ban manually in-game once' };
    }

    const added = ctx.bans.add(hash, characterName, characterName);
    return { success: added };
  });

  d.register('unbanPlayer', async (args) => {
    const steamId = String(args?.player?.gameId || args?.player?.steamId || args?.steamId || '');
    const name = args?.player?.name;

    if (steamId) {
      const hash = ctx.steamHash.hashForSteamId(steamId);
      if (hash) {
        const removed = ctx.bans.removeByAccountId(hash);
        return { success: removed };
      }
    }
    if (name) {
      const removed = ctx.bans.removeByName(String(name));
      return { success: removed > 0 };
    }
    return { success: false, message: 'unbanPlayer needs steamId or name' };
  });

  d.register('kickPlayer', () => ({ success: false, message: 'kick is not supported by Enshrouded externally; use in-game admin /kick' }));

  d.register('sendMessage', () => ({ success: false, message: 'in-game chat injection is not supported' }));
  d.register('teleportPlayer', () => ({ success: false, message: 'teleport is not supported externally' }));
  d.register('giveItem', () => ({ success: false, message: 'giveItem is not supported externally' }));

  return d;
}

// Re-export to give the rest of the project a stable import path.
export { sleep };
