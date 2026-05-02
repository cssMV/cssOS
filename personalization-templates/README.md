# cssOS Personalization Template Library

This directory holds the on-disk pre-rendered template MVs that the
personalization engine uses for system gifts (welcome, milestones,
birthdays, anniversaries, etc.). Each subdirectory is one template.

## Where this directory lives

- **Production VM:** `/srv/cssos/shared/personalization-templates/`
  (rsync'd from this repo or authored directly on the VM)
- **Local dev:** `<repo-root>/personalization-templates/` (this dir)
- **Override:** set `CSSOS_PERSONALIZATION_TEMPLATES_DIR` env var

The Express backend's `loadPersonalizationTemplates()` scans the first
existing path in that list at boot and caches every valid manifest in
memory.

## Layout

```
personalization-templates/
  welcome/
    en.v1/
      manifest.json
      base.mp4              # the pre-rendered video — same for every recipient
      base.mp3              # audio track
      cover.png             # static cover image
      lyrics.txt.tpl        # plain-text lyrics with {name} placeholders
      lyrics.ass.tpl        # ASS subtitle file with {name} (optional)
    zh.v1/
      ...
  first_subscriber/
    en.v1/
      ...
  birthday/
    en.v1/
      ...
    zh.v1/
      ...
```

The directory naming pattern `<trigger>/<lang>.v<n>/` is conventional
but not enforced — the registry walks the tree looking for any
`manifest.json` and uses the manifest's own `id` / `trigger_key` /
`language` / `version` fields.

## manifest.json schema

Required fields, in the order they typically appear:

```json
{
  "id": "welcome.zh.v1",
  "trigger_key": "welcome",
  "language": "zh",
  "version": 1,
  "label": "Welcome MV — Mandarin Chinese",

  "base_video": "base.mp4",
  "base_audio": "base.mp3",
  "base_cover": "cover.png",
  "duration_secs": 32,
  "aspect_ratio": "16:9",

  "title_template": "{name}, 欢迎来到 cssOS",
  "subtitle_template": "你的第一首歌，正在写成",

  "plain_lyrics_file": "lyrics.txt.tpl",
  "ass_lyrics_file": "lyrics.ass.tpl",

  "emotional_tone": "warm",
  "max_name_chars": 20,
  "active": true,

  "notes": "Soft piano + ambient pad. Title fades in at 0:04, name overlay at 0:07."
}
```

### Field rules

- **id** — globally unique. Convention: `<trigger>.<lang>.v<n>`.
- **trigger_key** — must be one of the literals in
  `src/personalization/types.ts::GiftTriggerKey`. The engine refuses
  to dispatch a template whose key isn't registered.
- **language** — BCP-47 tag. Use the base tag (`zh`, `pt`) when the
  template works for the whole language; use a regional subtag
  (`zh-Hant`, `pt-BR`) only when the template is genuinely
  region-specific.
- **base_video / base_audio / base_cover** — paths relative to the
  manifest dir. Absolute URLs (`https://...` or `/...`) are accepted
  and passed through unchanged.
- **aspect_ratio** — one of `16:9`, `9:16`, `2.39:1`, `32:9`, `1:1`,
  `4:3`. The watch frame respects this.
- **title_template / subtitle_template** — may contain `{name}`. NO
  other placeholders are honoured (a typo like `{namee}` will render
  literally — by design, so silent breakage is impossible).
- **plain_lyrics_file** — required. May contain `{name}` anywhere.
- **ass_lyrics_file** — optional. Same `{name}` rules. ASS subtitle
  features (karaoke `\k` tags, fades, positions) are preserved
  verbatim.
- **emotional_tone** — one of `warm`, `celebratory`, `tender`,
  `triumphant`, `melancholy`, `playful`, `majestic`, `intimate`.
  Feeds the watch panel's emotional-subtitle styling (#251).
- **max_name_chars** — code-point limit (NOT bytes). Names longer
  are truncated with `…`. Default 24 if omitted; reduce for
  tight overlays.
- **active** — `false` keeps the template in the registry but never
  selected. Lets you commit WIP templates without breaking dispatch.

## Adding a new template — checklist

1. Pick a trigger from the GiftTriggerKey enum.
2. Pick a language. If `en` is your only language, the engine still
   uses it as a fallback for every locale (score=10).
3. Render the base media (video + audio + cover) with NO name baked
   in — the renderer overlays the name at delivery time via the
   lyric/title templates.
4. Write the `manifest.json`, `lyrics.txt.tpl`, and (optionally)
   `lyrics.ass.tpl`. Use `{name}` exactly — case-sensitive.
5. Test locally:
   ```
   node -e "
     const t = require('./dist/personalization/templates/registry.js');
     await t.loadPersonalizationTemplates();
     console.log(t.listLoadedTemplates().map(x => x.manifest.id));
   "
   ```
6. Deploy: `rsync -az personalization-templates/ api-vm:/srv/cssos/shared/personalization-templates/`
7. Restart the Express service so the registry re-scans:
   `sudo systemctl restart cssOS.service`

## Authoring the base media

Some practical guidance for the creative team:

- **Duration**: 25–45 seconds is the sweet spot for system gifts.
  Long enough to feel deliberate, short enough that users don't
  bounce before it ends.
- **Title overlay**: leave the upper-third clean for the title +
  name. The renderer doesn't composite anything onto base.mp4 —
  the name appears via the lyric/karaoke layer the watch panel
  paints on top at playback time.
- **Karaoke**: the watch panel's existing karaoke-line renderer
  picks up the substituted lyrics and times them via the audio
  track. Keep the lyric template's section breaks aligned with
  natural musical pauses in base.mp3.
- **Cover**: 16:9 or 9:16 to match the video. Avoid embedding the
  user's name in the cover — the watch frame composites the name
  via overlay so the cover stays generic.

## Inviolable rules

1. **Base media is never modified per recipient.** The same `base.mp4`
   serves everyone. Only the lyric/title text differs. This is what
   makes the system cheap (~$0 per gift) and fast (no encoding step
   at delivery time).

2. **No marketing.** Templates are gifts. They thank the user. They
   do not promote upgrades, solicit shares, or pitch features.

3. **No ads. No third-party logos. No copyrighted music.** Every
   asset must be original or clearly licensed for unrestricted
   non-commercial redistribution embedded in user gifts.

4. **Names embed via overlay, never via baked-in text.** Renaming a
   user a year later should let them watch the SAME gift again with
   the new name correctly displayed. (Audit trail keeps the original
   embedded name on file via `personalization_template_renders`.)
