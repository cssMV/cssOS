#!/usr/bin/env node
/* W2267 回归 —— ?take=N 必须按【URL 身份】认版本, 不许按 lang 标签猜。
 *
 * 为什么这份测试要从 src/index.ts 里【抽真实函数体】来跑, 而不是在这里照抄一份:
 * 抄一份就是造一份(W1960 的教训)。抄出来的副本永远会通过, 真代码改坏了它也不报。
 *
 * 校准: CALIBRATE=1 读 git HEAD 的 index.ts, 必须【失败】—— 失败不了就说明判据没判到东西。
 *
 *   node scripts/test-take-pick.mjs
 *   CALIBRATE=1 node scripts/test-take-pick.mjs
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const CAL = process.env.CALIBRATE === "1";
const src = CAL
  ? execSync("git show HEAD:src/index.ts", { encoding: "utf8", maxBuffer: 64 << 20 })
  : fs.readFileSync("src/index.ts", "utf8");

/* ── 抽取: takeDedupeKey + _isPreEpic + _pickTake(或旧版 _takeRow 查询) ───── */
function slice(from, to, label) {
  const i = src.indexOf(from);
  if (i < 0) return null;
  const j = src.indexOf(to, i);
  if (j < 0) throw new Error(`抽取 ${label} 失败: 找不到结尾`);
  return src.slice(i, j + to.length);
}

const dedupeSrc = slice("function takeDedupeKey(url: string): string {",
                        "\n}\n", "takeDedupeKey");
if (!dedupeSrc) throw new Error("抽取 takeDedupeKey 失败");

const preSrc  = slice("const _isPreEpic = (voice: string, lang: string): boolean =>",
                      "voice === \"pre-epic\" || lang.includes(\"pre-epic\");", "_isPreEpic");
const pickSrc = slice("const _pickTake = (t: any): { url: string; row: _VerRow | null } | null => {",
                      "\n      return null;\n    };", "_pickTake");

if (!preSrc || !pickSrc) {
  console.log(CAL
    ? "CALIBRATE 判据命中: 这一版 index.ts 里没有 _pickTake(按 URL 认版本) —— 正是要修的旧版。"
    : "FAIL: src/index.ts 里找不到 _pickTake / _isPreEpic —— W2267 的修复不在了。");
  process.exit(CAL ? 0 : 1);
}

/* 去掉 TS 类型标注, 变成可直接 eval 的 JS。只动签名, 不动函数体逻辑。 */
const toJs = (t) => t
  .replace(/function takeDedupeKey\(url: string\): string/, "function takeDedupeKey(url)")
  .replace(/\(voice: string, lang: string\): boolean/, "(voice, lang)")
  .replace(/\(t: any\): \{ url: string; row: _VerRow \| null \} \| null/, "(t)")
  .replace(/const seed: string\[\] = \[\]/, "const seed = []")
  .replace(/ as Error/g, "");

const factory = new Function("_onlyTake", "_allVerRows", "_takeRows", `
  ${toJs(dedupeSrc)}
  ${toJs(preSrc)}
  ${toJs(pickSrc)}
  return _pickTake;
`);

/* ── 真实数据: Chase the Stars 86a49ef7… (2026-11-04 实测) ──────────────── */
const U = (h) => `https://cdn.cssstudio.app/artifacts/audio/aud-${h}.mp3`;
const TRACKS = [
  { id: 1547, lang: "en", voice: "auto",     audio_url: U("bf1a9907ca0d73b14dddcc93"), alt_audio_url: U("cceba7334945f246901b3af3") },
  { id: 1548, lang: "ja", voice: "auto",     audio_url: U("623f6750479be1cfac6cdc04"), alt_audio_url: U("2f83c82fbddd2e4c748c289a") },
  { id: 1549, lang: "ko", voice: "auto",     audio_url: U("2b9d750cc6b75f365cd8d303"), alt_audio_url: U("39ad2b40ac8a61bb49f7b7c6") },
  { id: 1614, lang: "en", voice: "pre-epic", audio_url: U("89e1a165bf54bba8de24a519"), alt_audio_url: U("8e4aebcf7651cd30103e9f9b") },
];
const VERS = [
  { id: 700,  lang: "ja",            version_no: 1, url: U("623f6750479be1cfac6cdc04") },
  { id: 701,  lang: "ko",            version_no: 1, url: U("2b9d750cc6b75f365cd8d303") },
  { id: 702,  lang: "orig-pre-epic", version_no: 1, url: U("89e1a165bf54bba8de24a519") },
  { id: 703,  lang: "zh",            version_no: 1, url: U("bf1a9907ca0d73b14dddcc93") },  // ← 标签是错的
  { id: 5780, lang: "ja",            version_no: 2, url: U("2f83c82fbddd2e4c748c289a") },
  { id: 5781, lang: "ko",            version_no: 2, url: U("39ad2b40ac8a61bb49f7b7c6") },
  { id: 5782, lang: "orig-pre-epic", version_no: 2, url: U("8e4aebcf7651cd30103e9f9b") },
  { id: 5783, lang: "zh",            version_no: 2, url: U("cceba7334945f246901b3af3") },  // ← 标签是错的
];

const pickFor = (take, tracks = TRACKS, vers = VERS) =>
  factory(take, vers, vers.filter((v) => v.version_no === take));

let fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✗ ${name}\n      得到 ${JSON.stringify(got)}\n      应为 ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${name}`);
};
const r = (take, track, tracks, vers) => {
  const p = pickFor(take, tracks, vers)(track);
  return p ? { url: p.url.slice(-28), row: p.row ? p.row.id : null } : null;
};

console.log("\n【1】多语言同号 —— 每条轨必须拿到自己那一版, 不许串到别人身上");
t("en ♪1",       r(1, TRACKS[0]), { url: "aud-bf1a9907ca0d73b14dddcc93.mp3".slice(-28), row: 703 });
t("en ♪2",       r(2, TRACKS[0]), { url: "aud-cceba7334945f246901b3af3.mp3".slice(-28), row: 5783 });
t("ja ♪2",       r(2, TRACKS[1]), { url: "aud-2f83c82fbddd2e4c748c289a.mp3".slice(-28), row: 5780 });
t("ko ♪2",       r(2, TRACKS[2]), { url: "aud-39ad2b40ac8a61bb49f7b7c6.mp3".slice(-28), row: 5781 });
t("pre-epic ♪2", r(2, TRACKS[3]), { url: "aud-8e4aebcf7651cd30103e9f9b.mp3".slice(-28), row: 5782 });

console.log("\n【2】这一组就是 bug 本身 —— 旧写法 ORDER BY lang LIMIT 1 会把 en 指到 ja 那一版上");
{
  const p = pickFor(2)(TRACKS[0]);
  const wrong = VERS.find((v) => v.lang === "ja" && v.version_no === 2);
  t("en ♪2 ≠ 日文那一版的音频", p.url !== wrong.url, true);
  t("en ♪2 ≠ 日文那一行(5780)", p.row && p.row.id !== wrong.id, true);
}

console.log("\n【3】标签错了也要对 —— 703/5783 写着 zh, 装的是 en 轨的文件");
t("认 URL 不认 lang", pickFor(2)(TRACKS[0]).row.lang, "zh");

console.log("\n【4】单语言作品(♪3+ 走版本表那条路)—— 行为与改动前一致");
{
  const jaOnly = [{ id: 9, lang: "ja", voice: "auto", audio_url: U("aaa"), alt_audio_url: U("bbb") }];
  const jaVers = [1, 2, 3, 4, 5, 6].map((n) => ({ id: 100 + n, lang: "ja", version_no: n, url: U("v" + n) }));
  jaVers[0].url = U("aaa"); jaVers[1].url = U("bbb");         // ♪1/♪2 = 轨自己的两列
  t("ja ♪1 → 轨自己的第一列", r(1, jaOnly[0], jaOnly, jaVers).row, 101);
  t("ja ♪2 → 轨自己的第二列", r(2, jaOnly[0], jaOnly, jaVers).row, 102);
  t("ja ♪5 → 版本表第5行",    r(5, jaOnly[0], jaOnly, jaVers).row, 105);
}

console.log("\n【5】拒绝猜 —— 挑不中必须返回 null, 不许退回第一行");
{
  const ghost = [{ id: 1, lang: "de", voice: "auto", audio_url: "", alt_audio_url: "" }];
  t("de 轨 ♪2(同号下只有 ja/ko/zh/pre-epic)", r(2, ghost[0], ghost, VERS), null);
  const preGhost = [{ id: 2, lang: "en", voice: "pre-epic", audio_url: "", alt_audio_url: "" }];
  const onlyNormal = [{ id: 7, lang: "en", version_no: 2, url: U("zzz") }];
  t("pre-epic 轨不得认领普通轨那一版", r(2, preGhost[0], preGhost, onlyNormal), null);
  const normGhost = [{ id: 3, lang: "en", voice: "auto", audio_url: "", alt_audio_url: "" }];
  const onlyPre = [{ id: 8, lang: "orig-pre-epic", version_no: 2, url: U("yyy") }];
  t("普通轨不得认领 pre-epic 那一版", r(2, normGhost[0], normGhost, onlyPre), null);
}

/* ── 【6】判据不能只测纯函数 ────────────────────────────────────────────────
 * 上面 1-5 全过了, 线上照样失败: resubtitle 那条 SELECT 【没取 alt_audio_url】,
 * 于是 ♪2 那个文件在端点眼里根本不存在 —— seed 只有 1 条, take=2 落到 ♪3+ 那一支
 * 按 lang 挑, 当然挑不中。纯函数测试拿的是【完整的轨对象】, 这个漏它永远看不见。
 * 所以这里直接判那条 SQL 的文本。 */
console.log("\n【6】resubtitle 的 SELECT 必须把 ♪2 那一列取出来");
{
  const i = src.indexOf("SELECT DISTINCT ON (lang, voice)");
  const q = i < 0 ? "" : src.slice(i, src.indexOf("`", i));
  t("取了 alt_audio_url", /alt_audio_url/.test(q), true);
  t("map() 里也绝对化了 alt_audio_url",
    /alt_audio_url:\s*t\.alt_audio_url\s*\?\s*_abs\(t\.alt_audio_url\)/.test(src), true);
}

console.log("");
if (CAL) {
  if (fail) { console.log(`CALIBRATE 判据命中 —— 对着 git HEAD 跑有 ${fail} 项不过, 说明判据真的在判东西。`); process.exit(0); }
  console.log("CALIBRATE 却全过了 —— 判据没判到东西, 这份测试不可信。"); process.exit(1);
}
if (fail) { console.log(`FAIL —— ${fail} 项不过`); process.exit(1); }
console.log("PASS —— 全部通过");
