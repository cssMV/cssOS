#!/usr/bin/env node
/* W2272 回归 —— `loadWorkTakes()` 下发的每一颗 ♪ 到底有没有时长。
 *
 * 为什么时长缺失值得一条回归: 它【不报错、不降级】。胶囊上只是不显示长度,
 * 而巡检的「唱词超出音频」(OVERRUN)和「幽灵尾奏」(OUTRO_OVER)两项
 * 【根本判不了】—— W2270 全库实测 70 处判不了, 全是这一个原因。
 * 看不见的漏判比看得见的错更难发现。
 *
 * 两处修的是【读】那一侧(库里本来就有的值被丢掉了):
 *   ① 重复分支补认时长 —— 与 W2175 补封面、W2178 补字幕是同一个坑的第三次。
 *      ♪1/♪2 走老字段先铺, 版本行到 push() 里被判重复直接 return,
 *      于是版本行明明有 duration_secs, 那颗 ♪ 仍然是 null。
 *   ② 无语言轨的作品: `user_works.duration_secs` 本来就查出来了却被原地丢掉。
 *      它的语义是【只有 ♪1】(W367 那句 UPDATE 写的就是 take1, 见 W2232),
 *      所以只能给排第一的那个 URL —— 摊给 ♪2 就是 W2267 那个 207 秒幽灵尾奏。
 *
 * 不抄一份 loadWorkTakes 来测: 抄一份就是造一份(W1960 的教训), 抄出来的副本
 * 永远通过。这里【从 src/index.ts 抽真实函数体】, 用 tsc 去掉类型标注后跑,
 * 库调用用一个按 SQL 分派的 withClient 桩喂进去。
 *
 * 喂进去的形状全是【线上实测到的】(2026-11-06 量), 不是顺手编的:
 *   303372a5…  无语言轨, uw.duration_secs=367, 两条版本行时长皆空
 *   402bbe6c…  无语言轨, uw.duration_secs=182, preview 恰好 = 版本行 #1 的 URL
 *
 * 校准: CALIBRATE=1 读 git HEAD 的 index.ts, 必须【失败】—— 失败不了就说明判据没判到东西。
 *
 *   node scripts/test-takes-duration.mjs
 *   CALIBRATE=1 node scripts/test-takes-duration.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

const CAL = process.env.CALIBRATE === "1";
const src = CAL
  ? execSync("git show HEAD:src/index.ts", { encoding: "utf8", maxBuffer: 64 << 20 })
  : fs.readFileSync("src/index.ts", "utf8");

/* 抽不到就返回 null, 不抛 —— CALIBRATE 跑的是旧版源码, 锚点本来就可能不一样。
 * MAX_SPAN 兜住另一头: 结尾锚点在别处偶然命中时, 别把半个文件吞进来。 */
const MAX_SPAN = 20000;
function slice(from, to) {
  const i = src.indexOf(from);
  if (i < 0) return null;
  const j = src.indexOf(to, i);
  if (j < 0 || j - i > MAX_SPAN) return null;
  return src.slice(i, j + to.length);
}

/* 有些函数的结尾长得很普通(`\n}`), 直接拿它当锚点会在半路命中。
 * 这个版本先走到函数体里一个【独一无二的标记】, 再从那儿往后找结尾。 */
function sliceVia(from, via, to) {
  const i = src.indexOf(from);
  if (i < 0) return null;
  const v = src.indexOf(via, i);
  if (v < 0 || v - i > MAX_SPAN) return null;
  const j = src.indexOf(to, v);
  if (j < 0 || j - v > 2000) return null;
  return src.slice(i, j + to.length);
}

const typeSrc  = slice("type WorkTake = {", "\n};");
const nullSrc  = slice("const TAKE_NULL_LANG =", "\n");
const dedupSrc = slice("function takeDedupeKey(url: string): string {", "\n}\n");
const loadSrc  = slice("async function loadWorkTakes(workId: string)", "\n  return out;\n}\n");
const regSrc   = sliceVia("async function registerMediaVersion(opts: {",
                          "[media-version] 实测时长失败", "\n    }\n  }\n}");

for (const [name, v] of [["WorkTake", typeSrc], ["TAKE_NULL_LANG", nullSrc],
                         ["takeDedupeKey", dedupSrc], ["loadWorkTakes", loadSrc],
                         ["registerMediaVersion(带实测时长的闸门)", regSrc]]) {
  if (!v) {
    console.log(`${CAL ? "CALIBRATE 判据命中" : "FAIL"}: 抽不到 ${name}`);
    process.exit(CAL ? 0 : 1);
  }
}

