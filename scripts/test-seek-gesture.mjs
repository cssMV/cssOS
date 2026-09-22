/* W2139 回归测试 —— 快进/快退(左右键 + 媒体框横滑)。
 *
 * 钉死三件最容易坏的事:
 *  ① seekBy 必须【音视频一起动】。平台四轨分离: 视频静音、声音走 <audio>,
 *    而 getMedia() 优先返回 video —— 只动它, 用户听到的歌纹丝不动, 快进等于没按。
 *  ② 左右键在【面板可见】就生效, 但 Shift+←/→(♪1/♪2 切换)和 Alt+←/→(字幕微调)
 *    绝不能被抢走 —— 三方抢同一个键是这次改动最大的风险。
 *  ③ 横滑判定必须"明显横向", 否则会吃掉竖滑切歌(TikTok 手势)。
 */
import fs from "node:fs";

const noop = () => {};
function media(id, dur, cur) {
  return { id, src: "x.mp3", currentSrc: "x.mp3", duration: dur, currentTime: cur,
           readyState: 2, paused: false, muted: false, volume: 1,
           addEventListener: noop, play: () => Promise.resolve(), pause: noop };
}
function boot(els) {
  const g = {
    document: {
      getElementById: (id) => els[id] || null,
      createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop }),
      body: { appendChild: noop }, addEventListener: noop,
      querySelector: () => null, querySelectorAll: () => [],
      documentElement: { classList: { contains: () => false } },
      fullscreenElement: null, webkitFullscreenElement: null,
    },
    window: { addEventListener: noop },
    setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    console: { warn: noop, info: noop, log: noop },
    localStorage: { getItem: () => null, setItem: noop },
  };
  g.globalThis = g;
  const src = fs.readFileSync(new URL("../public/app.mv-keys.js", import.meta.url), "utf8");
  new Function("globalThis", "document", "window", "setTimeout", "clearTimeout",
    "setInterval", "clearInterval", "console", "localStorage", src)(
    g, g.document, g.window, g.setTimeout, g.clearTimeout, g.setInterval,
    g.clearInterval, g.console, g.localStorage);
  return g;
}

let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}`); if (!ok && d) console.log("     " + d); };

// ① 音视频一起 seek
{
  const a = media("watch-audio-preview", 200, 50);
  const v = media("watch-video", 200, 50);
  const g = boot({ "watch-audio-preview": a, "watch-video": v, "watch-panel": { hidden: false, classList: { contains: () => false }, offsetParent: {}, getClientRects: () => [1] } });
  const hasSeek = typeof g.cssosSeekBy === "function";
  check("导出了 cssosSeekBy", hasSeek);
  // ⚠ 必须守住: 校准时(旧版没有这个函数)测试应当【报失败】, 不是抛异常崩掉。
  //   崩掉的测试证明不了"它能拦住回归", 只证明它自己脆。
  const t = hasSeek ? g.cssosSeekBy(+10) : null;
  check("audio 前进了 10 秒(它才是出声的那个)", Math.abs(a.currentTime - 60) < 0.2, `audio=${a.currentTime}`);
  check("video 跟着对齐, 不音画分家", Math.abs(v.currentTime - 60) < 0.2, `video=${v.currentTime}`);
  check("返回新时刻", Math.abs((t ?? -1) - 60) < 0.2, `t=${t}`);
}
// 边界: 不越界
{
  const a = media("watch-audio-preview", 30, 28);
  const g = boot({ "watch-audio-preview": a, "watch-panel": { hidden: false, classList: { contains: () => false }, offsetParent: {}, getClientRects: () => [1] } });
  if (typeof g.cssosSeekBy === "function") g.cssosSeekBy(+10);
  check("不越过片尾", a.currentTime <= 30 && a.currentTime > 28, `t=${a.currentTime}`);
  a.currentTime = 3;
  if (typeof g.cssosSeekBy === "function") g.cssosSeekBy(-10);
  check("不退到负数", a.currentTime === 0, `t=${a.currentTime}`);
}
// ② 键位让位(源码层, 先剥注释 —— 今天已经被自己的注释骗过一次)
{
  const raw = fs.readFileSync(new URL("../public/app.mv-keys.js", import.meta.url), "utf8");
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  check("Shift+←/→ 不被快进抢走(留给 ♪1/♪2)", /!e\.shiftKey/.test(code));
  check("Alt 组合整体放行(留给字幕微调)", /e\.altKey\)\s*return/.test(code));
  check("波形编辑器开着时让位", /cssos-wave-editor/.test(code));
  check("只为左右键放宽闸门, 不是整体放宽", /isSeekArrow && isWatchPanelVisible\(\)/.test(code));
}
// ③ 横滑判定 + 字幕微调改挂 Alt
{
  const raw = fs.readFileSync(new URL("../public/app.watch-ui.js", import.meta.url), "utf8");
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  check("横滑要求明显横向(不吃掉竖滑切歌)",
    /Math\.abs\(dx\) >= 40 && Math\.abs\(dx\) >= 1\.5 \* Math\.abs\(dy\)/.test(code));
  check("横滑走共用的 cssosSeekBy", /cssosSeekBy\(delta\)/.test(code));
  check("竖滑切歌仍在", /advanceSong\(dy < 0 \? \+1 : -1\)/.test(code));
  check("字幕微调已改挂 Alt", /if \(!ev\.altKey\) return;/.test(code));
}
// ④ 绝不把"左右滑动切换面板"请回来
{
  const nav = fs.readFileSync(new URL("../public/app.panel-swipe-nav.js", import.meta.url), "utf8");
  check("panel-swipe-nav 仍是停用状态(面板宪法第4条仍作废)",
    /__cssosSwipeNavInstalled = true;\s*\n\s*return;|return;\s*\/\/[^\n]*W2016/.test(nav) || /W2016/.test(nav));
}
console.log(`\n通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
