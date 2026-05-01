/**
 * CSSMV_SUBTITLE_CLEANER 20260425 #113 — Jing
 * ------------------------------------------------------------------
 *
 *   "字幕标题中有'/'的分隔符号，渲染字幕的时候请删掉，普通字幕中的
 *    **Verse 1** 或者 [Verse 1] 之类的非字幕，也请删掉
 *    (歌词框里可以继续保留)."
 *
 * The lyrics engine returns raw text with section markers and "/"
 * separators in titles. We keep those in the editable lyric box (raw
 * source-of-truth) but strip them everywhere they're rendered as a
 * subtitle / karaoke line / MV title.
 *
 * Targets:
 *   • #watch-karaoke-line — rendered lyric overlay (.watch-karaoke-current,
 *     .watch-karaoke-prev, .watch-karaoke-next)
 *   • #watch-subtitle — subtitle bar (when actually used for lyrics)
 *   • .cssmv-mv-title / #mv-title — the song title in the media frame
 *
 * The lyrics editor textarea (#watch-lyrics-editor / #lyrics) is left
 * alone — it MUST contain the raw text so the next render step can
 * still consume the original markers.
 *
 * Strip rules:
 *   1. **Verse 1** / **Chorus** / **Bridge** / **Pre-Chorus** /
 *      **Outro** / **Intro** / **Refrain** / **Hook** / etc. —
 *      markdown-bold section labels.
 *   2. [Verse 1] / [Chorus] / [Bridge] etc. — bracket section labels.
 *   3. (Chorus) / (Verse 2) — paren section labels (only when the
 *      label looks like a section keyword, NOT actual paren'd content).
 *   4. Leading / trailing `/` separator chars in titles (rare but
 *      "Title / 副标题" should display as "Title 副标题" in the MV).
 *   5. Stray markdown markers like `***`, leading `#`, etc.
 */
(function attachSubtitleCleaner(global) {
  "use strict";

  const SECTION_KEYWORDS = [
    "Verse", "Chorus", "Pre-Chorus", "PreChorus", "Bridge", "Outro",
    "Intro", "Refrain", "Hook", "Coda", "Interlude", "Breakdown",
    "Tag", "Vamp", "Ending", "Beat",
    // Common Chinese / Japanese section labels — same intent as the
    // English ones; lyrics LLMs occasionally emit them in CJK locales.
    "主歌", "副歌", "桥段", "前奏", "间奏", "尾奏", "引子",
    "Aメロ", "Bメロ", "サビ", "ブリッジ"
  ];
  // Build one regex that matches any keyword optionally followed by a
  // number/digit/letter suffix ("Verse 1", "Chorus 2A", "副歌2").
  const KW = SECTION_KEYWORDS
    .map((k) => k.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"))
    .join("|");
  // **Verse 1**, ** Verse 1 **, **Chorus**, …
  const RE_BOLD = new RegExp(
    `\\*\\*\\s*(?:${KW})(?:[\\s\\-_]*[A-Za-z0-9一二三四五六七八九十0-9]+)?\\s*\\*\\*`,
    "gi"
  );
  // [Verse 1], [Chorus], …
  const RE_BRACKET = new RegExp(
    `\\[\\s*(?:${KW})(?:[\\s\\-_]*[A-Za-z0-9一二三四五六七八九十0-9]+)?\\s*\\]`,
    "gi"
  );
  // (Chorus), (Verse 2) — only when the entire paren content looks like
  // a section label, so we don't eat legitimate parenthetical content.
  const RE_PAREN = new RegExp(
    `\\(\\s*(?:${KW})(?:[\\s\\-_]*[A-Za-z0-9一二三四五六七八九十0-9]+)?\\s*\\)`,
    "gi"
  );
  // Heading-style markers like "# Verse 1"
  const RE_HASH = new RegExp(
    `^\\s*#{1,6}\\s*(?:${KW})(?:[\\s\\-_]*[A-Za-z0-9一二三四五六七八九十0-9]+)?\\s*:?\\s*$`,
    "gim"
  );

  function cleanSubtitleText(input) {
    if (!input) return input;
    let s = String(input);
    s = s.replace(RE_BOLD, "");
    s = s.replace(RE_BRACKET, "");
    s = s.replace(RE_PAREN, "");
    s = s.replace(RE_HASH, "");
    // Strip stray markdown bullet runs and triple-stars.
    s = s.replace(/\*{2,}/g, "");
    // Collapse double spaces created by removals; keep single newlines.
    s = s.replace(/[ \t]+/g, " ");
    s = s.replace(/\s*\n\s*/g, "\n");
    s = s.trim();
    return s;
  }

  function cleanTitleText(input) {
    if (!input) return input;
    let s = cleanSubtitleText(input);
    // Strip "/" separator characters in titles. "Title / 副标题" →
    // "Title 副标题"; the lyrics editor retains the original. Keep "/"
    // in URLs by skipping if the slash is between non-whitespace
    // alphanumerics that look URL-shaped (rare in titles).
    if (!/https?:\/\//i.test(s)) {
      s = s.replace(/\s*\/\s*/g, " ");
      s = s.replace(/[ \t]+/g, " ").trim();
    }
    return s;
  }

  // ---------------------------------------------------------------- observers
  function cleanIfChanged(el, cleaner, marker) {
    if (!el) return;
    if (el.dataset[marker + "Cleaning"] === "1") return;
    // Walk text nodes only — don't blow away nested glyph spans.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let node;
    let any = false;
    el.dataset[marker + "Cleaning"] = "1";
    try {
      while ((node = walker.nextNode())) {
        const before = node.nodeValue || "";
        if (!before.trim()) continue;
        const after = cleaner(before);
        if (after !== before) {
          node.nodeValue = after;
          any = true;
        }
      }
    } finally {
      setTimeout(() => { el.dataset[marker + "Cleaning"] = "0"; }, 0);
    }
    return any;
  }

  function attachObserver(el, cleaner, marker) {
    if (!el) return;
    if (el.dataset[marker + "Bound"] === "1") return;
    el.dataset[marker + "Bound"] = "1";
    cleanIfChanged(el, cleaner, marker);
    const mo = new MutationObserver(() => cleanIfChanged(el, cleaner, marker));
    mo.observe(el, { childList: true, characterData: true, subtree: true });
  }

  function refresh() {
    attachObserver(
      document.getElementById("watch-karaoke-line"),
      cleanSubtitleText,
      "cssmvSubclean"
    );
    attachObserver(
      document.getElementById("watch-subtitle"),
      cleanSubtitleText,
      "cssmvSubclean"
    );
    const titleCandidates = [
      document.querySelector(".cssmv-mv-title"),
      document.getElementById("mv-title")
    ].filter(Boolean);
    titleCandidates.forEach((el) =>
      attachObserver(el, cleanTitleText, "cssmvTitleClean")
    );
  }

  function boot() {
    refresh();
    let tries = 0;
    const iv = setInterval(() => {
      refresh();
      if (++tries > 60) clearInterval(iv);
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  // Expose for other modules.
  global.cssmvCleanSubtitleText = cleanSubtitleText;
  global.cssmvCleanTitleText = cleanTitleText;
})(typeof globalThis !== "undefined" ? globalThis : window);
