/* W2215 回归 — Jing:「右侧栏, 包括 AI 助理, Dock 是否也应该靠边 10px?
 *                     我倾向于统一规则, 都靠边 10px。」
 *
 * 改动前实测的贴边值有【五种】: 右侧栏 right14/bottom20 · AI FAB right14/底地板13 ·
 * Dock 底地板13 / 另三边 24 · 返回键 left14 · 三点 right12 · Flagship left12。
 * 本测试钉住"统一 10", 并钉住两件【不该跟着变】的事:
 *   ① safe-area 那一项必须原样留着 —— 它管刘海/home 条, 不是"贴边多少";
 *   ② AI FAB 叠在 Dock 之上的 +62px 层距不动 —— 它不是自己贴边。
 * 全部改在各自的真源, 不叠覆盖规则。
 *
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };

const rail = read("public/app.watch-social-rail.js");
const css  = read("public/style.css");
const flag = read("public/app.flagship-badges.js");
const fab  = read("public/app.agent-chat.js");
const html = read("public/index.html");

// ① 右侧栏(轨内 AI ＋ 是它的子节点, 自动跟随)
ok("右侧栏 right/bottom 都是 10",
   /#cssos-watch-social-rail\{position:absolute;right:10px;bottom:10px;/.test(rail),
   "原 right:14 / bottom:20");
ok("轨内 AI ＋ 仍是右侧栏的子节点(不另设自己的贴边)",
   !/#cssos-rail-ai\{[^}]*right:\s*\d/.test(rail),
   "它应该跟着轨走; 自己写 right 就会和轨脱钩");
ok("用户拖过的 AI ＋ 位置仍归用户(applyRailAiPos 未被动过)",
   /applyRailAiPos\(/.test(rail),
   "导演铁律: 用户干预 > 系统默认");

// ② 顶栏左右两端
ok("返回键 left:10", /#cssos-watch-backbtn\{position:absolute;left:10px;/.test(rail), "原 14");
// ⋯ 有【两处】贴边: JS 内联(网页端生效)+ style.css 的 html.cssos-app 覆盖(App 端生效)。
// 只改一处就只有一端是 10 —— 第一版正是这样漏的(网页端量出来还是 12)。
ok("三点 ⋯ App 端 right:10", /#watch-exit-cinema \{[\s\S]{0,400}?right: 10px !important;/.test(css), "原 12");
ok("三点 ⋯ 网页端(JS 内联) right:10",
   /"position:absolute", "top:12px", "right:10px",/.test(read("public/app.watch-search.js")),
   "app.watch-search.js:266 的内联 right:12 —— 网页端没有 !important 规则压它, 内联说了算");
ok("Flagship left:10", /#cssos-mv-flagship-badge\{position:absolute;top:10px;left:10px;/.test(flag), "原 12");
ok("Flagship 的 top:10 没动(W2214 顶栏行锚就照着它定的)",
   /#cssos-mv-flagship-badge\{position:absolute;top:10px;/.test(flag));

// ③ Dock 四边
ok("Dock 底边地板 10", /bottom: max\(10px, calc\(env\(safe-area-inset-bottom, 5px\) \+ 8px\)\) !important;/.test(css), "原 13");
for (const [side, prop] of [["left", "left: 10px;"], ["right", "right: 10px;"], ["top", "top: 10px;"]]) {
  const blk = (css.match(new RegExp(`\\.dock\\[data-dock-position="${side}"\\] \\{[\\s\\S]*?\\n\\}`)) || [""])[0];
  ok(`Dock 贴${side}边 10`, blk.includes(prop), "原 24px");
}
ok("竖排 Dock 的留空跟着 10 走",
   ((css.match(/\.dock\[data-dock-position="(left|right)"\] \{[\s\S]*?\n\}/g) || [])
     .filter((b) => /max-height: calc\(100vh - 20px\)/.test(b)).length === 2),
   "原 48px = 24×2; 边距改了留空不改就对不上");
ok("没误伤文件别处同名的 max-height: calc(100vh - 48px)",
   /max-height: calc\(100vh - 48px\);/.test(css),
   "style.css 里还有一处无关的同名声明(约 10927 行), 不该被一起改掉");

// ④ AI 全局 FAB
ok("AI 全局 FAB right:10", /#cssos-agent-fab\{position:fixed !important;right:10px !important;/.test(fab), "原 14");
ok("它的底部地板跟 Dock 同步为 10",
   /bottom:calc\(max\(10px, env\(safe-area-inset-bottom,5px\) \+ 8px\) \+ 62px\) !important;/.test(fab));
ok("叠在 Dock 之上的 62px 层距没动", /\+ 62px\) !important;/.test(fab),
   "它不是自己贴边, 是站在 Dock 头上的一层");

// ⑤ safe-area 一项都不许丢
ok("Dock 仍带 safe-area-inset-bottom", /env\(safe-area-inset-bottom, 5px\)/.test(css));
ok("AI FAB 仍带 safe-area-inset-bottom", /env\(safe-area-inset-bottom,5px\)/.test(fab));

// ⑥ 全改在真源, 没有新叠的覆盖规则
ok("没有为贴边新写 #watch-panel.maximized 覆盖块",
   !/#watch-panel\.maximized [^{]*#cssos-watch-social-rail/.test(read("public/style.watch.css")),
   "同一个值有两个地方写, 下一个人必定改错那一个");

// ⑦ 缓存键
const headHtml = execSync("git show HEAD:public/index.html", { encoding: "utf8", maxBuffer: 1 << 28 });
for (const f of ["public/app.watch-social-rail.js", "public/app.flagship-badges.js",
                 "public/app.agent-chat.js", "public/style.css", "public/app.watch-search.js"]) {
  const base = f.split("/").pop(), esc = base.replace(/\./g, "\\.");
  const v  = (html.match(new RegExp(esc + "\\?v=([^\"]+)")) || [])[1];
  const hv = (headHtml.match(new RegExp(esc + "\\?v=([^\"]+)")) || [])[1];
  const same = execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 }) === readFileSync(f, "utf8");
  ok(`${base} 内容改了 ⇒ ?v= 也改了`, same || (v && v !== hv));
}

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
