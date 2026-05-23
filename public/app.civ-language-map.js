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
  /* CSSOS_WAVE_197 20260516 — Jing
   *
   * Earlier this map returned exotic ancestral languages for many civs
   * (Latin for ancient Rome, Sanskrit for Vedic India, Old Norse for
   * Norse myth, etc.). Two problems with that in practice:
   *   1. Small lyric LLMs (cerebras / groq llama-3.1-8b) can't write
   *      credible lyrics in these languages, so they silently fall
   *      back to Chinese, producing the exact bug the user reported.
   *   2. Even where the LLM can write the language, the user's UI is
   *      typically English; getting Latin lyrics out of an English UI
   *      is jarring.
   *
   * New policy — TWO TIERS:
   *   • MAINSTREAM languages: keep them. LLMs write these well and
   *     users browsing in these UIs expect native lyrics.
   *     (zh, en, ja, ko, es, fr, de, it, pt, ru, hi, ar, tr)
   *   • EVERYTHING ELSE: route to "" (let caller fall back to UI / "en").
   *     Returning "" means seedLang gets dropped → state.language picks
   *     up creationState.language → UI primary → "en". The user gets
   *     English lyrics, never Chinese.
   *
   * If the lyrics LLM can't fulfill an explicit user-chosen mainstream
   * language, the SYSTEM PROMPT now instructs: "fall back to English,
   * NEVER to Chinese." */
  /* CSSOS_WAVE_360 20260522 — Jing「文明智能联动·铁律升级」:
   * "人物母语是什么语言就用什么语言. 我不相信 openAI/Claude 无法输出该人物的母语."
   * W197 当年把大量文明降级成 ""(英文) 是因为【小模型】写不了那些语言会偷偷出中文.
   * 现在两件事变了: (1) 歌词系统提示已加硬约束 —— 主题只当语义种子, 正文严格用
   * 目标语言, 非中文目标【绝不出现中文】(W358); (2) 写不出母语时 W209 premium 升级
   * 自动调 OpenAI/Anthropic. 所以恢复真实母语: 波斯→fa、古希腊→el、古罗马→la、
   * 文艺复兴→it、启蒙→fr、巴洛克/古典/浪漫→de、北欧神话→is、现代北欧→sv 等等.
   * 兜底次序仍是: 母语 → (写不出) 英文 → 永不中文(除非本就是中华). */
  const ENTRIES = [
    // ── Chinese-language civilizations ──
    { match: ["中华", "Chinese", "Confucian", "Daoist", "Taoist"],       lang: "zh" },
    // ── East Asian ──
    { match: ["日本", "Japan", "Japanese"],                               lang: "ja" },
    { match: ["朝鲜", "韩国", "高丽", "Korean", "Korea", "Goryeo", "Joseon"], lang: "ko" },
    { match: ["越南", "Vietnam", "Vietnamese"],                           lang: "vi" },
    { match: ["藏文明", "西藏", "Tibet", "Tibetan"],                     lang: "bo" },
    // ── Indian subcontinent ──
    { match: ["莫卧儿", "Mughal"],                                        lang: "ur" },
    { match: ["古印度", "印度教神话", "Vedic", "Hindu Myth"],            lang: "sa" },
    { match: ["佛教神话", "Buddhist Myth"],                              lang: "sa" },
    { match: ["现代印度", "Modern India"],                                lang: "hi" },
    { match: ["印度", "India", "Indian"],                                lang: "hi" },
    // ── Persian / Iranian ──
    { match: ["波斯", "Persia", "Persian", "Iran", "Iranian"],            lang: "fa" },
    /* CSSOS_WAVE_229 — 古埃及→ar (当代受众期待阿拉伯语). */
    { match: ["古埃及", "Ancient Egypt", "Egyptian Myth", "托勒密", "Ptolemaic"], lang: "ar" },
    { match: ["美索不达米亚", "Mesopotam"],                              lang: "ar" },
    { match: ["奥斯曼", "Ottoman", "Turkic"],                            lang: "tr" },
    { match: ["阿拉伯", "Arab"],                                          lang: "ar" },
    // ── Greek / Hellenic / Byzantine ──
    { match: ["古希腊", "Ancient Greek", "Hellenic", "Greek Myth"],       lang: "el" },
    { match: ["拜占庭", "Byzantine"],                                     lang: "el" },
    // ── Latin (ancient Rome) ──
    { match: ["古罗马", "Ancient Roman", "Roman Empire"],                 lang: "la" },
    // ── European epochs → that era's tongue ──
    { match: ["文艺复兴", "Renaissance"],                                 lang: "it" },
    { match: ["启蒙", "Enlightenment"],                                   lang: "fr" },
    { match: ["巴洛克", "Baroque"],                                       lang: "de" },
    { match: ["古典主义", "Classical Europe"],                            lang: "de" },
    { match: ["浪漫主义", "Romantic Europe"],                             lang: "de" },
    { match: ["维多利亚", "Victorian"],                                   lang: "en" },
    { match: ["近现代欧洲", "近代欧洲", "Modern Europe", "Early Modern Europe"], lang: "en" },
    // ── Norse / Nordic ──
    { match: ["北欧神话", "Norse Mythology"],                            lang: "is" },
    { match: ["现代北欧", "Modern Nordic"],                              lang: "sv" },
    // ── New World ──
    { match: ["印加", "Inca"],                                            lang: "es" },
    { match: ["美国", "近现代北美", "Modern North America", "United States", "American"], lang: "en" },
    // ── Africa ──
    { match: ["现代非洲", "Modern Africa"],                              lang: "sw" },
    // ── Fictional / catch-all Western ──
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
