# cssOS resume #160 / #161 / #162 — autonomous run report

**Run timestamp**: 2026-04-27 (scheduled task) **Session**: awesome-upbeat-brown **Branch**: `codex/cssmv-day5` (78 ahead / 1 behind `api-vm/main`)

---

## Summary of work done this session

### A. Static review of `pipeline_mv_api.rs` — PASSED (cargo unavailable in sandbox)

The sandbox does **not** have `cargo`/`rustc` installed, so a real `cargo build --release`could not be executed. A line-by-line static review was performed and the code looks clean:

- `DerivedSettings` struct (line 1687) derives `Debug, Clone, Default, Serialize, Deserialize`— all fields are `Option<String>` / `Option<u32>`, so `Default` works trivially.
- `parse_lyrics_llm_output` (line 1873) returns the new 4-tuple `(String, Option<Vec<LyricSection>>, Option<Vec<ShotScript>>, Option<DerivedSettings>)`. All call sites (lines 2140, 2153, 2161, 2172, 2200, 2354) destructure to 4 elements.
- `derive_settings_fallback` (line 2410) — pure heuristic on language/civilization/lyrics body, no external deps, no lifetimes, all returns are `Option<String>` / `Option<u32>` so Default composition is fine. Caveat: `name.get_mut(0..1)` for capitalisation returns `None` on multi-byte UTF-8 boundaries (Japanese / Chinese / Korean section names) — that's safe (no panic) but the kind label won't be capitalised; cosmetic only.
- `LyricsResponse` (line 1644) adds `derived_settings: Option<DerivedSettings>` — has `#[serde(default, skip_serializing_if = "Option::is_none")]` so old clients keep working.
- New test `parses_derived_settings_envelope` (line 2182) is well-formed.
- `tracing::info!` field syntax (`derived_present = derived_settings.is_some()`) is valid.

**One residual risk**: I cannot 100% guarantee compile success without running cargo. On your machine please run:

```
cd /Users/jing/cssOS/rust-api
LIBTORCH_USE_PYTORCH=1 cargo build --release 2>&1 | tee /tmp/cssos-build.log
```

If anything fails, the most likely culprits are (a) a missing `Default` impl on a field type that I assumed defaults — none in this patch, but easy to spot — or (b) a serde derive collision if `DerivedSettings` shares a name with another module. `grep -rn "struct DerivedSettings" rust-api/src/` should return only one hit.

### B. Universal entries audit (#161) — DONE

Every "万能入口" now routes through `cssmvMvPipelineRunAll` either directly or via `openMvPipelinePanel({autoStart: true})`:

EntryFilePathLogo click / longpress`app.dock-runtime.js`→ `cssmvUnifiedEntry` → `openMvPipelinePanel({autoStart: true})` ✓Quick mic tap (`cssos:mic`)`app.boot.js:469`→ `invokeUniversalCreationEntry` → `openMvPipelinePanel({autoStart: true})` ✓Mic-hold submit`app.boot.js:515`→ `submitVoiceOrFallbackTitle` → `cssmvMvPipelineRunAll` ✓ (file finally being LOADED, see below)Voice transcript`app.voice-submit.js`→ `cssmvMvPipelineRunAll` ✓Right-click 一键MV`app.context-menu.js:395`→ `cssmvUnifiedEntry` ✓Watch dock click`app.dock-runtime.js:139`→ `cssmvUnifiedEntry` ✓Boot recovery flows`app.boot.js:52,131,140,149,469`→ `invokeUniversalCreationEntry` ✓Advanced Settings APPLY & RENDER`app.advanced-panel-settings-render.js:90`→ `openMvPipelinePanel` ✓

**Critical fix this run**: `public/app.voice-submit.js` was **untracked AND not loaded**by any `<script>` tag in `index.html`. The file existed with the runAll-routing logic but the browser silently fell back to legacy `createRun` because `globalThis.submitVoiceOrFallbackTitleModule` was never defined. **Fixed** by adding a script tag at `public/index.html` (after `app.voice-seed.js`):

```html
<script src="app.voice-submit.js?v=20260427-universal-entry-voice-161"></script>
```

Also fixed a typo in `voice-submit.js` — was passing `autoRun: true` to `openMvPipelinePanel` (which expects `autoStart`). Replaced with explicit `autoStart: false` + direct `cssmvMvPipelineRunAll(seedFromVoice)` so the voice transcript reliably reaches the lyrics stage.

### C. HTML form default audit (#162) — DONE

