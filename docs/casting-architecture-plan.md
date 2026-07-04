# Casting & Multi-Format Architecture Plan

> Status: **APPROVED DIRECTION — evolve, do not rebuild** (Jing, 2026-07-04).
> P0/P1 below are executable checklists **pending Jing's go-ahead before any code**.
> P2/P3 are plan-level.

## 1. Goal

A user-director should be able to **cast** digital actors into roles
(protagonist / antagonist / supporting / extra — each with a 正/反 alignment),
have the system **recommend** a cast via 文明智能联动, then generate — defaulting
into the existing MV panel (6-capsule progress + 流流流 streaming lyrics). The same
casting → pipeline flow scales to MV → triptych → opera → short drama → series →
film via a `format` parameter.

## 2. Core decision: evolve the current architecture

We do **not** rebuild. The signatures and machinery already exist and are
constitutionally protected assets:

| Asset we reuse | Where it lives today |
|---|---|
| MV panel + 6-capsule progress + 流流流 streaming lyrics | watch/MV panel (constitutional signatures — untouched) |
| `digital_actors` table (civilization, archetypes, gender, age_range, appearance_tags, style_descriptor, cover_image, is_premium) | `migrations/093_digital_actors.sql` |
| **`actor_castings` table already exists** (casting_id, actor_id, work_id, created_by_user_id, role_name, cast_price_cents) | `migrations/093_digital_actors.sql:80` |
| Single-actor cast entry `castRun(actor, workType)` + `castPromptFor` — **already branches workType `mv` / `triptych` / `opera`** and opens the creation panel with a seed prompt | `public/app.actor-gallery.js:1093,1103` |
| Role/戏路 taxonomy (hero/villain/antihero/ruler/action/sage/charmer/tragic/comic/enigma/youth) | `ROLE_TAXONOMY` in `public/app.actor-gallery.js:382` |
| MV seed entry (accepts `language`, festival, season, time_of_day) | `POST /api/mv/seed` `src/index.ts:698` |
| **Mother-tongue routing already exists** — `civToLanguageServer(civilization)` and the civ-override that replaces the passed language | `src/index.ts:4913` + override at `:13541` |

Casting is therefore an **entry layer** (a cast step before the pipeline) plus a
**parameter layer** (feed the cast into the existing generator). Nothing about the
MV panel / capsules / streaming changes.

---

## 3. P0 — Data model (executable checklist)

The `actor_castings` table exists but only carries `role_name` (free text) +
price. Extend it to model role + alignment + billing, and add a per-work cast
container.

