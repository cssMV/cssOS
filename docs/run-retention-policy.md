# cssOS Run Retention Policy

## Goals

- Keep the main UI and active run playback fast.
- Stop `api-vm` from becoming the permanent home for WAV/MV artifacts.
- Separate **hot local execution storage** from **durable asset storage**.

## Current pressure snapshot

Observed on `api-vm`:

- root disk: `194G`
- used: `113G`
- available: `82G`
- `/srv/cssos/shared/runs`: about `51G`
- `/srv/cssos/releases`: about `17G`

This means:

- expansion is **not yet urgent**
- migration and cleanup are **already justified**

## Lifecycle tiers

### Active

- Location:
  - local `api-vm` run directories
- Target window:
  - newest `0-7` days
  - in-flight / recent debugging runs
- Policy:
  - keep full run tree locally
  - no pruning of build outputs

### Warm

- Location:
  - local `api-vm` plus GCS mirror
- Target window:
  - `7-30` days
- Policy:
  - mirror run directories to `gs://cssstudio-gpu-cssos-assets-prod/runs/<run_id>/...`
  - keep local copy until storage-backed artifact resolution is fully live

### Cold

- Location:
  - object storage only
- Target window:
  - `30+` days
- Policy:
  - retain object storage copy plus lightweight metadata
  - remove local run build once all artifact reads resolve by `asset_key`

## Release retention

Releases should not accumulate indefinitely.

- keep:
  - current target
  - newest `2-3` release directories
- prune:
  - older release directories

This is the fastest safe local-disk recovery lever.

## Suggested immediate operations

1. Mirror successful/completed runs older than `14` days into GCS.
2. Keep local runs intact for now.
3. Prune old releases down to current + newest `3`.
4. Re-evaluate disk usage.
5. Only expand disk if sustained usage still trends above `75%`.

## Tooling

- [archive-runs-to-gcs.sh](/Users/jing/cssOS/scripts/archive-runs-to-gcs.sh)
- [prune-old-releases.sh](/Users/jing/cssOS/scripts/prune-old-releases.sh)

## Important safety rule

Do not delete local run artifacts until all of these are true:

- artifact download/playback can resolve from `asset_key`
- worker/debug tooling no longer assumes local-only run paths
- object storage mirror for target runs has been verified
