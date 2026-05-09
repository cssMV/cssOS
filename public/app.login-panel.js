const loginPanelT =
  typeof globalThis.t === "function"
    ? globalThis.t.bind(globalThis)
    : (key) => String(key || "");
const loginPanelLoginCopy =
  typeof globalThis.loginCopy === "function"
    ? globalThis.loginCopy.bind(globalThis)
    : (en, zh) => {
        const locale = String(globalThis.currentLocale || navigator.language || "en").toLowerCase();
        return locale.startsWith("zh") ? (zh || en || "") : (en || zh || "");
      };
const loginPanelHasPanelPermission =
  typeof globalThis.hasPanelPermission === "function"
    ? globalThis.hasPanelPermission.bind(globalThis)
    : () => true;
const loginPanelRequiredPanelIds =
  globalThis.loginPanelRequiredPanelIds instanceof Set ? globalThis.loginPanelRequiredPanelIds : new Set();
/* CSSOS_WAVE_98C_IOS_NATIVE_OAUTH 20260508 — Jing
 * Helpers used by the login card click handler when the page is
 * running inside the iOS Capacitor app (WKWebView). Web browser
 * users hit none of these — they fall through to the existing
 * `window.location.href = platform.url` redirect. */
function isIosNativeAppModule() {
  try {
    const cap = globalThis.Capacitor;
    if (!cap) return false;
    const isNative =
      typeof cap.isNativePlatform === "function"
        ? cap.isNativePlatform()
        : Boolean(cap.isNative);
    const platform =
      typeof cap.getPlatform === "function" ? cap.getPlatform() : "";
    return Boolean(isNative) && platform === "ios";
  } catch (_) {
    return false;
  }
}

async function iosNativeAppleSignInModule() {
  try {
    const cap = globalThis.Capacitor;
    if (!cap || typeof cap.Plugins !== "object") return false;
    const plugin = cap.Plugins.SignInWithApple;
    if (!plugin || typeof plugin.authorize !== "function") {
      console.warn("[ios-apple] SignInWithApple plugin missing — run `npx cap sync ios`");
      showToast(loginPanelLoginCopy(
        "Apple sign-in plugin missing (run cap sync).",
        "Apple 登录插件缺失（需运行 cap sync）。",
      ));
      return false;
    }
    const result = await plugin.authorize({
      clientId: "app.cssstudio.app",
      redirectURI: "https://cssstudio.app/auth/apple/callback",
      scopes: "email name",
      state: Math.random().toString(36).slice(2),
    });
    const resp = result && (result.response || result);
    const idToken = resp && resp.identityToken;
    if (!idToken) {
      console.warn("[ios-apple] no identityToken in response", result);
      showToast(loginPanelLoginCopy("Apple sign-in returned no token.", "Apple 登录未返回令牌。"));
      return false;
    }
    const r = await fetch("/auth/apple/native", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        identityToken: idToken,
        email: resp.email || null,
        fullName: resp.fullName || null,
      }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || j.ok !== true) {
      console.warn("[ios-apple] backend rejected token", { status: r.status, body: j });
      const detail = (j && (j.error || j.code)) || `http_${r.status}`;
      showToast(loginPanelLoginCopy(
        `Apple sign-in failed: ${detail}`,
        `Apple 登录失败：${detail}`,
      ));
      return false;
    }
    // Refresh app session so the rest of the UI picks up the new user
    try {
      window.location.replace("/");
    } catch (_) {
      window.location.href = "/";
    }
    return true;
  } catch (err) {
    // User-cancelled errors are normal — silently fall through.
    const msg = String(err && (err.message || err)).toLowerCase();
    if (msg.includes("cancel")) return true;
    console.warn("[ios-apple] sign-in error", err);
    const m = String(err && (err.message || err)).slice(0, 80);
    showToast(loginPanelLoginCopy(
      `Apple sign-in error: ${m}`,
      `Apple 登录错误：${m}`,
    ));
    return false;
  }
}

