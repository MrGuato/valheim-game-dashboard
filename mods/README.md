# Longhouse mods

Two small BepInEx plugins that give the dashboard more to show. Both are optional.

| | Installed on | Adds to the dashboard |
|---|---|---|
| **Longhouse.Server** (Tier 1) | the dedicated server only | biome, character figure (body, skin, hair), visible gear, health, "in a dungeon" / "asleep" |
| **Longhouse.Companion** (Tier 2) | each player's PC, opt-in | food buffs, stamina/eitr, rested and comfort, skills, lifetime stats, most-killed creature, favourite food, the world stats charts |

## How the data travels

The server plugin writes one `LH1 {json}` line per connected player to the server log every 30 seconds (only when something changed, or every 5 minutes). The collector already reads that log, so there's no new port, file or API.

The companion mod sends a summary once a minute **over the game connection** to the server plugin, which logs it the same way. The name on it is taken from the connection that sent it, so nobody can post stats for someone else, and the collector type-checks and clamps every field before using it. No web requests, no tokens. It reads the character's lifetime stats and changes nothing in the game.

## Achievements

Valheim 1.0 turns achievements off while `Game.isModded` is true. The standard loader, [BepInExPack_Valheim](https://thunderstore.io/c/valheim/p/denikson/BepInExPack_Valheim/), sets that flag for every modded game, and Iron Gate asks every mod to set it too.

- **Server plugin: no effect on anyone's achievements.** The flag is only checked on each player's own PC, and the server never sends it to clients.
- **Companion mod: achievements are off while BepInEx is installed on your PC**, with or without this mod. Your lifetime stats keep counting either way. Remove BepInEx (delete `winhttp.dll` and `doorstop_config.ini` in the Valheim folder) and achievements work again.

## Install

### Server plugin with lloesche/valheim-server

1. Set `BEPINEX=true` in the server's `.env` and recreate the container (`docker compose up -d`). The image downloads BepInExPack_Valheim on start.
2. Copy `Longhouse.Server.dll` to `config/bepinex/plugins/` and restart the container.
3. The server log shows `LH1 {"t":"hello","plugin":"0.2.0"}` once the world has loaded.

Settings end up in `config/bepinex/com.mrguato.longhouse.server.cfg` after the first start: `ScanSeconds` (default 30) and `AcceptCompanionStats` (default true).

### Companion mod (players)

1. Install [BepInExPack_Valheim](https://thunderstore.io/c/valheim/p/denikson/BepInExPack_Valheim/) (r2modman/Thunderstore Mod Manager, or unzip it into the Valheim folder). Read the achievements note above first.
2. Put `Longhouse.Companion.dll` in `BepInEx/plugins/`.
3. Join the server. Your profile fills in within a minute. Set `Enabled = false` in `BepInEx/config/com.mrguato.longhouse.companion.cfg` to stop sending.

It only talks to a server that runs the Longhouse server plugin; elsewhere it does nothing.

## Build

The mods compile against the game's own assemblies, which can't be redistributed, so they aren't in this repo.

```bash
mkdir -p .refs/managed .refs/bepinex
cp <valheim_server>/valheim_server_Data/Managed/*.dll .refs/managed/   # or the client's valheim_Data/Managed
cp <BepInExPack_Valheim>/BepInEx/core/*.dll .refs/bepinex/
docker run --rm -v "$PWD":/w -w /w/mods mcr.microsoft.com/dotnet/sdk:8.0 \
  sh -c 'for p in Server Companion; do dotnet build -c Release Longhouse.$p/Longhouse.$p.csproj -o out; done'
```

The DLLs land in `mods/out/`. Pass `-p:ValheimManaged=... -p:BepInExCore=...` to build against other folders.
