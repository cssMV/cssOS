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
    const r = await fetch("/api/auth/apple/native", {
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

/* CSSOS_WAVE_435 20260525 — Jing: 禁止第三方 CDN (cdn.simpleicons.org).
 * 5 个登录 provider 图标改为内联 SVG data URI，零外部依赖。
 * SVG path data 来自 simple-icons v13（MIT license）。
 * 颜色直接写入 fill 属性，与原 cdn.simpleicons.org/{slug}/{color} 等效。 */
const _INLINE_LOGOS = {
  apple: (color) => `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23${color || "ffffff"}' d='M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.054 9.102 1.52 12.082 1.004 1.458 2.208 3.09 3.792 3.032 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.402-2.376-2-.156-3.675 1.09-4.6 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701'/%3E%3C/svg%3E`,
  google: (color) => `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23${color || "4285f4"}' d='M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z'/%3E%3C/svg%3E`,
  facebook: (color) => `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23${color || "1877f2"}' d='M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z'/%3E%3C/svg%3E`,
  github: (color) => `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23${color || "ffffff"}' d='M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'/%3E%3C/svg%3E`,
  x:      (color) => `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23${color || "ffffff"}' d='M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z'/%3E%3C/svg%3E`,
};

function logoColorForModule(platformId) {
  const map = {
    apple: "000000",
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
  const color = logoColorForModule(platformId);
  if (_INLINE_LOGOS[platformId]) {
    const src = _INLINE_LOGOS[platformId](color);
    return `<img src="${src}" alt="${platformId}" class="login-logo" /><span class="login-logo-fallback">${fallbackText}</span>`;
  }
  // Fallback for any non-inlined provider: text glyph, no external request.
  return `<span class="login-logo-glyph brand-text">${(fallbackText || platformId).slice(0, 2).toUpperCase()}</span><span class="login-logo-fallback">${fallbackText}</span>`;
}

function providerLogoOnlyModule(platformId) {
  if (!platformId) return '<span class="login-logo-glyph">?</span>';
  if (platformId === "bsky") return '<span class="login-logo-glyph bsky">🦋</span>';
  if (platformId === "linkedin") return '<span class="login-logo-glyph brand-text">in</span>';
  if (platformId === "slack") return '<span class="login-logo-glyph brand-text">sl</span>';
  const color = logoColorForModule(platformId);
  if (_INLINE_LOGOS[platformId]) {
    const src = _INLINE_LOGOS[platformId](color);
    return `<img src="${src}" alt="${platformId}" class="login-source-logo" />`;
  }
  return `<span class="login-logo-glyph brand-text">${platformId.slice(0, 2).toUpperCase()}</span>`;
}

// logoSlugForModule kept for external callers (harmless, no CDN request).
function logoSlugForModule(platformId) {
  const map = {
    apple:"apple",behance:"behance",discord:"discord",dribbble:"dribbble",
    facebook:"facebook",github:"github",gitlab:"gitlab",google:"google",
    instagram:"instagram",kakaotalk:"kakaotalk",line:"line",linkedin:"linkedin",
    medium:"medium",pinterest:"pinterest",reddit:"reddit",slack:"slack",
    stackoverflow:"stackoverflow",telegram:"telegram",tiktok:"tiktok",
    twitch:"twitch",wechat:"wechat",weibo:"sinaweibo",x:"x"
  };
  return map[platformId] || platformId;
}

function renderLoginPlatformsModule() {
  if (!loginList) return;
  loginList.innerHTML = "";
  const _summaryHost = document.getElementById("login-summary-host");
  if (_summaryHost) _summaryHost.innerHTML = "";
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
  /* CSSOS_WAVE_236c 20260519 — Jing: 显式 ALLOWLIST.
   * 之前用 enabledMap.get(id).enabled 过滤, 实测有 provider 在
   * authState.providers 里 enabled=true 但其实路径没打通的情况,
   * 还是会渲染出 "Unavailable" 标签. 改为白名单: 只有这 5 个
   * 一定渲染, 其他不管 enabledMap 怎么说一律不渲染.
   * App Store 截图 + 用户体验都干净. */
  /* CSSOS_WAVE_815 20260616 — Jing 真机: iOS 上 Google/Facebook/X/GitHub 的
   * OAuth 全失败(系统 Safari 报 400 malformed / auth_failed —— redirect_uri
   * 等未对 App 配好),只有 Apple 原生登录可用。坏的第三方登录 = Apple 2.1
   * 坏功能 + 死胡同。iOS 原生只显示 Apple 登录(+ 邮箱表单,另处);Apple 4.8
   * 仅要求"有 Apple 登录"即合规。Web 不变(仍 5 家)。OAuth 修通后再放开。 */
  var _iosNativeLogin = (function () {
    try {
      if (document.documentElement.getAttribute("data-ios-native") === "1") return true;
      if (typeof globalThis.cssosIsIosNative === "function" && globalThis.cssosIsIosNative()) return true;
      var cap = globalThis.Capacitor;
      return !!(cap && typeof cap.getPlatform === "function" && cap.getPlatform() === "ios"
        && (typeof cap.isNativePlatform !== "function" || cap.isNativePlatform()));
    } catch (_e) { return false; }
  })();
  var _PROVIDER_ALLOW = new Set(_iosNativeLogin ? ["apple"] : ["google", "apple", "facebook", "github", "x"]);
  /* CSSOS_WAVE_541 20260531 — Jing: App 端社交平台空框根因 = WKWebView 旧 SW 缓存
   * 让 window.CSSOS_I18N_PLATFORMS 拿到空/旧数组, socialPlatforms.filter 后 rendered=0,
   * 清空 loginList 后什么都不渲染。修法: 实时从 global 取数组 + 白名单 id 兜底,
   * 保证这 5 个永远出现(标签仍走 loginPanelLoginCopy, 不硬编码可翻译文案)。 */
  var _ALLOW_ORDER = _iosNativeLogin ? ["apple"] : ["google", "apple", "facebook", "github", "x"];
  var _srcPlatforms = [];
  try {
    var _g = (window.CSSOS_I18N_PLATFORMS && window.CSSOS_I18N_PLATFORMS.socialPlatforms) || socialPlatforms;
    if (Array.isArray(_g)) _srcPlatforms = _g;
  } catch (_e0) {}
  var _byId = Object.create(null);
  _srcPlatforms.forEach(function (p) { if (p && p.id) _byId[p.id] = p; });
  // 兜底: 即使源数组为空, 也按白名单 id 顺序合成最小平台对象(icon 由 providerLogoHtmlModule 兜底)。
  var _filteredPlatforms = _ALLOW_ORDER
    .filter(function (id) { return _PROVIDER_ALLOW.has(id); })
    .map(function (id) { return _byId[id] || { id: id, icon: "", comingSoon: false }; });
  try {
    console.info("[login-panel][W541] allow=" + _ALLOW_ORDER.join(",") + " src=" + _srcPlatforms.length + " rendered=" + _filteredPlatforms.length);
  } catch (_e) {}
  const list = _filteredPlatforms.map((platform) => {
    const record = enabledMap.get(platform.id);
    const logo = record?.logo;
    const isLinked = linkedProviders.has(platform.id);
    const iconHtml = logo
      ? `<img src="${logo}" alt="${platform.id}" class="login-logo" />`
      : providerLogoHtmlModule(platform.id, record?.icon || platform.icon);
    // CSSOS_WAVE_107C 20260509 — Jing
    // Platforms flagged comingSoon in i18n/platforms.js (Instagram /
    // TikTok / Weibo) are rendered as a non-clickable "Coming soon"
    // pill regardless of what /api/auth/providers says, so we never
    // route a tap into a flow that's known to fail.
    const isComingSoon = Boolean(platform.comingSoon);
    const recordEnabled = isComingSoon ? false : Boolean(record?.enabled);
    const actionLabel = authState.user
      ? isLinked
        ? loginPanelLoginCopy("Linked", "已绑定")
        : recordEnabled
          ? loginPanelLoginCopy("Switch account", "切换账号")
          : isComingSoon
            ? loginPanelLoginCopy("Coming soon", "即将上线")
            : loginPanelLoginCopy("Unavailable", "未开放")
      : recordEnabled
        ? loginPanelLoginCopy("Sign in", "登录")
        : isComingSoon
          ? loginPanelLoginCopy("Coming soon", "即将上线")
          : loginPanelLoginCopy("Unavailable", "未开放");
    return {
      id: platform.id,
      icon: iconHtml,
      enabled: isComingSoon
        ? false
        : (record?.enabled ?? isSocialEnabledModule(platform.id)),
      url: isComingSoon
        ? ""
        : (record?.url || (record?.enabled ? `/auth/${platform.id}` : "")),
      linked: isLinked,
      active: authState.loginProvider === platform.id,
      actionLabel,
      comingSoon: isComingSoon
    };
  });

  const summary = document.createElement("div");
  summary.className = "login-summary";
  if (authState.user) {
    const label = authState.user.name || authState.user.email || authState.user.id || "";
    summary.innerHTML = `
      <div class="login-compact-summary">
        <span class="login-compact-label">${loginPanelLoginCopy("Signed in", "已登录")}</span>
        <span class="login-compact-user">${label}</span>
        <button class="mini-btn ghost" type="button" data-login-open-subscription style="margin-left:auto">${loginPanelLoginCopy("Membership", "会员")}</button>
      </div>
    `;
  } else {
    /* CSSOS_WAVE_236 20260519 — Jing: 登录页只留 "View plans first" 按钮,
     * 去掉 "Choose a social account..." 引导文案 + GitHub 诊断文案.
     * App Store 截图需要干净的登录页. */
    summary.innerHTML = `
      <div class="login-hint">
        <div class="work-actions">
          <button class="mini-btn ghost" type="button" data-login-open-subscription>${loginPanelLoginCopy("View plans first", "先看会员方案")}</button>
        </div>
      </div>
    `;
  }
  const summaryHost = document.getElementById("login-summary-host");
  (summaryHost || loginList).appendChild(summary);
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
    // CSSOS_FIX_IOS_NATIVE_LINK 20260508 — Jing
    // Inside the iOS Capacitor app we MUST go through the click
    // handler (which routes Apple → ASAuthorization, others →
    // SFSafariViewController). A bare <a href> bypasses all of
    // that and just navigates the WebView to appleid.apple.com,
    // which then bounces to external Safari with auth_failed.
    const isClickableLink = enabled && !authState.user && !!platform.url && !isIosNativeAppModule();
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
    // CSSOS_WAVE_874 — Jing: iOS 只有 Apple 一颗时, :only-child 选不中(同容器还有 SIGNED-IN/LOG OUT 兄弟),
    // 所以这里直接给【唯一一颗 provider 卡】打 .cssos-login-solo, CSS 让它铺满整行居中(全宽 Apple 主 CTA)。
    const _soloClass = orderedList.length === 1 ? " cssos-login-solo" : "";
    card.className = `login-card ${stateClass}${platform.active ? " active" : ""}${_soloClass}`;
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
  // CSSOS_WAVE_880 — Jing「不管什么方法, 我只要全宽」: 唯一一颗 Apple 卡的【宽度】用内联 !important 钉死。
  // 内联 !important 优先级高于任何样式表(含胶囊宪法的 !important)→ 一定全宽。只钉宽度/铺满, 不加任何美化。
  try {
    var _soloCard = loginList.querySelector(".login-card.cssos-login-solo");
    if (_soloCard) {
      _soloCard.style.setProperty("width", "100%", "important");
      _soloCard.style.setProperty("max-width", "100%", "important");
      _soloCard.style.setProperty("min-width", "0", "important");
      _soloCard.style.setProperty("margin", "0", "important");
      _soloCard.style.setProperty("grid-column", "1 / -1", "important");
      _soloCard.style.setProperty("justify-content", "center", "important");
      _soloCard.style.setProperty("-webkit-mask-image", "none", "important");
      _soloCard.style.setProperty("mask-image", "none", "important");
    }
  } catch (_eFull) {}
  // CSSOS_WAVE_207 20260516 — Jing: Apple App Review demo sign-in.
  // cssOS is OAuth-only by design; this is the ONE email+password path,
  // gated server-side by APP_REVIEW_DEMO_EMAIL + APP_REVIEW_DEMO_PASSWORD
  // env vars (W206). When the env is unset, the endpoint 503s and the
  // form silently shows "currently disabled" — so we can always leave
  // the UI shipping, and only the credentials toggle whether it works.
  // Collapsed by default; hidden when a user is already signed in.
  appendAppReviewDemoForm();
  // CSSOS_WAVE_459 20260527 — Jing: 激活胶囊居中滚入视口。
  // 居中的作用不只是美观：手机窄屏时最多显示 "左邻+激活+右邻" 三粒，
  // 使不相邻的非激活互压死区始终在屏幕外，绕开 W420 的点击死区问题。
  try {
    requestAnimationFrame(function () {
      var _active = loginList && loginList.querySelector(".login-card.active");
      if (_active && loginList.scrollWidth > loginList.clientWidth) {
        var _pl = _active.offsetLeft;
        var _pw = _active.offsetWidth;
        var _cl = loginList.clientWidth;
        loginList.scrollLeft = _pl - (_cl - _pw) / 2;
      }
    });
  } catch (_e) {}
}

function appendAppReviewDemoForm() {
  try {
    if (!loginList) return;
    if (authState && authState.user) return; // hide once signed in
    if (loginList.querySelector("[data-cssos-demo-login]")) return; // idempotent
    const wrap = document.createElement("details");
    wrap.className = "login-demo-wrap";
    wrap.setAttribute("data-cssos-demo-login", "1");
    wrap.style.cssText = "margin-top:18px;padding:10px 12px;border:1px dashed rgba(255,255,255,0.12);border-radius:10px;background:rgba(255,255,255,0.02);";
    const titleEn = "App Review demo sign-in";
    const titleZh = "应用审核入口";
    wrap.innerHTML = [
      `<summary style="cursor:pointer;font:600 12px/1.3 ui-monospace,monospace;color:rgba(255,255,255,0.55);letter-spacing:0.06em;text-transform:uppercase;list-style:none;">`,
      `  ${loginPanelLoginCopy(titleEn, titleZh)}`,
      `</summary>`,
      `<div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">`,
      `  <div style="font-size:11.5px;line-height:1.5;color:rgba(255,255,255,0.5);">`,
      `    ${loginPanelLoginCopy(
        "Apple App Reviewers only. Production sign-in goes through Apple / Google / GitHub / etc. above.",
        "仅供 Apple 审核员使用。普通登录请用上方的 Apple / Google / GitHub 等。"
      )}`,
      `  </div>`,
      `  <input type="email" data-cssos-demo-email autocomplete="email" placeholder="${escapeAttr(loginPanelLoginCopy("Email", "邮箱"))}" `,
      `         style="background:rgba(0,0,0,0.32);border:1px solid rgba(255,255,255,0.14);color:#e6e8ee;border-radius:8px;padding:8px 10px;font:500 13px/1.3 -apple-system,system-ui,sans-serif;" />`,
      `  <input type="password" data-cssos-demo-password autocomplete="current-password" placeholder="${escapeAttr(loginPanelLoginCopy("Password", "密码"))}" `,
      `         style="background:rgba(0,0,0,0.32);border:1px solid rgba(255,255,255,0.14);color:#e6e8ee;border-radius:8px;padding:8px 10px;font:500 13px/1.3 -apple-system,system-ui,sans-serif;" />`,
      `  <button type="button" data-cssos-demo-submit `,
      `          style="background:rgba(0,245,160,0.16);border:1px solid rgba(0,245,160,0.42);color:#5effc9;border-radius:8px;padding:8px 14px;font:600 13px/1.2 -apple-system,system-ui,sans-serif;cursor:pointer;">`,
      `    ${loginPanelLoginCopy("Sign in", "登录")}`,
      `  </button>`,
      `  <div data-cssos-demo-status style="font-size:11.5px;line-height:1.5;color:rgba(255,255,255,0.55);min-height:1.2em;"></div>`,
      `</div>`,
    ].join("");
    loginList.appendChild(wrap);
    bindDemoForm(wrap);
  } catch (_e) { /* never break login panel render */ }
}

function escapeAttr(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function bindDemoForm(wrap) {
  const emailEl    = wrap.querySelector("[data-cssos-demo-email]");
  const passwordEl = wrap.querySelector("[data-cssos-demo-password]");
  const submitEl   = wrap.querySelector("[data-cssos-demo-submit]");
  const statusEl   = wrap.querySelector("[data-cssos-demo-status]");
  if (!emailEl || !passwordEl || !submitEl || !statusEl) return;
  const submit = async () => {
    const email = String(emailEl.value || "").trim();
    const password = String(passwordEl.value || "");
    if (!email || !password) {
      statusEl.textContent = loginPanelLoginCopy("Email and password required.", "请填写邮箱和密码。");
      return;
    }
    submitEl.disabled = true;
    const origText = submitEl.textContent;
    submitEl.textContent = loginPanelLoginCopy("Signing in…", "登录中…");
    statusEl.textContent = "";
    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload || payload.ok !== true) {
        const code = (payload && payload.error) || `status_${res.status}`;
        if (code === "demo_login_disabled") {
          statusEl.textContent = loginPanelLoginCopy(
            "Demo sign-in is currently disabled.",
            "演示登录当前已关闭。"
          );
        } else if (code === "invalid_credentials") {
          statusEl.textContent = loginPanelLoginCopy("Wrong email or password.", "邮箱或密码错误。");
        } else if (code === "demo_user_missing") {
          statusEl.textContent = loginPanelLoginCopy("Demo account not found.", "演示账号不存在。");
        } else {
          statusEl.textContent = loginPanelLoginCopy("Sign-in failed: ", "登录失败：") + code;
        }
        submitEl.disabled = false;
        submitEl.textContent = origText;
        return;
      }
      statusEl.textContent = loginPanelLoginCopy("Signed in. Loading…", "已登录，正在加载…");
      // Rehydrate authState the same way an OAuth callback would.
      try { await (typeof fetchMe === "function" ? fetchMe() : fetchMeModule()); } catch (_) {}
      try { renderLoginPlatforms(); } catch (_) {}
      // Soft reload so any cached panel state for guests is wiped and
      // every render path sees the new authState in one pass.
      setTimeout(() => { try { window.location.reload(); } catch (_) {} }, 350);
    } catch (err) {
      statusEl.textContent = loginPanelLoginCopy("Network error: ", "网络错误：") + (err && err.message || err);
      submitEl.disabled = false;
      submitEl.textContent = origText;
    }
  };
  submitEl.addEventListener("click", submit);
  [emailEl, passwordEl].forEach((el) => {
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); submit(); }
    });
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
    // CSSOS_WAVE_383 20260523 — Jing「已登录用户(含 admin)不应再弹出登录面板;
    // 只有游客进平台才显示」。/api/me 落地后纠正启动竞态:
    //   • 命中用户: 写【乐观会话提示】(下次启动同步抑制自动弹出, 零闪烁); 若
    //     登录面板是【自动弹出】(非用户主动点开)且仍开着, 收起它。
    //   • 游客: 清除提示; 若因过期提示被乐观抑制、本次启动从未弹过登录面板,
    //     则补弹一次(游客才需要登录)。
    try {
      const lp = (typeof loginPanel !== "undefined" && loginPanel) ||
        document.getElementById("login-panel");
      if (authState.user) {
        try { localStorage.setItem("cssos.session.hint", "1"); } catch (_s) {}
        // Close it unless the user explicitly opened it (dock 🔐 / context-menu
        // set autoOpened="0"). The boot "guide" open leaves autoOpened unset,
        // and some boot paths show login WITHOUT routing through openPanel — so
        // we treat anything that isn't an explicit user open ("0") as auto and
        // close it for a signed-in user.
        if (lp && lp.dataset.autoOpened !== "0" && !lp.classList.contains("hidden")) {
          if (typeof globalThis.minimizeToDockBridge === "function") {
            globalThis.minimizeToDockBridge(lp);
          } else {
            lp.classList.add("hidden");
            lp.dataset.minimized = "true";
          }
          lp.dataset.autoOpened = "0";
        }
      } else {
        try { localStorage.removeItem("cssos.session.hint"); } catch (_s) {}
        if (lp && lp.classList.contains("hidden") &&
            !globalThis.__cssosLoginAutoShown &&
            typeof globalThis.openPanel === "function") {
          globalThis.openPanel(lp);
        }
      }
    } catch (_e) { /* non-fatal */ }
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
  /* login-status and login-user are hidden when logged in — the compact
   * summary in #login-summary-host covers the same info more cleanly. */
  if (loginStatus) {
    loginStatus.style.display = authState.user ? "none" : "";
    loginStatus.textContent = authState.user ? t("login.statusSigned") : t("login.statusGuest");
  }
  if (loginUser) {
    loginUser.style.display = "none"; /* always hidden; compact-summary shows handle */
    if (authState.user) {
      const label = authState.user.name || authState.user.email || authState.user.id;
      loginUser.textContent = label || "";
    } else {
      loginUser.textContent = "";
    }
  }
  if (loginLogout) {
    // CSSOS_WAVE_1012 20260619 — Jing「登录面板没有退出按钮, 退不了登录」: 旧逻辑用
    // 权限(login.logout)+ 行为开关(show_logout)双闸 → 一旦任一为假就永远藏起退出按钮,
    // 用户(含管理员)登录后无法登出, 也截不到干净登录页, 更是 App Store 合规风险(必须能登出)。
    // 改: 只要已登录就【常显】退出按钮; 未登录则隐藏(没登录无可退)。
    loginLogout.style.display = authState.user ? "inline-flex" : "none";
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
      <div class="provider-login-actions" data-segmented="3" data-pill-bar>
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

// CSSOS_WAVE_383 20260523 — Jing「已登录用户(含 admin)不应再弹出登录面板;
// 只有游客进平台才显示」。启动竞态根治(caller-agnostic 兜底):
// 某些启动路径会【绕过 openPanel 的守卫】直接把登录面板显示出来(className=
// 直写 / 布局恢复 / 计时器),且时机早于/晚于 fetchMe,导致已登录用户每次进
// 平台仍被弹登录。这里不再去逐一追凶,而是装一个常驻“纠偏器”:只要
// (已登录 或 命中乐观会话提示) 且 登录面板被自动显示(非用户主动点开,
// 即 dataset.autoOpened !== "0"),就立刻把它收起。用户主动从 dock 🔐 /
// 右键菜单打开时 openPanel 会写 autoOpened="0",此处放行,签到用户照样可
// 切换/解绑/登出。
(function installLoginAutoCloseGuard() {
  if (globalThis.__cssosLoginAutoCloseGuardInstalled) return;
  globalThis.__cssosLoginAutoCloseGuardInstalled = true;

  function signedIn() {
    try {
      if (typeof authState !== "undefined" && authState && authState.user) return true;
    } catch (_e) {}
    try {
      if (typeof globalThis.authState !== "undefined" && globalThis.authState && globalThis.authState.user) return true;
    } catch (_e) {}
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem("cssos.session.hint") === "1") return true;
    } catch (_e) {}
    return false;
  }

  function panelVisible(lp) {
    try {
      if (lp.classList.contains("hidden")) return false;
      if (lp.dataset.minimized === "true") return false;
      const cs = getComputedStyle(lp);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      return true;
    } catch (_e) { return false; }
  }

  function enforce() {
    const lp = document.getElementById("login-panel");
    if (!lp) return;
    // Only auto-close when this was NOT an explicit user open.
    if (lp.dataset.autoOpened === "0") return;
    if (!signedIn()) return;          // guests SHOULD see the login panel
    if (!panelVisible(lp)) return;    // already dismissed
    try {
      if (typeof globalThis.minimizeToDockBridge === "function") {
        globalThis.minimizeToDockBridge(lp);
      } else {
        lp.classList.add("hidden");
        lp.dataset.minimized = "true";
      }
      lp.dataset.autoOpened = "0";
    } catch (_e) {}
  }

  function boot() {
    const lp = document.getElementById("login-panel");
    if (lp) {
      try {
        const mo = new MutationObserver(() => { try { enforce(); } catch (_e) {} });
        mo.observe(lp, { attributes: true, attributeFilter: ["class", "style"] });
      } catch (_e) {}
    }
    // Catch boot openers that fired before the observer (className= direct writes,
    // layout restore, early timers) with a few staggered re-checks. Cheap + bounded.
    [0, 150, 400, 900, 1600, 2600].forEach((ms) => setTimeout(() => { try { enforce(); } catch (_e) {} }, ms));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
