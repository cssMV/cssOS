let zeroInputPreludeTimer = null;
let watchPipelineContinuationTimer = null;
let lastWatchPipelineContinuationSignature = "";
globalThis.watchPipelineLaunchPending ??= false;

function stopZeroInputPreludeModule() {
  if (zeroInputPreludeTimer) {
    clearInterval(zeroInputPreludeTimer);
    zeroInputPreludeTimer = null;
  }
}

function applyZeroInputStageVisualModule(stage, subtitle, teaser = "") {
  const tone =
    stage === "callback" ? "callback" : stage === "chorus" ? "group" : "opening";
  globalThis.watchNarrativeTone = tone;
  if (watchSubtitle) {
    watchSubtitle.classList.remove("tone-opening", "tone-lead", "tone-group", "tone-callback");
    watchSubtitle.classList.add(`tone-${tone}`);
  }
  syncWatchEngineGrid();
  if (watchSvg) {
    watchSvg.style.display = "none";
    watchSvg.removeAttribute("src");
    watchSvg.setAttribute("alt", "");
  }
  if (watchScreenBackdrop) {
    watchScreenBackdrop.style.backgroundImage = "";
  }
}

function randomZeroInputPreludePackModule() {
  const packs = [
    {
      subtitle: loginCopy("KaraOKe MV · Catching a first spark"),
      lyricLead: loginCopy("listening for the opening line"),
      musicLead: loginCopy("hearing the pulse under the silence"),
      videoLead: loginCopy("imagining distance, light, and bodies"),
      karaLead: loginCopy("waiting for the chorus to ask for subtitles"),
      teaser: loginCopy(
        "Nothing was typed. cssOS is improvising a fresh song, camera arc, and karaoke cut from pure imagination."
      )
    },
    {
      subtitle: loginCopy("KaraOKe MV · Writing in the air"),
      lyricLead: loginCopy("finding an image worth singing first"),
      musicLead: loginCopy("letting the chorus discover its own gravity"),
      videoLead: loginCopy("blocking entrances, exits, and a return shot"),
      karaLead: loginCopy("holding space for the lines to glow on beat"),
      teaser: loginCopy(
        "cssOS is inventing a one-tap MV with no prompt, no upload, and no borrowed script fragments."
      )
    },
    {
      subtitle: loginCopy("KaraOKe MV · Improvising a world"),
      lyricLead: loginCopy("pulling a motif out of thin air"),
      musicLead: loginCopy("building the lift that will carry the hook"),
      videoLead: loginCopy("turning scattered figures into scene changes"),
      karaLead: loginCopy("saving a place for the last line to land"),
      teaser: loginCopy(
        "Fresh lyrics, music, and moving images are being composed live so this click can return as a complete MV."
      )
    }
  ];
  return packs[Math.floor(Math.random() * packs.length)] || packs[0];
}

function startZeroInputPreludeModule() {
  stopZeroInputPreludeModule();
  const phases = [
    {
      subtitle: loginCopy("KaraOKe MV · Catching a first line"),
      lyrics: loginCopy("opening image is arriving"),
      music: loginCopy("the hidden pulse is starting to move"),
      video: loginCopy("distance and light are being staged"),
      kara: loginCopy("the chorus has not asked to glow yet")
    },
    {
      subtitle: loginCopy("KaraOKe MV · Lifting the chorus"),
      lyrics: loginCopy("the refrain is answering the first image"),
      music: loginCopy("the hook is finding its way home"),
      video: loginCopy("two-shots and group motion are taking shape"),
      kara: loginCopy("timing space is opening for the chorus")
    },
    {
      subtitle: loginCopy("KaraOKe MV · Setting the callback"),
      lyrics: loginCopy("the ending is being taught what to answer"),
      music: loginCopy("the final return is being tuned"),
      video: loginCopy("the release shot is waiting behind the crowd"),
      kara: loginCopy("the last line is keeping time offscreen")
    }
  ];
  const pack = randomZeroInputPreludePackModule();
  let phaseIndex = 0;
  if (watchSubtitle) watchSubtitle.textContent = pack.subtitle;
  setEngineProgressVisible("lyrics", true, { immediate: true });
  setEngineProgressVisible("music", true, { immediate: true });
  setEngineProgressVisible("video", true, { immediate: true });
  setEngineProgressVisible("kara", true, { immediate: true });
  applyZeroInputStageVisualModule("opening", pack.subtitle, pack.teaser);
  setEngineDetail("lyrics", pack.lyricLead);
  setEngineDetail("music", pack.musicLead);
  setEngineDetail("video", pack.videoLead);
  setEngineDetail("kara", pack.karaLead);
  zeroInputPreludeTimer = setInterval(() => {
    const phase = phases[phaseIndex % phases.length];
    const visualStage = phaseIndex % phases.length === 1 ? "chorus" : phaseIndex % phases.length === 2 ? "callback" : "opening";
    phaseIndex += 1;
    if (watchSubtitle) watchSubtitle.textContent = phase.subtitle;
    applyZeroInputStageVisualModule(visualStage, phase.subtitle, phase.video);
    setEngineDetail("lyrics", phase.lyrics);
    setEngineDetail("music", phase.music);
    setEngineDetail("video", phase.video);
    setEngineDetail("kara", phase.kara);
  }, 1800);
  return pack;
}

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

function resolveCreationSurfaceOriginForPayload(payload = {}, title = "", lyricsText = "") {
  const source = String(payload?.source || "").trim();
  if (source === "voice") return "dock";
  if (String(title || "").trim() || String(lyricsText || "").trim()) return "settings";
  return "logo";
}

function presentCreationSurfaceForPayload(payload = {}, options = {}) {
  const origin = resolveCreationSurfaceOriginForPayload(
    payload,
    options.title,
    options.lyricsText
  );
  if (typeof globalThis.showCreationSurfaceModule === "function") {
    globalThis.showCreationSurfaceModule(origin);
    return;
  }
  if (typeof globalThis.openMinimalCreationResultSurfaceModule === "function") {
    globalThis.openMinimalCreationResultSurfaceModule({ preferredTab: "mv" });
  }
}

