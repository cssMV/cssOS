/* CSSOS_PERSON_MV_WAVE76 + WAVE77 20260508 — Jing
 * Premium subscription modal ($9.99/mo) at #premium hash route, plus
 * the "💌 Refer & earn" affiliate panel. Both render dual-themed
 * (forest-green light override) and i18n-aware (en/zh).
 *
 * Capture & track behavior:
 *   On every page load, if URL has `?ref=<u>`, we POST the value to
 *   /api/referral/track which sets a `cssos_ref` HTTP cookie. The
 *   server-side OAuth callback reads that cookie at first signup and
 *   awards the inviter via applyPendingReferral. */
(function () {
  "use strict";
  if (window.__cssosPremiumMounted) return;
  window.__cssosPremiumMounted = true;

  const ZH = /^zh/i.test(String(globalThis.currentLocale || navigator.language || "en"));
  const T = (en, zh) => (ZH ? zh : en);

  // ── Capture ?ref= and persist to server cookie ───────────────────
  try {
    const u = new URL(window.location.href);
    const ref = (u.searchParams.get("ref") || "").trim();
    if (ref && /^[A-Za-z0-9_\-]{2,40}$/.test(ref)) {
      fetch("/api/referral/track", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ref: ref.toLowerCase() }),
      }).catch(() => {});
    }
  } catch (_e) { /* ignore */ }

  function injectStyles() {
    if (document.getElementById("cssos-premium-style")) return;
    const s = document.createElement("style");
    s.id = "cssos-premium-style";
    s.textContent = `
      .cssos-premium-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.62);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999;
      }
      .cssos-premium-card {
        background: #1a1d24; color: #f4f4f6; border-radius: 16px;
        max-width: 480px; width: calc(100% - 32px); padding: 28px;
        box-shadow: 0 24px 80px rgba(0,0,0,0.55);
        border: 1px solid rgba(255,255,255,0.08);
      }
      .cssos-premium-h {
        font-size: 22px; font-weight: 700; margin: 0 0 4px;
        display: flex; align-items: center; gap: 8px;
      }
      .cssos-premium-price {
        font-size: 36px; font-weight: 800; margin: 12px 0 4px;
        color: #fbbf24;
      }
      .cssos-premium-sub { font-size: 13px; opacity: 0.72; margin-bottom: 16px; }
      .cssos-premium-features {
        list-style: none; padding: 0; margin: 14px 0 18px;
        font-size: 14px; line-height: 1.8;
      }
      .cssos-premium-features li::before { content: "✓ "; color: #22c55e; font-weight: 700; }
      .cssos-premium-cta {
        background: #fbbf24; color: #1a1d24; border: 0;
        padding: 12px 18px; border-radius: 10px; cursor: pointer;
        font-weight: 700; font-size: 15px; width: 100%;
      }
      .cssos-premium-cta:hover { filter: brightness(1.08); }
      .cssos-premium-secondary {
        background: transparent; color: #f4f4f6;
        border: 1px solid rgba(255,255,255,0.18);
        padding: 10px 16px; border-radius: 10px; cursor: pointer;
        font-size: 14px; margin-top: 8px; width: 100%;
      }
      .cssos-premium-close {
        background: transparent; color: #f4f4f6; border: 0;
        font-size: 22px; cursor: pointer; opacity: 0.6; line-height: 1;
      }
      .cssos-premium-close:hover { opacity: 1; }
      .cssos-premium-row { display: flex; justify-content: space-between; align-items: flex-start; }
      .cssos-premium-badge {
        display: inline-flex; align-items: center; justify-content: center;
        width: 18px; height: 18px; border-radius: 50%;
        background: #fbbf24; color: #1a1d24; font-size: 12px; font-weight: 800;
        margin-left: 4px; vertical-align: -3px;
      }
      .cssos-affiliate-section {
        margin: 16px 0; padding: 14px; background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
      }
      .cssos-affiliate-toggle {
        background: transparent; color: inherit; border: 0; cursor: pointer;
        font-weight: 700; font-size: 15px; padding: 0;
      }
      .cssos-affiliate-link {
        background: rgba(0,0,0,0.30); padding: 8px 10px; border-radius: 6px;
        font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px;
        word-break: break-all; margin: 8px 0;
      }
      .cssos-affiliate-stats {
        display: flex; gap: 12px; flex-wrap: wrap; font-size: 13px; opacity: 0.85;
      }
      /* DUAL THEME — light override (forest-green palette) */
      html[data-theme="light"] .cssos-premium-card {
        background: #f6fbf7; color: #0f3a2a;
        border: 1px solid rgba(0,0,0,0.10);
        box-shadow: 0 24px 80px rgba(0,80,40,0.18);
      }
      html[data-theme="light"] .cssos-premium-price { color: #b58100; }
      html[data-theme="light"] .cssos-premium-cta {
        background: #b58100; color: #fff;
      }
      html[data-theme="light"] .cssos-premium-secondary {
        color: #0f3a2a; border-color: rgba(0,0,0,0.18);
      }
      html[data-theme="light"] .cssos-premium-close { color: #0f3a2a; }
      html[data-theme="light"] .cssos-premium-badge {
        background: #b58100; color: #fff;
      }
      html[data-theme="light"] .cssos-affiliate-section {
        background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.10);
      }
      html[data-theme="light"] .cssos-affiliate-link {
        background: rgba(0,0,0,0.06);
      }
    `;
    document.head.appendChild(s);
  }

  async function api(path, opts) {
    try {
      const r = await fetch(path, Object.assign({ credentials: "include" }, opts || {}));
      return await r.json().catch(() => null);
    } catch { return null; }
  }

  function closeModal() {
    const ov = document.getElementById("cssos-premium-overlay");
    if (ov) ov.remove();
    if (window.location.hash === "#premium") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  async function openPremiumModal() {
    injectStyles();
    closeModal();
    const status = await api("/api/premium/status");
    const isPremium = !!(status && status.ok && status.data && status.data.is_premium);
    const until = status?.data?.premium_until || null;

    const ov = document.createElement("div");
    ov.id = "cssos-premium-overlay";
    ov.className = "cssos-premium-overlay";
    ov.innerHTML = `
      <div class="cssos-premium-card" role="dialog" aria-modal="true">
        <div class="cssos-premium-row">
          <h2 class="cssos-premium-h">${T("Premium", "高级会员")} <span class="cssos-premium-badge" title="${T("Premium","高级会员")}">★</span></h2>
          <button class="cssos-premium-close" aria-label="close">×</button>
        </div>
        <div class="cssos-premium-price">$9.99<span style="font-size:14px;opacity:0.7;font-weight:500">/${T("mo","月")}</span></div>
        <div class="cssos-premium-sub">${T("Cancel anytime. Auto-renews monthly.", "随时可取消，按月自动续订。")}</div>
        <ul class="cssos-premium-features">
          <li>${T("4K rendering — free upscale", "4K 渲染 — 免费升级画质")}</li>
          <li>${T("No watermark on embeds", "嵌入分享无水印")}</li>
          <li>${T("Premium style packs", "高级风格包")}</li>
          <li>${T("Unlimited DMs (no daily cap)", "无限私信（无每日上限）")}</li>
          <li>${T("Priority engine queue", "引擎队列优先")}</li>
        </ul>
        ${isPremium
          ? `<div style="margin:8px 0 12px;font-size:13px;opacity:0.85">${T("You are premium until","您的高级会员有效期至")}: <b>${until ? new Date(until).toLocaleDateString() : "—"}</b></div>
             <button class="cssos-premium-secondary" id="cssos-premium-cancel">${T("Cancel subscription", "取消订阅")}</button>`
          : `<button class="cssos-premium-cta" id="cssos-premium-subscribe">${T("Subscribe — $9.99/mo", "订阅 — $9.99/月")}</button>`}
        <button class="cssos-premium-secondary" id="cssos-premium-dismiss">${T("Close", "关闭")}</button>
      </div>
    `;
    document.body.appendChild(ov);
    ov.querySelector(".cssos-premium-close")?.addEventListener("click", closeModal);
    ov.querySelector("#cssos-premium-dismiss")?.addEventListener("click", closeModal);
    ov.addEventListener("click", (e) => { if (e.target === ov) closeModal(); });
    const subBtn = ov.querySelector("#cssos-premium-subscribe");
    if (subBtn) {
      subBtn.addEventListener("click", async () => {
        subBtn.disabled = true;
        subBtn.textContent = T("Redirecting…", "跳转中…");
        const r = await api("/api/premium/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        const url = r?.data?.checkout_url;
        if (url) window.location.href = url;
        else { subBtn.disabled = false; subBtn.textContent = T("Subscribe — $9.99/mo", "订阅 — $9.99/月"); alert(T("Subscribe failed.", "订阅失败。")); }
      });
    }
    const cancelBtn = ov.querySelector("#cssos-premium-cancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", async () => {
        if (!confirm(T("Cancel premium at the end of the current period?", "在当前周期结束时取消高级会员？"))) return;
        cancelBtn.disabled = true;
        const r = await api("/api/premium/cancel", { method: "POST" });
        if (r && r.ok !== false && (r.ok || r.data)) {
          alert(T("Cancellation scheduled.", "已安排取消。"));
          closeModal();
        } else {
          cancelBtn.disabled = false;
          alert(T("Cancel failed.", "取消失败。"));
        }
      });
    }
  }

  function maybeOpenForHash() {
    if (window.location.hash === "#premium") openPremiumModal();
  }
  window.addEventListener("hashchange", maybeOpenForHash);
  document.addEventListener("DOMContentLoaded", maybeOpenForHash);
  if (document.readyState !== "loading") maybeOpenForHash();

  // Public helper for buttons / topbar links elsewhere.
  window.cssosOpenPremium = openPremiumModal;

  /* ── Wave 77: 💌 Refer & earn collapsible UI helper ───────────── */
  async function renderAffiliateInto(host) {
    if (!host) return;
    injectStyles();
    const r = await api("/api/user/referrals");
    if (!r || !r.ok || !r.data) return;
    const d = r.data;
    const link = d.invite_url || "";
    const wrap = document.createElement("div");
    wrap.className = "cssos-affiliate-section";
    wrap.innerHTML = `
      <button class="cssos-affiliate-toggle" type="button" aria-expanded="false">
        💌 ${T("Refer & earn", "邀请赚积分")} <span style="opacity:0.6">▾</span>
      </button>
      <div class="cssos-affiliate-body" style="display:none;margin-top:10px">
        <div style="font-size:13px;opacity:0.85;line-height:1.6">
          ${T("Share your invite link. When a friend signs up you earn 50 credits, plus 10% of their spend for 30 days (max 100 referrals).",
              "分享邀请链接。好友注册后，你获得 50 积分，并在 30 天内获得他们消费的 10% 佣金（最多 100 位推荐）。")}
        </div>
        <div class="cssos-affiliate-link" id="cssos-aff-link">${link || "—"}</div>
        <button class="cssos-premium-secondary" id="cssos-aff-copy" style="width:auto;margin-top:0">${T("Copy link", "复制链接")}</button>
        <div class="cssos-affiliate-stats" style="margin-top:10px">
          <span><b>${d.total_referrals || 0}</b> ${T("referrals", "推荐人数")}</span>
          <span><b>${d.total_earned_credits || 0}</b> ${T("credits earned", "已赚积分")}</span>
          <span style="opacity:0.7">${T("Cap","上限")}: ${d.cap || 100}</span>
        </div>
      </div>
    `;
    host.appendChild(wrap);
    const toggle = wrap.querySelector(".cssos-affiliate-toggle");
    const body = wrap.querySelector(".cssos-affiliate-body");
    toggle?.addEventListener("click", () => {
      const open = body.style.display !== "none";
      body.style.display = open ? "none" : "block";
      toggle.setAttribute("aria-expanded", String(!open));
    });
    wrap.querySelector("#cssos-aff-copy")?.addEventListener("click", () => {
      if (!link) return;
      try { navigator.clipboard?.writeText(link); } catch { /* ignore */ }
      const btn = wrap.querySelector("#cssos-aff-copy");
      const old = btn.textContent;
      btn.textContent = T("Copied!", "已复制！");
      setTimeout(() => { btn.textContent = old; }, 1400);
    });
  }
  window.cssosRenderAffiliate = renderAffiliateInto;

  // Auto-mount affiliate section onto the user homepage hero if present.
  function tryAutoMount() {
    const host = document.querySelector("[data-cssos-affiliate-host], .cssos-user-home-hero");
    if (host && !host.__cssosAffMounted) {
      host.__cssosAffMounted = true;
      renderAffiliateInto(host).catch(() => {});
    }
  }
  document.addEventListener("DOMContentLoaded", tryAutoMount);
  setTimeout(tryAutoMount, 1500);
})();
