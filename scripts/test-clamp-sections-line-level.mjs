#!/usr/bin/env node
// W2306 回归: 落盘前终检必须【连行级和节级的时间一起收】, 不只收 token。
//
// 为什么这条非测不可: `[Music...]` 器乐段是引擎【唯一直接读行级时间】的那种行
// (app.emotion-subtitle-engine.js 的 _isMusicLine 分支读 line.t_end 当 _me,
// 一个 token 都不看)。只收 token 的终检对它完全无效 —— 而它恰恰是最容易越界的
// 一种行(injectMusicGaps 的尾奏按 duration_secs 画, 那个值常是错的)。
//
// 从 src/index.ts 现场抽函数体跑(平台既有做法, 同 test-parse-lyrics-multiline.mjs)。
// CALIBRATE=1 把行/节那两刀旁路掉 —— 核心用例【必须失败】。基线固定在【代码语义】上,
// 不在 git 位置上(读 HEAD 当基线会在提交那一刻自己失效)。
//
// 用法:  node scripts/test-clamp-sections-line-level.mjs
//        CALIBRATE=1 node scripts/test-clamp-sections-line-level.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, "..");
const CAL = process.env.CALIBRATE === "1";
const src = fs.readFileSync(path.join(repo, "src", "index.ts"), "utf8");

const from = src.indexOf("function clampSectionsToAudioMs<T extends");
const to = src.indexOf("function clampTimelineToAudio(");
if (from < 0 || to < 0 || to <= from) {
  console.error("抽不到 clampSectionsToAudioMs —— src/index.ts 结构变了, 先去看真源, 不要猜。");
  process.exit(2);   // 2 = 判不了, 不是通过
}

let js = src.slice(from, to)
  .replace("function clampSectionsToAudioMs<T extends { lines: Array<{ tokens: Array<any> }> }>(\n  sections: T[], durSec: number | null | undefined,\n): { sections: T[]; dropped: number; clipped: number } {",
           "function clampSectionsToAudioMs(sections, durSec) {")
  .replace("const _clampMs = (v: any): { v: any; hit: boolean } => {", "const _clampMs = (v) => {")
  .replace("const out: T[] = [];", "const out = [];")
  .replace("const lines: any[] = [];", "const lines = [];")
  .replace("const toks: any[] = [];", "const toks = [];")
  .replace("out.push({ ...sec, t_start: _ss.v, t_end: _se.v, lines } as T);", "out.push({ ...sec, t_start: _ss.v, t_end: _se.v, lines });")
  .replace("if (lines.length) out.push({ ...sec, lines } as T);", "if (lines.length) out.push({ ...sec, lines });")
  .replace(/\(ln as any\)/g, "ln")
  .replace(/\(sec as any\)/g, "sec");

if (js.includes(": T[]") || js.includes("as T")) {
  console.error("去类型没去干净 —— 真源签名变了, 先去看它, 不要猜:\n" + js.slice(0, 400));
  process.exit(2);
}

if (CAL) {
  // 旁路【行/节那两刀】= 回到修复前的行为(只收 token)。
  const LINE = "lines.push({ ...ln, t_start: _ls.v, t_end: _le.v, tokens: toks });";
  const SEC  = "out.push({ ...sec, t_start: _ss.v, t_end: _se.v, lines });";
  if (!js.includes(LINE) || !js.includes(SEC)) {
    console.error("校准模式找不到行/节那两刀 —— 真源结构变了, 先去看它, 不要猜。");
    process.exit(2);
  }
  js = js.replace(LINE, "lines.push({ ...ln, tokens: toks });")
         .replace(SEC,  "out.push({ ...sec, lines });");
}

const mod = await import("data:text/javascript," + encodeURIComponent(
  js + "\nexport { clampSectionsToAudioMs };\n"));
const clamp = mod.clampSectionsToAudioMs;

