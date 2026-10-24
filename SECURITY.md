# Security policy

## Reporting a problem

Please don't open a public issue for a security problem. Use GitHub's private reporting instead: **Security → Report a vulnerability** on this repo. I'll reply within a week and credit you in the release notes if you'd like.

Useful things to include: what you found, how to reproduce it, and which image tag or commit you tested.

## What's covered

- The container image `ghcr.io/mrguato/valheim-game-dashboard`
- The collector (`server/`), the web UI (`index.html`, `assets/`) and the deploy files (`deploy/`)
- The Longhouse server plugin in `mods/`
- The GitHub Actions workflows

Problems in Valheim itself go to [Iron Gate](https://valheim.com/support/). Problems in BepInEx go to that project.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.2.x   | ✅ |
| 0.1.x   | ❌ (update to 0.2) |

## How the project keeps itself safe

- The dashboard listens on `127.0.0.1` by default and is meant to sit behind a tunnel or reverse proxy you control. `LONGHOUSE_PASSWORD` adds HTTP basic auth, compared in constant time.
- Docker access goes through a socket proxy that only allows reading container state and logs (`CONTAINERS=1`, `POST=0`). The collector never sees the Docker socket itself and never touches world files.
- Responses carry a strict Content-Security-Policy (`default-src 'self'`), `X-Frame-Options: DENY`, `nosniff` and `no-referrer`.
- Steam IDs are hashed before they're stored. The server address is hidden unless `LONGHOUSE_HIDE_ADDRESS=false`.
- The image runs as the unprivileged `node` user on Node 24 LTS (Alpine), with npm, yarn and corepack removed. There are no npm dependencies.
- No secrets live in the repo. `.env` is gitignored.
- Every push and pull request runs hadolint, CodeQL, gitleaks (secret scanning) and Trivy (repo config and the built image). Dependabot opens weekly updates for the base image and GitHub Actions.
