# Enshrouded Server Manager - Takaro

Connects an Enshrouded dedicated server to [Takaro](https://takaro.io) with one file: `dbghelp.dll`, placed next to
`enshrouded_server.exe`. The mod runs inside the server and connects outbound to Takaro. Only the server needs it;
players join as usual.

It supports **Enshrouded 1.0** (game builds 1267041 and 1269579) and the earlier build 1024233.

## Download

**[Download and install guide → mad-001.github.io/Enshrouded-Server-Manager-Takaro](https://mad-001.github.io/Enshrouded-Server-Manager-Takaro/)**

It is a community connector; the source is in
[`gettakaro/connectors` `games/enshrouded`](https://github.com/gettakaro/connectors/tree/main/games/enshrouded).

## Install

1. Stop the server and copy `dbghelp.dll` from the zip next to `enshrouded_server.exe`.
2. In Takaro, go to **Game servers**, click **Create new game server** and choose **Generic** to see your
   registration token. The server appears in Takaro by itself when it connects.
3. Start the server. It creates `takaro/plugin.json` next to `enshrouded_server.exe`. Paste your registration
   token into `registrationToken`, put your server's name into `identityToken` and save; the mod connects within
   a few seconds:

   ```json
   {
     "registrationToken": "paste-your-token-here",
     "identityToken": "name-your-server"
   }
   ```

   Takaro creates the game server under that name and recognizes it by it from then on, so pick a name no other
   server in your Takaro uses and keep it.
4. `takaro/plugin.log` shows `connected to Takaro as "<name>"` and the server turns online in Takaro.

On Linux under Wine/Proton the setting below is required (see [Linux: Wine and Proton](#linux-wine-and-proton)).
To remove the mod, stop the server and delete `dbghelp.dll`.

## Linux: Wine and Proton

The mod works under 64-bit Wine (wine64 or a WoW64 build) and Proton, but it needs one setting. Wine and Proton
ship their own `dbghelp.dll` and by default use it instead of the one next to `enshrouded_server.exe`. Without
the setting the mod is never loaded: no `takaro/plugin.log`, no `[Takaro]` lines in the console, and the server
runs as if nothing were installed.

**Running Wine yourself (no Docker)?** The simplest fix is to set it once in Wine's own settings; nothing else
needs to change. As the same Linux user that runs the server (add `WINEPREFIX=/path/to/prefix` in front if you
use your own prefix):

```bash
winecfg
```

→ **Libraries** tab → type `dbghelp` under "New override for library" → **Add** → select it → **Edit** →
**Native then Builtin** → OK. Or the same in one command:

```bash
wine reg add 'HKCU\Software\Wine\DllOverrides' /v dbghelp /d native,builtin /f
```

Then restart the server. Otherwise, set this environment variable on the game server so Wine loads the mod first:

```text
WINEDLLOVERRIDES=dbghelp=n,b
```

| How your server runs | Where to set it |
|---|---|
| Started by hand | `WINEDLLOVERRIDES="dbghelp=n,b" wine64 enshrouded_server.exe` (or `wine`) |
| systemd service | Under `[Service]`: `Environment=WINEDLLOVERRIDES=dbghelp=n,b`, then `systemctl daemon-reload` and restart |
| Docker Compose | Under `environment:` of the server: `WINEDLLOVERRIDES: "dbghelp=n,b"` |
| `docker run` | `-e WINEDLLOVERRIDES="dbghelp=n,b"` |
| Unraid template | Edit the container, add a **Variable**: key `WINEDLLOVERRIDES`, value `dbghelp=n,b` |
| Pterodactyl, AMP or another panel | The server's environment / startup variables |
| Your own start script | `export WINEDLLOVERRIDES="dbghelp=n,b"` before `wine enshrouded_server.exe` |

If your image already sets `WINEDLLOVERRIDES`, add the mod to that value with a semicolon instead of replacing
it, for example `dbghelp=n,b;mscoree,mshtml=`. Restart the server after the change.

**Can't set the variable?** Some images overwrite it in their start script. Store the same setting once in the
server's Wine prefix instead (run it as the user the server runs as, with the server's `WINEPREFIX`; for Docker,
inside the container), then restart the server:

```bash
wine reg add 'HKCU\Software\Wine\AppDefaults\enshrouded_server.exe\DllOverrides' /v dbghelp /d native,builtin /f
```

A prefix that is recreated (new container volume, reinstall) loses this; the variable does not.

**Check that it loaded.** `takaro/plugin.log` appears and shows `connected to Takaro`. If there is no
`plugin.log` at all, Wine still used its own copy. To see which one it used, start the server once with
`WINEDEBUG=+loaddll` added: a `Loaded` line for the `dbghelp.dll` in the server folder ending in `: native` means
the mod loaded; a line for `C:\windows\system32\dbghelp.dll` ending in `: builtin` means the setting did not reach
the server. Remove `WINEDEBUG` again afterwards.

**Wine versions.** Wine development releases from 11.8 on usually load the mod without the setting; older Wine,
including stable Wine 11.0, and Proton need it. Set it on every version; it does no harm.

## What it does

Tested in game on Enshrouded 1.0 on 2026-10-15:

- Player joined / left events, player list (with in-game character names), location and inventory
- Player chat to Takaro (and to Discord through a Takaro module), Discord and Takaro messages into game chat
- Give items (the console command `give <player> <itemCode> [amount] [level]` can also set the item level),
  teleport players
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
working. The item list follows the same way: on a new build the mod rebuilds it once from the server's own
`enshrouded_server.kfc` and saves it as `takaro/enshrouded-items.json`, so giving items and the item catalogue
keep working. Any feature it could not set up shows as degraded in Takaro while the rest keeps running, and a newer
release brings it back.
