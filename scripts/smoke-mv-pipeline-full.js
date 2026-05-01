// Full 6-stage pipeline smoke test for cssmvRunPipeline().
//
// Boots app.mv-pipeline-panel.js inside a vm sandbox with enough DOM and
// browser stubs that the IIFE initialises its panel, installs the global
// entry point `cssmvRunPipeline`, and can be driven through all 6 stages
// (cover → lyrics → music → video → subtitles → compose) against a
// mocked fetch().
//
// Three scenarios are exercised in sequence:
//   A. Happy path       — every stage returns a plausible success payload;
//                         we assert state.mvUrl is set and the MV tab is
//                         activated at the end.
//   B. Video failure    — /api/mv/video rejects; assert videoFailed path
//                         tags subtitles+compose as "skipped" and the
//                         music-fallback activates the Music tab.
//   C. Compose failure  — /api/mv/compose rejects; assert music fallback
//                         fires and runAll returns without an mvUrl.
//
// The source is loaded once with VIDEO_TIMEOUT_MS / COMPOSE_TIMEOUT_MS
// patched down to 300ms so the timeout-via-hang path doesn't take 3
// minutes. Most scenarios reject explicitly from fetch() anyway.
//
// Run: node smoke-full-pipeline.js

"use strict";

const fs   = require("fs");
const vm   = require("vm");
const path = require("path");

const FILE = path.resolve(
  __dirname,
  "../public/app.mv-pipeline-panel.js"
);
let src = fs.readFileSync(FILE, "utf8");

// Patch the hard-coded ceilings down so test scenarios that rely on real
// withTimeout() rejections complete quickly. We leave the helper intact —
// only the ms constants change.
src = src.replace(
  /const VIDEO_TIMEOUT_MS = \d+;/,
  "const VIDEO_TIMEOUT_MS = 300;"
);
src = src.replace(
  /const COMPOSE_TIMEOUT_MS = \d+;/,
  "const COMPOSE_TIMEOUT_MS = 300;"
);

// ──────────────── DOM stubs ────────────────
//
// The pipeline panel is an IIFE that inits against document.body. It calls
// document.getElementById(PANEL_ID) and then panel.querySelector("#mvp-*")
// for the inputs. We build a minimal fake DOM that satisfies those paths.

function makeInput(initial) {
  return {
    value: initial || "",
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    dispatchEvent() {}
  };
}

function makeGenericEl() {
  const el = {
    value: "",
    innerHTML: "",
    textContent: "",
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [],
    appendChild(c) { this.children.push(c); return c; },
    removeChild() {},
    setAttribute() {},
    removeAttribute() {},
    getAttribute() { return null; },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    insertAdjacentElement() {},
    insertAdjacentHTML() {},
    querySelector() { return makeGenericEl(); },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    focus() {},
    blur() {},
    click() {},
    load() {},
    play() { return Promise.resolve(); },
    pause() {}
  };
  return el;
}

const inputs = {
  prompt:  makeInput(""),
  style:   makeInput(""),
  lyrics:  makeInput("")
};

function makePanel() {
  const selectorMap = {
    "#mvp-prompt": inputs.prompt,
    "#mvp-style":  inputs.style,
    "#mvp-lyrics": inputs.lyrics,
    "#mvp-run":    makeGenericEl(),
    "#mvp-save":   makeGenericEl(),
    "#mvp-summary": makeGenericEl()
  };
  return {
    id: "mv-pipeline-panel",
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [],
    appendChild() {},
    setAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector(sel) {
      if (selectorMap[sel]) return selectorMap[sel];
      // Stage rows, progress fills, data-*-for queries etc. — just return a
      // generic element so setStage / setProgress don't explode.
      return makeGenericEl();
    },
    querySelectorAll() { return []; },
    insertAdjacentElement() {},
    insertAdjacentHTML() {},
    innerHTML: ""
  };
}

