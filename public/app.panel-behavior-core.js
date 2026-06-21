const PANEL_BEHAVIOR_DEFAULT_SPELL = String(globalThis.DEFAULT_SPELL || "CSS");
const PANEL_BEHAVIOR_MIRROR_ANIMATION_MODES =
  globalThis.MIRROR_ANIMATION_MODES ||
  Object.freeze({
    HALO: "halo",
    BREATH: "breath",
    PRISM: "prism",
    ORACLE: "oracle",
  });
const PANEL_BEHAVIOR_MIRROR_ANIMATION_STRATEGIES =
  globalThis.MIRROR_ANIMATION_STRATEGIES ||
  Object.freeze({
    PER_TYPE: "per_type",
    FIXED: "fixed",
    RANDOM: "random",
  });
const PANEL_BEHAVIOR_FORYOU_PREVIEW_MODES =
  globalThis.FORYOU_PREVIEW_MODES ||
  Object.freeze({
    AUTO: "auto",
    IMAGE: "image",
    VIDEO: "video",
  });

globalThis.DEFAULT_SPELL ??= PANEL_BEHAVIOR_DEFAULT_SPELL;
globalThis.FORYOU_PREVIEW_MODES ??= PANEL_BEHAVIOR_FORYOU_PREVIEW_MODES;
const panelBehaviorLoginCopy =
  typeof globalThis.loginCopy === "function"
    ? globalThis.loginCopy.bind(globalThis)
    : (en, zh) => {
        const locale = String(globalThis.currentLocale || navigator.language || "en").toLowerCase();
        return locale.startsWith("zh") ? zh : en;
      };
const panelBehaviorDeliveryReportsPanel =
  globalThis.deliveryReportsPanel || document.getElementById("delivery-reports-panel");
const PANEL_BEHAVIOR_DELIVERY_REPORT_KINDS =
  globalThis.DELIVERY_REPORT_KINDS ||
  Object.freeze([
    "dashboard",
    "ops_health",
    "kpi",
    "analytics",
    "trends",
    "alerts",
    "digest",
    "briefing_pack"
  ]);
const panelBehaviorCreationSetDefaults =
  globalThis.creationSetDefaults || document.getElementById("creation-set-defaults");
const PANEL_BEHAVIOR_FORYOU_PREVIEW_MODE_KEY =
  globalThis.FORYOU_PREVIEW_MODE_KEY || "cssos.foryou.previewMode";
const PANEL_BEHAVIOR_WATCH_ACTIVE_TAB_KEY =
  globalThis.WATCH_ACTIVE_TAB_KEY || "cssos.watch.activeTab";

function defaultPanelBehaviorSettings() {
  const midpointNumber = (min, max, step = 1, precision = 4) => {
    const safeMin = Number(min || 0);
    const safeMax = Number(max || 0);
    const safeStep = Math.max(Number(step || 1), 0.0001);
    const raw = (safeMin + safeMax) / 2;
    const snapped = safeMin + Math.round((raw - safeMin) / safeStep) * safeStep;
    return Number(snapped.toFixed(precision));
  };
  const panelCommands = Object.values(globalThis.PANEL_COMMAND_CATALOG || {}).reduce((acc, item) => {
    if (!item?.behaviorKey) return acc;
    acc[item.behaviorKey] = {
      shortcut_key: String(item.fallbackShortcut || "").slice(0, 1).toLowerCase(),
      voice_command: String(item.fallbackVoice?.en || "")
    };
    return acc;
  }, {});
  return {
    appearance: {
      theme_mode: "system"
    },
    /* CSSOS_PHASE2_PANEL_CHROME_V2 20260419:
       Panel "constitution" v2 defaults. These drive:
       - panel_chrome.transparent       -> html[data-panel-transparent]
                                           (legacy boolean, preserved for
                                           back-compat; if true, coerces
                                           background_opacity to 0.70)
       - panel_chrome.background_opacity -> CSS var --panel-alpha
                                           (new slider, 0.70..1.00, default 1)
       - panel_chrome.maximize_mode     -> panel[data-maximize-mode]
                                           (fullscreen | classic)
       - panel_chrome.layout_mode       -> html[data-panel-layout-mode]
                                           (stack_00 | showcase_grid)
       Default is fully opaque (Apple/Windows-style), full-screen maximize,
       0,0 stacked open. */
    panel_chrome: {
      transparent: false,
      background_opacity: 1,
      maximize_mode: "fullscreen",
      layout_mode: "stack_00"
    },
    logo: {
      spell: PANEL_BEHAVIOR_DEFAULT_SPELL,
      subtitle: "Studio",
      slogan_template: "Just say <span class=\"spell\">{spell}</span>, witness the miracle!",
      mirror_size_px: 360,   // CSSOS_WAVE_1033 20260620 — Jing「保持进入时那个小尺寸, 别撑大」: 旧默认
                             // 600 被 70vh 撑到 ~420(大)。改 360 = 进入时的小 logo, 且 = CSS 兜底
                             // var(--mirror-size,360px), 首屏与 applySettings 后一致 → 无跳变。想调大去
                             // 高级设置 logo 尺寸滑块。
      mask_inset_percent: midpointNumber(0, 28, 1, 0),
      spellcast_ring_scale: midpointNumber(0.82, 1.12, 0.01),
      spellcast_glow_scale: midpointNumber(0, 1, 0.02, 2),
      gray_ring_speed_sec: midpointNumber(2, 18, 0.5, 1),
      gray_ring_grayscale: midpointNumber(0, 1, 0.02, 2),
      gray_ring_colorfulness: midpointNumber(0, 1, 0.02, 2),
      spellcast_layer: "behind",
      hold_ring_scale: midpointNumber(0.82, 1.12, 0.01),
      hold_ring_layer: "behind",
      media: {
        image_1: "assets/mirror-1.webp",
        image_2: "assets/mirror-2.webp",
        video: ""
      },
      mirror_strategy: PANEL_BEHAVIOR_MIRROR_ANIMATION_STRATEGIES.PER_TYPE,
      fixed_mode: PANEL_BEHAVIOR_MIRROR_ANIMATION_MODES.HALO,
      per_type: {
        single: PANEL_BEHAVIOR_MIRROR_ANIMATION_MODES.HALO,
        triptych: PANEL_BEHAVIOR_MIRROR_ANIMATION_MODES.BREATH,
        opera: PANEL_BEHAVIOR_MIRROR_ANIMATION_MODES.PRISM
      }
    },
    dock: {
      scale: 1,
      background_opacity: 0.24,
      show_labels: true,
      docking_enabled: true,
      dock_position: "bottom"
    },
    background: {
      mode: "aurora",
      intensity: 0.48,
      motion: 0.24
    },
    mic: {
      longpress_ms: 600,
      max_hold_sec: 30,
      logo_surface_mode: "mv_only",
      dock_surface_mode: "mv_only",
      settings_surface_mode: "mv_only"
    },
    cssmv: {
      default_section: "digest",
      auto_refresh: true
    },
    language: {
      default_mode: "content",
      show_more: false
    },
    login: {
      panel_density: "full",
      preferred_provider: "google",
      show_logout: true,
      session_days: 90
    },
    profile: {
      panel_density: "full",
      note: "",
      default_nav: "works"
    },
    works: {
      focus_section: "works",
      auto_load: true,
      search_enabled: true,
      search_limit: 10,
      default_sort: "newest",
      default_filter: "all",
      rerun_strategy: "preserve"
    },
    seller: {
      focus_lane: "orders",
      auto_refresh: true,
      order_filter: "all",
      ledger_limit: 12
    },
    about: {
      default_tab: "whitepaper",
      density: "relaxed"
    },
    api: {
      billing_mode: "full",
      payment_method: "card",
      auto_recharge: true
    },
    membership: {
      starter_monthly_limit: 30,
      pro_monthly_limit: 100,
      studio_monthly_limit: 300,
      enterprise_monthly_limit: 0,
      vip_admin_only: true
    },
    creator_boost: {
      enabled_kinds: ["language", "voice", "thumbnail", "preview_video", "generation", "background_job"],
      language_unit_cents: 300,
      voice_unit_cents: 500,
      thumbnail_unit_cents: 79,
      preview_video_unit_cents: 249,
      generation_unit_cents: 99,
      background_job_unit_cents: 199,
      admin_only_purchase_override: false,
      studio_includes_extra_languages: 2,
      enterprise_includes_extra_languages: 4,
      studio_includes_extra_voices: 2,
      enterprise_includes_extra_voices: 4
    },
    billing_actions: {
      lyrics_generate_cents: 20,
      music_generate_cents: 40,
      video_generate_cents: 60,
      enterprise_route_cents: 5,
      cinema_booking_cents: 0,
      included_membership_covers_core: true
    },
    studio_enterprise: {
      team_collaboration_enabled: false,
      max_team_members: 5,
      multi_project_enabled: true,
      max_projects: 12,
      enterprise_api_enabled: false,
      enterprise_api_rate_limit_per_minute: 600
    },
    commerce: {
      payout_hold_days: 14,
      payout_sweep_ms: 60 * 60 * 1000,
      min_tip_cents: 100
    },
    foryou: {
      preview_mode: PANEL_BEHAVIOR_FORYOU_PREVIEW_MODES.AUTO,
      compact_after_lyrics: true,
      hold_ms: 10000,
      auto_watch_ms: 10000,
      search_enabled: true,
      market_limit: 10,
      default_sort: "newest",
      default_filter: "all"
    },
    watch: {
      default_tab: "mv",
      preview_limit_sec: 30,
      subtitle_scale: midpointNumber(0.8, 1.4, 0.05, 2),
      engine_detail: "full",
      flash_ring_scale: midpointNumber(0.84, 1.08, 0.01, 2),
      show_generation_flow: false
    },
    engines: {
      lyrics: "cssmv",
      cover: "cssmv",
      music: "cssmv",
      video: "cssmv",
      mv: "cssmv"
    },
    // CSSOS_PHASE2_MV_PIPELINE_ENGINES 20260418 —
    // Per-stage engine + version overrides driven by /api/mv/engines. Defaults
    // intentionally empty so the server catalog (billing_matrix) is the single
    // source of truth; admin can persist overrides via savePanelDefaults.
    mv_pipeline_engines: {},
    lyrics: {
      typewriter_speed: 18,
      font_scale: midpointNumber(0.85, 1.4, 0.05, 2),
      auto_collapse: true
    },
    music: {
      waveform_bars: 24,
      layer_cards: 5
    },
    video: {
      storyboard_frames: 8,
      camera_slots: 4
    },
    delivery_reports: {
      default_kind: "briefing_pack",
      preview_expanded: false,
      focus_section: "overview",
      density: "full"
    },
    delivery_ops: {
      recovery_limit: 8,
      focus_lane: "overview",
      alert_density: "full",
      auto_refresh: true
    },
    panel_commands: panelCommands
  };
}

