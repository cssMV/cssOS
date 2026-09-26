/* W2211 回归 — Jing:「请恢复影院态的搜索框。」
 *
 * 这是撤销 W2206, 但【不能把 W2205 撞坏】。W2206 当初收起它, 是因为它内联 top:4px、
 * 高 42px, 正好盖住影院态四边 seek 的顶边 16px 带(_BP = 16) —— elementFromPoint
 * 命中 INPUT, 点下去只是聚焦输入框。现在改成【框让位】: 影院态下移到 20px。
 * 所以本测试两头都判: 框必须回来, 顶边那 16px 必须仍然露给 seek。
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

const ws  = strip(read("public/app.watch-search.js"));
const ui  = strip(read("public/app.watch-ui.js"));
const wcss = read("public/style.watch.css");
const html = read("public/index.html");

// ① 框回来了 —— W2206 那段影院态拦截整段没了
ok("showBar 不再对影院态早退",
   !/classList\.contains\("maximized"\)\) \{\s*\n\s*box\.style\.transform = "translateY\(-140%\)"/.test(ws),
   "那段一在, 鼠标动一下框就被按回收起位");
ok("showBar 无条件露出", /function showBar\(force\) \{\s*\n\s*box\.style\.transform = "translateY\(0\)";/.test(ws));

// ② 顶边 16px 仍归 seek —— 框让位, 不是又被收起
const band = (ui.match(/_BP = (\d+)/) || [])[1];
ok("影院态四边 seek 的带宽读得到", !!band);
const shift = (wcss.match(/#watch-panel\.maximized #watch-search-box \{\s*top: calc\(env\(safe-area-inset-top, 0px\) \+ (\d+)px\) !important;/) || [])[1];
ok("影院态给搜索框设了下移量", !!shift);
ok(`下移量(${shift}px)大于 seek 带宽(${band}px)`, Number(shift) > Number(band),
   "小于等于就等于没让位, 顶边 seek 又会被输入框吃掉");

// ③ 让位必须真盖得过 JS 写的内联 top
ok("基准 top 确实是内联写的(所以必须 !important)",
   /top:calc\(env\(safe-area-inset-top,0px\) \+ 4px\)/.test(ws));
ok("让位规则带 !important", /#watch-panel\.maximized #watch-search-box \{[\s\S]*?!important;/.test(wcss));
ok("选择器特指度高过 html.cssos-app 那条(两端都生效)",
   /#watch-panel\.maximized #watch-search-box/.test(wcss)
   && /html\.cssos-app #watch-search-box/.test(read("public/style.css")),
   "style.css:7064 那条也是 !important, 靠多一个 id 赢");
ok("规则写在 style.watch.css(它在 style.css 之后加载)", /#watch-panel\.maximized #watch-search-box/.test(wcss));

// ④ 没碰被锁死的媒体框绿光(W1983)
ok("媒体框绿光那段一个字符未动",
   /\.watch-screen::after \{[\s\S]*?0 0 14px rgba\(0, 245, 160, 0\.34\)[\s\S]*?0 0 38px rgba\(0, 245, 160, 0\.22\)[\s\S]*?0 0 78px rgba\(11, 247, 255, 0\.12\)[\s\S]*?inset 0 0 22px rgba\(0, 245, 160, 0\.13\)/.test(wcss),
   "W1983 已锁: 三层外辉光 14/38/78 + inset 22, 动它要先拿 Jing 的 yes");
ok("新规则只针对 #watch-search-box, 不涉及 .watch-screen/.watch-frame",
   !/#watch-panel\.maximized #watch-search-box \{[^}]*watch-(screen|frame)/.test(wcss));

// ⑤ / 键与右轨 🔍 的 summon 没被这波弄坏
ok("summon 仍在(两个入口共用)", /function summon\(\) \{/.test(ws));
ok("summon 仍清 CHROME 的 display:none", /cssosWatchChromeWake\(\)/.test(ws));

// ⑥ 缓存键
const headHtml = execSync("git show HEAD:public/index.html", { encoding: "utf8", maxBuffer: 1 << 28 });
for (const f of ["public/app.watch-search.js", "public/style.watch.css"]) {
  const base = f.split("/").pop(), esc = base.replace(/\./g, "\\.");
  const v = (html.match(new RegExp(esc + "\\?v=([^\"]+)")) || [])[1];
  const hv = (headHtml.match(new RegExp(esc + "\\?v=([^\"]+)")) || [])[1];
  const same = execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 }) === readFileSync(f, "utf8");
  ok(`${base} 内容改了 ⇒ ?v= 也改了`, same || (v && v !== hv),
     `?v=${v} 与 HEAD 相同但内容已变 —— 浏览器会拿旧字节`);
}

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