function ensureWatchPipelineContinuationModule(options = {}) {
  if (watchPipelineContinuationTimer) {
    clearTimeout(watchPipelineContinuationTimer);
    watchPipelineContinuationTimer = null;
  }
  const title = String(options?.title || state.title || "").trim();
  const lines = compactLyricLines(
    Array.isArray(options?.lines) && options.lines.length
      ? options.lines
      : Array.isArray(state.lines)
        ? state.lines
        : String(lyricsEl?.textContent || "").split("\n")
  ).filter(Boolean);
  if (!title || !lines.length) return false;
  if (!hasCompleteSongSeedSnapshotModule(state.songSeed)) return false;
  if (globalThis.lyricsSeedRequestState?.pending) return false;
  if (globalThis.watchPipelineLaunchPending) return false;
  const activeRunId = String(
    currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || ""
  ).trim();
  if (activeRunId) return false;
  const signature = JSON.stringify([title, lines.slice(0, 6).join("\n")]);
  if (signature === lastWatchPipelineContinuationSignature) return false;
  watchPipelineContinuationTimer = setTimeout(async () => {
    watchPipelineContinuationTimer = null;
    const reboundRunId = String(
      currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || ""
    ).trim();
    if (reboundRunId || globalThis.lyricsSeedRequestState?.pending) return;
    lastWatchPipelineContinuationSignature = signature;
    const lyricText = buildLyricsText(title, lines);
    setEngineState("lyrics", "done");
    setEngineDetail("lyrics", "stage: done");
    setEngineProgressVisible("lyrics", false, { immediate: true });
    setEngineState("music", "running");
    setEngineDetail(
      "music",
      t("watch.status.continuingFromLyrics")
    );
    setEngineProgressVisible("music", true, { immediate: true });
    engineProgressState.music = Number(engineProgressState.music || 0);
    try {
      globalThis.watchPipelineLaunchPending = true;
      await runPipeline(getMicJobId(), title, lyricText);
    } catch (_err) {
      showToast(t("watch.toast.lyricsReadyMusicRecovering"));
    } finally {
      globalThis.watchPipelineLaunchPending = false;
    }
  }, 260);
  return true;
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

function createFallbackLyricPicker(_seedText) {
  const recent = [];
  const recentLimit = 5;
  return (items) => {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return "";
    const pool = list.filter((item) => !recent.includes(item));
    const candidates = pool.length ? pool : list;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    recent.push(chosen);
    if (recent.length > recentLimit) recent.shift();
    return chosen;
  };
}

function buildZhFallbackLyrics(subject, tone, vocal, workType) {
  const pick = createFallbackLyricPicker(`${subject}|${tone}|${vocal}|${workType}|zh|${Date.now()}|${Math.random()}`);
  const scenes = [
    "月光压在长阶上", "细雪落进空庭里", "潮声贴着旧城墙", "灯影停在檐角边",
    "风从竹影深处来", "雨丝绕过青石巷", "雾把远山轻轻藏起", "钟声穿过半开的窗",
    "海风掠过旧码头", "晨雾缠住木格窗", "银河压低在山脊", "烛光摇进长廊尽头",
    "蝉声泡在午后的热", "霜花爬满未关的窗", "渡船在雾里缓缓亮灯", "秋叶落进没有字的信封",
    "星子坠入瓷碗似的湖面", "老街的红灯笼轻轻晃", "风铃替夜色点名", "薄雾把时钟一层层裹起",
    "檐下的雨正在替谁数拍", "云压低了整座废园的肩膀", "远处的高塔悄悄收起光线",
    "潮水退到看不见的礁石边", "夜色替小径镀了一层霜", "月色裁成两半停在屋顶",
    "旧书摊的灯还亮着", "深巷的石阶被踩得发亮"
  ];
  const details = [
    "衣角还带着未散的香", "指尖像碰到一段旧时光", "眼神里藏着没说完的倔强",
    "唇边只剩一寸微凉", "脚步比心事更轻", "回身时连沉默都发亮",
    "呼吸像水面慢慢晃", "连影子都不敢惊动夜晚", "袖口残留半分墨迹",
    "发梢缠着昨夜的雨", "掌心里攥着没说出口的承诺", "眼角泛着比泪更轻的光",
    "侧脸被月色磨得温柔", "笑意藏进没合上的书页", "目光停在无人走过的窗",
    "声音薄成一片雪后初晴", "肩膀承着一整条长夜的重量", "呼吸间都是旧故事的温度",
    "连心跳都比从前慢了一拍", "连背影都写着没寄出的信",
    "连衣角的弧度都温柔得刚刚好", "连睫毛的颤动都像一段留白",
    "影子替我把心事藏得干净", "脚尖点地像怕惊醒一个梦"
  ];
  const emotions = [
    "舍不得", "不敢忘", "偏要等", "仍在想", "终于懂", "还想问",
    "不肯让", "慢慢亮", "重新学会呼吸", "替自己点一盏灯",
    "把名字压进夜色", "把话折成纸船", "在原地慢慢老去", "一遍一遍回头",
    "把沉默说得很长", "替你守一段薄光", "把遗憾唱成温柔",
    "和故事里的人重新告别", "替心事换一个回音", "让沉重轻下来",
    "把余生拆成明天", "把想念收进抽屉", "在夜里替你亮一秒"
  ];
  const chorusClosers = [
    "让我在余温里把你再认一遍", "让这一生的回望都落回心上",
    "让天光尽头还留着你的方向", "让风停下来替我们把名字轻放",
    "让最后一眼比初见更长", "让人间万物都替这句心事让路",
    "让故事在温柔处慢慢褪色", "让漫长成为一种温柔的让步",
    "让每一次心跳都指回你的方向", "让夜色替我们把未完的话收好",
    "让明天的光先替今天落脚", "让所有未说出口的都留在此刻微亮",
    "让远去的都能折返成一缕风", "让呼吸替代告别的形状",
    "让河流把名字送到另一个清晨"
  ];
  const bridges = [
    "我把没说完的话折进袖口", "旧梦在耳边轻轻翻页",
    "连最迟的星光也开始靠近", "远处的桥影像一封没寄出的信",
    "连回声都替我把名字念慢", "这一刻连时间都学会侧身",
    "把心里的潮水压成平静的水面", "把来不及说的字写进空白的信封",
    "替沉默涂上一层薄薄的光", "把漫长的等待折成小小的灯",
    "让昨日在掌心里熄成一缕香", "把回忆轻轻晾在月色里",
    "把没有出口的路走成一条长诗", "把半句心事留给未完成的雨",
    "在老墙上画一扇永不关的窗", "把一切说不完的都交给风"
  ];
  const outros = [
    "镜头慢慢拉远，只剩风还记得来时的路",
    "最后只看见灯火退成一点，却还温着心口",
    "远景一点点散开，余温还留在指尖尽头",
    "等夜色合上门，我们的名字还轻轻发亮",
    "天边的光慢慢收住，只剩心跳替故事作结",
    "长街终于安静，只有那句没说完的话还在",
    "雾散之后，桥的那头还有人提灯等着",
    "星河收拢成一粒小小的光，落进胸口",
    "故事被温柔地合上，像一本不舍得读完的书",
    "晨光替夜色盖上被子，人间又重新开始呼吸",
    "海面退潮之后，心事终于找到了岸",
    "最后一缕烟消散，留下的都被岁月轻轻托住"
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
  const pick = createFallbackLyricPicker(`${subject}|${tone}|${vocal}|${workType}|en|${Date.now()}|${Math.random()}`);
  const scenes = [
    "the lantern haze on the stairs",
    "snow breathing over the courtyard",
    "tide echoing past the old wall",
    "late light sleeping on the window frame",
    "mist folding the hills into silence",
    "rain threading through the alley",
    "the bell crossing a half-open room",
    "the river holding one pale shimmer",
    "a boulevard exhaling after the rain",
    "a rooftop leaning into the blue hour",
    "the tram lights smearing across the wet glass",
    "the cafe windows blushing with dusk",
    "the bridge humming under a thin fog",
    "a field of wheat turning bronze at sundown",
    "the harbor lanterns nodding at the tide",
    "a piano drifting through the open hallway",
    "an attic full of unopened afternoons",
    "a train station glowing like an exhale",
    "a chapel hush gathering behind the glass",
    "the city skyline stitched in amber and indigo"
  ];
  const details = [
    "your shadow staying warm at the edge",
    "my pulse learning how to move slowly",
    "the air carrying the shape of your name",
    "every quiet thing turning luminous",
    "the night opening without a sound",
    "my breath settling like silk in water",
    "your silence spelling out a slow promise",
    "the hush wearing a color only you could call",
    "my hands remembering the weight of your kindness",
    "the light curling around us like an old song",
    "the room holding its breath so we could speak",
    "a single candle learning the shape of our names",
    "the evening leaning close to overhear our hope",
    "every small kindness turning into architecture",
    "the sky lowering its voice so ours could travel",
    "my heart rehearsing the way to stay"
  ];
  const chorus = [
    "stay in my chest a little longer",
    "leave your light where I can return",
    "turn this longing into something I can hold",
    "let the last look linger like dawn",
    "keep one honest ember alive in me",
    "let the distance bend back into warmth",
    "turn every goodbye into a doorway",
    "hold my quiet the way you hold a song",
    "lend me one more sunrise in your voice",
    "weave your name across the quiet in me",
    "keep this light low enough for us to sleep beside",
    "stitch my faith back with a softer thread"
  ];
  const outro = [
    "the camera pulls back and the warmth remains",
    "the distance widens but the glow keeps breathing",
    "the skyline softens and still I remember",
    "the last frame fades and your trace stays bright",
    "the dawn steps in carefully, carrying the end of the song",
    "the room exhales and a single window stays lit",
    "the tide retreats without asking for the letter back",
    "the credits dissolve, and only a humming remains",
    "the lantern cools but the promise stays warm",
    "the night lowers the volume and keeps the melody"
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

function buildJaFallbackLyrics(subject, tone, vocal, workType) {
  const pick = createFallbackLyricPicker(`${subject}|${tone}|${vocal}|${workType}|ja|${Date.now()}|${Math.random()}`);
  const scenes = [
    "月影が石段を静かに濡らす", "粉雪が空の中庭に降り積もる", "潮騒が古い城壁を撫でて通る",
    "軒先に小さな灯りが止まる", "竹林の奥から風が滑り込む", "細い雨が石畳の路地を縫う",
    "霧が遠い山を静かに抱えていく", "鐘の音が半分開いた窓を渡る",
    "桜の花びらが夜更けの肩に落ちる", "夏の花火が黒い海面を撫でる",
    "柔らかな街灯が傘の縁に滲む", "蝉時雨が午後を長く引き伸ばす",
    "秋の田んぼが夕暮れを撫でていく", "雪原が月光をそっと翻訳する",
    "駅のホームが静かに白くなる", "商店街のちょうちんが低く揺れる",
    "線香花火の先でひとつの約束が光る", "神社の石畳に小さな足跡が残る",
    "海辺の風鈴が夜更けに呼吸を合わせる", "ビルの谷間に星が一粒だけ落ちてくる"
  ];
  const details = [
    "袖口にまだ香りがそっと残っている", "指先が遠い日の光に触れてしまう",
    "眼差しに言いそびれた強さが潜んでいる", "唇の端に小さな冷たさだけが残る",
    "足音が胸の奥より軽く響く", "振り返る仕草に沈黙が光を帯びる",
    "呼吸が水面のようにゆっくり揺れる", "影さえも夜を起こさないように進む",
    "髪の先に昨夜の雨が残っている", "手のひらに言えなかった約束が畳まれている",
    "目尻にはうっすらとした光が滲む", "横顔が月に優しく磨かれていく",
    "微笑みが読みかけの頁に挟まれている", "視線は誰も通らない窓辺に止まる",
    "声は雪晴れのように薄く澄んでいる", "肩には長い夜の重さがそっと乗る",
    "鼓動はいつもより一拍遅い", "足先が夢を壊さないように地を踏む",
    "まつげの揺れまでがひとつの余白になる", "影までもが言いたいことを隠してくれる"
  ];
  const chorus = [
    "もう少しだけ胸の中に留まって",
    "帰る場所になる光をそっと置いていって",
    "この想いを抱えられる形に変えて",
    "最後の眼差しを夜明けのように残して",
    "わたしの中の誠実な火を消さないで",
    "遠ざかる距離をもう一度温かさに折り返して",
    "さようならを新しい扉に変えていって",
    "わたしの静けさを歌のように抱きしめて",
    "あなたの声にもう一度朝を見せて",
    "名前をわたしの静けさに縫いつけて"
  ];
  const outro = [
    "カメラがゆっくり引いて、風だけが道を覚えている",
    "灯りが一点に退いても、胸の奥はまだ温かい",
    "遠景が少しずつほどけ、余韻が指先に残る",
    "夜が扉を閉じても、名前はそっと光り続ける",
    "空の端の光が静かに畳まれ、心拍が物語を閉じる",
    "長い街がようやく静かになり、まだ言い残した言葉が残る",
    "夜明けが歌の終わりを抱えて静かに入ってくる",
    "ランタンは冷めても、約束は温かく残る"
  ];
  if (workType === "opera") {
    return [
      "[序]",
      `${subject}は${pick(scenes)}の中にそっと姿を現す。`,
      `${pick(details)}。`,
      "",
      "[唱]",
      `${tone}が${vocal}の下でそっと火を起こし、沈黙を誓いに変える。`,
      `高い梁までが身を寄せてくる。`,
      "",
      "[合唱]",
      `${subject}、${pick(chorus)}。`,
      "",
      "[終]",
      `${pick(outro)}。`
    ];
  }
  if (workType === "triptych") {
    return [
      "[第一幕]",
      `${pick(scenes)}に、${subject}がゆっくりと目を開ける。`,
      `${pick(details)}。`,
      "",
      "[第二幕]",
      `${vocal}が${tone}を辿り、言葉にできない想いを静かにほどいていく。`,
      "",
      "[第三幕]",
      `${subject}、${pick(chorus)}。`,
      `${pick(outro)}。`
    ];
  }
  return [
    "[Intro]",
    `${subject}は${pick(scenes)}から現れて、${pick(details)}。`,
    "",
    "[Verse 1]",
    `${vocal}が${tone}を糸のように手繰り、暗闇の奥に小さな灯を残す。`,
    `歩みごとに、もうひとつ小さな光が零れていく。`,
    "",
    "[Chorus]",
    `${subject}、${pick(chorus)}。`,
    "",
    "[Outro]",
    `${pick(outro)}。`
  ];
}

// CSSOS_TRUE_RANDOM_LYRICS 20260420 — Jing: the old buildZh/En/Ja
// FallbackLyrics builders each carried a fixed pool (scenes/details/
// emotions/chorusClosers/bridges/outros) and mad-libs'd them with
// subject/tone/vocal. That's precisely the "假随机" behavior Jing
// flagged — same couplet structure and vocabulary every time, which
// also anchored OpenAI/Claude's outputs by polluting examples/retries.
// Cut at the entry point: buildLocalFallbackLyrics now returns [] so
// callers fall through to the real LLM path. The buildZh/En/Ja
// functions below are kept only for reference / future debugging and
// are NO LONGER CALLED. If the LLM path is truly unreachable the
// caller will surface a user-visible error instead of silently
// printing template boilerplate.
function buildLocalFallbackLyrics(_title) {
  return [];
}
// eslint-disable-next-line no-unused-vars
function _buildLocalFallbackLyrics_DEPRECATED(title) {
  const safeTitle = String(title || "").trim() || buildDirectCreationFallbackTitle();
  if (isDemoTemplateTitle(safeTitle)) return [];
  const genre = String(creationState.selections?.genre || styleInput?.value || state.style || "").trim();
  const voice = String(voiceInput?.value || state.voice || "").trim();
  const uiDefault = globalThis.resolveUiDefaultCreationLanguageModule?.() || "en";
  const rawLang = String(creationState.language || document.documentElement.lang || uiDefault).toLowerCase();
  const lang = rawLang.split(/[-_]/)[0];
  const workType = normalizeWorkTypeClient(creationState.workType || "single");
  const isZh = lang.startsWith("zh");
  const isJa = lang.startsWith("ja");
  const subjectFallback = isZh ? "未命名主题" : isJa ? "無題のテーマ" : "Untitled theme";
  const toneFallback = isZh ? "当前风格" : isJa ? "今の空気" : "current style";
  const vocalFallback = isZh ? "当前声线" : isJa ? "今の声" : "current voice";
  const subject = safeTitle || subjectFallback;
  const tone = genre || toneFallback;
  const vocal = voice || vocalFallback;
  if (isZh) return buildZhFallbackLyrics(subject, tone, vocal, workType);
  if (isJa) return buildJaFallbackLyrics(subject, tone, vocal, workType);
  return buildEnFallbackLyrics(subject, tone, vocal, workType);
}

function ensureCreationTitleAndLyricsModule(title, lines) {
  const resolvedTitle = String(title || "").trim() || buildDirectCreationFallbackTitle();
  const normalizedLines = Array.isArray(lines)
    ? lines
        .map((line) => String(line || "").trim())
        .filter(Boolean)
    : [];
  const safeLines = normalizedLines.length ? normalizedLines : buildLocalFallbackLyrics(resolvedTitle);
  return {
    title: resolvedTitle,
    lines: Array.isArray(safeLines) ? safeLines.filter(Boolean) : []
  };
}

function renderCreationUniverseCardModule(seed = state.songSeed) {
  if (!creationUniverseCard) return;
  const summary = seed?.creativeSummary || null;
  if (!summary) {
    creationUniverseCard.classList.add("is-empty");
    creationUniverseCard.innerHTML = `
      <div class="creation-universe-eyebrow">${escapeHtml(loginCopy("Current Universe"))}</div>
      <div class="creation-universe-body">${escapeHtml(loginCopy("When lyric magic lands, the current civilization, perspective, emotion, and structure will stay pinned here."))}</div>
    `;
    return;
  }
  creationUniverseCard.classList.remove("is-empty");
  const chips = [
    summary.family ? loginCopy(`Family · ${summary.family}`) : "",
    summary.emotion ? loginCopy(`Mood · ${summary.emotion}`) : "",
    summary.structure ? loginCopy(`Form · ${summary.structure}`) : ""
  ].filter(Boolean);
  creationUniverseCard.innerHTML = `
    <div class="creation-universe-eyebrow">${escapeHtml(loginCopy("Current Universe"))}</div>
    <div class="creation-universe-headline">${escapeHtml(summary.civilization || summary.family || "")}</div>
    <div class="creation-universe-meta">
      ${chips.map((chip) => `<span class="creation-universe-chip">${escapeHtml(chip)}</span>`).join("")}
    </div>
    <div class="creation-universe-body">${escapeHtml([summary.perspective, summary.languageStyle].filter(Boolean).join(" · "))}</div>
  `;
}

function renderCreationReferenceLibraryModule() {
  if (!creationReferenceLibrary) return;
  // CSSMV_UI_LANG_AUTO_EMPTY 20260423 #86 — honor UI locale when empty
  const uiFallback = globalThis.resolveUiPrimaryLanguageModule?.() || "en";
  const lang = String(creationState.language || uiFallback).trim().toLowerCase();
  const atlas = creationReferenceAtlas[lang] || creationReferenceAtlas[uiFallback] || creationReferenceAtlas.en || creationReferenceAtlas.zh;
  creationReferenceLibrary.innerHTML = `
    <div class="creation-reference-region">${escapeHtml(atlas.region || "")}</div>
    <div class="creation-reference-group">
      <div class="creation-reference-title">${escapeHtml(loginCopy("Reference Artists"))}</div>
      <div class="creation-reference-note">${escapeHtml(atlas.artists.join(", "))}</div>
    </div>
    <div class="creation-reference-group">
      <div class="creation-reference-title">${escapeHtml(loginCopy("Reference Ensembles"))}</div>
      <div class="creation-reference-note">${escapeHtml(atlas.ensembles.join(", "))}</div>
    </div>
  `;
}

function syncScrollPeekModule(container) {
  if (!(container instanceof HTMLElement)) return;
  const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
  const isScrollable = maxScroll > 6;
  container.classList.toggle("is-scrollable", isScrollable);
  container.classList.toggle("is-at-end", !isScrollable || container.scrollLeft >= maxScroll - 6);
  container.classList.toggle("has-overflow", isScrollable);
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
    renderLyricsLanguageTabsModule();
    syncScrollPeekModule(creationTabs);
    syncScrollPeekModule(creationChips);
    syncScrollPeekModule(lyricsLanguageTabs);
  });
}

function getLyricsDraftMapModule() {
  if (!creationState.lyricDrafts || typeof creationState.lyricDrafts !== "object") {
    creationState.lyricDrafts = {};
  }
  return creationState.lyricDrafts;
}

function getActiveLyricsLanguageModule() {
  // CSSMV_UI_LANG_AUTO_EMPTY 20260423 #86 — Jing: fallback is UI locale, not "zh".
  const uiFallback = globalThis.resolveUiPrimaryLanguageModule?.() || "en";
  const available = globalThis.getSelectedCreationLanguages?.() || [uiFallback];
  const current = String(creationState.activeLyricsLanguage || "").trim().toLowerCase();
  if (available.includes(current)) return current;
  return available[0] || uiFallback;
}

function persistActiveLyricsDraftModule() {
  if (!lyricsInput) return;
  const activeLang = getActiveLyricsLanguageModule();
  const drafts = getLyricsDraftMapModule();
  drafts[activeLang] = String(lyricsInput.value || "");
  creationState.activeLyricsLanguage = activeLang;
}

function switchLyricsLanguageDraftModule(nextLang) {
  if (!lyricsInput) return;
  persistActiveLyricsDraftModule();
  const normalized = String(nextLang || "").trim().toLowerCase();
  // CSSMV_UI_LANG_AUTO_EMPTY 20260423 #86 — Jing: fallback is UI locale, not "zh".
  const uiFallbackSwitch = globalThis.resolveUiPrimaryLanguageModule?.() || "en";
  const available = globalThis.getSelectedCreationLanguages?.() || [uiFallbackSwitch];
  const activeLang = available.includes(normalized) ? normalized : available[0] || uiFallbackSwitch;
  creationState.activeLyricsLanguage = activeLang;
  const drafts = getLyricsDraftMapModule();
  const nextDraft = typeof drafts[activeLang] === "string" ? drafts[activeLang] : "";
  lyricsInput.value = nextDraft;
}

function renderLyricsLanguageTabsModule() {
  if (!lyricsLanguageTabs || !lyricsInputPaneEditor) return;
  // CSSMV_UI_LANG_AUTO_EMPTY 20260423 #86 — Jing: fallback is UI locale, not "zh".
  const uiFallbackRender = globalThis.resolveUiPrimaryLanguageModule?.() || "en";
  const languages = globalThis.getSelectedCreationLanguages?.() || [uiFallbackRender];
  const primary = globalThis.getPrimaryCreationLanguage?.() || languages[0] || uiFallbackRender;
  const activeLang = getActiveLyricsLanguageModule();
  lyricsLanguageTabs.hidden = languages.length <= 1;
  if (lyricsLanguageTabs.hidden) {
    creationState.activeLyricsLanguage = primary;
    const drafts = getLyricsDraftMapModule();
    const primaryDraft = typeof drafts[primary] === "string" ? drafts[primary] : "";
    if (lyricsInput && lyricsInput.value !== primaryDraft && primaryDraft) {
      lyricsInput.value = primaryDraft;
    }
    return;
  }
  const labels = new Map(
    (globalThis.getCreationLyricLanguageCatalog?.() || []).map((entry) => [String(entry.code || ""), String(entry.label || entry.code || "")])
  );
  lyricsLanguageTabs.innerHTML = languages
    .map((lang) => {
      const isPrimary = lang === primary;
      const isActive = lang === activeLang;
      const label = labels.get(lang) || lang.toUpperCase();
      return `<button class="cta ghost tiny${isActive ? " active" : ""}" type="button" data-lyrics-language-tab="${escapeHtml(lang)}">${escapeHtml(label)}${isPrimary ? ` · ${escapeHtml(loginCopy("Original"))}` : ` · ${escapeHtml(loginCopy("Subtitle"))}`}</button>`;
    })
    .join("");
  lyricsLanguageTabs.querySelectorAll("[data-lyrics-language-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      switchLyricsLanguageDraftModule(String(button.getAttribute("data-lyrics-language-tab") || ""));
      renderLyricsLanguageTabsModule();
    });
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

  if (creationTempo) creationTempo.value = hasCreationFieldTouched("tempo") && Number(creationState.tempo || 0) > 0 ? String(creationState.tempo) : "";
  if (creationKey) creationKey.value = hasCreationFieldTouched("key") ? String(creationState.key || "").trim().toUpperCase() : "";
  if (creationDuration) {
    const derivedDuration = resolveCreationDurationValue();
    creationDuration.value = Number.isFinite(derivedDuration) && derivedDuration > 0 ? String(derivedDuration) : "";
  }
  if (creationLanguage) {
    // CSSMV_CIVILIZATION_CASCADE 20260424 #98 — only force a concrete value
    // when the user has touched the field (or a seed-lock is active). When
    // untouched, keep the dropdown on "Auto" ("") so a UI-locale flip is
    // visually honoured instead of pinning to a stale language.
    const lockedBySeed = !!creationState.languageLockedBySeed && !readExplicitCreationLanguage();
    if (hasCreationFieldTouched("language") || lockedBySeed) {
      const resolvedValue = resolveCreationLanguageValue();
      if (creationLanguage.value !== resolvedValue) creationLanguage.value = resolvedValue;
    } else if (creationLanguage.value !== "") {
      creationLanguage.value = "";
    }
    creationLanguage.disabled = lockedBySeed;
    creationLanguage.dataset.lockedBySeed = lockedBySeed ? "1" : "0";
    creationLanguage.title = lockedBySeed
      ? loginCopy(
          "Lyric magic picked the language first. Clear or choose language before using the wand next time."
        )
      : "";
  }
  if (creationWorkType) creationWorkType.value = hasCreationFieldTouched("workType") ? normalizeWorkTypeClient(creationState.workType || "") : "";
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
    const rawValue = String(creationTempo.value || "").trim();
    if (!rawValue) {
      clearCreationFieldTouched("tempo");
      creationState.tempo = null;
      renderCreationConsoleModule();
      return;
    }
    markCreationFieldTouched("tempo");
    creationState.tempo = Math.max(40, Math.min(220, Number(rawValue || 88)));
    renderCreationConsoleModule();
  });
  creationKey?.addEventListener("change", () => {
    const nextValue = String(creationKey.value || "").trim().toUpperCase();
    if (!nextValue) {
      clearCreationFieldTouched("key");
      creationState.key = "";
      renderCreationConsoleModule();
      return;
    }
    markCreationFieldTouched("key");
    creationState.key = nextValue;
    renderCreationConsoleModule();
  });
  creationDuration?.addEventListener("focus", () => {
    creationDuration.blur();
    safeShowToast(
      loginCopy(
        "Duration is derived from the lyrics and music structure."
      )
    );
  });
  creationLanguage?.addEventListener("change", () => {
    persistActiveLyricsDraftModule();
    const lockedBySeed = !!creationState.languageLockedBySeed && !readExplicitCreationLanguage();
    if (lockedBySeed) {
      creationLanguage.value = resolveCreationLanguageValue();
      safeShowToast(
        loginCopy(
          "Language is pinned by lyric magic for this draft. Clear first, or choose language before using the wand."
        )
      );
      renderCreationConsoleModule();
      return;
    }
    const nextLanguage = String(creationLanguage.value || "").trim().toLowerCase();
    if (!nextLanguage) {
      clearCreationFieldTouched("language");
      creationState.language = "";
      creationState.languageLockedBySeed = false;
      creationState.activeLyricsLanguage = globalThis.getPrimaryCreationLanguage?.() || globalThis.resolveUiPrimaryLanguageModule?.() || "en";
      renderCreationConsoleModule();
      return;
    }
    markCreationFieldTouched("language");
    creationState.language = nextLanguage;
    creationState.languageLockedBySeed = false;
    const capability = enforceCreationCapability({ skipLoginPrompt: true, allowCinemaBookingPrompt: false });
    if (!capability.ok && capability.reason === "creator_boost_language") {
      // CSSMV_UI_LANG_AUTO_EMPTY 20260423 #86 — don't snap back to zh on
      // capability reject; honor the UI locale instead.
      const uiFallback = globalThis.resolveUiPrimaryLanguageModule?.() || "en";
      creationState.language = uiFallback;
      creationLanguage.value = uiFallback;
    }
    creationState.activeLyricsLanguage = globalThis.getPrimaryCreationLanguage?.() || nextLanguage;
    renderCreationConsoleModule();
  });
  creationWorkType?.addEventListener("change", () => {
    const rawValue = String(creationWorkType.value || "").trim();
    if (!rawValue) {
      clearCreationFieldTouched("workType");
      creationState.workType = "";
      renderCreationConsoleModule();
      return;
    }
    markCreationFieldTouched("workType");
    const nextWorkType = normalizeWorkTypeClient(rawValue || "single");
    const capability = enforceCreationCapability({ workType: nextWorkType, skipLoginPrompt: true, allowCinemaBookingPrompt: false });
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
    enforceCreationCapability({ skipLoginPrompt: true, allowCinemaBookingPrompt: false });
    renderCreationConsoleModule();
  });
  creationEnsembleStyle?.addEventListener("input", () => {
    markCreationFieldTouched("ensembleStyle");
    creationState.ensembleStyle = String(creationEnsembleStyle.value || "").slice(0, 240);
    enforceCreationCapability({ skipLoginPrompt: true, allowCinemaBookingPrompt: false });
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
        genre: "",
        mood: "",
        instrument: "",
        instrumentation: "",
        ambience: "",
        vocal_gender: "",
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
        tempo_bpm: "",
        musical_key: "",
        duration_s: "",
        language: "",
        prompt: "",
        work_type: ""
      }
    };
    applyCreationDefaults(defaults);
    resetCreationTouchedFields();
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
    creationState.extraLyricLanguages = [];
    creationState.lyricDrafts = {};
    // CSSMV_UI_LANG_AUTO_EMPTY 20260423 #86 — Jing: fallback is UI locale, not "zh".
    creationState.activeLyricsLanguage = globalThis.getPrimaryCreationLanguage?.() || globalThis.resolveUiPrimaryLanguageModule?.() || "en";
    creationState.extraVoiceTracks = [];
    creationState.languageLockedBySeed = false;
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
  lyricsInput?.addEventListener("input", () => {
    persistActiveLyricsDraftModule();
  });
}

