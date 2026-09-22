/* W2138 回归测试 —— 单一音频权威的【硬串台】三条分支。
 *
 * 背景: crosstalk[work-mismatch] 自 2026-07-27 起累计 1366 次, 今天仍在发生。
 * 根因不是"切歌没切干净", 而是 app.watch-audio-authority.js 把两件事混成一条 bail:
 *   · fetch 轨列表失败
 *   · 这首确实没有可播音频
 * 两者都会先把 _enforcedWork 设成新作品再 return, 于是:
 *   音频元素还挂着上一首 → 1.5s 安全 tick 的判据 (dom !== _enforcedWork) 已相等 → 永不重试。
 * 一次网络抖动 = 永久串台。
 *
 * 这个测试【真加载模块】(最小 DOM 垫片 + 桩 fetch), 不是镜像源码逻辑。
 */
import fs from "node:fs";

function makeEl(id) {
  return {
    id, src: "", currentSrc: "", muted: false, paused: true, readyState: 0,
    volume: 1, loop: false, playsInline: false, ended: false, style: {},
    dataset: {}, classList: { contains: () => false, add() {}, remove() {} },
    setAttribute() {}, getAttribute(k) { return k === "src" ? this.src : null; },
    removeAttribute(k) { if (k === "src") { this.src = ""; this.currentSrc = ""; } },
    addEventListener() {}, removeEventListener() {},
    pause() { this.paused = true; },
    play() { this.paused = false; return Promise.resolve(); },
    load() { this.currentSrc = this.src; },
  };
}

async function run(scenario, fetchImpl, prevSrc) {
  const audio = makeEl("watch-audio-preview");
  const video = makeEl("watch-video");
  const panel = makeEl("watch-panel");
  audio.src = prevSrc; audio.currentSrc = prevSrc;
  const els = { "watch-audio-preview": audio, "watch-video": video, "watch-panel": panel };

  const g = {
    document: {
      getElementById: (id) => els[id] || null,
      querySelector: () => null, querySelectorAll: () => [],
      addEventListener() {}, documentElement: { classList: { contains: () => false } },
    },
    window: { addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {} },
    setTimeout: (fn) => { try { fn(); } catch {} return 0; },
    setInterval: () => 0, clearTimeout() {}, clearInterval() {},
    console: { warn() {}, info() {}, log() {} },
    fetch: fetchImpl,
  };
  g.globalThis = g;
  const src = fs.readFileSync(new URL("../public/app.watch-audio-authority.js", import.meta.url), "utf8");
  const fn = new Function("globalThis", "document", "window", "localStorage",
    "setTimeout", "setInterval", "clearTimeout", "clearInterval", "console", "fetch",
    src + "\n;return globalThis;");
  const out = fn(g, g.document, g.window, g.localStorage, g.setTimeout, g.setInterval,
    g.clearTimeout, g.clearInterval, g.console, g.fetch);
  const NEW = "11111111-2222-3333-4444-555555555555";
  await out.cssosWatchAudioAuthority(NEW);
  await new Promise((r) => setTimeout(r, 30));
  return { audio, state: out.cssosAudioAuthorityState(), NEW };
}

const PREV = "https://cdn.cssstudio.app/artifacts/audio/aud-PREVIOUSWORK.mp3";
const MINE = "https://cdn.cssstudio.app/artifacts/audio/aud-THISWORK.mp3";
let pass = 0, fail = 0;
const check = (n, ok, detail) => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}`); if (!ok && detail) console.log("     " + detail); };

// ① fetch 失败 —— 绝不落锁, 让 1.5s tick 再来
{
  const { state, NEW } = await run("fetch fail", () => Promise.reject(new Error("net")), PREV);
  check("fetch 失败 → 不把 _enforcedWork 锁成新作品(tick 才会重试)",
    state.enforcedWork !== NEW, `enforcedWork=${state.enforcedWork}`);
}
// ② fetch 成功但这首确实没音频 —— 必须清空, 不能留着上一首
{
  const { audio, state, NEW } = await run("no tracks",
    () => Promise.resolve({ ok: true, json: () => Promise.resolve({ tracks: [] }) }), PREV);
  check("确实没音频 → 音频元素被清空(不留上一首)",
    !audio.src && !audio.currentSrc, `src=${audio.src}`);
  check("确实没音频 → 本作品落锁(避免 tick 空转)", state.enforcedWork === NEW);
}
// ③ 正常有轨 —— 切到本作品的源
{
  const { audio } = await run("ok",
    () => Promise.resolve({ ok: true, json: () => Promise.resolve({
      tracks: [{ status: "ready", is_default: true, track_order: 0, audio_url: MINE }] }) }), PREV);
  check("有可用音轨 → 切到本作品的源", audio.src === MINE, `src=${audio.src}`);
}
// ④ 源码层: 旧的"混为一谈"那条 bail 不许再出现
{
  const src = fs.readFileSync(new URL("../public/app.watch-audio-authority.js", import.meta.url), "utf8");
  check("旧 bail(!sel 就直接落锁并留旧源)已不存在",
    !/if \(!sel\) \{ _enforcedWork = workId; _enforcedUrl = ""/.test(src));
  check("_busy 不再直接丢弃新作品", !/if \(!isUuid\(workId\) \|\| _busy\) return;/.test(src));
}
console.log(`\n通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
