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

## Sequencing / prioritization

1. **110A (this morning)** ✅ — items 3 + 5-hero-name; Wave 110 plan
2. **110B** — item 1 (debug missing tiers + tighten contemporary regex), item 2 (codex shows existing MVs during generation)
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
