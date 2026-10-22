# Longhouse server plugin

A small BepInEx plugin for the **dedicated server only**. Players install nothing.

It adds to the dashboard:

- each online player's biome, or "in a dungeon" / "asleep"
- the character figure: body type, skin and hair colour, hair and beard
- visible gear (head, chest, legs, cape, weapon, off-hand, utility), with quality where the game syncs it
- health
- kills per creature and boss kills for each player, and the "creatures slain" chart
- how many building pieces each player has standing in the world

Kills are counted from the day the plugin is installed. They aren't the character's lifetime numbers, which live only on each player's PC. Skills, food buffs and crafting never reach the server, so the dashboard doesn't show them.

## How it works

Everything comes from state the server already has:

- **Players:** the connected-player list and each player's synced character data (position, look, gear, health).
- **Kills:** Valheim marks a creature with every player who hits it. When the creature dies and is removed, the server is told, and the plugin credits each marked player who is online. A one-hit kill can be missed if the creature dies before its marks reach the server.
- **Pieces:** every building piece stores its builder. Every 10 minutes the plugin counts them for each player who has been online since the server started.

It writes `LH1 {json}` lines to the server log, which the collector already follows: no new port, file or API. It never sends anything to players' games.

## Achievements

The plugin can't affect anyone's achievements. Valheim decides those on each player's own PC: cheats used, cheat world modifiers, cheated items, and whether *that PC's* game is modded. Running BepInEx on the server marks only the server as modded, and the server never sends that to players. Players should keep BepInEx off their own PCs if they care about achievements; Longhouse doesn't need it there.

## Install

### MrGuato/Valheim_Game_Server or lloesche/valheim-server

1. Set `BEPINEX=true` in the server's `.env` and recreate the container (`docker compose up -d`).
2. Copy `Longhouse.Server.dll` to `config/bepinex/plugins/` and restart the container.
3. The server log shows `LH1 {"t":"hello","plugin":"0.3.0"}` once the world has loaded.

Settings end up in `config/bepinex/config/com.mrguato.longhouse.server.cfg` (`config/bepinex/com.mrguato.longhouse.server.cfg` with lloesche) after the first start: `ScanSeconds` (default 30) and `PiecesMinutes` (default 10, 0 turns piece counting off).

## Build

The plugin compiles against the game's own assemblies, which can't be redistributed, so they aren't in this repo.

```bash
mkdir -p .refs/managed .refs/bepinex
cp <valheim_server>/valheim_server_Data/Managed/*.dll .refs/managed/
cp <BepInExPack_Valheim>/BepInEx/core/*.dll .refs/bepinex/
docker run --rm -v "$PWD":/w -w /w/mods mcr.microsoft.com/dotnet/sdk:8.0 \
  dotnet build -c Release Longhouse.Server/Longhouse.Server.csproj -o out
```

The DLL lands in `mods/out/`. Pass `-p:ValheimManaged=... -p:BepInExCore=...` to build against other folders.
