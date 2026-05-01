function buildWatchArchiveRegionLinkConclusionCardModule(probeSummary) {
  const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
  const conclusion = payload?.conclusion || {};
  const targets = Array.isArray(payload?.targets) ? payload.targets : [];
  const targetByName = Object.fromEntries(targets.map((item) => [String(item?.target || ""), item]));
  const localPublic = targetByName.local_public || null;
  const apiVmPublic = targetByName.api_vm_public || null;
  const gzvmPublic = targetByName.gzvm_public || null;
  const gzvmLoopback = targetByName.gzvm_loopback || null;
  const verdict = String(conclusion?.verdict || "");
  let headline = dashboardCopy("Probe summary unavailable", "探针摘要暂不可用");
  if (verdict === "server_recovered") headline = dashboardCopy("Server recovered", "服务器已恢复");
  else if (verdict === "cross_border_path_anomaly") headline = dashboardCopy("Cross-border path anomaly", "跨境链路异常");
  else if (verdict === "server_side_degradation") headline = dashboardCopy("Server-side degradation", "服务器侧退化");
  else if (verdict === "mixed_or_unknown") headline = dashboardCopy("Mixed path health", "链路状态混合");
  return {
    headline,
    verdict: verdict || "unknown",
    summary: conclusion?.summary || dashboardCopy("No region link conclusion summary yet.", "当前还没有地区链路结论摘要。"),
    note: dashboardCopy(
      `Local=${localPublic?.http_success_rate ?? 0}% · api-vm=${apiVmPublic?.http_success_rate ?? 0}% · gzvm=${gzvmPublic?.http_success_rate ?? 0}% · loopback=${gzvmLoopback?.http_success_rate ?? 0}%`,
      `本机=${localPublic?.http_success_rate ?? 0}% · 美国机=${apiVmPublic?.http_success_rate ?? 0}% · 中国公网=${gzvmPublic?.http_success_rate ?? 0}% · 中国回环=${gzvmLoopback?.http_success_rate ?? 0}%`
    ),
    capturedAt: payload?.captured_at || ""
  };
}

function buildWatchArchiveRegionLinkTrendStripModule(probeSummary) {
  const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
  const targets = Array.isArray(payload?.targets) ? payload.targets : [];
  return targets.filter((item) => item && item.target).map((item) => ({
    target: String(item.target),
    httpRate: Number(item.http_success_rate || 0),
    tlsRate: Number(item.tls_success_rate || 0),
    resetRate: Number(item.reset_rate || 0)
  }));
}

function buildProbeSparklineModule(points) {
  const values = Array.isArray(points) ? points.map((value) => Math.max(0, Math.min(100, Number(value || 0)))) : [];
  if (!values.length) return "";
  return values.map((value) => {
    if (value >= 95) return "█";
    if (value >= 80) return "▇";
    if (value >= 60) return "▆";
    if (value >= 40) return "▄";
    if (value >= 20) return "▂";
    return "▁";
  }).join("");
}

function buildWatchArchiveCertExpiryCardModule(probeSummary) {
  const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
  const cert = payload?.metadata?.certificate || {};
  const daysRemaining = Number(cert?.days_remaining);
  let level = dashboardCopy("unknown", "未知");
  if (Number.isFinite(daysRemaining)) {
    if (daysRemaining >= 21) level = dashboardCopy("healthy", "健康");
    else if (daysRemaining >= 7) level = dashboardCopy("watch", "观察");
    else level = dashboardCopy("alert", "告警");
  }
  return {
    level,
    title: dashboardCopy("TLS certificate expiry", "TLS 证书到期"),
    note: cert?.not_after
      ? dashboardCopy(
          `gzvm cert expires at ${cert.not_after}${Number.isFinite(daysRemaining) ? ` · ${daysRemaining} days left` : ""}`,
          `gzvm 证书到期时间 ${cert.not_after}${Number.isFinite(daysRemaining) ? ` · 剩余 ${daysRemaining} 天` : ""}`
        )
      : dashboardCopy("Certificate expiry is not available yet.", "证书到期信息暂时不可用。")
  };
}

