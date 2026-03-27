function normalizeSongCreationPayload(payload = {}) {
  const source = String(payload?.source || state.songSeed?.draft?.source || "manual").trim() || "manual";
  const title = String(payload?.title || state.songSeed?.draft?.title || "").trim();
  const rawVoiceId = payload?.rawVoiceId ?? state.songSeed?.draft?.rawVoiceId ?? null;
  const rawTranscript = String(payload?.rawTranscript || state.songSeed?.draft?.rawTranscript || micState.transcript || "").trim();
  const workType = normalizeWorkTypeClient(payload?.workType || creationState.workType || "single");
  const existingRunId = String(payload?.existingRunId || "").trim();
  const localWorkId = String(payload?.localWorkId || "").trim();
  return {
    source,
    title,
    rawVoiceId: rawVoiceId ? String(rawVoiceId).trim() : null,
    rawTranscript,
    isSongSeedTitleUserEdited: getSongSeedTitleUserEditedFlag(payload),
    workType,
    existingRunId,
    localWorkId
  };
}

function buildDirectCreationFallbackTitle() {
  const userTitle = String(titleInput?.value || "").trim();
  if (userTitle && !isDemoTemplateTitle(userTitle)) return userTitle;
  const contextTitle = getSongSeedTitleContext();
  if (contextTitle && !isDemoTemplateTitle(contextTitle)) return contextTitle;
  const stateTitle = String(state.title || "").trim();
  if (stateTitle && !isDemoTemplateTitle(stateTitle)) return stateTitle;
  return buildFallbackSongSeedTitle();
}

function createFallbackLyricSeed(input) {
  const text = String(input || "cssos")
    .split("")
    .reduce((hash, char, index) => {
      const code = char.codePointAt(0) || 0;
      return (hash * 131 + code + index + 17) % 2147483647;
    }, 97);
  return text || 97;
}

function createFallbackLyricPicker(seedText) {
  let seed = createFallbackLyricSeed(seedText);
  const next = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  return (items) => {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return "";
    return list[Math.floor(next() * list.length) % list.length];
  };
}

function buildZhFallbackLyrics(subject, tone, vocal, workType) {
  const pick = createFallbackLyricPicker(`${subject}|${tone}|${vocal}|${workType}|zh`);
  const scenes = [
    "月光压在长阶上",
    "细雪落进空庭里",
    "潮声贴着旧城墙",
    "灯影停在檐角边",
    "风从竹影深处来",
    "雨丝绕过青石巷",
    "雾把远山轻轻藏起",
    "钟声穿过半开的窗"
  ];
  const details = [
    "衣角还带着未散的香",
    "指尖像碰到一段旧时光",
    "眼神里藏着没说完的倔强",
    "唇边只剩一寸微凉",
    "脚步比心事更轻",
    "回身时连沉默都发亮",
    "呼吸像水面慢慢晃",
    "连影子都不敢惊动夜晚"
  ];
  const emotions = [
    "舍不得",
    "不敢忘",
    "偏要等",
    "仍在想",
    "终于懂",
    "还想问",
    "不肯让",
    "慢慢亮"
  ];
  const chorusClosers = [
    "让我在余温里把你再认一遍",
    "让这一生的回望都落回心上",
    "让天光尽头还留着你的方向",
    "让风停下来替我们把名字轻放",
    "让最后一眼比初见更长",
    "让人间万物都替这句心事让路"
  ];
  const bridges = [
    "我把没说完的话折进袖口",
    "旧梦在耳边轻轻翻页",
    "连最迟的星光也开始靠近",
    "远处的桥影像一封没寄出的信",
    "连回声都替我把名字念慢",
    "这一刻连时间都学会侧身"
  ];
  const outros = [
    "镜头慢慢拉远，只剩风还记得来时的路",
    "最后只看见灯火退成一点，却还温着心口",
    "远景一点点散开，余温还留在指尖尽头",
    "等夜色合上门，我们的名字还轻轻发亮",
    "天边的光慢慢收住，只剩心跳替故事作结",
    "长街终于安静，只有那句没说完的话还在"
  ];
  const openings = [
    `${pick(scenes)}，${subject}像被谁轻轻唤醒`,
    `${subject}从${pick(scenes)}里走出来，${pick(details)}`,
    `${pick(scenes)}的时候，${subject}先比夜色亮了一层`,
    `${pick(scenes)}，${subject}带着${pick(details)}慢慢靠近`
  ];
  const verseTurns = [
    `${tone}落在肩头，${vocal}一开口就把旧事唱得很轻`,
    `${vocal}贴着${tone}的纹理，把最深的心事唱成回音`,
    `${tone}从衣襟滑到掌心，${vocal}把迟来的想念唱得很真`,
    `${vocal}顺着${tone}的呼吸，把夜里的波澜慢慢压稳`
  ];
  const chorusLeads = [
    `${subject}啊，我还是${pick(emotions)}`,
    `${subject}啊，原来我一直${pick(emotions)}`,
    `${subject}啊，让这颗心终于${pick(emotions)}`,
    `${subject}啊，连风都听见我在${pick(emotions)}`
  ];

  if (workType === "triptych") {
    return [
      `[Intro]`,
      openings[0],
      `${pick(details)}，像第一幕刚刚推开门。`,
      ``,
      `[Verse 1]`,
      verseTurns[0],
      `${pick(bridges)}，把人间的潮声都收进衣纹。`,
      ``,
      `[Chorus]`,
      chorusLeads[0],
      pick(chorusClosers),
      ``,
      `[Verse 2]`,
      openings[1],
      verseTurns[1],
      ``,
      `[Bridge]`,
      pick(bridges),
      `${pick(details)}，连月色都不忍出声。`,
      ``,
      `[Outro]`,
      pick(outros)
    ];
  }

  if (workType === "opera") {
    return [
      `[序幕]`,
      openings[2],
      `${pick(details)}，像命运在高处轻轻举灯。`,
      ``,
      `[主歌]`,
      verseTurns[2],
      `${pick(bridges)}，让众声都替这一眼回身。`,
      ``,
      `[副歌]`,
      chorusLeads[1],
      pick(chorusClosers),
      ``,
      `[终场]`,
      `${pick(scenes)}，${subject}仍在心上发声。`,
      pick(outros)
    ];
  }

  return [
    `[Intro]`,
    openings[3],
    `${pick(details)}。`,
    ``,
    `[Verse 1]`,
    verseTurns[3],
    `${pick(bridges)}，让夜色也放慢了脚跟。`,
    ``,
    `[Chorus]`,
    chorusLeads[2],
    pick(chorusClosers),
    ``,
    `[Verse 2]`,
    `${pick(scenes)}，我还在原地等那一句回声。`,
    `${pick(details)}，却还是愿意把真心捧稳。`,
    ``,
    `[Outro]`,
    pick(outros)
  ];
}

