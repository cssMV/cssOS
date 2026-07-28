# cssOS — System Constitution

## 面板宪法 (Panel Constitution)

All panels — static or dynamically injected — are governed by these rules.
Any new panel or modal that bypasses these rules is a constitutional violation.

### Article 1 — Standard controls

Every panel has exactly **three window buttons** and a draggable titlebar:

| Button | Action |
|--------|--------|
| **—** Minimize | Hide the panel body; keep the titlebar visible as a collapsed strip |
| **⤢** Maximize / Restore | **True OS-level window maximize** — `document.documentElement.requestFullscreen()` (with vendor prefixes). On Apple Vision Pro this enters Immersive Space. Must never be a CSS-only trick. Restore returns to the last user-sized floating position. |
| **×** Close | Collapse panel to its Dock icon (never destroy state) |

Panels are **draggable** (titlebar = handle) and **resizable** from all 8
edges/corners. Both behaviors apply to dynamically injected panels too.

### Article 2 — Screen-boundary clamp

A panel **must never leave the viewport**, including after resize or
orientation change. The titlebar (drag handle) must always remain reachable.
On every drag move and resize, clamp the panel rect to:
```
left  ≥ 0
top   ≥ 0
right  ≤ window.innerWidth
bottom ≤ window.innerHeight  (at minimum, keep titlebar height inside)
```

### Article 3 — Z-index focus order

Whichever panel the user most recently activated (clicked, tapped, or opened)
sits on top. All other panels sit below it in activation order. A single
`zIndexCounter` tracks the global stacking order; each activation increments
it and sets the panel's `z-index`.

### Article 4 — Swipe to switch (multi-panel)

When two or more panels are open, a **left / right swipe** cycles focus
between them (brings next/previous panel to front, Article 3). The swipe
gesture is recognized on the panel body and the dock area.

### Article 5 — Quick swipe up = close

A fast upward fling on a panel body triggers **Close** (Article 1 × button).
Velocity threshold: ≥ 400 px/s over ≤ 200 ms.

### Article 6 — Quick swipe down on titlebar = minimize

A fast downward fling **while holding the titlebar** triggers **Minimize**
(Article 1 — button). Same velocity threshold as Article 5.

### Article 7 — Double-tap = panel settings overlay

A double-click / double-tap on the panel body opens a compact **panel
settings popover** (position, size presets, snap-to-grid, opacity). A single
click anywhere outside dismisses it.

### Article 8 — Simultaneous panel limit

**Default: 5 panels maximum.** When the user tries to open a 6th panel,
the least-recently-used (LRU) open panel is automatically minimized to its
titlebar strip. No dialog, no interruption — seamless. The Dock pill bar
shows at a glance how many slots are occupied.

Power users (Studio / Enterprise tier) may raise the limit via panel
settings (Article 7 settings overlay).

*(If Jing explicitly changes this number, update here AND in
`app.panel-manager.js` `PANEL_MAX_OPEN`.)*

### Dock Pill Constitution (Addendum)

The Dock is a **chromatic 凸嵌凹 pill bar** — the same `data-pill-bar`
system as every other tab bar on the platform.

| Dock position | Pill orientation | Notes |
|---|---|---|
| Bottom (default) | Horizontal `data-pill-bar` | Natural fit for the pill geometry |
| Left / Right | Vertical `data-pill-bar` + `flex-direction:column` | Pill bites rotate 90° |
| Top | Horizontal `data-pill-bar` | Mirror of bottom |

**Default = pill mode.** Users may revert to Apple-icon style via Advanced
Settings → Dock → Style. The setting key is `dock.style`: `"pill"` (default)
or `"icon"` (legacy Apple-style). The active Dock item gets `.active` class;
the `data-action` attribute on each `.dock-item` is the pill key.

**Labels:** Each pill may show a short panel title below (or beside) the
icon, controlled by the existing `dock.show_labels` setting. In pill mode
the label is always visible at comfortable size; in icon mode the label
fades on hover (legacy behavior).