Stripped remaining hardcoded defaults so `derived_settings` (the lyrics-stage envelope or the `derive_settings_fallback` heuristic) drives the final values:

- **Voice Gender** (`#voice-input`): added `<option value="" selected>Auto · 文明智能填充</option>`at the top. Was implicitly defaulting to "Feminine".
- **Key** (`#creation-key`): added `<option value="" selected>Auto · 智能填充</option>`. Was implicitly defaulting to "C".
- **Work Type** (`#creation-work-type`): added `<option value="" selected>Auto · 智能判断</option>`
  - new options `short_drama`, `series`, `film`. Was implicitly defaulting to "Single".

Verified already empty/placeholder-only:

- **Tempo BPM** (`#creation-tempo`): `placeholder="—"`, no value ✓
- **Duration sec** (`#creation-duration`): `placeholder="180"`, no value ✓
- **Section Form** (`#creation-section-form`): placeholder only ✓
- **Language** (`#creation-language`): already has `<option value="" selected>Auto</option>` ✓

Cache-bust on `style.css` bumped to `v=20260427-no-hardcoded-defaults-162`.

### D. (this report)

---

## Files changed this session

```
public/index.html               (+ Auto options, voice-submit script tag, css bust)
public/app.voice-submit.js      (option name fix: autoRun → autoStart; explicit runAll call)
```

Existing Sandbox modifications carried over from prior session (still untracked / unstaged):

```
public/app.js                   (+145 / -22)        — #158, #162
public/app.mv-pipeline-panel.js (+192 / -8)         — #157, #159, #161
public/index.html               (+43 / -2)          — cache-bust + Auto options + voice-submit tag
rust-api/src/pipeline_mv_api.rs (+451 / -5)         — #160 derived_settings
public/app.voice-submit.js      (untracked, 304 LOC)— #161 universal entry routing
```

---

## Deploy guide for Jing (run on your local Mac, not in sandbox)

The sandbox cannot push to GitHub or scp to api-vm — it has no git credentials and no network. The full source tree IS persisted in `/Users/jing/cssOS/` on your laptop, so all the edits above are already on disk.

### Step 1 — review the diff locally

```bash
cd /Users/jing/cssOS
git status                      # should show 354 untracked files in public/ + this batch
git diff public/index.html      # verify the Auto options + voice-submit script tag
git diff rust-api/src/pipeline_mv_api.rs | head -200
```

### Step 2 — verify rust-api compiles

```bash
cd /Users/jing/cssOS/rust-api
LIBTORCH_USE_PYTORCH=1 cargo build --release 2>&1 | tee /tmp/cssos-build.log
# If it fails, open /tmp/cssos-build.log — most likely fixes will be in
# pipeline_mv_api.rs around the new DerivedSettings code (lines 1687-2633).
```

If the build succeeds, also run the lyrics tests:

```bash
cd /Users/jing/cssOS/rust-api
LIBTORCH_USE_PYTORCH=1 cargo test --release \
  -p rust-api lyrics_parse_tests:: 2>&1 | tee /tmp/cssos-test.log
```

Expect: `parses_derived_settings_envelope ... ok` plus the four pre-existing tests passing.

### Step 3 — commit

The 354 untracked files in `public/` are NOT new — they're files that were never committed by an earlier session. The voice-submit.js file is the most critical of those because it now needs to be in production for the universal-entry fix to work.

A safe approach is two commits:

```bash
cd /Users/jing/cssOS
# Commit 1 — touched-this-session (highest signal)
git add public/index.html public/app.voice-submit.js \
        public/app.js public/app.mv-pipeline-panel.js \
        rust-api/src/pipeline_mv_api.rs
git commit -m "mv-pipeline: derived_settings + universal-entry voice + html auto defaults

- pipeline_mv_api: lyrics stage emits 18-field DerivedSettings envelope
  (work_type / duration_secs / voice_gender / tempo_bpm / key / genre /
  mood / instrument / ambience / vocal_style / ensemble_style /
  instrumentation / section_form / articulation_bias / voicing_register /
  expression_cc_bias / inspiration_notes / reference_artists / language).
  derive_settings_fallback() synthesises one when LLM doesn't comply,
  keyed by language × civilization (ja/ko/zh/en/es/fr/de/ru/ar/hi pools).
- Front-end strips hardcoded 88 BPM / C key / 180s / Single defaults.
- public/app.voice-submit.js routed through cssmvMvPipelineRunAll;
  finally LOADED via index.html script tag (was untracked + unloaded).
- HTML form: Voice Gender / Key / Work Type get Auto sentinel options.

#158 #159 #160 #161 #162"

# Commit 2 — drop the rest of the untracked tree if it really belongs
# (only run after a careful review)
git status --short public/ | head -20
# git add public/    # <— only after eyeballing
```

