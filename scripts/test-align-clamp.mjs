#!/usr/bin/env node
/* W2295 回归 —— 对齐结果必须落在音频之内。
 *
 * 这份【真的把那两个函数跑起来】, 不是 grep 源码。做法: 从 src/index.ts 里原样抽出
 * clampTimelineToAudio / clampSectionsToAudioMs 两段, 补一个最小类型声明, 用 tsc
 * 编成 JS 再 import 进来喂合成样本。抽不出来就报「判不了」并失败 —— 不静默跳过。
 *
 * 为什么要有它(W2293 的实测): 《Ἀθηνᾶ》写下 306 词, Suno 只唱了删节版(自由 ASR 实测
 * 185 词 / 末尾 226.9s), 音频 240.0s。强制对齐被喂进全部 306 词, whisperX 把没唱的
 * 121 词一路铺到 283.0s。这件事【不报错、不降级、不空白】—— 字幕看着完全正常, 只是
 * 歌早唱完了字还在滚, 只有人眼能发现。五条语言轨 10 个版本里 7 个这样, 最多越界 74s。
 *
 * 校准: CALIBRATE=1 改从 git HEAD 取 src/index.ts —— 那里还没有这两个函数,
 * 必须抽取失败/断言失败。校准跑过了 = 这份判据是假的。
 *
 * 用法: node scripts/test-align-clamp.mjs        |  CALIBRATE=1 node scripts/test-align-clamp.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CAL = process.env.CALIBRATE === "1";
const ROOT = process.cwd();
let src;
if (CAL) {
  console.log("⚠ CALIBRATE=1 —— 从 git HEAD 取源码, 下面必须失败");
  try { src = execFileSync("git", ["show", "HEAD:src/index.ts"], { cwd: ROOT, maxBuffer: 1 << 28 }).toString(); }
  catch (e) { fail("连 git HEAD 的 src/index.ts 都取不到 —— 判不了: " + e.message); }
} else {
  src = fs.readFileSync(path.join(ROOT, "src/index.ts"), "utf8");
}

let bad = 0;
function ok(cond, what) { console.log(`  ${cond ? "✓" : "✗"} ${what}`); if (!cond) bad++; }
function fail(msg) { console.error("FAIL " + msg); process.exit(CAL ? 0 : 2); }

/* 抽一个【顶层】函数的整段源码。
 *
 * 不从「function 之后第一个 {」开始配平 —— 我在这上面连栽两次, 两次都是因为
 * 函数签名里还有别的大括号:
 *   ① 泛型:        function clampSectionsToAudioMs<T extends { lines: … }>(…)
 *   ② 返回类型:    (…): { sections: T[]; dropped: number; clipped: number } {
 * 从它们开始配平, 会提前收尾、只抽到签名。
 * (两次都错在安全那一侧: 编译不过 → 报「判不了」, 没有假通过。)
 *
 * 改用一条确定的事实: 这个文件里【顶层函数的收尾大括号在第 0 列】。
 * 找 "\n}" 即可, 不必解析类型。 */
function grab(name) {
  const i = src.indexOf(`function ${name}`);
  if (i < 0) return null;
  const j = src.indexOf("\n}", i);
  if (j < 0) return null;
  return src.slice(i, j + 2);
}

const a = grab("clampTimelineToAudio");
const b = grab("clampSectionsToAudioMs");
if (!a || !b) {
  const miss = [!a && "clampTimelineToAudio", !b && "clampSectionsToAudioMs"].filter(Boolean).join(" / ");
  if (CAL) { console.log(`  ✓ 校准通过: HEAD 里没有 ${miss} —— 抽不出来`); process.exit(0); }
  fail(`src/index.ts 里抽不出 ${miss} —— 判不了(不是「通过」)`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "w2295-"));
const ts = path.join(tmp, "m.ts");
fs.writeFileSync(ts, `type LyricTimelineEntry = { text: string; start_s: number; end_s: number; unit: "word" };
${a}
${b}
export { clampTimelineToAudio, clampSectionsToAudioMs };
`);
try {
  execFileSync(path.join(ROOT, "node_modules/.bin/tsc"),
    [ts, "--target", "es2022", "--module", "es2022", "--moduleResolution", "bundler", "--outDir", tmp],
    { stdio: "pipe" });
} catch (e) {
  fail("抽出来的两段编译不过 —— 判不了:\n" + (e.stdout?.toString() || e.message));
}
const M = await import(path.join(tmp, "m.js"));
const W = (t, s, e) => ({ text: t, start_s: s, end_s: e, unit: "word" });

