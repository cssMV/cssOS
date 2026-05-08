// CSSOS_PHASE2_SUBSCRIPTION_NOTIFY 20260501 #263 — Jing
// "今天会出现第一个真正的订阅用户. 请在出现时通知我."
//
// Admin-only polling watcher that hits /api/admin/subscription-events/recent
// every 30s and fires a celebratory toast + chime + browser notification
// the moment a new event lands (customer.subscription.created /
// customer.subscription.updated / invoice.paid / checkout.session.completed).
//
// Behaviour:
//   • Only activates when the logged-in user's email matches the admin
//     allowlist (admin@cssstudio.app by default; backend echoes 403
//     otherwise so we silently stop).
//   • Persists the last-seen event ID in localStorage so reloads don't
//     re-celebrate old subscriptions.
//   • De-dupes per session via an in-memory Set.
//   • Plays a short Web Audio chime (no asset dependency) — falls back
//     silently if AudioContext is blocked by autoplay policy.
//   • Requests Notification permission lazily on first detected event,
//     never up-front.
//
// User-controlled opt-out: localStorage['cssos:subWatcher:disabled'] = '1'.

(function initSubscriptionWatcherModule() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (globalThis.__cssosSubscriptionWatcherStarted) return;
  globalThis.__cssosSubscriptionWatcherStarted = true;

  const POLL_INTERVAL_MS = 30 * 1000;
  const STORAGE_LAST_TS = "cssos:subWatcher:lastEventTs";
  const STORAGE_DISABLED = "cssos:subWatcher:disabled";
  const SEEN = new Set();
  let timer = null;
  let stopped = false;
  let consecutive403 = 0;

  function loginCopy(en, zh) {
    try {
      const lang = (globalThis.cssosLanguageState
        ? globalThis.cssosLanguageState()?.activeLanguage
        : "") || "";
      if (String(lang).toLowerCase().startsWith("zh")) return zh || en;
    } catch (_e) {}
    return en;
  }

  function getViewerEmail() {
    try {
      const auth = globalThis.cssosAuthState
        ? globalThis.cssosAuthState()
        : (globalThis.authState || null);
      const email = String(auth?.user?.email || "").trim().toLowerCase();
      return email;
    } catch (_e) { return ""; }
  }

  function isOptedOut() {
    try { return localStorage.getItem(STORAGE_DISABLED) === "1"; }
    catch (_e) { return false; }
  }

  function readLastTs() {
    try { return localStorage.getItem(STORAGE_LAST_TS) || ""; }
    catch (_e) { return ""; }
  }

  function writeLastTs(iso) {
    try { localStorage.setItem(STORAGE_LAST_TS, String(iso || "")); }
    catch (_e) {}
  }

  function playChime() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      // A bright two-note rising chime: A5 → E6 (a perfect-fifth lift).
      const notes = [
        { freq: 880,  start: 0.00, dur: 0.35 },
        { freq: 1318.51, start: 0.18, dur: 0.55 },
      ];
      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = n.freq;
        gain.gain.setValueAtTime(0, now + n.start);
        gain.gain.linearRampToValueAtTime(0.12, now + n.start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur + 0.05);
      });
      // Auto-close the context after the chime to free the audio device.
      setTimeout(() => { try { ctx.close(); } catch (_e) {} }, 1500);
    } catch (_e) { /* chime is best-effort */ }
  }

  function showToast(msg) {
    try {
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(msg, { duration: 9000, kind: "celebrate" });
        return;
      }
    } catch (_e) {}
    try {
      const banner = document.createElement("div");
      banner.textContent = msg;
      banner.style.cssText = [
        "position:fixed", "top:24px", "left:50%", "transform:translateX(-50%)",
        "z-index:2147483647", "padding:14px 22px", "border-radius:12px",
        "background:linear-gradient(135deg,#ff7a59,#ffb648)", "color:#fff",
        "font-weight:600", "font-size:15px", "box-shadow:0 12px 40px rgba(0,0,0,.25)",
        "max-width:90vw", "text-align:center",
      ].join(";");
      document.body.appendChild(banner);
      setTimeout(() => { try { banner.remove(); } catch (_e) {} }, 9000);
    } catch (_e) {}
  }

  function maybeShowBrowserNotification(title, body) {
    try {
      if (!("Notification" in window)) return;
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "/favicon.ico" });
        return;
      }
      if (Notification.permission !== "denied") {
        Notification.requestPermission().then((p) => {
          if (p === "granted") {
            try { new Notification(title, { body, icon: "/favicon.ico" }); } catch (_e) {}
          }
        }).catch(() => {});
      }
    } catch (_e) {}
  }

  function formatAmount(ev) {
    if (ev.amount_cents == null) return "";
    const amount = (Number(ev.amount_cents) / 100).toFixed(2);
    const cur = String(ev.currency || "usd").toUpperCase();
    return `${cur} ${amount}`;
  }

  function celebrate(ev) {
    if (SEEN.has(ev.id)) return;
    SEEN.add(ev.id);
    const who = ev.customer_email || loginCopy("a new subscriber", "新订阅用户");
    const amount = formatAmount(ev);
    const tag = ev.event_type === "customer.subscription.created"
      ? loginCopy("New subscription", "新订阅")
      : ev.event_type === "invoice.paid"
        ? loginCopy("Invoice paid", "账单已支付")
        : ev.event_type === "checkout.session.completed"
          ? loginCopy("Checkout completed", "结账完成")
          : loginCopy("Subscription updated", "订阅更新");
    const title = `🎉 ${tag} — ${who}`;
    const body = amount
      ? loginCopy(`${amount} • ${ev.plan_id || ""}`, `${amount} • ${ev.plan_id || ""}`).trim()
      : (ev.plan_id || "");
    // CSSOS_PHASE2_FIRST_SUB_CELEBRATION 20260501 #265 — Jing
    // "弹出庆祝MV，一个制作精美的MV，而不只是一个简单的toast."
    // For the first paying-subscriber-class events, take over the screen
    // with the cinematic celebration. For lower-stakes events (updates /
    // invoice.paid renewals) keep the lightweight toast so renewal noise
    // doesn't hijack the screen every cycle.
    const isHeadlineEvent =
      ev.event_type === "customer.subscription.created" ||
      ev.event_type === "checkout.session.completed";
    if (isHeadlineEvent && globalThis.cssosFirstSubCelebration?.present) {
      try {
        globalThis.cssosFirstSubCelebration.present(ev);
        // Headline path skips toast/chime — celebration handles its own.
        maybeShowBrowserNotification(title, body || tag);
        try {
          console.log(
            "%c[cssOS] %s %s %s",
            "color:#ff7a59;font-weight:700",
            title, body, ev.created_at || "",
          );
        } catch (_e) {}
        return;
      } catch (_e) {
        // Fall through to the lightweight path on any celebration error.
      }
    }
    showToast(`${title}${body ? "  " + body : ""}`);
    maybeShowBrowserNotification(title, body || tag);
    playChime();
    try {
      console.log(
        "%c[cssOS] %s %s %s",
        "color:#ff7a59;font-weight:700",
        title, body, ev.created_at || "",
      );
    } catch (_e) {}
  }

  async function pollOnce() {
    if (stopped) return;
    if (isOptedOut()) return;
    const email = getViewerEmail();
    if (!email) return; // not logged in yet — try again next tick
    const since = readLastTs() || new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    let resp;
    try {
      resp = await fetch(
        `/api/admin/subscription-events/recent?since=${encodeURIComponent(since)}`,
        { credentials: "same-origin" },
      );
    } catch (_e) { return; }
    if (resp.status === 403) {
      consecutive403 += 1;
      // Not an admin — stop politely after the first 403.
      if (consecutive403 >= 1) {
        stopped = true;
        if (timer) { clearInterval(timer); timer = null; }
      }
      return;
    }
    consecutive403 = 0;
    if (!resp.ok) return;
    let data;
    try { data = await resp.json(); } catch (_e) { return; }
    if (!data || data.ok !== true) return;
    const events = Array.isArray(data.events) ? data.events : [];
    if (!events.length) return;
    // Events come newest-first; iterate oldest-first so toasts arrive in
    // chronological order on the very first batch.
    events.slice().reverse().forEach((ev) => {
      try { celebrate(ev); } catch (_e) {}
    });
    // Advance the cursor so we don't re-fetch the same window forever.
    try {
      const newest = events[0]?.created_at;
      if (newest) writeLastTs(new Date(newest).toISOString());
    } catch (_e) {}
  }

  // CSSOS_SUB_WATCHER_ADMIN_GATE 20260508 — Jing
  // Hit /api/me once; only start polling if user has admin role. Avoids
  // Safari "access control checks" log spam for guests/regular users.
  async function isAdminUser() {
    try {
      const r = await fetch("/api/me", { credentials: "include" });
      if (!r.ok) return false;
      const me = await r.json();
      const role = (me && (me.user?.role || me.role || me.user?.is_admin || me.is_admin));
      return role === "admin" || role === true;
    } catch (_e) { return false; }
  }

  function start() {
    if (timer || stopped) return;
    isAdminUser().then((ok) => {
      if (!ok || stopped) return;
      setTimeout(() => { pollOnce(); }, 2000);
      timer = setInterval(() => { pollOnce(); }, POLL_INTERVAL_MS);
    });
  }

  function stop() {
    stopped = true;
    if (timer) { clearInterval(timer); timer = null; }
  }

  // Public escape hatch for debugging from the console.
  globalThis.cssosSubscriptionWatcher = {
    pollOnce,
    start,
    stop,
    forceCelebrate(ev) {
      celebrate(Object.assign(
        { id: "manual-" + Date.now(), event_type: "customer.subscription.created",
          created_at: new Date().toISOString() },
        ev || {},
      ));
    },
    setOptOut(flag) {
      try {
        if (flag) localStorage.setItem(STORAGE_DISABLED, "1");
        else localStorage.removeItem(STORAGE_DISABLED);
      } catch (_e) {}
    },
  };

  // Wait for either DOMContentLoaded or visibility — page may have been
  // pre-rendered.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
