# Wave 108 — Minimalist Home + Compact Auto-Hide Activity Bar

**Owner**: Jing
**Drafted**: 2026-05-09 (after Wave 107C)
**Status**: 🟡 **Awaiting design sign-off** before implementation

---

## The user's core complaint

> "ViewWall 盖住了所有的面板，相当于主界面只有 ViewWall 了。"

The home shelf stack (`#cssos-home-shelves`) currently renders **5 large shelves** in sequence:

1. 🎉 Festival shelf
2. 🏛 文明热门 MV (image cards — what Jing calls "ViewWall")
3. 🏛 文明流派 (group cards)
4. 🎨 风格电台 (5 style chips)
5. 📅 今日历史
6. ✨ 为你推荐 (currently shows untranslated `recs.personMv.title`)

Together they occupy the entire viewport, can't be scrolled past, can't be hidden, can't be covered by other panels — so the home page IS the shelves. The user wants the home page to be **minimalist + futuristic**: just the logo with tiny utility icons in the corners. The activity content needs to live in something compact and dismissible.

## Design intent (verbatim from Jing)

- 主界面 = logo panel only by default
- Top corners stay: version-info pill (top-left), theme-color toggle (top-right)
- Bottom-right keeps the AI chat button
- Dock is NOT removed — auto-hides on no-op like today
- A new **compact bar** replaces the shelf stack:
  - **6 tabs** in ONE container with a single background frame
  - Tabs separated by `/` and each tab has its own background color
  - Tab list: **排行榜** + **🎨 风格电台 (5 sub-genres: Epic, Tang, Ambient, Cinematic, Rock)**
- Below the compact bar: **🏛 文明流派** (6 schools — Daoism, Greek Philosophy, etc.) as a horizontal row
- Width: same as current `#cssos-home-shelves` (≤1280px) — must NOT cover the top-corner pills
- Position: top-center by default. **If Dock is at top → compact bar + groups row reposition to bottom-center.**
- **Auto-hide after 10s of no activity**, same as dock. Re-show on mouse move / key / scroll near it.
- Logo panel stays visible always (with corner pills)

## What moves where

### Stays on home (always visible)
- Logo panel (`.logo-panel` / `<header class="title">`)
- Version-info pill (top-left)
- Theme/appearance toggle (top-right)
- AI chat floating button (bottom-right)
- Dock (auto-hide as today)

### Moves into the new compact bar
- **排行榜** (leaderboard tab — new-ish; need to confirm if `app.leaderboard.js` exists or if this becomes a fresh tab driven by an API call)
- **🎨 风格电台** — 5 style sub-tabs: `epic | tang | ambient | cinematic | rock`

### Moves into Person-MV panel as its landing
- 🏛 文明热门 MV image grid (奶奶, 爱因斯坦, 亚历山大大帝...) — currently top of home, becomes Person-MV panel landing screen ("游客进入就显示这些图片墙")
- The text-based recommendations (✨ 为你推荐) become the **second / third** screen inside Person-MV panel, not the entry

### Stays on home but as a single horizontal row below the compact bar
- 🏛 文明流派 (6 group cards)

### Removed from home entirely
- 📅 今日历史 — option: move into Person-MV panel "Today" tab; or sunset
- 🎉 Festival shelf — keep as transient overlay (only shows on festival days, unchanged)
- ✨ 为你推荐 (current shelf) — folds into Person-MV panel later screens

---

## Visual sketch (terminal art)

