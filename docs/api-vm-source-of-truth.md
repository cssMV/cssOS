# api-vm Source Of Truth

This file is the single source of truth for cssOS deployment facts on `api-vm`.

## Access

- SSH target: `api-vm`
- SSH auth: passwordless login is already configured

## Canonical server root

- Server root: `/srv/cssos`
- Canonical directories:
  - `/srv/cssos/current`
  - `/srv/cssos/repo`
  - `/srv/cssos/releases`
  - `/srv/cssos/shared`
  - `/srv/cssos/bin`

## Frontend source of truth

- Live frontend directory: `/srv/cssos/current/public`
- Frontend changes that the user will verify must be synced here first

## Rust backend source of truth

- Rust workspace: `/srv/cssos/repo/rust-api`
- Live service binary: `/usr/local/bin/cssos-rust-api`
- Service name: `cssos-rust-api`

## Environment

- Environment file: `/etc/cssos.env`
- Do not guess other env locations for remote deployment

## Rules

- Do not treat `/home/jing`, `/home/cssos`, or other home directories as deployment targets
- Do not deploy user-facing frontend changes anywhere except `/srv/cssos/current/public`
- Do not deploy Rust source changes anywhere except `/srv/cssos/repo/rust-api`
- Use this file first when remote path or env questions come up
