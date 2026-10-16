# Enshrouded Server Manager - Takaro

Connects an Enshrouded dedicated server to [Takaro](https://takaro.io) with one file: `dbghelp.dll`, placed next to
`enshrouded_server.exe`. The mod runs inside the server and connects outbound to Takaro. Only the server needs it;
players join as usual.

It supports **Enshrouded 1.0** (game build 1267041) and the earlier build 1024233.

## Download

Get `takaro-enshrouded-plugin.zip` from this repo's
[Releases](https://github.com/mad-001/Enshrouded-Server-Manager-Takaro/releases). Every new version of the mod is
published there automatically. Full guide: https://mad-001.github.io/Enshrouded-Server-Manager-Takaro/

It is a community connector; the source is in
[`gettakaro/connectors` `games/enshrouded`](https://github.com/gettakaro/connectors/tree/main/games/enshrouded).

## Install

1. Stop the server and copy `dbghelp.dll` from the zip next to `enshrouded_server.exe`.
2. In Takaro, go to **Game servers**, click **Create new game server** and choose **Generic** to see your
   registration token. The server appears in Takaro by itself when it connects.
3. Start the server. It creates `takaro/plugin.json` next to `enshrouded_server.exe`. Paste your registration
   token into `registrationToken` and save; the mod connects within a few seconds.
4. `takaro/plugin.log` shows `connected to Takaro as "<name>"` and the server turns online in Takaro.

On Linux under Wine/Proton, set `WINEDLLOVERRIDES=dbghelp=n,b`. To remove the mod, stop the server and delete
`dbghelp.dll`.

## What it does

Tested in game on Enshrouded 1.0 on 2026-10-15:

- Player joined / left events, player list (with in-game character names), location and inventory
- Player chat to Takaro (and to Discord through a Takaro module), Discord and Takaro messages into game chat
- Give items, teleport players
- Kill events (creature and weapon) and death events (position)
- Kick, ban and unban, including Admin-group players
- Character levels: the console commands `levels` and `level <player>` give each online player's level and
  experience, so Takaro modules can act on them (for example, kicking a first-time player whose character is far
  above your regulars)

Messages from Takaro (and from Discord through a Takaro module) appear in game chat as a notice, styled like the
game's own join messages. Players show with their character name everywhere: joins, chat and the player list.

## Game updates

Everything that changes between game builds is in `takaro/enshrouded-gamedata.json` (one section per build; the
log prints `game build: <n>` at start). After a game update the mod works out the new build's section from the
game itself, saves it to that file with the note `derived automatically` and uses it, so the same DLL keeps
working. Any feature it could not set up shows as degraded in Takaro while the rest keeps running, and a newer
release brings it back.
