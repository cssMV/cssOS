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

  /* CSSOS_SHARE_LINK_DIRECT_OPEN 20260506 — Jing
   * "面板跳来跳去，最终播放了一个不是分享的那个标题的作品" — even with
   * isShareLink guards inside the 645-line openMarketWorkPreview, the
   * function has too many side-effect branches (queue auto-chain, panel
   * default content, take-toggle hydration, market preview rendering)
   * for a share link to land cleanly. Bypass it entirely: pre-seed the
   * pipeline state, drop the watch-panel's .hidden, and let the existing
   * watch-ui hydration + cinema MutationObserver pick up from there. */
  function openShareLinkDirect(work) {
    var mvUrl = String(work.final_mv_url || work.preview_video_url || "").trim();
    var title = String(work.title || "").trim();
    var coverUrl = String(work.cover_image || work.preview_image_url || "").trim();
    var audioUrl = String(work.audio_track_1_url || "").trim();
    var altAudioUrl = String(work.audio_track_2_url || "").trim();
    var lyrics = String(work.lyrics_preview || "").trim();
    var style = String(work.style || "").trim();
    var duration = Number(work.duration_secs || 0) || null;

    // 1. Seed cssmvPipelineLastResult so watch-ui's hydration finds the
    //    URL + title without triggering a fresh pipeline run.
    try {
      globalThis.cssmvPipelineLastResult = {
        mvUrl: mvUrl || null,
        coverUrl: coverUrl || null,
        title: title || null,
        lyrics: lyrics || null,
        style: style || null,
        runId: null,
        audioUrl: audioUrl || null,
        altAudioUrl: altAudioUrl || null,
        durationSecs: duration,
        tsAt: Date.now(),
        // Long freshMs so any subsequent re-hydration check sees this
        // as authoritative. The single-source-of-truth principle: the
        // share-link UUID controls the panel, period.
        freshMs: 60 * 60 * 1000,
        source: "share-link"
      };
    } catch (_e) {}

    // 2. Mirror into mv-pipeline-panel state if it exists.
    try {
      var ps = globalThis.cssosMvPipelinePanelState
        ? globalThis.cssosMvPipelinePanelState()
        : null;
      if (ps) {
        ps.mvUrl = mvUrl || null;
        ps.audioUrl = audioUrl || null;
        ps.altAudioUrl = altAudioUrl || null;
        ps.duration = duration || 0;
        ps.title = title;
        ps.coverUrl = coverUrl;
        ps.lyrics = lyrics;
        ps.style = style;
        ps.workId = work.id || null;
        ps.ownerName = work.owner_name || "";
      }
    } catch (_e) {}

    // 3. Drop a single-entry, loop_single playlist so auto-advance can't hop.
    try {
      var pl = globalThis.cssosPlaylists;
      if (pl && typeof pl.populate === "function") {
        pl.populate("share-link", [work]);
        pl.setActive && pl.setActive("share-link");
        pl.setMode && pl.setMode("loop_single");
      }
    } catch (_e) {}

    // 4. Directly write the video + audio src so the panel plays this
    //    exact work even before any hydration helper runs.
    try {
      var v = document.getElementById("watch-video");
      var a = document.getElementById("watch-audio-preview");
      if (v && mvUrl) {
        v.src = mvUrl;
        v.removeAttribute("muted");
        v.muted = false;
        v.volume = 1;
        try { v.load && v.load(); } catch (_e) {}
        try { v.play && v.play().catch(function () {}); } catch (_e) {}
      }
      if (a && audioUrl) {
        a.src = audioUrl;
        a.removeAttribute("muted");
        a.muted = false;
        a.volume = 1;
        try { a.load && a.load(); } catch (_e) {}
      }
      // Title overlay
      var t = document.getElementById("watch-title");
      if (t) t.textContent = title || "";
    } catch (_e) {}

    // 5. Open the watch panel — un-hide + run the shell module if present
    //    (this kicks the cinema-enter chain via MutationObserver).
    try {
      var watchPanel = document.getElementById("watch-panel");
      if (watchPanel) {
        watchPanel.classList.remove("hidden");
        watchPanel.dataset.minimized = "false";
        if (typeof globalThis.openWatchPanelShellModule === "function") {
          try { globalThis.openWatchPanelShellModule(); } catch (_e) {}
        }
        if (typeof globalThis.cssosEnterCinemaLayout === "function") {
          try { globalThis.cssosEnterCinemaLayout(); } catch (_e) {}
        }
        if (typeof globalThis.cssosRequestBrowserFullscreen === "function") {
          try { globalThis.cssosRequestBrowserFullscreen(); } catch (_e) {}
        }
      }
    } catch (_e) {}
  }

  function openWhenReady(work, attempt) {
    attempt = attempt || 0;
    // Wait until the watch panel is in the DOM.
    var watchPanel = document.getElementById("watch-panel");
    if (watchPanel) {
      openShareLinkDirect(work);
      return;
    }
    if (attempt > 80) {
      console.warn("[share-link] watch-panel never appeared");
      return;
    }
    setTimeout(function () { openWhenReady(work, attempt + 1); }, 200);
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
      /* CSSOS_SHARE_LINK_SENTINEL 20260506 — Jing
       * Stamp a global flag so ensureWatchAutoChainOnOpenModule (and
       * any other "no media → regen pipeline" path) bails out for the
       * lifetime of this share session. The flag is cleared the moment
       * the user closes / minimizes the MV panel via the 3-button
       * close, or by their next manual action — see app.watch-ui.js. */
      globalThis.__cssosShareLinkActive = true;
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
