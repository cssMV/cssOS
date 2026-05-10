# Wave 110 — Person MV Panel Overhaul

**Owner**: Jing
**Drafted**: 2026-05-10 (after the morning ⭐ session)
**Status**: 🟡 Plan + first 2 items already shipped (110A); rest queued by impact

---

## Source: 8 items Jing surfaced this morning

Each numbered as Jing wrote them. Status column is wave-by-wave.

| # | Topic | Status |
|---|---|---|
| 1 | Default show ALL persons (1000-target dataset) | 🟡 partial — debug pending |
| 2 | Confucius codex doesn't refresh after multiple generations; each create makes 2 covers — should differ | 🔴 not yet |
| 3 | Cinema text colors too pale for both themes | ✅ shipped (110A) |
| 4 | Hardcoded i18n strings everywhere — must go through CSSOS_I18N.tr() | 🔴 audit pending |
| 5 | Big hero name = current UI locale; subtitle = mother tongue; replace likes with cost / listen / buyout pricing | 🟡 hero name shipped (110A); pricing pending |
| 6 | Cinema playback UX — border progress bar; auto-hide info after 10s; auto-advance; era-aware "Up next" styles | 🔴 not yet |
| 7 | Engine ordering by output speed; some run in parallel; emotional-subtitles for person MV | 🔴 not yet |
| 8 | i18n reinforced — Japanese / Korean / Spanish users shouldn't see Chinese-or-English assumptions | 🔴 audit pending |

---

## Item 1 — Default render shows ALL persons

**Symptom (this morning)**: panel landed on "Hall of Fame · 22" only, no Notable / Compendium / User-Creations sections. DB actually has **55 personalities** (S=37, A=5, B=13).

**Likely root causes** (to verify with `console.log` audit):

- The bucketing in `render()` may be over-classifying S-tier into Contemporary (regex `/当代|现代|20\s*世纪|.../i` is greedy — eras like "近现代科学 · 20世纪" match)
- Or the screenshot was simply scrolled and other sections are below the fold

**Fix plan**:

- [ ] Console-log bucket sizes after each `render()` so we can see the live distribution
- [ ] Tighten contemporary regex — only era strings whose primary unit IS contemporary (`^当代$ | ^现代$ | ^20[-—–]?\s*世纪$ | ^21\s*世纪$`)
- [ ] If the issue is just scroll, add a sticky tier-jump nav so users can leap between sections

**1000-target dataset** is a separate seeding task — Wave 110D plan should add a curator seed JSON with ~1000 figures across all S/A/B tiers, civilizations, and eras. Currently `seedPersonProfilesOnce()` only ships ~30. Backend stub:

```sql
-- migrations/059_person_seed_v2.sql
INSERT INTO person_profiles (...)
VALUES (...)  -- 1000 rows, balanced across civilizations
ON CONFLICT (person_id) DO NOTHING;
```

Build the seed file by querying Wikidata for "most-influential historical figures" by civilization, then hand-curating tier assignments.

---

## Item 2 — Confucius codex stuck on "Generating" + duplicate covers

**Symptoms**:

- User clicks "Create New Version" multiple times → the codex page stays in onboarding ("Generating the first MV for 孔子…"), even though the user's "为你创作" panel does have Confucius MVs
- Each successful generation creates 2 covers — should be 2 *different* takes (similar but not identical)

**Diagnose**:

- The codex API returns `mvs: 1` for confucius, but the user feels several were generated. Check whether new MVs are being persisted under a different `person_id` (e.g., `adhoc-confucius-xxxxxx` because user typed the name from the create-anybody flow → spawned an ad-hoc twin)
- 109H dedupe should have prevented this — verify the dedupe SQL actually returns the canonical confucius row (it should: source_status='curated' wins)
- The "Generating…" state → the codex polls `/api/person-mv/persons/:id/codex` but `loreEmpty` flag can be stuck true if the lore is empty AND no cached works exist for that person yet

**Fix plan**:

- [ ] On the codex page, **always show existing MVs** even while a new one is being generated. The "in-progress" tile becomes a sibling card next to the existing ones, not the whole-page state
- [ ] Cover variation: the prompt currently sends one cover request → 1 cover. To get 2 distinct covers, the cover stage must request **2 takes with different `seed` values** at the SAME prompt. Update `/api/mv/cover` to optionally return `[take1, take2]` and have the pipeline pick or show both

---

## Item 3 — Cinema text contrast ✅ shipped (Wave 110A)

