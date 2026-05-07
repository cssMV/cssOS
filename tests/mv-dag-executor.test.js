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

test("weighted progress + critical path reported", async () => {
  const dag = cssmvDag.create()
    .stage("a", [],    { weight: 10 }, async () => { await new Promise(r => setTimeout(r, 5));  return 1; })
    .stage("b", ["a"], { weight: 90 }, async () => { await new Promise(r => setTimeout(r, 10)); return 2; });
  const r = await cssmvDag.run(dag);
  assert.strictEqual(r.weightedProgress, 1);
  assert.deepStrictEqual(r.criticalPath, ["a", "b"]);
});
