# Changelog

All notable changes to this project. Releases follow [semantic versioning](https://semver.org/); image tags drop the `v` (`v0.2.0` → `0.2.0`, `0.2`).

## [0.2.0] - 2026-10-24

### Added
- **3D character figures.** Every profile now shows a voxel Viking built from the player's body type, skin, hair, beard and equipped gear: helmet, armor, cape, weapon and shield. It's drawn with plain WebGL (`assets/voxel.js`, no libraries) with baked ambient occlusion and voxel edge lines for a pixel-art look, stands on a disc tinted by the biome the player is in, and turns slowly on its own. Drag it, or focus it and use the arrow keys, to turn it yourself. Double-click resets the view. Browsers without WebGL keep the flat SVG figure, and reduced-motion settings stop the idle spin.
- Longhouse server plugin (`mods/`, BepInEx, server-only): biome, appearance, visible gear and health for connected players, kills per creature (counted from Valheim's attacker marks) and pieces standing per player. Players install nothing, so achievements are unaffected.
- Changelog and security policy.

### Changed
- README rewritten: quick start, feature tour, screenshots, plugin comparison, configuration reference.
- Base image is now Node 24 LTS (`node:24-alpine`), and CI runs Node 24. Dependabot skips odd, non-LTS Node majors.
- The container healthcheck uses JSON notation (hadolint DL3025).
- GitHub Actions updated: checkout 7, setup-node 7, docker/login-action 4, deploy-pages 5, hadolint-action 3.5.0.
- Links point at the renamed [valheim-game-server](https://github.com/MrGuato/valheim-game-server) repo.

### Fixed
- Pieces were never counted on Valheim 1.0, which no longer fills the peer's player id. Plugin 0.3.1 reads the id stamped on the player's character instead, and does the first count about a minute after a player joins.

## [0.1.0] - 2026-10-22

First release: server status from the Steam query, in-game day, boss progress, sessions, deaths, leaderboards, heatmap, activity feed and armory-style profiles with drawn SVG figures. Published as `ghcr.io/mrguato/valheim-game-dashboard` for amd64 and arm64.