- `.pmv-hero-name-zh` → `#ffffff` + drop shadow
- `.pmv-hero-name-native` → `#e6fff2` + shadow (was `#bff5dc`, washed out)
- `.pmv-hero-name-latin` → `#c8f0de` + shadow
- Light-theme overrides keep contrast against the gradient overlay
- Drop shadows ensure legibility even when the portrait beneath has bright sections

---

## Item 4 + 8 — i18n audit (highest-leverage work)

**Rule going forward**:
- **No hardcoded English** as ground-truth. Every visible string passes through `CSSOS_I18N.tr("English source")`.
- The runtime resolves to whatever locale the user picked in Language panel.
- Default locale = browser language (`navigator.language`), NOT hardcoded English.
- **No hardcoded Chinese either** — same rule, just in the other direction.

**Audit scope**:

- [ ] grep through `public/app.person-mv-panel.js` for all string literals that go to the DOM, mark hardcoded ones
- [ ] grep through `public/app.mv-pipeline-panel.js` similarly
- [ ] grep through `public/app.watch-ui.js` — cinema playback strings
- [ ] All API error messages — `auditAuthFailure` etc. — are server-side and should ALSO localize per `Accept-Language` header

**Lyrics structure** (item 4 sub-clause):
> "歌词默认走的是京典10节歌词结构（Verse 1, Verse 2, Chorus 1, Verse 3, Verse 4, Chorus 2, Bridge, Chorus 3, Chorus 4, Outro），除非用户在'高级设置'面板里的'段落结构'选项设置了不同的歌词结构。"

- [ ] Verify the lyrics LLM prompt includes the 10-section default + reads `panelBehavior.advanced.lyric_structure` override
- [ ] Lyrics output language MUST equal user's UI locale, not the person's mother tongue. A Japanese user studying Confucius gets Japanese lyrics by default.

---

## Item 5 (continued) — Replace likes with pricing

> "底部的点赞请取消或者保留？像我之前说的，不要点赞那些虚假繁荣，而是真金白银，（仅创作者本人显示成本价）/聆听价格/买断价格。"

**New bottom row replaces the heart counter**:

- 🎧 **Listen price** — what a viewer pays per play (free for creator, $0.05 for non-Premium, free for Premium)
- 💎 **Buyout price** — one-time purchase to own the MV (set by creator, default = 10× listen)
- 💰 **Cost price** — only creators see this on their own works (real engine spend in cents)

Backend: extend `/api/person-mv/persons/:id/codex` to return `pricing: { listen_cents, buyout_cents, cost_cents (creator-only) }` per MV.

Frontend: replace the heart in `pmv-mv-card` with these three figures.

---

## Item 6 — Cinema playback UX

**Sub-tasks**:

- [ ] **Border progress bar** — current playback shows a center progress bar (during generation). Cinema mode (during playback) should put a slim border progress around the video frame instead, like classic cinema scope
- [ ] **Auto-hide info after 10s** — title / chips / description fade away during playback (mirror dock auto-hide). Reappear on cursor move. **Default 10s** — Jing wants this to be the universal idle for all panels going forward
- [ ] **Auto-advance** — at end-of-track, 5/8/10/15 second countdown then play next. Use existing `cssos:cinema-queue` event. Match this to the music end logic already in `app.watch-ui.js` (`watchQueueAdvanceModule`)
- [ ] **Era-aware Up Next chips** — instead of a fixed Epic / Tang / Ambient / Cinematic / Rock list, derive 3-5 styles from the person's era and civilization (e.g. Confucius → 古风 / 编钟与弦乐 / 庄重; Beethoven → 古典 / 浪漫 / 协奏)

---

## Item 7 — Engine pipeline ordering

Current: lyrics → cover → music → video → subtitles → compose (sequential).

Jing's proposal — **fastest engines first, parallel where possible**:

```
            ┌── lyrics  (fast — LLM, ~5s)
            │       └─→ subtitles (depends on lyrics)
   START ───┼── cover   (medium — image gen, ~20s)
            └── music   (slow — Suno, ~60-90s)
                    └─→ video (depends on cover/music for kenburns)
                              └─→ compose (depends on video + subtitles)
```

- [ ] Run lyrics + cover + music in parallel from the start
- [ ] subtitles depends on lyrics + music → can fire as soon as both complete
- [ ] video uses kenburns_image (cover) for Lite tier OR runway-gen3 (text+cover prompt) for Pro tier
- [ ] compose is the final dependent

