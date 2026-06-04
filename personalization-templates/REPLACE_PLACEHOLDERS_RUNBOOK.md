# Replacing v2 Placeholder Assets with Real MVs

The three gift MVs (welcome / first_subscriber / birthday) currently
live at `personalization-templates/<trigger>/en.v2/` and use the
v1 placeholder mp3/mp4 as temporary base assets. The creative briefs
(`manifest.json` → `creative_brief`) are the source of truth for what
the real assets should be.

## Generation paths

**Path A — Suno + Kling via the cssstudio.app UI**

1. Log in to https://cssstudio.app as `admin@cssstudio.app`.
2. For each trigger, open the MV creator and paste:
   - **Title**: from `manifest.json` → `title_template` (replace `{name}` with `the world`)
   - **Lyrics**: contents of `lyrics.txt.tpl` (keep `{name}` literal)
   - **Style**: from `creative_brief.music_style`
   - **Video Outline**: from `creative_brief.video`
3. Run the full pipeline. Wait 15-25 min per MV.
4. Once the work is rendered, open it in Works Center → Download MP3 and
   MP4 (admin tier = lossless allowed).
5. Drop the files at:
   - `personalization-templates/<trigger>/en.v2/base.mp3`
   - `personalization-templates/<trigger>/en.v2/base.mp4`
6. Regenerate `cover.png` from the first frame:
   ```bash
   ffmpeg -y -i base.mp4 -vframes 1 -q:v 2 cover.png
   ```
7. `rsync -az personalization-templates/ api-vm:/srv/cssos/current/personalization-templates/`
8. `ssh api-vm 'sudo systemctl restart cssOS.service'`

**Path B — External tools (Suno.com + Kling.ai + Pika etc.)**

Same idea, but generate the assets outside cssOS and drop them in.
The system doesn't care where the mp3/mp4 came from — it only reads
the file bytes at template render time.

## Verification

After dropping new assets and restarting:

```bash
ssh api-vm 'cd /srv/cssos/current && node -e "
  const { renderTemplateGift } = require(\"./dist/personalization/templates/render.js\");
  // (or use the /api/personalization/inbox endpoint and trigger a test fire)
"'
```

Or simpler: open the app as a test user with a fresh account, the
welcome MV should fire automatically on first login and play the new
assets.

## Brief sources (canonical)

- `welcome/en.v2/manifest.json` → `creative_brief`
- `first_subscriber/en.v2/manifest.json` → `creative_brief`
- `birthday/en.v2/manifest.json` → `creative_brief`

Every brief specifies: music_style / instrumentation / vocal / video.
The Suno/Kling prompts in the chat that produced this set are
captured in the manifests, so future regeneration stays consistent.

## State

- `welcome.en.v1` → `active: false` (retired)
- `welcome.en.v2` → `active: true` (current; using v1 placeholder bytes until real assets land)
- `first_subscriber.en.v1` → `active: false`
- `first_subscriber.en.v2` → `active: true` (same)
- `birthday.en.v1` → `active: false`
- `birthday.en.v2` → `active: true` (same)
