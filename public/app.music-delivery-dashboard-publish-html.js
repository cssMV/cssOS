function buildMusicDeliveryDashboardPatchBundleHtmlModule(ctx = {}) {
  const {
    sectionPhrases = [],
    dashboardCopy,
    escapeHtml,
    JSON: JsonCtor = JSON,
    rewriteBundleHistoryHtml = "",
    rewritePatchBundle,
    patchBundleJson = "",
    deliveryDashboardState = {},
    rewriteBundleDiffs = [],
    focusedDiff = null,
    rewritePromotions = [],
    formatFileBytes,
    buildDeliveryArtifactOpenControl,
    buildRewritePromotionArtifactItem,
    buildRunArtifactOpenControl
  } = ctx;
  if (!sectionPhrases.length) return "";
  return `
        <div class="report-list-item">
          <div class="report-preview-title">Commit Rewrite Patch Bundle</div>
          <div class="report-card-copy">${escapeHtml(
            dashboardCopy(
              "Export the currently selected sandbox rewrite as a reusable patch bundle for later save/apply flows.",
              "把当前选中的沙盒改写导出成可复用的 patch bundle，供后续保存和应用。"
            )
          )}</div>
          <div class="report-export-actions" style="flex-wrap:wrap;">
            <button class="report-export-action" type="button" data-delivery-rewrite-bundle-commit='${escapeHtml(JsonCtor.stringify(rewritePatchBundle))}'>Commit Current Bundle</button>
            <input class="billing-input" type="text" placeholder="Version Name" value="${escapeHtml(
              deliveryDashboardState.rewritePatchBundleVersionName || ""
            )}" data-delivery-rewrite-bundle-version />
            <button class="report-export-action ${deliveryDashboardState.rewritePatchBundleSaving ? "is-muted" : ""}" type="button" data-delivery-rewrite-bundle-save='${escapeHtml(
              JsonCtor.stringify(deliveryDashboardState.rewritePatchBundle || rewritePatchBundle)
            )}' ${deliveryDashboardState.runId && !deliveryDashboardState.rewritePatchBundleSaving ? "" : "disabled"}>${
              deliveryDashboardState.rewritePatchBundleSaving ? "Saving..." : "Save To Run"
            }</button>
          </div>
          <div class="report-list" style="margin-top:8px;">
            <div class="report-list-item">
              <div class="report-preview-title">${escapeHtml(
                deliveryDashboardState.rewritePatchBundle
                  ? "Committed Patch Bundle"
                  : "Pending Patch Bundle"
              )}</div>
              <div class="report-card-copy">${escapeHtml(
                deliveryDashboardState.rewritePatchBundle
                  ? dashboardCopy("This bundle has been frozen from the current sandbox selection.", "这个 bundle 已经从当前沙盒选择冻结下来。")
                  : dashboardCopy("Commit the current rewrite to freeze it as a reusable patch bundle.", "提交当前改写后，就会冻结成一个可复用的 patch bundle。")
              )}</div>
            </div>
            <div class="report-list-item">
              <pre class="report-preview-code">${escapeHtml(patchBundleJson)}</pre>
            </div>
            ${
              deliveryDashboardState.rewritePatchBundleError
                ? `<div class="report-list-item"><div class="report-card-copy">${escapeHtml(deliveryDashboardState.rewritePatchBundleError)}</div></div>`
                : ""
            }
            ${
              deliveryDashboardState.rewritePromotionError
                ? `<div class="report-list-item"><div class="report-card-copy">${escapeHtml(deliveryDashboardState.rewritePromotionError)}</div></div>`
                : ""
            }
            <div class="report-list-item">
              <div class="report-preview-title">Patch Bundle History</div>
              <div class="report-card-copy">${escapeHtml(
                dashboardCopy(
                  "Saved bundles are persisted as run-level rewrite artifacts and can be restored back into the current sandbox.",
                  "保存后的 bundle 会成为 run 级 rewrite 资产，并可以恢复回当前沙盒。"
                )
              )}</div>
            </div>
            ${rewriteBundleHistoryHtml}
            <div class="report-list-item">
              <div class="report-preview-title">Patch History Diff</div>
              <div class="report-card-copy">${escapeHtml(
                dashboardCopy(
                  "Compare adjacent saved bundle versions before promoting one into the provider execution lane.",
                  "在将某个版本正式下发到 provider 执行链之前，先对比相邻 bundle 版本差异。"
                )
              )}</div>
              <div class="report-export-actions" style="flex-wrap:wrap;">
                ${rewriteBundleDiffs
                  .map(
                    (diff) => `<button class="report-export-action ${
                      deliveryDashboardState.rewriteBundleDiffFocus === `${diff.from_bundle_id}->${diff.to_bundle_id}` ? "" : "is-muted"
                    }" type="button" data-delivery-rewrite-diff-focus="${escapeHtml(
                      `${diff.from_bundle_id}->${diff.to_bundle_id}`
                    )}">${escapeHtml(`${diff.from_version_name} -> ${diff.to_version_name}`)}</button>`
                  )
                  .join("") || `<span class="report-card-copy">${escapeHtml(
                    dashboardCopy("Need at least two saved bundles to compare diff.", "至少需要两个已保存 bundle 才能比较 diff。")
                  )}</span>`}
              </div>
            </div>
            ${
              focusedDiff
                ? `<div class="report-list-item">
                    <pre class="report-preview-code">${escapeHtml(JsonCtor.stringify(focusedDiff, null, 2))}</pre>
                  </div>`
                : ""
            }
            <div class="report-list-item">
              <div class="report-preview-title">Provider Promotion History</div>
              <div class="report-card-copy">${escapeHtml(
                dashboardCopy(
                  "Promoted rewrite bundles are tracked as provider-job handoff artifacts.",
                  "已提升的 rewrite bundle 会作为 provider job 交接资产持续记录。"
                )
              )}</div>
            </div>
            ${
              rewritePromotions.length
                ? rewritePromotions
                    .map(
                      (entry) => `<div class="report-list-item">
                          <div class="report-preview-title">${escapeHtml(entry.version_name || entry.bundle_id || "promotion")}</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${entry.promoted_at || "promoted"} · ${entry.bundle_id || ""}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            `Status: ${entry.job_status?.status || entry.payload?.status || "queued"} · Job: ${entry.job_status?.job_id || "pending"}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            `Apply-back: ${entry.apply_back_result?.status || "pending_apply_back"}`
                          )}</div>
                          <div class="report-export-actions" style="flex-wrap:wrap;">
                            ${
                              entry.execution_queue_path
                                ? buildRunArtifactOpenControl(
                                    deliveryDashboardState.runId || "",
                                    entry.execution_queue_path,
                                    "Open Queue",
                                    { assetKey: entry.execution_queue_asset_key || "" }
                                  )
                                : ""
                            }
                            ${
                              entry.job_status_path
                                ? buildRunArtifactOpenControl(
                                    deliveryDashboardState.runId || "",
                                    entry.job_status_path,
                                    "Open Job Status",
                                    { assetKey: entry.job_status_asset_key || "" }
                                  )
                                : ""
                            }
                            ${
                              entry.apply_back_result_path
                                ? buildRunArtifactOpenControl(
                                    deliveryDashboardState.runId || "",
                                    entry.apply_back_result_path,
                                    "Open Apply-Back",
                                    { assetKey: entry.apply_back_result_asset_key || "" }
                                  )
                                : ""
                            }
                            ${buildDeliveryArtifactOpenControl(
                              deliveryDashboardState.runId || "",
                              buildRewritePromotionArtifactItem(entry),
                              "Open Promotion JSON"
                            )}
                          </div>
                        </div>`
                    )
                    .join("")
                : `<div class="report-empty">${escapeHtml(
                    dashboardCopy("No provider promotion has been recorded yet.", "当前还没有记录任何 provider promotion。")
                  )}</div>`
            }
          </div>
        </div>
      `;
}