**Emotional subtitles** — long-promised feature: instead of plain SRT with karaoke timing, color-tag each line by sentiment (gentle → green; intense → red; sad → blue). Already a bit of infra in `app.watch-ui.js` for karaoke; just need to thread emotion tags from lyrics LLM through the SRT generator.

---

## Item 8 — i18n hard reinforcement (covered in §4)

Already discussed inline. The Japanese / Korean / Spanish user must see THEIR language without being asked. Browser detection + Language-panel override.

---

## Multi-cover slideshow (Jing, 110B feed-in)

> "既然每个用户输出一次就有两个作品，封面图不一样，我建议用这些封面图做增强版幻灯，不知道幻灯需要的封面图最多是多少？是否有个极限？"

**ffmpeg practical limits**:

- 3-min MV at 5s/image = 36 max
- 3-min MV at 7s/image (Ken Burns sweet spot) = **~26**
- Beyond 30, each image gets <5s on screen — too brief to appreciate
- Render time grows linearly; ~50 covers on a 4-CPU box ≈ 60-90s render
- Memory pressure starts at ~80 (each image gets its own filter graph)

**Recommended cap: 24 covers** per slideshow.

**Strategy**:

- **Per person**, accumulate ALL covers across all users' MVs (`cover_pool`)
- When pool size > 24, randomly pick 24 each pipeline run
- When pool size ≤ 24, use them all (with kenburns randomized direction so the same image doesn't always pan the same way)
- If pool is empty (first-ever MV for this person), use the cover engine output as the only image

**Backend**:

- New table column or join: `person_mvs.cover_url` already exists; just `SELECT cover_url FROM person_mvs WHERE person_id=$1 ORDER BY random() LIMIT 24`
- Codex API extended: `cover_pool: [...24 urls]`

**Pipeline**:

- Video stage receives `cover_pool` and builds `kenburns_image` segments — one per cover, distributed across the song duration
- If `cover_pool.length === 1`, fall back to current single-image kenburns

## Work title diversification (Jing, 110B feed-in)

> "每个作品的标题不一定是该人物的名字，而是与该人物有关的，比如生平，事迹"

**Currently shipped in 110B**: `buildSeed()` now picks a random theme from:

1. `lore.events[i]` — random life event ("周游列国", "杏坛讲学")
2. `p.roles[i]` — random role  
3. `p.visual_symbols[i]` — random symbol
4. bio first sentence
5. core_theme

The lyrics LLM reads this theme via `seed.prompt` and the LLM's title-generation already keys off the prompt, so each take gets a different angle and different title. Verify by running 5 generations of the same person and inspecting the titles.

If the LLM output is still title-monotonous, add explicit instruction: "Generate a unique work title that is NOT the person's name; reference the theme."

---

## Wave 112 PREVIEW — Cities / Landmarks / Sites MV (Civilization Universe expansion)

(Per Jing 20260510 — flagged after Wave 111. Dock icon already
says 🏛 "Civilization MV"; unifying People + Places under it.)

### Why this matters

Historic sites are stories with infrastructure. Each landmark
yields MULTIPLE narrative angles:

  - 长城 → built-by (蒙恬), war (戍守), legend (孟姜女), modern war
  - 故宫 → founding (永乐), daily life (康熙读书), fall (1924)
  - 罗马斗兽场 → gladiators, Christian martyrs, Renaissance ruin
  - Mount Everest → mythology, pilgrimage, climbing history,
    geopolitics

A single landmark can support 5-10 MVs against different angles.
The data multiplier is bigger than single-person MVs.

### Architecture: extend, don't rebuild

90% of Person-MV infra is reusable:
  - MV pipeline (lyrics + music + cover + video + compose)
  - Cinema + storm + Take 2 + cover_pool
  - Panel constitution (drag / 8-resize / 3 buttons)
  - Dedupe + edit/delete + user creations
  - Tier system (S / A / B / Compendium / User)
  - Era-aware style picker
  - cssos:run_progress events

What's new:
  - Schema: `landmark_profiles` table (location, period, civ,
    notable_events[], coordinates, related_persons[])
  - Different "story angle" picker — instead of bio events:
    built / witnessed / inhabited / destroyed / restored /
    legend
  - Different cover prompt template (location aesthetics +
    weather + time-of-day rather than portrait)
  - Cross-graph relationships: landmark ↔ person ↔ event
  - Different navigator at end-of-MV: "nearby landmarks" +
    "same-civ landmarks" + "people who visited here"

### UX: tabs in the existing panel

  ┌─────────────────────────────────────────────────────┐
  │ 🏛 Civilization MV · Civilization Universe          │
  │ ┌─────────┬───────────┬──────────┐                  │
  │ │ People  │ Landmarks │  Events  │                  │
  │ └─────────┴───────────┴──────────┘                  │
  │                                                     │
  │ [search] [filter: era] [filter: civ] [tier]         │
  │                                                     │
  │ ⭐ Hall of Fame Landmarks (S)                        │
  │ 🎴 Notable Sites (A)                                │
  │ 📜 Compendium (B/C)                                 │
  │ 👤 User-added Sites                                 │
  └─────────────────────────────────────────────────────┘

  Dock icon stays 🏛, tooltip becomes "Civilization MV (People +
  Sites + Events)".