function buildWatchArchiveUpstreamDependencyMemoModule(probeSummary) {
  const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
  const targets = Array.isArray(payload?.targets) ? payload.targets : [];
  const targetByName = Object.fromEntries(targets.map((item) => [String(item?.target || ""), item]));
  const gzvmPublic = targetByName.gzvm_public || null;
  const gzvmLoopback = targetByName.gzvm_loopback || null;
  const localPublic = targetByName.local_public || null;
  const apiVmPublic = targetByName.api_vm_public || null;
  const gzvmServer = (Array.isArray(payload?.metadata?.servers) ? payload.metadata.servers : []).find((item) => String(item?.server || "") === "gzvm");
  const hostHealthy =
    String(gzvmServer?.nginx_status || "") === "active" &&
    String(gzvmServer?.cssos_status || "") === "online" &&
    Number(gzvmPublic?.http_success_rate || 0) >= 80 &&
    Number(gzvmLoopback?.http_success_rate || 0) >= 80;
  const edgeWeak = Number(localPublic?.http_success_rate || 0) < 50 || Number(apiVmPublic?.http_success_rate || 0) < 50;
  let headline = dashboardCopy("Dependency picture is still mixed.", "当前依赖链画像仍然混合。");
  if (hostHealthy && edgeWeak) headline = dashboardCopy("Core host dependencies look healthy; the weaker dependency is the external route path.", "核心主机依赖看起来健康，偏弱的是外部路由路径。");
  else if (!hostHealthy) headline = dashboardCopy("The host stack still needs attention before blaming upstream routing.", "在怀疑上游路由之前，主机栈仍需先处理。");
  return {
    headline,
    note: dashboardCopy(
      `gzvm nginx=${gzvmServer?.nginx_status || "unknown"} · cssos=${gzvmServer?.cssos_status || "unknown"} · public=${gzvmPublic?.http_success_rate ?? 0}% · loopback=${gzvmLoopback?.http_success_rate ?? 0}%`,
      `gzvm nginx=${gzvmServer?.nginx_status || "unknown"} · cssos=${gzvmServer?.cssos_status || "unknown"} · 公网=${gzvmPublic?.http_success_rate ?? 0}% · 回环=${gzvmLoopback?.http_success_rate ?? 0}%`
    )
  };
}

function buildWatchArchiveHttpStatusBreakdownModule(probeSummary) {
  const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
  const targets = Array.isArray(payload?.targets) ? payload.targets : [];
  return targets.filter((item) => item && item.target).map((item) => {
    const breakdown = item?.http_status_breakdown || {};
    return {
      target: String(item.target),
      line: dashboardCopy(
        `200:${Number(breakdown["200"] || 0)} · 301:${Number(breakdown["301"] || 0)} · 000:${Number(breakdown["000"] || 0)} · other:${Number(breakdown.other || 0)}`,
        `200:${Number(breakdown["200"] || 0)} · 301:${Number(breakdown["301"] || 0)} · 000:${Number(breakdown["000"] || 0)} · 其他:${Number(breakdown.other || 0)}`
      )
    };
  });
}

function buildWatchArchiveCertRenewalCountdownModule(probeSummary) {
  const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
  const cert = payload?.metadata?.certificate || {};
  const daysRemaining = Number(cert?.days_remaining);
  let band = dashboardCopy("unknown", "未知");
  if (Number.isFinite(daysRemaining)) {
    if (daysRemaining >= 30) band = dashboardCopy("safe window", "安全窗口");
    else if (daysRemaining >= 14) band = dashboardCopy("renew soon", "建议续期");
    else band = dashboardCopy("urgent", "紧急");
  }
  return {
    band,
    note: cert?.not_after
      ? dashboardCopy(`${daysRemaining} days left until ${cert.not_after}`, `距离 ${cert.not_after} 还剩 ${daysRemaining} 天`)
      : dashboardCopy("Certificate countdown is not available yet.", "证书倒计时暂时不可用。")
  };
}

function buildWatchArchiveServerIncidentLogStripModule(probeHistory) {
  const samples = Array.isArray(probeHistory) ? probeHistory : [];
  return samples.slice(-6).reverse().map((sample) => {
    const verdict = String(sample?.conclusion?.verdict || "unknown");
    const label =
      verdict === "cross_border_path_anomaly"
        ? dashboardCopy("route anomaly", "链路异常")
        : verdict === "server_recovered"
          ? dashboardCopy("recovered", "已恢复")
          : verdict === "server_side_degradation"
            ? dashboardCopy("server degradation", "服务器退化")
            : dashboardCopy("mixed", "混合");
    return {
      capturedAt: String(sample?.captured_at || ""),
      summary: sample?.conclusion?.summary || dashboardCopy("No incident summary yet.", "当前还没有异常摘要。"),
      label
    };
  });
}

function buildWatchArchiveOnCallSummaryBannerModule(probeSummary) {
  const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
  const conclusion = payload?.conclusion || {};
  const metadata = payload?.metadata || {};
  const gzvm = (Array.isArray(metadata?.servers) ? metadata.servers : []).find((item) => String(item?.server || "") === "gzvm");
  const verdict = String(conclusion?.verdict || "");
  let level = dashboardCopy("watch", "观察");
  let headline = dashboardCopy("On-call summary is mixed.", "值班摘要当前偏混合。");
  if (verdict === "cross_border_path_anomaly") {
    level = dashboardCopy("watch", "观察");
    headline = dashboardCopy("Host looks healthy; watch the route path, not the app process.", "主机看起来健康，值班更该盯链路，不是应用进程。");
  } else if (verdict === "server_recovered") {
    level = dashboardCopy("healthy", "健康");
    headline = dashboardCopy("Server path looks recovered and stable enough for routine watch.", "服务器路径看起来已恢复，适合进入常规值班观察。");
  } else if (verdict === "server_side_degradation") {
    level = dashboardCopy("alert", "告警");
    headline = dashboardCopy("Server-side degradation still needs direct action.", "服务器侧退化仍需要直接处理。");
  }
  return {
    level,
    headline,
    note: dashboardCopy(
      `gzvm nginx=${gzvm?.nginx_status || "unknown"} · cssos=${gzvm?.cssos_status || "unknown"} · verdict=${verdict || "unknown"}`,
      `gzvm nginx=${gzvm?.nginx_status || "unknown"} · cssos=${gzvm?.cssos_status || "unknown"} · 结论=${verdict || "unknown"}`
    )
  };
}

