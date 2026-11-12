#!/usr/bin/env node
// W2301 探针: 把【真实歌词】喂给【src/index.ts 里那个真函数】, 看它解析成什么。
//
// 为什么要这样跑, 而不是读代码推理:
//   W1960 的教训是「先找再动」, 这里是它的姊妹条 —— 判一个解析器的行为, 只能让它真跑一遍。
//   我推理出「跨行方括号块会把后续行当歌词」, 但只有喂进真数据才看到它具体吃掉了哪几行、
//   以及【我自己的尺子漏报了哪两行】(含非拉丁括号的 • Support: / • Percussion:)。
//
// 用法:  node scripts/w2301-parse-lyrics-probe.mjs <歌词文本文件>
// 它从 src/index.ts 现场抽函数体, 所以永远跟着真源走, 不会抽成一份会过期的副本。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(here, "..", "src", "index.ts");
const src = fs.readFileSync(srcPath, "utf8");

const from = src.indexOf("const SECTION_KEYWORD_RE");
const to = src.indexOf("// ── LLM emotion annotation");
if (from < 0 || to < 0 || to <= from) {
  console.error("抽不到 parseLyricsToSections —— src/index.ts 结构变了, 先去看真源, 不要猜。");
  process.exit(2);     // 2 = 判不了, 不是通过
}

// 只去 TS 类型注解, 其余一个字不改
const js = src.slice(from, to)
  .replace("const stripTokenMarkup = (s: string) =>", "const stripTokenMarkup = (s) =>")
  .replace("function isJunkSubtitleToken(s: string): boolean {", "function isJunkSubtitleToken(s) {")
  .replace("function parseLyricsToSections(text: string): LyricsSection[] {", "function parseLyricsToSections(text) {")
  .replace("function foldMultilineBracketBlocks(text: string): string {", "function foldMultilineBracketBlocks(text) {")
  .replace("function unescapeBracketMarkup(text: string): string {", "function unescapeBracketMarkup(text) {")
  .replace("function normalizeLyricMarkupForParsing(text: string): string {", "function normalizeLyricMarkupForParsing(text) {")
  .replace("const out: string[] = [];", "const out = [];")
  .replace("const sections: LyricsSection[] = [];", "const sections = [];")
  .replace("let lines: string[] = [];", "let lines = [];");

const mod = await import("data:text/javascript," + encodeURIComponent(
  js + "\nexport { parseLyricsToSections };\n"));

const file = process.argv[2];
if (!file) { console.error("用法: node scripts/w2301-parse-lyrics-probe.mjs <歌词文本文件>"); process.exit(2); }
const text = fs.readFileSync(file, "utf8");

// 先量一遍【哪些行是跨行方括号块的开头】—— 形状判据, 不用关键词(关键词永远列不全)
const openUnclosed = text.split("\n").filter((l) => /^\s*\[[^\]]*$/.test(l));

const secs = mod.parseLyricsToSections(text);
console.log(`解析出 ${secs.length} 节 · 文本里【以 [ 开头但同行无 ]】的行: ${openUnclosed.length}`);
if (openUnclosed.length) {
  console.log("  这些块的第二行起会全部变成歌词:");
  for (const l of openUnclosed) console.log(`    ${l.trim().slice(0, 80)}`);
}
console.log("");

let suspect = 0;
for (const s of secs) {
  console.log(`  [${s.tag}]  (${s.lines.length} 行)`);
  for (const l of s.lines) {
    const letters = l.replace(/[^\p{L}\p{N}]/gu, "");
    const latin = letters.length ? l.replace(/[^A-Za-z]/g, "").length / letters.length : 0;
    // ⚠ 这把尺子会【漏报】含非拉丁括号的说明行(• Support: Shō (笙)… 拉丁比例不到 0.9),
    //    也会【误伤】京典咒语行(古语：… / Latin: "…" —— 那些是真歌词, 要唱的)。
    //    两类一把尺子分不开, 长度也分不开。所以它只是【提请人眼看】, 不是判决。
    const flag = l.length > 40 && latin > 0.9 ? "   <<<< 疑似制作说明(需人眼)" : "";
    if (flag) suspect++;
    console.log(`        ${l.slice(0, 110)}${flag}`);
  }
}
console.log(`\n疑似制作说明 ${suspect} 行 —— 这个数会偏小, 别拿它当上限。`);
