# cssOS ElevenLabs Music sidecar

Tiny FastAPI service that wraps the official `elevenlabs` Python SDK so the
Rust backend can issue `composition_plan` music generation calls without
hand-crafting the constantly-shifting JSON schema.

## Why a sidecar

ElevenLabs Music's `/v1/music/compose` endpoint accepts two body shapes:

1. **flat** — `prompt + music_length_ms` — easy to send from anywhere, but
   the model treats lyrics as part of the *style description* and produces
   ambient soundscapes instead of singing them.
2. **composition_plan** — `{positive_global_styles, sections[]}` — tells the
   model "here are the verses, here is the chorus, here are the lines to
   sing in each section". This is the path that produces a real song with
   vocals.

The composition_plan field names drift between SDK releases. Hand-crafting
the JSON in Rust kept tripping `422 Unprocessable Entity`. The official
Python SDK tracks the schema for us — running it as a localhost-only
sidecar is the cleanest way to use it without rewriting the Rust adapter
every time ElevenLabs ships a new field.

## Endpoints

```
GET  /healthz          → {"ok": true, "sdk_version": "...", "api_key_set": true}
POST /compose          → 200 audio/mpeg (raw mp3 bytes)
                       | 4xx/5xx JSON {"ok": false, "error": "...", "detail": "..."}
```

`POST /compose` body:

```json
{
  "title":             "（informational）",
  "lyrics":            "[Verse 1]\n... 你的中文歌词 ...\n[Chorus]\n...",
  "style":             "Chinese pop ballad, female lead, piano + strings",
  "duration_ms":       180000,
  "language":          "zh",
  "make_instrumental": false,
  "output_format":     "mp3_44100_192"
}
```

The sidecar parses the lyric body into Verse/Chorus/Bridge sections,
distributes `duration_ms` proportionally, and forwards the result through
`elevenlabs.client.ElevenLabs(...).music.compose(composition_plan=..., ...)`.

## Local dev

```bash
cd eleven-music-sidecar
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
ELEVENLABS_API_KEY=sk_xxxx uvicorn main:app --host 127.0.0.1 --port 8765
# In another terminal:
curl -s http://127.0.0.1:8765/healthz | jq .
```

## Production deploy

The service is deployed at `/srv/cssos/eleven-music-sidecar/` on `api-vm`
and run via `systemctl --user enable eleven-music-sidecar` (or as the
`jing` user via the system unit installed in `/etc/systemd/system/`).

The API key is kept in `/etc/cssos/eleven-music-sidecar.env`:

```
ELEVENLABS_API_KEY=sk_...
```

### Wire-up from Rust

In `rust-api/src/music_gen/elevenlabs.rs`, gate the sidecar path behind:

```
ELEVEN_MUSIC_VIA_SIDECAR=1
ELEVEN_MUSIC_SIDECAR_URL=http://127.0.0.1:8765
```

When `ELEVEN_MUSIC_VIA_SIDECAR=1` is set, the adapter POSTs to the sidecar
instead of building the composition_plan body itself. When unset (or the
sidecar is unreachable), the adapter falls back to the existing flat-prompt
path so we never go down completely.