**Snap-to-edge with ghost preview:**
The Dock pill bar retains the full 4-edge snap behavior (bottom / left /
right / top). During a drag, when the Dock center crosses within 48 px of
any screen edge, a **snap ghost** appears — a translucent pill-bar-shaped
outline at the *exact* dimensions and position the Dock would occupy if
released. The ghost uses `outline: 2px dashed rgba(0,245,160,0.55)` and
`background: rgba(0,245,160,0.07)`, border-radius matching the pill track.
Releasing inside the snap zone commits; dragging back out dismisses the
ghost. The ghost element id is `#dock-snap-ghost`.

**Direction-aware pill geometry:**
- Bottom / Top: standard horizontal `data-pill-bar`
- Left / Right: `data-pill-bar` + `data-pill-vertical` attribute →
  `flex-direction: column`. The 凸嵌凹 mask geometry rotates 90°:
  active pill bites into above/below neighbors instead of left/right.

**Enforcement:** New dock items added via `ensureDockItem()` must include
`data-action` (already required) — this doubles as the pill key. No extra
markup needed.

**Minimum width + mandatory icon (W490):** Every Dock pill has
`min-width: 120px` (= 3 × the 40px pill height). Short labels must never
shrink to a mis-tap-prone sliver; the floor guarantees a stable tap target,
and `grid 1fr` still expands pills when space allows. Every Dock pill MUST
also carry an icon (emoji or image) as a visual anchor — a label-only pill in
pill mode loses its boundary cue. `ensureDockItem()` injections must include a
leading icon glyph. (Scope: Dock only — this is NOT yet promoted to the
platform-wide `data-pill-bar` constitution; other bars are unchanged.)

**The mic pill is special (W488–W490):** the mic's oversized icon overflows
the track upward (`.dock-mic-icon` negative `translateY` rising into the
track's transparent top headroom — the track is `54px` tall = `40px` capsule
+ `14px` headroom, with the green fill painted by a `linear-gradient` only on
the bottom 40px so no green strip appears above the other pills). The mic
still **participates in 凹凸镶嵌** at both side edges; it only adds
`overflow: visible` + `mask-clip: no-clip` so the vertical pop survives the
side-carving mask. The mic is pinned **first** in `DOCK_FRONT_PINNED` /
`DOCK_DEFAULT_ORDER` and in static HTML so it is already in position 1 on load
(it is the default-active pill, and the active pill moves to first).

---

## 平台视觉签名 (Platform Visual Signatures)

cssOS has two visual signatures that are as recognizable as a logo. Every AI,
contributor, and future wave **MUST** preserve them. Destroying either one —
even accidentally, even "while I'm here" — is a regression equivalent to
removing the brand color.

### Signature 1 — 「流流流」 Streaming UI

The live-generation streaming interface: text, lyrics, subtitles, and MV
frames flow in character by character / frame by frame as the AI generates
them. The sensation of "watching the AI think in real time" is intentional
and irreplaceable. Never replace streaming output with a loader spinner +
final-reveal. The stream IS the product.

### Signature 2 — 随机色凸嵌凹胶囊 (Chromatic 凸嵌凹 Pill Bar)

Every tab switcher, action bar, filter row, and progress strip on the
platform uses the **v28 凸嵌凹 pill constitution**:

- Active pill = full convex pill, saturated with its **own hue**.
- **ALL** inactive pills concave toward active — not just immediate neighbors.
  Every inactive to the RIGHT of active: left side concave (凹向左 = toward active).
  Every inactive to the LEFT of active: right side concave (凹向右 = toward active).
  Adjacent pairs of inactives on the same side also interlock — the "river
  flows toward the island" effect. Use `~` (general sibling), never `+`.
- Each pill gets a **distinct hue** from the 12-step spectrum palette
  (`CSSOS_PILL_HUES = [155,192,235,268,310,342,22,48,82,118,168,210]`).
- The track border + background follows the active pill's hue (`--th`),
  transitioning smoothly on activation.
