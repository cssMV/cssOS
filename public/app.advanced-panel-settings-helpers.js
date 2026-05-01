function buildDeferredAdvancedMembershipMarkupBridge() {
  return `
    <section class="advanced-panel-card" data-advanced-panel="membership">
      <div class="advanced-panel-card-title">${escapeHtml(loginCopy("Membership & Boost"))}</div>
      <div class="advanced-panel-note">${escapeHtml(loginCopy("Heavy membership controls are loading in the next frame so the page can respond first."))}</div>
    </section>
  `;
}

function buildDeferredAdvancedPermissionMarkupBridge() {
  return `
    <section class="advanced-panel-card" data-advanced-panel="permission-overview">
      <div class="advanced-panel-card-title">${escapeHtml(loginCopy("Action Permission Overview"))}</div>
      <div class="advanced-panel-note">${escapeHtml(loginCopy("Permission matrix is loading after the base controls."))}</div>
    </section>
  `;
}

function stripAdvancedHeavyMarkupBridge(markup, admin) {
  let nextMarkup = String(markup || "");
  nextMarkup = nextMarkup.replace(
    /<section class="advanced-panel-card" data-advanced-panel="membership">[\s\S]*?<\/section>/,
    buildDeferredAdvancedMembershipMarkupBridge()
  );
  if (admin) {
    nextMarkup = nextMarkup.replace(
      /<section class="advanced-panel-card" data-advanced-panel="permission-overview">[\s\S]*?<\/section>/,
      buildDeferredAdvancedPermissionMarkupBridge()
    );
  }
  return nextMarkup;
}

