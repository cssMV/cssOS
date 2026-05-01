function buildProfileAvatarMarkup(options = {}) {
  const displayName = String(options.displayName || "").trim() || "User";
  const avatarUrl = String(options.avatarUrl || "").trim();
  const canEditProfile = options.canEditProfile === true;
  return `
    <div class="profile-avatar-wrap">
      ${avatarUrl ? `<img class="profile-avatar-image" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}" />` : `<div class="profile-avatar-fallback">${escapeHtml(displayName.slice(0, 2).toUpperCase())}</div>`}
      <label class="cta tiny profile-avatar-cta" ${canEditProfile ? "" : "hidden"}>
        ${t("profile.changeAvatar")}
        <input id="profile-avatar-input" type="file" accept="image/*" hidden />
      </label>
    </div>
  `;
}

function getProfileAvatarOverrideKeyModule() {
  const id = String(authState.user?.email || authState.user?.id || "guest").trim().toLowerCase();
  return `${PROFILE_AVATAR_OVERRIDE_KEY}.${id}`;
}

function getProfileAvatarOverrideKey() {
  return getProfileAvatarOverrideKeyModule();
}

function readProfileAvatarOverrideModule() {
  if (!authState.user) return "";
  try {
    return String(localStorage.getItem(getProfileAvatarOverrideKey()) || "");
  } catch (_err) {
    return "";
  }
}

function readProfileAvatarOverride() {
  return readProfileAvatarOverrideModule();
}

function writeProfileAvatarOverrideModule(value) {
  if (!authState.user) return;
  try {
    if (value) {
      localStorage.setItem(getProfileAvatarOverrideKey(), value);
    } else {
      localStorage.removeItem(getProfileAvatarOverrideKey());
    }
  } catch (_err) {
    // ignore
  }
}

function writeProfileAvatarOverride(value) {
  writeProfileAvatarOverrideModule(value);
}

function buildProfileMetaMarkup(options = {}) {
  const displayName = String(options.displayName || "").trim() || "User";
  const providerLabel = String(options.providerLabel || "").trim() || loginCopy("Unknown");
  const linkedText = String(options.linkedText || "").trim() || t("profile.noLinkedProviders");
  const note = String(options.note || "").trim();
  const roleLabel = String(options.roleLabel || DEFAULT_ROLE);
  return `
    <div class="profile-account-title">${t("profile.accountTitle")}</div>
    <div class="profile-account-name">${escapeHtml(displayName)}</div>
    <div class="profile-account-meta">${t("profile.signedInAs")} ${escapeHtml(providerLabel)}</div>
    <div class="profile-account-meta">${t("profile.connectedProviders")} ${escapeHtml(linkedText)}</div>
    <div class="profile-account-meta">${t("profile.accountRole")} ${escapeHtml(roleLabel)}</div>
    ${note ? `<div class="profile-account-meta">${escapeHtml(note)}</div>` : ""}
  `;
}

function buildProfileLatestCardsMarkup(options = {}) {
  const latestWorkTitle = String(options.latestWorkTitle || t("profile.latestNone"));
  const latestRevenueText = String(options.latestRevenueText || t("profile.latestNone"));
  const membershipTitle = String(options.membershipTitle || loginCopy("No recent change"));
  const membershipMeta = String(options.membershipMeta || "");
  return `
    <div class="profile-account-latest">
      <div class="profile-mini-card">
        <div class="profile-mini-label">${t("profile.latestWork")}</div>
        <div class="profile-mini-value">${escapeHtml(latestWorkTitle)}</div>
        ${buildProfileNavButtonMarkup("works", t("profile.moreWorks"), options)}
      </div>
      <div class="profile-mini-card">
        <div class="profile-mini-label">${t("profile.latestRevenue")}</div>
        <div class="profile-mini-value">${escapeHtml(latestRevenueText)}</div>
        ${buildProfileNavButtonMarkup("api", t("profile.moreRevenue"), options)}
      </div>
      <div class="profile-mini-card">
        <div class="profile-mini-label">${escapeHtml(loginCopy("Latest plan change"))}</div>
        <div class="profile-mini-value">${escapeHtml(membershipTitle)}</div>
        ${membershipMeta ? `<div class="profile-account-meta">${escapeHtml(membershipMeta)}</div>` : ""}
        ${buildProfileNavButtonMarkup("api", loginCopy("Open billing"), options)}
      </div>
      ${options.canOpenUserAdmin ? `
        <div class="profile-mini-card">
          <div class="profile-mini-label">${escapeHtml(loginCopy("User Console"))}</div>
          <div class="profile-mini-value">${escapeHtml(loginCopy("Find users · membership · reward / penalty"))}</div>
          ${buildProfileNavButtonMarkup("user-admin", loginCopy("Open user panel"), options)}
        </div>
      ` : ""}
    </div>
  `;
}

function buildGuestProfileHintMarkup() {
  return `
    <div class="profile-account-title">${t("profile.accountTitle")}</div>
    <div class="profile-account-meta">${t("profile.guestHint")}</div>
  `;
}

function buildProfileNavButtonMarkup(target, label, options = {}) {
  const normalizedTarget = String(target || "").trim();
  if (!normalizedTarget) return "";
  const abilityKey = normalizedTarget === "works" ? "canOpenWorks" : "canOpenApi";
  const enabled = options?.[abilityKey] === true;
  return `<button class="${escapeHtml(profileNavButtonClass(normalizedTarget, options))}" type="button" data-profile-nav="${escapeHtml(normalizedTarget)}" ${enabled ? "" : "hidden"}>${escapeHtml(label)}</button>`;
}

function profileNavButtonClass(target, options = {}) {
  const defaultNav = String(options.defaultNav || "").trim();
  return `mini-btn ghost ${defaultNav === target ? "" : "is-muted"}`.trim();
}

function buildSignedInProfileMarkup(options = {}) {
  const workspaceMarkup = String(options.workspaceMarkup || "");
  return `
    <div class="profile-account-shell">
      ${buildProfileAvatarMarkup(options)}
      <div class="profile-account-main">
        ${buildProfileMetaMarkup(options)}
        ${buildProfileLatestCardsMarkup(options)}
        ${workspaceMarkup}
      </div>
    </div>
  `;
}

function buildProfileSignedInShellMarkup(options = {}) {
  return buildSignedInProfileMarkup(options);
}

function buildProfileGuestShellMarkup() {
  return buildGuestProfileHintMarkup();
}

function bindSignedInProfileActions(summary, options = {}) {
  if (!(summary instanceof Element)) return;
  bindProfileNavButtons(summary, options);
  bindProfileAvatarInput(summary, options);
  bindProfileCommerceActions(summary);
  syncProfilePasskeyControls({ signedIn: true });
  ensureProfileCommerceLoaded();
}

function bindProfileNavButtons(summary, options = {}) {
  if (!(summary instanceof Element)) return;
  const canOpenWorks = options.canOpenWorks === true;
  const canOpenApi = options.canOpenApi === true;
  const canOpenUserAdmin = options.canOpenUserAdmin === true;
  summary.querySelectorAll("[data-profile-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-profile-nav");
      if (target === "works" && canOpenWorks) openPanel(worksPanel);
      if (target === "api" && canOpenApi) openPanel(apiPanel);
      if (target === "user-admin" && canOpenUserAdmin) openUserAdminPanelModule?.();
    });
  });
}

function bindProfileAvatarInput(summary, options = {}) {
  if (!(summary instanceof Element)) return;
  const canEditProfile = options.canEditProfile === true;
  const avatarInput = summary.querySelector("#profile-avatar-input");
  avatarInput?.addEventListener("change", () => {
    if (!canEditProfile) return;
    const file = avatarInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      writeProfileAvatarOverride(String(reader.result || ""));
      broadcastProfileRefresh({ includeWorks: true });
    };
    reader.readAsDataURL(file);
  });
}

function syncProfilePasskeyControls(options = {}) {
  const signedIn = options.signedIn === true;
  const passkeyEnableBtn = document.getElementById("passkey-enable");
  const passkeyLoginBtn = document.getElementById("passkey-login");
  const passkeyReady = authState.linkedProviders.includes("passkey");
  if (passkeyEnableBtn) {
    const nextAction = signedIn && passkeyReady ? "passkey.login" : "passkey.enable";
    passkeyEnableBtn.textContent = t(nextAction === "passkey.login" ? "profile.passkeyLogin" : "profile.passkeyEnable");
    passkeyEnableBtn.setAttribute("data-action", nextAction);
    passkeyEnableBtn.hidden = !hasPanelPermission(nextAction === "passkey.login" ? "profile.passkey.login" : "profile.passkey.enable");
  }
  if (passkeyLoginBtn) passkeyLoginBtn.style.display = signedIn ? "none" : (hasPanelPermission("profile.passkey.login") ? "" : "none");
}

function renderGuestProfileState(summary) {
  if (!(summary instanceof Element)) return;
  summary.innerHTML = buildProfileGuestShellMarkup();
  syncProfilePasskeyControls({ signedIn: false });
}

function buildProfilePanelContext(behavior = readPanelBehaviorSettingsLocal()) {
  const displayName = authState.user?.name || authState.user?.email || authState.user?.id || "User";
  const providerId = authState.loginProvider || "";
  const providerLabel = providerId ? getPlatformLabel(providerId) : loginCopy("Unknown");
  const linkedList = Array.from(new Set(authState.linkedProviders || [])).filter((id) => id !== "passkey");
  const linkedText = linkedList.length
    ? linkedList.map((id) => getPlatformLabel(id)).join(" · ")
    : t("profile.noLinkedProviders");
  const commerce = watchCommerceState.payload || null;
  const latestWork = commerce?.ownership?.works?.[0] || null;
  const latestLedger = Array.isArray(commerce?.ledger_entries) ? commerce.ledger_entries[0] : null;
  const avatarUrl = readProfileAvatarOverride() || authState.user?.avatar || "";
  const latestMembershipChange = billingState.latest_membership_change && typeof billingState.latest_membership_change === "object"
    ? billingState.latest_membership_change
    : null;
  const latestMembershipMeta = latestMembershipChange?.meta && typeof latestMembershipChange.meta === "object"
    ? latestMembershipChange.meta
    : {};
  const previousTier = String(latestMembershipMeta.previous_tier || "").trim();
  const targetTier = String(latestMembershipMeta.target_tier || "").trim();
  const refundedCents = Number(latestMembershipMeta.refunded_cents || 0);
  const chargedCents = Number(latestMembershipMeta.charged_cents || 0);
  const holdReleaseAt = billingState.pending_balance_release_at
    ? new Date(String(billingState.pending_balance_release_at)).toLocaleDateString()
    : "";
  const latestMembershipDate = latestMembershipChange?.created_at
    ? new Date(String(latestMembershipChange.created_at)).toLocaleDateString()
    : "";
  let membershipTitle = loginCopy("No recent change");
  let membershipMetaText = "";
  if (previousTier && targetTier) {
    membershipTitle = loginCopy(
      `${previousTier} -> ${targetTier}`
    );
    if (refundedCents > 0) {
      membershipMetaText = loginCopy(
        holdReleaseAt
          ? `Refund on hold: $${(refundedCents / 100).toFixed(2)} · unlocks ${holdReleaseAt}`
          : `Refund on hold: $${(refundedCents / 100).toFixed(2)}`
      );
    } else if (chargedCents > 0) {
      membershipMetaText = loginCopy(
        latestMembershipDate
          ? `Charged $${(chargedCents / 100).toFixed(2)} · ${latestMembershipDate}`
          : `Charged $${(chargedCents / 100).toFixed(2)}`
      );
    } else if (latestMembershipDate) {
      membershipMetaText = latestMembershipDate;
    }
  } else if (Number(billingState.pending_balance_cents || 0) > 0) {
    membershipTitle = loginCopy("Refund on hold");
    membershipMetaText = loginCopy(
      holdReleaseAt
        ? `$${(Number(billingState.pending_balance_cents || 0) / 100).toFixed(2)} unlocks ${holdReleaseAt}`
        : `$${(Number(billingState.pending_balance_cents || 0) / 100).toFixed(2)} pending`
    );
  }
  return {
    displayName,
    providerLabel,
    linkedText,
    avatarUrl,
    latestWorkTitle: String(latestWork?.title || t("profile.latestNone")),
    latestRevenueText: latestLedger
      ? `${formatUsdFromCents(latestLedger?.amount_cents, "$0.00")} · ${String(latestLedger?.note || latestLedger?.kind || "entry")}`
      : t("profile.latestNone"),
    membershipTitle,
    membershipMeta: membershipMetaText,
    workspaceMarkup: buildProfileCommerceMarkup(),
    note: behavior?.profile?.note || "",
    roleLabel: String(authState.tier || authState.role || DEFAULT_ROLE),
    defaultNav: behavior?.profile?.default_nav || "",
    canOpenUserAdmin: hasPanelPermission("admin.panel")
  };
}

function ensureProfileSummaryNode() {
  if (!profileGrid) return null;
  let summary = profileGrid.querySelector(".profile-account");
  if (summary) return summary;
  summary = document.createElement("div");
  summary.className = "profile-account";
  profileGrid.insertBefore(summary, profileGrid.firstChild);
  return summary;
}

function readProfilePanelAbilities() {
  return {
    canEditProfile: hasPanelPermission("profile.avatar.edit"),
    canOpenWorks: hasPanelPermission("profile.nav.works"),
    canOpenApi: hasPanelPermission("profile.nav.api"),
    canOpenUserAdmin: hasPanelPermission("admin.panel")
  };
}

function renderResolvedProfilePanel(behavior = readPanelBehaviorSettingsLocal()) {
  const summary = ensureProfileSummaryNode();
  if (!summary) return;
  const { canEditProfile, canOpenWorks, canOpenApi, canOpenUserAdmin } = readProfilePanelAbilities();
  if (authState.user) {
    const profileContext = buildProfilePanelContext(behavior);
    summary.innerHTML = buildProfileSignedInShellMarkup({
      ...profileContext,
      canEditProfile,
      canOpenWorks,
      canOpenApi,
      canOpenUserAdmin
    });
    bindSignedInProfileActions(summary, {
      canOpenWorks,
      canOpenApi,
      canEditProfile,
      canOpenUserAdmin
    });
    return;
  }
  renderGuestProfileState(summary);
}

function renderProfilePanel() {
  if (!profileGrid) return;
  const behavior = readPanelBehaviorSettingsLocal();
  renderResolvedProfilePanel(behavior);
}

function buildSignedInVersionMarkup() {
  const displayName = authState.user?.name || authState.user?.email || authState.user?.id || "User";
  return `
    <div class="version-session">
      <div class="version-session-label">${t("versions.loggedInAs")}</div>
      <div class="version-session-value">${escapeHtml(displayName)}</div>
    </div>
    <button class="cta tiny" type="button" data-action="profile.open">${t("versions.openProfile")}</button>
  `;
}

function buildGuestVersionMarkup() {
  return `
    <button class="cta tiny" type="button" data-action="passkey.login" data-i18n="action.passkeyLogin">
      ${t("action.passkeyLogin")}
    </button>
  `;
}

function renderProfileVersionActions() {
  if (!versionActions) return;
  versionActions.innerHTML = authState.user
    ? buildSignedInVersionMarkup()
    : buildGuestVersionMarkup();
}

function refreshProfileVersionSurface(elements) {
  renderProfileVersionActions();
  void loadVersionsModule(elements);
}

function renderVersionActions() {
  renderProfileVersionActions();
}

function refreshThemeQuickToggleModule(settings = null, effectiveThemeOverride = "") {
  if (!(themeQuickToggle instanceof HTMLButtonElement)) return;
  const behavior = settings ? sanitizePanelBehaviorSettings(settings) : readPanelBehaviorSettingsLocal();
  const themeMode = String(behavior?.appearance?.theme_mode || "system");
  const effectiveTheme =
    effectiveThemeOverride || getEffectiveThemeModeFromSettings(behavior) || "dark";
  const icon = effectiveTheme === "dark" ? "☾" : "☀";
  const title =
    globalThis.CSSOS_I18N?.t?.("theme.quick.title") ||
    loginCopy("Theme");
  themeQuickToggle.textContent = icon;
  themeQuickToggle.dataset.theme = effectiveTheme;
  themeQuickToggle.dataset.themeMode = themeMode;
  themeQuickToggle.setAttribute("aria-label", title);
  themeQuickToggle.setAttribute("title", title);
  if (themeQuickMenu instanceof HTMLElement) {
    themeQuickMenu
      .querySelectorAll("[data-theme-mode]")
      .forEach((button) => button.classList.toggle("is-active", button.getAttribute("data-theme-mode") === themeMode));
  }
}

function normalizeVersionListModule(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map((item) => (typeof item === "string" ? { id: item } : item));
  }
  if (Array.isArray(payload.versions)) {
    return payload.versions.map((item) => (typeof item === "string" ? { id: item } : item));
  }
  return [];
}

function extractVersionDatePartsModule(entry) {
  const raw = String(entry?.createdAt || entry?.date || entry?.id || "").trim();
  const match = raw.match(/(\d{4})-?(\d{2})-?(\d{2})/);
  if (!match) return null;
  return { year: match[1], month: match[2], day: match[3] };
}

function formatVersionBadgeModule(entry) {
  const parts = extractVersionDatePartsModule(entry);
  if (!parts) return String(entry?.id || "").replace(/_/g, "");
  return `${parts.month}${parts.day}${parts.year}`;
}

function formatVersionDateLabelModule(entry) {
  const parts = extractVersionDatePartsModule(entry);
  if (!parts) return String(entry?.createdAt || entry?.date || entry?.id || "").trim();
  return `${parts.month}/${parts.day}/${parts.year}`;
}

function getVersionReleaseNotesModule(entry) {
  const id = String(entry?.id || entry?.version || "").trim();
  return VERSION_RELEASE_NOTES[id] || {
    headline: loginCopy("Latest release is live"),
    copy: loginCopy(
      "This card tells you what changed in this update instead of only showing an internal build id."
    ),
    highlights: [
      loginCopy("Version notes are easier to read"),
      loginCopy("Technical ids are tucked into details"),
      loginCopy("Refresh to use the newest release")
    ]
  };
}

function renderVersionHeroModule(elements, entry, currentId) {
  const versionHero = elements?.versionHero;
  const versionHighlights = elements?.versionHighlights;
  const versionCurrentLabel = elements?.versionCurrentLabel;
  const versionTechSummary = elements?.versionTechSummary;
  if (!versionHero || !versionHighlights) return;
  const notes = getVersionReleaseNotesModule(entry);
  // CSSOS_PHASE2_P2_60_I18N 20260419 — VERSION_RELEASE_NOTES is English-SSOT;
  // route every user-visible field through tr() so the runtime translator
  // covers all locales uniformly. `tr` falls back to the English source
  // verbatim when the runtime is unavailable or the locale is already en.
  const trFn = typeof globalThis.tr === "function" ? globalThis.tr : (s) => String(s || "");
  versionHero.innerHTML = `
    <div class="version-badge">${escapeHtml(formatVersionBadgeModule(entry))}</div>
    <div class="version-headline">${escapeHtml(trFn(notes.headline))}</div>
    <div class="version-copy">${escapeHtml(trFn(notes.copy))}</div>
  `;
  versionHighlights.innerHTML = "";
  notes.highlights.forEach((line) => {
    const item = document.createElement("div");
    item.className = "version-highlight";
    item.textContent = trFn(line);
    versionHighlights.appendChild(item);
  });
  if (versionCurrentLabel) {
    versionCurrentLabel.textContent = `${formatVersionDateLabelModule(entry)} · ${currentId}`;
  }
  if (versionTechSummary) {
    versionTechSummary.textContent = loginCopy(
      `Technical details · ${currentId}`
    );
  }
}

async function loadVersionsModule(elements) {
  const versionToggle = elements?.versionToggle;
  const versionMenu = elements?.versionMenu;
  const versionList = elements?.versionList;
  if (!versionToggle || !versionMenu || !versionList) return;
  try {
    const [currentRes, listRes] = await Promise.all([
      fetch("/version.json", { cache: "no-store" }).catch(() => null),
      fetch("/versions.json", { cache: "no-store" }).catch(() => null)
    ]);
    const currentData = currentRes && currentRes.ok ? await currentRes.json() : null;
    const listData = listRes && listRes.ok ? await listRes.json() : null;
    const current =
      listData?.current || currentData?.version || currentData?.id || "current";
    const versions = normalizeVersionListModule(listData);
    if (!versions.length) {
      versionToggle.classList.add("is-hidden");
      return;
    }
    const activeEntry =
      versions.find((entry) => String(entry?.id || entry?.version || entry?.name || "").trim() === current) ||
      versions[0];
    renderVersionHeroModule(elements, activeEntry, current);
    versionList.innerHTML = "";
    versions.forEach((entry) => {
      const id = entry.id || entry.version || entry.name;
      if (!id) return;
      const safePath = entry.path || `/v/${encodeURIComponent(id)}`;
      const label = entry.label || formatVersionBadgeModule(entry) || id;
      const item = document.createElement("a");
      item.href = safePath;
      item.className = `version-item ${id === current ? "active" : ""}`;
      item.innerHTML = `
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(formatVersionDateLabelModule(entry))}</span>
      `;
      item.addEventListener("click", (event) => {
        event.preventDefault();
        window.location.assign(safePath);
      });
      versionList.appendChild(item);
    });
  } catch (err) {
    versionToggle.classList.add("is-hidden");
  }
}

function initVersionSwitcherModule(elements) {
  const versionToggle = elements?.versionToggle;
  const versionMenu = elements?.versionMenu;
  if (!versionToggle || !versionMenu) return;
  const versionToggleLabel = loginCopy("Updates");
  versionToggle.textContent = "⋯";
  versionToggle.setAttribute("aria-label", versionToggleLabel);
  versionToggle.setAttribute("title", versionToggleLabel);
  versionToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    versionMenu.classList.toggle("is-hidden");
  });
  document.addEventListener("click", () => {
    versionMenu.classList.add("is-hidden");
  });
  refreshProfileVersionSurface(elements);
}

function initVersionSwitcherSurface(elements) {
  initVersionSwitcherModule(elements);
}

function initThemeQuickSwitcherModule() {
  if (!(themeQuickToggle instanceof HTMLButtonElement)) return;
  if (themeQuickToggle.dataset.bound === "true") {
    refreshThemeQuickToggleModule();
    return;
  }
  themeQuickToggle.dataset.bound = "true";
  themeQuickToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    themeQuickMenu?.classList.toggle("is-hidden");
  });
  themeQuickMenu?.querySelectorAll("[data-theme-mode]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const nextMode = String(button.getAttribute("data-theme-mode") || "system").trim().toLowerCase();
      updatePanelBehaviorSettings((current) => ({
        ...current,
        appearance: {
          ...(current.appearance || {}),
          theme_mode: ["system", "dark", "light"].includes(nextMode) ? nextMode : "system"
        }
      }));
      themeQuickMenu?.classList.add("is-hidden");
    });
  });
  document.addEventListener("click", () => {
    themeQuickMenu?.classList.add("is-hidden");
  });
  refreshThemeQuickToggleModule();
}

function mountVersionSwitcherSurfaceModule() {
  initVersionSwitcherSurface({
    versionToggle,
    versionMenu,
    versionList,
    versionCurrentLabel,
    versionHero,
    versionHighlights,
    versionTechSummary
  });
}

function initVersionSwitcher() {
  mountVersionSwitcherSurfaceModule();
  initThemeQuickSwitcherModule();
}

function refreshProfilePanelsAndVersionSurfaceModule() {
  renderProfilePanel();
  refreshProfileVersionSurface({
    versionToggle,
    versionMenu,
    versionList,
    versionCurrentLabel,
    versionHero,
    versionHighlights,
    versionTechSummary
  });
}

function refreshProfilePanelsAndVersionSurface() {
  refreshProfilePanelsAndVersionSurfaceModule();
}

window.refreshThemeQuickToggleModule = Object.assign(refreshThemeQuickToggleModule, {
  __moduleImpl: refreshThemeQuickToggleModule
});
