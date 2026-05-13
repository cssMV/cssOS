/* CSSOS_WAVE_113K 20260511 — Jing
 * Client-side accumulator for per-engine cost entries.
 *
 * Intercepts every fetch() to /api/mv/(lyrics|cover|music|video|subtitles|compose|audio/upload)
 * and, if the JSON response includes `cost_cents` + `engine`, pushes
 * an entry into a global ring buffer. When a work is saved, the save
 * body builder drains the buffer into `cost_breakdown: [...]` which
 * the backend persists into user_works.cost_breakdown JSONB.
 *
 * Buffer is keyed by an implicit "current run" — drained on every
 * /api/works/save POST so successive runs don't leak into each other.
 */
(function () {
  if (globalThis.__cssosCostAccumWired) return;
  globalThis.__cssosCostAccumWired = true;

  var BUFFER = [];
  var MAX = 128;
  var STAGE_RE = /\/api\/mv\/(lyrics|cover|music|video|subtitles|subtitle|compose|audio\/upload|audio\/transcribe|lyrics\/parse)(?:\b|$|\?)/;

  function stageFromUrl(url) {
    var m = String(url || "").match(STAGE_RE);
    if (!m) return null;
    var s = m[1].replace("/", "_");
    if (s === "audio_upload") return "audio_upload";
    if (s === "audio_transcribe" || s === "subtitle") return "subtitle";
    if (s === "lyrics_parse") return "lyrics_parse";
    return s;
  }

  function push(entry) {
    if (!entry || !entry.stage) return;
    BUFFER.push(entry);
    if (BUFFER.length > MAX) BUFFER.splice(0, BUFFER.length - MAX);
  }

  globalThis.cssosDrainCostBreakdown = function () {
    var out = BUFFER.slice();
    BUFFER = [];
    return out;
  };

  globalThis.cssosPeekCostBreakdown = function () {
    return BUFFER.slice();
  };

  globalThis.cssosRecordEngineCostEntry = function (entry) {
    if (!entry || typeof entry !== "object") return;
    push({
      stage: String(entry.stage || "").slice(0, 24),
      provider: String(entry.provider || entry.engine || "").slice(0, 48),
      model: String(entry.model || "").slice(0, 96),
      cents: Math.max(0, Number(entry.cents || entry.cost_cents || 0) | 0),
      ts: Number(entry.ts) || Date.now(),
      ms: Math.max(0, Number(entry.ms || 0) | 0),
    });
  };

  // Wrap fetch — only intercept response bodies, never alter requests.
  var _origFetch = globalThis.fetch && globalThis.fetch.bind(globalThis);
  if (!_origFetch) return;
  globalThis.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var stage = stageFromUrl(url);
    var t0 = Date.now();
    var p = _origFetch(input, init);
    if (!stage) return p;
    // Drain trigger on /api/works/save itself — let body builder
    // already have read drainCostBreakdown(). Do nothing more.
    if (/\/api\/works\/save/.test(url)) return p;
    return p.then(function (response) {
      // Clone so callers still get a fresh body to read.
      var cloned;
      try { cloned = response.clone(); } catch (_) { return response; }
      // Only attempt JSON parse for application/json responses.
      var ct = (cloned.headers.get("content-type") || "").toLowerCase();
      if (ct.indexOf("application/json") < 0) return response;
      cloned.json().then(function (json) {
        if (!json || typeof json !== "object") return;
        var cents = Number(json.cost_cents || 0);
        if (cents <= 0) {
          // audio/upload returns a structured cost_breakdown subobject
          var cb = json.cost_breakdown;
          if (cb && typeof cb === "object") {
            if (Number(cb.transcribe_cents) > 0) {
              push({ stage: "subtitle", provider: "whisper", model: "whisper-1",
                     cents: Number(cb.transcribe_cents), ts: Date.now(), ms: Date.now() - t0 });
            }
            if (Number(cb.fingerprint_cents) > 0) {
              push({ stage: "compose", provider: "acrcloud", model: "fingerprint",
                     cents: Number(cb.fingerprint_cents), ts: Date.now(), ms: Date.now() - t0 });
            }
          }
          return;
        }
        push({
          stage: stage,
          provider: String(json.engine || json.provider || ""),
          model: String(json.model || ""),
          cents: cents,
          ts: Date.now(),
          ms: Date.now() - t0,
        });
      }).catch(function () { /* json parse failure — silent */ });
      return response;
    });
  };
})();