- [ ] **New migration `migrations/094_casting_roles.sql`:**
  - `ALTER TABLE actor_castings ADD COLUMN role TEXT` — enum-by-convention:
    `protagonist | antagonist | supporting | extra`.
  - `ADD COLUMN alignment TEXT` — `good | evil | neutral`.
  - `ADD COLUMN billing_order INT NOT NULL DEFAULT 0` — top billing = 0.
  - `ADD COLUMN archetype TEXT` — one `ROLE_TAXONOMY` key (hero/villain/…),
    snapshotted at cast time (the actor's `archetypes[]` may change later).
  - `ADD COLUMN auto_suggested BOOLEAN NOT NULL DEFAULT false` — was this slot
    filled by the recommender vs hand-picked.
  - Index `(work_id, billing_order)`.
  - Back-compat: existing rows get `role='protagonist', alignment='neutral'`.
- [ ] **Cast is derived, not duplicated:** a work's cast = `SELECT … FROM
  actor_castings WHERE work_id=$1 ORDER BY billing_order`. No new `works` column;
  `actor_castings` is the source of truth.
- [ ] **Type**: add a `WorkCastSlot` TS type in `src/` (role, alignment,
  actor_id, archetype, billing_order, actor snapshot fields needed for prompts:
  civilization, name_en/native, style_descriptor, gender).
- [ ] **Decision needed (Jing):** cap on cast size per format? (e.g. MV ≤ 3
  named + N extras; film unlimited). Default proposal: MV 1–3 named, extras as a
  count not individual rows.

## 4. P1 — Casting UI + recommendation (executable checklist)

### 4a. Recommendation endpoint
- [ ] **`POST /api/cast/recommend`** in `src/index.ts` (near the other `/api/mv/*`
  routes). Body: `{ civilization?, genre?, mood?, format, needed: [{role, alignment,
  archetype?}] }`. Returns per slot a ranked list of `digital_actors`.
  - Ranking (文明智能联动): same-civilization first, then `archetype` match against
    the actor's `archetypes[]`, then alignment fit (villain archetype → antagonist),
    then `is_premium`/popularity tiebreak.
  - Reuse `civToLanguageServer` to attach each candidate's mother-tongue so the UI
    can preview language per pick.
  - No new model call required for v1 — pure SQL ranking over `digital_actors`.
- [ ] **Decision needed (Jing):** should extras be auto-generated actors (synthetic,
  no DB row) or only drawn from the existing library? Proposal: v1 draws from library;
  synthetic extras is a later wave.

### 4b. Cast panel (frontend)
- [ ] New **cast step** injected at the MV-pipeline entry (before seed). A panel
  (governed by 面板宪法) with **role slots**: 主角 / 反派 / 配角 / 群演, each showing
  the recommended actor with swap/search/clear, plus an alignment toggle.
  - Reuse the actor-gallery card renderer + the new `/img` proxy for thumbnails.
  - Reuse `ROLE_TAXONOMY` for archetype chips.
- [ ] **Seed the protagonist slot from the existing button:** `castRun(actor,
  workType)` (`app.actor-gallery.js:1103`) currently opens creation with a single
  actor — change it to pre-fill the protagonist slot of the new cast panel instead
  of a bare prompt. Keep the one-tap path for users who don't want to cast others.
- [ ] **Output routing unchanged:** on generate, the cast is posted alongside the
  seed; the flow lands in the **MV panel → 6-capsule → 流流流** exactly as today.

### 4c. ② Mother-tongue wiring (approved model — fold into P1)
- [ ] **MV lyrics default to the protagonist's mother tongue:** at the cast→seed
  boundary, set `language = civToLanguageServer(protagonist.civilization)` before
  calling `POST /api/mv/seed`. Verify the existing civ-override (`src/index.ts:13541`)
  fires on this path; if the cast path bypasses it, route through it.
- [ ] **Explicit override wins** (per CLAUDE.md 文明智能联动): the MV panel's existing
  language selector overrides the civ default. Intervention model (approved): **one
  small 🌐 language switch per surface** (母语 / 界面语 / 自选) + the global language
  panel's explicit choice still wins.
- [ ] **Card mother-tongue voice intro:** the actor card's intro playback defaults to
  `civToLanguage(actor.civilization)`; add the 🌐 switch beside the play button to
  re-voice in another language on demand.

---

## 5. P2 — Feed the cast into the existing pipeline (plan-level)

- Cast → generation params: protagonist civilization drives lyrics language (§4c) +
  the existing ~25 文明智能联动 params (style/instrument/era/vocal timbre) blend across
  the cast (protagonist-weighted).
- Output defaults into the MV panel; capsules + streaming lyrics unchanged.
- No new panel — extend `POST /api/mv/seed` (or a thin `/api/mv/seed-cast` wrapper)
  to accept `cast: WorkCastSlot[]`.

## 6. P3 — Multi-format (plan-level)

- Add a `format` parameter: `mv | triptych | opera | short_drama | series | film`.
  `castPromptFor` already branches `triptych`/`opera` — generalize it into a
  format→structure template (segment count, duration, act structure).
- Each segment reuses the P1 cast + P2 pipeline. Roll out in order: **MV (now) →
  triptych (validate multi-segment orchestration) → longer formats.**
- Series/film get an episode/act container over `actor_castings` (cast persists
  across segments; billing_order carries).

---

## 7. Touch-point summary

| Layer | Files |
|---|---|
| DB | `migrations/094_casting_roles.sql` (new) |
| Backend | `src/index.ts` — `POST /api/cast/recommend` (new), cast-aware seed, ensure civ-override on cast path |
| Frontend | `public/app.actor-gallery.js` — cast panel + `castRun` pre-fills slots; MV-pipeline entry adds cast step; 🌐 language switch |
| Reused untouched | MV panel, 6-capsule progress, 流流流 streaming, `civToLanguageServer`, 25-param 联动, `digital_actors` |

## 8. Open decisions for Jing (before P0 coding)

1. Cast size cap per format? (proposal: MV 1–3 named + extras-as-count)
2. Extras from library only, or synthetic-generated? (proposal: library first)
3. Is the cast step **mandatory** at MV entry, or optional (one-tap still bypasses)?
   (proposal: optional — protagonist auto-filled, casting others is opt-in)
4. Pricing: `actor_castings.cast_price_cents` already exists — does casting
   multiple premium actors sum their cast prices into the wallet debit? (ties to
   the W219 pay-as-you-go wallet)