function shouldRetryAutoSongSeedTitleModule(title) {
  return !shouldPreserveSongSeedTitleForRefresh() && hasRecentAutoSongSeedTitle(title);
}

function formatCreationLanguageBadgeModule(lang) {
  const value = String(lang || "").trim().toLowerCase();
  if (value === "ja") return "JP";
  if (value === "en") return "EN";
  if (value === "zh") return loginCopy("CN");
  return value.toUpperCase() || "--";
}

function describeCreationRandomizationModule() {
  const resolvedLanguage = resolveCreationLanguageValue();
  const resolvedTempo = resolveCreationTempoValue();
  const resolvedKey = resolveCreationKeyValue();
  const resolvedDuration = resolveCreationDurationValue();
  return [
    formatCreationLanguageBadgeModule(resolvedLanguage),
    `${resolvedTempo} BPM`,
    `${resolvedKey} major`,
    resolvedDuration ? `${resolvedDuration}s` : loginCopy("Duration grows from lyrics")
  ].join(" · ");
}

function openCreationConsoleModule() {
  openPanel(settingsPanel);
  creationState.activeTab = "genre";
  renderCreationConsoleModule();
  const box = document.getElementById("creation-console");
  box?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function buildCreationSignatureModule(title, customLyrics, mode = "music_video") {
  // Intentionally exclude `title` from the dedup signature: voice-submit assigns
  // a random fallback title per trigger, so including the title here would let
  // two rapid triggers slip through as "distinct" runs and spawn duplicate
  // pipelines (see bug: one trigger creating 反抗者之歌 + 失重潮生 together).
  return JSON.stringify({
    mode,
    lyrics: String(customLyrics || "").trim().slice(0, 400),
    style: String(styleInput?.value || state.style || "").trim(),
    voice: String(voiceInput?.value || state.voice || "").trim()
  });
}

function shouldSkipDuplicateCreationModule(signature) {
  const now = Date.now();
  const isSame = !!signature && signature === lastCreationSignature;
  const isHot = now - lastCreationStartedAt < 3500;
  // Any active creation / pending pipeline / pending final audio is enough to
  // reject a re-entry, independent of signature equality. The signature-based
  // hot window remains as a secondary guard for same-input taps.
  if (creationLock) return true;
  if (typeof isCreationBusyModule === "function" && isCreationBusyModule()) return true;
  if (isSame && isHot) return true;
  // A plain hot window also blocks: if anything started in the last 3.5s,
  // reject regardless of signature — this catches the voice-submit path where
  // each trigger mints a different random title.
  if (isHot && lastCreationStartedAt > 0) return true;
  return false;
}

function markCreationStartedModule(signature) {
  creationLock = true;
  lastCreationSignature = signature;
  lastCreationStartedAt = Date.now();
}

function markCreationFinished() {
  creationLock = false;
}

function isCreationBusyModule() {
  const requestState = globalThis.lyricsSeedRequestState || {};
  return !!(
    creationLock ||
    requestState.pending ||
    String(activePipelineRunId || "").trim() ||
    String(pendingFinalAudioRunId || "").trim() ||
    (String(currentWatchAudioRunId || "").trim() && karaCompletionAt <= 0)
  );
}

async function requestLyricsSeedWithRetryModule(mode = "music_video", options = {}) {
  const attempts = Math.max(1, Number(options?.attempts || 2));
  let lastPayload = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastPayload = await runLyricsGenerate(mode, options).catch(() => null);
    const hasLyrics = !!String(lastPayload?.data?.lyrics || lastPayload?.lyrics || "").trim();
    const isUsable =
      !!lastPayload &&
      lastPayload.ok !== false &&
      lastPayload.empty !== true &&
      lastPayload.no_data !== true &&
      hasLyrics;
    if (isUsable) return lastPayload;
    if (attempt < attempts) {
      safeShowToast(t("watch.toast.retryingLyricsSeed"));
    }
  }
  return lastPayload;
}

