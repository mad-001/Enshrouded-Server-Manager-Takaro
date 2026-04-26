import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../logger.js';

const execAsync = promisify(exec);

export class BackupService {
  constructor(
    private savePath: string,
    private backupDir: string,
  ) {
    fs.mkdirSync(this.backupDir, { recursive: true });
  }

  // Hourly-style timestamped folder backup, matching the existing hourly_backup.bat pattern.
  async backup(): Promise<{ ok: boolean; path?: string; error?: string }> {
    if (!fs.existsSync(this.savePath)) {
      return { ok: false, error: `save path missing: ${this.savePath}` };
    }
    const stamp = this.timestamp();
    const target = path.join(this.backupDir, stamp);
    try {
      fs.mkdirSync(target, { recursive: true });
      if (process.platform === 'win32') {
        await execAsync(`xcopy "${this.savePath}\\*" "${target}\\" /Y /Q /E`);
      } else {
        await execAsync(`cp -r "${this.savePath}/." "${target}/"`);
      }
      logger.info(`Backup created: ${target}`);
      return { ok: true, path: target };
    } catch (err) {
      logger.error(`Backup failed: ${(err as Error).message}`);
      return { ok: false, error: (err as Error).message };
    }
  }

  async pruneOlderThanDays(days: number): Promise<number> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let pruned = 0;
    for (const entry of fs.readdirSync(this.backupDir)) {
      const full = path.join(this.backupDir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory() && stat.mtimeMs < cutoff) {
        fs.rmSync(full, { recursive: true, force: true });
        pruned++;
      }
    }
    if (pruned) logger.info(`Pruned ${pruned} backups older than ${days}d`);
    return pruned;
  }

  list(): string[] {
    return fs
      .readdirSync(this.backupDir)
      .filter((f) => fs.statSync(path.join(this.backupDir, f)).isDirectory())
      .sort()
      .reverse();
  }

  private timestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  }
}
