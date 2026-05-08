"use strict";
const test = require("node:test");
const assert = require("node:assert");

// Load the browser-global module into a fake root.
const root = {};
require("../public/app.mv-dag-executor.js");
// The IIFE attached to globalThis since `root` parameter inside the file
// uses `globalThis` (Node 18+ has globalThis). Pull the api off of it.
const cssmvDag = globalThis.cssmvDag;
assert.ok(cssmvDag && typeof cssmvDag.create === "function", "cssmvDag exported");

test("6-node diamond DAG runs in correct topological order", async () => {
  const order = [];
  const dag = cssmvDag.create()
    .stage("cover",   [],                                async () => { order.push("cover");   return "C"; })
    .stage("lyrics",  [],                                async () => { order.push("lyrics");  return "L"; })
    .stage("music",   ["lyrics"],                        async () => { order.push("music");   return "M"; })
    .stage("video",   ["cover", "music"],                async () => { order.push("video");   return "V"; })
    .stage("subs",    ["lyrics", "music"],               async () => { order.push("subs");    return "S"; })
    .stage("compose", ["cover", "music", "video", "subs"], async () => { order.push("compose"); return "MV"; });
  const r = await cssmvDag.run(dag);
  assert.deepStrictEqual(Object.keys(r.failed), []);
  assert.strictEqual(r.done.compose, "MV");
  // music must come after lyrics; video after cover+music; compose last.
  assert.ok(order.indexOf("lyrics")  < order.indexOf("music"));
  assert.ok(order.indexOf("cover")   < order.indexOf("video"));
  assert.ok(order.indexOf("music")   < order.indexOf("video"));
  assert.ok(order.indexOf("compose") === order.length - 1);
});

test("cycle detection throws synchronously via run", async () => {
  const dag = cssmvDag.create()
    .stage("a", ["b"], async () => 1)
    .stage("b", ["a"], async () => 2);
  await assert.rejects(() => cssmvDag.run(dag), /cycle/);
});

test("stage failure cancels transitive dependents but not unrelated branches", async () => {
  let ranUnrelated = false;
  const dag = cssmvDag.create()
    .stage("a",         [],          async () => 1)
    .stage("b",         ["a"],       async () => { throw new Error("boom"); })
    .stage("c",         ["b"],       async () => 3)
    .stage("unrelated", [],          async () => { ranUnrelated = true; return 99; });
  const r = await cssmvDag.run(dag);
  assert.ok(r.failed.b, "b failed");
  assert.ok(r.cancelled.c, "c cancelled (transitive dep of b)");
  assert.strictEqual(r.done.a, 1);
  assert.strictEqual(r.done.unrelated, 99);
  assert.strictEqual(ranUnrelated, true);
});

test("retry counter respected", async () => {
  let attempts = 0;
  const dag = cssmvDag.create()
    .stage("flaky", [], async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("retry me");
      return "ok";
    });
  const r = await cssmvDag.run(dag, { retry: { flaky: 5 } });
  assert.strictEqual(r.done.flaky, "ok");
  assert.strictEqual(attempts, 3);
});

test("cache pre-population skips done stages", async () => {
  let coverRan = false;
  const dag = cssmvDag.create()
    .stage("cover", [],         async () => { coverRan = true; return "fresh"; })
    .stage("video", ["cover"],  async ({ cover }) => "v:" + cover);
  const r = await cssmvDag.run(dag, { cache: { cover: "cached" } });
  assert.strictEqual(coverRan, false);
  assert.strictEqual(r.done.video, "v:cached");
});

test("cache pre-population emits onStageDone with meta.cached:true (wave 7a)", async () => {
  // Mirrors the panel's wave-7a contract: when a stage is pre-populated via
  // the cache, the executor still fires onStageDone so the caller can mirror
  // the cached output into UI state — but meta.cached === true tells the
  // caller to skip recordEngine + dispatchStageEvents (UX side-effects).
  const seen = [];
  const dag = cssmvDag.create()
    .stage("cover", [],        async () => { throw new Error("should not run"); })
    .stage("video", ["cover"], async ({ cover }) => "v:" + cover.image_url);
  const r = await cssmvDag.run(dag, {
    cache: { cover: { image_url: "cached.png", cost_cents: 0 } },
    onStageDone: (id, output, meta) => { seen.push({ id, cached: !!(meta && meta.cached) }); }
  });
  // cover should appear with cached:true; video runs fresh (cached:false).
  const coverEvt = seen.find(e => e.id === "cover");
  const videoEvt = seen.find(e => e.id === "video");
  assert.ok(coverEvt && coverEvt.cached === true, "cover onStageDone meta.cached === true");
  assert.ok(videoEvt && videoEvt.cached === false, "video onStageDone meta.cached === false");
  assert.strictEqual(r.done.video, "v:cached.png");
});

