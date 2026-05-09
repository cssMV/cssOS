(function () {
  // CSSOS_WAVE_107C 20260509 — Jing
  // - WhatsApp removed entirely: it has no OAuth flow and never will.
  //   See docs/SOCIAL_LOGIN_PROVIDER_REGISTRATION.md (Tier 3).
  // - instagram/tiktok/weibo flagged comingSoon: true. The login panel
  //   renders these as a non-clickable "Coming soon" pill so users
  //   don't tap them and hit auth_failed.
  const socialPlatforms = [
  { id: "apple", icon: "A" },
  { id: "behance", icon: "Be" },
  { id: "discord", icon: "Di" },
  { id: "dribbble", icon: "Dr" },
  { id: "facebook", icon: "Fb" },
  { id: "github", icon: "GH" },
  { id: "gitlab", icon: "GL" },
  { id: "google", icon: "G" },
  { id: "instagram", icon: "Ig", comingSoon: true },
  { id: "kakaotalk", icon: "Ka" },
  { id: "line", icon: "Li" },
  { id: "linkedin", icon: "In" },
  { id: "medium", icon: "Me" },
  { id: "pinterest", icon: "Pi" },
  { id: "reddit", icon: "Re" },
  { id: "slack", icon: "Sl" },
  { id: "stackoverflow", icon: "SO" },
  { id: "telegram", icon: "Te" },
  { id: "tiktok", icon: "Tk", comingSoon: true },
  { id: "twitch", icon: "Tw" },
  { id: "wechat", icon: "We" },
  { id: "weibo", icon: "Wb", comingSoon: true },
  { id: "x", icon: "X" }
];
  const PLATFORM_LABELS = {
  en: {
    apple: "Apple",
    behance: "Behance",
    discord: "Discord",
    dribbble: "Dribbble",
    facebook: "Facebook",
    github: "GitHub",
    gitlab: "GitLab",
    google: "Google",
    instagram: "Instagram",
    kakaotalk: "KakaoTalk",
    line: "LINE",
    linkedin: "LinkedIn",
    medium: "Medium",
    pinterest: "Pinterest",
    reddit: "Reddit",
    slack: "Slack",
    stackoverflow: "Stack Overflow",
    telegram: "Telegram",
    tiktok: "TikTok",
    twitch: "Twitch",
    wechat: "WeChat",
    weibo: "Weibo",
    x: "X"
  },
  zh: {
    apple: "苹果",
    behance: "Behance",
    discord: "Discord",
    dribbble: "Dribbble",
    facebook: "脸书",
    github: "GitHub",
    gitlab: "GitLab",
    google: "谷歌",
    instagram: "Instagram",
    kakaotalk: "KakaoTalk",
    line: "LINE",
    linkedin: "领英",
    medium: "Medium",
    pinterest: "Pinterest",
    reddit: "Reddit",
    slack: "Slack",
    stackoverflow: "Stack Overflow",
    telegram: "Telegram",
    tiktok: "抖音",
    twitch: "Twitch",
    wechat: "微信",
    weibo: "微博",
    x: "X"
  }
};

  const { DEFAULT_LOCALE } = window.CSSOS_I18N_CONSTANTS || { DEFAULT_LOCALE: "en" };

  function validatePlatformLabels(locale) {
    const map = PLATFORM_LABELS[locale] || {};
    const fallback = PLATFORM_LABELS[DEFAULT_LOCALE] || {};
    const missing = [];
    socialPlatforms.forEach((platform) => {
      const id = platform.id;
      if (!map[id] && !fallback[id]) {
        missing.push(id);
      }
    });
    return missing;
  }

  function getPlatformLabel(locale, platformId) {
    const labels = PLATFORM_LABELS[locale] ? PLATFORM_LABELS[locale] : PLATFORM_LABELS[DEFAULT_LOCALE] || {};
    return labels[platformId] || PLATFORM_LABELS[DEFAULT_LOCALE]?.[platformId] || platformId;
  }

  const isDebug = () =>
    location.hostname === "localhost" || new URLSearchParams(location.search).get("debug") === "1";

  if (isDebug()) {
    const missing = validatePlatformLabels(DEFAULT_LOCALE);
    if (missing.length) {
      console.warn("Missing platform labels:", missing);
    }
  }

  window.CSSOS_I18N_PLATFORMS = {
    socialPlatforms,
    PLATFORM_LABELS,
    validatePlatformLabels,
    getPlatformLabel
  };
})();
