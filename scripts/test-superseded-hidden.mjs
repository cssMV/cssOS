#!/usr/bin/env node
/* W2147 回归 — 退场(superseded)的轨不画胶囊格子。
 *
 * 为什么需要: 'superseded' 是「这一版退场了, 记录留着」。但胶囊的 meaningful 过滤
 * 原本只要求 t.lang, 退场轨照样进 distinctVoices → 画出一颗 disabled 格子, 且
 * mkCell 的非 ready 分支给它挂 " ⚠" + tooltip「渲染中…」—— 像坏了, 比不处理更糟。
 *
 * 校准: CALIBRATE=1 从 git HEAD 读旧文件, 期望【失败】。
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };

const src = read("public/app.mv-language-pill.js");
// 只看活代码 —— 注释里会原样引用这些字符串, 曾两次被自己的注释骗过
const live = src.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");

ok("meaningful 过滤排除 superseded",
   /_lastTracks\.filter\(function \(t\) \{[\s\S]{0,200}?!== "superseded"/.test(live),
   "不排除 → 退场轨画成一颗 disabled 的 ⚠ 格子, tooltip 说「渲染中…」");
ok("仍然要求 t.lang(原有条件没丢)", /t && t\.lang/.test(live));
// 只看 meaningful 那一个过滤器本身 —— 整份文件里别处也有 !== "pending" 之类,
// 拿全文件判会假失败(第一版正是这么写的)。
const filt = (live.match(/var meaningful = _lastTracks\.filter\(function \(t\) \{[\s\S]*?\}\);/) || [""])[0];
ok("过滤器确实被找到(判据本身没瞎)", filt.length > 0);
for (const st of ["pending", "rendering", "failed"]) {
  ok(`不误伤 ${st}(真实状态仍要让用户看见)`, !filt.includes(st),
     "把进行中/失败也藏掉 = 用户看不见自己的轨在跑");
}
const v = (read("public/index.html").match(/app\.mv-language-pill\.js\?v=([^"']+)/) || [])[1] || "";
ok("胶囊文件 ?v= 已 bump", /w2147/.test(v), `现在是 "${v}" —— 独立 script 不 bump 就吃旧缓存`);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} 过 / ${fail} 败` + (CAL ? "  [校准: 期望有失败]" : ""));
process.exit(CAL ? 0 : (fail ? 1 : 0));
