function renderMusicDeliveryDashboardRewriteBridge(input = {}) {
  const sections = Array.isArray(input.sections) ? input.sections : [];
  const compareA = input.compareA || null;
  const compareB = input.compareB || null;
  const arrangementItem = input.arrangementItem || null;
  const selectedSection = input.selectedSection || null;
  const sectionPhrases = Array.isArray(input.sectionPhrases) ? input.sectionPhrases : [];
  const activeRewriteMode = String(input.activeRewriteMode || "mutation");
  const providerReadyRewritePayload = input.providerReadyRewritePayload || {};
  const cueSheetPatchPlan = input.cueSheetPatchPlan || {};
  const cuePatchPlan = input.cuePatchPlan || {};
  const rewritePayloadMode = String(input.rewritePayloadMode || "provider");
  const comparePhraseA = input.comparePhraseA || null;
  const comparePhraseB = input.comparePhraseB || null;

  const compareOptionsHtml = sections
    .map(
      (section) =>
        `<option value="${escapeHtml(section.id)}">${escapeHtml(`${section.label} · ${section.startSec.toFixed(1)}s`)}</option>`
    )
    .join("");

  const comparePanelHtml = sections.length
    ? `
        <div class="report-list-item">
          <div class="report-preview-title">A/B Compare</div>
          <div class="report-card-copy">${escapeHtml(
            dashboardCopy("Jump between two sections to compare their arrangement, density, and orchestration.", "在两个段落之间快速切换，对比它们的编排、密度和配器。")
          )}</div>
          <div class="report-export-actions" style="flex-wrap:wrap;">
            <label class="report-card-copy" style="display:flex;align-items:center;gap:8px;">
              A
              <select class="billing-input" data-delivery-compare-select="A">${compareOptionsHtml}</select>
            </label>
            <button class="report-export-action" type="button" data-delivery-compare-play="A" ${
              compareA && deliveryDashboardState.mixerReady ? "" : "disabled"
            }>Play A</button>
            <label class="report-card-copy" style="display:flex;align-items:center;gap:8px;">
              B
              <select class="billing-input" data-delivery-compare-select="B">${compareOptionsHtml}</select>
            </label>
            <button class="report-export-action" type="button" data-delivery-compare-play="B" ${
              compareB && deliveryDashboardState.mixerReady ? "" : "disabled"
            }>Play B</button>
          </div>
        </div>
      `
    : "";

  let arrangementSummary = dashboardCopy(
    "Load the arrangement timeline to navigate sections instead of auditioning only the full song.",
    "载入编排时间轴后，就可以不只试听整首，而是直接按段落导航。"
  );
  if (!arrangementItem) {
    arrangementSummary = dashboardCopy(
      "This run does not have a cue sheet artifact yet.",
      "这个运行当前还没有 cue sheet 产物。"
    );
  } else if (deliveryDashboardState.arrangementLoading) {
    arrangementSummary = dashboardCopy(
      "Loading cue sheet and phrase-level section map...",
      "正在加载 cue sheet 和段落级映射..."
    );
  } else if (deliveryDashboardState.arrangementError) {
    arrangementSummary = deliveryDashboardState.arrangementError;
  } else if (sections.length) {
    arrangementSummary = dashboardCopy(
      `Timeline ready with ${sections.length} sections. Selected: ${selectedSection?.label || "none"}`,
      `时间轴已就绪，共 ${sections.length} 个段落。当前选中：${selectedSection?.label || "无"}`
    );
  }
  if (deliveryDashboardState.rewriteSandboxActive) {
    arrangementSummary = dashboardCopy(
      `Rewrite sandbox active. ${deliveryDashboardState.rewriteSandboxSummary || "Patched arrangement preview is driving the timeline."}`,
      `改写沙盒已激活。${deliveryDashboardState.rewriteSandboxSummary || "当前时间轴由改写后的临时副本驱动。"}`
    );
  }
  if (deliveryDashboardState.rewriteMixLane === "rewritten" && deliveryDashboardState.rewriteSandboxData) {
    arrangementSummary = dashboardCopy(
      `Rewritten lane selected. ${deliveryDashboardState.rewriteSandboxSummary || "Patched arrangement preview is ready."}`,
      `当前正在查看改写版车道。${deliveryDashboardState.rewriteSandboxSummary || "改写后的临时编排已经就绪。"}`
    );
  }

  const rewritePatchBundle = buildRewritePatchBundle({
    mode: activeRewriteMode,
    providerPayload: providerReadyRewritePayload,
    cuePatchPlan,
    selectedSection,
    comparePhraseA,
    comparePhraseB
  });
  const rewritePayloadJson =
    rewritePayloadMode === "cue"
      ? JSON.stringify(cueSheetPatchPlan, null, 2)
      : JSON.stringify(providerReadyRewritePayload, null, 2);

  const rewritePayloadHtml = sectionPhrases.length
    ? `
        <div class="report-list-item">
          <div class="report-preview-title">Structured Rewrite Payload</div>
          <div class="report-card-copy">${escapeHtml(
            dashboardCopy(
              "This layer converts rewrite drafts into provider ops and synchronized cue-sheet patch instructions.",
              "这一层会把改写草稿转换成 provider 操作和同步的 cue-sheet 补丁指令。"
            )
          )}</div>
          <div class="report-export-actions" style="flex-wrap:wrap;">
            <button class="report-export-action ${rewritePayloadMode === "provider" ? "" : "is-muted"}" type="button" data-delivery-rewrite-payload-mode="provider">Provider Payload</button>
            <button class="report-export-action ${rewritePayloadMode === "cue" ? "" : "is-muted"}" type="button" data-delivery-rewrite-payload-mode="cue">Cue Patch Plan</button>
          </div>
          <div class="report-list" style="margin-top:8px;">
            <div class="report-list-item">
              <div class="report-preview-title">${escapeHtml(
                rewritePayloadMode === "cue" ? "cue-sheet / midi / phrase-map patch plan" : "provider-ready rewrite payload"
              )}</div>
              <div class="report-card-copy">${escapeHtml(
                rewritePayloadMode === "cue"
                  ? dashboardCopy(
                      "Targets cue sheet, MIDI draft, and phrase map together so later application can stay synchronized.",
                      "同时作用于 cue sheet、MIDI 草稿和 phrase map，方便后续统一应用。"
                    )
                  : dashboardCopy(
                      "Targets provider execution as a unified rewrite op list with source phrases, patch summaries, and step instructions.",
                      "面向 provider 执行链，统一输出带 source phrase、补丁摘要和步骤的 rewrite op 列表。"
                    )
              )}</div>
            </div>
            <div class="report-list-item">
              <pre class="report-preview-code">${escapeHtml(rewritePayloadJson)}</pre>
            </div>
          </div>
        </div>
      `
    : `<div class="report-empty">${escapeHtml(
        dashboardCopy(
          "Structured rewrite payloads will appear after phrase comparison data is ready.",
          "phrase 对比数据就绪后，这里会生成结构化改写指令。"
        )
      )}</div>`;

  const sandboxPatchedPhrases = sectionPhrases.filter((phrase) => phrase.isSandboxPatched);
  const rewriteSandboxHtml = sectionPhrases.length
    ? `
        <div class="report-list-item">
          <div class="report-preview-title">Patched Arrangement Preview</div>
          <div class="report-card-copy">${escapeHtml(
            deliveryDashboardState.rewriteSandboxActive
              ? dashboardCopy(
                  `Sandbox is active for ${selectedSection?.label || "this section"} with ${sandboxPatchedPhrases.length} patched phrase${sandboxPatchedPhrases.length === 1 ? "" : "s"}.`,
                  `沙盒已作用于 ${selectedSection?.label || "当前段落"}，共影响 ${sandboxPatchedPhrases.length} 个 phrase。`
                )
              : dashboardCopy(
                  "Apply the rewrite sandbox to route the current rewrite payload into a temporary arrangement copy.",
                  "应用改写沙盒后，当前 rewrite payload 会被写入一个临时编排副本。"
                )
          )}</div>
          <div class="report-export-actions" style="flex-wrap:wrap;">
            <button class="report-export-action" type="button" data-delivery-rewrite-sandbox-apply="${escapeHtml(activeRewriteMode)}">Apply Sandbox</button>
            <button class="report-export-action ${deliveryDashboardState.rewriteMixLane === "original" ? "" : "is-muted"}" type="button" data-delivery-rewrite-lane="original">Original Lane</button>
            <button class="report-export-action ${deliveryDashboardState.rewriteMixLane === "rewritten" ? "" : "is-muted"}" type="button" data-delivery-rewrite-lane="rewritten" ${
              deliveryDashboardState.rewriteSandboxData ? "" : "disabled"
            }>Rewritten Lane</button>
            <button class="report-export-action ${deliveryDashboardState.rewriteSandboxActive ? "" : "is-muted"}" type="button" data-delivery-rewrite-sandbox-preview="${escapeHtml(selectedSection?.id || "")}" ${
              deliveryDashboardState.mixerReady && selectedSection ? "" : "disabled"
            }>Preview Patched Section</button>
            <button class="report-export-action is-muted" type="button" data-delivery-rewrite-sandbox-clear ${
              deliveryDashboardState.rewriteSandboxActive ? "" : "disabled"
            }>Clear Sandbox</button>
          </div>
          <div class="report-list" style="margin-top:8px;">
            ${
              sandboxPatchedPhrases.length
                ? sandboxPatchedPhrases
                    .map(
                      (phrase) => `
                        <div class="report-list-item">
                          <div class="report-preview-title">${escapeHtml(phrase.id)}</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${phrase.role} · ${phrase.chordSlot || "free"} · ${phrase.articulation || "adaptive"}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            phrase.patchSummary || phrase.sandboxPatchKind || "sandbox patch"
                          )}</div>
                        </div>
                      `
                    )
                    .join("")
                : `<div class="report-empty">${escapeHtml(
                    dashboardCopy(
                      "No patched phrase preview yet. Apply the sandbox to generate a temporary rewritten arrangement.",
                      "当前还没有 patched phrase 预览。应用沙盒后会生成临时改写编排。"
                    )
                  )}</div>`
            }
          </div>
        </div>
      `
    : `<div class="report-empty">${escapeHtml(
        dashboardCopy(
          "Patched arrangement preview appears once phrase comparison data is available.",
          "phrase 对比数据就绪后，这里会出现改写后的临时编排预览。"
        )
      )}</div>`;

  return {
    comparePanelHtml,
    arrangementSummary,
    rewritePatchBundle,
    rewritePayloadHtml,
    rewriteSandboxHtml
  };
}

window.renderMusicDeliveryDashboardRewriteBridge = renderMusicDeliveryDashboardRewriteBridge;
