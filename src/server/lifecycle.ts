import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { logger } from '../logger.js';
import type { BridgeConfig } from '../config.js';
import { sendCtrlCToProcess } from './win32.js';
import { findEnshroudedPid, forceKill, isProcessRunning } from './process.js';

const STOP_TIMEOUT_MS = 30_000;
const STOP_POLL_MS = 1000;

export class ServerLifecycle {
  constructor(private config: BridgeConfig) {}

  async start(): Promise<number | null> {
    if (!this.config.manageServerProcess) {
      logger.info('manageServerProcess=false; not launching server (assumed managed externally)');
      return await findEnshroudedPid();
    }
    const existing = await findEnshroudedPid();
    if (existing) {
      logger.info(`Server already running, pid=${existing}`);
      return existing;
    }
    logger.info(`Launching ${this.config.enshroudedServerExe}`);
    const child = spawn(this.config.enshroudedServerExe, [], {
      cwd: this.config.enshroudedServerPath,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();
    await sleep(2000);
    const pid = await findEnshroudedPid();
    logger.info(`Server started, pid=${pid ?? 'unknown'}`);
    return pid;
  }

  // Graceful shutdown via CTRL_C_EVENT. Same recipe as ESM EnshroudedServerService.Stop().
  async stop(): Promise<{ stopped: boolean; forced: boolean }> {
    const pid = await findEnshroudedPid();
    if (!pid) {
      logger.info('Stop requested but no server process found');
      return { stopped: true, forced: false };
    }

    logger.info(`Stopping server pid=${pid} via CTRL_C_EVENT`);
    const sent = sendCtrlCToProcess(pid);
    if (!sent) {
      logger.warn('CTRL_C_EVENT not delivered, will force-kill');
      const killed = await forceKill(pid);
      return { stopped: killed, forced: true };
    }

    let waited = 0;
    while (waited < STOP_TIMEOUT_MS) {
      if (!(await isProcessRunning(pid))) {
        logger.info(`Server stopped gracefully after ${waited}ms`);
        return { stopped: true, forced: false };
      }
      await sleep(STOP_POLL_MS);
      waited += STOP_POLL_MS;
    }

    logger.error(`Server did not stop within ${STOP_TIMEOUT_MS}ms — force killing`);
    const killed = await forceKill(pid);
    return { stopped: killed, forced: true };
  }

  async restart(): Promise<number | null> {
    await this.stop();
    await sleep(2000);
    return this.start();
  }
}
