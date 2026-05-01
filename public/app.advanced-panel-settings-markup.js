function buildAdvancedPanelSettingsMarkupBridge(settings) {
  const current = sanitizePanelBehaviorSettings(settings);
  const admin = getUserRole() === "admin";
  const navItems = [
    { key: "logo", label: loginCopy("Logo Mirror") },
    { key: "dock", label: loginCopy("Dock") },
    { key: "mic", label: loginCopy("Mic Topic Panel") },
    { key: "global", label: loginCopy("Global Visuals") },
    { key: "rerun-policy", label: loginCopy("Rerun Policy") },
    { key: "membership", label: loginCopy("Membership") },
    ...(admin ? [{ key: "permission-overview", label: loginCopy("Permission Overview") }] : [])
  ];
  const boostInfo = creatorBoostState.payload?.entitlements || {
    language: { available: 0 },
    voice: { available: 0 },
    thumbnail: { available: 0 },
    preview_video: { available: 0 },
    generation: { available: 0 },
    background_job: { available: 0 }
  };
  const selectedLanguages = globalThis.getSelectedCreationLanguages?.() || ["zh"];
  const selectedVoices = globalThis.getSelectedCreationVoiceTracks?.() || ["lead_default"];
  const primaryLanguage = globalThis.getPrimaryCreationLanguage?.() || selectedLanguages[0] || "zh";
  const languageCatalog = globalThis.getCreationLyricLanguageCatalog?.() || [];
  const voiceCatalog = globalThis.getCreationVoiceTrackCatalog?.() || [];
  const voiceLabelMap = new Map(voiceCatalog.map((entry) => [String(entry?.code || ""), String(entry?.label || entry?.code || "")]));
  const membershipRows = [
    {
      tier: loginCopy("Guest"),
      queue: formatQueueLaneLabel("guest_preview"),
      quota: loginCopy("0 / month"),
      generation: loginCopy("Browse a few panels only"),
      selling: loginCopy("No"),
      boosts: loginCopy("No")
    },
    {
      tier: loginCopy("Basic / Free"),
      queue: formatQueueLaneLabel("free_standard"),
      quota: loginCopy("3 / month"),
      generation: loginCopy("Basic creation, watermark"),
      selling: loginCopy("Own works only"),
      boosts: loginCopy("Upgrade first")
    },
    {
      tier: loginCopy("Starter"),
      queue: formatQueueLaneLabel("starter_paid"),
      quota: `${Number(current.membership.starter_monthly_limit || 30)} / ${loginCopy("month")}`,
      generation: loginCopy("720p, up to 6 min, single work"),
      selling: loginCopy("Can sell and trade works"),
      boosts: loginCopy("Temporary generations, language, and voice boosts")
    },
    {
      tier: "Pro",
      queue: formatQueueLaneLabel("pro_pipeline"),
      quota: `${Number(current.membership.pro_monthly_limit || 100)} / ${loginCopy("month")}`,
      generation: loginCopy("1080p, up to 8 min, triptych/opera"),
      selling: loginCopy("Full creator commerce"),
      boosts: loginCopy("Temporary generations, language, and voice boosts")
    },
    {
      tier: "Studio",
      queue: formatQueueLaneLabel("studio_pipeline"),
      quota: `${Number(current.membership.studio_monthly_limit || 300)} / ${loginCopy("month")}`,
      generation: loginCopy("Team workspace, multi-project"),
      selling: loginCopy("Full creator commerce"),
      boosts: loginCopy(`Includes ${Number(current.creator_boost.studio_includes_extra_languages || 0)} lang / ${Number(current.creator_boost.studio_includes_extra_voices || 0)} voice`)
    },
    {
      tier: "Enterprise",
      queue: formatQueueLaneLabel("enterprise_dedicated"),
      quota: Number(current.membership.enterprise_monthly_limit || 0) > 0 ? `${Number(current.membership.enterprise_monthly_limit)} / ${loginCopy("month")}` : loginCopy("Unlimited"),
      generation: loginCopy("Enterprise API, isolated route limits"),
      selling: loginCopy("Contract / enterprise workflow"),
      boosts: loginCopy(`Includes ${Number(current.creator_boost.enterprise_includes_extra_languages || 0)} lang / ${Number(current.creator_boost.enterprise_includes_extra_voices || 0)} voice`)
    },
    {
      tier: "VIP",
      queue: formatQueueLaneLabel("vip_private"),
      quota: loginCopy("Unlimited"),
      generation: loginCopy("Private queue, no daily/monthly cap"),
      selling: loginCopy("Almost all panel actions except special defaults"),
      boosts: loginCopy("No language/voice cap")
    }
  ];
  const actionMatrixRows = admin ? buildActionPermissionMatrixRows(current) : [];
  const filteredActionMatrixRows = admin ? filterActionPermissionMatrixRows(actionMatrixRows, permissionOverviewFilter) : [];
  return `
    <div class="panel-label">${escapeHtml(t("settings.panel.parameterCenter"))}</div>
    <div class="advanced-panel-nav advanced-panel-pill-strip scroll-peek" role="tablist" data-scroll-peek>
      ${navItems
        .map(
          (item) => `
            <button
              class="advanced-pill"
              type="button"
              role="tab"
              data-advanced-nav="${escapeHtml(item.key)}"
            >${escapeHtml(item.label)}</button>
          `
        )
        .join("")}
    </div>
    <section class="advanced-panel-card" data-advanced-panel="render-now">
      <div class="advanced-panel-card-title">${escapeHtml(loginCopy("Apply & Render"))}</div>
      <div class="advanced-panel-note">${escapeHtml(loginCopy("Use current inputs (or defaults if empty) to continue the one-tap MV flow immediately."))}</div>
      <button class="cta" type="button" data-advanced-apply-render>${escapeHtml(loginCopy("Apply & Render Now"))}</button>
    </section>
    <div class="advanced-panel-grid">
      <section class="advanced-panel-card" data-advanced-panel="logo">
        <div class="advanced-panel-card-title">${escapeHtml(loginCopy("Logo Mirror"))}</div>
        <div class="advanced-panel-note">${escapeHtml(loginCopy("Logo parameters are moving back to the logo panel itself. This area now acts as a hosted entrance plus media handoff, so the mirror still follows the panel constitution."))}</div>
        <label><span>${escapeHtml(loginCopy("Mirror image A"))}</span><input type="file" accept="image/*" data-advanced-setting="logo-image-1" /></label>
        <label><span>${escapeHtml(loginCopy("Mirror image B"))}</span><input type="file" accept="image/*" data-advanced-setting="logo-image-2" /></label>
        <label><span>${escapeHtml(loginCopy("Mirror video"))}</span><input type="file" accept="video/*" data-advanced-setting="logo-video" /></label>
        <div class="advanced-panel-note">${escapeHtml(loginCopy(`Current media: ${current.logo.media.image_1.split("/").pop() || "A"} / ${current.logo.media.image_2.split("/").pop() || "B"}${current.logo.media.video ? ` / ${current.logo.media.video.split("/").pop() || "video"}` : ""}`))}</div>
        <button class="cta ghost tiny" type="button" data-advanced-open-panel="logo-panel">${escapeHtml(loginCopy("Open logo settings"))}</button>
        ${admin ? `<button class="cta ghost tiny" type="button" data-advanced-save="logo">${escapeHtml(t("settings.panel.setDefault"))}</button>` : ""}
      </section>
      <section class="advanced-panel-card" data-advanced-panel="dock">
        <div class="advanced-panel-card-title">${escapeHtml(loginCopy("Dock"))}</div>
        <label><span>${escapeHtml(loginCopy("Scale"))}</span><input type="range" min="0.8" max="1.35" step="0.05" data-advanced-setting="dock-scale" value="${escapeHtml(String(current.dock.scale))}" /></label>
        <label><span>${escapeHtml(loginCopy("Background opacity"))}</span><input type="range" min="0" max="0.65" step="0.01" data-advanced-setting="dock-background-opacity" value="${escapeHtml(String(current.dock.background_opacity ?? 0.24))}" /></label>
        <label class="advanced-panel-check"><input type="checkbox" data-advanced-setting="dock-labels" ${current.dock.show_labels ? "checked" : ""} /><span>${escapeHtml(loginCopy("Show labels"))}</span></label>
        <label class="advanced-panel-check"><input type="checkbox" data-advanced-setting="dock-docking" ${current.dock.docking_enabled ? "checked" : ""} /><span>${escapeHtml(loginCopy("Allow edge docking"))}</span></label>
        <label><span>${escapeHtml(loginCopy("Dock position"))}</span>
          <select data-advanced-setting="dock-position">
            <option value="bottom" ${current.dock.dock_position === "bottom" ? "selected" : ""}>${escapeHtml(loginCopy("Bottom"))}</option>
            <option value="left" ${current.dock.dock_position === "left" ? "selected" : ""}>${escapeHtml(loginCopy("Left"))}</option>
            <option value="right" ${current.dock.dock_position === "right" ? "selected" : ""}>${escapeHtml(loginCopy("Right"))}</option>
            <option value="top" ${current.dock.dock_position === "top" ? "selected" : ""}>${escapeHtml(loginCopy("Top"))}</option>
          </select>
        </label>
        <button class="cta ghost tiny" type="button" data-advanced-dock-reset>${escapeHtml(loginCopy("Reset to bottom center"))}</button>
        ${admin ? `<button class="cta ghost tiny" type="button" data-advanced-save="dock">${escapeHtml(t("settings.panel.setDefault"))}</button>` : ""}
      </section>
      <section class="advanced-panel-card" data-advanced-panel="mic">
        <div class="advanced-panel-card-title">${escapeHtml(loginCopy("Mic Topic Panel"))}</div>
        <div class="advanced-panel-note">${escapeHtml(loginCopy("Mic timing parameters are moving onto the logo panel itself, because the mirror is where click, double-click, and long-press all happen. This hosted card now keeps the debug window and an entrance only."))}</div>
        <button class="cta ghost tiny" type="button" data-advanced-open-panel="logo-panel">${escapeHtml(loginCopy("Open logo voice settings"))}</button>
        <div class="advanced-panel-note">${escapeHtml(loginCopy("If voice title capture fails, the system falls back to direct generation just like the lyrics wand."))}</div>
        ${admin ? `<button class="cta ghost tiny" type="button" data-advanced-save="mic">${escapeHtml(t("settings.panel.setDefault"))}</button>` : ""}
      </section>
      <section class="advanced-panel-card" data-advanced-panel="global">
        <div class="advanced-panel-card-title">${escapeHtml(loginCopy("Global Visuals"))}</div>
        <div class="advanced-panel-note">${escapeHtml(loginCopy("Global palette and ambient background controls stay here. Panel-specific playback and engine tuning now live inside each panel's own settings."))}</div>
        <label><span>${escapeHtml(loginCopy("Theme"))}</span>
          <select data-advanced-setting="theme-mode">
            <option value="system" ${current.appearance?.theme_mode === "system" ? "selected" : ""}>${escapeHtml(loginCopy("Follow system"))}</option>
            <option value="dark" ${current.appearance?.theme_mode === "dark" ? "selected" : ""}>${escapeHtml(loginCopy("Dark"))}</option>
            <option value="light" ${current.appearance?.theme_mode === "light" ? "selected" : ""}>${escapeHtml(loginCopy("Light"))}</option>
          </select>
        </label>
        <label><span>${escapeHtml(loginCopy("Background style"))}</span>
          <select data-advanced-setting="background-mode">
            <option value="aurora" ${current.background.mode === "aurora" ? "selected" : ""}>${escapeHtml(loginCopy("Aurora"))}</option>
            <option value="ribbon" ${current.background.mode === "ribbon" ? "selected" : ""}>${escapeHtml(loginCopy("Stripe ribbon"))}</option>
            <option value="watercolor" ${current.background.mode === "watercolor" ? "selected" : ""}>${escapeHtml(loginCopy("Watercolor"))}</option>
            <option value="ink" ${current.background.mode === "ink" ? "selected" : ""}>${escapeHtml(loginCopy("Ink mist"))}</option>
          </select>
        </label>
        <label><span>${escapeHtml(loginCopy("Background intensity"))}</span><input type="range" min="0" max="1" step="0.01" data-advanced-setting="background-intensity" value="${escapeHtml(String(current.background.intensity))}" /></label>
        <label><span>${escapeHtml(loginCopy("Background motion"))}</span><input type="range" min="0" max="1" step="0.01" data-advanced-setting="background-motion" value="${escapeHtml(String(current.background.motion))}" /></label>
        <div class="advanced-panel-note">${escapeHtml(loginCopy("These modes share one slow timing curve, so the page can stay animated without flicker."))}</div>
        ${admin ? `<button class="cta ghost tiny" type="button" data-advanced-save="global">${escapeHtml(t("settings.panel.setDefault"))}</button>` : ""}
      </section>
      <section class="advanced-panel-card" data-advanced-panel="engines">
        <div class="advanced-panel-card-title">${escapeHtml(loginCopy("Creation Engines"))}</div>
        <div class="advanced-panel-note">${escapeHtml(loginCopy("Pick the default engine and version per pipeline stage (cover art, lyrics, music, video, subtitles, MV compose). Prices are shown per engine; selections persist across runs and remain overridable. New engines surface here automatically via the /api/mv/engines catalog — nothing is hardcoded."))}</div>
        <div class="mv-engines-panel" data-mv-engines-panel data-mv-engines-state="loading">
          <div class="advanced-panel-note" data-mv-engines-placeholder>${escapeHtml(loginCopy("Loading engine catalog…"))}</div>
        </div>
        ${admin ? `<button class="cta ghost tiny" type="button" data-advanced-save="engines">${escapeHtml(t("settings.panel.setDefault"))}</button>` : ""}
      </section>
      <section class="advanced-panel-card" data-advanced-panel="rerun-policy">
        <div class="advanced-panel-card-title">${escapeHtml(loginCopy("Rerun Policy"))}</div>
        <div class="advanced-panel-note">${escapeHtml(loginCopy("When a rerun hits the same title, choose whether cssOS keeps the old work and creates a sibling output, or rewires the existing work to the new generation. This is the first step toward engine-version refreshes."))}</div>
        <label>
          <span>${escapeHtml(loginCopy("Same-title rerun behavior"))}</span>
          <select data-advanced-setting="works-rerun-strategy">
            <option value="preserve" ${current.works.rerun_strategy === "preserve" ? "selected" : ""}>${escapeHtml(loginCopy("Keep old work, create a new sibling"))}</option>
            <option value="overwrite" ${current.works.rerun_strategy === "overwrite" ? "selected" : ""}>${escapeHtml(loginCopy("Overwrite the matched work link"))}</option>
          </select>
        </label>
        <div class="advanced-panel-note">${escapeHtml(loginCopy("Current implementation already drives single-work reruns. Structured opera / triptych overwrite will follow the same policy next."))}</div>
      </section>
      <section class="advanced-panel-card" data-advanced-panel="membership">
        <div class="advanced-panel-card-title">${escapeHtml(loginCopy("Membership & Boost"))}</div>
        <div class="advanced-panel-note">${escapeHtml(loginCopy("Creation quotas, Studio / Enterprise defaults, and temporary paid add-ons all live here. Inputs apply immediately after you change them, so every field is clamped to safe min/max ranges."))}</div>
        <div class="membership-matrix" role="table" aria-label="${escapeHtml(loginCopy("Membership matrix"))}">
          <div class="membership-matrix-header" role="row">
            <span>${escapeHtml(loginCopy("Tier"))}</span>
            <span>${escapeHtml(loginCopy("Queue"))}</span>
            <span>${escapeHtml(loginCopy("Quota"))}</span>
            <span>${escapeHtml(loginCopy("Generation"))}</span>
            <span>${escapeHtml(loginCopy("Commerce"))}</span>
            <span>${escapeHtml(loginCopy("Boost"))}</span>
          </div>
          ${membershipRows
            .map(
              (row) => `
                <div class="membership-matrix-row" role="row">
                  <span>${escapeHtml(row.tier)}</span>
                  <span>${escapeHtml(row.queue)}</span>
                  <span>${escapeHtml(row.quota)}</span>
                  <span>${escapeHtml(row.generation)}</span>
                  <span>${escapeHtml(row.selling)}</span>
                  <span>${escapeHtml(row.boosts)}</span>
                </div>
              `
            )
            .join("")}
        </div>
        <label><span>${escapeHtml(loginCopy("Starter monthly limit"))}</span><input type="number" min="1" max="1000" step="1" data-advanced-setting="membership-starter-limit" value="${escapeHtml(String(current.membership.starter_monthly_limit))}" ${admin ? "" : "disabled"} /></label>
        <label><span>${escapeHtml(loginCopy("Pro monthly limit"))}</span><input type="number" min="1" max="5000" step="1" data-advanced-setting="membership-pro-limit" value="${escapeHtml(String(current.membership.pro_monthly_limit))}" ${admin ? "" : "disabled"} /></label>
        <label><span>${escapeHtml(loginCopy("Studio monthly limit"))}</span><input type="number" min="1" max="10000" step="1" data-advanced-setting="membership-studio-limit" value="${escapeHtml(String(current.membership.studio_monthly_limit))}" ${admin ? "" : "disabled"} /></label>
        <label><span>${escapeHtml(loginCopy("Enterprise monthly limit (0 = unlimited)"))}</span><input type="number" min="0" max="100000" step="1" data-advanced-setting="membership-enterprise-limit" value="${escapeHtml(String(current.membership.enterprise_monthly_limit))}" ${admin ? "" : "disabled"} /></label>
        <label class="advanced-panel-check"><input type="checkbox" data-advanced-setting="membership-vip-admin-only" ${current.membership.vip_admin_only ? "checked" : ""} ${admin ? "" : "disabled"} /><span>${escapeHtml(loginCopy("VIP remains admin-assigned only"))}</span></label>
        <label><span>${escapeHtml(loginCopy("Extra language price (USD cents)"))}</span><input type="number" min="100" max="100000" step="100" data-advanced-setting="boost-language-unit-cents" value="${escapeHtml(String(current.creator_boost.language_unit_cents))}" ${admin ? "" : "disabled"} /></label>
        <label><span>${escapeHtml(loginCopy("Extra voice lane price (USD cents)"))}</span><input type="number" min="100" max="100000" step="100" data-advanced-setting="boost-voice-unit-cents" value="${escapeHtml(String(current.creator_boost.voice_unit_cents))}" ${admin ? "" : "disabled"} /></label>
        <label><span>${escapeHtml(loginCopy("Thumbnail value-pack price (USD cents)"))}</span><input type="number" min="25" max="100000" step="1" data-advanced-setting="boost-thumbnail-unit-cents" value="${escapeHtml(String(current.creator_boost.thumbnail_unit_cents))}" ${admin ? "" : "disabled"} /></label>
        <label><span>${escapeHtml(loginCopy("Preview video value-pack price (USD cents)"))}</span><input type="number" min="25" max="100000" step="1" data-advanced-setting="boost-preview-video-unit-cents" value="${escapeHtml(String(current.creator_boost.preview_video_unit_cents))}" ${admin ? "" : "disabled"} /></label>
        <label><span>${escapeHtml(loginCopy("Extra generation price (USD cents)"))}</span><input type="number" min="25" max="100000" step="1" data-advanced-setting="boost-generation-unit-cents" value="${escapeHtml(String(current.creator_boost.generation_unit_cents))}" ${admin ? "" : "disabled"} /></label>
        <label><span>${escapeHtml(loginCopy("Background queue slot price (USD cents)"))}</span><input type="number" min="25" max="100000" step="1" data-advanced-setting="boost-background-job-unit-cents" value="${escapeHtml(String(current.creator_boost.background_job_unit_cents || 199))}" ${admin ? "" : "disabled"} /></label>
        <label class="advanced-panel-check"><input type="checkbox" data-advanced-setting="boost-admin-only-purchase-override" ${current.creator_boost.admin_only_purchase_override ? "checked" : ""} ${admin ? "" : "disabled"} /><span>${escapeHtml(loginCopy("Temporarily make boost purchases admin-only"))}</span></label>
        <label><span>${escapeHtml(loginCopy("Studio included extra languages"))}</span><input type="number" min="0" max="10" step="1" data-advanced-setting="boost-studio-language-included" value="${escapeHtml(String(current.creator_boost.studio_includes_extra_languages))}" ${admin ? "" : "disabled"} /></label>
        <label><span>${escapeHtml(loginCopy("Studio included extra voices"))}</span><input type="number" min="0" max="10" step="1" data-advanced-setting="boost-studio-voice-included" value="${escapeHtml(String(current.creator_boost.studio_includes_extra_voices))}" ${admin ? "" : "disabled"} /></label>
        <label><span>${escapeHtml(loginCopy("Enterprise included extra languages"))}</span><input type="number" min="0" max="20" step="1" data-advanced-setting="boost-enterprise-language-included" value="${escapeHtml(String(current.creator_boost.enterprise_includes_extra_languages))}" ${admin ? "" : "disabled"} /></label>
        <label><span>${escapeHtml(loginCopy("Enterprise included extra voices"))}</span><input type="number" min="0" max="20" step="1" data-advanced-setting="boost-enterprise-voice-included" value="${escapeHtml(String(current.creator_boost.enterprise_includes_extra_voices))}" ${admin ? "" : "disabled"} /></label>
        <label class="advanced-panel-check"><input type="checkbox" data-advanced-setting="studio-team-collaboration-enabled" ${current.studio_enterprise.team_collaboration_enabled ? "checked" : ""} ${admin ? "" : "disabled"} /><span>${escapeHtml(loginCopy("Enable Studio/Enterprise team collaboration"))}</span></label>
        <label><span>${escapeHtml(loginCopy("Max team members"))}</span><input type="number" min="1" max="500" step="1" data-advanced-setting="studio-max-team-members" value="${escapeHtml(String(current.studio_enterprise.max_team_members))}" ${admin ? "" : "disabled"} /></label>
        <label class="advanced-panel-check"><input type="checkbox" data-advanced-setting="studio-multi-project-enabled" ${current.studio_enterprise.multi_project_enabled ? "checked" : ""} ${admin ? "" : "disabled"} /><span>${escapeHtml(loginCopy("Enable multi-project workspaces"))}</span></label>
        <label><span>${escapeHtml(loginCopy("Max projects"))}</span><input type="number" min="1" max="1000" step="1" data-advanced-setting="studio-max-projects" value="${escapeHtml(String(current.studio_enterprise.max_projects))}" ${admin ? "" : "disabled"} /></label>
        <label class="advanced-panel-check"><input type="checkbox" data-advanced-setting="enterprise-api-enabled" ${current.studio_enterprise.enterprise_api_enabled ? "checked" : ""} ${admin ? "" : "disabled"} /><span>${escapeHtml(loginCopy("Enable enterprise API access"))}</span></label>
        <label><span>${escapeHtml(loginCopy("Enterprise API RPM"))}</span><input type="number" min="1" max="100000" step="1" data-advanced-setting="enterprise-api-rpm" value="${escapeHtml(String(current.studio_enterprise.enterprise_api_rate_limit_per_minute))}" ${admin ? "" : "disabled"} /></label>
        <div class="advanced-panel-note">${escapeHtml(loginCopy(`Available boosts: generation ${Number(boostInfo?.generation?.available || 0)}, background slots ${Number(boostInfo?.background_job?.available || 0)}, language ${Number(boostInfo?.language?.available || 0)}, voice ${Number(boostInfo?.voice?.available || 0)}, thumbnail ${Number(boostInfo?.thumbnail?.available || 0)}, preview video ${Number(boostInfo?.preview_video?.available || 0)}.`))}</div>
        <div class="advanced-panel-subsection">
          <div class="advanced-panel-subtitle">${escapeHtml(loginCopy("MV Subtitle Track Manager"))}</div>
          <div class="advanced-panel-note">${escapeHtml(loginCopy("Keep the picture fixed. Add subtitle lyric languages or extra voice lanes as separate delivery tracks only. Checking a new billable language or voice will ask for Creator Boost checkout before the run."))}</div>
          <div class="advanced-panel-track-summary">
            <span>${escapeHtml(loginCopy(`Current lyric tracks: ${selectedLanguages.join(" / ")}`))}</span>
            <span>${escapeHtml(loginCopy(`Current voice lanes: ${selectedVoices.map((voice) => voiceLabelMap.get(String(voice || "")) || voice).join(" / ")}`))}</span>
          </div>
          <div class="advanced-panel-pill-strip scroll-peek" data-scroll-peek>
            ${languageCatalog
              .map((entry) => {
                const code = String(entry?.code || "").trim().toLowerCase();
                const checked = selectedLanguages.includes(code);
                const locked = code === primaryLanguage;
                const label = locked
                  ? loginCopy(`${entry.label} · original`)
                  : entry.label;
                return `<button class="advanced-pill${checked ? " is-active" : ""}${locked ? " is-locked" : ""}" type="button" data-track-language="${escapeHtml(code)}" ${locked ? "disabled" : ""}>${escapeHtml(label)}</button>`;
              })
              .join("")}
          </div>
          <div class="advanced-panel-pill-strip scroll-peek" data-scroll-peek>
            ${voiceCatalog
              .map((entry) => {
                const code = String(entry?.code || "").trim().toLowerCase();
                const checked = selectedVoices.includes(code);
                return `<button class="advanced-pill${checked ? " is-active" : ""}" type="button" data-track-voice="${escapeHtml(code)}">${escapeHtml(String(entry?.label || code))}</button>`;
              })
              .join("")}
          </div>
          <div class="advanced-panel-note">${escapeHtml(loginCopy("Each extra lyric language can later become its own lyrics tab, ASS track, karaoke track, and multilingual delivery slot. No subtitle burn-in is allowed."))}</div>
        </div>
        <!-- CSSOS_PHASE2_PAYMENTS 20260419 — Creator Boost purchase shop now
             offers BOTH international Stripe and domestic NihaoPay
             (Alipay / WeChat Pay / UnionPay) for every boost kind.
             Each card represents a single boost product with its own
             two-gateway payment group.
             P2-57b admin_only_purchase_override still gates the purchase
             for non-admins (disabled=true on the mini-btn elements). -->
        <div class="boost-shop-grid advanced-panel-boost-shop">
          ${[
            { kind: "generation", quantity: 10, unitCents: Math.max(0, Number(current.creator_boost.generation_unit_cents || 99)) * 10, title: loginCopy("Buy 10 extra generations") },
            { kind: "background_job", quantity: 1, unitCents: Math.max(0, Number(current.creator_boost.background_job_unit_cents || 199)), title: loginCopy("Buy 1 background slot") },
            { kind: "language", quantity: 1, unitCents: Math.max(0, Number(current.creator_boost.language_unit_cents || 300)), title: loginCopy("Buy 1 extra language") },
            { kind: "voice", quantity: 1, unitCents: Math.max(0, Number(current.creator_boost.voice_unit_cents || 500)), title: loginCopy("Buy 1 extra voice lane") },
            { kind: "thumbnail", quantity: 1, unitCents: Math.max(0, Number(current.creator_boost.thumbnail_unit_cents || 99)), title: loginCopy("Buy 1 thumbnail value-pack") },
            { kind: "preview_video", quantity: 1, unitCents: Math.max(0, Number(current.creator_boost.preview_video_unit_cents || 199)), title: loginCopy("Buy 1 preview video value-pack") }
          ].map((item) => {
            const locked = (current.creator_boost.admin_only_purchase_override && !admin);
            const disabledAttr = locked ? "disabled" : "";
            const priceLabel = `$${(Number(item.unitCents || 0) / 100).toFixed(2)}`;
            return `
            <div class="boost-shop-card">
              <div class="boost-shop-head">
                <span class="boost-shop-title">${escapeHtml(item.title)}</span>
                <span class="boost-shop-price">${escapeHtml(priceLabel)}</span>
              </div>
              <div class="pay-group">
                <div class="pay-group-head">
                  <span class="pay-group-dot intl"></span>
                  <span>${escapeHtml(loginCopy("International · Stripe"))}</span>
                </div>
                <div class="pay-group-body">
                  <button class="mini-btn pay-stripe" type="button" data-creator-boost-checkout="${escapeHtml(item.kind)}" data-creator-boost-quantity="${item.quantity}" ${disabledAttr}>${escapeHtml(loginCopy("Pay with card"))}</button>
                </div>
              </div>
              <div class="pay-group">
                <div class="pay-group-head">
                  <span class="pay-group-dot cn"></span>
                  <span>${escapeHtml(loginCopy("China · NihaoPay"))}</span>
                </div>
                <div class="pay-group-body">
                  <button class="mini-btn pay-vendor alipay" type="button" data-creator-boost-nihaopay-vendor="alipay" data-creator-boost-nihaopay-kind="${escapeHtml(item.kind)}" data-creator-boost-nihaopay-quantity="${item.quantity}" data-creator-boost-nihaopay-price="${item.unitCents}" ${disabledAttr}>${escapeHtml(loginCopy("Alipay"))}</button>
                  <button class="mini-btn pay-vendor wechatpay" type="button" data-creator-boost-nihaopay-vendor="wechatpay" data-creator-boost-nihaopay-kind="${escapeHtml(item.kind)}" data-creator-boost-nihaopay-quantity="${item.quantity}" data-creator-boost-nihaopay-price="${item.unitCents}" ${disabledAttr}>${escapeHtml(loginCopy("WeChat Pay"))}</button>
                  <button class="mini-btn pay-vendor unionpay" type="button" data-creator-boost-nihaopay-vendor="unionpay" data-creator-boost-nihaopay-kind="${escapeHtml(item.kind)}" data-creator-boost-nihaopay-quantity="${item.quantity}" data-creator-boost-nihaopay-price="${item.unitCents}" ${disabledAttr}>${escapeHtml(loginCopy("UnionPay"))}</button>
                </div>
              </div>
            </div>
          `;
          }).join("")}
        </div>
        ${admin ? `
          <div class="advanced-panel-note">${escapeHtml(loginCopy("Admin-only member controls: VIP is assigned manually here and is never publicly self-serve."))}</div>
          <label><span>${escapeHtml(loginCopy("Target user email"))}</span><input type="email" data-advanced-setting="admin-target-email" placeholder="member@example.com" /></label>
          <label><span>${escapeHtml(loginCopy("Assign membership tier"))}</span>
            <select data-advanced-setting="admin-target-tier">
              <option value="free">${escapeHtml(loginCopy("Basic / Free"))}</option>
              <option value="starter">${escapeHtml(loginCopy("Starter"))}</option>
              <option value="pro">${escapeHtml(loginCopy("Pro"))}</option>
              <option value="studio">${escapeHtml(loginCopy("Studio"))}</option>
              <option value="enterprise">${escapeHtml(loginCopy("Enterprise"))}</option>
              <option value="vip">VIP</option>
            </select>
          </label>
          <div class="advanced-panel-actions">
            <button class="cta ghost tiny" type="button" data-admin-membership-assign>${escapeHtml(loginCopy("Apply membership"))}</button>
          </div>
          <label><span>${escapeHtml(loginCopy("Manual entitlement kind"))}</span>
            <select data-advanced-setting="admin-entitlement-kind">
              <option value="generation">${escapeHtml(loginCopy("Extra generation"))}</option>
              <option value="language">${escapeHtml(loginCopy("Extra language"))}</option>
              <option value="voice">${escapeHtml(loginCopy("Extra voice lane"))}</option>
              <option value="thumbnail">${escapeHtml(loginCopy("Thumbnail regeneration"))}</option>
              <option value="preview_video">${escapeHtml(loginCopy("Preview video regeneration"))}</option>
            </select>
          </label>
          <label><span>${escapeHtml(loginCopy("Manual entitlement quantity"))}</span><input type="number" min="1" max="200" step="1" value="1" data-advanced-setting="admin-entitlement-quantity" /></label>
          <label><span>${escapeHtml(loginCopy("Manual grant note"))}</span><input type="text" maxlength="240" data-advanced-setting="admin-entitlement-note" placeholder="${escapeHtml(loginCopy("VIP courtesy / contract / migration"))}" /></label>
          <div class="advanced-panel-actions">
            <button class="cta ghost tiny" type="button" data-admin-entitlement-grant>${escapeHtml(loginCopy("Grant entitlement"))}</button>
          </div>
        ` : ""}
        ${admin ? `<button class="cta ghost tiny" type="button" data-advanced-save="membership">${escapeHtml(t("settings.panel.setDefault"))}</button>` : ""}
      </section>
      ${
        admin
          ? `
            <section class="advanced-panel-card" data-advanced-panel="permission-overview">
              <div class="advanced-panel-card-title">${escapeHtml(loginCopy("Action Permission Overview"))}</div>
              <div class="advanced-panel-note">${escapeHtml(loginCopy("Admin read-only overview for concrete actions and buttons across works, seller, api, reports, login, profile, creation, and cssmv."))}</div>
              <div class="permission-overview-summary">
                <span>${escapeHtml(loginCopy(`Showing ${filteredActionMatrixRows.length} actions`))}</span>
                <button class="report-export-action is-muted" type="button" data-permission-filter-reset>${escapeHtml(loginCopy("Clear all filters"))}</button>
              </div>
              <div class="permission-overview-filters" role="group" aria-label="${escapeHtml(loginCopy("Permission overview filters"))}">
                <button class="report-export-source ${permissionOverviewFilter === "all" ? "is-active" : ""}" type="button" data-permission-filter="all">${escapeHtml(loginCopy("All"))}</button>
                <button class="report-export-source ${permissionOverviewFilter === "delivery" ? "is-active" : ""}" type="button" data-permission-filter="delivery">delivery</button>
              </div>
              <div class="permission-overview-filters" role="group" aria-label="${escapeHtml(loginCopy("Permission requirement filters"))}">
                <button class="report-export-source ${permissionOverviewRequirementFilter === "all" ? "is-active" : ""}" type="button" data-permission-requirement-filter="all">${escapeHtml(loginCopy("All Thresholds"))}</button>
                <button class="report-export-source ${permissionOverviewRequirementFilter === "basic" ? "is-active" : ""}" type="button" data-permission-requirement-filter="basic">Basic+</button>
                <button class="report-export-source ${permissionOverviewRequirementFilter === "pro" ? "is-active" : ""}" type="button" data-permission-requirement-filter="pro">Pro+</button>
                <button class="report-export-source ${permissionOverviewRequirementFilter === "enterprise" ? "is-active" : ""}" type="button" data-permission-requirement-filter="enterprise">Enterprise+</button>
                <button class="report-export-source ${permissionOverviewRequirementFilter === "vip" ? "is-active" : ""}" type="button" data-permission-requirement-filter="vip">VIP+</button>
                <button class="report-export-source ${permissionOverviewRequirementFilter === "admin" ? "is-active" : ""}" type="button" data-permission-requirement-filter="admin">Admin</button>
              </div>
              <div class="permission-overview-filters" role="group" aria-label="${escapeHtml(loginCopy("Delivery domain filters"))}">
                <button class="report-export-source ${permissionOverviewDomainFilter === "all" ? "is-active" : ""}" type="button" data-permission-domain-filter="all">${escapeHtml(loginCopy("All Domains"))}</button>
                <button class="report-export-source ${permissionOverviewDomainFilter === "watch" ? "is-active" : ""}" type="button" data-permission-domain-filter="watch">watch</button>
                <button class="report-export-source ${permissionOverviewDomainFilter === "rewrite" ? "is-active" : ""}" type="button" data-permission-domain-filter="rewrite">rewrite</button>
                <button class="report-export-source ${permissionOverviewDomainFilter === "compliance" ? "is-active" : ""}" type="button" data-permission-domain-filter="compliance">compliance</button>
                <button class="report-export-source ${permissionOverviewDomainFilter === "probe" ? "is-active" : ""}" type="button" data-permission-domain-filter="probe">probe</button>
                <button class="report-export-source ${permissionOverviewDomainFilter === "publish" ? "is-active" : ""}" type="button" data-permission-domain-filter="publish">publish</button>
              </div>
              <div class="permission-overview-table" role="table" aria-label="${escapeHtml(loginCopy("Action permission matrix"))}">
                <div class="permission-overview-header" role="row">
                  <span>${escapeHtml(loginCopy("Panel"))}</span>
                  <span>${escapeHtml(loginCopy("Action"))}</span>
                  <span>${escapeHtml(loginCopy("Threshold"))}</span>
                  <span>${escapeHtml(loginCopy("Guest"))}</span>
                  <span>${escapeHtml(loginCopy("Free"))}</span>
                  <span>${escapeHtml(loginCopy("Starter"))}</span>
                  <span>Pro</span>
                  <span>Studio</span>
                  <span>Enterprise</span>
                  <span>VIP</span>
                  <span>${escapeHtml(loginCopy("Admin"))}</span>
                </div>
                ${filteredActionMatrixRows
                  .map(
                    (row) => `
                      <div class="permission-overview-row" role="row">
                        <span>${escapeHtml(String(row.panel || ""))}</span>
                        <span>${escapeHtml(String(row.action || ""))}</span>
                        <span class="permission-threshold-chip">${escapeHtml(String(row.requirement || ""))}</span>
                        <span>${escapeHtml(buildPermissionCellForTier(row, "guest"))}</span>
                        <span>${escapeHtml(buildPermissionCellForTier(row, "free"))}</span>
                        <span>${escapeHtml(buildPermissionCellForTier(row, "starter"))}</span>
                        <span>${escapeHtml(buildPermissionCellForTier(row, "pro"))}</span>
                        <span>${escapeHtml(buildPermissionCellForTier(row, "studio"))}</span>
                        <span>${escapeHtml(buildPermissionCellForTier(row, "enterprise"))}</span>
                        <span>${escapeHtml(buildPermissionCellForTier(row, "vip"))}</span>
                        <span>${escapeHtml(buildPermissionCellForTier(row, "admin"))}</span>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </section>
          `
          : ""
      }
    </div>
  `;
}

globalThis.buildAdvancedPanelSettingsMarkupBridge = buildAdvancedPanelSettingsMarkupBridge;