function buildEnFallbackLyrics(subject, tone, vocal, workType) {
  const pick = createFallbackLyricPicker(`${subject}|${tone}|${vocal}|${workType}|en`);
  const scenes = [
    "the lantern haze on the stairs",
    "snow breathing over the courtyard",
    "tide echoing past the old wall",
    "late light sleeping on the window frame",
    "mist folding the hills into silence",
    "rain threading through the alley",
    "the bell crossing a half-open room",
    "the river holding one pale shimmer"
  ];
  const details = [
    "your shadow staying warm at the edge",
    "my pulse learning how to move slowly",
    "the air carrying the shape of your name",
    "every quiet thing turning luminous",
    "the night opening without a sound",
    "my breath settling like silk in water"
  ];
  const chorus = [
    "stay in my chest a little longer",
    "leave your light where I can return",
    "turn this longing into something I can hold",
    "let the last look linger like dawn",
    "keep one honest ember alive in me"
  ];
  const outro = [
    "the camera pulls back and the warmth remains",
    "the distance widens but the glow keeps breathing",
    "the skyline softens and still I remember",
    "the last frame fades and your trace stays bright"
  ];
  if (workType === "opera") {
    return [
      "[Prelude]",
      `${subject} rises through ${pick(scenes)}, ${pick(details)}.`,
      "",
      "[Verse]",
      `A ${tone} fire moves beneath the ${vocal}, turning silence into vow.`,
      `Even the high rafters lean closer now.`,
      "",
      "[Chorus]",
      `${subject}, ${pick(chorus)}.`,
      `${pick(outro)}.`
    ];
  }
  return [
    "[Intro]",
    `${subject} appears through ${pick(scenes)}, ${pick(details)}.`,
    "",
    "[Verse 1]",
    `The ${vocal} carries ${tone} like a thread of light through the dark.`,
    `Every step leaves one more small spark.`,
    "",
    "[Chorus]",
    `${subject}, ${pick(chorus)}.`,
    "",
    "[Outro]",
    `${pick(outro)}.`
  ];
}

function buildLocalFallbackLyrics(title) {
  const safeTitle = String(title || "").trim() || buildDirectCreationFallbackTitle();
  if (isDemoTemplateTitle(safeTitle)) return [];
  const genre = String(creationState.selections?.genre || styleInput?.value || state.style || "").trim();
  const voice = String(voiceInput?.value || state.voice || "").trim();
  const lang = String(creationState.language || document.documentElement.lang || "zh").toLowerCase();
  const workType = normalizeWorkTypeClient(creationState.workType || "single");
  const zh = lang.startsWith("zh");
  const subject = safeTitle || (zh ? "未命名主题" : "Untitled theme");
  const tone = genre || (zh ? "当前风格" : "current style");
  const vocal = voice || (zh ? "当前声线" : "current voice");
  return zh
    ? buildZhFallbackLyrics(subject, tone, vocal, workType)
    : buildEnFallbackLyrics(subject, tone, vocal, workType);
}

