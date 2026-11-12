import fs from "node:fs";
const src = fs.readFileSync("src/index.ts", "utf8");
const from = src.indexOf("const SECTION_KEYWORD_RE");
const to = src.indexOf("// ── LLM emotion annotation");
const base = src.slice(from, to)
  .replace("const stripTokenMarkup = (s: string) =>", "const stripTokenMarkup = (s) =>")
  .replace("function isJunkSubtitleToken(s: string): boolean {", "function isJunkSubtitleToken(s) {")
  .replace("function parseLyricsToSections(text: string): LyricsSection[] {", "function parseLyricsToSections(text) {")
  .replace("function foldMultilineBracketBlocks(text: string): string {", "function foldMultilineBracketBlocks(text) {")
  .replace("function unescapeBracketMarkup(text: string): string {", "function unescapeBracketMarkup(text) {")
  .replace("function normalizeLyricMarkupForParsing(text: string): string {", "function normalizeLyricMarkupForParsing(text) {")
  .replace("const sections: LyricsSection[] = [];", "const sections = [];")
  .replace("let lines: string[] = [];", "let lines = [];")
  .replace("const out: string[] = [];", "const out = [];");
const CALL = 'for (const raw of normalizeLyricMarkupForParsing(text).split("\\n")) {';
const mk = (js) => import("data:text/javascript," + encodeURIComponent(js + "\nexport { parseLyricsToSections };"));
const now  = await mk(base);
const before = await mk(base.replace(CALL, 'for (const raw of foldMultilineBracketBlocks(text).split("\\n")) {'));  // 只有 W2302 折叠, 没有 W2303 解转义
const txt = fs.readFileSync(process.argv[2], "utf8");
const body = (m) => m.parseLyricsToSections(txt).flatMap(s => s.lines).filter(l => l.trim());
const B = body(before), N = body(now);
const gone = B.filter(l => !N.includes(l));
console.log(`修复前正文 ${B.length} 行 → 修复后 ${N.length} 行 (剔掉 ${gone.length} 行)`);
for (const l of gone) console.log("  剔掉: " + l.trim().slice(0, 84));
console.log("--- 修复后仍在正文里、但不像歌词的 ---");
for (const l of N) if (/Instrumentation|Video Prompt|Style of Music|Inspired by/.test(l)) console.log("  仍在: " + l.trim().slice(0, 84));
