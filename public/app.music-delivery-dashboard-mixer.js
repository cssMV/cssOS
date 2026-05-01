function renderMusicDeliveryDashboardMixerBridge() {
  const response = deliveryDashboardState.response || null;
  const mixerTrackStates = deliveryDashboardState.mixerTrackStates || {};
  const mixerBuffers = Array.isArray(deliveryDashboardState.mixerBuffers)
    ? deliveryDashboardState.mixerBuffers
    : [];
  const sections = currentMusicDeliverySections();
  const selectedSection =
    findMusicDeliverySection(deliveryDashboardState.selectedSection) || sections[0] || null;
  const compareA =
    findMusicDeliverySection(deliveryDashboardState.compareA) || sections[0] || null;
  const compareB =
    findMusicDeliverySection(deliveryDashboardState.compareB) || sections[1] || sections[0] || null;
  const roleList = currentMusicDeliveryRoleList();
  const sectionPhrases = currentMusicDeliverySectionPhrases(selectedSection?.id);
  const selectedPhrase =
    findMusicDeliveryPhrase(deliveryDashboardState.selectedPhraseId, selectedSection?.id) || null;
  const comparePhraseA =
    findMusicDeliveryPhrase(deliveryDashboardState.phraseCompareA, selectedSection?.id) ||
    sectionPhrases[0] ||
    null;
  const comparePhraseB =
    findMusicDeliveryPhrase(deliveryDashboardState.phraseCompareB, selectedSection?.id) ||
    sectionPhrases[1] ||
    sectionPhrases[0] ||
    null;
  const motifBuckets = sectionPhrases.reduce((acc, phrase) => {
    const key = motifLabelForPhrase(phrase);
    if (!key) return acc;
    const existing = acc[key] || { label: key, count: 0, phrases: [] };
    existing.count += 1;
    existing.phrases.push(phrase);
    acc[key] = existing;
    return acc;
  }, {});

  const packageBrowser = Array.isArray(response?.package_browser) ? response.package_browser : [];
  const stemItems = packageBrowser.filter((item) => String(item?.category || "") === "stems");

  const mixerTracksHtml = mixerBuffers.length
    ? mixerBuffers
        .map((entry) => {
          const state = mixerTrackStates[entry.key] || {};
          return `
            <div class="report-list-item">
              <div class="report-preview-title">${escapeHtml(entry.title || entry.item?.label || "stem")}</div>
              <div class="report-card-copy">${escapeHtml(`${entry.role} · ${Number(entry.duration || 0).toFixed(1)}s`)}</div>
              <div style="display:flex;align-items:end;gap:2px;height:34px;margin:8px 0;">
                ${Array.isArray(entry.waveform)
                  ? entry.waveform
                      .map(
                        (value) =>
                          `<div style="flex:1;min-width:2px;border-radius:999px;background:linear-gradient(180deg, rgba(255,255,255,0.92), rgba(122,255,214,0.38));height:${Math.max(4, Math.round(Number(value || 0) * 34))}px;"></div>`
                      )
                      .join("")
                  : ""}
              </div>
              <div class="report-export-actions">
                <button class="report-export-action ${state.muted ? "is-muted" : ""}" type="button" data-delivery-mixer-mute="${escapeHtml(entry.key)}">${state.muted ? "Unmute" : "Mute"}</button>
                <button class="report-export-action ${state.solo ? "" : "is-muted"}" type="button" data-delivery-mixer-solo="${escapeHtml(entry.key)}">${state.solo ? "Soloed" : "Solo"}</button>
                <label class="report-card-copy" style="display:flex;align-items:center;gap:8px;">
                  Vol
                  <input type="range" min="0" max="1" step="0.01" value="${escapeHtml(String(Number(state.gain ?? 1).toFixed(2)))}" data-delivery-mixer-gain="${escapeHtml(entry.key)}" />
                </label>
              </div>
            </div>
          `;
        })
        .join("")
    : `<div class="report-empty">${escapeHtml(
        dashboardCopy("Load the stems to audition and compare them here.", "加载分轨后，就可以在这里试听和对比。")
      )}</div>`;

  let mixerSummary = dashboardCopy(
    "Load WAV stems to compare, solo, mute, and audition the arrangement.",
    "加载 WAV 分轨后，就可以直接对比、独奏、静音和试听编曲。"
  );
  if (!stemItems.length) {
    mixerSummary = dashboardCopy(
      "No WAV stems are available for this run yet.",
      "这个运行当前还没有可用的 WAV 分轨。"
    );
  } else if (deliveryDashboardState.mixerLoading) {
    mixerSummary = dashboardCopy(
      "Loading stems into the audition mixer...",
      "正在把分轨载入试听混音器..."
    );
  } else if (deliveryDashboardState.mixerError) {
    mixerSummary = deliveryDashboardState.mixerError;
  } else if (deliveryDashboardState.mixerReady) {
    mixerSummary = dashboardCopy(
      `Mixer ready with ${mixerBuffers.length} stems · ${Number(deliveryDashboardState.mixerDuration || 0).toFixed(1)}s`,
      `混音器已就绪，共 ${mixerBuffers.length} 条分轨 · ${Number(deliveryDashboardState.mixerDuration || 0).toFixed(1)} 秒`
    );
  }

  const mixerControlsHtml = `
    <div class="report-export-actions">
      <button class="report-export-action" type="button" data-delivery-mixer-load ${stemItems.length ? "" : "disabled"}>${deliveryDashboardState.mixerReady ? "Reload Mixer" : "Load Mixer"}</button>
      <button class="report-export-action" type="button" data-delivery-arrangement-load ${deliveryDashboardState.arrangementData ? "" : "disabled"}>${deliveryDashboardState.arrangementData ? "Reload Timeline" : "Load Timeline"}</button>
      <button class="report-export-action" type="button" data-delivery-mixer-play ${
        deliveryDashboardState.mixerReady ? "" : "disabled"
      }>${deliveryDashboardState.mixerPlaying ? "Restart" : "Play Mix"}</button>
      <button class="report-export-action is-muted" type="button" data-delivery-mixer-stop ${
        deliveryDashboardState.mixerPlaying ? "" : "disabled"
      }>Stop</button>
    </div>
  `;

  const totalTimelineDuration = sections.reduce(
    (max, section) => Math.max(max, Number(section.endSec || 0)),
    0
  );
  const timelineHtml = sections.length
    ? `
        <div style="display:flex;gap:6px;align-items:stretch;overflow:auto;padding-bottom:4px;">
          ${sections
            .map((section) => {
              const basis = totalTimelineDuration > 0 ? Math.max(12, (section.durationSec / totalTimelineDuration) * 100) : 16;
              const isSelected = selectedSection?.id === section.id;
              return `
                <button
                  type="button"
                  data-delivery-section-pick="${escapeHtml(section.id)}"
                  style="flex:${basis} 0 auto;min-width:88px;text-align:left;border-radius:16px;padding:12px;border:1px solid rgba(255,255,255,0.12);background:${isSelected ? "rgba(120,180,255,0.22)" : "rgba(255,255,255,0.04)"};color:inherit;"
                >
                  <div class="report-preview-title">${escapeHtml(section.label)}</div>
                  <div class="report-card-copy">${escapeHtml(`${section.template} · ${section.startSec.toFixed(1)}s - ${section.endSec.toFixed(1)}s`)}</div>
                </button>
              `;
            })
            .join("")}
        </div>
      `
    : `<div class="report-empty">${escapeHtml(
        dashboardCopy("Load the cue sheet to inspect verse, chorus, and bridge sections.", "载入 cue sheet 后，就可以查看 verse、chorus、bridge 等段落。")
      )}</div>`;

  const sectionPanelHtml = selectedSection
    ? `
        <div class="report-list-item">
          <div class="report-preview-title">${escapeHtml(selectedSection.label)}</div>
          <div class="report-card-copy">${escapeHtml(
            `${selectedSection.template} · bars ${selectedSection.barStart}-${selectedSection.barEnd} · ${selectedSection.startSec.toFixed(1)}s - ${selectedSection.endSec.toFixed(1)}s`
          )}</div>
          <div class="report-card-copy">${escapeHtml(
            `${selectedSection.intensity || "dynamic"} · ${selectedSection.contour || "flowing"}`
          )}</div>
          <div class="report-export-actions">
            <button class="report-export-action" type="button" data-delivery-section-play="${escapeHtml(selectedSection.id)}" ${
              deliveryDashboardState.mixerReady ? "" : "disabled"
            }>Play Section</button>
            <label class="report-card-copy" style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" data-delivery-loop-toggle ${deliveryDashboardState.loopSection ? "checked" : ""} />
              Loop selected section
            </label>
            <button class="report-export-action ${deliveryDashboardState.loopSection ? "" : "is-muted"}" type="button" data-delivery-loop-play ${
              deliveryDashboardState.mixerReady && selectedSection ? "" : "disabled"
            }>Start Loop</button>
          </div>
        </div>
      `
    : `<div class="report-empty">${escapeHtml(
        dashboardCopy("Pick a section on the timeline to inspect and loop it.", "在时间轴上选择一个段落，即可查看并循环播放。")
      )}</div>`;

  const sectionRoleMatrixHtml =
    selectedSection && roleList.length
      ? roleList
          .map((role) => {
            const sectionHasRole = selectedSection.roles
              .map((item) => normalizeDeliveryRole(item))
              .includes(role);
            const relatedTracks = musicDeliveryTracksForRole(role);
            const relatedLabels = relatedTracks
              .slice(0, 3)
              .map((track) => track.title)
              .join(", ");
            const isFocused = deliveryDashboardState.focusRole === role;
            return `
              <div class="report-list-item">
                <div class="report-preview-title">${escapeHtml(role)}</div>
                <div class="report-card-copy">${escapeHtml(
                  `${sectionHasRole ? "active in section" : "not highlighted in section"} · ${relatedTracks.length} stem${relatedTracks.length === 1 ? "" : "s"}`
                )}</div>
                <div class="report-card-copy">${escapeHtml(relatedLabels || "No mapped stems yet")}</div>
                <div class="report-export-actions">
                  <button class="report-export-action ${isFocused ? "" : "is-muted"}" type="button" data-delivery-role-focus="${escapeHtml(role)}" ${
                    relatedTracks.length ? "" : "disabled"
                  }>${isFocused ? "Focused" : "Focus"}</button>
                  <button class="report-export-action" type="button" data-delivery-role-audition="${escapeHtml(role)}" ${
                    relatedTracks.length && deliveryDashboardState.mixerReady ? "" : "disabled"
                  }>Audition Role</button>
                </div>
              </div>
            `;
          })
          .join("")
      : `<div class="report-empty">${escapeHtml(
          dashboardCopy("Load stems and a cue sheet to inspect the role matrix.", "载入分轨和 cue sheet 后，就可以查看角色矩阵。")
        )}</div>`;

  const roleFocusSummary = deliveryDashboardState.focusRole
    ? dashboardCopy(
        `Role focus is locked to ${deliveryDashboardState.focusRole}.`,
        `角色聚焦已锁定到 ${deliveryDashboardState.focusRole}。`
      )
    : dashboardCopy(
        "No role focus is active. You are hearing the full section blend.",
        "当前没有角色聚焦，正在听完整段落的整体混合。"
      );

  const phraseFocusSummary = selectedPhrase
    ? dashboardCopy(
        `Phrase ${selectedPhrase.id} · ${selectedPhrase.chordSlot || "no chord slot"} · ${selectedPhrase.articulation || "adaptive"}`,
        `当前 phrase：${selectedPhrase.id} · ${selectedPhrase.chordSlot || "无和弦槽"} · ${selectedPhrase.articulation || "adaptive"}`
      )
    : deliveryDashboardState.selectedChordSlot || deliveryDashboardState.selectedArticulation
      ? dashboardCopy(
          `Focused on ${deliveryDashboardState.selectedChordSlot || deliveryDashboardState.selectedArticulation}.`,
          `当前聚焦：${deliveryDashboardState.selectedChordSlot || deliveryDashboardState.selectedArticulation}。`
        )
      : dashboardCopy(
          "No phrase, chord slot, or articulation is selected yet.",
          "当前还没有选中 phrase、和弦槽或演奏法。"
        );

  const phraseHeatmapHtml =
    selectedSection && sectionPhrases.length
      ? roleList
          .map((role) => {
            const rolePhrases = sectionPhrases.filter((phrase) => phrase.role === role);
            return `
              <div class="report-list-item">
                <div class="report-preview-title">${escapeHtml(role)}</div>
                <div style="display:flex;align-items:end;gap:4px;height:52px;margin-top:8px;">
                  ${
                    rolePhrases.length
                      ? rolePhrases
                          .map((phrase) => {
                            const isSelected = deliveryDashboardState.selectedPhraseId === phrase.id;
                            const heat = Math.max(
                              10,
                              Math.min(
                                52,
                                Math.round((Number(phrase.noteCount || 0) + Number(phrase.noteDensity || 0) * 6) * 4)
                              )
                            );
                            return `<button type="button" data-delivery-phrase-audition="${escapeHtml(phrase.id)}" title="${escapeHtml(`${phrase.id} · ${phrase.chordSlot} · ${phrase.articulation}`)}" style="flex:1;min-width:18px;height:${heat}px;border-radius:10px 10px 4px 4px;border:${isSelected ? "2px solid rgba(255,255,255,0.92)" : "1px solid rgba(255,255,255,0.08)"};background:linear-gradient(180deg, rgba(255,210,120,0.95), rgba(255,120,120,0.35));"></button>`;
                          })
                          .join("")
                      : `<div class="report-card-copy">${escapeHtml("No phrase activity")}</div>`
                  }
                </div>
                <div class="report-card-copy">${escapeHtml(
                  rolePhrases.map((phrase) => phrase.chordSlot).filter(Boolean).join(" · ") || "No chord activity"
                )}</div>
                ${
                  rolePhrases.length
                    ? `<div class="report-export-actions">${rolePhrases
                        .map(
                          (phrase) => `<button class="report-export-action ${deliveryDashboardState.selectedPhraseId === phrase.id ? "" : "is-muted"}" type="button" data-delivery-phrase-audition="${escapeHtml(phrase.id)}">${escapeHtml(phrase.chordSlot || phrase.id)}</button>`
                        )
                        .join("")}</div>`
                    : ""
                }
              </div>
            `;
          })
          .join("")
      : `<div class="report-empty">${escapeHtml(
          dashboardCopy("Load phrase map data to inspect role-level phrase heatmaps.", "载入 phrase map 后，就可以查看角色级 phrase 热力图。")
        )}</div>`;

  const chordLaneHtml =
    selectedSection && selectedSection.barStart >= 0
      ? `
          <div class="report-list-item">
            <div class="report-preview-title">Chord Lane</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
              ${
                Array.isArray(selectedSection?.chordSlots) && selectedSection.chordSlots.length
                  ? selectedSection.chordSlots
                      .map(
                        (slot, index) => `<button type="button" data-delivery-chord-audition="${escapeHtml(slot)}" style="padding:8px 12px;border-radius:999px;border:${deliveryDashboardState.selectedChordSlot === slot ? "2px solid rgba(255,255,255,0.9)" : "1px solid rgba(255,255,255,0.12)"};background:${deliveryDashboardState.selectedChordSlot === slot ? "rgba(120,180,255,0.18)" : "rgba(255,255,255,0.05)"};color:inherit;">
                          <div class="report-preview-title">${escapeHtml(`Slot ${index + 1}`)}</div>
                          <div class="report-card-copy">${escapeHtml(slot)}</div>
                        </button>`
                      )
                      .join("")
                  : `<div class="report-card-copy">${escapeHtml("No chord slots found for this section")}</div>`
              }
            </div>
          </div>
        `
      : "";

  const articulationLensHtml =
    selectedSection && sectionPhrases.length
      ? `
          <div class="report-list-item">
            <div class="report-preview-title">Articulation Lens</div>
            <div class="report-card-copy">${escapeHtml(
              dashboardCopy("See which articulations are driving each role in the current section.", "查看当前段落中各角色主要由哪些演奏法驱动。")
            )}</div>
            <div class="report-list">
              ${roleList
                .map((role) => {
                  const rolePhrases = sectionPhrases.filter((phrase) => phrase.role === role);
                  const articulationSummary = rolePhrases.reduce((acc, phrase) => {
                    const key = phrase.articulation || "adaptive";
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                  }, {});
                  const chips = Object.entries(articulationSummary)
                    .map(
                      ([name, count]) =>
                        `<button type="button" data-delivery-articulation-audition="${escapeHtml(name)}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:${deliveryDashboardState.selectedArticulation === name ? "rgba(255,210,120,0.2)" : "rgba(120,180,255,0.14)"};border:${deliveryDashboardState.selectedArticulation === name ? "2px solid rgba(255,255,255,0.9)" : "1px solid rgba(120,180,255,0.2)"};margin-right:6px;margin-top:6px;color:inherit;">${escapeHtml(`${name} × ${count}`)}</button>`
                    )
                    .join("");
                  return `
                    <div class="report-list-item">
                      <div class="report-preview-title">${escapeHtml(role)}</div>
                      <div class="report-card-copy">${chips || escapeHtml("No articulation data")}</div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>
        `
      : "";

  const comparePhraseSummary =
    comparePhraseA && comparePhraseB
      ? dashboardCopy(
          `Comparing ${comparePhraseA.id} against ${comparePhraseB.id}.`,
          `正在对比 ${comparePhraseA.id} 和 ${comparePhraseB.id}。`
        )
      : dashboardCopy(
          "Choose two phrases to compare motif, density, and articulation.",
          "选择两个 phrase 后，就可以对比动机、密度和演奏法。"
        );

  const compareDensityDelta =
    comparePhraseA && comparePhraseB
      ? Math.abs(Number(comparePhraseA.noteDensity || 0) - Number(comparePhraseB.noteDensity || 0))
      : 0;

  const compareDeckHtml = sectionPhrases.length
    ? `
        <div class="report-list-item">
          <div class="report-preview-title">Phrase Compare Deck</div>
          <div class="report-card-copy">${escapeHtml(comparePhraseSummary)}</div>
          <div class="report-list">
            ${[
              { slot: "A", phrase: comparePhraseA },
              { slot: "B", phrase: comparePhraseB }
            ]
              .map(
                ({ slot, phrase }) => `
                  <div class="report-list-item">
                    <div class="report-preview-title">${escapeHtml(`Phrase ${slot}`)}</div>
                    <div class="report-card-copy">${escapeHtml(
                      phrase
                        ? `${phrase.id} · ${phrase.role} · ${phrase.chordSlot || "free"}`
                        : "No phrase selected"
                    )}</div>
                    <div class="report-card-copy">${escapeHtml(
                      phrase
                        ? `${phrase.articulation || "adaptive"} · density ${Number(phrase.noteDensity || 0).toFixed(2)} · ${phrase.noteCount} notes`
                        : "Select a phrase below"
                    )}</div>
                    <div class="report-export-actions" style="flex-wrap:wrap;">
                      ${
                        phrase
                          ? `<button class="report-export-action" type="button" data-delivery-phrase-compare-play="${escapeHtml(phrase.id)}" ${
                              deliveryDashboardState.mixerReady ? "" : "disabled"
                            }>Play ${escapeHtml(slot)}</button>`
                          : ""
                      }
                      ${sectionPhrases
                        .map(
                          (candidate) => `<button class="report-export-action ${
                            phrase?.id === candidate.id ? "" : "is-muted"
                          }" type="button" data-delivery-phrase-compare-select="${escapeHtml(candidate.id)}" data-delivery-phrase-compare-slot="${escapeHtml(slot)}">${escapeHtml(candidate.chordSlot || candidate.id)}</button>`
                        )
                        .join("")}
                    </div>
                  </div>
                `
              )
              .join("")}
            <div class="report-list-item">
              <div class="report-preview-title">Compare Readout</div>
              <div class="report-card-copy">${escapeHtml(
                comparePhraseA && comparePhraseB
                  ? `motif ${motifLabelForPhrase(comparePhraseA)} vs ${motifLabelForPhrase(comparePhraseB)}`
                  : "Pick two phrases to inspect motif overlap."
              )}</div>
              <div class="report-card-copy">${escapeHtml(
                comparePhraseA && comparePhraseB
                  ? `density delta ${compareDensityDelta.toFixed(2)} · articulations ${comparePhraseA.articulation || "adaptive"} / ${comparePhraseB.articulation || "adaptive"}`
                  : "Motif and density comparison will appear here."
              )}</div>
            </div>
          </div>
        </div>
      `
    : `<div class="report-empty">${escapeHtml(
        dashboardCopy("Select a section with phrase data to compare phrases.", "先选择一个带 phrase 数据的段落，再开始对比。")
      )}</div>`;

  const motifTrackerHtml = Object.values(motifBuckets).length
    ? `
        <div class="report-list-item">
          <div class="report-preview-title">Motif Tracker</div>
          <div class="report-card-copy">${escapeHtml(
            dashboardCopy("Grouped by contour, articulation, and chord slot so repeated gesture families surface quickly.", "按轮廓、演奏法和和弦槽分组，方便快速找出重复的动机家族。")
          )}</div>
          <div class="report-list">
            ${Object.values(motifBuckets)
              .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
              .map(
                (bucket) => `
                  <div class="report-list-item">
                    <div class="report-preview-title">${escapeHtml(bucket.label)}</div>
                    <div class="report-card-copy">${escapeHtml(`${bucket.count} phrase${bucket.count === 1 ? "" : "s"}`)}</div>
                    <div class="report-export-actions" style="flex-wrap:wrap;">
                      ${bucket.phrases
                        .map(
                          (phrase) => `<button class="report-export-action ${
                            deliveryDashboardState.selectedPhraseId === phrase.id ? "" : "is-muted"
                          }" type="button" data-delivery-phrase-audition="${escapeHtml(phrase.id)}">${escapeHtml(phrase.id)}</button>`
                        )
                        .join("")}
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      `
    : `<div class="report-empty">${escapeHtml(
        dashboardCopy("Motif tracking appears after phrase data is loaded.", "载入 phrase 数据后，这里会显示动机追踪。")
      )}</div>`;

  const rewriteAssistMode = String(deliveryDashboardState.rewriteAssistMode || "");
  const rewriteAssistSuggestions = rewriteAssistSuggestionForPhrase(comparePhraseA, comparePhraseB);
  const phraseMutationDrafts = phraseMutationPresetsForPair(comparePhraseA, comparePhraseB);
  const reharmonizationDrafts = reharmonizationDraftForPair(
    comparePhraseA,
    comparePhraseB,
    selectedSection
  );
  const counterMelodyDrafts = counterMelodyDraftForPair(comparePhraseA, comparePhraseB);
  const activeRewriteMode = rewriteAssistMode || "mutation";
  const activeRewriteDrafts =
    activeRewriteMode === "reharmonize"
      ? reharmonizationDrafts
      : activeRewriteMode === "counter"
        ? counterMelodyDrafts
        : phraseMutationDrafts;
  const providerReadyRewritePayload = buildProviderReadyRewritePayload({
    mode: activeRewriteMode,
    drafts: activeRewriteDrafts,
    comparePhraseA,
    comparePhraseB,
    selectedSection
  });
  const cueSheetPatchPlan = buildCueSheetPatchPlan({
    mode: activeRewriteMode,
    drafts: activeRewriteDrafts,
    comparePhraseA,
    comparePhraseB,
    selectedSection
  });
  const cuePatchPlan = cueSheetPatchPlan || {};
  const rewritePayloadMode = String(deliveryDashboardState.rewritePayloadMode || "provider");
  const rewriteAssistHtml = sectionPhrases.length
    ? `
        <div class="report-list-item">
          <div class="report-preview-title">Rewrite Assist</div>
          <div class="report-card-copy">${escapeHtml(
            dashboardCopy("Turn phrase comparison into executable rewrite drafts for mutation, reharmonization, and counter-melody work.", "把 phrase 对比直接推进成可执行改写草稿，覆盖变体、再和声与副旋律。")
          )}</div>
          <div class="report-export-actions" style="flex-wrap:wrap;">
            ${[
              ["mutation", dashboardCopy("Mutation Presets", "变体预设")],
              ["reharmonize", dashboardCopy("Reharm Draft", "再和声草稿")],
              ["counter", dashboardCopy("Counter Rewrite", "副旋律改写")]
            ]
              .map(
                ([mode, label]) => `<button class="report-export-action ${
                  activeRewriteMode === mode ? "" : "is-muted"
                }" type="button" data-delivery-rewrite-assist="${escapeHtml(mode)}">${escapeHtml(label)}</button>`
              )
              .join("")}
          </div>
          <div class="report-list" style="margin-top:8px;">
            <div class="report-list-item">
              <div class="report-preview-title">${escapeHtml(
                activeRewriteMode === "reharmonize"
                  ? "Reharmonization Draft"
                  : activeRewriteMode === "counter"
                    ? "Counter-Melody Draft"
                    : "Phrase Mutation Presets"
              )}</div>
              <div class="report-card-copy">${escapeHtml(
                activeRewriteMode === "reharmonize"
                  ? dashboardCopy("These cards reshape harmony while keeping the phrase identity readable.", "这些卡片会重写和声，但保留 phrase 身份可辨识。")
                  : activeRewriteMode === "counter"
                    ? dashboardCopy("These cards draft answering lines that can sit around the anchor phrase.", "这些卡片会生成围绕主 phrase 的回应线草稿。")
                    : dashboardCopy("These cards mutate the motif itself, so later arranging tools can apply a concrete variation pass.", "这些卡片会直接改写动机本体，便于后续编曲器执行具体变体。")
              )}</div>
            </div>
            ${activeRewriteDrafts
              .map(
                (draft, index) => `
                  <div class="report-list-item">
                    <div class="report-preview-title">${escapeHtml(draft.title || `Draft ${index + 1}`)}</div>
                    <div class="report-card-copy">${escapeHtml(draft.summary || "")}</div>
                    ${
                      draft.progression
                        ? `<div class="report-card-copy">${escapeHtml(`Progression: ${draft.progression}`)}</div>`
                        : ""
                    }
                    <div class="report-export-actions" style="flex-wrap:wrap;">
                      ${
                        draft.sourcePhraseId
                          ? `<button class="report-export-action" type="button" data-delivery-rewrite-phrase-play="${escapeHtml(draft.sourcePhraseId)}" ${
                              deliveryDashboardState.mixerReady ? "" : "disabled"
                            }>Play Source</button>`
                          : ""
                      }
                      ${
                        draft.targetPhraseId
                          ? `<button class="report-export-action is-muted" type="button" data-delivery-rewrite-phrase-play="${escapeHtml(draft.targetPhraseId)}" ${
                              deliveryDashboardState.mixerReady ? "" : "disabled"
                            }>Play Target</button>`
                          : ""
                      }
                    </div>
                    <div class="report-list" style="margin-top:8px;">
                      ${(Array.isArray(draft.steps) ? draft.steps : [])
                        .map(
                          (step, stepIndex) => `
                            <div class="report-list-item">
                              <div class="report-preview-title">${escapeHtml(`Step ${stepIndex + 1}`)}</div>
                              <div class="report-card-copy">${escapeHtml(step)}</div>
                            </div>
                          `
                        )
                        .join("")}
                    </div>
                  </div>
                `
              )
              .join("")}
            ${rewriteAssistSuggestions
              .map(
                (suggestion, index) => `
                  <div class="report-list-item">
                    <div class="report-preview-title">${escapeHtml(
                      activeRewriteMode
                        ? `${activeRewriteMode} cue ${index + 1}`
                        : `Rewrite cue ${index + 1}`
                    )}</div>
                    <div class="report-card-copy">${escapeHtml(suggestion)}</div>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      `
    : `<div class="report-empty">${escapeHtml(
        dashboardCopy("Rewrite assist will appear after phrase audition data is available.", "phrase 试听数据就绪后，这里会出现改写辅助建议。")
      )}</div>`;

  return {
    sections,
    selectedSection,
    compareA,
    compareB,
    roleList,
    sectionPhrases,
    selectedPhrase,
    comparePhraseA,
    comparePhraseB,
    mixerTracksHtml,
    mixerSummary,
    mixerControlsHtml,
    timelineHtml,
    sectionPanelHtml,
    sectionRoleMatrixHtml,
    roleFocusSummary,
    phraseFocusSummary,
    phraseHeatmapHtml,
    chordLaneHtml,
    articulationLensHtml,
    compareDeckHtml,
    motifTrackerHtml,
    activeRewriteMode,
    providerReadyRewritePayload,
    cueSheetPatchPlan,
    cuePatchPlan,
    rewritePayloadMode,
    rewriteAssistHtml
  };
}

window.renderMusicDeliveryDashboardMixerBridge = renderMusicDeliveryDashboardMixerBridge;