### Data sources for seeding

  - UNESCO World Heritage Sites (~1200 entries) → curated S/A
  - Wikidata Q-IDs for historic sites → name_variants pre-populated
  - Top tourist attractions per civilization (LLM curated, ~500)
  - User submissions: "Add a place" — same dedupe rules as people

### Estimated effort

  3-4 sessions:
    Session 1: schema + seed (UNESCO + Wikidata pull)
    Session 2: tab UI + landmark codex (mostly forking
               person-codex)
    Session 3: story-angle picker + cross-graph navigator
    Session 4: i18n + Wikidata multi-lang names backfill

### Sequencing

  - Wave 111 (Music Source Uploads) FIRST — that's a parser-pipeline
    feature that benefits People + Places + Events equally
  - Wave 112 (Landmarks tab) AFTER 111

  Both waves play well together: a landmark's lyrics LLM call can
  use a custom audio reference uploaded for the place's "official
  theme music."

---

## Wave 111 PREVIEW — Advanced Settings · Custom Lyrics / Music Source Uploads

(Per Jing 20260510 — flagged as the BIG next bone after Person MV
panel wraps. Brief sketch only; full plan when we get there.)

The panel surface already has 5 input slots:
  - Reference Audio (`.mp3` / `.wav` / `.flac`)
  - MIDI Sketch (`.mid`)
  - MusicXML Score (`.musicxml` / `.xml`)
  - Score Image (`.png` / `.jpg`, OMR target)
  - Numbered Notation / Staff Notation (text or image)

