#!/usr/bin/env node
/* W2267 + W2268 回归 —— ?take=N 认哪一版音频。
 *
 * W2267: 不许按 `work_media_versions.lang` 猜, 要按【URL 身份】。
 * W2268: 连「按 URL 认」都不自己拼了 —— ♪N 的次序一律问 `loadWorkTakes()`,
 *        它是平台拼 ♪N 的唯一真源(前端 app.takes.js 读的也是它的产物)。
 *
 * 为什么这份测试要从 src/index.ts 里【抽真实函数体】来跑, 而不是在这里照抄一份:
 * 抄一份就是造一份(W1960 的教训)。抄出来的副本永远会通过, 真代码改坏了它也不报。
 *
 * 被测的 `_pickTake` 现在只做一件事: 按 (lang, voice) 取桶, 下标 N-1。
 * 桶【怎么拼出来的】归 `loadWorkTakes()`, 由 scripts/test-takes.js 管。
 * 所以这里喂进去的桶是【线上实测到的形状】(日期见下), 不是我顺手编的。
 * 要重新量: python3 <scratchpad>/clientcheck.py "<workId>=<标题>"
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

/* 抽不到就返回 null, 不抛 —— CALIBRATE 跑的是【旧版】源码, 那里头函数签名/结尾
 * 本来就长得不一样。抛异常会让校准路径崩在这儿, 看起来像测试坏了,
 * 其实正是"判据命中旧版"该走的那条路(实测栽过一次)。
 * MAX_SPAN 兜住另一头: 结尾锚点若在别处偶然命中, 别把半个文件都吞进来。 */
const MAX_SPAN = 8000;
function slice(from, to, _label) {
  const i = src.indexOf(from);
  if (i < 0) return null;
  const j = src.indexOf(to, i);
  if (j < 0 || j - i > MAX_SPAN) return null;
  return src.slice(i, j + to.length);
}

const dedupeSrc = slice("function takeDedupeKey(url: string): string {", "\n}\n", "takeDedupeKey");
if (!dedupeSrc) throw new Error("抽取 takeDedupeKey 失败");

const bucketSrc = slice("const _takeBucket = (t: any): WorkTake[] => {", "\n    };", "_takeBucket");
const pickSrc   = slice("const _pickTake = (t: any)", "\n      return { url, dur, row };\n    };", "_pickTake");

if (!bucketSrc || !pickSrc) {
  console.log(CAL
    ? "CALIBRATE 判据命中: 这一版 index.ts 里没有 _takeBucket/_pickTake(问 loadWorkTakes 认版本) —— 正是要修的旧版。"
    : "FAIL: src/index.ts 里找不到 _takeBucket / _pickTake —— W2268 的修复不在了。");
  process.exit(CAL ? 0 : 1);
}

/* 去掉 TS 类型标注, 变成可直接 eval 的 JS。只动签名, 不动函数体逻辑。 */
const toJs = (t) => t
  .replace(/function takeDedupeKey\(url: string\): string/, "function takeDedupeKey(url)")
  .replace(/\(t: any\): WorkTake\[\] =>/, "(t) =>")
  .replace(/\(t: any\):[^=]*=>/, "(t) =>")
  .replace(/ as any/g, "")
  .replace(/ as Error/g, "");

const factory = new Function("_onlyTake", "_allVerRows", "_takesByKey", `
  ${toJs(dedupeSrc)}
  ${toJs(bucketSrc)}
  ${toJs(pickSrc)}
  return _pickTake;
`);

const U = (h) => `https://cdn.cssstudio.app/artifacts/audio/aud-${h}.mp3`;
const KEY = (lang, voice) => `${lang}\u0001${voice || "auto"}`;
const bk = (...urls) => urls.map(([u, d], i) => ({
  take: i + 1, label: "♪" + (i + 1), url: u, duration_secs: d, subtitle_url: null, cover_url: null, source: "track",
}));

/* ── 实测数据 ① Chase the Stars 86a49ef7… (2026-11-05 量) ──────────────────
 * 四条轨的 ♪ 都来自轨自己那两列; 版本行 703/5783 的 lang 写着 zh, 装的却是 en
 * 那两个文件 —— 按标签挑挑不中, 按 URL 挑就是准的。 */
