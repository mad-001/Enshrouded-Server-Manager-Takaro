import fs from 'node:fs';
import path from 'node:path';

export interface SaveCharacter {
  accountIdHash: bigint;
  accountIdHashStr: string;
  characterName: string;
  offset: number;
}

interface IndexFile {
  latest: number;
  time: number;
  deleted: boolean;
}

// Read the save index to find the active shard, then walk the shard for
// character entries. Each entry is: 8 bytes (account hash, LE u64) + 4 bytes (u32 LE name length) + N bytes name.
//
// The character table is found by scanning for plausible entries. The KSC1 format
// puts these inline among other binary data; we discriminate by:
//   - name length 1..64
//   - all name bytes printable ASCII
//   - hash != 0
//
// False positives are rare given those constraints; results are deduped by hash.
export class SaveParser {
  constructor(private savePath: string) {}

  latestShardPath(): string | null {
    const indexFiles = fs.readdirSync(this.savePath).filter((f) => f.endsWith('-index'));
    if (!indexFiles.length) return null;
    const indexFile = path.join(this.savePath, indexFiles[0]);
    const parsed = JSON.parse(fs.readFileSync(indexFile, 'utf8')) as IndexFile;
    const base = indexFiles[0].replace(/-index$/, '');
    return path.join(this.savePath, `${base}-${parsed.latest}`);
  }

  parseCharacters(shardPath?: string): SaveCharacter[] {
    const target = shardPath || this.latestShardPath();
    if (!target || !fs.existsSync(target)) return [];

    const buf = fs.readFileSync(target);
    if (buf.length < 32) return [];
    // KSC1 magic ('K','S','C','1' = 0x3143534B in LE u32). Soft check; some shards
    // could use newer formats, the walker below is robust to either.
    const KSC1 = 0x3143534b;
    if (buf.readUInt32LE(0) !== KSC1) {
      // not fatal — proceed and let the walker filter
    }

    const found = new Map<string, SaveCharacter>();
    for (let i = 0; i < buf.length - 12; i++) {
      const len = buf.readUInt32LE(i + 8);
      if (len < 1 || len > 64) continue;
      if (i + 12 + len > buf.length) continue;

      let printable = true;
      for (let j = 0; j < len; j++) {
        const b = buf[i + 12 + j];
        if (b < 0x20 || b > 0x7e) {
          printable = false;
          break;
        }
      }
      if (!printable) continue;

      const hash = buf.readBigUInt64LE(i);
      if (hash === 0n) continue;

      const name = buf.subarray(i + 12, i + 12 + len).toString('utf8');
      // Accept printable ASCII names (game restricts character names to a similar set).
      // Rejects pure-binary false positives with high reliability.
      if (!/^[\x20-\x7e]+$/.test(name)) continue;
      // Drop names that are obviously not character names (no letters at all).
      if (!/[A-Za-z]/.test(name)) continue;

      const key = hash.toString();
      if (!found.has(key)) {
        found.set(key, {
          accountIdHash: hash,
          accountIdHashStr: key,
          characterName: name,
          offset: i,
        });
      }
    }

    return [...found.values()];
  }
}