function buildMusicDeliveryDashboardPublishLaneHtmlModule(ctx = {}) {
  const {
    dashboardCopy,
    escapeHtml,
    JSON: JsonCtor = JSON,
    deliveryDashboardState = {},
    releaseCandidateInputValue = "",
    focusedRevision,
    publishButtonEnabled = false,
    blockedPublishExplainer,
    approvalToPublishTrace,
    complianceLockedPublishGate,
    complianceReleaseUnblockToken,
    complianceImmutablePublishAuthorization,
    blockerSpecificCopy = "",
    missingSignerRoles = [],
    readinessChecklist = [],
    suggestedRole = "",
    suggestedActor = null,
    currentActor = null,
    routingShortcuts = [],
    guidedPlaybook = [],
    publishSimulation,
    publishOutcomeEstimator,
    approvalSlaForecast,
    releaseRiskBanner,
    requiresPublishAcknowledgment = false,
    postPublishWatchlist = [],
    liveWatchSession,
    timedFollowupPrompt = "",
    anomalyCheckpoints = [],
    rollbackRecommendationLane,
    watchReport,
    watchHandoffSummary,
    incidentReplayBundle
  } = ctx;
  return `
            <div class="report-list-item">
              <div class="report-preview-title">Release Candidate Lane</div>
              <div class="report-card-copy">${escapeHtml(
                dashboardCopy(
                  "Name a release candidate, lock the chosen revision, then publish that locked arrangement as the formal handoff version.",
                  "先给候选版本命名，再锁定选中的 revision，最后把这个已锁定编排作为正式交付版本发布。"
                )
              )}</div>
              <div class="report-export-actions" style="flex-wrap:wrap;">
                <input class="billing-input" type="text" placeholder="Release Candidate Name" value="${escapeHtml(
                  releaseCandidateInputValue
                )}" data-delivery-arrangement-candidate-name />
                <button class="report-export-action ${deliveryDashboardState.arrangementRevisionActionSaving ? "is-muted" : ""}" type="button" data-delivery-arrangement-release-candidate="${escapeHtml(
                  focusedRevision?.revision_id || ""
                )}" ${focusedRevision && !deliveryDashboardState.arrangementRevisionActionSaving ? "" : "disabled"}>Nominate RC</button>
                <button class="report-export-action ${deliveryDashboardState.arrangementRevisionActionSaving ? "is-muted" : ""}" type="button" data-delivery-arrangement-lock="${escapeHtml(
                  focusedRevision?.revision_id || ""
                )}" ${focusedRevision && !deliveryDashboardState.arrangementRevisionActionSaving ? "" : "disabled"}>Lock Revision</button>
                <button class="report-export-action ${publishButtonEnabled ? "" : "is-muted"}" type="button" data-delivery-arrangement-publish="${escapeHtml(
                  focusedRevision?.revision_id || ""
                )}" ${publishButtonEnabled ? "" : "disabled"}>Publish Chosen Revision</button>
              </div>
              <div class="report-list" style="margin-top:8px;">
                <div class="report-list-item">
                  <div class="report-preview-title">Publish-Time Enforcement</div>
                  <div class="report-card-copy">${escapeHtml(
                    blockedPublishExplainer?.blocked
                      ? formatBlockedPublishMessage(blockedPublishExplainer, approvalToPublishTrace)
                      : dashboardCopy(
                          "Publish is clear to proceed once you choose the locked revision.",
                          "当前发布门禁已放行，选择锁定 revision 后即可发布。"
                        )
                  )}</div>
                  <div class="report-card-copy">${escapeHtml(
                    `gate=${String(complianceLockedPublishGate?.gate_state || "missing")} · token=${String(
                      complianceReleaseUnblockToken?.status || "missing"
                    )} · authorization=${String(
                      complianceImmutablePublishAuthorization?.authorization_state || "missing"
                    )}`
                  )}</div>
                  ${
                    Array.isArray(blockedPublishExplainer?.missing_steps) &&
                    blockedPublishExplainer.missing_steps.length
                      ? `<div class="report-card-copy">${escapeHtml(
                          `${dashboardCopy("Missing steps", "缺失环节")}: ${blockedPublishExplainer.missing_steps.join(", ")}`
                        )}</div>`
                      : ""
                  }
                  <div class="report-card-copy">${escapeHtml(blockerSpecificCopy)}</div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Approval To Publish Trace</div>
                  <div class="report-card-copy">${escapeHtml(
                    approvalToPublishTrace?.last_approver
                      ? dashboardCopy(
                          `Last approver: ${String(
                            approvalToPublishTrace.last_approver.actor_name ||
                              approvalToPublishTrace.last_approver.actor_id ||
                              "unknown"
                          )} (${String(approvalToPublishTrace.last_approver.actor_role || "unknown")})`,
                          `最后放行人：${String(
                            approvalToPublishTrace.last_approver.actor_name ||
                              approvalToPublishTrace.last_approver.actor_id ||
                              "unknown"
                          )}（${String(approvalToPublishTrace.last_approver.actor_role || "unknown")}）`
                        )
                      : dashboardCopy(
                          "No approver has signed this publish path yet.",
                          "这条发布路径目前还没有审批人签发。"
                        )
                  )}</div>
                  <div class="report-card-copy">${escapeHtml(
                    approvalToPublishTrace
                      ? `quorum=${approvalToPublishTrace.quorum_met ? "met" : "pending"} · required=${Array.isArray(
                          approvalToPublishTrace.required_signers
                        ) ? approvalToPublishTrace.required_signers.join(", ") : "n/a"}`
                      : "quorum=pending"
                  )}</div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">One-Click Missing-Step Actions</div>
                  <div class="report-card-copy">${escapeHtml(
                    blockedPublishExplainer?.blocked
                      ? dashboardCopy(
                          "Use these shortcuts to close the missing publish steps without leaving this lane.",
                          "这些快捷动作可以直接在当前面板里补齐缺失的发布步骤。"
                        )
                      : dashboardCopy(
                          "No missing publish step is open right now.",
                          "当前没有待补齐的发布步骤。"
                        )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action ${deliveryDashboardState.arrangementRevisionActionSaving ? "is-muted" : ""}" type="button" data-delivery-publish-step-approve ${
                      deliveryDashboardState.arrangementRevisionActionSaving ? "disabled" : ""
                    }>${escapeHtml(dashboardCopy("Approve As Current Actor", "以当前身份签发"))}</button>
                    <button class="report-export-action ${deliveryDashboardState.arrangementRevisionActionSaving ? "is-muted" : ""}" type="button" data-delivery-publish-step-finalize ${
                      deliveryDashboardState.arrangementRevisionActionSaving ? "disabled" : ""
                    }>${escapeHtml(dashboardCopy("Finalize Publish Gate", "完成发布门禁检查"))}</button>
                    <button class="report-export-action ${missingSignerRoles.length ? "" : "is-muted"}" type="button" data-delivery-publish-step-remind="${escapeHtml(
                      missingSignerRoles.join(",")
                    )}" ${missingSignerRoles.length ? "" : "disabled"}>${escapeHtml(
                      dashboardCopy("Send Signer Reminder", "发送签发提醒")
                    )}</button>
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Signer Reminder</div>
                  <div class="report-card-copy">${escapeHtml(
                    missingSignerRoles.length
                      ? dashboardCopy(
                          `Waiting on signer roles: ${missingSignerRoles.join(", ")}.`,
                          `仍在等待这些签发角色：${missingSignerRoles.join("、")}。`
                        )
                      : dashboardCopy(
                          "All required signer roles have already approved.",
                          "所有必需签发角色都已完成审批。"
                        )
                  )}</div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Release Readiness Checklist</div>
                  <div class="report-list" style="margin-top:8px;">
                    ${readinessChecklist
                      .map(
                        (item) => `<div class="report-list-item">
                            <div class="report-preview-title">${escapeHtml(
                              `${item.ready ? "READY" : "PENDING"} · ${item.label}`
                            )}</div>
                          </div>`
                      )
                      .join("")}
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Auto-Suggest Actor</div>
                  <div class="report-card-copy">${escapeHtml(
                    suggestedRole
                      ? dashboardCopy(
                          `Next best signer is ${suggestedRole}${suggestedActor ? ` via ${suggestedActor.actor_name || suggestedActor.actor_id}` : ""}.`,
                          `下一位最合适的签发角色是 ${suggestedRole}${suggestedActor ? `，建议人：${suggestedActor.actor_name || suggestedActor.actor_id}` : ""}。`
                        )
                      : dashboardCopy(
                          "No actor switch is needed. The current actor can continue.",
                          "当前不需要切换签发人，现有身份可以继续。"
                        )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    ${
                      suggestedActor
                        ? `<button class="report-export-action" type="button" data-delivery-publish-actor-suggest='${escapeHtml(
                            JsonCtor.stringify(suggestedActor)
                          )}'>${escapeHtml(
                            dashboardCopy("Use Suggested Actor", "使用建议签发人")
                          )}</button>`
                        : ""
                    }
                    ${
                      currentActor?.actor_role
                        ? `<span class="report-card-copy">${escapeHtml(
                            dashboardCopy(
                              `Current actor: ${currentActor.actor_name || currentActor.actor_id} (${currentActor.actor_role})`,
                              `当前身份：${currentActor.actor_name || currentActor.actor_id}（${currentActor.actor_role}）`
                            )
                          )}</span>`
                        : ""
                    }
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Signer Routing Shortcuts</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    ${
                      routingShortcuts.length
                        ? routingShortcuts
                            .map(
                              (route) => `<button class="report-export-action" type="button" data-delivery-publish-route-shortcut='${escapeHtml(
                                JsonCtor.stringify(route)
                              )}'>${escapeHtml(
                                `${route.label} -> ${route.requiredRole || "role"}${route.actor ? ` (${route.actor.actor_name || route.actor.actor_id})` : ""}`
                              )}</button>`
                            )
                            .join("")
                        : `<span class="report-card-copy">${escapeHtml(
                            dashboardCopy("No routing shortcut is configured yet.", "当前还没有配置签发路由快捷键。")
                          )}</span>`
                    }
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Guided Publish Playbook</div>
                  <div class="report-card-copy">${escapeHtml(
                    deliveryDashboardState.publishRunbookStatus ||
                      dashboardCopy(
                        "Run the guided runbook to take the shortest recovery path, then review the checklist again.",
                        "运行引导式 runbook 后，系统会走最短补救路径，再回来复核清单。"
                      )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action ${deliveryDashboardState.arrangementRevisionActionSaving ? "is-muted" : ""}" type="button" data-delivery-publish-runbook-automation ${
                      deliveryDashboardState.arrangementRevisionActionSaving ? "disabled" : ""
                    }>${escapeHtml(dashboardCopy("Run Shortest-Path Runbook", "执行最短路径 runbook"))}</button>
                  </div>
                  <div class="report-list" style="margin-top:8px;">
                    ${guidedPlaybook
                      .map(
                        (step, index) => `<div class="report-list-item">
                            <div class="report-preview-title">${escapeHtml(
                              `${step.done ? "DONE" : "NEXT"} · ${index + 1}. ${step.label}`
                            )}</div>
                            <div class="report-card-copy">${escapeHtml(step.detail)}</div>
                          </div>`
                      )
                      .join("")}
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Publish Simulation Dry-Run</div>
                  <div class="report-card-copy">${escapeHtml(deliveryDashboardState.publishSimulationSummary || "")}</div>
                  <div class="report-card-copy">${escapeHtml(
                    publishSimulation.ready
                      ? dashboardCopy(
                          "Dry-run result: publish would pass the current gate checks.",
                          "模拟结果：当前发布可以通过门禁检查。"
                        )
                      : dashboardCopy(
                          "Dry-run result: publish would still be blocked right now.",
                          "模拟结果：当前发布仍会被门禁拦住。"
                        )
                  )}</div>
                  <div class="report-card-copy">${escapeHtml(
                    publishSimulation.next_actions.length
                      ? publishSimulation.next_actions.join(" ")
                      : dashboardCopy(
                          "No additional recovery step is suggested right now.",
                          "当前没有额外建议的补救步骤。"
                        )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action" type="button" data-delivery-publish-simulate="${escapeHtml(
                      JsonCtor.stringify(publishSimulation)
                    )}">${escapeHtml(dashboardCopy("Re-run Dry-Run", "重新模拟发布"))}</button>
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Publish Outcome Estimator</div>
                  <div class="report-card-copy">${escapeHtml(
                    `${dashboardCopy("Outcome", "结果")}: ${publishOutcomeEstimator.state}`
                  )}</div>
                  <div class="report-card-copy">${escapeHtml(publishOutcomeEstimator.summary)}</div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">${escapeHtml(approvalSlaForecast.label)}</div>
                  <div class="report-card-copy">${escapeHtml(approvalSlaForecast.summary)}</div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Release Risk Banner</div>
                  <div class="report-card-copy">${escapeHtml(
                    `${dashboardCopy("Risk level", "风险级别")}: ${String(releaseRiskBanner.level).toUpperCase()}`
                  )}</div>
                  <div class="report-card-copy">${escapeHtml(releaseRiskBanner.summary)}</div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Gated Publish Confirmation</div>
                  <div class="report-card-copy">${escapeHtml(
                    requiresPublishAcknowledgment
                      ? dashboardCopy(
                          "This publish path needs an explicit confirmation before the final publish button becomes available.",
                          "当前发布路径需要先完成一次显式确认，最终发布按钮才会解锁。"
                        )
                      : dashboardCopy(
                          "Current risk is low enough that no extra publish confirmation gate is required.",
                          "当前风险较低，不需要额外的发布确认门。"
                        )
                  )}</div>
                  <div class="report-card-copy">${escapeHtml(
                    deliveryDashboardState.publishConfirmationArmed
                      ? dashboardCopy(
                          "Publish confirmation is armed. You can now choose whether to publish.",
                          "发布确认已开启。你现在可以决定是否执行正式发布。"
                        )
                      : dashboardCopy(
                          "Publish confirmation is not armed yet.",
                          "当前还没有开启发布确认。"
                        )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action ${requiresPublishAcknowledgment && !deliveryDashboardState.publishConfirmationArmed ? "" : "is-muted"}" type="button" data-delivery-publish-confirm-arm ${
                      requiresPublishAcknowledgment && !deliveryDashboardState.publishConfirmationArmed ? "" : "disabled"
                    }>${escapeHtml(dashboardCopy("Acknowledge And Arm Publish", "确认风险并解锁发布"))}</button>
                    <button class="report-export-action ${deliveryDashboardState.publishConfirmationArmed ? "" : "is-muted"}" type="button" data-delivery-publish-confirm-disarm ${
                      deliveryDashboardState.publishConfirmationArmed ? "" : "disabled"
                    }>${escapeHtml(dashboardCopy("Disarm Publish", "取消发布解锁"))}</button>
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Operator Acknowledgment</div>
                  <div class="report-card-copy">${escapeHtml(
                    dashboardCopy(
                      "Use this note to record who reviewed the current risk before publish.",
                      "用这条备注记录当前是谁在发布前确认了这次风险。"
                    )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <input class="billing-input" type="text" placeholder="${escapeHtml(
                      dashboardCopy("Operator acknowledgment note", "运营确认备注")
                    )}" value="${escapeHtml(deliveryDashboardState.publishAcknowledgmentNote || "")}" data-delivery-publish-ack-note />
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Post-Publish Watchlist</div>
                  <div class="report-card-copy">${escapeHtml(
                    deliveryDashboardState.postPublishWatchStatus ||
                      dashboardCopy(
                        "Use this watchlist to keep a live eye on the first post-publish signals.",
                        "用这份观察清单持续盯住发布后的第一批信号。"
                      )
                  )}</div>
                  <div class="report-list" style="margin-top:8px;">
                    ${postPublishWatchlist
                      .map(
                        (item, index) => `<div class="report-list-item">
                            <div class="report-preview-title">${escapeHtml(
                              `${dashboardCopy("Watch", "观察")} ${index + 1}`
                            )}</div>
                            <div class="report-card-copy">${escapeHtml(item)}</div>
                          </div>`
                      )
                      .join("")}
                  </div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action" type="button" data-delivery-post-publish-watch-start>${escapeHtml(
                      dashboardCopy("Start Live Watch", "开启实时观察")
                    )}</button>
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Live Watch Session</div>
                  <div class="report-card-copy">${escapeHtml(liveWatchSession.summary)}</div>
                  <div class="report-card-copy">${escapeHtml(
                    deliveryDashboardState.postPublishFollowupPrompt || timedFollowupPrompt
                  )}</div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Anomaly Checkpoints</div>
                  <div class="report-list" style="margin-top:8px;">
                    ${anomalyCheckpoints
                      .map(
                        (item, index) => `<div class="report-list-item">
                            <div class="report-preview-title">${escapeHtml(
                              `${item.label} ${index + 1}`
                            )}</div>
                            <div class="report-card-copy">${escapeHtml(item.detail)}</div>
                          </div>`
                      )
                      .join("")}
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Timed Follow-Up Prompts</div>
                  <div class="report-card-copy">${escapeHtml(
                    deliveryDashboardState.postPublishFollowupPrompt || timedFollowupPrompt
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action" type="button" data-delivery-post-publish-followup>${escapeHtml(
                      dashboardCopy("Log Follow-Up Prompt", "记录 follow-up 提示")
                    )}</button>
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Watch Outcome Journal</div>
                  <div class="report-list" style="margin-top:8px;">
                    ${(Array.isArray(deliveryDashboardState.postPublishWatchJournal)
                      ? deliveryDashboardState.postPublishWatchJournal
                      : []
                    )
                      .map(
                        (entry, index) => `<div class="report-list-item">
                            <div class="report-preview-title">${escapeHtml(
                              `${entry.kind || "watch"} ${index + 1}`
                            )}</div>
                            <div class="report-card-copy">${escapeHtml(
                              `${entry.at || ""} · ${entry.note || ""}`
                            )}</div>
                          </div>`
                      )
                      .join("") || `<div class="report-empty">${escapeHtml(
                        dashboardCopy(
                          "Watch outcome journal is empty. Start live watch or log a follow-up prompt to begin tracking.",
                          "观察结果日志还是空的。开启实时观察或记录一次 follow-up 提示后，这里就会开始累计。"
                        )
                      )}</div>`}
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Rollback Recommendation Lane</div>
                  <div class="report-card-copy">${escapeHtml(rollbackRecommendationLane.summary)}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action" type="button" data-delivery-post-publish-rollback-keep>${escapeHtml(
                      dashboardCopy("Keep Current Publish", "维持当前发布")
                    )}</button>
                    ${
                      rollbackRecommendationLane.fallbackRevision
                        ? `<button class="report-export-action ${rollbackRecommendationLane.recommendRollback ? "" : "is-muted"}" type="button" data-delivery-post-publish-rollback="${escapeHtml(
                            rollbackRecommendationLane.fallbackRevision.revision_id
                          )}" ${rollbackRecommendationLane.recommendRollback ? "" : "disabled"}>${escapeHtml(
                            dashboardCopy("Rollback To Suggested Revision", "回滚到建议 revision")
                          )}</button>`
                        : ""
                    }
                  </div>
                  <div class="report-list" style="margin-top:8px;">
                    ${(Array.isArray(deliveryDashboardState.rollbackDecisionAuditTrail)
                      ? deliveryDashboardState.rollbackDecisionAuditTrail
                      : []
                    )
                      .map(
                        (entry, index) => `<div class="report-list-item">
                            <div class="report-preview-title">${escapeHtml(
                              `${entry.decision || "decision"} ${index + 1}`
                            )}</div>
                            <div class="report-card-copy">${escapeHtml(
                              `${entry.at || ""} · ${entry.revision_id || "current"} · ${entry.reason || ""}`
                            )}</div>
                          </div>`
                      )
                      .join("") || `<div class="report-empty">${escapeHtml(
                        dashboardCopy(
                          "Rollback decision audit trail is empty. Record either rollback or keep-current to start the trail.",
                          "回滚决策审计轨迹还是空的。记录一次“回滚”或“维持当前发布”后，这里就会开始累计。"
                        )
                      )}</div>`}
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Exportable Watch Report</div>
                  <div class="report-card-copy">${escapeHtml(
                    dashboardCopy(
                      "Bundle the current watch session, checkpoints, journal, and rollback trail into one exportable report.",
                      "把当前观察会话、检查点、日志和回滚轨迹整理成一份可导出的正式报告。"
                    )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action" type="button" data-delivery-post-publish-export-watch-report>${escapeHtml(
                      dashboardCopy("Download Watch Report", "下载观察报告")
                    )}</button>
                  </div>
                  <pre class="report-preview-code">${escapeHtml(JsonCtor.stringify(watchReport, null, 2))}</pre>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Handoff Summary</div>
                  <div class="report-card-copy">${escapeHtml(
                    dashboardCopy(
                      "Summarize the current watch state for the next operator or downstream handoff.",
                      "把当前观察状态压缩成一份适合交给下一位运营或下游团队的交接摘要。"
                    )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action" type="button" data-delivery-post-publish-export-handoff>${escapeHtml(
                      dashboardCopy("Download Handoff Summary", "下载交接摘要")
                    )}</button>
                  </div>
                  <pre class="report-preview-code">${escapeHtml(JsonCtor.stringify(watchHandoffSummary, null, 2))}</pre>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Incident Replay Bundle</div>
                  <div class="report-card-copy">${escapeHtml(
                    dashboardCopy(
                      "Capture the watch trail, anomaly checkpoints, compliance snapshots, and rollback decisions for replay and review.",
                      "把观察轨迹、异常检查点、合规快照和回滚决策打包成一份可复盘的事件回放包。"
                    )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action" type="button" data-delivery-post-publish-export-replay>${escapeHtml(
                      dashboardCopy("Download Replay Bundle", "下载复盘包")
                    )}</button>
                  </div>
                  <pre class="report-preview-code">${escapeHtml(JsonCtor.stringify(incidentReplayBundle, null, 2))}</pre>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Report History Shelf</div>
                  <div class="report-card-copy">${escapeHtml(
                    dashboardCopy(
                      "Search, tag, and compare saved watch reports and replay bundles here as a reusable incident archive.",
                      "在这里检索、分类和对比已保存的观察报告与复盘包，形成可复用的事件档案馆。"
                    )
                  )}</div>
              `;
}

Object.assign(globalThis, {
  buildMusicDeliveryDashboardPatchBundleHtmlModule,
  buildMusicDeliveryDashboardPublishLaneHtmlModule
});