globalThis.requestLyricsSeedWithRetryModule = requestLyricsSeedWithRetryModule;

function hasUsableSongSeedSnapshotModule(seed = state.songSeed) {
  if (!seed || typeof seed !== "object") return false;
  const lyrics = String(seed.lyrics || "").trim();
  const title = String(seed.title || "").trim();
  const outline = String(seed.videoOutline || seed.video_outline || "").trim();
  const prompts = Array.isArray(seed.sectionPrompts)
    ? seed.sectionPrompts
    : Array.isArray(seed.section_prompts)
      ? seed.section_prompts
      : [];
  const hasBodyLyrics =
    globalThis.hasCanonicalLyricsBodyLinesModule?.(title, lyrics, 1) ??
    String(lyrics || "").trim().split("\n").filter(Boolean).length >= 1;
  return !!(hasBodyLyrics || title || outline || prompts.length);
}

function hasCompleteSongSeedSnapshotModule(seed = state.songSeed) {
  if (!seed || typeof seed !== "object") return false;
  const lyrics = String(seed.lyrics || "").trim();
  const title = String(seed.title || "").trim();
  const outline = String(seed.videoOutline || seed.video_outline || "").trim();
  const prompts = Array.isArray(seed.sectionPrompts)
    ? seed.sectionPrompts
    : Array.isArray(seed.section_prompts)
      ? seed.section_prompts
      : [];
  const hasBodyLyrics =
    globalThis.hasCanonicalLyricsBodyLinesModule?.(title, lyrics, 2) ??
    String(lyrics || "").trim().split("\n").filter(Boolean).length >= 2;
  return !!(hasBodyLyrics && title && (outline || prompts.length));
}

