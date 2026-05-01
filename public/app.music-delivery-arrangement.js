(function attachMusicDeliveryArrangement(global) {
  function normalizeDeliveryRoleBridge(value) {
    const role = String(value || "").toLowerCase().trim();
    if (!role) return "stem";
    if (role.includes("lead") || role.includes("vocal")) return "lead";
    if (role.includes("string")) return "strings";
    if (role.includes("brass")) return "brass";
    if (role.includes("perc") || role.includes("drum")) return "perc";
    if (role.includes("choir") || role.includes("backing")) return "choir";
    if (role.includes("bass")) return "bass";
    return "stem";
  }

  function syncMusicDeliveryMixerGainsBridge() {
    const trackStates = global.deliveryDashboardState.mixerTrackStates || {};
    const anySolo = Object.values(trackStates).some((track) => track?.solo);
    const nodes = Array.isArray(global.deliveryDashboardState.mixerNodes)
      ? global.deliveryDashboardState.mixerNodes
      : [];
    nodes.forEach((entry) => {
      const state = trackStates[entry.key] || {};
      const isAudible = anySolo ? !!state.solo : !state.muted;
      const targetGain = isAudible ? Number(state.gain ?? 1) : 0;
      if (entry.gain?.gain) {
        try {
          entry.gain.gain.setValueAtTime(targetGain, entry.gain.context.currentTime);
        } catch (_error) {
          entry.gain.gain.value = targetGain;
        }
      }
    });
  }

  async function ensureMusicDeliveryMixerContextBridge() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      throw new Error("Web Audio API is not available in this browser");
    }
    if (!global.deliveryDashboardState.mixerContext) {
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.value = 0.92;
      master.connect(ctx.destination);
      global.deliveryDashboardState.mixerContext = ctx;
      global.deliveryDashboardState.mixerMasterGain = master;
    }
    if (global.deliveryDashboardState.mixerContext.state === "suspended") {
      await global.deliveryDashboardState.mixerContext.resume();
    }
    return global.deliveryDashboardState.mixerContext;
  }

  function normalizeArrangementSectionBridge(segment, index) {
    const startSec = Number(segment?.start_sec || 0);
    const durationSec = Math.max(0.25, Number(segment?.duration_sec || 0));
    const sourceSection = String(segment?.source_section || segment?.section_name || `Section ${index + 1}`);
    const templateName = String(segment?.template_name || segment?.section_name || "").toLowerCase();
    return {
      id: `section-${index + 1}`,
      index,
      label: sourceSection,
      template: templateName || "section",
      startSec,
      durationSec,
      endSec: startSec + durationSec,
      barStart: Number(segment?.bar_start || 0),
      barEnd: Number(segment?.bar_end || 0),
      chordSlots: Array.isArray(segment?.chord_slots) ? segment.chord_slots : [],
      contour: String(segment?.contour || ""),
      intensity: String(segment?.intensity || segment?.energy || ""),
      roles: Array.isArray(segment?.layer_roles) ? segment.layer_roles : []
    };
  }

  function normalizeArrangementPhraseBridge(segmentIndex, block, index) {
    const role = global.normalizeDeliveryRole(block?.role);
    return {
      id: String(block?.phrase_id || `phrase-${segmentIndex + 1}-${index + 1}`),
      role,
      patch: String(block?.patch || ""),
      articulation: String(block?.articulation || "adaptive"),
      barStart: Number(block?.bar_start || 0),
      barEnd: Number(block?.bar_end || 0),
      startSec: Number(block?.start_sec || 0),
      endSec: Number(block?.end_sec || 0),
      noteCount: Number(block?.note_count || 0),
      noteDensity: Number(block?.note_density || 0),
      contour: String(block?.contour || ""),
      chordSlot: String(block?.chord_slot || "")
    };
  }

  function currentMusicDeliverySectionsBridge() {
    const data =
      global.deliveryDashboardState.rewriteSandboxActive && global.deliveryDashboardState.rewriteSandboxData
        ? global.deliveryDashboardState.rewriteSandboxData
        : global.deliveryDashboardState.arrangementData;
    return Array.isArray(data?.sections) ? data.sections : [];
  }

  function findMusicDeliverySectionBridge(sectionId) {
    return global.currentMusicDeliverySections().find((section) => section.id === sectionId) || null;
  }

  function currentMusicDeliverySectionPhrasesBridge(sectionId = global.deliveryDashboardState.selectedSection) {
    const data =
      global.deliveryDashboardState.rewriteSandboxActive && global.deliveryDashboardState.rewriteSandboxData
        ? global.deliveryDashboardState.rewriteSandboxData
        : global.deliveryDashboardState.arrangementData;
    const sections = global.currentMusicDeliverySections();
    const targetSection = global.findMusicDeliverySection(sectionId) || sections[0] || null;
    if (!targetSection || !Array.isArray(data?.phrases)) return [];
    return data.phrases.filter((phrase) => {
      return (
        Math.abs(Number(phrase.startSec || 0) - Number(targetSection.startSec || 0)) < 0.01 &&
        Math.abs(Number(phrase.endSec || 0) - Number(targetSection.endSec || 0)) < Math.max(0.05, Number(targetSection.durationSec || 0) * 0.1)
      ) || (
        phrase.startSec >= targetSection.startSec - 0.01 &&
        phrase.endSec <= targetSection.endSec + 0.01
      );
    });
  }

  function findMusicDeliveryPhraseBridge(phraseId, sectionId = global.deliveryDashboardState.selectedSection) {
    return global.currentMusicDeliverySectionPhrases(sectionId).find((phrase) => phrase.id === phraseId) || null;
  }

  function currentMusicDeliveryChordSlotsBridge(sectionId = global.deliveryDashboardState.selectedSection) {
    const section = global.findMusicDeliverySection(sectionId);
    return Array.isArray(section?.chordSlots) ? section.chordSlots : [];
  }

  function currentMusicDeliveryRoleListBridge() {
    const fromSections = global.currentMusicDeliverySections().flatMap((section) =>
      Array.isArray(section?.roles) ? section.roles.map((role) => global.normalizeDeliveryRole(role)) : []
    );
    const fromTracks = Array.isArray(global.deliveryDashboardState.mixerBuffers)
      ? global.deliveryDashboardState.mixerBuffers.map((entry) => global.normalizeDeliveryRole(entry?.role))
      : [];
    const seen = new Set();
    return [...fromSections, ...fromTracks]
      .filter((role) => {
        if (!role || seen.has(role)) return false;
        seen.add(role);
        return true;
      })
      .sort((a, b) => global.DELIVERY_ROLE_ORDER.indexOf(a) - global.DELIVERY_ROLE_ORDER.indexOf(b));
  }

  function musicDeliveryTracksForRoleBridge(role) {
    const normalized = global.normalizeDeliveryRole(role);
    return Array.isArray(global.deliveryDashboardState.mixerBuffers)
      ? global.deliveryDashboardState.mixerBuffers.filter(
          (entry) => global.normalizeDeliveryRole(entry?.role) === normalized
        )
      : [];
  }

  function applyMusicDeliveryRoleFocusBridge(role) {
    const normalized = global.normalizeDeliveryRole(role);
    const trackStates = global.deliveryDashboardState.mixerTrackStates || {};
    let anyMatched = false;
    Object.entries(trackStates).forEach(([key, state]) => {
      const buffer = global.deliveryDashboardState.mixerBuffers.find((entry) => entry.key === key);
      const matches = global.normalizeDeliveryRole(buffer?.role) === normalized;
      state.solo = matches;
      state.muted = false;
      anyMatched = anyMatched || matches;
    });
    global.deliveryDashboardState.focusRole = anyMatched ? normalized : "";
    global.syncMusicDeliveryMixerGains();
    global.renderMusicDeliveryDashboard();
  }

  function clearMusicDeliveryRoleFocusBridge() {
    const trackStates = global.deliveryDashboardState.mixerTrackStates || {};
    Object.values(trackStates).forEach((state) => {
      state.solo = false;
    });
    global.deliveryDashboardState.focusRole = "";
    global.syncMusicDeliveryMixerGains();
    global.renderMusicDeliveryDashboard();
  }

  function applyMusicDeliveryPhraseFocusBridge(phraseId, sectionId = global.deliveryDashboardState.selectedSection) {
    const phrase = global.findMusicDeliveryPhrase(phraseId, sectionId);
    if (!phrase) return null;
    global.applyMusicDeliveryRoleFocus(phrase.role);
    global.deliveryDashboardState.selectedPhraseId = phrase.id;
    global.deliveryDashboardState.selectedChordSlot = phrase.chordSlot || "";
    global.deliveryDashboardState.selectedArticulation = phrase.articulation || "";
    return phrase;
  }

  function applyMusicDeliveryChordSlotFocusBridge(chordSlot, sectionId = global.deliveryDashboardState.selectedSection) {
    const sectionPhrases = global.currentMusicDeliverySectionPhrases(sectionId).filter(
      (phrase) => phrase.chordSlot === chordSlot
    );
    if (!sectionPhrases.length) return [];
    const role = sectionPhrases[0].role;
    global.applyMusicDeliveryRoleFocus(role);
    global.deliveryDashboardState.selectedPhraseId = sectionPhrases[0].id;
    global.deliveryDashboardState.selectedChordSlot = chordSlot;
    global.deliveryDashboardState.selectedArticulation = sectionPhrases[0].articulation || "";
    return sectionPhrases;
  }

  function applyMusicDeliveryArticulationFocusBridge(articulation, sectionId = global.deliveryDashboardState.selectedSection) {
    const sectionPhrases = global.currentMusicDeliverySectionPhrases(sectionId).filter(
      (phrase) => phrase.articulation === articulation
    );
    if (!sectionPhrases.length) return [];
    const role = sectionPhrases[0].role;
    global.applyMusicDeliveryRoleFocus(role);
    global.deliveryDashboardState.selectedPhraseId = sectionPhrases[0].id;
    global.deliveryDashboardState.selectedChordSlot = sectionPhrases[0].chordSlot || "";
    global.deliveryDashboardState.selectedArticulation = articulation;
    return sectionPhrases;
  }

  global.normalizeDeliveryRoleBridge = normalizeDeliveryRoleBridge;
  global.syncMusicDeliveryMixerGainsBridge = syncMusicDeliveryMixerGainsBridge;
  global.ensureMusicDeliveryMixerContextBridge = ensureMusicDeliveryMixerContextBridge;
  global.normalizeArrangementSectionBridge = normalizeArrangementSectionBridge;
  global.normalizeArrangementPhraseBridge = normalizeArrangementPhraseBridge;
  global.currentMusicDeliverySectionsBridge = currentMusicDeliverySectionsBridge;
  global.findMusicDeliverySectionBridge = findMusicDeliverySectionBridge;
  global.currentMusicDeliverySectionPhrasesBridge = currentMusicDeliverySectionPhrasesBridge;
  global.findMusicDeliveryPhraseBridge = findMusicDeliveryPhraseBridge;
  global.currentMusicDeliveryChordSlotsBridge = currentMusicDeliveryChordSlotsBridge;
  global.currentMusicDeliveryRoleListBridge = currentMusicDeliveryRoleListBridge;
  global.musicDeliveryTracksForRoleBridge = musicDeliveryTracksForRoleBridge;
  global.applyMusicDeliveryRoleFocusBridge = applyMusicDeliveryRoleFocusBridge;
  global.clearMusicDeliveryRoleFocusBridge = clearMusicDeliveryRoleFocusBridge;
  global.applyMusicDeliveryPhraseFocusBridge = applyMusicDeliveryPhraseFocusBridge;
  global.applyMusicDeliveryChordSlotFocusBridge = applyMusicDeliveryChordSlotFocusBridge;
  global.applyMusicDeliveryArticulationFocusBridge = applyMusicDeliveryArticulationFocusBridge;
})(globalThis);