console.log("\n── 词级 clamp");
{
  // 真实形状: 240s 音频, 时间轴跑到 283s, 末尾一批词整个在音频之外
  const tl = [W("a", 10, 11), W("b", 200, 201), W("c", 239.5, 241.2), W("d", 250, 252), W("e", 280, 283)];
  const info = {};
  const out = M.clampTimelineToAudio(tl, 240, info);
  ok(out.length === 3, `整个在音频之外的词被丢掉 (5 → ${out.length})`);
  ok(info.dropped === 2, `报出丢了 2 个 (报 ${info.dropped})`);
  ok(Math.abs(out[2].end_s - 240) < 1e-9, `跨边界那个被收到 240s (${out[2].end_s})`);
  ok(info.clipped === 1, `报出收边 1 个 (报 ${info.clipped})`);
  ok(info.was_end_s === 283, `报出原来的末尾 283s (报 ${info.was_end_s})`);
  ok(info.of === 5 && info.audio_s === 240, "报出总词数与音频时长");
}
console.log("\n── 本来就在音频之内的, 一个字不许动(不许误报)");
{
  const tl = [W("a", 10, 11), W("b", 200, 211.28)];   // Ἀθηνᾶ 用对了词时的真实值
  const info = {};
  const out = M.clampTimelineToAudio(tl, 240, info);
  ok(out === tl, "原数组原样返回(没有重建)");
  ok(info.dropped === 0 && info.clipped === 0, "报 0 丢 0 收边");
}
console.log("\n── 容差: 最后一个字压在文件末尾差几十毫秒, 不算越界");
{
  const tl = [W("a", 1, 2), W("z", 239, 240.2)];
  const out = M.clampTimelineToAudio(tl, 240, {});
  ok(out === tl, "240.2s vs 240s 不动它");
}
console.log("\n── 时长量不到 = 判不了, 绝不猜");
{
  for (const d of [null, 0, undefined]) {
    const tl = [W("a", 1, 2), W("b", 500, 600)];
    const out = M.clampTimelineToAudio(tl, d, {});
    ok(out === tl, `时长=${String(d)} 时原样返回, 不夹`);
  }
}
console.log("\n── 段级终检(毫秒)");
{
  const sec = (toks) => ({ tag: "V", lines: [{ tokens: toks }] });
  const sections = [
    sec([{ char: "a", t_start: 1000, t_end: 2000 }]),
    sec([{ char: "b", t_start: 239000, t_end: 241000 }]),   // 跨边界 → 收边
    sec([{ char: "c", t_start: 250000, t_end: 252000 }]),   // 整个在外 → 整段消失
  ];
  const r = M.clampSectionsToAudioMs(sections, 240);
  ok(r.sections.length === 2, `空掉的段被丢掉 (3 → ${r.sections.length})`);
  ok(r.dropped === 1 && r.clipped === 1, `报 丢1/收边1 (报 丢${r.dropped}/收边${r.clipped})`);
  ok(r.sections[1].lines[0].tokens[0].t_end === 240000, "跨边界的字收到 240000ms");
  const same = M.clampSectionsToAudioMs(sections, null);
  ok(same.sections === sections && same.dropped === 0, "时长判不了时原样返回");
}
console.log("\n── 三个对齐器的出口都过了 clamp");
{
  for (const [re, what] of [
    [/if \(viaX && viaX\.length\) return await _clamp\(viaX\);/, "whisperX 出口"],
    [/if \(viaMms && viaMms\.length\) return await _clamp\(viaMms\);/, "MMS-FA 出口"],
    [/return timeline\.length \? await _clamp\(timeline\) : undefined;/, "OpenAI 出口"],
  ]) ok(re.test(src), what);
  ok(/sections = _sc\.sections;/.test(src), "落盘前有段级终检");
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n不合格 ${bad} 项`);
if (CAL) {
  if (bad > 0) { console.log("校准通过: 在 HEAD 的源码上判出了问题"); process.exit(0); }
  console.error("FAIL 校准失败: HEAD 的源码也判成全过 —— 这份判据是假的"); process.exit(3);
}
process.exit(bad ? 1 : 0);
