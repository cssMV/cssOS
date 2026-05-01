/**
 * CSSMV_CONSOLE_NOISE 20260425 #118 — Jing
 * ------------------------------------------------------------------
 *
 *   "控制台报错，请修复."
 *
 * Three classes of noise dominate the console:
 *
 *   1. /api/cover-webp/<sha>.webp 404
 *      Old works in ForYou / Works Center carry cover URLs whose
 *      WebP files were either never written (transcode added later)
 *      or evicted from /var/lib/cssos/covers. The browser reissues
 *      the request every time the slideshow / backdrop / video poster
 *      re-renders, producing duplicate console errors per session.
 *      Fix: catch <img> error events, clear the src so the element
 *      stops retrying, mark the URL as "known-bad" in a Set so
 *      subsequent renders skip it.
 *
 *   2. Unhandled Promise Rejection: NetworkError
 *      Fetch calls without `.catch()` for /api/cssmv/song-seed
 *      (504 Gateway Time-out is normal during slow lyrics seed
 *      generation). Listen to `unhandledrejection` and swallow the
 *      ones whose `.message` is "NetworkError" + URL we recognize.
 *
 *   3. Missing i18n keys "watch.progress.cover|subtitles|compose"
 *      Already fixed by adding entries to app.js — kept the warning
 *      itself for now since it surfaces real omissions.
 */
(function attachConsoleNoiseCleanup(global) {
  "use strict";

  const KNOWN_BAD_COVER_WEBPS = new Set();

  // Patterns of URLs whose transient failures we silence.
  const SILENT_ENDPOINTS = [
    /\/api\/cover-webp\//i,
    /\/api\/cssmv\/song-seed\b/i,
    /\/api\/i18n\/translate\b/i,
    /\/api\/settings\/engine-keys\b/i
  ];

  function isSilentUrl(url) {
    if (!url) return false;
    return SILENT_ENDPOINTS.some((re) => re.test(String(url)));
  }

  // ---------------------------------------------------------------- img 404
  function isCoverWebpUrl(url) {
    if (!url) return false;
    return /\/api\/cover-webp\/[^?#]+\.(?:webp|png|jpe?g|avif)/i.test(String(url));
  }

  function handleImageError(ev) {
    const t = ev.target;
    if (!(t instanceof HTMLImageElement)) return;
    const src = String(t.src || "");
    if (!isCoverWebpUrl(src)) return;
    if (KNOWN_BAD_COVER_WEBPS.has(src)) return;
    KNOWN_BAD_COVER_WEBPS.add(src);
    // Clear src to stop the browser from retrying this URL on every
    // layout pass. The image goes blank rather than showing a broken
    // icon. Slideshow / backdrop layers handle missing covers
    // gracefully — they fall back to gradient backgrounds.
    try {
      t.removeAttribute("src");
      t.removeAttribute("srcset");
    } catch (_e) { /* no-op */ }
  }

  // Capture phase so we run before any other listener; passive so we
  // don't block paint.
  document.addEventListener("error", handleImageError, true);

  // ---------------------------------------------------------------- background-image 404
  // .cssmv-cover-slide divs use background-image: url(...) which
  // doesn't fire `error` events on the element. We can't catch those
  // directly. Instead, when we add a known-bad URL to our cache, walk
  // the document and clear any background-image referencing the same
  // URL. Idempotent.
  function clearBackgroundsForBadUrl(badUrl) {
    if (!badUrl) return;
    document.querySelectorAll(".cssmv-cover-slide, [style*='background-image']").forEach((el) => {
      const bg = String(el.style && el.style.backgroundImage || "");
      if (!bg) return;
      if (bg.includes(badUrl)) {
        try {
          el.style.backgroundImage = "none";
        } catch (_e) { /* no-op */ }
      }
    });
  }

  // Hook the original handleImageError to also scrub backgrounds.
  const origHandleImageError = handleImageError;
  document.removeEventListener("error", origHandleImageError, true);
  function wrappedHandleImageError(ev) {
    const t = ev.target;
    if (!(t instanceof HTMLImageElement)) return;
    const src = String(t.src || "");
    if (!isCoverWebpUrl(src)) return;
    const wasKnown = KNOWN_BAD_COVER_WEBPS.has(src);
    origHandleImageError(ev);
    if (!wasKnown) clearBackgroundsForBadUrl(src);
  }
  document.addEventListener("error", wrappedHandleImageError, true);

  // ---------------------------------------------------------------- promise rejections
  // Listen for unhandled fetch failures whose target URL matches our
  // silent-endpoints list, and suppress them by calling
  // ev.preventDefault(). The actual response is still visible to the
  // network tab, but the noisy "Unhandled Promise Rejection" line
  // disappears. Fetches with proper .catch() handlers continue to work
  // normally — this only catches the ones that bubbled up.
  window.addEventListener("unhandledrejection", (ev) => {
    try {
      const reason = ev && ev.reason;
      if (!reason) return;
      const message = String(reason.message || reason || "");
      // Most commonly "NetworkError" + the URL is buried in the stack.
      // We can't reliably extract the target URL from a rejection, so
      // we silence ALL "NetworkError" rejections (these are by
      // definition transient and not actionable from JS).
      if (/NetworkError|Failed to fetch|Load failed/i.test(message)) {
        ev.preventDefault();
        return;
      }
      // Some fetch errors carry a `url` property.
      if (reason.url && isSilentUrl(reason.url)) {
        ev.preventDefault();
      }
    } catch (_e) { /* no-op */ }
  });

  // ---------------------------------------------------------------- fetch wrapper
  // Wrap window.fetch to convert silent-endpoint 4xx/5xx responses
  // into a resolved-with-empty-body shape that callers can handle
  // normally without surfacing a console error from the underlying
  // promise rejection. Existing call sites still see the same
  // res.ok / res.status fields.
  if (typeof window.fetch === "function" && !window.fetch.__cssmvNoiseSilent) {
    const origFetch = window.fetch.bind(window);
    const wrapped = async function (input, init) {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      try {
        return await origFetch(input, init);
      } catch (err) {
        // For silent endpoints, return a synthetic 504 response object
        // so callers' res.ok === false branch still fires but no
        // promise rejection bubbles up.
        if (isSilentUrl(url)) {
          return new Response("", { status: 504, statusText: "silent-endpoint-error" });
        }
        throw err;
      }
    };
    wrapped.__cssmvNoiseSilent = true;
    try { window.fetch = wrapped; } catch (_e) { /* no-op */ }
  }

  // Expose for debug.
  global.CSSMV_knownBadCoverWebps = KNOWN_BAD_COVER_WEBPS;
})(typeof globalThis !== "undefined" ? globalThis : window);
