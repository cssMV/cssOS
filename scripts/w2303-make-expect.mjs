// 从【真源抽出的真函数】算出每个作品修复前/后的正文, 产出验收用的 expect JSON。
// 黑名单不是关键词, 是【这一次实际被剔掉的那些行】自己的内容片段 ——
// 片段取「冒号后的前 40 字」, 因为字幕管线会把 `*\[Video Prompt: ` 这种前缀剥掉。
import fs from "node:fs";
const src = fs.readFileSync("src/index.ts", "utf8");
const from = src.indexOf("const SECTION_KEYWORD_RE"), to = src.indexOf("// ── LLM emotion annotation");
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
if (!base.includes(CALL)) { console.error("抽不到 normalize 调用 —— 真源变了, 停手"); process.exit(2); }
const mk = (js) => import("data:text/javascript," + encodeURIComponent(js + "\nexport { parseLyricsToSections };"));
const now = await mk(base);
const before = await mk(base.replace(CALL, 'for (const raw of foldMultilineBracketBlocks(text).split("\\n")) {'));
const out = {};
for (const [w8, f] of JSON.parse(process.argv[2])) {
  const txt = fs.readFileSync(f, "utf8");
  const body = (m) => m.parseLyricsToSections(txt).flatMap(s => s.lines).filter(l => l.trim());
  const B = body(before), N = body(now);
  const gone = B.filter(l => !N.includes(l));
  const frag = gone.map(l => {
    let s = l.trim().replace(/^[*_#\s]+/, "").replace(/^\\?[\[【]/, "");
    const c = s.indexOf(":"); if (c >= 0 && c < 30) s = s.slice(c + 1);
    return s.trim().slice(0, 40);
  }).filter(s => s.length >= 20);
  out[w8] = { expect_lines: N.length, before_lines: B.length, removed: gone.length, blacklist: frag };
  console.error(`${w8}: ${B.length} → ${N.length} (剔 ${gone.length}), 黑名单 ${frag.length} 条`);
}
console.log(JSON.stringify(out, null, 1));
