import fs from 'node:fs';
import path from 'node:path';

export interface BridgeConfig {
  registrationToken: string;
  serverName: string;
  // What gets sent as identityToken on the Takaro `identify` message.
  // Defaults to serverName so the value is exactly what you put in the config.
  // Override only if you need to match a specific value already stored in Takaro
  // for a pre-existing gameserver.
  identityToken: string;
  enshroudedServerPath: string;
  enshroudedServerExe: string;
  enshroudedServerJson: string;
  enshroudedLogPath: string;
  enshroudedSavePath: string;
  steamCmdPath: string;
  backupDirectory: string;
  // If true, the bridge launches/stops the server process itself.
  // If false, the bridge only attaches to a server already managed by Monitor.ps1 / restart_server.bat.
  manageServerProcess: boolean;
  takaroWsUrl: string;
  stateDirectory: string;
}

export function loadConfig(configPath = 'TakaroConfig.txt'): BridgeConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Config file not found at ${path.resolve(configPath)}. Copy TakaroConfig.example.txt to TakaroConfig.txt and fill in the values.`,
    );
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  const kv: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    kv[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }

  const required = ['registrationToken', 'serverName'];
  for (const key of required) {
    if (!kv[key]) throw new Error(`Missing required config: ${key}`);
  }

  const base = kv.enshroudedServerPath || 'C:\\GameServers\\Enshrouded';
  return {
    registrationToken: kv.registrationToken,
    serverName: kv.serverName,
    identityToken: kv.identityToken || kv.serverName,
    enshroudedServerPath: base,
    enshroudedServerExe: kv.enshroudedServerExe || path.join(base, 'enshrouded_server.exe'),
    enshroudedServerJson: kv.enshroudedServerJson || path.join(base, 'enshrouded_server.json'),
    enshroudedLogPath: kv.enshroudedLogPath || path.join(base, 'logs', 'enshrouded_server.log'),
    enshroudedSavePath: kv.enshroudedSavePath || path.join(base, 'savegame'),
    steamCmdPath: kv.steamCmdPath || 'C:\\steamcmd\\steamcmd.exe',
    backupDirectory: kv.backupDirectory || path.join(base, 'savegame_backups'),
    manageServerProcess: (kv.manageServerProcess || 'false').toLowerCase() === 'true',
    takaroWsUrl: kv.takaroWsUrl || 'wss://connect.takaro.io/',
    stateDirectory: kv.stateDirectory || path.join(process.cwd(), 'state'),
  };
}
