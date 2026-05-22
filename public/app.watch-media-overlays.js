// app.watch-media-overlays.js
// P2-28a/b/c/d + P2-75 — media-frame overlays and typography enhancements.
//
//   P2-28a  ✦按钮 CN/EN 字体池分离 + 右键设置自动轮换
//   P2-28b  MV 标题艺术化：大号 / 多行 / 不超出媒体框
//   P2-28c  标题/字幕打字机 + 逐字飘落入场动画
//   P2-28d  原唱 / 伴奏切换按钮 (人声 / 音乐)
//   P2-75   Per-token random fonts (每字/每词随机字体) + ✦ 按钮高亮
//             - 左键：立刻按 per-word / per-char 随机字体 + 重绘字幕/标题
//             - 右键：设置弹窗（自动轮换间隔 / 随机粒度 / 预设风格）
//             - 预设：chaos 百家争鸣 / rhythm 中英轮抽 / line 整行统一 / single 原样
//             - 字幕/标题允许多行，自动缩放字号
//             - Music 标签同样生效
//
// Design principles:
//   - 缺啥补啥：零输入时仍有体验（随机字体、随机入场方向）
//   - 一切参数化：所有时长/尺寸/间隔/候选池都在顶部 CONFIG
//   - 一切 i18n：按钮 title + tooltip 全走 loginCopy / t()
//   - 不侵入 watch-ui.js 字幕渲染路径：通过 MutationObserver 挂钩

