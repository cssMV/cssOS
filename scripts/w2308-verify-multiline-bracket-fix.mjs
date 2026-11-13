#!/usr/bin/env node
/**
 * W2308 —— 实测验证: 解析器那一处修复(W2302 折叠 + W2303 解转义)到底有没有解掉
 *          那 83 个作品里的跨行方括号块(其中 77 个当时只是【延时雷】, 还没发作)。
 *
 * Jing 2026-11-13:「77 个还埋着跨行方括号块的作品。按你的建议做。」
 * 我当时的建议原文:「只修解析器(加块状态机, 认跨行方括号)—— 一处修, 83 个作品连带
 * 那 77 个雷一起解决, 不动任何歌词, 然后给这 6 条重做字幕。」
 * 解析器已修(W2302/W2303, 线上 dist 里两个函数都在), 6 条字幕也重做过。
 * **剩下的就是把「一处修连带解掉 77 个」这句话真的验出来** —— 不是推理, 是跑真函数。
 *
 * 判法(两头都判, 同 scripts/test-clamp-sections-line-level.mjs):
 *   · 修后 = 从 src/index.ts 抽出真函数体跑
 *   · 修前 = 把 parseLyricsToSections 里那一句 normalizeLyricMarkupForParsing(text)
 *            换回 text(逐字回到修复前), 其余一个字不动
 *   · 对每个作品比两边的 lines: 修前多出来的那些行就是【曾经被唱出来的说明】
 *
 * 另有一道【独立判据】, 不信两边的 diff, 自己从原文找块:
 *   以 [ 开头且本行没有闭合的行 → 往后找第一个带闭合的行(不设上限, 不因遇到下一个开括号而停)
 *   → 块内的那些行, 修后【一行都不许出现在 lines 里】。
 *   折叠本身有两条保守回退(超 20 行 / 中途又遇开括号就不折叠), 这道判据正是为了
 *   把那两条回退漏下的残留揪出来 —— 用折叠自己的规则去验折叠, 等于没验。
 *
 * 读库只读不写。CALIBRATE 不适用(这里本来就两头都跑)。
 */
import fs from "node:fs";

const SRC = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const DATA = process.argv[2];
if (!DATA) { console.error("用法: node w2308-verify-multiline-bracket-fix.mjs <previews.json>"); process.exit(2); }

/* ── 抽真函数体 ───────────────────────────────────────────────────────────── */
const A = "// ── Parse raw lyrics text → sections/lines";
const B = "// ── LLM emotion annotation";
const ia = SRC.indexOf(A), ib = SRC.indexOf(B);
if (ia < 0 || ib < 0 || ib <= ia) { console.error("‼ 抽不出解析器那一段 —— 判不了"); process.exit(2); }
let body = SRC.slice(ia, ib);

const detype = (s) => s
  .replace(/function foldMultilineBracketBlocks\(text: string\): string/, "function foldMultilineBracketBlocks(text)")
  .replace(/function unescapeBracketMarkup\(text: string\): string/, "function unescapeBracketMarkup(text)")
  .replace(/function normalizeLyricMarkupForParsing\(text: string\): string/, "function normalizeLyricMarkupForParsing(text)")
  .replace(/function parseLyricsToSections\(text: string\): LyricsSection\[\]/, "function parseLyricsToSections(text)")
  .replace(/const sections: LyricsSection\[\] = \[\]/, "const sections = []")
  .replace(/let lines: string\[\] = \[\]/, "let lines = []")
  .replace(/const out: string\[\] = \[\]/, "const out = []")
  .replace(/const stripTokenMarkup = \(s: string\)/, "const stripTokenMarkup = (s)")
  .replace(/function isJunkSubtitleToken\(s: string\): boolean/, "function isJunkSubtitleToken(s)")
  .replace(/\(\(l: string\)/g, "((l)")
  .replace(/\(l: string\)/g, "(l)");

const FIXED_CALL = 'for (const raw of normalizeLyricMarkupForParsing(text).split("\\n"))';
const PLAIN_CALL = 'for (const raw of text.split("\\n"))';
if (!body.includes(FIXED_CALL)) { console.error("‼ 找不到修后那一句 —— 判不了"); process.exit(2); }

const mk = async (src, label) => {
  const js = detype(src) + "\nexport { parseLyricsToSections, normalizeLyricMarkupForParsing };\n";
  if (/:\s*(string|boolean|number)\b/.test(js.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""))) {
    console.error(`‼ ${label}: 去类型没干净 —— 判不了`); process.exit(2);
  }
  try { return await import("data:text/javascript," + encodeURIComponent(js)); }
  catch (e) { console.error(`‼ ${label}: 导入失败 ${String(e).slice(0, 160)} —— 判不了`); process.exit(2); }
};

