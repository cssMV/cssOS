/* W2264 回归 — Jing:「播放器右侧栏等=右下角的搜索按钮, 请删除掉。」
 *
 * 这份测试原来钉的是 W2208「右轨必须有 🔍」。那一条已被 Jing 当面取消, 于是
 * 整份翻面: 现在钉的是【它必须不在】, 并且【唤出搜索的其余入口一个都不能少】——
 * 删掉一个入口不等于把功能删了, 真删了才是回归。
 *
 * 为什么不是把文件删掉: 留着这份反向测试, 下一个人(或下一个我)照着 W2208 的注释
 * 把 🔍 加回去时会当场红。删了测试 = 把这条取消变成口头约定。
 *
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败(HEAD 上 🔍 还在)。 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };
const strip = (s) => s.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");

const railRaw = read("public/app.watch-social-rail.js");
const rail = strip(railRaw);
const ws   = strip(read("public/app.watch-search.js"));
const html = read("public/index.html");

// ① 右轨那一格确实没了
ok("右轨不再 append 🔍 项", !/rail\.appendChild\(mkItem\("🔍"/.test(rail),
   "W2264 已删; 别照着 W2208 的旧注释加回来");
ok("右轨代码里一个 🔍 都不剩(注释里的墓碑不算)", !/🔍/.test(rail));
ok("留了墓碑注释说明为什么删(防止下一个人'修复'它)",
   /CSSOS_WAVE_2264/.test(railRaw) && /🔍/.test(railRaw),
   "注释被一起删掉 = 这条取消只剩口头约定");

// ② 右轨其余项一个都没被误伤 —— 删一格最容易顺手删到邻居
for (const [icon, name] of [["💬", "评论"], ["📤", "分享"], ["🎧", "聆听"], ["🎞️", "观看"],
                            ["💝", "打赏"], ["💎", "买断"], ["＋", "AI 助理"]]) {
  ok(`右轨 ${name} ${icon} 还在`, rail.includes(`mkItem("${icon}"`));
}
ok("AI ＋ 仍是 #cssos-rail-ai(贴边 10px 那条规则按 id 选它)",
   /aiBtn\.id = "cssos-rail-ai";/.test(rail));

// ③ 功能没跟着没 —— 唤出搜索的其余入口必须完好
ok("summon() 还在(唤出搜索的唯一真源)", /function summon\(\) \{/.test(ws));
ok("cssosWatchSearchShow 仍指向 summon", /globalThis\.cssosWatchSearchShow = summon;/.test(ws));
ok("/ 键入口(W2207)还在", /e\.key !== "\/"\) return;/.test(ws),
   "右轨那格没了之后, / 键是键盘用户唯一的主动唤出方式");
ok("summon 仍清 CHROME 的 display:none(否则框 0×0, focus 落不进去)",
   /cssosWatchChromeWake\(\)/.test(ws));
ok("index.html 仍把 wake 暴露出来", /globalThis\.cssosWatchChromeWake = wake;/.test(html));

// ④ 缓存键必须跟着内容变(独立 <script src?v=> 不 bump 就是改了也不生效)
for (const f of ["public/app.watch-social-rail.js", "public/app.watch-search.js"]) {
  const base = f.split("/").pop(), esc = base.replace(/\./g, "\\.");
  const v  = (html.match(new RegExp(esc + "\\?v=([^\"]+)")) || [])[1];
  const headHtml = execSync("git show HEAD:public/index.html", { encoding: "utf8", maxBuffer: 1 << 28 });
  const hv = (headHtml.match(new RegExp(esc + "\\?v=([^\"]+)")) || [])[1];
  const same = execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 }) === readFileSync(f, "utf8");
  ok(`${base} 内容改了 ⇒ ?v= 也改了`, same || (v && v !== hv),
     `?v=${v} 与 HEAD 相同但内容已变 —— 浏览器会拿旧字节`);
}

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