function renderCreationUniverseCardModule(seed = state.songSeed) {
  if (!creationUniverseCard) return;
  const summary = seed?.creativeSummary || null;
  if (!summary) {
    creationUniverseCard.classList.add("is-empty");
    creationUniverseCard.innerHTML = `
      <div class="creation-universe-eyebrow">${escapeHtml(loginCopy("Current Universe", "当前宇宙"))}</div>
      <div class="creation-universe-body">${escapeHtml(loginCopy("When lyric magic lands, the current civilization, perspective, emotion, and structure will stay pinned here.", "歌词魔法生成后，这次的文明、视角、情绪和结构会固定显示在这里。"))}</div>
    `;
    return;
  }
  creationUniverseCard.classList.remove("is-empty");
  const chips = [
    summary.family ? loginCopy(`Family · ${summary.family}`, `风格 · ${summary.family}`) : "",
    summary.emotion ? loginCopy(`Mood · ${summary.emotion}`, `情绪 · ${summary.emotion}`) : "",
    summary.structure ? loginCopy(`Form · ${summary.structure}`, `结构 · ${summary.structure}`) : ""
  ].filter(Boolean);
  creationUniverseCard.innerHTML = `
    <div class="creation-universe-eyebrow">${escapeHtml(loginCopy("Current Universe", "当前宇宙"))}</div>
    <div class="creation-universe-headline">${escapeHtml(summary.civilization || summary.family || "")}</div>
    <div class="creation-universe-meta">
      ${chips.map((chip) => `<span class="creation-universe-chip">${escapeHtml(chip)}</span>`).join("")}
    </div>
    <div class="creation-universe-body">${escapeHtml([summary.perspective, summary.languageStyle].filter(Boolean).join(" · "))}</div>
  `;
}

function renderCreationReferenceLibraryModule() {
  if (!creationReferenceLibrary) return;
  const lang = String(creationState.language || "zh").trim().toLowerCase();
  const atlas = creationReferenceAtlas[lang] || creationReferenceAtlas.zh;
  creationReferenceLibrary.innerHTML = `
    <div class="creation-reference-region">${escapeHtml(atlas.region || "")}</div>
    <div class="creation-reference-group">
      <div class="creation-reference-title">${escapeHtml(loginCopy("Reference Artists", "参考音乐人"))}</div>
      <div class="creation-reference-note">${escapeHtml(atlas.artists.join(", "))}</div>
    </div>
    <div class="creation-reference-group">
      <div class="creation-reference-title">${escapeHtml(loginCopy("Reference Ensembles", "参考乐团/编制"))}</div>
      <div class="creation-reference-note">${escapeHtml(atlas.ensembles.join(", "))}</div>
    </div>
  `;
}

function syncScrollPeekModule(container) {
  if (!(container instanceof HTMLElement)) return;
  const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
  container.classList.toggle("is-scrollable", maxScroll > 6);
  container.classList.toggle("is-at-end", maxScroll <= 6 || container.scrollLeft >= maxScroll - 6);
}

function creationTabLabelModule(tabKey) {
  const map = {
    genre: "creation.tab.genre",
    mood: "creation.tab.mood",
    instrument: "creation.tab.instrument",
    ambience: "creation.tab.ambience",
    vocalGender: "creation.tab.vocalGender"
  };
  return t(map[tabKey] || "") || tabKey;
}

function creationChipLabelModule(tabKey, value) {
  const key = `creation.option.${tabKey}.${String(value || "")
    .replace(/&/g, "and")
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "")
    .toLowerCase()}`;
  const translated = t(key);
  return translated || value;
}

function syncCreationTabsDomModule(tabDefs = []) {
  if (!(creationTabs instanceof HTMLElement)) return;
  const existing = new Map(
    Array.from(creationTabs.querySelectorAll("[data-creation-tab]")).map((node) => [
      node.getAttribute("data-creation-tab") || "",
      node
    ])
  );
  const seen = new Set();
  tabDefs.forEach((tab, index) => {
    const key = String(tab.key || "");
    if (!key) return;
    seen.add(key);
    let button = existing.get(key);
    if (!(button instanceof HTMLButtonElement)) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "creation-tab";
      button.dataset.creationTab = key;
    }
    button.textContent = creationTabLabelModule(key);
    button.classList.toggle("active", creationState.activeTab === key);
    const currentChild = creationTabs.children[index];
    if (currentChild !== button) {
      creationTabs.insertBefore(button, currentChild || null);
    }
  });
  existing.forEach((node, key) => {
    if (!seen.has(key)) node.remove();
  });
}

function syncCreationChipsDomModule(items = [], selected = "") {
  if (!(creationChips instanceof HTMLElement)) return;
  const existing = new Map(
    Array.from(creationChips.querySelectorAll("[data-creation-chip]")).map((node) => [
      node.getAttribute("data-creation-chip") || "",
      node
    ])
  );
  const seen = new Set();
  items.forEach((item, index) => {
    const value = String(item || "");
    seen.add(value);
    let button = existing.get(value);
    if (!(button instanceof HTMLButtonElement)) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "creation-chip";
      button.dataset.creationChip = value;
    }
    button.textContent = creationChipLabelModule(creationState.activeTab, value);
    button.classList.toggle("active", selected === value);
    const currentChild = creationChips.children[index];
    if (currentChild !== button) {
      creationChips.insertBefore(button, currentChild || null);
    }
  });
  existing.forEach((node, key) => {
    if (!seen.has(key)) node.remove();
  });
}

let creationConsoleExtrasFrameModule = 0;
let creationConsoleRenderFrameModule = 0;
const creationConsoleViewStateModule = {
  activeTab: "",
  selectedChip: "",
  chipItemsSignature: ""
};