```
Default state — minimalist (after 10s idle):

┌───────────────────────────────────────────────────────────┐
│ [v]                                                  [☀] │  ← top corners
│                                                          │
│                                                          │
│                                                          │
│                                                          │
│                       ╱╲                                 │
│                      ╱  ╲                                │
│                     │CSS│                                │  ← logo only
│                      ╲ Studio                            │
│                       ╲╱                                 │
│                                                          │
│                                                          │
│                                                          │
│                                                  [💬]    │  ← AI button
│                                                          │
│ [🎙][📁][▶️][💎] ...                                       │  ← dock (auto-hide)
└───────────────────────────────────────────────────────────┘

On hover / interaction within ~last 10s:

┌───────────────────────────────────────────────────────────┐
│ [v]                                                  [☀] │
│                                                          │
│  ╔════════════════════════════════════════════════════╗  │
│  ║ 排行榜 / 🗡 Epic / 🐉 Tang / 🎼 Ambient / 🎬 Cine / 🎸 Rock ║  ← compact bar
│  ╚════════════════════════════════════════════════════╝  │
│  [☯ Daoism] [🏛 Greek Phil] [🇨🇳 Tang] [🛡 Roman] ...      │  ← schools row
│                                                          │
│                       ╱╲                                 │
│                     │CSS│                                │
│                      ╲╱                                  │
│                                                          │
│                                                  [💬]    │
│ [🎙][📁][▶️][💎] ...                                       │
└───────────────────────────────────────────────────────────┘

Dock at top → compact bar + schools flip to bottom:

┌───────────────────────────────────────────────────────────┐
│ [🎙][📁][▶️][💎] ...                                       │  ← dock at top
│ [v]                                                  [☀] │
│                       ╱╲                                 │
│                     │CSS│                                │
│                      ╲╱                                  │
│                                                          │
│                                                          │
│                                                          │
│  [☯ Daoism] [🏛 Greek Phil] [🇨🇳 Tang] [🛡 Roman] ...      │
│  ╔════════════════════════════════════════════════════╗  │
│  ║ 排行榜 / 🗡 Epic / 🐉 Tang / 🎼 Ambient / 🎬 Cine / 🎸 Rock ║  ← compact bar at bottom
│  ╚════════════════════════════════════════════════════╝  │
│                                                  [💬]    │
└───────────────────────────────────────────────────────────┘
```

---

## Tab color palette (proposed)

Each tab gets a translucent background tinted by genre. Subject to your taste:

| Tab | Color (hsl) | Why |
|---|---|---|
| 排行榜 | `hsla(45, 90%, 55%, 0.15)` (gold) | Trophy / top |
| 🗡 Epic | `hsla(0, 70%, 50%, 0.15)` (crimson) | Sword / battle |
| 🐉 Tang | `hsla(35, 80%, 50%, 0.15)` (amber) | Tang dynasty palette |
| 🎼 Ambient | `hsla(190, 70%, 55%, 0.15)` (cyan) | Atmospheric |
| 🎬 Cinematic | `hsla(280, 60%, 55%, 0.15)` (violet) | Cinema |
| 🎸 Rock | `hsla(340, 75%, 50%, 0.15)` (magenta) | Energy |

Separator between tabs is the `/` glyph in `rgba(255,255,255,0.3)` mono font.

---

## Implementation tasks

### T1 — Audit current shelf wiring

Find what each shelf actually renders, where its data comes from, and what would break if we hide/move it:
- `public/app.person-mv-discover-shelf.js`
- `public/app.person-mv-groups-shelf.js`
- `public/app.person-mv-style-shelf.js`
- `public/app.person-mv-today-shelf.js`
- `public/app.person-mv-recommendations-shelf.js`
- `public/app.home-shelves-position.js`

### T2 — Build the new compact bar

New file: `public/app.home-activity-bar.js`. ~150 LOC.

```html
<div id="cssos-activity-bar" class="cssos-activity-bar" data-position="auto">
  <button data-tab="leaderboard">🏆 排行榜</button>
  <span class="sep">/</span>
  <button data-tab="epic">🗡 Epic</button>
  <span class="sep">/</span>
  ...
</div>
```

CSS spec:
- Single rounded background frame (`backdrop-filter: blur(20px)`)
- Width clamps to current shelf width (≤1280px)
- Each tab pill has its own bg color (palette above)
- Top center default; bottom center when dock is at top
- Click a tab → opens a small overlay panel (320×480) below the bar showing that genre's top 10. Tab stays selected; clicking again closes.

### T3 — Auto-hide behavior

Mirror dock auto-hide:
- Visible on initial load for 5s (gentle reveal)
- Hide after 10s of no `pointermove` / `keydown` / `scroll` over a 200px detection zone around the bar
- Re-show on `pointermove` within that zone or `mouseenter` on the bar
- `prefers-reduced-motion: reduce` → no fade transition, just toggle

### T4 — Schools row

Restyle `#person-mv-groups-shelf` into a single-row horizontal scroll:
- Below the compact bar (or above when dock is at top)
- Each pill: emoji + group name (no large card image)
- Click → opens Person-MV panel filtered by that group (existing `openPersonMvGroup(gid)`)
- Same auto-hide as compact bar

### T5 — Move image grid into Person-MV landing

- The `#person-mv-discover-shelf` content (奶奶, 爱因斯坦, ...) becomes the **default tab** inside the Person-MV panel.
- Render order inside Person-MV:
  1. Image grid (current ViewWall content) — first thing user sees
  2. Curation tabs (S / A / B tier) — second screen
  3. Text-only recommendations — third screen
- Person-MV panel auth was just relaxed in commit `6af0ad0` so guests see all of this; only actions trigger login.

### T6 — Sunset shelves on home

