/* CSSOS_WAVE_196 20260516 — Jing
 *
 * "人物MV的文明智能联动：歌词必须跟随人物的母语。中华文明 → 中文,
 *  古埃及 → 埃及语言, 日本 → 日语…以此类推。系统 UI 语言无关。"
 *
 * Civilization → lyric language (ISO 639-1 / -3) lookup. Used by the
 * person-MV seed builder so the lyrics LLM call gets the right
 * language regardless of what the UI is set to. Falls back to "en"
 * when the civilization is unknown / missing.
 *
 * Keys cover both Chinese and English civilization labels used across
 * the codex / landmark data. Matching is case-insensitive substring
 * for robustness against minor naming variations
 * (e.g. "Chinese Civilization" vs "Chinese Mythology" both → zh).
 */
(function () {
  "use strict";
  if (globalThis.civToLanguageModule) return;

  /* Ordered entries — first matching substring wins. Order matters
   * when one keyword is a substring of another (e.g. 古印度 vs 印度
   * — list more specific first). */
  const ENTRIES = [
    // ── Chinese-language civilizations ──
    { match: ["中华", "Chinese", "Confucian", "Daoist", "Taoist"],       lang: "zh" },
    // ── Japanese ──
    { match: ["日本", "Japan", "Japanese"],                               lang: "ja" },
    // ── Korean ──
    { match: ["朝鲜", "韩国", "高丽", "Korean", "Korea", "Goryeo", "Joseon"], lang: "ko" },
    // ── Vietnamese ──
    { match: ["越南", "Vietnam", "Vietnamese"],                           lang: "vi" },
    // ── Tibetan ──
    { match: ["藏文明", "西藏", "Tibet", "Tibetan"],                     lang: "bo" },
    // ── Indian languages ──
    { match: ["莫卧儿", "Mughal"],                                        lang: "ur" }, // Urdu
    { match: ["古印度", "印度教神话", "Vedic", "Hindu Myth"],            lang: "sa" }, // Sanskrit
    { match: ["佛教神话", "Buddhist Myth"],                              lang: "sa" }, // Sanskrit/Pali — sa most common in lyric LLMs
    { match: ["现代印度", "Modern India"],                                lang: "hi" }, // Hindi
    { match: ["印度", "India", "Indian"],                                lang: "hi" }, // generic
    // ── Persian / Iranian ──
    { match: ["波斯", "Persia", "Persian", "Iran", "Iranian"],            lang: "fa" },
    // ── Arabic-script civilizations ──
    { match: ["古埃及", "Ancient Egypt", "Egyptian Myth"],                lang: "ar" },
    { match: ["美索不达米亚", "Mesopotam"],                              lang: "ar" },
    { match: ["奥斯曼", "Ottoman", "Turkic"],                            lang: "tr" }, // Turkish
    { match: ["阿拉伯", "Arab"],                                          lang: "ar" },
    // ── Hellenic / Byzantine ──
    { match: ["古希腊", "Ancient Greek", "Hellenic", "Greek Myth"],       lang: "el" },
    { match: ["拜占庭", "Byzantine"],                                     lang: "el" },
    // ── Latin / Italian ──
    { match: ["古罗马", "Ancient Roman", "Roman Empire"],                 lang: "la" }, // Latin
    { match: ["文艺复兴", "Renaissance"],                                 lang: "it" },
    // ── Other European ──
    { match: ["启蒙", "Enlightenment"],                                   lang: "fr" },
    { match: ["巴洛克", "Baroque"],                                       lang: "de" },
    { match: ["古典主义", "Classical Europe"],                            lang: "de" },
    { match: ["浪漫主义", "Romantic Europe"],                             lang: "de" },
    { match: ["维多利亚", "Victorian"],                                   lang: "en" },
    { match: ["近现代欧洲", "近代欧洲", "Modern Europe", "Early Modern Europe"], lang: "en" },
    { match: ["北欧神话", "Norse Mythology"],                            lang: "is" }, // Old Norse → modern Icelandic
    { match: ["现代北欧", "Modern Nordic"],                              lang: "sv" }, // Swedish
    // ── New World ──
    { match: ["印加", "Inca"],                                            lang: "es" }, // Spanish (Quechua too obscure for LLMs)
    { match: ["美国", "近现代北美", "Modern North America", "United States", "American"], lang: "en" },
    // ── Africa ──
    { match: ["现代非洲", "Modern Africa"],                              lang: "sw" }, // Swahili
    // ── Catch-all "Western / European" ──
    { match: ["中土世界", "Middle-earth"],                                lang: "en" },
    { match: ["欧洲", "European", "西方", "Western"],                     lang: "en" },
    // ── Generic modern / contemporary ──
    { match: ["现代文学", "Modern Literature"],                          lang: "en" },
    { match: ["现代科学", "近现代科学", "Modern Science"],               lang: "en" },
    { match: ["当代", "Contemporary"],                                    lang: "en" },
  ];

  function civToLanguageModule(civilization) {
    const s = String(civilization || "").trim();
    if (!s) return "";
    const lower = s.toLowerCase();
    for (const e of ENTRIES) {
      for (const key of e.match) {
        if (lower.indexOf(key.toLowerCase()) !== -1) return e.lang;
      }
    }
    return ""; // unknown → caller falls back to UI default
  }

  Object.assign(globalThis, {
    civToLanguageModule,
    civToLanguage: civToLanguageModule,
  });
})();