let pass = 0, fail = 0;
const ck = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}\n       得到 ${JSON.stringify(got)}\n       期望 ${JSON.stringify(want)}`); }
};

/* ── 第 1 组: Jerusalem en ♪2 的真实形状 ────────────────────────────────
 * injectMusicGaps 按 duration_secs=422 画了尾奏 → 行/节/token 全是 421750;
 * 真音频 258.57s。终检传入的 durSec 是实测值 259。
 * 修前: token 收到 259000, 行级留 421750 → 引擎读行级 = 越界 163s。 */
console.log("第 1 组 · [Music...] 尾奏行(引擎读行级 t_end)");
{
  const secs = [
    { tag: "", t_start: 27611, t_end: 234262, lines: [
      { text: "We'll dwell in peace forever true", t_start: 181032, t_end: 234258,
        tokens: [{ char: "true", t_start: 233546, t_end: 234262 }] },
    ] },
    { tag: "music", t_start: 234508, t_end: 421750, lines: [
      { text: "[Music...]", t_start: 234508, t_end: 421750, adlib: true,
        tokens: [{ char: "[Music...]", t_start: 234508, t_end: 421750, adlib: true }] },
    ] },
  ];
  const r = clamp(secs, 259);
  const music = r.sections[1];
  ck("尾奏行的【行级】t_end 收到音频末尾", music.lines[0].t_end, 259000);
  ck("尾奏行的 token t_end 同样在界内", music.lines[0].tokens[0].t_end, 259000);
  ck("尾奏【节级】t_end 也收到音频末尾", music.t_end, 259000);
  ck("唱词行一个字没动(本来就在界内)", r.sections[0].lines[0].t_end, 234258);
  ck("唱词节一个字没动", r.sections[0].t_end, 234262);
  // 文件里【任何一个】时间字段都不得超界 —— 这才是那条硬不变量的完整说法
  const all = [];
  for (const s of r.sections) {
    all.push(s.t_start, s.t_end);
    for (const l of s.lines) { all.push(l.t_start, l.t_end); for (const t of l.tokens) all.push(t.t_start, t.t_end); }
  }
  ck("全文件无一字段超界", all.filter((v) => Number.isFinite(v) && v > 259000), []);
}

/* ── 第 2 组: vi ♪2 同形(302 → 301750, 真音频 219.8s) ─────────────────── */
console.log("第 2 组 · vi ♪2 同形");
{
  const secs = [{ tag: "music", t_start: 192661, t_end: 301750, lines: [
    { text: "[Music...]", t_start: 192661, t_end: 301750, adlib: true,
      tokens: [{ char: "[Music...]", t_start: 192661, t_end: 301750, adlib: true }] },
  ] }];
  const r = clamp(secs, 220);
  ck("行级收到 220000", r.sections[0].lines[0].t_end, 220000);
  ck("节级收到 220000", r.sections[0].t_end, 220000);
}

/* ── 第 3 组: 必须【不动】的几种(防过度收紧) ───────────────────────────
 * 这一组在两种模式下都应该通过 —— 它们从来没坏过, 任何一条失败都说明我的修改
 * 伤到了本来正确的行为(W2303 的做法: 陷阱用例两头都验)。 */
console.log("第 3 组 · 陷阱: 本来正确的不许动(两种模式都该过)");
{
  const secs = [{ tag: "", t_start: 1000, t_end: 5000, lines: [
    { text: "within", t_start: 1000, t_end: 5000, tokens: [{ char: "w", t_start: 1000, t_end: 5000 }] },
  ] }];
  const r = clamp(secs, 10);
  ck("界内的行/节/token 全不动", [r.sections[0].t_end, r.sections[0].lines[0].t_end, r.sections[0].lines[0].tokens[0].t_end], [5000, 5000, 5000]);
  ck("界内不报收边", r.clipped, 0);
}
{
  // 量不到时长 = 判不了 → 原样返回, 一个字段都不许动(宁可不夹, 不夹错)
  const secs = [{ tag: "music", t_start: 0, t_end: 999999, lines: [
    { text: "[Music...]", t_start: 0, t_end: 999999, tokens: [{ char: "x", t_start: 0, t_end: 999999 }] },
  ] }];
  for (const d of [null, undefined, 0]) {
    const r = clamp(secs, d);
    ck(`durSec=${String(d)} 判不了 → 原样不夹`, r.sections[0].lines[0].t_end, 999999);
  }
}
{
  // 时间字段缺失/非数 → 原样放回, 不许被写成 limMs(那会凭空造出时间)
  const secs = [{ tag: "", lines: [
    { text: "no times", tokens: [{ char: "a", t_start: 100, t_end: 200 }] },
  ] }];
  const r = clamp(secs, 10);
  ck("行缺 t_end → 仍然缺(不凭空造)", r.sections[0].lines[0].t_end, undefined);
  ck("节缺 t_start → 仍然缺", r.sections[0].t_start, undefined);
}
{
  // 整行都在音频之外 → 连行带段一起丢(原有行为, 不许退化)
  const secs = [{ tag: "music", t_start: 500000, t_end: 600000, lines: [
    { text: "[Music...]", t_start: 500000, t_end: 600000, tokens: [{ char: "x", t_start: 500000, t_end: 600000 }] },
  ] }];
  const r = clamp(secs, 100);
  ck("全在音频之外的段被丢掉", r.sections.length, 0);
  ck("丢字计数仍然对", r.dropped, 1);
}

console.log(`\n${CAL ? "【校准模式】" : "【工作树】"}通过 ${pass} · 失败 ${fail}`);
if (CAL) {
  // 校准必须失败, 且失败的必须是第 1/2 组那几条; 第 3 组(陷阱)必须照样通过。
  if (fail === 0) { console.error("‼ 校准模式竟然全过 —— 这个测试测不到任何东西, 等于没测。"); process.exit(2); }
  console.log("校准达标: 旁路行/节那两刀之后核心用例失败 ✅ (第 3 组仍通过 = 没伤到正确行为)");
  process.exit(0);
}
process.exit(fail ? 1 : 0);
