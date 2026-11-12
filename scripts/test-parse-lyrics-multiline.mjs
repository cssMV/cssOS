#!/usr/bin/env node
// W2302 回归: parseLyricsToSections 必须认【跨多行的方括号块】。
//
// 从 src/index.ts 现场抽函数体跑(平台既有做法, 同 test-takes-duration.mjs)——
// 不复制一份会过期的副本, 所以它永远跟着真源走。
//
// CALIBRATE=1 时改抽 `git show HEAD:src/index.ts`, 那一版【必须有用例失败】。
// 两头都验(W2298 第 7 条): 只验「修后通过」分不清「测试有效」和「测试恒通过」。
//
// 用法:  node scripts/test-parse-lyrics-multiline.mjs
//        CALIBRATE=1 node scripts/test-parse-lyrics-multiline.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, "..");
const CAL = process.env.CALIBRATE === "1";

let src;
if (CAL) {
  try {
    src = execFileSync("git", ["show", "HEAD:src/index.ts"], { cwd: repo, encoding: "utf8", maxBuffer: 64 << 20 });
  } catch (e) {
    console.error("校准模式取不到 HEAD:src/index.ts —— " + e.message);
    process.exit(2);
  }
} else {
  src = fs.readFileSync(path.join(repo, "src", "index.ts"), "utf8");
}

const from = src.indexOf("const SECTION_KEYWORD_RE");
const to = src.indexOf("// ── LLM emotion annotation");
if (from < 0 || to < 0 || to <= from) {
  console.error("抽不到 parseLyricsToSections —— src/index.ts 结构变了, 先去看真源, 不要猜。");
  process.exit(2); // 2 = 判不了, 不是通过
}

const js = src.slice(from, to)
  .replace("const stripTokenMarkup = (s: string) =>", "const stripTokenMarkup = (s) =>")
  .replace("function isJunkSubtitleToken(s: string): boolean {", "function isJunkSubtitleToken(s) {")
  .replace("function parseLyricsToSections(text: string): LyricsSection[] {", "function parseLyricsToSections(text) {")
  .replace("function foldMultilineBracketBlocks(text: string): string {", "function foldMultilineBracketBlocks(text) {")
  .replace("const sections: LyricsSection[] = [];", "const sections = [];")
  .replace("let lines: string[] = [];", "let lines = [];")
  .replace("const out: string[] = [];", "const out = [];");

const mod = await import("data:text/javascript," + encodeURIComponent(js + "\nexport { parseLyricsToSections };\n"));
const parse = mod.parseLyricsToSections;

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

console.log("");
console.log(`${CAL ? "【校准模式 · 读 git HEAD】" : "【当前工作区】"} 通过 ${pass} · 失败 ${fail} · 共 ${pass + fail}`);

if (CAL) {
  const core = results.find((r) => r.name.startsWith("跨行方括号块的说明不进歌词"));
  if (core && core.ok) {
    console.log("❌ 校准没过: HEAD 那一版【也通过了】核心用例 —— 说明这个测试没在测本次改动。");
    process.exit(1);
  }
  console.log("✅ 校准通过: HEAD 那一版在核心用例上失败, 本次改动确实是它修的。");
  process.exit(0);
}
process.exit(fail === 0 ? 0 : 1);