Hide these elements via CSS (don't delete, in case we want to restore):
- `#person-mv-festival-shelf` — keep but only renders on festival days
- `#person-mv-discover-shelf` — hide on home; the shelf logic still feeds Person-MV
- `#person-mv-style-shelf` — replaced by the new bar
- `#person-mv-today-shelf` — hide on home; surface inside Person-MV
- `#person-mv-recs-shelf` — hide on home; surface inside Person-MV
- `#cssos-home-shelves` container itself — keep for now; renamed/reused by the new bar

### T7 — Logo panel scaling

Verify logo doesn't get covered when compact bar is at top. If overlap on small viewports:
- Add a CSS rule: when bar is visible, logo scales to 70% on viewports ≤900px.
- When bar is hidden (auto-hide active), logo returns to 100%.

### T8 — Dock-position awareness

The bar reads `behavior.dock.dock_position` (already in panel-behavior settings):
- `bottom` (default) → bar at top
- `top` → bar at bottom
- `left` / `right` → bar at top center (unchanged)

### T9 — Cache bust + ship

- Bump `?v=` for any modified file
- New file gets a `?v=20260509-wave108-activity-bar`

### T10 — Manual smoke

- Home page on Mac Safari → bar shows for 5s, hides after 10s idle, reappears on hover ✅
- Home page on iPhone (web) → same ✅
- Home page in iOS native app → same ✅ (no Capacitor-specific code needed)
- Person-MV panel opens for guest → shows image grid as landing, no login prompt ✅ (already done)
- Click "🎬 进入影院" as guest → login prompt appears ✅ (already done)
- Tap排行榜 tab → top 10 list overlay opens, click again closes
- Tap 🗡 Epic tab → epic-genre top 10 opens

---

## Risks

1. **Performance** — adding a backdrop-filter blur element can hurt mobile Safari. Mitigate: use CSS `will-change: opacity` only, and `contain: layout paint` on the bar.
2. **Accessibility** — auto-hide can confuse screen readers. Mitigate: bar has `aria-live="polite"` and remains in tab order even when visually hidden (`opacity: 0` instead of `display: none`).
3. **Discoverability** — first-time users may not know the bar auto-hides. Mitigate: gentle 5s initial reveal, plus a one-time tooltip "Move your mouse here for the activity bar" on first visit (uses localStorage flag).
4. **Persistence of last-selected tab** — store in `panelBehavior.home.activeTab` so reload returns to user's last view.

---

## Definition of done

- [ ] Default home shows ONLY logo + corner pills + AI button + dock
- [ ] Activity bar appears for 5s on load, hides after 10s idle, restores on interaction
- [ ] 6 tabs work: 排行榜, Epic, Tang, Ambient, Cinematic, Rock — each opens a 10-item overlay
- [ ] Schools row appears under the bar (or above if dock is on top)
- [ ] Bar auto-flips to bottom when `dock_position === "top"`
- [ ] Logo panel never gets covered by the bar
- [ ] Person-MV panel opens for guests with image grid as landing
- [ ] Login is gated only at action layer inside Person-MV (already shipped in commit `6af0ad0`)
- [ ] No regressions: festival overlay still appears on festival days
- [ ] Cache-bust applied, deployed, verified on prod

---

## Open questions for Jing

1. **排行榜 tab content**: top-10 by views? by likes? mixed score? Or four sub-tabs inside (views / likes / shares / new)?
2. **Schools row content**: keep all 6 groups visible, or scroll-overflow if more groups added later?
3. **Festival overlay**: should it interrupt the minimalist home (full-screen takeover) or also live in the activity bar as a 7th tab on festival days?
4. **iOS native**: same auto-hide timing (10s)? Or shorter on touch devices (5s)?

---

## Estimated effort

| Block | Hours |
|---|---|
| T1 Audit | 0.5h |
| T2 Compact bar component | 2h |
| T3 Auto-hide | 0.5h |
| T4 Schools row restyle | 0.5h |
| T5 Move grid to Person-MV | 1.5h |
| T6 Sunset shelves CSS | 0.5h |
| T7 Logo scaling | 0.5h |
| T8 Dock-position awareness | 0.5h |
| T9 Cache + ship | 0.5h |
| T10 Smoke test | 0.5h |
| **Total** | **~7 hours** focused work |

---

## Out of scope

- Re-skinning the dock (separate concern, recently fixed)
- Rebuilding 排行榜 backend (assume `/api/leaderboard?genre=epic&limit=10` exists or stub it; backend wave separately if missing)
- Translating `recs.personMv.title` (small i18n fix can ride along)
