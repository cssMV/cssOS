/* CSSOS_MV_DAG_EXECUTOR 20260507 — Jing
 *
 * Standalone DAG executor for the MV pipeline (and any other multi-stage
 * pipeline that wants topo-ordered async execution with retries, resume
 * cache, cancel-on-error, weighted progress, and critical-path tracking).
 *
 * Design goals:
 *   - Pure JS, no deps on pipeline-panel internals.
 *   - Importable as `globalThis.cssmvDag = { create, run }`.
 *   - Replaces the imperative serial-with-some-parallel block in
 *     app.mv-pipeline-panel.js. The panel can opt in via the feature flag
 *     `globalThis.CSSMV_DAG_RUNNER === true`. Fallback is the legacy path.
 *
 * API:
 *   const dag = cssmvDag.create()
 *     .stage("cover",   [],                  { weight: 10 }, async (deps, ctx) => {...})
 *     .stage("lyrics",  [],                  { weight: 5  }, async (deps, ctx) => {...})
 *     .stage("music",   ["lyrics"],          { weight: 35 }, async ({lyrics}, ctx) => {...})
 *     .stage("video",   ["cover","music"],   { weight: 40 }, async (deps, ctx) => {...})
 *     .stage("subs",    ["lyrics","music"],  { weight: 5  }, async (deps, ctx) => {...})
 *     .stage("compose", ["cover","music","video","subs"], { weight: 5 }, async (deps, ctx) => {...})
 *   ;
 *   const result = await cssmvDag.run(dag, {
 *     ctx,
 *     cache: { lyrics: previouslyComputedLyricsOutput },  // resume support
 *     retry: { compose: 3, video: 2 },
 *     onStageStart, onStageDone, onStageError, onProgress,
 *     cancelOn: "skip-dependents",  // | "first-error" | "continue-best-effort"
 *   });
 *   // result = { done, failed, cancelled, durationMs, criticalPath, weightedProgress }
 */

