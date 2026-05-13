/* CSSOS_WAVE_111 20260511 — Jing
 * Custom Lyrics / Music Source Uploads UI.
 * Injects a 📥 Import button into the MV Pipeline panel + a modal
 * that handles two flows:
 *   A. Paste/upload lyrics text → parse via /api/mv/lyrics/parse,
 *      normalize sections, detect work_type, route into pipeline
 *      with skip_stages=['lyrics'].
 *   B. Upload audio file → /api/mv/audio/upload runs ffprobe + DRM +
 *      transcode + (optional) ACRCloud + (optional) Whisper, returns
 *      asset_url + skip_stages. Frontend slots the audio into the
 *      take-1 audio_track_1 position so the pipeline skips music gen.
 */
(function () {
  if (globalThis.__cssosMvImportWired) return;
  globalThis.__cssosMvImportWired = true;

  function tr(en, zh) {
    return typeof globalThis.loginCopy === "function"
      ? globalThis.loginCopy(en, zh || en)
      : en;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function injectStyles() {
    if (document.getElementById("cssos-mv-import-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-mv-import-style";
    st.textContent = [
      "#cssos-import-modal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.72);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;}",
      "#cssos-import-modal[hidden]{display:none;}",
      "#cssos-import-modal .panel{background:#0d1117;border:1px solid rgba(255,255,255,0.12);border-radius:14px;width:min(92vw,640px);max-height:88vh;overflow-y:auto;color:#e6e8ee;padding:20px;}",
      "#cssos-import-modal h2{margin:0 0 14px;font-size:18px;}",
      "#cssos-import-modal .tabs{display:flex;gap:8px;margin-bottom:14px;}",
      "#cssos-import-modal .tab{padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,0.18);background:rgba(0,0,0,0.4);cursor:pointer;color:#9aa;font-size:13px;}",
      "#cssos-import-modal .tab.active{background:rgba(0,245,160,0.15);border-color:rgba(0,245,160,0.6);color:#daffee;}",
      "#cssos-import-modal label{display:block;font-size:12px;opacity:0.78;margin:10px 0 4px;}",
      "#cssos-import-modal input[type=text], #cssos-import-modal textarea, #cssos-import-modal select{width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:8px;color:#daffee;padding:8px 10px;font:inherit;box-sizing:border-box;}",
      "#cssos-import-modal textarea{min-height:160px;font-family:ui-monospace,monospace;font-size:12px;}",
      "#cssos-import-modal .row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}",
      "#cssos-import-modal .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px;}",
      "#cssos-import-modal button.cta{padding:8px 14px;border-radius:999px;border:0;background:linear-gradient(135deg,#00f5a0,#00b87a);color:#0a0d12;font-weight:700;cursor:pointer;}",
      "#cssos-import-modal button.ghost{padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.2);background:transparent;color:#daffee;cursor:pointer;}",
      "#cssos-import-modal .status{font-size:12px;opacity:0.78;margin-top:10px;min-height:18px;}",
      "#cssos-import-modal .status.err{color:#ff6b6b;}",
      "#cssos-import-modal .status.ok{color:#00f5a0;}",
      "#cssos-import-modal .preview{margin-top:10px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);font-size:12px;}",
      "#cssos-import-modal .preview .row{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;}",
      "#cssos-import-modal .preview .row span:first-child{opacity:0.7;}",
      ".cssos-import-trigger{padding:6px 12px;border-radius:999px;border:1px solid rgba(0,245,160,0.4);background:rgba(0,245,160,0.08);color:#daffee;cursor:pointer;font:600 12px/1 -apple-system,system-ui,sans-serif;}",
      ".cssos-import-trigger:hover{background:rgba(0,245,160,0.15);}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function buildModal() {
    if (document.getElementById("cssos-import-modal")) return;
    var modal = document.createElement("div");
    modal.id = "cssos-import-modal";
    modal.hidden = true;
    modal.innerHTML = ''
      + '<div class="panel">'
      + '  <h2>📥 ' + escapeHtml(tr("Import your own lyrics or audio", "导入自定义歌词或音乐")) + '</h2>'
      + '  <div class="tabs">'
      + '    <button type="button" class="tab active" data-tab="lyrics">' + escapeHtml(tr("Lyrics", "歌词")) + '</button>'
      + '    <button type="button" class="tab" data-tab="audio">' + escapeHtml(tr("Audio file", "音频文件")) + '</button>'
      + '  </div>'

      + '  <div class="pane" data-pane="lyrics">'
      + '    <label>' + escapeHtml(tr("Title (optional)", "标题（可选）")) + '</label>'
      + '    <input type="text" data-field="title" placeholder="' + escapeHtml(tr("e.g. 凌霄宝殿", "如 凌霄宝殿")) + '">'
      + '    <label>' + escapeHtml(tr("Paste lyrics (.lrc / .srt / .vtt / plain text supported)", "粘贴歌词（支持 .lrc / .srt / .vtt / 纯文本）")) + '</label>'
      + '    <textarea data-field="text" placeholder="[Verse 1]\nLine 1...\n[Chorus 1]\nHook..."></textarea>'
      + '    <div class="row">'
      + '      <div><label>' + escapeHtml(tr("Work type", "作品类型")) + '</label>'
      + '        <select data-field="work_type">'
      + '          <option value="">' + escapeHtml(tr("Auto-detect", "自动识别")) + '</option>'
      + '          <option value="single">' + escapeHtml(tr("Single (≤8min)", "单曲 (≤8 分钟)")) + '</option>'
      + '          <option value="triptych">' + escapeHtml(tr("Triptych (≤24min)", "三部曲 (≤24 分钟)")) + '</option>'
      + '          <option value="opera">' + escapeHtml(tr("Opera act (≤90min)", "歌剧一幕 (≤90 分钟)")) + '</option>'
      + '          <option value="shortplay">' + escapeHtml(tr("Short play", "短剧")) + '</option>'
      + '          <option value="series">' + escapeHtml(tr("TV series episode", "电视剧一集")) + '</option>'
      + '          <option value="film">' + escapeHtml(tr("Film cue", "电影分镜")) + '</option>'
      + '        </select>'
      + '      </div>'
      + '      <div><label>' + escapeHtml(tr("Language", "语言")) + '</label>'
      + '        <select data-field="language">'
      + '          <option value="">' + escapeHtml(tr("Auto / follow UI", "自动 / 跟随界面")) + '</option>'
      + '          <option value="en">English</option>'
      + '          <option value="zh">中文</option>'
      + '          <option value="ja">日本語</option>'
      + '        </select>'
      + '      </div>'
      + '    </div>'
      + '    <div class="status" data-status="lyrics"></div>'
      + '    <div class="preview" data-preview="lyrics" hidden></div>'
      + '  </div>'

      + '  <div class="pane" data-pane="audio" hidden>'
      + '    <label>' + escapeHtml(tr("Title", "标题")) + '</label>'
      + '    <input type="text" data-field="audio_title" placeholder="' + escapeHtml(tr("Required", "必填")) + '">'
      + '    <label>' + escapeHtml(tr("Audio file (.mp3 .m4a .wav .flac .ogg, up to 100MB)", "音频文件（.mp3 .m4a .wav .flac .ogg，最大 100MB）")) + '</label>'
      + '    <input type="file" data-field="audio_file" accept="audio/*">'
      + '    <div class="row">'
      + '      <div><label>' + escapeHtml(tr("Work type", "作品类型")) + '</label>'
      + '        <select data-field="audio_work_type">'
      + '          <option value="single">' + escapeHtml(tr("Single (≤8min)", "单曲 (≤8 分钟)")) + '</option>'
      + '          <option value="triptych">' + escapeHtml(tr("Triptych (≤24min)", "三部曲 (≤24 分钟)")) + '</option>'
      + '          <option value="opera">' + escapeHtml(tr("Opera act (≤90min)", "歌剧一幕 (≤90 分钟)")) + '</option>'
      + '        </select>'
      + '      </div>'
      + '      <div><label>' + escapeHtml(tr("Lyrics", "歌词")) + '</label>'
      + '        <select data-field="audio_lyrics_choice">'
      + '          <option value="whisper">' + escapeHtml(tr("Transcribe via Whisper", "用 Whisper 自动转写")) + '</option>'
      + '          <option value="paste">' + escapeHtml(tr("I'll paste them", "我自己粘贴")) + '</option>'
      + '          <option value="none">' + escapeHtml(tr("No lyrics", "无歌词")) + '</option>'
      + '        </select>'
      + '      </div>'
      + '    </div>'
      + '    <textarea data-field="audio_lyrics" placeholder="' + escapeHtml(tr("Paste lyrics here…", "在此粘贴歌词…")) + '" hidden></textarea>'
      + '    <div class="status" data-status="audio"></div>'
      + '    <div class="preview" data-preview="audio" hidden></div>'
      + '  </div>'

      + '  <div class="actions">'
      + '    <button type="button" class="ghost" data-act="cancel">' + escapeHtml(tr("Cancel", "取消")) + '</button>'
      + '    <button type="button" class="cta" data-act="submit">' + escapeHtml(tr("Import", "导入")) + '</button>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(modal);
    wireModal(modal);
  }

  function wireModal(modal) {
    var activeTab = "lyrics";
    function setTab(t) {
      activeTab = t;
      modal.querySelectorAll(".tab").forEach(function (b) {
        b.classList.toggle("active", b.dataset.tab === t);
      });
      modal.querySelectorAll(".pane").forEach(function (p) {
        p.hidden = p.dataset.pane !== t;
      });
      modal.querySelectorAll(".status").forEach(function (s) {
        s.textContent = ""; s.className = "status";
      });
      modal.querySelectorAll(".preview").forEach(function (p) { p.hidden = true; });
    }
    modal.querySelectorAll(".tab").forEach(function (b) {
      b.addEventListener("click", function () { setTab(b.dataset.tab); });
    });

    var lyricsChoice = modal.querySelector('[data-field="audio_lyrics_choice"]');
    var lyricsTextarea = modal.querySelector('[data-field="audio_lyrics"]');
    lyricsChoice.addEventListener("change", function () {
      lyricsTextarea.hidden = lyricsChoice.value !== "paste";
    });

    modal.querySelector('[data-act="cancel"]').addEventListener("click", close);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) close();
    });
    modal.querySelector('[data-act="submit"]').addEventListener("click", function () {
      if (activeTab === "lyrics") return submitLyrics(modal);
      return submitAudio(modal);
    });
    function close() {
      modal.hidden = true;
    }
    modal.__close = close;
    modal.__setTab = setTab;
  }

  async function submitLyrics(modal) {
    var statusEl = modal.querySelector('[data-status="lyrics"]');
    var previewEl = modal.querySelector('[data-preview="lyrics"]');
    statusEl.className = "status";
    statusEl.textContent = tr("Parsing…", "正在解析…");
    previewEl.hidden = true;
    var text = modal.querySelector('[data-field="text"]').value.trim();
    var title = modal.querySelector('[data-field="title"]').value.trim();
    var workType = modal.querySelector('[data-field="work_type"]').value;
    if (!text) {
      statusEl.className = "status err";
      statusEl.textContent = tr("Please paste lyrics first.", "请先粘贴歌词。");
      return;
    }
    try {
      var res = await fetch("/api/mv/lyrics/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text, title: title, work_type: workType }),
        credentials: "include",
      });
      var json = await res.json();
      if (!json.ok) {
        statusEl.className = "status err";
        statusEl.textContent = (json.error || "parse_failed");
        return;
      }
      previewEl.hidden = false;
      previewEl.innerHTML = ''
        + '<div class="row">'
        + '<span>' + escapeHtml(tr("Format", "格式")) + ':</span><span>' + escapeHtml(json.format) + '</span>'
        + '<span>' + escapeHtml(tr("Work type", "作品类型")) + ':</span><span>' + escapeHtml(json.work_type) + '</span>'
        + '<span>' + escapeHtml(tr("Duration", "时长")) + ':</span><span>' + (json.duration_secs|0) + 's' + (json.over_limit ? ' ⚠ ' + escapeHtml(tr("exceeds limit", "超过限制")) : '') + '</span>'
        + '<span>' + escapeHtml(tr("Lines", "行数")) + ':</span><span>' + (json.line_count|0) + '</span>'
        + '</div>';
      statusEl.className = "status ok";
      statusEl.textContent = tr("Parsed. Routing to MV pipeline…", "解析完成，导入到 MV 管线…");
      // Hand off to pipeline panel.
      if (typeof globalThis.openMvPipelinePanel === "function") {
        globalThis.openMvPipelinePanel({
          seed: {
            prompt: title || (text.split("\n")[0] || "").slice(0, 80),
            lyrics: json.lyrics,
            __workType: json.work_type,
            __alignedLyrics: json.aligned_lyrics,
            __skipStages: ["lyrics"],
            __importSource: "custom_lyrics",
            __durationSecs: json.duration_secs,
          },
          forceNew: true,
        });
      }
      setTimeout(function () { modal.__close && modal.__close(); }, 600);
    } catch (err) {
      statusEl.className = "status err";
      statusEl.textContent = String(err && err.message || err);
    }
  }

  async function submitAudio(modal) {
    var statusEl = modal.querySelector('[data-status="audio"]');
    var previewEl = modal.querySelector('[data-preview="audio"]');
    statusEl.className = "status";
    previewEl.hidden = true;
    var fileInput = modal.querySelector('[data-field="audio_file"]');
    var title = modal.querySelector('[data-field="audio_title"]').value.trim();
    var workType = modal.querySelector('[data-field="audio_work_type"]').value;
    var lyricsChoice = modal.querySelector('[data-field="audio_lyrics_choice"]').value;
    var pastedLyrics = modal.querySelector('[data-field="audio_lyrics"]').value.trim();
    if (!fileInput.files || !fileInput.files[0]) {
      statusEl.className = "status err";
      statusEl.textContent = tr("Choose an audio file first.", "请先选择音频文件。");
      return;
    }
    var file = fileInput.files[0];
    var HARD_CAP = 100 * 1024 * 1024;
    var SOFT_CAP = 80 * 1024 * 1024;
    if (file.size > HARD_CAP) {
      // CSSOS_WAVE_111B-B2 — client Web Audio pre-transcode for >100MB
      // files. Decode → resample to 48kHz stereo → encode 192kbps via
      // WebCodecs AudioEncoder when available, falling back to raw wav
      // (last-resort — server transcodes anyway). For browsers without
      // WebCodecs (Safari < 18), we hard-reject.
      if (!("AudioEncoder" in window) || !("AudioDecoder" in window)) {
        statusEl.className = "status err";
        statusEl.textContent = tr(
          "File too large (100MB max) and your browser doesn't support client-side transcoding. Try a smaller file or Chrome/Edge.",
          "文件过大（最大 100MB），且浏览器不支持客户端预转码。请换更小文件或用 Chrome/Edge。"
        );
        return;
      }
      statusEl.textContent = tr("File >100MB — transcoding in your browser to save bandwidth…",
                                "文件 > 100MB — 浏览器内预转码以节省带宽…");
      try {
        file = await cssosClientTranscodeAudio(file, { onProgress: function (pct) {
          statusEl.textContent = tr("Pre-transcoding… ", "预转码中… ") + Math.round(pct * 100) + "%";
        }});
        if (file.size > HARD_CAP) {
          statusEl.className = "status err";
          statusEl.textContent = tr("Even after transcoding, file exceeds 100MB. Please trim the audio.",
                                    "即使转码后仍超过 100MB，请先裁剪音频。");
          return;
        }
      } catch (err) {
        statusEl.className = "status err";
        statusEl.textContent = tr("Pre-transcode failed: ", "预转码失败：") + (err && err.message || err);
        return;
      }
    } else if (file.size > SOFT_CAP && ("AudioEncoder" in window) && ("AudioDecoder" in window)) {
      // Opportunistic predecode for 80-100MB to speed upload.
      statusEl.textContent = tr("Optimizing audio for upload…", "正在优化音频…");
      try {
        file = await cssosClientTranscodeAudio(file, { onProgress: function (pct) {
          statusEl.textContent = tr("Optimizing… ", "优化中… ") + Math.round(pct * 100) + "%";
        }});
      } catch (err) {
        // soft-cap path: optimization optional, fall back to original
      }
    }
    statusEl.textContent = tr("Uploading…", "正在上传…");
    var form = new FormData();
    form.append("audio", file);
    form.append("title", title);
    form.append("work_type", workType);
    if (lyricsChoice === "paste" && pastedLyrics) {
      form.append("lyrics", pastedLyrics);
      form.append("skip_transcribe", "1");
    } else if (lyricsChoice === "none") {
      form.append("skip_transcribe", "1");
    }
    try {
      var res = await fetch("/api/mv/audio/upload", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      var json = await res.json();
      if (!json.ok) {
        statusEl.className = "status err";
        statusEl.textContent = (json.error || "upload_failed") + (json.hint ? " — " + json.hint : "");
        return;
      }
      previewEl.hidden = false;
      var m = json.meta || {};
      var fp = json.fingerprint;
      previewEl.innerHTML = ''
        + '<div class="row">'
        + '<span>' + escapeHtml(tr("Duration", "时长")) + ':</span><span>' + (m.duration_secs|0) + 's</span>'
        + '<span>' + escapeHtml(tr("Codec", "编码")) + ':</span><span>' + escapeHtml(m.codec || "?") + ' · ' + (m.bitrate_kbps|0) + 'kbps · ' + (m.sample_rate|0) + 'Hz · ' + (m.channels|0) + 'ch' + '</span>'
        + (m.artist ? '<span>' + escapeHtml(tr("Artist", "艺人")) + ':</span><span>' + escapeHtml(m.artist) + '</span>' : '')
        + '<span>' + escapeHtml(tr("Fingerprint", "指纹")) + ':</span><span>' + (fp && fp.matched ? '⚠ ' + escapeHtml(tr("matched", "命中商业曲库")) + (fp.title ? ' — ' + escapeHtml(fp.title + (fp.artists ? " · " + fp.artists.join(", ") : "")) : '') : escapeHtml(tr("clean / pending", "未匹配 / 待审核"))) + '</span>'
        + '<span>' + escapeHtml(tr("Marketplace", "市场上架")) + ':</span><span>' + (json.requires_clearance ? '🔒 ' + escapeHtml(tr("locked until cleared", "清版前锁定")) : '✅ ' + escapeHtml(tr("eligible", "可上架"))) + '</span>'
        + '<span>' + escapeHtml(tr("Skip stages", "跳过阶段")) + ':</span><span>' + escapeHtml((json.skip_stages || []).join(", ") || "none") + '</span>'
        + '</div>';
      statusEl.className = "status ok";
      statusEl.textContent = tr("Uploaded. Routing to MV pipeline…", "上传完成，导入到 MV 管线…");
      var derivedLyrics = pastedLyrics
        || (json.whisper && json.whisper.text)
        || "";
      if (typeof globalThis.openMvPipelinePanel === "function") {
        globalThis.openMvPipelinePanel({
          seed: {
            prompt: title || (file.name || "").replace(/\.[^.]+$/, ""),
            lyrics: derivedLyrics,
            __workType: workType,
            __audioAssetUrl: json.asset_url,
            __durationSecs: m.duration_secs,
            __skipStages: json.skip_stages,
            __importSource: json.import_source,
            __requiresClearance: json.requires_clearance,
            __fingerprint: fp,
          },
          forceNew: true,
        });
      }
      setTimeout(function () { modal.__close && modal.__close(); }, 1200);
    } catch (err) {
      statusEl.className = "status err";
      statusEl.textContent = String(err && err.message || err);
    }
  }

  function openImportModal(initialTab) {
    injectStyles();
    buildModal();
    var modal = document.getElementById("cssos-import-modal");
    modal.hidden = false;
    if (initialTab && modal.__setTab) modal.__setTab(initialTab);
  }
  globalThis.openCssosImportModal = openImportModal;

  // Inject the trigger button into the MV pipeline panel header
  // (idempotent — runs on DOM ready and on panel-open events).
  function injectTrigger() {
    var hosts = document.querySelectorAll("#mv-pipeline-panel .panel-header, .mv-pipeline-header, .pipeline-actions");
    hosts.forEach(function (host) {
      if (host.querySelector(".cssos-import-trigger")) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cssos-import-trigger";
      btn.textContent = "📥 " + tr("Import", "导入");
      btn.title = tr("Import your own lyrics or audio", "导入自定义歌词或音乐");
      btn.addEventListener("click", function () { openImportModal("lyrics"); });
      host.appendChild(btn);
    });
  }
  // Try multiple times — pipeline panel renders late.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectTrigger);
  } else {
    injectTrigger();
  }
  [500, 1500, 3500].forEach(function (ms) { setTimeout(injectTrigger, ms); });
  document.addEventListener("click", injectTrigger, { capture: true, once: false });
})();