function sanitizePanelBehaviorSettings(value = {}) {
  const base = defaultPanelBehaviorSettings();
  const source = value && typeof value === "object" ? value : {};
  const sanitizeEngine = (value, fallback) => {
    const candidate = String(value || "").trim().toLowerCase();
    return candidate || fallback;
  };
  const normalizeMirrorMediaPath = (rawValue, fallback) => {
    const raw = String(rawValue || fallback || "").trim();
    if (raw === "assets/mirror-1.png") return "assets/mirror-1.webp";
    if (raw === "assets/mirror-2.png") return "assets/mirror-2.webp";
    return raw || fallback;
  };
  const panelCommandSource = source?.panel_commands && typeof source.panel_commands === "object"
    ? source.panel_commands
    : {};
  const panelCommands = Object.keys(base.panel_commands || {}).reduce((acc, key) => {
    const fallback = base.panel_commands[key] || {};
    const raw = panelCommandSource[key] || {};
    acc[key] = {
      shortcut_key: String(raw.shortcut_key || fallback.shortcut_key || "")
        .trim()
        .slice(0, 1)
        .toLowerCase(),
      voice_command: String(raw.voice_command || fallback.voice_command || "")
        .trim()
        .slice(0, 80)
    };
    return acc;
  }, {});
  return {
    appearance: {
      theme_mode: ["system", "dark", "light"].includes(String(source?.appearance?.theme_mode || ""))
        ? String(source.appearance.theme_mode)
        : base.appearance.theme_mode
    },
    panel_chrome: (() => {
      const transparent = !!source?.panel_chrome?.transparent;
      // CSSOS_PHASE2_PANEL_CHROME_V2 20260419 — new opacity slider, clamped
      // to 0.70..1.00. Legacy saved settings with transparent=true get
      // coerced to 0.70 (the minimum allowed value of the new range) so the
      // previously-selected translucent look survives the upgrade without a
      // break in visual identity.
      const rawOpacity = Number(source?.panel_chrome?.background_opacity);
      let opacity;
      if (Number.isFinite(rawOpacity)) {
        opacity = Math.max(0.70, Math.min(1.00, rawOpacity));
      } else {
        opacity = transparent ? 0.70 : base.panel_chrome.background_opacity;
      }
      return {
        transparent,
        background_opacity: opacity,
        maximize_mode: ["fullscreen", "classic"].includes(String(source?.panel_chrome?.maximize_mode || ""))
          ? String(source.panel_chrome.maximize_mode)
          : base.panel_chrome.maximize_mode,
        layout_mode: ["stack_00", "showcase_grid"].includes(String(source?.panel_chrome?.layout_mode || ""))
          ? String(source.panel_chrome.layout_mode)
          : base.panel_chrome.layout_mode
      };
    })(),
    logo: {
      spell: String(source?.logo?.spell || base.logo.spell).slice(0, 24) || PANEL_BEHAVIOR_DEFAULT_SPELL,
      subtitle: String(source?.logo?.subtitle || base.logo.subtitle).slice(0, 40) || "Studio",
      slogan_template: String(source?.logo?.slogan_template || base.logo.slogan_template).slice(0, 240) || base.logo.slogan_template,
      mirror_size_px: Math.max(420, Math.min(880, Number(source?.logo?.mirror_size_px ?? base.logo.mirror_size_px) || 600)),
      mask_inset_percent: Math.max(0, Math.min(28, Number(source?.logo?.mask_inset_percent ?? base.logo.mask_inset_percent) || 12)),
      spellcast_ring_scale: Math.max(0.82, Math.min(1.12, Number(source?.logo?.spellcast_ring_scale ?? base.logo.spellcast_ring_scale) || 1)),
      spellcast_glow_scale: Math.max(0, Math.min(1, Number(source?.logo?.spellcast_glow_scale ?? base.logo.spellcast_glow_scale) || 0.18)),
      gray_ring_speed_sec: Math.max(2, Math.min(18, Number(source?.logo?.gray_ring_speed_sec ?? base.logo.gray_ring_speed_sec) || 5.8)),
      gray_ring_grayscale: Math.max(0, Math.min(1, Number(source?.logo?.gray_ring_grayscale ?? base.logo.gray_ring_grayscale) || 0.6)),
      gray_ring_colorfulness: Math.max(0, Math.min(1, Number(source?.logo?.gray_ring_colorfulness ?? base.logo.gray_ring_colorfulness) || 0.28)),
      spellcast_layer: ["behind", "front"].includes(String(source?.logo?.spellcast_layer || ""))
        ? String(source.logo.spellcast_layer)
        : base.logo.spellcast_layer,
      hold_ring_scale: Math.max(0.82, Math.min(1.12, Number(source?.logo?.hold_ring_scale ?? base.logo.hold_ring_scale) || 1)),
      hold_ring_layer: ["behind", "front"].includes(String(source?.logo?.hold_ring_layer || ""))
        ? String(source.logo.hold_ring_layer)
        : base.logo.hold_ring_layer,
      media: {
        image_1: normalizeMirrorMediaPath(source?.logo?.media?.image_1, base.logo.media.image_1).slice(0, 512),
        image_2: normalizeMirrorMediaPath(source?.logo?.media?.image_2, base.logo.media.image_2).slice(0, 512),
        video: String(source?.logo?.media?.video || base.logo.media.video || "").slice(0, 512)
      },
      mirror_strategy: Object.values(PANEL_BEHAVIOR_MIRROR_ANIMATION_STRATEGIES).includes(source?.logo?.mirror_strategy)
        ? source.logo.mirror_strategy
        : base.logo.mirror_strategy,
      fixed_mode: Object.values(PANEL_BEHAVIOR_MIRROR_ANIMATION_MODES).includes(source?.logo?.fixed_mode)
        ? source.logo.fixed_mode
        : base.logo.fixed_mode,
      per_type: {
        single: Object.values(PANEL_BEHAVIOR_MIRROR_ANIMATION_MODES).includes(source?.logo?.per_type?.single)
          ? source.logo.per_type.single
          : base.logo.per_type.single,
        triptych: Object.values(PANEL_BEHAVIOR_MIRROR_ANIMATION_MODES).includes(source?.logo?.per_type?.triptych)
          ? source.logo.per_type.triptych
          : base.logo.per_type.triptych,
        opera: Object.values(PANEL_BEHAVIOR_MIRROR_ANIMATION_MODES).includes(source?.logo?.per_type?.opera)
          ? source.logo.per_type.opera
          : base.logo.per_type.opera
      }
    },
    dock: {
      scale: Math.max(0.8, Math.min(1.35, Number(source?.dock?.scale ?? base.dock.scale) || 1)),
      background_opacity: Math.max(0, Math.min(0.65, Number(source?.dock?.background_opacity ?? base.dock.background_opacity) || base.dock.background_opacity)),
      show_labels: source?.dock?.show_labels !== false,
      docking_enabled: source?.dock?.docking_enabled !== false,
      dock_position: ["left", "right", "top", "bottom"].includes(String(source?.dock?.dock_position || ""))
        ? String(source.dock.dock_position)
        : base.dock.dock_position
    },
    background: {
      mode: ["aurora", "ribbon", "watercolor", "ink"].includes(String(source?.background?.mode || ""))
        ? String(source.background.mode)
        : base.background.mode,
      intensity: Math.max(0, Math.min(1, Number(source?.background?.intensity ?? base.background.intensity) || base.background.intensity)),
      motion: Math.max(0, Math.min(1, Number(source?.background?.motion ?? base.background.motion) || base.background.motion))
    },
    mic: {
      longpress_ms: Math.max(250, Math.min(3000, Number(source?.mic?.longpress_ms ?? base.mic.longpress_ms) || 600)),
      max_hold_sec: [3, 5, 10, 15, 30].includes(Number(source?.mic?.max_hold_sec))
        ? Number(source.mic.max_hold_sec)
        : base.mic.max_hold_sec,
      logo_surface_mode: ["showcase", "mv_only"].includes(String(source?.mic?.logo_surface_mode || ""))
        ? String(source.mic.logo_surface_mode)
        : base.mic.logo_surface_mode,
      dock_surface_mode: ["showcase", "mv_only"].includes(String(source?.mic?.dock_surface_mode || ""))
        ? String(source.mic.dock_surface_mode)
        : base.mic.dock_surface_mode,
      settings_surface_mode: ["showcase", "mv_only"].includes(String(source?.mic?.settings_surface_mode || ""))
        ? String(source.mic.settings_surface_mode)
        : base.mic.settings_surface_mode
    },
    cssmv: {
      default_section: ["digest", "governance", "timeline"].includes(String(source?.cssmv?.default_section || ""))
        ? String(source.cssmv.default_section)
        : base.cssmv.default_section,
      auto_refresh: source?.cssmv?.auto_refresh !== false
    },
    language: {
      default_mode: ["content", "settings"].includes(String(source?.language?.default_mode || ""))
        ? String(source.language.default_mode)
        : base.language.default_mode,
      show_more: !!source?.language?.show_more
    },
    login: {
      panel_density: ["compact", "full"].includes(String(source?.login?.panel_density || ""))
        ? String(source.login.panel_density)
        : base.login.panel_density,
      preferred_provider: ["google", "github", "x", "bsky", "passkey"].includes(String(source?.login?.preferred_provider || ""))
        ? String(source.login.preferred_provider)
        : base.login.preferred_provider,
      show_logout: source?.login?.show_logout !== false,
      session_days: [30, 90, 180, 365].includes(Number(source?.login?.session_days))
        ? Number(source.login.session_days)
        : base.login.session_days
    },
    profile: {
      panel_density: ["compact", "full"].includes(String(source?.profile?.panel_density || ""))
        ? String(source.profile.panel_density)
        : base.profile.panel_density,
      note: String(source?.profile?.note || "").slice(0, 120),
      default_nav: ["works", "api"].includes(String(source?.profile?.default_nav || ""))
        ? String(source.profile.default_nav)
        : base.profile.default_nav
    },
    works: {
      focus_section: ["works", "comments", "monetization"].includes(String(source?.works?.focus_section || ""))
        ? String(source.works.focus_section)
        : base.works.focus_section,
      auto_load: source?.works?.auto_load !== false,
      search_enabled: source?.works?.search_enabled !== false,
      search_limit: Math.max(10, Math.min(100, Number(source?.works?.search_limit ?? base.works.search_limit) || 10)),
      default_sort: ["newest", "oldest", "title", "type"].includes(String(source?.works?.default_sort || ""))
        ? String(source.works.default_sort)
        : base.works.default_sort,
      default_filter: ["all", "single", "triptych", "opera", "live", "hidden"].includes(String(source?.works?.default_filter || ""))
        ? String(source.works.default_filter)
        : base.works.default_filter,
      rerun_strategy: ["preserve", "overwrite"].includes(String(source?.works?.rerun_strategy || ""))
        ? String(source.works.rerun_strategy)
        : base.works.rerun_strategy
    },
    seller: {
      focus_lane: ["orders", "income"].includes(String(source?.seller?.focus_lane || ""))
        ? String(source.seller.focus_lane)
        : base.seller.focus_lane,
      auto_refresh: source?.seller?.auto_refresh !== false,
      order_filter: ["all", "paid", "pending"].includes(String(source?.seller?.order_filter || ""))
        ? String(source.seller.order_filter)
        : base.seller.order_filter,
      ledger_limit: Math.max(4, Math.min(40, Number(source?.seller?.ledger_limit ?? base.seller.ledger_limit) || 12))
    },
    about: {
      default_tab: ["whitepaper", "about", "contact"].includes(String(source?.about?.default_tab || ""))
        ? String(source.about.default_tab)
        : base.about.default_tab,
      density: ["compact", "relaxed"].includes(String(source?.about?.density || ""))
        ? String(source.about.density)
        : base.about.density
    },
    api: {
      billing_mode: ["compact", "full"].includes(String(source?.api?.billing_mode || ""))
        ? String(source.api.billing_mode)
        : base.api.billing_mode,
      payment_method: ["card", "bank"].includes(String(source?.api?.payment_method || ""))
        ? String(source.api.payment_method)
        : base.api.payment_method,
      auto_recharge: source?.api?.auto_recharge !== false
    },
    membership: {
      starter_monthly_limit: Math.max(1, Math.min(1000, Number(source?.membership?.starter_monthly_limit ?? base.membership.starter_monthly_limit) || 30)),
      pro_monthly_limit: Math.max(1, Math.min(5000, Number(source?.membership?.pro_monthly_limit ?? base.membership.pro_monthly_limit) || 100)),
      studio_monthly_limit: Math.max(1, Math.min(10000, Number(source?.membership?.studio_monthly_limit ?? base.membership.studio_monthly_limit) || 300)),
      enterprise_monthly_limit: Math.max(0, Math.min(100000, Number(source?.membership?.enterprise_monthly_limit ?? base.membership.enterprise_monthly_limit) || 0)),
      vip_admin_only: source?.membership?.vip_admin_only !== false
    },
    creator_boost: {
      enabled_kinds: Array.isArray(source?.creator_boost?.enabled_kinds)
        ? source.creator_boost.enabled_kinds.filter((item) => ["language", "voice", "thumbnail", "preview_video", "generation", "background_job"].includes(String(item || "")))
        : base.creator_boost.enabled_kinds.slice(),
      language_unit_cents: Math.max(100, Math.min(100000, Number(source?.creator_boost?.language_unit_cents ?? base.creator_boost.language_unit_cents) || 300)),
      voice_unit_cents: Math.max(100, Math.min(100000, Number(source?.creator_boost?.voice_unit_cents ?? base.creator_boost.voice_unit_cents) || 500)),
      thumbnail_unit_cents: Math.max(25, Math.min(100000, Number(source?.creator_boost?.thumbnail_unit_cents ?? base.creator_boost.thumbnail_unit_cents) || 79)),
      preview_video_unit_cents: Math.max(25, Math.min(100000, Number(source?.creator_boost?.preview_video_unit_cents ?? base.creator_boost.preview_video_unit_cents) || 249)),
      generation_unit_cents: Math.max(25, Math.min(100000, Number(source?.creator_boost?.generation_unit_cents ?? base.creator_boost.generation_unit_cents) || 99)),
      background_job_unit_cents: Math.max(25, Math.min(100000, Number(source?.creator_boost?.background_job_unit_cents ?? base.creator_boost.background_job_unit_cents) || 199)),
      admin_only_purchase_override: !!source?.creator_boost?.admin_only_purchase_override,
      studio_includes_extra_languages: Math.max(0, Math.min(10, Number(source?.creator_boost?.studio_includes_extra_languages ?? base.creator_boost.studio_includes_extra_languages) || 2)),
      enterprise_includes_extra_languages: Math.max(0, Math.min(20, Number(source?.creator_boost?.enterprise_includes_extra_languages ?? base.creator_boost.enterprise_includes_extra_languages) || 4)),
      studio_includes_extra_voices: Math.max(0, Math.min(10, Number(source?.creator_boost?.studio_includes_extra_voices ?? base.creator_boost.studio_includes_extra_voices) || 2)),
      enterprise_includes_extra_voices: Math.max(0, Math.min(20, Number(source?.creator_boost?.enterprise_includes_extra_voices ?? base.creator_boost.enterprise_includes_extra_voices) || 4))
    },
    billing_actions: {
      lyrics_generate_cents: Math.max(0, Math.min(100000, Number(source?.billing_actions?.lyrics_generate_cents ?? base.billing_actions.lyrics_generate_cents) || 20)),
      music_generate_cents: Math.max(0, Math.min(100000, Number(source?.billing_actions?.music_generate_cents ?? base.billing_actions.music_generate_cents) || 40)),
      video_generate_cents: Math.max(0, Math.min(100000, Number(source?.billing_actions?.video_generate_cents ?? base.billing_actions.video_generate_cents) || 60)),
      enterprise_route_cents: Math.max(0, Math.min(100000, Number(source?.billing_actions?.enterprise_route_cents ?? base.billing_actions.enterprise_route_cents) || 5)),
      cinema_booking_cents: Math.max(0, Math.min(100000, Number(source?.billing_actions?.cinema_booking_cents ?? base.billing_actions.cinema_booking_cents) || 0)),
      included_membership_covers_core: source?.billing_actions?.included_membership_covers_core !== false
    },
    studio_enterprise: {
      team_collaboration_enabled: !!source?.studio_enterprise?.team_collaboration_enabled,
      max_team_members: Math.max(1, Math.min(500, Number(source?.studio_enterprise?.max_team_members ?? base.studio_enterprise.max_team_members) || 5)),
      multi_project_enabled: source?.studio_enterprise?.multi_project_enabled !== false,
      max_projects: Math.max(1, Math.min(1000, Number(source?.studio_enterprise?.max_projects ?? base.studio_enterprise.max_projects) || 12)),
      enterprise_api_enabled: !!source?.studio_enterprise?.enterprise_api_enabled,
      enterprise_api_rate_limit_per_minute: Math.max(1, Math.min(100000, Number(source?.studio_enterprise?.enterprise_api_rate_limit_per_minute ?? base.studio_enterprise.enterprise_api_rate_limit_per_minute) || 600))
    },
    commerce: {
      payout_hold_days: Math.max(0, Math.min(90, Number(source?.commerce?.payout_hold_days ?? base.commerce.payout_hold_days) || 14)),
      payout_sweep_ms: Math.max(
        60_000,
        Math.min(24 * 60 * 60 * 1000, Number(source?.commerce?.payout_sweep_ms ?? base.commerce.payout_sweep_ms) || 60 * 60 * 1000)
      ),
      min_tip_cents: Math.max(100, Math.min(100_000, Number(source?.commerce?.min_tip_cents ?? base.commerce.min_tip_cents) || 100))
    },
    foryou: {
      preview_mode: Object.values(PANEL_BEHAVIOR_FORYOU_PREVIEW_MODES).includes(source?.foryou?.preview_mode)
        ? source.foryou.preview_mode
        : base.foryou.preview_mode,
      compact_after_lyrics: source?.foryou?.compact_after_lyrics !== false,
      hold_ms: Math.max(0, Math.min(30000, Number(source?.foryou?.hold_ms ?? base.foryou.hold_ms) || 10000)),
      auto_watch_ms: Math.max(0, Math.min(30000, Number(source?.foryou?.auto_watch_ms ?? base.foryou.auto_watch_ms) || 10000)),
      search_enabled: source?.foryou?.search_enabled !== false,
      market_limit: Math.max(10, Math.min(100, Number(source?.foryou?.market_limit ?? base.foryou.market_limit) || 10)),
      default_sort: ["newest", "oldest", "title", "listen_low", "listen_high"].includes(String(source?.foryou?.default_sort || ""))
        ? String(source.foryou.default_sort)
        : base.foryou.default_sort,
      default_filter: ["all", "single", "triptych", "opera", "owned", "public"].includes(String(source?.foryou?.default_filter || ""))
        ? String(source.foryou.default_filter)
        : base.foryou.default_filter
    },
    watch: {
      default_tab: ["mv", "music", "lyrics", "script", "comments", "revenue", "ownership"].includes(String(source?.watch?.default_tab || ""))
        ? String(source.watch.default_tab)
        : base.watch.default_tab,
      preview_limit_sec: Math.max(0, Math.min(180, Number(source?.watch?.preview_limit_sec ?? base.watch.preview_limit_sec) || 30)),
      subtitle_scale: Math.max(0.8, Math.min(1.4, Number(source?.watch?.subtitle_scale ?? base.watch.subtitle_scale) || 1)),
      engine_detail: ["compact", "full"].includes(String(source?.watch?.engine_detail || "")) ? String(source.watch.engine_detail) : base.watch.engine_detail,
      flash_ring_scale: Math.max(0.84, Math.min(1.08, Number(source?.watch?.flash_ring_scale ?? base.watch.flash_ring_scale) || 0.94)),
      show_generation_flow: !!source?.watch?.show_generation_flow
    },
    engines: {
      lyrics: sanitizeEngine(source?.engines?.lyrics, base.engines.lyrics),
      cover: sanitizeEngine(source?.engines?.cover, base.engines.cover),
      music: sanitizeEngine(source?.engines?.music, base.engines.music),
      video: sanitizeEngine(source?.engines?.video, base.engines.video),
      mv: sanitizeEngine(source?.engines?.mv, base.engines.mv)
    },
    mv_pipeline_engines: (() => {
      // Data-driven: accept any stage key the server catalog returns. Each
      // entry must be { engine: non-empty string, version: non-empty string }.
      const raw = source && typeof source === "object" ? source.mv_pipeline_engines : null;
      if (!raw || typeof raw !== "object") return {};
      const out = {};
      for (const key of Object.keys(raw)) {
        const stage = String(key || "").trim().toLowerCase();
        if (!stage) continue;
        const entry = raw[key];
        if (!entry || typeof entry !== "object") continue;
        const engine = String(entry.engine || "").trim();
        const version = String(entry.version || "").trim();
        if (!engine || !version) continue;
        out[stage] = { engine, version };
      }
      return out;
    })(),
    lyrics: {
      typewriter_speed: Math.max(8, Math.min(60, Number(source?.lyrics?.typewriter_speed ?? base.lyrics.typewriter_speed) || 18)),
      font_scale: Math.max(0.85, Math.min(1.4, Number(source?.lyrics?.font_scale ?? base.lyrics.font_scale) || 1)),
      auto_collapse: source?.lyrics?.auto_collapse !== false
    },
    music: {
      waveform_bars: Math.max(12, Math.min(48, Number(source?.music?.waveform_bars ?? base.music.waveform_bars) || 24)),
      layer_cards: Math.max(3, Math.min(8, Number(source?.music?.layer_cards ?? base.music.layer_cards) || 5))
    },
    video: {
      storyboard_frames: Math.max(4, Math.min(16, Number(source?.video?.storyboard_frames ?? base.video.storyboard_frames) || 8)),
      camera_slots: Math.max(2, Math.min(8, Number(source?.video?.camera_slots ?? base.video.camera_slots) || 4))
    },
    delivery_reports: {
      default_kind: PANEL_BEHAVIOR_DELIVERY_REPORT_KINDS.includes(String(source?.delivery_reports?.default_kind || ""))
        ? String(source.delivery_reports.default_kind)
        : base.delivery_reports.default_kind,
      preview_expanded: !!source?.delivery_reports?.preview_expanded,
      focus_section: ["overview", "dashboard", "export", "history"].includes(String(source?.delivery_reports?.focus_section || ""))
        ? String(source.delivery_reports.focus_section)
        : base.delivery_reports.focus_section,
      density: ["compact", "full"].includes(String(source?.delivery_reports?.density || ""))
        ? String(source.delivery_reports.density)
        : base.delivery_reports.density
    },
    delivery_ops: {
      recovery_limit: Math.max(4, Math.min(20, Number(source?.delivery_ops?.recovery_limit ?? base.delivery_ops.recovery_limit) || 8)),
      focus_lane: ["overview", "subscriptions", "logs", "recovery", "actions"].includes(String(source?.delivery_ops?.focus_lane || ""))
        ? String(source.delivery_ops.focus_lane)
        : base.delivery_ops.focus_lane,
      alert_density: ["compact", "full"].includes(String(source?.delivery_ops?.alert_density || ""))
        ? String(source.delivery_ops.alert_density)
        : base.delivery_ops.alert_density,
      auto_refresh: source?.delivery_ops?.auto_refresh !== false
    },
    panel_commands: panelCommands
  };
}

function readPanelBehaviorSettingsLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(PANEL_BEHAVIOR_SETTINGS_KEY) || "{}");
    const migrated = migrateLegacyMicSurfaceModes(raw);
    return sanitizePanelBehaviorSettings(migrated);
  } catch {
    return defaultPanelBehaviorSettings();
  }
}

function migrateLegacyMicSurfaceModes(settings = {}) {
  const source = settings && typeof settings === "object" ? settings : {};
  const migrationKey = "cssos.behavior.migrated.direct_mv.v1";
  const mic = source?.mic && typeof source.mic === "object" ? source.mic : {};
  const needsMigration =
    !localStorage.getItem(migrationKey) &&
    ["logo_surface_mode", "dock_surface_mode", "settings_surface_mode"].some(
      (key) => String(mic?.[key] || "").trim().toLowerCase() === "showcase"
    );
  if (!needsMigration) return source;
  const next = {
    ...source,
    mic: {
      ...mic,
      logo_surface_mode: "mv_only",
      dock_surface_mode: "mv_only",
      settings_surface_mode: "mv_only"
    }
  };
  try {
    localStorage.setItem(migrationKey, "1");
    localStorage.setItem(PANEL_BEHAVIOR_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

function writePanelBehaviorSettingsLocal(settings) {
  try {
    localStorage.setItem(PANEL_BEHAVIOR_SETTINGS_KEY, JSON.stringify(sanitizePanelBehaviorSettings(settings)));
  } catch {
    // ignore
  }
}

function mergePanelBehaviorSettings(baseValue = {}, overlayValue = {}) {
  const base = baseValue && typeof baseValue === "object" ? baseValue : {};
  const overlay = overlayValue && typeof overlayValue === "object" ? overlayValue : {};
  const merged = { ...base };
  Object.keys(overlay).forEach((key) => {
    const baseEntry = base[key];
    const overlayEntry = overlay[key];
    if (
      baseEntry &&
      overlayEntry &&
      typeof baseEntry === "object" &&
      typeof overlayEntry === "object" &&
      !Array.isArray(baseEntry) &&
      !Array.isArray(overlayEntry)
    ) {
      merged[key] = { ...baseEntry, ...overlayEntry };
      return;
    }
    merged[key] = overlayEntry;
  });
  return merged;
}

function updatePanelBehaviorSettings(mutator) {
  const current = readPanelBehaviorSettingsLocal();
  const draft = sanitizePanelBehaviorSettings(mutator(current));
  applyPanelBehaviorSettings(draft);
  void renderAdvancedPanelSettings();
  return draft;
}

let systemThemeMediaQuery = null;
let systemThemeMediaQueryBound = false;

function resolveEffectiveThemeMode(themeMode) {
  if (themeMode === "light" || themeMode === "dark") return themeMode;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "dark";
  }
}

function getEffectiveThemeModeFromSettings(settings = null) {
  const next = settings ? sanitizePanelBehaviorSettings(settings) : readPanelBehaviorSettingsLocal();
  return resolveEffectiveThemeMode(next?.appearance?.theme_mode || "system");
}

function applyDocumentThemeSettings(settings = null) {
  const next = settings ? sanitizePanelBehaviorSettings(settings) : readPanelBehaviorSettingsLocal();
  const effectiveTheme = resolveEffectiveThemeMode(next?.appearance?.theme_mode || "system");
  document.documentElement.dataset.theme = effectiveTheme;
  document.documentElement.dataset.themeMode = next?.appearance?.theme_mode || "system";
  document.documentElement.dataset.themeIcon = effectiveTheme === "dark" ? "☾" : "☀";
  if (document.body) {
    document.body.dataset.themeMode = next?.appearance?.theme_mode || "system";
    document.body.dataset.theme = effectiveTheme;
  }
  document.documentElement.style.colorScheme = effectiveTheme;
  return effectiveTheme;
}

function cyclePanelThemeMode() {
  return updatePanelBehaviorSettings((current) => {
    const effective = getEffectiveThemeModeFromSettings(current);
    const currentMode = String(current?.appearance?.theme_mode || "system");
    const nextMode =
      currentMode === "dark"
        ? "light"
        : currentMode === "light"
          ? "dark"
          : effective === "dark"
            ? "light"
            : "dark";
    return {
      ...current,
      appearance: {
        ...(current.appearance || {}),
        theme_mode: nextMode
      }
    };
  });
}

function bindSystemThemeWatcher() {
  if (systemThemeMediaQueryBound) return;
  try {
    systemThemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = readPanelBehaviorSettingsLocal();
      if (current?.appearance?.theme_mode !== "system") return;
      applyPanelBehaviorSettings(current);
    };
    if (typeof systemThemeMediaQuery.addEventListener === "function") {
      systemThemeMediaQuery.addEventListener("change", onChange);
    } else if (typeof systemThemeMediaQuery.addListener === "function") {
      systemThemeMediaQuery.addListener(onChange);
    }
    systemThemeMediaQueryBound = true;
  } catch {
    systemThemeMediaQuery = null;
  }
}

function applyPanelBehaviorSettings(settings) {
  const next = sanitizePanelBehaviorSettings(settings);
  bindSystemThemeWatcher();
  FORYOU_POST_COMPLETE_HOLD_MS = next.foryou.hold_ms;
  FORYOU_AUTO_ENJOY_DELAY_MS = next.foryou.auto_watch_ms;
  LYRICS_TYPEWRITER_SPEED = next.lyrics.typewriter_speed;
  MUSIC_WAVEFORM_BAR_COUNT = next.music.waveform_bars;
  VIDEO_STORYBOARD_FRAME_COUNT = next.video.storyboard_frames;
  LONGPRESS_MS = next.mic.longpress_ms;
  HOLD_MAX_MS = next.mic.max_hold_sec * 1000;
  MIRROR_SIZE_PX = next.logo.mirror_size_px;
  MIRROR_MASK_INSET_PERCENT = next.logo.mask_inset_percent;
  logoSubtitleText = next.logo.subtitle;
  logoSloganTemplate = next.logo.slogan_template;
  DOCK_SCALE = next.dock.scale;
  globalThis.DOCK_BACKGROUND_OPACITY = next.dock.background_opacity;
  DOCK_LABEL_VISIBLE = next.dock.show_labels;
  DOCK_DOCKING_ENABLED = next.dock.docking_enabled;
  DOCK_POSITION = next.dock.dock_position;
  globalThis.LONGPRESS_MS = LONGPRESS_MS;
  globalThis.HOLD_MAX_MS = HOLD_MAX_MS;
  globalThis.DOCK_SCALE = DOCK_SCALE;
  globalThis.DOCK_LABEL_VISIBLE = DOCK_LABEL_VISIBLE;
  globalThis.DOCK_DOCKING_ENABLED = DOCK_DOCKING_ENABLED;
  globalThis.DOCK_POSITION = DOCK_POSITION;
  globalThis.creationEngineDefaults = { ...(next.engines || {}) };
  /* CSSOS_PHASE1_PANEL_CHROME_APPLY 20260417:
     Surface the new panel_chrome toggles onto <html> dataset so CSS can key off
     them, and expose a plain globalThis.panelChromeSettings reference so the
     panel-layout module can read the maximize/layout mode without re-reading
     the whole settings blob. Existing inline per-panel styles (set via drag /
     resize) continue to win because these only drive CSS variables + class
     hooks. */
  try {
    const rootDs = document.documentElement.dataset;
    rootDs.panelTransparent = next.panel_chrome.transparent ? "true" : "false";
    rootDs.panelMaximizeMode = next.panel_chrome.maximize_mode;
    rootDs.panelLayoutMode = next.panel_chrome.layout_mode;
    // CSSOS_PHASE2_PANEL_CHROME_V2 20260419 — push the new opacity slider
    // (0.70..1.00) onto the CSS --panel-alpha variable so every panel's
    // --panel-strong base color picks it up immediately.
    const alpha = Math.max(0.70, Math.min(1.00, Number(next.panel_chrome.background_opacity) || 1));
    document.documentElement.style.setProperty("--panel-alpha", String(alpha));
  } catch {
    // ignore — non-browser environments
  }
  globalThis.panelChromeSettings = { ...(next.panel_chrome || {}) };
  const effectiveTheme = applyDocumentThemeSettings(next);
  globalThis.refreshThemeQuickToggleModule?.(next, effectiveTheme);
  document.body.dataset.backgroundMode = next.background.mode;
  document.documentElement.style.setProperty("--bg-intensity", String(next.background.intensity));
  document.documentElement.style.setProperty("--bg-motion-scale", String(next.background.motion));
  if (cssmvPanel) {
    cssmvPanel.dataset.defaultSection = next.cssmv.default_section;
    cssmvPanel.dataset.autoRefresh = next.cssmv.auto_refresh ? "true" : "false";
  }
  if (languagePanel) {
    languagePanel.dataset.defaultMode = next.language.default_mode;
    languagePanel.dataset.showMore = next.language.show_more ? "true" : "false";
    globalThis.toggleLanguagePanelMode?.(next.language.default_mode);
    const moreHidden = !next.language.show_more;
    languageListMore?.classList.toggle("is-hidden", moreHidden);
  }
  if (loginPanel) loginPanel.dataset.panelDensity = next.login.panel_density;
  if (loginPanel) {
    loginPanel.dataset.preferredProvider = next.login.preferred_provider;
    loginPanel.dataset.showLogout = next.login.show_logout ? "true" : "false";
    loginPanel.dataset.sessionDays = String(next.login.session_days);
  }
  if (profilePanel) {
    profilePanel.dataset.panelDensity = next.profile.panel_density;
    profilePanel.dataset.defaultNav = next.profile.default_nav;
  }
  if (worksPanel) {
    worksPanel.dataset.focusSection = next.works.focus_section;
    worksPanel.dataset.autoLoad = next.works.auto_load ? "true" : "false";
    worksPanel.dataset.searchEnabled = next.works.search_enabled ? "true" : "false";
    worksPanel.dataset.searchLimit = String(next.works.search_limit);
    worksPanel.dataset.defaultSort = next.works.default_sort;
    worksPanel.dataset.defaultFilter = next.works.default_filter;
  }
  if (sellerPanel) {
    sellerPanel.dataset.focusLane = next.seller.focus_lane;
    sellerPanel.dataset.autoRefresh = next.seller.auto_refresh ? "true" : "false";
    sellerPanel.dataset.orderFilter = next.seller.order_filter;
    sellerPanel.dataset.ledgerLimit = String(next.seller.ledger_limit);
  }
  if (aboutPanel) {
    aboutPanel.dataset.defaultTab = next.about.default_tab;
    aboutPanel.dataset.contentDensity = next.about.density;
    globalThis.activateAboutTabModule?.(next.about.default_tab);
  }
  if (apiPanel) {
    apiPanel.dataset.billingMode = next.api.billing_mode;
    if (apiPaymentMethod) setSelectValueSafe(apiPaymentMethod, next.api.payment_method);
    if (apiAutoRecharge) apiAutoRecharge.checked = !!next.api.auto_recharge;
  }
  setStoredMirrorAnimationStrategy(next.logo.mirror_strategy);
  setStoredMirrorAnimationMode(next.logo.fixed_mode);
  setStoredMirrorAnimationPerType(next.logo.per_type);
  if (state.spell !== next.logo.spell) {
    applySpell(next.logo.spell, { force: true, refreshPanels: true });
  }
  if (mirrorSubtitle) mirrorSubtitle.textContent = logoSubtitleText;
  if (mirrorSlogan) mirrorSlogan.innerHTML = formatSlogan(state.spell || next.logo.spell);
  if (logoPanel) {
    logoPanel.style.setProperty("--mirror-size", `${MIRROR_SIZE_PX}px`);
    logoPanel.style.setProperty("--mirror-mask-inset", `${MIRROR_MASK_INSET_PERCENT}%`);
    logoPanel.style.setProperty("--hold-ring-inset", `${Math.max(48, Math.round(MIRROR_SIZE_PX * 0.14))}px`);
    logoPanel.style.setProperty("--spellcast-ring-scale", String(next.logo.spellcast_ring_scale));
    logoPanel.style.setProperty("--spellcast-glow-scale", String(next.logo.spellcast_glow_scale));
    logoPanel.style.setProperty("--logo-gray-ring-speed-sec", `${next.logo.gray_ring_speed_sec}s`);
    logoPanel.style.setProperty("--logo-gray-ring-grayscale", String(next.logo.gray_ring_grayscale));
    logoPanel.style.setProperty("--logo-gray-ring-colorfulness", String(next.logo.gray_ring_colorfulness));
    logoPanel.style.setProperty("--spellcast-ring-z", next.logo.spellcast_layer === "front" ? "3" : "0");
    logoPanel.style.setProperty("--hold-ring-scale", String(next.logo.hold_ring_scale));
    logoPanel.style.setProperty("--hold-ring-z", next.logo.hold_ring_layer === "front" ? "3" : "0");
    const mirrorA = logoPanel.querySelector(".mirror-img.mirror-a");
    const mirrorB = logoPanel.querySelector(".mirror-img.mirror-b");
    const mirrorVideo = logoPanel.querySelector(".mirror-video");
    if (mirrorA && next.logo.media.image_1) mirrorA.src = resolvePublicAssetUrl(next.logo.media.image_1);
    if (mirrorB && next.logo.media.image_2) mirrorB.src = resolvePublicAssetUrl(next.logo.media.image_2);
    if (mirrorVideo instanceof HTMLVideoElement) {
      if (next.logo.media.video) {
        const resolvedVideoUrl = resolvePublicAssetUrl(next.logo.media.video);
        if (mirrorVideo.src !== resolvedVideoUrl) mirrorVideo.src = resolvedVideoUrl;
        mirrorVideo.play().catch(() => {});
        logoPanel.classList.add("mirror-video-active");
      } else {
        mirrorVideo.pause();
        mirrorVideo.removeAttribute("src");
        mirrorVideo.load();
        logoPanel.classList.remove("mirror-video-active");
      }
    }
  }
  if (foryouPanel) {
    foryouPanel.dataset.previewMode = next.foryou.preview_mode;
    foryouPanel.dataset.compactAfterLyrics = next.foryou.compact_after_lyrics ? "true" : "false";
    foryouPanel.dataset.searchEnabled = next.foryou.search_enabled ? "true" : "false";
    foryouPanel.dataset.marketLimit = String(next.foryou.market_limit);
    foryouPanel.dataset.defaultSort = next.foryou.default_sort;
    foryouPanel.dataset.defaultFilter = next.foryou.default_filter;
    localStorage.setItem(PANEL_BEHAVIOR_FORYOU_PREVIEW_MODE_KEY, next.foryou.preview_mode);
  }
  globalThis.watchActiveTab = next.watch.default_tab;
  localStorage.setItem(PANEL_BEHAVIOR_WATCH_ACTIVE_TAB_KEY, globalThis.watchActiveTab);
  globalThis.watchPreviewLimitSec = next.watch.preview_limit_sec;
  if (watchPanel) {
    watchPanel.style.setProperty("--watch-karaoke-scale", String(next.watch.subtitle_scale));
    watchPanel.style.setProperty("--watch-flash-ring-scale", String(next.watch.flash_ring_scale));
    watchPanel.dataset.engineDetail = next.watch.engine_detail;
    watchPanel.dataset.showGenerationFlow = next.watch.show_generation_flow ? "true" : "false";
  }
  globalThis.syncWatchGenerationVisibilityModule?.();
  if (lyricsPanel) {
    lyricsPanel.style.setProperty("--lyrics-font-scale", String(next.lyrics.font_scale));
    lyricsPanel.dataset.autoCollapse = next.lyrics.auto_collapse ? "true" : "false";
  }
  if (musicPanel) musicPanel.dataset.layerCards = String(next.music.layer_cards);
  if (videoPanel) videoPanel.dataset.cameraSlots = String(next.video.camera_slots);
  if (panelBehaviorDeliveryReportsPanel) {
    panelBehaviorDeliveryReportsPanel.dataset.focusSection = next.delivery_reports.focus_section;
    panelBehaviorDeliveryReportsPanel.dataset.reportDensity = next.delivery_reports.density;
    deliveryReportState.kind = next.delivery_reports.default_kind;
    deliveryExportState.previewExpanded = !!next.delivery_reports.preview_expanded;
    renderDeliveryReportTabs();
    if (deliveryReportState.response) {
      renderReportHeader(deliveryReportState.response);
      renderDeliveryReportBody(deliveryReportState.response);
    }
  }
  deliveryOpsState.recoveryLimit = next.delivery_ops.recovery_limit;
  if (deliveryOpsPanel) {
    deliveryOpsPanel.dataset.focusLane = next.delivery_ops.focus_lane;
    deliveryOpsPanel.dataset.alertDensity = next.delivery_ops.alert_density;
    deliveryOpsPanel.dataset.autoRefresh = next.delivery_ops.auto_refresh ? "true" : "false";
  }
  Object.entries(globalThis.PANEL_COMMAND_CATALOG || {}).forEach(([panelId, entry]) => {
    const panel = document.getElementById(panelId);
    const commandSettings = next.panel_commands?.[entry.behaviorKey] || null;
    if (!(panel instanceof HTMLElement) || !commandSettings) return;
    panel.dataset.shortcutKey = String(commandSettings.shortcut_key || "");
    panel.dataset.voiceCommand = String(commandSettings.voice_command || "");
  });
  if (dock) {
    dock.style.setProperty("--dock-scale", String(globalThis.DOCK_SCALE));
    dock.style.setProperty("--dock-shell-opacity", String(next.dock.background_opacity));
    dock.classList.toggle("dock-labels-hidden", !globalThis.DOCK_LABEL_VISIBLE);
    dock.dataset.dockPosition = globalThis.DOCK_POSITION;
  }
  writePanelBehaviorSettingsLocal(next);
  if (panelBehaviorCreationSetDefaults)
    panelBehaviorCreationSetDefaults.hidden = getUserRole() !== "admin";
  return next;
}

async function loadPanelDefaults(panelKey, fallback) {
  try {
    const res = await fetch(`/api/panel-defaults/${encodeURIComponent(panelKey)}`, { credentials: "include" });
    if (res.status === 404) return fallback;
    const payload = await res.json().catch(() => null);
    const data = getApiData(payload);
    return data?.defaults || fallback;
  } catch {
    return fallback;
  }
}

async function savePanelDefaults(panelKey, defaults, trigger = null) {
  if (getUserRole() !== "admin") return null;
  try {
    setButtonBusy(trigger, true);
    const res = await fetch(`/api/panel-defaults/${encodeURIComponent(panelKey)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ defaults })
    });
    if (res.status === 404) {
      return defaults;
    }
    const payload = await res.json().catch(() => null);
    const data = getApiData(payload);
    if (!res.ok || payload?.ok === false) {
      throw new Error(payload?.code || `panel_defaults_save_failed:${res.status}`);
    }
    return data?.defaults || defaults;
  } catch {
    const autoField =
      String(trigger?.getAttribute?.("data-advanced-setting") || "").trim() ||
      String(trigger?.getAttribute?.("data-dock-setting") || "").trim();
    if (autoField) {
      showToast(
        panelBehaviorLoginCopy(
          "Applied locally. Cloud default sync failed.",
          "本地已应用，但云端默认值同步失败。"
        )
      );
    } else {
      showToast(panelBehaviorLoginCopy("Failed to save defaults.", "保存默认模板失败。"));
    }
    return null;
  } finally {
    setButtonBusy(trigger, false);
  }
}
globalThis.savePanelDefaults = globalThis.savePanelDefaults || savePanelDefaults;

async function fileToDataUrl(file) {
  if (!(file instanceof File)) return "";
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

async function hydrateBehaviorDefaultsFromServer(force = false) {
  if (!authState.user && !force) return null;
  const local = readPanelBehaviorSettingsLocal();
  const remote = await loadPanelDefaults("behavior", local);
  const merged = sanitizePanelBehaviorSettings(
    remote && typeof remote === "object"
      ? mergePanelBehaviorSettings(local, remote)
      : local
  );
  applyPanelBehaviorSettings(merged);
  return merged;
}

async function hydratePanelDefaultsFromServer(force = false) {
  if (!authState.user && !force) return;
  const targets = ["logo", "foryou", "watch", "lyrics", "music", "video", "about", "api", "delivery_reports", "delivery_ops", "cssmv", "language", "login", "profile", "works", "seller"];
  for (const panelKey of targets) {
    const panel = panelElementByDefaultKey(panelKey);
    if (!panel) continue;
    const local = getStoredPanelDefaultSnapshot(panel.id) || {};
    const remote = await loadPanelDefaults(panelKey, local);
    const snapshot = remote && typeof remote === "object" ? remote : local;
    savePanelDefaultSnapshot(panel.id, snapshot);
    panel.__applyDefaultSnapshot?.(snapshot);
  }
}


window.defaultPanelBehaviorSettings = Object.assign(defaultPanelBehaviorSettings, { __moduleImpl: defaultPanelBehaviorSettings });
window.sanitizePanelBehaviorSettings = Object.assign(sanitizePanelBehaviorSettings, { __moduleImpl: sanitizePanelBehaviorSettings });
window.readPanelBehaviorSettingsLocal = Object.assign(readPanelBehaviorSettingsLocal, { __moduleImpl: readPanelBehaviorSettingsLocal });
window.writePanelBehaviorSettingsLocal = Object.assign(writePanelBehaviorSettingsLocal, { __moduleImpl: writePanelBehaviorSettingsLocal });
window.mergePanelBehaviorSettings = Object.assign(mergePanelBehaviorSettings, { __moduleImpl: mergePanelBehaviorSettings });
window.updatePanelBehaviorSettings = Object.assign(updatePanelBehaviorSettings, { __moduleImpl: updatePanelBehaviorSettings });
window.applyPanelBehaviorSettings = Object.assign(applyPanelBehaviorSettings, { __moduleImpl: applyPanelBehaviorSettings });
window.getEffectiveThemeModeFromSettings = Object.assign(getEffectiveThemeModeFromSettings, { __moduleImpl: getEffectiveThemeModeFromSettings });
window.applyDocumentThemeSettings = Object.assign(applyDocumentThemeSettings, { __moduleImpl: applyDocumentThemeSettings });
window.cyclePanelThemeMode = Object.assign(cyclePanelThemeMode, { __moduleImpl: cyclePanelThemeMode });
window.loadPanelDefaults = Object.assign(loadPanelDefaults, { __moduleImpl: loadPanelDefaults });
window.savePanelDefaults = Object.assign(savePanelDefaults, { __moduleImpl: savePanelDefaults });
window.hydrateBehaviorDefaultsFromServer = Object.assign(hydrateBehaviorDefaultsFromServer, { __moduleImpl: hydrateBehaviorDefaultsFromServer });
window.hydratePanelDefaultsFromServer = Object.assign(hydratePanelDefaultsFromServer, { __moduleImpl: hydratePanelDefaultsFromServer });

window.__panelBehaviorCore = {
  defaultPanelBehaviorSettings: defaultPanelBehaviorSettings,
  sanitizePanelBehaviorSettings: sanitizePanelBehaviorSettings,
  readPanelBehaviorSettingsLocal: readPanelBehaviorSettingsLocal,
  writePanelBehaviorSettingsLocal: writePanelBehaviorSettingsLocal,
  mergePanelBehaviorSettings: mergePanelBehaviorSettings,
  updatePanelBehaviorSettings: updatePanelBehaviorSettings,
  applyPanelBehaviorSettings: applyPanelBehaviorSettings,
  getEffectiveThemeModeFromSettings: getEffectiveThemeModeFromSettings,
  applyDocumentThemeSettings: applyDocumentThemeSettings,
  cyclePanelThemeMode: cyclePanelThemeMode,
  loadPanelDefaults: loadPanelDefaults,
  savePanelDefaults: savePanelDefaults,
  hydrateBehaviorDefaultsFromServer: hydrateBehaviorDefaultsFromServer,
  hydratePanelDefaultsFromServer: hydratePanelDefaultsFromServer
};

applyDocumentThemeSettings(readPanelBehaviorSettingsLocal());
