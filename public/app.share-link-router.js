/* CSSOS_PHASE_A_SHARE_LINK_ROUTER 20260506 — Jing
 *
 * Reads `?cssMV=<work-id>` from the URL on boot. If present:
 *   1. Hits GET /api/works/public/<id> to resolve the work payload.
 *   2. Shapes a work-like object compatible with openMarketWorkPreview()
 *      (the existing entrypoint used by For You / Works Center).
 *   3. Calls openMarketWorkPreview(work) — which opens the MV panel
 *      and triggers the auto-cinema flow already wired in
 *      app.watch-media-layout-p2100.js + index.html's pure-cinema JS.
 *   4. Strips the cssMV query param from the URL bar so a refresh
 *      doesn't re-fire the share-open while the panel is already open.
 *
 * Loaded EARLY (before app.boot.js) so the work data is in flight by
 * the time the user could click anything else. We wait for
 * openMarketWorkPreview to be defined before invoking — boot order on a
 * cold cache is racy.
 */
(function () {
  "use strict";

  function readShareWorkId() {
    try {
      var sp = new URL(window.location.href).searchParams;
      var raw = (sp.get("cssMV") || sp.get("mv") || "").trim();
      // Accept UUID-ish (8-64 hex/dash) only.
      if (!/^[0-9a-fA-F-]{8,64}$/.test(raw)) return "";
      return raw;
    } catch (_e) {
      return "";
    }
  }

  function stripShareParam() {
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete("cssMV");
      url.searchParams.delete("mv");
      var clean = url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "") + url.hash;
      window.history.replaceState({}, document.title, clean);
    } catch (_e) {}
  }

  function shapeWorkFromPublicResponse(data) {
    if (!data || typeof data !== "object") return null;
    return {
      id: data.id,
      work_id: data.id,
      title: data.title || "",
      style: data.style || "",
      work_type: data.work_type || "",
      lyrics_preview: data.lyrics_preview || "",
      owner_name: data.owner_name || "",
      duration_secs: data.duration_secs || null,
      cover_image: data.cover_image || null,
      preview_image_url: data.preview_image_url || null,
      preview_video_url: data.preview_video_url || null,
      final_mv_url: data.final_mv_url || null,
      audio_track_1_url: data.audio_track_1_url || null,
      audio_track_2_url: data.audio_track_2_url || null,
      // Pass-through flags so downstream UI (Phase B download buttons
      // + preview-only sign-in CTA) can read them off the work object.
      __cssosShareLink: true,
      __cssosTier: data.viewer_tier || "guest",
      __cssosFullAccess: !!data.full_access,
      __cssosPreviewOnly: !!data.preview_only,
      __cssosCanDownloadMp3: !!data.can_download_mp3,
      __cssosCanDownloadWav: !!data.can_download_wav,
      __cssosCanDownloadMp4: !!data.can_download_mp4,
      __cssosGateAction: data.gate_action || null,
    };
  }

  function openWhenReady(work, attempt) {
    attempt = attempt || 0;
    if (typeof globalThis.openMarketWorkPreview === "function") {
      try { globalThis.openMarketWorkPreview(work); } catch (e) {
        console.warn("[share-link] openMarketWorkPreview failed:", e);
      }
      return;
    }
    if (attempt > 60) {
      console.warn("[share-link] openMarketWorkPreview never appeared");
      return;
    }
    setTimeout(function () { openWhenReady(work, attempt + 1); }, 250);
  }

  async function bootShareLink() {
    var id = readShareWorkId();
    if (!id) return;
    stripShareParam();
    try {
      var res = await fetch("/api/works/public/" + encodeURIComponent(id), {
        credentials: "include",
        headers: { "Accept": "application/json" }
      });
      var payload = await res.json().catch(function () { return null; });
      if (!res.ok || !payload || !payload.ok) {
        console.warn("[share-link] /api/works/public failed:", res.status, payload);
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(
            (typeof globalThis.loginCopy === "function"
              ? globalThis.loginCopy("Share link not found.", "分享链接失效。")
              : "Share link not found.")
          );
        }
        return;
      }
      var work = shapeWorkFromPublicResponse(payload.data);
      if (!work) return;
      // Wait until DOM is ready AND openMarketWorkPreview is defined.
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          openWhenReady(work, 0);
        });
      } else {
        openWhenReady(work, 0);
      }
    } catch (err) {
      console.warn("[share-link] boot failed:", err);
    }
  }

  // Fire as soon as this script parses — fetch can race with the rest of
  // app.js loading; we'll just wait for the open fn before invoking.
  bootShareLink();

  // Expose for debugging / re-trigger.
  globalThis.__cssosShareLinkBoot = bootShareLink;
})();
