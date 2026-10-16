# Enshrouded Server Manager - Takaro

Connects an Enshrouded dedicated server to [Takaro](https://takaro.io) with one file: `dbghelp.dll`, placed next to
`enshrouded_server.exe`. The mod runs inside the server and connects outbound to Takaro, so there is nothing else to
run and no port to forward. Players do not install anything.

It supports **Enshrouded 1.0** (game build 1267041) and the earlier build 1024233.

> This repo used to hold a Node.js bridge that read the server log. The in-game mod replaces it: the bridge could
> only see joins and leaves, the mod also handles chat, item delivery, teleports, kick and ban. The bridge code is
> still here for reference (see [Legacy bridge](#legacy-bridge)).

## Where the mod lives

The mod is part of Takaro's official connectors: [gettakaro/connectors `games/enshrouded`](https://github.com/gettakaro/connectors/tree/main/games/enshrouded).
Enshrouded 1.0 support is [gettakaro/connectors#524](https://github.com/gettakaro/connectors/pull/524); once it is
merged, Takaro publishes the release automatically.

## Download

From [gettakaro/connectors releases](https://github.com/gettakaro/connectors/releases), take
`takaro-enshrouded-plugin.zip` from the latest `enshrouded-vX.Y.Z` release (not a pre-release). Releases up to
v0.7.0 support game build 1024233 only; Enshrouded 1.0 support ships in the release after #524 is merged.

## Install

1. Stop the server and copy `dbghelp.dll` from the zip next to `enshrouded_server.exe`.
2. In Takaro, go to **Game servers**, click **Create new game server** and choose **Generic** to see your
   registration token. You do not create the server yourself; it appears in Takaro when it connects.
3. Start the server. It creates `takaro/plugin.json` next to `enshrouded_server.exe`. Paste your registration
   token into `registrationToken` and save; the mod connects within a few seconds, no restart needed.
4. `takaro/plugin.log` shows `connected to Takaro as "<name>"` and the server turns online in Takaro.

On Linux under Wine/Proton, set `WINEDLLOVERRIDES=dbghelp=n,b`. Turn off automatic game updates so the server stays
on a supported build. To remove the mod, stop the server and delete `dbghelp.dll`.

## What it does

Tested in game on Enshrouded 1.0 on 2026-10-15:

- Player joined / left events, player list, location and inventory
- Player chat to Takaro (and to Discord through a Takaro module), Discord and Takaro messages into game chat
- Give items, teleport players
- Kill events (creature and weapon) and death events (position)
- Kick, ban and unban, including Admin-group players

Enshrouded has no server sender for chat, so messages from Takaro appear under the name of an online player.

## Game updates

Everything that changes between game builds is in `takaro/enshrouded-gamedata.json` (one section per build; the
log prints `game build: <n>` at start). A game update needs a new section there, not a new DLL. Until then, features
whose game code moved switch themselves off and Takaro shows which ones.

## Legacy bridge

The Node.js bridge (`src/`, `package.json`, `service-install.ps1`) tails `logs/enshrouded_server.log` and edits
`enshrouded_server.json` for bans. It is no longer maintained; use the mod above, and do not run both on the same server.