async function iosOpenSystemBrowserModule(url) {
  try {
    const cap = globalThis.Capacitor;
    if (!cap || typeof cap.Plugins !== "object") return false;
    const browser = cap.Plugins.Browser;
    if (!browser || typeof browser.open !== "function") return false;
    // Tag the request so the backend (or our own callback page) can
    // route the success redirect to /auth/return — a Universal Link
    // that iOS hands straight back to the installed app.
    const sep = url.includes("?") ? "&" : "?";
    const tagged = `${url}${sep}intent=ios-app`;
    await browser.open({
      url: tagged,
      presentationStyle: "popover",
      windowName: "_self",
    });
    return true;
  } catch (err) {
    console.warn("[ios-oauth] Browser.open failed", err);
    return false;
  }
}

function getPlatformLabelModule(platformId) {
  const locale = PLATFORM_LABELS[currentLocale] ? currentLocale : DEFAULT_LOCALE;
  return getPlatformLabelFromMap(locale, platformId);
}

function isSocialEnabledModule(platformId) {
  if (!SOCIAL_KEYS) return false;
  const direct = SOCIAL_KEYS[platformId];
  if (direct) return true;
  const upper = platformId.toUpperCase();
  if (SOCIAL_KEYS[upper]) return true;
  const snake = platformId.replace(/-/g, "_").toUpperCase();
  return Boolean(SOCIAL_KEYS[snake]);
}

function logoSlugForModule(platformId) {
  const map = {
    apple: "apple",
    behance: "behance",
    discord: "discord",
    dribbble: "dribbble",
    facebook: "facebook",
    github: "github",
    gitlab: "gitlab",
    google: "google",
    instagram: "instagram",
    kakaotalk: "kakaotalk",
    line: "line",
    linkedin: "linkedin",
    medium: "medium",
    pinterest: "pinterest",
    reddit: "reddit",
    slack: "slack",
    stackoverflow: "stackoverflow",
    telegram: "telegram",
    tiktok: "tiktok",
    twitch: "twitch",
    wechat: "wechat",
    weibo: "sinaweibo",
    whatsapp: "whatsapp",
    x: "x"
  };
  return map[platformId] || platformId;
}

function logoColorForModule(platformId) {
  const map = {
    apple: "ffffff",
    github: "ffffff",
    x: "ffffff",
    tiktok: "ffffff",
    google: "4285f4",
    facebook: "1877f2",
    wechat: "07c160"
  };
  return map[platformId] || "";
}

function providerLogoHtmlModule(platformId, fallbackText) {
  if (platformId === "bsky") {
    return '<span class="login-logo-glyph bsky">🦋</span>';
  }
  if (platformId === "linkedin") {
    return '<span class="login-logo-glyph brand-text">in</span>';
  }
  if (platformId === "slack") {
    return '<span class="login-logo-glyph brand-text">sl</span>';
  }
  const slug = logoSlugForModule(platformId);
  const color = logoColorForModule(platformId);
  const src = `https://cdn.simpleicons.org/${slug}${color ? `/${color}` : ""}`;
  return `<img src="${src}" alt="${platformId}" class="login-logo" loading="lazy" referrerpolicy="no-referrer" /><span class="login-logo-fallback">${fallbackText}</span>`;
}

function providerLogoOnlyModule(platformId) {
  if (!platformId) return '<span class="login-logo-glyph">?</span>';
  if (platformId === "bsky") return '<span class="login-logo-glyph bsky">🦋</span>';
  if (platformId === "linkedin") return '<span class="login-logo-glyph brand-text">in</span>';
  if (platformId === "slack") return '<span class="login-logo-glyph brand-text">sl</span>';
  const slug = logoSlugForModule(platformId);
  const color = logoColorForModule(platformId);
  const src = `https://cdn.simpleicons.org/${slug}${color ? `/${color}` : ""}`;
  return `<img src="${src}" alt="${platformId}" class="login-source-logo" loading="lazy" referrerpolicy="no-referrer" />`;
}