let panelEl = null;
const audioEl = {
  src: "",
  preload: "",
  load: function () { mediaCalls.audioLoad++; },
  play: function () { mediaCalls.audioPlay++; return Promise.resolve(); },
  pause: function () {},
  addEventListener() {},
  removeEventListener() {}
};
const videoEl = {
  src: "",
  autoplay: false,
  muted: false,
  play: function () { mediaCalls.videoPlay++; return Promise.resolve(); },
  pause: function () {},
  addEventListener() {},
  removeEventListener() {}
};

const mediaCalls = {
  audioLoad: 0,
  audioPlay: 0,
  videoPlay: 0
};

const documentStub = {
  getElementById(id) {
    if (id === "mv-pipeline-panel") {
      if (!panelEl) panelEl = makePanel();
      return panelEl;
    }
    if (id === "watch-audio-preview") return audioEl;
    if (id === "watch-video") return videoEl;
    // Everything else: generic element.
    return makeGenericEl();
  },
  querySelector(sel) {
    if (sel === "#" + "mv-pipeline-panel") return this.getElementById("mv-pipeline-panel");
    return null;
  },
  querySelectorAll() { return []; },
  createElement() { return makeGenericEl(); },
  addEventListener() {},
  removeEventListener() {},
  body: { appendChild() {}, querySelector() { return null; }, addEventListener() {} }
};

// ──────────────── Shared watch-panel side-effect trackers ────────────────
const calls = {
  activateWatchTab: [],
  fallbackWatchPlaybackToMusicModule: [],
  setWatchVideoFromArtifact: [],
  attemptWatchVideoPlaybackModule: 0,
  syncWatchProgressRotatorModule: 0,
  stageBarsSetProgress: [],
  stageBarsSetDone: [],
  stageBarsReset: 0,
  stageBarsShow: 0,
  hideMvArtTitle: 0,
  setCoverSlides: 0,
  startCoverSlideshow: 0,
  addCoverSlide: 0,
  fetchURLs: []
};

const engineProgressState = { music: 0, video: 0, kara: 0 };

// ──────────────── Mock fetch ────────────────
//
// Each scenario installs its own `fetchImpl` on `sandbox.__fetchImpl`. We
// don't rebuild the sandbox per scenario — we just swap the implementation
// so the IIFE's closure-captured fetch reference keeps working.

function makeResponse(bodyObj, opts) {
  const status = (opts && opts.status) || 200;
  const ok = status >= 200 && status < 300;
  const bodyText = JSON.stringify(bodyObj);
  return {
    ok,
    status,
    text: function () { return Promise.resolve(bodyText); },
    json: function () { return Promise.resolve(bodyObj); }
  };
}