- One global utility: `cssosMakePillBar(el, opts)` in `app.pill-bar.js`.
  `MutationObserver` auto-stamps every `[data-pill-bar]` in the DOM,
  including dynamically injected popups and modals.

**Enforcement rules for contributors:**

1. Any new tab bar, segmented control, filter row, or parallel-button group
   **MUST** use `data-pill-bar` on the container. No bespoke pill CSS.
2. `data-pill-bar` works on **any** child element type: `<button>`, `<div>`,
   `<span>`, `<input>`, `<select>`, `<label>` — whatever is in the container.
3. For progress strips with equal-width chips (e.g. the 6-stage MV pipeline),
   add `data-pill-equal` to switch to `flex:1 1 0` layout.
4. For panels with a light background, add `data-pill-text="dark"` to the
   container for readable text.
5. `mono:true` option (or `data-pill-mono` attribute) reverts to single
   brand-green — use only when a design explicitly calls for monochrome.
6. **Do NOT** write bespoke tab/pill CSS. If you find yourself writing
   `.some-tab.active { border-radius:999px … }`, stop and use the utility
   instead.
7. **Every pill carries an icon + a minimum width (W497).** When applying
   pill style, any pill whose label has no leading icon **MUST** get one
   (emoji or image) as a visual anchor, and the bar gets
   `min-width = pill-height × 3` (= 120px at the standard 40px height) to keep
   short labels from shrinking to a mis-tap-prone sliver. Read-only DISPLAY
   chips (badges) take the capsule *look* only — never the 凸嵌凹 interlock or
   the min-width (they are not selectable targets). Apply the min-width
   **per-bar** as each bar is migrated, not as a blanket global rule, so an
   already-live bar's layout can't regress unverified. **Reliable way to get
   the 120px floor:** pin the COLUMN floor with
   `grid-auto-columns: minmax(120px, 1fr) !important` on the bar — child
   `min-width:120px` alone is unreliable because `minmax(max-content,1fr)`
   does not fold min-width into max-content, so short labels stay cramped.

The W220.A frozen items (`.creation-tabs`, `.seed-script-tabs`,
`.msrc-tabbar`, `.palette-presets`) are exempt from migration but must not
regress; new components always use `data-pill-bar`.

---

## 文明智能联动 (Civilization Smart Linkage)

These six characters are the **spiritual backbone** of cssOS. When this
principle is not enforced, many sources of chaos sprout. It governs how the
UI locale, the user's explicit language choice, and the person/civilization
context combine to drive up to ~25 MV parameters — music style, lyrics
language, vocal timbre, instrumentation, era cues, etc.

### Two entry paths to the MV panel

**1. Normal path** — logo / mic / play / long-press / keyboard shortcut /
AI assistant prompt → MV panel.

- Lyrics language **follows the UI locale**.
- If the user has explicitly chosen a different language in the language
  panel, that explicit override wins.
- Zero-friction: whatever language the interface is in, that is what the
  user hears back.

**2. Person-MV path** — clicking a person card → MV panel.

- Lyrics language **MUST follow the person's mother tongue**, derived from
  `person.civilization`.
- This is **independent of** the UI locale and **independent of** any
  language the user has selected.
- Implementation: `civToLanguageModule(civilization)` (frontend,
  `app.civilization-language.js`, W196) and `civToLanguageServer(civ)`
  (backend, `src/index.ts`, W197).

### Scope

文明智能联动 is not only about lyrics language. It propagates civilization
context into music style, instrumentation, era, vocal characteristics and
other MV parameters. Lyrics language is the most visible facet; the rest
must stay coherent with it.

### Enforcement rule for contributors

Any new MV entry path, AI prompt, or auto-generation flow MUST decide
which of the two paths above it belongs to and route language/civilization
accordingly. Defaulting to "whatever string is in the textbox" is not
acceptable.

---

## Pricing & subscription constitution (W219)

### Two-layer billing — never mix them

