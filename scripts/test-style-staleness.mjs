#!/usr/bin/env node
/* W2168 回归 —— 换新活时清掉【残留】风格, 但绝不误清用户新填的。
 *
 * 事故: 2026-09-24《鶴の恩返し/白鹤报恩》, Jing 在提示词里写「音乐风格请使用日本雅乐」,
 * 实际发给 Suno 的 style 是上一首残留的 `ambient shoegaze`。歌出来了, 但不是他要的那种。
 * W212 当年只清歌词没清风格 —— 因为风格可能是用户刚填的, 一律清会抹掉他的意图。
 *
 * 判据必须同时满足两条才算残留: 换了新活 + 风格框自上次运行以来没被动过。
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

ok("记住上一次运行用过的风格", /state\._lastPipelineStyle = String/.test(live),
   "不记就分不清『残留』和『用户新填的』");
ok("清理判据同时要求 promptChanged 和 风格未被改动",
   /if \(promptChanged && _curStyle && _lastStyle && _curStyle === _lastStyle\)/.test(live),
   "少任一条都会误清用户刚填的风格");
ok("命中时清 state.style", /_curStyle === _lastStyle\)[\s\S]{0,400}?state\.style = ""/.test(live));
ok("命中时也清 DOM 输入框", /_elStyle\.value = ""/.test(live),
   "只清 state 没用 —— 每次运行都从 #mvp-style 现读");
ok("清完派发 input 事件(让联动的控件跟上)", /_elStyle\.dispatchEvent\(new Event\("input"/.test(live));
ok("清理逻辑被 try 包住, 不会让运行失败", /\} catch \(_styErr\)/.test(live));
ok("歌词的原有清理没被动", /state\.lyrics = "";[\s\S]{0,80}?taLyrics\.value = ""/.test(live));
// 成功后整体清空这条(W2166)仍在 —— 两条是互补的: 一条管跑完, 一条管没跑完就换活
ok("跑完成功后的整体清空仍在", /clearCreationInputsAfterSuccessModule/.test(live));

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} 过 / ${fail} 败` + (CAL ? "  [校准: 期望有失败]" : ""));
process.exit(CAL ? 0 : (fail ? 1 : 0));
