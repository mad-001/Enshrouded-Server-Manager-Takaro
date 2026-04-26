import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function findEnshroudedPid(exeName = 'enshrouded_server.exe'): Promise<number | null> {
  if (process.platform !== 'win32') return null;
  try {
    const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${exeName}" /NH /FO CSV`);
    const line = stdout.split(/\r?\n/).find((l) => l.toLowerCase().includes(exeName.toLowerCase()));
    if (!line) return null;
    const cols = line.split('","').map((s) => s.replace(/"/g, ''));
    const pid = parseInt(cols[1], 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

export async function isProcessRunning(pid: number): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  try {
    const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /NH /FO CSV`);
    return stdout.toLowerCase().includes('enshrouded_server.exe');
  } catch {
    return false;
  }
}

export async function forceKill(pid: number): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  try {
    await execAsync(`taskkill /F /PID ${pid}`);
    return true;
  } catch {
    return false;
  }
}
