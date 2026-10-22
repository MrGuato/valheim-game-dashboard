[![Made With Love](https://img.shields.io/badge/Made%20with%20%E2%9D%A4%EF%B8%8F-by%20Jonathan-red)](https://github.com/MrGuato)
[![Build and Publish](https://github.com/MrGuato/valheim-game-dashboard/actions/workflows/build.yml/badge.svg)](https://github.com/MrGuato/valheim-game-dashboard/actions/workflows/build.yml)
[![Lint](https://github.com/MrGuato/valheim-game-dashboard/actions/workflows/lint.yml/badge.svg)](https://github.com/MrGuato/valheim-game-dashboard/actions/workflows/lint.yml)
[![CodeQL](https://github.com/MrGuato/valheim-game-dashboard/actions/workflows/codeql.yml/badge.svg)](https://github.com/MrGuato/valheim-game-dashboard/actions/workflows/codeql.yml)
[![Security](https://github.com/MrGuato/valheim-game-dashboard/actions/workflows/security.yml/badge.svg)](https://github.com/MrGuato/valheim-game-dashboard/actions/workflows/security.yml)
[![Release](https://img.shields.io/github/v/release/MrGuato/valheim-game-dashboard)](https://github.com/MrGuato/valheim-game-dashboard/releases)
[![GHCR](https://img.shields.io/badge/GHCR-container%20image-blue)](https://github.com/MrGuato/valheim-game-dashboard/pkgs/container/valheim-game-dashboard)
[![Last Commit](https://img.shields.io/github/last-commit/MrGuato/valheim-game-dashboard)](https://github.com/MrGuato/valheim-game-dashboard/commits/main)

<p align="center"><img src="assets/logo.svg" width="110" alt="Longhouse logo"></p>

# Longhouse

A little dashboard for a Valheim dedicated server. I run a server for family and friends and wanted one page where everyone can see who's on, what day it is in-game, who's been playing the most and who keeps dying.

**Demo (fake data):** https://mrguato.github.io/valheim-game-dashboard/
**Docs:** https://mrguato.github.io/valheim-game-dashboard/docs.html

## What it shows

- Server status: online, players, uptime, version, in-game day and time, next save
- Player profiles laid out like a WoW armory, with a drawn character in the middle and gear slots around it
- Leaderboards (deaths, playtime, longest session, sessions)
- A "when do we play" heatmap and a feed of joins, leaves, deaths and raids
- Boss progress

Some of the profile stuff needs mods from [`mods/`](mods/README.md): a server plugin for biome, character figure and gear, and an opt-in companion mod for food, skills and lifetime stats. Without them you get the vanilla stats above and the character figures stay grey. The companion mod needs BepInEx on the player's PC, which turns Valheim's achievements off while it's installed; the server plugin doesn't affect anyone's achievements.

## Running it

It runs as a Docker container next to your Valheim container and reads the game's logs through a read-only Docker socket proxy. Nothing gets port-forwarded; I put it behind a Cloudflare Tunnel with Access so only my group can open it.

```bash
git clone https://github.com/MrGuato/valheim-game-dashboard.git
cd valheim-game-dashboard/deploy
cp .env.example .env
docker compose up -d
```

That starts it on `127.0.0.1:8080`. Point a tunnel's public hostname at it (`http://localhost:8080` if cloudflared runs on the host, `http://longhouse:8080` if it's a container on the same network). The docs have the full walkthrough.

Image: `ghcr.io/mrguato/valheim-game-dashboard` (amd64 + arm64)

Tested with `lloesche/valheim-server` on Valheim 1.0.20. It should also work with my own [Valheim_Game_Server](https://github.com/MrGuato/Valheim_Game_Server) image.

## Notes

- Valheim 1.0 saves worlds in a new chunked format, so boss progress can't be read from the save anymore. Set `LONGHOUSE_BOSSES` in `.env` instead.
- The in-game day comes from the log line the server writes when everyone sleeps, so it's an estimate until somebody sleeps.
- Steam IDs get hashed before anything is stored. No server address, passwords or real player data live in this repo; the demo uses made-up players.

## Dev

No build step and no npm dependencies.

```bash
python -m http.server 5178                                          # UI with mock data
VALHEIM_LOG_PATH=./valheim.log LONGHOUSE_DATA_DIR=./data npm start   # collector against a log file
npm test
```

MIT. Not affiliated with Iron Gate or Coffee Stain.
