#!/usr/bin/env node
/* W2297 回归 —— 字幕条的语言标签只许在【占位符】时回落字形检测。
 *
 * 真跑, 不读注释: 从 src/index.ts 里抠出 LANG_CODE_PLACEHOLDERS、_isLangPlaceholder 的判据
 * 和 detectLyricLang 本体, 在真代码上求值。
 *
 * CALIBRATE=1 读 git HEAD 的 src/index.ts —— 那里没有 LANG_CODE_PLACEHOLDERS, 必须抠不出来而失败。
 * 抠不出来一律算失败(判不了 ≠ 通过)。
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const CAL = process.env.CALIBRATE === "1";
const src = CAL
  ? execSync("git show HEAD:src/index.ts", { encoding: "utf8", maxBuffer: 1 << 28 })
  : readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

let fail = 0, pass = 0;
const ok  = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗", m); } };
const die = (m) => { console.log("  ✗ 抠不出来(判不了, 算失败):", m); fail++; };

/* ── 1. 占位符集合 ── */
let PLACEHOLDERS = null;
{
  const i = src.indexOf("const LANG_CODE_PLACEHOLDERS = new Set(");
  if (i < 0) die("LANG_CODE_PLACEHOLDERS 不存在");
  else {
    const open = src.indexOf("[", i), close = src.indexOf("]", open);
    if (open < 0 || close < 0) die("LANG_CODE_PLACEHOLDERS 的数组字面量不完整");
    else {
      try { PLACEHOLDERS = new Set(JSON.parse(src.slice(open, close + 1).replace(/,\s*$/, ""))); }
      catch (e) { die("LANG_CODE_PLACEHOLDERS 解析失败: " + e.message); }
    }
  }
}

/* ── 2. 判据里的那条正则 ── */
let SHAPE = null;
{
  const i = src.indexOf("_isLangPlaceholder");
  if (i < 0) die("_isLangPlaceholder 不存在");
  else {
    const m = src.slice(i, i + 600).match(/!(\/\^.*?\/)\.test\(_trackLangRaw\)/);
    if (!m) die("_isLangPlaceholder 里的形状正则抠不出来");
    else { try { SHAPE = eval(m[1]); } catch (e) { die("形状正则 eval 失败: " + e.message); } }
  }
}

/* ── 3. detectLyricLang 本体(用来证明「对拉丁字母它的信息量是零」) ── */
let detect = null;
{
  const i = src.indexOf("const detectLyricLang = (text: string): string => {");
  if (i < 0) die("detectLyricLang 不存在");
  else {
    const j = src.indexOf("\n    };", i);
    if (j < 0) die("detectLyricLang 收尾找不到");
    else {
      const body = src.slice(i, j + 7).replace("(text: string): string =>", "(text) =>").replace(/^const /, "");
      try { detect = eval(`(() => { const ${body} return detectLyricLang; })()`); }
      catch (e) { die("detectLyricLang eval 失败: " + e.message); }
    }
  }
}

if (PLACEHOLDERS && SHAPE && detect) {
  const isPlaceholder = (raw) => {
    const s = String(raw || "").trim().toLowerCase();
    return PLACEHOLDERS.has(s) || !SHAPE.test(s);
  };

  console.log("\n── 占位符: 必须回落字形检测");
  for (const p of ["", "  ", "orig", "auto", "und", "unknown", "default", "pre-epic", "orig-pre-epic", "ORIG"])
    ok(isPlaceholder(p), `占位符 ${JSON.stringify(p)} → 回落检测`);

  console.log("\n── W2296 实际栽的那些真语言: 必须采信轨上的标签");
  for (const l of ["gd", "nah", "yo", "akk", "yua", "non", "la", "quc", "haw", "mi",
                   "qu", "zap", "zu", "xh", "man", "am", "vi"])
    ok(!isPlaceholder(l), `真语言 ${l} → 采信轨, 不回落`);

  console.log("\n── 原来那 17 个白名单语言: 行为不变(仍采信)");
  for (const l of ["zh", "en", "ja", "ko", "es", "fr", "de", "it", "pt", "ru",
                   "fa", "el", "he", "hi", "th", "ar", "tr"])
    ok(!isPlaceholder(l), `白名单 ${l} → 仍采信`);

  console.log("\n── 带地区的码也要采信");
  for (const l of ["zh-hans", "pt-br", "en-us"]) ok(!isPlaceholder(l), `${l} → 采信`);

  console.log("\n── 垃圾值仍当占位符");
  for (const l of ["x", "toolongcode", "12", "zh_hans!"]) ok(isPlaceholder(l), `${JSON.stringify(l)} → 回落检测`);

  console.log("\n── 前提: detectLyricLang 对这些语言的信息量是零(全部回 en)");
  ok(detect("Dh'fhalbh mo ghaol") === "en", "苏格兰盖尔语(gd) 被 detect 成 en");
  ok(detect("Ṣàngó ni mo bá") === "en", "约鲁巴语(yo) 被 detect 成 en");
  ok(detect("In cuicatl in xochitl") === "en", "纳瓦特尔语(nah) 被 detect 成 en");
  ok(detect("Veni vidi vici") === "en", "拉丁语(la) 被 detect 成 en");
  ok(detect("Tôi yêu tiếng Việt") === "en", "越南语(vi) 被 detect 成 en");
  ok(detect("አማርኛ ቋንቋ") === "en", "阿姆哈拉语(am) 被 detect 成 en(埃塞俄比亚字母连分支都没有)");
  console.log("\n── 字形能认出来的, 仍然认得出(没被这次改动波及)");
  ok(detect("明月几时有") === "zh", "汉字 → zh");
  ok(detect("さくら さくら") === "ja", "假名 → ja");
  ok(detect("아리랑") === "ko", "韩文 → ko");

  console.log("\n── 旧白名单判据必须不再被用于「这是不是真语言」");
  ok(!/realLangCodes\.has\(String\(tr\.lang\)\)\s*\?/.test(src), "realLangCodes.has(tr.lang) ? … 已不在代码里");
}

console.log(`\n结果: 通过 ${pass} · 失败 ${fail}`);
if (CAL) {
  if (fail > 0) { console.log("CALIBRATE ✅ 读 HEAD 确实失败了 —— 判据是真在跑"); process.exit(0); }
  console.log("CALIBRATE ❌ 读 HEAD 竟然全过 —— 判据是假的"); process.exit(1);
}
process.exit(fail ? 1 : 0);
