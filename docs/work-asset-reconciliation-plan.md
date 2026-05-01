# Work Asset Reconciliation Plan

## Why This Exists

We have two separate questions that should always have a single answer:

1. "Which works exist?"
2. "Where do the media files for those works live?"

Right now those answers are split across different systems:

- `user_works` is the active metadata table.
- `works` exists but is effectively unused.
- `work_assets` exists but is empty in production.
- `/srv/cssos/shared/runs/<run_id>/...` still holds historical local run output.
- `/srv/cssos/shared/assets/...` holds a mix of gallery/demo/training media.

That split is why we can generate material, see files on disk, and still fail to
see a coherent record in the works center.

## What We Confirmed

Observed on `api-vm` on `2026-04-15`:

- `public.works` has `0` rows.
- `public.user_works` is the live metadata table.
- `public.work_assets` has `0` rows.
- Recent `user_works.source_run_id` values are mostly UUID-style, not
  `run_2026...` directory ids.
- Recent `user_works` rows usually contain:
  - `cover_image` as an inline `data:image/...` payload
  - `preview_image_url` as an inline `data:image/...` payload
  - no `preview_video_url`
- The latest `user_works.source_run_id` values do not resolve to local
  `/srv/cssos/shared/runs/<source_run_id>` directories.
- `/srv/cssos/shared/assets/examples/manifest.json` is not a canonical mapping
  from recent `user_works` to media assets.

This means:

- recent work metadata is reaching the database,
- but durable media asset registration is not,
- and old file-system assumptions no longer explain recent output.

## Current Failure Mode

The current write path stores work metadata like this:

- write/update `user_works`
- store `cover_image`
- store `preview_image_url`
- optionally store `preview_video_url`

But there is no required follow-up step that says:

- upload final media to durable asset storage
- create a canonical asset row
- link that asset row back to the work

Because of that, we get "works exist, but media lineage is fuzzy."

## Canonical Model Going Forward

### Metadata

Use `user_works` as the canonical work metadata table.

Reason:

- the active app code already reads and writes `user_works`
- the latest production rows are already there
- `works` is not carrying current traffic

### Asset Registry

Use `work_assets` as the canonical asset registry, but re-anchor it to
`user_works(id)` instead of the unused `works(id)`.

Each completed media object should have at least one row in `work_assets`.

Recommended asset types:

- `cover_image`
- `preview_image`
- `preview_video`
- `final_audio`
- `final_video`
- `lyrics_package`
- `stems_archive`

Recommended `meta` fields:

- `storage_backend`
- `object_key`
- `mime_type`
- `bytes`
- `duration_ms`
- `source_run_id`
- `created_by_stage`
- `retention_tier`

### Storage

The durable home for media must be asset storage, not `api-vm`.

Target:

- metadata in PostgreSQL
- media in asset storage / bucket
- only active scratch and short-lived build trees on `api-vm`

## Rules We Should Enforce

### Rule 1

`source_run_id` must point to a real, resolvable generation lineage.

If it is a run directory id, the resolver should find a run directory.

If it is a UUID from a newer pipeline, there must be a separate resolver table or
documented service that can map that UUID to durable assets.

### Rule 2

No completed work should rely on inline data URLs as its only asset representation.

Inline preview images are acceptable as UI fallback only.

They are not sufficient as the canonical storage contract.

### Rule 3

Every completed or published work should have at least:

- one metadata row in `user_works`
- one or more durable asset rows in `work_assets`
- file objects stored outside `api-vm`

### Rule 4

`api-vm` run directories are scratch space.

They are allowed to exist during generation and debugging, but they are not the
long-term source of truth.

## Proposed Rollout

### Phase 1: Audit And Visibility

- add a repeatable audit command for `user_works`, `work_assets`, `runs`, and
  `shared/assets`
- identify rows with:
  - no durable asset row
  - inline-only preview fields
  - non-resolvable `source_run_id`

Implemented helper:

- [audit_work_asset_reconciliation.mjs](/Users/jing/cssOS/scripts/audit_work_asset_reconciliation.mjs)

### Phase 2: Schema Reconciliation

- treat `user_works` as canonical
- migrate `work_assets.work_id` to reference `user_works(id)`
- add uniqueness on `(work_id, asset_type)` so each work has one current asset
  pointer per asset kind

### Phase 3: Write-Path Fix

When generation completes:

1. upload final media to durable asset storage
2. write or upsert `work_assets` rows
3. store only durable asset references in `user_works`
4. keep inline thumbnails only as optional fallback

This should happen from the same code path that currently updates
`user_works.source_run_id`, `cover_image`, `preview_image_url`, and
`preview_video_url`.

### Phase 4: Backfill

- scan recent `user_works`
- locate corresponding media where possible
- upload missing final outputs into durable storage
- create `work_assets` rows
- replace inline or local-only references with durable asset references

Implemented helper:

- [backfill_work_assets.mjs](/Users/jing/cssOS/scripts/backfill_work_assets.mjs)

Suggested first run:

```bash
DATABASE_URL=... node scripts/backfill_work_assets.mjs
```

Suggested execute run on `api-vm` after reviewing dry-run output:

```bash
DATABASE_URL=... WORK_ASSET_BACKFILL_LIMIT=50 node scripts/backfill_work_assets.mjs --execute
```

### Phase 5: Retention

After durable asset registration is verified:

- prune successful local run media from `api-vm`
- keep only:
  - recent in-flight scratch data
  - short debug window
  - lightweight manifests

## How This Supports A Pure Rust Backend

This also unlocks gradual backend consolidation:

1. Rust becomes the canonical owner of run state and asset resolution.
2. Node can shrink to frontend/static delivery.
3. Nginx can eventually serve static frontend assets directly.
4. The remaining backend surface can move behind Rust APIs and Rust asset
   tickets.

The important point is that "pure Rust" is not just an API rewrite. It depends on
having one coherent work metadata model and one coherent asset registry model.

## Immediate Recommendation

The next concrete implementation step should be:

1. keep `user_works` as the active metadata table
2. start writing canonical `work_assets` rows for every new completed work
3. stop treating inline preview images as the durable asset contract
4. move final media into asset storage as soon as a work is completed

Once those four rules are in place, the works center, the file system, and the
database will stop disagreeing about where a work actually lives.
