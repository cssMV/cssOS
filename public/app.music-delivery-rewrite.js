(function attachMusicDeliveryRewrite(global) {
  function cloneMusicDeliveryArrangementDataBridge(data) {
    if (!data) return null;
    return {
      item: data.item || null,
      phraseItem: data.phraseItem || null,
      raw: data.raw || null,
      sections: Array.isArray(data.sections)
        ? data.sections.map((section) => ({ ...section, chordSlots: Array.isArray(section.chordSlots) ? [...section.chordSlots] : [] }))
        : [],
      phrases: Array.isArray(data.phrases) ? data.phrases.map((phrase) => ({ ...phrase })) : []
    };
  }

  function applyRewriteSandboxFromPayloadBridge({
    arrangementData,
    mode,
    providerPayload,
    cuePatchPlan,
    selectedSection
  }) {
    const sandbox = global.cloneMusicDeliveryArrangementData(arrangementData);
    if (!sandbox) return null;
    const patches = Array.isArray(cuePatchPlan?.cue_sheet_patches) ? cuePatchPlan.cue_sheet_patches : [];
    const phraseMapPatches = Array.isArray(cuePatchPlan?.phrase_map_patches) ? cuePatchPlan.phrase_map_patches : [];
    const section = sandbox.sections.find((item) => item.id === selectedSection?.id) || sandbox.sections[0] || null;
    const phrases = sandbox.phrases;

    patches.forEach((patch, index) => {
      const phrase = phrases.find((item) => item.id === patch.source_phrase_id);
      if (!phrase) return;
      phrase.isSandboxPatched = true;
      phrase.sandboxPatchKind = patch.patch_kind || mode;
      if (mode === "mutation") {
        phrase.noteDensity = Math.max(0.2, Number(phrase.noteDensity || 0) * 0.82);
        phrase.noteCount = Math.max(1, Math.round(Number(phrase.noteCount || 0) * 0.85));
        phrase.contour = `${phrase.contour || "flowing"} -> mutated`;
        phrase.articulation = patch.desired_articulation || phrase.articulation || "adaptive";
        phrase.chordSlot = patch.desired_chord_slot || phrase.chordSlot || "";
      } else if (mode === "reharmonize") {
        phrase.chordSlot = patch.desired_chord_slot || phrase.chordSlot || "";
        phrase.contour = `${phrase.contour || "flowing"} -> reharmonized`;
        phrase.articulation = patch.desired_articulation || phrase.articulation || "adaptive";
      }
      phrase.patchSummary = Array.isArray(patch.steps) ? patch.steps[0] || "" : "";
      const providerOp = Array.isArray(providerPayload?.rewrite_ops) ? providerPayload.rewrite_ops[index] : null;
      if (providerOp?.harmonic_progression && section) {
        const progression = providerOp.harmonic_progression.split("->").map((item) => item.trim()).filter(Boolean);
        if (progression.length) {
          section.chordSlots = progression;
        }
      }
    });

    if (mode === "counter") {
      phraseMapPatches.forEach((patch, index) => {
        const source = phrases.find((item) => item.id === patch.source_phrase_id);
        if (!source) return;
        const counterId = `${source.id}-counter-${index + 1}`;
        const alreadyExists = phrases.some((item) => item.id === counterId);
        if (alreadyExists) return;
        phrases.push({
          ...source,
          id: counterId,
          role: source.role === "lead" ? "strings" : source.role === "bass" ? "choir" : "lead",
          articulation: "legato-counter",
          noteDensity: Math.max(0.2, Number(source.noteDensity || 0) * 0.65),
          noteCount: Math.max(1, Math.round(Number(source.noteCount || 0) * 0.6)),
          startSec: Number(source.startSec || 0) + 0.12,
          endSec: Number(source.endSec || 0),
          contour: `${source.contour || "flowing"} -> counter`,
          isSandboxPatched: true,
          sandboxPatchKind: "counter_phrase_insert",
          patchSummary: patch.phrase_summary || ""
        });
      });
    }

    if (section) {
      section.isSandboxPatched = true;
      section.contour = `${section.contour || "flowing"} · sandbox ${mode}`;
    }
    sandbox.summary =
      mode === "reharmonize"
        ? "Sandbox applied: reharmonized section draft"
        : mode === "counter"
          ? "Sandbox applied: counter-melody section draft"
          : "Sandbox applied: phrase mutation draft";
    return sandbox;
  }

  function applyMusicDeliveryRewriteSandboxBridge(payload) {
    const sandbox = global.applyRewriteSandboxFromPayload(payload);
    if (!sandbox) return;
    global.deliveryDashboardState.rewriteSandboxActive = true;
    global.deliveryDashboardState.rewriteSandboxData = sandbox;
    global.deliveryDashboardState.rewriteSandboxSummary = String(sandbox.summary || "Rewrite sandbox active");
    global.renderMusicDeliveryDashboard();
  }

  function clearMusicDeliveryRewriteSandboxBridge() {
    global.deliveryDashboardState.rewriteSandboxActive = false;
    global.deliveryDashboardState.rewriteSandboxData = null;
    global.deliveryDashboardState.rewriteSandboxSummary = "";
    global.deliveryDashboardState.rewriteMixLane = "original";
    global.deliveryDashboardState.rewritePatchBundle = null;
    global.deliveryDashboardState.rewritePatchBundleError = "";
    global.deliveryDashboardState.restoredRewriteBundleId = "";
    global.deliveryDashboardState.rewritePatchBundleVersionName = "";
    global.deliveryDashboardState.rewritePromotionSaving = false;
    global.deliveryDashboardState.rewritePromotionError = "";
    global.deliveryDashboardState.rewriteBundleDiffFocus = "";
    global.deliveryDashboardState.arrangementRevisionFocus = "";
    global.deliveryDashboardState.arrangementRevisionActionSaving = false;
    global.deliveryDashboardState.arrangementRevisionActionError = "";
    global.deliveryDashboardState.arrangementReleaseCandidateName = "";
    global.renderMusicDeliveryDashboard();
  }

  function buildRewritePatchBundleBridge({
    mode,
    providerPayload,
    cuePatchPlan,
    selectedSection,
    comparePhraseA,
    comparePhraseB
  }) {
    return {
      bundle_version: "cssmv.rewrite.bundle.v1",
      mode,
      exported_at: new Date().toISOString(),
      section: {
        id: String(selectedSection?.id || ""),
        label: String(selectedSection?.label || ""),
        template: String(selectedSection?.template || "")
      },
      source_phrase_ids: [comparePhraseA?.id, comparePhraseB?.id].filter(Boolean),
      provider_payload: providerPayload,
      cue_patch_plan: cuePatchPlan
    };
  }

  function restoreMusicDeliveryRewriteBundleBridge(bundle) {
    if (!bundle || typeof bundle !== "object") return;
    const selectedSection =
      global.findMusicDeliverySection(bundle?.section?.id) || global.currentMusicDeliverySections()[0] || null;
    global.deliveryDashboardState.rewritePatchBundle = bundle;
    global.deliveryDashboardState.restoredRewriteBundleId = String(bundle.bundle_id || "");
    global.deliveryDashboardState.rewritePatchBundleVersionName = String(bundle.version_name || "");
    global.applyMusicDeliveryRewriteSandbox({
      arrangementData: global.deliveryDashboardState.arrangementData,
      mode: String(bundle.mode || "mutation"),
      providerPayload: bundle.provider_payload || {},
      cuePatchPlan: bundle.cue_patch_plan || {},
      selectedSection
    });
    global.deliveryDashboardState.rewriteMixLane = "rewritten";
  }

  global.cloneMusicDeliveryArrangementDataBridge = cloneMusicDeliveryArrangementDataBridge;
  global.applyRewriteSandboxFromPayloadBridge = applyRewriteSandboxFromPayloadBridge;
  global.applyMusicDeliveryRewriteSandboxBridge = applyMusicDeliveryRewriteSandboxBridge;
  global.clearMusicDeliveryRewriteSandboxBridge = clearMusicDeliveryRewriteSandboxBridge;
  global.buildRewritePatchBundleBridge = buildRewritePatchBundleBridge;
  global.restoreMusicDeliveryRewriteBundleBridge = restoreMusicDeliveryRewriteBundleBridge;
})(globalThis);
