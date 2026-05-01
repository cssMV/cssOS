const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const APP_JS_PATH = path.resolve(__dirname, "../public/app.js");
const APP_SOURCE = fs.readFileSync(APP_JS_PATH, "utf8");

function extractFunctionSource(source, name) {
  const patterns = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  let header = "";
  for (const pattern of patterns) {
    start = source.indexOf(pattern);
    if (start >= 0) {
      header = pattern;
      break;
    }
  }
  if (start < 0) {
    throw new Error(`Function ${name} not found in ${APP_JS_PATH}`);
  }
  const paramsStart = start + header.length - 1;
  let paramsDepth = 0;
  let paramsEnd = -1;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  for (let i = paramsStart; i < source.length; i += 1) {
    const ch = source[i];
    const prev = source[i - 1];
    if (!inDouble && !inTemplate && ch === "'" && prev !== "\\") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && ch === '"' && prev !== "\\") {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === "`" && prev !== "\\") {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;
    if (ch === "(") paramsDepth += 1;
    if (ch === ")") {
      paramsDepth -= 1;
      if (paramsDepth === 0) {
        paramsEnd = i;
        break;
      }
    }
  }
  if (paramsEnd < 0) {
    throw new Error(`Function ${name} parameters are not balanced`);
  }
  const braceStart = source.indexOf("{", paramsEnd);
  if (braceStart < 0) {
    throw new Error(`Function ${name} has no body`);
  }
  let depth = 0;
  inSingle = false;
  inDouble = false;
  inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    const prev = source[i - 1];
    const next = source[i + 1];
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (prev === "*" && ch === "/") inBlockComment = false;
      continue;
    }
    if (!inSingle && !inDouble && !inTemplate) {
      if (ch === "/" && next === "/") {
        inLineComment = true;
        continue;
      }
      if (ch === "/" && next === "*") {
        inBlockComment = true;
        continue;
      }
    }
    if (!inDouble && !inTemplate && ch === "'" && prev !== "\\") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && ch === '"' && prev !== "\\") {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === "`" && prev !== "\\") {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  throw new Error(`Function ${name} body is not balanced`);
}

function buildVoiceFlowSandbox(overrides = {}) {
  const events = [];
  const startCreationCalls = [];
  const optimisticWorks = [];
  const workUpdates = [];
  const panelsOpened = [];
  const toasts = [];
  const statuses = [];
  const fallbackMediaCalls = [];
  const dispatchedEvents = [];

  const sandbox = {
    console,
    Promise,
    Date,
    Math,
    state: {
      spell: "CSS",
      style: "Chinese GuFeng",
      title: "",
      songSeed: null
    },
    micState: {
      transcript: "",
      debug: null,
      rawVoiceId: null,
      rawVoiceDeleted: false,
      creationSource: "manual"
    },
    authState: { user: null },
    creatorBoostState: { loaded: true },
    creationState: {
      duration: 180,
      workType: "single"
    },
    titleInput: { dataset: {}, value: "" },
    styleInput: { value: "Chinese GuFeng" },
    voiceInput: { value: "Feminine" },
    watchSubtitle: { textContent: "" },
    foryouPanel: { id: "for_you" },
    watchPanel: { id: "watch" },
    DEFAULT_SPELL: "CSS",
    LONGPRESS_MS: 600,
    getMicJobId: () => "mic-job-001",
    loadCreatorBoostState: async () => null,
    enforceCreationCapability: () => ({ ok: true }),
    normalizeWorkTypeClient: (value) => String(value || "single"),
    deriveTitleFromVoice: async () => ({
      transcript: "请创作歌曲 靈霄寶殿",
      title: "靈霄寶殿",
      wakeDetected: true,
      workType: "single"
    }),
    applyVoiceIntentToCreationState: () => {
      events.push("applyVoiceIntentToCreationState");
    },
    showToast: (message) => {
      toasts.push(String(message));
    },
    loginCopy: (en, zh) => zh,
    setSongSeedTitleValue: (title, options = {}) => {
      sandbox.state.title = String(title || "");
      sandbox.titleInput.value = String(title || "");
      sandbox.titleInput.dataset.userEdited = options.userEdited ? "1" : "0";
      return sandbox.state.title;
    },
    b64FromArrayBuffer: () => "ZmFrZQ==",
    runLyricsGenerate: async () => null,
    isSongSeedQuotaExceeded: () => false,
    safeShowToast: () => {},
    getSongSeedQuotaExceededMessage: () => "",
    deriveVoiceKeywordTitle: () => "",
    updateMicDebugState: (payload) => {
      sandbox.micState.debug = payload;
      events.push("updateMicDebugState");
    },
    buildDirectCreationFallbackTitle: () => "Fallback Title",
    shouldPreserveSongSeedTitleForRefresh: () => sandbox.titleInput.dataset.userEdited === "1",
    getAccessTier: () => "dev",
    buildLocalFallbackLyrics: (title) => [`line:${title}`, "bridge"],
    upsertLocalWorkRecord: (work) => {
      optimisticWorks.push(work);
      return { ...work };
    },
    currentWorkCoverImage: (title) => `cover:${title}`,
    compactLyricLines: (lines) => lines,
    refreshWorkSurfaces: async () => {
      events.push("refreshWorkSurfaces");
    },
    openPanel: (panel) => {
      panelsOpened.push(panel?.id || String(panel));
    },
    activateWatchTab: (tab) => {
      events.push(`activateWatchTab:${tab}`);
    },
    resolvePreferredWatchOpenTab: (fallback) => fallback,
    createRun: async () => ({ run_id: "run_voice_001" }),
    window: {
      CSS_UI_LANG: "zh",
      dispatchEvent: (event) => {
        dispatchedEvents.push(event);
      }
    },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    startCreation: (...args) => {
      startCreationCalls.push(args);
      return Promise.resolve(true);
    },
    playFailureFallbackMedia: async (options) => {
      fallbackMediaCalls.push(options);
      return false;
    },
    setMicCaptureStatus: (...args) => {
      statuses.push(args);
    },
    updateLocalWorkRecord: (id, patch) => {
      workUpdates.push({ id, patch });
    }
  };

  Object.assign(sandbox, overrides);
  return {
    sandbox,
    events,
    startCreationCalls,
    optimisticWorks,
    workUpdates,
    panelsOpened,
    toasts,
    statuses,
    fallbackMediaCalls,
    dispatchedEvents
  };
}

