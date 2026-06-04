function buildPanelSettingsMarkupBridge({
  isLogoPanel,
  isCssmvPanel,
  isLanguagePanel,
  isLoginPanel,
  isProfilePanel,
  isWorksPanel,
  isSellerPanel,
  isAboutPanel,
  isApiPanel,
  isForyouPanel,
  isWatchPanel,
  isLyricsPanel,
  isMusicPanel,
  isVideoPanel,
  isDeliveryReportsPanel,
  isDeliveryOpsPanel,
  sizeLimits
}) {
  return `
    <div class="panel-settings-title">${t("settings.panel.title")}</div>
    <label data-setting-block="title">
      ${t("settings.panel.titleLabel")}
      <input type="text" data-setting="title" />
    </label>
    <div class="panel-settings-title">${loginCopy("Panel Command")}</div>
    <label>
      ${loginCopy("Shortcut key (C + S + key)")}
      <input type="text" maxlength="1" data-setting="panel-shortcut-key" placeholder="${loginCopy("Single key")}" />
      <span class="panel-setting-readout" data-setting-readout="panel-shortcut-default"></span>
    </label>
    <label>
      ${loginCopy("Voice command")}
      <input type="text" maxlength="80" data-setting="panel-voice-command" placeholder="${loginCopy("Open this panel")}" />
      <span class="panel-setting-readout" data-setting-readout="panel-voice-default"></span>
    </label>
    <!-- CSSOS_PHASE2_DOCK_SLOT 20260505 — Jing
         "dock position也无效，请修复，第一个位置从0开始". Per-panel
         slot index in the dock; 0 = first, 1 = second, etc. Empty
         means "use the global default order". -->
    <label>
      ${loginCopy("Dock slot index (0 = first)")}
      <input type="number" min="0" max="64" step="1" data-setting="panel-dock-slot" placeholder="${loginCopy("Default")}" />
      <span class="panel-setting-readout" data-setting-readout="panel-dock-slot-current"></span>
    </label>
    ${
      isLogoPanel
        ? `
      <label>
        ${t("settings.panel.incantation")}
        <input type="text" data-setting="spell" />
      </label>
      <label>
        ${loginCopy("Subtitle")}
        <input type="text" data-setting="logo-subtitle" />
      </label>
      <label>
        ${loginCopy("Slogan template")}
        <input type="text" data-setting="logo-slogan-template" />
      </label>
      <label>
        ${loginCopy("Mirror size (px)")}
        <input type="range" min="420" max="880" step="10" data-setting="logo-size" />
      </label>
      <label>
        ${loginCopy("Halo inset (%)")}
        <input type="range" min="0" max="28" step="1" data-setting="logo-mask-inset" />
      </label>
      <label>
        ${loginCopy("Flash ring size")}
        <input type="range" min="0.82" max="1.12" step="0.01" data-setting="logo-spellcast-ring-scale" />
        <span class="panel-setting-readout" data-setting-readout="logo-spellcast-ring-scale"></span>
      </label>
      <label>
        ${loginCopy("Flash glow strength")}
        <input type="range" min="0" max="1" step="0.02" data-setting="logo-spellcast-glow-scale" />
        <span class="panel-setting-readout" data-setting-readout="logo-spellcast-glow-scale"></span>
      </label>
      <label>
        ${loginCopy("Gray ring speed")}
        <input type="range" min="2" max="18" step="0.5" data-setting="logo-gray-ring-speed" />
        <span class="panel-setting-readout" data-setting-readout="logo-gray-ring-speed"></span>
      </label>
      <label>
        ${loginCopy("Gray ring grayscale")}
        <input type="range" min="0" max="1" step="0.02" data-setting="logo-gray-ring-grayscale" />
        <span class="panel-setting-readout" data-setting-readout="logo-gray-ring-grayscale"></span>
      </label>
      <label>
        ${loginCopy("Gray ring colorfulness")}
        <input type="range" min="0" max="1" step="0.02" data-setting="logo-gray-ring-colorfulness" />
        <span class="panel-setting-readout" data-setting-readout="logo-gray-ring-colorfulness"></span>
      </label>
      <label>
        ${loginCopy("Flash ring layer")}
        <select data-setting="logo-spellcast-layer">
          <option value="behind">${loginCopy("Behind mirror")}</option>
          <option value="front">${loginCopy("In front of mirror")}</option>
        </select>
      </label>
      <label>
        ${loginCopy("Green ring size")}
        <input type="range" min="0.82" max="1.12" step="0.01" data-setting="logo-hold-ring-scale" />
        <span class="panel-setting-readout" data-setting-readout="logo-hold-ring-scale"></span>
      </label>
      <label>
        ${loginCopy("Green ring layer")}
        <select data-setting="logo-hold-ring-layer">
          <option value="behind">${loginCopy("Behind mirror")}</option>
          <option value="front">${loginCopy("In front of mirror")}</option>
        </select>
      </label>
      <div class="panel-settings-inline-actions">
        <button type="button" class="cta ghost tiny" data-setting="logo-align-gray-ring">${loginCopy("Align To Gray Ring")}</button>
        <button type="button" class="cta ghost tiny" data-setting="logo-align-gray-ring-minimal">${loginCopy("Align + Minimal Glow")}</button>
        <button type="button" class="cta ghost tiny" data-setting="logo-save-ring-preset">${loginCopy("Save As Logo Preset")}</button>
      </div>
      <label>
        ${loginCopy("Saved logo presets")}
        <select data-setting="logo-ring-preset-select"></select>
      </label>
      <div class="panel-settings-inline-actions">
        <button type="button" class="cta ghost tiny" data-setting="logo-load-ring-preset">${loginCopy("Load Logo Preset")}</button>
        <button type="button" class="cta ghost tiny" data-setting="logo-delete-ring-preset">${loginCopy("Delete Preset")}</button>
      </div>
      <div class="panel-settings-title">${loginCopy("Voice Trigger")}</div>
      <label>
        ${loginCopy("Long press threshold (ms)")}
        <input type="range" min="250" max="3000" step="50" data-setting="mic-longpress-ms" />
      </label>
      <label>
        ${loginCopy("Voice capture length")}
        <select data-setting="mic-max-hold-sec">
          ${[3, 5, 10, 15, 30].map((sec) => `<option value="${sec}">${loginCopy(`${sec} sec`)}</option>`).join("")}
        </select>
      </label>
      <label>
        ${loginCopy("Logo surface mode")}
        <select data-setting="mic-logo-surface-mode">
          <option value="showcase">${loginCopy("Showcase panels")}</option>
          <option value="mv_only">${loginCopy("Direct MV")}</option>
        </select>
      </label>
      <label>
        ${loginCopy("Dock mic surface mode")}
        <select data-setting="mic-dock-surface-mode">
          <option value="showcase">${loginCopy("Showcase panels")}</option>
          <option value="mv_only">${loginCopy("Direct MV")}</option>
        </select>
      </label>
      <label>
        ${loginCopy("Settings submit surface mode")}
        <select data-setting="mic-settings-surface-mode">
          <option value="showcase">${loginCopy("Showcase panels")}</option>
          <option value="mv_only">${loginCopy("Direct MV")}</option>
        </select>
      </label>
      ${buildMicDebugBoardMarkup()}
    `
        : ""
    }
    ${
      isCssmvPanel
        ? `
      <label>
        ${loginCopy("Default focus")}
        <select data-setting="cssmv-default-section">
          <option value="digest">${loginCopy("Digest")}</option>
          <option value="governance">${loginCopy("Governance")}</option>
          <option value="timeline">${loginCopy("Timeline")}</option>
        </select>
      </label>
      <label class="advanced-panel-check">
        <input type="checkbox" data-setting="cssmv-auto-refresh" />
        <span>${loginCopy("Refresh digest on open")}</span>
      </label>
    `
        : ""
    }
    ${
      isLanguagePanel
        ? `
      <label>
        ${loginCopy("Default mode")}
        <select data-setting="language-default-mode">
          <option value="content">${loginCopy("Content")}</option>
          <option value="settings">${loginCopy("Settings")}</option>
        </select>
      </label>
      <label class="advanced-panel-check">
        <input type="checkbox" data-setting="language-show-more" />
        <span>${loginCopy("Expand more languages by default")}</span>
      </label>
    `
        : ""
    }
    ${
      isLoginPanel
        ? `
      <label>
        ${loginCopy("Login panel density")}
        <select data-setting="login-panel-density">
          <option value="full">${loginCopy("Full")}</option>
          <option value="compact">${loginCopy("Compact")}</option>
        </select>
      </label>
      <label>
        ${loginCopy("Preferred provider")}
        <select data-setting="login-preferred-provider">
          <option value="google">Google</option>
          <option value="github">GitHub</option>
          <option value="x">X</option>
          <option value="bsky">Bluesky</option>
          <option value="passkey">Passkey</option>
        </select>
      </label>
      <label class="advanced-panel-check">
        <input type="checkbox" data-setting="login-show-logout" />
        <span>${loginCopy("Show logout button")}</span>
      </label>
      <label>
        ${loginCopy("Remember session window")}
        <select data-setting="login-session-days">
          <option value="30">${loginCopy("30 days")}</option>
          <option value="90">${loginCopy("90 days")}</option>
          <option value="180">${loginCopy("180 days")}</option>
          <option value="365">${loginCopy("365 days")}</option>
        </select>
      </label>
    `
        : ""
    }
    ${
      isProfilePanel
        ? `
      <label>
        ${loginCopy("Profile density")}
        <select data-setting="profile-panel-density">
          <option value="full">${loginCopy("Full")}</option>
          <option value="compact">${loginCopy("Compact")}</option>
        </select>
      </label>
      <label>
        ${loginCopy("Profile note")}
        <input type="text" data-setting="profile-note" maxlength="120" />
      </label>
      <label>
        ${loginCopy("Default jump button")}
        <select data-setting="profile-default-nav">
          <option value="works">${loginCopy("Works")}</option>
          <option value="api">API</option>
        </select>
      </label>
    `
        : ""
    }
    ${
      isWorksPanel
        ? `
      <label>
        ${loginCopy("Default focus")}
        <select data-setting="works-focus-section">
          <option value="works">${loginCopy("Works")}</option>
          <option value="comments">${loginCopy("Comments")}</option>
          <option value="monetization">${loginCopy("Monetization")}</option>
        </select>
      </label>
      <label class="advanced-panel-check">
        <input type="checkbox" data-setting="works-auto-load" />
        <span>${loginCopy("Refresh works on open")}</span>
      </label>
      <label class="advanced-panel-check">
        <input type="checkbox" data-setting="works-search-enabled" />
        <span>${loginCopy("Enable pull-down search")}</span>
      </label>
      <label>
        ${loginCopy("Search result limit")}
        <input type="number" min="4" max="48" step="1" data-setting="works-search-limit" />
      </label>
      <label>
        ${loginCopy("Default filter")}
        <select data-setting="works-default-filter">
          <option value="all">${loginCopy("All")}</option>
          <option value="single">${loginCopy("Single")}</option>
          <option value="triptych">${loginCopy("Triptych")}</option>
          <option value="opera">${loginCopy("Opera")}</option>
          <option value="live">${loginCopy("Live")}</option>
          <option value="hidden">${loginCopy("Hidden")}</option>
        </select>
      </label>
      <label>
        ${loginCopy("Default sort")}
        <select data-setting="works-default-sort">
          <option value="newest">${loginCopy("Newest")}</option>
          <option value="oldest">${loginCopy("Oldest")}</option>
          <option value="title">${loginCopy("Title")}</option>
          <option value="type">${loginCopy("Type")}</option>
        </select>
      </label>
    `
        : ""
    }
    ${
      isSellerPanel
        ? `
      <label>
        ${loginCopy("Default lane")}
        <select data-setting="seller-focus-lane">
          <option value="orders">${loginCopy("Orders")}</option>
          <option value="income">${loginCopy("Income")}</option>
        </select>
      </label>
      <label class="advanced-panel-check">
        <input type="checkbox" data-setting="seller-auto-refresh" />
        <span>${loginCopy("Refresh seller data on open")}</span>
      </label>
      <label>
        ${loginCopy("Order filter")}
        <select data-setting="seller-order-filter">
          <option value="all">${loginCopy("All")}</option>
          <option value="paid">${loginCopy("Paid")}</option>
          <option value="pending">${loginCopy("Pending")}</option>
        </select>
      </label>
      <label>
        ${loginCopy("Ledger item limit")}
        <input type="number" min="4" max="40" step="1" data-setting="seller-ledger-limit" />
      </label>
    `
        : ""
    }
    ${
      isAboutPanel
        ? `
      <label>
        ${loginCopy("Default tab")}
        <select data-setting="about-default-tab">
          <option value="whitepaper">${loginCopy("Whitepaper")}</option>
          <option value="about">${loginCopy("About")}</option>
          <option value="contact">${loginCopy("Contact")}</option>
        </select>
      </label>
      <label>
        ${loginCopy("Section density")}
        <select data-setting="about-density">
          <option value="relaxed">${loginCopy("Relaxed")}</option>
          <option value="compact">${loginCopy("Compact")}</option>
        </select>
      </label>
    `
        : ""
    }
    ${
      isApiPanel
        ? `
      <label>
        ${loginCopy("Billing view")}
        <select data-setting="api-billing-mode">
          <option value="full">${loginCopy("Full")}</option>
          <option value="compact">${loginCopy("Compact")}</option>
        </select>
      </label>
      <label>
        ${loginCopy("Default payment method")}
        <select data-setting="api-payment-method-default">
          <option value="card">${loginCopy("Card")}</option>
          <option value="bank">${loginCopy("Bank transfer")}</option>
        </select>
      </label>
      <label class="advanced-panel-check">
        <input type="checkbox" data-setting="api-auto-recharge-default" />
        <span>${loginCopy("Enable auto recharge by default")}</span>
      </label>
      <div class="panel-settings-title">${loginCopy("Commerce policy")}</div>
      <label>
        ${loginCopy("Payout hold days")}
        <input type="number" min="0" max="90" step="1" data-setting="commerce-payout-hold-days" />
      </label>
      <label>
        ${loginCopy("Payout sweep every (minutes)")}
        <input type="number" min="1" max="1440" step="1" data-setting="commerce-payout-sweep-minutes" />
      </label>
      <label>
        ${loginCopy("Minimum tip (USD)")}
        <input type="number" min="1" max="1000" step="1" data-setting="commerce-min-tip-usd" />
      </label>
    `
        : ""
    }
    ${
      isForyouPanel
        ? `
      <label>
        ${t("settings.foryou.previewMode")}
        <select data-setting="preview-mode">
          <option value="auto">${t("settings.foryou.previewMode.auto")}</option>
          <option value="image">${t("settings.foryou.previewMode.image")}</option>
          <option value="video">${t("settings.foryou.previewMode.video")}</option>
        </select>
      </label>
      <label>
        ${loginCopy("On entering the platform", "进入平台时")}
        <select data-setting="auto-enter-mv">
          <option value="ask">${loginCopy("Ask every time", "每次询问")}</option>
          <option value="always">${loginCopy("Always watch MV", "总是欣赏")}</option>
          <option value="never">${loginCopy("Don’t auto-enter", "不自动进入")}</option>
        </select>
      </label>
      <label>
        ${loginCopy("Hold after completion (ms)")}
        <input type="number" min="0" max="30000" step="1000" data-setting="foryou-hold-ms" />
      </label>
      <label class="advanced-panel-check">
        <input type="checkbox" data-setting="foryou-compact-after-lyrics" />
        <span>${loginCopy("Collapse after lyrics finish")}</span>
      </label>
      <label>
        ${loginCopy("Auto watch delay (ms)")}
        <input type="number" min="0" max="30000" step="1000" data-setting="foryou-auto-watch-ms" />
      </label>
      <label class="advanced-panel-check">
        <input type="checkbox" data-setting="foryou-search-enabled" />
        <span>${loginCopy("Enable pull-down search")}</span>
      </label>
      <label>
        ${loginCopy("Marketplace result limit")}
        <input type="number" min="4" max="48" step="1" data-setting="foryou-market-limit" />
      </label>
      <label>
        ${loginCopy("Marketplace filter")}
        <select data-setting="foryou-default-filter">
          <option value="all">${loginCopy("All")}</option>
          <option value="single">${loginCopy("Single")}</option>
          <option value="triptych">${loginCopy("Triptych")}</option>
          <option value="opera">${loginCopy("Opera")}</option>
          <option value="owned">${loginCopy("Mine")}</option>
          <option value="public">${loginCopy("Others")}</option>
        </select>
      </label>
      <label>
        ${loginCopy("Marketplace sort")}
        <select data-setting="foryou-default-sort">
          <option value="newest">${loginCopy("Newest")}</option>
          <option value="oldest">${loginCopy("Oldest")}</option>
          <option value="title">${loginCopy("Title")}</option>
          <option value="listen_low">${loginCopy("Low price")}</option>
          <option value="listen_high">${loginCopy("High price")}</option>
        </select>
      </label>
    `
        : ""
    }
    ${
      isWatchPanel
        ? `
      <label>
        ${loginCopy("Default tab")}
        <select data-setting="watch-default-tab">
          <option value="mv">MV</option>
          <option value="music">${t("watch.tab.music")}</option>
          <option value="lyrics">Lyrics</option>
        </select>
      </label>
      <label>
        ${loginCopy("Preview limit (sec)")}
        <input type="number" min="0" max="180" step="5" data-setting="watch-preview-limit-sec" />
      </label>
      <label>
        ${loginCopy("Subtitle scale")}
        <input type="range" min="0.8" max="1.4" step="0.05" data-setting="watch-subtitle-scale" />
      </label>
      <label>
        ${loginCopy("Engine detail")}
        <select data-setting="watch-engine-detail">
          <option value="compact">${loginCopy("Compact")}</option>
          <option value="full">${loginCopy("Full")}</option>
        </select>
      </label>
      <label class="advanced-panel-check">
        <input type="checkbox" data-setting="watch-show-generation-flow" />
        <span>${loginCopy("Show generation flow by default")}</span>
      </label>
      <label>
        ${loginCopy("Flash ring size")}
        <input type="range" min="0.84" max="1.08" step="0.01" data-setting="watch-flash-ring-scale" />
      </label>
    `
        : ""
    }
    ${
      isLyricsPanel
        ? `
      <label>
        ${loginCopy("Typewriter speed")}
        <input type="number" min="8" max="60" step="1" data-setting="lyrics-type-speed" />
      </label>
      <label>
        ${loginCopy("Lyrics scale")}
        <input type="range" min="0.85" max="1.4" step="0.05" data-setting="lyrics-font-scale" />
      </label>
      <label class="advanced-panel-check">
        <input type="checkbox" data-setting="lyrics-auto-collapse" />
        <span>${loginCopy("Auto collapse after done")}</span>
      </label>
    `
        : ""
    }
    ${
      isMusicPanel
        ? `
      <label>
        ${loginCopy("Waveform bars")}
        <input type="number" min="12" max="48" step="1" data-setting="music-waveform-bars" />
      </label>
      <label>
        ${loginCopy("Layer cards")}
        <input type="number" min="3" max="8" step="1" data-setting="music-layer-cards" />
      </label>
    `
        : ""
    }
    ${
      isVideoPanel
        ? `
      <label>
        ${loginCopy("Storyboard frames")}
        <input type="number" min="4" max="16" step="1" data-setting="video-storyboard-frames" />
      </label>
      <label>
        ${loginCopy("Camera slots")}
        <input type="number" min="2" max="8" step="1" data-setting="video-camera-slots" />
      </label>
    `
        : ""
    }
    ${
      isDeliveryReportsPanel
        ? `
      <label>
        ${loginCopy("Default report")}
        <select data-setting="reports-default-kind">
          ${DELIVERY_REPORT_KINDS.map((kind) => `<option value="${kind}">${escapeHtml(formatReportKindLabel(kind))}</option>`).join("")}
        </select>
      </label>
      <label>
        ${loginCopy("Focus section")}
        <select data-setting="reports-focus-section">
          <option value="overview">${loginCopy("Overview")}</option>
          <option value="dashboard">${loginCopy("Dashboard")}</option>
          <option value="export">${loginCopy("Export")}</option>
          <option value="history">${loginCopy("History")}</option>
        </select>
      </label>
      <label>
        ${loginCopy("Report density")}
        <select data-setting="reports-density">
          <option value="full">${loginCopy("Full")}</option>
          <option value="compact">${loginCopy("Compact")}</option>
        </select>
      </label>
      <label class="advanced-panel-check">
        <input type="checkbox" data-setting="reports-preview-expanded" />
        <span>${loginCopy("Expand export preview by default")}</span>
      </label>
    `
        : ""
    }
    ${
      isDeliveryOpsPanel
        ? `
      <label>
        ${loginCopy("Recovery limit")}
        <input type="number" min="4" max="20" step="1" data-setting="ops-recovery-limit" />
      </label>
      <label>
        ${loginCopy("Focus lane")}
        <select data-setting="ops-focus-lane">
          <option value="overview">${loginCopy("Overview")}</option>
          <option value="subscriptions">${loginCopy("Subscriptions")}</option>
          <option value="logs">${loginCopy("Logs")}</option>
          <option value="recovery">${loginCopy("Recovery")}</option>
          <option value="actions">${loginCopy("Actions")}</option>
        </select>
      </label>
      <label>
        ${loginCopy("Alert density")}
        <select data-setting="ops-alert-density">
          <option value="full">${loginCopy("Full")}</option>
          <option value="compact">${loginCopy("Compact")}</option>
        </select>
      </label>
      <label class="advanced-panel-check">
        <input type="checkbox" data-setting="ops-auto-refresh" />
        <span>${loginCopy("Refresh automatically on open")}</span>
      </label>
    `
        : ""
    }
    <label>
      ${t("settings.panel.accentColor")}
      <input type="color" data-setting="accent" />
    </label>
    <label>
      ${t("settings.panel.glassOpacity")}
      <input type="range" min="0" max="0.9" step="0.05" data-setting="opacity" />
    </label>
    <label>
      ${t("settings.panel.blur")}
      <input type="range" min="0" max="28" step="1" data-setting="blur" />
    </label>
    <div class="row">
      <label>
        ${t("settings.panel.width")}
        <input type="number" min="${sizeLimits.minWidth}" max="${sizeLimits.maxWidth}" step="10" data-setting="width" />
      </label>
      <label>
        ${t("settings.panel.height")}
        <input type="number" min="${sizeLimits.minHeight}" max="${sizeLimits.maxHeight}" step="10" data-setting="height" />
      </label>
    </div>
    <div class="advanced-panel-note">${escapeHtml(loginCopy(`Panel size limits: width ${sizeLimits.minWidth}-${sizeLimits.maxWidth}px, height ${sizeLimits.minHeight}-${sizeLimits.maxHeight}px. Input changes apply immediately.`))}</div>
    ${
      isLogoPanel
        ? `
      <div class="panel-settings-title">${t("settings.panel.mirrorMedia")}</div>
      <label>
        ${t("settings.panel.mirrorStrategy")}
        <select data-setting="mirror-animation-strategy">
          <option value="random">${t("settings.panel.mirrorStrategy.random")}</option>
          <option value="fixed">${t("settings.panel.mirrorStrategy.fixed")}</option>
          <option value="per_type">${t("settings.panel.mirrorStrategy.perType")}</option>
        </select>
      </label>
      <label data-setting-block="mirror-fixed-mode">
        ${t("settings.panel.mirrorFixedMode")}
        <select data-setting="mirror-animation-mode">
          <option value="halo">${t("settings.panel.mirrorAnimation.halo")}</option>
          <option value="breath">${t("settings.panel.mirrorAnimation.breath")}</option>
          <option value="prism">${t("settings.panel.mirrorAnimation.prism")}</option>
          <option value="oracle">${t("settings.panel.mirrorAnimation.oracle")}</option>
        </select>
      </label>
      <label data-setting-block="mirror-single-mode">
        ${t("settings.panel.mirrorSingleMode")}
        <select data-setting="mirror-animation-single">
          <option value="halo">${t("settings.panel.mirrorAnimation.halo")}</option>
          <option value="breath">${t("settings.panel.mirrorAnimation.breath")}</option>
          <option value="prism">${t("settings.panel.mirrorAnimation.prism")}</option>
          <option value="oracle">${t("settings.panel.mirrorAnimation.oracle")}</option>
        </select>
      </label>
      <label data-setting-block="mirror-triptych-mode">
        ${t("settings.panel.mirrorTriptychMode")}
        <select data-setting="mirror-animation-triptych">
          <option value="halo">${t("settings.panel.mirrorAnimation.halo")}</option>
          <option value="breath">${t("settings.panel.mirrorAnimation.breath")}</option>
          <option value="prism">${t("settings.panel.mirrorAnimation.prism")}</option>
          <option value="oracle">${t("settings.panel.mirrorAnimation.oracle")}</option>
        </select>
      </label>
      <label data-setting-block="mirror-opera-mode">
        ${t("settings.panel.mirrorOperaMode")}
        <select data-setting="mirror-animation-opera">
          <option value="halo">${t("settings.panel.mirrorAnimation.halo")}</option>
          <option value="breath">${t("settings.panel.mirrorAnimation.breath")}</option>
          <option value="prism">${t("settings.panel.mirrorAnimation.prism")}</option>
          <option value="oracle">${t("settings.panel.mirrorAnimation.oracle")}</option>
        </select>
      </label>
      <label>
        ${t("settings.panel.mirrorImage1")}
        <input type="file" accept="image/*" data-setting="mirror-image-1" />
      </label>
      <label>
        ${t("settings.panel.mirrorImage2")}
        <input type="file" accept="image/*" data-setting="mirror-image-2" />
      </label>
      <label>
        ${t("settings.panel.mirrorVideo")}
        <input type="file" accept="video/*" data-setting="mirror-video" />
      </label>
    `
        : ""
    }
    <div class="actions">
      ${getUserRole() === "admin" ? `<button type="button" class="cta ghost" data-setting="set-default">${t("settings.panel.setDefault")}</button>` : ""}
      <button type="button" class="cta ghost" data-setting="reset">${t("settings.panel.reset")}</button>
    </div>
  `;
}

globalThis.buildPanelSettingsMarkupBridge = buildPanelSettingsMarkupBridge;
