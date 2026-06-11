# Coding-agent session — CSS Studio (built with Claude Code)

> A representative engineering session: redesigning the multi-language / multi-voice
> "capsule" control on the in-cinema MV panel. It shows the loop I run with Claude Code
> dozens of times a day — observe on a real device → root-cause → design → ship → verify →
> iterate on visual feedback. Infrastructure secrets, hostnames and credentials have been
> removed; the engineering is unchanged.

---

**Founder:** The "Languages / Voices" capsule mixes its two tracks and shows a duplicate
"Want an MV" pill. Upgrade the whole thing: each capsule head owns its own track, and the
concave inlay should invert based on how many heads are active. Do it carefully — read the
whole thing first, don't break anything else.

**Claude:** Read the three relevant files before touching anything (the pill renderer, the
cell builder, the global concave system). Found the real bug: the gating CSS keyed off an
ancestor wrapper —

```css
#cssos-lang-fold[data-expanded="lang"] #watch-language-pill .cssos-cell-voice { display:none }
```

— which requires the bar to be nested inside that wrapper. On re-render the bar isn't always
re-nested, so the selector silently stops matching → no gating → both tracks render at once,
and both guide pills leak. Fix: move the gate onto the bar itself so it can't desync:

```css
#watch-language-pill[data-expanded="lang"] .cssos-cell-voice { display:none !important }
```

Also deduped the guide pills (one shared pill for non-owners) and set `data-expanded` on the
bar in `applyState`. Built, bumped the service-worker cache version, deployed, verified the
new code is live and returns 200.

**Founder:** *(screenshot)* The Voices head is now hidden behind Languages — only a sliver
shows.

**Claude:** Root cause: the *global* concave system applies a `width: calc(100% + 20px)` +
negative-margin "wrap" class to any pill left of the active one — including the mode head —
so "Languages" grew over "Voices". Fix: exclude mode heads from the global pass and let the
panel-local `paintConcave()` own the language bar entirely, so the two systems never fight.

**Founder:** *(screenshot)* Direction's right now, but the capsules aren't biting together.

**Claude:** The bar is a CSS **grid**, and in grid a negative margin alone doesn't create
overlap — the column track holds its width. The original "bite" relied on
`width: calc(100% + 20px)` to make the pill physically extend into its neighbor. I'd dropped
that to protect the heads; restoring it (with the bite mask) makes them interlock again.

**Founder:** *(screenshot)* Selecting another language eats the neighbor pill.

**Claude:** z-order bug. I was stacking left-high uniformly, which is only correct for
left-biting pills; a right-biting active head then paints over its neighbor. Reworked
`setZ()` to assign z by **role** instead of position — the embraced/merged pill sits highest,
left-bite next, right-bite lowest — so the wrapper is always *under* what it wraps and the
bowl reveals the neighbor cleanly. This fixed both directions symmetrically.

**Founder:** *(screenshot)* The whole track is now jittering.

**Claude:** A `MutationObserver` I added to keep the concave fresh was watching `class`
changes — and `paintConcave` itself toggles classes, so it re-triggered itself in a loop.
Two fixes: (1) the observer now watches only `childList` (real re-renders), and (2) made
`paintConcave` idempotent — it computes a signature of the current state and returns early
without writing a single style if nothing changed. Any redundant call is now a cheap no-op,
so the loop can't cause reflow. Jitter gone.

**Founder:** The little flag/mic icon is half-eaten by the concave bowl.

**Claude:** The icon sat inside the 20px transparent bowl region; bumped the leading padding
past the bowl + overlap so content always clears it.

**Founder:** Capsule lengths look averaged, not adaptive.

**Claude:** The constitution grid uses `minmax(max-content, 1fr)`; the `1fr` stretches every
column to equal width when there's free space, truncating the long "Want an MV like this"
pill. Overrode the language bar to `grid-auto-columns: max-content` + `justify-content: start`
so every pill sizes to its own content; added `min-width: max-content` as a belt so the
bite's `calc()` width can never under-size a pill. Adaptive now, nothing truncates.

**Founder:** "Want an MV" still doesn't open the create panel, and it pauses the music.

**Claude:** The handler's first branch called a function that was *never defined anywhere in
the codebase*, so it was a permanent no-op. Repointed it to the real entry that lazy-loads and
opens the creation pipeline, with a fallback. Also wrapped the click to stop pointer/touch
propagation so it can't bubble to the watch panel's pause handler. Opens reliably now; music
keeps playing.

---

### Why this is representative
A single founder, building a deep consumer-AI platform end-to-end, using Claude Code as the
force-multiplier: read-before-write discipline, real root-causes (not symptom patches) across
CSS grid semantics, z-stacking, observer feedback loops and dead code, and a tight
ship→observe→iterate loop driven by real-device screenshots — many such cycles per day.