function scheduleCreationConsoleExtrasModule(seed = state.songSeed) {
  if (creationConsoleExtrasFrameModule) {
    cancelAnimationFrame(creationConsoleExtrasFrameModule);
  }
  creationConsoleExtrasFrameModule = requestAnimationFrame(() => {
    creationConsoleExtrasFrameModule = 0;
    renderCreationUniverseCardModule(seed);
    renderCreationReferenceLibraryModule();
    syncScrollPeekModule(creationTabs);
    syncScrollPeekModule(creationChips);
  });
}

function flushRenderCreationConsoleModule() {
  if (!creationTabs || !creationChips) return;
  const tabDefs = [
    { key: "genre" },
    { key: "mood" },
    { key: "instrument" },
    { key: "ambience" },
    { key: "vocalGender" }
  ];
  const items = creationOptionCatalog[creationState.activeTab] || [];
  const selected = creationState.selections[creationState.activeTab] || "";
  const chipItemsSignature = `${creationState.activeTab}::${items.join("|")}`;
  if (creationConsoleViewStateModule.activeTab !== creationState.activeTab) {
    syncCreationTabsDomModule(tabDefs);
  }
  if (
    creationConsoleViewStateModule.activeTab !== creationState.activeTab ||
    creationConsoleViewStateModule.selectedChip !== selected ||
    creationConsoleViewStateModule.chipItemsSignature !== chipItemsSignature
  ) {
    syncCreationChipsDomModule(items, selected);
  }
  creationConsoleViewStateModule.activeTab = creationState.activeTab;
  creationConsoleViewStateModule.selectedChip = selected;
  creationConsoleViewStateModule.chipItemsSignature = chipItemsSignature;

  if (creationTempo) creationTempo.value = String(creationState.tempo);
  if (creationKey) creationKey.value = creationState.key;
  if (creationDuration) creationDuration.value = String(creationState.duration);
  if (creationLanguage) creationLanguage.value = creationState.language;
  if (creationWorkType) creationWorkType.value = normalizeWorkTypeClient(creationState.workType);
  if (creationInstrumentation && document.activeElement !== creationInstrumentation) creationInstrumentation.value = creationState.instrumentation;
  if (creationVocalStyle && document.activeElement !== creationVocalStyle) creationVocalStyle.value = creationState.vocalStyle;
  if (creationEnsembleStyle && document.activeElement !== creationEnsembleStyle) creationEnsembleStyle.value = creationState.ensembleStyle;
  if (creationLicensedStylePack && document.activeElement !== creationLicensedStylePack) creationLicensedStylePack.value = creationState.licensedStylePack;
  if (creationExternalAudioAdapter && document.activeElement !== creationExternalAudioAdapter) creationExternalAudioAdapter.value = creationState.externalAudioAdapter;
  if (creationArrangementDensity && document.activeElement !== creationArrangementDensity) creationArrangementDensity.value = String(creationState.arrangementDensity);
  if (creationDynamicsCurve && document.activeElement !== creationDynamicsCurve) creationDynamicsCurve.value = creationState.dynamicsCurve;
  if (creationSectionForm && document.activeElement !== creationSectionForm) creationSectionForm.value = creationState.sectionForm;
  if (creationArticulationBias && document.activeElement !== creationArticulationBias) creationArticulationBias.value = creationState.articulationBias;
  if (creationVoicingRegister && document.activeElement !== creationVoicingRegister) creationVoicingRegister.value = creationState.voicingRegister;
  if (creationPercussionActivity && document.activeElement !== creationPercussionActivity) creationPercussionActivity.value = String(creationState.percussionActivity);
  if (creationExpressionCcBias && document.activeElement !== creationExpressionCcBias) creationExpressionCcBias.value = creationState.expressionCcBias;
  if (creationHumanization && document.activeElement !== creationHumanization) creationHumanization.value = String(creationState.humanization);
  if (creationInspirationNotes && creationInspirationNotes.value !== creationState.inspirationNotes) creationInspirationNotes.value = creationState.inspirationNotes;
  const pricingDefaults = workTypePricingDefaults(creationState.workType);
  if (creationDefaultListen && document.activeElement !== creationDefaultListen) {
    creationDefaultListen.value = (pricingDefaults.listenCents / 100).toFixed(2);
  }
  if (creationDefaultBuyout && document.activeElement !== creationDefaultBuyout) {
    creationDefaultBuyout.value = (pricingDefaults.buyoutCents / 100).toFixed(2);
  }
  if (creationDefaultsRow) creationDefaultsRow.hidden = getUserRole() !== "admin";
  if (creationSetDefaults) creationSetDefaults.hidden = getUserRole() !== "admin";
  if (creationPrompt && creationPrompt.value !== creationState.prompt) creationPrompt.value = creationState.prompt;
  if (creationPromptCount) creationPromptCount.textContent = `${creationState.prompt.length}/500`;
  if (creationSummary) creationSummary.textContent = creationSummaryText();
  if (creationStyleCount) creationStyleCount.textContent = `${String(styleInput?.value || creationSummaryText()).length}/2000`;
  scheduleCreationConsoleExtrasModule(state.songSeed);
}

function renderCreationConsoleModule() {
  if (creationConsoleRenderFrameModule) return;
  creationConsoleRenderFrameModule = requestAnimationFrame(() => {
    creationConsoleRenderFrameModule = 0;
    flushRenderCreationConsoleModule();
  });
}

