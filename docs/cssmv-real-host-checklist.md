# CSSMV Real Host Checklist

## Chosen concrete stack

- Local Mac instrument / FX / mix host: `Carla`
- US `api-vm` instrument / FX / mix host: `carla-headless`
- Local and server singer host bridge: `DiffSingerMiniEngine`

## Local Mac shortest path

1. Install Carla on macOS.
2. Put `DiffSingerMiniEngine` in a stable path such as `~/.cssmv-hosts/DiffSingerMiniEngine`.
3. Prepare Carla session templates under `~/.cssmv-hosts/carla/`.
4. Source `scripts/cssmv-host-env.local.example.sh`.
5. Replace the stage hooks with your real Carla / singer commands.
6. Run `npm run cssmv:smoke-free-host`.
7. Confirm `render.host-probe.json` moves at least from `unresolved` to env-backed adapter paths.

## US server shortest path

1. Install `carla-headless` on the `api-vm`.
2. Create a dedicated Python venv for the singer engine.
3. Place `DiffSingerMiniEngine` under `/srv/cssmv-hosts/DiffSingerMiniEngine`.
4. Prepare Carla session templates under `/srv/cssmv-hosts/carla/`.
   Repo skeletons live in `/Users/jing/cssOS/scripts/carla-templates/` and can be copied to the server as:
   `instrument-template.carxp`, `vocal-fx-template.carxp`, `mix-template.carxp`.
5. Source `scripts/cssmv-host-env.api-vm.example.sh` in the service environment.
6. Run `npm run cssmv:smoke-free-host` from the deployed checkout.

## Current adapter status

- The Carla `instrument_host` adapter now prepares a runtime session package and can execute a real render command through `CSSMV_CARLA_INSTRUMENT_RENDER_CMD`.
- The DiffSinger `vocal_source_host` adapter now prepares a runtime request package and can execute a real render command through `CSSMV_DIFFSINGER_RENDER_CMD`.
- The Carla `vocal_fx_host` adapter now executes a real render command through `CSSMV_CARLA_VOCAL_FX_RENDER_CMD`.
- The Carla `mix_host` adapter now executes a real render command through `CSSMV_CARLA_MIX_RENDER_CMD`.
- If the render command exits `0` and writes the expected artifacts, CSSMV will treat that stage as truly host-rendered.

## Wrapper contract

- Top-level envs now point at stable wrapper scripts instead of calling the mock helpers directly.
- The Carla wrapper prepares a per-run `session.carxp` from a stage template and then hands off to `CSSMV_CARLA_STAGE_RENDER_CMD_INSTRUMENT`, `CSSMV_CARLA_STAGE_RENDER_CMD_VOCAL_FX`, or `CSSMV_CARLA_STAGE_RENDER_CMD_MIX`.
- The DiffSinger wrapper accepts either `CSSMV_DIFFSINGER_RENDER_HTTP_URL` or `CSSMV_DIFFSINGER_CLI_TEMPLATE`.
- The `api-vm` example now points its singer CLI template at `scripts/cssmv-diffsinger-submit-render.py`, which speaks the engine's real `/submit -> /query -> /download` flow when a `submit.request.json` sidecar is present.
- The runtime now writes `submit.request.json` with a fallback lyric phoneme bridge, so the singer host receives a real `model + phonemes + f0 + speedup` request body even before a richer language-specific phonemizer lands.

## Dev smoke note

- For local smoke only, you can set `CSSMV_DIFFSINGER_SKIP_ONNXRUNTIME_CHECK=1` to verify the runner path before the real engine environment is fully installed.
- Keep that variable unset in real deployments so the adapter still proves `onnxruntime` is actually available.

## `api-vm` DiffSinger blocker

