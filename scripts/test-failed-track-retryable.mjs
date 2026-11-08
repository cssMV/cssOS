/* W2277 回归 — Jing 2026-11-08:「先从根上修去重，让 failed 的轨能重试。」
 *
 * 改之前: /api/works/:id/language-tracks 的去重只看【这个语言有没有行】, 不看状态。
 * 于是一条 failed 的轨【永久堵住】这个语言 —— 甘地的 hi 轨 suno_poll_timeout 之后,
 * 再 POST 一次只拿到 NO_NEW_LANGUAGES, 除了删那一行没有别的路。
 *
 * ⚠ 本测试的另一半比第一半重要: 【不能照字面只放开 status='failed'】。
 * 实测全库 22 条 failed 里有 20 条【带着音频】, 其中 19 条是 voice='pre-epic' 的版本行 ——
 * 它们抱着 epic 之前那一版的 audio_url(W2145 把版本身份挪到 voice 的全部意义就是保住它们),
 * 状态写成 failed 只因为 2026-09-23 那批撞上 Suno 402 欠费。里面还有
 * 《举杯邀月》《春风得意》《桃花仙》—— W2086「17 首旧版音乐被覆盖」的幸存者。
 * 放开它们 = 重试把 audio_url 指向新音频 = 旧版从胶囊里消失。字节还在 R2, 但没人能选到它,
 * 而「覆盖, 就是删掉」。那是 W2061/W2086 丢掉 19 首歌的同一个机制。
 *
 * 所以判据是【有没有东西可丢】, 不是【状态叫什么】。本测试把路由里那段判据的【原文抽出来跑】,
 * 不另写一份(抄一份就是造一份, W1960)。
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };

const ts = read("src/index.ts");

/* ── ① 把判据的原文抽出来, 转成可跑的 JS ───────────────────────────────── */
const m = ts.match(/const isRetryableFailure = \([\s\S]*?=>\s*\n?\s*String\(r\.status \|\| ""\) === "failed" && !r\.audio_url && !r\.alt_audio_url;/);
if (!m) {
  console.log("  ❌ 没能从 src/index.ts 抽出 isRetryableFailure —— 文件结构变了, 先去看它");
  process.exit(1);
}
const src = m[0].replace(/:\s*\{[^}]*\}/g, "").replace(/\s*\|\s*null/g, "");
let isRetryableFailure;
try {
  isRetryableFailure = new Function(`${src}; return isRetryableFailure;`)();
} catch (e) {
  console.log("  ❌ 抽出来的判据跑不起来: " + e.message); process.exit(1);
}

/* ── ② 在已知答案上校准 —— 过不了就别信后面任何结论 ───────────────────── */
console.log("判据校准:");
const AUD = "https://cdn.cssstudio.app/artifacts/audio/aud-deadbeef.mp3";
const cases = [
  ["failed 且两个音频都空 → 可重试",        { status: "failed", audio_url: null, alt_audio_url: null }, true],
  ["failed 但有 ♪1 → 不可(旧版的碑)",      { status: "failed", audio_url: AUD,  alt_audio_url: null }, false],
  ["failed 但有 ♪2 → 不可",                 { status: "failed", audio_url: null, alt_audio_url: AUD  }, false],
  ["ready 空音频 → 不可",                   { status: "ready",  audio_url: null, alt_audio_url: null }, false],
  ["pending 在飞 → 不可(再来一次双倍烧钱)", { status: "pending", audio_url: null, alt_audio_url: null }, false],
  ["rendering 在飞 → 不可",                 { status: "rendering", audio_url: null, alt_audio_url: null }, false],
  ["superseded → 不可(W2142 刻意退场)",     { status: "superseded", audio_url: AUD, alt_audio_url: null }, false],
  ["status 为 null → 不可",                 { status: null, audio_url: AUD, alt_audio_url: null }, false],
];
for (const [name, row, want] of cases) ok(name, isRetryableFailure(row) === want);

/* ── ③ 用真实的那 22 条 failed 轨跑一遍(2026-11-08 库里快照) ──────────── */
console.log("真实快照(2026-11-08, 全库 22 条 failed):");
const real = [
  // 真空失败 —— 这两条就是要放行的
  { t: "Jerusalem ja (suno_task_SENSITIVE_WORD_ERROR)", status: "failed", audio_url: null, alt_audio_url: null, want: true },
  { t: "甘地忌辰 hi (suno_poll_timeout)",               status: "failed", audio_url: null, alt_audio_url: null, want: true },
  // 带音频的 pre-epic 版本行 —— 一条都不许放行
  { t: "举杯邀月 zh/pre-epic (W2086 幸存者)", status: "failed", audio_url: AUD, alt_audio_url: null, want: false },
  { t: "春风得意 zh/pre-epic (W2086 幸存者)", status: "failed", audio_url: AUD, alt_audio_url: AUD,  want: false },
  { t: "桃花仙 zh/pre-epic (W2086 幸存者)",   status: "failed", audio_url: AUD, alt_audio_url: AUD,  want: false },
  { t: "Inti qu/auto (848 字歌词 + 音频)",    status: "failed", audio_url: AUD, alt_audio_url: null, want: false },
  { t: "雅典娜 el/pre-epic",                  status: "failed", audio_url: AUD, alt_audio_url: null, want: false },
  { t: "Jerusalem zh/pre-epic",               status: "failed", audio_url: AUD, alt_audio_url: null, want: false },
];
let allowed = 0;
for (const r of real) { ok(`${r.t} → ${r.want ? "放行" : "堵住"}`, isRetryableFailure(r) === r.want); if (isRetryableFailure(r)) allowed++; }
ok("22 条里只放行【真空失败】那 2 条", allowed === 2, `实际放行 ${allowed} 条`);

/* ── ④ 路由真的用上了这个判据, 而不是摆着不用 ─────────────────────────── */
console.log("接线:");
ok("have 用 isRetryableFailure 过滤后才建",
   /const have = new Set\(existing\.rows\.filter\(\(r\) => !isRetryableFailure\(r\)\)\.map\(\(r\) => r\.lang\)\);/.test(ts),
   "只定义不接线 = 改了等于没改");
ok("SELECT 真的把 status/audio_url/alt_audio_url 查出来了",
   /SELECT lang, track_order, status, audio_url, alt_audio_url\s*\n?\s*FROM work_language_tracks WHERE work_id=\$1::uuid/.test(ts),
   "判据读的三列必须真在结果里, 否则全是 undefined → 所有 failed 都被放行");
ok("maxOrder 仍按【全部】行算, 不只按未堵住的",
   /let maxOrder = existing\.rows\.reduce\(\(m, r\) => Math\.max\(m, r\.track_order\), 0\);/.test(ts),
   "按过滤后的行算会撞 track_order");
ok("去重那一句本身没动(仍是 !have.has(code))",
   /if \(supported\.has\(code\) && !have\.has\(code\) && !seen\.has\(code\)\)/.test(ts));
ok("ON CONFLICT 仍是 DO NOTHING(复用旧行, 不改它的 charged_cents)",
   /ON CONFLICT \(work_id, lang, voice\) DO NOTHING/.test(ts));

console.log(`\n${fail === 0 ? "全部通过" : "有不通过项"}: ${pass} 过 / ${fail} 不过`);
process.exit(fail === 0 ? 0 : 1);