function renderLoginPlatformsModule() {
  if (!loginList) return;
  loginList.innerHTML = "";
  const behavior = readPanelBehaviorSettingsLocal();
  const enabledMap = new Map(
    authProviders.map((provider) => [
      provider.id,
      {
        enabled: provider.enabled,
        url: provider.url,
        icon: provider.icon,
        logo: provider.logo_url
      }
    ])
  );
  const linkedProviders = new Set(authState.linkedProviders || []);
  const list = socialPlatforms.map((platform) => {
    const record = enabledMap.get(platform.id);
    const logo = record?.logo;
    const isLinked = linkedProviders.has(platform.id);
    const iconHtml = logo
      ? `<img src="${logo}" alt="${platform.id}" class="login-logo" />`
      : providerLogoHtmlModule(platform.id, record?.icon || platform.icon);
    const actionLabel = authState.user
      ? isLinked
        ? loginPanelLoginCopy("Linked", "已绑定")
        : loginPanelLoginCopy("Switch account", "切换账号")
      : record?.enabled
        ? loginPanelLoginCopy("Sign in", "登录")
        : loginPanelLoginCopy("Unavailable", "未开放");
    return {
      id: platform.id,
      icon: iconHtml,
      enabled: record?.enabled ?? isSocialEnabledModule(platform.id),
      url: record?.url || (record?.enabled ? `/auth/${platform.id}` : ""),
      linked: isLinked,
      active: authState.loginProvider === platform.id,
      actionLabel
    };
  });

  const summary = document.createElement("div");
  summary.className = "login-summary";
  if (authState.user) {
    const sourceProvider = authState.loginProvider || "";
    const sourceLabel = sourceProvider ? getPlatformLabelModule(sourceProvider) : loginPanelLoginCopy("Unknown", "未知");
    const linkedList = Array.from(linkedProviders).filter((providerId) => providerId !== "passkey");
    const linkedText = linkedList.length
      ? linkedList.map((providerId) => getPlatformLabelModule(providerId)).join(" · ")
      : loginPanelLoginCopy("No social provider linked yet", "还没有绑定社交账号");
    const label = authState.user.name || authState.user.email || authState.user.id || "";
    const sessionDays = Number(authState.sessionDays || behavior.login.session_days || 90);
    summary.innerHTML = `
      <div class="login-source-card">
        <div class="login-source-badge">${providerLogoOnlyModule(sourceProvider)}</div>
        <div class="login-me-meta">
          <div class="login-me-title">${loginPanelLoginCopy("Current source platform", "当前来源平台")}</div>
          <div class="login-me-source-name">${sourceLabel}</div>
          <div class="login-me-user">${label}</div>
          <div class="login-me-linked">${loginPanelLoginCopy("Connected:", "已连接：")} ${linkedText}</div>
          <div class="login-switch-hint">${loginPanelLoginCopy(`Session window: ${sessionDays} days. Linked platforms can switch instantly without signing in again.`, `会话窗口：${sessionDays} 天。已绑定平台可直接切换，无需再次登录。`)}</div>
          <div class="work-actions" style="margin-top:12px;">
            <button class="mini-btn ghost" type="button" data-login-open-subscription>${loginPanelLoginCopy("Membership and upgrade", "会员与升级")}</button>
          </div>
        </div>
      </div>
    `;
  } else {
    const githubDiag = authState.authDiagnostics;
    const githubHint = githubDiag
      ? githubDiag.enabled
        ? t("login.githubDiagReady").replace(
            "{callback}",
            githubDiag.callback_url || "https://cssstudio.app/auth/github/callback"
          )
        : t("login.githubDiagMissing").replace(
            "{missing}",
            Array.isArray(githubDiag.missing_env) && githubDiag.missing_env.length
              ? githubDiag.missing_env.join(", ")
              : "unknown"
          )
      : "";
    summary.innerHTML = `
      <div class="login-hint">
        ${loginPanelLoginCopy("Choose a social account to continue. After sign-in, this panel will show your connected providers.", "选择一个社交账号登录。登录后，这里会显示你已绑定的平台和账号状态。")}
        ${githubHint ? `<div class="login-diagnostic-hint">${escapeHtml(githubHint)}</div>` : ""}
        <div class="work-actions" style="margin-top:12px;">
          <button class="mini-btn ghost" type="button" data-login-open-subscription>${loginPanelLoginCopy("View plans first", "先看会员方案")}</button>
        </div>
      </div>
    `;
  }
  loginList.appendChild(summary);
  summary.querySelector("[data-login-open-subscription]")?.addEventListener("click", () => {
    openSubscriptionPanelModule?.();
  });

  const preferred = behavior.login.preferred_provider;
  const orderedList = [...(authState.user
    ? [...list].sort((a, b) => Number(a.linked) - Number(b.linked))
    : list)].sort((a, b) => {
      if (a.id === preferred && b.id !== preferred) return -1;
      if (b.id === preferred && a.id !== preferred) return 1;
      return 0;
    });

  orderedList.forEach((platform) => {
    const enabled = Boolean(platform.enabled);
    const canSwitchProvider = loginPanelHasPanelPermission("login.provider.switch");
    const canUnlinkProvider = loginPanelHasPanelPermission("login.provider.unlink");
    const isClickableLink = enabled && !authState.user && !!platform.url;
    const card = document.createElement(isClickableLink ? "a" : "div");
    const stateClass = platform.linked ? "linked" : enabled ? "enabled" : "disabled";
    if (isClickableLink) {
      card.href = platform.url;
    } else {
      card.tabIndex = enabled ? 0 : -1;
      card.setAttribute("role", "button");
      card.setAttribute("aria-disabled", enabled ? "false" : "true");
      card.addEventListener("click", async (event) => {
        if (event.target instanceof Element && event.target.closest(".login-unlink-btn")) return;
        if (!enabled) return;
        if (platform.id === "bsky") {
          openBlueskyLoginModalModule(platform);
          return;
        }
        if (authState.user && platform.linked) {
          if (!canSwitchProvider) return;
          await switchLinkedProvider(platform.id);
          return;
        }
        if (platform.url) {
          // CSSOS_WAVE_98C_IOS_NATIVE_OAUTH 20260508 — Jing
          // Inside the iOS Capacitor WebView, Google (and others) block
          // OAuth on UA-detected WKWebViews and cookies aren't shared
          // with system Safari, so a plain `location.href = ...` flow
          // breaks. Route Apple through the native ASAuthorization API
          // and everything else through SFSafariViewController, which
          // returns to the app via a Universal Link.
          // CSSOS_DIAG_IOS_NATIVE 20260508 — Jing
          const cap = globalThis.Capacitor;
          console.log("[ios-diag] platform=" + platform.id, {
            hasCapacitor: !!cap,
            isNative: cap && typeof cap.isNativePlatform === "function" ? cap.isNativePlatform() : null,
            getPlatform: cap && typeof cap.getPlatform === "function" ? cap.getPlatform() : null,
            plugins: cap && cap.Plugins ? Object.keys(cap.Plugins) : null,
            isIosNative: isIosNativeAppModule(),
          });
          if (isIosNativeAppModule()) {
            if (platform.id === "apple") {
              const ok = await iosNativeAppleSignInModule();
              if (ok) return;
              // fall through to web flow if native sign-in failed
            }
            const opened = await iosOpenSystemBrowserModule(platform.url);
            if (opened) return;
          }
          window.location.href = platform.url;
        }
      });
      card.addEventListener("keydown", async (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        card.click();
      });
    }
    card.className = `login-card ${stateClass}${platform.active ? " active" : ""}`;
    card.innerHTML = `
      <div class="login-icon">${platform.icon}</div>
      <div class="login-title-wrap">
        <div class="login-title">${getPlatformLabelModule(platform.id)}</div>
        <div class="login-action-tag">${platform.active ? loginPanelLoginCopy("Current session", "当前会话") : platform.linked ? loginPanelLoginCopy("Tap to switch", "点击切换") : platform.actionLabel}</div>
      </div>
      ${platform.linked && authState.user && !platform.active && canUnlinkProvider ? `<button class="cta ghost tiny login-unlink-btn" type="button" data-provider="${platform.id}">${loginPanelLoginCopy("Unlink", "解绑")}</button>` : ""}
    `;
    loginList.appendChild(card);
  });
}