(function (root) {
  "use strict";

  function create() {
    /** @type {Array<{id:string, deps:string[], weight:number, fn:Function}>} */
    const stages = [];
    const ids = Object.create(null);

    const builder = {
      stage: function (id, deps, optsOrFn, maybeFn) {
        if (typeof id !== "string" || !id) throw new Error("[dag] stage id required");
        if (ids[id]) throw new Error("[dag] duplicate stage id: " + id);
        deps = Array.isArray(deps) ? deps.slice() : [];
        let opts, fn;
        if (typeof optsOrFn === "function") { opts = {}; fn = optsOrFn; }
        else { opts = optsOrFn || {}; fn = maybeFn; }
        if (typeof fn !== "function") throw new Error("[dag] stage fn required: " + id);
        const weight = (typeof opts.weight === "number" && opts.weight > 0) ? opts.weight : 1;
        stages.push({ id: id, deps: deps, weight: weight, fn: fn });
        ids[id] = true;
        return builder;
      },
      stages: stages,
      _ids: ids
    };
    return builder;
  }

  // Kahn's algorithm — returns ordered ids, throws on cycle or unknown dep.
  function topoSort(stages) {
    const indeg = Object.create(null);
    const children = Object.create(null);
    const byId = Object.create(null);
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      byId[s.id] = s;
      indeg[s.id] = indeg[s.id] || 0;
      children[s.id] = children[s.id] || [];
    }
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      for (let j = 0; j < s.deps.length; j++) {
        const d = s.deps[j];
        if (!byId[d]) throw new Error("[dag] unknown dep '" + d + "' in stage '" + s.id + "'");
        indeg[s.id] += 1;
        children[d].push(s.id);
      }
    }
    const order = [];
    const queue = [];
    for (const id in indeg) if (indeg[id] === 0) queue.push(id);
    while (queue.length) {
      const id = queue.shift();
      order.push(id);
      const kids = children[id];
      for (let i = 0; i < kids.length; i++) {
        indeg[kids[i]] -= 1;
        if (indeg[kids[i]] === 0) queue.push(kids[i]);
      }
    }
    if (order.length !== stages.length) {
      throw new Error("[dag] cycle detected");
    }
    return { order: order, byId: byId, children: children };
  }

  // Walk transitive dependents of `id` and return their ids.
  function transitiveDependents(id, children) {
    const out = [];
    const seen = Object.create(null);
    const stack = (children[id] || []).slice();
    while (stack.length) {
      const x = stack.pop();
      if (seen[x]) continue;
      seen[x] = true;
      out.push(x);
      const kids = children[x] || [];
      for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
    }
    return out;
  }

  async function run(dag, opts) {
    opts = opts || {};
    const ctx = opts.ctx || {};
    const cache = opts.cache || {};
    const retryCfg = opts.retry || {};
    const cancelOn = opts.cancelOn || "skip-dependents";
    const onStageStart = opts.onStageStart || function () {};
    const onStageDone  = opts.onStageDone  || function () {};
    const onStageError = opts.onStageError || function () {};
    const onProgress   = opts.onProgress   || function () {};

    const stages = dag.stages.slice();
    const topo = topoSort(stages);
    const byId = topo.byId;
    const children = topo.children;

    /** @type {Object<string, any>} */
    const done = Object.create(null);
    /** @type {Object<string, Error>} */
    const failed = Object.create(null);
    /** @type {Object<string, true>} */
    const cancelled = Object.create(null);
    /** @type {Object<string, {start:number, end:number}>} */
    const timing = Object.create(null);
    const retriesLeft = Object.create(null);
    for (let i = 0; i < stages.length; i++) {
      retriesLeft[stages[i].id] = (typeof retryCfg[stages[i].id] === "number") ? retryCfg[stages[i].id] : 0;
    }

    // Pre-populate cache as done. Emit onStageDone synchronously so the
    // caller can mirror cached stages into UI state (setStage("done"),
    // recordEngine, persistResume) without a special-case branch on the
    // panel side. Done before the pump loop so dependents see deps as
    // satisfied on the first readyIds() check.
    for (const k in cache) {
      if (byId[k]) {
        done[k] = cache[k];
        timing[k] = { start: 0, end: 0 };
        try { onStageDone(k, cache[k], { weightedProgress: 0, durationMs: 0, cached: true }); } catch (_e) {}
      }
    }

    const totalWeight = stages.reduce(function (a, s) { return a + s.weight; }, 0) || 1;
    function weightedProgress() {
      let w = 0;
      for (const id in done) if (byId[id]) w += byId[id].weight;
      return w / totalWeight;
    }

    let firstErrorSeen = false;
    const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

    function readyIds() {
      const ready = [];
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        if (done[s.id] !== undefined) continue;
        if (failed[s.id] || cancelled[s.id]) continue;
        if (inflight[s.id]) continue;
        let ok = true;
        for (let j = 0; j < s.deps.length; j++) {
          if (done[s.deps[j]] === undefined) { ok = false; break; }
        }
        if (ok) ready.push(s.id);
      }
      return ready;
    }

    /** @type {Object<string, Promise<any>>} */
    const inflight = Object.create(null);

    function launch(id) {
      const s = byId[id];
      const depOutputs = Object.create(null);
      for (let j = 0; j < s.deps.length; j++) depOutputs[s.deps[j]] = done[s.deps[j]];
      const tStart = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      timing[id] = { start: tStart, end: 0 };
      try { onStageStart(id, { ctx: ctx, weightedProgress: weightedProgress() }); } catch (_e) {}
      const p = Promise.resolve().then(function () { return s.fn(depOutputs, ctx, {
        progress: function (pct) { try { onProgress(id, pct); } catch (_e) {} }
      }); });
      inflight[id] = p.then(function (output) {
        delete inflight[id];
        const tEnd = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        timing[id].end = tEnd;
        done[id] = output;
        try { onStageDone(id, output, { weightedProgress: weightedProgress(), durationMs: tEnd - tStart }); } catch (_e) {}
      }, function (err) {
        delete inflight[id];
        if (retriesLeft[id] > 0) {
          retriesLeft[id] -= 1;
          // Re-enqueue by simply returning; readyIds will pick it up next pump.
          return;
        }
        const tEnd = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        timing[id].end = tEnd;
        failed[id] = err instanceof Error ? err : new Error(String(err));
        firstErrorSeen = true;
        try { onStageError(id, failed[id], { ctx: ctx }); } catch (_e) {}
        if (cancelOn === "skip-dependents" || cancelOn === "first-error") {
          const deps = transitiveDependents(id, children);
          for (let i = 0; i < deps.length; i++) {
            if (done[deps[i]] === undefined && !failed[deps[i]]) cancelled[deps[i]] = true;
          }
        }
      });
      return inflight[id];
    }

    // Pump loop — launch all ready stages, await any settle, repeat.
    while (true) {
      if (cancelOn === "first-error" && firstErrorSeen && Object.keys(inflight).length === 0) break;
      const ready = readyIds();
      for (let i = 0; i < ready.length; i++) {
        if (cancelOn === "first-error" && firstErrorSeen) break;
        launch(ready[i]);
      }
      const inflightKeys = Object.keys(inflight);
      if (inflightKeys.length === 0) break;
      // Wait for any to settle. Promise.race with already-settled is fine.
      const racers = inflightKeys.map(function (k) { return inflight[k]; });
      try { await Promise.race(racers); } catch (_e) { /* per-stage handlers caught it */ }
    }

    const t1 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

    // Critical path: bottom-up DP. cp[id] = self_dur + max(cp[parent] over deps).
    const cp = Object.create(null);
    for (let i = 0; i < topo.order.length; i++) {
      const id = topo.order[i];
      const s = byId[id];
      const self = (timing[id] && timing[id].end) ? (timing[id].end - timing[id].start) : 0;
      let best = 0;
      for (let j = 0; j < s.deps.length; j++) {
        if (cp[s.deps[j]] !== undefined && cp[s.deps[j]].total > best) best = cp[s.deps[j]].total;
      }
      cp[id] = { total: self + best, self: self, dep: null };
      for (let j = 0; j < s.deps.length; j++) {
        if (cp[s.deps[j]] && cp[s.deps[j]].total === best) { cp[id].dep = s.deps[j]; break; }
      }
    }
    let leaf = null, leafMax = -1;
    for (const id in cp) if (cp[id].total > leafMax) { leafMax = cp[id].total; leaf = id; }
    const criticalPath = [];
    let cur = leaf;
    while (cur) { criticalPath.unshift(cur); cur = cp[cur] && cp[cur].dep; }

    return {
      done: done,
      failed: failed,
      cancelled: cancelled,
      durationMs: t1 - t0,
      criticalPath: criticalPath,
      weightedProgress: weightedProgress(),
      timing: timing
    };
  }

  const api = { create: create, run: run, _topoSort: topoSort };

  if (root) root.cssmvDag = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
