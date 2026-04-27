import fs from 'node:fs';
import { logger } from './logger.js';
import type { BridgeConfig } from './config.js';
import { TakaroWsClient } from './ws/client.js';
import { LogTailer } from './log-tail/tailer.js';
import { PlayerTracker } from './players/tracker.js';
import { toTakaroPlayer, type Player } from './players/types.js';
import { ServerLifecycle } from './server/lifecycle.js';
import { BanManager } from './bans/manager.js';
import { SteamHashCache } from './bans/cache.js';
import { BackupService } from './backup/service.js';
import { SaveParser } from './save/parser.js';
import { registerAllHandlers } from './handlers/index.js';

const SAVE_RESCAN_INTERVAL_MS = 60_000;
const BACKUP_PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const BACKUP_RETENTION_DAYS = 7;

export class Bridge {
  private ws: TakaroWsClient;
  private players = new PlayerTracker();
  private tailer: LogTailer;
  private lifecycle: ServerLifecycle;
  private bans: BanManager;
  private steamHash: SteamHashCache;
  private backups: BackupService;
  private saveParser: SaveParser;
  private rescanTimer: NodeJS.Timeout | null = null;
  private pruneTimer: NodeJS.Timeout | null = null;

  constructor(private config: BridgeConfig) {
    fs.mkdirSync(config.stateDirectory, { recursive: true });
    this.ws = new TakaroWsClient(config.takaroWsUrl, {
      identityToken: config.identityToken,
      registrationToken: config.registrationToken,
      name: config.serverName,
    });
    logger.info(`Identifying as identityToken='${config.identityToken}' name='${config.serverName}'`);
    this.tailer = new LogTailer(config.enshroudedLogPath);
    this.lifecycle = new ServerLifecycle(config);
    this.bans = new BanManager(config.enshroudedServerJson);
    this.steamHash = new SteamHashCache(config.stateDirectory);
    this.backups = new BackupService(config.enshroudedSavePath, config.backupDirectory);
    this.saveParser = new SaveParser(config.enshroudedSavePath);
  }

  async start(): Promise<void> {
    logger.info(`Starting bridge for server: ${this.config.serverName}`);

    if (this.config.manageServerProcess) {
      await this.lifecycle.start();
    }

    this.tailer.on('line', (line) => this.players.ingestLine(line));
    this.tailer.start();

    this.players.on('player-connected', (p: Player) => {
      this.steamHash.recordPlayerSession(p.steamId, p.characterName);
      this.ws.sendGameEvent('player-connected', { player: toTakaroPlayer(p) });
    });
    this.players.on('player-disconnected', (p: Player) => {
      this.ws.sendGameEvent('player-disconnected', { player: toTakaroPlayer(p) });
    });

    const dispatcher = registerAllHandlers({
      ws: this.ws,
      players: this.players,
      lifecycle: this.lifecycle,
      bans: this.bans,
      steamHash: this.steamHash,
      backups: this.backups,
    });

    this.ws.on('request', (msg) => {
      dispatcher.dispatch(msg).catch((e) => {
        logger.error(`Dispatch error: ${(e as Error).message}`);
      });
    });

    this.ws.connect();

    this.scheduleSaveRescan();
    this.scheduleBackupPrune();
  }

  async stop(): Promise<void> {
    logger.info('Bridge stopping');
    if (this.rescanTimer) clearInterval(this.rescanTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.tailer.stop();
    this.ws.shutdown();
  }

  // Re-parse the latest save shard periodically. Each pass adds new character->hash
  // mappings to the cache; recordPlayerSession() promotes them to steamId mappings on connect.
  private scheduleSaveRescan(): void {
    const run = () => {
      try {
        const characters = this.saveParser.parseCharacters();
        if (characters.length) {
          this.steamHash.ingestSave(characters);
          // Try to promote any currently-online player whose mapping just appeared.
          for (const p of this.players.list()) {
            this.steamHash.recordPlayerSession(p.steamId, p.characterName);
          }
        }
      } catch (err) {
        logger.warn(`Save rescan failed: ${(err as Error).message}`);
      }
    };
    run();
    this.rescanTimer = setInterval(run, SAVE_RESCAN_INTERVAL_MS);
  }

  private scheduleBackupPrune(): void {
    this.pruneTimer = setInterval(() => {
      this.backups.pruneOlderThanDays(BACKUP_RETENTION_DAYS).catch((e) => {
        logger.warn(`Backup prune failed: ${(e as Error).message}`);
      });
    }, BACKUP_PRUNE_INTERVAL_MS);
  }
}