async function fetchMeModule() {
  try {
    const previousUserId = String(authState.user?.id || "").trim();
    const res = await fetch("/api/me", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    const meData = data?.data || data || {};
    authState.user = meData.user || null;
    authState.loginProvider = meData.auth_provider || null;
    authState.sessionDays = Number(meData.session_days || authState.sessionDays || 90);
    authState.sessionExpiresAt = meData.session_expires_at || null;
    authState.role = meData.role || DEFAULT_ROLE;
    authState.tier = meData.tier || authState.role || DEFAULT_ROLE;
    authState.permissionSnapshot = meData.permission_snapshot && typeof meData.permission_snapshot === "object"
      ? meData.permission_snapshot
      : null;
    if (authState.user?.email) {
      const normalizedEmail = String(authState.user.email).trim().toLowerCase();
      if (SYSTEM_ADMIN_EMAILS.has(normalizedEmail)) {
        authState.role = "admin";
        authState.tier = "admin";
      }
    }
    if (authState.user) {
      const profileRes = await fetch("/api/profile", { credentials: "include" });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        const linkedData = profileData?.data || profileData || {};
        authState.linkedProviders = Array.isArray(linkedData?.linked_auth?.providers)
          ? linkedData.linked_auth.providers
          : [];
        if (linkedData?.permission_snapshot && typeof linkedData.permission_snapshot === "object") {
          authState.permissionSnapshot = linkedData.permission_snapshot;
        }
      }
    } else {
      authState.linkedProviders = [];
      authState.loginProvider = null;
      authState.sessionExpiresAt = null;
      authState.permissionSnapshot = null;
    }
    watchCommerceState.loaded = false;
    watchCommerceState.loading = false;
    watchCommerceState.payload = null;
    watchCommerceState.error = null;
    updateLoginUI();
    renderLoginPlatforms();
    broadcastProfileRefresh({ includeProfile: false, includeVersion: false, includeWorks: true });
    renderApiBillingPanel();
    renderCreationConsole();
    await hydrateBehaviorDefaultsFromServer(true);
    await hydratePanelDefaultsFromServer(true);
    await renderAdvancedPanelSettings();
    await handleStripeCheckoutReturn();
    await loadCreationPanelDefaults(true);
    fetchBillingStatus();
    maybeOpenSubscriptionOnboardingModule(previousUserId);
  } catch (_err) {
    // ignore
  }
}

