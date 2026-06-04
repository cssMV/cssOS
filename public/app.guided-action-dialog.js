/* CSSOS_WAVE_220A 20260517 — Jing: reusable Guided Action Dialog.
 *
 * Purpose: instead of dumping a red error toast that says "do X manually",
 * show a friendly modal with:
 *   - clear title + body
 *   - PRIMARY action (auto-navigates the user there)
 *   - SECONDARY action (cancel / dismiss)
 *   - visible countdown (default 10s) that auto-fires the primary action
 *     when it reaches zero — so users who don't react are still guided.
 *
 * Cancel pauses the countdown; clicking outside or pressing Escape
 * dismisses. Only one dialog visible at a time (replaces in place).
 *
 * Usage from anywhere in the app:
 *   globalThis.cssmvShowGuidedAction({
 *     title: "Out of balance",
 *     message: "This stage needs up to $0.08. Your balance is $0.00.",
 *     primaryLabel: "Top up now",
 *     primaryFn: () => globalThis.openSubscriptionPanelModule?.(),
 *     secondaryLabel: "Not yet",
 *     countdownSec: 10,            // optional, default 10
 *     icon: "💰",                  // optional
 *   });
 *
 * Returns an object { dismiss(), pause(), resume() } in case the caller
 * needs to control it (rare).
 */
