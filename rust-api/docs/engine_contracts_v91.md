# cssMV Engine Contracts v91

This document locks the external command contract for real engine entrypoints.

## 1. CSS_MUSIC_CMD

Purpose:
Generate instrumental/background music wav for the run.

### Environment variables

- `CSS_LANG`
- `CSS_LYRICS_JSON` absolute path to input lyrics json
- `CSS_OUT_WAV` absolute path to output wav
- `CSS_TITLE_HINT` optional title hint string

### Expected output

The command MUST create file at `CSS_OUT_WAV`.

### Output requirements

- readable by ffmpeg
- non-empty
- wav container preferred
- sample rate recommended: `48000`
- duration recommended: `>= 2s`

### Exit code

- `0` means success
- non-zero means failure

## 2. CSS_VOCALS_CMD

Purpose:
Generate vocal/singing wav for a specific language and voice.

### Environment variables

- `CSS_LANG`
- `CSS_VOICE` (example: female, male, alto, tenor)
- `CSS_LYRICS_JSON`
- `CSS_OUT_WAV`
- `CSS_TITLE_HINT`

### Expected output

The command MUST create file at `CSS_OUT_WAV`.

### Output requirements

- readable by ffmpeg
- non-empty
- wav container preferred
- sample rate recommended: `48000`
- mono or stereo both acceptable
- duration recommended: `>= 2s`

### Exit code

- `0` means success
- non-zero means failure

## 3. Lyrics JSON input contract

Minimum accepted structure:

```json
{
  "schema": "css.lyrics.v1",
  "lang": "en",
  "title": "Neon Waltz",
  "lines": [
    { "t": 0.0, "text": "..." },
    { "t": 1.5, "text": "..." }
  ]
}
```

Requirements:

- `schema`: string
- `lang`: string
- `lines`: array
- each line contains:
  - `t`: number
  - `text`: string

Commands should ignore unknown fields.

## 4. Failure behavior

- If command exits non-zero, cssMV stage fails.
- If command exits zero but output file is missing/empty/invalid, cssMV stage fails.
- Stub fallback should only happen when real command is not configured, not when a configured real command fails.

## 0. CSS_LYRICS_CMD

Purpose:
Generate lyrics json for a target language.

### Environment variables

- `CSS_LANG`
- `CSS_TITLE_HINT`
- `CSS_PROMPT_JSON` absolute path to prompt/input json
- `CSS_OUT_JSON` absolute path to output lyrics json

### Expected output

The command MUST create file at `CSS_OUT_JSON`.

### Output requirements

The output MUST be valid JSON and include fields compatible with:

```json
{
  "schema": "css.lyrics.v1",
  "lang": "en",
  "title": "Neon Waltz",
  "lines": [
    { "t": 0.0, "text": "..." }
  ]
}
```

Required rules:

- `schema`: string
- `lang`: string
- `lines`: array
- `lines.length >= 1`
- each line includes:
  - `t`: number
  - `text`: string
- at least one line text must be non-empty after trim

### Exit code

- `0` means success
- non-zero means failure

## 5. CSS_RENDER_CMD

Purpose:
Render the final MV mp4 from video, mixed audio, and subtitles.

### Environment variables

- `CSS_LANG`
- `CSS_VIDEO_MP4` absolute path to input video mp4
- `CSS_MIX_WAV` absolute path to mixed audio wav
- `CSS_SUB_ASS` absolute path to subtitle ass file
- `CSS_OUT_MP4` absolute path to output final mv mp4

### Expected output

The command MUST create file at `CSS_OUT_MP4`.

### Output requirements

- readable by ffmpeg / ffprobe
- non-empty
- mp4 container preferred
- should contain:
  - at least one video stream
  - at least one audio stream
- recommended duration: `>= 2s`

### Input requirements

#### CSS_VIDEO_MP4

- must be a readable video file
- must contain at least one video stream

#### CSS_MIX_WAV

- must be a readable audio file
- must contain at least one audio stream

#### CSS_SUB_ASS

- must be a readable `.ass` subtitle file
- missing subtitles should be treated as a render failure if the render command requires them

### Exit code

- `0` means success
- non-zero means failure

## 6. Subtitles ASS contract

Purpose:
Provide timed subtitle overlay input for render.

Minimal requirements:

- file exists
- UTF-8 text recommended
- contains:
  - `[Script Info]`
  - `[Events]`
  - at least one `Dialogue:` line

Example minimal valid ASS:

```ass
[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,54,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,3,0,2,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:02.00,Default,,0,0,0,,cssMV
```
