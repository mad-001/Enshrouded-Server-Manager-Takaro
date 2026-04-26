import fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../logger.js';

const execAsync = promisify(exec);

const ENSHROUDED_APP_ID = '2278520';

export class SteamCmdUpdater {
  constructor(
    private steamCmdPath: string,
    private serverPath: string,
  ) {}

  // Returns true if the server exe timestamp changed (i.e., an update was applied).
  async updateAndCheck(): Promise<{ updated: boolean; before?: number; after?: number }> {
    const exePath = `${this.serverPath}\\enshrouded_server.exe`;
    const before = fs.existsSync(exePath) ? fs.statSync(exePath).mtimeMs : 0;
    const cmd = `"${this.steamCmdPath}" +force_install_dir "${this.serverPath}" +login anonymous +app_update ${ENSHROUDED_APP_ID} validate +quit`;
    logger.info(`Running SteamCMD update: ${cmd}`);
    try {
      const { stdout } = await execAsync(cmd, { maxBuffer: 16 * 1024 * 1024 });
      const after = fs.existsSync(exePath) ? fs.statSync(exePath).mtimeMs : 0;
      const updated = after > before;
      logger.info(`SteamCMD finished. updated=${updated}`);
      logger.debug(stdout.split(/\r?\n/).slice(-15).join('\n'));
      return { updated, before, after };
    } catch (err) {
      logger.error(`SteamCMD failed: ${(err as Error).message}`);
      return { updated: false };
    }
  }
}