async function startCreation(customTitle, customLyrics, options = {}) {
  if (!authState?.user && typeof openLoginForCreation === "function") {
    openLoginForCreation(
      loginCopy(
        "Sign in first to start the one-tap MV flow."
      )
    );
    return false;
  }
  // CSSOS_PHASE2_LEGACY_CREATION_GUARD 20260426 #141 — Jing
  // "音乐引擎/视频引擎还fallback到旧的媒体" — we found the leak: the
  // legacy creative-engine (this function) was running in PARALLEL with
  // MV Pipeline panel even when the unified entry only meant to fire
  // MV Pipeline. Symptoms: /api/cssmv/song-seed 504, /build/master.mp3
  // 404 storm, watch.action.resume i18n complaint chain, title bar
  // stuck at "SUBTITLES 0%" because legacy engineProgressState wins.
  //
  // Guard: if a fresh cssmvPipelineLastResult OR an actively-running
  // MV Pipeline session is detected, skip the legacy startCreation
  // entirely. Caller can pass `options.allowLegacyAlongsideMv === true`
  // to bypass (rare debug path).
  if (!options?.allowLegacyAlongsideMv) {
    try {
      const lastRes = globalThis.cssmvPipelineLastResult;
      if (lastRes && lastRes.mvUrl) {
        const tsAt = Number(lastRes.tsAt || 0);
        const freshMs = Number(lastRes.freshMs || 600000);
        if (tsAt && (Date.now() - tsAt) < freshMs) {
          console.info(
            "%c[startCreation] skipped — fresh MV Pipeline result owns this session (age %dms)",
            "color:#08f", Date.now() - tsAt
          );
          return false;
        }
      }
      // Active MV Pipeline run: cssmvPipelineActiveStage returns non-null
      // when at least one stage is running/done.
      if (typeof globalThis.cssmvPipelineActiveStage === "function") {
        const live = globalThis.cssmvPipelineActiveStage();
        if (live && !live.finished && !live.hasError) {
          console.info(
            "%c[startCreation] skipped — MV Pipeline run in progress (stage=%s pct=%d)",
            "color:#08f", live.stageId, live.pct
          );
          return false;
        }
      }
    } catch (_e) { /* fall through to legacy path */ }
  }
  if (authState.user && !creatorBoostState.loaded) {
    await loadCreatorBoostState().catch(() => null);
  }
  const primaryLyricsDraft = globalThis.getPrimaryLyricsDraft?.(customLyrics) || customLyrics;
  const creationPayload = normalizeSongCreationPayload({
    ...(options && typeof options === "object" ? options : {}),
    title: customTitle,
    rawTranscript: options?.rawTranscript || micState.transcript || ""
  });
  const resolvedDurationSec = resolveCreationDurationValue({
    title: customTitle,
    lyricsText: primaryLyricsDraft || ""
  });
  const capability = enforceCreationCapability({
    mode: "music_video",
    durationSec: resolvedDurationSec,
    workType: creationState.workType,
    allowCinemaBookingPrompt: false
  });
  if (!capability.ok) return false;
  const boostConsumed = await consumeCreatorBoostsIfNeeded();
  if (!boostConsumed) return false;
  const signature = buildCreationSignatureModule(customTitle, primaryLyricsDraft, "music_video");
  if (shouldSkipDuplicateCreationModule(signature)) {
    safeShowToast(t("watch.toast.creationBusy"));
    return false;
  }
  markCreationStartedModule(signature);
  let shouldReleaseLock = true;
  try {
    if (zeroThresholdAutoplayRequested) {
      primeZeroThresholdAudioPreviewModule(state.songSeed || {});
    }
    let title = String(customTitle || "").trim();
    let baseLines = primaryLyricsDraft?.trim() ? primaryLyricsDraft.trim().split("\n") : [];
    let usedSongSeed = false;
    const zeroThresholdFastPath =
      zeroThresholdAutoplayRequested &&
      !baseLines.length &&
      !String(customTitle || "").trim();
    const directZeroInputMode =
      !baseLines.length &&
      !String(customTitle || "").trim() &&
      creationPayload.source !== "voice";
    if (directZeroInputMode) {
      cssmvTriggered = false;
      watchTriggered = false;
      resetTypingState();
      resetEngineStates();
      const zeroInputPrelude = startZeroInputPreludeModule();
      maybeCompactForyouAfterLyrics({ armAuto: false });
      state.songSeed = null;
      state.baseLines = [];
      state.lines = [];
      renderSongSeedPreviewModule(null);
      globalThis.currentResolvedWatchArtworkDataUrl = "";
      globalThis.currentPreviewFrameDataUrl = "";
      globalThis.currentWatchArtworkVariantPool = [];
      cssmvPanel.classList.add("hidden");
      updateDockVisibility();
      if (lyricsEl) {
        lyricsEl.textContent = "";
      }
      animateProgress();
      updateEnginePanels(loginCopy("CSS MV"), []);
    }
    if (!baseLines.length && (!zeroThresholdFastPath || directZeroInputMode)) {
      const prewarmTitle = String(
        title || titleInput?.value || state.title || loginCopy("CSS MV")
      ).trim();
      const prewarmLines = compactLyricLines(
        String(lyricsInput?.value || state.songSeed?.lyrics || "")
          .split("\n")
          .filter(Boolean)
      ).slice(0, 8);
      void globalThis.requestWatchFrameArtworkModule?.(
        prewarmTitle,
        t("watch.status.requestingLyricsSeed"),
        prewarmLines
      );
      const seed = await requestLyricsSeedWithRetryModule("music_video", { attempts: 1 });
      if (globalThis.isSongSeedQuotaExceededModule?.(seed) ?? false) {
        safeShowToast(globalThis.getSongSeedQuotaExceededMessageModule?.(seed) || "");
        return false;
      }
      if (seed?.ok && !seed?.empty && seed?.data?.lyrics) {
        const normalizedSeed = globalThis.normalizeSongSeedModule?.(seed?.data || seed) || null;
        usedSongSeed = true;
        globalThis.applySongSeedToSettingsModule?.(seed?.data || seed);
        if (normalizedSeed && typeof normalizedSeed === "object") {
          state.songSeed = { ...(state.songSeed || {}), ...normalizedSeed };
        }
        title = String(title || seed.data.title || normalizedSeed?.title || "").trim();
        const canonicalLyrics =
          globalThis.buildCanonicalLyricsWithTitleModule?.(
            title || normalizedSeed?.title || "",
            String(seed.data.lyrics || ""),
          ) || String(seed.data.lyrics || "");
        baseLines = extractDisplayLyricLines(canonicalLyrics);
        void globalThis.requestWatchFrameArtworkModule?.(
          title || prewarmTitle,
          String(normalizedSeed?.musicStyle || normalizedSeed?.creativeSummary?.compact || "").trim() || t("watch.status.waitingImage"),
          baseLines
        );
        if (normalizedSeed?.videoOutline && videoOutlineInput && !String(videoOutlineInput.value || "").trim()) {
          videoOutlineInput.value = normalizedSeed.videoOutline;
        }
        if (Array.isArray(normalizedSeed?.sectionPrompts) && sectionPromptsInput && !String(sectionPromptsInput.value || "").trim()) {
          sectionPromptsInput.value =
            globalThis.renderSectionPromptsTextModule?.(normalizedSeed.sectionPrompts) || "";
        }
        globalThis.requestForyouThumbnail?.(
          title || normalizedSeed?.title || loginCopy("CSS MV"),
          normalizedSeed?.musicStyle || normalizedSeed?.creativeSummary?.compact || "",
          baseLines
        );
      }
    }
    const hasActiveSongSeed = hasUsableSongSeedSnapshotModule(state.songSeed);
    const hasCompleteSongSeed = hasCompleteSongSeedSnapshotModule(state.songSeed);
    if (!baseLines.length || !hasCompleteSongSeed) {
      if (!hasActiveSongSeed) {
        state.songSeed = null;
        renderSongSeedPreviewModule(null);
      } else {
        renderSongSeedPreviewModule(state.songSeed);
      }
      const seedStatusCopy =
        globalThis.summarizeWatchLyricsSeedStatusModule?.() ||
        t("watch.subtitle.waitingLyricsSeed");
      setEngineState("lyrics", "running");
      setEngineDetail("lyrics", seedStatusCopy);
      setEngineProgressVisible("lyrics", true, { immediate: true });
      setEngineState("music", "pending");
      setEngineState("video", "pending");
      setEngineState("kara", "pending");
      if (watchSubtitle) {
        globalThis.syncWatchSubtitleForWaitingMediaModule?.();
      }
      safeShowToast(t("watch.toast.seedStillPreparing"));
      const recovered = await globalThis.regenerateLyricsForWatchModule?.();
      if (recovered) {
        shouldReleaseLock = false;
        return true;
      }
      return false;
    }
    if (!usedSongSeed && !hasActiveSongSeed) {
      state.songSeed = null;
      renderSongSeedPreviewModule(null);
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
    const safeCreation = ensureCreationTitleAndLyricsModule(
      title,
      replaceSpellInLines(baseLines, DEFAULT_SPELL, state.spell)
    );
    title = safeCreation.title;
    const lines = safeCreation.lines;
    const lyricText = buildLyricsText(title, lines);
    lyricsTargetLength = lyricText.length;

    watchSubtitle.textContent = t("watch.status.requestingMusicEngine");
    cssmvTriggered = false;
    watchTriggered = false;
    resetTypingState();
    resetEngineStates();
    maybeCompactForyouAfterLyrics({ armAuto: false });
    void globalThis.requestWatchFrameArtworkModule?.(
      title,
      String(state.songSeed?.musicStyle || state.songSeed?.creativeSummary?.compact || "").trim() || t("watch.status.waitingImage"),
      lines
    );
    cssmvPanel.classList.add("hidden");
    updateDockVisibility();
    if (watchAudioPreview) {
      watchAudioPreview.pause?.();
      watchAudioPreview.removeAttribute("src");
      watchAudioPreview.load?.();
      watchAudioPreview.style.display = "none";
    }
    if (watchVideo) {
      watchVideo.pause?.();
      watchVideo.removeAttribute("src");
      watchVideo.load?.();
    }
    typingState.completed = lyricText.length > 0;
    typingState.paused = false;
    typingState.canceled = false;
    if (lyricsEl) {
      lyricsEl.textContent = lyricText;
      lyricsEl.classList.remove("paused", "canceled");
    }
    if (watchLyricsEditor) {
      watchLyricsEditor.value = lines.join("\n");
    }
    setEngineState("lyrics", "done");
    setEngineDetail("lyrics", "stage: done");
    globalThis.pinLyricsProgressVisibilityModule?.(3600);
    if (lyricsProgress) setProgress(lyricsProgress, 100);
    setEngineProgressVisible("lyrics", false, { delayMs: 3600 });
    updateEnginePanels(title, lines);
    state.baseLines = baseLines;
    state.lines = lines;
    const allowed = await consumeGeneration();
    if (!allowed) return false;
    if (creationPayload.localWorkId) {
      updateLocalWorkRecord(creationPayload.localWorkId, { status: "generating_music" });
      currentWatchPreviewWork =
        listLocalWorksForCurrentUser().find((work) => String(work?.local_id || work?.work_id || "").trim() === creationPayload.localWorkId) ||
        currentWatchPreviewWork;
      globalThis.cssosBindToWorkId?.(currentWatchPreviewWork); // CSSOS_WAVE_121 Step 2
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
    presentCreationSurfaceForPayload(creationPayload, {
      title,
      lyricsText: lyricText
    });
    shouldReleaseLock = false;
    return true;
  } finally {
    stopZeroInputPreludeModule();
    if (shouldReleaseLock) {
      markCreationFinished();
    }
  }
}

async function runPipeline(jobId, title, lyrics) {
  const existingRunId = String(
    globalThis.getCurrentInFlightWatchRunIdModule?.() ||
    currentWatchAudioRunId ||
    activePipelineRunId ||
    pendingFinalAudioRunId ||
    ""
  ).trim();
  if (existingRunId) {
    currentWatchAudioRunId = existingRunId;
    currentWatchAudioRunError = "";
    updateWatchAudioDebug();
    setEngineState("music", "running");
    setEngineDetail("music", t("watch.status.autoRecoveringStage"));
    startPipelineProgressPolling(existingRunId);
    startPendingFinalAudioPolling(existingRunId);
    return { ok: true, reused: true, run_id: existingRunId };
  }
  if (!String(lyrics || "").trim()) {
    globalThis.setWatchCreateRunDebugMeta?.("response", {
      status: "blocked",
      note: "lyrics_missing"
    });
    setEngineState("music", "pending");
    setEngineDetail("music", t("watch.toast.seedStillPreparing"));
    safeShowToast(t("watch.toast.seedStillPreparing"));
    return { ok: false, blocked: "lyrics_missing" };
  }
  if (globalThis.watchPipelineLaunchPending) {
    globalThis.setWatchCreateRunDebugMeta?.("response", {
      status: "skipped",
      note: "launch_pending"
    });
    setEngineState("music", "running");
    setEngineDetail("music", t("watch.toast.autoRecoveringStage"));
    return { ok: false, skipped: true };
  }
  globalThis.watchPipelineLaunchPending = true;
  try {
    startRecentRunRecovery(title);
    setEngineState("music", "running");
    setEngineDetail(
      "music",
      t("watch.status.requestingMusicEngine")
    );
    setEngineProgressVisible("music", true, { immediate: true });
    engineProgressState.music = Number(engineProgressState.music || 0);
    const musicAllowed = await consumeBillableAction("music_generate", {
      meta: {
        job_id: jobId,
        title: String(title || "").trim().slice(0, 120),
        work_type: normalizeWorkTypeClient(creationState.workType || "single"),
        duration_sec: resolveCreationDurationValue({ title, lyricsText: lyrics })
      }
    });
    if (!musicAllowed) {
      throw new Error("music_generate_billing_blocked");
    }
    // CSSMV_UI_LANG_AUTO_EMPTY 20260423 #86 — Jing: UI locale is the primary
    // fallback for random/default language, not hardcoded "zh".
    const uiLang = String(window.CSS_UI_LANG || document.documentElement.lang || creationState.language || globalThis.resolveUiPrimaryLanguageModule?.() || "en");
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
      setEngineState("music", "running");
      setEngineDetail(
        "music",
        t("watch.status.musicEngineAccepted")
      );
      engineProgressState.music = Number(engineProgressState.music || 0);
      window.dispatchEvent(
        new CustomEvent("cssos:run_created", {
          detail: { run_id: runId, title: String(title || "").trim() }
        })
      );
      startPipelineProgressPolling(runId);
      startPendingFinalAudioPolling(runId);
      globalThis.setWatchCreateRunDebugMeta?.("response", {
        status: "polling",
        runId,
        statusUrl: `/cssapi/v1/runs/${encodeURIComponent(runId)}/status`,
        note: "polling_attached"
      });
    }
    if (!runId) {
      globalThis.setWatchCreateRunDebugMeta?.("response", {
        status: "recovering",
        note: "run_id_missing"
      });
      currentWatchAudioRunError = "run_id_missing";
      updateWatchAudioDebug();
      setEngineDetail(
        "music",
        t("watch.status.musicRunRecovering")
      );
    }
    return json;
  } catch (error) {
    globalThis.setWatchCreateRunDebugMeta?.("response", {
      status: "error",
      note: String(error?.message || error || "run_pipeline_failed").slice(0, 180)
    });
    if (!currentWatchAudioRunId) {
      startRecentRunRecovery(title);
    }
    currentWatchAudioRunError = String(error?.message || error || "run_pipeline_failed")
      .replace(/\s+/g, "_")
      .slice(0, 80);
    setEngineState("music", "pending");
    setEngineDetail(
      "music",
      t("watch.status.musicEngineRecovering")
    );
    updateWatchAudioDebug();
    safeShowToast(
      t("watch.toast.musicPipelineRecovering")
    );
    throw error;
  } finally {
    globalThis.watchPipelineLaunchPending = false;
  }
}

async function startCreationWithLyrics(title, lyricsText) {
  if (authState.user && !creatorBoostState.loaded) {
    await loadCreatorBoostState().catch(() => null);
  }
  const resolvedDurationSec = resolveCreationDurationValue({ title, lyricsText });
  const capability = enforceCreationCapability({
    mode: "music_video",
    durationSec: resolvedDurationSec,
    workType: creationState.workType,
    allowCinemaBookingPrompt: false
  });
  if (!capability.ok) return false;
  const boostConsumed = await consumeCreatorBoostsIfNeeded();
  if (!boostConsumed) return false;
  const signature = buildCreationSignatureModule(title, lyricsText, "music_video");
  if (shouldSkipDuplicateCreationModule(signature)) {
    safeShowToast(t("watch.toast.creationBusy"));
    return false;
  }
  markCreationStartedModule(signature);
  let shouldReleaseLock = true;
  try {
    if (!state.songSeed) renderSongSeedPreviewModule(null);
    const safeCreation = ensureCreationTitleAndLyricsModule(
      title,
      String(lyricsText || "").trim().split("\n")
    );
    title = safeCreation.title;
    const lines = safeCreation.lines;
    void createMyWorkRecord(title, lines);
    const lyricText = buildLyricsText(title, lines);
    lyricsTargetLength = lyricText.length;

    watchSubtitle.textContent = t("watch.status.requestingMusicEngine");
    cssmvTriggered = false;
    watchTriggered = false;
    resetTypingState();
    resetEngineStates();
    maybeCompactForyouAfterLyrics({ armAuto: false });
    void globalThis.requestWatchFrameArtworkModule?.(
      title,
      String(state.songSeed?.musicStyle || state.songSeed?.creativeSummary?.compact || "").trim() || t("watch.status.waitingImage"),
      lines
    );
    cssmvPanel.classList.add("hidden");
    updateDockVisibility();
    if (watchAudioPreview) {
      watchAudioPreview.pause?.();
      watchAudioPreview.removeAttribute("src");
      watchAudioPreview.load?.();
      watchAudioPreview.style.display = "none";
    }
    if (watchVideo) {
      watchVideo.pause?.();
      watchVideo.removeAttribute("src");
      watchVideo.load?.();
    }
    typingState.completed = lyricText.length > 0;
    typingState.paused = false;
    typingState.canceled = false;
    if (lyricsEl) {
      lyricsEl.textContent = lyricText;
      lyricsEl.classList.remove("paused", "canceled");
    }
    if (watchLyricsEditor) {
      watchLyricsEditor.value = lines.join("\n");
    }
    setEngineState("lyrics", "done");
    setEngineDetail("lyrics", "stage: done");
    globalThis.pinLyricsProgressVisibilityModule?.(3600);
    if (lyricsProgress) setProgress(lyricsProgress, 100);
    setEngineProgressVisible("lyrics", false, { delayMs: 3600 });
    updateEnginePanels(title, lines);
    state.baseLines = lines;
    state.lines = lines;
    state.title = title;
    const allowed = await consumeGeneration();
    if (!allowed) return false;
    void runPipeline(getMicJobId(), title, lyricText);
    presentCreationSurfaceForPayload(
      { source: "manual" },
      {
        title,
        lyricsText: lyricText
      }
    );
    shouldReleaseLock = false;
    return true;
  } finally {
    if (shouldReleaseLock) {
      markCreationFinished();
    }
  }
}

Object.assign(globalThis, {
  hasUsableSongSeedSnapshotModule,
  hasCompleteSongSeedSnapshotModule,
  ensureWatchPipelineContinuationModule,
  renderCreationUniverseCardModule,
  renderCreationReferenceLibraryModule,
  creationTabLabelModule,
  creationChipLabelModule,
  scheduleCreationConsoleExtrasModule,
  syncCreationTabsDomModule,
  syncCreationChipsDomModule,
  flushRenderCreationConsoleModule,
  renderCreationConsoleModule,
  initCreationConsoleModule,
  shouldRetryAutoSongSeedTitleModule,
  formatCreationLanguageBadgeModule,
  describeCreationRandomizationModule,
  openCreationConsoleModule,
  buildCreationSignatureModule,
  shouldSkipDuplicateCreationModule,
  markCreationStartedModule,
  markCreationFinishedModule: markCreationFinished,
  isCreationBusyModule,
  startCreation
});
