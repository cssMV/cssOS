/* W2204 回归 — Jing:「1. 点击边框任何地方 seek。2. 点击屏幕暂停/重新播放。」
 *
 * 两个功能 2026-05-04 就写好了(CSSOS_PHASE2_BORDER_SEEK)。边框 seek 一直是通的;
 * 点屏幕暂停不生效, 是因为【暂停之后立刻被救活】。
 *
 * 动手前把全站"救活"逻辑清点了一遍(静态扫 + 运行时给 play() 装探针):
 *   真正会跟用户对抗的只有两处, 都在 index.html —
 *     ① forceUnmuteAndPlay  挂在用户手势上 —— 而"点击暂停"本身就是手势
 *     ② W374 resume         监听 pause 事件, 120ms 后无条件 play()
 *   app.watch-audio-authority.js / app.watch-playback-watchdog.js 早就问过
 *   W1676 契约 cssosAudioIntentPaused, 所以它们不参与。
 *   另外 videoPlaying 恒真(W2190 藏起来的视频仍在播)导致点击永远走暂停分支。
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
const html = read("public/index.html");
const ui = read("public/app.watch-ui.js");

// ① 两个救活者都问契约
ok("forceUnmuteAndPlay 问 W1676 契约",
   /function forceUnmuteAndPlay\(\)[\s\S]{0,900}?if \(globalThis\.cssosAudioIntentPaused\) return;/.test(html),
   "它挂在手势上, 而「点击暂停」本身就是手势 → 暂停前先把音频播了一遍");
ok("W374 自动续播看门狗 resume() 问契约",
   /function resume\(\)[\s\S]{0,900}?if \(globalThis\.cssosAudioIntentPaused\) return;/.test(html),
   "它监听 pause 事件, 120ms 后无条件 play()");

// ② 已经合规的两处别被改坏
ok("watch-audio-authority 仍问契约", /cssosAudioIntentPaused|intentPaused/.test(read("public/app.watch-audio-authority.js")));
ok("watch-playback-watchdog 仍问契约", /cssosAudioIntentPaused|intentPaused/.test(read("public/app.watch-playback-watchdog.js")));

// ③ 点击处理器: 立契约 / 解契约 / 只认可见视频 / 边框只 seek
ok("暂停时立契约",
   /if \(videoPlaying \|\| audioPlaying\) \{[\s\S]{0,200}?globalThis\.cssosAudioIntentPaused = true;/.test(ui));
ok("再点一下解契约并继续播",
   /if \(globalThis\.cssosAudioIntentPaused\) \{[\s\S]{0,160}?cssosAudioIntentPaused = false;[\s\S]{0,400}?watchAudioPreview\.play\?\.\(\)/.test(ui),
   "不加这段, 暂停后的点击会掉进生成分支, 用户被按停在那儿出不来");
ok("videoPlaying 只认在出画面的视频",
   /const videoPlaying = !!\([\s\S]{0,400}?getComputedStyle\(watchVideo\)\.visibility !== "hidden"/.test(ui),
   "W2190 藏起来的视频仍在播 → videoPlaying 恒真 → 每次点击都走暂停分支");
ok("点边框只 seek, 提前 return 不占 350ms 锁",
   /_by <= _BP \|\| _by >= _bs\.height - _BP \|\| _bx <= _BP \|\| _bx >= _bs\.width - _BP\) return;/.test(ui),
   "边框 seek 归 media-layout; 不堵掉这里, 点边框会变成又跳又停");
ok("边框判据与 media-layout 同为 16px",
   /_BP = 16/.test(ui) && /BORDER_PX = 16/.test(read("public/app.watch-media-layout-p2100.js")));

// ④ 原有的边框 seek 没被动过
const ml = read("public/app.watch-media-layout-p2100.js");
ok("边框 seek 仍按最近边映射(上下用 x, 左右用 y)",
   /minD === dTop \|\| minD === dBottom/.test(ml) && /frac = Math\.max\(0, Math\.min\(1, dx \/ rect\.width\)\)/.test(ml));
ok("边框点击不切播放/暂停(media-layout 侧原规矩仍在)",
   /Border click EITHER way: don't toggle play\/pause/.test(ml));

/* ⑤ W2205/W2206 — 影院态四条边都给 seek, 窗口态保留缩放 */
const css = read("public/style.css");
ok("影院态(maximized)让开缩放边",
   /#watch-panel\.maximized > \.panel-resize-edge,[\s\S]{0,120}?pointer-events: none;/.test(css),
   "实测: 上/左/右三条边命中的都是 .panel-resize-edge, 只有底边能 seek");
ok("只收 #watch-panel 一家, 别的面板不受影响",
   /#watch-panel\.maximized > \.panel-resize-edge/.test(css) && !/^\s*\.panel-resize-edge\s*\{[^}]*pointer-events:\s*none/m.test(css));
/* 只看活代码: 第一版这条判据匹配到了【我自己写的注释】(那句"不用 body.cssos-cinema-mode"),
 * 于是报了个假失败。本会话已经栽过同一个坑(W2187 那次"活代码里不再有…"也是这么办的)。 */
const cssLive = css.replace(/\/\*[\s\S]*?\*\//g, "");
ok("判据用 .maximized, 不用 body.cssos-cinema-mode",
   !/body\.cssos-cinema-mode[^{]*\.panel-resize-edge/.test(cssLive)
   && /#watch-panel\.maximized > \.panel-resize-edge/.test(cssLive),
   "媒体框宪法: 那个类常年挂着, 拿它判状态得到的结论是假的");
ok("画面层(watch-svg / watch-music-art)算裸媒体面",
   /t\.classList\.contains\("watch-svg"\)[\s\S]{0,80}?watch-music-art/.test(ml),
   "让开缩放边后左/右两条边命中的是 IMG.watch-svg, 不补就还是点不动");
ok("按钮防御没被动过(画面上盖着按钮仍不误触)",
   /closest\("button,a,input,select,textarea,\[role='button'\],\[contenteditable\]"\)/.test(ml));

const se = read("public/app.watch-search.js");
ok("影院态不被动唤出搜索框",
   /function showBar\(force\)[\s\S]{0,420}?classList\.contains\("maximized"\)[\s\S]{0,160}?return;/.test(se),
   "它挂在 panel 的 pointermove/wheel/keydown 上 —— 影院态鼠标一动就盖住顶边");
ok("已露出时进影院态会收回去(不是单纯 return)",
   /classList\.contains\("maximized"\)\) \{[\s\S]{0,200}?translateY\(-140%\)/.test(se));
ok("留了主动唤出的旁路",
   /cssosWatchSearchShow = function \(\) \{ return showBar\(true\); \}/.test(se),
   "将来加快捷键/Dock 入口时还能唤它, 只是鼠标动一下不再唤");

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