const T_CTS = {
  en:  { lang: "en", voice: "auto" },
  ja:  { lang: "ja", voice: "auto" },
  ko:  { lang: "ko", voice: "auto" },
  pre: { lang: "en", voice: "pre-epic" },
};
const B_CTS = new Map([
  [KEY("en", "auto"),     bk([U("bf1a9907ca0d73b14dddcc93"), 421], [U("cceba7334945f246901b3af3"), 223])],
  [KEY("ja", "auto"),     bk([U("623f6750479be1cfac6cdc04"), 240], [U("2f83c82fbddd2e4c748c289a"), 240])],
  [KEY("ko", "auto"),     bk([U("2b9d750cc6b75f365cd8d303"), 240], [U("39ad2b40ac8a61bb49f7b7c6"), 240])],
  [KEY("en", "pre-epic"), bk([U("89e1a165bf54bba8de24a519"), 50],  [U("8e4aebcf7651cd30103e9f9b"), 43])],
]);
const V_CTS = [
  { id: 700,  lang: "ja",            version_no: 1, url: U("623f6750479be1cfac6cdc04"), duration_secs: 240 },
  { id: 701,  lang: "ko",            version_no: 1, url: U("2b9d750cc6b75f365cd8d303"), duration_secs: 240 },
  { id: 702,  lang: "orig-pre-epic", version_no: 1, url: U("89e1a165bf54bba8de24a519"), duration_secs: 50 },
  { id: 703,  lang: "zh",            version_no: 1, url: U("bf1a9907ca0d73b14dddcc93"), duration_secs: 421 },  // ← 标签是错的
  { id: 5780, lang: "ja",            version_no: 2, url: U("2f83c82fbddd2e4c748c289a"), duration_secs: 240 },
  { id: 5781, lang: "ko",            version_no: 2, url: U("39ad2b40ac8a61bb49f7b7c6"), duration_secs: 240 },
  { id: 5782, lang: "orig-pre-epic", version_no: 2, url: U("8e4aebcf7651cd30103e9f9b"), duration_secs: 43 },
  { id: 5783, lang: "zh",            version_no: 2, url: U("cceba7334945f246901b3af3"), duration_secs: 223 },  // ← 标签是错的
];

/* ── 实测数据 ② 花落花开 0889ef5f… (2026-11-05 量) —— W2268 要修的那一类 ────
 * 默认轨(voice='orig')的 ♪2 不在它自己两列里: 是 loadWorkTakes 把【孤儿版本行】
 * (lang='regen-v6', 没有任何一条轨叫这个名字)挂到作品默认轨末尾凑出来的。
 * 而版本行 5693 的 lang 恰好是 'zh'、url 恰好是【♪1 自己那个文件】——
 * 旧写法按 lang 认 'zh' 就会认到它, 等于拿 ♪1 的音频当 ♪2 对齐。 */
const T_HLHK = {
  orig: { lang: "zh", voice: "orig" },
  auto: { lang: "zh", voice: "auto" },
  pre:  { lang: "zh", voice: "pre-epic" },
};
const B_HLHK = new Map([
  [KEY("zh", "orig"),     bk([U("003d9ed4786fc645fab6091e"), 342], [U("88c93c0c99f11fde86802d37"), 276], [U("321101eb2414f9c83450c7ff"), 265])],
  [KEY("zh", "auto"),     bk([U("6b9a07be27768c7af6464bb8"), 368], [U("321101eb2414f9c83450c7ff"), null])],
  [KEY("zh", "pre-epic"), bk([U("6b9a07be27768c7af6464bb8"), 353], [U("321101eb2414f9c83450c7ff"), null])],
]);
const V_HLHK = [
  { id: 46,   lang: "orig-pre-epic", version_no: 1, url: U("6b9a07be27768c7af6464bb8"), duration_secs: 353 },
  { id: 47,   lang: "zh",            version_no: 1, url: U("6b9a07be27768c7af6464bb8"), duration_secs: 368 },
  { id: 5678, lang: "regen-v6",      version_no: 1, url: U("321101eb2414f9c83450c7ff"), duration_secs: 265 },
  { id: 5679, lang: "regen-v6",      version_no: 2, url: U("88c93c0c99f11fde86802d37"), duration_secs: 276 },
  { id: 5692, lang: "orig-pre-epic", version_no: 2, url: U("321101eb2414f9c83450c7ff"), duration_secs: null },
  { id: 5693, lang: "zh",            version_no: 2, url: U("003d9ed4786fc645fab6091e"), duration_secs: 342 },
  { id: 5694, lang: "zh",            version_no: 3, url: U("321101eb2414f9c83450c7ff"), duration_secs: null },
];

const pick = (take, buckets, vers) => factory(take, vers, buckets);
const tail = (u) => String(u || "").slice(-28);

let fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✗ ${name}\n      得到 ${JSON.stringify(got)}\n      应为 ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${name}`);
};
const r = (take, track, buckets = B_CTS, vers = V_CTS) => {
  const p = pick(take, buckets, vers)(track);
  return p ? { url: tail(p.url), row: p.row ? p.row.id : null } : null;
};
const rd = (take, track, buckets = B_CTS, vers = V_CTS) => {
  const p = pick(take, buckets, vers)(track);
  return p ? p.dur : null;
};

console.log("\n【1】多语言同号 —— 每条轨必须拿到自己那一版, 不许串到别人身上");
t("en ♪1",       r(1, T_CTS.en),  { url: tail(U("bf1a9907ca0d73b14dddcc93")), row: 703 });
t("en ♪2",       r(2, T_CTS.en),  { url: tail(U("cceba7334945f246901b3af3")), row: 5783 });
t("ja ♪2",       r(2, T_CTS.ja),  { url: tail(U("2f83c82fbddd2e4c748c289a")), row: 5780 });
t("ko ♪2",       r(2, T_CTS.ko),  { url: tail(U("39ad2b40ac8a61bb49f7b7c6")), row: 5781 });
t("pre-epic ♪2", r(2, T_CTS.pre), { url: tail(U("8e4aebcf7651cd30103e9f9b")), row: 5782 });

console.log("\n【2】这一组就是 W2267 的 bug 本身 —— 旧写法 ORDER BY lang LIMIT 1 把 en 指到 ja 那一版上");
{
  const p = pick(2, B_CTS, V_CTS)(T_CTS.en);
  const wrong = V_CTS.find((v) => v.lang === "ja" && v.version_no === 2);
  t("en ♪2 ≠ 日文那一版的音频", p.url !== wrong.url, true);
  t("en ♪2 ≠ 日文那一行(5780)", p.row && p.row.id !== wrong.id, true);
}

console.log("\n【3】标签错了也要对 —— 703/5783 写着 zh, 装的是 en 轨的文件");
t("认 URL 不认 lang", pick(2, B_CTS, V_CTS)(T_CTS.en).row.lang, "zh");

console.log("\n【4】这一组就是 W2268 的 bug 本身 —— 按 lang 认会认到【♪1 自己那个文件】");
{
  const p = pick(2, B_HLHK, V_HLHK)(T_HLHK.orig);
  const own1 = U("003d9ed4786fc645fab6091e");             // ♪1 自己
  const trap = V_HLHK.find((v) => v.id === 5693);          // lang='zh' & version_no=2, url 就是 ♪1
  t("花落花开 默认轨 ♪2 = 孤儿行那个文件", tail(p.url), tail(U("88c93c0c99f11fde86802d37")));
  t("花落花开 默认轨 ♪2 ≠ ♪1 自己",        p.url !== own1, true);
  t("没有落到那行陷阱(5693)",              p.row && p.row.id !== trap.id, true);
  t("♪2 挂回孤儿行 5679",                  p.row.id, 5679);
  t("♪3 = 第三版(265s)",                   tail(pick(3, B_HLHK, V_HLHK)(T_HLHK.orig).url), tail(U("321101eb2414f9c83450c7ff")));
}

console.log("\n【5】非默认声线只拿自己那两列 —— 不许凭空多出别人的 ♪N");
{
  t("auto 轨 ♪2 = 它自己的第二列", tail(r(2, T_HLHK.auto, B_HLHK, V_HLHK).url), tail(U("321101eb2414f9c83450c7ff")));
  t("auto 轨没有 ♪3",              r(3, T_HLHK.auto, B_HLHK, V_HLHK), null);
  t("pre-epic 轨没有 ♪3",          r(3, T_HLHK.pre, B_HLHK, V_HLHK), null);
}

console.log("\n【6】时长: 这一版自己带的优先; 空了拿【同一个 URL】的任一条版本行补");
t("en ♪1 时长 = 421", rd(1, T_CTS.en), 421);
t("en ♪2 时长 = 223", rd(2, T_CTS.en), 223);
t("auto ♪2 桶里为 null → 从同 URL 的 5678 补到 265",
  rd(2, T_HLHK.auto, B_HLHK, V_HLHK), 265);

console.log("\n【7】拒绝猜 —— 桶里没有第 N 版就返回 null, 不许退回第一行");
{
  const empty = new Map([[KEY("de", "auto"), bk([U("x"), 1])]]);
  t("de 轨 ♪2(桶里只有一版)", r(2, { lang: "de", voice: "auto" }, empty, V_CTS), null);
  t("认不到键的真轨不许借别人的桶", r(1, { lang: "fr", voice: "auto" }, empty, V_CTS), null);
}

console.log("\n【8】无语言轨的作品: 伪轨(lang='orig')回退到键 \"\" —— 只在真没有轨时");
{
  const pseudo = new Map([["", bk([U("p1"), 100], [U("p2"), 90])]]);
  t("伪轨 ♪2 → 键 \"\" 的第二版", tail(r(2, { lang: "orig", voice: "auto" }, pseudo, V_CTS).url), tail(U("p2")));
  const both = new Map([["", bk([U("p1"), 100])], [KEY("en", "auto"), bk([U("e1"), 200], [U("e2"), 210])]]);
  t("有真轨时仍走自己的桶", tail(r(2, { lang: "en", voice: "auto" }, both, V_CTS).url), tail(U("e2")));
}

/* ── 【9】判据不能只测纯函数 ────────────────────────────────────────────────
 * 1-8 全过了, 线上照样失败过一次: resubtitle 那条 SELECT 【没取 alt_audio_url】,
 * 于是 ♪2 那个文件在端点眼里根本不存在。纯函数测试拿的是【完整的轨对象】,
 * 这种「数据缺列」它永远看不见。所以这里直接判那条 SQL 的文本。 */
console.log("\n【9】resubtitle 的 SELECT 必须把 ♪2 那一列取出来");
{
  const i = src.indexOf("SELECT DISTINCT ON (lang, voice)");
  const q = i < 0 ? "" : src.slice(i, src.indexOf("`", i));
  t("取了 alt_audio_url", /alt_audio_url/.test(q), true);
  t("map() 里也绝对化了 alt_audio_url",
    /alt_audio_url:\s*t\.alt_audio_url\s*\?\s*_abs\(t\.alt_audio_url\)/.test(src), true);
}

