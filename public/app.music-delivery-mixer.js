(function attachMusicDeliveryMixer(global) {
  async function loadMusicDeliveryArrangementBridge(cueItem, phraseItem = null) {
    if (!cueItem) return;
    const nextKey = global.musicDeliveryArrangementKey(cueItem);
    const nextPhraseKey = global.musicDeliveryArrangementKey(phraseItem);
    if (
      global.deliveryDashboardState.arrangementData &&
      global.deliveryDashboardState.arrangementKey === nextKey &&
      global.deliveryDashboardState.arrangementPhraseKey === nextPhraseKey
    ) {
      return;
    }
    global.deliveryDashboardState.arrangementLoading = true;
    global.deliveryDashboardState.arrangementError = "";
    global.renderMusicDeliveryDashboard();
    try {
      const payload = await global.fetchDeliveryArtifact(cueItem, "json");
      let phrasePayload = null;
      if (phraseItem) {
        try {
          phrasePayload = await global.fetchDeliveryArtifact(phraseItem, "json");
        } catch (_error) {
          // ignore phrase fetch failure
        }
      }
      const rawSections = Array.isArray(payload?.cue_segments)
        ? payload.cue_segments
        : Array.isArray(payload?.segments)
          ? payload.segments
          : [];
      const rawPhraseSegments = Array.isArray(phrasePayload?.phrase_segments)
        ? phrasePayload.phrase_segments
        : [];
      const sections = rawSections.map((segment, index) =>
        global.normalizeArrangementSection(segment, index)
      );
      const phrases = rawPhraseSegments.flatMap((segment, segmentIndex) =>
        (Array.isArray(segment?.phrase_map) ? segment.phrase_map : []).map((block, index) =>
          global.normalizeArrangementPhrase(segmentIndex, block, index)
        )
      );
      global.deliveryDashboardState.arrangementData = {
        item: cueItem,
        phraseItem,
        sections,
        phrases,
        raw: payload
      };
      const appliedPromotion = global.latestAppliedRewritePromotion();
      if (appliedPromotion && global.revisionFilesMatchArrangement(cueItem, phraseItem, appliedPromotion)) {
        global.deliveryDashboardState.rewriteSandboxActive = true;
        global.deliveryDashboardState.rewriteMixLane = "rewritten";
        global.deliveryDashboardState.rewriteSandboxSummary = `Apply-back revision active: ${
          appliedPromotion.version_name || appliedPromotion.bundle_id || "rewrite revision"
        }`;
        global.deliveryDashboardState.rewriteSandboxData = global.cloneMusicDeliveryArrangementData({
          item: cueItem,
          phraseItem,
          sections,
          phrases,
          raw: payload
        });
      } else {
        global.deliveryDashboardState.rewriteSandboxActive = false;
        global.deliveryDashboardState.rewriteSandboxData = null;
        global.deliveryDashboardState.rewriteSandboxSummary = "";
      }
      global.deliveryDashboardState.arrangementKey = nextKey;
      global.deliveryDashboardState.arrangementPhraseKey = nextPhraseKey;
      if (!global.deliveryDashboardState.selectedSection && sections[0]) {
        global.deliveryDashboardState.selectedSection = sections[0].id;
      }
      if (!global.deliveryDashboardState.compareA && sections[0]) {
        global.deliveryDashboardState.compareA = sections[0].id;
      }
      if (!global.deliveryDashboardState.compareB && sections[1]) {
        global.deliveryDashboardState.compareB = sections[1].id;
      }
      if (!global.deliveryDashboardState.phraseCompareA && phrases[0]) {
        global.deliveryDashboardState.phraseCompareA = phrases[0].id;
      }
      if (!global.deliveryDashboardState.phraseCompareB && phrases[1]) {
        global.deliveryDashboardState.phraseCompareB = phrases[1].id;
      }
    } catch (error) {
      global.deliveryDashboardState.arrangementError = String(error);
    } finally {
      global.deliveryDashboardState.arrangementLoading = false;
      global.renderMusicDeliveryDashboard();
    }
  }

  async function loadMusicDeliveryMixerBridge(items) {
    const stems = Array.isArray(items) ? items.filter(Boolean) : [];
    const nextKey = global.musicDeliveryMixerKey(stems);
    if (!stems.length) {
      global.resetMusicDeliveryMixerState();
      global.renderMusicDeliveryDashboard();
      return;
    }
    if (
      global.deliveryDashboardState.mixerReady &&
      global.deliveryDashboardState.mixerKey === nextKey &&
      Array.isArray(global.deliveryDashboardState.mixerBuffers) &&
      global.deliveryDashboardState.mixerBuffers.length
    ) {
      return;
    }
    global.stopMusicDeliveryMixerPlayback();
    global.deliveryDashboardState.mixerKey = nextKey;
    global.deliveryDashboardState.mixerLoading = true;
    global.deliveryDashboardState.mixerError = "";
    global.deliveryDashboardState.mixerReady = false;
    global.deliveryDashboardState.mixerBuffers = [];
    global.deliveryDashboardState.mixerTrackStates = {};
    global.renderMusicDeliveryDashboard();
    try {
      const ctx = await global.ensureMusicDeliveryMixerContext();
      const trackStates = {};
      const buffers = [];
      for (let index = 0; index < stems.length; index += 1) {
        const item = stems[index];
        const arrayBuffer = await global.fetchDeliveryArtifact(item, "arrayBuffer");
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        const key = global.musicDeliveryPreviewKey(item);
        const channel = audioBuffer.getChannelData(0);
        const buckets = 20;
        const bucketSize = Math.max(1, Math.floor(channel.length / buckets));
        const waveform = Array.from({ length: buckets }, (_, idx) => {
          const start = idx * bucketSize;
          const end = Math.min(channel.length, start + bucketSize);
          let peak = 0;
          for (let i = start; i < end; i += 1) {
            peak = Math.max(peak, Math.abs(channel[i] || 0));
          }
          return peak;
        });
        trackStates[key] = {
          gain: 1,
          muted: false,
          solo: false
        };
        buffers.push({
          key,
          item,
          role: global.stemMixerRole(item, index),
          title: global.stemMixerDisplayName(item, index),
          waveform,
          duration: audioBuffer.duration || 0,
          audioBuffer
        });
      }
      global.deliveryDashboardState.mixerTrackStates = trackStates;
      global.deliveryDashboardState.mixerBuffers = buffers;
      global.deliveryDashboardState.mixerDuration = buffers.reduce(
        (max, entry) => Math.max(max, Number(entry.duration || 0)),
        0
      );
      global.deliveryDashboardState.mixerReady = true;
    } catch (error) {
      global.deliveryDashboardState.mixerError = String(error);
    } finally {
      global.deliveryDashboardState.mixerLoading = false;
      global.renderMusicDeliveryDashboard();
    }
  }

  async function startMusicDeliveryMixerPlaybackBridge(playbackWindow = null) {
    if (!global.deliveryDashboardState.mixerReady) return;
    global.stopMusicDeliveryMixerPlayback();
    try {
      const ctx = await global.ensureMusicDeliveryMixerContext();
      const master = global.deliveryDashboardState.mixerMasterGain;
      const nodes = [];
      for (const entry of global.deliveryDashboardState.mixerBuffers) {
        const source = ctx.createBufferSource();
        source.buffer = entry.audioBuffer;
        const gain = ctx.createGain();
        source.connect(gain);
        gain.connect(master);
        nodes.push({ key: entry.key, source, gain });
      }
      global.deliveryDashboardState.mixerNodes = nodes;
      global.syncMusicDeliveryMixerGains();
      let endedCount = 0;
      const offsetSec = Math.max(0, Number(playbackWindow?.startSec || 0));
      const durationSec =
        playbackWindow && Number.isFinite(Number(playbackWindow?.durationSec))
          ? Math.max(0.2, Number(playbackWindow.durationSec))
          : null;
      nodes.forEach((entry) => {
        entry.source.onended = () => {
          if (!global.deliveryDashboardState.mixerPlaying) {
            return;
          }
          endedCount += 1;
          if (endedCount >= nodes.length) {
            global.deliveryDashboardState.mixerNodes = [];
            global.deliveryDashboardState.mixerPlaying = false;
            global.renderMusicDeliveryDashboard();
          }
        };
        if (durationSec) {
          entry.source.start(0, offsetSec, durationSec);
        } else {
          entry.source.start(0, offsetSec);
        }
      });
      global.deliveryDashboardState.mixerPlaying = true;
      global.deliveryDashboardState.mixerStartedAt = Date.now();
      global.deliveryDashboardState.mixerPlaybackWindow = playbackWindow
        ? {
            startSec: offsetSec,
            durationSec: durationSec || global.deliveryDashboardState.mixerDuration,
            label: playbackWindow.label || ""
          }
        : null;
      if (playbackWindow?.loop && durationSec) {
        global.deliveryDashboardState.mixerLoopTimer = window.setTimeout(() => {
          if (!global.deliveryDashboardState.loopSection) return;
          void global.startMusicDeliveryMixerPlayback(playbackWindow);
        }, Math.max(100, Math.round(durationSec * 1000)));
      }
    } catch (error) {
      global.deliveryDashboardState.mixerError = String(error);
      global.deliveryDashboardState.mixerPlaying = false;
    }
    global.renderMusicDeliveryDashboard();
  }

  function setMusicDeliveryMixerTrackToggleBridge(key, field) {
    const current = global.deliveryDashboardState.mixerTrackStates?.[key];
    if (!current) return;
    current[field] = !current[field];
    global.syncMusicDeliveryMixerGains();
    global.renderMusicDeliveryDashboard();
  }

  function setMusicDeliveryMixerTrackGainBridge(key, value) {
    const current = global.deliveryDashboardState.mixerTrackStates?.[key];
    if (!current) return;
    current.gain = Math.max(0, Math.min(1, Number(value || 0)));
    global.syncMusicDeliveryMixerGains();
    global.renderMusicDeliveryDashboard();
  }

  global.loadMusicDeliveryArrangementBridge = loadMusicDeliveryArrangementBridge;
  global.loadMusicDeliveryMixerBridge = loadMusicDeliveryMixerBridge;
  global.startMusicDeliveryMixerPlaybackBridge = startMusicDeliveryMixerPlaybackBridge;
  global.setMusicDeliveryMixerTrackToggleBridge = setMusicDeliveryMixerTrackToggleBridge;
  global.setMusicDeliveryMixerTrackGainBridge = setMusicDeliveryMixerTrackGainBridge;
})(globalThis);
