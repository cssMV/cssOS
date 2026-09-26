/* W2202 回归 — Jing:「赋予左右方向键快退⏪快进⏩功能, 上次提过, 但很没有实现。」
 *
 * 查下来功能【本来就在】(W2139, app.mv-keys.js), 现场实测也通:
 * 焦点在页面/胶囊上按 → 音频 60→65、视频同步, 顶部闪 "+5s · 1:05"(100% 不透明)。
 * 唯一会"按了没反应"的是【焦点停在搜索框里】—— 搜索框就在 MV 面板顶上,
 * 点过一次焦点就一直在那儿。让位给文字光标本身是对的, 错在【空框也让位】。
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
const src = read("public/app.mv-keys.js");
const live = src.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");

// ① 原有那套还在(别被后来的改动弄没了)
ok("裸 ←/→ 仍是 ±5s 快进快退",
   /key === "ArrowLeft" \|\| key === "ArrowRight"[\s\S]{0,140}?dx = key === "ArrowLeft" \? -5 : 5/.test(live));
ok("走 seekBy(音视频一起 seek, 不音画分家)",
   /var nt = seekBy\(dx\);/.test(live));
ok("seekBy 以音频为主并同步另一轨",
   /var primary = usable\(a\) \? a : \(usable\(v\) \? v : null\)/.test(live)
   && /var other = \(primary === a\) \? v : a;/.test(live),
   "CLAUDE.md: 平台四轨分离, 只 seek 一个会音画分家");
ok("对外暴露 cssosSeekBy", /globalThis\.cssosSeekBy = seekBy;/.test(live));
ok("Shift+←/→ 不抢(那是 ♪ 切换)", /&& !e\.shiftKey/.test(live));
ok("面板可见即可用, 不要求真全屏",
   /if \(!isWatchActive\(\) && !\(isSeekArrow && isWatchPanelVisible\(\)\)\) return;/.test(live));

// ② W2202 — 空输入框不再吞掉方向键
ok("有 isEmptyTextField 判据", /function isEmptyTextField\(el\)/.test(live));
ok("只放行【空且无选区】的输入框",
   /String\(el\.value \|\| ""\)\.length > 0\) return false;/.test(live)
   && /el\.selectionStart !== el\.selectionEnd\) return false;/.test(live),
   "框里有字或有选区 → 立刻还给文字光标, 打字体验不许变");
ok("放行还要求【正在看 MV】",
   /isEmptyTextField\(e\.target\) && isWatchPanelVisible\(\)/.test(live),
   "不在看 MV 时不该去动别人的输入框方向键");
ok("非方向键仍旧完全让位给输入框",
   /_seekArrowEarly = \(e\.key === "ArrowLeft" \|\| e\.key === "ArrowRight"\) && !e\.shiftKey/.test(live));

// ③ 提示可见(按了要有反馈, 否则用户以为没实现)
ok("flashHint 把 opacity 设回 1", /t\.style\.opacity = "1";/.test(live));
ok("提示带时间码, 不只是箭头", /fmtTime\(nt\)/.test(live));

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
