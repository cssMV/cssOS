/* W2331 回归 — Jing:「请禁止助理被拒后自己改做别的戏路。」
 *
 * 事故(今晚实测): 用户要一部日本歌剧, create_work 被生成权闸拒绝
 * (need_rights 21 / have 9), 助理【没有停下来】, 而是自己改做了一部三部曲
 * 《時代を売らない》并且成功建出来。它在文字里确实说了"歌剧做不了",
 * 但屏幕上只看到三部曲建成了 —— 用户要的东西没做出来, 看起来却像成功了。
 * 那比明着失败更坏, 而且照样花了钱。
 *
 * 为什么必须有【代码闸】而不是只写提示: 今晚同一个晚上,
 * 规划提示里"每幕 3-12 场"那句软约束被无视成了 21 场。提示照样写, 但保证只能由代码做。
 *
 * 判的四件事:
 *   ① 提示里写明了(让助理把原始失败说清楚, 而不是撞上闸才停)
 *   ② 闸【在调用工具之前】, 并且 continue —— 拦住就意味着一分钱不花
 *   ③ 只拦【换戏路】, 同戏路重试放行(用户可能刚充值; 且闸已在花钱之前)
 *   ④ 失败登记在【调用之后】, 任何 create_work 错误都登记
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };

const src = read("src/index.ts");

// ① 提示
ok("系统提示里写明了禁止换戏路",
   /NEVER SUBSTITUTE A DIFFERENT WORK TYPE AFTER A FAILURE \(W2331\)/.test(src),
   "提示负责让助理把原始失败说清楚 —— 它不该是撞上闸才停");
ok("提示里点名了【别悄悄做个三部曲】这种具体行为",
   /do NOT quietly make a triptych because the opera was refused/.test(src),
   "抽象的'不要替换'容易被读成别的意思; 今晚的真实行为要写进去");

// ② 闸的位置: 必须在 runAgentTool 之前, 且 continue
const iState = src.indexOf("let _refusedCreateWorkType");
const iGate = src.indexOf('if (toolName === "create_work" && _refusedCreateWorkType)');
const iCall = src.indexOf("result = await runAgentTool(toolName, toolInput");
const iLatch = src.indexOf('if (toolName === "create_work" && fullResult && fullResult.error');
ok("状态声明在工具循环之前", iState > 0 && iGate > iState, `state=${iState} gate=${iGate}`);
ok("【闸排在 runAgentTool 之前】—— 拦住就等于一分钱不花",
   iGate > 0 && iCall > 0 && iGate < iCall,
   `gate=${iGate} call=${iCall} —— 排在后面就等于先做了再说不该做`);
const gateBody = iGate > 0 && iCall > iGate ? src.slice(iGate, iCall) : "";
ok("拦住的那一支直接 continue(不会落到真正执行那一行)",
   /\n\s*continue;\s*\n/.test(gateBody),
   "不 continue 就会继续往下走到 runAgentTool, 闸形同虚设");
ok("拦住时仍然给模型一条 tool_result(说明为什么被拦)",
   /work_type_substitution_blocked/.test(gateBody)
     && /toolResults\.push\(\{ type: "tool_result"/.test(gateBody),
   "不回 tool_result, Anthropic 的 tool_use 会话会缺一条配对, 这一轮直接崩");
ok("tool_result 里带上【原始失败】, 让助理照实转述",
   /original_error: _refusedCreateError/.test(gateBody));

// ③ 只拦换戏路
ok("只在 work_type 【不同】时拦", /if \(wantWt !== _refusedCreateWorkType\)/.test(gateBody),
   "同戏路重试要放行: 用户可能刚充了值, 而且闸已排在花钱之前(W2327), 再拒一次几乎不花钱");
ok("缺省 work_type 归一成 single, 不会把 undefined 当成另一种戏路",
   /work_type \|\| "single"\)\.trim\(\)\.toLowerCase\(\) \|\| "single"/.test(gateBody));

// ④ 登记
ok("失败登记排在【调用之后】", iLatch > 0 && iLatch > iCall, `latch=${iLatch} call=${iCall}`);
ok("任何 create_work 错误都登记(不只闸拒)",
   /fullResult\.error && !_refusedCreateWorkType/.test(src),
   "歌词失败/建行失败同样不该换一种交差 —— 用户要的那种没做出来");
ok("只登记第一次失败(!_refusedCreateWorkType), 不被后续覆盖",
   /&& !_refusedCreateWorkType\) \{/.test(src));
ok("登记与拦截都留日志(事后能复盘)",
   /\[agent\]\[W2331\] 拦下换戏路重试/.test(src) && /\[agent\]\[W2331\] create_work\(%s\) 失败/.test(src));

// 作用域: 不许跨请求
ok("状态是【本次请求】的局部变量, 不是模块级(下一次用户开口是新意图)",
   /^\s{2}let _refusedCreateWorkType = "";$/m.test(src),
   "模块级会让一次失败绑住后面所有人的请求");

console.log(`\nW2331  ✅ ${pass}  ❌ ${fail}` + (CAL ? "   (CALIBRATE: 期望有 ❌)" : ""));
process.exit(fail ? 1 : 0);
