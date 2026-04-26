import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.js';
import type { SaveCharacter } from '../save/parser.js';

interface CacheData {
  // characterName -> accountIdHash (string for JSON portability)
  byCharacterName: Record<string, string>;
  // steamId -> accountIdHash. Populated when a character we currently track via
  // the log tail (which gives us steamId) matches a name in the save file (which
  // gives us hash). One save parse + one player session = one mapping recorded forever.
  bySteamId: Record<string, string>;
}

export class SteamHashCache {
  private filePath: string;
  private data: CacheData = { byCharacterName: {}, bySteamId: {} };

  constructor(stateDir: string) {
    fs.mkdirSync(stateDir, { recursive: true });
    this.filePath = path.join(stateDir, 'steam-hash-cache.json');
    if (fs.existsSync(this.filePath)) {
      try {
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as CacheData;
      } catch (err) {
        logger.warn(`Could not parse cache file ${this.filePath}: ${(err as Error).message}`);
      }
    }
  }

  ingestSave(characters: SaveCharacter[]): void {
    let added = 0;
    for (const c of characters) {
      if (this.data.byCharacterName[c.characterName] !== c.accountIdHashStr) {
        this.data.byCharacterName[c.characterName] = c.accountIdHashStr;
        added++;
      }
    }
    if (added > 0) {
      this.persist();
      logger.info(`Save parser added ${added} character->hash mappings`);
    }
  }

  // Called when a player connects (we know steamId + characterName from log tail).
  // If we already have characterName -> hash from the save, this is the moment we record steamId -> hash.
  recordPlayerSession(steamId: string, characterName: string): void {
    const hash = this.data.byCharacterName[characterName];
    if (!hash) return;
    if (this.data.bySteamId[steamId] === hash) return;
    this.data.bySteamId[steamId] = hash;
    this.persist();
    logger.info(`Recorded steam:${steamId} -> hash:${hash} (via character '${characterName}')`);
  }

  hashForSteamId(steamId: string): bigint | null {
    const s = this.data.bySteamId[steamId];
    return s ? BigInt(s) : null;
  }

  hashForCharacterName(name: string): bigint | null {
    const s = this.data.byCharacterName[name];
    return s ? BigInt(s) : null;
  }

  size(): { byCharacterName: number; bySteamId: number } {
    return {
      byCharacterName: Object.keys(this.data.byCharacterName).length,
      bySteamId: Object.keys(this.data.bySteamId).length,
    };
  }

  private persist(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }
}
