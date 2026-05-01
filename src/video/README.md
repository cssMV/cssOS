# cssMV Video Engine

Rust video engine for cssMV scene rendering, project thumbnail generation, MV composition, and visual consistency scoring.

## What It Does

- Renders one playable video clip per scene
- Generates an optional 3-5 second project thumbnail video
- Composes the full MV with the provided music track
- Validates duration alignment against `music.duration_secs`
- Produces continuity outputs for characters, style, shot plans, and scores

## Requirements

- Rust toolchain
- `ffmpeg` and `ffprobe` available in `PATH`

## Run

```bash
cargo run --bin cssmv-video-engine -- examples/video_project_input.json --output-json target/cssmv-video-engine/demo/result.json
```

## Test

```bash
cargo test
```

## Output

The engine writes media to:

```text
target/cssmv-video-engine/<project-id>/
```

and returns JSON with:

- `thumbnail`
- `scene_video_paths`
- `compose_result`
- `continuity_scores`
- `character_profiles`
- `normalized_style`
- `shot_plans`

## Notes

- `scene.duration_secs` is treated as source of truth for clip duration
- the final MV fails explicitly if scene totals do not match `music.duration_secs`
- thumbnail generation fails explicitly if enabled and outside the 3-5 second range
