function buildUserAdminPanelMarkupModule() {
  if (!authState.user) {
    return `
      <div class="works-section">
        <div class="section-title">${escapeHtml(loginCopy("User Panel"))}</div>
        <div class="comment-card">
          <div class="comment-text">${escapeHtml(loginCopy(
            "Sign in to see your membership, workspace lane, credit status, and personal shortcuts."
          ))}</div>
          <div class="work-actions" style="margin-top:12px;">
            <button class="mini-btn" type="button" data-user-panel-open-login>${escapeHtml(loginCopy("Open login"))}</button>
          </div>
        </div>
      </div>
    `;
  }
  const isAdmin = typeof hasPanelPermission === "function" ? hasPanelPermission("admin.panel") : false;
  const membershipPreset = typeof getMembershipPreset === "function" ? getMembershipPreset() : null;
  const queueLane = String(membershipPreset?.queuePriority || authState.tier || "standard").trim();
  const userEmail = String(authState.user?.email || "").trim();
  const displayName = String(authState.user?.display_name || authState.user?.name || userEmail || "").trim();
  const tierLabel = typeof describeMembershipTier === "function"
    ? describeMembershipTier(authState.tier || authState.role || "free")
    : String(authState.tier || authState.role || "free");
  const shortcutCards = `
    <div class="works-list">
      <article class="work-card">
        <div class="work-cover">SUB</div>
        <div class="work-info">
          <div class="work-title">${escapeHtml(loginCopy("Subscription"))}</div>
          <div class="works-note">${escapeHtml(loginCopy("Upgrade tier, compare rights, and manage paid unlocks."))}</div>
          <div class="work-actions"><button class="mini-btn ghost tiny" type="button" data-user-panel-open="subscription">${escapeHtml(loginCopy("Open"))}</button></div>
        </div>
      </article>
      <article class="work-card">
        <div class="work-cover">CR</div>
        <div class="work-info">
          <div class="work-title">${escapeHtml(loginCopy("Credit"))}</div>
          <div class="works-note">${escapeHtml(loginCopy("Check your score, band, penalties, and governance posture."))}</div>
          <div class="work-actions"><button class="mini-btn ghost tiny" type="button" data-user-panel-open="credit">${escapeHtml(loginCopy("Open"))}</button></div>
        </div>
      </article>
      <article class="work-card">
        <div class="work-cover">WS</div>
        <div class="work-info">
          <div class="work-title">${escapeHtml(t("panel.workspaces"))}</div>
          <div class="works-note">${escapeHtml(t("workspaces.shortcutNote"))}</div>
          <div class="work-actions"><button class="mini-btn ghost tiny" type="button" data-user-panel-open="workspaces">${escapeHtml(t("action.open"))}</button></div>
        </div>
      </article>
      <article class="work-card">
        <div class="work-cover">WK</div>
        <div class="work-info">
          <div class="work-title">${escapeHtml(loginCopy("Works Center"))}</div>
          <div class="works-note">${escapeHtml(loginCopy("Manage covers, pricing, visibility, and watch entry for your works."))}</div>
          <div class="work-actions"><button class="mini-btn ghost tiny" type="button" data-user-panel-open="works">${escapeHtml(loginCopy("Open"))}</button></div>
        </div>
      </article>
    </div>
  `;
  return `
    <div class="works-section">
      <div class="section-title">${escapeHtml(loginCopy("Account overview"))}</div>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(loginCopy("Display name"))}</div>
          <div class="stat-value">${escapeHtml(displayName || loginCopy("Anonymous"))}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(loginCopy("Membership"))}</div>
          <div class="stat-value">${escapeHtml(tierLabel)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(loginCopy("Queue lane"))}</div>
          <div class="stat-value">${escapeHtml(queueLane)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(loginCopy("Session"))}</div>
          <div class="stat-value">${escapeHtml(String(authState.sessionDays || 90))}${escapeHtml(loginCopy(" days"))}</div>
        </div>
      </div>
      <div class="comment-card" style="margin-top:14px;">
        <div class="comment-text">${escapeHtml(loginCopy(
          "This panel is your personal control surface. Admin-only actions stay below when the signed-in account is an administrator."
        ))}</div>
        <div class="works-note">${escapeHtml(userEmail || loginCopy("No email on file."))}</div>
      </div>
    </div>
    <div class="works-section">
      <div class="section-title">${escapeHtml(loginCopy("Quick entrances"))}</div>
      ${shortcutCards}
    </div>
    ${isAdmin ? `<div class="works-section"><div class="section-title">${escapeHtml(loginCopy("Admin extension"))}</div></div>` : ""}
    ${isAdmin ? `
    <div class="works-section">
      <div class="section-title">${escapeHtml(loginCopy("User console"))}</div>
      <div class="comment-card">
        <div class="comment-text">${escapeHtml(loginCopy(
          "Use this panel to quickly locate a user, inspect membership tier, and execute membership / reward operations."
        ))}</div>
      </div>
    </div>
    <div class="panel-search-shell">
      <div class="panel-search-row">
        <input id="user-admin-search" class="panel-search-input" type="search" placeholder="${escapeHtml(loginCopy("Search by email / user id"))}" />
        <button id="user-admin-search-btn" class="cta tiny" type="button">${escapeHtml(loginCopy("Search"))}</button>
      </div>
    </div>
    <div id="user-admin-results" class="works-list">
      <div class="works-note">${escapeHtml(loginCopy("User search results will appear here."))}</div>
    </div>
    <div class="works-section">
      <div class="section-title">${escapeHtml(loginCopy("Admin actions"))}</div>
      <div class="panel-search-shell">
        <div class="panel-search-row">
          <input id="user-admin-email" class="panel-search-input" type="email" placeholder="${escapeHtml(loginCopy("Target email"))}" />
          <select id="user-admin-tier" class="panel-search-select">
            <option value="free">Free</option>
            <option value="starter">Starter</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="studio">Studio</option>
            <option value="enterprise">Enterprise</option>
            <option value="vip">VIP</option>
          </select>
          <button id="user-admin-membership-btn" class="cta tiny" type="button">${escapeHtml(loginCopy("Set membership"))}</button>
        </div>
        <div class="panel-search-row">
          <select id="user-admin-entitlement-kind" class="panel-search-select">
            <option value="language">${escapeHtml(loginCopy("Language boost"))}</option>
            <option value="voice">${escapeHtml(loginCopy("Voice boost"))}</option>
            <option value="thumbnail">${escapeHtml(loginCopy("Thumbnail boost"))}</option>
            <option value="preview_video">${escapeHtml(loginCopy("Preview video boost"))}</option>
          </select>
          <input id="user-admin-entitlement-quantity" class="panel-search-input panel-search-input--narrow" type="number" min="1" step="1" value="1" placeholder="${escapeHtml(loginCopy("Qty"))}" />
          <select id="user-admin-reason-template" class="panel-search-select">
            <option value="">${escapeHtml(loginCopy("Reason template"))}</option>
            <option value="${escapeHtml(loginCopy("Reward: strong creative contribution"))}">${escapeHtml(loginCopy("Reward · contribution"))}</option>
            <option value="${escapeHtml(loginCopy("Reward: timely delivery and collaboration"))}">${escapeHtml(loginCopy("Reward · delivery"))}</option>
            <option value="${escapeHtml(loginCopy("Penalty: repeated abuse or spam"))}">${escapeHtml(loginCopy("Penalty · abuse/spam"))}</option>
            <option value="${escapeHtml(loginCopy("Penalty: rights or policy risk"))}">${escapeHtml(loginCopy("Penalty · rights/policy"))}</option>
            <option value="${escapeHtml(loginCopy("Freeze: severe account review required"))}">${escapeHtml(loginCopy("Freeze · account review"))}</option>
          </select>
          <input id="user-admin-note" class="panel-search-input" type="text" placeholder="${escapeHtml(loginCopy("Note / reward reason"))}" />
          <button id="user-admin-entitlement-btn" class="cta tiny" type="button">${escapeHtml(loginCopy("Grant reward"))}</button>
          <button id="user-admin-entitlement-revoke-btn" class="mini-btn ghost tiny" type="button">${escapeHtml(loginCopy("Revoke reward"))}</button>
        </div>
        <div class="panel-search-row">
          <button id="user-admin-downgrade-free-btn" class="mini-btn ghost tiny" type="button">${escapeHtml(loginCopy("Downgrade to Free"))}</button>
          <button id="user-admin-downgrade-starter-btn" class="mini-btn ghost tiny" type="button">${escapeHtml(loginCopy("Downgrade to Starter"))}</button>
          <button id="user-admin-freeze-btn" class="mini-btn ghost tiny" type="button">${escapeHtml(loginCopy("Freeze user"))}</button>
        </div>
      </div>
      <div class="works-note">${escapeHtml(loginCopy(
        "Use membership updates for tier changes, reward actions for temporary extra capacity, revoke to claw back unused temporary capacity, and freeze to enforce a global restriction state."
      ))}</div>
      <div id="user-admin-action-status" class="works-note">${escapeHtml(loginCopy("No admin action has been executed yet."))}</div>
    </div>
    <div class="works-section">
      <div class="section-title">${escapeHtml(loginCopy("Reward / penalty ledger"))}</div>
      <div class="works-note">${escapeHtml(loginCopy(
        "This list explains what was rewarded or penalized, for whom, and why."
      ))}</div>
      <div id="user-admin-action-ledger" class="works-list"></div>
    </div>
    ` : ""}
  `;
}

