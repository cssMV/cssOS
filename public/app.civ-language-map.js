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
    // CSSOS_WAVE_433 20260525 — 阿契美尼德 (Achaemenid) → Old Persian (peo).
    // Cyrus/Darius/Xerxes used cuneiform 𐎤𐎢𐎽𐎢𐏁, not modern Farsi.
    // Must be listed BEFORE the generic 波斯/Persia entry (first match wins).
    { match: ["阿契美尼德", "Achaemenid", "居鲁士", "Cyrus", "Darius", "大流士", "薛西斯", "Xerxes"], lang: "peo" },
    { match: ["波斯", "Persia", "Persian", "Iran", "Iranian"],            lang: "fa" },
    /* CSSOS_WAVE_229 — 古埃及→ar (当代受众期待阿拉伯语). */
    /* CSSOS_WAVE_1797 (Jing) — 克丽奥帕特拉是【托勒密希腊人】, 母语通用希腊语,
     * 她还是第一个学会埃及语的托勒密。此前落在 古埃及→ar, 会让她唱阿拉伯语。
     * 单开一条更具体的 civ, 排在 古埃及 之前 —— 零波及其余 14 位埃及人物。 */
    { match: ["托勒密", "Ptolemaic"],                                  lang: "el" },
    { match: ["古埃及", "Ancient Egypt", "Egyptian Myth"], lang: "ar" },
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
    /* CSSOS_WAVE_1796 (Jing「必须文明智能联动」) — 与后端 CIV_LANGUAGE_ENTRIES 对齐。
     * 这 7 个文明此前两端都没有条目 → 返回 "" → 歌词跟 UI 语言走而非人物母语。
     * 库里已有 27 位上线演员命中这个洞(凯尔特/斯拉夫神话/波利尼西亚/玛雅/约鲁巴)。
     * 按 W360 现行政策给真母语, 不降级英文。两端必须同步改, 少改一端就是半个联动。 */
    { match: ["希伯来", "Hebrew"],                                       lang: "he" },
    { match: ["凯尔特", "Celtic"],                                       lang: "cy" },
    { match: ["斯拉夫", "Slavic"],                                       lang: "ru" },
    { match: ["阿兹特克", "Aztec", "Nahua"],                             lang: "nah" },
    { match: ["玛雅", "Maya"],                                           lang: "yua" },
    { match: ["约鲁巴", "Yoruba"],                                       lang: "yo" },
    { match: ["波利尼西亚", "Polynesia", "Hawaii"],                      lang: "haw" },
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

  // ---------------------------------------------------------------------------
  // civDisplayName(civ, locale) — returns a human-readable English (or locale)
  // display name for a civilization string. Used wherever the raw Chinese
  // civilization label needs to appear in the UI.
  // ---------------------------------------------------------------------------
  var CIV_DISPLAY_NAMES = {
    // Chinese
    "中华文明":    "Chinese Civilization",
    "中国古代":    "Ancient China",
    "中华民国":    "Republic of China",
    "中华人民共和国": "People's Republic of China",
    "先秦":       "Pre-Qin China",
    "秦朝":       "Qin Dynasty",
    "汉朝":       "Han Dynasty",
    "三国":       "Three Kingdoms",
    "唐朝":       "Tang Dynasty",
    "宋朝":       "Song Dynasty",
    "元朝":       "Yuan Dynasty",
    "明朝":       "Ming Dynasty",
    "清朝":       "Qing Dynasty",
    "近代中国":    "Modern China",
    "中华神话":    "Chinese Mythology",
    "中华佛教神话": "Chinese Buddhist Mythology",
    "中华民间":    "Chinese Folklore",
    "佛教神话":    "Buddhist Mythology",
    "北欧神话":    "Norse Mythology",
    "美索不达米亚文明": "Mesopotamian Civilization",
    "美索不达米亚神话": "Mesopotamian Mythology",
    "古典主义欧洲": "Neoclassical Europe",
    "启蒙欧洲":    "Enlightenment Europe",
    "巴洛克欧洲":  "Baroque Europe",
    "浪漫主义欧洲": "Romantic Europe",
    "欧洲文明":    "European Civilization",
    "近现代欧洲":  "Early Modern Europe",
    "近现代北美":  "Early Modern North America",
    "近现代科学":  "Modern Science",
    "藏文明":      "Tibetan Civilization",
    // Japan
    "日本古典":    "Classical Japan",
    "日本":       "Japan",
    "日本近代":    "Modern Japan",
    "江户时代":    "Edo Period",
    "明治时代":    "Meiji Era",
    // Other Asia
    "朝鲜":       "Korea",
    "韩国":       "Korea",
    "越南":       "Vietnam",
    "印度":       "India",
    "印度文明":    "Indian Civilization",
    "印度古典":    "Classical India",
    "波斯":       "Persia",
    "奥斯曼":     "Ottoman Empire",
    "阿拉伯":     "Arab Civilization",
    "蒙古":       "Mongol Empire",
    "藏族":       "Tibetan",
    "藏族文明":    "Tibetan Civilization",
    "古罗马文明":  "Ancient Roman Civilization",
    // Western
    "古希腊":      "Ancient Greece",
    "古希腊文明":  "Ancient Greek Civilization",
    "古罗马":      "Ancient Rome",
    "古埃及":      "Ancient Egypt",
    "古埃及文明":  "Ancient Egyptian Civilization",
    "拜占庭":      "Byzantine Empire",
    "中世纪欧洲":  "Medieval Europe",
    "文艺复兴":    "Renaissance",
    "近代欧洲":    "Modern Europe",
    "英国":        "Britain",
    "法国":        "France",
    "德国":        "Germany",
    "美国":        "United States",
    "俄国":        "Russia",
    "苏联":        "Soviet Union",
    // Africa & Americas
    "非洲":        "Africa",
    "玛雅":        "Maya Civilization",
    "阿兹特克":    "Aztec Empire",
    "印加":        "Inca Empire",
    // Generic
    "现代":        "Modern Era",
    "当代":        "Contemporary",
    "古代":        "Ancient",
  };

  /**
   * Returns an English display name for a civilization string.
   * Falls back to the original string if no mapping found.
   * @param {string} civ  - raw civilization string (e.g. "日本古典")
   * @param {string} [locale] - optional locale; if "zh" returns civ as-is
   */
  function civDisplayName(civ, locale) {
    if (!civ) return "";
    if (locale && locale.startsWith("zh")) return civ;
    // exact match
    if (CIV_DISPLAY_NAMES[civ]) return CIV_DISPLAY_NAMES[civ];
    // substring match (e.g. "中华文明-汉朝" → "Han Dynasty" via "汉朝")
    for (var k in CIV_DISPLAY_NAMES) {
      if (civ.indexOf(k) !== -1) return CIV_DISPLAY_NAMES[k];
    }
    // if no Chinese characters found, return as-is (already English)
    if (!/[一-鿿]/.test(civ)) return civ;
    // last resort: return as-is (unknown Chinese civ)
    return civ;
  }

  // CSSOS_WAVE_593 — 共享: 把一组 meta 字段(civilization/era/location/dynasty…)逐个本地化后用分隔符拼接。
  // 每个元素过 civDisplayName(覆盖文明 + 朝代/era; 未知词原样返回), locale 默认取文档语言 →
  // 非中文用户绝不看到"印度文明/唐朝"等中文(回退英文)。彻底替代散落各处的 [a,b,c].join(" · ")。
  function civMetaText(parts, locale, sep) {
    if (!Array.isArray(parts)) parts = [parts];
    locale = locale || (function () {
      try { return document.documentElement.lang || navigator.language || ""; } catch (_e) { return ""; }
    })();
    sep = (sep == null) ? " · " : sep;
    return parts.filter(Boolean).map(function (x) { return civDisplayName(String(x), locale); }).join(sep);
  }

  Object.assign(globalThis, {
    civToLanguageModule,
    civToLanguage: civToLanguageModule,
    civDisplayName,
    civMetaText,
  });
})();
