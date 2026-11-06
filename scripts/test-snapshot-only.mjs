#!/usr/bin/env node
/**
 * CSSOS_WAVE_2270 回归 —— 跑 ♪2 不许碰作品级那一槽。
 *
 * 为什么要有这一份: `upsertSubtitleJson` 名义上按 take 分槽, 但 ♪N 的对齐【一律以
 * 槽位 1 调用】(♪N 的身份靠 audioUrl 的快照键区分, 不靠槽位)。于是「给 ♪2 补字幕」
 * 这一个动作会把 `works/<id>/subtitle-take1.json` 读-改-写掉 —— 而实测三首
 * (花落花开/桃花仙/春风得意)的 orig ♪1 与 auto ♪1 全都解析到那一份。
 * 不拦住, 补 6 条 ♪2 就等于删 6 条 ♪1。
 *
 * 判据不是「源码里有没有那个单词」—— 本函数自成一体, 可以【真跑】: 把它抽出来、
 * 转译掉类型、喂一套假 R2 + 假 DB, 直接看它写了哪几个 key、回写了哪几张表。
 * 调用方那一半(端点里的 _snapOnly / 两处拒绝)抽不出来, 才用静态判据。
 *
 *   node scripts/test-snapshot-only.mjs
 *   CALIBRATE=1 node scripts/test-snapshot-only.mjs   # 读 git HEAD, 必须失败
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import ts from "typescript";

const CAL = process.env.CALIBRATE === "1";
const src = CAL
  ? execSync("git show HEAD:src/index.ts", { maxBuffer: 1 << 28 }).toString()
  : readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

let pass = 0; const fails = [];
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fails.push(name + (detail ? ` — ${detail}` : "")); console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `得到 ${JSON.stringify(got)}, 期望 ${JSON.stringify(want)}`);

/* ── 抽出函数本体并转译 ───────────────────────────────────────────── */
const START = "async function upsertSubtitleJson(";
const END = "\n// ── CSSOS_WAVE_441";
const i = src.indexOf(START), j = src.indexOf(END, i);
if (i < 0 || j < 0) {
  console.error("抽取 upsertSubtitleJson 失败 —— 源码结构变了, 先核对这份判据再改代码");
  process.exit(1);
}
const fnTs = src.slice(i, j);
const fnJs = ts.transpileModule(fnTs, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;

/* ── 一套假 R2 + 假 DB ───────────────────────────────────────────── */
function makeEnv(existingDoc) {
  const env = { uploads: [], queries: [], store: existingDoc };
  env.deps = {
    r2Enabled: () => true,
    withJsonMutex: async (_k, f) => await f(),
    downloadJsonFromR2: async (_p) => env.store ? JSON.parse(JSON.stringify(env.store)) : null,
    uploadBufferToR2: async (buf, key) => {
      env.uploads.push({ key, doc: JSON.parse(buf.toString("utf8")) });
      return `https://cdn.cssstudio.app/${key}`;
    },
    withClient: async (f) => await f({ query: async (sql, params) => { env.queries.push({ sql: String(sql).replace(/\s+/g, " ").trim(), params }); return { rows: [] }; } }),
    crypto: { createHash },
  };
  return env;
}
const build = (env) => new Function(
  "r2Enabled", "withJsonMutex", "downloadJsonFromR2", "uploadBufferToR2", "withClient", "crypto",
  `${fnJs}; return upsertSubtitleJson;`,
)(env.deps.r2Enabled, env.deps.withJsonMutex, env.deps.downloadJsonFromR2,
  env.deps.uploadBufferToR2, env.deps.withClient, env.deps.crypto);

const WID = "0889ef5f-7957-4cfe-86a2-390d0156b41b";
const A1 = "https://cdn.cssstudio.app/artifacts/audio/aud-003d9ed4786fc645fab6091e.mp3";
const A2 = "https://cdn.cssstudio.app/artifacts/audio/aud-88c93c0c99f11fde86802d37.mp3";
const tag = (u) => createHash("sha1").update(u).digest("hex").slice(0, 10);
const SEC1 = [{ title: "[Verse 1]", lines: [{ text: "♪1 的词", t_start: 0, t_end: 1000, tokens: [] }] }];
const SEC2 = [{ title: "[Verse 1]", lines: [{ text: "♪2 的词", t_start: 0, t_end: 1000, tokens: [] }] }];
/* 库里已有的那一份: zh = ♪1 的时间轴(这就是三首 orig♪1/auto♪1 真在读的东西), 另有 en 一条 */
const EXISTING = {
  v: 1, work_id: WID, take: 1, updated_at: "2026-01-01T00:00:00Z",
  vol_curve: { step_ms: 500, values: [0.1, 0.2] },
  languages: [
    { lang: "zh", analyzed_at: "2026-01-01T00:00:00Z", sections: SEC1 },
    { lang: "en", analyzed_at: "2026-01-01T00:00:00Z", sections: [] },
  ],
};
const WORKLEVEL = `works/${WID}/subtitle-take1.json`;

console.log("\n【1】旧行为(♪1 / 不传 opts)必须一字不变");
{
  const env = makeEnv(EXISTING); const f = build(env);
  const r = await f(WID, "zh", 1, SEC2, null, A1);
  eq("作品级 + 快照两份都写", env.uploads.map((u) => u.key).sort(),
     [`works/${WID}/subtitle-take1--a${tag(A1)}.json`, WORKLEVEL].sort());
  ok("回写 user_works.subtitle_take1_json_url", env.queries.some((q) => /UPDATE user_works SET subtitle_take1_json_url/.test(q.sql)));
  ok("回写轨 subtitle_url", env.queries.some((q) => /UPDATE work_language_tracks SET subtitle_url/.test(q.sql)));
  ok("返回作品级地址", r === `https://cdn.cssstudio.app/${WORKLEVEL}`, String(r));
}

console.log("\n【2】bug 本身: snapshotOnly 时作品级那一槽【一个字节都不许写】");
{
  const env = makeEnv(EXISTING); const f = build(env);
  const r = await f(WID, "zh", 1, SEC2, { step_ms: 500, values: [0.9] }, A2, { snapshotOnly: true });
  eq("只写快照一个 key", env.uploads.map((u) => u.key), [`works/${WID}/subtitle-take1--a${tag(A2)}.json`]);
  ok("绝不写作品级 take1.json", !env.uploads.some((u) => u.key === WORKLEVEL));
  ok("绝不回写 user_works 那两列", !env.queries.some((q) => /UPDATE user_works/.test(q.sql)));
  ok("返回快照地址, 不是 null", r === `https://cdn.cssstudio.app/works/${WID}/subtitle-take1--a${tag(A2)}.json`, String(r));
  const snap = env.uploads[0].doc;
  eq("快照里 zh 是【这一版】的词", snap.languages.find((l) => l.lang === "zh").sections[0].lines[0].text, "♪2 的词");
  ok("快照带上别的语言(以库里那份做底)", !!snap.languages.find((l) => l.lang === "en"));
  eq("快照的 vol_curve 是这一版自己的", snap.vol_curve.values, [0.9]);
}

console.log("\n【3】snapshotOnly 没有音频身份 → 宁可不写");
{
  const env = makeEnv(EXISTING); const f = build(env);
  const r = await f(WID, "zh", 1, SEC2, null, "", { snapshotOnly: true });
  eq("零上传", env.uploads.length, 0);
  eq("零 SQL", env.queries.length, 0);
  ok("返回 null", r === null, String(r));
}

console.log("\n【4】库里原来没有那份文件时也不许靠 snapshotOnly 建出来");
{
  const env = makeEnv(null); const f = build(env);
  await f(WID, "zh", 1, SEC2, null, A2, { snapshotOnly: true });
  eq("仍然只写快照", env.uploads.map((u) => u.key), [`works/${WID}/subtitle-take1--a${tag(A2)}.json`]);
}

console.log("\n【5】调用方那一半(端点里抽不出来, 用静态判据)");
{
  ok("♪2+ 才只写快照, ♪1 不受影响", /const _snapOnly = _onlyTake >= 2;/.test(src));
  ok("写入点带上 { snapshotOnly: _snapOnly }", /\{ snapshotOnly: _snapOnly \}\)/.test(src));
  ok("没有版本行可挂 → 拒做 TAKE_NO_VERSION_ROW", /_onlyTake >= 2 && !_takeRow[\s\S]{0,400}TAKE_NO_VERSION_ROW/.test(src));
  const iRefuse = src.indexOf("TAKE_NO_VERSION_ROW");
  const iSwap = src.indexOf("(tr as any).audio_url = picked.url;");
  ok("拒做要发生在换 audio_url 之前", iRefuse > 0 && iSwap > 0 && iRefuse < iSwap, `${iRefuse} vs ${iSwap}`);
  ok("快照没落成 → 拒绝, 不许留一个指向空气的 subtitle_url", /SNAPSHOT_WRITE_FAILED/.test(src));
  const iFail = src.indexOf("SNAPSHOT_WRITE_FAILED");
  const iVer = src.indexOf("UPDATE work_media_versions SET subtitle_url=$2 WHERE id=$1");
  ok("这条拒绝要发生在写版本行之前", iFail > 0 && iVer > 0 && iFail < iVer, `${iFail} vs ${iVer}`);
}

console.log(`\n${fails.length ? "✗" : "✓"} ${pass} 过 / ${fails.length} 不过`);
if (fails.length) { for (const f of fails) console.log("  · " + f); }
if (CAL) {
  if (fails.length) { console.log("\n✓ 判据命中: git HEAD(改动前)确实不过 —— 这份判据测的是真东西"); process.exit(0); }
  console.log("\n✗ 判据没命中: git HEAD 竟然全过 —— 说明它没测到 W2270 的改动"); process.exit(1);
}
process.exit(fails.length ? 1 : 0);
