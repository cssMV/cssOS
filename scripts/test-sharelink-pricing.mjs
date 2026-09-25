#!/usr/bin/env node
/* W2173 回归 —— 分享深链打开的作品必须带着价格与归属。
 *
 * 事故: 右轨三个价全是兜底(🎧¢69 / 🎞️¢99 / 💎$5.99), 而库里是 66 / 0 / buyout_enabled=false。
 * 两处缺口叠加:
 *   ① 后端 /api/works/public/:id 的 SQL 查了 current_buyout_price_cents + buyout_enabled,
 *      但【映射时只返了 listen】, 买断那两个被丢掉。
 *   ② 前端 shapeWorkFromPublicResponse() 连拿到的 listen 都没往下传。
 * 而且两头字段名不一样(后端 listen_price_cents / 右轨读 current_listen_price_cents)——
 * 这正是它一路被漏掉的原因。
 *
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };
const nocomment = (t) => t.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");

const idx = nocomment(read("src/index.ts"));
const router = nocomment(read("public/app.share-link-router.js"));

console.log("— 后端公开接口 —");
ok("返回 current_buyout_price_cents", /current_buyout_price_cents: \(normalized as any\)/.test(idx),
   "SQL 查了却不返, 右轨只能退回 $5.99 兜底");
ok("返回 buyout_enabled", /buyout_enabled: \(normalized as any\)\.buyout_enabled === true/.test(idx));
ok("返回 owner_user_id(右轨判『自己的作品』要用)", /owner_user_id: \(row as any\)\.owner_user_id/.test(idx));

console.log("— 前端 shaper —");
const shaper = router.slice(router.indexOf("function shapeWorkFromPublicResponse"),
                            router.indexOf("function stripShareParam") > 0 ? undefined : undefined);
ok("带上 current_listen_price_cents(名字要和右轨一致)",
   /current_listen_price_cents: \(data\.listen_price_cents != null\)/.test(router),
   "后端叫 listen_price_cents, 右轨读 current_listen_price_cents —— 名字不接就永远是兜底");
ok("带上 current_buyout_price_cents", /current_buyout_price_cents: \(data\.current_buyout_price_cents != null\)/.test(router));
ok("带上 buyout_enabled", /buyout_enabled: data\.buyout_enabled === true/.test(router));
ok("带上 owner_user_id", /owner_user_id: data\.owner_user_id \|\| null/.test(router));
ok("用 != null 而不是 ||(0 是有意义的值)", /!= null\)\s*\?\s*Number\(data\.listen_price_cents\)/.test(router),
   "|| 会把显式的 0 当成没填 —— W2172 刚踩过同一个坑");

const html = read("public/index.html");
const v = (html.match(/app\.share-link-router\.js\?v=([^"']+)/) || [])[1] || "";
ok("share-link-router 的 ?v= 已 bump", /w2173/.test(v), `现在是 "${v}"`);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} 过 / ${fail} 败` + (CAL ? "  [校准: 期望有失败]" : ""));
process.exit(CAL ? 0 : (fail ? 1 : 0));
