/* W2207 回归 — Jing:「请配一个 / 快捷键。」
 *
 * 关键事实: 「/」这个键【本来就有人占】, 但占它的是【另一个搜索】——
 *   app.global-search.js  /  → /api/person-mv/search  查人物/人物MV/评论
 *   app.watch-search.js      → /api/works/market?q=   查作品库(W2206 在影院态被收起)
 * 所以「/ 已经存在」≠ 影院态丢掉的作品搜索回来了。本波只在影院态把 / 接到作品搜索,
 * 其它状态一个字符不动。
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

const ws   = strip(read("public/app.watch-search.js"));
const gs   = strip(read("public/app.global-search.js"));
const html = read("public/index.html");

// ① 两个搜索确实查的不是一个东西 —— 这是本波存在的前提, 前提没了就该重新想
ok("全局 / 查的是 person-mv", /person-mv\/search/.test(gs));
ok("本搜索框查的是作品库 works/market", /works\/market/.test(ws),
   "两者若查同一个接口, 本波就是多余的");

// ② 新键存在, 且【只在影院态】接管
ok("有 / 处理函数", /function cinemaSlashKey\(e\)/.test(ws));
// 下面的判据一律只看 cinemaSlashKey 的函数体 —— 这些片段(stopPropagation /
// showBar(true) / input.focus())在本文件别处本来就有, 拿整份文件判等于没判。
const fn = (ws.match(/function cinemaSlashKey\(e\)[\s\S]*?\n    \}/) || [""])[0];
ok("能取到 cinemaSlashKey 函数体", fn.length > 120);
ok("只认裸 /, 带修饰键不抢", /e\.key !== "\/"\) return;/.test(fn)
   && /e\.metaKey \|\| e\.ctrlKey \|\| e\.altKey\) return;/.test(fn));
ok("输入框/文本域/可编辑区里不抢",
   /tagName === "INPUT" \|\| t\.tagName === "TEXTAREA" \|\| t\.isContentEditable\)\) return;/.test(fn));
ok("判据是 #watch-panel.maximized(与 W2205/W2206 同一个)",
   /getElementById\("watch-panel"\)[\s\S]{0,200}?classList\.contains\("maximized"\)\) return;/.test(fn),
   "不能用 body.cssos-cinema-mode —— 媒体框宪法明写它常年挂着, 拿它判状态是假的");
ok("非影院态原样让给全局搜索(return, 不 preventDefault)",
   /if \(!wp \|\| !wp\.classList\.contains\("maximized"\)\) return;\s*\n\s*e\.preventDefault\(\);/.test(fn),
   "先 return 再 preventDefault —— 顺序反了就把全局搜索也吃掉了");

// ③ 抢得住: 必须 capture + stopPropagation, 否则两个搜索一起弹
ok("捕获阶段注册", /phase: "capture"/.test(ws));
ok("挂在 document 上(与全局搜索同一个节点)", /target: "document"/.test(ws));
ok("stopPropagation 挡住全局搜索", /e\.stopPropagation\(\);/.test(fn));
ok("全局搜索确实是 document 冒泡(所以捕获跑在它前面)",
   /document\.addEventListener\("keydown", function \(e\) \{[\s\S]{0,260}?e\.key !== "\/"\) return;/.test(gs)
   && !/e\.key !== "\/"\) return;[\s\S]{0,400}?\}, true\);/.test(gs),
   "若全局搜索改成 capture, 本波的抢占前提就没了");

// ④ 走中枢, 不另造轮子; 中枢没加载才回退(watch-search 在 index.html 里排在中枢之前)
ok("走 cssosShortcuts 中枢注册", /cssosShortcuts\.register\(\{/.test(ws));
ok("中枢缺席时回退到裸捕获监听",
   /document\.addEventListener\("keydown", cinemaSlashKey, true\);/.test(ws));

// ⑤ 唤出后要能直接打字
ok("唤出用 force 旁路(影院态被动触发是被拦的)", /showBar\(true\);/.test(fn));
ok("并把焦点送进输入框", /input\.focus\(\)/.test(fn));

// ⑥ 缓存键必须跟着内容变(不变 = 浏览器拿旧字节, 改了等于没改)
const m = html.match(/app\.watch-search\.js\?v=([^"]+)/);
ok("index.html 引了 app.watch-search.js", !!m);
if (m) {
  const headHtml = execSync("git show HEAD:public/index.html", { encoding: "utf8", maxBuffer: 1 << 28 });
  const headV = (headHtml.match(/app\.watch-search\.js\?v=([^"]+)/) || [])[1];
  const headSrc = execSync("git show HEAD:public/app.watch-search.js", { encoding: "utf8", maxBuffer: 1 << 28 });
  const nowSrc  = readFileSync("public/app.watch-search.js", "utf8");
  ok("内容改了 ⇒ ?v= 也改了", nowSrc === headSrc || m[1] !== headV,
     `?v=${m[1]} 与 HEAD 相同但文件内容已变 —— 浏览器会拿旧字节`);
}

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
