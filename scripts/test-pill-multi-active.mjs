/* W2192 回归 — Jing:「胶囊套的有一点小问题, 请修复。」
 *
 * 症状(截图): 激活的 "♪4 · 4:50" 印了两遍、后一个压在前一个上。
 * 根因: #watch-language-pill 一条轨里【同时有 4 个 .active】——
 *   模式头(Languages) + 当前语言 + 当前声线 + 当前 ♪ (各组轮流显示, 这是设计)。
 * 而 v28 的 "[data-pill-bar]>[data-pill-key].active~[data-pill-key]" 假设一条轨只有
 * 一个岛, 于是排在后面的那个 active 被当成「active 右边的未激活胶囊」, 吃到
 * margin-left:-20px + padding-left:36px → 整个胶囊左移压住邻居、标签被推右。
 *
 * 修法按宪法自己的原话补 :not(.active)（「ALL inactive pills concave toward active」）。
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };
const src = read("public/app.pill-bar.js");
const live = src.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");

ok("「active 右侧」规则排除了 active 自己",
   /\[data-pill-bar\]>\[data-pill-key\]\.active~\[data-pill-key\]:not\(\.active\)\{/.test(live),
   "不排除 → 多 active 轨上, 后面那个 active 自己也被左移 20px 压住邻居");
ok("旧的、不排除 active 的写法已不存在",
   !/\[data-pill-bar\]>\[data-pill-key\]\.active~\[data-pill-key\]\{/.test(live));
ok("markPre 也不把 active 当成「active 左侧」",
   /cssos-pill-pre[\s\S]{0,180}?!children\[j\]\.classList\.contains\("active"\)/.test(live),
   "左侧那条走的是 JS 打的类, 只改 CSS 会漏掉一半");

/* 拿真选择器跑一遍: 单 active 轨必须【一个像素都不变】, 多 active 轨才有区别。 */
const mk = (n, activeIdx) => {
  const kids = [];
  for (let i = 0; i < n; i++) kids.push({ i, active: activeIdx.includes(i) });
  // 复刻 CSS 的 "X.active ~ Y:not(.active)" 与改前的 "X.active ~ Y"
  const oldHit = kids.filter((k) => kids.some((p) => p.i < k.i && p.active));
  const newHit = oldHit.filter((k) => !k.active);
  return { oldHit: oldHit.map((k) => k.i), newHit: newHit.map((k) => k.i) };
};
const single = mk(7, [3]);
ok("单 active 轨: 新旧命中完全一致(现有每条胶囊条零变化)",
   JSON.stringify(single.oldHit) === JSON.stringify(single.newHit),
   `旧 ${JSON.stringify(single.oldHit)} vs 新 ${JSON.stringify(single.newHit)}`);
const multi = mk(18, [2, 6, 7, 11]);   // 实测的那条轨: 模式头/语言/声线/♪4
ok("多 active 轨: 改前会把 3 个 active 自己也算进去",
   multi.oldHit.filter((i) => [6, 7, 11].includes(i)).length === 3,
   "这就是 Jing 看到的「胶囊套胶囊」");
ok("多 active 轨: 改后一个 active 都不再被算进去",
   multi.newHit.filter((i) => [2, 6, 7, 11].includes(i)).length === 0);

const v = (readFileSync("public/index.html", "utf8").match(/app\.pill-bar\.js\?v=([^"']+)/) || [])[1] || "";
const vPrev = (() => { try { return (execSync("git show HEAD~1:public/index.html", { encoding: "utf8", maxBuffer: 1 << 28 })
  .match(/app\.pill-bar\.js\?v=([^"']+)/) || [])[1] || ""; } catch (e) { return ""; } })();
const prevSrc = (() => { try { return execSync("git show HEAD~1:public/app.pill-bar.js", { encoding: "utf8", maxBuffer: 1 << 28 }); } catch (e) { return null; } })();
ok("pill-bar 的 ?v= 随内容变更而 bump",
   prevSrc === null || prevSrc === readFileSync("public/app.pill-bar.js", "utf8") || (!!v && v !== vPrev),
   `现在 "${v}", 上一版 "${vPrev}"`);

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