/* ── 【10】换音频的三件连带 ────────────────────────────────────────────────
 * injectMusicGaps(sections, tr.duration_secs) 会在最后一句唱词之后补一段尾奏,
 * 长到 duration-0.25。只换 audio_url 不换时长, ♪2(223s) 的字幕里就多出 207 秒
 * 幽灵尾奏 —— 唱词本身是对的, 所以接口返回的 lastEnd_s(whisper 词级时间轴)
 * 完全看不出来, 实测就是这么漏过去的。 */
console.log("\n【10】换音频必须连时长、包络一起换, 时长拿不到要实测");
t("赋值了 duration_secs",       /if \(_pdur && _pdur > 0\) \(tr as any\)\.duration_secs = _pdur;/.test(src), true);
t("重算了音量包络",             /computeVolumeCurveViaFfmpeg\(picked\.url\)/.test(src), true);
t("时长为空时 ffprobe 实测",    /_pdur = await probeRemoteDurationSecs\(picked\.url\)/.test(src), true);
t("实测也拿不到就不做(不沿用上一版)", /TAKE_DURATION_UNKNOWN/.test(src), true);
t("不再按 lang 认领版本行",     /_takeRows/.test(src), false);

/* ── 【11】必须有「先看看」的入口 ─────────────────────────────────────────
 * 这个端点一跑就覆盖字幕, 而 W2268 的 bug 正是「挑错文件但不报错」——
 * 没有 dry 入口, 每次确认都得先破坏一次(W2086 那 17 首就是这么丢的)。 */
console.log("\n【11】?dry=1 必须存在, 且在任何写入之前就 return");
{
  const i = src.indexOf('req.query as any)?.dry');
  t("端点认 ?dry=1", i > 0, true);
  const loop = src.indexOf("for (const tr of trackRows) {\n      let _takeRow");
  t("dry 的 return 在轨循环之前", i > 0 && loop > 0 && i < loop, true);
  t("dry 报出整条 ♪ 数组", /takes: _onlyTake >= 1 \? _takeBucket\(t\)/.test(src), true);
  t("dry 报出会写回哪一行", /would_write_version_row/.test(src), true);
}

console.log("");
if (CAL) {
  if (fail) { console.log(`CALIBRATE 判据命中 —— 对着 git HEAD 跑有 ${fail} 项不过, 说明判据真的在判东西。`); process.exit(0); }
  console.log("CALIBRATE 却全过了 —— 判据没判到东西, 这份测试不可信。"); process.exit(1);
}
if (fail) { console.log(`FAIL —— ${fail} 项不过`); process.exit(1); }
console.log("PASS —— 全部通过");