- `cssmv-diffsinger.service` can be healthy while `/models` is still empty. That means the HTTP bridge is alive, but `assets/acoustic/*.onnx` is still missing.
- The current `api-vm` acoustic asset folder contains `1215_opencpop_ds1000_fix_label_nomidi/config.yaml` and `model_ckpt_steps_320000.ckpt`, not a MiniEngine-ready `1215_opencpop_ds1000_fix_label_nomidi.onnx`.
- A fresh clone of `DiffSinger` `main` includes the modern acoustic exporter, but it no longer ships the legacy config graph that this checkpoint expects.
- A clone of `DiffSinger` `v1.4.0` includes the matching legacy configs and ONNX export docs, but that export path produces the old diff-decoder style ONNX flow instead of the single-file acoustic model that `DiffSingerMiniEngine` enumerates.
- So the real blocker is not just “convert ckpt to any onnx”; it is “obtain or build a MiniEngine-compatible acoustic `.onnx` for this checkpoint family.”
- On `2026-03-27`, we did manage to export a legacy diff-decoder ONNX on `api-vm` with `DiffSinger-v1.4.0` plus `torch 1.13.1`, after stripping the obsolete `example_outputs` kwarg and forcing `opset_version=14`.
- That exported file exists at `/tmp/1215_opencpop_ds1000_fix_label_nomidi.diff_decoder.t113.op14.onnx` and loads in ONNX Runtime.
- Its runtime signature is `condition[1, n_frames, 256] + speedup -> mel`, which proves the old checkpoint can be exported, but also proves it is not directly interchangeable with the MiniEngine acoustic contract.
- The MiniEngine acoustic contract is `tokens + durations + f0 + speedup -> mel`, so a real bridge still needs a front-stage conditioning generator instead of just a file rename.
- The repo now includes `scripts/cssmv-diffsinger-generate-condition.py`, which turns `submit.request.json` into `condition.npy` by loading the legacy `model.fs2` `ParameterEncoder` from `DiffSinger-v1.4.0`.
- The repo also now includes `scripts/cssmv-diffsinger-legacy-bridge.py`, which chains `submit.request.json -> condition.npy -> legacy diff-decoder ONNX -> mel.npy` for bridge experiments on `api-vm`.
- That bridge now also supports an optional post-`mel.npy` vocoder handoff through `CSSMV_DIFFSINGER_LEGACY_VOCODER_CMD`; when configured and successful, it records a real `wav` path in `legacy-bridge.summary.json`.
- The repo now includes `scripts/cssmv-diffsinger-vocode-mel.py`, a direct `mel.npy + submit.request.json -> wav` wrapper for the MiniEngine NSF-HiFiGAN vocoder on `api-vm`.
- On `2026-03-27`, that bridge did produce a real short-form `mel.npy` on `api-vm`: `/tmp/cssmv-bridge-short/mel.npy`, with `conditionShape [1, 36, 256]` and `melShape [1, 36, 128]`.
- On `2026-03-27`, the long-form bridge also proved its chunked write path on `api-vm`: `/tmp/cssmv-bridge-full-chunked-v4/` emitted multiple `chunks/mel.chunk.*.npy` files plus `legacy-bridge.progress.json`.
- The `128`-frame chunk size with `16` frames of overlap was the fastest configuration so far to surface consecutive long-form chunks on `api-vm`, so the `api-vm` env sample now pins `CSSMV_DIFFSINGER_LEGACY_CHUNK_FRAMES=128` and `CSSMV_DIFFSINGER_LEGACY_CHUNK_OVERLAP=16`.
- The current remaining risk is throughput, not contract mismatch: the long-form bridge is now observable and incremental, but it still needs more runtime to finish the full `mel.npy` on CPU.
- The next practical host step after `mel.npy` is a vocoder handoff. `CSSMV_DIFFSINGER_LEGACY_VOCODER_CMD` receives `{{MEL_NPY}}`, `{{OUTPUT_WAV}}`, `{{SUMMARY_JSON}}`, `{{SUBMIT_REQUEST}}`, and `{{OUTPUT_DIR}}`.
- `scripts/cssmv-diffsinger-bridge-status.py <bridge_output_dir>` now provides a compact summary of `completedChunks`, `completedFrames`, `completionRatio`, `partialMelShape`, `framesPerSec`, and ETA fields for any in-flight bridge output directory.
- `scripts/cssmv-diffsinger-bridge-watch.py <bridge_output_dir> [interval_sec]` and `scripts/cssmv-diffsinger-bridge-watch.sh <bridge_output_dir> [interval_sec]` provide a repeating one-line watcher for long-running bridge jobs.
- `scripts/cssmv-diffsinger-start-bridge.sh <submit_request.json> <output_dir> [timeout_sec]` starts the legacy bridge in the background with `nohup`, writes `bridge.pid` and `bridge.log`, and is the preferred `api-vm` entrypoint for runs longer than the short interactive SSH window.

## What “done” looks like next

- `instrument_host` resolves to the plugin-host adapter, emits `hosts/carla/instrument/session.manifest.json`, and exits `0` only after an actual render/export step.
- `vocal_source_host` resolves to the singer adapter and writes `vocal.lead.wav`.
- `vocal_fx_host` resolves to the FX adapter and writes `vocal.lead.fx.wav`.
- `mix_host` resolves to the mix adapter and writes `mix.wav` plus `mastering.report.json`.