### Step 4 — push + deploy to api-vm

Once committed locally:

```bash
# Push to GitHub
git push origin codex/cssmv-day5

# (optional) merge into main if you want to deploy from main:
# git checkout main && git merge codex/cssmv-day5 && git push origin main

# Deploy to api-vm — replace user@host with your actual values from
# scripts/OPS.md (you maintain this file, I left it untouched).
ssh api-vm "cd /srv/cssos && git pull origin codex/cssmv-day5 && \
            cd rust-api && \
            LIBTORCH_USE_PYTORCH=1 cargo build --release && \
            sudo systemctl restart rust-api"

# Static frontend (public/) — depends on your nginx setup; if it serves
# directly from the repo, the git pull already covers it. If it's served
# from a separate dist:
#   rsync -avz --delete public/ api-vm:/srv/cssos/public/
```

### Step 5 — verify in Safari

Cache-bust strings already updated on:

- `style.css?v=20260427-no-hardcoded-defaults-162`
- `app.js?v=20260427-mv-pipeline-owns-audio-158`
- `app.mv-pipeline-panel.js?v=20260427-3stream-parallel-play-159`
- `app.voice-submit.js?v=20260427-universal-entry-voice-161`

Hard refresh: `Cmd+Shift+R`. Open DevTools console and verify:

Should seeShould NOT see`[entry:dock-watch] click` → `→ MV Pipeline runAll504 on /api/cssmv/song-seed`Audio playing unmuted on compose-done`404` storm on `/cssapi/v1/runs/.../music-delivery-artifact?path=...`Subtitle ticking on the bar"砖头人" fallback renderFinal video plays in fullscreenHorror-movie "muted video + creepy ambient"Voice gender / key / work type shown as "Auto" until lyrics stage fills themHardcoded "Feminine" / "C" / "Single" pre-populating the form

### Step 6 — full regression test

1. **Cold load → logo click**: should fire 6-stage pipeline immediately, finish \~5min.
2. **Long-press mic**: speak a title in Japanese ("夜空の星"). Lyrics stage should emit `derived_settings.language = "ja"`, `voice_gender = "feminine"`, `reference_artists = "Aimer, Hikaru Utada, ..."`, `genre = "J-Pop"`. Form fields should populate with these values, not fallback to "Feminine"/"C".
3. **Right-click 一键MV**: should adopt fresh result if last run was &lt;10min ago, else fire a new run.
4. **APPLY & RENDER from Advanced Settings**: should pass user's overrides through without being squashed by derived_settings (frontend overlays only over empty fields).

---

## Open follow-ups (not done this session)

1. **Cargo build verification** — depends on local cargo, see Step 2 above.
2. **Frontend application of derived_settings** — `app.mv-pipeline-panel.js` already pulls the envelope and writes it to `creationState`, but I did not test that each of the 18 fields lands on the right form input. After the deploy, confirm in DevTools that `creationState.tempoBpm`, `.key`, `.workType` etc. all reflect the lyrics-stage-derived values when the user has not picked them manually.
3. **i18n keys for the new Auto options** — added `creation.option.vocalGender.auto`, `creation.option.key.auto`, `creation.option.workType.auto` as `data-i18n` slots but did NOT add translations to `public/i18n/dict.js`. Until you add them, the labels will fall back to the inline English-Chinese hybrid text I put in the HTML ("Auto · 文明智能填充" etc.).

---

## What I deliberately did NOT do

- Did not git commit / push from sandbox — no credentials, and you've said you push from your machine.
- Did not run rust-api / nodejs tests — sandbox has no cargo / no npm test scripts pinned for this state.
- Did not modify the existing 354 untracked files in `public/` — too much surface area to safely add. Only touched the 5 files above.
- Did not edit `scripts/OPS.md` — that's your operational doc.

Sources & file pointers:

- This report: `/Users/jing/cssOS/CSSOS-RESUME-160-161-162-REPORT.md`
- Updated index.html: `/Users/jing/cssOS/public/index.html`
- Updated voice-submit: `/Users/jing/cssOS/public/app.voice-submit.js`
- DerivedSettings: `/Users/jing/cssOS/rust-api/src/pipeline_mv_api.rs` lines 1687-2633