1. **Subscription = ACCESS / capabilities only.**
   Decides what a user *can do* (length cap, seats, lossless, API, etc.)
   and *how fast* (queue lane, concurrency). Never decides *how much*
   they can output. There is **no monthly generation quota** on any
   tier; `monthlyGenerationLimit` is hardcoded `null` and any legacy
   gate that reads it is intentionally inert.

2. **Output = pay-as-you-go from wallet.**
   `user_credits.balance` is stored in **integer cents USD** and
   debited by the EXACT cents the third-party engine bills us
   (`estimateEngineCostCents` → `debitCredits`). Staff exempt via
   `isCssosAdminEmail`. Pre-flight balance gate refuses the call
   *before* burning any vendor money.

### Tier matrix (single source of truth — Apple IAP catalog)

**W1448 pricing reset (Jing).** Studio Annual anchored at **$999.99**
(the prior $1000 entry triggered an Apple Guideline 3 review hold).
Annual = monthly × 10 (~17% off), all `.99` endings. **Enterprise tier
RETIRED as a purchasable SKU** — removed from the IAP catalog, the
`tierPriceCents` ladder, and the frontend plan modal. (Enterprise
*capability gates* in `membershipPolicyForTier` and the tier-permission
arrays are intentionally left intact for grandfathered access and a
separate capability-layer wave; only its PRICE/purchase surfaces are gone.)

| Tier | Monthly | Annual (monthly × 10) |
|---|---|---|
| free | $0 | — |
| starter | $9.99 | $99.99 |
| pro | $29.99 | $299.99 |
| studio | $99.99 | $999.99 |
| contact | $999+ (custom) | — |

Stripe `tierPriceCents` and any future Alipay/WeChat/NihaoPay
integration MUST mirror these exact amounts. **Apple ASC, the backend
`IAP_PRODUCT_CATALOG`, `scripts/iap-sync.mjs`, `tierPriceCents`, and the
frontend plan modal must all stay identical — consistency across surfaces
is the hard rule (Jing), independent of the absolute price.** rust-api's
`membership_tier_plan` copy is retired (W219.5); do not re-sync.

### Capability axes (per `membershipPolicyForTier`)

`maxOutputLengthSeconds` · `fullLengthBonusOdds` · `seats` ·
`concurrentJobs` · `cloudStorageBytes` · `workRetentionDays` ·
`canExportLossless` · `canRemoveWatermark` · `canCustomWatermark` ·
`canSellWorks` · `canTakeCommissions` · `platformCutBps` ·
`canReceiveTips` · `canUseApi` · `canUseWebhooks` · `canSelfHost` ·
`canForcePremiumProvider` · `canUpscale4k` · `queueLane` ·
`supportResponseHours` · `hasDedicatedSupportChannel` ·
`uptimeSlaPercent`.

Key rules:
- **Free**: 60s cap, 1 concurrent, marketplace ❌ (no white-label sales).
- **Starter**: 3min, marketplace ✅ (first paid step).
- **Pro**: 8min (full song length), lossless WAV/FLAC ✅, **1% full-length bonus**.
- **Studio**: 10min, 4K upscale, API access, 10 seats, 500GB.
- **Enterprise**: 10min, 30 seats, 2TB, 99.5% SLA, custom watermark.
- **Contact** ($999+): private deployment, negotiated cut, dedicated CSM.

### Wallet rules

- Top-up: Stripe Checkout / Apple IAP credit packs (shared
  `IAP_PRODUCT_CATALOG` SKUs).
- Withdraw: $20 minimum, 2 weeks payout (Stripe Connect), KYC at
  $600/yr cumulative (1099-K line). Only user-deposited funds are
  withdrawable; bonus / refund credits stay in the wallet.
- Anti-fraud: same-card top-up → withdraw within 30 days delayed.
- Cancelling subscription **never** clears the wallet.

### What `/api/premium/*` does now

