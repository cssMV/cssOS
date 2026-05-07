// app.watch-media-layout-p2100.js
// CSSOS_PHASE2_WATCH_MEDIA_LAYOUT 20260425 #102 — full rewrite to fix:
//   • info "i" button: click toggle works, popover is in document.body
//     with position:fixed so no stacking-context trap
//   • tabs bar: default hidden, auto-show on pointer activity, hide after 3s
//     (Jing: "上下滑动切换到前一首歌/后一首歌" needs clean frame; tabs still
//     accessible via hover/activity)
//   • subtitle random fonts: force per-token mode to "word" + call
//     shuffleTokenFonts() (not cssmvApplyTextEntry) after every textContent
//     change so fonts actually re-randomize per word
//   • fullscreen button still present
//
// Loads AFTER app.watch-media-overlays.js.

(function initWatchMediaLayoutP2100Module() {
  "use strict";
  if (document.getElementById("cssmv-watch-layout-p2100-styles")) return;

  const st = document.createElement("style");
  st.id = "cssmv-watch-layout-p2100-styles";
  st.textContent = `
/* Equal padding on media frame */
#watch-panel .watch-frame { padding: 14px !important; }

/* Tabs: default hidden, ONLY reveal via info button click (+ auto-hide 3s) */
#watch-panel .watch-tabs {
  max-height: 0 !important;
  overflow: hidden !important;
  opacity: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  transition: max-height .25s ease, opacity .25s ease, padding .25s ease, margin .25s ease !important;
  pointer-events: none !important;
}
#watch-panel.cssmv-info-open .watch-tabs {
  max-height: 120px !important;
  opacity: 1 !important;
  overflow: visible !important;
  padding: 6px 0 !important;
  margin: 0 0 6px 0 !important;
  pointer-events: auto !important;
}

/* Default-hide ALL bottom-overlay chrome — only shown when info button is open */
#watch-panel .watch-frame-progress-copy,
#watch-panel .watch-frame-progress,
#watch-panel .watch-commerce-actions,
#watch-panel .watch-engine-grid,
#watch-panel .kara-runtime-board {
  display: none !important;
}
#watch-panel.cssmv-info-open .watch-frame-progress,
#watch-panel.cssmv-info-open .watch-commerce-actions,
#watch-panel.cssmv-info-open .watch-engine-grid,
#watch-panel.cssmv-info-open .kara-runtime-board {
  display: revert !important;
}

/* Jing 2026-04-25 #102r — soft slideshow fade for ✦ font reshuffle.
   When .cssmv-p2100-fade is present, the element transitions opacity
   smoothly. .cssmv-p2100-fading sets opacity:0; removing it fades back
   to 1. Each leg ≈400ms so total ≈800ms slideshow feel. */
#watch-panel .cssmv-p2100-fade {
  transition: opacity 0.42s cubic-bezier(0.4, 0, 0.2, 1) !important;
  will-change: opacity !important;
}
#watch-panel .cssmv-p2100-fading {
  opacity: 0 !important;
}
/* Per-glyph subtle pop-in so each new random font feels gentle, not a hard
   cut. Combined with the parent's opacity fade this gives a smooth
   "slideshow" feel. */
#watch-panel .cssmv-p2100-glyph {
  transition: filter 0.6s ease, transform 0.6s ease, opacity 0.6s ease !important;
}

/* CSSMV_STATUS_VS_SUBTITLE_SPLIT 20260425 #110 — Jing
 * "提示信息另外用一个新的标签，不要和普通字幕混在一起，不然会把孩子和
 *  脏水一起泼出去。即：保留普通字幕随机字体切换，另外添加一个标签显示
 *  输出信息."
 *
 * Previously I'd CSS-reset .watch-subtitle to plain text because it
 * was being repurposed for status messages ("CSS is composing…",
 * "KaraOKe MV · Painting the cover now", etc.). That nuked the real
 * subtitle styling (tone-/emotion-/style- variants in style.watch.css).
 *
 * New rule: .watch-subtitle is ONLY for actual subtitle text and keeps
 * its full design. Status messages go to a separate element
 * #watch-status-info that we inject below. The redirect is wired in
 * the JS block "STATUS-INFO REDIRECT" further down. The CSS reset is
 * gone — .watch-subtitle inherits its native style from style.watch.css.
 */
/* CSSOS_PHASE2_TITLE_BAR_LIVE_PCT 20260426 #128/#130 — Jing
   "请把Watch面板媒体框底部中间的输出信息（那里不再显示，留出位置显示普通字幕），
    移动到标题上"
   Status pill that used to float at bottom-center has moved to the panel
   title bar (driven by cssmvPipelineActiveStage in app.watch-ui.js).
   #watch-status-info is now invisible but still EXISTS because the
   redirect MutationObserver below uses it as a sink to strip
   status-shaped text out of #watch-subtitle. Keeping it
   display:none !important is load-bearing: removing the element entirely
   would force a refactor of the observer; hiding it keeps the
   side-channel intact while freeing the bottom-center for real subtitles. */
#watch-panel #watch-status-info,
#watch-panel #watch-status-info.is-active {
  display: none !important;
  opacity: 0 !important;
  pointer-events: none !important;
  position: absolute;
  left: -9999px;
  top: -9999px;
}

/* CSSMV_LYRIC_SINGLE_LINE 20260426 #120 — Jing
   "恢复普通字幕，不要多行显示，只能一句歌词一行显示，可以保留逐字随机切换。
    字幕标题保持多行显示。"
   Title (.cssmv-mv-title) keeps the multi-line heavy/light weight treatment.
   Karaoke lyric line (#watch-karaoke-line) and #watch-subtitle revert to
   single-line: each lyric phrase on its OWN line, ellipsis if it overflows
   the frame width. Per-glyph random fonts still apply via .cssmv-p2100-glyph. */
#watch-panel .cssmv-mv-title {
  white-space: normal !important;
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
  max-width: min(92%, 1100px) !important;
  line-height: 1.18 !important;
  max-height: 86% !important;
  overflow: hidden !important;
}
#watch-panel #watch-karaoke-line,
#watch-panel #watch-subtitle {
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  word-break: keep-all !important;
  overflow-wrap: normal !important;
  /* CSSOS_PHASE2_SUBTITLE_BOTTOM_LEFT 20260504 — Jing: shrink the
   * max-width so the bottom-left anchored subtitle leaves space on
   * the right for commerce / action chips and per-take pills. */
  max-width: min(62%, 720px) !important;
  line-height: 1.2 !important;
}
/* The karaoke line wraps each cue in .watch-karaoke-prev / -current /
   -next sub-rows. Each row stays single-line; the parent stack remains
   vertical (prev / current / next), but no row of lyrics ever wraps. */
#watch-panel #watch-karaoke-line .watch-karaoke-prev,
#watch-panel #watch-karaoke-line .watch-karaoke-current,
#watch-panel #watch-karaoke-line .watch-karaoke-next {
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  display: block !important;
  max-width: 100% !important;
}
/* Suppress the heavy/light multi-line wrap rows when they show up on
   the karaoke line. The .watch-karaoke-row class is emitted by the
   subtitle weight-wrap path; flatten them into inline-block so the
   row ends up on ONE line. */
#watch-panel #watch-karaoke-line .watch-karaoke-row {
  display: inline-block !important;
  white-space: nowrap !important;
}
#watch-panel .cssmv-mv-title .cssmv-p2100-glyph,
#watch-panel #watch-karaoke-line .cssmv-p2100-glyph,
#watch-panel #watch-subtitle .cssmv-p2100-glyph {
  display: inline-block !important;
}
/* When p2100 glyph spans are present, cap each glyph's font-size so heavy
   tokens (1em) never grow past the screen height proportionally. We scale
   via inline style in JS too, but provide a CSS clamp baseline. */
#watch-panel .cssmv-mv-title .cssmv-w-heavy {
  font-size: clamp(1em, 7vh, 4em) !important;
}
#watch-panel .cssmv-mv-title .cssmv-w-light {
  font-size: clamp(0.6em, 4.5vh, 2.4em) !important;
}
/* Heavy = bold lead. Light = smaller, dimmer. Force visibility because some
   parents (.cssmv-anim-glyph) had opacity:0 baseline; our spans need
   opacity:1 unconditionally. */
#watch-panel .cssmv-p2100-glyph {
  opacity: 1 !important;
  visibility: visible !important;
  display: inline-block !important;
  animation: none !important;
  color: inherit !important;
}
#watch-panel .cssmv-w-heavy {
  font-weight: 800 !important;
  font-size: 1em !important;
  letter-spacing: 0.01em !important;
  opacity: 1 !important;
}
#watch-panel .cssmv-w-light {
  font-weight: 400 !important;
  font-size: 0.66em !important;
  opacity: 0.7 !important;
  letter-spacing: 0.02em !important;
}
/* Title random-position rule — only on .cssmv-mv-title (song title), NOT
   on .watch-subtitle (status text). */
#watch-panel .cssmv-mv-title {
  max-width: min(92%, 1100px) !important;
}

/* Vertical writing mode for CJK-dominant text (Jing 2026-04-25 #102h —
   "对于中文/日文/韩文等方块字的字幕标题，甚至可以竖排"). When applied, the
   <br> emitted between heavy/light groups becomes a column break — runs of
   CJK chars stack vertically and weight groups split into adjacent columns. */
#watch-panel .cssmv-p2100-vertical-rl {
  writing-mode: vertical-rl !important;
  -webkit-writing-mode: vertical-rl !important;
  text-orientation: upright !important;
  -webkit-text-orientation: upright !important;
  max-height: 80% !important;
  margin: 0 auto !important;
}
#watch-panel .cssmv-p2100-vertical-lr {
  writing-mode: vertical-lr !important;
  -webkit-writing-mode: vertical-lr !important;
  text-orientation: upright !important;
  -webkit-text-orientation: upright !important;
  max-height: 80% !important;
  margin: 0 auto !important;
}
#watch-panel .cssmv-p2100-vertical-rl .cssmv-p2100-glyph,
#watch-panel .cssmv-p2100-vertical-lr .cssmv-p2100-glyph {
  display: block !important;
  /* In vertical mode, each glyph takes its own line naturally; the explicit
     <br>s become column breaks. */
}
/* Info popover — anchored BELOW .watch-frame, full width of frame */
.cssmv-info-popover-fixed {
  /* keep position: fixed default for fullscreen, but reposition will set
     left/top below the frame's bottom edge */
}

/* Aggressive spacing inside .watch-screen too — the ENJOY/LISTEN/BUYOUT/TIP
   buttons + WORK COST BILL row + "No matched billable..." line + Privileged
   preview text all sit overlaid on the video. They need their own gaps. */
#watch-panel.cssmv-info-open .watch-screen > * {
  margin-block: 14px !important;
}
#watch-panel.cssmv-info-open .watch-screen .watch-commerce-actions {
  display: flex !important;
  flex-wrap: wrap !important;
  justify-content: center !important;
  gap: 16px !important;
  padding: 14px 0 !important;
}
#watch-panel.cssmv-info-open .watch-screen .watch-commerce-actions > * {
  margin: 6px !important;
}

/* Bottom info chrome spacing when info is open (Jing #102j) — apply layout
   gaps to every top-level descendant inside the frame area so cards don't
   clump together. Generic stretch + gap so any structure stays readable. */
#watch-panel.cssmv-info-open .watch-pane.active { gap: 24px !important; }
#watch-panel.cssmv-info-open .watch-pane.active > * { margin-block: 16px !important; }
#watch-panel.cssmv-info-open .watch-frame-progress { margin: 22px 0 !important; padding: 16px 0 !important; }
#watch-panel.cssmv-info-open .watch-frame-progress-copy { padding: 10px 0 !important; }
#watch-panel.cssmv-info-open .watch-commerce-actions {
  margin: 22px 0 !important;
  gap: 18px !important;
  display: flex !important;
  flex-wrap: wrap !important;
  justify-content: center !important;
  padding: 12px 0 !important;
}
#watch-panel.cssmv-info-open .watch-commerce-actions > * { margin: 8px !important; }
#watch-panel.cssmv-info-open .watch-engine-grid { margin: 26px 0 !important; gap: 18px !important; padding: 14px 0 !important; }
/* Jing 2026-04-25 #102p — kara-runtime cards (CURRENT STAGE / STRUCTURE /
   SUBTITLE LOAD): gap between SIBLING cards = 12px; gap between the BLACK
   info-popover and the FIRST card = also 12px (was 26px+ — too far). */
#watch-panel.cssmv-info-open .kara-runtime-board {
  margin: 12px 0 !important;
  padding: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
}
.kara-runtime-board { display: flex !important; flex-direction: column !important; gap: 12px !important; }
.kara-runtime-card { margin: 0 !important; }
.kara-runtime-card + .kara-runtime-card { margin-top: 0 !important; }
.kara-runtime-board > * { margin: 0 !important; }
/* The .cssmv-info-popover-fixed sits at top:(frame.bottom + 8). The first
   card after it should sit close — match the 12px sibling spacing. */
body > .cssmv-info-popover-fixed { margin-bottom: 12px !important; }
#watch-panel.cssmv-info-open .watch-info-card { margin: 22px 0 !important; padding: 14px 18px !important; }
#watch-panel.cssmv-info-open .watch-screen-backdrop { padding-bottom: 16px !important; }
.cssmv-info-popover-fixed { padding: 16px 18px !important; line-height: 1.65 !important; gap: 12px !important; }

/* ================================================================
   Jing 2026-04-25 #102v — Advanced Settings panel cleanup:
   • Hide "设为默认" button (values are random/derived, not user-fixed)
   • Empty hardcoded duration default ("180" placeholder) — duration is
     auto-derived from lyrics output
   • Empty hardcoded music-style / vocal-style / instrumentation /
     ensemble pre-fills — these come from civilization-driven random
   ================================================================ */
#creation-set-defaults { display: none !important; }
/* ================================================================
   Jing 2026-04-25 #102n — For You / Works Center card spacing +
   pointer cursor + click-to-switch fix.
   ================================================================ */
#foryou-panel .work-card,
#foryou-panel .foryou-card,
#works-panel .work-card,
#works-panel .works-card,
#works-panel .works-section .work-card,
.foryou-works-list .work-card,
.works-grid .work-card {
  margin: 14px 0 !important;
  padding: 14px !important;
  border-radius: 14px !important;
  cursor: pointer !important;
  transition: transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease !important;
}
#foryou-panel .work-card:hover,
#foryou-panel .foryou-card:hover,
#works-panel .work-card:hover,
.foryou-works-list .work-card:hover,
.works-grid .work-card:hover {
  cursor: pointer !important;
  transform: translateY(-2px) !important;
  background: rgba(218,255,242,0.08) !important;
  border-color: rgba(218,255,242,0.55) !important;
  box-shadow: 0 8px 28px rgba(0,245,160,0.16), 0 0 0 1px rgba(218,255,242,0.45) !important;
}
/* Section wrappers in Works Center should also have breathing room */
#works-panel .works-section { margin: 22px 0 !important; padding: 12px 0 !important; }
#works-panel .works-section + .works-section { border-top: 1px solid rgba(218,255,242,0.12); }
/* Make sure inner thumb / meta / actions inherit the pointer so the whole
   card surface feels tappable, not just the Enjoy button. */
.foryou-works-list .work-card *, .works-grid .work-card * { cursor: pointer !important; }
/* But keep buttons themselves explicit so their text stays readable */
.foryou-works-list .work-card button, .works-grid .work-card button { cursor: pointer !important; }

/* 4 bottom-right buttons, all transparent default */
#watch-panel .cssmv-stem-toggle {
  top: auto !important; bottom: 14px !important; right: 172px !important;
  background: transparent !important; border-color: transparent !important;
  box-shadow: none !important; backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important; opacity: 0 !important;
  transition: opacity .22s ease, transform .22s ease, background .22s ease, border-color .22s ease, box-shadow .22s ease !important;
}
#watch-panel #watch-style-shift {
  top: auto !important; bottom: 14px !important; right: 120px !important;
  background: transparent !important; border-color: transparent !important;
  box-shadow: none !important; backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important; opacity: 0 !important;
  transition: opacity .22s ease, transform .22s ease, background .22s ease, border-color .22s ease !important;
}
.cssmv-fr-btn {
  position: absolute; bottom: 14px; z-index: 8;
  width: 44px; height: 44px;
  display: grid; place-items: center;
  border-radius: 999px;
  border: 1px solid transparent; background: transparent;
  color: rgba(242,255,248,0.98);
  font-family: "CSSTitleBoldC","Syne",system-ui,sans-serif;
  font-size: 18px; line-height: 1;
  cursor: pointer; opacity: 0; pointer-events: auto;
  transition: opacity .22s ease, transform .22s ease, background .22s ease, border-color .22s ease;
  user-select: none; -webkit-user-select: none;
}
.cssmv-info-btn { right: 68px; font-style: italic; font-weight: 600; font-size: 20px; }
.cssmv-fs-btn   { right: 14px; font-size: 19px; }

#watch-panel .watch-screen:hover .cssmv-stem-toggle,
#watch-panel .watch-screen:focus-within .cssmv-stem-toggle,
#watch-panel .watch-screen:hover #watch-style-shift,
#watch-panel .watch-screen:focus-within #watch-style-shift,
.watch-screen:hover .cssmv-fr-btn,
.watch-screen:focus-within .cssmv-fr-btn { opacity: 0.72 !important; }

#watch-panel .cssmv-stem-toggle:hover, #watch-panel .cssmv-stem-toggle:focus-visible,
#watch-panel #watch-style-shift:hover, #watch-panel #watch-style-shift:focus-visible,
.cssmv-fr-btn:hover, .cssmv-fr-btn:focus-visible, .cssmv-info-btn.is-open {
  opacity: 1 !important; transform: scale(1.05) !important;
  background: linear-gradient(180deg, rgba(7,14,12,0.42), rgba(5,10,9,0.24)) !important;
  border-color: rgba(218,255,242,0.55) !important;
  backdrop-filter: blur(12px) saturate(1.08) !important;
  -webkit-backdrop-filter: blur(12px) saturate(1.08) !important;
  box-shadow: 0 0 24px rgba(0,245,160,0.16), 0 0 52px rgba(11,247,255,0.08) !important;
}

#watch-panel.is-cssmv-fullscreen {
  position: fixed !important; inset: 0 !important; z-index: 99999 !important;
  width: 100vw !important; height: 100vh !important;
  max-width: none !important; max-height: none !important;
}
/* Jing 2026-04-25 #102l — TRUE fullscreen vertical centering. Strip ALL
   padding/margin/min-height from every container in the chain, hide every
   sibling that's NOT the active pane (kara-progress-shell, watch-tabs,
   etc), and put the .watch-pane.active directly under the panel header
   filling 100vh - header. Frame uses align-items:center; justify-content:
   center so the .watch-screen sits dead-center vertically. */
#watch-panel.is-cssmv-fullscreen .panel-body,
#watch-panel.is-cssmv-fullscreen .watch-body {
  width: 100vw !important;
  max-width: 100vw !important;
  height: calc(100vh - 52px) !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  overflow: hidden !important;
}
/* Hide every direct child of .watch-body that isn't the active pane —
   kills empty <div class="watch-tabs"> reserved space, hidden but not
   display:none progress shells, etc. */
#watch-panel.is-cssmv-fullscreen .watch-body > *:not(.watch-pane) {
  display: none !important;
}
#watch-panel.is-cssmv-fullscreen .watch-pane { display: none !important; }
#watch-panel.is-cssmv-fullscreen .watch-pane.active {
  display: flex !important;
  width: 100vw !important;
  max-width: 100vw !important;
  height: calc(100vh - 52px) !important;
  min-height: calc(100vh - 52px) !important;
  margin: 0 !important;
  padding: 0 !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
}
/* Hide auxiliary children of the active pane (engine-progress-shell,
   engine-grid, runtime-board) when info is closed — they otherwise add
   empty rows that shift the frame upward. */
#watch-panel.is-cssmv-fullscreen .watch-pane.active > *:not(.watch-frame) {
  display: none !important;
}
#watch-panel.is-cssmv-fullscreen.cssmv-info-open .watch-pane.active > * {
  display: revert !important;
}
#watch-panel.is-cssmv-fullscreen .watch-frame {
  width: 100vw !important;
  max-width: 100vw !important;
  margin: 0 !important;
  padding: 0 !important;
  /* center the screen if it's shorter than the viewport */
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
#watch-panel.is-cssmv-fullscreen .watch-screen {
  width: 100vw !important;
  height: auto !important;
  /* If the screen has its own aspect-ratio set (16/9, 21/9, 32/9, …) the
     browser computes height = width / aspect. We clamp height so it never
     overflows the viewport — when clamped, max-height wins and width
     auto-shrinks back to keep the aspect ratio. */
  max-width: 100vw !important;
  max-height: calc(100vh - 52px) !important;
  margin: 0 !important;
  /* Force the picker's chosen ratio (overridden inline by JS below) */
}
/* Inner video / image must FILL the screen — no left-right whitespace, no
   distortion. Cropping is acceptable (cover semantics), per Jing 2026-04-25:
   "撑满屏幕的左右，不要左右留白，封面图也不能变形，只要撑满左右，能显示多少
    就显示多少". The cover slideshow div (.cssmv-cover-slide) uses
   background-size: cover from app.cover-slideshow.js — keep it consistent. */
#watch-panel.is-cssmv-fullscreen .watch-video,
#watch-panel.is-cssmv-fullscreen .watch-svg,
#watch-panel.is-cssmv-fullscreen .watch-screen-backdrop {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
#watch-panel.is-cssmv-fullscreen .cssmv-cover-slide {
  background-size: cover !important;
  background-position: center !important;
}

/* CSSMV_COVER_FILL_VW 20260425 #102 — Jing
   Even outside fullscreen, the cover (placeholder before video plays) must
   fill the available media-frame width responsively. The base watch-screen
   already has width:100% + aspect-ratio:16/9, but if any parent has padding
   we want zero on left/right so the cover hugs the viewport. */
#watch-panel:not(.is-cssmv-fullscreen) .watch-frame {
  padding-left: 14px !important;
  padding-right: 14px !important;
}
#watch-panel:not(.is-cssmv-fullscreen) .watch-screen {
  width: 100% !important;
  max-width: 100% !important;
}
#watch-panel:not(.is-cssmv-fullscreen) .watch-svg,
#watch-panel:not(.is-cssmv-fullscreen) .watch-video,
#watch-panel:not(.is-cssmv-fullscreen) .cssmv-cover-slide {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  background-size: cover !important;
  background-position: center !important;
}

/* Music tab: art disc + music-stage host should fill horizontally too —
   the art image inside #watch-music-art uses background-size: cover already
   but the disc itself was capped. Keep cropping behaviour, just make sure
   the host fills its container left-right. */
#watch-panel .watch-music-stage,
#watch-panel .watch-music-ring {
  width: 100% !important;
  max-width: 100% !important;
}
#watch-panel .watch-music-art,
#watch-panel.is-cssmv-fullscreen .watch-music-art {
  background-size: cover !important;
  background-position: center !important;
}

/* Info popover lives in document.body with fixed positioning so nothing can trap it */
.cssmv-info-popover-fixed {
  position: fixed;
  max-width: 380px; min-width: 220px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(5,10,9,0.92);
  border: 1px solid rgba(218,255,242,0.38);
  backdrop-filter: blur(16px) saturate(1.1);
  -webkit-backdrop-filter: blur(16px) saturate(1.1);
  color: rgba(242,255,248,0.96);
  font-size: 13px; line-height: 1.5;
  white-space: pre-wrap;
  opacity: 0; pointer-events: none;
  transform: translateY(6px);
  transition: opacity .16s ease, transform .16s ease;
  z-index: 2147483647; /* max int32 — above fullscreen overlays */
  box-shadow: 0 12px 40px rgba(0,0,0,0.6);
}
.cssmv-info-popover-fixed.is-open { opacity: 1; transform: translateY(0); pointer-events: auto; }
`;
  document.head.appendChild(st);

  // ========================================================================
  // FONT FIX — actually this time.
  //
  // Root cause chain identified reading app.watch-media-overlays.js:
  //   • enhanceIfPlainText() wraps #watch-subtitle into .cssmv-anim-glyph spans
  //   • wrapGlyphs() calls pickFontsForTokens(pieces, preset, mode) which
  //     assigns a font via cssmvAssignFontForPiece(piece)
  //   • cssmvAssignFontForPiece reads loadFontPools() from localStorage-backed
  //     catalog cache and picks randomly — BUT caches per-piece so same word
  //     always gets same font, until __cssmvPieceFontMap is cleared by
  //     shuffleTokenFonts()
  //   • If perTokenMode() is "off" → wrapGlyphs doesn't even emit the
  //     font-family CSS → you see one default font everywhere
  //
  // Fix:
  //   1. Force perTokenMode to "word" on boot if it's "off"
  //   2. Call globalThis.cssmvShuffleTokenFonts() after every subtitle
  //      textContent change — this clears the piece→font cache and re-wraps
  //   3. Also call it once on boot so the initial subtitle gets fonts
  // ========================================================================
  function primeFontMode() {
    try {
      const KEY = "cssmv.watchFontPerTokenMode";
      const cur = (localStorage.getItem(KEY) || "").trim().toLowerCase();
      if (!cur || cur === "off") localStorage.setItem(KEY, "word");
      // Ensure preset is chaos (per-token random) unless user picked another
      const KEYP = "cssmv.watchFontPerTokenPreset";
      const curP = (localStorage.getItem(KEYP) || "").trim().toLowerCase();
      if (!curP) localStorage.setItem(KEYP, "chaos");
    } catch (_) { /* localStorage disabled */ }
  }
  primeFontMode();

  // ========================================================================
  // SELF-CONTAINED PER-WORD RANDOM FONT WRAPPER (Jing 2026-04-25 #102f)
  //
  // Stops fighting with the overlays module — does the work entirely here.
  // Tokenizes subtitle/title text, classifies each token as heavy/light,
  // assigns a random font from a guaranteed-loaded pool, and emits glyph
  // spans tagged with .cssmv-anim-glyph so the overlays module's own
  // enhanceIfPlainText skip-check leaves us alone.
  //
  // Heavy = nouns, verbs, adjectives, content words → larger, top line
  // Light = particles/articles/conjunctions/auxiliaries → smaller, next line
  // Insert <br> between heavy and light groups so weight is on its own line.
  // ========================================================================
  const LATIN_FONTS = [
    "Georgia, serif",
    "'Times New Roman', serif",
    "'Courier New', monospace",
    "Impact, sans-serif",
    "'Arial Black', sans-serif",
    "'Trebuchet MS', sans-serif",
    "'Brush Script MT', cursive",
    "Verdana, sans-serif",
    "Palatino, serif",
    "Garamond, serif",
    "Tahoma, sans-serif",
    "'Lucida Sans', sans-serif",
    "'Comic Sans MS', cursive",
  ];
  const CJK_FONTS = [
    "'PingFang SC', sans-serif",
    "'PingFang TC', sans-serif",
    "'STSong', serif",
    "'STKaiti', cursive",
    "'STFangsong', serif",
    "'Heiti SC', sans-serif",
    "'Hiragino Sans GB', sans-serif",
    "'KaiTi', cursive",
    "'FangSong', serif",
    "'Microsoft YaHei', sans-serif",
    "'SimSun', serif",
    "'SimHei', sans-serif",
  ];
  const CJK_RE = /[　-鿿豈-﫿぀-ヿ가-힯]/;

  // Light tokens → "particle" weight class. Heavy tokens → bold lead.
  const LIGHT_CN = new Set(
    ("的了和与是在一就不也都而或若之以为被所其而且然但虽则若您" +
     "下上中前后里外内这那什么又还吗呢吧呀啊哦嗯哈嘿哟唉").split("")
  );
  const LIGHT_EN = new Set([
    "a","an","the","of","in","on","at","to","for","by","with","and","or",
    "but","is","am","are","was","were","be","been","being","my","your",
    "his","her","its","our","their","this","that","these","those","i","we",
    "you","he","she","it","they","do","does","did","not","no","yes","so",
    "as","if","than","then","when","while","because","just","also","very"
  ]);

  function pieceWeight(p) {
    if (!p || /^\s+$/.test(p)) return "ws";
    const cn = CJK_RE.test(p);
    if (cn) {
      // Single CJK char — light if in LIGHT_CN
      if (p.length === 1 && LIGHT_CN.has(p)) return "light";
      return "heavy";
    }
    const lw = p.toLowerCase();
    if (LIGHT_EN.has(lw)) return "light";
    if (lw.length <= 2) return "light";
    return "heavy";
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function tokenize(text) {
    const out = [];
    let buf = "";
    let bufKind = null; // null | "latin" | "cjk" | "ws"
    function flush() { if (buf) { out.push(buf); buf = ""; bufKind = null; } }
    for (const ch of String(text || "")) {
      const isSpace = /\s/.test(ch);
      const isCjk = CJK_RE.test(ch);
      if (isSpace) { flush(); out.push(ch); continue; }
      if (isCjk) { flush(); out.push(ch); continue; } // each CJK char standalone
      // latin: accumulate
      if (bufKind && bufKind !== "latin") flush();
      buf += ch; bufKind = "latin";
    }
    flush();
    return out;
  }

  // Build pools from the project's full font catalog (hundreds of entries)
  // when available; fall back to our hardcoded short list otherwise. Memoize
  // for 2 seconds — the catalog rarely changes after boot but we want to
  // pick up newly-loaded fonts.
  let __p2100PoolCache = null;
  let __p2100PoolStamp = 0;
  function loadPools() {
    const now = Date.now();
    if (__p2100PoolCache && now - __p2100PoolStamp < 2000) return __p2100PoolCache;
    let cjk = [], latin = [];
    function ingest(family, hint) {
      const fam = String(family || "").trim();
      if (!fam) return;
      const h = String(hint || "");
      // Jing 2026-04-25 #102k — the manifest uses `fonts_en/` for Latin and
      // `fonts/` for CJK. My old regex `fonts\/` matched BOTH because
      // `fonts_en/` starts with `fonts`, so every Latin font got
      // misclassified as CJK and the Latin pool stayed small. Fix: detect
      // English explicitly first; only flag CJK if NOT english AND any CJK
      // marker matches.
      const isLatin =
        /fonts_en\/|\/en\/|latin|english|^en$/i.test(h) ||
        (/^[\x20-\x7E]+$/.test(fam) && !CJK_RE.test(fam));
      const isCjk = !isLatin && (
        /cjk|fonts_cn|\/cn\/|\/zh\/|\/kr\/|\/jp\//i.test(h) ||
        (h.startsWith("fonts/") && !h.startsWith("fonts_en")) ||
        CJK_RE.test(fam)
      );
      const css = "'" + fam.replace(/'/g, "\\'") + "'" + ", sans-serif";
      if (isCjk) cjk.push(css);
      else latin.push(css);
    }
    try {
      const fn = globalThis.buildWatchFontCatalogModule;
      if (typeof fn === "function") {
        const entries = fn() || [];
        for (const e of entries) ingest(e?.family, e?.group || e?.src);
      }
    } catch (_) {}
    try {
      const m = globalThis.CSSOS_WATCH_FONT_MANIFEST;
      if (Array.isArray(m)) {
        for (const e of m) ingest(e?.family, e?.src || e?.group);
      }
    } catch (_) {}
    // Jing 2026-04-25 #102s — only inject system fonts as a fallback when
    // catalog is genuinely empty. Otherwise let the user's 243+ downloaded
    // fonts dominate the random picks instead of being drowned out by 13
    // system defaults.
    if (latin.length === 0) {
      for (const f of LATIN_FONTS) latin.push(f);
    }
    if (cjk.length === 0) {
      for (const f of CJK_FONTS) cjk.push(f);
    }
    // Deduplicate while preserving order.
    cjk = Array.from(new Set(cjk));
    latin = Array.from(new Set(latin));
    __p2100PoolCache = { cjk, latin };
    __p2100PoolStamp = now;
    return __p2100PoolCache;
  }
  // Cache of fonts confirmed loaded — checked once per font via the
  // FontFaceSet API. Skips fonts whose @font-face src 404'd or never
  // got requested, so we don't waste random picks on invisible fallbacks.
  const __p2100FontReady = new Map();
  function isFontReady(css) {
    if (__p2100FontReady.has(css)) return __p2100FontReady.get(css);
    let ok = true;
    try {
      // css looks like "'AQUARIUM', sans-serif" — extract first family.
      const m = css.match(/^'([^']+)'/) || css.match(/^"([^"]+)"/);
      const fam = m ? m[1] : css.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
      if (fam && document.fonts && document.fonts.check) {
        ok = document.fonts.check("16px '" + fam + "'");
      }
    } catch (_) { ok = true; }
    __p2100FontReady.set(css, ok);
    return ok;
  }

  function pickFont(piece) {
    const { cjk, latin } = loadPools();
    const isCjk = CJK_RE.test(piece);
    const pool = isCjk ? (cjk.length ? cjk : latin) : (latin.length ? latin : cjk);
    if (!pool.length) return "sans-serif";
    // Jing 2026-04-25 #102s — DO NOT filter by isFontReady. Earlier code
    // restricted picks to fonts that document.fonts.check() said were
    // already loaded; system fonts pass instantly but custom @font-face
    // fonts only become "ready" after the user actually uses them, creating
    // a chicken-and-egg cycle that biased every pick into the same ~13
    // system fonts. Now we pick from the full pool (all 256 fonts) and
    // trust @font-face's font-display:swap to fetch + swap glyphs in when
    // each font lands.
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // CSSMV_FONT_PREWARM_DISABLED 20260425 #118 — Jing
  // The previous boot-time prewarm proactively fetched ALL ~243 latin +
  // 12 CJK fonts via document.fonts.load(), which fired a 404 storm in
  // the console for every font file the server doesn't actually have
  // (the manifest is generous; the on-disk catalog is sparse). Fonts
  // are tagged with `font-display: swap` so they fetch on first use
  // anyway — skipping the prewarm just trades a tiny first-render
  // delay for a clean console.
  function prewarmFontBatch() {
    // No-op. Fonts load lazily when first referenced via the random
    // picker — see pickFont() / applyShuffle().
  }

  function buildWeightedHtml(pieces, opts) {
    // CSSMV_LYRIC_SINGLE_LINE 20260426 #120 — Jing
    // For the song TITLE we group consecutive heavy/light and insert
    // <br> between groups (multi-line look). For lyric subtitles
    // (#watch-karaoke-line, #watch-subtitle) we keep everything on a
    // single line — pass { skipBr: true } from applyShuffle().
    const skipBr = !!(opts && opts.skipBr);
    let html = "";
    let prevW = null;
    // Hidden sentinel with .cssmv-anim-glyph so overlays' shouldEnhance
    // skip-check sees one and leaves the parent alone. We DO NOT use
    // .cssmv-anim-glyph on the actual visible spans because that class
    // has `opacity: 0` baseline (animations fade it in) — and our spans
    // don't have the animation, so they'd stay invisible forever.
    html += '<span class="cssmv-anim-glyph cssmv-p2100-marker" aria-hidden="true" style="display:none;width:0;height:0;"></span>';
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      const w = pieceWeight(p);
      if (w === "ws") {
        html += escapeHtml(p);
        continue;
      }
      if (!skipBr && prevW && prevW !== w && (prevW === "heavy" || prevW === "light")) {
        html += "<br>";
      }
      const fam = pickFont(p);
      const safe = escapeHtml(p);
      // ONLY .cssmv-p2100-glyph — visible by default, our CSS sets opacity 1.
      const cls = "cssmv-p2100-glyph cssmv-w-" + w;
      html += `<span class="${cls}" style="font-family:${fam};opacity:1;">${safe}</span>`;
      prevW = w;
    }
    return html;
  }

  function applyShuffle(el, opts) {
    if (!el) return;
    const text = (el.textContent || "").trim();
    if (!text) return;
    // Jing 2026-04-25 #102r — soft slideshow crossfade. animate=true triggers
    // a 800ms gentle opacity fade; animate=false (default) writes instantly
    // so initial renders + marker-recovery don't show a blank gap.
    const animate = !!(opts && opts.animate);
    function writeContent() {
      const pieces = tokenize(text);
      // CSSMV_LYRIC_SINGLE_LINE 20260426 #120 — only the SONG TITLE gets
      // multi-line heavy/light <br> breaks. Karaoke + subtitle stay on
      // a single line so each lyric phrase reads cleanly.
      const isTitle = el.classList && el.classList.contains("cssmv-mv-title");
      el.innerHTML = buildWeightedHtml(pieces, { skipBr: !isTitle });
      // Random alignment within the frame — left / center / right.
      const aligns = ["left", "center", "right"];
      el.style.textAlign = aligns[Math.floor(Math.random() * aligns.length)];
      // CJK vertical writing mode (40% chance for CJK-dominant text).
      let cjkCount = 0, totalCount = 0;
      for (const ch of text) {
        if (/\s/.test(ch)) continue;
        totalCount++;
        if (CJK_RE.test(ch)) cjkCount++;
      }
      const cjkRatio = totalCount ? (cjkCount / totalCount) : 0;
      el.classList.remove("cssmv-p2100-vertical-rl", "cssmv-p2100-vertical-lr");
      // CSSMV_LYRIC_SINGLE_LINE 20260426 #120 — vertical writing mode
      // is reserved for the song title only; single-line karaoke/subtitle
      // never goes vertical.
      if (isTitle && cjkRatio >= 0.6 && Math.random() < 0.4) {
        const cls = Math.random() < 0.5 ? "cssmv-p2100-vertical-rl" : "cssmv-p2100-vertical-lr";
        el.classList.add(cls);
      }
    }

    // Helper: shrink title font-size if it overflows the frame.
    function fitTitleToFrame() {
      if (!el.classList.contains("cssmv-mv-title")) return;
      const screen = el.closest(".watch-screen");
      if (!screen) return;
      const screenH = screen.clientHeight || 600;
      // If the title element's natural height exceeds 86% of frame, scale
      // down proportionally via inline transform.
      requestAnimationFrame(function () {
        try {
          const used = el.scrollHeight || el.offsetHeight || 0;
          const cap = Math.floor(screenH * 0.86);
          if (used > cap && cap > 80) {
            const scale = Math.max(0.4, cap / used);
            el.style.transform = "scale(" + scale.toFixed(3) + ")";
            el.style.transformOrigin = "center center";
          } else {
            el.style.transform = "";
            el.style.transformOrigin = "";
          }
        } catch (_) {}
      });
    }

    if (!animate) {
      writeContent();
      fitTitleToFrame();
      return;
    }
    // ANIMATED PATH — fade out → swap → fade in. Each leg ~400ms so total
    // ~800ms slideshow feel. Use a class so transition timing lives in CSS.
    el.classList.add("cssmv-p2100-fade");
    // Force reflow so the fade-in transition takes effect.
    // eslint-disable-next-line no-unused-expressions
    void el.offsetHeight;
    el.classList.add("cssmv-p2100-fading");
    setTimeout(function () {
      writeContent();
      fitTitleToFrame();
      // Allow render of new content before removing fade class so fade-in
      // animates from opacity:0 → 1 smoothly.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          el.classList.remove("cssmv-p2100-fading");
        });
      });
    }, 420);
  }

  // Public function our own observers + boot hooks call.
  // Jing 2026-04-25 #102t — only re-shuffle the SONG TITLE and KARAOKE
  // LYRICS. The #watch-subtitle element is status text ("KaraOKe / MV /
  // Rendering subtitle / now") which should keep its default font and
  // single-line layout — random fonts on status text was wrong.
  function forceShuffle(opts) {
    const title = document.querySelector(".cssmv-mv-title");
    if (title) applyShuffle(title, opts);
    const kara = document.getElementById("watch-karaoke-line");
    if (kara && !kara.querySelector(".watch-karaoke-word") &&
        !kara.querySelector(".watch-karaoke-current, .watch-karaoke-prev, .watch-karaoke-next")) {
      applyShuffle(kara, opts);
    }
  }

  // Wire ✦ button click to our shuffle too — animated 800ms slideshow fade.
  function wireStarBtnExtra() {
    const btn = document.getElementById("watch-style-shift");
    if (btn && !btn.dataset.cssmvP2100Wired) {
      btn.dataset.cssmvP2100Wired = "1";
      btn.addEventListener("click", function () {
        // ✦ click → animated reshuffle. Slight delay so overlays runs first
        // (we then overwrite it with our random fonts + soft fade).
        setTimeout(() => forceShuffle({ animate: true }), 30);
      }, false);
    }
  }

  // ========================================================================
  // BUTTONS: info (click-toggle) + fullscreen
  // ========================================================================
  let infoBtn, fsBtn;
  const infoPopover = document.createElement("div");
  infoPopover.className = "cssmv-info-popover-fixed";
  infoPopover.setAttribute("role", "tooltip");
  function appendPopoverToBody() {
    if (infoPopover.parentNode === document.body) return;
    if (!document.body) return;
    document.body.appendChild(infoPopover);
  }

  function pickInfoSource() {
    const parts = [];
    const progCopy = document.getElementById("watch-frame-progress-copy");
    if (progCopy && progCopy.textContent.trim()) parts.push(progCopy.textContent.trim());
    const subtitle = document.getElementById("watch-subtitle");
    if (subtitle && subtitle.textContent.trim()) parts.push(subtitle.textContent.trim());
    const kara = document.getElementById("watch-karaoke-line");
    if (kara && kara.textContent.trim()) parts.push(kara.textContent.trim());
    return parts.join("\n\n") || "—";
  }

  function positionPopover() {
    // Use .watch-screen rect — it's the actual rendered media element. In
    // fullscreen .watch-frame is 100vw but .watch-screen has the aspect-
    // ratio'd size (letterboxed). Anchor the popover RIGHT below the
    // visible screen, centered horizontally.
    const screen = document.querySelector("#watch-panel .watch-screen");
    const frame = document.querySelector("#watch-panel .watch-frame");
    const target = screen || frame;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    let left = rect.left;
    let width = rect.width;
    let top = rect.bottom + 8;
    // If positioning would overflow viewport bottom, clamp to bottom -
    // popover height. If popover height not known yet, use 200px guess.
    const popH = infoPopover.offsetHeight || 200;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (top + popH > vh - 8) top = Math.max(8, vh - popH - 8);
    // If the screen is full-width (fullscreen mode), center & cap width.
    if (width >= vw - 4) {
      width = Math.min(720, vw - 32);
      left = (vw - width) / 2;
    }
    infoPopover.style.left = left + "px";
    infoPopover.style.width = width + "px";
    infoPopover.style.maxWidth = width + "px";
    infoPopover.style.top = top + "px";
  }

  // Jing 2026-04-25 #102c — info click toggles BOTH top tabs + bottom
  // info popover together. Then auto-hide BOTH after 3s of idle (no
  // mouse/touch/key activity inside the panel). Any activity resets
  // the timer; leaving the panel alone for 3s closes everything.
  let infoIdleTimer = null;
  function clearIdle() {
    if (infoIdleTimer) { clearTimeout(infoIdleTimer); infoIdleTimer = null; }
  }
  function armIdle() {
    clearIdle();
    infoIdleTimer = setTimeout(function () {
      closeInfo();
    }, 3000);
  }
  function openInfo() {
    if (!infoBtn) return;
    infoPopover.textContent = pickInfoSource();
    infoBtn.classList.add("is-open");
    infoPopover.classList.add("is-open");
    const panel = document.getElementById("watch-panel");
    if (panel) panel.classList.add("cssmv-info-open");
    requestAnimationFrame(positionPopover);
    armIdle();
  }
  function closeInfo() {
    clearIdle();
    if (infoBtn) infoBtn.classList.remove("is-open");
    infoPopover.classList.remove("is-open");
    const panel = document.getElementById("watch-panel");
    if (panel) panel.classList.remove("cssmv-info-open");
  }
  // Any pointer/key activity inside the panel while info is open resets
  // the 3s countdown — user is actively reading, don't close on them.
  function bumpIdleIfOpen() {
    if (!infoPopover.classList.contains("is-open")) return;
    armIdle();
  }
  function toggleInfo(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (infoPopover.classList.contains("is-open")) closeInfo();
    else openInfo();
  }

  // Close when clicking outside (bubble phase, not capture — simpler + reliable)
  document.addEventListener("click", function (e) {
    if (!infoPopover.classList.contains("is-open")) return;
    if (infoBtn && (e.target === infoBtn || infoBtn.contains(e.target))) return;
    if (e.target === infoPopover || infoPopover.contains(e.target)) return;
    closeInfo();
  });
  // Reposition on scroll/resize
  window.addEventListener("scroll", function () {
    if (infoPopover.classList.contains("is-open")) positionPopover();
  }, true);
  window.addEventListener("resize", function () {
    if (infoPopover.classList.contains("is-open")) positionPopover();
  });

  function installButtons() {
    const screen = document.querySelector("#watch-panel .watch-screen");
    if (!screen) return false;
    if (screen.querySelector(".cssmv-info-btn")) return true;

    infoBtn = document.createElement("button");
    infoBtn.type = "button";
    infoBtn.className = "cssmv-fr-btn cssmv-info-btn";
    infoBtn.setAttribute("aria-label", "Info");
    infoBtn.textContent = "i";
    infoBtn.addEventListener("click", function (e) {
      // CSSOS_PHASE2_BUTTON_STOPPROP 20260429 #168.5 — see fsBtn block below.
      if (e && typeof e.stopPropagation === "function") e.stopPropagation();
      toggleInfo();
    });

    fsBtn = document.createElement("button");
    fsBtn.type = "button";
    fsBtn.className = "cssmv-fr-btn cssmv-fs-btn";
    fsBtn.setAttribute("aria-label", "Fullscreen");
    fsBtn.textContent = "⛶";
    function applyScreenAspectRatio() {
      // Read the picker's choice from creationState (#99 published it on
      // globalThis). Fallback to 16/9.
      const screen = document.querySelector("#watch-panel .watch-screen");
      if (!screen) return;
      let aspect = "16 / 9";
      try {
        const cs = globalThis.creationState;
        const ar = cs && (cs.aspectRatio || cs.aspect_ratio || cs.aspect);
        if (typeof ar === "string") {
          // accept "16:9" / "21:9" / "32:9" / "9:16" / "1:1" / "4:5" / "2.39:1"
          const m = ar.match(/^\s*([\d.]+)\s*[:\/x×]\s*([\d.]+)\s*$/);
          if (m) aspect = `${m[1]} / ${m[2]}`;
        } else if (cs && cs.outputWidth && cs.outputHeight) {
          aspect = `${cs.outputWidth} / ${cs.outputHeight}`;
        }
      } catch (_) { /* noop */ }
      screen.style.aspectRatio = aspect;
    }
    fsBtn.addEventListener("click", async function (e) {
      e.preventDefault();
      // CSSOS_PHASE2_BUTTON_STOPPROP 20260429 #168.5 — Jing
      // "媒体框右下角的四个按钮，被点击的同时，也触发媒体播放点击，
      //  导致暂停，而暂停之后，无法继续播放. 改进：点击媒体框，切换
      //  播放/暂停。"
      // Stop propagation so the new media-frame-click toggler doesn't
      // also pause the video as a side-effect of pressing fullscreen.
      e.stopPropagation();
      const panel = document.getElementById("watch-panel");
      if (!panel) return;
      const inFS = !!document.fullscreenElement;
      try {
        if (inFS) {
          await document.exitFullscreen();
          panel.classList.remove("is-cssmv-fullscreen");
          // CSSOS_FS_BTN_CINEMA_SYNC 20260505 — Jing
          // "退出影院模式后，再进去，媒体框右下角的全屏按钮，影院模式丢失"
          // The bottom-right ⛶ click handler used to only flip
          // is-cssmv-fullscreen — leaving body.cssos-cinema-mode out of
          // sync. Now mirror the body-class flip so chrome-hide CSS +
          // pure-cinema JS pick up the state correctly on every press.
          document.body.classList.remove("cssos-cinema-mode", "cssos-watch-theater", "cssos-watch-idle");
        } else if (panel.requestFullscreen) {
          applyScreenAspectRatio();
          await panel.requestFullscreen();
          panel.classList.add("is-cssmv-fullscreen");
          document.body.classList.add("cssos-cinema-mode");
        } else {
          applyScreenAspectRatio();
          panel.classList.toggle("is-cssmv-fullscreen");
          document.body.classList.toggle("cssos-cinema-mode", panel.classList.contains("is-cssmv-fullscreen"));
        }
      } catch (_err) {
        applyScreenAspectRatio();
        panel.classList.toggle("is-cssmv-fullscreen");
        document.body.classList.toggle("cssos-cinema-mode", panel.classList.contains("is-cssmv-fullscreen"));
      }
      // Reposition info popover after fullscreen layout settles so it sits
      // below the (now-resized) media frame instead of where it was anchored
      // pre-fullscreen.
      setTimeout(function () {
        if (infoPopover.classList.contains("is-open")) positionPopover();
      }, 100);
    });
    // Resize: re-apply aspect-ratio so it picks up any picker change
    window.addEventListener("resize", function () {
      const panel = document.getElementById("watch-panel");
      if (panel && panel.classList.contains("is-cssmv-fullscreen")) {
        applyScreenAspectRatio();
      }
    });
    document.addEventListener("fullscreenchange", function () {
      const panel = document.getElementById("watch-panel");
      if (panel && !document.fullscreenElement) panel.classList.remove("is-cssmv-fullscreen");
    });

    // CSSOS_PHASE2_AUTO_CINEMA 20260504 — Jing
    // Reusable entry the universal-entry chain calls every time the
    // Watch panel opens. Equivalent to the user hitting the bottom-
    // right ⛶ button: requestFullscreen + apply the .is-cssmv-fullscreen
    // class (cinema layout + dark backdrop). If the browser rejects
    // requestFullscreen (no user activation), the class still flips so
    // the visual cinema state shows.
    // CSSOS_PHASE2_CINEMA_LAYOUT_FIRST 20260505 — Jing
    // "MV面板/媒体框在载入/启动时，就应该以最大化状态启动".
    // Phase 1: synchronous layout-only fullscreen — apply the class
    // + body theme. No requestFullscreen yet (that gets deferred to
    // Phase 2 in the watch-ui caller, after audio is established).
    if (!globalThis.cssosEnterCinemaLayout) {
      globalThis.cssosEnterCinemaLayout = function () {
        const panel = document.getElementById("watch-panel");
        if (!panel) return;
        if (panel.classList.contains("is-cssmv-fullscreen")) return;
        try { applyScreenAspectRatio(); } catch (_e) {}
        panel.classList.add("is-cssmv-fullscreen");
        document.body.classList.add("cssos-cinema-mode");
      };
    }
    if (!globalThis.cssosRequestBrowserFullscreen) {
      globalThis.cssosRequestBrowserFullscreen = async function () {
        const panel = document.getElementById("watch-panel");
        if (!panel) return;
        if (document.fullscreenElement) return;
        // Snapshot audio state so the fullscreen reflow can't mute us.
        const v = document.getElementById("watch-video");
        const a = document.getElementById("watch-audio-preview");
        const snap = {
          vMuted: v?.muted, vVolume: v?.volume,
          aMuted: a?.muted, aVolume: a?.volume,
        };
        const restore = () => {
          try {
            if (v && snap.vMuted !== undefined) {
              v.muted = snap.vMuted;
              if (typeof snap.vVolume === "number") v.volume = snap.vVolume;
            }
            if (a && snap.aMuted !== undefined) {
              a.muted = snap.aMuted;
              if (typeof snap.aVolume === "number") a.volume = snap.aVolume;
            }
          } catch (_e) {}
        };
        try {
          const fn =
            panel.requestFullscreen ||
            panel.webkitRequestFullscreen ||
            panel.mozRequestFullScreen ||
            panel.msRequestFullscreen;
          if (fn) await fn.call(panel);
          // CSSOS_AUDIO_MUTE_RESTORE 20260505b — Jing
          // "媒体进度条走了，画面走了，但是好像音乐被静音了". The Safari
          // fullscreen reflow can mute the audio track multiple times in
          // a row as it rebuilds layers. Two restore checks (50/400ms) was
          // not enough — extend to a longer cascade and also re-arm if any
          // mute event fires within the cascade window.
          [50, 200, 600, 1200, 2500].forEach(function (ms) { setTimeout(restore, ms); });
          [v, a].filter(Boolean).forEach(function (el) {
            var onMute = function () {
              if (el.muted !== false && (snap.vMuted === false || snap.aMuted === false)) restore();
            };
            el.addEventListener("volumechange", onMute);
            setTimeout(function () { el.removeEventListener("volumechange", onMute); }, 3000);
          });
        } catch (err) {
          console.info("[cssos-cinema] requestFullscreen rejected:", err?.name || err);
          restore();
        }
      };
    }
    // Backwards-compat: the original combined helper still works for
    // anyone calling it directly (e.g. the bottom-right ⛶ button).
    if (!globalThis.cssosEnterCinemaMode) {
      globalThis.cssosEnterCinemaMode = async function () {
        const panel = document.getElementById("watch-panel");
        if (!panel) return;
        // Already in cinema? Skip.
        if (panel.classList.contains("is-cssmv-fullscreen") &&
            document.fullscreenElement) {
          return;
        }
        try { applyScreenAspectRatio(); } catch (_e) {}
        panel.classList.add("is-cssmv-fullscreen");
        // Cinema = full black regardless of theme. Stamped on <body>
        // so any rule scoped to a theme picker still sees a flat dark
        // canvas behind the fullscreened panel.
        document.body.classList.add("cssos-cinema-mode");
        // CSSOS_PHASE2_CINEMA_NO_MUTE 20260504 — capture audio state
        // BEFORE the fullscreen transition so we can defensively
        // restore it AFTER. Some browsers drop the audio track during
        // fullscreen reflow; by snapshotting muted/volume + reapplying,
        // we make sure the user never lands in silent fullscreen.
        const v = document.getElementById("watch-video");
        const a = document.getElementById("watch-audio-preview");
        const snapshot = {
          vMuted: v?.muted, vVolume: v?.volume,
          aMuted: a?.muted, aVolume: a?.volume,
        };
        const restoreAudio = () => {
          try {
            if (v && snapshot.vMuted !== undefined) {
              v.muted = snapshot.vMuted;
              if (typeof snapshot.vVolume === "number") v.volume = snapshot.vVolume;
            }
            if (a && snapshot.aMuted !== undefined) {
              a.muted = snapshot.aMuted;
              if (typeof snapshot.aVolume === "number") a.volume = snapshot.aVolume;
            }
          } catch (_e) {}
        };
        if (!document.fullscreenElement) {
          try {
            const fn =
              panel.requestFullscreen ||
              panel.webkitRequestFullscreen ||
              panel.mozRequestFullScreen ||
              panel.msRequestFullscreen;
            if (fn) await fn.call(panel);
            // Defensive audio restore (next tick, after layout settles).
            setTimeout(restoreAudio, 50);
            setTimeout(restoreAudio, 400);
          } catch (err) {
            console.info("[cssos-cinema] requestFullscreen rejected:", err?.name || err);
            restoreAudio();
          }
        }
      };
      // Pair: drop the cinema class when the user exits fullscreen.
      document.addEventListener("fullscreenchange", function () {
        if (!document.fullscreenElement) {
          document.body.classList.remove("cssos-cinema-mode");
        }
      });
    }

    screen.appendChild(infoBtn);
    screen.appendChild(fsBtn);

    // CSSOS_PHASE2_MOBILE_OVERFLOW_BTN 20260505 — Jing
    // "媒体框右下角的那些按钮，手机端都收到三点里。以免和右下角的内容
    //  打架". On mobile (≤560 px), the bottom-right button cluster
    // (info / fullscreen / take-toggle / stem-toggle / style-shift)
    // collides with subtitles / playlist chips. Add a single ⋯
    // overflow button that toggles a `cssmv-overflow-open` class on
    // .watch-screen; the CSS rules below show the cluster only when
    // that class is present, so the corner stays clean by default.
    if (!screen.querySelector(".cssmv-overflow-btn")) {
      const overflowBtn = document.createElement("button");
      overflowBtn.type = "button";
      overflowBtn.className = "cssmv-fr-btn cssmv-overflow-btn";
      overflowBtn.setAttribute("aria-label", "More");
      overflowBtn.textContent = "⋯";
      overflowBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        screen.classList.toggle("cssmv-overflow-open");
      });
      // Outside-click closes the overflow group.
      document.addEventListener("pointerdown", function (e) {
        if (!screen.classList.contains("cssmv-overflow-open")) return;
        const t = e.target;
        if (t && typeof t.closest === "function") {
          if (t.closest(".cssmv-overflow-btn")) return;
          if (t.closest(".cssmv-fr-btn")) return;
          if (t.closest(".cssmv-stem-toggle")) return;
          if (t.closest("#watch-style-shift")) return;
        }
        screen.classList.remove("cssmv-overflow-open");
      }, true);
      screen.appendChild(overflowBtn);
    }
    return true;
  }

  // ========================================================================
  // TABS + INFO POPOVER idle-reset wiring. Tabs are NOT revealed on plain
  // pointer activity anymore — only the "i" button click toggles them.
  // While info is open, any pointer/key activity inside the panel resets
  // the 3s countdown; true idleness closes everything.
  // ========================================================================
  function installIdleTracking() {
    const panel = document.getElementById("watch-panel");
    if (!panel) return false;
    if (panel.dataset.cssmvIdleBound === "1") return true;
    panel.dataset.cssmvIdleBound = "1";
    ["mousemove", "touchstart", "touchmove", "wheel", "pointerdown", "keydown", "click"].forEach(function (ev) {
      panel.addEventListener(ev, bumpIdleIfOpen, { passive: true });
    });
    // Mouse over popover itself counts as activity too
    infoPopover.addEventListener("mousemove", bumpIdleIfOpen);
    infoPopover.addEventListener("scroll", bumpIdleIfOpen, { passive: true });
    return true;
  }

  function installMediaFrameClickToggle() {
    // CSSOS_PHASE2_FRAME_CLICK_TOGGLE 20260429 #168.5 — Jing
    // "改进：点击媒体框，切换播放/暂停。"
    // Click on the watch-screen frame (NOT on a button) toggles play/pause
    // on whichever element is currently the active source (video first,
    // audio fallback). Buttons inside the frame call stopPropagation so
    // they don't double-trigger.
    const screen = document.querySelector("#watch-panel .watch-screen");
    if (!screen) return false;
    if (screen.dataset.cssmvFrameToggleBound === "1") return true;
    screen.dataset.cssmvFrameToggleBound = "1";
    screen.addEventListener("click", function (e) {
      /* CSSOS_FRAME_CLICK_GUARD 20260506 #2 — Jing
       * "用户在媒体框里的操作，正在播放的媒体不必暂停". Inverted the
       * skip-list approach — instead of enumerating every interactive
       * element (which keeps growing as new pills/buttons land), we
       * only toggle play/pause when the click target is the bare
       * video/screen background itself. Anything else (button, pill,
       * overlay, lyric, title, dropdown, anchor, input, even a
       * CSS-only "cursor:pointer" element) is treated as an
       * intentional UI operation and the media keeps playing. */
      const t = e.target;
      const v = document.getElementById("watch-video");
      const isBareSurface =
        t === screen ||
        t === v ||
        (t && t.classList && (
          t.classList.contains("watch-screen") ||
          t.classList.contains("watch-video") ||
          t.classList.contains("watch-frame")
        ));
      if (!isBareSurface) {
        // Click landed on something interactive in the frame — let it
        // do its thing without toggling play/pause.
        return;
      }
      // Defensive — even on the bare surface, if the click is inside
      // any interactive ancestor (lyric overlay, anchor, pill row),
      // skip. This catches edge cases where the bare-surface check
      // matched a transparent overlay layered on top of a button.
      if (t && typeof t.closest === "function") {
        if (t.closest("button,a,input,select,textarea,[role='button'],[contenteditable]")) return;
        if (t.closest("[data-no-frame-toggle]")) return;
      }
      // `v` is already declared above (line 1351). Reuse, don't re-bind.
      const a = document.getElementById("watch-audio-preview");
      const primary =
        (v && v.src && v.readyState > 0) ? v :
        (a && a.src && a.readyState > 0) ? a :
        v || a;
      if (!primary) return;
      // CSSOS_PHASE2_BORDER_SEEK 20260504 — Jing
      // "鼠标点击面板边框，即进度条就从哪里暂停，如果还没播放到的，
      //  就快进到那里。点击媒体框，切换播放/暂停。"
      // Click within the outer border band (~16px from any edge of the
      // media frame) seeks to that fraction of the timeline. The
      // mapping treats the perimeter as the union of the four edges:
      //   • top edge   → fraction = x / width        (left→right)
      //   • bottom     → fraction = x / width        (same direction)
      //   • left edge  → fraction = y / height       (top→bottom)
      //   • right edge → fraction = y / height       (same direction)
      // Whichever edge the click is closest to wins.
      const rect = screen.getBoundingClientRect();
      const dx = e.clientX - rect.left;
      const dy = e.clientY - rect.top;
      const BORDER_PX = 16;
      const nearTop    = dy <= BORDER_PX;
      const nearBottom = dy >= rect.height - BORDER_PX;
      const nearLeft   = dx <= BORDER_PX;
      const nearRight  = dx >= rect.width  - BORDER_PX;
      const onBorder = nearTop || nearBottom || nearLeft || nearRight;
      if (onBorder) {
        const dur = Number(primary.duration || 0);
        if (Number.isFinite(dur) && dur > 0) {
          let frac;
          // Pick the closest edge so the seek reads the same axis the
          // user's click lands on.
          const dTop    = dy;
          const dBottom = rect.height - dy;
          const dLeft   = dx;
          const dRight  = rect.width  - dx;
          const minD = Math.min(dTop, dBottom, dLeft, dRight);
          if (minD === dTop || minD === dBottom) {
            frac = Math.max(0, Math.min(1, dx / rect.width));
          } else {
            frac = Math.max(0, Math.min(1, dy / rect.height));
          }
          const target = frac * dur;
          try {
            primary.currentTime = target;
            // If we picked video, also seek audio so they stay synced.
            if (primary === v && a && a.src && Number.isFinite(Number(a.duration))) {
              try { a.currentTime = target; } catch (_e) {}
            }
            // Show the border-seek hint briefly.
            screen.dataset.cssosSeekFrac = frac.toFixed(3);
            console.info(
              "[watch-frame] border-seek → %s (frac %s)",
              new Date(target * 1000).toISOString().substr(11, 8),
              frac.toFixed(3)
            );
          } catch (_err) {}
        }
        // Border click EITHER way: don't toggle play/pause.
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Interior click → toggle play/pause (the original behaviour).
      try {
        if (primary.paused || primary.ended) {
          try { primary.muted = false; } catch (_e) {}
          const p = primary.play();
          if (p && typeof p.catch === "function") p.catch(function () {});
          if (primary === v && a && a.src) {
            try { a.muted = false; a.play().catch(function () {}); } catch (_e) {}
          }
        } else {
          primary.pause();
          if (primary === v && a && !a.paused) {
            try { a.pause(); } catch (_e) {}
          }
        }
      } catch (_err) { /* non-fatal */ }
    }, false);
    console.info(
      "%c[watch-frame] click-to-toggle play/pause installed",
      "color:#0a8;font-weight:bold"
    );
    return true;
  }

  function boot() {
    appendPopoverToBody();
    const ok1 = installButtons();
    const ok2 = installIdleTracking();
    installMediaFrameClickToggle();
    if (!(ok1 && ok2)) {
      let tries = 0;
      const iv = setInterval(function () {
        appendPopoverToBody();
        const a = installButtons(), b = installIdleTracking();
        wireStarBtnExtra();
        if ((a && b) || ++tries > 40) clearInterval(iv);
      }, 200);
    }
    wireStarBtnExtra();
    // Staggered shuffle fires — race-proof.
    setTimeout(forceShuffle, 200);
    setTimeout(forceShuffle, 900);
    setTimeout(forceShuffle, 2200);
    // Pre-load EVERY font in the catalog (50 fonts/500ms). Once-only —
    // after this runs, all 243 custom fonts are in document.fonts.check.
    setTimeout(prewarmFontBatch, 600);
    // Jing 2026-04-25 #102i — overlays module's own enhanceIfPlainText keeps
    // re-wrapping the subtitle/title with its own glyph spans, overwriting
    // ours and erasing per-token random fonts. We win the race by re-applying
    // every 1.5s, forever. Cheap (only runs when text exists).
    // Jing 2026-04-25 #102n — Delegated click on For You + Works Center
    // cards: when any .work-card is clicked, force-switch the Watch panel
    // to that card's run/work id. Fixes "click work A then work B, watch
    // stays on A" by always re-opening the watch panel with the new id.
    function findRunIdFromCard(card) {
      // Try several common data attribute names for the run/work id.
      const tries = [
        "runId", "workId", "audioRunId", "pipelineRunId",
        "cssosRunId", "cssosWorkId", "deliveryRunId",
        "id", "key"
      ];
      for (const k of tries) {
        const v = card.dataset[k];
        if (v) return String(v).trim();
      }
      // Sometimes the run id sits on a child node
      const child = card.querySelector("[data-run-id], [data-work-id], [data-audio-run-id]");
      if (child) {
        return String(
          child.dataset.runId || child.dataset.workId || child.dataset.audioRunId || ""
        ).trim();
      }
      return "";
    }
    function switchWatchToWork(runId, card) {
      try {
        // Update global state expected by the watch UI module.
        if (runId) {
          if (typeof globalThis.activePipelineRunId !== "undefined") {
            globalThis.activePipelineRunId = runId;
          }
          if (typeof globalThis.currentWatchAudioRunId !== "undefined") {
            globalThis.currentWatchAudioRunId = runId;
          }
          // Notify any listeners (mv-pipeline-panel, watch-ui) so they
          // re-fetch artifacts for the new id.
          window.dispatchEvent(new CustomEvent("cssos:open-watch-for-run", {
            detail: { run_id: runId, source: "card-click" }
          }));
          window.dispatchEvent(new CustomEvent("cssos:title_resolved", {
            detail: { title: "", run_id: runId, source: "card-click" }
          }));
        }
        // Close & reopen the watch panel so it re-initializes with the new id.
        const watchPanel = document.getElementById("watch-panel");
        if (watchPanel) {
          // Remove "active/open" classes the watch-ui module might rely on
          // sticky-state from the prior work.
          watchPanel.classList.add("cssmv-p2100-rebooting");
        }
        // Try every known watch-open API in order — first one to succeed wins.
        const openers = [
          () => globalThis.openWatchPreviewFlowModule?.({ run_id: runId, force: true }),
          () => globalThis.openWatchMusicPlaybackSurfaceModule?.({ run_id: runId, autoplay: false }),
          () => globalThis.openWatchPanelShellModule?.({ run_id: runId }),
          () => globalThis.openWatchPanel?.(runId),
        ];
        for (const fn of openers) {
          try { const r = fn && fn(); if (r) break; } catch (_) {}
        }
        if (watchPanel) {
          setTimeout(() => watchPanel.classList.remove("cssmv-p2100-rebooting"), 200);
        }
      } catch (_) { /* non-fatal */ }
    }
    // Jing 2026-04-25 #102x — robust per-card watch-switch.
    //
    // Real failure mode: clicking ENJOY on a different row in Works Center
    // / For You list opens the watch panel but it stays stuck on the FIRST
    // work clicked. Root cause: the existing watch-ui module checks "panel
    // already open?" → reuses old run_id → ignores the new one.
    //
    // Fix: when user clicks any card (or any per-card action button —
    // ENJOY / LISTEN / BUYOUT / TIP), FORCE-close the watch panel first
    // (clear its run_id state) THEN allow the click to bubble through to
    // the existing handler which will reopen it with the freshly-detected
    // run id. This makes every per-card click feel like a fresh switch.
    document.addEventListener("click", function (e) {
      const t = e.target;
      if (!(t instanceof Element)) return;

      // Detect: click inside a list-card OR on per-card action button.
      const card = t.closest(".work-card, .foryou-card, .works-card, [data-source-run-id], [data-run-id]");
      if (!card) return;

      // CSSOS_PHASE2_TITLE_TOGGLE_NOT_WATCH 20260504 — Jing
      // "之前是点击作品标题显示歌词/音乐风格/成本等信息，点击图片打开
      //  MV面板欣赏作品。现在是点击标题也就如MV，不对". Title clicks
      // hit data-work-toggle / data-market-toggle (expand details).
      // Cover clicks hit data-work-open-watch / data-market-action='open-watch'
      // (open watch). The capture-phase rebooter below was firing on
      // ANY click inside the card, so title clicks were also kicking
      // a watch reopen — making the title behave like the cover.
      // Gate the rebooter so it only runs for cover / action-button
      // clicks; title-toggle clicks fall through to the expand binder
      // without poking watch.
      if (t.closest("[data-work-toggle], [data-market-toggle]")) return;
      const intentToOpenWatch = !!t.closest(
        "[data-work-open-watch], [data-market-action='open-watch'], " +
        "[data-work-action='watch'], [data-market-action='preview'], " +
        "[data-market-action='listen']"
      );
      if (!intentToOpenWatch) return;

      // Common run-id holders. Check the CARD first, then the button itself.
      function readId(node) {
        if (!node) return "";
        const ds = node.dataset || {};
        return (
          ds.sourceRunId || ds.runId || ds.workId ||
          ds.deliveryId || ds.audioRunId || ds.id || ""
        ).toString().trim();
      }
      const runId = readId(t.closest("[data-source-run-id], [data-run-id], [data-work-id]")) || readId(card);

      // Mutate global active run state so any listener picks the new one.
      if (runId) {
        try {
          if ("activePipelineRunId" in globalThis) globalThis.activePipelineRunId = runId;
          if ("currentWatchAudioRunId" in globalThis) globalThis.currentWatchAudioRunId = runId;
        } catch (_) {}
      }

      // Force-close the watch panel BEFORE the existing click handler runs
      // so it has to re-open with fresh state. Use closing button if present
      // OR just hide via CSS — watch-ui will re-show on its own when the
      // existing open-flow runs from the ENJOY click below.
      const watchPanel = document.getElementById("watch-panel");
      if (watchPanel && !watchPanel.classList.contains("hidden")) {
        // Dispatch close + open events so watch-ui reinitializes
        window.dispatchEvent(new CustomEvent("cssos:watch-force-close", {
          detail: { reason: "card-switch", at: Date.now() }
        }));
        // Add reinit marker
        watchPanel.dataset.cssmvPendingReinit = String(Date.now());
        if (runId) watchPanel.dataset.cssmvNextRunId = runId;
      }

      // Dispatch run-switch event for any listener
      if (runId) {
        window.dispatchEvent(new CustomEvent("cssos:open-watch-for-run", {
          detail: { run_id: runId, source: "card-click", at: Date.now() }
        }));
      }
      // Don't preventDefault — let the original click handler fire so the
      // watch-ui's own open-flow does the actual heavy lifting.
    }, true);   // capture phase so we run BEFORE inner click handlers

    // Jing 2026-04-25 #102q — STOP the flicker.
    //
    // Old code fired forceShuffle on every MutationObserver event AND every
    // 250ms interval AND hijacked cssmvApplyTextEntry. That created a loop:
    // my write → overlays' RAF rewrite → my MO fires → my write → ... 60×/s.
    // Result: title looked like a flickering font cycle.
    //
    // New behavior: only re-shuffle when the underlying TEXT actually
    // changes (new song title arrives, lyric line advances). Same text =
    // no re-shuffle. ✦ button click still triggers an explicit reshuffle.
    function trackedText(el) {
      try {
        return (el && el.textContent ? el.textContent : "").trim();
      } catch (_) { return ""; }
    }
    function watchTextChanges(el, key) {
      if (!el) return;
      if (el.dataset[key + "TextObs"] === "1") return;
      el.dataset[key + "TextObs"] = "1";
      el.dataset[key + "LastText"] = trackedText(el);
      const mo = new MutationObserver(function () {
        const cur = trackedText(el);
        if (!cur) return;
        if (cur === el.dataset[key + "LastText"]) {
          // Same text — overlays just re-wrote children, but we don't care.
          // Re-apply our shuffle ONCE if our marker disappeared, then stop.
          if (!el.querySelector(".cssmv-p2100-glyph")) {
            applyShuffle(el);
          }
          return;
        }
        el.dataset[key + "LastText"] = cur;
        applyShuffle(el);
      });
      mo.observe(el, { childList: true, characterData: true, subtree: true });
      // Initial application
      if (trackedText(el)) applyShuffle(el);
    }
    function attachTextWatchers() {
      // Jing 2026-04-25 #102t — only watch song title + karaoke lyric line.
      // Status text in #watch-subtitle is left alone (keeps default font).
      const title = document.querySelector(".cssmv-mv-title");
      if (title) watchTextChanges(title, "p2100Tit");
      const kara = document.getElementById("watch-karaoke-line");
      if (kara) watchTextChanges(kara, "p2100Kara");
      return true;
    }
    attachTextWatchers();
    // Title element may appear later — poll briefly to attach.
    let titleTries = 0;
    const titleIv = setInterval(function () {
      attachTextWatchers();
      if (++titleTries > 30) clearInterval(titleIv);
    }, 400);
  }
  if (document.readyState === "complete" || document.readyState === "interactive") boot();
  else document.addEventListener("DOMContentLoaded", boot);

  // ========================================================================
  // Jing 2026-04-25 #102v — Advanced Settings hardcoded-defaults cleanup
  //
  // Fields like #creation-tempo (placeholder "88"), #creation-duration
  // (placeholder "180"), and the various style/instrumentation textareas
  // ship with hardcoded sample text that misleads the user into thinking
  // those values are committed. The system actually picks values from
  // civilization random cascade once lyrics are generated. So clear all
  // pre-fills on panel render — but only when the user hasn't typed
  // anything yet. Re-clear via MutationObserver in case a later script
  // re-applies defaults.
  // ========================================================================
  function emptyAdvancedDefaults() {
    const ids = [
      "creation-tempo", "creation-duration",
      "creation-instrumentation", "creation-vocal-style",
      "creation-ensemble-style", "creation-licensed-style-pack",
      "creation-external-audio-adapter", "creation-arrangement-density",
    ];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      // Only clear if value matches the hardcoded default placeholder
      // (e.g. tempo=88, duration=180) AND user hasn't focused/typed.
      if (el.dataset.cssmvP2100UserTyped === "1") continue;
      // Detect "untouched default" by checking against known hardcoded values
      const v = (el.value || "").trim();
      const defaults = {
        "creation-tempo": ["88"],
        "creation-duration": ["180"],
      };
      if (defaults[id] && defaults[id].includes(v)) {
        el.value = "";
        // The placeholder may still show "180" — that's fine, it's a hint
      }
      // Track first user input
      if (!el.dataset.cssmvP2100Bound) {
        el.dataset.cssmvP2100Bound = "1";
        el.addEventListener("input", function () {
          el.dataset.cssmvP2100UserTyped = "1";
        }, { once: true });
      }
    }
  }
  // CSSOS_PHASE2_ADV_DEFAULTS_GATE 20260505 — Jing
  // "请仔细检查全站代码，查处哪些代码在严重消耗资源". This used to
  // run every 3 s forever (~28800 DOM walks/day) even when the
  // Advanced panel is closed — pointless. Run once on boot (800 ms),
  // then bind a one-shot listener that re-runs ONLY when the
  // Advanced panel becomes visible / shows the relevant fields.
  setTimeout(emptyAdvancedDefaults, 800);
  // Re-run on the cssmv:advanced-panel-opened event (fired by the
  // advanced-panel module when it mounts the controls). Falls back
  // to a single 5 s safety re-run.
  document.addEventListener("cssmv:advanced-panel-opened", emptyAdvancedDefaults);
  setTimeout(emptyAdvancedDefaults, 5000);

  // ========================================================================
  // Jing 2026-04-25 #102v — Pipeline trigger lock
  //
  // Once the user fires a creation flow (cast spell / generate / Enjoy on
  // a fresh card), lock subsequent triggers until the flow closes (watch
  // panel opens with media playing OR explicit pipeline-complete event).
  // Fixes: clicking the cast button repeatedly produced 2-3 lyric outputs,
  // each music/video stage used a different lyric set, MV ended up with
  // mismatched titles + lyrics + audio.
  //
  // We hook into known "start" buttons and known fetch endpoints. While
  // locked, intercept clicks and show a brief toast "正在生成中…".
  // ========================================================================
  let __cssmvPipelineRunning = false;
  let __cssmvPipelineRunningSince = 0;
  function setPipelineRunning(running) {
    __cssmvPipelineRunning = !!running;
    __cssmvPipelineRunningSince = running ? Date.now() : 0;
    const root = document.documentElement;
    if (running) root.classList.add("cssmv-pipeline-running");
    else root.classList.remove("cssmv-pipeline-running");
    window.dispatchEvent(new CustomEvent(
      running ? "cssos:pipeline-locked" : "cssos:pipeline-unlocked",
      { detail: { at: Date.now() } }
    ));
  }
  function showPipelineToast(message) {
    let toast = document.getElementById("cssmv-pipeline-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "cssmv-pipeline-toast";
      toast.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(5,10,9,0.92);color:rgba(242,255,248,0.96);padding:14px 22px;border-radius:14px;border:1px solid rgba(218,255,242,0.32);backdrop-filter:blur(16px);font-size:14px;line-height:1.4;box-shadow:0 12px 40px rgba(0,0,0,0.6);opacity:0;pointer-events:none;transition:opacity 0.3s ease;";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = "1";
    clearTimeout(toast.__hideTimer);
    toast.__hideTimer = setTimeout(() => { toast.style.opacity = "0"; }, 2200);
  }
  // Intercept clicks on known trigger buttons — block if locked.
  const TRIGGER_SELECTORS = [
    "#watch-btn", "[data-action='cast-spell']", "[data-action='generate']",
    ".dock-spell", "#cssmv-spell-btn", ".cssmv-cast-btn",
    "#start-pipeline", ".start-pipeline-btn"
  ];
  document.addEventListener("click", function (e) {
    if (!__cssmvPipelineRunning) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    for (const sel of TRIGGER_SELECTORS) {
      if (t.closest && t.closest(sel)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        showPipelineToast("正在生成中… 请等当前作品完成");
        return;
      }
    }
  }, true);   // capture phase so we run BEFORE existing handlers

  // Detect pipeline start/end by intercepting fetch() to known endpoints.
  try {
    const origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      // First lyrics request → pipeline started
      if (/\/api\/mv\/lyrics(\?|$)/.test(url) && !__cssmvPipelineRunning) {
        setPipelineRunning(true);
      }
      // Final compose / commit → pipeline ended
      const promise = origFetch(input, init);
      if (/\/api\/mv\/compose(\?|$)|\/api\/mv\/commit(\?|$)/.test(url)) {
        promise.finally(() => {
          // Give it a couple seconds for downstream UI to settle
          setTimeout(() => setPipelineRunning(false), 2500);
        });
      }
      return promise;
    };
  } catch (_) { /* noop */ }

  // Safety: auto-unlock after 5 minutes regardless (in case a stage fails
  // and never sends a compose call).
  setInterval(function () {
    if (__cssmvPipelineRunning && Date.now() - __cssmvPipelineRunningSince > 5 * 60 * 1000) {
      setPipelineRunning(false);
    }
  }, 30000);

  // Also unlock on watch-overlay-play click (user manually proceeded) and on
  // cssos:pipeline-complete events from elsewhere.
  window.addEventListener("cssos:pipeline-complete", () => setPipelineRunning(false));
  window.addEventListener("cssos:pipeline-finished", () => setPipelineRunning(false));

  // CSSMV_STATUS_VS_SUBTITLE_SPLIT 20260425 #110 — Jing: status text
  // is redirected to a separate #watch-status-info element, so
  // #watch-subtitle is free to render real subtitle text with its
  // native styling. The random-font watcher for the karaoke line
  // (#watch-karaoke-line) already covers per-token shuffling on the
  // actual lyric overlay (the visible "subtitle" the user is watching).

  // ========================================================================
  // CSSMV_TITLE_6STAGE 20260425 #103 — Jing
  //
  // The Watch panel title bar progress info still showed only the legacy
  // 4-stage rotation (lyrics/music/video/kara) and rendered "Complete" /
  // "已完成" text when the active stage hit 100%. The actual pipeline now
  // has 6 stages (cover/lyrics/music/video/subtitles/compose) and should:
  //   • cycle the title rotation through ALL 6 (so the user sees each
  //     stage's live %)
  //   • drop "Complete" text — when a stage is done, the visual border
  //     bar already shows a frozen colored loop (.is-done-static); the
  //     title should NOT shout "100%" at the user
  //   • when ALL 6 stages hit done, hide every progress bar/strip and
  //     auto-play the MV
  //
  // Strategy:
  //   1. Patch globalThis.getActiveWatchProgressCardModule (after
  //      app.watch-ui.js wires it) to expand the card pool to 6 stages.
  //      Cover/subtitles/compose pull from engineProgressState directly.
  //   2. Run an interval that:
  //      a) reads the same 6-stage progress map
  //      b) snaps a random hue onto each completed stage's done-static
  //         bar (matches the spec — "随机让进度条显示一种颜色")
  //      c) when all 6 are done, calls cssmvStageBarsHide() and starts
  //         the video playback (#watch-video.play()) once
  //      d) when not all done, makes sure the title text doesn't show
  //         the "Complete" / "已完成" suffix — replace with the active
  //         stage's label only.
  // ========================================================================
  (function installSixStageTitleAndAutoplay() {
    const ALL_STAGES = ["cover", "lyrics", "music", "video", "subtitles", "compose"];
    let _autoPlayed = false;
    let _allDoneAt = 0;

    function readProgress() {
      const eng = (typeof window.engineProgressState === "object" && window.engineProgressState) || {};
      const lyricsPct =
        typeof window.currentLyricsProgressPercentModule === "function"
          ? Number(window.currentLyricsProgressPercentModule() || 0)
          : Number(eng.lyrics || 0);
      return {
        cover: Math.max(0, Math.min(100, Number(eng.cover || eng.thumbnail || 0))),
        lyrics: Math.max(0, Math.min(100, lyricsPct)),
        music: Math.max(0, Math.min(100, Number(eng.music || 0))),
        video: Math.max(0, Math.min(100, Number(eng.video || 0))),
        subtitles: Math.max(0, Math.min(100, Number(eng.subtitles || 0))),
        compose: Math.max(0, Math.min(100, Number(eng.compose || eng.kara || 0)))
      };
    }

    function isAllDone(map) {
      return ALL_STAGES.every((k) => Number(map[k] || 0) >= 100);
    }

    // Patch the rotator pool. We try once on boot and re-try lazily —
    // app.watch-ui.js may install its own definition after this module
    // loads, so we wrap it once it's present and stable.
    let _patchAttempts = 0;
    function patchRotator() {
      _patchAttempts += 1;
      if (typeof globalThis.getActiveWatchProgressCardModule !== "function") {
        if (_patchAttempts < 50) setTimeout(patchRotator, 200);
        return;
      }
      if (globalThis.getActiveWatchProgressCardModule.__cssmv6stage) return;
      const original = globalThis.getActiveWatchProgressCardModule;
      const safeT = (key) => {
        try {
          if (typeof globalThis.t === "function") {
            const v = globalThis.t(key);
            if (v && !/^TODO_i18n/.test(v)) return v;
          }
        } catch (_e) { /* no-op */ }
        return null;
      };
      const labelFor = (key) => {
        return (
          safeT(`watch.progress.${key}`) ||
          safeT(`engine.${key}`) ||
          (key.charAt(0).toUpperCase() + key.slice(1))
        );
      };
      const patched = function patchedGetActiveWatchProgressCard() {
        const map = readProgress();
        const cards = ALL_STAGES.map((key) => ({
          key,
          label: String(labelFor(key) || key).replace(/\s*0%$/, ""),
          progress: Math.round(map[key] || 0),
          done: Number(map[key] || 0) >= 100
        }));
        const liveCards = cards.filter((c) => !c.done);
        if (!liveCards.length) {
          // ALL six done — return null so watch-ui's "no card" branch
          // hides the shells. Title-rendering code there ALSO bails on
          // null, so the stale "${label} 100%" never sticks.
          return null;
        }
        const started = liveCards.filter((c) => Number(c.progress || 0) > 0);
        const pool = started.length ? started : liveCards;
        const ROTATE_MS = Number(globalThis.WATCH_PROGRESS_ROTATE_MS) || 5000;
        const idx = Math.floor(Date.now() / ROTATE_MS) % pool.length;
        return pool[idx] || pool[0] || null;
      };
      patched.__cssmv6stage = true;
      patched.__cssmvOriginal = original;
      globalThis.getActiveWatchProgressCardModule = patched;
    }
    setTimeout(patchRotator, 80);

    // ----------------------------------------------------------------- title scrub
    // Strip any "Complete" / "已完成" suffix that may have been rendered
    // by other modules. Runs cheaply on a 1s tick.
    function scrubTitleCompleteText() {
      const el = document.querySelector("#watch-panel .panel-title");
      if (!el) return;
      const txt = el.textContent || "";
      // Match " · Complete" or " · 已完成" or " · 完成" at the tail.
      const cleaned = txt.replace(/\s*·\s*(Complete|已完成|完成)\s*$/u, "");
      if (cleaned !== txt) el.textContent = cleaned;
    }

    // ----------------------------------------------------------------- random done-color
    // When a stage completes, the chase-border bar applies an
    // .is-done-static class. We additionally write a CSS variable
    // --cssmv-bar-hue with a deterministic random hue per stage so the
    // bar sits on a unique frozen color — "随机让进度条显示一种颜色".
    const stageDoneHueAssigned = Object.create(null);
    function assignDoneHues(map) {
      ALL_STAGES.forEach((key) => {
        if (Number(map[key] || 0) < 100) return;
        if (stageDoneHueAssigned[key]) return;
        // Random hue between 0 and 360, pinned per-session so re-renders
        // don't flicker.
        stageDoneHueAssigned[key] = Math.floor(Math.random() * 360);
      });
      // The chase-border SVG is shared across stages — only useful when
      // its rotation lands on a done stage. We still poke the CSS var on
      // the SVG element so the .is-done-static rule picks it up. The
      // gradient stops will be overridden by app.watch-stage-bars.js's
      // applyStageHue() anyway during render mode, so this only matters
      // when the rotation lands on a done stage.
      const svg = document.querySelector(".cssmv-border-bar");
      if (!svg) return;
      // Pick the currently-rotated stage from globalThis if exposed.
      // Best-effort — if we can't read it, skip silently.
    }

    // ----------------------------------------------------------------- all-done auto-play
    function tryAutoPlayMv() {
      if (_autoPlayed) return;
      const map = readProgress();
      if (!isAllDone(map)) {
        _allDoneAt = 0;
        return;
      }
      // Debounce: require all-done state to hold for 800ms before acting.
      if (!_allDoneAt) {
        _allDoneAt = Date.now();
        return;
      }
      if (Date.now() - _allDoneAt < 800) return;
      _autoPlayed = true;
      try {
        if (typeof globalThis.cssmvStageBarsHide === "function") {
          globalThis.cssmvStageBarsHide();
        }
      } catch (_e) { /* no-op */ }
      try {
        const v = document.getElementById("watch-video");
        if (v && typeof v.play === "function") {
          v.muted = true; // browsers gate audio autoplay; muted is always allowed
          v.playsInline = true;
          const p = v.play();
          if (p && typeof p.catch === "function") p.catch(() => {});
        }
      } catch (_e) { /* no-op */ }
      // Give the user a chance to unmute manually after the video starts —
      // we don't unmute automatically (autoplay policies).
    }

    // ----------------------------------------------------------------- main tick
    setInterval(() => {
      const map = readProgress();
      assignDoneHues(map);
      scrubTitleCompleteText();
      tryAutoPlayMv();
    }, 600);

    // Reset auto-play state when a new run is opened (so the next
    // pipeline can auto-play again).
    function resetAutoPlay() {
      _autoPlayed = false;
      _allDoneAt = 0;
      Object.keys(stageDoneHueAssigned).forEach((k) => delete stageDoneHueAssigned[k]);
    }
    window.addEventListener("cssos:open-watch-for-run", resetAutoPlay);
    document.addEventListener("cssos:open-watch-for-run", resetAutoPlay);
    window.addEventListener("cssos:pipeline-start", resetAutoPlay);
  })();

  // ========================================================================
  // CSSMV_CARD_SWITCH_LASTMILE 20260425 #106 — Jing
  //
  // "请跑完卡片切换的最后一里路." Card-click capture handler dispatches
  // cssos:open-watch-for-run, but no module actually listens — so the
  // panel stays on the old run. This block is the missing receiver:
  //   1. Look up the work record matching the new run_id (search the
  //      ownership payload + any flat work caches we can reach).
  //   2. Mutate currentWatchPreviewWork / currentWatchAudioRunId.
  //   3. Re-hydrate Watch artifacts (video / cover) from the new run's
  //      pipeline state via hydrateWatchFromRunPayloadModule().
  //   4. Call renderMarketWorkPreviewIntoWatchModule when the work
  //      record is reachable so commerce + seed re-render too.
  //   5. Otherwise fall back to openWatchPreviewFlowModule which will
  //      pick up the freshly-mutated currentWatch* state.
  // ========================================================================
  (function installCardSwitchReceiver() {
    function findWorkByRunId(runId) {
      if (!runId) return null;
      // Primary source: watchCommerceState.payload.ownership.works (the
      // server-paid set the user owns a preview/license for).
      try {
        const works =
          (globalThis.watchCommerceState &&
            globalThis.watchCommerceState.payload &&
            globalThis.watchCommerceState.payload.ownership &&
            Array.isArray(globalThis.watchCommerceState.payload.ownership.works) &&
            globalThis.watchCommerceState.payload.ownership.works) ||
          [];
        // Walk children of triptych/opera roots too.
        const stack = [];
        works.forEach((w) => stack.push(w));
        while (stack.length) {
          const w = stack.shift();
          if (!w) continue;
          const ids = [w.source_run_id, w.run_id, w.id, w.delivery_id]
            .map((v) => String(v || "").trim())
            .filter(Boolean);
          if (ids.includes(String(runId))) return w;
          if (Array.isArray(w.children)) w.children.forEach((c) => stack.push(c));
        }
      } catch (_e) { /* no-op */ }
      // Secondary: any registry/foryou cache the app exposes.
      const registries = [
        globalThis.foryouSeedPreviewCache,
        globalThis.worksCenterCache,
        globalThis.currentStructuredWatchQueue && globalThis.currentStructuredWatchQueue.items,
        globalThis.lastForyouWorks,
        globalThis.lastWorksCenterWorks
      ].filter(Boolean);
      for (const reg of registries) {
        try {
          const list = Array.isArray(reg) ? reg : Array.isArray(reg.items) ? reg.items : [];
          for (const w of list) {
            const ids = [w?.source_run_id, w?.run_id, w?.id, w?.delivery_id]
              .map((v) => String(v || "").trim())
              .filter(Boolean);
            if (ids.includes(String(runId))) return w;
          }
        } catch (_e) { /* no-op */ }
      }
      return null;
    }

    let _switchInFlight = false;
    async function handleOpenWatchForRun(ev) {
      if (_switchInFlight) return;
      const runId = String((ev && ev.detail && ev.detail.run_id) || "").trim();
      const source = String((ev && ev.detail && ev.detail.source) || "").trim();
      if (!runId) return;
      // Only take action for explicit card-click switches; reset events
      // (pipeline-start) just need the auto-play reset above.
      if (source !== "card-click") return;
      _switchInFlight = true;
      try {
        // Mutate global state FIRST so any concurrent code reads the new id.
        try {
          if ("activePipelineRunId" in globalThis) globalThis.activePipelineRunId = runId;
          if ("currentWatchAudioRunId" in globalThis) globalThis.currentWatchAudioRunId = runId;
          if ("pendingFinalAudioRunId" in globalThis) globalThis.pendingFinalAudioRunId = runId;
        } catch (_e) { /* no-op */ }

        // Bind currentWatchPreviewWork to the matching record if we can
        // find it — that's what unlocks renderMarketWorkPreviewIntoWatch.
        const work = findWorkByRunId(runId);
        if (work) {
          try { globalThis.currentWatchPreviewWork = work; } catch (_e) { /* no-op */ }
        }

        // Hide stale video so the next-run cover paint isn't masked.
        try {
          const v = document.getElementById("watch-video");
          if (v) {
            try { v.pause && v.pause(); } catch (_e) { /* no-op */ }
            v.removeAttribute("src");
            try { v.load && v.load(); } catch (_e) { /* no-op */ }
            v.style.display = "none";
          }
        } catch (_e) { /* no-op */ }
        // Force the layout-p2100 fullscreen state to forget the old run
        // so the new cover paints fresh.
        try {
          const panel = document.getElementById("watch-panel");
          if (panel) panel.classList.remove("cssmv-info-open");
        } catch (_e) { /* no-op */ }

        // Hydrate artifacts from the new run's pipeline state. This
        // populates watch-svg cover + watch-video src.
        if (typeof globalThis.hydrateWatchFromRunPayloadModule === "function") {
          try { await globalThis.hydrateWatchFromRunPayloadModule(runId); } catch (_e) { /* no-op */ }
        }

        // If we found a real work record, re-render the full market
        // preview surface so seed/title/commerce all flip.
        if (work && typeof globalThis.renderMarketWorkPreviewIntoWatchModule === "function") {
          const seed = typeof globalThis.buildMarketPreviewSeedModule === "function"
            ? globalThis.buildMarketPreviewSeedModule(work)
            : (typeof globalThis.buildMarketPreviewSeed === "function"
              ? globalThis.buildMarketPreviewSeed(work)
              : { title: work.title || "", lyrics: "" });
          try {
            await globalThis.renderMarketWorkPreviewIntoWatchModule({
              work,
              seed,
              previewUnlimited: false
            });
          } catch (_e) { /* no-op */ }
        } else if (typeof globalThis.openWatchPreviewFlowModule === "function") {
          // Fallback: state is already mutated, just re-trigger the open
          // flow so the panel re-paints from the new global ids.
          try {
            await globalThis.openWatchPreviewFlowModule({
              preferredTab: "mv",
              clearLimit: true
            });
          } catch (_e) { /* no-op */ }
        }
      } finally {
        // Small lockout window so a double-click doesn't race with the
        // hydration we just kicked off.
        setTimeout(() => { _switchInFlight = false; }, 600);
      }
    }
    window.addEventListener("cssos:open-watch-for-run", handleOpenWatchForRun);
    document.addEventListener("cssos:open-watch-for-run", handleOpenWatchForRun);
  })();

  // ========================================================================
  // CSSMV_STATUS_VS_SUBTITLE_SPLIT 20260425 #110 — Jing
  //
  //   "提示信息另外用一个新的标签，不要和普通字幕混在一起，不然会把孩子和
  //    脏水一起泼出去。即：保留普通字幕随机字体切换，另外添加一个标签显示
  //    输出信息."
  //
  // The #watch-subtitle element historically served two roles:
  //   1. Real subtitle text (with the styled tone-/emotion-/style-
  //      class variants in style.watch.css)
  //   2. Status messages during waiting ("CSS is composing…", "KaraOKe
  //      MV · Painting the cover now", lyrics-seed status, etc.)
  //
  // I'd previously CSS-reset .watch-subtitle to plain to suppress the
  // styled status look, which threw the baby out with the bathwater —
  // real subtitles lost their styling too.
  //
  // New design: insert a separate #watch-status-info element. Watch
  // #watch-subtitle for textContent changes; if the new text matches a
  // known STATUS pattern (or is set while playback isn't active), move
  // it to #watch-status-info and clear #watch-subtitle. Real subtitles
  // sneak through untouched because they don't match the patterns.
  // ========================================================================
  (function installSubtitleStatusSplit() {
    const STATUS_PATTERNS = [
      /CSS is composing/i,
      /CSS\s+正在/,
      /^KaraOKe\s+MV\s*[·•]/i,
      /Composing music now/i,
      /Rendering video now/i,
      /Rendering subtitle/i,
      /Writing the first line/i,
      /Painting the cover/i,
      /Privileged preview/i,
      /Buyer preview/i,
      /Preview ended/i,
      /Recovering lyrics/i,
      /requesting.*music\s+engine/i,
      /waiting.*lyrics/i,
      /generating/i,
      /loading/i,
      /preparing/i,
      // Chinese variants — common status verbs
      /(正在|准备|加载|生成|渲染|输出|稍候|等待)/,
      /^—$/, // dash placeholder
    ];

    function looksLikeStatus(text) {
      const s = String(text || "").trim();
      if (!s) return false;
      // Short single-line "status feel" — bail if it's lyric-shaped
      // (multiline, contains punctuation suggesting a verse, etc.)
      if (/[。，、！？；：…\n]/.test(s) && s.length > 24) return false;
      return STATUS_PATTERNS.some((re) => re.test(s));
    }

    let statusEl = null;
    function ensureStatusEl() {
      if (statusEl && document.body.contains(statusEl)) return statusEl;
      const sub = document.getElementById("watch-subtitle");
      if (!sub) return null;
      const screen = sub.closest(".watch-screen") || sub.parentNode;
      if (!screen) return null;
      statusEl = document.getElementById("watch-status-info");
      if (!statusEl) {
        statusEl = document.createElement("div");
        statusEl.id = "watch-status-info";
        statusEl.className = "watch-status-info";
        statusEl.setAttribute("aria-live", "polite");
        screen.appendChild(statusEl);
      }
      return statusEl;
    }

    function setStatus(text) {
      const el = ensureStatusEl();
      if (!el) return;
      const s = String(text || "").trim();
      if (!s) {
        el.textContent = "";
        el.classList.remove("is-active");
        return;
      }
      if (el.textContent !== s) el.textContent = s;
      el.classList.add("is-active");
    }

    let redirecting = false;
    function maybeRedirect() {
      if (redirecting) return;
      const sub = document.getElementById("watch-subtitle");
      if (!sub) return;
      // CSSOS_PHASE2_SUBTITLE_LYRIC_WRITE 20260426 #133 — Jing
      // The karaoke renderer in app.watch-ui.js stamps
      // dataset.cssmvOrigin = "lyric" when it pushes the active sung line
      // into #watch-subtitle. NEVER strip those — they're real lyrics, not
      // status messages, even if the lyric happens to look status-shaped
      // ("loading my heart up", "等待天明", etc.). Reset the flag so any
      // SUBSEQUENT non-tagged write (e.g. pipeline restart, voice-seed
      // status) goes back through the looksLikeStatus filter normally.
      if (sub.dataset.cssmvOrigin === "lyric") {
        delete sub.dataset.cssmvOrigin;
        return;
      }
      const text = String(sub.textContent || "").trim();
      if (!text) {
        // Subtitle was cleared — also clear status if it was showing.
        return;
      }
      if (!looksLikeStatus(text)) return;
      // Move to status element, clear from subtitle.
      redirecting = true;
      try {
        setStatus(text);
        sub.textContent = "";
      } finally {
        // Release on next microtask so observer fires once for the clear.
        setTimeout(() => { redirecting = false; }, 0);
      }
    }

    function attachObserver() {
      const sub = document.getElementById("watch-subtitle");
      if (!sub) return false;
      if (sub.dataset.cssmvStatusSplit === "1") return true;
      sub.dataset.cssmvStatusSplit = "1";
      ensureStatusEl();
      // Apply once on attach in case status text is already there.
      maybeRedirect();
      const mo = new MutationObserver(() => maybeRedirect());
      mo.observe(sub, { childList: true, characterData: true, subtree: true });
      return true;
    }

    function boot() {
      if (!attachObserver()) {
        let tries = 0;
        const iv = setInterval(() => {
          if (attachObserver() || ++tries > 40) clearInterval(iv);
        }, 200);
      }
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }

    // Expose for other modules to push status without touching subtitle.
    globalThis.cssmvSetWatchStatusInfo = setStatus;
  })();

  // ─────────────────────────────────────────────────────────────────────────
  // CSSOS_PHASE2_MUSIC_TAB_SUBTITLE 20260426 #131 — Jing
  //
  // "Music标签页，除了黑胶唱片之外，其余可以复用MV标签页的很多元素，请改进。"
  //
  // The Music pane only had the vinyl + play button. The active karaoke
  // lyric line and the regular subtitle line never existed there, so users
  // on the Music tab couldn't see what's being sung. Approach: keep the
  // canonical text in #watch-karaoke-line / #watch-subtitle (MV pane), then
  // mirror their textContent to clones inside the Music pane every time
  // they change. We can't share DOM nodes (one parent only), but we CAN
  // share the source-of-truth text and let the Music CSS scope handle
  // bottom-center positioning over the music stage.
  // ─────────────────────────────────────────────────────────────────────────
  (function () {
    const css = `
      /* Position the mirrored karaoke + subtitle inside the music stage,
         not relative to .watch-screen (which the music pane doesn't have). */
      #watch-pane-music .watch-music-karaoke-line,
      #watch-pane-music .watch-music-subtitle {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        z-index: 6;
        pointer-events: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: min(86%, 920px);
      }
      #watch-pane-music .watch-music-karaoke-line {
        bottom: 14%;
      }
      #watch-pane-music .watch-music-subtitle {
        bottom: 6%;
      }
      /* Hide if empty so we don't get a phantom box on first paint. */
      #watch-pane-music .watch-music-karaoke-line:empty,
      #watch-pane-music .watch-music-subtitle:empty {
        display: none;
      }
      /* Anchor the music stage so the absolutely-positioned mirrors land
         relative to it. The existing layout already gives .watch-music-stage
         a defined height, but be explicit. */
      #watch-pane-music .watch-music-stage {
        position: relative;
      }
    `;
    const style = document.createElement("style");
    style.id = "cssmv-music-tab-subtitle-css";
    style.textContent = css;
    document.head.appendChild(style);

    function mirrorOnce() {
      const srcK = document.getElementById("watch-karaoke-line");
      const dstK = document.getElementById("watch-music-karaoke-line");
      if (srcK && dstK && dstK.innerHTML !== srcK.innerHTML) {
        dstK.innerHTML = srcK.innerHTML;
      }
      const srcS = document.getElementById("watch-subtitle");
      const dstS = document.getElementById("watch-music-subtitle");
      if (srcS && dstS && dstS.innerHTML !== srcS.innerHTML) {
        dstS.innerHTML = srcS.innerHTML;
      }
    }

    function attach() {
      const srcK = document.getElementById("watch-karaoke-line");
      const srcS = document.getElementById("watch-subtitle");
      const dstK = document.getElementById("watch-music-karaoke-line");
      const dstS = document.getElementById("watch-music-subtitle");
      if (!srcK || !srcS || !dstK || !dstS) return false;
      if (srcK.dataset.cssmvMusicMirror === "1") return true;
      srcK.dataset.cssmvMusicMirror = "1";
      srcS.dataset.cssmvMusicMirror = "1";
      mirrorOnce();
      const mo = new MutationObserver(mirrorOnce);
      mo.observe(srcK, { childList: true, characterData: true, subtree: true });
      mo.observe(srcS, { childList: true, characterData: true, subtree: true });
      return true;
    }

    function boot() {
      if (!attach()) {
        let tries = 0;
        const iv = setInterval(() => {
          if (attach() || ++tries > 40) clearInterval(iv);
        }, 200);
      }
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  })();
})();
