(function attachWatchArchiveShiftHandoff(global) {
  const dashboardCopy = (...args) => global.dashboardCopy(...args);

  function buildWatchArchiveVerdictDeltaBridge(currentProbeSummary, timelineCompare) {
    const currentVerdict = String(currentProbeSummary?.conclusion?.verdict || "unknown");
    const compareVerdict = String(timelineCompare?.b?.verdict || timelineCompare?.a?.verdict || "unknown");
    const changed = currentVerdict !== compareVerdict;
    return {
      headline: changed
        ? dashboardCopy(
            `Current verdict changed from ${compareVerdict} to ${currentVerdict}.`,
            `当前结论已从 ${compareVerdict} 变化为 ${currentVerdict}。`
          )
        : dashboardCopy(
            `Current verdict still matches ${currentVerdict}.`,
            `当前结论仍然与 ${currentVerdict} 一致。`
          ),
      changed
    };
  }

  function buildWatchArchiveShiftCloseChecklistBridge(probeSummary, operatorNotes, handoffAcknowledgments) {
    const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
    const metadata = payload?.metadata || {};
    const gzvm = (Array.isArray(metadata?.servers) ? metadata.servers : []).find(
      (item) => String(item?.server || "") === "gzvm"
    );
    const verdict = String(payload?.conclusion?.verdict || "unknown");
    const notesReady = !!String(operatorNotes || "").trim();
    const ackReady = Array.isArray(handoffAcknowledgments) && handoffAcknowledgments.length > 0;
    const hostReady =
      String(gzvm?.nginx_status || "") === "active" && String(gzvm?.cssos_status || "") === "online";
    const checklist = [
      {
        label: dashboardCopy("Host services healthy", "主机服务健康"),
        state: hostReady ? dashboardCopy("ready", "就绪") : dashboardCopy("pending", "待完成")
      },
      {
        label: dashboardCopy("Operator notes captured", "值班备注已记录"),
        state: notesReady ? dashboardCopy("ready", "就绪") : dashboardCopy("pending", "待完成")
      },
      {
        label: dashboardCopy("At least one handoff acknowledgment", "至少一次接班确认"),
        state: ackReady ? dashboardCopy("ready", "就绪") : dashboardCopy("pending", "待完成")
      },
      {
        label: dashboardCopy("Verdict understood", "当前结论已确认"),
        state: verdict !== "unknown" ? dashboardCopy("ready", "就绪") : dashboardCopy("pending", "待完成")
      }
    ];
    const readyCount = checklist.filter((item) => item.state === dashboardCopy("ready", "就绪")).length;
    return {
      headline:
        readyCount === checklist.length
          ? dashboardCopy("Shift can close cleanly.", "这一班可以干净收口。")
          : dashboardCopy("Shift still has open handoff items.", "这一班仍有交接项未收口。"),
      checklist
    };
  }

  function buildWatchArchiveAckedHandoffLedgerBridge(handoffAcknowledgments) {
    const rows = Array.isArray(handoffAcknowledgments) ? handoffAcknowledgments : [];
    return {
      count: rows.length,
      rows: rows.slice(-8).reverse()
    };
  }

  function buildWatchArchiveVerdictDriftSparklineBridge(probeHistory) {
    const samples = Array.isArray(probeHistory) ? probeHistory : [];
    const verdicts = samples
      .slice(-16)
      .map((sample) => String(sample?.conclusion?.verdict || "unknown"));
    const sparkline = verdicts
      .map((verdict) => {
        if (verdict === "server_recovered") return "█";
        if (verdict === "cross_border_path_anomaly") return "▆";
        if (verdict === "server_side_degradation") return "▁";
        if (verdict === "mixed_or_unknown") return "▄";
        return "·";
      })
      .join("");
    let driftCount = 0;
    for (let i = 1; i < verdicts.length; i += 1) {
      if (verdicts[i] !== verdicts[i - 1]) driftCount += 1;
    }
    return {
      sparkline,
      driftCount,
      note: dashboardCopy(
        `${driftCount} verdict changes across the recent probe window.`,
        `最近探针窗口里共有 ${driftCount} 次结论变化。`
      )
    };
  }

  function buildWatchArchiveShiftRiskBadgeBridge(probeSummary, shiftCloseChecklist, verdictDriftSparkline) {
    const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
    const verdict = String(payload?.conclusion?.verdict || "unknown");
    const pendingCount = Array.isArray(shiftCloseChecklist?.checklist)
      ? shiftCloseChecklist.checklist.filter((item) => item.state !== dashboardCopy("ready", "就绪")).length
      : 0;
    const driftCount = Number(verdictDriftSparkline?.driftCount || 0);
    let badge = dashboardCopy("low", "低");
    if (verdict === "server_side_degradation" || pendingCount >= 2 || driftCount >= 3) {
      badge = dashboardCopy("high", "高");
    } else if (verdict === "cross_border_path_anomaly" || pendingCount >= 1 || driftCount >= 1) {
      badge = dashboardCopy("medium", "中");
    }
    return {
      badge,
      note: dashboardCopy(
        `Pending close items: ${pendingCount} · Verdict drift: ${driftCount}`,
        `待收口项：${pendingCount} · 结论漂移：${driftCount}`
      )
    };
  }

  function buildWatchArchiveHandoffCompletenessScoreBridge(operatorNotes, handoffAcknowledgments, exportReceipts) {
    let score = 0;
    if (String(operatorNotes || "").trim()) score += 35;
    if (Array.isArray(handoffAcknowledgments) && handoffAcknowledgments.length) score += 35;
    if (Array.isArray(exportReceipts) && exportReceipts.length) score += 30;
    return {
      score,
      note: dashboardCopy(
        `Notes + ack + export receipt drive this handoff completeness score.`,
        `备注、接班确认、导出回执共同决定交接完整度分数。`
      )
    };
  }

  function buildWatchArchiveVerdictStabilitySummaryBridge(probeHistory) {
    const samples = Array.isArray(probeHistory) ? probeHistory : [];
    const verdicts = samples
      .slice(-8)
      .map((sample) => String(sample?.conclusion?.verdict || "unknown"));
    if (!verdicts.length) {
      return {
        headline: dashboardCopy("No verdict stability summary yet.", "当前还没有结论稳定性摘要。"),
        note: ""
      };
    }
    const uniqueCount = new Set(verdicts).size;
    let headline = dashboardCopy("Verdict looks stable.", "结论看起来比较稳定。");
    if (uniqueCount >= 3) {
      headline = dashboardCopy("Verdict is shifting across multiple states.", "结论正在多个状态之间切换。");
    } else if (uniqueCount === 2) {
      headline = dashboardCopy("Verdict is moderately stable but still drifting.", "结论中等稳定，但仍有漂移。");
    }
    return {
      headline,
      note: dashboardCopy(
        `${uniqueCount} unique verdict states across the recent probe window.`,
        `最近探针窗口里出现了 ${uniqueCount} 种不同结论状态。`
      )
    };
  }

  function buildWatchArchiveShiftExitRecommendationBridge(shiftRiskBadge, shiftCloseChecklist) {
    const risk = String(shiftRiskBadge?.badge || "");
    const pendingCount = Array.isArray(shiftCloseChecklist?.checklist)
      ? shiftCloseChecklist.checklist.filter((item) => item.state !== dashboardCopy("ready", "就绪")).length
      : 0;
    let headline = dashboardCopy("Keep watching this shift a bit longer.", "这一班建议继续观察一会儿。");
    if (risk === dashboardCopy("low", "低") && pendingCount === 0) {
      headline = dashboardCopy("This shift can exit cleanly.", "这一班可以平稳收班。");
    } else if (risk === dashboardCopy("high", "高")) {
      headline = dashboardCopy("Do not exit yet. Keep the shift open and continue monitoring.", "现在不建议收班，继续值守观察。");
    }
    return {
      headline,
      note: dashboardCopy(
        `Risk=${risk || "unknown"} · Pending close items=${pendingCount}`,
        `风险=${risk || "未知"} · 待收口项=${pendingCount}`
      )
    };
  }

  function buildWatchArchiveHandoffQualityBadgeBridge(handoffCompletenessScore, handoffAcknowledgments) {
    const score = Number(handoffCompletenessScore?.score || 0);
    const ackCount = Array.isArray(handoffAcknowledgments) ? handoffAcknowledgments.length : 0;
    let badge = dashboardCopy("weak", "偏弱");
    if (score >= 85 && ackCount >= 1) badge = dashboardCopy("strong", "较强");
    else if (score >= 50) badge = dashboardCopy("fair", "一般");
    return {
      badge,
      note: dashboardCopy(
        `Completeness ${score}/100 with ${ackCount} acknowledgments.`,
        `完整度 ${score}/100，已有 ${ackCount} 次接班确认。`
      )
    };
  }

  function buildWatchArchiveVerdictConfidenceCardBridge(probeSummary, verdictStabilitySummary, verdictDriftSparkline) {
    const verdict = String(probeSummary?.conclusion?.verdict || "unknown");
    const driftCount = Number(verdictDriftSparkline?.driftCount || 0);
    const stable = String(verdictStabilitySummary?.headline || "").includes("stable") ||
      String(verdictStabilitySummary?.headline || "").includes("稳定");
    let confidence = dashboardCopy("medium", "中");
    if (verdict === "unknown" || driftCount >= 3) confidence = dashboardCopy("low", "低");
    else if (stable && driftCount === 0) confidence = dashboardCopy("high", "高");
    return {
      confidence,
      note: dashboardCopy(
        `Verdict=${verdict} · Drift count=${driftCount}`,
        `结论=${verdict} · 漂移次数=${driftCount}`
      )
    };
  }

  function buildWatchArchiveShiftBoardSnapshotBridge(
    probeSummary,
    shiftRiskBadge,
    shiftExitRecommendation,
    handoffQualityBadge,
    verdictConfidenceCard
  ) {
    const verdict = String(probeSummary?.conclusion?.verdict || "unknown");
    const capturedAt = String(probeSummary?.captured_at || probeSummary?.capturedAt || "");
    return {
      headline: dashboardCopy("Current shift board at a glance.", "当前这一班的一眼总览。"),
      rows: [
        dashboardCopy(`Verdict · ${verdict}`, `结论 · ${verdict}`),
        dashboardCopy(`Risk · ${shiftRiskBadge?.badge || "unknown"}`, `风险 · ${shiftRiskBadge?.badge || "未知"}`),
        dashboardCopy(
          `Exit recommendation · ${shiftExitRecommendation?.headline || dashboardCopy("pending", "待定")}`,
          `收班建议 · ${shiftExitRecommendation?.headline || dashboardCopy("待定", "待定")}`
        ),
        dashboardCopy(
          `Handoff quality · ${handoffQualityBadge?.badge || "unknown"}`,
          `交接质量 · ${handoffQualityBadge?.badge || "未知"}`
        ),
        dashboardCopy(
          `Confidence · ${verdictConfidenceCard?.confidence || dashboardCopy("unknown", "未知")}`,
          `把握度 · ${verdictConfidenceCard?.confidence || dashboardCopy("未知", "未知")}`
        ),
        capturedAt
          ? dashboardCopy(`Captured at ${capturedAt}`, `探测时间 ${capturedAt}`)
          : dashboardCopy("No capture timestamp yet.", "当前还没有探测时间。")
      ]
    };
  }

  function buildWatchArchiveHandoffReadinessBannerBridge(
    handoffCompletenessScore,
    handoffQualityBadge,
    shiftExitRecommendation
  ) {
    const score = Number(handoffCompletenessScore?.score || 0);
    const quality = String(handoffQualityBadge?.badge || "");
    const exitHeadline = String(shiftExitRecommendation?.headline || "");
    const exitReady =
      exitHeadline.includes("exit cleanly") ||
      exitHeadline.includes("平稳收班");
    let level = dashboardCopy("hold", "暂缓");
    let headline = dashboardCopy("Handoff is not ready to send yet.", "当前交接还不适合发出。");
    if (score >= 85 && quality === dashboardCopy("strong", "较强") && exitReady) {
      level = dashboardCopy("ready", "可发");
      headline = dashboardCopy("Handoff is ready to send.", "当前交接已经可以发出。");
    } else if (score >= 50) {
      level = dashboardCopy("almost", "接近可发");
      headline = dashboardCopy("Handoff is close, but still needs one more pass.", "交接已经接近可发，但还建议再过一遍。");
    }
    return {
      level,
      headline,
      note: dashboardCopy(
        `Completeness ${score}/100 · Quality ${quality || "unknown"}`,
        `完整度 ${score}/100 · 质量 ${quality || "未知"}`
      )
    };
  }

  function buildWatchArchiveConfidenceTrendStripBridge(probeHistory) {
    const samples = Array.isArray(probeHistory) ? probeHistory.slice(-8) : [];
    if (!samples.length) {
      return {
        strip: "",
        trend: dashboardCopy("unknown", "未知"),
        note: dashboardCopy("Confidence trend needs more probe history.", "把握度趋势还需要更多探针历史。")
      };
    }
    const levels = samples.map((sample) => {
      const verdict = String(sample?.conclusion?.verdict || "unknown");
      if (verdict === "unknown" || verdict === "mixed_or_unknown") return 1;
      if (verdict === "server_recovered") return 3;
      if (verdict === "cross_border_path_anomaly") return 2;
      return 1;
    });
    const strip = levels
      .map((value) => (value >= 3 ? "█" : value === 2 ? "▒" : "░"))
      .join("");
    const recent = levels.slice(-3);
    const older = levels.slice(0, Math.max(1, levels.length - 3));
    const recentAvg = recent.reduce((sum, value) => sum + value, 0) / recent.length;
    const olderAvg = older.reduce((sum, value) => sum + value, 0) / older.length;
    let trend = dashboardCopy("steady", "平稳");
    if (recentAvg + 0.25 < olderAvg) trend = dashboardCopy("worse", "转差");
    else if (recentAvg > olderAvg + 0.25) trend = dashboardCopy("better", "转好");
    return {
      strip,
      trend,
      note: dashboardCopy(
        `Recent confidence trend looks ${trend}.`,
        `最近把握度趋势看起来${trend}。`
      )
    };
  }

  function buildWatchArchiveShiftActionRailBridge(
    shiftRiskBadge,
    shiftExitRecommendation,
    crossBorderAnomalyAlert
  ) {
    const risk = String(shiftRiskBadge?.badge || "");
    const severeCrossBorder = String(crossBorderAnomalyAlert?.level || "") === dashboardCopy("alert", "告警");
    const exitHeadline = String(shiftExitRecommendation?.headline || "");
    const actions = [];
    if (risk === dashboardCopy("high", "高")) {
      actions.push(dashboardCopy("Keep this shift open and continue active monitoring.", "继续保持这一班开启，持续主动观察。"));
    }
    if (severeCrossBorder) {
      actions.push(dashboardCopy("Route investigation toward network path checks first.", "优先把排查路由到网络链路检查。"));
    }
    if (exitHeadline.includes("exit cleanly") || exitHeadline.includes("平稳收班")) {
      actions.push(dashboardCopy("Prepare the handoff package and close the shift in order.", "准备交接包，并按顺序完成收班。"));
    }
    if (!actions.length) {
      actions.push(dashboardCopy("Refresh probes, confirm the latest sample, then decide whether to hand off.", "刷新探针，确认最新样本后，再决定是否交接。"));
    }
    return {
      headline: dashboardCopy("Next actions for this shift.", "这一班接下来该做的动作。"),
      actions: actions.slice(0, 3)
    };
  }

  function buildWatchArchiveHandoffSendGateBridge(handoffReadinessBanner, shiftCloseChecklist) {
    const level = String(handoffReadinessBanner?.level || "");
    const pendingCount = Array.isArray(shiftCloseChecklist?.checklist)
      ? shiftCloseChecklist.checklist.filter((item) => item.state !== dashboardCopy("ready", "就绪")).length
      : 0;
    let status = dashboardCopy("blocked", "阻塞");
    let note = dashboardCopy("Do not send the handoff yet.", "现在还不建议发出交接。");
    if (level === dashboardCopy("ready", "可发") && pendingCount === 0) {
      status = dashboardCopy("open", "已开闸");
      note = dashboardCopy("Handoff can be sent now.", "当前交接现在可以发出。");
    } else if (level === dashboardCopy("almost", "接近可发")) {
      status = dashboardCopy("review", "待复核");
      note = dashboardCopy("One more review pass is recommended before sending.", "建议再做一遍复核后再发出。");
    }
    return {
      status,
      note,
      detail: dashboardCopy(
        `Pending close items=${pendingCount} · Readiness=${level || "unknown"}`,
        `待收口项=${pendingCount} · 就绪度=${level || "未知"}`
      )
    };
  }

  function buildWatchArchiveConfidenceFallbackHintsBridge(
    verdictConfidenceCard,
    crossBorderAnomalyAlert,
    routeComparisonMemo
  ) {
    const confidence = String(verdictConfidenceCard?.confidence || "");
    const severeCrossBorder = String(crossBorderAnomalyAlert?.level || "") === dashboardCopy("alert", "告警");
    const hints = [];
    if (confidence === dashboardCopy("low", "低")) {
      hints.push(dashboardCopy("Use the most conservative wording in handoff notes.", "在交接备注里使用最保守的结论表述。"));
      hints.push(dashboardCopy("Avoid strong server-down claims unless gzvm public also fails.", "除非 gzvm 公网也失败，否则不要下很重的服务器宕机结论。"));
    } else if (confidence === dashboardCopy("medium", "中")) {
      hints.push(dashboardCopy("Keep the current conclusion, but call out remaining uncertainty.", "可以保留当前结论，但要明确剩余不确定性。"));
    } else {
      hints.push(dashboardCopy("Current verdict confidence is good enough for a normal handoff summary.", "当前结论把握度足够支撑常规交接摘要。"));
    }
    if (severeCrossBorder) {
      hints.push(dashboardCopy("Prefer path-level language over host-level blame.", "优先使用链路级表述，不要先归因到主机本身。"));
    }
    if (routeComparisonMemo?.headline) {
      hints.push(dashboardCopy(`Route memo: ${routeComparisonMemo.headline}`, `链路备忘：${routeComparisonMemo.headline}`));
    }
    return {
      headline: dashboardCopy("Fallback hints when confidence is lower.", "把握度较低时的保守处理提示。"),
      hints: hints.slice(0, 4)
    };
  }

  global.buildWatchArchiveVerdictDeltaBridge = buildWatchArchiveVerdictDeltaBridge;
  global.buildWatchArchiveShiftCloseChecklistBridge = buildWatchArchiveShiftCloseChecklistBridge;
  global.buildWatchArchiveAckedHandoffLedgerBridge = buildWatchArchiveAckedHandoffLedgerBridge;
  global.buildWatchArchiveVerdictDriftSparklineBridge = buildWatchArchiveVerdictDriftSparklineBridge;
  global.buildWatchArchiveShiftRiskBadgeBridge = buildWatchArchiveShiftRiskBadgeBridge;
  global.buildWatchArchiveHandoffCompletenessScoreBridge = buildWatchArchiveHandoffCompletenessScoreBridge;
  global.buildWatchArchiveVerdictStabilitySummaryBridge = buildWatchArchiveVerdictStabilitySummaryBridge;
  global.buildWatchArchiveShiftExitRecommendationBridge = buildWatchArchiveShiftExitRecommendationBridge;
  global.buildWatchArchiveHandoffQualityBadgeBridge = buildWatchArchiveHandoffQualityBadgeBridge;
  global.buildWatchArchiveVerdictConfidenceCardBridge = buildWatchArchiveVerdictConfidenceCardBridge;
  global.buildWatchArchiveShiftBoardSnapshotBridge = buildWatchArchiveShiftBoardSnapshotBridge;
  global.buildWatchArchiveHandoffReadinessBannerBridge = buildWatchArchiveHandoffReadinessBannerBridge;
  global.buildWatchArchiveConfidenceTrendStripBridge = buildWatchArchiveConfidenceTrendStripBridge;
  global.buildWatchArchiveShiftActionRailBridge = buildWatchArchiveShiftActionRailBridge;
  global.buildWatchArchiveHandoffSendGateBridge = buildWatchArchiveHandoffSendGateBridge;
  global.buildWatchArchiveConfidenceFallbackHintsBridge = buildWatchArchiveConfidenceFallbackHintsBridge;
})(globalThis);