function setUserAdminTargetEmailModule(email) {
  const emailInput = document.getElementById("user-admin-email");
  if (!(emailInput instanceof HTMLInputElement)) return false;
  emailInput.value = String(email || "").trim();
  emailInput.focus();
  emailInput.select();
  void loadUserAdminActionLedgerFromServerModule(emailInput.value);
  return true;
}

function setUserAdminActionStatusModule(message) {
  const node = document.getElementById("user-admin-action-status");
  if (!(node instanceof HTMLElement)) return false;
  node.textContent = String(message || "");
  return true;
}

function readUserAdminActionLedgerModule() {
  try {
    const raw = globalThis.localStorage?.getItem("cssos.userAdminActionLedger");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function writeUserAdminActionLedgerModule(entries) {
  try {
    globalThis.localStorage?.setItem("cssos.userAdminActionLedger", JSON.stringify(Array.isArray(entries) ? entries : []));
  } catch (_error) {
    // ignore storage failures
  }
}

async function loadUserAdminActionLedgerFromServerModule(email) {
  const targetEmail = String(email || "").trim();
  if (!targetEmail) {
    renderUserAdminActionLedgerModule();
    return false;
  }
  try {
    const res = await fetch(`/api/admin/users/actions?email=${encodeURIComponent(targetEmail)}&limit=40`, {
      credentials: "include"
    });
    const payload = await res.json().catch(() => null);
    const actions = Array.isArray(payload?.data?.actions) ? payload.data.actions : [];
    if (!res.ok || payload?.ok === false) {
      throw new Error(payload?.message || `admin_user_actions_failed:${res.status}`);
    }
    writeUserAdminActionLedgerModule(
      actions.map((row) => ({
        id: String(row?.action_id || ""),
        at: String(row?.created_at || ""),
        kind: String(row?.action_scope || row?.action_kind || "notice"),
        title: String(row?.action_kind || loginCopy("Admin action")),
        summary: String(row?.note || "")
      }))
    );
    renderUserAdminActionLedgerModule();
    return true;
  } catch (_error) {
    renderUserAdminActionLedgerModule();
    return false;
  }
}

function appendUserAdminActionLedgerModule(entry) {
  const current = readUserAdminActionLedgerModule();
  current.unshift({
    id: `uaa_${Date.now()}`,
    at: new Date().toISOString(),
    ...entry
  });
  writeUserAdminActionLedgerModule(current.slice(0, 80));
  renderUserAdminActionLedgerModule();
}

function buildUserAdminActionLedgerMarkupModule() {
  const rows = readUserAdminActionLedgerModule();
  if (!rows.length) {
    return `<div class="works-note">${escapeHtml(loginCopy("No reward / penalty records yet."))}</div>`;
  }
  return rows.map((row) => `
    <article class="work-card">
      <div class="work-cover">${escapeHtml(String(row?.kind || "?").slice(0, 2).toUpperCase())}</div>
      <div class="work-info">
        <div class="work-title">${escapeHtml(String(row?.title || loginCopy("Admin action")))}</div>
        <div class="work-tags">${escapeHtml(String(row?.at || ""))}</div>
        <div class="works-note">${escapeHtml(String(row?.summary || ""))}</div>
      </div>
    </article>
  `).join("");
}

function renderUserAdminActionLedgerModule() {
  const container = document.getElementById("user-admin-action-ledger");
  if (!(container instanceof HTMLElement)) return false;
  container.innerHTML = buildUserAdminActionLedgerMarkupModule();
  return true;
}

async function applyUserAdminMembershipUpdateModule(trigger = null) {
  const emailInput = document.getElementById("user-admin-email");
  const tierInput = document.getElementById("user-admin-tier");
  const email = String(emailInput?.value || "").trim();
  const tier = String(tierInput?.value || "").trim().toLowerCase();
  if (!email || !tier) {
    safeShowToast?.(loginCopy("Enter the target email and membership tier first."));
    return false;
  }
  setButtonBusy?.(trigger, true);
  try {
    const res = await fetch("/api/admin/membership/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, tier })
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.ok === false) {
      throw new Error(payload?.message || `admin_membership_set_failed:${res.status}`);
    }
    const message = loginCopy(
      `Membership updated for ${email} -> ${tier}.`
    );
    safeShowToast?.(message);
    setUserAdminActionStatusModule(message);
    appendUserAdminActionLedgerModule({
      kind: "membership",
      title: loginCopy("Membership updated"),
      summary: loginCopy(`${email} is now on ${tier}.`)
    });
    return true;
  } catch (_error) {
    const message = loginCopy("Failed to update membership.");
    safeShowToast?.(message);
    setUserAdminActionStatusModule(message);
    return false;
  } finally {
    setButtonBusy?.(trigger, false);
  }
}

async function applyUserAdminEntitlementGrantModule(trigger = null) {
  const emailInput = document.getElementById("user-admin-email");
  const kindInput = document.getElementById("user-admin-entitlement-kind");
  const quantityInput = document.getElementById("user-admin-entitlement-quantity");
  const noteInput = document.getElementById("user-admin-note");
  const email = String(emailInput?.value || "").trim();
  const boostKind = String(kindInput?.value || "").trim().toLowerCase();
  const quantity = Math.max(1, Number(quantityInput?.value || 1));
  const note = String(noteInput?.value || "").trim();
  if (!email || !boostKind) {
    safeShowToast?.(loginCopy("Enter the target email and entitlement type first."));
    return false;
  }
  setButtonBusy?.(trigger, true);
  try {
    const res = await fetch("/api/admin/entitlements/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, boost_kind: boostKind, quantity, note })
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.ok === false) {
      throw new Error(payload?.message || `admin_entitlement_grant_failed:${res.status}`);
    }
    const message = loginCopy(
      `Granted ${quantity} ${boostKind} reward to ${email}.`
    );
    safeShowToast?.(message);
    setUserAdminActionStatusModule(message);
    appendUserAdminActionLedgerModule({
      kind: "reward",
      title: loginCopy("Temporary reward granted"),
      summary: loginCopy(
        `${email} received ${quantity} ${boostKind} capacity.${note ? ` Reason: ${note}` : ""}`
      )
    });
    return true;
  } catch (_error) {
    const message = loginCopy("Failed to grant reward.");
    safeShowToast?.(message);
    setUserAdminActionStatusModule(message);
    return false;
  } finally {
    setButtonBusy?.(trigger, false);
  }
}

async function revokeUserAdminEntitlementModule(trigger = null) {
  const emailInput = document.getElementById("user-admin-email");
  const kindInput = document.getElementById("user-admin-entitlement-kind");
  const quantityInput = document.getElementById("user-admin-entitlement-quantity");
  const email = String(emailInput?.value || "").trim();
  const boostKind = String(kindInput?.value || "").trim().toLowerCase();
  const quantity = Math.max(1, Number(quantityInput?.value || 1));
  if (!email || !boostKind) {
    safeShowToast?.(loginCopy("Enter the target email and entitlement type first."));
    return false;
  }
  setButtonBusy?.(trigger, true);
  try {
    const res = await fetch("/api/admin/entitlements/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, boost_kind: boostKind, quantity })
    });
    const payload = await res.json().catch(() => null);
    const revokedQuantity = Number(payload?.data?.revoked_quantity || 0);
    if (!res.ok || payload?.ok === false) {
      throw new Error(payload?.message || `admin_entitlement_revoke_failed:${res.status}`);
    }
    const message = revokedQuantity > 0
      ? loginCopy(`Revoked ${revokedQuantity} ${boostKind} reward from ${email}.`)
      : loginCopy(`No unused ${boostKind} reward remained for ${email}.`);
    safeShowToast?.(message);
    setUserAdminActionStatusModule(message);
    appendUserAdminActionLedgerModule({
      kind: revokedQuantity > 0 ? "penalty" : "notice",
      title: revokedQuantity > 0 ? loginCopy("Reward revoked") : loginCopy("Nothing to revoke"),
      summary: message
    });
    return revokedQuantity > 0;
  } catch (_error) {
    const message = loginCopy("Failed to revoke reward.");
    safeShowToast?.(message);
    setUserAdminActionStatusModule(message);
    return false;
  } finally {
    setButtonBusy?.(trigger, false);
  }
}

function applyUserAdminPenaltyPresetModule(tier, trigger = null) {
  const tierInput = document.getElementById("user-admin-tier");
  if (tierInput instanceof HTMLSelectElement) {
    tierInput.value = String(tier || "").trim().toLowerCase();
  }
  return applyUserAdminMembershipUpdateModule(trigger);
}

async function applyUserAdminFreezePlaceholderModule(trigger = null) {
  const emailInput = document.getElementById("user-admin-email");
  const noteInput = document.getElementById("user-admin-note");
  const email = String(emailInput?.value || "").trim();
  const note = String(noteInput?.value || "").trim();
  if (!email) {
    safeShowToast?.(loginCopy("Enter the target email first."));
    return false;
  }
  setButtonBusy?.(trigger, true);
  try {
    const res = await fetch("/api/admin/users/freeze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, note })
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.ok === false) {
      throw new Error(payload?.message || `admin_user_freeze_failed:${res.status}`);
    }
    const message = loginCopy(
      `${email} has been frozen and downgraded to Free.`
    );
    safeShowToast?.(message);
    setUserAdminActionStatusModule(message);
    appendUserAdminActionLedgerModule({
      kind: "freeze",
      title: loginCopy("User frozen"),
      summary: note ? `${message} ${loginCopy("Reason")}：${note}` : message
    });
    return true;
  } catch (_error) {
    const message = loginCopy("Failed to freeze user.");
    safeShowToast?.(message);
    setUserAdminActionStatusModule(message);
    return false;
  } finally {
    setButtonBusy?.(trigger, false);
  }
}

async function runUserAdminSearchModule(query) {
  const results = document.getElementById("user-admin-results");
  if (!(results instanceof HTMLElement)) return false;
  const q = String(query || "").trim();
  if (!q) {
    results.innerHTML = `<div class="works-note">${escapeHtml(loginCopy("Enter an email or user id first."))}</div>`;
    return false;
  }
  results.innerHTML = `<div class="works-note">${escapeHtml(loginCopy("Searching users..."))}</div>`;
  try {
    const url = `/api/admin/users/search?q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { credentials: "include" });
    const payload = await res.json().catch(() => null);
    const data = payload?.data || payload || {};
    const users = Array.isArray(data?.users) ? data.users : [];
    if (!res.ok || payload?.ok === false || !users.length) {
      results.innerHTML = `<div class="works-note">${escapeHtml(loginCopy("No matching users yet, or this admin search route is not connected on the current backend."))}</div>`;
      return false;
    }
    results.innerHTML = users.map((user) => `
      <article class="work-card">
        <div class="work-cover">${escapeHtml(String(user?.email || user?.id || "?").slice(0, 2).toUpperCase())}</div>
        <div class="work-info">
          <div class="work-title">${escapeHtml(String(user?.email || user?.id || loginCopy("Unknown user")))}</div>
          <div class="work-tags">${escapeHtml(loginCopy("Tier"))} · ${escapeHtml(String(user?.tier || user?.role || "guest"))}</div>
          <div class="works-note">${escapeHtml(loginCopy("Use this user as the target for membership or reward actions."))}</div>
          <div class="work-actions">
            <button class="mini-btn ghost tiny" type="button" data-user-admin-use-email="${escapeHtml(String(user?.email || ""))}">${escapeHtml(loginCopy("Use email"))}</button>
          </div>
        </div>
      </article>
    `).join("");
    results.querySelectorAll("[data-user-admin-use-email]").forEach((button) => {
      button.addEventListener("click", () => {
        const email = String(button.getAttribute("data-user-admin-use-email") || "").trim();
        if (email) setUserAdminTargetEmailModule(email);
      });
    });
    return true;
  } catch (_error) {
    results.innerHTML = `<div class="works-note">${escapeHtml(loginCopy("Admin user search is not ready on this backend yet."))}</div>`;
    return false;
  }
}

async function renderUserAdminPanelModule() {
  const body = document.getElementById("user-admin-panel-content");
  if (!(body instanceof HTMLElement)) return false;
  body.innerHTML = buildUserAdminPanelMarkupModule();
  body.querySelector("[data-user-panel-open-login]")?.addEventListener("click", () => openPanel?.(loginPanel));
  body.querySelectorAll("[data-user-panel-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = String(button.getAttribute("data-user-panel-open") || "").trim();
      if (target === "subscription") {
        globalThis.openSubscriptionPanelModule?.();
        return;
      }
      if (target === "credit") {
        globalThis.openCreditPanelModule?.();
        return;
      }
      if (target === "workspaces") {
        globalThis.openWorkspacesPanelModule?.();
        return;
      }
      if (target === "works") {
        globalThis.openWorksPanelModule?.();
      }
    });
  });
  body.querySelector("#user-admin-search-btn")?.addEventListener("click", () => {
    const value = body.querySelector("#user-admin-search")?.value || "";
    void runUserAdminSearchModule(value);
  });
  body.querySelector("#user-admin-membership-btn")?.addEventListener("click", (event) => {
    void applyUserAdminMembershipUpdateModule(event.currentTarget);
  });
  body.querySelector("#user-admin-entitlement-btn")?.addEventListener("click", (event) => {
    void applyUserAdminEntitlementGrantModule(event.currentTarget);
  });
  body.querySelector("#user-admin-entitlement-revoke-btn")?.addEventListener("click", (event) => {
    void revokeUserAdminEntitlementModule(event.currentTarget);
  });
  body.querySelector("#user-admin-downgrade-free-btn")?.addEventListener("click", (event) => {
    void applyUserAdminPenaltyPresetModule("free", event.currentTarget);
  });
  body.querySelector("#user-admin-downgrade-starter-btn")?.addEventListener("click", (event) => {
    void applyUserAdminPenaltyPresetModule("starter", event.currentTarget);
  });
  body.querySelector("#user-admin-freeze-btn")?.addEventListener("click", (event) => {
    void applyUserAdminFreezePlaceholderModule(event.currentTarget);
  });
  body.querySelector("#user-admin-search")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void runUserAdminSearchModule(event.currentTarget?.value || "");
  });
  body.querySelector("#user-admin-email")?.addEventListener("change", (event) => {
    void loadUserAdminActionLedgerFromServerModule(event.currentTarget?.value || "");
  });
  body.querySelector("#user-admin-reason-template")?.addEventListener("change", (event) => {
    const nextValue = String(event.currentTarget?.value || "").trim();
    const noteInput = body.querySelector("#user-admin-note");
    if (!(noteInput instanceof HTMLInputElement)) return;
    if (nextValue) noteInput.value = nextValue;
  });
  if (body.querySelector("#user-admin-action-ledger")) {
    renderUserAdminActionLedgerModule();
  }
  return true;
}

function openUserAdminPanelModule() {
  const panel =
    globalThis.userAdminPanel instanceof HTMLElement
      ? globalThis.userAdminPanel
      : document.getElementById("user-admin-panel");
  if (!(panel instanceof HTMLElement)) return false;
  globalThis.userAdminPanel = panel;
  openPanel?.(panel, { focus: true, layout: true });
  panel.classList.remove("hidden");
  panel.dataset.minimized = "false";
  globalThis.focusPanelBridge?.(panel);
  globalThis.bringPanelToFrontBridge?.(panel, { repeatPasses: 3 });
  void renderUserAdminPanelModule();
  return true;
}

Object.assign(globalThis, {
  buildUserAdminPanelMarkupModule,
  applyUserAdminEntitlementGrantModule,
  applyUserAdminFreezePlaceholderModule,
  applyUserAdminMembershipUpdateModule,
  applyUserAdminPenaltyPresetModule,
  appendUserAdminActionLedgerModule,
  buildUserAdminActionLedgerMarkupModule,
  loadUserAdminActionLedgerFromServerModule,
  renderUserAdminPanelModule,
  renderUserAdminActionLedgerModule,
  revokeUserAdminEntitlementModule,
  runUserAdminSearchModule,
  readUserAdminActionLedgerModule,
  setUserAdminActionStatusModule,
  setUserAdminTargetEmailModule,
  writeUserAdminActionLedgerModule,
  openUserAdminPanelModule
});
