/* W2216 — 给【影院态顶栏与贴边宪法】这一条配的校验。
 *
 * 为什么要给一篇文档写测试: W1960 的教训是我在注释里写了「与原版逐字一致」而其实不是,
 * 后面十几轮排查全部信错了前提。宪法一旦和代码脱节, 比没有宪法更糟 —— 下一个人会
 * 照着一份过期的宪法去改。所以这条宪法里每一个【引了代码的句子】都在这里被钉住。
 *
 * 注意: 本测试只读, 不改任何行为。Jing 2026-09-26:「今天的状态我觉得是完美了, 不要再动。」
 * 它存在的意义正是让"不要再动"能被机器守住, 而不是靠记性。
 *
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败(那时这一条还没入宪)。 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };

const doc = read("CLAUDE.md");
const i = doc.indexOf("## 🔒 影院态顶栏与贴边宪法");
ok("这一条在 CLAUDE.md 里", i !== -1, "Jing:「最好入宪」");
const sec = i === -1 ? "" : doc.slice(i);

// ① 宪法引的 CSS 必须与 style.watch.css 【逐行】一致 —— 不是"大意一致"
const wcss = read("public/style.watch.css");
const m = sec.match(/```css\n\/\* public\/style\.watch\.css[^\n]*\*\/\n([\s\S]*?)```/);
ok("宪法里有那段 CSS", !!m);
if (m) {
  const bad = m[1].replace(/\n$/, "").split("\n").filter((l) => !wcss.includes(l));
  ok("宪法引的 CSS 与源文件逐行一致", bad.length === 0,
     "对不上的行: " + JSON.stringify(bad.slice(0, 3)) + " —— 这正是 W1960 栽过的坑");
}

// ② 行锚的数值、以及它绑定的 Flagship top, 都不许悄悄变
ok("行锚仍是 30px", /--cssos-mv-toprow-center: 30px;/.test(wcss));
ok("Flagship 的 top 仍是 10px(行锚照着它定)",
   /#cssos-mv-flagship-badge\{position:absolute;top:10px;/.test(read("public/app.flagship-badges.js")));
ok("两个 40px 圆减 20 / 42px 框减 21(减各自半高对齐中心)",
   /--cssos-mv-toprow-center\) - 20px\)/.test(wcss) && /--cssos-mv-toprow-center\) - 21px\)/.test(wcss));
ok("行锚三条都不带 safe-area / notch-clear",
   !/--cssos-mv-toprow-center[\s\S]{0,420}?(safe-area-inset-top|cssos-notch-clear)/.test(wcss),
   "带了就在刘海机上被推到 Flagship 下面 —— 那正是要修的毛病本身");

// ③ 贴边 10px 清单 —— 宪法点名的每一个都得真的是 10
for (const [f, frag, who] of [
  ["public/app.watch-social-rail.js", "#cssos-watch-social-rail{position:absolute;right:10px;bottom:10px;", "右侧栏"],
  ["public/app.watch-social-rail.js", "#cssos-watch-backbtn{position:absolute;left:10px;", "返回 ‹"],
  ["public/app.flagship-badges.js",   "#cssos-mv-flagship-badge{position:absolute;top:10px;left:10px;", "Flagship"],
  ["public/app.agent-chat.js",        "right:10px !important;left:auto !important;bottom:calc(max(10px,", "AI 全局 FAB"],
  ["public/app.watch-search.js",      '"position:absolute", "top:12px", "right:10px",', "三点 ⋯ · 网页端内联"],
  ["public/style.css",                "bottom: max(10px, calc(env(safe-area-inset-bottom, 5px) + 8px)) !important;", "Dock 底"],
]) ok(`贴边 10: ${who}`, read(f).includes(frag), f);
ok("三点 ⋯ · App 端覆盖也是 10",
   /#watch-exit-cinema \{[\s\S]{0,400}?right: 10px !important;/.test(read("public/style.css")),
   "这个值写在【两个地方】, 只改一处就只有一端是 10(W2215 第一版就这么漏的)");

// ④ 三样【不跟着变】的
ok("safe-area 项没被删(只降地板)", /env\(safe-area-inset-bottom, 5px\)/.test(read("public/style.css")));
ok("AI FAB 叠在 Dock 之上的 62px 层距没动", /\+ 62px\) !important;/.test(read("public/app.agent-chat.js")));
ok("用户拖过的 AI ＋ 位置仍归用户", /applyRailAiPos\(/.test(read("public/app.watch-social-rail.js")));
ok("搜索框 left/right 仍是 60(不是贴边值, 不该改成 10)",
   /#watch-search-box \{ left: 60px !important; right: 60px !important; \}/.test(read("public/style.css")),
   "60 = 10 边距 + 40 按钮 + 10 间隙, 正好给返回键和三点让位");

// ⑤ 第三节那两件【刻意保留】的 —— 前提还在, 说明宪法那段话仍然成立
ok("seek 带判据仍是 _BP = 16(宪法引了这个数)", /_BP = 16/.test(read("public/app.watch-ui.js")));
ok("CHROME 10s 空闲系统仍在(搜索框淡出的来源)", /CHROME_SELECTORS/.test(read("public/index.html")));
ok("宪法白纸黑字写了这两件是【刻意保留】不是 bug",
   /刻意保留】的事 —— 不是待修的 bug/.test(sec),
   "少了这句, 下一个人会把它们当 bug 顺手'修好'");

// ⑥ 其余定稿
ok(".toast 无条件 pointer-events:none", /\n\.toast \{[\s\S]*?pointer-events: none;/.test(read("public/style.css")));
ok("横幅 top 回到 12px(W2212 已按 Jing 要求回滚)",
   /top:calc\(12px \+ env\(safe-area-inset-top\)\)/.test(read("public/app.appstore-ribbon.js")));
ok("横幅整条可关", /bar\.addEventListener\("click", dismiss\);/.test(read("public/app.appstore-ribbon.js")));
const html = read("public/index.html");
for (const p of ["lyrics", "music", "video"]) {
  ok(`#${p}-panel 已删`, !html.includes(`id="${p}-panel"`));
  ok(`#${p}-engine-surface 数据面保留`, html.includes(`id="${p}-engine-surface"`));
}

// ⑦ 红线与回归指路必须在(宪法的执行力全靠这两段)
ok("有红线段, 且要求先拿 Jing 的 yes", /没有 yes 就不动/.test(sec));
ok("红线点名不许把那两件当 bug 修", /不接受把第三节那两件当 bug/.test(sec));
for (const t of ["scripts/test-uniform-edge-10px.mjs",
                 "scripts/test-cinema-search-restored.mjs",
                 "scripts/test-lyrics-panel-removed.mjs"]) {
  ok(`宪法点名的回归存在: ${t.split("/").pop()}`, existsSync(t));
  ok(`宪法里写了它`, sec.includes(t.split("/").pop()));
}

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