/* ── 把抽出来的 TS 片段转成可 import 的 JS ──────────────────────────────── */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "w2272-"));
const tsFile = path.join(dir, "extract.ts");
fs.writeFileSync(tsFile, `
export let FIXTURE: any = {};
export function setFixture(f: any) { FIXTURE = f; }
async function probeRemoteDurationSecs(_u: string): Promise<number | null> {
  FIXTURE.probed = (FIXTURE.probed || 0) + 1;
  return FIXTURE.probe ?? null;
}
async function withClient(fn: any): Promise<any> {
  return await fn({
    query: async (sql: string, params: any[]) => {
      const s = String(sql);
      (FIXTURE.log = FIXTURE.log || []).push({ sql: s.replace(/\\s+/g, " ").trim(), params });
      if (/^(insert|update)/i.test(s)) return { rows: [], rowCount: 0 };
      if (s.includes("FROM work_language_tracks")) return { rows: FIXTURE.tracks || [] };
      if (s.includes("FROM work_media_versions") && s.includes("'cover'")) return { rows: FIXTURE.covers || [] };
      if (s.includes("FROM work_media_versions")) return { rows: FIXTURE.vers || [] };
      if (s.includes("FROM work_assets")) return { rows: FIXTURE.assets || [] };
      if (s.includes("FROM user_works")) return { rows: FIXTURE.uw ? [FIXTURE.uw] : [] };
      throw new Error("桩没认出这条 SQL: " + s.slice(0, 80));
    },
  });
}
${typeSrc}
${nullSrc}
${dedupSrc}
export ${loadSrc}
export ${regSrc}
`);
const jsFile = path.join(dir, "extract.js");
/* tsc 对这个片段必然报类型错(withClient 是桩、标注引用的类型没全抽过来),
 * 退出码是 2 —— 但【照样会 emit】。这里只认「有没有产出 JS」, 不认退出码:
 * 判据要的是函数体的行为, 不是片段的类型完整性。 */
try {
  execSync(`npx --no-install tsc --target es2022 --module es2022 --moduleResolution bundler `
         + `--skipLibCheck --outDir ${JSON.stringify(dir)} ${JSON.stringify(tsFile)}`,
         { stdio: "pipe", cwd: process.cwd() });
} catch (e) {
  if (!fs.existsSync(jsFile)) {
    console.log("FAIL: tsc 没能把抽出来的片段转成 JS:\n" + String(e.stdout || e.message).slice(0, 1200));
    process.exit(1);
  }
}
const mod = await import(jsFile);

/* ── 判据 ──────────────────────────────────────────────────────────────── */
let pass = 0, fail = 0;
const WID = "303372a5-7bb3-4567-af06-ece3b6d8d097";
const U = (h) => `https://cdn.cssstudio.app/artifacts/audio/aud-${h}.mp3`;
function eq(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log(`  ❌ ${name}\n       得到 ${JSON.stringify(got)}\n       应为 ${JSON.stringify(want)}`); }
}
const durs = async (fx) => {
  mod.setFixture(fx);
  const m = await mod.loadWorkTakes(WID);
  const list = m.get(fx.tracks?.length ? "zh\u0001auto" : "") || [];
  return list.map((t) => t.duration_secs);
};

console.log("── ① 无语言轨: ♪1 的时长取 user_works.duration_secs(实测 303372a5…) ──");
eq("♪1=367 · ♪2/♪3 不猜", await durs({
  tracks: [], uw: { preview_audio_url: U("ad437036f02234"), duration_secs: 367 },
  vers: [{ lang: null, version_no: 1, label: null, url: U("1bed0439e808ae"), subtitle_url: null, duration_secs: null },
         { lang: null, version_no: 2, label: null, url: U("06126adb889539"), subtitle_url: null, duration_secs: null }],
}), [367, null, null]);

console.log("── ② 无语言轨: preview 恰好 = 版本行 #1(实测 402bbe6c…) ──");
eq("不多出一颗 ♪, ♪1=182", await durs({
  tracks: [], uw: { preview_audio_url: U("c368503c56a884"), duration_secs: 182 },
  vers: [{ lang: null, version_no: 1, label: null, url: U("c368503c56a884"), subtitle_url: null, duration_secs: null },
         { lang: null, version_no: 2, label: null, url: U("c87f80828cbc2f"), subtitle_url: null, duration_secs: null }],
}), [182, null]);

console.log("── ③ ♪1 的时长【绝不许】摊到 ♪2(W2267 那 207 秒幽灵尾奏的成因) ──");
eq("preview 空 → a1 是 ♪1 拿 100, a2 仍是 null", await durs({
  tracks: [], uw: { preview_audio_url: "", duration_secs: 100 },
  assets: [{ asset_type: "audio_track_1", url: U("aaa111") },
           { asset_type: "audio_track_2", url: U("bbb222") }],
}), [100, null]);