async function fetchMe() {
  return fetchMeModule();
}

function updateLoginUIModule() {
  if (loginStatus) {
    loginStatus.textContent = authState.user ? t("login.statusSigned") : t("login.statusGuest");
  }
  if (loginUser) {
    if (authState.user) {
      const label = authState.user.name || authState.user.email || authState.user.id;
      loginUser.textContent = label || "";
    } else {
      loginUser.textContent = "";
    }
  }
  if (loginLogout) {
    const behavior = readPanelBehaviorSettingsLocal();
    loginLogout.style.display = loginPanelHasPanelPermission("login.logout") && behavior.login.show_logout ? "inline-flex" : "none";
  }
  broadcastProfileRefresh();
  updateDockVisibility();
  syncDeliveryDashboardActionPermissions();
  panels.forEach((panel) => {
    if (panel?.classList.contains("show-settings") && typeof panel.__refreshSettings === "function") {
      panel.__refreshSettings();
    }
  });
}

function updateLoginUI() {
  updateLoginUIModule();
}

function maybeOpenSubscriptionOnboardingModule(previousUserId = "") {
  const userId = String(authState.user?.id || "").trim();
  if (!userId) return false;
  const prior = String(previousUserId || "").trim();
  const tier = String(authState.tier || authState.role || DEFAULT_ROLE).trim().toLowerCase();
  if (!["guest", "free", "starter", "basic", ""].includes(tier)) return false;
  const storageKey = `cssos.subscriptionOnboardingSeen.${userId}`;
  const alreadySeen = globalThis.localStorage?.getItem(storageKey) === "1";
  const isFreshLogin = userId !== prior;
  if (!isFreshLogin || alreadySeen) return false;
  globalThis.localStorage?.setItem(storageKey, "1");
  setTimeout(() => {
    if (typeof openSubscriptionPanelModule === "function") {
      openSubscriptionPanelModule();
      showToast?.(loginPanelLoginCopy(
        "Start here for membership plans, upgrade lanes, and Creator Boost.",
        "先从这里查看会员方案、升级队列和 Creator Boost。"
      ));
    }
  }, 180);
  return true;
}

