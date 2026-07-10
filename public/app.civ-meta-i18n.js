/* CSSOS_WAVE_1674 — civilization / era 显示层 i18n (方案 A, Jing 批准)。
 *
 * 数据库里 person_profiles / digital_actors 的 civilization、era 中英文混存
 * (如 "近现代科学"、"20世纪"), 卡片直接显示原值 → 英文界面下西方人物顶着中文
 * ("冒充中国人")。这里在【显示层】按 UI 语言映射: 英文界面 → 英文; 中文界面 → 原样中文。
 * 存储值与依赖 civilization 的逻辑(语言路由/外貌映射/MV 参数)全部不动 → 零风险。
 *
 * 补齐一个一直被调用却从未定义的全局: civMetaText([civ, era], _opt, sep)。
 * app.person-mv-panel.js / app.agent-chat.js 早就在调它, 缺定义时回落到原始中文拼接 ——
 * 这正是人物市场卡片露中文的根因。同时导出 cssosCivDisplay / cssosEraDisplay 供他处复用。
 */
(function () {
  "use strict";

  // 文明 zh→en (person_profiles + digital_actors 全量 39 种)。
  var CIV_EN = {
    "中华文明": "Chinese", "中华神话": "Chinese Myth", "中华民间": "Chinese Folk", "中华佛教神话": "Chinese Buddhist Myth",
    "佛教神话": "Buddhist Myth", "北欧神话": "Norse Myth", "印加文明": "Inca", "印度教神话": "Hindu Myth", "印度文明": "Indian",
    "古典主义欧洲": "Classical Europe", "古印度文明": "Ancient India", "古埃及文明": "Ancient Egypt", "古埃及神话": "Egyptian Myth",
    "古希腊文明": "Ancient Greece", "古希腊神话": "Greek Myth", "古罗马文明": "Ancient Rome", "启蒙欧洲": "Enlightenment Europe",
    "巴洛克欧洲": "Baroque Europe", "当代": "Contemporary", "拜占庭文明": "Byzantine", "文艺复兴欧洲": "Renaissance Europe",
    "日本古典": "Classical Japan", "朝鲜古典": "Classical Korea", "欧洲文明": "European", "波斯文明": "Persian",
    "浪漫主义欧洲": "Romantic Europe", "现代北欧": "Modern Nordic", "现代印度": "Modern India", "现代非洲": "Modern Africa",
    "美索不达米亚文明": "Mesopotamia", "美索不达米亚神话": "Mesopotamian Myth", "莫卧儿印度": "Mughal India", "藏文明": "Tibetan",
    "西方文明": "Western", "近代欧洲": "Early Modern Europe", "近现代北美": "Modern North America",
    "近现代欧洲": "Modern Europe", "近现代科学": "Modern Science", "斯拉夫神话": "Slavic Myth",
  };

  // 时代 zh→en (具名朝代 / 时期; 纯"N世纪"类由下方 eraPattern 处理)。
  var ERA_EN = {
    "上古": "Antiquity", "上古 · 后羿时代": "Antiquity · Age of Houyi", "东晋": "Eastern Jin", "中世纪": "Medieval",
    "伊丽莎白时代": "Elizabethan", "佛教神系": "Buddhist pantheon", "共和末期": "Late Republic", "北宋": "Northern Song",
    "北朝乐府以来": "Since the Northern Dynasties Yuefu", "印加": "Inca", "古典": "Classical", "古典时期": "Classical period",
    "古典浪漫": "Classical–Romantic", "古典—浪漫之交": "Classical–Romantic transition", "古巴比伦": "Old Babylonian",
    "古王国": "Old Kingdom", "古王国—": "Old Kingdom", "古王国 · 第四王朝": "Old Kingdom · 4th Dynasty",
    "后印象派": "Post-Impressionist", "吐蕃": "Tibetan Empire", "吠陀以来": "Since the Vedic era", "吠陀—史诗": "Vedic–Epic",
    "启蒙": "Enlightenment", "唐": "Tang", "唐 / 神话时代": "Tang / Mythic age", "奥古斯都时期": "Augustan",
    "奥林匹斯神系": "Olympian pantheon", "孔雀王朝": "Maurya", "宋以来民间传说": "Folklore since the Song",
    "工业革命": "Industrial Revolution", "巴洛克": "Baroque", "希腊化": "Hellenistic", "希腊化时期": "Hellenistic period",
    "帝国早期": "Early Empire", "平安": "Heian", "开天辟地": "Primordial creation", "战国": "Warring States",
    "战国—江户": "Warring States–Edo", "战国-秦": "Warring States–Qin", "托勒密末期": "Late Ptolemaic", "拜占庭": "Byzantine",
    "文艺复兴": "Renaissance", "文艺复兴早期": "Early Renaissance", "文艺复兴盛期": "High Renaissance", "新巴比伦": "Neo-Babylonian",
    "新王国": "New Kingdom", "明": "Ming", "春秋": "Spring and Autumn", "未来佛": "Future Buddha",
    "汉以来民间传说": "Folklore since the Han", "汉末三国": "Late Han–Three Kingdoms", "江户": "Edo", "波旁王朝": "Bourbon dynasty",
    "浪漫": "Romantic", "清": "Qing", "清初": "Early Qing", "清末—民国—中华人民共和国": "Late Qing–Republic–PRC",
    "特洛伊战争后": "After the Trojan War", "现代": "Modern", "盛唐": "High Tang", "盛唐—中唐": "High–Mid Tang",
    "科学革命": "Scientific Revolution", "秦": "Qin", "维也纳古典": "Viennese Classical", "维京": "Viking",
    "罗马共和末期": "Late Roman Republic", "罗马帝国": "Roman Empire", "罗马帝国 · 弗拉维王朝": "Roman Empire · Flavian",
    "罗马帝国 · 朱里亚-克劳狄王朝": "Roman Empire · Julio-Claudian", "苏美尔": "Sumerian", "莫卧儿": "Mughal",
    "西汉": "Western Han", "近代": "Early Modern", "道教神系": "Daoist pantheon", "阿卡德": "Akkadian", "阿契美尼德": "Achaemenid",
    // W1677 — "当代" 既是 civ 也是 era; 只挂在 CIV_EN 时 cssosEraDisplay() 单独调用会回落原文。
    "当代": "Contemporary",
  };

  function isZhUI() {
    try { return (typeof globalThis.loginCopy === "function" && globalThis.loginCopy("en", "zh") === "zh"); }
    catch (_e) { return false; }
  }
  function ordinal(n) { n = +n; var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  // 世纪类: "19世纪"→19th century · "19-20世纪"→19th–20th century · "前 6 世纪"→6th century BC · "约前 2 世纪"→c. 2nd century BC
  function eraPattern(s) {
    s = String(s || "").trim();
    var circa = /^约/.test(s); if (circa) s = s.replace(/^约\s*/, "");
    // W1677 — 跨纪元复合式: "前 2 世纪—后 4 世纪" → "2nd century BC – 4th century AD"。
    //   必须先于下面的同纪元分支匹配, 否则 "前…—后…" 会被误当作单纪元区间。
    var span = s.match(/^(?:公元)?前\s*([0-9]+)\s*世纪\s*[-–—]\s*后\s*([0-9]+)\s*世纪$/);
    if (span) return (circa ? "c. " : "") + ordinal(span[1]) + " century BC – " + ordinal(span[2]) + " century AD";
    var bc = false;
    s = s.replace(/^(?:公元)?前\s*/, function () { bc = true; return ""; });
    var m = s.match(/^([0-9]+)\s*[-–—]\s*([0-9]+)\s*世纪$/);
    if (m) return (circa ? "c. " : "") + ordinal(m[1]) + "–" + ordinal(m[2]) + " century" + (bc ? " BC" : "");
    m = s.match(/^([0-9]+)\s*世纪$/);
    if (m) return (circa ? "c. " : "") + ordinal(m[1]) + " century" + (bc ? " BC" : "");
    return null;
  }
  function civEn(v) { var s = String(v || "").trim(); return CIV_EN[s] || s; }
  function eraEn(v) { var s = String(v || "").trim(); return ERA_EN[s] || eraPattern(s) || s; }
  function mapPart(v) { var s = String(v || "").trim(); return CIV_EN[s] || ERA_EN[s] || eraPattern(s) || s; }

  // 英文界面 → 映射英文; 中文界面 → 原样。未命中 → 原样回落。
  globalThis.cssosCivDisplay = function (civ) { return isZhUI() ? String(civ || "") : civEn(civ); };
  globalThis.cssosEraDisplay = function (era) { return isZhUI() ? String(era || "") : eraEn(era); };
  globalThis.civMetaText = function (parts, _opt, sep) {
    sep = (typeof sep === "string") ? sep : " · ";
    var arr = Array.isArray(parts) ? parts : [parts];
    var zh = isZhUI();
    return arr.filter(Boolean).map(function (v) { return zh ? String(v) : mapPart(v); }).join(sep);
  };
})();