const POST = await mk(body, "修后");
const PRE  = await mk(body.replace(FIXED_CALL, PLAIN_CALL), "修前");

/* ── 独立判据: 从原文自己找跨行方括号块 ───────────────────────────────────── */
const OPENS = (l) => /^\s*[\[【〔]/.test(l) && !/[\]】〕」』]/.test(l);
const CLOSES = (l) => /[\]】〕」』]/.test(l);
const FOLD_MAX = 20;   // 与 src 里的 MULTILINE_BRACKET_MAX_LINES 一致

function findBlocks(text) {
  const src = String(text || "").split("\n");
  const blocks = [];
  for (let i = 0; i < src.length; i++) {
    if (!OPENS(src[i])) continue;
    let close = -1, interveningOpen = false;
    for (let j = i + 1; j < src.length; j++) {
      if (OPENS(src[j])) { interveningOpen = true; }
      if (CLOSES(src[j])) { close = j; break; }
    }
    if (close < 0) { blocks.push({ open: i, close: -1, kind: "never-closed", body: [] }); continue; }
    const span = close - i;
    const body = src.slice(i + 1, close + 1);
    // 折叠自己会不会接手: 要求 ≤20 行【且】中途没有另一个开括号行
    let foldTakes = span <= FOLD_MAX;
    for (let j = i + 1; j < close; j++) if (OPENS(src[j])) foldTakes = false;
    blocks.push({ open: i, close, kind: foldTakes ? "fold-takes" : "fold-skips", span, body, interveningOpen });
  }
  return blocks;
}

const flat = (secs) => secs.flatMap((s) => s.lines.map((l) => l.trim())).filter(Boolean);

/* ── 跑 ───────────────────────────────────────────────────────────────────── */
const works = JSON.parse(fs.readFileSync(DATA, "utf8"));
let nFixed = 0, nClean = 0, residual = [], neverClosed = [], foldSkips = [], unjudgeable = [];
const rows = [];

for (const w of works) {
  const text = String(w.lyrics_preview || "");
  if (!text.trim()) { unjudgeable.push([w.id, w.title, "preview 是空的"]); continue; }
  let pre, post;
  try { pre = flat(PRE.parseLyricsToSections(text)); post = flat(POST.parseLyricsToSections(text)); }
  catch (e) { unjudgeable.push([w.id, w.title, "解析抛错 " + String(e).slice(0, 80)]); continue; }

  const blocks = findBlocks(text);
  const postSet = new Set(post);
  // ① 块内的行, 修后还在 lines 里的 —— 残留泄漏
  const stillLeaking = [];
  for (const b of blocks) {
    for (const bl of b.body) {
      const t = bl.trim();
      if (t && postSet.has(t)) stillLeaking.push({ kind: b.kind, span: b.span, line: t });
    }
  }
  // ② 修前多出来的行 —— 这就是修复实际拦下来的量
  const postCount = new Map();
  for (const l of post) postCount.set(l, (postCount.get(l) || 0) + 1);
  const removed = [];
  for (const l of pre) {
    const c = postCount.get(l) || 0;
    if (c > 0) postCount.set(l, c - 1); else removed.push(l);
  }

  const nc = blocks.filter((b) => b.kind === "never-closed").length;
  const fs_ = blocks.filter((b) => b.kind === "fold-skips").length;
  if (nc) neverClosed.push([w.id, w.title, nc]);
  if (fs_) foldSkips.push([w.id, w.title, fs_]);
  if (stillLeaking.length) residual.push([w.id, w.title, stillLeaking]);
  if (removed.length) nFixed++; else nClean++;

  rows.push({ id: String(w.id).slice(0, 8), title: String(w.title || "").slice(0, 34),
              blocks: blocks.length, pre: pre.length, post: post.length,
              removed: removed.length, residual: stillLeaking.length, removedSample: removed.slice(0, 2) });
}

console.log("清单 %d 个作品(lyrics_preview 里有「以 [ 开头、本行没闭合」的行)\n", works.length);
/* node 的 console.log 不认 %-9s / %5d 这类宽度说明符(只认 %s %d), 第一版就这么把
 * 格式串原样打了出来。手动 padEnd/padStart, 不靠 printf。 */
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
console.log(pad("work", 10) + pad("title", 36) + rpad("块数", 5) + rpad("修前", 6)
          + rpad("修后", 6) + rpad("少唱", 6) + rpad("残留", 7));
