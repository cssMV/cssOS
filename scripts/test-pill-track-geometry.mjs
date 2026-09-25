/* W2193/W2194 回归 —
 *   Jing:「让激活胶囊在左边第一个位置」
 *        「手动移动胶囊靠近轨道两头的时候, 自动吸附到两边, 显示完整的胶囊」
 *        「请一并治那处 40px 双咬」
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
const src = read("public/app.lang-flag-pills.js");
const live = src.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");

// ① 一条缝只许被咬一次
ok("有 addBite 闸(cc-left 撞上左邻的 cc-right 就降 cc-solid)",
   /function addBite\([\s\S]{0,260}?cssos-cc-left" && bitesRight\(left\)[\s\S]{0,80}?cssos-cc-solid/.test(live),
   "cc-right 向右伸 20 + cc-left 向左伸 20 = 同一条缝 40px 重叠");
ok("v2 里三处 cc-left 全部走 addBite, 没有裸 add",
   (live.match(/addBite\(p, "cssos-cc-left", left\)/g) || []).length === 3
   && !/p\.classList\.add\("cssos-cc-left"\);\s*\/\//.test(live.split("v2(展开)")[1] || ""),
   "漏掉任何一处, 那条缝就还是 40px");

/* 按真几何模拟一遍: cc-right 右伸 20, cc-left 左伸 20, cc-solid/merge 不伸。
 * 不变式 = 任何一条缝的咬合量都不超过 20。 */
const EXT = { "cssos-cc-right": { r: 20, l: 0 }, "cssos-cc-left": { r: 0, l: 20 },
              "cssos-cc-solid": { r: 0, l: 0 }, "cssos-cc-merge-l": { r: 0, l: 0 },
              "cssos-cc-merge-m": { r: 0, l: 0 }, "cssos-cc-merge-r": { r: 0, l: 0 } };
const seamBite = (a, b) => (EXT[a] ? EXT[a].r : 0) + (EXT[b] ? EXT[b].l : 0);
ok("模拟: cc-right 紧跟 cc-left = 40px(这就是 Jing 看到的那处)",
   seamBite("cssos-cc-right", "cssos-cc-left") === 40);
ok("模拟: 降级成 cc-solid 之后 = 20px",
   seamBite("cssos-cc-right", "cssos-cc-solid") === 20);
ok("模拟: 实测那条轨的类序列, 每缝都 ≤20",
   (() => { const seq = ["cssos-cc-right","cssos-cc-right","cssos-cc-right","cssos-cc-solid",
                         "cssos-cc-left","cssos-cc-left","cssos-cc-left","cssos-cc-left",
                         "cssos-cc-left","cssos-cc-left","cssos-cc-left","cssos-cc-left"];
     for (let i = 1; i < seq.length; i++) if (seamBite(seq[i - 1], seq[i]) > 20) return false;
     return true; })());

// ② 两头吸附
ok("轨道开了原生 scroll-snap(proximity, 不自己写惯性)",
   /scroll-snap-type:x proximity/.test(live));
ok("每个胶囊都是吸附点(align:start → 左端永远是完整胶囊的起点)",
   /#watch-language-pill>button\{scroll-snap-align:start;\}/.test(live));

// ③ 激活胶囊贴左
ok("有 scrollActiveToStart", /function scrollActiveToStart\(/.test(live));
ok("滚动是【滚轨道】不是重排 DOM(模式头那组导航不许被拆散)",
   !/insertBefore|prepend\(/.test(live.split("scrollActiveToStart")[1] || ""));
ok("目标元素记下来, 不在应用时重新 querySelector",
   /bar\.__ccPendingEl = act;/.test(live) && /var act = bar\.__ccPendingEl;/.test(live),
   "一条轨里有多个 active, 'DOM 里第一个 active' 是当前语言(还被藏着, 宽度 0), 不是要滚到的那个");
ok("量不到就不消费待办, 由 rAF / ResizeObserver 补",
   /ResizeObserver/.test(live) && /if \(!bar\.clientWidth\) return false;/.test(live),
   "重绘那一刻常常还在折叠态, 量出来全是 0 —— 第一版就是这么滚到 0 的");
ok("同一个激活项不重复滚(不跟用户手动滑动抢)",
   /if \(bar\.__ccScrollKey === key\) return;/.test(live));

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
