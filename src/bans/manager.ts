import fs from 'node:fs';
import { logger } from '../logger.js';

export interface BanEntry {
  accountId: string; // u64 stored as string in our cache; JSON has it as a number
  displayName: string;
  characterName: string;
  banDate: { value: number };
}

interface ServerJson {
  bannedAccounts?: Array<{
    accountId: number | string;
    displayName: string;
    characterName: string;
    banDate: { value: number };
  }>;
  [key: string]: unknown;
}

export class BanManager {
  constructor(private serverJsonPath: string) {}

  list(): BanEntry[] {
    const json = this.read();
    return (json.bannedAccounts || []).map((b) => ({
      accountId: String(b.accountId),
      displayName: b.displayName,
      characterName: b.characterName,
      banDate: b.banDate,
    }));
  }

  // Add a ban entry. accountIdHash must be the game's accountIDHash for the steam ID
  // (obtained via the SteamHashCache, which builds the mapping by parsing save files).
  add(accountIdHash: bigint, displayName: string, characterName: string): boolean {
    const json = this.read();
    json.bannedAccounts = json.bannedAccounts || [];
    const idStr = accountIdHash.toString();
    if (json.bannedAccounts.some((b) => String(b.accountId) === idStr)) {
      logger.info(`Ban entry for accountId ${idStr} already exists`);
      return false;
    }
    json.bannedAccounts.push({
      // Write as number; if it overflows JS Number.MAX_SAFE_INTEGER, write as string —
      // the JSON spec allows it and the game tolerates either form for the hashed id.
      accountId: accountIdHash <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(accountIdHash) : (idStr as unknown as number),
      displayName,
      characterName,
      banDate: { value: Math.floor(Date.now() / 1000) },
    });
    this.write(json);
    logger.info(`Banned ${characterName} (${displayName}) accountId=${idStr}`);
    return true;
  }

  removeByName(name: string): number {
    const json = this.read();
    const before = json.bannedAccounts?.length ?? 0;
    if (!json.bannedAccounts) return 0;
    json.bannedAccounts = json.bannedAccounts.filter(
      (b) => b.displayName !== name && b.characterName !== name,
    );
    const removed = before - json.bannedAccounts.length;
    if (removed > 0) {
      this.write(json);
      logger.info(`Unbanned ${removed} entries matching '${name}'`);
    }
    return removed;
  }

  removeByAccountId(accountIdHash: bigint): boolean {
    const json = this.read();
    if (!json.bannedAccounts) return false;
    const idStr = accountIdHash.toString();
    const before = json.bannedAccounts.length;
    json.bannedAccounts = json.bannedAccounts.filter((b) => String(b.accountId) !== idStr);
    const removed = before - json.bannedAccounts.length > 0;
    if (removed) {
      this.write(json);
      logger.info(`Unbanned accountId=${idStr}`);
    }
    return removed;
  }

  private read(): ServerJson {
    return JSON.parse(fs.readFileSync(this.serverJsonPath, 'utf8')) as ServerJson;
  }

  private write(json: ServerJson): void {
    const backup = `${this.serverJsonPath}.bridge-backup`;
    fs.copyFileSync(this.serverJsonPath, backup);
    fs.writeFileSync(this.serverJsonPath, JSON.stringify(json, null, '\t'));
  }
}
