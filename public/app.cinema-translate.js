/* CSSOS_PERSON_MV_WAVE53 20260508 — Jing
 * Cinema-mode bilingual subtitle translation.
 *
 * Per the locality principle: put the 🌐 control ON the cinema view,
 * not in a centralized settings panel. We install a small floating
 * button + popover into any element with [data-cinema-host] (or
 * fall back to body when cinema goes fullscreen) so the user can
 * 1-click translate the active MV's subtitles to their locale.
 *
 * The translated SRT is emitted as a `cssos:subtitles-translated`
 * CustomEvent with detail={work_id, target_lang, srt}; existing
 * subtitle renderers can subscribe and swap their cue source. We
 * also stash the SRT on window.__cssosSubtitleOverride so older
 * code that polls a global can pick it up. */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__cssosCinemaTranslateInstalled) return;
  window.__cssosCinemaTranslateInstalled = true;

  var LANGS = [
    { code: "", label: "Original" },
    { code: "zh", label: "中文" },
    { code: "en", label: "English" },
    { code: "ja", label: "日本語" },
    { code: "ko", label: "한국어" },
    { code: "es", label: "Español" },
    { code: "fr", label: "Français" },
  ];

  function currentWorkId() {
    var v = window.__cssosCurrentWorkId || window.__currentWorkId || null;
    if (v) return String(v);
    var el = document.querySelector("[data-cinema-host][data-work-id]");
    if (el) return el.getAttribute("data-work-id") || null;
    var meta = document.querySelector('meta[name="cssos-work-id"]');
    if (meta) return meta.getAttribute("content") || null;
    return null;
  }

  function buildButton() {
    var wrap = document.createElement("div");
    wrap.className = "cssos-cinema-translate";
    wrap.style.cssText = [
      "position:fixed","right:18px","bottom:24px","z-index:9999",
      "font-family:inherit","color:#fff","display:none",
    ].join(";");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", "Translate subtitles");
    btn.textContent = "🌐";
    btn.style.cssText = [
      "background:rgba(0,0,0,.55)","color:#fff","border:1px solid rgba(255,255,255,.25)",
      "border-radius:999px","width:42px","height:42px","font-size:20px",
      "cursor:pointer","backdrop-filter:blur(6px)",
    ].join(";");
    var menu = document.createElement("div");
    menu.style.cssText = [
      "position:absolute","right:0","bottom:50px","display:none",
      "background:rgba(15,15,18,.96)","border:1px solid rgba(255,255,255,.15)",
      "border-radius:10px","padding:6px","min-width:160px",
      "box-shadow:0 8px 32px rgba(0,0,0,.5)",
    ].join(";");
    LANGS.forEach(function (l) {
      var item = document.createElement("button");
      item.type = "button";
      item.textContent = l.label;
      item.style.cssText = [
        "display:block","width:100%","text-align:left","background:transparent",
        "color:#eee","border:0","padding:8px 12px","font-size:14px",
        "cursor:pointer","border-radius:6px",
      ].join(";");
      item.addEventListener("mouseenter", function(){ item.style.background="rgba(255,255,255,.08)"; });
      item.addEventListener("mouseleave", function(){ item.style.background="transparent"; });
      item.addEventListener("click", function () {
        menu.style.display = "none";
        if (!l.code) {
          window.__cssosSubtitleOverride = null;
          document.dispatchEvent(new CustomEvent("cssos:subtitles-translated", {
            detail: { target_lang: "", srt: null, work_id: currentWorkId() },
          }));
          return;
        }
        translateTo(l.code, item);
      });
      menu.appendChild(item);
    });
    btn.addEventListener("click", function () {
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", function (ev) {
      if (!wrap.contains(ev.target)) menu.style.display = "none";
    });
    wrap.appendChild(menu);
    wrap.appendChild(btn);
    return wrap;
  }

  function translateTo(targetLang, anchor) {
    var workId = currentWorkId();
    if (!workId) {
      console.warn("[cinema-translate] no active work_id");
      return;
    }
    var origLabel = anchor ? anchor.textContent : "";
    if (anchor) anchor.textContent = origLabel + " ⏳";
    fetch("/api/works/" + encodeURIComponent(workId) + "/translate-subs", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_lang: targetLang }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (anchor) anchor.textContent = origLabel;
        if (!j || !j.ok) {
          console.warn("[cinema-translate] failed", j);
          return;
        }
        window.__cssosSubtitleOverride = { work_id: workId, target_lang: j.target_lang, srt: j.srt };
        document.dispatchEvent(new CustomEvent("cssos:subtitles-translated", {
          detail: { work_id: workId, target_lang: j.target_lang, srt: j.srt, cached: !!j.cached },
        }));
      })
      .catch(function (err) {
        if (anchor) anchor.textContent = origLabel;
        console.warn("[cinema-translate] error", err);
      });
  }

  function showWhenCinema() {
    var el = wrap;
    var inCinema = !!document.querySelector("[data-cinema-host], .cinema-mode, .pmv-cinema-active");
    el.style.display = inCinema ? "block" : "none";
  }

  var wrap = buildButton();
  function mount() {
    if (!document.body) { setTimeout(mount, 50); return; }
    document.body.appendChild(wrap);
    showWhenCinema();
    var mo = new MutationObserver(showWhenCinema);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class","data-cinema-host"] });
    document.addEventListener("cssos:cinema-queue", showWhenCinema);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
