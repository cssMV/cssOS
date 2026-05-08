/* CSSOS_WAVE80 20260508 — Jing — web-vitals reporter.
 * Inline minimal Core Web Vitals collector — avoids a runtime npm dep.
 * Tracks LCP, CLS, INP, FID, TTFB and POSTs each sample to
 * /api/internal/webvitals with {name,value,id,route}. Failures are
 * silent — telemetry MUST NOT break the app.
 *
 * IRON-RULE NOTES:
 *   - No visible strings, so no i18n needed.
 *   - No CSS, so no light-theme override needed.
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__cssosWebVitals) return;
  window.__cssosWebVitals = true;

  var ENDPOINT = "/api/internal/webvitals";
  var route = function () {
    try {
      return location.pathname + (location.hash || "");
    } catch (_e) {
      return "/";
    }
  };
  function uid() {
    return (
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10)
    );
  }
  function send(name, value) {
    if (!isFinite(value)) return;
    var body = JSON.stringify({
      name: name,
      value: value,
      id: uid(),
      route: route(),
    });
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(ENDPOINT, blob);
        return;
      }
    } catch (_e) {}
    try {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true,
      }).catch(function () {});
    } catch (_e) {}
  }

  // TTFB — straight from Navigation Timing.
  try {
    var nav = performance.getEntriesByType &&
      performance.getEntriesByType("navigation")[0];
    if (nav && nav.responseStart > 0) {
      send("TTFB", Math.max(0, nav.responseStart - nav.startTime));
    }
  } catch (_e) {}

  // LCP — largest-contentful-paint observer; report final value on hide.
  var lcp = 0;
  try {
    var po = new PerformanceObserver(function (list) {
      var entries = list.getEntries();
      var last = entries[entries.length - 1];
      if (last) lcp = last.renderTime || last.loadTime || last.startTime || 0;
    });
    po.observe({ type: "largest-contentful-paint", buffered: true });
  } catch (_e) {}

  // CLS — cumulative layout shift, sum of session-window shifts.
  var cls = 0;
  try {
    var clsObs = new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        if (!e.hadRecentInput) cls += e.value;
      });
    });
    clsObs.observe({ type: "layout-shift", buffered: true });
  } catch (_e) {}

  // FID — first-input observer.
  try {
    var fidObs = new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        send("FID", e.processingStart - e.startTime);
      });
    });
    fidObs.observe({ type: "first-input", buffered: true });
  } catch (_e) {}

  // INP — best-effort: track max event duration ≥40ms.
  var inp = 0;
  try {
    var inpObs = new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        if (e.duration > inp) inp = e.duration;
      });
    });
    inpObs.observe({ type: "event", durationThreshold: 40, buffered: true });
  } catch (_e) {}

  function flush() {
    if (lcp > 0) send("LCP", lcp);
    send("CLS", cls);
    if (inp > 0) send("INP", inp);
  }
  // visibilitychange + pagehide is the standard "final" hook.
  window.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
})();