function buildWatchArchiveCertRenewalActionCardModule(probeSummary) {
  const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
  const cert = payload?.metadata?.certificate || {};
  const daysRemaining = Number(cert?.days_remaining);
  let action = dashboardCopy("Keep watching the renewal window.", "继续观察续期窗口。");
  if (Number.isFinite(daysRemaining)) {
    if (daysRemaining >= 30) action = dashboardCopy("No urgent renewal action yet. Keep a calendar reminder and continue routine checks.", "暂时不用紧急续期，保留日历提醒并继续常规检查。");
    else if (daysRemaining >= 14) action = dashboardCopy("Start renewal preparation now so the replacement cert is ready before the final two-week window.", "现在就开始准备续期，确保新证书在最后两周前准备好。");
    else action = dashboardCopy("Renew immediately and schedule a post-renew validation run.", "立即续期，并安排一次续期后的验证探针。");
  }
  return { title: dashboardCopy("Cert Renewal Action", "证书续期动作"), note: action };
}

function buildWatchArchiveIncidentExportBundleModule(probeSummary, probeHistory) {
  const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
  const history = Array.isArray(probeHistory) ? probeHistory : [];
  const latest = history.length ? history[history.length - 1] : payload;
  return {
    schema: "cssos.zh_probe_incident_bundle.v1",
    exported_at: new Date().toISOString(),
    latest_probe: payload,
    latest_sample: latest || null,
    recent_history: history.slice(-12)
  };
}

function buildWatchArchiveOnCallActionChecklistModule(probeSummary) {
  const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
  const verdict = String(payload?.conclusion?.verdict || "");
  if (verdict === "cross_border_path_anomaly") {
    return [
      dashboardCopy("Confirm gzvm nginx and cssos are still healthy.", "先确认 gzvm 的 nginx 和 cssos 仍然健康。"),
      dashboardCopy("Watch external route resets instead of restarting the app.", "优先观察外部链路 reset，不要先重启应用。"),
      dashboardCopy("Export the current incident bundle before handoff.", "交班前导出当前异常交接包。")
    ];
  }
  if (verdict === "server_side_degradation") {
    return [
      dashboardCopy("Check gzvm loopback path first.", "先检查 gzvm 回环路径。"),
      dashboardCopy("Verify nginx and cssos status before blaming the route.", "先核对 nginx 和 cssos 状态，再判断是否是链路问题。"),
      dashboardCopy("Export the latest probe bundle for incident tracking.", "导出最新探针包用于异常跟踪。")
    ];
  }
  return [
    dashboardCopy("Refresh the probe panel and verify the latest sample.", "刷新探针面板并确认最新样本。"),
    dashboardCopy("Check the cert countdown and renewal action card.", "看一眼证书倒计时和续证动作卡。"),
    dashboardCopy("Keep the latest incident bundle ready for handoff.", "保持最新异常交接包随时可导出。")
  ];
}

function buildWatchArchiveCertValidationDrillModule(probeSummary) {
  const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
  const cert = payload?.metadata?.certificate || {};
  return [
    dashboardCopy(`1. Renew before ${cert?.not_after || "the expiry window"}.`, `1. 在 ${cert?.not_after || "到期窗口"} 之前完成续期。`),
    dashboardCopy("2. Run the probe again and confirm gzvm public + loopback both return HTTP 200.", "2. 续期后重跑探针，确认 gzvm 公网和回环都返回 HTTP 200。"),
    dashboardCopy("3. Confirm the cert countdown card shows the new not-after date.", "3. 确认证书倒计时卡已经显示新的到期时间。")
  ];
}

Object.assign(globalThis, {
  buildWatchArchiveRegionLinkConclusionCardModule,
  buildWatchArchiveRegionLinkTrendStripModule,
  buildProbeSparklineModule,
  buildWatchArchiveCertExpiryCardModule,
  buildWatchArchiveUpstreamDependencyMemoModule,
  buildWatchArchiveHttpStatusBreakdownModule,
  buildWatchArchiveCertRenewalCountdownModule,
  buildWatchArchiveServerIncidentLogStripModule,
  buildWatchArchiveOnCallSummaryBannerModule,
  buildWatchArchiveCertRenewalActionCardModule,
  buildWatchArchiveIncidentExportBundleModule,
  buildWatchArchiveOnCallActionChecklistModule,
  buildWatchArchiveCertValidationDrillModule
});
