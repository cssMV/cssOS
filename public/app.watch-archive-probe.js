(function attachWatchArchiveProbe(global) {
  const dashboardCopy = (...args) => global.dashboardCopy(...args);

  function buildWatchArchiveLinkStabilitySparklineBridge(probeHistory) {
    const samples = Array.isArray(probeHistory) ? probeHistory : [];
    if (!samples.length) return [];
    const targetSeries = new Map();
    samples.forEach((sample) => {
      const targets = Array.isArray(sample?.targets) ? sample.targets : [];
      targets.forEach((target) => {
        const key = String(target?.target || "").trim();
        if (!key) return;
        if (!targetSeries.has(key)) targetSeries.set(key, []);
        targetSeries.get(key).push(Number(target?.http_success_rate || 0));
      });
    });
    return Array.from(targetSeries.entries()).map(([target, series]) => ({
      target,
      sparkline: global.buildProbeSparkline(series),
      latest: series.length ? Number(series[series.length - 1] || 0) : 0,
      floor: series.length ? Math.min(...series) : 0,
      ceiling: series.length ? Math.max(...series) : 0
    }));
  }

  function buildWatchArchiveAlertThresholdCardsBridge(probeSummary, probeHistory) {
    const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
    const historySamples = Array.isArray(probeHistory) ? probeHistory : [];
    const latestTargets = Array.isArray(payload?.targets) ? payload.targets : [];
    const historyCount = historySamples.length;
    return latestTargets
      .filter((item) => item && item.target)
      .map((item) => {
        const httpRate = Number(item.http_success_rate || 0);
        const resetRate = Number(item.reset_rate || 0);
        const level =
          httpRate >= 95 && resetRate <= 5
            ? dashboardCopy("healthy", "健康")
            : httpRate >= 70 && resetRate <= 25
              ? dashboardCopy("watch", "观察")
              : dashboardCopy("alert", "告警");
        return {
          target: String(item.target),
          level,
          status: dashboardCopy(
            `HTTP ${httpRate}% vs reset ${resetRate}%`,
            `HTTP ${httpRate}%，重置 ${resetRate}%`
          ),
          note: dashboardCopy(
            `${historyCount} historical samples in trend memory.`,
            `趋势记忆里已有 ${historyCount} 个历史样本。`
          )
        };
      });
  }

  function buildWatchArchiveRouteComparisonMemoBridge(probeSummary) {
    const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
    const targets = Array.isArray(payload?.targets) ? payload.targets : [];
    const targetByName = Object.fromEntries(targets.map((item) => [String(item?.target || ""), item]));
    const localPublic = targetByName.local_public || null;
    const apiVmPublic = targetByName.api_vm_public || null;
    const gzvmPublic = targetByName.gzvm_public || null;
    const gzvmLoopback = targetByName.gzvm_loopback || null;

    const outsideWeak =
      Number(localPublic?.http_success_rate || 0) < 50 || Number(apiVmPublic?.http_success_rate || 0) < 50;
    const serverStrong =
      Number(gzvmPublic?.http_success_rate || 0) >= 80 && Number(gzvmLoopback?.http_success_rate || 0) >= 80;

    let headline = dashboardCopy("Route comparison is still mixed.", "当前路径对比仍然混合。");
    if (outsideWeak && serverStrong) {
      headline = dashboardCopy(
        "Cross-border or external path weakness is more likely than a server crash.",
        "当前更像跨境或外部路径偏弱，不像服务器宕机。"
      );
    } else if (!outsideWeak && serverStrong) {
      headline = dashboardCopy(
        "Server path and external path look aligned.",
        "服务器路径与外部路径目前基本一致。"
      );
    } else if (!serverStrong) {
      headline = dashboardCopy(
        "Server-side path still needs attention before blaming the route.",
        "在怀疑链路之前，服务器侧路径仍需先关注。"
      );
    }

    return {
      headline,
      note: dashboardCopy(
        `Local=${localPublic?.http_success_rate ?? 0}% · api-vm=${apiVmPublic?.http_success_rate ?? 0}% · gzvm public=${gzvmPublic?.http_success_rate ?? 0}% · gzvm loopback=${gzvmLoopback?.http_success_rate ?? 0}%`,
        `本机=${localPublic?.http_success_rate ?? 0}% · 美国机=${apiVmPublic?.http_success_rate ?? 0}% · 中国公网=${gzvmPublic?.http_success_rate ?? 0}% · 中国回环=${gzvmLoopback?.http_success_rate ?? 0}%`
      )
    };
  }

  function buildWatchArchiveUptimeStripBridge(probeHistory) {
    const samples = Array.isArray(probeHistory) ? probeHistory : [];
    if (!samples.length) return [];
    const targetSeries = new Map();
    samples.forEach((sample) => {
      const targets = Array.isArray(sample?.targets) ? sample.targets : [];
      targets.forEach((target) => {
        const key = String(target?.target || "").trim();
        if (!key) return;
        if (!targetSeries.has(key)) targetSeries.set(key, []);
        targetSeries.get(key).push(Number(target?.http_success_rate || 0) >= 80 ? 1 : 0);
      });
    });
    return Array.from(targetSeries.entries()).map(([target, series]) => {
      const successful = series.reduce((sum, value) => sum + value, 0);
      const percent = series.length ? Math.round((successful / series.length) * 100) : 0;
      return {
        target,
        uptimePercent: percent,
        strip: series.map((value) => (value ? "█" : "·")).join("")
      };
    });
  }

  function buildWatchArchiveServerHealthCardBridge(probeSummary) {
    const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
    const targets = Array.isArray(payload?.targets) ? payload.targets : [];
    const targetByName = Object.fromEntries(targets.map((item) => [String(item?.target || ""), item]));
    const gzvmPublic = targetByName.gzvm_public || null;
    const gzvmLoopback = targetByName.gzvm_loopback || null;
    const localPublic = targetByName.local_public || null;
    const apiVmPublic = targetByName.api_vm_public || null;

    const serverHealthy =
      Number(gzvmPublic?.http_success_rate || 0) >= 80 && Number(gzvmLoopback?.http_success_rate || 0) >= 80;
    const remoteWeak =
      Number(localPublic?.http_success_rate || 0) < 50 || Number(apiVmPublic?.http_success_rate || 0) < 50;

    let title = dashboardCopy("Server health is mixed", "服务器健康度混合");
    let level = dashboardCopy("watch", "观察");
    let summary = dashboardCopy(
      "The probe set is still mixed, so server health is not fully settled yet.",
      "当前探针结果仍然混合，服务器健康度还不能完全下定论。"
    );
    if (serverHealthy && remoteWeak) {
      title = dashboardCopy("Server path looks healthy", "服务器路径看起来健康");
      level = dashboardCopy("healthy", "健康");
      summary = dashboardCopy(
        "gzvm public and loopback both look healthy, which points more to route weakness than server failure.",
        "中国公网与中国回环都健康，更像路径偏弱，不像服务器失败。"
      );
    } else if (!serverHealthy) {
      title = dashboardCopy("Server path still needs work", "服务器路径仍需处理");
      level = dashboardCopy("alert", "告警");
      summary = dashboardCopy(
        "gzvm public or loopback is still below the health threshold, so server-side recovery is incomplete.",
        "中国公网或中国回环仍低于健康阈值，说明服务器侧恢复还没完全到位。"
      );
    }

    return {
      title,
      level,
      summary,
      note: dashboardCopy(
        `gzvm public=${gzvmPublic?.http_success_rate ?? 0}% @ ${gzvmPublic?.avg_total_latency_ms ?? 0}ms · loopback=${gzvmLoopback?.http_success_rate ?? 0}% @ ${gzvmLoopback?.avg_total_latency_ms ?? 0}ms`,
        `中国公网=${gzvmPublic?.http_success_rate ?? 0}% @ ${gzvmPublic?.avg_total_latency_ms ?? 0}ms · 中国回环=${gzvmLoopback?.http_success_rate ?? 0}% @ ${gzvmLoopback?.avg_total_latency_ms ?? 0}ms`
      )
    };
  }

  function buildWatchArchiveEndpointLatencyMemoBridge(probeSummary) {
    const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
    const targets = Array.isArray(payload?.targets) ? payload.targets : [];
    if (!targets.length) {
      return {
        headline: dashboardCopy("No latency memo yet.", "当前还没有延迟备忘。"),
        rows: []
      };
    }
    const rows = targets
      .filter((item) => item && item.target)
      .map((item) => ({
        target: String(item.target),
        totalLatency: Number(item.avg_total_latency_ms || 0),
        connectLatency: Number(item.avg_connect_latency_ms || 0)
      }));
    const headline = dashboardCopy(
      "Average endpoint latency from each probe path.",
      "每条探针路径的平均端点延迟。"
    );
    return { headline, rows };
  }

  function buildWatchArchiveServiceStatusStripBridge(probeSummary) {
    const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
    const servers = Array.isArray(payload?.metadata?.servers) ? payload.metadata.servers : [];
    return servers.map((item) => {
      const server = String(item?.server || "server");
      if (server === "gzvm") {
        return {
          server,
          line: dashboardCopy(
            `reachable=${item?.reachable || "unknown"} · nginx=${item?.nginx_status || "unknown"} · cssos=${item?.cssos_status || "unknown"}`,
            `可达=${item?.reachable || "unknown"} · nginx=${item?.nginx_status || "unknown"} · cssos=${item?.cssos_status || "unknown"}`
          )
        };
      }
      return {
        server,
        line: dashboardCopy(
          `reachable=${item?.reachable || "unknown"}`,
          `可达=${item?.reachable || "unknown"}`
        )
      };
    });
  }

  global.buildWatchArchiveLinkStabilitySparklineBridge = buildWatchArchiveLinkStabilitySparklineBridge;
  global.buildWatchArchiveAlertThresholdCardsBridge = buildWatchArchiveAlertThresholdCardsBridge;
  global.buildWatchArchiveRouteComparisonMemoBridge = buildWatchArchiveRouteComparisonMemoBridge;
  global.buildWatchArchiveUptimeStripBridge = buildWatchArchiveUptimeStripBridge;
  global.buildWatchArchiveServerHealthCardBridge = buildWatchArchiveServerHealthCardBridge;
  global.buildWatchArchiveEndpointLatencyMemoBridge = buildWatchArchiveEndpointLatencyMemoBridge;
  global.buildWatchArchiveServiceStatusStripBridge = buildWatchArchiveServiceStatusStripBridge;
})(globalThis);
