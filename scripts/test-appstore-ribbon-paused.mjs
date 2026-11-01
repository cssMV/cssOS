/* W2264 回归 — Jing:「请暂停这条横幅, 取消显示即可, 以后还会用到的。也许是不同的内容,
 * 关闭不显示即可, 不要删除掉代码。」
 *
 * 两头都判, 缺一不可:
 *   ① 现在【不显示】—— ENABLED=false 且在挂任何监听之前就 return;
 *   ② 以后【还能用】—— 整模块原样还在(文案 / × / 点哪都能关 / 全屏搬运 / sessionStorage),
 *      把 ENABLED 改回 true 就恢复。
 * 只判①会让「顺手删干净」也通过, 那正是 Jing 明确不要的。
 *
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败(HEAD 上还在显示)。 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };
const strip = (s) => s.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");

const raw  = read("public/app.appstore-ribbon.js");
const js   = strip(raw);
const html = read("public/index.html");

// ① 现在不显示
ok("有一个明确的开关 ENABLED", /var ENABLED = (true|false);/.test(js));
ok("开关是关的", /var ENABLED = false;/.test(js));
ok("关在挂监听之前就 return(停用不留副作用)",
   js.indexOf("if (!ENABLED) return;") > 0 &&
   js.indexOf("if (!ENABLED) return;") < js.indexOf('addEventListener("fullscreenchange"'),
   "放在 mount() 里 early-return 的话, 每次进出全屏仍要跑一遍搬运逻辑");

// ② 以后还能用 —— 代码一行没删
ok("横幅文案还在(换内容就改这句)", /now on the App Store/.test(raw));
ok("mount() 还在", /function mount\(\) \{/.test(js));
ok("× 关闭按钮还在", /id="cssos-appstore-ribbon-x"/.test(js));
ok("W2214「点哪都能关」还在", /bar\.addEventListener\("click", dismiss\);/.test(js));
ok("W1596 关闭语义(sessionStorage, 只管本次会话)还在",
   /sessionStorage\.setItem\(KEY, "1"\)/.test(js));
ok("W1765 真全屏搬运还在", /function reparentForFullscreen\(\)/.test(js));
ok("W2214 的 top:12px 没被顺手改", /top:calc\(12px \+ env\(safe-area-inset-top\)\)/.test(js));
ok("<script> 标签还在(没从 index.html 摘掉)",
   /app\.appstore-ribbon\.js\?v=/.test(html));

// ③ 缓存键必须跟着内容变
const v  = (html.match(/app\.appstore-ribbon\.js\?v=([^"]+)/) || [])[1];
const headHtml = execSync("git show HEAD:public/index.html", { encoding: "utf8", maxBuffer: 1 << 28 });
const hv = (headHtml.match(/app\.appstore-ribbon\.js\?v=([^"]+)/) || [])[1];
const same = execSync("git show HEAD:public/app.appstore-ribbon.js", { encoding: "utf8", maxBuffer: 1 << 28 })
             === readFileSync("public/app.appstore-ribbon.js", "utf8");
ok("内容改了 ⇒ ?v= 也改了", same || (v && v !== hv),
   `?v=${v} 与 HEAD 相同但内容已变 —— 浏览器会拿旧字节, 横幅照常出现`);

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
