/* W2191 回归 — Jing:「请把 8 张上限改掉, 让封面数跟着 ♪ 数走。」
 *
 * 上限【不止是那个数字】: 变体后缀池本来正好 8 条, slice(0, n-1) 用完就没了。
 * 只改数字不改池子, ♪9 往后共用同一条提示词 → 生成出来长得一样,
 * 正好毁掉「六张张张不同」那个效果。所以这份测试两样都验。
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
const live = (s) => s.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");

// ① 数字上限
const panel = live(read("public/app.mv-pipeline-panel.js"));
ok("面板出图张数不再钉死 8", !/Math\.min\(8, Number\(state\.coverCount\)/.test(panel),
   "8 就是 Jing 要去掉的那个顶");
ok("面板出图张数改为 64 硬顶", /Math\.min\(64, Number\(state\.coverCount\) \|\| 3\)/.test(panel));
ok("封面池张数也一并放开", (panel.match(/Math\.min\(64, Number\(state\.coverCount\)/g) || []).length >= 2,
   "两处都要改: 变体生成 + /cover-pool");
const api = live(read("src/index.ts"));
ok("/api/mv/plate 不再钉死 8", !/Math\.min\(8, Number\(body\.count\)/.test(api));
ok("/api/mv/plate 改为 64 硬顶", /Math\.min\(64, Number\(body\.count\) \|\| 1\)/.test(api));

// ② 池子: 按面板里真正的那套算法跑一遍, 验到 64 都不重样
const zhM = /const _baseZh = (\[[^\]]*\]);/.exec(panel);
const a2M = /const _axis2Zh = (\[[^\]]*\]);/.exec(panel);
ok("抠得出两轴后缀池(判据本身没瞎)", !!zhM && !!a2M);
if (zhM && a2M) {
  const base = JSON.parse(zhM[1].replace(/，/g, "，"));
  const ax2 = JSON.parse(a2M[1].replace(/，/g, "，"));
  const build = (n) => { const o = []; for (let i = 0; i < n - 1; i++)
    o.push(base[i % base.length] + ax2[Math.floor(i / base.length) % ax2.length]); return o; };
  for (const n of [8, 12, 24, 64]) {
    const o = build(n);
    ok(`coverCount=${n} 时 ${o.length} 条变体全不重样`, new Set(o).size === o.length,
       `去重后只剩 ${new Set(o).size} 条 —— 重复的提示词会生成出一样的画面`);
  }
  const OLD8 = ["，特写", "，广角", "，侧光", "，柔雾", "，逆光剪影", "，俯拍", "，黄金时刻", "，雨夜霓虹"];
  ok("前 8 条与改前逐字一致(没让改的不碰)",
     JSON.stringify(build(8)) === JSON.stringify(OLD8.slice(0, 7)),
     `现在是 ${JSON.stringify(build(8))}`);
}

// ③ 张数仍然跟着 take 数走(W2181 的那条, 别被这波改掉)
ok("定妆照张数仍按 take 数出满", /state\.coverCount = Math\.max\(_takeCount/.test(panel));

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