console.log("── ④ 版本行知道时长, 轨的列空着 → 补认(同 W2175 封面 / W2178 字幕) ──");
eq("♪1 补成 333, ♪2 保持 222", await durs({
  tracks: [{ lang: "zh", voice: "auto", is_default: true,
             audio_url: U("seed01"), duration_secs: null,
             alt_audio_url: U("seed02"), alt_duration_secs: 222 }],
  vers: [{ lang: "zh", version_no: 1, label: null, url: U("seed01"), subtitle_url: null, duration_secs: 333 }],
}), [333, 222]);

console.log("── ⑤' 非默认声线的轨: 版本行按【URL】认时长(实测 唐伯虎三部曲 6 处) ──");
/* verLangs 对非默认声线是空的, 所以「重复时补认」那一支根本不跑 ——
 * 必须像 W2269 的字幕一样按 URL 索引。只改重复分支就会漏掉这 6 处。 */
eq("pre-epic 轨的 ♪2 拿到 265s", await (async () => {
  mod.setFixture({
    tracks: [
      { lang: "zh", voice: "orig", is_default: true,
        audio_url: U("hlhk-a1"), duration_secs: 342, alt_audio_url: U("hlhk-a2"), alt_duration_secs: 276 },
      { lang: "zh", voice: "pre-epic", is_default: false,
        audio_url: U("hlhk-pre1"), duration_secs: 353, alt_audio_url: U("hlhk-shared2"), alt_duration_secs: null },
    ],
    vers: [{ lang: "regen-v6", version_no: 1, label: null, url: U("hlhk-shared2"),
             subtitle_url: null, duration_secs: 265 }],
  });
  const m = await mod.loadWorkTakes(WID);
  return (m.get("zh\u0001pre-epic") || []).map((t) => t.duration_secs);
})(), [353, 265]);

console.log("── ⑤ 轨的列已有时长 → 版本行不许覆盖它 ──");
eq("♪1 保持 210(不被 999 盖掉)", await durs({
  tracks: [{ lang: "zh", voice: "auto", is_default: true,
             audio_url: U("seed01"), duration_secs: 210,
             alt_audio_url: null, alt_duration_secs: null }],
  vers: [{ lang: "zh", version_no: 1, label: null, url: U("seed01"), subtitle_url: null, duration_secs: 999 }],
}), [210]);

/* ── 写入侧: 音频版本行必须带着自己的时长落地 ───────────────────────────
 * 实测 10 个写音频版本的调用点里有 3 个不传时长(:4956 / :35084 / :42361 的 ♪2),
 * 于是全库 159 条版本行的 duration_secs 是空的。闸门装在 registerMediaVersion
 * 这一处(每条音频版本行必经), 而不是在调用点补三次 —— 补调用点, 下一个新增的
 * 调用点照样会漏。 */
const reg = async (opts, probe) => {
  mod.setFixture({ probe: probe ?? null });
  await mod.registerMediaVersion(opts);
  const f = mod.FIXTURE;
  const upd = (f.log || []).filter((q) => /^update work_media_versions set duration_secs/i.test(q.sql));
  return { probed: f.probed || 0, wrote: upd.length, val: upd[0]?.params?.[2] ?? null,
           onlyNull: upd.length ? /duration_secs IS NULL/.test(upd[0].sql) : null };
};
const A = { workId: "303372a5-7bb3-4567-af06-ece3b6d8d097", kind: "audio", url: U("x1") };

console.log("── ⑥ 音频没传时长 → 当场实测并写回 ──");
eq("量到 240 → 写 240", await reg(A, 240), { probed: 1, wrote: 1, val: 240, onlyNull: true });

console.log("── ⑦ 已经传了时长 → 不实测、不多写一条 UPDATE ──");
eq("不探测", await reg({ ...A, durationSecs: 311 }, 240), { probed: 0, wrote: 0, val: null, onlyNull: null });

console.log("── ⑧ 量不到 → 保持为空, 绝不猜 ──");
eq("探了但不写", await reg(A, null), { probed: 1, wrote: 0, val: null, onlyNull: null });

console.log("── ⑨ 非音频(封面)→ 这道闸门不该碰它 ──");
eq("不探测", await reg({ ...A, kind: "cover" }, 240), { probed: 0, wrote: 0, val: null, onlyNull: null });

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass} 过 / ${fail} 挂`);
if (CAL) {
  if (fail > 0) { console.log("CALIBRATE 判据命中旧版(应当如此)。"); process.exit(0); }
  console.log("CALIBRATE 却全过 —— 判据没判到东西, 这条回归是假的。"); process.exit(1);
}
process.exit(fail ? 1 : 0);
