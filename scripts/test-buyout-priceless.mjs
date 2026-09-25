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

/* 守【性质】不守某个具体波号: 这些文件后面还会被别的波次改, 钉死波号会在每次
 * 正常 bump 之后变成假失败(今天连着假失败三次)。
 *
 * 真正要守的不变式是:【这个文件的内容变了, 它的 ?v= 就必须跟着变】——
 * 内容没动时 ?v= 保持原样是完全正确的, 不该判失败(第一版改成"不等于上一版"
 * 时就立刻在没改动的 app.takes.js 上又假失败了一次)。 */
const gitShow = (rev, f) => { try { return execSync(`git show ${rev}:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 }); } catch (e) { return null; } };
const vOf = (file, html) => (String(html || "").match(new RegExp(file.replace(/[.]/g, "[.]") + "\\?v=([^\"']+)")) || [])[1] || "";
function cacheKeyOk(file) {
  const now = readFileSync("public/" + file, "utf8");
  const prev = gitShow("HEAD~1", "public/" + file);
  const vNow = vOf(file, readFileSync("public/index.html", "utf8"));
  const vPrev = vOf(file, gitShow("HEAD~1", "public/index.html"));
  if (prev == null) return { ok: !!vNow, why: `${file} 是新文件, ?v="${vNow}"` };
  if (prev === now) return { ok: true, why: `${file} 内容未变, ?v="${vNow}" 保持原样是对的` };
  return { ok: !!vNow && vNow !== vPrev,
           why: `${file} 内容变了, ?v= 从 "${vPrev}" → "${vNow}"(必须变, 否则浏览器照旧拿旧文件)` };
}

ok("抠得出 buyoutCents(判据本身没瞎)", !!body);
let f = null;
/* W2189 起 buyoutCents 会先问 cachedPrice()(卡片没带价格字段时按作品 id 拉回来的缓存)。
 * 抠出来单跑时那个函数不在作用域里 —— 注入一个【空缓存】版本: 既让函数跑得起来,
 * 又保证下面每一条断言验的仍是【字段齐全时的取值规则】本身, 没被缓存偷偷改写。 */
try { f = new Function("cachedPrice", "w", body).bind(null, () => null); }
catch (e) { console.log("       new Function 抛错:", e.message); }
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
/* W2189 — 缺字段时走缓存那条新分支: feed 卡片不带价格, 拉回来的作品信息说"买断关闭"
 * → 必须是 0(Priceless), 不能再落到 599 兜底。这正是 Jing 看到的 $5.99。 */
if (body) {
  const withCache = new Function("cachedPrice", "w", body)
    .bind(null, () => ({ listen: 66, buyout: 0, buyoutEnabled: false }));
  ok("卡片缺价格字段 + 缓存说买断关闭 → 0(Priceless)", withCache({}) === 0,
     `得到 ${withCache({})}, 期望 0`);
  const withPrice = new Function("cachedPrice", "w", body)
    .bind(null, () => ({ listen: 66, buyout: 1499, buyoutEnabled: true }));
  ok("卡片缺价格字段 + 缓存有价 → 用缓存的价", withPrice({}) === 1499,
     `得到 ${withPrice({})}, 期望 1499`);
}
// 显示分支仍在(W1258)
ok("0 走 Priceless 分支(W1258 的铁律)", /_bc > 0 \? fmtCents\(_bc\) : copy\("Priceless"/.test(src));

const html = readFileSync("public/index.html", "utf8");
const v = (html.match(/app\.watch-social-rail\.js\?v=([^"']+)/) || [])[1] || "";
{ const r = cacheKeyOk("app.watch-social-rail.js"); ok("watch-social-rail 的 ?v= 随内容变更而 bump", r.ok, r.why); }

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} 过 / ${fail} 败` + (CAL ? "  [校准: 期望有失败]" : ""));
process.exit(CAL ? 0 : (fail ? 1 : 0));
