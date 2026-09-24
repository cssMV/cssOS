#!/usr/bin/env node
/* W2161 回归 —— 定妆照绝不能挂到【当前正在播的作品】上。
 *
 * 事故: 2026-09-22 16:56-16:58, 《鶴の恩返し》那次 lite 跑的 6 张白鹤定妆照全部挂进了
 * 《李清照·声声慢三部曲·寻寻觅觅》(4b357bc9), 而鶴 那首连作品都没建成 ——
 * 因为 W2137 写成了 state.workId || cssosCurrentWorkId(), 全新运行里前者为空。
 *
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };

const panel = read("public/app.mv-pipeline-panel.js");
// 注释里会原样引用出事那行, 只看活代码(今晚被自己的注释骗过两次)
const live = panel.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");

ok("活代码里不再有 cssosCurrentWorkId 回落",
   !/cssosCurrentWorkId/.test(live),
   "回落 = 把这一首的定妆照挂到别人正在播的那首上");
const plateCalls = [...live.matchAll(/"\/api\/mv\/plate"[\s\S]{0,400}?\}\s*\)\s*\)?/g)].map((m) => m[0]);
ok("两个 /api/mv/plate 调用点都找到了(判据本身没瞎)", plateCalls.length === 2,
   `实际找到 ${plateCalls.length} 个`);
for (const [i, c] of plateCalls.entries()) {
  ok(`调用点${i + 1} 的 work_id 只认 state.workId`,
     /work_id:\s*String\(state\.workId \|\| ""\) \|\| undefined/.test(c));
}
ok("commit 之后仍把定妆照归位(slideshow_frames 没被误删)",
   /slideshow_frames:\s*Array\.isArray\(state\.plateUrls\)/.test(live),
   "去掉运行中的 work_id 后, 这条是定妆照唯一的归位通道");
ok("lite 仍只出一张(W2140 的规则没被动)",
   /_coverTierId !== "lite"/.test(live));

const html = read("public/index.html"), man = read("public/app.panel-manifest.js");
const a = (html.match(/app\.panel-manifest\.js\?v=([^"']+)/) || [])[1] || "";
const b = (man.match(/app\.mv-pipeline-panel\.js\?v=([^"']+)/) || [])[1] || "";
ok("缓存链两环都 bump 到 w2161", /w2161/.test(a) && /w2161/.test(b),
   `manifest="${a}" panel="${b}" —— 只 bump 一环 = Safari 继续吃旧文件(W2140 的教训)`);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} 过 / ${fail} 败` + (CAL ? "  [校准: 期望有失败]" : ""));
process.exit(CAL ? 0 : (fail ? 1 : 0));
