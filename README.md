# Enshrouded Takaro Bridge

A Node.js service that connects an Enshrouded dedicated server to Takaro's WebSocket gateway. Replaces the previous `takaro.dll` + `winmm.dll` injection approach with a fully external bridge — the game runs vanilla, the bridge can be restarted independently of the server.

## What it does

| Capability | Status |
|---|---|
| Player connect / disconnect events | ✅ Log tail with peer-correlated Steam ID matching |
| `getPlayers` / `getPlayer` / `testReachability` | ✅ |
| `getPlayerLocation` | ✅ Last-known from teleport log lines, `(0,0,0)` otherwise |
| `getPlayerInventory` | Stub — game has no external API |
| `executeConsoleCommand` | ✅ Echo success so downstream Takaro hooks fire |
| `shutdown` | ✅ Graceful via `CTRL_C_EVENT` (game saves cleanly), 30s timeout, force-kill fallback |
| `listBans` | ✅ Read from `enshrouded_server.json` |
| `banPlayer` | ✅ When `accountIDHash` is known (via save parser); falls back to "ban manually in-game once" message |
| `unbanPlayer` | ✅ By Steam ID (if known) or by name match |
| `kickPlayer` | Stub — Enshrouded only supports `/kick` from in-game admin chat |
| `sendMessage` / `teleportPlayer` / `giveItem` | Stub — no external API |
| Backups | ✅ Timestamped folders, retention pruning |
| SteamCMD updates | ✅ Wrapper around the existing `auto_update.bat` workflow |
| Server start / stop / restart | Optional (`manageServerProcess` flag); off by default so `Monitor.ps1` keeps owning the process |

## Architecture

The game runs **vanilla** — no DLL injection. The bridge runs as a separate Windows service alongside the server:

```
┌──────────────────────────────┐         ┌────────────────────────┐
│  enshrouded_server.exe       │         │  enshrouded-bridge     │
│  ──────────────────────────  │         │  ──────────────────    │
│  writes logs/                │ ──────▶ │  log tail              │
│  writes savegame/            │ ──────▶ │  save parser           │
│  reads enshrouded_server.json│ ◀────── │  ban manager           │
│  receives CTRL_C_EVENT       │ ◀────── │  win32 (koffi)         │
└──────────────────────────────┘         │                        │
                                          │  WebSocket             │
                                          └─────────┬──────────────┘
                                                    │
                                                    ▼
                                          wss://connect.takaro.io/
```

## Steam ID ↔ accountIDHash mapping

The trick that makes programmatic bans work: the world save shards (`savegame/3ad85aea-N`) embed a table of `(accountIDHash, characterName)` pairs. The bridge:

1. Periodically parses the latest shard and records `characterName → accountIDHash` mappings to `state/steam-hash-cache.json`.
2. When a player connects, the log tail gives us `(steamId, characterName)`. If we already know `characterName → hash` from the save, we record `steamId → hash`.
3. Once `steamId → hash` is known, `banPlayer` from Takaro can write to `bannedAccounts[]` directly.

For brand-new players, ban once in-game (`/ban` in admin chat) so the entry lands in the JSON. The next save parse picks up their hash, and from then on programmatic bans for that Steam ID work.

## Setup

```powershell
# 1. Install dependencies (needs Node 20+)
cd Bridge
npm install

# 2. Configure
copy TakaroConfig.example.txt TakaroConfig.txt
notepad TakaroConfig.txt   # paste your registrationToken, set paths

# 3. Build
npm run build

# 4. Run interactively to verify
npm start

# 5. Install as Windows service (elevated PowerShell)
.\service-install.ps1
```

## Config reference (`TakaroConfig.txt`)

| Key | Default |
|---|---|
| `registrationToken` | (required) |
| `serverName` | (required) |
| `enshroudedServerPath` | (required) e.g. `C:\GameServers\Enshrouded` |
| `enshroudedServerExe` | `<path>\enshrouded_server.exe` |
| `enshroudedServerJson` | `<path>\enshrouded_server.json` |
| `enshroudedLogPath` | `<path>\logs\enshrouded_server.log` |
| `enshroudedSavePath` | `<path>\savegame` |
| `steamCmdPath` | `C:\steamcmd\steamcmd.exe` |
| `backupDirectory` | `<path>\savegame_backups` |
| `manageServerProcess` | `false` (let `Monitor.ps1` own it) |
| `takaroWsUrl` | `wss://connect.takaro.io/` |
| `stateDirectory` | `./state` |

## Cutover from the DLL

One-time, server-stopped:
1. Stop the server (the DLL holds `takaro.dll` open, so it must be stopped to delete).
2. Delete `takaro.dll` and `winmm.dll` from the Enshrouded folder.
3. Install the bridge service per above.
4. Start the server.

After that single stop, every bridge change is `Restart-Service EnshroudedBridge` — game keeps running.

## Layout

```
Bridge/
├── src/
│   ├── index.ts              entry, signal handlers
│   ├── bridge.ts             orchestrator
│   ├── config.ts             TakaroConfig.txt loader
│   ├── logger.ts             winston rotating logs
│   ├── ws/                   Takaro WebSocket protocol + client
│   ├── server/               lifecycle, win32 (koffi), process tracking
│   ├── log-tail/             chokidar/tail wrapper
│   ├── players/              tracker + types
│   ├── save/                 KSC1 shard parser (character table)
│   ├── bans/                 enshrouded_server.json read/write + steam→hash cache
│   ├── backup/               timestamped folder backups
│   ├── update/               SteamCMD wrapper
│   └── handlers/             one entry per Takaro action
├── package.json
├── tsconfig.json
├── service-install.ps1       NSSM installer
└── TakaroConfig.example.txt
```