function initCreationConsoleModule() {
  if (!creationTabs || !creationChips) return;
  renderCreationConsoleModule();
  syncCreationStateToLegacyInputs();

  creationTabs.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const key = target.dataset.creationTab;
    if (!key) return;
    creationState.activeTab = key;
    renderCreationConsoleModule();
  });
  creationTabs.addEventListener("scroll", () => syncScrollPeekModule(creationTabs), { passive: true });
  creationChips.addEventListener("scroll", () => syncScrollPeekModule(creationChips), { passive: true });

  creationChips.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const chip = target.dataset.creationChip;
    if (!chip) return;
    const key = creationState.activeTab;
    markCreationFieldTouched(key);
    creationState.selections[key] = creationState.selections[key] === chip ? "" : chip;
    syncCreationStateToLegacyInputs();
    renderCreationConsoleModule();
  });

  creationTempo?.addEventListener("input", () => {
    markCreationFieldTouched("tempo");
    creationState.tempo = Math.max(40, Math.min(220, Number(creationTempo.value || 88)));
    renderCreationConsoleModule();
  });
  creationKey?.addEventListener("change", () => {
    markCreationFieldTouched("key");
    creationState.key = creationKey.value || "C";
    renderCreationConsoleModule();
  });
  creationDuration?.addEventListener("input", () => {
    markCreationFieldTouched("duration");
    const preset = getMembershipPreset();
    const rawDuration = Number(creationDuration.value || 180);
    const allowedDuration = Math.max(30, Math.min(preset.maxDurationSec || 30, rawDuration));
    creationState.duration = allowedDuration;
    if (rawDuration > allowedDuration) {
      creationDuration.value = String(allowedDuration);
      safeShowToast(
        loginCopy(
          `Your ${describeMembershipTier()} plan currently supports up to ${allowedDuration} seconds.`,
          `你当前的${describeMembershipTier()}档位，最长支持 ${allowedDuration} 秒。`
        )
      );
    }
    renderCreationConsoleModule();
  });
  creationLanguage?.addEventListener("change", () => {
    markCreationFieldTouched("language");
    creationState.language = creationLanguage.value || "zh";
    const capability = enforceCreationCapability({ skipLoginPrompt: true });
    if (!capability.ok && capability.reason === "creator_boost_language") {
      creationState.language = "zh";
      creationLanguage.value = "zh";
    }
    renderCreationConsoleModule();
  });
  creationWorkType?.addEventListener("change", () => {
    markCreationFieldTouched("workType");
    const nextWorkType = normalizeWorkTypeClient(creationWorkType.value || "single");
    const capability = enforceCreationCapability({ workType: nextWorkType, skipLoginPrompt: true });
    if (!capability.ok && capability.reason === "work_type_limit") {
      creationState.workType = "single";
      creationWorkType.value = "single";
    } else {
      creationState.workType = nextWorkType;
    }
    renderCreationConsoleModule();
  });
  creationInstrumentation?.addEventListener("input", () => {
    markCreationFieldTouched("instrumentation");
    creationState.instrumentation = String(creationInstrumentation.value || "").slice(0, 400);
    syncCreationStateToLegacyInputs();
    renderCreationConsoleModule();
  });
  creationVocalStyle?.addEventListener("input", () => {
    markCreationFieldTouched("vocalStyle");
    creationState.vocalStyle = String(creationVocalStyle.value || "").slice(0, 240);
    enforceCreationCapability({ skipLoginPrompt: true });
    renderCreationConsoleModule();
  });
  creationEnsembleStyle?.addEventListener("input", () => {
    markCreationFieldTouched("ensembleStyle");
    creationState.ensembleStyle = String(creationEnsembleStyle.value || "").slice(0, 240);
    enforceCreationCapability({ skipLoginPrompt: true });
    syncCreationStateToLegacyInputs();
    renderCreationConsoleModule();
  });
  creationLicensedStylePack?.addEventListener("input", () => {
    markCreationFieldTouched("licensedStylePack");
    creationState.licensedStylePack = String(creationLicensedStylePack.value || "").slice(0, 240);
    renderCreationConsoleModule();
  });
  creationExternalAudioAdapter?.addEventListener("input", () => {
    markCreationFieldTouched("externalAudioAdapter");
    creationState.externalAudioAdapter = String(creationExternalAudioAdapter.value || "").slice(0, 240);
    renderCreationConsoleModule();
  });
  creationArrangementDensity?.addEventListener("input", () => {
    creationState.arrangementDensity = Math.max(0.2, Math.min(1, Number(creationArrangementDensity.value || 0.6)));
    renderCreationConsoleModule();
  });
  creationDynamicsCurve?.addEventListener("input", () => {
    creationState.dynamicsCurve = String(creationDynamicsCurve.value || "").slice(0, 240);
    renderCreationConsoleModule();
  });
  creationSectionForm?.addEventListener("input", () => {
    creationState.sectionForm = String(creationSectionForm.value || "").slice(0, 240);
    renderCreationConsoleModule();
  });
  creationArticulationBias?.addEventListener("input", () => {
    creationState.articulationBias = String(creationArticulationBias.value || "").slice(0, 240);
    renderCreationConsoleModule();
  });
  creationVoicingRegister?.addEventListener("input", () => {
    creationState.voicingRegister = String(creationVoicingRegister.value || "").slice(0, 240);
    renderCreationConsoleModule();
  });
  creationPercussionActivity?.addEventListener("input", () => {
    creationState.percussionActivity = Math.max(0, Math.min(1, Number(creationPercussionActivity.value || 0.45)));
    renderCreationConsoleModule();
  });
  creationExpressionCcBias?.addEventListener("input", () => {
    creationState.expressionCcBias = String(creationExpressionCcBias.value || "").slice(0, 240);
    renderCreationConsoleModule();
  });
  creationHumanization?.addEventListener("input", () => {
    creationState.humanization = Math.max(0, Math.min(1, Number(creationHumanization.value || 0.35)));
    renderCreationConsoleModule();
  });
  creationInspirationNotes?.addEventListener("input", () => {
    markCreationFieldTouched("inspirationNotes");
    creationState.inspirationNotes = String(creationInspirationNotes.value || "").slice(0, 1000);
    renderCreationConsoleModule();
  });
  creationDefaultListen?.addEventListener("input", () => {
    // keep value user-editable until save
  });
  creationDefaultBuyout?.addEventListener("input", () => {
    // keep value user-editable until save
  });
  creationPrompt?.addEventListener("input", () => {
    markCreationFieldTouched("prompt");
    creationState.prompt = String(creationPrompt.value || "").slice(0, 500);
    renderCreationConsoleModule();
  });
  titleInput?.addEventListener("input", () => {
    titleInput.dataset.userEdited = "1";
    state.title = String(titleInput.value || "").trim() || state.title;
    updateEnginePanels(titleInput?.value?.trim() || state.title, (lyricsInput?.value || "").split("\n"));
  });
  styleInput?.addEventListener("input", () => {
    markCreationFieldTouched("styleText");
    renderCreationConsoleModule();
    updateEnginePanels(titleInput?.value?.trim() || state.title, (lyricsInput?.value || "").split("\n"));
  });
  creationClear?.addEventListener("click", () => {
    const defaults = panelDefaultsState.creation || {
      creative: {
        genre: "Chinese GuFeng",
        mood: "",
        instrument: "",
        instrumentation: "",
        ambience: "",
        vocal_gender: "Feminine",
        vocal_style: "",
        ensemble_style: "",
        arrangement_density: 0.6,
        dynamics_curve: "",
        section_form: "",
        articulation_bias: "",
        voicing_register: "",
        percussion_activity: 0.45,
        expression_cc_bias: "",
        humanization: 0.35,
        inspiration_notes: "",
        licensed_style_pack: "",
        external_audio_adapter: "",
        tempo_bpm: 88,
        musical_key: "C",
        duration_s: 180,
        language: "zh",
        prompt: "",
        work_type: "single"
      }
    };
    applyCreationDefaults(defaults);
    if (titleInput) {
      titleInput.value = "";
      titleInput.dataset.userEdited = "0";
    }
    if (lyricsInput) lyricsInput.value = "";
    if (lyricsSourceInput) lyricsSourceInput.value = "";
    if (styleInput) styleInput.value = "";
    if (musicStructureInput) musicStructureInput.value = "";
    if (videoOutlineInput) videoOutlineInput.value = "";
    if (sectionPromptsInput) sectionPromptsInput.value = "";
    state.songSeed = null;
    renderSongSeedPreview(null);
    renderCreationConsoleModule();
    showToast(t("action.clearAll"));
  });
  bindSeedRefreshButton(styleRegenerate, "style");
  bindSeedRefreshButton(musicStructureRegenerate, "structure");
  bindSeedRefreshButton(videoOutlineRegenerate, "outline");
  bindSeedRefreshButton(sectionPromptsRegenerate, "scenes");
  creationSetDefaults?.addEventListener("click", () => {
    void saveCreationPanelDefaults(creationSetDefaults);
  });
}

