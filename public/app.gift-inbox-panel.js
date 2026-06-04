// CSSOS_PHASE2_PERSONALIZATION_INBOX 20260502 #271 - Jing
//
// "My Gifts" panel — lives inside the Profile panel and lists every
// system gift MV the cssOS Curator has delivered to this user.
// Calls GET /api/personalization/inbox; renders empty / loading /
// error / list states. Clicking an item routes into the existing
// watch panel via the same code path the rest of the app uses for
// "play this work_id".
//
// This file is JS today but is written in TS-flavored JSDoc so the
// future migration to a real /public/ TypeScript build pipeline is
// a one-shot rename. Every public function has a @typedef, every
// fetch payload has a @typedef, no `any` / no implicit globals.

(function initGiftInboxPanelModule() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (globalThis.__cssosGiftInboxPanelStarted) return;
  globalThis.__cssosGiftInboxPanelStarted = true;

  const STYLE_ID = "cssos-gift-inbox-style";
  const MOUNT_ID = "gift-inbox-mount";
  const REFRESH_DEBOUNCE_MS = 30 * 1000;

  /**
   * @typedef {Object} GiftInboxItem
   * @property {string} audit_id
   * @property {string} trigger_event
   * @property {string|null} work_id
   * @property {string|null} template_id
   * @property {string|null} dispatched_at
   * @property {string|null} delivered_at
   * @property {string|null} viewed_at
   * @property {number} cost_cents
   * @property {string|null} title
   * @property {string|null} style
   * @property {string|null} cover_image
   * @property {string|null} preview_image_url
   * @property {string|null} preview_video_url
   * @property {string|null} lyrics_preview
   * @property {string|null} recipient_display_name
   */

  let lastFetchAt = 0;
  /** @type {GiftInboxItem[] | null} */
  let cached = null;

  function loginCopy(en, zh) {
    try {
      const lang =
        (globalThis.cssosLanguageState
          ? globalThis.cssosLanguageState()?.activeLanguage
          : "") || "";
      if (String(lang).toLowerCase().startsWith("zh")) return zh || en;
    } catch (_e) {}
    return en;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
.gift-inbox-mount {
  margin-top: 24px;
}
/* CSSOS_PHASE2_GIFT_INBOX_THEME 20260503 — Jing
   The gift inbox is mounted inside the Profile panel, which uses a
   LIGHT (cream) surface in production. The original styling assumed
   a dark theme and white-on-cream text was invisible. Force a dark
   translucent card with light text so the panel reads correctly
   regardless of the parent's surface color. */
/* CSSOS_WAVE_164 20260515 — Jing: "请换一种清爽的色调，请带上封面图".
   Swapped the muddy dark-purple card for a clean cream + amber palette
   that matches the 🎁 gift badge (Wave 135). When the work has no
   cover image, fall back to a soft amber gradient with a centered 🎁
   emoji instead of an empty dark square. */
.gift-inbox-card {
  border: 1px solid rgba(220, 170, 70, 0.32);
  border-radius: 16px;
  background: linear-gradient(180deg, #fffaf0 0%, #fff5e0 100%);
  color: #3a2a10;
  overflow: hidden;
  box-shadow: 0 6px 24px rgba(180, 130, 40, 0.12);
}
.gift-inbox-header {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(180, 130, 40, 0.14);
}
.gift-inbox-header > h3 {
  margin: 0;
  font-size: 14px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 600;
  color: #6a4a10;
}
.gift-inbox-header > .gift-inbox-meta {
  font-size: 12px; opacity: 0.75;
  color: #8a6a20;
}
.gift-inbox-list {
  display: flex; flex-direction: column;
}
.gift-inbox-row {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 18px;
  cursor: pointer;
  transition: background 0.15s ease;
  border-top: 1px solid rgba(180, 130, 40, 0.10);
  color: #3a2a10;
}
.gift-inbox-row:first-child { border-top: 0; }
.gift-inbox-row:hover { background: rgba(255, 200, 90, 0.14); }
.gift-inbox-cover {
  width: 56px; height: 56px; border-radius: 10px; flex: none;
  background: linear-gradient(135deg, #ffd28d 0%, #ffb060 100%) center/cover no-repeat;
  position: relative;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; line-height: 1;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.35);
}
.gift-inbox-cover.has-image { background-color: #fff5e0; }
.gift-inbox-cover.has-image .gift-inbox-cover-emoji { display: none; }
.gift-inbox-cover::after {
  /* Tiny dot in the corner when the gift hasn't been viewed yet. */
  content: ""; position: absolute; top: -3px; right: -3px;
  width: 10px; height: 10px; border-radius: 50%;
  background: #ff8c42; box-shadow: 0 0 8px rgba(255, 140, 66, 0.7);
  border: 2px solid #fffaf0;
}
.gift-inbox-row.is-viewed .gift-inbox-cover::after { display: none; }
.gift-inbox-body {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 2px;
}
.gift-inbox-title {
  font-size: 14px; font-weight: 600;
  color: #3a2a10;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gift-inbox-meta-line {
  font-size: 11px; opacity: 0.75;
  display: flex; gap: 8px;
  color: #6a4a10;
}
.gift-inbox-trigger-pill {
  display: inline-block;
  padding: 1px 8px; border-radius: 999px;
  font-size: 10px; letter-spacing: 0.04em;
  background: rgba(255, 160, 60, 0.22);
  color: #a55a00;
}
.gift-inbox-empty,
.gift-inbox-loading,
.gift-inbox-error {
  padding: 24px 18px; text-align: center; font-size: 13px;
  opacity: 0.78;
}
.gift-inbox-empty .gift-inbox-empty-icon {
  font-size: 32px; margin-bottom: 8px;
}
`;
    document.head.appendChild(style);
  }

  /** @returns {HTMLElement | null} */
  function getMount() {
    return document.getElementById(MOUNT_ID);
  }

  function isLoggedIn() {
    try {
      const auth = globalThis.cssosAuthState
        ? globalThis.cssosAuthState()
        : globalThis.authState;
      return Boolean(auth?.user?.id);
    } catch (_e) {
      return false;
    }
  }

  function formatTriggerLabel(triggerEvent) {
    const map = {
      welcome: loginCopy("Welcome", "欢迎"),
      welcome_back: loginCopy("Welcome back", "回来了"),
      first_subscriber: loginCopy("First subscriber", "首位订阅"),
      milestone_100: loginCopy("100th subscriber", "第 100 位"),
      milestone_1000: loginCopy("1,000th subscriber", "第 1,000 位"),
      milestone_10000: loginCopy("10,000th subscriber", "第 10,000 位"),
      milestone_100000: loginCopy("100,000th subscriber", "第 100,000 位"),
      plan_upgrade: loginCopy("Plan upgrade", "升级"),
      plan_downgrade: loginCopy("Plan change", "降级"),
      account_deletion: loginCopy("Farewell", "告别"),
      birthday: loginCopy("Birthday", "生日"),
      anniversary_marriage: loginCopy("Anniversary", "纪念日"),
      anniversary_other: loginCopy("Anniversary", "纪念日"),
      feedback_adopted: loginCopy("Feedback adopted", "反馈被采纳"),
      streak_30day: loginCopy("30-day streak", "30 天创作"),
      streak_100day: loginCopy("100-day streak", "100 天创作"),
      referral_success: loginCopy("Referral", "推荐"),
    };
    return map[triggerEvent] || triggerEvent;
  }

  function formatRelativeDate(iso) {
    if (!iso) return "";
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return "";
    const days = Math.floor(ms / 86400000);
    if (days === 0) return loginCopy("today", "今天");
    if (days === 1) return loginCopy("yesterday", "昨天");
    if (days < 30) return loginCopy(`${days} days ago`, `${days} 天前`);
    if (days < 365) {
      const months = Math.floor(days / 30);
      return loginCopy(`${months}mo ago`, `${months} 个月前`);
    }
    const years = Math.floor(days / 365);
    return loginCopy(`${years}y ago`, `${years} 年前`);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderEmpty(mount) {
    mount.innerHTML = `
      <div class="gift-inbox-card">
        <div class="gift-inbox-header">
          <h3>${escapeHtml(loginCopy("My Gifts", "我的礼物"))}</h3>
          <span class="gift-inbox-meta">${escapeHtml(loginCopy("from cssOS · Curator", "来自 cssOS · 策展人"))}</span>
        </div>
        <div class="gift-inbox-empty">
          <div class="gift-inbox-empty-icon">🎁</div>
          <div>${escapeHtml(loginCopy(
            "No gifts yet — your first MV is on its way.",
            "暂无礼物 — 你的第一首 MV 正在路上。",
          ))}</div>
        </div>
      </div>
    `;
  }

  function renderLoading(mount) {
    mount.innerHTML = `
      <div class="gift-inbox-card">
        <div class="gift-inbox-header">
          <h3>${escapeHtml(loginCopy("My Gifts", "我的礼物"))}</h3>
          <span class="gift-inbox-meta">${escapeHtml(loginCopy("loading…", "加载中…"))}</span>
        </div>
        <div class="gift-inbox-loading">${escapeHtml(loginCopy("Fetching your gifts…", "正在获取你的礼物…"))}</div>
      </div>
    `;
  }

  function renderError(mount, msg) {
    mount.innerHTML = `
      <div class="gift-inbox-card">
        <div class="gift-inbox-header">
          <h3>${escapeHtml(loginCopy("My Gifts", "我的礼物"))}</h3>
        </div>
        <div class="gift-inbox-error">${escapeHtml(msg)}</div>
      </div>
    `;
  }

  /** @param {HTMLElement} mount @param {GiftInboxItem[]} items */
  function renderList(mount, items) {
    if (!items.length) { renderEmpty(mount); return; }
    // CSSOS_WAVE_164 — only count as "new" if unviewed AND delivered
    // within the last 7 days. An 11-day-old welcome MV shouldn't keep
    // shouting "1 new" forever.
    const FRESH_MS = 7 * 86400000;
    const now = Date.now();
    const isFresh = (g) => {
      if (g.viewed_at) return false;
      const t = new Date(g.delivered_at || g.dispatched_at || 0).getTime();
      return Number.isFinite(t) && t > 0 && (now - t) < FRESH_MS;
    };
    const unviewed = items.filter(isFresh).length;
    const total = items.length;
    const headerMeta = unviewed > 0
      ? loginCopy(`${unviewed} new`, `${unviewed} 份未看`)
      : loginCopy(`${total} ${total === 1 ? "gift" : "gifts"}`, `${total} 份礼物`);
    const rowsHtml = items
      .map((g) => {
        const cover = g.cover_image || g.preview_image_url || "";
        const hasImg = !!cover;
        const coverStyle = hasImg
          ? `background-image: url("${escapeHtml(cover)}");`
          : "";
        const showDot = isFresh(g);
        return `
          <div class="gift-inbox-row${showDot ? "" : " is-viewed"}"
               data-gift-audit-id="${escapeHtml(g.audit_id)}"
               data-gift-work-id="${escapeHtml(g.work_id || "")}">
            <div class="gift-inbox-cover${hasImg ? " has-image" : ""}" style="${coverStyle}"><span class="gift-inbox-cover-emoji">🎁</span></div>
            <div class="gift-inbox-body">
              <div class="gift-inbox-title">${escapeHtml(g.title || loginCopy("Untitled gift", "无题礼物"))}</div>
              <div class="gift-inbox-meta-line">
                <span class="gift-inbox-trigger-pill">${escapeHtml(formatTriggerLabel(g.trigger_event))}</span>
                <span>${escapeHtml(formatRelativeDate(g.delivered_at || g.dispatched_at))}</span>
              </div>
            </div>
          </div>`;
      })
      .join("");
    mount.innerHTML = `
      <div class="gift-inbox-card">
        <div class="gift-inbox-header">
          <h3>${escapeHtml(loginCopy("My Gifts", "我的礼物"))}</h3>
          <span class="gift-inbox-meta">${escapeHtml(headerMeta)}</span>
        </div>
        <div class="gift-inbox-list">${rowsHtml}</div>
      </div>
    `;
    mount.querySelectorAll(".gift-inbox-row").forEach((row) => {
      row.addEventListener("click", (ev) => {
        ev.preventDefault();
        const auditId = row.getAttribute("data-gift-audit-id");
        const workId = row.getAttribute("data-gift-work-id");
        if (!auditId || !workId) return;
        const giftItem = (cached || []).find((g) => g.audit_id === auditId);
        openGift(auditId, workId, giftItem || null);
      });
    });
  }

  /**
   * Open a gift: navigate to the watch panel for the work_id, AND
   * mark the gift viewed server-side. Both happen optimistically;
   * the watch-panel open path doesn't wait on the viewed POST.
   *
   * CSSOS_PHASE2_GIFT_OPEN 20260503 — Jing
   * The inbox already has title / cover / preview_video_url for the
   * gift; pass them in alongside the id so openMarketWorkPreview has
   * a hydrated work object instead of just `{id}`. System-owned gift
   * works don't sit in the public market index, so the id-only path
   * was leaving the watch frame blank.
   */
  function openGift(auditId, workId, giftItem) {
    // Optimistic local state — strike out the unviewed dot immediately.
    if (cached) {
      const item = cached.find((g) => g.audit_id === auditId);
      if (item && !item.viewed_at) item.viewed_at = new Date().toISOString();
      const mount = getMount();
      if (mount) renderList(mount, cached);
    }
    // Background mark-as-viewed.
    fetch(`/api/personalization/inbox/${encodeURIComponent(auditId)}/viewed`, {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => { /* best-effort */ });

    // Hydrate a work object from the inbox row — at minimum we have
    // title, cover, audio/video URL pointing at the template assets.
    const item = giftItem || (cached || []).find((g) => g.audit_id === auditId) || {};
    const hydratedWork = {
      id: workId,
      __source: "gift",
      title: item.title || "",
      cover_image: item.cover_image || item.preview_image_url || null,
      cover_image_url: item.cover_image || item.preview_image_url || null,
      preview_image_url: item.preview_image_url || item.cover_image || null,
      preview_video_url: item.preview_video_url || null,
      final_mv_url: item.preview_video_url || null,
      lyrics_preview: item.lyrics_preview || "",
      lyrics_full: item.lyrics_preview || "",
      style: item.style || "",
      work_type: "single",
      structure_role: "gift",
    };
    // CSSOS_WAVE_136 20260515 — Jing: "收件箱里的欢迎MV无法打开,或者
    // 极难打开". Root cause: the old path handed openMarketWorkPreview a
    // `hydratedWork` built from the INBOX ROW's cached fields. But after
    // Wave 132 the gift is upgraded in the background — the real music /
    // lyrics / slideshow land in work_assets + user_works, while the
    // inbox row still carries the stale placeholder URLs (often empty).
    // Result: blank watch frame → "can't open" / flaky.
    //
    // Fix: route through cssosOpenWorkById (Wave 121/126) — it fetches
    // /api/works/public/:id for the CANONICAL data, binds the work-id
    // contract (flushes stale caches), then opens. The hydratedWork is
    // passed only as a last-resort fallback if the fetch fails.
    // CSSOS_WAVE_164 — await cssosOpenWorkById so that if the
    // canonical fetch rejects (gift works aren't always in the public
    // market index), we can fall through to the hydrated-work path
    // instead of silently failing.
    (async () => {
      try {
        if (typeof globalThis.cssosOpenWorkById === "function") {
          const ok = await globalThis.cssosOpenWorkById(workId, hydratedWork);
          if (ok !== false) return;
        }
      } catch (_e) { /* fall through */ }
      try {
        if (typeof globalThis.cssosBindToWorkId === "function") {
          globalThis.cssosBindToWorkId(hydratedWork);
        }
        if (typeof globalThis.openMarketWorkPreview === "function") {
          globalThis.openMarketWorkPreview(hydratedWork);
          return;
        }
      } catch (_e) {}
      // Last-resort: open the watch panel directly with hydrated URLs.
      try {
        const watchVideo = document.getElementById("watch-video");
        const watchPanel = document.getElementById("watch-panel");
        if (watchVideo && hydratedWork.preview_video_url) {
          watchVideo.src = hydratedWork.preview_video_url;
          watchVideo.load?.();
          watchVideo.play?.().catch(() => {});
        }
        if (watchPanel) {
          watchPanel.classList.remove("hidden");
          watchPanel.dataset.minimized = "false";
        }
      } catch (_e) {}
    })();
  }

  async function fetchInbox() {
    const resp = await fetch("/api/personalization/inbox?limit=50", {
      credentials: "same-origin",
    });
    if (resp.status === 401) return null;
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data || data.ok !== true) throw new Error("malformed response");
    return Array.isArray(data.items) ? data.items : [];
  }

  async function refreshInbox(force = false) {
    const mount = getMount();
    if (!mount) return;
    if (!isLoggedIn()) {
      mount.innerHTML = "";
      return;
    }
    const now = Date.now();
    if (!force && cached && now - lastFetchAt < REFRESH_DEBOUNCE_MS) {
      renderList(mount, cached);
      return;
    }
    if (!cached) renderLoading(mount);
    try {
      const items = await fetchInbox();
      lastFetchAt = Date.now();
      if (items === null) {
        // Not logged in by the time the response landed.
        mount.innerHTML = "";
        return;
      }
      cached = items;
      renderList(mount, items);
    } catch (err) {
      console.warn("[gift-inbox] fetch failed:", err);
      renderError(
        mount,
        loginCopy(
          "Couldn't load your gifts right now.",
          "暂时无法加载你的礼物。",
        ),
      );
    }
  }

  function init() {
    ensureStyles();
    refreshInbox();
    // Re-render whenever the profile panel opens (cheap — uses
    // the in-memory cache unless 30s have passed).
    const profilePanel = document.getElementById("profile-panel");
    if (profilePanel) {
      const observer = new MutationObserver(() => {
        if (!profilePanel.classList.contains("hidden")) {
          refreshInbox();
        }
      });
      observer.observe(profilePanel, { attributes: true, attributeFilter: ["class"] });
    }
    // Public hooks for other modules / dev console.
    globalThis.cssosGiftInbox = {
      refresh: () => refreshInbox(true),
      get items() { return cached ? cached.slice() : []; },
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
