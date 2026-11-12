#!/usr/bin/env node
// W2302 回归: parseLyricsToSections 必须认【跨多行的方括号块】。
//
// 从 src/index.ts 现场抽函数体跑(平台既有做法, 同 test-takes-duration.mjs)——
// 不复制一份会过期的副本, 所以它永远跟着真源走。
//
// CALIBRATE=1 读【同一份真源】, 但把折叠那一步旁路掉 —— 核心用例【必须失败】。
// 两头都验(W2298 第 7 条): 只验「修后通过」分不清「测试有效」和「测试恒通过」。
//
// ⚠ 为什么不用 `git show HEAD:src/index.ts` 当基线: 我第一版就是那样写的, 结果
//    修复一提交, HEAD 自己就带上了折叠, 校准当场失效(它报「HEAD 也通过了」)。
//    **基线不能跟着 git 走。** 旁路真源里那一行调用, 基线就永远是「修复前的行为」。
//
// 用法:  node scripts/test-parse-lyrics-multiline.mjs
//        CALIBRATE=1 node scripts/test-parse-lyrics-multiline.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, "..");
const CAL = process.env.CALIBRATE === "1";

const src = fs.readFileSync(path.join(repo, "src", "index.ts"), "utf8");

const from = src.indexOf("const SECTION_KEYWORD_RE");
const to = src.indexOf("// ── LLM emotion annotation");
if (from < 0 || to < 0 || to <= from) {
  console.error("抽不到 parseLyricsToSections —— src/index.ts 结构变了, 先去看真源, 不要猜。");
  process.exit(2); // 2 = 判不了, 不是通过
}

let js = src.slice(from, to)
  .replace("const stripTokenMarkup = (s: string) =>", "const stripTokenMarkup = (s) =>")
  .replace("function isJunkSubtitleToken(s: string): boolean {", "function isJunkSubtitleToken(s) {")
  .replace("function parseLyricsToSections(text: string): LyricsSection[] {", "function parseLyricsToSections(text) {")
  .replace("function foldMultilineBracketBlocks(text: string): string {", "function foldMultilineBracketBlocks(text) {")
  .replace("function unescapeBracketMarkup(text: string): string {", "function unescapeBracketMarkup(text) {")
  .replace("function normalizeLyricMarkupForParsing(text: string): string {", "function normalizeLyricMarkupForParsing(text) {")
  .replace("const sections: LyricsSection[] = [];", "const sections = [];")
  .replace("let lines: string[] = [];", "let lines = [];")
  .replace("const out: string[] = [];", "const out = [];");

if (CAL) {
  // 旁路折叠 = 回到修复前的行为。基线固定在【代码语义】上, 不在 git 位置上。
  const CALL = 'for (const raw of normalizeLyricMarkupForParsing(text).split("\\n")) {';
  const BARE = 'for (const raw of text.split("\\n")) {';
  if (!js.includes(CALL)) {
    console.error("校准模式找不到 normalize 那一行调用 —— 真源结构变了, 先去看它, 不要猜。");
    process.exit(2);
  }
  js = js.replace(CALL, BARE);
}

const mod = await import("data:text/javascript," + encodeURIComponent(
  js + "\nexport { parseLyricsToSections };\n"
     + "export const __fold = typeof foldMultilineBracketBlocks === 'function' ? foldMultilineBracketBlocks : null;\n"
     + "export const __unesc = typeof unescapeBracketMarkup === 'function' ? unescapeBracketMarkup : null;\n"));
const parse = mod.parseLyricsToSections;
// 校准模式用 identity 代替折叠, 而不是 null —— 这样用例条数两种模式一致(都是 11 条),
// 第 8 组在校准模式下自然失败(没折叠就会漏), 「对照」和「幂等」两条仍跑得到。
//
// ⚠ 诚实说明: 第 8 组校准到的是【折叠这一步】, 校准不到 resubtitle / 生成管线里
//   那两行 `reLyrics = foldMultilineBracketBlocks(reLyrics)` 的接线 —— 它们埋在
//   两个大 handler 里, 抽不出来单测。那两行只有线上实跑能验(见 W2302 的提交说明)。
const fold = CAL ? ((t) => t) : mod.__fold;
const unesc = CAL ? ((t) => t) : mod.__unesc;

