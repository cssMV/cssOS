#!/usr/bin/env node
/* W2169 回归 —— runAll 的并发闸必须在最前面, 且不能把用户锁死。
 *
 * 事故: 唯一的闸是 `if (state.running) return`, 但 state.running 要到函数第 ~940 行
 * 才置 true, 中间还有一次 await(低余额弹窗)。两次进入都能穿过去, 各跑一遍歌词阶段,
 * 各花一次 LLM 的钱。服务器日志实证: 同一秒两条 [mv-lyrics][SRC](23:39:19 / 23:52:17)。
 *
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const src = CAL ? execSync("git show HEAD:public/app.mv-pipeline-panel.js", { encoding: "utf8", maxBuffer: 1 << 28 })
                : readFileSync("public/app.mv-pipeline-panel.js", "utf8");
const live = src.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };

// 闸必须在 runAll 开头几行内 —— 装在后面等于没装
const i = live.indexOf("async function runAll(opts)");
ok("找到 runAll(判据本身没瞎)", i > 0);
const head = live.slice(i, i + 1400);
ok("闸门在 runAll 开头", /_startedAt/.test(head),
   "state.running 要到 ~940 行才置 true, 闸装在那儿拦不住同一秒的第二次进入");
ok("重复触发时直接 return", /if \(_prev && \(_now - _prev\) < 8000\)[\s\S]{0,300}?return;/.test(head));
ok("重复触发会连调用栈 warn 出来", /new Error\("duplicate runAll"\)\.stack/.test(live),
   "第二个调用方还没查出来 —— 不打栈就永远查不出");
ok("低余额弹窗后的自我重入放行", /if \(!options\._bypassTierPrompt\)/.test(head),
   "不放行 = 选完档位后再也跑不起来");

console.log("— 不能把用户锁在外面 —");
ok("用时间窗, 不用布尔标志", /_now - _prev\) < 8000/.test(live),
   "布尔标志漏清一处, 开始按钮就永久卡死(入口到 running=true 之间有十几处提前 return)");
ok("主动取消时立刻放闸", /picked\.picked[\s\S]{0,200}?state\._startedAt = 0/.test(live));
const fin = (live.match(/state\.running = false;\s*\n\s*state\._startedAt = 0;/g) || []).length;
ok("两处 finally 都放闸(runAll 与 runMultiPart)", fin === 2, `实际 ${fin} 处`);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} 过 / ${fail} 败` + (CAL ? "  [校准: 期望有失败]" : ""));
process.exit(CAL ? 0 : (fail ? 1 : 0));
