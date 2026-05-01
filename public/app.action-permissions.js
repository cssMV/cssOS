(() => {
const actionPermissionsLoginCopy =
  typeof globalThis.loginCopy === "function"
    ? globalThis.loginCopy.bind(globalThis)
    : (en, zh) => {
        const locale = String(globalThis.currentLocale || navigator.language || "en").toLowerCase();
        return locale.startsWith("zh") ? zh : en;
      };
const actionPermissionsNormalizeAccessTier =
  typeof globalThis.normalizeAccessTier === "function"
    ? globalThis.normalizeAccessTier.bind(globalThis)
    : (value) => {
        const raw = String(value || "").trim().toLowerCase();
        if (["free", "starter", "pro", "studio", "enterprise", "vip", "admin"].includes(raw)) return raw;
        return "guest";
      };
const actionPermissionsReadPanelBehaviorSettingsLocal =
  typeof globalThis.readPanelBehaviorSettingsLocal === "function"
    ? globalThis.readPanelBehaviorSettingsLocal.bind(globalThis)
    : (() => ({}));
const actionPermissionsSanitizePanelBehaviorSettings =
  typeof globalThis.sanitizePanelBehaviorSettings === "function"
    ? globalThis.sanitizePanelBehaviorSettings.bind(globalThis)
    : ((value) => value && typeof value === "object" ? value : {});
function buildPermissionCellForTier(row, tier) {
  const normalizedTier = actionPermissionsNormalizeAccessTier(tier);
  const access = typeof row.access === "function" ? row.access(normalizedTier) : row.access?.[normalizedTier];
  if (access === true) return actionPermissionsLoginCopy("Yes", "可用");
  if (access === false || access == null) return actionPermissionsLoginCopy("No", "不可用");
  return String(access);
}

const ACTION_PERMISSION_MATRIX_TIERS = ["guest", "free", "starter", "pro", "studio", "enterprise", "vip", "admin"];
const DELIVERY_ADMIN_ONLY_ACTION_ATTRS = [
  "data-delivery-rewrite-bundle-commit",
  "data-delivery-rewrite-bundle-save",
  "data-delivery-rewrite-bundle-promote",
  "data-delivery-rewrite-sandbox-apply",
  "data-delivery-rewrite-sandbox-clear",
  "data-delivery-arrangement-revision-rollback",
  "data-delivery-arrangement-revision-merge-forward",
  "data-delivery-arrangement-release-candidate",
  "data-delivery-arrangement-lock",
  "data-delivery-arrangement-publish",
  "data-delivery-publish-step-approve",
  "data-delivery-publish-step-finalize",
  "data-delivery-publish-step-remind",
  "data-delivery-publish-actor-suggest",
  "data-delivery-publish-route-shortcut",
  "data-delivery-publish-runbook-automation",
  "data-delivery-publish-confirm-arm",
  "data-delivery-publish-confirm-disarm",
  "data-delivery-post-publish-rollback",
  "data-delivery-compliance-escalate",
  "data-delivery-compliance-ticket",
  "data-delivery-compliance-backfill",
  "data-delivery-compliance-rotate-secret",
  "data-delivery-compliance-update-registry",
  "data-delivery-compliance-reopen",
  "data-delivery-compliance-save-directory",
  "data-delivery-compliance-save-preset",
  "data-delivery-compliance-audit-log",
  "data-delivery-compliance-save-role-policy",
  "data-delivery-compliance-approve",
  "data-delivery-compliance-save-routing",
  "data-delivery-compliance-save-signers",
  "data-delivery-compliance-finalize-quorum",
  "data-delivery-probe-dispatch-done",
  "data-delivery-probe-dispatch-history-export",
  "data-delivery-probe-incident-export",
  "data-delivery-probe-handoff-ack",
  "data-delivery-probe-receipt-copy",
  "data-delivery-probe-followup-copy",
  "data-delivery-watch-case-route-priority",
  "data-delivery-watch-case-route",
  "data-delivery-watch-case-close-summary",
  "data-delivery-watch-owner-inbox-digest",
  "data-delivery-watch-case-export-bundle",
  "data-delivery-watch-case-status"
];
const DELIVERY_STANDARD_SCOPE_RULES = [
  { scope: "delivery.watch.case", panel: "ops", action: actionPermissionsLoginCopy("Delivery watch case actions", "交付 watch case 动作"), match: (name) => name.startsWith("data-delivery-watch-case-") },
  { scope: "delivery.watch.archive", panel: "ops", action: actionPermissionsLoginCopy("Delivery watch archive actions", "交付 watch archive 动作"), match: (name) => name.includes("data-delivery-watch-archive-") },
  { scope: "delivery.watch.compare", panel: "ops", action: actionPermissionsLoginCopy("Delivery watch compare actions", "交付 watch compare 动作"), match: (name) => name.includes("data-delivery-watch-compare-") },
  { scope: "delivery.watch.saved_view", panel: "ops", action: actionPermissionsLoginCopy("Delivery watch saved view actions", "交付 watch saved view 动作"), match: (name) => name.includes("data-delivery-watch-saved-view-") },
  { scope: "delivery.watch.standard", panel: "ops", action: actionPermissionsLoginCopy("Delivery watch actions", "交付 watch 动作"), match: (name) => name.startsWith("data-delivery-watch-") },
  { scope: "delivery.compliance.refresh", panel: "ops", action: actionPermissionsLoginCopy("Delivery compliance refresh actions", "交付 compliance refresh 动作"), match: (name) => name === "data-delivery-compliance-refresh" },
  { scope: "delivery.compliance.open", panel: "ops", action: actionPermissionsLoginCopy("Delivery compliance open actions", "交付 compliance open 动作"), match: (name) => name === "data-delivery-compliance-open" },
  { scope: "delivery.compliance.registry", panel: "ops", action: actionPermissionsLoginCopy("Delivery compliance registry actions", "交付 compliance registry 动作"), match: (name) => ["data-delivery-compliance-update-registry", "data-delivery-compliance-save-directory", "data-delivery-compliance-save-preset", "data-delivery-compliance-save-role-policy", "data-delivery-compliance-save-routing", "data-delivery-compliance-save-signers", "data-delivery-compliance-backfill"].includes(name) },
  { scope: "delivery.compliance.approval", panel: "ops", action: actionPermissionsLoginCopy("Delivery compliance approval actions", "交付 compliance approval 动作"), match: (name) => ["data-delivery-compliance-approve", "data-delivery-compliance-escalate", "data-delivery-compliance-ticket", "data-delivery-compliance-audit-log"].includes(name) },
  { scope: "delivery.compliance.signer", panel: "ops", action: actionPermissionsLoginCopy("Delivery compliance signer actions", "交付 compliance signer 动作"), match: (name) => ["data-delivery-compliance-rotate-secret", "data-delivery-compliance-reopen"].includes(name) },
  { scope: "delivery.compliance.quorum", panel: "ops", action: actionPermissionsLoginCopy("Delivery compliance quorum actions", "交付 compliance quorum 动作"), match: (name) => name === "data-delivery-compliance-finalize-quorum" },
  { scope: "delivery.compliance.standard", panel: "ops", action: actionPermissionsLoginCopy("Delivery compliance actions", "交付 compliance 动作"), match: (name) => name.startsWith("data-delivery-compliance-") },
  { scope: "delivery.rewrite.bundle", panel: "reports", action: actionPermissionsLoginCopy("Delivery rewrite bundle actions", "交付 rewrite bundle 动作"), match: (name) => name.includes("data-delivery-rewrite-bundle-") },
  { scope: "delivery.rewrite.sandbox", panel: "reports", action: actionPermissionsLoginCopy("Delivery rewrite sandbox actions", "交付 rewrite sandbox 动作"), match: (name) => name.includes("data-delivery-rewrite-sandbox-") },
  { scope: "delivery.rewrite.diff", panel: "reports", action: actionPermissionsLoginCopy("Delivery rewrite diff actions", "交付 rewrite diff 动作"), match: (name) => name === "data-delivery-rewrite-diff-focus" },
  { scope: "delivery.rewrite.playback", panel: "reports", action: actionPermissionsLoginCopy("Delivery rewrite playback actions", "交付 rewrite playback 动作"), match: (name) => ["data-delivery-rewrite-phrase-play", "data-delivery-rewrite-lane", "data-delivery-rewrite-payload-mode", "data-delivery-rewrite-assist"].includes(name) },
  { scope: "delivery.rewrite.standard", panel: "reports", action: actionPermissionsLoginCopy("Delivery rewrite actions", "交付 rewrite 动作"), match: (name) => name.startsWith("data-delivery-rewrite-") },
  { scope: "delivery.probe.dispatch", panel: "ops", action: actionPermissionsLoginCopy("Delivery probe dispatch actions", "交付 probe dispatch 动作"), match: (name) => name.includes("data-delivery-probe-dispatch-") },
  { scope: "delivery.probe.export", panel: "ops", action: actionPermissionsLoginCopy("Delivery probe export actions", "交付 probe export 动作"), match: (name) => ["data-delivery-probe-incident-export", "data-delivery-probe-receipt-copy", "data-delivery-probe-followup-copy"].includes(name) },
  { scope: "delivery.probe.handoff", panel: "ops", action: actionPermissionsLoginCopy("Delivery probe handoff actions", "交付 probe handoff 动作"), match: (name) => name === "data-delivery-probe-handoff-ack" },
  { scope: "delivery.probe.compare", panel: "ops", action: actionPermissionsLoginCopy("Delivery probe compare actions", "交付 probe compare 动作"), match: (name) => name === "data-delivery-probe-compare-select" },
  { scope: "delivery.probe.standard", panel: "ops", action: actionPermissionsLoginCopy("Delivery probe actions", "交付 probe 动作"), match: (name) => name.startsWith("data-delivery-probe-") },
  { scope: "delivery.publish.simulate", panel: "reports", action: actionPermissionsLoginCopy("Delivery publish simulate actions", "交付 publish simulate 动作"), match: (name) => name === "data-delivery-publish-simulate" },
  { scope: "delivery.publish.route", panel: "reports", action: actionPermissionsLoginCopy("Delivery publish route actions", "交付 publish route 动作"), match: (name) => ["data-delivery-publish-route-shortcut", "data-delivery-publish-actor-suggest", "data-delivery-publish-runbook-automation"].includes(name) },
  { scope: "delivery.publish.confirm", panel: "reports", action: actionPermissionsLoginCopy("Delivery publish confirm actions", "交付 publish confirm 动作"), match: (name) => ["data-delivery-publish-confirm-arm", "data-delivery-publish-confirm-disarm", "data-delivery-publish-ack-note"].includes(name) },
  { scope: "delivery.publish.finalize", panel: "reports", action: actionPermissionsLoginCopy("Delivery publish finalize actions", "交付 publish finalize 动作"), match: (name) => ["data-delivery-publish-step-approve", "data-delivery-publish-step-finalize", "data-delivery-publish-step-remind"].includes(name) },
  { scope: "delivery.publish.standard", panel: "reports", action: actionPermissionsLoginCopy("Delivery publish actions", "交付 publish 动作"), match: (name) => name.startsWith("data-delivery-publish-") },
  { scope: "delivery.post_publish.standard", panel: "reports", action: actionPermissionsLoginCopy("Delivery post-publish actions", "交付发布后动作"), match: (name) => name.startsWith("data-delivery-post-publish-") },
  { scope: "delivery.arrangement.standard", panel: "reports", action: actionPermissionsLoginCopy("Delivery arrangement actions", "交付 arrangement 动作"), match: (name) => name.startsWith("data-delivery-arrangement-") },
  { scope: "delivery.mixer.standard", panel: "reports", action: actionPermissionsLoginCopy("Delivery mixer actions", "交付 mixer 动作"), match: (name) => name.startsWith("data-delivery-mixer-") },
  { scope: "delivery.ops.standard", panel: "ops", action: actionPermissionsLoginCopy("Delivery ops actions", "交付 ops 动作"), match: (name) => name.startsWith("data-delivery-ops-") }
];

function deliveryPermissionScopeFromAttr(attrName = "") {
  const normalized = String(attrName || "").trim().toLowerCase();
  if (!normalized.startsWith("data-delivery-")) return "";
  if (DELIVERY_ADMIN_ONLY_ACTION_ATTRS.includes(normalized)) {
    return `delivery.action.${normalized.replace(/^data-delivery-/, "").replaceAll("-", ".")}`;
  }
  const matched = DELIVERY_STANDARD_SCOPE_RULES.find((entry) => entry.match(normalized));
  if (matched) return matched.scope;
  return "delivery.action.standard";
}

function deliveryPermissionPanelFromAttr(attrName = "") {
  const normalized = String(attrName || "").trim().toLowerCase();
  const matched = DELIVERY_STANDARD_SCOPE_RULES.find((entry) => entry.match(normalized));
  if (matched) return matched.panel;
  if (normalized.includes("-probe-") || normalized.includes("-watch-") || normalized.includes("-compliance-")) {
    return "ops";
  }
  return "reports";
}

function deliveryPermissionActionLabel(attrName = "") {
  const normalized = String(attrName || "").trim().toLowerCase().replace(/^data-delivery-/, "");
  const label = normalized
    .split("-")
    .map((part) => part.replaceAll("_", " "))
    .join(" / ");
  const english = label.replace(/\b\w/g, (char) => char.toUpperCase()) || "Delivery action";
  const chinese = `交付动作：${label || "标准动作"}`;
  return actionPermissionsLoginCopy(english, chinese);
}

function permissionBooleanLabel(allowed) {
  return allowed ? actionPermissionsLoginCopy("Yes", "可用") : false;
}

function isBasicPlusTier(tier) {
  return actionPermissionsNormalizeAccessTier(tier) !== "guest";
}

function isProPlusTier(tier) {
  return ["pro", "studio", "enterprise", "vip", "admin"].includes(actionPermissionsNormalizeAccessTier(tier));
}

function isEnterprisePlusTier(tier) {
  return ["enterprise", "vip", "admin"].includes(actionPermissionsNormalizeAccessTier(tier));
}

function deliveryScopeAllowedForTier(scope, tier, ctx) {
  const normalizedScope = String(scope || "").trim().toLowerCase();
  if (normalizedScope === "delivery.action.standard") return !!ctx?.loggedIn;
  if (normalizedScope === "delivery.watch.compare" || normalizedScope === "delivery.rewrite.playback" || normalizedScope === "delivery.probe.compare") {
    return isBasicPlusTier(tier);
  }
  if (
    normalizedScope === "delivery.rewrite.bundle" ||
    normalizedScope === "delivery.rewrite.sandbox" ||
    normalizedScope === "delivery.rewrite.diff" ||
    normalizedScope === "delivery.compliance.registry" ||
    normalizedScope === "delivery.publish.route" ||
    normalizedScope === "delivery.probe.dispatch" ||
    normalizedScope === "delivery.probe.export" ||
    normalizedScope === "delivery.probe.handoff"
  ) {
    return isProPlusTier(tier);
  }
  if (
    normalizedScope === "delivery.compliance.approval" ||
    normalizedScope === "delivery.compliance.signer" ||
    normalizedScope === "delivery.compliance.quorum" ||
    normalizedScope === "delivery.publish.finalize" ||
    normalizedScope === "delivery.publish.confirm"
  ) {
    return isEnterprisePlusTier(tier);
  }
  if (normalizedScope.startsWith("delivery.action.")) {
    return actionPermissionsNormalizeAccessTier(tier) === "admin";
  }
  return !!ctx?.loggedIn;
}

function deliveryScopeDescribeForTier(scope, tier) {
  const normalizedScope = String(scope || "").trim().toLowerCase();
  if (normalizedScope === "delivery.watch.compare" || normalizedScope === "delivery.rewrite.playback" || normalizedScope === "delivery.probe.compare") {
    return actionPermissionsNormalizeAccessTier(tier) === "guest" ? false : actionPermissionsLoginCopy("Basic+", "Basic 及以上");
  }
  if (
    normalizedScope === "delivery.rewrite.bundle" ||
    normalizedScope === "delivery.rewrite.sandbox" ||
    normalizedScope === "delivery.rewrite.diff" ||
    normalizedScope === "delivery.compliance.registry" ||
    normalizedScope === "delivery.publish.route" ||
    normalizedScope === "delivery.probe.dispatch" ||
    normalizedScope === "delivery.probe.export" ||
    normalizedScope === "delivery.probe.handoff"
  ) {
    return isProPlusTier(tier) ? actionPermissionsLoginCopy("Pro+", "Pro 及以上") : false;
  }
  if (
    normalizedScope === "delivery.compliance.approval" ||
    normalizedScope === "delivery.compliance.signer" ||
    normalizedScope === "delivery.compliance.quorum" ||
    normalizedScope === "delivery.publish.finalize" ||
    normalizedScope === "delivery.publish.confirm"
  ) {
    return isEnterprisePlusTier(tier) ? actionPermissionsLoginCopy("Enterprise+", "Enterprise 及以上") : false;
  }
  if (normalizedScope.startsWith("delivery.action.")) {
    return actionPermissionsNormalizeAccessTier(tier) === "admin" ? actionPermissionsLoginCopy("Admin", "管理员") : false;
  }
  return actionPermissionsNormalizeAccessTier(tier) === "guest" ? false : actionPermissionsLoginCopy("Basic+", "Basic 及以上");
}

function buildActionPermissionRegistry(settings = actionPermissionsReadPanelBehaviorSettingsLocal()) {
  const current = actionPermissionsSanitizePanelBehaviorSettings(settings);
  const starterLimit = Number(current.membership.starter_monthly_limit || 30);
  const proLimit = Number(current.membership.pro_monthly_limit || 100);
  const studioLimit = Number(current.membership.studio_monthly_limit || 300);
  const enterpriseLimit = Number(current.membership.enterprise_monthly_limit || 0);
  const enterpriseQuotaLabel =
    enterpriseLimit > 0 ? actionPermissionsLoginCopy(`${enterpriseLimit}/month`, `${enterpriseLimit} 次/月`) : actionPermissionsLoginCopy("Unlimited", "无限");
  const registry = [
    {
      scope: "login.open",
      panel: "login",
      action: actionPermissionsLoginCopy("Open login panel", "打开登录面板"),
      allowed: () => true,
      describe: () => actionPermissionsLoginCopy("Open", "可打开")
    },
    {
      scope: "login.provider.switch",
      panel: "login",
      action: actionPermissionsLoginCopy("Switch linked provider", "切换已绑定平台"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "login.provider.unlink",
      panel: "login",
      action: actionPermissionsLoginCopy("Unlink provider", "解绑平台"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "login.logout",
      panel: "login",
      action: actionPermissionsLoginCopy("Logout", "退出登录"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "profile.open",
      panel: "profile",
      action: actionPermissionsLoginCopy("Open profile panel", "打开资料面板"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "profile.passkey.login",
      panel: "profile",
      action: actionPermissionsLoginCopy("Passkey login", "Passkey 登录"),
      allowed: () => true,
      describe: () => actionPermissionsLoginCopy("Yes", "可用")
    },
    {
      scope: "profile.passkey.enable",
      panel: "profile",
      action: actionPermissionsLoginCopy("Enable passkey", "启用 Passkey"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "profile.avatar.edit",
      panel: "profile",
      action: actionPermissionsLoginCopy("Change avatar", "修改头像"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "profile.nav.works",
      panel: "profile",
      action: actionPermissionsLoginCopy("Jump to works center", "跳转作品中心"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "profile.nav.api",
      panel: "profile",
      action: actionPermissionsLoginCopy("Jump to API panel", "跳转 API 面板"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "works.open",
      panel: "works",
      action: actionPermissionsLoginCopy("Open works center", "打开作品中心"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => (tier === "guest" ? actionPermissionsLoginCopy("Prompt login", "提示登录") : actionPermissionsLoginCopy("Yes", "可用"))
    },
    {
      scope: "works.own.view",
      panel: "works",
      action: actionPermissionsLoginCopy("View/download own works", "查看/下载自己的作品"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "works.watch",
      panel: "works",
      action: actionPermissionsLoginCopy("Open own work in watch panel", "在欣赏面板打开自己的作品"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "works.thumbnail.regen",
      panel: "works",
      action: actionPermissionsLoginCopy("Paid thumbnail value-pack", "付费缩略图增值包装"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => (tier === "guest" ? actionPermissionsLoginCopy("Prompt login", "提示登录") : actionPermissionsLoginCopy("Login + paid boost", "登录后按次付费"))
    },
    {
      scope: "works.preview_video.regen",
      panel: "works",
      action: actionPermissionsLoginCopy("Paid preview video value-pack", "付费缩略视频增值包装"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => (tier === "guest" ? actionPermissionsLoginCopy("Prompt login", "提示登录") : actionPermissionsLoginCopy("Login + paid boost", "登录后按次付费"))
    },
    {
      scope: "works.type.edit",
      panel: "works",
      action: actionPermissionsLoginCopy("Edit work type", "编辑作品类型"),
      allowed: (tier) => isPaidMemberTier(tier),
      describe: (tier) => permissionBooleanLabel(isPaidMemberTier(tier))
    },
    {
      scope: "works.price.edit",
      panel: "works",
      action: actionPermissionsLoginCopy("Edit listen / buyout price", "编辑聆听 / 买断价格"),
      allowed: (tier) => isPaidMemberTier(tier),
      describe: (tier) => permissionBooleanLabel(isPaidMemberTier(tier))
    },
    {
      scope: "works.visibility.edit",
      panel: "works",
      action: actionPermissionsLoginCopy("Edit listing visibility", "编辑上架可见性"),
      allowed: (tier) => isPaidMemberTier(tier),
      describe: (tier) => permissionBooleanLabel(isPaidMemberTier(tier))
    },
    {
      scope: "works.sell",
      panel: "works",
      action: actionPermissionsLoginCopy("Publish / sell works", "上架 / 销售作品"),
      allowed: (tier) => isPaidMemberTier(tier),
      describe: (tier) => permissionBooleanLabel(isPaidMemberTier(tier))
    },
    {
      scope: "works.payout",
      panel: "works",
      action: actionPermissionsLoginCopy("Set up payout", "设置收款"),
      allowed: (tier) => isPaidMemberTier(tier),
      describe: (tier) => permissionBooleanLabel(isPaidMemberTier(tier))
    },
    {
      scope: "seller.view",
      panel: "seller",
      action: actionPermissionsLoginCopy("Open seller dashboard", "打开卖家面板"),
      allowed: (tier) => isPaidMemberTier(tier),
      describe: (tier) => (tier === "guest" ? actionPermissionsLoginCopy("Prompt login", "提示登录") : permissionBooleanLabel(isPaidMemberTier(tier)))
    },
    {
      scope: "seller.payout",
      panel: "seller",
      action: actionPermissionsLoginCopy("Seller payout tools", "卖家收款工具"),
      allowed: (tier) => isPaidMemberTier(tier),
      describe: (tier) => permissionBooleanLabel(isPaidMemberTier(tier))
    },
    {
      scope: "seller.operate",
      panel: "seller",
      action: actionPermissionsLoginCopy("Operate seller controls", "执行高级卖家操作"),
      allowed: (tier) => isVipOrAdminTier(tier),
      describe: (tier) => permissionBooleanLabel(isVipOrAdminTier(tier))
    },
    {
      scope: "api.docs.view",
      panel: "api",
      action: actionPermissionsLoginCopy("Browse API docs", "浏览 API 文档"),
      allowed: () => true,
      describe: () => actionPermissionsLoginCopy("Yes", "可用")
    },
    {
      scope: "api.billing.view",
      panel: "api",
      action: actionPermissionsLoginCopy("View API billing", "查看 API 账单"),
      allowed: () => true,
      describe: (tier) => (tier === "guest" ? actionPermissionsLoginCopy("Docs only", "仅文档") : actionPermissionsLoginCopy("Yes", "可用"))
    },
    {
      scope: "api.billing.manage",
      panel: "api",
      action: actionPermissionsLoginCopy("Manage balance / auto-recharge", "管理余额 / 自动充值"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "api.enterprise.route",
      panel: "api",
      action: actionPermissionsLoginCopy("Enterprise API route", "企业 API 实际路由"),
      allowed: (tier) => canUseEnterpriseApiClient(tier),
      describe: (tier) => (canUseEnterpriseApiClient(tier) ? actionPermissionsLoginCopy("Enabled when admin opens it", "管理员开启后可用") : false)
    },
    {
      scope: "reports.open",
      panel: "reports",
      action: actionPermissionsLoginCopy("Open reports panel", "打开报表面板"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "reports.export.use",
      panel: "reports",
      action: actionPermissionsLoginCopy("Use report export UI", "使用报表导出界面"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => (tier === "guest" ? false : actionPermissionsLoginCopy("View only", "只读查看"))
    },
    {
      scope: "reports.export.source.select",
      panel: "reports",
      action: actionPermissionsLoginCopy("Select export source", "选择导出来源"),
      allowed: (tier) => isVipOrAdminTier(tier),
      describe: (tier) => permissionBooleanLabel(isVipOrAdminTier(tier))
    },
    {
      scope: "reports.export.format.select",
      panel: "reports",
      action: actionPermissionsLoginCopy("Select export format", "选择导出格式"),
      allowed: (tier) => isVipOrAdminTier(tier),
      describe: (tier) => permissionBooleanLabel(isVipOrAdminTier(tier))
    },
    {
      scope: "reports.export.generate",
      panel: "reports",
      action: actionPermissionsLoginCopy("Generate new export", "生成新的导出"),
      allowed: (tier) => isVipOrAdminTier(tier),
      describe: (tier) => permissionBooleanLabel(isVipOrAdminTier(tier))
    },
    {
      scope: "reports.export.result.copy",
      panel: "reports",
      action: actionPermissionsLoginCopy("Copy export result", "复制导出结果"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "reports.export.result.download",
      panel: "reports",
      action: actionPermissionsLoginCopy("Download export result", "下载导出结果"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "reports.export.preview.toggle",
      panel: "reports",
      action: actionPermissionsLoginCopy("Expand / collapse export preview", "展开 / 折叠导出预览"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "reports.history.filter",
      panel: "reports",
      action: actionPermissionsLoginCopy("Filter history", "筛选导出历史"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "reports.history.search",
      panel: "reports",
      action: actionPermissionsLoginCopy("Search history", "搜索导出历史"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "reports.history.select",
      panel: "reports",
      action: actionPermissionsLoginCopy("Select history rows", "选择历史记录"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "reports.history.bulk.download",
      panel: "reports",
      action: actionPermissionsLoginCopy("Download selected history bundle", "下载所选历史合集"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "reports.history.bulk.delete",
      panel: "reports",
      action: actionPermissionsLoginCopy("Delete selected history rows", "删除所选历史记录"),
      allowed: (tier) => isVipOrAdminTier(tier),
      describe: (tier) => permissionBooleanLabel(isVipOrAdminTier(tier))
    },
    {
      scope: "reports.history.sort",
      panel: "reports",
      action: actionPermissionsLoginCopy("Sort history", "排序历史记录"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "reports.history.clear_selection",
      panel: "reports",
      action: actionPermissionsLoginCopy("Clear history selection", "清空历史选择"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "reports.history.clear",
      panel: "reports",
      action: actionPermissionsLoginCopy("Clear export history", "清空导出历史"),
      allowed: (tier) => isVipOrAdminTier(tier),
      describe: (tier) => permissionBooleanLabel(isVipOrAdminTier(tier))
    },
    {
      scope: "reports.history.pin",
      panel: "reports",
      action: actionPermissionsLoginCopy("Pin / unpin history", "固定 / 取消固定历史"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "reports.history.restore",
      panel: "reports",
      action: actionPermissionsLoginCopy("Restore history item to result", "把历史记录载入结果区"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "reports.history.copy",
      panel: "reports",
      action: actionPermissionsLoginCopy("Copy history item", "复制历史记录"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "reports.history.download",
      panel: "reports",
      action: actionPermissionsLoginCopy("Download history item", "下载历史记录"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => permissionBooleanLabel(tier !== "guest")
    },
    {
      scope: "reports.history.delete",
      panel: "reports",
      action: actionPermissionsLoginCopy("Delete single history item", "删除单条历史记录"),
      allowed: (tier) => isVipOrAdminTier(tier),
      describe: (tier) => permissionBooleanLabel(isVipOrAdminTier(tier))
    },
    {
      scope: "creation.start",
      panel: "creation",
      action: actionPermissionsLoginCopy("Start generation", "开始生成"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => ({
        guest: actionPermissionsLoginCopy("Prompt login", "提示登录"),
        free: actionPermissionsLoginCopy("3/month", "3 次/月"),
        starter: actionPermissionsLoginCopy(`${starterLimit}/month`, `${starterLimit} 次/月`),
        pro: actionPermissionsLoginCopy(`${proLimit}/month`, `${proLimit} 次/月`),
        studio: actionPermissionsLoginCopy(`${studioLimit}/month`, `${studioLimit} 次/月`),
        enterprise: enterpriseQuotaLabel,
        vip: actionPermissionsLoginCopy("Unlimited", "无限"),
        admin: actionPermissionsLoginCopy("Unlimited", "无限")
      })[tier]
    },
    {
      scope: "creation.advanced",
      panel: "creation",
      action: actionPermissionsLoginCopy("Advanced creation settings", "高级创作设置"),
      allowed: (tier) => ["pro", "studio", "enterprise", "vip", "admin"].includes(tier),
      describe: (tier) => permissionBooleanLabel(["pro", "studio", "enterprise", "vip", "admin"].includes(tier))
    },
    {
      scope: "creation.structured",
      panel: "creation",
      action: actionPermissionsLoginCopy("Structured works / triptych / opera", "结构化作品 / 三部曲 / 歌剧"),
      allowed: (tier) => ["pro", "studio", "enterprise", "vip", "admin"].includes(tier),
      describe: (tier) => permissionBooleanLabel(["pro", "studio", "enterprise", "vip", "admin"].includes(tier))
    },
    {
      scope: "creation.extras",
      panel: "creation",
      action: actionPermissionsLoginCopy("Extra languages / voice lanes", "额外语言 / 多声线"),
      allowed: (tier) => !["guest", "free"].includes(tier),
      describe: (tier) => ({
        guest: false,
        free: actionPermissionsLoginCopy("Upgrade first", "先升级会员"),
        starter: actionPermissionsLoginCopy("Boost", "临时加购"),
        pro: actionPermissionsLoginCopy("Boost", "临时加购"),
        studio: actionPermissionsLoginCopy("Included + boost", "部分内含 + 可加购"),
        enterprise: actionPermissionsLoginCopy("Included + boost", "部分内含 + 可加购"),
        vip: actionPermissionsLoginCopy("Unlimited", "无限"),
        admin: actionPermissionsLoginCopy("Unlimited", "无限")
      })[tier]
    },
    {
      scope: "creation.cinema",
      panel: "creation",
      action: actionPermissionsLoginCopy("Cinema-grade generation", "电影级生成"),
      allowed: (tier) => tier === "admin",
      describe: (tier) => ({
        guest: false,
        free: false,
        starter: false,
        pro: actionPermissionsLoginCopy("Booking only", "仅预约"),
        studio: actionPermissionsLoginCopy("Booking only", "仅预约"),
        enterprise: actionPermissionsLoginCopy("Contract / booking", "合同 / 预约"),
        vip: actionPermissionsLoginCopy("Private arrangement", "专门安排"),
        admin: actionPermissionsLoginCopy("Yes", "可用")
      })[tier]
    },
    {
      scope: "cssmv.open",
      panel: "cssmv",
      action: actionPermissionsLoginCopy("Open CSSMV panel / digest / timeline", "打开 CSSMV 面板 / 摘要 / 时间线"),
      allowed: (tier, ctx) => ctx.loggedIn,
      describe: (tier) => (tier === "guest" ? actionPermissionsLoginCopy("Prompt login", "提示登录") : actionPermissionsLoginCopy("Yes", "可用"))
    },
    {
      scope: "cssmv.workspace.sync",
      panel: "cssmv",
      action: actionPermissionsLoginCopy("Studio workspace/project sync", "Studio 工作区 / 项目同步"),
      allowed: (tier) => canUseStudioWorkspaceClient(tier),
      describe: (tier) => permissionBooleanLabel(canUseStudioWorkspaceClient(tier))
    },
    {
      scope: "cssmv.action.retry",
      panel: "cssmv",
      action: actionPermissionsLoginCopy("Delivery action: retry", "CSSMV 动作：重试"),
      allowed: (tier) => ["pro", "studio", "enterprise", "vip", "admin"].includes(tier),
      describe: (tier) => permissionBooleanLabel(["pro", "studio", "enterprise", "vip", "admin"].includes(tier))
    },
    {
      scope: "cssmv.action.force_refresh_signals",
      panel: "cssmv",
      action: actionPermissionsLoginCopy("Delivery action: force refresh signals", "CSSMV 动作：强制刷新信号"),
      allowed: (tier) => ["studio", "enterprise", "vip", "admin"].includes(tier),
      describe: (tier) => permissionBooleanLabel(["studio", "enterprise", "vip", "admin"].includes(tier))
    },
    {
      scope: "cssmv.action.capture_snapshot",
      panel: "cssmv",
      action: actionPermissionsLoginCopy("Delivery action: capture snapshot", "CSSMV 动作：捕获快照"),
      allowed: (tier) => ["studio", "enterprise", "vip", "admin"].includes(tier),
      describe: (tier) => permissionBooleanLabel(["studio", "enterprise", "vip", "admin"].includes(tier))
    },
    {
      scope: "cssmv.action.escalate_ops",
      panel: "cssmv",
      action: actionPermissionsLoginCopy("Delivery action: escalate ops", "CSSMV 动作：升级到运维"),
      allowed: (tier) => ["enterprise", "vip", "admin"].includes(tier),
      describe: (tier) => permissionBooleanLabel(["enterprise", "vip", "admin"].includes(tier))
    },
    {
      scope: "cssmv.action.require_manual_intervention",
      panel: "cssmv",
      action: actionPermissionsLoginCopy("Delivery action: require manual intervention", "CSSMV 动作：要求人工介入"),
      allowed: (tier) => ["vip", "admin"].includes(tier),
      describe: (tier) => permissionBooleanLabel(["vip", "admin"].includes(tier))
    }
  ];
  DELIVERY_STANDARD_SCOPE_RULES.forEach((entry) => {
    registry.push({
      scope: entry.scope,
      panel: entry.panel,
      action: entry.action,
      allowed: (tier, ctx) => deliveryScopeAllowedForTier(entry.scope, tier, ctx),
      describe: (tier) => deliveryScopeDescribeForTier(entry.scope, tier)
    });
  });
  registry.push({
    scope: "delivery.action.standard",
    panel: "reports",
    action: actionPermissionsLoginCopy("Delivery standard actions", "交付标准动作"),
    allowed: (tier, ctx) => ctx.loggedIn,
    describe: (tier) => permissionBooleanLabel(tier !== "guest")
  });
  DELIVERY_ADMIN_ONLY_ACTION_ATTRS.forEach((attrName) => {
    registry.push({
      scope: deliveryPermissionScopeFromAttr(attrName),
      panel: deliveryPermissionPanelFromAttr(attrName),
      action: deliveryPermissionActionLabel(attrName),
      allowed: (tier) => tier === "admin",
      describe: (tier) => permissionBooleanLabel(tier === "admin")
    });
  });
  return registry;
}

function getActionPermissionRule(scope, settings = actionPermissionsReadPanelBehaviorSettingsLocal()) {
  const normalized = String(scope || "").trim().toLowerCase();
  if (!normalized) return null;
  return buildActionPermissionRegistry(settings).find((rule) => rule.scope === normalized) || null;
}

function describeActionPermission(scope, tier, settings = actionPermissionsReadPanelBehaviorSettingsLocal()) {
  const rule = getActionPermissionRule(scope, settings);
  if (!rule) return false;
  const normalizedTier = actionPermissionsNormalizeAccessTier(tier);
  const value = typeof rule.describe === "function" ? rule.describe(normalizedTier, settings) : rule.describe;
  if (value !== undefined) return value;
  return permissionBooleanLabel(Boolean(rule.allowed?.(normalizedTier, { loggedIn: normalizedTier !== "guest", admin: normalizedTier === "admin", settings })));
}

function permissionRequirementLabel(scope, settings = actionPermissionsReadPanelBehaviorSettingsLocal()) {
  const rule = getActionPermissionRule(scope, settings);
  if (!rule) return "";
  const tiers = [
    { key: "guest", label: actionPermissionsLoginCopy("Public", "公开") },
    { key: "free", label: actionPermissionsLoginCopy("Basic+", "Basic+") },
    { key: "starter", label: actionPermissionsLoginCopy("Starter+", "Starter+") },
    { key: "pro", label: actionPermissionsLoginCopy("Pro+", "Pro+") },
    { key: "studio", label: actionPermissionsLoginCopy("Studio+", "Studio+") },
    { key: "enterprise", label: actionPermissionsLoginCopy("Enterprise+", "Enterprise+") },
    { key: "vip", label: actionPermissionsLoginCopy("VIP+", "VIP+") },
    { key: "admin", label: actionPermissionsLoginCopy("Admin", "管理员") }
  ];
  const firstAllowed = tiers.find((entry) =>
    Boolean(
      rule.allowed?.(entry.key, {
        loggedIn: entry.key !== "guest",
        admin: entry.key === "admin",
        settings
      })
    )
  );
  if (!firstAllowed) return actionPermissionsLoginCopy("Blocked", "禁用");
  if (firstAllowed.key === "guest") return actionPermissionsLoginCopy("Public", "公开");
  if (firstAllowed.key === "free") return actionPermissionsLoginCopy("Basic+", "Basic+");
  if (firstAllowed.key === "admin") return actionPermissionsLoginCopy("Admin", "管理员");
  return firstAllowed.label;
}

function buildActionPermissionMatrixRows(settings = actionPermissionsReadPanelBehaviorSettingsLocal()) {
  return buildActionPermissionRegistry(settings)
    .filter((rule) => rule.matrix !== false && rule.panel && rule.action)
    .map((rule) => ({
      panel: rule.panel,
      scope: rule.scope,
      action: rule.action,
      requirement: permissionRequirementLabel(rule.scope, settings),
      access: (tier) => describeActionPermission(rule.scope, tier, settings)
    }));
}

function filterActionPermissionMatrixRows(rows, filter = permissionOverviewFilter) {
  const normalized = String(filter || "all").trim().toLowerCase();
  const items = Array.isArray(rows) ? rows : [];
  const domainFiltered =
    normalized === "delivery"
      ? items.filter((row) => String(row.scope || "").startsWith("delivery."))
      : items;
  const requirementFiltered = domainFiltered.filter((row) => {
    const requirement = String(row.requirement || "").toLowerCase();
    const scope = String(row.scope || "").toLowerCase();
    if (permissionOverviewRequirementFilter === "basic") return requirement.includes("basic");
    if (permissionOverviewRequirementFilter === "pro") return requirement.includes("pro");
    if (permissionOverviewRequirementFilter === "enterprise") return requirement.includes("enterprise");
    if (permissionOverviewRequirementFilter === "vip") return requirement.includes("vip");
    if (permissionOverviewRequirementFilter === "admin") return requirement === "admin" || requirement === "管理员";
    return true;
  });
  return requirementFiltered.filter((row) => {
    const scope = String(row.scope || "").toLowerCase();
    if (permissionOverviewDomainFilter === "watch") return scope.startsWith("delivery.watch.");
    if (permissionOverviewDomainFilter === "rewrite") return scope.startsWith("delivery.rewrite.");
    if (permissionOverviewDomainFilter === "compliance") return scope.startsWith("delivery.compliance.");
    if (permissionOverviewDomainFilter === "probe") return scope.startsWith("delivery.probe.");
    if (permissionOverviewDomainFilter === "publish") return scope.startsWith("delivery.publish.") || scope.startsWith("delivery.post_publish.");
    return true;
  });
}


window.buildPermissionCellForTier = Object.assign(buildPermissionCellForTier, { __moduleImpl: buildPermissionCellForTier });
window.deliveryPermissionScopeFromAttr = Object.assign(deliveryPermissionScopeFromAttr, { __moduleImpl: deliveryPermissionScopeFromAttr });
window.deliveryPermissionPanelFromAttr = Object.assign(deliveryPermissionPanelFromAttr, { __moduleImpl: deliveryPermissionPanelFromAttr });
window.deliveryPermissionActionLabel = Object.assign(deliveryPermissionActionLabel, { __moduleImpl: deliveryPermissionActionLabel });
window.permissionBooleanLabel = Object.assign(permissionBooleanLabel, { __moduleImpl: permissionBooleanLabel });
window.isBasicPlusTier = Object.assign(isBasicPlusTier, { __moduleImpl: isBasicPlusTier });
window.isProPlusTier = Object.assign(isProPlusTier, { __moduleImpl: isProPlusTier });
window.isEnterprisePlusTier = Object.assign(isEnterprisePlusTier, { __moduleImpl: isEnterprisePlusTier });
window.deliveryScopeAllowedForTier = Object.assign(deliveryScopeAllowedForTier, { __moduleImpl: deliveryScopeAllowedForTier });
window.deliveryScopeDescribeForTier = Object.assign(deliveryScopeDescribeForTier, { __moduleImpl: deliveryScopeDescribeForTier });
window.buildActionPermissionRegistry = Object.assign(buildActionPermissionRegistry, { __moduleImpl: buildActionPermissionRegistry });
window.getActionPermissionRule = Object.assign(getActionPermissionRule, { __moduleImpl: getActionPermissionRule });
window.describeActionPermission = Object.assign(describeActionPermission, { __moduleImpl: describeActionPermission });
window.permissionRequirementLabel = Object.assign(permissionRequirementLabel, { __moduleImpl: permissionRequirementLabel });
window.buildActionPermissionMatrixRows = Object.assign(buildActionPermissionMatrixRows, { __moduleImpl: buildActionPermissionMatrixRows });
window.filterActionPermissionMatrixRows = Object.assign(filterActionPermissionMatrixRows, { __moduleImpl: filterActionPermissionMatrixRows });
window.__actionPermissionCore = {
  buildPermissionCellForTier: buildPermissionCellForTier,
  deliveryPermissionScopeFromAttr: deliveryPermissionScopeFromAttr,
  deliveryPermissionPanelFromAttr: deliveryPermissionPanelFromAttr,
  deliveryPermissionActionLabel: deliveryPermissionActionLabel,
  permissionBooleanLabel: permissionBooleanLabel,
  isBasicPlusTier: isBasicPlusTier,
  isProPlusTier: isProPlusTier,
  isEnterprisePlusTier: isEnterprisePlusTier,
  deliveryScopeAllowedForTier: deliveryScopeAllowedForTier,
  deliveryScopeDescribeForTier: deliveryScopeDescribeForTier,
  buildActionPermissionRegistry: buildActionPermissionRegistry,
  getActionPermissionRule: getActionPermissionRule,
  describeActionPermission: describeActionPermission,
  permissionRequirementLabel: permissionRequirementLabel,
  buildActionPermissionMatrixRows: buildActionPermissionMatrixRows,
  filterActionPermissionMatrixRows: filterActionPermissionMatrixRows
};
})();