The legacy single-tier "Premium" subscription ($9.99/mo on Stripe;
¥69/mo on Alipay/WeChat; $9.99 on NihaoPay) is **retired**:
- `POST /api/premium/subscribe` → 410 Gone + migration hint.
- `POST /api/premium/subscribe-cn` → 410 Gone (Alipay/WeChat coming
  back on the unified tier system in W219.3).
- `GET /api/premium/providers` → empty `providers: []` + `deprecated: true`.
- Existing `users.premium_until` rows are honored until they expire;
  no force-cancel. New subscriptions go through `/api/billing/checkout`.

---

## ⚠️ MUSIC STYLE block — HARD-LOCK (Jing red-line)

**Touching this without an explicit Jing message naming this block by
name is a red-line violation.** Jing has called this out explicitly,
repeatedly, and at the limit of patience. Any AI / collaborator must:

1. NOT modify any of the following without prior authorization:
   - `.creation-tabs` (Genre / Mood / Instrument / Ambience / Vocal Gender)
   - `.creation-chips` (Chinese GuFeng / Pop / Rock / Classical / ...)
   - `#creation-style-input` and its surrounding label/row
   - `#creation-style-count`
   - any wave 28 step file or section referencing these selectors
2. Before any change, send a confirmation request like:
   "I plan to change <selector> by <one-line summary>. Authorize? (yes/no)"
3. Wait for an explicit "yes" before shipping. No "while I'm here"
   bundling, no consistency passes, no auto-extension.

If a CSS pass needs to "consolidate" rules and that pass touches any
of the above selectors, ABORT the pass and ask Jing first.

This rule exists because the block has been "completed" multiple times
and silently regressed by AI overreach. The cost is paid by Jing's
evenings. The fix is a process boundary, not a code constraint.

---

## W220.A pill wave — PERMANENTLY FROZEN

The following components and their CSS / JS are **frozen as of v28
step 34**. No AI, no future wave, no "polish pass" touches them
without an EXPLICIT instruction from Jing naming the exact change:

- `.creation-tabs` + `.creation-tab` (Genre/Mood/Instrument/Ambience/Vocal Gender)
- `.creation-chips` + `.creation-chip` (Chinese GuFeng / Hip Hop / ...)
- `.seed-script-tabs` (Custom Lyrics / Music Source Uploads, Music Structure / Video Outline / Section Scene Prompts)
- `.msrc-tabbar` + `.msrc-tab` (Audio / Video / MIDI / MusicXML / Sheet music / Image)
- `.palette-presets` (Emerald / Crimson / Azure / Violet / Gold)
- `.palette-color-tabs` + `.palette-color-card` (BG color pills)
- Single-pill action bars `#random-palette` / `#apply-settings` / `#creation-clear`
- The v28 constitution rules at the end of `public/style.css`

If a bug appears in one of these, fix THAT bug minimally; do not
"normalize" or "consolidate" the others. If a new tab/pill bar joins
the system, IT adopts the constitution — the existing frozen set is
not touched to match it.

## AI working-discipline rule (W220.A — added the hard way)

Jing should NOT have to re-inspect the codebase after every turn to
check whether I touched something I wasn't asked to. That's a tax
on his time, and it's mine to eliminate. Four hard rules:

1. **No-instruction = no action.** Even when the screen "obviously
   needs one more thing", even when style is "obviously inconsistent",
   even when a related component "would clearly benefit" — I do not
   touch it. Consistency / completeness is Jing's call, not mine.

2. **Want to touch something not in this turn's instruction → ASK
   FIRST.** Format: "I see X in <file:line>, do you want me to also Y?"
   Ship only after explicit yes. No silent "while I'm here" edits.

