#!/usr/bin/env node
/* W2269 回归 —— pre-epic 轨的 ♪2 不许再借 ♪1 的时间轴。
 *
 * 背景: W2145 为了「绝不拿新版时间轴配旧版歌声」, 把 pre-epic 整条短路到
 * work_language_tracks.subtitle_url。那一列是【单值】, 装不下两版 —— 于是 ♪2 必然
 * 拿到 ♪1 的那份。实测 Chase the Stars: ♪1 是 50s 音频、♪2 是 43s, 同一份 49.6s
 * 的时间轴配过去整首渐漂。「宁可空白, 绝不错配」本该把它判成空白。
 *
 * W2269 把短路收窄到【这份 takes 是谁给的】:
 *   服务端下发 takes → take.subtitle_url 只可能来自版本行, 可以用
 *   没有 takes(卡片/队列)→ 仍整条短路(那条路塞进去的是作品级两列, 正是要堵的)
 *
 * 判据跑【真文件】public/app.takes.js, 不照抄副本。
 * 校准: CALIBRATE=1 读 git HEAD 的那一版, 必须【失败】。
 *
 *   node scripts/test-preepic-take-subtitle.mjs
 *   CALIBRATE=1 node scripts/test-preepic-take-subtitle.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

const CAL = process.env.CALIBRATE === "1";
let file = "public/app.takes.js";
if (CAL) {
  const tmp = path.join(os.tmpdir(), `takes-head-${process.pid}.cjs`);
  fs.writeFileSync(tmp, execSync("git show HEAD:public/app.takes.js", { encoding: "utf8" }));
  file = tmp;
}
globalThis.window = globalThis;
await import(`file://${path.resolve(file)}`);
const T = globalThis.cssosTakes;
if (!T) { console.log("FAIL: app.takes.js 没有挂出 cssosTakes"); process.exit(1); }

const tk = (u, sub) => ({ url: u, duration_secs: 50, subtitle_url: sub });
/* pre-epic + 服务端下发的 takes */
const srv = (takes, trackSub) => ({
  voice: "pre-epic", takes, subtitle_url: trackSub,
  subtitle_take1_json_url: "WORK-LEVEL-1", subtitle_take2_json_url: "WORK-LEVEL-2",
});
/* pre-epic + 没有 takes(卡片 / 队列 item 的形状) */
const card = (trackSub, extra = {}) => ({
  voice: "pre-epic", subtitle_url: trackSub, audio_url: "a", alt_audio_url: "b",
  subtitle_take1_json_url: "WORK-LEVEL-1", subtitle_take2_json_url: "WORK-LEVEL-2", ...extra,
});

let fail = 0;
const t = (n, got, want) => {
  const ok = got === want;
  if (!ok) { fail++; console.log(`  ✗ ${n}\n      得到 ${JSON.stringify(got)}\n      应为 ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${n}`);
};

console.log("\n【1】pre-epic × 服务端 takes —— 每一版认自己的");
t("♪1 版本自带 → 用它",            T.subtitleUrl(srv([tk("a", "SNAP-1"), tk("b", null)], "TRACK"), 1), "SNAP-1");
t("♪2 版本自带 → 用它",            T.subtitleUrl(srv([tk("a", "SNAP-1"), tk("b", "SNAP-2")], "TRACK"), 2), "SNAP-2");
t("♪1 没有 → 退回轨那一列",        T.subtitleUrl(srv([tk("a", null), tk("b", null)], "TRACK"), 1), "TRACK");

console.log("\n【2】这一组就是 bug 本身 —— ♪2 没有自己的字幕时必须空白, 不许拿 ♪1 的");
t("♪2 没有 → 空白",                T.subtitleUrl(srv([tk("a", null), tk("b", null)], "TRACK"), 2), "");
t("♪2 没有且轨也没有 → 空白",      T.subtitleUrl(srv([tk("a", null), tk("b", null)], null), 2), "");
t("♪2 没有时也不许取作品级 take2", T.subtitleUrl(srv([tk("a", null), tk("b", null)], "TRACK"), 2) !== "WORK-LEVEL-2", true);

console.log("\n【3】没有 takes 的对象(卡片/队列)—— W2145 原样, 整条短路");
t("♪1 → 轨那一列",                 T.subtitleUrl(card("TRACK"), 1), "TRACK");
t("♪2 → 也是轨那一列",             T.subtitleUrl(card("TRACK"), 2), "TRACK");
t("♪2 绝不取作品级 take2",         T.subtitleUrl(card("TRACK"), 2) !== "WORK-LEVEL-2", true);
t("轨那一列为空 → 空白",           T.subtitleUrl(card(null), 1), "");

console.log("\n【4】普通轨(非 pre-epic)—— 行为必须一字不变");
t("♪1 版本自带",                   T.subtitleUrl({ voice: "auto", takes: [tk("a", "SNAP-1")], subtitle_take1_json_url: "WORK-LEVEL-1" }, 1), "SNAP-1");
t("♪1 没有 → 作品级 take1",        T.subtitleUrl({ voice: "auto", takes: [tk("a", null)], subtitle_take1_json_url: "WORK-LEVEL-1" }, 1), "WORK-LEVEL-1");
t("♪2 没有 → 作品级 take2",        T.subtitleUrl({ voice: "auto", takes: [tk("a", null), tk("b", null)], subtitle_take1_json_url: "WORK-LEVEL-1", subtitle_take2_json_url: "WORK-LEVEL-2" }, 2), "WORK-LEVEL-2");
t("♪3 没有 → 回退 take2",          T.subtitleUrl({ voice: "auto", takes: [tk("a", null), tk("b", null), tk("c", null)], subtitle_take1_json_url: "WORK-LEVEL-1", subtitle_take2_json_url: "WORK-LEVEL-2" }, 3), "WORK-LEVEL-2");

/* 后端那一半: 版本行自带的字幕要【按 URL】认回 seed 铺出来的 ♪ ——
 * 否则非默认声线的 ♪ 永远 subtitle_url=null, 上面【1】那两条在线上就永远走不到。 */
console.log("\n【5】后端: loadWorkTakes 必须按 URL 把版本行的字幕认回 seed");
{
  const src = CAL
    ? execSync("git show HEAD:src/index.ts", { encoding: "utf8", maxBuffer: 64 << 20 })
    : fs.readFileSync("src/index.ts", "utf8");
  t("建了 subByUrl 索引", /const subByUrl = new Map<string, string>\(\);/.test(src), true);
  t("seed 入列时带上它",
    /for \(const s of seed\) push\(s\.url, s\.dur, subByUrl\.get\(takeDedupeKey\(String\(s\.url \|\| ""\)\)\) \|\| null/.test(src), true);
}

console.log("");
if (CAL) {
  if (fail) { console.log(`CALIBRATE 判据命中 —— 对着 git HEAD 跑有 ${fail} 项不过, 说明判据真的在判东西。`); process.exit(0); }
  console.log("CALIBRATE 却全过了 —— 判据没判到东西, 这份测试不可信。"); process.exit(1);
}
if (fail) { console.log(`FAIL —— ${fail} 项不过`); process.exit(1); }
console.log("PASS —— 全部通过");
