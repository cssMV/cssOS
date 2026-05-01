# Training Automation Plan

## Goal

Keep music-model and video-model intake, scoring, bucketing, and training refresh running in the background without requiring daily manual clicks.

## Core loop

1. Import Suno channel assets to the asset server.
2. Import curated YouTube video pools to the asset server.
3. Rebuild intake manifests.
4. Score music quality and split `gold / silver / reject`.
5. Refresh the melody training pipeline.
6. Publish metrics and notify operators.

## Asset storage

- Use the asset bucket path, not local laptop storage.
- Default prefix:
  - `gs://cssstudio-gpu-cssos-assets-prod/training-assets`

## Safety rules

- Only administrator can hold unlimited background or automation privileges.
- Regular memberships may get finite queue and training-adjacent product access, but never infinite server-consuming rights.
- YouTube imports must stay on approved query pools from:
  - `/Users/jing/cssOS/config/youtube_training_query_whitelist.json`

## Suggested cadence

- Hourly light intake refresh
- Twice-daily heavier training pipeline refresh
- Nightly metrics rollup and drift check

## Success signal

- New work creation automatically uses the latest promoted model outputs.
- Quality metrics improve without requiring daily manual operator intervention.
