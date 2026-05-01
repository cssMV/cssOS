# cssOS Current Two-Server Topology

## Current machines

1. `api-vm`
   - API server
   - run worker / generation worker
   - transient run filesystem
   - short-lived caches and upload drafts

2. Database server
   - PostgreSQL only
   - relational metadata
   - no media binary storage

## Rule

With the current footprint, the database server should stay a database server only.

Do not put:

- final MV mp4
- final wav/flac/mp3
- preview videos
- thumbnails
- uploaded MIDI / MusicXML / score images / reference audio

on the DB server filesystem.

## Near-term plan before a dedicated asset server exists

### api-vm responsibilities

Keep on `api-vm` only:

- active run directories
- build outputs for in-flight jobs
- session upload drafts
- recent artifacts kept for short retention

Treat all of the above as **ephemeral working storage**, not permanent archive.

### database responsibilities

Keep in DB:

- work records
- run records
- artifact metadata
- storage keys / logical paths
- access control
- retention state

### cleanup requirement

Because `api-vm` has only about `200 GB`, the system needs aggressive cleanup even before full object storage is added:

- prune failed/incomplete run builds quickly
- expire temporary upload drafts
- move only final deliverables into a durable asset tier when available
- remove intermediate stems/frame caches after a short retention window

## Recommended next infrastructure step

The next machine/service should **not** be another DB node for media. It should be:

- object storage bucket, or
- dedicated asset VM / NAS mounted for bulk media

Preferred architecture:

- `api-vm` = compute / API
- DB server = metadata
- asset storage = bulk binaries

Current provisioned asset bucket:

- `gs://cssstudio-gpu-cssos-assets-prod`
- region: `us-east1`
- public access prevention: `enforced`
- uniform bucket-level access: `enabled`

Runtime access identity:

- `cssos-assets-runtime@cssstudio-gpu.iam.gserviceaccount.com`
- bucket roles: `storage.objectViewer`, `storage.objectCreator`
- recommended usage: attach this identity to `api-vm` / workers instead of distributing static keys
- uniform bucket-level access: `enabled`

## If Google-managed services are available

Use Google-managed scaling where it helps:

- database server can stay on managed / autoscaled storage for PostgreSQL
- media should go to Google Cloud Storage, not Cloud SQL disk

That gives:

- cheap large-capacity storage
- lifecycle rules
- signed URL or ticket-based download support
- separation between compute pressure and media growth

## Migration order

1. keep current run build flow on `api-vm`
2. start recording artifact metadata as storage-agnostic keys
3. add asset backend abstraction
4. move final outputs and uploaded references to durable asset storage
5. shorten local retention on `api-vm`

## Recommended generation/write path

Do not treat object storage as the primary scratch filesystem for heavy rendering.

Preferred pattern:

- in-flight render temp, stems, frame caches, shot assembly:
  - local on `api-vm`
- completed large outputs:
  - immediately mirrored or promoted to durable asset storage
- demo/example media:
  - stored in durable asset storage too, with local copies only as temporary compatibility mirrors

## Bottom line

With only the current two servers:

- use `api-vm` as temporary run workspace only
- use the DB server for metadata only
- plan the next expansion as a dedicated asset storage layer, not more DB disk
