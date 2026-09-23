#!/usr/bin/env node
/* W2148 回归 — resubtitle 的轨去重键 (lang) → (lang, voice), 且默认行为不变。
 *
 * 为什么: W2145 之后 pre-epic 轨与 epic 轨【同语言】, 被 DISTINCT ON (lang) 整条吃掉,
 * ?voice= 过滤永远 404(实跑 0/15 才发现)。同理平台上 voice='orig'/'childlike'/'jing'
 * 那些多声线轨一直就看不见。
 *
 * 但 W691f 的教训不能推翻: 字幕 JSON 按 lang 索引, 同语言多轨会互相覆盖
 * (Jerusalem 4 条 zh 串台)。所以【不带 ?voice= 时必须仍折叠成每语言一条】。
 *
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const idx = CAL ? execSync("git show HEAD:src/index.ts", { encoding: "utf8", maxBuffer: 1 << 28 })
                : readFileSync("src/index.ts", "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };
// 注释里会原样引用旧 SQL —— 两次被自己的注释骗过, 所以只看活代码
const live = idx.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");

ok("去重键是 (lang, voice)", /DISTINCT ON \(lang, voice\)/.test(live),
   "DISTINCT ON (lang) 会把同语言的另一个声线整条吃掉 → ?voice= 永远 404");
ok("select 里带上了 voice", /DISTINCT ON \(lang, voice\) lang, voice,/.test(live),
   "不 select voice, 过滤时 t.voice 是 undefined → 全被当成 auto");
ok("select 里带上了 is_default(折叠时要用)", /DISTINCT ON \(lang, voice\)[^`]*is_default/.test(live));
ok("ORDER BY 跟着键走", /ORDER BY lang, voice, is_default DESC, track_order/.test(live));
ok("无轨兜底分支也带 voice", /lang: "orig", voice: "auto"/.test(live),
   "兜底轨没有 voice → ?voice= 会把它误判成 auto");
ok("不带 ?voice= 时折叠回每语言一条(守住 W691f)",
   /if \(!_onlyVoice\) \{[\s\S]{0,700}?byLang/.test(live),
   "不折叠 = 同语言多声线各写一次, 后写的顶掉先写的(Jerusalem 串台重演)");
ok("折叠优先 is_default", /t\.is_default && !cur\.is_default/.test(live));
ok("?voice= 过滤仍在", /NO_SUCH_VOICE_TRACK/.test(live));
ok("?lang= 过滤没被碰坏", /NO_SUCH_LANG_TRACK/.test(live));

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} 过 / ${fail} 败` + (CAL ? "  [校准: 期望有失败]" : ""));
process.exit(CAL ? 0 : (fail ? 1 : 0));