function mockFetch(scenario) {
  return function (url, init) {
    calls.fetchURLs.push(url);
    const route = String(url || "");
    // Cover stage — happy path always returns a cover.
    if (route.indexOf("/api/mv/cover") >= 0) {
      return Promise.resolve(makeResponse({
        image_url: "https://test.example/cover.png",
        engine: "test",
        version: "mock-v1",
        cost_cents: 5
      }));
    }
    if (route.indexOf("/api/mv/lyrics") >= 0) {
      return Promise.resolve(makeResponse({
        lyrics: "Mocked lyrics line 1\nLine 2\nLine 3",
        engine: "test",
        version: "mock-llm",
        cost_cents: 2
      }));
    }
    if (route.indexOf("/api/mv/music") >= 0) {
      return Promise.resolve(makeResponse({
        audio_url: "https://test.example/audio.mp3",
        duration_secs: 12,
        title: "Mock Track",
        engine: "musicgpt",
        version: "mock-v1",
        cost_cents: 30
      }));
    }
    if (route.indexOf("/api/mv/video") >= 0) {
      if (scenario.videoFails === "reject") {
        return Promise.reject(new Error("mock video reject"));
      }
      if (scenario.videoFails === "http500") {
        return Promise.resolve(makeResponse({ error: "Runway unavailable" }, { status: 500 }));
      }
      if (scenario.videoFails === "hang") {
        // Never resolves → withTimeout(300ms) triggers.
        return new Promise(function () {});
      }
      return Promise.resolve(makeResponse({
        video_url: "https://test.example/video.mp4",
        engine: "runway",
        version: "mock-gen4",
        cost_cents: 120
      }));
    }
    if (route.indexOf("/api/mv/subtitles") >= 0) {
      return Promise.resolve(makeResponse({
        srt: "1\n00:00:00,000 --> 00:00:02,000\nHello\n",
        line_count: 3,
        engine: "test",
        version: "mock-v1",
        cost_cents: 4
      }));
    }
    if (route.indexOf("/api/mv/compose") >= 0) {
      if (scenario.composeFails === "reject") {
        return Promise.reject(new Error("mock compose reject"));
      }
      if (scenario.composeFails === "hang") {
        return new Promise(function () {});
      }
      return Promise.resolve(makeResponse({
        public_url: "https://test.example/mv_final.mp4",
        engine: "ffmpeg",
        version: "mock-v1",
        cost_cents: 10
      }));
    }
    // Engines / pricing / schema — return empty so catalog loads as no-op.
    if (route.indexOf("/cssapi/v1/engines") >= 0) {
      return Promise.resolve(makeResponse({ engines: [] }));
    }
    if (route.indexOf("/cssapi/v1/pricing") >= 0) {
      return Promise.resolve(makeResponse({ pricing: [] }));
    }
    // Default: 404-style response so the pipeline surfaces a clear error.
    return Promise.resolve(makeResponse({ error: "unmocked " + route }, { status: 404 }));
  };
}

// ──────────────── Sandbox ────────────────
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Promise,
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  JSON,
  Error,
  TypeError,
  URL,
  document: documentStub,
  currentLocale: "en",
  engineProgressState,
  // Watch-panel side effects — just record them.
  activateWatchTab(tab) { calls.activateWatchTab.push(tab); },
  fallbackWatchPlaybackToMusicModule(msg) { calls.fallbackWatchPlaybackToMusicModule.push(msg); },
  attemptWatchVideoPlaybackModule() { calls.attemptWatchVideoPlaybackModule++; },
  syncWatchProgressRotatorModule() { calls.syncWatchProgressRotatorModule++; },
  setWatchVideoFromArtifact(url) { calls.setWatchVideoFromArtifact.push(url); },
  cssmvStageBarsSetProgress(key, pct) { calls.stageBarsSetProgress.push({ key, pct }); },
  cssmvStageBarsSetDone(key) { calls.stageBarsSetDone.push(key); },
  cssmvStageBarsReset() { calls.stageBarsReset++; },
  cssmvStageBarsShow() { calls.stageBarsShow++; },
  cssmvHideMvArtTitle() { calls.hideMvArtTitle++; },
  cssmvSetCoverSlides() { calls.setCoverSlides++; },
  cssmvStartCoverSlideshow() { calls.startCoverSlideshow++; },
  cssmvAddCoverSlide() { calls.addCoverSlide++; },
  cssmvEngines: null,
  activePipelineRunId: "run_smoke",
  currentWatchAudioRunId: "run_smoke",
  // Event plumbing used by the music stage's title-resolved dispatch.
  CustomEvent: function (name, detail) { this.name = name; this.detail = detail && detail.detail; return this; },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {}
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.window = sandbox;
// fetch goes through an indirection so we can swap impls per scenario.
sandbox.fetch = function (u, init) {
  return sandbox.__fetchImpl(u, init);
};
sandbox.__fetchImpl = function () {
  return Promise.reject(new Error("fetch not configured"));
};

vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: "app.mv-pipeline-panel.js" });

// ──────────────── Assertion helper ────────────────
let FAILURES = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); FAILURES++; return false; }
  console.log("PASS:", msg);
  return true;
}