function collectAdvancedPanelSettingsFromDomBridge() {
  const pick = (sel) => advancedPanelSettings?.querySelector(sel);
  const current = readPanelBehaviorSettingsLocal();
  // CSSOS_PHASE2_MV_ENGINES_SELECTOR 20260418 —
  // Walk the hydrated per-stage selectors (data-mv-engine-stage) and mirror
  // the current selection into a new mv_pipeline_engines settings branch so
  // admin savePanelDefaults can persist per-stage engine defaults. The legacy
  // "engines" branch below is kept untouched for backward compatibility.
  const mvPipelineEngines = {
    ...(current.mv_pipeline_engines && typeof current.mv_pipeline_engines === "object"
      ? current.mv_pipeline_engines
      : {})
  };
  if (advancedPanelSettings) {
    advancedPanelSettings
      .querySelectorAll("[data-mv-engine-stage]")
      .forEach((row) => {
        if (!(row instanceof HTMLElement)) return;
        const stageKey = String(row.getAttribute("data-mv-engine-stage") || "")
          .trim()
          .toLowerCase();
        if (!stageKey) return;
        const select = row.querySelector("[data-mv-engine-select]");
        if (!(select instanceof HTMLSelectElement)) return;
        const raw = String(select.value || "");
        const sep = raw.indexOf("::");
        if (sep <= 0) {
          delete mvPipelineEngines[stageKey];
          return;
        }
        const engine = raw.slice(0, sep);
        const version = raw.slice(sep + 2);
        if (engine && version) {
          mvPipelineEngines[stageKey] = { engine, version };
        } else {
          delete mvPipelineEngines[stageKey];
        }
      });
  }
  return sanitizePanelBehaviorSettings({
    ...current,
    mv_pipeline_engines: mvPipelineEngines,
    appearance: {
      ...(current.appearance || {}),
      theme_mode:
        pick('[data-advanced-setting="theme-mode"]')?.value ||
        current.appearance?.theme_mode ||
        "system"
    },
    logo: {
      ...current.logo,
      spell: pick('[data-advanced-setting="logo-spell"]')?.value || current.logo.spell || DEFAULT_SPELL,
      subtitle: pick('[data-advanced-setting="logo-subtitle"]')?.value || current.logo.subtitle || "Studio",
      slogan_template:
        pick('[data-advanced-setting="logo-slogan-template"]')?.value ||
        current.logo.slogan_template ||
        "Just say <span class=\"spell\">{spell}</span>, witness the miracle!",
      mirror_size_px: Number(
        pick('[data-advanced-setting="logo-size"]')?.value || current.logo.mirror_size_px || 600
      ),
      mask_inset_percent: Number(
        pick('[data-advanced-setting="logo-mask-inset"]')?.value ||
          current.logo.mask_inset_percent ||
          12
      ),
      mirror_strategy:
        pick('[data-advanced-setting="logo-strategy"]')?.value ||
        current.logo.mirror_strategy ||
        MIRROR_ANIMATION_STRATEGIES.PER_TYPE,
      fixed_mode:
        pick('[data-advanced-setting="logo-fixed"]')?.value ||
        current.logo.fixed_mode ||
        MIRROR_ANIMATION_MODES.HALO,
      per_type: {
        single:
          pick('[data-advanced-setting="logo-single"]')?.value ||
          current.logo.per_type?.single ||
          MIRROR_ANIMATION_MODES.HALO,
        triptych:
          pick('[data-advanced-setting="logo-triptych"]')?.value ||
          current.logo.per_type?.triptych ||
          MIRROR_ANIMATION_MODES.BREATH,
        opera:
          pick('[data-advanced-setting="logo-opera"]')?.value ||
          current.logo.per_type?.opera ||
          MIRROR_ANIMATION_MODES.PRISM
      }
    },
    mic: {
      ...current.mic,
      longpress_ms: Number(pick('[data-advanced-setting="mic-longpress-ms"]')?.value || 600),
      max_hold_sec: Number(pick('[data-advanced-setting="mic-max-hold-sec"]')?.value || 30),
      logo_surface_mode:
        pick('[data-setting="mic-logo-surface-mode"]')?.value ||
        current.mic.logo_surface_mode ||
        "mv_only",
      dock_surface_mode:
        pick('[data-setting="mic-dock-surface-mode"]')?.value ||
        current.mic.dock_surface_mode ||
        "mv_only",
      settings_surface_mode:
        pick('[data-setting="mic-settings-surface-mode"]')?.value ||
        current.mic.settings_surface_mode ||
        "mv_only"
    },
    dock: {
      ...current.dock,
      scale: Number(pick('[data-advanced-setting="dock-scale"]')?.value || 1),
      background_opacity: Number(
        pick('[data-advanced-setting="dock-background-opacity"]')?.value ||
          current.dock.background_opacity ||
          0.24
      ),
      show_labels: !!pick('[data-advanced-setting="dock-labels"]')?.checked,
      docking_enabled: !!pick('[data-advanced-setting="dock-docking"]')?.checked,
      dock_position: pick('[data-advanced-setting="dock-position"]')?.value || "bottom"
    },
    background: {
      ...current.background,
      mode: pick('[data-advanced-setting="background-mode"]')?.value || current.background.mode || "aurora",
      intensity: Number(
        pick('[data-advanced-setting="background-intensity"]')?.value ||
          current.background.intensity ||
          0.48
      ),
      motion: Number(
        pick('[data-advanced-setting="background-motion"]')?.value ||
          current.background.motion ||
          0.24
      )
    },
    engines: {
      lyrics: pick('[data-advanced-setting="engine-lyrics"]')?.value || current.engines?.lyrics || "cssmv",
      cover: pick('[data-advanced-setting="engine-cover"]')?.value || current.engines?.cover || "cssmv",
      music: pick('[data-advanced-setting="engine-music"]')?.value || current.engines?.music || "cssmv",
      video: pick('[data-advanced-setting="engine-video"]')?.value || current.engines?.video || "cssmv",
      mv: pick('[data-advanced-setting="engine-mv"]')?.value || current.engines?.mv || "cssmv"
    },
    works: {
      ...current.works,
      rerun_strategy:
        pick('[data-advanced-setting="works-rerun-strategy"]')?.value ||
        current.works.rerun_strategy ||
        "preserve"
    },
    membership: {
      ...current.membership,
      starter_monthly_limit: Number(
        pick('[data-advanced-setting="membership-starter-limit"]')?.value ||
          current.membership.starter_monthly_limit
      ),
      pro_monthly_limit: Number(
        pick('[data-advanced-setting="membership-pro-limit"]')?.value ||
          current.membership.pro_monthly_limit
      ),
      studio_monthly_limit: Number(
        pick('[data-advanced-setting="membership-studio-limit"]')?.value ||
          current.membership.studio_monthly_limit
      ),
      enterprise_monthly_limit: Number(
        pick('[data-advanced-setting="membership-enterprise-limit"]')?.value ||
          current.membership.enterprise_monthly_limit
      ),
      vip_admin_only: !!pick('[data-advanced-setting="membership-vip-admin-only"]')?.checked
    },
    creator_boost: {
      ...current.creator_boost,
      enabled_kinds: ["language", "voice", "thumbnail", "preview_video", "generation", "background_job"],
      language_unit_cents: Number(
        pick('[data-advanced-setting="boost-language-unit-cents"]')?.value ||
          current.creator_boost.language_unit_cents
      ),
      voice_unit_cents: Number(
        pick('[data-advanced-setting="boost-voice-unit-cents"]')?.value ||
          current.creator_boost.voice_unit_cents
      ),
      thumbnail_unit_cents: Number(
        pick('[data-advanced-setting="boost-thumbnail-unit-cents"]')?.value ||
          current.creator_boost.thumbnail_unit_cents
      ),
      preview_video_unit_cents: Number(
        pick('[data-advanced-setting="boost-preview-video-unit-cents"]')?.value ||
          current.creator_boost.preview_video_unit_cents
      ),
      generation_unit_cents: Number(
        pick('[data-advanced-setting="boost-generation-unit-cents"]')?.value ||
          current.creator_boost.generation_unit_cents
      ),
      background_job_unit_cents: Number(
        pick('[data-advanced-setting="boost-background-job-unit-cents"]')?.value ||
          current.creator_boost.background_job_unit_cents
      ),
      admin_only_purchase_override: !!pick(
        '[data-advanced-setting="boost-admin-only-purchase-override"]'
      )?.checked,
      studio_includes_extra_languages: Number(
        pick('[data-advanced-setting="boost-studio-language-included"]')?.value ||
          current.creator_boost.studio_includes_extra_languages
      ),
      enterprise_includes_extra_languages: Number(
        pick('[data-advanced-setting="boost-enterprise-language-included"]')?.value ||
          current.creator_boost.enterprise_includes_extra_languages
      ),
      studio_includes_extra_voices: Number(
        pick('[data-advanced-setting="boost-studio-voice-included"]')?.value ||
          current.creator_boost.studio_includes_extra_voices
      ),
      enterprise_includes_extra_voices: Number(
        pick('[data-advanced-setting="boost-enterprise-voice-included"]')?.value ||
          current.creator_boost.enterprise_includes_extra_voices
      )
    },
    billing_actions: {
      ...current.billing_actions
    },
    studio_enterprise: {
      ...current.studio_enterprise,
      team_collaboration_enabled: !!pick(
        '[data-advanced-setting="studio-team-collaboration-enabled"]'
      )?.checked,
      max_team_members: Number(
        pick('[data-advanced-setting="studio-max-team-members"]')?.value ||
          current.studio_enterprise.max_team_members
      ),
      multi_project_enabled: !!pick('[data-advanced-setting="studio-multi-project-enabled"]')?.checked,
      max_projects: Number(
        pick('[data-advanced-setting="studio-max-projects"]')?.value ||
          current.studio_enterprise.max_projects
      ),
      enterprise_api_enabled: !!pick('[data-advanced-setting="enterprise-api-enabled"]')?.checked,
      enterprise_api_rate_limit_per_minute: Number(
        pick('[data-advanced-setting="enterprise-api-rpm"]')?.value ||
          current.studio_enterprise.enterprise_api_rate_limit_per_minute
      )
    }
  });
}

Object.assign(globalThis, {
  buildDeferredAdvancedMembershipMarkupBridge,
  buildDeferredAdvancedPermissionMarkupBridge,
  stripAdvancedHeavyMarkupBridge,
  collectAdvancedPanelSettingsFromDomBridge
});
