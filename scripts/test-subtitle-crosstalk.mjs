/* W2138 回归测试 —— 字幕这条道的【硬串台】。
 *
 * 背景: crosstalk[work-mismatch] 里 subtitle 掉队 19 指纹 / 430 次。
 * 根因与音频那条同形: loadForWork 把身份放在 fetch【之后】才认 ——
 *     var r = await fetch(...); if (!r.ok) return; ... _offsetWorkId = workId;
 * fetch 一失败, _offsetWorkId 就停在上一个作品, 旧 cue 原样留着, 且无重试。
 *
 * 本测试【真加载引擎模块】(最小 DOM/定时器垫片 + 桩 fetch), 不镜像源码。
 * ⚠ 必须先在【修复前的版本】上跑过并失败, 才算能拦住回归 —— 见提交说明里的校准数据。
 */
import fs from "node:fs";

function boot(fetchImpl) {
  const noop = () => {};
  const el = () => ({
    style: {}, dataset: {}, classList: { add: noop, remove: noop, contains: () => false, toggle: noop },
    appendChild: noop, removeChild: noop, remove: noop, insertBefore: noop,
    setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
    addEventListener: noop, removeEventListener: noop, querySelector: () => null,
    querySelectorAll: () => [], getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }),
    textContent: "", innerHTML: "", children: [], firstChild: null, parentNode: null,
  });
  const g = {
    document: {
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      createElement: el, addEventListener: noop, body: el(),
      documentElement: { classList: { contains: () => false } },
      readyState: "complete",
    },
    window: { addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false }) },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    setTimeout: (fn, ms) => { if (!ms || ms < 50) { try { fn(); } catch {} } return 0; },
    clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
    console: { warn: noop, info: noop, log: noop, error: noop },
    fetch: fetchImpl,
    performance: { now: () => Date.now() },
  };
  g.globalThis = g;
  const src = fs.readFileSync(new URL("../public/app.emotion-subtitle-engine.js", import.meta.url), "utf8");
  const fn = new Function("globalThis", "document", "window", "localStorage", "setTimeout",
    "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame",
    "cancelAnimationFrame", "console", "fetch", "performance",
    src + "\n;return globalThis;");
  return fn(g, g.document, g.window, g.localStorage, g.setTimeout, g.clearTimeout,
    g.setInterval, g.clearInterval, g.requestAnimationFrame, g.cancelAnimationFrame,
    g.console, g.fetch, g.performance);
}

const OLD = "aaaaaaaa-1111-2222-3333-444444444444";
const NEW = "bbbbbbbb-5555-6666-7777-888888888888";
const okTracks = { ok: true, status: 200, json: () => Promise.resolve({ tracks: [] }) };

let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}`); if (!ok && d) console.log("     " + d); };

// ① 先把引擎带到"旧作品"状态, 再让新作品的 fetch 失败
{
  let calls = 0;
  const g = boot((u) => {
    calls += 1;
    if (String(u).includes(OLD)) return Promise.resolve(okTracks);
    return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) });
  });
  const E = g.cssosEmotionSubtitle;
  await E.loadForWork(OLD);
  await new Promise((r) => setTimeout(r, 20));
  const before = E.getWorkId();
  await E.loadForWork(NEW);
  await new Promise((r) => setTimeout(r, 20));
  check("旧作品先加载成功(前置条件)", before === OLD, `getWorkId=${before}`);
  check("新作品 fetch 失败 → 身份【不再】停在上一个作品",
    E.getWorkId() === NEW, `getWorkId=${E.getWorkId()} (应为新作品)`);
}

// ② fetch 成功 → 正常认到新作品
{
  const g = boot(() => Promise.resolve(okTracks));
  const E = g.cssosEmotionSubtitle;
  await E.loadForWork(OLD);
  await E.loadForWork(NEW);
  await new Promise((r) => setTimeout(r, 20));
  check("fetch 成功 → 身份切到新作品", E.getWorkId() === NEW, `getWorkId=${E.getWorkId()}`);
}

// ③ 源码层: 身份不许再排在 fetch 之后
{
  const src = fs.readFileSync(new URL("../public/app.emotion-subtitle-engine.js", import.meta.url), "utf8");
  const i = src.indexOf("async function loadForWork");
  // ⚠ 必须先把注释剥掉再判: 上面那段说明里【引用了旧代码】作反例, 里面就有 `await fetch(`,
  //   直接在原文上找位置会被自己的注释骗到(第一版就栽在这)。判代码就只看代码。
  const seg = src.slice(i, i + 3400)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  const idAt = seg.indexOf("_offsetWorkId = workId");
  const fetchAt = seg.indexOf("await fetch(");
  check("身份在 fetch 之前就认下来", idAt > 0 && fetchAt > 0 && idAt < fetchAt,
    `idAt=${idAt} fetchAt=${fetchAt}`);
  check("有代数守卫(连切多首只让最新的赢)", /myGen !== _lfwGen/.test(seg));
  check("fetch 失败有重试", /_lfwRetry/.test(seg));
}

// ④ 语言胶囊必须把 ownerWorkId 传进去, 否则守卫整个失效
{
  const pill = fs.readFileSync(new URL("../public/app.mv-language-pill.js", import.meta.url), "utf8");
  check("语言胶囊传了 ownerWorkId(守卫才生效)",
    /cssosEmotionSubtitle\.load\(track, take, _ownWid/.test(pill));
}

console.log(`\n通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