console.log("-".repeat(86));
for (const r of rows) {
  console.log(pad(r.id, 10) + pad(r.title, 36) + rpad(r.blocks, 5) + rpad(r.pre, 6)
            + rpad(r.post, 6) + rpad(r.removed, 6) + rpad(r.residual ? "‼" + r.residual : "0", 7));
}

console.log("\n" + "=".repeat(86));
console.log("修复实际拦下说明行的作品: %d · 本来就不受影响的: %d", nFixed, nClean);
console.log("修后【仍有块内行落进歌词】的作品: %d", residual.length);
for (const [id, t, ls] of residual) {
  console.log("  ‼ %s %s", String(id).slice(0, 8), t);
  for (const x of ls.slice(0, 4)) console.log("        [%s span=%s] %s", x.kind, x.span, x.line.slice(0, 96));
}
console.log("\n折叠【故意不接手】的块(超 %d 行 / 中途又遇开括号): %d 个作品", FOLD_MAX, foldSkips.length);
for (const [id, t, n] of foldSkips) console.log("  · %s %s —— %d 个", String(id).slice(0, 8), t, n);
console.log("\n开了括号但【整份歌词里再也没有闭合】的: %d 个作品(这类折叠一律不动, 要人眼看)", neverClosed.length);
for (const [id, t, n] of neverClosed) console.log("  · %s %s —— %d 处", String(id).slice(0, 8), t, n);
console.log("\n判不了: %d  %s", unjudgeable.length, JSON.stringify(unjudgeable.slice(0, 6)));

/* ── 导出「针」: 修前会被唱出来、修后不会的那些行 ──────────────────────────
 * 下一步拿它去扫线上字幕: 哪些作品【已经发作】(字幕里真留着这些行)。
 * 判泄漏必须拿修前/修后的解析结果比, 不能在成品字幕上按关键词找 ——
 * 字幕管线会把 `[Instrumentation: ` 这类前缀剥掉, 关键词扫必漏一半(W2303 的教训)。 */
const needles = rows.filter((r) => r.removed || r.residual).map((r) => r.id);
fs.writeFileSync(process.argv[3] || "/tmp/w2308-needles.json", JSON.stringify(
  works.map((w) => {
    const text = String(w.lyrics_preview || "");
    if (!text.trim()) return null;
    let pre, post;
    try { pre = flat(PRE.parseLyricsToSections(text)); post = flat(POST.parseLyricsToSections(text)); } catch { return null; }
    const cnt = new Map();
    for (const l of post) cnt.set(l, (cnt.get(l) || 0) + 1);
    const removed = [];
    for (const l of pre) { const c = cnt.get(l) || 0; if (c > 0) cnt.set(l, c - 1); else removed.push(l); }
    const blockBody = findBlocks(text).flatMap((b) => b.body.map((x) => x.trim()).filter(Boolean));
    if (!removed.length && !blockBody.length) return null;
    return { id: w.id, title: w.title, removed, blockBody };
  }).filter(Boolean), null, 1), "utf8");
console.log("\n针已导出: %s", process.argv[3] || "/tmp/w2308-needles.json");
void needles;

const bad = residual.length + unjudgeable.length;
/* 三分法 —— 「83 个作品」里其实混着三件完全不同的事, 一个数字说不清。 */
const ncIds = new Set(neverClosed.map((x) => String(x[0]).slice(0, 8)));
const partA = rows.filter((r) => r.removed > 0 && !r.residual);          // 真·跨行块, 折叠治好了
const partB = rows.filter((r) => r.residual > 0);                        // 修后仍有块内行落进歌词
const partC = rows.filter((r) => r.removed === 0 && !r.residual);        // 本来就不漏
console.log("\n三分法(这三类的成因完全不同, 不要合成一个数):");
/* node 只认 %s / %d, 不认 %2d —— 宽度一律自己 padStart。 */
console.log("  A 真·跨行方括号块, 折叠已治好              " + rpad(partA.length, 3) + " 个作品");
console.log("  B 修后仍有块内行落进歌词                    " + rpad(partB.length, 3) + " 个作品");
console.log("  C 本来就不漏                                " + rpad(partC.length, 3) + " 个作品"
          + "  (其中 " + partC.filter((r) => ncIds.has(r.id)).length
          + " 个的最后一行是半截标记 —— preview 被截断的痕迹)");
console.log("\n汇总: 清单 %d · 实际过 %d %s · 修复生效 %d · 残留 %d · 判不了 %d",
            works.length, rows.length, rows.length === works.length - unjudgeable.length ? "✅无遗漏" : "‼有遗漏",
            nFixed, residual.length, unjudgeable.length);
console.log("VERDICT: W2308-verify 结束(残留 %d / 判不了 %d)", residual.length, unjudgeable.length);
process.exit(bad ? 1 : 0);
