/* W2208 回归 — Jing:「请加上 Dock 入口。」
 *
 * 做成了【右轨 🔍】而不是 Dock 项, 因为 Dock 项在任何一个状态都点不到:
 *   ① 打开 watch/MV 面板 → html.cssos-watch-open → #dock{display:none!important}(W846,
 *      Jing 自己定的「看 MV 时不显示 Dock」)。影院态 Dock 不在屏幕上。
 *   ② 搜索框是 #watch-panel 的子节点 —— 面板关着时它本来就没法用。
 * 本测试把这两条前提也钉住: 哪天它们变了, 这个取舍就该重新想。
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
const strip = (s) => s.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");

const rail = strip(read("public/app.watch-social-rail.js"));
const ws   = strip(read("public/app.watch-search.js"));
const css  = read("public/style.css");
const html = read("public/index.html");

// ① 取舍的两条前提 —— 变了就该重新选放哪儿
ok("前提①: 打开 watch 面板就藏 Dock",
   /html\.cssos-watch-open #dock \{ display: none !important; \}/.test(css),
   "这条若没了, Dock 项就可行了, 本波的放置理由失效");
ok("前提②: 搜索框在 #watch-panel 内(面板关着就没法用)",
   /getElementById\("watch-panel"\)/.test(ws));

// ② 入口真的加在右轨上, 且复用平台已有的 mkItem(不另造按钮样式)
const item = (rail.match(/rail\.appendChild\(mkItem\("🔍"[\s\S]*?\n    \}\)\);/) || [""])[0];
ok("右轨有 🔍 项", item.length > 80);
ok("复用 mkItem, 没另造按钮", /rail\.appendChild\(mkItem\("🔍"/.test(rail));
ok("点它唤出作品搜索(works/market 那个)", /cssosWatchSearchShow\(\); return;/.test(item));
ok("兜底退回全局搜索, 不做死按钮", /cssosOpenGlobalSearch\(\); return;/.test(item));
ok("有 aria + title(纯图标按钮必须可读)",
   /aria: copy\("Search works"/.test(item) && /title: copy\("Search works"/.test(item));
ok("不标 data-social-gated(搜索是看, 不是发)", !/social: true/.test(item),
   "标了会被 <13 社交闸(app.social-age-gate.js)连带隐藏");

// ③ 位置: 必须排在 AI ＋ 之前 —— 右轨 bottom:20px 向上长, 越靠前越先被矮屏顶出去
const iSearch = rail.indexOf('mkItem("🔍"');
const iAi = rail.indexOf('var aiBtn = mkItem("＋"');
ok("🔍 排在 AI ＋ 之前(= 普通项末尾, 矮屏也还在)", iSearch > 0 && iAi > iSearch);
ok("🔍 排在买断 💎 之后(没插进交易那一组中间)",
   rail.indexOf('mkItem("💎"') > 0 && rail.indexOf('mkItem("💎"') < iSearch);

// ④ 两个入口共用一份唤出逻辑
ok("cssosWatchSearchShow 即 summon(右轨点了也聚焦)",
   /globalThis\.cssosWatchSearchShow = summon;/.test(ws));
const summonFn = (ws.match(/function summon\(\) \{[\s\S]*?\n    \}/) || [""])[0];
ok("能取到 summon 函数体", summonFn.length > 60);
ok("summon 清掉【CHROME 系统】的 display:none(否则框 0×0, focus 落不进去)",
   /cssosWatchChromeWake\(\)/.test(summonFn),
   "影院态 index.html 的空闲系统给框打的是 display:none !important, showBar 只改 transform/opacity");
ok("走 CHROME 系统自己的 wake, 不自己写 style.display",
   !/style\.display/.test(summonFn),
   "它用 hidden[] 记着原值, 绕过去改会把账搞乱");
ok("index.html 确实把 wake 暴露出来了",
   /globalThis\.cssosWatchChromeWake = wake;/.test(html));
ok("summon 也清掉 W2206 的收起(force 露出)+ 送焦点",
   /showBar\(true\);/.test(summonFn) && /input\.focus\(\)/.test(summonFn));

// ⑤ 缓存键必须跟着内容变
for (const f of ["public/app.watch-social-rail.js", "public/app.watch-search.js"]) {
  const base = f.split("/").pop();
  const v = (html.match(new RegExp(base.replace(/\./g, "\\.") + "\\?v=([^\"]+)")) || [])[1];
  const headHtml = execSync("git show HEAD:public/index.html", { encoding: "utf8", maxBuffer: 1 << 28 });
  const headV = (headHtml.match(new RegExp(base.replace(/\./g, "\\.") + "\\?v=([^\"]+)")) || [])[1];
  const headSrc = execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 });
  const nowSrc = readFileSync(f, "utf8");
  ok(`${base} 内容改了 ⇒ ?v= 也改了`, nowSrc === headSrc || (v && v !== headV),
     `?v=${v} 与 HEAD 相同但内容已变 —— 浏览器会拿旧字节`);
}

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