function resetCalls() {
  calls.activateWatchTab.length = 0;
  calls.fallbackWatchPlaybackToMusicModule.length = 0;
  calls.setWatchVideoFromArtifact.length = 0;
  calls.attemptWatchVideoPlaybackModule = 0;
  calls.syncWatchProgressRotatorModule = 0;
  calls.stageBarsSetProgress.length = 0;
  calls.stageBarsSetDone.length = 0;
  calls.stageBarsReset = 0;
  calls.stageBarsShow = 0;
  calls.hideMvArtTitle = 0;
  calls.setCoverSlides = 0;
  calls.startCoverSlideshow = 0;
  calls.addCoverSlide = 0;
  calls.fetchURLs.length = 0;
  mediaCalls.audioLoad = 0;
  mediaCalls.audioPlay = 0;
  mediaCalls.videoPlay = 0;
  engineProgressState.music = 0;
  engineProgressState.video = 0;
  engineProgressState.kara = 0;
  audioEl.src = "";
  videoEl.src = "";
  inputs.prompt.value = "";
  inputs.style.value = "";
  inputs.lyrics.value = "";
}

// ──────────────── Scenario runner ────────────────
async function runScenario(name, scenario) {
  console.log("\n── Scenario: " + name + " ──");
  resetCalls();
  sandbox.__fetchImpl = mockFetch(scenario);
  // Seed prompt via the input so synthesize-zero-input doesn't kick in.
  inputs.prompt.value = "test prompt";
  inputs.style.value  = "pop";
  // Drive the pipeline. cssmvRunPipeline returns the runAll() promise.
  const rp = sandbox.cssmvRunPipeline({});
  try {
    await rp;
  } catch (e) {
    // runAll catches its own errors internally; a thrown error here means
    // the test harness itself broke.
    console.error("Scenario unexpectedly threw:", e.message);
    FAILURES++;
  }
}