Each slot today shows "Choose File" + placeholder ("After upload,
this slot will show parse mode and extraction focus" / "...next
parser shell"). The parsers themselves are NOT built yet.

What it needs to become:

  1. Audio parser → key/tempo/melody contour/structural form
     - Use librosa or essentia in a small Python sidecar
     - Output → enrich the music-engine prompt
  2. MIDI parser → notes/chord progression/tempo map (mido/mid2hum)
  3. MusicXML parser → music21 structural read
  4. Score image OMR → Audiveris (Java) or oemer (Python)
  5. Numbered/staff notation → custom rules + LLM fallback

  Then the parsed musical structure becomes a STRONG condition
  fed to the lyrics LLM ("write lyrics that fit THIS melody and
  THIS chord progression"), the music engine (Suno-as-arranger
  / ElevenLabs sync-binary with reference), and the cover/video
  engines (use detected mood + tempo for visual pacing).

Architectural note: this is the bridge between "user has musical
ideas" and "AI fills in the gaps." Currently cssOS goes
text → AI music. Wave 111 makes it (text + music sketch) → AI
music that respects the user's input.

Estimated effort: 2-3 sessions. Starts after Person MV closes.

---

## Sequencing / prioritization

1. **110A** ✅ — items 3 + 5-hero-name; plan
2. **110B** ✅ — items 1 (default-all + tier filter strict), 2 (subtitle copy: "first" → "new"), title diversification, cover slideshow plan
3. **110B2** ✅ — nginx 900s + frontend 502 retry (compose timeout)
4. **110B3** ✅ — cinema panel-toggle button + storm Pro+ gate
5. **110B4** ✅ — person-MV end-of-playback navigator (contemporaries + lineage cards, 10s countdown)
6. **110C** — multi-cover slideshow backend + pipeline
7. **110D** — Take 2 produces SECOND MV (different cover + audio) — see below
8. **110E** — i18n full audit + multi-language name display (Wikidata-style)

---

## Wave 110D plan (Jing 20260510 — "Take 2 should make its own MV")

> "Suno 输出的第二首音乐，岂不就是白白浪费了？"

**Current architecture**:

- One pipeline run → Suno returns Take 1 + Take 2 (different audio variants)
- Cover stage runs ONCE → 1 cover image
- Compose stage runs ONCE → 1 MV
- Take 2 saved as `state.altAudioUrl` → user can switch audio mid-play
- Same video, two audio tracks

**Jing's correction**: each run should produce TWO DISTINCT MVs:
- Different cover (2 cover seeds)
- Different audio (Take 1 vs Take 2)
- Different composed video

**Implementation**:

- [ ] Cover stage: request 2 takes (already supported by some image engines via `n=2`; for others, fire 2 sequential requests with different seeds)
- [ ] Compose stage: when 2 takes are present, run TWICE in parallel:
  - MV-A = Cover-1 + Take-1-audio
  - MV-B = Cover-2 + Take-2-audio
- [ ] Persist both as separate works under the same person_id
- [ ] Codex shows BOTH cards
- [ ] Cinema queue cycles through both
- [ ] Cost: ~$0 extra on music (Suno already produced both takes); +1 cover request (~$0); +compose 2× (local ffmpeg, ~free)
- [ ] Save: doubles the storage but cheap

**Risk**: compose 2× doubles render time. Mitigate by running them in parallel ffmpeg processes (we have CPU headroom on the api-vm).

---

## Wave 110E plan (Jing 20260510 — "Wikipedia-style multi-language names")

> "wiki那里显示多少种语言，我们就显示多少种"

**Current**: hero shows current-locale name + native name + latin transliteration.

**Target**: show ALL language variants Wikipedia/Wikidata has for that person:

```
                    Confucius       ← user's UI locale (English)
                    孔子            ← native (Chinese, mother tongue)
                  孔丘 · Kǒng Qiū   ← additional Chinese names + pinyin
        공자 (KO) · 孔子 (JA) · Конфуций (RU)
        Konfuzius (DE) · Confucio (ES) · Kongzi (PY)
```

**Schema**:

- New JSONB column on `person_profiles`: `name_variants JSONB DEFAULT '{}'`
- Shape: `{ "en": "Confucius", "zh": "孔子", "zh-tw": "孔子", "ko": "공자", "ja": "孔子", "ru": "Конфуций", "de": "Konfuzius", "es": "Confucio", ... }`
- Hero shows up to 6 non-empty variants (overflow → "+ more" tooltip)

**Source**:

- Wikidata Q-IDs: most figures have one (Confucius = Q4604). Q5 entity → labels in 100+ languages
- Backfill task: query Wikidata API once per person, store name_variants
- Future ad-hoc persons: LLM call returns `name_variants` directly

**i18n audit (continuation of 110A)**:

- [ ] grep `app.person-mv-panel.js` for hardcoded strings → wrap in `tr()`
- [ ] grep `app.mv-pipeline-panel.js` (Storm cells, end-of-MV CTAs all currently zh-only)
- [ ] grep `app.watch-ui.js` cinema strings
- [ ] Server-side error messages localize via `Accept-Language` (lower priority)
- [ ] Lyrics LLM prompt: output in user's UI locale, not person's mother tongue (current bias)
3. **110C** — item 4 + 8 (i18n audit pass on person-mv-panel + watch-ui — biggest single win)
4. **110D** — 1000-figure seed file (data work, slow but boring)
5. **110E** — item 6 (cinema border progress + auto-hide + era-aware up-next)
6. **110F** — item 5 pricing replacement (backend pricing column + frontend display)
7. **110G** — item 7 (parallel pipeline + emotional subtitles)

Each sub-wave sized for one focused session; can ship independently.

---

## Out of scope this morning

- 1000-person seed (110D) — actual data curation, not a coding session
- Pricing economy (110F) — needs Stripe metering hooks
- Emotional subtitles (110G) — depends on lyrics LLM emitting emotion tags

---

## Definition of done (the whole wave)

- [ ] All 8 items above ✅ across the lettered sub-waves
- [ ] No remaining hardcoded user-visible Chinese OR English in `app.person-mv-panel.js` / `app.mv-pipeline-panel.js` / `app.watch-ui.js`
- [ ] Cinema playback works end-to-end without staying on the "Generating…" screen when MVs already exist
- [ ] Default panel shows all 5 sections (Hall, Notable, Contemporary subgroups, Compendium, User Creations) with non-zero counts whenever data is there
- [ ] Auto-advance + 10s idle + emotional subtitles validated on a 3-MV playlist
- [ ] Pricing row replaces the heart counter on every MV card