function loadFunctionsIntoSandbox(sandbox, names) {
  const source = names.map((name) => extractFunctionSource(APP_SOURCE, name)).join("\n\n");
  vm.runInNewContext(source, sandbox, { filename: "public/app.js" });
}

test("voice confirmation enters the main creation chain with an optimistic card and existing run reuse", async () => {
  const ctx = buildVoiceFlowSandbox();
  loadFunctionsIntoSandbox(ctx.sandbox, [
    "getSongSeedTitleUserEditedFlag",
    "normalizeSongCreationPayload",
    "submitVoiceOrFallbackTitle"
  ]);

  const fakeBlob = {
    size: 4096,
    type: "audio/webm",
    async arrayBuffer() {
      return new Uint8Array([1, 2, 3, 4]).buffer;
    }
  };

  await ctx.sandbox.submitVoiceOrFallbackTitle(fakeBlob);

  assert.equal(ctx.optimisticWorks.length, 1);
  assert.equal(ctx.optimisticWorks[0].status, "queued");
  assert.equal(ctx.optimisticWorks[0].source, "voice");
  assert.equal(ctx.optimisticWorks[0].show_voice_source_badge, true);

  assert.equal(ctx.startCreationCalls.length, 1);
  const [titleArg, lyricsArg, optionsArg] = ctx.startCreationCalls[0];
  assert.equal(titleArg, "靈霄寶殿");
  assert.match(lyricsArg, /line:靈霄寶殿/);
  assert.equal(optionsArg.existingRunId, "run_voice_001");
  assert.equal(optionsArg.source, "voice");
  assert.equal(optionsArg.isSongSeedTitleUserEdited, false);
  assert.ok(optionsArg.localWorkId.startsWith("voice_"));

  assert.equal(ctx.fallbackMediaCalls.length, 0);
  assert.ok(ctx.panelsOpened.includes("for_you"));
  assert.ok(ctx.panelsOpened.includes("watch"));
  assert.equal(ctx.sandbox.watchSubtitle.textContent, "KaraOKe MV · 等待中");
  assert.equal(ctx.sandbox.state.songSeed.draft.source, "voice");
});

test("voice confirmation failure still advances UI and uses graceful fallback media without electronic tone", async () => {
  const ctx = buildVoiceFlowSandbox({
    createRun: async () => {
      throw new Error("stream disconnected before completion");
    }
  });
  loadFunctionsIntoSandbox(ctx.sandbox, [
    "getSongSeedTitleUserEditedFlag",
    "normalizeSongCreationPayload",
    "submitVoiceOrFallbackTitle"
  ]);

  const fakeBlob = {
    size: 2048,
    type: "audio/webm",
    async arrayBuffer() {
      return new Uint8Array([5, 6, 7, 8]).buffer;
    }
  };

  await ctx.sandbox.submitVoiceOrFallbackTitle(fakeBlob);

  assert.equal(ctx.startCreationCalls.length, 1);
  assert.equal(ctx.fallbackMediaCalls.length, 1);
  assert.equal(ctx.fallbackMediaCalls[0].preferDemoMedia, true);
  assert.equal(ctx.fallbackMediaCalls[0].allowSilence, true);
  assert.equal(ctx.workUpdates.length, 1);
  assert.equal(ctx.workUpdates[0].patch.status, "failed");
  assert.ok(ctx.toasts.includes("创作正在后台继续进行。"));
});

test("preview limit bypass grants full playback to admin, VIP, and the author", () => {
  const ctx = buildVoiceFlowSandbox({
    authState: { user: { id: "user_1", email: "owner@example.com", membership_tier: "free" } },
    getUserRole: () => "user",
    normalizeAccessTier: (tier) => String(tier || "")
  });
  loadFunctionsIntoSandbox(ctx.sandbox, ["isAdminUser", "canBypassPreviewLimit"]);

  assert.equal(
    ctx.sandbox.canBypassPreviewLimit(
      { id: "admin_id", membership_tier: "free", isAdmin: true },
      { owner_user_id: "other" }
    ),
    true
  );
  assert.equal(
    ctx.sandbox.canBypassPreviewLimit(
      { id: "vip_id", membership_tier: "vip", isVIP: true },
      { owner_user_id: "other" }
    ),
    true
  );
  assert.equal(
    ctx.sandbox.canBypassPreviewLimit(
      { id: "user_1", email: "owner@example.com", membership_tier: "free" },
      { owner_user_id: "user_1", owner_email: "owner@example.com" }
    ),
    true
  );
  assert.equal(
    ctx.sandbox.canBypassPreviewLimit(
      { id: "buyer", email: "buyer@example.com", membership_tier: "free" },
      { owner_user_id: "author", owner_email: "author@example.com" }
    ),
    false
  );
});
