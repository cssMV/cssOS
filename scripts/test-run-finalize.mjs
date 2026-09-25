#!/usr/bin/env node
/* W2166 回归 —— 生成完毕后必须: 入库 · 音频落 R2 · 覆盖层退场 · 自动播放。
 *
 * 事故: W2137 把 compose 从 DAG 删掉(永不烧录), 但整个收尾埋在 compose 里 ——
 * saveAsWork 第一行 `if (!state.mvUrl) return null` 永远成立, commit 从此没发生过。
 * 2026-09-24《鶴の恩返し》三次运行 6 首音频只存在于 tempfile.aiquickdraw.com,
 * 库里 0 行, 差点全丢。
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

const panel = nocomment(read("public/app.mv-pipeline-panel.js"));
const idx   = nocomment(read("src/index.ts"));

console.log("— 后端: 音频返回前落 R2 —");
ok("♪1 走 persistRemoteAudioToStable", /_stable = await persistRemoteAudioToStable\(String\(tier\.audio_url\)\)/.test(idx),
   "不落盘 = 把 tempfile.aiquickdraw.com 的临时地址存进库(李清照教训)");
ok("♪2 也落盘(两首都付过钱)", /persistRemoteAudioToStable\(String\(tier\.alt_audio_url\)\)/.test(idx));
ok("落盘失败不静默(会 warn)", /W2166\] ♪1 落盘未生效/.test(read("src/index.ts")));

console.log("— 前端: saveAsWork 的闸门 —");
ok("不再只认 mvUrl", !/async function saveAsWork\(mvId\) \{\s*\n\s*if \(!state\.mvUrl\) return null;/.test(panel),
   "mvUrl 是 compose 的产物, compose 已从 DAG 删除 → commit 永不发生");
ok("有音频就能入库", /!state\.mvUrl && !state\.audioUrl && !state\.audioUrlBackendOnly/.test(panel));

console.log("— 前端: DAG 成功后的收尾 —");
ok("DAG 成功后调用 saveAsWork", /_res = await saveAsWork\(_mvId\)/.test(panel));
ok("入库后派发 cssmv:run-finish", /CustomEvent\("cssmv:run-finish"/.test(panel));
ok("只有拿到 work_id 才清创作输入",
   /if \(_res && _res\.work_id\)[\s\S]{0,700}?clearCreationInputsAfterSuccessModule/.test(panel),
   "没入库就清 = 把用户的词也弄丢");
ok("覆盖层退场", /showMvOverallProgress\(false\)/.test(panel));
ok("自动播放音乐, 不让用户点", /_a\.play\(\)/.test(panel) && /watch-audio-preview/.test(panel));
ok("播放被拦时退回平台既有通道", /fallbackWatchPlaybackToMusicModule/.test(panel));

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} 过 / ${fail} 败` + (CAL ? "  [校准: 期望有失败]" : ""));
process.exit(CAL ? 0 : (fail ? 1 : 0));
