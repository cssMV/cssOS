/* CSSOS_PHASE2_MODULE1 20260508 — Jing
 * Cinema MV pipeline → iOS Live Activity bridge (JS side).
 *
 * Per the locality principle the cinema pipeline panel emits
 * `cssos:run_progress` events with detail = { runId, personName,
 * stage, pct, etaSecs }. This module subscribes, and on iOS 16.1+
 * (Capacitor + native plugin present) starts/updates/ends a Live
 * Activity so the lock screen + Dynamic Island show the same
 * progress as the in-app chips.
 *
 * Web / Android / older iOS: this file is a no-op — the existing
 * in-app progress UI is the only surface, exactly as before.
 *
 * Visible strings here are minimal and routed through CSSOS_I18N
 * when present; the SwiftUI widget itself owns the lock-screen
 * presentation so we don't render anything in the DOM.
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__cssosCinemaLiveActivityInstalled) return;
  window.__cssosCinemaLiveActivityInstalled = true;

  function tr(key, fallback) {
    try {
      var i18n = window.CSSOS_I18N;
      if (i18n && typeof i18n.tr === "function") {
        var v = i18n.tr(key);
        if (v) return v;
      }
    } catch (e) { /* ignore */ }
    return fallback;
  }

  function getPlugin() {
    try {
      var cap = window.Capacitor;
      if (!cap || typeof cap.isNativePlatform !== "function") return null;
      if (!cap.isNativePlatform()) return null;
      if (cap.getPlatform && cap.getPlatform() !== "ios") return null;
      var p = (cap.Plugins || {})["CssosLiveActivity"];
      return p || null;
    } catch (e) { return null; }
  }

  // runId -> { activityId, registered }
  var sessions = Object.create(null);

  async function ensureStarted(detail) {
    var p = getPlugin();
    if (!p) return null;
    var runId = String(detail && detail.runId || "");
    if (!runId) return null;
    if (sessions[runId]) return sessions[runId];
    try {
      var personName = String(detail.personName || tr("cinema.unknown_person", "?"));
      var res = await p.start({ personName: personName, runId: runId });
      if (!res || !res.activityId) return null;
      sessions[runId] = { activityId: res.activityId, registered: false };
      // Hand the push token to the server so backend can drive updates.
      if (res.pushToken) {
        try {
          await fetch("/api/push/live-activity-token", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              run_id: runId,
              push_token: res.pushToken,
              bundle_id: window.__cssosBundleId || null,
            }),
          });
          sessions[runId].registered = true;
        } catch (err) {
          console.warn("[live-activity] register failed", err);
        }
      }
      return sessions[runId];
    } catch (err) {
      console.warn("[live-activity] start failed", err);
      return null;
    }
  }

  async function onProgress(ev) {
    var d = (ev && ev.detail) || {};
    var p = getPlugin();
    if (!p) return;
    var sess = await ensureStarted(d);
    if (!sess) return;
    try {
      await p.update({
        activityId: sess.activityId,
        stage: String(d.stage || "cover"),
        pct: Math.max(0, Math.min(100, Math.round(Number(d.pct) || 0))),
        etaSecs: Math.max(0, Math.round(Number(d.etaSecs) || 0)),
      });
    } catch (err) { console.warn("[live-activity] update failed", err); }
  }

  async function onFinish(ev) {
    var d = (ev && ev.detail) || {};
    var runId = String(d.runId || "");
    if (!runId) return;
    var sess = sessions[runId];
    var p = getPlugin();
    if (sess && p) {
      try { await p.end({ activityId: sess.activityId }); }
      catch (err) { console.warn("[live-activity] end failed", err); }
    }
    if (sess && sess.registered) {
      try {
        await fetch("/api/push/live-activity-token", {
          method: "DELETE",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ run_id: runId }),
        });
      } catch (err) { console.warn("[live-activity] unregister failed", err); }
    }
    delete sessions[runId];
  }

  window.addEventListener("cssos:run_progress", onProgress);
  window.addEventListener("cssos:run_finished", onFinish);
  window.addEventListener("cssos:run_failed", onFinish);
})();