test("lyrics cache pre-population: callback can gate dispatchEvent on meta.cached (wave 7b)", async () => {
  // Wave 7b contract: when state.lyrics is already populated (resume case),
  // the panel pre-populates the DAG cache so the LLM call is skipped. The
  // executor still fires onStageDone for cover/lyrics — but with
  // meta.cached:true so the panel callback can skip dispatchStageEvents
  // (i.e. skip re-firing the cssmv:lyrics-updated CustomEvent).
  // This test simulates the panel's gating logic with a mock dispatchEvent
  // counter to assert the cached stage does NOT trigger a re-broadcast.
  let dispatchCount = 0;
  const mockDispatch = (stageId, _output, meta) => {
    if (meta && meta.cached) return; // wave 7a/7b gate
    if (stageId === "lyrics") dispatchCount += 1;
  };
  const dag = cssmvDag.create()
    .stage("lyrics", [], async () => { throw new Error("should not run — cached"); })
    .stage("music",  ["lyrics"], async ({ lyrics }) => "m:" + lyrics.lyrics);
  const r = await cssmvDag.run(dag, {
    cache: { lyrics: { lyrics: "cached lyrics body", cost_cents: 0 } },
    onStageDone: (id, output, meta) => { mockDispatch(id, output, meta); }
  });
  assert.strictEqual(dispatchCount, 0, "cached lyrics stage must NOT trigger re-broadcast");
  assert.strictEqual(r.done.music, "m:cached lyrics body");
});

test("music cache pre-population: callback can gate kara_ready on meta.cached (wave 7c)", async () => {
  // Wave 7c contract: when state.audioUrl + duration + alignedLyrics +
  // karaJson are already populated (resume case), the panel pre-populates
  // the DAG cache so the music engine call is skipped. The executor still
  // fires onStageDone for music — but with meta.cached:true so the panel
  // callback can skip dispatchStageEvents (i.e. skip re-firing
  // syncWatchOutputs / cssos:kara_ready / cssos:title_resolved).
  let karaReadyCount = 0;
  const mockDispatch = (stageId, _output, meta) => {
    if (meta && meta.cached) return; // wave 7a/7b/7c gate
    if (stageId === "music") karaReadyCount += 1;
  };
  const dag = cssmvDag.create()
    .stage("lyrics", [], async () => ({ lyrics: "L" }))
    .stage("music",  ["lyrics"], async () => { throw new Error("should not run — cached"); })
    .stage("video",  ["music"],  async ({ music }) => "v:" + music.audioUrl);
  const r = await cssmvDag.run(dag, {
    cache: {
      music: {
        audioUrl: "https://cached/audio.mp3",
        duration: 183,
        alignedLyrics: [{ start_s: 0, end_s: 3, text: "line 1" }],
        karaJson: [{ start_s: 0, end_s: 3, text: "line 1" }],
        cost_cents: 0,
      }
    },
    onStageDone: (id, output, meta) => { mockDispatch(id, output, meta); }
  });
  assert.strictEqual(karaReadyCount, 0, "cached music stage must NOT trigger re-broadcast");
  assert.strictEqual(r.done.video, "v:https://cached/audio.mp3");
});

test("weighted progress + critical path reported", async () => {
  const dag = cssmvDag.create()
    .stage("a", [],    { weight: 10 }, async () => { await new Promise(r => setTimeout(r, 5));  return 1; })
    .stage("b", ["a"], { weight: 90 }, async () => { await new Promise(r => setTimeout(r, 10)); return 2; });
  const r = await cssmvDag.run(dag);
  assert.strictEqual(r.weightedProgress, 1);
  assert.deepStrictEqual(r.criticalPath, ["a", "b"]);
});
