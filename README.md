# Enshrouded Server Manager - Takaro

Connects an Enshrouded dedicated server to [Takaro](https://takaro.io) with one file: `dbghelp.dll`, placed next to
`enshrouded_server.exe`. The mod runs inside the server and connects outbound to Takaro. Only the server needs it;
players join as usual.

It supports **Enshrouded 1.0** (game build 1267041) and the earlier build 1024233.

## Download

Get `takaro-enshrouded-plugin.zip` from the latest Enshrouded release on
[gettakaro/connectors releases](https://github.com/gettakaro/connectors/releases). The mod is part of Takaro's
official connectors, so every new version is published there automatically. The source is in
[`games/enshrouded`](https://github.com/gettakaro/connectors/tree/main/games/enshrouded).

## Install

1. Stop the server and copy `dbghelp.dll` from the zip next to `enshrouded_server.exe`.
2. In Takaro, go to **Game servers**, click **Create new game server** and choose **Generic** to see your
   registration token. The server appears in Takaro by itself when it connects.
3. Start the server. It creates `takaro/plugin.json` next to `enshrouded_server.exe`. Paste your registration
   token into `registrationToken` and save; the mod connects within a few seconds.
4. `takaro/plugin.log` shows `connected to Takaro as "<name>"` and the server turns online in Takaro.

On Linux under Wine/Proton, set `WINEDLLOVERRIDES=dbghelp=n,b`. Keep the server on a supported game build by
switching automatic game updates off. To remove the mod, stop the server and delete `dbghelp.dll`.

## What it does

Tested in game on Enshrouded 1.0 on 2026-10-15:

- Player joined / left events, player list, location and inventory
- Player chat to Takaro (and to Discord through a Takaro module), Discord and Takaro messages into game chat
- Give items, teleport players
- Kill events (creature and weapon) and death events (position)
- Kick, ban and unban, including Admin-group players

Messages from Takaro appear in game chat under the name of an online player.

## Game updates

Everything that changes between game builds is in `takaro/enshrouded-gamedata.json` (one section per build; the
log prints `game build: <n>` at start). After a game update, adding a section there brings every feature back with
the same DLL; Takaro shows which features are waiting for it.
