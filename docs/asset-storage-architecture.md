# cssOS Asset Storage Architecture

## Decision

Generated media, uploaded references, and future MV artifacts should **not** live permanently on the database server and should **not** rely on the `api-vm` local disk as the long-term store.

Recommended split:

1. `api-vm`
   - Keep only:
     - active run working directories
     - transient upload drafts
     - short-lived caches
     - delivery/export staging
   - Never treat its local disk as the durable home for all WAV/MP4 outputs.

2. Database server
   - Store only:
     - relational metadata
     - asset identifiers
     - logical paths / object keys
     - ownership / access-control / lifecycle state
   - Never store the media binaries themselves.

3. Dedicated asset storage
   - Durable home for:
     - final MV mp4
     - final mix wav/flac/mp3
     - preview clips
     - thumbnails / frame sequences
     - uploaded user references (audio, MIDI, MusicXML, score images)
   - Current production bucket:
     - `gs://cssstudio-gpu-cssos-assets-prod`
   - Runtime service account:
     - `cssos-assets-runtime@cssstudio-gpu.iam.gserviceaccount.com`
     - bucket roles: `storage.objectViewer`, `storage.objectCreator`
   - Preferred form:
     - object storage / S3-compatible bucket
     - or a dedicated high-capacity asset VM/NAS mounted behind a storage service

## Why

`api-vm` currently has only about `200 GB`, which is far too small for long-term MV retention once video generation volume grows.

Large media belongs in a storage layer that can:

- scale independently from API compute
- support lifecycle tiers
- survive API redeploys / VM replacement
- support signed download URLs or ticket-based download mediation
- replicate or back up separately from application state

## Recommended lifecycle

### Hot tier

- Location: dedicated object storage bucket or asset node
- Contents:
  - recent final MV
  - recent mix/master outputs
  - recent previews
  - active uploaded references
- Target window:
  - last `30-90` days of frequently accessed media

### Warm tier

- Location: cheaper object tier or slower asset volume
- Contents:
  - older final outputs still available to users
  - archived previews that can be restored on demand

### Cold tier

- Location: archive bucket / glacier-like tier / offline backup
- Contents:
  - old runs
  - superseded previews
  - large intermediate build outputs worth retaining for compliance but not for fast playback

## What should stay on api-vm

Safe to keep on `api-vm` temporarily:

- `/srv/cssos/shared/runs/<run_id>/build/...`
- upload draft scratch files
- temporary transcodes
- one-shot export bundles

Recommended generation shape:

- render intermediates locally on `api-vm`
- upload large final outputs to object storage immediately when a stage completes
- avoid using object storage as the live scratch disk for FFmpeg / shot assembly / stem rendering

Reason:

- local scratch is still much faster and simpler for active rendering
- durable storage should become the home of completed large artifacts, not transient write-heavy temp files

These should later be swept by lifecycle jobs:

- successful final artifacts copied to durable asset storage
- intermediate files pruned after retention window
- failed/incomplete runs cleaned aggressively

## Database responsibilities

The database should store rows like:

- `asset_id`
- `owner_user_id`
- `work_id`
- `run_id`
- `asset_kind`
- `storage_backend`
- `object_key`
- `mime_type`
- `bytes`
- `duration_ms`
- `checksum`
- `visibility`
- `retention_tier`
- `created_at`
- `last_accessed_at`

The database should not store:

- wav/mp4/png binaries
- large base64 payloads

## Download model

The current direction is correct:

- users should download media through system buttons
- buttons request a ticket / signed access grant
- the server resolves the asset key and returns a short-lived delivery URL or blob stream

That model becomes even more important once assets live in object storage instead of local files.

## Migration path

### Phase 1

- Keep current run builds on `api-vm`
- Keep DB storing logical paths only
- Introduce `asset_records` abstraction over path storage

### Phase 2

- Copy final artifacts from run dirs into dedicated asset storage
- Replace local file paths with logical asset keys
- Serve download/playback through ticketed asset resolver
- Move demo/example media into durable asset storage as well

### Phase 3

- Add lifecycle sweeper:
  - prune intermediates from `api-vm`
  - demote old assets to warm/cold tiers
  - retain only lightweight manifests locally

## Recommendation for cssOS now

Immediate rule:

- Do **not** plan to keep all generated MV/media on `api-vm`
- Do **not** put media binaries on the DB server

Short-term next step:

- keep `api-vm` as run workspace only
- introduce a dedicated durable asset store for final outputs and uploaded references

This keeps compute, metadata, and bulk media cleanly separated, which is the only safe shape once MV generation volume grows.