(function () {
  if (globalThis.cssmvShowGuidedAction) return;

  // Singleton handle.
  let active = null;

  function tr(en, _zh) {
    if (typeof globalThis.tr === "function") return globalThis.tr(en);
    if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en);
    return en;
  }

  function ensureStyles() {
    if (document.getElementById("cssmv-guided-action-style")) return;
    const s = document.createElement("style");
    s.id = "cssmv-guided-action-style";
    s.textContent = `
.cssmv-gad-backdrop {
  position: fixed; inset: 0; z-index: 2147483645;
  background: rgba(0,0,0,0.55);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: env(safe-area-inset-top, 16px) 16px env(safe-area-inset-bottom, 16px);
  animation: cssmv-gad-fade 160ms ease-out;
}
@keyframes cssmv-gad-fade { from { opacity: 0; } to { opacity: 1; } }
.cssmv-gad-card {
  background: rgba(20,20,22,0.96);
  color: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0, 245, 160, 0.18);
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  padding: 22px 22px 18px;
  max-width: 460px;
  width: min(94vw, 460px);
  font: 14px/1.45 -apple-system, system-ui, "PingFang SC", "Hiragino Sans", sans-serif;
  animation: cssmv-gad-pop 220ms cubic-bezier(.2,.7,.3,1.2);
}
@keyframes cssmv-gad-pop {
  from { transform: scale(.92); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}
.cssmv-gad-icon {
  font-size: 32px; line-height: 1; margin-bottom: 10px;
}
.cssmv-gad-title {
  font-size: 17px; font-weight: 600; letter-spacing: .2px;
  margin-bottom: 6px;
}
.cssmv-gad-msg {
  color: rgba(255,255,255,0.78);
  margin-bottom: 16px;
  word-wrap: break-word;
}
.cssmv-gad-progress {
  height: 3px; border-radius: 999px; overflow: hidden;
  background: rgba(255,255,255,0.10); margin-bottom: 14px;
}
.cssmv-gad-progress-fill {
  height: 100%; width: 100%;
  background: linear-gradient(90deg, rgba(0,245,160,.85), rgba(0,180,255,.85));
  transform-origin: left center;
  transition: transform 1s linear;
}
.cssmv-gad-actions {
  display: flex; gap: 10px; justify-content: flex-end; align-items: center;
  flex-wrap: wrap;
}
.cssmv-gad-cd {
  flex: 1 1 auto;
  font-size: 12px; color: rgba(255,255,255,0.55);
  letter-spacing: .3px;
}
.cssmv-gad-btn {
  appearance: none; cursor: pointer;
  font: inherit;
  padding: 8px 16px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.18);
  background: transparent; color: #fff;
  transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;
}
.cssmv-gad-btn:hover { background: rgba(255,255,255,0.08); }
.cssmv-gad-btn:active { transform: scale(.97); }
.cssmv-gad-btn.primary {
  background: rgba(0,245,160,0.18);
  border-color: rgba(0,245,160,0.5);
  font-weight: 600;
}
.cssmv-gad-btn.primary:hover { background: rgba(0,245,160,0.28); }
`;
    document.head.appendChild(s);
  }

  function dismissActive() {
    if (!active) return;
    try { active._cleanup(); } catch (_) {}
    try { active.backdrop.remove(); } catch (_) {}
    active = null;
  }

  function show(opts) {
    ensureStyles();
    dismissActive();

    const o = opts || {};
    const title = String(o.title || tr("Heads up", "提示"));
    const message = String(o.message || "");
    const icon = String(o.icon || "💡");
    const primaryLabel = String(o.primaryLabel || tr("Go", "前往"));
    const secondaryLabel = String(o.secondaryLabel || tr("Not now", "稍后"));
    const totalSec = Math.max(2, Math.min(60, Number(o.countdownSec || 10)));
    const primaryFn = typeof o.primaryFn === "function" ? o.primaryFn : function () {};
    const secondaryFn = typeof o.secondaryFn === "function" ? o.secondaryFn : function () {};

    const backdrop = document.createElement("div");
    backdrop.className = "cssmv-gad-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");

    const card = document.createElement("div");
    card.className = "cssmv-gad-card";
    card.innerHTML = `
      <div class="cssmv-gad-icon">${icon}</div>
      <div class="cssmv-gad-title"></div>
      <div class="cssmv-gad-msg"></div>
      <div class="cssmv-gad-progress"><div class="cssmv-gad-progress-fill"></div></div>
      <div class="cssmv-gad-actions">
        <div class="cssmv-gad-cd"></div>
        <button type="button" class="cssmv-gad-btn cssmv-gad-secondary"></button>
        <button type="button" class="cssmv-gad-btn primary cssmv-gad-primary"></button>
      </div>`;
    card.querySelector(".cssmv-gad-title").textContent = title;
    card.querySelector(".cssmv-gad-msg").textContent = message;
    card.querySelector(".cssmv-gad-primary").textContent = primaryLabel;
    card.querySelector(".cssmv-gad-secondary").textContent = secondaryLabel;
    const cdEl = card.querySelector(".cssmv-gad-cd");
    const fillEl = card.querySelector(".cssmv-gad-progress-fill");

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    let remaining = totalSec;
    let paused = false;
    let firedPrimary = false;
    let intervalId = 0;

    function paintCd() {
      cdEl.textContent = paused
        ? tr("Paused — click Go to continue.", "已暂停。")
        : tr(`Auto-continuing in ${remaining}s…`, `${remaining} 秒后自动继续…`)
            .replace("{n}", String(remaining));
      const ratio = Math.max(0, remaining / totalSec);
      fillEl.style.transform = `scaleX(${ratio})`;
    }
    function tick() {
      if (paused) return;
      remaining -= 1;
      paintCd();
      if (remaining <= 0) {
        clearInterval(intervalId);
        firePrimary();
      }
    }
    function firePrimary() {
      if (firedPrimary) return;
      firedPrimary = true;
      try { primaryFn(); } catch (e) { console.warn("[guided-action] primaryFn threw:", e); }
      dismissActive();
    }
    function fireSecondary() {
      try { secondaryFn(); } catch (e) { console.warn("[guided-action] secondaryFn threw:", e); }
      dismissActive();
    }
    function pause() {
      if (paused) return;
      paused = true;
      paintCd();
    }
    function resume() {
      if (!paused) return;
      paused = false;
      paintCd();
    }

    card.querySelector(".cssmv-gad-primary").addEventListener("click", firePrimary);
    card.querySelector(".cssmv-gad-secondary").addEventListener("click", function () {
      // Treat secondary as a "pause" first time (in case user wants to read),
      // dismiss on second click. UX: one tap = stop the auto-nav anxiety;
      // another tap = walk away.
      if (!paused) { pause(); return; }
      fireSecondary();
    });
    // Click outside dismisses (treated as secondary).
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) fireSecondary();
    });
    // Escape key cancels.
    function onKey(e) { if (e.key === "Escape") fireSecondary(); }
    document.addEventListener("keydown", onKey);

    paintCd();
    intervalId = setInterval(tick, 1000);

    active = {
      backdrop,
      _cleanup: function () {
        clearInterval(intervalId);
        document.removeEventListener("keydown", onKey);
      },
      dismiss: dismissActive,
      pause, resume,
    };
    return active;
  }

  globalThis.cssmvShowGuidedAction = show;
  globalThis.cssmvDismissGuidedAction = dismissActive;
})();
