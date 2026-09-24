#!/usr/bin/env node
/* W2164 回归 —— 「Generating a new MV」覆盖层只有 4 个胶囊, 没有 Cover。
 *
 * 为什么会漏: 这个覆盖层有【自己一份写死的 STAGE_META】, 和面板的 UI_STAGES 是两套表。
 * W2137 只改了面板那套, Jing 连着三次看到 Cover 还在。
 *
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const src = CAL ? execSync("git show HEAD:public/app.mv-pipeline-panel.js", { encoding: "utf8", maxBuffer: 1 << 28 })
                : readFileSync("public/app.mv-pipeline-panel.js", "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };

const i = src.indexOf("const STAGE_META = [");
ok("找到覆盖层的 STAGE_META(判据本身没瞎)", i > 0);
const meta = src.slice(i, src.indexOf("];", i));
const ids = [...meta.matchAll(/id:\s*"(\w+)"/g)].map((m) => m[1]);
ok("胶囊正好 4 个", ids.length === 4, `实际 ${ids.length}: ${ids.join(",")}`);
ok("没有 cover 胶囊", !ids.includes("cover"), `实际: ${ids.join(",")}`);
ok("顺序是 lyrics/music/video/subtitles",
   ids.join(",") === "lyrics,music,video,subtitles", ids.join(","));
const weights = [...meta.matchAll(/weight:\s*(\d+)/g)].map((m) => +m[1]);
ok("权重合计 100", weights.reduce((a, b) => a + b, 0) === 100, `实际 ${weights.reduce((a,b)=>a+b,0)} (${weights})`);
ok("cover 的权重并进了 video(不是摊给四个)", weights[2] === 55,
   `video 权重 ${weights[2]} —— 摊开会让出定妆照那段进度条原地不动`);

const live = src.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");
ok("onProgress 把 cover 折进 video", /_videoMerged/.test(live) && /pr\.cover/.test(live),
   "不折 = 定妆照那十几秒进度条不动, 假进度");
ok("lastPcts 初值不再有 cover 键",
   /let lastPcts = \{ lyrics: 0, music: 0, video: 0, subtitles: 0 \}/.test(live));

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} 过 / ${fail} 败` + (CAL ? "  [校准: 期望有失败]" : ""));
process.exit(CAL ? 0 : (fail ? 1 : 0));