3. **Instruction scope == change scope.** If Jing says "change A",
   I only modify A. If I find B is broken or stale next to A, I
   surface it at the end of the response ("by the way, B at <path>
   looks like Z — want a separate wave?") — I do not fix it inline.

4. **回滚 / rollback == pure undo.** Revert the named step. Do not
   bundle in "what I think you really meant" alongside the revert.

Every violation of these in the W220.A pill saga cost 20-30 minutes
of Jing's evening to detect + unwind. Treating the freeze boundary
and the instruction scope as inviolable is faster for both of us.

When in doubt → ASK, don't ship.

---

## Tab-pill constitution (W220.A)

cssOS has exactly **one** visual language for tab/pill switchers across
every panel. Authors MUST pick one of these two modes when adding a new
tab group; never invent a third look.

### Mode 1 — Fixed segmented (equal columns, all visible)

For switchers with a small, fixed number of options (typically **2-4**,
always all on-screen, no scroll).

```html
<div data-segmented="3">
  <button class="active">Tab A</button>
  <button>Tab B</button>
  <button>Tab C</button>
</div>
```

`data-segmented` accepts `"2"`, `"3"`, `"4"`, `"5"`. The container
becomes a grid of N equal-width segments; the active child fills with
brand green. Apple-Safari style.

### Mode 2 — Flex pill-bar (horizontal scroll)

For switchers with **unknown** or **many** options (5+), or dynamically
filled. Same green-tinted background, but children flex + scroll.

```html
<div class="cssmv-pill-bar">
  <button class="active">First</button>
  <button>Second</button>
  ... (any number) ...
</div>
```

### Shared visual rules — "rounded side flows away from active"

Every child segment is visible (light green fill). The ACTIVE pill
has BOTH sides rounded (full pill). Every INACTIVE has only ONE side
rounded — the side pointing **AWAY** from the active pill:

- Inactives **LEFT** of active → **left** side rounded
- Inactives **RIGHT** of active → **right** side rounded

So no matter where the active sits in the row, the rounded corners
flow outward toward both ends of the container, like a "river forking
around an island". The active pill is the only one with a complete
pill silhouette.

Implementation: CSS sibling combinators + `:has()`.
- `.active ~ *` → all siblings AFTER active → right-rounded
- `*:has(~ .active)` → all siblings BEFORE active → left-rounded
- `.active` → `border-radius: 999px !important` (full pill)

Fallback for `:has()`-less browsers: `:first-child` outer-left and
`:last-child` outer-right, middles flat. Works for the common 2-3
tab case; degraded but acceptable on older Safari < 15.4.

| Container property | Value |
|---|---|
| Background | `transparent` (the children carry the fill) |
| Border | `1px solid rgba(0, 245, 160, 0.30)` |
| Border radius | `999px` (long pill) |
| Padding | `0` |
| Gap between children | `0` (segments touch each other) |
| Min-height | `40px` |

| Child property | Inactive | Active |
|---|---|---|
| Background | `rgba(0, 245, 160, 0.08)` | `rgba(0, 245, 160, 0.32)` |
| Border | `0` | `0` |
| Border radius | position-based (see above) | `999px` (full) |
| Padding | `6px 16px` | `6px 16px` |
| Font weight | `inherit` | `600` |
| Hover | `rgba(0, 245, 160, 0.14)` darker preview | n/a |

EVOLUTION OF MISTAKES (kept for context):
- v1: each child a separate pill, head-to-head (WRONG)
- v2: sleeve + filled sibling, both with shapes (WRONG)
- v3: long sleeve + active thumb, inactives transparent (WRONG — user
  couldn't see segment boundaries)
- v4: all segments visible, outer-rounded only, active full-rounded
  pops out (WRONG — still head-to-head visually, not interlocked)
- v5–v23: many failed attempts at concave bites (WRONG — geometry off)
- v24: convex+convex with -20px shift (WRONG — still 凸顶凸, not 凸嵌凹)
- v27: TRUE 凸嵌凹 via mask-image. Active = full pill; every inactive
  extends 20px toward active (`margin: -20px; width: calc(100% + 20px)`)
  and carries a `mask-image: radial-gradient(circle 20px at <inner-edge>,
  transparent 19.5px, #000 20px)` that carves a concave bite matching
  active's convex curve. Hover bg auto-fills the masked shape.
- **v28 (current, LOCKED — do not change):** v27 geometry +
  every pill carries a 1px `rgba(0, 245, 160, 0.30)` border on its
  CONVEX side(s). Active = both left+right 1px borders. Inactive
  right-of-active = own right (convex) 1px border, left (concave) masked.
  Inactive left-of-active = own left (convex) 1px border, right (concave)
  masked. The concave-side border is automatically clipped by mask-image
  so the 凸嵌凹 seam stays one continuous shared curve. Required: pill
  `height: 40px` (mask radius = 20px = border-radius cap). Browser
  support: Safari 15+, Chrome 120+ (needs `:has()`).

  **COMPLETE v28 CSS — copy verbatim when adding any new pill bar:**
  ```css
  /* Active pill — 凸 full pill */
  [data-pill-bar] > [data-pill-key].active {
    border-radius: 999px !important;
    z-index: 2 !important;
    -webkit-mask-image: none !important;
    mask-image: none !important;
  }
  /* ALL inactives RIGHT of active — 凹 left, 凸 right (~ not +) */
  [data-pill-bar] > [data-pill-key].active ~ [data-pill-key] {
    border-radius: 0 999px 999px 0 !important;
    margin-left: -20px !important;
    width: calc(100% + 20px) !important;
    padding-left: 36px !important;
    z-index: 0 !important;
    border-right: 1px solid hsla(var(--ph,155),100%,65%,0.32) !important;
    -webkit-mask-image: radial-gradient(circle 20px at 0px 50%, transparent 19.5px, #000 20px) !important;
    mask-image:         radial-gradient(circle 20px at 0px 50%, transparent 19.5px, #000 20px) !important;
  }
  /* ALL inactives LEFT of active — 凸 left, 凹 right (~ not +) */
  [data-pill-bar] > [data-pill-key]:has(~ [data-pill-key].active) {
    border-radius: 999px 0 0 999px !important;
    margin-right: -20px !important;
    width: calc(100% + 20px) !important;
    padding-right: 36px !important;
    z-index: 0 !important;
    border-left: 1px solid hsla(var(--ph,155),100%,65%,0.32) !important;
    -webkit-mask-image: radial-gradient(circle 20px at 100% 50%, transparent 19.5px, #000 20px) !important;
    mask-image:         radial-gradient(circle 20px at 100% 50%, transparent 19.5px, #000 20px) !important;
  }
  ```
  **Key geometry (never get this wrong again):**
  - Mask center `at 0px 50%` = element's LEFT edge midpoint. Active pill's
    right convex arc center is also at that exact point → perfect 凸凹吻合.
  - Mask center `at 100% 50%` = element's RIGHT edge midpoint → same logic
    for left-side inactives.
  - `margin-left/right: -20px` + `width: calc(100%+20px)` cancel out on
    the far edge; each pill only "steals" 20px from its neighbor — no
    cumulative drift in flex/grid layout.
  - `~` (general sibling) is **mandatory** — `+` (adjacent only) breaks
    凹凸镶嵌 between non-adjacent inactive pills. This was the W466 lesson.

  **Dock-specific extra (text labels inside pills):**
  Wrap label text in `<span>` — the rule `[data-pill-key] > span { font-size: 11px }`
  only shrinks text inside `<span>`. Dynamically injected dock items that
  omit the `<span>` will show oversized text (W466 known issue for Person MV).

  **WHY the convex-side 1px border exists (UX hard constraint, not
  decoration):** on a hover-less or hover-ambiguous bar, without that
  visible thin green line between adjacent inactives a user CANNOT see
  where one pill ends and the next begins. The hover bg fills the whole
  pill — including its 20px convex bulge — and users would discover the
  pill boundary only AFTER clicking. The 1px convex-side border is a
  **click-boundary preview**: it tells the user "this is one pill;
  cross this line and you'll hit the next one." Removing it (even when
  it "looks cleaner") breaks click predictability and is a regression.
  This rule has equal constitutional weight to the 凸嵌凹 mask geometry.

  **No-active state rule:** when a bar has zero `.active` children,
  every pill gets a 1px convex right border too (`:last-child` excepted
  — the track's own right edge serves as its boundary). The bar is
  always "click-boundary previewable" whether or not anything is
  selected yet.

  **第一个胶囊默认激活 (First pill default active):** any pill track that
  has no preset `.active` gets its **first pill** activated by default —
  this provides the convex 凸 anchor island so the existing 凸嵌凹 interlock
  (`.active~` / `.cssos-pill-pre`) forms automatically and the whole strip
  reads as one seamless carved bar. Without an anchor, a zero-selected bar
  degrades into free-floating full-oval pills with gaps between them (the
  "飘椭圆" regression). Never fix that by adding new pill CSS — just default
  the first pill active. Works together with "选中谁→谁到第一个位置" (the
  selected pill becomes the island / moves to first, per the Dock rule).
  For a multi-select track, the default-active first pill is a **visual
  anchor only** — it must not toggle any underlying selection/checkbox, and
  the synthetic active must be cleared before every re-paint so it can yield
  to a real selection once the user picks one.

  **"No default ≠ disabled" rule:** when a bar opens with no pre-selected
  pill, all pills MUST remain clickable from a cold state. In particular,
  if the JS state holds an `activeTab` value for chip-catalog lookup
  while the DOM is suppressing the `.active` class (waiting for first
  user interaction), the click handler MUST force a re-sync even when
  the clicked key already equals `activeTab` — otherwise the first
  click on the pre-seeded tab is a no-op (DOM dedupes on equality).
  Pattern: bump the view-state cache to a sentinel before re-render,
  e.g. `viewState.activeTab = "__force_resync__"`.

RIGHT v6 — rounded side flows away from active:

```
Tab A active (pos 1 of 3):
( A ) B ) C )
  ↑     ↑   ↑
  both  right-rounded only (rightward flow)

Tab B active (pos 2 of 3):
( A ( B ) C )
  ↑   ↑   ↑
  left  both  right

Tab C active (pos 3 of 3):
( A ( B ( C )
  ↑   ↑   ↑
  left  left  both

Tab D active (pos 4 of 9):
( A ( B ( C ( D ) E ) F ) G ) H ) I )
                ↑   ↑   ↑   ↑   ↑   ↑
                both  all-right-rounded (rightward flow)
                                  ↑
                 leftward inactives all left-rounded
```

Convention: `(` marks left-rounded edge, `)` marks right-rounded
edge. Every inactive shows only ONE marker — the one pointing AWAY
from the active pill. The active pill shows both `(` and `)`.

### What is NOT a tab-pill switcher (do not apply)

- **Progress strips** — e.g. MV PIPELINE 6 stage chips carry per-stage
  hue + breathing + %; their CONTAINER aligns, their children must
  diverge.
- **Display chips** — `.price-chip`, `.report-stat-chip` etc. are
  read-only data badges, not switchers.
- **Color cards** — `.palette-color-card` holds a label + color input,
  it's a control not a tab.
- **Number-input rows** — Default Listen / Buyout Price etc. are
  parallel fields, not mutually-exclusive choices.

### Migration policy

When changing an existing tab group: add `data-segmented="N"` or
`.cssmv-pill-bar` to the container. The constitution CSS will override
legacy per-child rules (via the legacy neutraliser in style.css). Do
NOT rip out old per-child rules even when they look redundant — other
sites may still reference them.

---

## English is the single source of truth

- All UI strings are authored in English in the source tree.
- Other locales are produced by the W210 lazy LLM translation pipeline
  (`tr("English")` → cache → Claude Sonnet 4.5 batch translate, cached at
  `/srv/cssos/shared/i18n-cache/<locale>.json`).
- **Never** hardcode Chinese (or any non-English) literals in markup or
  JS. Use `data-i18n="..."` on DOM or `tr("English")` in JS.
- `loginCopy(en, _zhIgnoredLegacy)` ignores its second arg and routes to
  `tr(en)`.
