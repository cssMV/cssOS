# Database Backup & Disaster Recovery (Wave 102)

Daily `pg_dump` of the cssos postgres database is uploaded to Cloudflare R2 and
logged in the `db_backups` table. R2 retention is 30 days (older objects under
`backups/postgres/` are pruned at the end of every backup tick).

## Pieces

- **Migration** `migrations/054_db_backups.sql` — `db_backups` log table.
- **Backup script** `scripts/backup-postgres.mjs` — spawns
  `pg_dump --format=custom --no-owner --no-acl --compress=9` and streams the
  binary output to R2 via `@aws-sdk/lib-storage` `Upload` (multipart). Writes
  size + sha256 + duration + status to `db_backups`. Calls
  `pruneOldBackups(30)` at the end.
- **Restore script** `scripts/restore-postgres.mjs` —
  - `--list` lists last 10 backups
  - `--key=...` picks a specific R2 object (default = latest `ok` row)
  - `--target-db=postgres://...` overrides target (default = `DATABASE_URL`)
  - downloads to `/tmp/cssos-restore-*.dump` then runs
    `pg_restore --clean --if-exists --no-owner --no-acl`.
- **Roundtrip smoke test** `scripts/test-backup-roundtrip.mjs` — creates a
  temp DB, inserts a row, dumps, drops + recreates, restores, verifies row
  is present, drops the temp DB. Requires the `DATABASE_URL` user to have
  `CREATE DATABASE` / `DROP DATABASE` privileges (e.g. a superuser).
- **Scheduler** in `src/index.ts` fires `backupTick()` daily at 02:00 UTC and
  shells out to the backup script (one hour before the existing sample-cron at
  03:00 UTC).
- **Admin endpoints**:
  - `GET /api/admin/db/backups?limit=20` — most recent backup rows.
  - `POST /api/admin/db/backup-now` — trigger an immediate backup (admin token).

## Required env

- `DATABASE_URL`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET=cssos-artifacts`
- `pg_dump` / `pg_restore` on `PATH` (override with `PG_DUMP_BIN` /
  `PG_RESTORE_BIN`). On Debian/Ubuntu this is `/usr/bin/pg_dump`.

## R2 layout

```
backups/postgres/2026-05-08/cssos-2026-05-08T02-00-00-000Z.dump
```

## Manual run

```sh
# one-off backup
node scripts/backup-postgres.mjs

# list recent backups
node scripts/restore-postgres.mjs --list

# restore latest into a test DB
node scripts/restore-postgres.mjs --target-db=postgres://localhost/cssos_restore_test

# end-to-end smoke test (requires a superuser DATABASE_URL)
node scripts/test-backup-roundtrip.mjs
```