// ──────────────── Main ────────────────
(async () => {
  // Verify entry point exists.
  assert(
    typeof sandbox.cssmvRunPipeline === "function",
    "cssmvRunPipeline is installed as a globalThis export"
  );
  assert(
    typeof sandbox.cssmvFallbackToMusicOnly === "function",
    "cssmvFallbackToMusicOnly is installed as a globalThis export"
  );

  // ── A. Happy path ──
  await runScenario("A. Happy path (all 6 stages succeed)", {});

  // fetchURLs should contain each pipeline endpoint in order (cover first, then
  // possibly extra cover variations, then lyrics, music, video, subtitles, compose).
  const urls = calls.fetchURLs.join("\n");
  assert(urls.indexOf("/api/mv/cover") >= 0,     "A: /api/mv/cover was hit");
  assert(urls.indexOf("/api/mv/lyrics") >= 0,    "A: /api/mv/lyrics was hit");
  assert(urls.indexOf("/api/mv/music") >= 0,     "A: /api/mv/music was hit");
  assert(urls.indexOf("/api/mv/video") >= 0,     "A: /api/mv/video was hit");
  assert(urls.indexOf("/api/mv/subtitles") >= 0, "A: /api/mv/subtitles was hit");
  assert(urls.indexOf("/api/mv/compose") >= 0,   "A: /api/mv/compose was hit");
  assert(
    engineProgressState.music === 100 &&
      engineProgressState.video === 100 &&
      engineProgressState.kara  === 100,
    "A: engineProgressState snapped to 100 after compose"
  );
  assert(
    calls.activateWatchTab.indexOf("mv") >= 0,
    "A: Watch tab was switched to 'mv' after compose"
  );
  assert(
    calls.setWatchVideoFromArtifact.length >= 1 &&
      calls.setWatchVideoFromArtifact[0].indexOf("mv_final.mp4") >= 0,
    "A: composed MV URL was pushed into the Watch <video> element"
  );
  assert(
    calls.attemptWatchVideoPlaybackModule >= 1,
    "A: attemptWatchVideoPlaybackModule fired (zero-click autoplay)"
  );

  // ── B. Video timeout via hang ──
  await runScenario("B. Video hangs → withTimeout(300ms) rejects", {
    videoFails: "hang"
  });
  const urlsB = calls.fetchURLs.join("\n");
  assert(urlsB.indexOf("/api/mv/video") >= 0, "B: /api/mv/video was attempted");
  assert(urlsB.indexOf("/api/mv/compose") < 0, "B: /api/mv/compose was NOT attempted (short-circuit)");
  assert(urlsB.indexOf("/api/mv/subtitles") < 0, "B: /api/mv/subtitles was NOT attempted (short-circuit)");
  assert(
    engineProgressState.music === 100 &&
      engineProgressState.video === 100 &&
      engineProgressState.kara  === 100,
    "B: engineProgressState snapped to 100 via fallbackToMusicOnly"
  );
  assert(
    calls.activateWatchTab.indexOf("music") >= 0,
    "B: Watch tab was switched to 'music' via fallback"
  );
  assert(
    calls.fallbackWatchPlaybackToMusicModule.length >= 1,
    "B: fallbackWatchPlaybackToMusicModule was called"
  );
  assert(
    calls.fallbackWatchPlaybackToMusicModule[0].indexOf("Video timed out") >= 0 ||
      calls.fallbackWatchPlaybackToMusicModule[0].indexOf("视频超时") >= 0,
    "B: fallback message indicates video timeout (got: '" + calls.fallbackWatchPlaybackToMusicModule[0] + "')"
  );

  // ── C. Video fetch reject ──
  await runScenario("C. Video fetch rejects immediately", {
    videoFails: "reject"
  });
  assert(
    calls.fallbackWatchPlaybackToMusicModule.length >= 1 &&
      calls.activateWatchTab.indexOf("music") >= 0,
    "C: video-reject triggered music fallback"
  );
  assert(
    engineProgressState.video === 100,
    "C: progress rotator released on video-reject"
  );

  // ── D. Compose timeout via hang ──
  await runScenario("D. Compose hangs → withTimeout(300ms) rejects", {
    composeFails: "hang"
  });
  const urlsD = calls.fetchURLs.join("\n");
  assert(urlsD.indexOf("/api/mv/video") >= 0,     "D: video stage ran (so we can reach compose)");
  assert(urlsD.indexOf("/api/mv/subtitles") >= 0, "D: subtitles stage ran");
  assert(urlsD.indexOf("/api/mv/compose") >= 0,   "D: compose was attempted");
  assert(
    calls.fallbackWatchPlaybackToMusicModule.length >= 1,
    "D: compose-timeout triggered music fallback"
  );
  assert(
    calls.fallbackWatchPlaybackToMusicModule[0].indexOf("Compose") >= 0 ||
      calls.fallbackWatchPlaybackToMusicModule[0].indexOf("合成") >= 0,
    "D: fallback message mentions compose (got: '" + calls.fallbackWatchPlaybackToMusicModule[0] + "')"
  );
  assert(
    engineProgressState.music === 100 &&
      engineProgressState.video === 100 &&
      engineProgressState.kara  === 100,
    "D: progress rotator released on compose-timeout"
  );

  // ── E. Compose fetch reject ──
  await runScenario("E. Compose fetch rejects immediately", {
    composeFails: "reject"
  });
  assert(
    calls.fallbackWatchPlaybackToMusicModule.length >= 1,
    "E: compose-reject triggered music fallback"
  );
  assert(
    calls.activateWatchTab.indexOf("music") >= 0,
    "E: Watch tab switched to 'music' after compose reject"
  );

  // ── F. Video returns HTTP 500 (upstream error surfaced by Runway) ──
  await runScenario("F. Video HTTP 500 (upstream 5xx)", {
    videoFails: "http500"
  });
  assert(
    calls.fallbackWatchPlaybackToMusicModule.length >= 1,
    "F: HTTP-500 on video stage triggered music fallback"
  );

  console.log("\n════════════════════════════════════");
  if (FAILURES === 0) {
    console.log("All pipeline smoke scenarios PASSED.");
    process.exit(0);
  } else {
    console.error("FAILED: " + FAILURES + " assertion(s).");
    process.exit(1);
  }
})();