async function fetchAuthProvidersModule() {
  try {
    const res = await fetch("/api/auth/providers", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    authProviders = Array.isArray(data?.data?.providers)
      ? data.data.providers
      : Array.isArray(data?.providers)
        ? data.providers
        : [];
    const diagRes = await fetch("/api/auth/diagnostics?provider=github", { credentials: "include" });
    if (diagRes.ok) {
      const diagData = await diagRes.json();
      authState.authDiagnostics = diagData?.data?.diagnostic || null;
    }
    renderLoginPlatforms();
  } catch (_err) {
    // ignore
  }
}

async function fetchAuthProviders() {
  return fetchAuthProvidersModule();
}

async function unlinkProviderModule(providerId) {
  if (!providerId || !authState.user) return;
  if (authState.loginProvider === providerId) {
    showToast(loginPanelLoginCopy("Current session provider can't be unlinked here.", "当前会话来源平台不能在这里解绑。"));
    return;
  }
  try {
    const res = await fetch("/api/profile/unlink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ provider: providerId })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.ok === false) {
      const code = data?.code || "";
      if (code === "CANNOT_UNLINK_LAST_METHOD") {
        showToast(loginPanelLoginCopy("Keep at least one login method.", "请至少保留一种登录方式。"));
      } else {
        showToast(loginPanelLoginCopy("Unlink failed.", "解绑失败。"));
      }
      return;
    }
    if (authState.loginProvider === providerId) {
      authState.loginProvider = authState.linkedProviders.find((id) => id !== providerId) || null;
    }
    await fetchMe();
    showToast(loginPanelLoginCopy("Provider unlinked.", "已解绑该平台。"));
  } catch (_err) {
    showToast(loginPanelLoginCopy("Unlink failed.", "解绑失败。"));
  }
}

async function unlinkProvider(providerId) {
  return unlinkProviderModule(providerId);
}

async function switchLinkedProviderModule(providerId) {
  if (!providerId || !authState.user) return;
  if (authState.loginProvider === providerId) return;
  try {
    const res = await fetch("/api/profile/switch-provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ provider: providerId })
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.ok === false) {
      showToast(loginPanelLoginCopy("Unable to switch platform.", "暂时无法切换平台。"));
      return;
    }
    await fetchMe();
    showToast(loginPanelLoginCopy("Platform switched.", "平台已切换。"));
  } catch (_err) {
    showToast(loginPanelLoginCopy("Unable to switch platform.", "暂时无法切换平台。"));
  }
}

async function switchLinkedProvider(providerId) {
  return switchLinkedProviderModule(providerId);
}

async function updateSessionPolicyModule(days) {
  try {
    const res = await fetch("/api/profile/session-policy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ days })
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.ok === false) {
      showToast(loginPanelLoginCopy("Session policy update failed.", "会话时长更新失败。"));
      return;
    }
    authState.sessionDays = Number(payload?.data?.session_days || days || authState.sessionDays || 90);
    authState.sessionExpiresAt = payload?.data?.session_expires_at || authState.sessionExpiresAt;
    renderLoginPlatforms();
  } catch (_err) {
    showToast(loginPanelLoginCopy("Session policy update failed.", "会话时长更新失败。"));
  }
}

async function updateSessionPolicy(days) {
  return updateSessionPolicyModule(days);
}

function canOpenPanelByIdModule(panelId) {
  if (!panelId) return true;
  if (panelId === "api-panel") return loginPanelHasPanelPermission("api.docs.view");
  if (panelId === "login-panel") return loginPanelHasPanelPermission("login.open");
  if (panelId === "subscription-panel") return true;
  if (panelId === "credit-panel") return isLoggedInUser();
  if (panelId === "workspaces-panel") return isLoggedInUser();
  if (panelId === "seller-panel") return loginPanelHasPanelPermission("seller.view");
  if (panelId === "works-panel") return true;
  if (panelId === "profile-panel") return loginPanelHasPanelPermission("profile.open");
  if (panelId === "user-admin-panel") return isLoggedInUser();
  if (panelId === "delivery-reports-panel") return loginPanelHasPanelPermission("reports.open");
  if (panelId === "delivery-ops-panel") return loginPanelHasPanelPermission("reports.open");
  if (panelId === "cssmv-panel") return loginPanelHasPanelPermission("cssmv.open");
  return !loginPanelRequiredPanelIds.has(panelId) || isLoggedInUser();
}

function canOpenPanelById(panelId) {
  return canOpenPanelByIdModule(panelId);
}

function ensureBlueskyLoginModalModule() {
  let modal = document.getElementById("bsky-login-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "bsky-login-modal";
  modal.className = "provider-login-modal hidden";
  modal.innerHTML = `
    <div class="provider-login-dialog bsky-login-dialog">
      <div class="provider-login-brand">
        <div class="provider-login-brand-icon">🦋</div>
        <div>
          <div class="provider-login-brand-title">Bluesky</div>
          <div class="provider-login-brand-copy">${loginPanelLoginCopy("Mirror the social sign-in flow, then return here.", "高仿社交登录窗口，登录后会自动返回这里。")}</div>
        </div>
      </div>
      <label class="provider-login-field">
        <span>${loginPanelLoginCopy("Handle", "账号")}</span>
        <input type="text" data-bsky-handle placeholder="name.bsky.social" />
      </label>
      <label class="provider-login-field">
        <span>${loginPanelLoginCopy("App password", "应用密码")}</span>
        <input type="password" data-bsky-password placeholder="${loginPanelLoginCopy("App password", "应用密码")}" />
      </label>
      <div class="provider-login-actions">
        <button class="cta ghost tiny" type="button" data-bsky-oauth>${loginPanelLoginCopy("Use OAuth", "使用 OAuth")}</button>
        <button class="cta ghost tiny" type="button" data-bsky-close>${loginPanelLoginCopy("Close", "关闭")}</button>
        <button class="cta tiny" type="button" data-bsky-submit>${loginPanelLoginCopy("Sign in", "登录")}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-bsky-close]")) {
      modal.classList.add("hidden");
    }
  });
  modal.querySelector("[data-bsky-oauth]")?.addEventListener("click", () => {
    window.location.href = "/auth/bsky";
  });
  modal.querySelector("[data-bsky-submit]")?.addEventListener("click", async () => {
    const handle = modal.querySelector("[data-bsky-handle]")?.value?.trim();
    const appPassword = modal.querySelector("[data-bsky-password]")?.value?.trim();
    if (!handle || !appPassword) {
      showToast(loginPanelLoginCopy("Enter your Bluesky handle and app password.", "请输入 Bluesky 账号和应用密码。"));
      return;
    }
    try {
      const res = await fetch("/auth/bluesky", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ handle, app_password: appPassword })
      });
      if (res.ok) {
        modal.classList.add("hidden");
        await fetchMe();
      } else {
        showToast(loginPanelLoginCopy("Bluesky sign-in failed.", "Bluesky 登录失败。"));
      }
    } catch (_err) {
      showToast(loginPanelLoginCopy("Bluesky sign-in failed.", "Bluesky 登录失败。"));
    }
  });
  return modal;
}

function openBlueskyLoginModalModule(platform = {}) {
  if (platform && !platform.enabled) return;
  const modal = ensureBlueskyLoginModalModule();
  modal?.classList.remove("hidden");
}

Object.assign(globalThis, {
  getPlatformLabel: getPlatformLabelModule,
  isSocialEnabled: isSocialEnabledModule,
  logoSlugFor: logoSlugForModule,
  logoColorFor: logoColorForModule,
  providerLogoHtml: providerLogoHtmlModule,
  providerLogoOnly: providerLogoOnlyModule,
  renderLoginPlatforms: renderLoginPlatformsModule
});
