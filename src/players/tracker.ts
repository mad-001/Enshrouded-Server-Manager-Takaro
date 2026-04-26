import EventEmitter from 'node:events';
import { logger } from '../logger.js';
import type { Player, Position } from './types.js';

const PENDING_TIMEOUT_MS = 300_000;

interface PendingSteamId {
  steamId: string;
  receivedAt: number;
}

// Translates raw enshrouded_server.log lines into player-connected/-disconnected/position events.
//
// Correlation strategy (from peer-based fix shipped 2026-04-26):
// 1. "[online] Added peer N(M) (steamid:X)"           -> peerToSteamId[N] = X
// 2. "[server] Machine 'M': Player 'N(K)' logged in"  -> pendingPeer = N
// 3. "[server] Player 'NAME' logged in with Permissions:" -> pair NAME with peerToSteamId[pendingPeer]
// 4. Fallback FIFO queue from "Session accepted with peer (steamid:X)" used only if peer mapping missed.
export class PlayerTracker extends EventEmitter {
  private players = new Map<string, Player>();
  private characterToSteam = new Map<string, string>();
  private peerToSteamId = new Map<number, string>();
  private pendingPeer: number | null = null;
  private pendingSteamIds: PendingSteamId[] = [];

  ingestLine(line: string): void {
    if (line.includes('Session accepted with peer')) {
      const sid = this.extractSteamId(line);
      if (sid) {
        this.pendingSteamIds.push({ steamId: sid, receivedAt: Date.now() });
        this.gcPendingSteamIds();
      }
      return;
    }

    if (line.includes('[online] Added peer ')) {
      const peer = this.extractPeerFromAddedPeer(line);
      const sid = this.extractSteamId(line);
      if (peer != null && sid) this.peerToSteamId.set(peer, sid);
      return;
    }

    if (line.includes("Machine '") && line.includes("': Player '") && line.includes("' logged in") && !line.includes('with Permissions')) {
      const peer = this.extractPeerFromMachineLine(line);
      if (peer != null) this.pendingPeer = peer;
      return;
    }

    if (line.includes('logged in with Permissions')) {
      const name = this.extractCharacterName(line);
      if (!name) return;
      const sid = this.resolveSteamId();
      if (!sid) {
        logger.warn(`Could not resolve Steam ID for ${name} (no peer or pending)`);
        this.pendingPeer = null;
        return;
      }
      const player: Player = {
        steamId: sid,
        characterName: name,
        permissions: [],
        connectedAt: Date.now(),
      };
      this.players.set(sid, player);
      this.characterToSteam.set(name, sid);
      this.removePending(sid);
      this.pendingPeer = null;
      logger.info(`Player connected: ${name} (steam:${sid})`);
      this.emit('player-connected', player);
      return;
    }

    if (line.includes("[server] Remove Player '")) {
      const name = this.extractCharacterName(line);
      if (!name) return;
      const sid = this.characterToSteam.get(name);
      if (!sid) return;
      const player = this.players.get(sid);
      if (!player) return;
      this.players.delete(sid);
      this.characterToSteam.delete(name);
      logger.info(`Player disconnected: ${name} (steam:${sid})`);
      this.emit('player-disconnected', player);
      return;
    }

    if (line.includes('Player EntityId') && line.includes('teleported From')) {
      const pos = this.extractPositionFromTeleport(line);
      const entityId = this.extractEntityIdFromTeleport(line);
      if (pos && entityId != null) {
        // EntityId isn't a Steam ID; we don't have a clean entity->player map yet.
        // Update the most-recently-connected player as a heuristic; replaced when we
        // can map Player handle (M(N)) to entity id from a future log line.
        const recent = this.mostRecentlyConnected();
        if (recent) {
          recent.lastKnownPosition = pos;
          recent.positionUpdatedAt = Date.now();
        }
      }
      return;
    }
  }

  list(): Player[] {
    return [...this.players.values()];
  }

  bySteamId(steamId: string): Player | undefined {
    return this.players.get(steamId);
  }

  byCharacterName(name: string): Player | undefined {
    const sid = this.characterToSteam.get(name);
    return sid ? this.players.get(sid) : undefined;
  }

  private resolveSteamId(): string | null {
    if (this.pendingPeer != null) {
      const sid = this.peerToSteamId.get(this.pendingPeer);
      if (sid) return sid;
    }
    if (this.pendingSteamIds.length) {
      this.pendingSteamIds.sort((a, b) => a.receivedAt - b.receivedAt);
      return this.pendingSteamIds[0].steamId;
    }
    return null;
  }

  private removePending(sid: string): void {
    this.pendingSteamIds = this.pendingSteamIds.filter((p) => p.steamId !== sid);
  }

  private gcPendingSteamIds(): void {
    const cutoff = Date.now() - PENDING_TIMEOUT_MS;
    this.pendingSteamIds = this.pendingSteamIds.filter((p) => p.receivedAt > cutoff);
  }

  private mostRecentlyConnected(): Player | undefined {
    let best: Player | undefined;
    for (const p of this.players.values()) {
      if (!best || p.connectedAt > best.connectedAt) best = p;
    }
    return best;
  }

  private extractSteamId(line: string): string | null {
    const m = line.match(/\(steamid:(\d+)\)/);
    return m ? m[1] : null;
  }

  private extractCharacterName(line: string): string | null {
    const m = line.match(/Player '([^']+)'/);
    return m ? m[1] : null;
  }

  private extractPeerFromAddedPeer(line: string): number | null {
    const m = line.match(/Added peer (\d+)\(/);
    return m ? parseInt(m[1], 10) : null;
  }

  private extractPeerFromMachineLine(line: string): number | null {
    const m = line.match(/': Player '(\d+)\(/);
    return m ? parseInt(m[1], 10) : null;
  }

  private extractPositionFromTeleport(line: string): Position | null {
    const m = line.match(/to \(([\-\d.]+),\s*([\-\d.]+),\s*([\-\d.]+)\)/);
    if (!m) return null;
    return { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) };
  }

  private extractEntityIdFromTeleport(line: string): number | null {
    const m = line.match(/Player EntityId (\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }
}
