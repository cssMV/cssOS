#!/usr/bin/env node
/* W2172 回归 —— 买断显式 0 / 关闭 = 无价之宝, 不能被 599 兜底吃掉。
 *
 * 事故: W1258 立了铁律「买断 0/未设 = 无价之宝, 绝不是免费/0」, 但它判的是 _bc > 0,
 * 而 W1167 的 buyoutCents() 写成 `Number(a||b||c) || 599` —— 0 在到达判断前就变成 599,
 * 那条铁律从来没生效过。《鶴の恩返し/白鹤报恩》买断 0 + buyout_enabled=false,
 * 右轨照样显示 $5.99。
 *
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const src = CAL ? execSync("git show HEAD:public/app.watch-social-rail.js", { encoding: "utf8", maxBuffer: 1 << 28 })
                : readFileSync("public/app.watch-social-rail.js", "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };

/* 把 buyoutCents 从源码里抠出来【真跑】—— 不是 grep 字符串。
 * 抽取必须数大括号: 第一版我用 /\{[\s\S]*?\n  \}/ 跨行非贪婪, 在旧版那种【一行写完】
 * 的写法上会贪到后面某个函数的收尾大括号, 抠出不平衡的片段 → new Function 抛错 →
 * 六条行为判据整个被跳过, 校准只剩"解析失败", 复现不了故障。那不叫校准。 */
function extractFn(text, name) {
  const at = text.indexOf("function " + name + "(w)");
  if (at < 0) return null;
  const open = text.indexOf("{", at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return text.slice(open + 1, i); }
  }
  return null;
}
const body = extractFn(src, "buyoutCents");
ok("抠得出 buyoutCents(判据本身没瞎)", !!body);
let f = null;
try { f = new Function("w", body); } catch (e) { console.log("       new Function 抛错:", e.message); }
ok("能执行", typeof f === "function");
if (f) {
  const t = (name, w, want) => ok(name, f(w) === want, `得到 ${f(w)}, 期望 ${want}`);
  t("买断 0 且 buyout_enabled=false → 0(无价之宝)", { current_buyout_price_cents: 0, suggested_buyout_price_cents: 0, buyout_enabled: false }, 0);
  t("显式 0 → 0", { current_buyout_price_cents: 0 }, 0);
  t("正常价原样返回", { current_buyout_price_cents: 1499 }, 1499);
  t("只有建议价时用建议价", { suggested_buyout_price_cents: 599 }, 599);
  t("三个字段都缺席 → 仍回到 W1167 的 599 兜底", {}, 599);
  t("w 为空 → 599", null, 599);
}
// 显示分支仍在(W1258)
ok("0 走 Priceless 分支(W1258 的铁律)", /_bc > 0 \? fmtCents\(_bc\) : copy\("Priceless"/.test(src));

const html = readFileSync("public/index.html", "utf8");
const v = (html.match(/app\.watch-social-rail\.js\?v=([^"']+)/) || [])[1] || "";
ok("watch-social-rail 的 ?v= 已 bump 到 w2172", /w2172/.test(v),
   `现在是 "${v}" —— 独立 <script src?v=> 不 bump, 浏览器照旧拿旧文件`);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} 过 / ${fail} 败` + (CAL ? "  [校准: 期望有失败]" : ""));
process.exit(CAL ? 0 : (fail ? 1 : 0));