function shouldRetryAutoSongSeedTitleModule(title) {
  return !shouldPreserveSongSeedTitleForRefresh() && hasRecentAutoSongSeedTitle(title);
}

function formatCreationLanguageBadgeModule(lang) {
  const value = String(lang || "").trim().toLowerCase();
  if (value === "ja") return "JP";
  if (value === "en") return "EN";
  if (value === "zh") return loginCopy("CN", "中文");
  return value.toUpperCase() || "--";
}

function describeCreationRandomizationModule() {
  return [
    formatCreationLanguageBadgeModule(creationState.language),
    `${creationState.tempo} BPM`,
    `${creationState.key} major`,
    `${creationState.duration}s`
  ].join(" · ");
}

function openCreationConsoleModule() {
  openPanel(settingsPanel);
  creationState.activeTab = "genre";
  renderCreationConsoleModule();
  const box = document.getElementById("creation-console");
  box?.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function startCreation(customTitle, customLyrics, options = {}) {
  if (authState.user && !creatorBoostState.loaded) {
    await loadCreatorBoostState().catch(() => null);
  }
  const creationPayload = normalizeSongCreationPayload({
    ...(options && typeof options === "object" ? options : {}),
    title: customTitle,
    rawTranscript: options?.rawTranscript || micState.transcript || ""
  });
  const capability = enforceCreationCapability({
    mode: "music_video",
    durationSec: Number(creationState.duration || 180),
    workType: creationState.workType
  });
  if (!capability.ok) return false;
  const boostConsumed = await consumeCreatorBoostsIfNeeded();
  if (!boostConsumed) return false;
  const signature = buildCreationSignature(customTitle, customLyrics, "music_video");
  if (shouldSkipDuplicateCreation(signature)) {
    return false;
  }
  markCreationStarted(signature);
  let shouldReleaseLock = true;
  try {
    if (zeroThresholdAutoplayRequested) {
      primeZeroThresholdAudioPreviewModule(state.songSeed || {});
    }
    let title = String(customTitle || "").trim();
    let baseLines = customLyrics?.trim() ? customLyrics.trim().split("\n") : [];
    let usedSongSeed = false;
    const zeroThresholdFastPath =
      zeroThresholdAutoplayRequested &&
      !baseLines.length &&
      !String(customTitle || "").trim();
    if (!baseLines.length && !zeroThresholdFastPath) {
      const seed = await runLyricsGenerate("music_video");
      if (isSongSeedQuotaExceeded(seed)) {
        safeShowToast(getSongSeedQuotaExceededMessage(seed));
        return false;
      }
      if (seed?.ok && !seed?.empty && seed?.data?.lyrics) {
        usedSongSeed = true;
        title = String(title || seed.data.title || "").trim();
        baseLines = extractDisplayLyricLines(String(seed.data.lyrics || ""));
      }
    }
    if (!baseLines.length) {
      title = title || buildDirectCreationFallbackTitle();
      baseLines = buildLocalFallbackLyrics(title);
      if (!baseLines.length) {
        setMicCaptureStatus(
          "fallback",
          loginCopy("Media fallback engaged", "已切换到媒体回退"),
          loginCopy(
            "No reliable lyric seed was produced, so cssOS is switching to demo media instead of replaying a stock template.",
            "没有拿到可靠歌词种子，因此 cssOS 会直接切到 demo 媒体，而不是重放老模板。"
          )
        );
        await playWatchPanelFailureFallback({ preferDemoMedia: true, allowSilence: true });
        safeShowToast(
          loginCopy(
            "No fresh lyric seed was available. Demo media is now carrying the experience.",
            "没有拿到新的歌词种子，现由 demo 媒体承接这次体验。"
          )
        );
        return false;
      }
      setMicCaptureStatus(
        "fallback",
        loginCopy("Random lyrics engaged", "已切换到随机歌词"),
        loginCopy(
          "No reliable lyric seed was produced, so cssOS generated a fresh fallback lyric instead of reusing script fragments.",
          "没有拿到可靠歌词种子，因此 cssOS 已改为现场随机生成歌词，而不是拼接脚本碎片。"
        )
      );
    }
    if (!usedSongSeed) {
      state.songSeed = null;
      renderSongSeedPreviewModule(null);
      if (zeroThresholdAutoplayRequested) {
        primeZeroThresholdAudioPreviewModule({});
      }
    }
    title = title || buildDirectCreationFallbackTitle();
    if (creationPayload.localWorkId) {
      updateLocalWorkRecord(creationPayload.localWorkId, {
        title,
        status: "generating_lyrics",
        source: creationPayload.source,
        raw_voice_id: creationPayload.rawVoiceId || "",
        raw_transcript: creationPayload.rawTranscript,
        show_voice_source_badge: creationPayload.source === "voice",
        is_song_seed_title_user_edited: creationPayload.isSongSeedTitleUserEdited
      });
      void refreshWorkSurfaces();
    }
    const lines = replaceSpellInLines(baseLines, DEFAULT_SPELL, state.spell);
    const lyricText = buildLyricsText(title, lines);
    lyricsTargetLength = lyricText.length;

    watchSubtitle.textContent = "KaraOKe MV · Rendering";
    cssmvTriggered = false;
    watchTriggered = false;
    resetTypingState();
    resetEngineStates();
    maybeCompactForyouAfterLyrics({ armAuto: false });
    syncForyouThumbFromLyrics(title, lines);
    cssmvPanel.classList.add("hidden");
    watchPanel.classList.add("hidden");
    updateDockVisibility();
    typewriter(lyricsEl, lyricText, LYRICS_TYPEWRITER_SPEED);
    animateProgress();
    updateEnginePanels(title, lines);
    state.baseLines = baseLines;
    state.lines = lines;
    const allowed = await consumeGeneration();
    if (!allowed) return false;
    requestWatchVideoPreviewModule(title, lines);
    if (creationPayload.localWorkId) {
      updateLocalWorkRecord(creationPayload.localWorkId, { status: "generating_video" });
      currentWatchPreviewWork =
        listLocalWorksForCurrentUser().find((work) => String(work?.local_id || work?.work_id || "").trim() === creationPayload.localWorkId) ||
        currentWatchPreviewWork;
    }
    void createMyWorkRecord(title, lines, creationPayload);
    if (creationPayload.existingRunId) {
      currentWatchAudioRunId = creationPayload.existingRunId;
      currentWatchAudioRunError = "";
      updateWatchAudioDebug();
      startPipelineProgressPolling(creationPayload.existingRunId);
      startPendingFinalAudioPolling(creationPayload.existingRunId);
      void attemptImmediateFinalAudioAttach(creationPayload.existingRunId);
    } else {
      void runPipeline(getMicJobId(), title, lyricText);
    }
    openPanel(foryouPanel);
    openPanel(watchPanel);
    activateWatchTab(resolvePreferredWatchOpenTab("mv"));
    revealEnginePanel("lyrics");
    layoutShowcasePanels();
    shouldReleaseLock = false;
    return true;
  } finally {
    if (shouldReleaseLock) {
      markCreationFinished();
    }
  }
}

async function runPipeline(jobId, title, lyrics) {
  try {
    startRecentRunRecovery(title);
    const musicAllowed = await consumeBillableAction("music_generate", {
      meta: {
        job_id: jobId,
        title: String(title || "").trim().slice(0, 120),
        work_type: normalizeWorkTypeClient(creationState.workType || "single"),
        duration_sec: Number(creationState.duration || 180)
      }
    });
    if (!musicAllowed) {
      throw new Error("music_generate_billing_blocked");
    }
    const uiLang = String(window.CSS_UI_LANG || document.documentElement.lang || creationState.language || "zh");
    const tier = getAccessTier();
    const voice = {
      bytes: 0,
      mime: "text/plain",
      mode: normalizeWorkTypeClient(creationState.workType || "single"),
      job_id: String(jobId || "").trim()
    };
    currentWatchAudioRunError = "";
    updateWatchAudioDebug();
    const json = await createRun({
      title,
      uiLang,
      tier,
      voice,
      lyricsText: lyrics,
      jobId
    });
    let runId = String(json?.run_id || json?.data?.run_id || "").trim();
    if (!runId) {
      runId = await recoverRecentRunId(title);
    }
    if (runId) {
      stopRecentRunRecovery();
      currentWatchAudioRunId = runId;
      currentWatchAudioRunError = "";
      updateWatchAudioDebug();
      window.dispatchEvent(
        new CustomEvent("cssos:run_created", {
          detail: { run_id: runId, title: String(title || "").trim() }
        })
      );
      startPipelineProgressPolling(runId);
      startPendingFinalAudioPolling(runId);
    }
    if (!runId) {
      currentWatchAudioRunError = "run_id_missing";
      updateWatchAudioDebug();
    }
    return json;
  } catch (error) {
    if (!currentWatchAudioRunId) {
      startRecentRunRecovery(title);
    }
    currentWatchAudioRunError = String(error?.message || error || "run_pipeline_failed")
      .replace(/\s+/g, "_")
      .slice(0, 80);
    updateWatchAudioDebug();
    throw error;
  }
}

async function startCreationWithLyrics(title, lyricsText) {
  if (authState.user && !creatorBoostState.loaded) {
    await loadCreatorBoostState().catch(() => null);
  }
  const capability = enforceCreationCapability({
    mode: "music_video",
    durationSec: Number(creationState.duration || 180),
    workType: creationState.workType
  });
  if (!capability.ok) return false;
  const boostConsumed = await consumeCreatorBoostsIfNeeded();
  if (!boostConsumed) return false;
  const signature = buildCreationSignature(title, lyricsText, "music_video");
  if (shouldSkipDuplicateCreation(signature)) {
    return false;
  }
  markCreationStarted(signature);
  let shouldReleaseLock = true;
  try {
    if (!state.songSeed) renderSongSeedPreviewModule(null);
    const lines = lyricsText.trim().split("\n");
    void createMyWorkRecord(title, lines);
    const lyricText = buildLyricsText(title, lines);
    lyricsTargetLength = lyricText.length;

    watchSubtitle.textContent = "KaraOKe MV · Rendering";
    cssmvTriggered = false;
    watchTriggered = false;
    resetTypingState();
    resetEngineStates();
    maybeCompactForyouAfterLyrics({ armAuto: false });
    syncForyouThumbFromLyrics(title, lines);
    cssmvPanel.classList.add("hidden");
    watchPanel.classList.add("hidden");
    updateDockVisibility();
    typewriter(lyricsEl, lyricText, LYRICS_TYPEWRITER_SPEED);
    animateProgress();
    updateEnginePanels(title, lines);
    state.baseLines = lines;
    state.lines = lines;
    state.title = title;
    const allowed = await consumeGeneration();
    if (!allowed) return false;
    void runPipeline(getMicJobId(), title, lyricText);
    openPanel(foryouPanel);
    revealEnginePanel("lyrics");
    layoutShowcasePanels();
    shouldReleaseLock = false;
    return true;
  } finally {
    if (shouldReleaseLock) {
      markCreationFinished();
    }
  }
}

Object.assign(globalThis, {
  renderCreationUniverseCardModule,
  renderCreationReferenceLibraryModule,
  creationTabLabelModule,
  creationChipLabelModule,
  scheduleCreationConsoleExtrasModule,
  syncCreationTabsDomModule,
  syncCreationChipsDomModule,
  flushRenderCreationConsoleModule,
  renderCreationConsoleModule,
  initCreationConsoleModule
});
