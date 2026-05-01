function buildCreditScoreBandModule(score = 700) {
  const safeScore = Number(score || 0);
  if (safeScore >= 780) {
    return {
      label: loginCopy("Radiant"),
      summary: loginCopy("High trust and smooth access.")
    };
  }
  if (safeScore >= 700) {
    return {
      label: loginCopy("Stable"),
      summary: loginCopy("Normal trust posture.")
    };
  }
  if (safeScore >= 620) {
    return {
      label: loginCopy("Guarded"),
      summary: loginCopy("Some limits may tighten.")
    };
  }
  return {
    label: loginCopy("Fragile"),
    summary: loginCopy("Review and restriction risk is higher.")
  };
}

async function loadCreditPanelSnapshotModule() {
  if (!authState.user?.id) {
    return {
      ok: true,
      authenticated: false,
      trust: null
    };
  }
  try {
    const response = await fetch(`${apiBase()}/cssapi/v1/trust/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ user_id: String(authState.user.id || "").trim() })
    });
    const payload = await response.json().catch(() => null);
    const trust = payload?.data?.data || payload?.data || null;
    if (!response.ok || !trust) {
      throw new Error(payload?.message || `credit_panel_load_failed:${response.status}`);
    }
    return {
      ok: true,
      authenticated: true,
      trust
    };
  } catch (_error) {
    return {
      ok: false,
      authenticated: true,
      trust: null
    };
  }
}

function buildCreditPenaltyMarkupModule(penalties = []) {
  const rows = Array.isArray(penalties) ? penalties : [];
  if (!rows.length) {
    return `<div class="works-note">${escapeHtml(loginCopy("No active penalties."))}</div>`;
  }
  return rows.map((penalty) => `
    <article class="work-card">
      <div class="work-cover">!</div>
      <div class="work-info">
        <div class="work-title">${escapeHtml(String(penalty?.kind || loginCopy("Penalty")))}</div>
        <div class="works-note">${escapeHtml(String(penalty?.reason || loginCopy("No reason provided.")))}</div>
        <div class="work-tags">${escapeHtml(String(penalty?.ends_at || loginCopy("No expiry")))}</div>
      </div>
    </article>
  `).join("");
}

function buildCreditPanelMarkupModule(snapshot) {
  if (!snapshot?.authenticated) {
    return `
      <div class="works-section">
        <div class="section-title">${escapeHtml(loginCopy("Credit Panel"))}</div>
        <div class="comment-card">
          <div class="comment-text">${escapeHtml(loginCopy(
            "Sign in to see your user credit score, trust band, and governance posture."
          ))}</div>
          <div class="work-actions" style="margin-top:12px;">
            <button class="mini-btn" type="button" data-credit-open-login>${escapeHtml(loginCopy("Open login"))}</button>
          </div>
        </div>
      </div>
    `;
  }

  if (!snapshot?.ok || !snapshot?.trust) {
    return `
      <div class="works-section">
        <div class="section-title">${escapeHtml(loginCopy("Credit Panel"))}</div>
        <div class="comment-card">
          <div class="comment-text">${escapeHtml(loginCopy(
            "Credit service is waking up. Refresh once or reopen the panel."
          ))}</div>
        </div>
      </div>
    `;
  }

  const trust = snapshot.trust || {};
  const score = Number(trust.credit_score || 700);
  const band = buildCreditScoreBandModule(score);
  const riskLevel = String(trust.risk_level || "normal").replace(/_/g, " ");
  return `
    <div class="works-section">
      <div class="section-title">${escapeHtml(loginCopy("Credit Overview"))}</div>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(loginCopy("Credit score"))}</div>
          <div class="stat-value">${score}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(loginCopy("Trust band"))}</div>
          <div class="stat-value">${escapeHtml(band.label)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(loginCopy("Risk level"))}</div>
          <div class="stat-value">${escapeHtml(riskLevel)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(loginCopy("Open disputes"))}</div>
          <div class="stat-value">${Number(trust.open_dispute_count || 0)}</div>
        </div>
      </div>
      <div class="comment-card" style="margin-top:14px;">
        <div class="comment-text">${escapeHtml(String(band.summary || ""))}</div>
        <div class="works-note">${escapeHtml(loginCopy(
          "This MVP is already backed by the live trust endpoint. Next we can expand it into a full score history and change ledger."
        ))}</div>
      </div>
    </div>
    <div class="works-grid">
      <div class="works-section">
        <div class="section-title">${escapeHtml(loginCopy("Status flags"))}</div>
        <div class="works-list">
          <article class="work-card">
            <div class="work-cover">${trust.low_credit_warning ? "!" : "OK"}</div>
            <div class="work-info">
              <div class="work-title">${escapeHtml(loginCopy("Low credit warning"))}</div>
              <div class="works-note">${escapeHtml(trust.low_credit_warning ? loginCopy("Warning is active.") : loginCopy("No warning right now."))}</div>
            </div>
          </article>
          <article class="work-card">
            <div class="work-cover">${trust.review_required ? "R" : "OK"}</div>
            <div class="work-info">
              <div class="work-title">${escapeHtml(loginCopy("Review required"))}</div>
              <div class="works-note">${escapeHtml(trust.review_required ? loginCopy("Manual review may be required.") : loginCopy("No manual review is required."))}</div>
            </div>
          </article>
          <article class="work-card">
            <div class="work-cover">${trust.restricted ? "L" : "OK"}</div>
            <div class="work-info">
              <div class="work-title">${escapeHtml(loginCopy("Restricted"))}</div>
              <div class="works-note">${escapeHtml(trust.restricted ? loginCopy("Some actions are restricted.") : loginCopy("No active restrictions."))}</div>
            </div>
          </article>
          <article class="work-card">
            <div class="work-cover">${trust.frozen ? "F" : "OK"}</div>
            <div class="work-info">
              <div class="work-title">${escapeHtml(loginCopy("Frozen"))}</div>
              <div class="works-note">${escapeHtml(trust.frozen ? loginCopy("Account freeze is active.") : loginCopy("Account is active."))}</div>
            </div>
          </article>
        </div>
      </div>
      <div class="works-section">
        <div class="section-title">${escapeHtml(loginCopy("Active penalties"))}</div>
        <div class="works-list">${buildCreditPenaltyMarkupModule(trust.active_penalties)}</div>
      </div>
    </div>
  `;
}

function getCreditPanelModule() {
  const panel = document.getElementById("credit-panel");
  return panel instanceof HTMLElement ? panel : null;
}

async function renderCreditPanelModule() {
  const content = document.getElementById("credit-panel-content");
  if (!(content instanceof HTMLElement)) return false;
  content.innerHTML = `<div class="works-note">${escapeHtml(loginCopy("Loading credit panel..."))}</div>`;
  const snapshot = await loadCreditPanelSnapshotModule();
  content.innerHTML = buildCreditPanelMarkupModule(snapshot);
  content.querySelector("[data-credit-open-login]")?.addEventListener("click", () => openPanel?.(loginPanel));
  return true;
}

function openCreditPanelModule() {
  const panel = getCreditPanelModule();
  if (!(panel instanceof HTMLElement)) return false;
  openPanel?.(panel, { focus: true, layout: true });
  panel.classList.remove("hidden");
  panel.dataset.minimized = "false";
  globalThis.clampPanelInViewport?.(panel);
  globalThis.focusPanelBridge?.(panel);
  globalThis.bringPanelToFrontBridge?.(panel, { repeatPasses: 3 });
  void renderCreditPanelModule();
  return true;
}

Object.assign(globalThis, {
  buildCreditPanelMarkupModule,
  getCreditPanelModule,
  renderCreditPanelModule,
  openCreditPanelModule
});