const bodyOf = (secs) => secs.flatMap((s) => s.lines);
const flat = (secs) => bodyOf(secs).join("\n");

let pass = 0, fail = 0;
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? "✅" : "❌"} ${name}${detail && !ok ? "\n       " + detail : ""}`);
}

// ── 1. 核心: 跨行方括号块的内容【不得】进歌词 ───────────────────────────────
// 这是《祇園精舎の鐘の声》的真实形状(实测那段说明被唱了 253 秒)。
const GION = `[Act I – Scene I]

[Scene Description:
The stage opens in dim gold and shadow. At the rear, a large bronze temple bell looms.
Lighting moves between warm temple gold and the cold steel gleam of war.]

[Style of Music:
Hybrid of traditional Heike biwa narrative chanting. Tempo: 56 BPM, solemn.]

[Instrumentation:
	•	Lead: Heike biwa, voice of the biwa Shōshi
	•	Ambient: Faint wind over a battlefield, occasional neigh of a distant warhorse]

[Verse 1]
祇園精舎の鐘の声
諸行無常の響きあり

[Chorus]
鐘は深く　海よりも重く
無常の響きよ`;

{
  const body = flat(parse(GION));
  const leaked = [
    "The stage opens",
    "Lighting moves between",
    "Hybrid of traditional",
    "Lead: Heike biwa",
    "Ambient: Faint wind",
  ].filter((s) => body.includes(s));
  check("跨行方括号块的说明不进歌词(祇園真实数据)", leaked.length === 0,
    `泄漏 ${leaked.length} 处: ${leaked.join(" | ")}`);
}
{
  // 真歌词必须一行不少
  const body = bodyOf(parse(GION)).map((l) => l.trim()).filter(Boolean);
  const want = ["祇園精舎の鐘の声", "諸行無常の響きあり", "鐘は深く　海よりも重く", "無常の響きよ"];
  const missing = want.filter((w) => !body.includes(w));
  check("真歌词一行不少(4 行)", missing.length === 0 && body.length === 4,
    `得到 ${body.length} 行 ${JSON.stringify(body)}; 缺 ${JSON.stringify(missing)}`);
}

// ── 2. 单行方括号的行为【不得】改变 ─────────────────────────────────────────
{
  // ⚠ 歌词行别用段落关键词开头: `hook a` 会被 SECTION_KEYWORD_RE 当成段落头
  //   (hook/verse/chorus/bridge/主歌/副歌… 都在里面)。这是既有行为, HEAD 上一样,
  //   我第一版用例就栽在这, 靠「校准模式里它也失败」才看出不是本次改动的锅。
  const t = "[Verse 1]\nline one\nline two\n\n[Chorus]\nsing it loud\nsing it twice";
  const secs = parse(t);
  const tags = secs.map((s) => s.tag);
  check("单行 [Verse 1]/[Chorus] 照旧",
    tags.join(",") === "Verse 1,Chorus"
      && bodyOf(secs).join("|") === "line one|line two|sing it loud|sing it twice",
    `tags=${JSON.stringify(tags)} body=${JSON.stringify(bodyOf(secs))}`);
}

// ── 3. 保守回退: 块一直不闭合 → 保持原行为, 不许把整首歌吞掉 ────────────────
{
  const many = Array.from({ length: 30 }, (_, i) => `真歌词第 ${i + 1} 行`);
  const t = "[Scene Description:\n" + many.join("\n");
  const body = bodyOf(parse(t)).map((l) => l.trim()).filter(Boolean);
  check("块超过 20 行不闭合 → 不折叠, 30 行一行不丢", body.length === 30,
    `只剩 ${body.length} 行`);
}

// ── 4. 保守回退: 块没闭合就来了下一个标记 → 不折叠 ──────────────────────────
{
  const t = "[Scene Description:\n[Verse 1]\n歌词甲\n歌词乙";
  const body = bodyOf(parse(t)).map((l) => l.trim()).filter(Boolean);
  check("块没闭合就遇到下一个标记 → 歌词不丢", body.includes("歌词甲") && body.includes("歌词乙"),
    `得到 ${JSON.stringify(body)}`);
}

// ── 5. 全角【】的跨行块同样要折叠 ───────────────────────────────────────────
{
  const t = "【场景说明：\n舞台在暗金色里打开, 后方悬着一口青铜钟。\n灯光在庙宇的暖金与战场的冷钢之间移动。】\n\n[Verse 1]\n真歌词一行";
  const body = flat(parse(t));
  check("全角【】跨行块也折叠",
    !body.includes("舞台在暗金色里打开") && !body.includes("灯光在庙宇的暖金"),
    `泄漏: ${JSON.stringify(bodyOf(parse(t)))}`);
}

// ── 6. 空文本 / 无标记的兜底不变 ────────────────────────────────────────────
{
  const secs = parse("没有任何标记的一行\n还有一行");
  check("无标记 → 兜底成一个 Verse 1 节",
    secs.length === 1 && secs[0].tag === "Verse 1" && secs[0].lines.length === 2,
    JSON.stringify(secs));
}

// ── 7. 【现状记录, 不是修复】单行方括号 + 行内还有字 → 行内文字仍被丢弃 ──────
// 这是同一个函数的另一面(W2300 差点踩): `[Carmen Sacrum] Iuppiter…` 的咒语会整句消失。
// 本次指令只修跨行块, 没授权改这一面。这条用例把【现状】钉住:
// 将来若有人修了它, 这条会失败并提醒去更新它, 而不是悄悄改掉行为。
{
  const t = "[Carmen Sacrum] Iuppiter omnipotens, audi nos\n[Verse 1]\n正经歌词";
  const body = bodyOf(parse(t)).map((l) => l.trim()).filter(Boolean);
  const swallowed = !body.some((l) => l.includes("Iuppiter"));
  check("(现状)单行方括号的行内文字仍被丢弃 —— 本次未授权修", swallowed,
    `它不再被丢弃了 —— 如果这是故意修的, 请更新这条用例。得到 ${JSON.stringify(body)}`);
}

// ── 8. 对齐侧: 折叠之后, 「以 [ 开头的行」过滤才真剔得掉说明 ────────────────
// 为什么这条单独存在: 只修 parseLyricsToSections【不够】。
//   · buildSubtitleSections 经它 → 字幕行是好的
//   · 但 alignWordsViaWhisper 的 refText 吃 reLyrics【全文】, forceEven 路径的
//     _body 也是 `reLyrics.split("\n").filter(l => !/^\s*[\[【〔]/.test(l))` ——
//     跨行块的第二行起【不以 [ 开头】, 两条路径都剔不掉它, 于是说明被当歌词算时间。
// 下面这个过滤表达式就是 src/index.ts 里那两处用的判据(判据简单, 复制它可接受;
// 被测的 fold 仍是从真源抽的)。
{
  const DROP_BRACKET_LINES = (t) =>
    t.split("\n").filter((l) => !/^\s*[\[【〔]/.test(l)).join(" ").trim();
  if (!fold) {
    check("折叠后 refText/_body 不含说明(对齐侧)", false,
      "抽不到 foldMultilineBracketBlocks —— 真源里没有它");
  } else {
    const body = DROP_BRACKET_LINES(fold(GION));
    const leaked = ["The stage opens", "Lighting moves", "Hybrid of traditional",
                    "Lead: Heike biwa", "Ambient: Faint wind"].filter((s) => body.includes(s));
    check("折叠后 refText/_body 不含说明(对齐侧)", leaked.length === 0,
      `泄漏 ${leaked.length} 处: ${leaked.join(" | ")}`);
    // 同时: 不折叠的话必须是漏的 —— 证明这条用例测的就是折叠
    const raw = DROP_BRACKET_LINES(GION);
    check("(对照)不折叠时 refText 确实会漏进说明", raw.includes("The stage opens"),
      "不折叠也不漏? 那这条用例测不到东西");
  }
  if (fold) {
    check("折叠是幂等的", fold(fold(GION)) === fold(GION), "折叠两次结果不同");
  }
}

// ── 第 9 组 · W2303 转义方括号 ──────────────────────────────────────────────
// 取自真歌词《Whispers of the Dragon Reborn》(a45dfee6)。这一组的要害不是
// 「把说明认出来」, 而是【不要误伤同一首歌里那行单星号包着的真歌词】。
const DRAGON = [
  "### \\[Style of Music]",
  "",
  "### \\[Verse 1: Echoes on the Wind]",
  "",
  "*\\[Instrumentation: Whispering flute, dulcimer tremolos, low synth pads]*",
  "**\\[Spoken whispers in the Old Tongue:]**",
  "*\u201CAl\u2019Thor\u2026 he walks again\u2026*",
  "*The Dragon breathes\u2026 in silence still.\u201D*",
  "",
  "**\\[English:]**",
  "In the breeze that touches no leaf,",
  "In the hush that follows thunder,",
  "",
  "\\[Video Prompt: Aerial shot of Two Rivers under twilight fog; a heron-marked sword rests on the wall.]",
].join("\n");
{
  const body = flat(parse(DRAGON));
  // ① 两类【现在会漏】的转义方括号, 修完必须都不在歌词里
  check("W2303 单星号包的转义方括号(配器)不进歌词", !body.includes("Instrumentation"),
    `泄漏: ${body.split("\n").filter((l) => l.includes("Instrumentation")).join(" | ")}`);
  check("W2303 裸转义方括号(分镜 Prompt)不进歌词", !body.includes("Video Prompt"),
    `泄漏: ${body.split("\n").filter((l) => l.includes("Video Prompt")).join(" | ")}`);
  // ② 最要紧的一条: 单星号包的【真歌词】必须原样还在
  check("W2303 单星号包的真歌词仍是歌词(不被误伤)",
    body.includes("Al\u2019Thor") && body.includes("The Dragon breathes"),
    "把 *\u201CAl\u2019Thor\u2026* 这行误判成标记了 —— 这正是修法不能按星号判的原因");
  check("W2303 普通歌词行不受影响",
    body.includes("In the breeze that touches no leaf,") && body.includes("In the hush that follows thunder,"),
    "正常歌词行丢了");
  // ③ 对齐侧(refText / _body)同样要干净 —— 只修 parse 不够, W2302 已经栽过一次
  if (unesc && fold) {
    // 复刻对齐侧那两条过滤(src/index.ts 的 refText / forceEven `_body`): 丢掉以方括号开头的行
    const dropBr = (t) => t.split("\n").filter((l) => !/^\s*[\[【〔]/.test(l)).join(" ").trim();
    const ref = dropBr(fold(unesc(DRAGON)));
    const leak = ["Instrumentation", "Video Prompt"].filter((k) => ref.includes(k));
    check("W2303 对齐侧 refText 也不含转义说明", leak.length === 0, `泄漏: ${leak.join(" | ")}`);
    check("W2303 解转义是幂等的", unesc(unesc(DRAGON)) === unesc(DRAGON), "解两次结果不同");
  }
  // ④ 已知仍会漏的第三类 —— 写成【显式期望】, 将来修好了这条会失败, 提醒更新文档
  const PROSE = ["### \\[Style of Music]", "",
    "**A dark, mysterious blend of Celtic folk.** Inspired by *Dead Can Dance*."].join("\n");
  check("(已知未修)部分加粗的散文说明仍会进歌词 —— 第三类, 不是转义括号",
    flat(parse(PROSE)).includes("Inspired by"),
    "它不漏了? 说明第三类也被捎带修了 —— 去更新 CLAUDE.md / 记忆, 别让文档停在旧结论");
}

console.log("");
console.log(`${CAL ? "【校准模式 · 旁路折叠】" : "【当前工作区】"} 通过 ${pass} · 失败 ${fail} · 共 ${pass + fail}`);

if (CAL) {
  const core = results.find((r) => r.name.startsWith("跨行方括号块的说明不进歌词"));
  if (core && core.ok) {
    console.log("❌ 校准没过: 旁路折叠之后【核心用例也通过了】—— 这个测试没在测折叠。");
    process.exit(1);
  }
  console.log("✅ 校准通过: 旁路折叠后核心用例失败, 说明它测的就是折叠这一步。");
  process.exit(0);
}
process.exit(fail === 0 ? 0 : 1);