(function initWatchMediaOverlaysModule() {
  "use strict";

  // ------------------------------------------------------------------
  // CONFIG — 一切参数化
  // ------------------------------------------------------------------
  const CONFIG = {
    // P2-28b MV art title
    // CSSOS_PHASE2_TITLE_NO_CLIP 20260429 #190 — Jing
    // "字幕标题超出了媒体框被截断了". The font ratio + 5 lines ×
    // 1.15 line-height was over-budgeting on short-frame (letterbox)
    // layouts and the last line clipped at the bottom edge. Tighten
    // the ratio and cap to 3 lines so the auto-fit shrinks faster
    // before overflow shows.
    MV_TITLE_FONT_SIZE_RATIO: 0.072,   // of min(frame.width, frame.height)
    MV_TITLE_MAX_WIDTH_RATIO: 0.88,
    MV_TITLE_MAX_LINES: 3,             // was 5; clip to 3 to prevent overflow
    MV_TITLE_LINE_HEIGHT: 1.12,
    MV_TITLE_MIN_FONT_PX: 18,
    MV_TITLE_MAX_FONT_PX: 84,
    MV_TITLE_APPEAR_DELAY_MS: 120,

    // P2-28c typewriter / falling entry
    ENTRY_STAGGER_MS: 52,              // per-glyph delay
    ENTRY_DURATION_MS: 720,            // one glyph's fall-in
    ENTRY_RANDOMIZE_MOTIONS: true,     // pick a random motion per text change
    MOTIONS: ["fall", "drift-left", "drift-right", "typewriter", "zoom-pop"],
    MAX_GLYPHS_STAGGER: 120,           // hard cap so huge blobs don't stagger forever

    // P2-28a auto-rotate
    AUTO_ROTATE_DEFAULT_MIN: 0,        // 0 = off
    AUTO_ROTATE_OPTIONS_MIN: [0, 1, 3, 5, 10, 15, 30, 60],
    AUTO_ROTATE_STORAGE_KEY: "cssmv.watchFontAutoRotateMin",
    SCRIPT_POOLS_ENABLED_KEY: "cssmv.watchFontScriptPools",

    // P2-28d vocals/instrumental toggle
    STEM_STORAGE_KEY: "cssmv.stemPreference", // "vocals" | "instrumental"
    STEM_DEFAULT: "vocals",

    // P2-75 per-token random fonts
    PER_TOKEN_MODE_KEY: "cssmv.watchFontPerTokenMode",   // "off" | "word" | "char"
    PER_TOKEN_MODE_DEFAULT: "word",
    PER_TOKEN_PRESET_KEY: "cssmv.watchFontPerTokenPreset", // "chaos" | "rhythm" | "line" | "single"
    PER_TOKEN_PRESET_DEFAULT: "chaos",
    // "single" means one-font-per-MV (legacy default). "line" = one font per line.
    // "chaos" = fully random per token. "rhythm" = alternate CJK / Latin pools per token.
    PER_TOKEN_SEED_KEY: "cssmv.watchFontPerTokenSeed",   // bump to force reshuffle
  };

  // ------------------------------------------------------------------
  // i18n helper
  // ------------------------------------------------------------------
  function tr(en, zh) {
    try {
      if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh);
    } catch (_err) {}
    const loc = String(globalThis.currentLocale || "").toLowerCase();
    return loc.startsWith("zh") ? zh : en;
  }
  function toast(en, zh) {
    try {
      if (typeof globalThis.showToast === "function") globalThis.showToast(tr(en, zh));
    } catch (_err) {}
  }

  // ------------------------------------------------------------------
  // DOM refs (lazy)
  // ------------------------------------------------------------------
  const IDS = {
    screen: "watch-panel", // fallback; actual is the `.watch-screen` inside watch-pane-mv
    frame: null,           // resolved at boot
    styleShift: "watch-style-shift",
    subtitle: "watch-subtitle",
    karaoke: "watch-karaoke-line",
    audio: "watch-audio-preview",
    video: "watch-video",
  };
  function qFrame() {
    // The actual media frame is div.watch-screen inside #watch-pane-mv.
    return (
      document.querySelector("#watch-pane-mv .watch-screen") ||
      document.querySelector(".watch-screen") ||
      null
    );
  }

  // ------------------------------------------------------------------
  // Styles — injected once
  // ------------------------------------------------------------------
  function ensureStyles() {
    if (document.getElementById("cssmv-watch-media-overlays-styles")) return;
    const st = document.createElement("style");
    st.id = "cssmv-watch-media-overlays-styles";
    st.textContent = `
/* ---------- P2-28b MV Art Title ---------- */
.cssmv-mv-title {
  position: absolute;
  left: 50%;
  top: 8%;
  transform: translate(-50%, 0);
  max-width: ${CONFIG.MV_TITLE_MAX_WIDTH_RATIO * 100}%;
  /* CSSOS_PHASE2_NO_TITLE_SAFE_ZONE 20260504 — Jing
     "媒体框就是'安全区'". Allow the title to occupy the full frame
     height; the only boundary is the frame itself. The auto-fit loop
     downstream still scales font-size to keep the title from
     overflowing the frame. */
  max-height: 100%;
  overflow: visible;
  text-align: center;
  font-family: var(--watch-title-font-family, "CSSTitleBoldC", "Syne", system-ui, sans-serif);
  font-weight: 800;
  line-height: ${CONFIG.MV_TITLE_LINE_HEIGHT};
  color: var(--cssmv-mv-title-color, rgba(255, 255, 255, 0.98));
  text-shadow:
    0 0 12px rgba(0, 0, 0, 0.55),
    0 0 24px color-mix(in srgb, var(--watch-frame-accent-1, #00f5a0) 45%, transparent),
    0 0 44px color-mix(in srgb, var(--watch-frame-accent-2, #0bf7ff) 28%, transparent);
  pointer-events: none;
  z-index: 6;
  opacity: 0;
  letter-spacing: 0.01em;
  word-break: break-word;
  overflow-wrap: anywhere;
  transition: opacity 0.36s ease-in-out;
  /* CSSOS_PHASE2_NO_TITLE_SAFE_ZONE 20260504 — drop the 4% inner
     padding; the anchor rule pins us to the frame edge directly. */
  padding: 0;
  white-space: normal;
  /* No max-width safe-zone either — the media frame is the bound. */
  max-width: 100%;
}
.cssmv-mv-title.is-visible { opacity: 1; }
.cssmv-mv-title.is-hidden  { opacity: 0; }
/* P2-42: while video is playing, keep the title visible but quieter and
   pinned to the top — never fully hide. */
.cssmv-mv-title.is-visible.is-playing {
  opacity: 0.62;
  top: 5%;
  transform: translate(-50%, 0) scale(0.78);
  transform-origin: top center;
  text-shadow:
    0 0 10px rgba(0, 0, 0, 0.72),
    0 0 22px color-mix(in srgb, var(--watch-frame-accent-1, #00f5a0) 28%, transparent);
  transition: opacity 0.42s ease, transform 0.42s ease, top 0.42s ease;
}

/* ---------- P2-28c entry animations ---------- */
.cssmv-anim-glyph {
  display: inline-block;
  opacity: 0;
  will-change: transform, opacity, filter;
  animation-duration: ${CONFIG.ENTRY_DURATION_MS}ms;
  animation-timing-function: cubic-bezier(0.22, 1.12, 0.36, 1);
  animation-fill-mode: both;
}
.cssmv-anim-glyph.is-space { display: inline; }

@keyframes cssmvEntryFall {
  0%   { opacity: 0; transform: translateY(-1.1em) rotate(-8deg); filter: blur(4px); }
  60%  { opacity: 1; transform: translateY(0.08em) rotate(0); filter: blur(0); }
  100% { opacity: 1; transform: translateY(0) rotate(0); filter: blur(0); }
}
@keyframes cssmvEntryDriftLeft {
  0%   { opacity: 0; transform: translateX(-1em) translateY(-0.4em); filter: blur(3px); }
  70%  { opacity: 1; transform: translateX(0.04em) translateY(0); filter: blur(0); }
  100% { opacity: 1; transform: translateX(0) translateY(0); filter: blur(0); }
}
@keyframes cssmvEntryDriftRight {
  0%   { opacity: 0; transform: translateX(1em) translateY(-0.3em); filter: blur(3px); }
  70%  { opacity: 1; transform: translateX(-0.03em) translateY(0); filter: blur(0); }
  100% { opacity: 1; transform: translateX(0) translateY(0); filter: blur(0); }
}
@keyframes cssmvEntryTypewriter {
  0%   { opacity: 0; transform: translateY(0); }
  1%   { opacity: 1; }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes cssmvEntryZoomPop {
  0%   { opacity: 0; transform: scale(0.2); filter: blur(6px); }
  60%  { opacity: 1; transform: scale(1.08); filter: blur(0); }
  100% { opacity: 1; transform: scale(1); filter: blur(0); }
}
.cssmv-anim-fall         { animation-name: cssmvEntryFall; }
.cssmv-anim-drift-left   { animation-name: cssmvEntryDriftLeft; }
.cssmv-anim-drift-right  { animation-name: cssmvEntryDriftRight; }
.cssmv-anim-typewriter   { animation-name: cssmvEntryTypewriter; animation-duration: 40ms; animation-timing-function: steps(1, end); }
.cssmv-anim-zoom-pop     { animation-name: cssmvEntryZoomPop; }

/* ---------- P2-28d vocals/instrumental toggle button ---------- */
.cssmv-stem-toggle {
  position: absolute;
  top: 14px;
  right: 64px;              /* sits left of ✦ (which is right:14px, w:44) */
  z-index: 8;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 1px solid rgba(218, 255, 242, 0.28);
  background: linear-gradient(180deg, rgba(7, 14, 12, 0.42), rgba(5, 10, 9, 0.24));
  color: rgba(242, 255, 248, 0.98);
  font-size: 17px;
  box-shadow:
    0 0 24px rgba(0, 245, 160, 0.16),
    0 0 52px rgba(11, 247, 255, 0.08);
  backdrop-filter: blur(12px) saturate(1.08);
  -webkit-backdrop-filter: blur(12px) saturate(1.08);
  opacity: 0.72;
  pointer-events: auto;
  transition: opacity 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  cursor: pointer;
}
.watch-screen:hover .cssmv-stem-toggle,
.watch-screen:focus-within .cssmv-stem-toggle { opacity: 1; }
.cssmv-stem-toggle:hover { transform: scale(1.05); border-color: rgba(218, 255, 242, 0.55); }
.cssmv-stem-toggle.is-instrumental .cssmv-stem-icon::before { content: "♪"; }
.cssmv-stem-toggle.is-vocals       .cssmv-stem-icon::before { content: "🎤"; font-size: 14px; }
.cssmv-stem-icon { pointer-events: none; line-height: 1; }

/* ---------- P2-75 ✦ button facelift — actually visible this time ---------- */
.cssmv-star-emphasized {
  opacity: 0.96 !important;
  font-size: 20px !important;
  width: 46px !important;
  height: 46px !important;
  border-color: rgba(236, 255, 248, 0.42) !important;
  box-shadow:
    0 0 30px rgba(0, 245, 160, 0.34),
    0 0 62px rgba(11, 247, 255, 0.18) !important;
  animation: cssmvStarPulse 3.6s ease-in-out infinite;
}
.cssmv-star-emphasized:hover {
  animation: none;
  transform: scale(1.06) rotate(10deg);
}
@keyframes cssmvStarPulse {
  0%   { box-shadow: 0 0 24px rgba(0, 245, 160, 0.28), 0 0 52px rgba(11, 247, 255, 0.14); }
  50%  { box-shadow: 0 0 38px rgba(0, 245, 160, 0.46), 0 0 84px rgba(11, 247, 255, 0.24); }
  100% { box-shadow: 0 0 24px rgba(0, 245, 160, 0.28), 0 0 52px rgba(11, 247, 255, 0.14); }
}

/* Multi-line friendly: allow glyph spans to flow naturally (each word/char can wrap) */
.cssmv-anim-glyph { word-break: keep-all; }
.watch-subtitle,
.watch-karaoke-line,
.watch-karaoke-current,
.watch-karaoke-prev,
.watch-karaoke-next {
  white-space: normal !important;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* ---------- CSSOS_PHASE2_P2_96_SUBTITLE_WEIGHT 20260424 #96 ----------
   Jing's spec (verbatim): "樱花/盛开/季节属于权重大的词/字,
   在那/的属于权重小。权重大的词/字和权重小的词/字不能在同一行,
   必须另起一行。" Split karaoke line into runs of high-weight (content)
   vs low-weight (function) words; each run is its own block-level row
   so high and low weight never share a line. High = large bold; low =
   small muted. Emphasis glow / per-word font from #85/#93 still work
   because the <span class="watch-karaoke-word"> inside the row retains
   its existing inline styles and classes. */
.watch-karaoke-row {
  display: block;
  width: 100%;
  line-height: 1.14;
  margin: 0.06em 0;
  text-align: inherit;
}
.watch-karaoke-row.is-weight-high {
  font-size: 1.28em;
  font-weight: 700;
  letter-spacing: 0.015em;
}
.watch-karaoke-row.is-weight-low {
  font-size: 0.72em;
  font-weight: 400;
  letter-spacing: 0.01em;
  opacity: 0.82;
}
.watch-karaoke-row.is-weight-high .watch-karaoke-word { font-weight: inherit; }
.watch-karaoke-row.is-weight-low  .watch-karaoke-word { font-weight: inherit; }

/* ---------- P2-28a auto-rotate settings popover ---------- */
.cssmv-font-settings-menu {
  position: fixed;
  z-index: 99999;
  min-width: 220px;
  padding: 10px 12px;
  background: rgba(14, 22, 20, 0.96);
  color: rgba(242, 255, 248, 0.98);
  border: 1px solid rgba(218, 255, 242, 0.22);
  border-radius: 10px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(11, 247, 255, 0.06);
  backdrop-filter: blur(12px) saturate(1.1);
  -webkit-backdrop-filter: blur(12px) saturate(1.1);
  font-size: 13px;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
.cssmv-font-settings-menu h4 {
  margin: 0 0 8px 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(182, 220, 205, 0.78);
  font-weight: 600;
}
.cssmv-font-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
}
.cssmv-font-settings-row label {
  flex: 1 1 auto;
  color: rgba(242, 255, 248, 0.92);
}
.cssmv-font-settings-row select,
.cssmv-font-settings-row input[type="checkbox"] {
  accent-color: #00f5a0;
  background: rgba(5, 10, 9, 0.6);
  color: inherit;
  border: 1px solid rgba(218, 255, 242, 0.22);
  border-radius: 6px;
  padding: 3px 6px;
  font: inherit;
}
.cssmv-font-settings-hint {
  font-size: 11px;
  color: rgba(178, 200, 190, 0.72);
  margin-top: 6px;
  line-height: 1.35;
}

/* ---------- P2-76 ✦ relocate top-right + kill center play button ----------
   Jing 2026-04-20:
     "图1，看，星星还在中间那里呢，应该放到右上角话筒按钮那里并排，UI也类似，
      顺便取消中间的播放按钮（双圆圈那个）。Music标签页，也是。"
   Fix:
     1. Force both ✦ buttons (#watch-style-shift in MV pane and
        #watch-music-style-shift in Music pane) to the top-right corner with
        circular UI identical to the 🎤 .cssmv-stem-toggle mic button, so they
        can never drift to the middle again no matter what other rule or
        JS style poke may have pushed them there.
     2. Move the mic button left to right:70px so the ✦ can claim the
        outermost right:14px slot and the two buttons sit neatly side-by-side.
     3. display:none the center double-ring .watch-overlay-play and
        .watch-music-play buttons entirely — the SVG border ring (MV) and
        music ring (Music) handle progress/flash already; those two center
        buttons were only adding visual noise over the composition. */
#watch-style-shift.watch-style-shift,
#watch-music-style-shift.watch-style-shift,
#watch-music-style-shift.watch-music-style-shift,
#watch-music-style-shift {
  position: absolute !important;
  top: 14px !important;
  right: 14px !important;
  left: auto !important;
  bottom: auto !important;
  transform: none !important;
  width: 44px !important;
  height: 44px !important;
  min-width: 44px !important;
  min-height: 44px !important;
  max-width: 44px !important;
  max-height: 44px !important;
  padding: 0 !important;
  margin: 0 !important;
  z-index: 9 !important;
  display: grid !important;
  place-items: center !important;
  border-radius: 999px !important;
  border: 1px solid rgba(218, 255, 242, 0.28) !important;
  background: linear-gradient(180deg, rgba(7, 14, 12, 0.42), rgba(5, 10, 9, 0.24)) !important;
  color: rgba(242, 255, 248, 0.98) !important;
  font-size: 17px !important;
  line-height: 1 !important;
  box-shadow:
    0 0 24px rgba(0, 245, 160, 0.16),
    0 0 52px rgba(11, 247, 255, 0.08) !important;
  backdrop-filter: blur(12px) saturate(1.08) !important;
  -webkit-backdrop-filter: blur(12px) saturate(1.08) !important;
  opacity: 0.78 !important;
  pointer-events: auto !important;
  cursor: pointer !important;
  transition: opacity 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease,
              border-color 0.22s ease !important;
}
.watch-screen:hover #watch-style-shift.watch-style-shift,
.watch-screen:focus-within #watch-style-shift.watch-style-shift,
.watch-music-stage:hover #watch-music-style-shift,
.watch-music-stage:focus-within #watch-music-style-shift {
  opacity: 1 !important;
}
#watch-style-shift.watch-style-shift:hover,
#watch-music-style-shift:hover {
  transform: scale(1.05) rotate(8deg) !important;
  border-color: rgba(236, 255, 248, 0.5) !important;
  box-shadow:
    0 0 32px rgba(0, 245, 160, 0.28),
    0 0 74px rgba(11, 247, 255, 0.18) !important;
}

/* Slide the mic button left so the ✦ claims right:14px. Together the two
   circular buttons stand side-by-side at the top-right corner. */
.cssmv-stem-toggle {
  right: 70px !important;
}

/* P2-75 emphasis keeps its pulse but no longer resizes beyond the 44px
   circle so both buttons stay visually harmonious. */
.cssmv-star-emphasized {
  width: 44px !important;
  height: 44px !important;
  font-size: 17px !important;
}

/* Kill the center double-ring play buttons on both panes — they duplicate
   the rounded-rect/ring SVG progress UIs and sit in the middle blocking
   composition. */
#watch-overlay-play,
.watch-overlay-play,
#watch-music-play,
.watch-music-play {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
`;
    document.head.appendChild(st);
  }

  // ------------------------------------------------------------------
  // Script classification (CJK vs Latin vs mixed)
  // ------------------------------------------------------------------
  const CJK_RE = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uff66-\uff9f]/;
  function hasCjk(s)   { return CJK_RE.test(String(s || "")); }
  function hasLatin(s) { return /[A-Za-z]/.test(String(s || "")); }
  function classifyText(s) {
    const c = hasCjk(s); const l = hasLatin(s);
    if (c && l) return "mixed";
    if (c) return "cjk";
    if (l) return "latin";
    return "other";
  }

  // ------------------------------------------------------------------
  // Graphemes — CJK chars, English words, punctuation
  // ------------------------------------------------------------------
  // CSSOS_PHASE2_BRACKET_GROUP 20260504 — Jing
  // "不是因为是标点符号就分开两个，这种时候应该是括号里面的字幕和
  //  括号一种字体". When a token list contains a "(" / "（" / "[" /
  //  "【" followed (eventually) by its matching close bracket, the
  //  bracket itself + everything inside + the close bracket should
  //  travel as ONE unit — same font, same line, no break. Otherwise
  //  the per-glyph layout splits "(가)" across three lines as we just
  //  saw. This pre-segmenter walks the string once and emits bracket
  //  groups as single pieces; everything else falls through to the
  //  existing CJK/Latin segmenter below.
  const __BRACKETS = { "(": ")", "（": "）", "[": "]", "【": "】", "「": "」", "『": "』", "《": "》" };
  function preGroupBrackets(str) {
    const groups = [];
    let i = 0;
    while (i < str.length) {
      const ch = str[i];
      const close = __BRACKETS[ch];
      if (close) {
        const closeIdx = str.indexOf(close, i + 1);
        // Only collapse if the close is found AND the inner content is
        // short enough to read as a single typographic unit (≤ 12 chars).
        // Long bracketed text (e.g. footnotes, attributions) keeps its
        // word-level breaking so it can wrap naturally.
        if (closeIdx > i && closeIdx - i - 1 <= 12) {
          groups.push({ start: i, end: closeIdx + 1 });
          i = closeIdx + 1;
          continue;
        }
      }
      i += 1;
    }
    if (!groups.length) return null;
    // Slice the string into [non-bracket, bracket-group, non-bracket, …]
    const out = [];
    let cursor = 0;
    for (const g of groups) {
      if (g.start > cursor) out.push({ text: str.slice(cursor, g.start), isGroup: false });
      out.push({ text: str.slice(g.start, g.end), isGroup: true });
      cursor = g.end;
    }
    if (cursor < str.length) out.push({ text: str.slice(cursor), isGroup: false });
    return out;
  }

  function segmentForEntry(text) {
    const out = [];
    const str = String(text || "");
    if (!str) return out;
    // CSSOS_PHASE2_BRACKET_GROUP 20260504 — pre-collapse bracket groups
    // into single pieces so "(가)" stays as one glyph span.
    const pre = preGroupBrackets(str);
    if (pre) {
      for (const seg of pre) {
        if (seg.isGroup) {
          out.push(seg.text);
        } else {
          // Recurse into the existing segmenter for non-bracket runs.
          const sub = segmentForEntry(seg.text);
          for (const s of sub) out.push(s);
        }
      }
      return out;
    }
    // Prefer Intl.Segmenter if available (word-level for Latin, char-level for CJK)
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      try {
        const seg = new Intl.Segmenter(undefined, { granularity: "word" });
        for (const piece of seg.segment(str)) {
          const chunk = piece.segment;
          // Each CJK char should fall individually; Latin words fall as a unit
          if (hasCjk(chunk) && chunk.length > 1) {
            for (const ch of Array.from(chunk)) out.push(ch);
          } else {
            out.push(chunk);
          }
        }
        return out;
      } catch (_err) {}
    }
    // Fallback: each CJK is a unit, Latin runs grouped, everything else passthrough
    let buf = "";
    let bufKind = "";
    const flush = () => { if (buf) { out.push(buf); buf = ""; bufKind = ""; } };
    for (const ch of Array.from(str)) {
      const kind = CJK_RE.test(ch) ? "cjk" : /[A-Za-z0-9]/.test(ch) ? "latin" : "other";
      if (kind === "cjk") { flush(); out.push(ch); continue; }
      if (kind === "latin") {
        if (bufKind && bufKind !== "latin") flush();
        bufKind = "latin"; buf += ch; continue;
      }
      // other (space/punct) — flush latin but keep punctuation as its own piece
      flush();
      out.push(ch);
    }
    flush();
    return out;
  }

  // ------------------------------------------------------------------
  // P2-28c — wrap plain text into staggered animation spans
  // ------------------------------------------------------------------
  let currentMotion = CONFIG.MOTIONS[0];
  function pickMotion() {
    if (!CONFIG.ENTRY_RANDOMIZE_MOTIONS) return currentMotion;
    const list = Array.isArray(CONFIG.MOTIONS) ? CONFIG.MOTIONS : ["fall"];
    currentMotion = list[Math.floor(Math.random() * list.length)] || "fall";
    return currentMotion;
  }

  // ------------------------------------------------------------------
  // P2-75 — per-token font pool lookup
  //   Build two pools (CJK + Latin) from the same catalog the ✦ preset
  //   cycler uses, so per-token fonts stay consistent with the manual
  //   shuffle. Falls back gracefully when the catalog isn't ready yet.
  // ------------------------------------------------------------------
  let __cssmvFontCatalogCache = null;
  let __cssmvFontCatalogStamp = 0;
  // CSSOS_PHASE2_FANCY_WEIGHT 20260504 — Jing
  // "请把fancy font真正接进来，并且给最高权重90%". A family is "plain"
  // when its name reads as a generic system / sans / serif / mono — those
  // are workhorse fallbacks the user wants to see only occasionally
  // (10%). Everything else (calligraphic CN, hand-written, decorative
  // display, the 143 deployed manifest fonts that survived the prune)
  // counts as "fancy" and gets the 90% bulk.
  const __CSSMV_PLAIN_FAMILY_RE = /^(?:system-ui|ui-(?:sans|serif|mono|rounded)|sans-serif|serif|monospace|cursive|fantasy|Helvetica(?:\s+Neue)?|Arial(?:\s+Black|\s+Narrow)?|Times(?:\s+New\s+Roman)?|Georgia|Verdana|Tahoma|Trebuchet(?:\s+MS)?|Courier(?:\s+New)?|Roboto(?:\s+(?:Mono|Slab|Condensed))?|Inter|Lato|Open\s+Sans|Source\s+Sans(?:\s+Pro)?|Source\s+Serif(?:\s+Pro)?|Source\s+Code(?:\s+Pro)?|Noto\s+Sans(?:\s+CJK)?|Noto\s+Serif(?:\s+CJK)?|PingFang(?:\s+SC|\s+TC|\s+HK)?|Hiragino\s+Sans(?:\s+GB)?|Microsoft\s+YaHei|Microsoft\s+JhengHei|SimSun|SimHei|Heiti(?:\s+SC|\s+TC)?|Songti(?:\s+SC|\s+TC)?|Apple\s+SD\s+Gothic\s+Neo|Malgun\s+Gothic|Yu\s+Gothic|Meiryo|MS\s+(?:Gothic|Mincho|PGothic|PMincho))$/i;
  function classifyFamily(fam) {
    const t = String(fam || "").trim().replace(/^["']|["']$/g, "");
    if (!t) return "fancy";
    return __CSSMV_PLAIN_FAMILY_RE.test(t) ? "plain" : "fancy";
  }
  function loadFontPools() {
    // cache for ~1s; catalog rarely changes after boot
    const now = Date.now();
    if (__cssmvFontCatalogCache && now - __cssmvFontCatalogStamp < 1000) {
      return __cssmvFontCatalogCache;
    }
    let cjk = [], latin = [];
    try {
      const entries = typeof globalThis.buildWatchFontCatalogModule === "function"
        ? globalThis.buildWatchFontCatalogModule()
        : [];
      if (Array.isArray(entries) && entries.length) {
        for (const e of entries) {
          const fam = String(e?.family || "").trim();
          if (!fam) continue;
          const g = String(e?.group || "").toLowerCase();
          const isCjk = g ? g === "cjk" : CJK_RE.test(fam);
          if (isCjk) cjk.push(fam); else latin.push(fam);
        }
      }
    } catch (_err) {}
    // CSSOS_PHASE2_FONT_POOL_MANIFEST_FALLBACK 20260420 #83
    if (!cjk.length && !latin.length) {
      try {
        const manifest = Array.isArray(globalThis.CSSOS_WATCH_FONT_MANIFEST)
          ? globalThis.CSSOS_WATCH_FONT_MANIFEST
          : [];
        for (const e of manifest) {
          const fam = String(e?.family || "").trim();
          const src = String(e?.src || "").trim().toLowerCase();
          if (!fam) continue;
          const isCjk =
            CJK_RE.test(fam) ||
            src.startsWith("fonts/") ||
            src.startsWith("fonts_cn2/");
          if (isCjk) cjk.push(fam); else latin.push(fam);
        }
      } catch (_err) {}
    }
    // CSSOS_PHASE2_FANCY_WEIGHT 20260504 — split each script pool into
    // fancy / plain sub-pools so the per-piece picker can do a 90/10
    // weighted draw. Falls back gracefully when one bucket is empty
    // (entire pool counts as the available bucket).
    const cjkFancy = [], cjkPlain = [];
    for (const f of cjk) {
      (classifyFamily(f) === "fancy" ? cjkFancy : cjkPlain).push(f);
    }
    const latinFancy = [], latinPlain = [];
    for (const f of latin) {
      (classifyFamily(f) === "fancy" ? latinFancy : latinPlain).push(f);
    }
    const pools = { cjk, latin, cjkFancy, cjkPlain, latinFancy, latinPlain };
    __cssmvFontCatalogCache = pools;
    __cssmvFontCatalogStamp = now;
    if (!globalThis.__cssmvFancyLogged) {
      globalThis.__cssmvFancyLogged = true;
      try {
        console.info(
          "%c[font-pools] cjk fancy=%d plain=%d · latin fancy=%d plain=%d (90/10 weighting active)",
          "color:#d2a; font-weight:bold",
          cjkFancy.length, cjkPlain.length, latinFancy.length, latinPlain.length
        );
      } catch (_e) {}
    }
    return pools;
  }
  // Weighted draw: 90% from the fancy bucket, 10% from plain. If one
  // side is empty, draw entirely from the other.
  function pickWeightedFromBuckets(fancy, plain, fancyWeight) {
    const w = (typeof fancyWeight === "number") ? fancyWeight : 0.9;
    const useFancy = (Math.random() < w) && fancy.length > 0;
    const bucket = useFancy ? fancy : (plain.length ? plain : fancy);
    if (!bucket.length) return "";
    return bucket[Math.floor(Math.random() * bucket.length)] || "";
  }
  globalThis.cssmvPickWeightedFontFamily = function (script, fancyWeight) {
    const pools = loadFontPools();
    const isCjk = String(script || "").toLowerCase() === "cjk";
    const fancy = isCjk ? pools.cjkFancy : pools.latinFancy;
    const plain = isCjk ? pools.cjkPlain : pools.latinPlain;
    return pickWeightedFromBuckets(fancy, plain, fancyWeight);
  };

  function perTokenMode() {
    try {
      const v = String(localStorage.getItem(CONFIG.PER_TOKEN_MODE_KEY) || "").trim().toLowerCase();
      if (v === "off" || v === "word" || v === "char") return v;
    } catch (_err) {}
    return CONFIG.PER_TOKEN_MODE_DEFAULT;
  }
  function setPerTokenMode(v) {
    const next = (v === "off" || v === "word" || v === "char") ? v : CONFIG.PER_TOKEN_MODE_DEFAULT;
    try { localStorage.setItem(CONFIG.PER_TOKEN_MODE_KEY, next); } catch (_err) {}
    return next;
  }
  function currentPreset() {
    try {
      const v = String(localStorage.getItem(CONFIG.PER_TOKEN_PRESET_KEY) || "").trim().toLowerCase();
      if (v === "chaos" || v === "rhythm" || v === "line" || v === "single") return v;
    } catch (_err) {}
    return CONFIG.PER_TOKEN_PRESET_DEFAULT;
  }
  function setCurrentPreset(v) {
    const allowed = new Set(["chaos", "rhythm", "line", "single"]);
    const next = allowed.has(v) ? v : CONFIG.PER_TOKEN_PRESET_DEFAULT;
    try { localStorage.setItem(CONFIG.PER_TOKEN_PRESET_KEY, next); } catch (_err) {}
    return next;
  }
  function bumpShuffleSeed() {
    try {
      const n = parseInt(localStorage.getItem(CONFIG.PER_TOKEN_SEED_KEY) || "0", 10) || 0;
      localStorage.setItem(CONFIG.PER_TOKEN_SEED_KEY, String(n + 1));
    } catch (_err) {}
  }

  // randomPick with small safety
  function randomFromPool(pool) {
    if (!Array.isArray(pool) || !pool.length) return "";
    return pool[Math.floor(Math.random() * pool.length)] || "";
  }

  // Given the full token list + a preset, return an array of font-families
  // (same length as tokens, "" = inherit).
  function pickFontsForTokens(pieces, preset, mode) {
    const len = pieces.length;
    const out = new Array(len).fill("");
    if (mode === "off" || preset === "single") return out;
    const { cjk, latin } = loadFontPools();
    if (!cjk.length && !latin.length) return out;

    // preset: "line" — pick ONE font per script, apply to every matching token
    // CSSOS_PHASE2_FANCY_WEIGHT 20260504 — every preset below now
    // routes its random draw through the 90/10 fancy/plain weighting.
    const pools = loadFontPools();
    const drawCjk = () => pickWeightedFromBuckets(pools.cjkFancy, pools.cjkPlain, 0.9)
                       || pickWeightedFromBuckets(pools.latinFancy, pools.latinPlain, 0.9);
    const drawLat = () => pickWeightedFromBuckets(pools.latinFancy, pools.latinPlain, 0.9)
                       || pickWeightedFromBuckets(pools.cjkFancy, pools.cjkPlain, 0.9);

    if (preset === "line") {
      const oneCjk = drawCjk();
      const oneLat = drawLat();
      for (let i = 0; i < len; i++) {
        const p = pieces[i];
        if (!p || /^\s+$/.test(p)) continue;
        out[i] = CJK_RE.test(p) ? oneCjk : oneLat;
      }
      return out;
    }

    // preset: "rhythm" — strict CJK/Latin alternation
    if (preset === "rhythm") {
      let flip = 0;
      for (let i = 0; i < len; i++) {
        const p = pieces[i];
        if (!p || /^\s+$/.test(p)) continue;
        const wantCjk = CJK_RE.test(p);
        const useCjk = wantCjk ? (flip++ % 2 === 0) : false;
        out[i] = wantCjk ? (useCjk ? drawCjk() : drawLat()) : drawLat();
      }
      return out;
    }

    // default: "chaos" — fully random per token (weighted)
    for (let i = 0; i < len; i++) {
      const p = pieces[i];
      if (!p || /^\s+$/.test(p)) continue;
      out[i] = CJK_RE.test(p) ? drawCjk() : drawLat();
    }
    return out;
  }

  function wrapGlyphs(text, motion, opts) {
    const rawPieces = segmentForEntry(text);
    if (!rawPieces.length) return "";
    const use = motion || pickMotion();
    const cap = Math.max(1, CONFIG.MAX_GLYPHS_STAGGER);

    // P2-75: decide per-token mode + preset. If mode === "char", collapse Latin
    // words into per-character granularity.
    const mode = (opts && typeof opts.mode === "string") ? opts.mode : perTokenMode();
    const preset = (opts && typeof opts.preset === "string") ? opts.preset : currentPreset();

    let pieces = rawPieces;
    if (mode === "char") {
      const expanded = [];
      for (const p of rawPieces) {
        if (!p || /^\s+$/.test(p) || p.length === 1) { expanded.push(p); continue; }
        // split non-space runs into single chars (keeps CJK per-char, breaks Latin per-letter)
        for (const ch of Array.from(p)) expanded.push(ch);
      }
      pieces = expanded;
    }

    const fonts = pickFontsForTokens(pieces, preset, mode);
    return pieces
      .map((piece, idx) => {
        const delay = Math.min(idx, cap) * CONFIG.ENTRY_STAGGER_MS;
        const isSpace = /^\s+$/.test(piece);
        const cls = [
          "cssmv-anim-glyph",
          `cssmv-anim-${use}`,
          isSpace ? "is-space" : "",
        ].filter(Boolean).join(" ");
        const safe = escapeHtml(piece);
        if (isSpace) return safe;
        const fam = fonts[idx] || "";
        const famCss = fam
          ? `font-family:"${String(fam).replace(/"/g, "\\\"")}", var(--watch-title-font-family, inherit);`
          : "";
        return `<span class="${cls}" style="animation-delay:${delay}ms;${famCss}">${safe}</span>`;
      })
      .join("");
  }
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Public: apply entry animation to plain-text content of a host element.
  // Used by mv-pipeline-panel.js when it receives title/lyrics with timestamps.
  globalThis.cssmvApplyTextEntry = function (el, text, opts) {
    if (!(el instanceof HTMLElement)) return;
    const motion = opts?.motion || pickMotion();
    el.innerHTML = wrapGlyphs(String(text || ""), motion);
  };

  // ------------------------------------------------------------------
  // Observe subtitle / karaoke elements — auto-enhance on text change
  // ------------------------------------------------------------------
  const observed = new WeakMap();
  function shouldEnhance(el) {
    if (!(el instanceof HTMLElement)) return false;
    // Skip if the element already contains our glyph spans (avoid infinite loop)
    if (el.querySelector?.(".cssmv-anim-glyph")) return false;
    // CSSOS_PHASE2_KARAOKE_FONT_PERSIST 20260420 #85 — karaoke line renders its
    // own <span class="watch-karaoke-word"> spans with per-word font-family
    // populated via cssmvAssignFontForPiece. Let that path own rendering — if
    // we re-wrap here on every timeupdate, we'd strip the karaoke-word structure
    // (sung/active styling) and restart the 720ms fade-in on every frame.
    if (el.querySelector?.(".watch-karaoke-word")) return false;
    // Skip empty
    const txt = (el.textContent || "").trim();
    if (!txt) return false;
    return true;
  }
  function enhanceIfPlainText(el) {
    if (!(el instanceof HTMLElement)) return;
    const info = observed.get(el);
    const now = Date.now();
    // Debounce rapid setters
    if (info && now - info.lastAt < 60) return;
    const rawTxt = (el.textContent || "").trim();
    if (!rawTxt) { observed.set(el, { lastText: "", lastAt: now }); return; }
    // CSSOS_PHASE2_FONT_RERENDER_RACE 20260420 #85
    // Previously returned early on lastText === rawTxt; but renderWatchKaraokeOverlayModule()
    // fires on every audio timeupdate (~5×/s) with the SAME cue text and rebuilds the DOM
    // with plain escapeHtml, wiping out the .cssmv-anim-glyph spans we just installed via
    // shuffleTokenFonts(). The old guard then blocked the re-wrap because text matched.
    // Now: only skip when text matches AND the glyph spans are still present. If the overlay
    // rebuild wiped our spans, fall through and re-wrap with fresh per-token fonts.
    const hasGlyphs = !!el.querySelector?.(".cssmv-anim-glyph");
    if (info && info.lastText === rawTxt && hasGlyphs) return;
    // Only re-wrap if it's currently plain-ish text (no rich innerHTML structure)
    // — karaoke line builds its own structure; we skip those by looking for known child divs.
    const hasComplexStructure = el.querySelector?.(".watch-karaoke-current, .watch-karaoke-prev, .watch-karaoke-next");
    if (hasComplexStructure) {
      // Walk children and animate the inner lines' plaintext runs only
      Array.from(el.querySelectorAll(".watch-karaoke-current, .watch-karaoke-prev, .watch-karaoke-next")).forEach((node) => {
        const t = (node.textContent || "").trim();
        if (t && !node.querySelector(".cssmv-anim-glyph")) {
          // Check it's "plain" — only text nodes, no spans inside
          const onlyText = Array.from(node.childNodes).every((c) => c.nodeType === 3 || (c.nodeType === 1 && !c.classList?.contains("karaoke-word")));
          if (onlyText) node.innerHTML = wrapGlyphs(t);
        }
      });
      observed.set(el, { lastText: rawTxt, lastAt: now });
      return;
    }
    // Plain subtitle text: re-wrap as glyphs
    el.innerHTML = wrapGlyphs(rawTxt);
    observed.set(el, { lastText: rawTxt, lastAt: now });
  }
  function attachObservers() {
    const subtitle = document.getElementById(IDS.subtitle);
    const karaoke = document.getElementById(IDS.karaoke);
    [subtitle, karaoke].filter(Boolean).forEach((el) => {
      if (el.__cssmvObserved) return;
      el.__cssmvObserved = true;
      const obs = new MutationObserver(() => {
        // Throttle per rAF to coalesce batches
        if (el.__cssmvRaf) return;
        el.__cssmvRaf = requestAnimationFrame(() => {
          el.__cssmvRaf = 0;
          if (shouldEnhance(el)) enhanceIfPlainText(el);
        });
      });
      obs.observe(el, { childList: true, characterData: true, subtree: true });
      // Initial pass
      if (shouldEnhance(el)) enhanceIfPlainText(el);
    });
  }

  // ------------------------------------------------------------------
  // P2-28b — MV art title overlay
  // ------------------------------------------------------------------
  let mvTitleEl = null;
  // CSSOS_PHASE2_MV_TITLE_REHYDRATE 20260420 — Jing:
  //   "MV标题没有显示在媒体框，请修复，谢谢。"
  // Root cause was an interaction between three bugs:
  //   A. When .watch-screen's children churn (panel hydration, pipeline reset,
  //      tab switches), ensureMvTitle() creates a FRESH empty element. But the
  //      module-scoped mvTitleLastText still held the previous text, so the
  //      next renderMvArtTitle(sameText) early-returned at the dedup check
  //      (`if (clean === mvTitleLastText) return`) — leaving the fresh node
  //      empty forever.
  //   B. The appear-delay setTimeout(120ms) captured `el` in closure. If the
  //      element was swapped during the delay, the `.is-visible` class landed
  //      on a detached node.
  //   C. <video autoplay> could fire `play` BEFORE render completes, adding
  //      `.is-playing` to an unrendered element. Since the CSS rule requires
  //      both `.is-visible.is-playing`, base `opacity:0` won.
  //
  // Fix:
  //   - Track the last rendered text on the element itself (__cssmvLastText)
  //     instead of a module variable. When the element gets swapped, a fresh
  //     node has no stale "last text" → render always runs.
  //   - Re-hydrate the fresh element from cached text if we have one.
  //   - Use mvTitleEl (live reference) inside setTimeout, not captured `el`.
  //   - Never set `.is-playing` on an element without `.is-visible`.
  let mvTitleCachedText = "";
  function ensureMvTitle() {
    const frame = qFrame();
    if (!frame) return null;
    if (!mvTitleEl || !mvTitleEl.isConnected) {
      const fresh = document.createElement("div");
      fresh.id = "cssmv-mv-title";
      fresh.className = "cssmv-mv-title";
      frame.appendChild(fresh);
      mvTitleEl = fresh;
      // Re-hydrate from cache so the newly-attached node isn't empty.
      if (mvTitleCachedText) {
        try {
          mvTitleEl.innerHTML = wrapGlyphs(mvTitleCachedText, pickMotion());
          fitMvTitleFontSize(mvTitleEl, frame);
          mvTitleEl.__cssmvLastText = mvTitleCachedText;
          /* CSSOS_WAVE_207 20260516 — Jing: "标题会在10秒后隐藏，可是
           * 这个妖怪一直挂在那里". The rehydrate path used to set
           * is-visible permanently — no auto-hide ever fired because
           * the showMvArtTitleForFlash() schedule only happens inside
           * renderMvArtTitle(). Route through the same flash helper
           * so the rehydrated text gets the same 10s visibility +
           * auto-hide treatment as a fresh render. */
          requestAnimationFrame(() => {
            if (!mvTitleEl || !mvTitleEl.isConnected) return;
            try { showMvArtTitleForFlash(); } catch (_e) {
              mvTitleEl.classList.remove("is-hidden");
              mvTitleEl.classList.add("is-visible");
            }
          });
        } catch (_err) {}
      }
    }
    return mvTitleEl;
  }
  function fitMvTitleFontSize(el, frame) {
    if (!(el instanceof HTMLElement) || !(frame instanceof HTMLElement)) return;
    const rect = frame.getBoundingClientRect();
    const basis = Math.min(rect.width || 0, rect.height || 0) || 320;
    let px = Math.round(basis * CONFIG.MV_TITLE_FONT_SIZE_RATIO);
    px = Math.max(CONFIG.MV_TITLE_MIN_FONT_PX, Math.min(CONFIG.MV_TITLE_MAX_FONT_PX, px));
    el.style.fontSize = px + "px";
    // If it overflows vertically past MAX_LINES, scale down until it fits
    const maxHeight = px * CONFIG.MV_TITLE_LINE_HEIGHT * CONFIG.MV_TITLE_MAX_LINES + 2;
    let guard = 0;
    while (el.scrollHeight > maxHeight && px > CONFIG.MV_TITLE_MIN_FONT_PX && guard < 40) {
      px = Math.max(CONFIG.MV_TITLE_MIN_FONT_PX, Math.round(px * 0.94));
      el.style.fontSize = px + "px";
      guard += 1;
    }
  }
  let mvTitleLastText = "";
  function renderMvArtTitle(text) {
    const frame = qFrame();
    const clean = String(text || "").trim();
    /* CSSOS_WAVE_207 20260516 — Jing: "Du Fu × Yueyang Tower 妖怪". The
     * old early-return when !frame left mvTitleCachedText stuck on the
     * previous work's title. When the watch frame later remounted,
     * ensureMvTitle() rehydrated from that stale cache and the wrong
     * title appeared with no auto-hide. Fix: ALWAYS update the cache
     * with the latest requested title (including "") before the frame
     * check, so a remount can never resurrect a previous work's text. */
    mvTitleCachedText = clean;
    mvTitleLastText = clean;
    if (!frame) return;
    const el = ensureMvTitle();
    if (!el) return;
    if (!clean) {
      el.classList.remove("is-visible", "is-playing");
      el.classList.add("is-hidden");
      el.innerHTML = "";
      mvTitleLastText = "";
      mvTitleCachedText = "";
      el.__cssmvLastText = "";
      return;
    }
    // Dedup against per-element last text (not module-global), so a freshly
    // reconstructed element always re-renders even if the string is identical.
    if (clean === el.__cssmvLastText && el.innerHTML) {
      // Ensure visibility on subsequent identical calls (defensive).
      if (!el.classList.contains("is-visible")) {
        el.classList.remove("is-hidden");
        el.classList.add("is-visible");
      }
      return;
    }
    mvTitleLastText = clean;
    mvTitleCachedText = clean;
    el.__cssmvLastText = clean;
    el.innerHTML = wrapGlyphs(clean, pickMotion());
    fitMvTitleFontSize(el, frame);
    // CSSOS_PHASE2_TITLE_FLASH 20260504 — Jing's request: title should
    // not stay on-screen continuously. Show for 10s on first render
    // (and on every subsequent shuffle), then auto-hide. The flash
    // helper picks a face-safe anchor + emotion class.
    setTimeout(() => {
      const live = mvTitleEl;
      if (!live || !live.isConnected) return;
      try { showMvArtTitleForFlash(); } catch (_e) {
        // Fallback: legacy behaviour (always-on)
        live.classList.remove("is-hidden");
        live.classList.add("is-visible");
      }
    }, CONFIG.MV_TITLE_APPEAR_DELAY_MS);
  }
  function hideMvArtTitle() {
    if (!mvTitleEl) return;
    mvTitleEl.classList.remove("is-visible", "is-playing");
    mvTitleEl.classList.add("is-hidden");
  }

  // CSSOS_PHASE2_TITLE_FLASH 20260504 — Jing
  // 10-second visibility flash that the auto-rotate-on-shuffle timer
  // calls into. Picks a face-safe corner each shuffle so the title
  // rotates around the frame instead of always sitting dead-centre
  // on top of whatever face the camera is holding. Applies the same
  // emotion class the karaoke renderer derives so the title "feels"
  // the song just like the lyric line does.
  let __cssmvTitleFlashTimer = 0;
  let __cssmvTitleAnchorIdx = 0;
  // Title anchors arranged so consecutive shuffles never overlap and
  // most positions stay clear of the centre (where faces live in
  // 16:9 portrait-ish framing). Each entry maps to CSS classes.
  const TITLE_ANCHORS = [
    "anchor-tl", "anchor-tr",
    "anchor-bl", "anchor-br",
    "anchor-tc", "anchor-bc",
    "anchor-ml", "anchor-mr",
  ];
  function pickFaceSafeAnchor() {
    // CSSOS_FACE_SAFE_ANCHOR_HOOK 20260506 — Jing
    // If app.face-safe-overlay.js detected a face, use its
    // recommended diagonal-opposite anchor so the title genuinely
    // misses the face, not just rotates blindly. Falls back to the
    // round-robin when no detection is available.
    try {
      if (globalThis.cssosFaceSafe && typeof globalThis.cssosFaceSafe.titleAnchor === "function") {
        const a = globalThis.cssosFaceSafe.titleAnchor();
        if (a && TITLE_ANCHORS.indexOf(a) >= 0) {
          __cssmvTitleAnchorIdx = TITLE_ANCHORS.indexOf(a);
          return a;
        }
      }
    } catch (_e) {}
    // Round-robin with small randomisation to avoid perceptible
    // patterning while still guaranteeing every corner gets used.
    const next = (__cssmvTitleAnchorIdx + 1 + Math.floor(Math.random() * 3)) % TITLE_ANCHORS.length;
    __cssmvTitleAnchorIdx = next;
    return TITLE_ANCHORS[next];
  }
  function inferTitleEmotionFromText(s) {
    const t = String(s || "").toLowerCase();
    if (/fire|burn|燃|怒|爆|火/.test(t)) return "ignite";
    if (/love|heart|爱|心|怀/.test(t)) return "intimate";
    if (/dream|moon|night|梦|月|夜|星/.test(t)) return "resolve";
    if (/joy|smile|喜|笑|乐|阳光/.test(t)) return "joy";
    if (/grief|tear|cry|悲|失|泪/.test(t)) return "grief";
    if (/calm|peace|静|安|宁|海/.test(t)) return "calm";
    return "";
  }
  function showMvArtTitleForFlash(durationMs) {
    if (!mvTitleEl) return;
    const flashMs = Math.max(2000, Math.min(60000, Number(durationMs) || 10000));
    // Anchor swap: clear all anchor-* classes, set the new one
    TITLE_ANCHORS.forEach((c) => mvTitleEl.classList.remove(c));
    const anchor = pickFaceSafeAnchor();
    mvTitleEl.classList.add(anchor);
    // Emotion class — title gets the same emotion language as karaoke.
    ["ignite","resolve","intimate","joy","calm","grief"].forEach((k) => {
      mvTitleEl.classList.remove("title-emotion-" + k);
    });
    const emo = inferTitleEmotionFromText(mvTitleLastText);
    if (emo) mvTitleEl.classList.add("title-emotion-" + emo);
    mvTitleEl.classList.remove("is-hidden");
    mvTitleEl.classList.add("is-visible");
    mvTitleEl.classList.add("is-flash");
    if (__cssmvTitleFlashTimer) clearTimeout(__cssmvTitleFlashTimer);
    __cssmvTitleFlashTimer = setTimeout(() => {
      if (!mvTitleEl) return;
      mvTitleEl.classList.remove("is-visible", "is-flash");
      mvTitleEl.classList.add("is-hidden");
      __cssmvTitleFlashTimer = 0;
    }, flashMs);
  }
  globalThis.cssmvShowMvArtTitleForFlash = showMvArtTitleForFlash;
  // Keep title sized against frame size changes
  function wireMvTitleResize() {
    const frame = qFrame();
    if (!frame || !mvTitleEl) return;
    if (frame.__cssmvMvTitleRO) return;
    const ro = new ResizeObserver(() => {
      if (mvTitleEl && mvTitleLastText) fitMvTitleFontSize(mvTitleEl, frame);
    });
    ro.observe(frame);
    frame.__cssmvMvTitleRO = ro;
  }
  globalThis.cssmvRenderMvArtTitle = renderMvArtTitle;
  globalThis.cssmvHideMvArtTitle = hideMvArtTitle;

  // P2-42 — MV title persistence.
  //
  // Previous P2-28b behavior faded the title fully out as soon as the video
  // started playing. Users reported the title "still isn't showing in the
  // media box" — because the typical lifecycle was:
  //   1. renderMvArtTitle() fires with a 120ms appear-delay
  //   2. <video> starts playing almost immediately (autoplay path)
  //   3. hideMvArtTitle() fires on `play`/`playing`
  //   4. title never becomes visible OR disappears before eye can catch it
  //
  // New behavior:
  //   - We no longer fully hide on play; instead we add a `.is-playing` class
  //     that keeps the title rendered but at a reduced opacity + shifted to
  //     the very top of the frame so it never competes with subtitles.
  //   - Explicit callers (cssmvHideMvArtTitle) still hide.
  function markMvTitlePlaying(playing) {
    if (!mvTitleEl) return;
    if (playing) {
      // The compound CSS rule `.cssmv-mv-title.is-visible.is-playing` requires
      // BOTH classes to be present to dim the title to 0.62. Without
      // .is-visible the base rule (opacity:0) wins and the title disappears.
      // So only allow .is-playing if we already have content + .is-visible.
      if (!mvTitleEl.__cssmvLastText) return;
      if (!mvTitleEl.classList.contains("is-visible")) {
        mvTitleEl.classList.remove("is-hidden");
        mvTitleEl.classList.add("is-visible");
      }
      mvTitleEl.classList.add("is-playing");
    } else {
      mvTitleEl.classList.remove("is-playing");
    }
  }
  function wireMvTitleAutoHide() {
    const v = document.getElementById(IDS.video);
    if (!v || v.__cssmvMvTitleAutoHide) return;
    v.__cssmvMvTitleAutoHide = true;
    const enterPlay = () => markMvTitlePlaying(true);
    const leavePlay = () => markMvTitlePlaying(false);
    v.addEventListener("play", enterPlay);
    v.addEventListener("playing", enterPlay);
    v.addEventListener("pause", leavePlay);
    v.addEventListener("ended", leavePlay);
    v.addEventListener("emptied", leavePlay);
  }

  // ------------------------------------------------------------------
  // P2-28a — CN/EN font pool split + auto-rotate
  // ------------------------------------------------------------------
  let autoRotateTimer = null;
  function currentAutoRotateMin() {
    try {
      const raw = localStorage.getItem(CONFIG.AUTO_ROTATE_STORAGE_KEY);
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n >= 0) return n;
    } catch (_err) {}
    return CONFIG.AUTO_ROTATE_DEFAULT_MIN;
  }
  function setAutoRotateMin(mins) {
    const n = Math.max(0, Math.min(24 * 60, parseInt(mins, 10) || 0));
    try { localStorage.setItem(CONFIG.AUTO_ROTATE_STORAGE_KEY, String(n)); } catch (_err) {}
    restartAutoRotate();
    return n;
  }
  function scriptPoolsEnabled() {
    try {
      const raw = localStorage.getItem(CONFIG.SCRIPT_POOLS_ENABLED_KEY);
      if (raw == null) return true; // default on
      return raw === "1" || raw === "true";
    } catch (_err) { return true; }
  }
  function setScriptPoolsEnabled(on) {
    try { localStorage.setItem(CONFIG.SCRIPT_POOLS_ENABLED_KEY, on ? "1" : "0"); } catch (_err) {}
  }
  function restartAutoRotate() {
    if (autoRotateTimer) { clearInterval(autoRotateTimer); autoRotateTimer = null; }
    const mins = currentAutoRotateMin();
    if (mins <= 0) return;
    autoRotateTimer = setInterval(() => {
      try {
        if (typeof globalThis.cycleWatchTypographyPresetModule === "function") {
          globalThis.cycleWatchTypographyPresetModule();
        }
      } catch (_err) {}
      // CSSOS_WAVE_332 20260522 — Jing: 自动切换那一刻确保【真的换字体】并派发
      // cssmv:font-shuffle(标题闪现 10 秒就绑这个事件, 见 app.watch-ui.js). 这样
      // "用户设几分钟切字体 = 几分钟闪一次标题 10 秒"天然同步.
      try { shuffleTokenFonts(); } catch (_err) {}
    }, mins * 60 * 1000);
  }

  // Patch pickWatchRandomFontModule to respect CN/EN pool separation when content
  // is detected. We can't easily tell which side (title vs subtitle) is calling,
  // so we alternate: first call returns CJK-biased font, second call returns Latin-biased.
  // When mixed/unknown, fall back to whole catalog.
  function installFontPoolSplit() {
    if (!scriptPoolsEnabled()) return;
    const orig = globalThis.pickWatchRandomFontModule;
    if (typeof orig !== "function" || orig.__cssmvPatched) return;
    let flip = 0;
    const patched = function cssmvPickWatchRandomFontModule(entries, fallback) {
      try {
        if (!scriptPoolsEnabled() || !Array.isArray(entries) || entries.length < 2) {
          return orig(entries, fallback);
        }
        const pref = (flip++ % 2 === 0) ? "cjk" : "latin";
        const pool = entries.filter((e) => {
          const g = String(e?.group || "").toLowerCase();
          if (g) return g === pref;
          const fam = String(e?.family || "");
          return pref === "cjk" ? CJK_RE.test(fam) : !CJK_RE.test(fam);
        });
        if (pool.length) return orig(pool, fallback);
      } catch (_err) {}
      return orig(entries, fallback);
    };
    patched.__cssmvPatched = true;
    globalThis.pickWatchRandomFontModule = patched;
  }

  // ------------------------------------------------------------------
  // P2-28a — right-click settings popover
  // ------------------------------------------------------------------
  let menuEl = null;
  function closeMenu() {
    if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
    menuEl = null;
    document.removeEventListener("pointerdown", onOutsideMenu, true);
  }
  function onOutsideMenu(ev) {
    if (!menuEl) return;
    if (!menuEl.contains(ev.target)) closeMenu();
  }
  function openFontSettingsMenu(clientX, clientY) {
    closeMenu();
    const m = document.createElement("div");
    m.className = "cssmv-font-settings-menu";
    const currentMin = currentAutoRotateMin();
    const poolsOn = scriptPoolsEnabled();
    const mode = perTokenMode();
    const preset = currentPreset();
    const rotateOpts = CONFIG.AUTO_ROTATE_OPTIONS_MIN
      .map((n) => `<option value="${n}" ${n === currentMin ? "selected" : ""}>${
        n === 0 ? tr("Off", "关闭") : tr(`${n} min`, `${n} 分钟`)
      }</option>`)
      .join("");
    const modeOpts = [
      ["word", tr("Per word (EN) / per char (CN)", "每词(英) / 每字(中)")],
      ["char", tr("Per character (every letter)",  "每字符（逐字母）")],
      ["off",  tr("Off (one font for all)",        "关闭（整段一种字体）")],
    ].map(([val, lbl]) => `<option value="${val}" ${val === mode ? "selected" : ""}>${lbl}</option>`).join("");
    const presetOpts = [
      ["chaos",  tr("Chaos — fully random",      "百家争鸣 · 完全随机")],
      ["rhythm", tr("Rhythm — CN/EN pools",      "中英轮抽 · 分池")],
      ["line",   tr("Line — one font per script","整段统一 · 每script一款")],
      ["single", tr("Single — legacy one-font",  "原样 · 整MV一款")],
    ].map(([val, lbl]) => `<option value="${val}" ${val === preset ? "selected" : ""}>${lbl}</option>`).join("");
    m.innerHTML = `
      <h4>${tr("Typography", "字体设置")}</h4>
      <div class="cssmv-font-settings-row">
        <label for="cssmv-font-mode-sel">${tr("Randomize granularity", "随机粒度")}</label>
        <select id="cssmv-font-mode-sel">${modeOpts}</select>
      </div>
      <div class="cssmv-font-settings-row">
        <label for="cssmv-font-preset-sel">${tr("Preset", "预设风格")}</label>
        <select id="cssmv-font-preset-sel">${presetOpts}</select>
      </div>
      <div class="cssmv-font-settings-row">
        <label for="cssmv-font-rotate-sel">${tr("Auto-shuffle every", "自动切换")}</label>
        <select id="cssmv-font-rotate-sel">${rotateOpts}</select>
      </div>
      <div class="cssmv-font-settings-row">
        <label for="cssmv-font-pools-chk">${tr("CN / EN split pool (preset ✦)", "中英字体分池 (预设 ✦)")}</label>
        <input id="cssmv-font-pools-chk" type="checkbox" ${poolsOn ? "checked" : ""} />
      </div>
      <div class="cssmv-font-settings-row">
        <label>${tr("Shuffle now", "立即切换")}</label>
        <button id="cssmv-font-shuffle-now" type="button" style="padding:3px 10px;border-radius:6px;border:1px solid rgba(218,255,242,0.28);background:rgba(5,10,9,0.6);color:inherit;cursor:pointer;">✦</button>
      </div>
      <div class="cssmv-font-settings-hint">${tr(
        "Left-click ✦ to reshuffle per-token fonts. Right-click opens this menu.",
        "左键 ✦ 立即重抽每字/每词字体；右键打开本菜单。"
      )}</div>
    `;
    document.body.appendChild(m);
    // Position
    const mw = m.offsetWidth, mh = m.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    const x = Math.max(8, Math.min(vw - mw - 8, (clientX || 40)));
    const y = Math.max(8, Math.min(vh - mh - 8, (clientY || 40)));
    m.style.left = x + "px"; m.style.top = y + "px";
    menuEl = m;
    // Wire
    m.querySelector("#cssmv-font-mode-sel")?.addEventListener("change", (ev) => {
      const v = setPerTokenMode(ev.target.value);
      toast(
        v === "off"  ? "Per-token fonts off" : v === "char" ? "Per-character shuffling" : "Per-word shuffling",
        v === "off"  ? "已关闭逐字字体"     : v === "char" ? "逐字符随机字体"        : "逐词/字随机字体"
      );
      shuffleTokenFonts();
    });
    m.querySelector("#cssmv-font-preset-sel")?.addEventListener("change", (ev) => {
      const v = setCurrentPreset(ev.target.value);
      toast("Preset: " + v, "预设: " + v);
      shuffleTokenFonts();
    });
    m.querySelector("#cssmv-font-rotate-sel")?.addEventListener("change", (ev) => {
      const v = parseInt(ev.target.value, 10) || 0;
      const n = setAutoRotateMin(v);
      toast(n > 0 ? `Auto-shuffle every ${n} min` : "Auto-shuffle off",
            n > 0 ? `每 ${n} 分钟自动切换字体` : "已关闭自动切换");
    });
    m.querySelector("#cssmv-font-pools-chk")?.addEventListener("change", (ev) => {
      setScriptPoolsEnabled(!!ev.target.checked);
      toast(ev.target.checked ? "CN / EN pool split on" : "Pool split off",
            ev.target.checked ? "中英分池已开" : "中英分池已关");
    });
    m.querySelector("#cssmv-font-shuffle-now")?.addEventListener("click", () => {
      shuffleTokenFonts();
    });
    // Outside click
    setTimeout(() => document.addEventListener("pointerdown", onOutsideMenu, true), 0);
  }

  // ------------------------------------------------------------------
  // P2-75 — shuffleTokenFonts(): the left-click action
  //   Re-wraps the subtitle, karaoke line, and MV title with a freshly
  //   picked per-token font array. Safe to call any time.
  // ------------------------------------------------------------------
  // CSSOS_PHASE2_PIECE_FONT_CACHE 20260420 #85
  // Persistent (text-piece → font-family) assignment, cleared only on shuffle.
  // Consumed by both wrapGlyphs (inline glyph spans) and renderWatchKaraokeOverlayModule
  // (karaoke-word spans) so that fonts stay stable across timeupdate-driven DOM rebuilds.
  const __cssmvPieceFontMap = new Map();
  function cssmvAssignFontForPiece(text) {
    const t = String(text || "").trim();
    if (!t) return "";
    if (__cssmvPieceFontMap.has(t)) return __cssmvPieceFontMap.get(t) || "";
    const pools = loadFontPools();
    if (!pools.cjk.length && !pools.latin.length) {
      __cssmvPieceFontMap.set(t, "");
      return "";
    }
    // CSSOS_PHASE2_FANCY_WEIGHT 20260504 — Jing
    // 90% fancy / 10% plain. The deployed manifest is heavy on CJK
    // calligraphic faces (143 survivors, mostly cjk after fonts_en
    // pruning), so the Latin fancy bucket can be tiny or empty. To
    // guarantee the user sees fancy fonts on Latin text too, cross-
    // pool the FANCY bucket whenever the same-script fancy bucket is
    // empty — most CJK calligraphic fonts cover the basic Latin block,
    // and a missing glyph cleanly falls through to var(--watch-title-
    // font-family) downstream.
    const wantCjk = CJK_RE.test(t);
    let fancy = wantCjk ? pools.cjkFancy : pools.latinFancy;
    if (!fancy.length) fancy = wantCjk ? pools.latinFancy : pools.cjkFancy;
    let plain = wantCjk ? pools.cjkPlain : pools.latinPlain;
    if (!plain.length) plain = wantCjk ? pools.latinPlain : pools.cjkPlain;
    const fam = pickWeightedFromBuckets(fancy, plain, 0.9);
    // CSSOS_PHASE2_BOUNDED_CACHE 20260505 — Jing
    // Cap the per-piece font map at 4000 entries so a long-lived
    // session reading thousands of unique CJK chars + Latin words
    // can't grow it to 100k+. Eviction: drop the oldest insertion
    // (Map preserves insertion order, so deleting the first key works).
    if (__cssmvPieceFontMap.size >= 4000) {
      const firstKey = __cssmvPieceFontMap.keys().next().value;
      if (firstKey) __cssmvPieceFontMap.delete(firstKey);
    }
    __cssmvPieceFontMap.set(t, fam);
    return fam;
  }
  globalThis.cssmvAssignFontForPiece = cssmvAssignFontForPiece;
  // CSSOS_PHASE2_FANCY_CACHE_BUST 20260504 — Jing
  // The per-piece font map is persistent across the session so a given
  // glyph keeps its font between re-renders. But when new fonts get
  // injected mid-session (Google Fonts arriving after first paint),
  // earlier assignments are stuck on whatever was available at the
  // moment they were first looked up. Expose a clear hook so callers
  // (font-manifest, settings panel, future hot-reload) can invalidate
  // every assignment and have the next render re-roll across the full
  // (now larger) pool.
  globalThis.cssmvClearPieceFontMap = function () {
    __cssmvPieceFontMap.clear();
    __cssmvFontCatalogCache = null;
    __cssmvFontCatalogStamp = 0;
  };

  function shuffleTokenFonts() {
    // CSSMV_FONT_SHUFFLE_FORCE 20260423 #93 — Jing: make this actually fire the
    // second, third, and Nth time by (a) clearing the per-element dedup cache
    // that renderMvArtTitle uses, (b) busting all observed-element debounce
    // state, and (c) re-rendering every overlay text node regardless of whether
    // its previous content looked identical.
    bumpShuffleSeed();
    // Invalidate pool cache so we pull a fresh catalog (e.g. newly favorited fonts)
    __cssmvFontCatalogCache = null;
    __cssmvFontCatalogStamp = 0;
    // Invalidate the piece→font map so every subsequent render picks fresh fonts.
    __cssmvPieceFontMap.clear();

    const debugOn = (() => {
      try { return localStorage.getItem("cssmv.debugShuffle") === "1"; } catch (_e) { return false; }
    })();
    if (debugOn) {
      try {
        const { cjk, latin } = loadFontPools();
        // eslint-disable-next-line no-console
        console.info("[cssmv] shuffleTokenFonts fired", {
          mvTitleEl: !!mvTitleEl,
          mvTitleLastText,
          pools: { cjk: cjk.length, latin: latin.length },
          mode: perTokenMode(),
          preset: currentPreset()
        });
      } catch (_err) {}
    }

    // Re-render MV title — bust the per-element dedup cache so any subsequent
    // renderMvArtTitle(sameText) call won't early-return and blow away our fresh
    // glyph spans.
    if (mvTitleEl && mvTitleLastText) {
      const frame = qFrame();
      mvTitleEl.innerHTML = wrapGlyphs(mvTitleLastText, pickMotion());
      try { mvTitleEl.__cssmvLastText = ""; } catch (_err) {}
      if (frame) fitMvTitleFontSize(mvTitleEl, frame);
      // CSSOS_PHASE2_TITLE_SHOW_ON_SHUFFLE 20260504 — Jing
      // "字幕标题要跟媒体框右下角字幕按钮右键菜单里的时间随机在切换字
      //  体呢？10秒钟自动隐藏，等到下一次随机字体切换，再显示10秒后自
      //  动隐藏."
      // Each shuffle: pop the title visible with the new fancy font;
      // schedule a 10s auto-hide. Subsequent shuffles re-pop and reset
      // the timer. Runs piggybacking on the existing auto-rotate timer
      // (right-click menu on the subtitle button — "Auto-shuffle every
      // {N} min") so the user-set cadence drives the title cycle too.
      try {
        showMvArtTitleForFlash();
      } catch (_e) { /* non-fatal */ }
    }

    // Re-render subtitle + karaoke text (plain mode)
    const subtitle = document.getElementById(IDS.subtitle);
    const karaoke  = document.getElementById(IDS.karaoke);
    [subtitle, karaoke].filter(Boolean).forEach((el) => {
      const txt = (el.textContent || "").trim();
      if (!txt) return;
      // Look for the complex karaoke structure to preserve it
      const hasComplex = el.querySelector?.(".watch-karaoke-current, .watch-karaoke-prev, .watch-karaoke-next");
      if (hasComplex) {
        Array.from(el.querySelectorAll(".watch-karaoke-current, .watch-karaoke-prev, .watch-karaoke-next")).forEach((node) => {
          const t = (node.textContent || "").trim();
          if (t) node.innerHTML = wrapGlyphs(t);
        });
      } else {
        el.innerHTML = wrapGlyphs(txt);
      }
      // Reset debounce so enhanceIfPlainText doesn't revert us
      observed.set(el, { lastText: txt, lastAt: Date.now() });
    });

    // CSSMV_FONT_SHUFFLE_FORCE 20260423 #93 — re-paint the per-word karaoke
    // spans. These are rendered by renderWatchKaraokeOverlayModule and
    // populated via cssmvAssignFontForPiece (now cleared). Swap their inline
    // font-family to the new assignment for every visible .watch-karaoke-word.
    try {
      document.querySelectorAll(".watch-karaoke-word").forEach((wordEl) => {
        const t = String(wordEl.textContent || "").trim();
        if (!t) return;
        const fam = cssmvAssignFontForPiece(t);
        if (fam) {
          try {
            wordEl.style.fontFamily = `"${String(fam).replace(/"/g, "\\\"")}", var(--watch-title-font-family, inherit)`;
          } catch (_err) {}
        }
      });
    } catch (_err) {}

    // Music panel: title / art nodes (best-effort — re-wrap any visible text overlays)
    try {
      ["watch-music-title-overlay", "watch-music-subtitle-overlay"].forEach((id) => {
        const el = document.getElementById(id);
        const txt = (el?.textContent || "").trim();
        if (el && txt) {
          el.innerHTML = wrapGlyphs(txt);
          observed.set(el, { lastText: txt, lastAt: Date.now() });
        }
      });
    } catch (_err) {}

    // CSSMV_FONT_SHUFFLE_FORCE 20260423 #93 — announce that a shuffle finished
    // so downstream listeners (karaoke ticker, MV title guard) can coordinate.
    try {
      window.dispatchEvent(new CustomEvent("cssmv:font-shuffle", {
        detail: { at: Date.now() }
      }));
    } catch (_err) {}
  }
  globalThis.cssmvShuffleTokenFonts = shuffleTokenFonts;
  globalThis.cssmvPerTokenMode      = perTokenMode;
  globalThis.cssmvSetPerTokenMode   = setPerTokenMode;
  globalThis.cssmvCurrentPreset     = currentPreset;
  globalThis.cssmvSetCurrentPreset  = setCurrentPreset;

  function wireStyleShiftMenu() {
    const btn = document.getElementById(IDS.styleShift);
    if (btn && !btn.__cssmvFontSettings) {
      btn.__cssmvFontSettings = true;
      // capture-phase contextmenu so we run before any existing handler
      btn.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openFontSettingsMenu(ev.clientX, ev.clientY);
      }, true);
      // P2-75 — left-click = per-token font reshuffle.
      //   We run AFTER the existing watch-ui click handler (which swaps the
      //   single-preset font via CSS vars) so our inline per-token font
      //   override wins. The `once` flag guard prevents double-binding.
      btn.addEventListener("click", (ev) => {
        // Don't preventDefault — let the existing cycleWatchTypographyPresetModule
        // run first so CSS variables update, then we reshuffle per-token.
        // If user really wants the legacy "single-font" behavior, they can
        // switch preset to "single" in the right-click menu.
        try { shuffleTokenFonts(); } catch (_err) {}
      }, false);
      // P2-75 — bump visibility so users can actually find the button
      btn.classList.add("cssmv-star-emphasized");
    }
    // P2-61 — music pane also gets a ✦ star button; it's a fresh node so we
    // wire both the left-click shuffle and the right-click settings menu here
    // (the MV-pane button wires its own click in app.watch-ui.js).
    const musicBtn = document.getElementById("watch-music-style-shift");
    if (musicBtn && !musicBtn.__cssmvFontSettings) {
      musicBtn.__cssmvFontSettings = true;
      musicBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        // Music tab: cycle the single-font preset AND reshuffle per-token
        try { globalThis.cycleWatchTypographyPresetModule?.(); } catch (_err) {}
        try { shuffleTokenFonts(); } catch (_err) {}
      });
      musicBtn.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openFontSettingsMenu(ev.clientX, ev.clientY);
      }, true);
      musicBtn.classList.add("cssmv-star-emphasized");
    }
  }

  // ------------------------------------------------------------------
  // P2-28d — vocals / instrumental toggle button
  // ------------------------------------------------------------------
  function currentStemPref() {
    try {
      const v = localStorage.getItem(CONFIG.STEM_STORAGE_KEY);
      if (v === "vocals" || v === "instrumental") return v;
    } catch (_err) {}
    return CONFIG.STEM_DEFAULT;
  }
  function setStemPref(v) {
    const next = v === "instrumental" ? "instrumental" : "vocals";
    try { localStorage.setItem(CONFIG.STEM_STORAGE_KEY, next); } catch (_err) {}
    return next;
  }
  globalThis.cssmvCurrentStemPreference = currentStemPref;

  function resolveStemUrls() {
    // Parameterized lookup — the pipeline can populate these globals;
    // we just ask about them here and fall back gracefully.
    const vocals =
      String(globalThis.currentPreviewAudioOriginalUrl || "").trim() ||
      String(globalThis.currentPreviewAudioUrl || "").trim() ||
      "";
    const instrumental =
      String(globalThis.currentPreviewAudioInstrumentalUrl || "").trim() ||
      "";
    return { vocals, instrumental };
  }
  function applyStemToAudio(which) {
    const audio = document.getElementById(IDS.audio);
    if (!(audio instanceof HTMLMediaElement)) return false;
    const urls = resolveStemUrls();
    const target = which === "instrumental" ? urls.instrumental : urls.vocals;
    const fallback = which === "instrumental" ? urls.vocals : urls.instrumental;
    const pick = target || fallback || "";
    if (!pick) {
      toast("No audio stem available yet", "暂无可切换的音频分轨");
      return false;
    }
    const wasPlaying = !audio.paused;
    const tt = audio.currentTime || 0;
    if (audio.src !== pick) {
      audio.src = pick;
      audio.load?.();
      audio.addEventListener("loadedmetadata", function once() {
        try { audio.currentTime = Math.min(tt, audio.duration || tt); } catch (_err) {}
        if (wasPlaying) audio.play?.().catch(() => {});
        audio.removeEventListener("loadedmetadata", once);
      });
    }
    if (!target && fallback) {
      toast(
        which === "instrumental" ? "No instrumental — using original" : "No vocals — using instrumental",
        which === "instrumental" ? "暂无伴奏，回退为原唱" : "暂无原唱，回退为伴奏"
      );
    } else {
      toast(
        which === "instrumental" ? "Instrumental" : "Vocals (original)",
        which === "instrumental" ? "伴奏" : "原唱"
      );
    }
    return true;
  }

  function ensureStemToggleBtn() {
    const frame = qFrame();
    if (!frame) return null;
    let btn = document.getElementById("cssmv-stem-toggle");
    if (btn && btn.isConnected) return btn;
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "cssmv-stem-toggle";
    btn.className = "cssmv-stem-toggle";
    btn.setAttribute("aria-label", tr("Toggle vocals / instrumental", "切换原唱/伴奏"));
    btn.innerHTML = `<span class="cssmv-stem-icon"></span>`;
    frame.appendChild(btn);
    syncStemToggleUi(btn, currentStemPref());
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const cur = currentStemPref();
      const next = cur === "vocals" ? "instrumental" : "vocals";
      setStemPref(next);
      syncStemToggleUi(btn, next);
      applyStemToAudio(next);
    });
    return btn;
  }
  function syncStemToggleUi(btn, pref) {
    if (!btn) return;
    btn.classList.toggle("is-vocals", pref === "vocals");
    btn.classList.toggle("is-instrumental", pref === "instrumental");
    btn.title = pref === "vocals"
      ? tr("Vocals (original). Click for instrumental.", "原唱。点击切到伴奏。")
      : tr("Instrumental. Click for vocals.", "伴奏。点击切到原唱。");
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  // P2-42 — pull a best-guess current title so the overlay can boot eagerly
  // even before a lyrics seed lands.
  function pickBootTitle() {
    try {
      const titleInput = document.getElementById("title-input");
      if (titleInput && typeof titleInput.value === "string" && titleInput.value.trim()) {
        return titleInput.value.trim();
      }
    } catch (_err) {}
    try {
      const watchState = globalThis.__watchState || globalThis.watchState;
      if (watchState && typeof watchState.title === "string" && watchState.title.trim()) {
        return watchState.title.trim();
      }
    } catch (_err) {}
    try {
      if (typeof globalThis.currentWorkTitle === "function") {
        const t = String(globalThis.currentWorkTitle() || "").trim();
        if (t) return t;
      }
    } catch (_err) {}
    return "";
  }

  function renderBootTitleIfAvailable() {
    try {
      const t = pickBootTitle();
      if (t) renderMvArtTitle(t);
    } catch (_err) {}
  }

  function boot() {
    ensureStyles();
    // Small delay lets watch-ui.js finish its initial wiring so our patch applies
    setTimeout(() => {
      installFontPoolSplit();
      wireStyleShiftMenu();
      ensureMvTitle();
      wireMvTitleResize();
      wireMvTitleAutoHide();
      renderBootTitleIfAvailable();
      ensureStemToggleBtn();
      attachObservers();
      restartAutoRotate();
    }, 0);

    // CSSOS_PHASE2_OBS_DEBOUNCE 20260505 — Jing
    // "请仔细检查全站代码，查处哪些代码在严重消耗资源". This observer
    // was watching ENTIRE document.body (childList + subtree), firing
    // on every DOM mutation across all 240 modules — every Works Center
    // re-render, every karaoke subtitle update, every font shuffle.
    // Each fire ran wireStyleShiftMenu / ensureMvTitle / wireMvTitleResize
    // / wireMvTitleAutoHide / attachObservers — heavy chain. Debounce
    // to 200 ms so a burst of mutations collapses into a single re-wire.
    let __cssmvRewireTid = 0;
    const mo = new MutationObserver(() => {
      if (__cssmvRewireTid) return;
      __cssmvRewireTid = setTimeout(() => {
        __cssmvRewireTid = 0;
        wireStyleShiftMenu();
        ensureMvTitle();
        wireMvTitleResize();
        wireMvTitleAutoHide();
        if (!mvTitleLastText) renderBootTitleIfAvailable();
        ensureStemToggleBtn();
        attachObservers();
      }, 200);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  // Expose a refresh hook for downstream pipelines
  globalThis.cssmvRefreshMediaOverlays = function () {
    wireStyleShiftMenu();
    ensureMvTitle();
    wireMvTitleAutoHide();
    ensureStemToggleBtn();
    attachObservers();
    restartAutoRotate();
  };
})();
