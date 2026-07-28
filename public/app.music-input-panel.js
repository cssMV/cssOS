/* CSSOS_WAVE_111A 20260512 — Jing
 * Music Source Uploads — 5-tab picker (audio / video / midi / sheet / image).
 *
 * Replaces the earlier 4-slot stacked layout. Per Jing:
 *   1. Audio → cssMV extracts time-coded lyrics, runs cover/video/compose ✅
 *   2. Video → cssMV extracts audio + lyrics, reuses video, composes ✅
 *   3. MIDI / MusicXML (with lyrics track only) → Wave 111B (placeholder here)
 *   4. Sheet music (OCR + sheet-site integration) → Wave 111C (placeholder here)
 *   5. Pure image → Claude Vision → song prompt → full pipeline ✅
 *
 * Tab bar is horizontally scrollable (per Jing's standing rule:
 * "凡是 tab，不管多还是少，都要做成可左右滚动的").
 *
 * Public surface preserved for app.creation-duration.js:
 *   globalThis.musicSourceUploadState  (now has audio/video/midi/sheet/image)
 *   buildAdvancedMusicSourceSettingsSection()
 *   mountMusicSourceUploadTabInSettings(root)
 */

/* CSSOS_WAVE_1694 20260710 — Jing「上架了, 按折中方案放开」。整卡片恢复, 但【只放出
 * 低风险的 4 个 tab】: 🎼MIDI · 📝MusicXML · 📜Sheet · 🖼️Image。
 * 继续藏住 🎵audio / 🎬video —— 那两个才是"上传任意 mp3/mp4 → 抽词复用"的苹果 5.2(IP)
 * + 1.2(UGC) 雷点。歌谱→MV 只需要 midi/musicxml/sheet, 一个都不缺。
 * 注意: `active` 字段以前是装饰性的(没人过滤), 现在由 musicSourceTabsEnabled() 真正生效。
 *
 * ↓ 原 W247 记录(保留):
 * CSSOS_WAVE_247 20260520 — Jing: App Store 过审前临时屏蔽「音乐源上传」整卡片.
 * 原因: 任意 mp3/mp4 上传 → 抽词/复用音视频, 在苹果眼里像"扒任意歌曲"工具,
 *   踩 5.2(IP) + 1.2(UGC 审核) 雷点. App 是远程加载 cssstudio.app, 所以这是
 *   纯前端开关 —— 翻 true 重新部署即放出, 无需重新发版/重审.
 * 过审后改回 true 即恢复 (整卡片 + 全部 5 个 tab).
 * 折中方案(只藏 audio/video 两个高危 tab)见 musicSourceTabs() 注释. */
const MUSIC_SOURCE_UPLOAD_ENABLED = true;   // W1694 — 上架后恢复(见上方折中方案)
globalThis.MUSIC_SOURCE_UPLOAD_ENABLED = MUSIC_SOURCE_UPLOAD_ENABLED;

const musicSourceUploadState = {
  audio: null,
  video: null,
  midi: null,
  musicxml: null,
  sheet: null,
  image: null,
  // Last selected tab — restored on remount
  activeTab: "audio",
  // Per-input analysis results (asset_url, whisper text, vision analysis, etc.)
  result: null,
};
globalThis.musicSourceUploadState = musicSourceUploadState;

const musicSourceUploadPending = {
  audio: false,
  video: false,
  midi: false,
  musicxml: false,
  sheet: false,
  image: false,
};

// ────────────────────────────────────────────────────────────────────
// Wave 111D-AUTOFILL · structured lyrics, title inference, style infer
// ────────────────────────────────────────────────────────────────────

/* Turn a wall-of-text lyric into a 京典-style section-labeled block:
 *   [Verse 1]
 *   line1
 *   line2
 *
 *   [Chorus 1]
 *   ...
 *
 * Algorithm:
 *   1. Split by newline OR sentence punctuation (whisper output often
 *      lacks line breaks entirely).
 *   2. Dedup adjacent identical lines (whisper repeats verse 1 a lot).
 *   3. Detect chorus by finding a 2-4 line block that recurs ≥ 2 times.
 *   4. Walk the lines: chorus block → Chorus; non-chorus runs of up to
 *      4 lines → Verse; single short non-chorus between two choruses →
 *      Bridge; final non-chorus → Outro.
 */
function _miStructureLyrics(raw) {
  if (!raw || typeof raw !== "string") return "";
  let lines = raw.split(/[\n\r]+|(?<=[.!?。！？])\s+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (lines.length === 0) return raw.trim();
  // dedup adjacent
  const dedup = [];
  for (const l of lines) {
    if (!dedup.length || dedup[dedup.length - 1].toLowerCase() !== l.toLowerCase()) {
      dedup.push(l);
    }
  }
  // find chorus
  let chorus = null;
  outer: for (let size = 4; size >= 2; size--) {
    const counts = new Map();
    for (let i = 0; i + size <= dedup.length; i++) {
      const key = dedup.slice(i, i + size).map((s) => s.toLowerCase()).join("|");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const [k, c] of counts) {
      if (c >= 2) { chorus = k.split("|"); break outer; }
    }
  }
  // segment
  const sections = [];
  let buf = [];
  const flushVerse = () => {
    if (buf.length) { sections.push({ kind: "verse", lines: buf.slice() }); buf = []; }
  };
  let i = 0;
  while (i < dedup.length) {
    if (chorus && i + chorus.length <= dedup.length) {
      const peek = dedup.slice(i, i + chorus.length).map((s) => s.toLowerCase()).join("|");
      if (peek === chorus.join("|")) {
        flushVerse();
        sections.push({ kind: "chorus", lines: dedup.slice(i, i + chorus.length) });
        i += chorus.length;
        continue;
      }
    }
    buf.push(dedup[i]);
    i++;
    if (buf.length >= 4) flushVerse();
  }
  flushVerse();
  // relabel: last verse → outro; verse between two choruses with ≤2 lines → bridge
  if (sections.length) {
    const last = sections[sections.length - 1];
    if (last.kind === "verse") last.kind = "outro";
    for (let k = 1; k < sections.length - 1; k++) {
      if (
        sections[k].kind === "verse" && sections[k].lines.length <= 2 &&
        sections[k - 1].kind === "chorus" && sections[k + 1].kind === "chorus"
      ) {
        sections[k].kind = "bridge";
      }
    }
  }
  let vN = 0, cN = 0;
  return sections.map((s) => {
    let label;
    if (s.kind === "chorus") label = `[Chorus ${++cN}]`;
    else if (s.kind === "bridge") label = `[Bridge]`;
    else if (s.kind === "outro") label = `[Outro]`;
    else label = `[Verse ${++vN}]`;
    return `${label}\n${s.lines.join("\n")}`;
  }).join("\n\n");
}

/* Suno (and most music engines) can ONLY parse English bracketed section
 * tags like [Verse 1] [Chorus 1] [Bridge] [Outro]. Anything else — Chinese
 * 【第一节】, Japanese 「サビ」, French (Couplet), or even unbracketed
 * "Verse 1:" — gets sung out loud as if it were a lyric. This pass walks
 * common label patterns and rewrites them all to the canonical
 * [Verse N] / [Chorus N] / [Bridge] / [Outro] / [Pre-Chorus] / [Intro] form.
 * Exposed on globalThis so the magic-wand and pipeline runner can call it
 * as a final safety pass before lyrics go to Suno. */
function _miNormalizeSectionLabels(text) {
  if (!text || typeof text !== "string") return "";
  let counts = { verse: 0, chorus: 0, prechorus: 0, bridge: 0, intro: 0, outro: 0, hook: 0, interlude: 0 };
  // Patterns: capture optional number and label
  // 1. Bracketed CJK / Japanese / generic non-English variants
  const patterns = [
    // 【第N段/节/章/小节】, 【主歌/副歌/桥段/前奏/间奏/尾声/导歌/前副歌】
    { re: /[【\[［](\s*第\s*([一二三四五六七八九十0-9]+)\s*[段节章小节]?\s*)?(主歌|副歌|桥段|前奏|间奏|尾声|导歌|前副歌|过渡|结尾|开头)\s*([一二三四五六七八九十0-9]+)?[】\]］]/g,
      map: (m, _g1, n1, label, n2) => {
        const n = _miCjkNumToInt(n1 || n2);
        if (label === "副歌") return ++counts.chorus, `[Chorus ${counts.chorus}]`;
        if (label === "主歌") return ++counts.verse, `[Verse ${counts.verse}]`;
        if (label === "桥段" || label === "过渡") return `[Bridge]`;
        if (label === "前奏" || label === "开头") return `[Intro]`;
        if (label === "间奏") return `[Interlude]`;
        if (label === "尾声" || label === "结尾") return `[Outro]`;
        if (label === "导歌" || label === "前副歌") return `[Pre-Chorus]`;
        return m;
      }
    },
    // 【第N节】 alone (no main label) → Verse N
    { re: /[【\[［]\s*第\s*([一二三四五六七八九十0-9]+)\s*[段节章小节]\s*[】\]］]/g,
      map: (_m, n1) => { const n = _miCjkNumToInt(n1); counts.verse = Math.max(counts.verse, n); return `[Verse ${n}]`; }
    },
    // Japanese サビ / Aメロ / Bメロ / イントロ / アウトロ / ブリッジ
    { re: /[「『\[［](サビ|Aメロ|Bメロ|Ａメロ|Ｂメロ|イントロ|アウトロ|ブリッジ|間奏)」』\]］]?/g,
      map: (_m, label) => {
        if (label === "サビ") return ++counts.chorus, `[Chorus ${counts.chorus}]`;
        if (/Aメロ|Ａメロ/.test(label)) return ++counts.verse, `[Verse ${counts.verse}]`;
        if (/Bメロ|Ｂメロ/.test(label)) return ++counts.verse, `[Verse ${counts.verse}]`;
        if (label === "イントロ") return `[Intro]`;
        if (label === "アウトロ") return `[Outro]`;
        if (label === "ブリッジ") return `[Bridge]`;
        if (label === "間奏") return `[Interlude]`;
        return _m;
      }
    },
    // Unbracketed "Verse 1:" / "Chorus:" / "Bridge -" → [Verse 1] etc.
    { re: /^\s*(Verse|Chorus|Pre[\s-]?Chorus|Bridge|Intro|Outro|Hook|Interlude|Refrain)\s*(\d+)?\s*[:\-—]?\s*$/gim,
      map: (_m, label, num) => {
        const L = String(label).toLowerCase().replace(/[\s-]/g, "");
        const n = Number(num) || 0;
        if (L === "verse") return n ? `[Verse ${n}]` : `[Verse ${++counts.verse}]`;
        if (L === "chorus" || L === "refrain") return n ? `[Chorus ${n}]` : `[Chorus ${++counts.chorus}]`;
        if (L === "prechorus") return `[Pre-Chorus]`;
        if (L === "bridge") return `[Bridge]`;
        if (L === "intro") return `[Intro]`;
        if (L === "outro") return `[Outro]`;
        if (L === "hook") return `[Hook]`;
        if (L === "interlude") return `[Interlude]`;
        return _m;
      }
    },
    // French (Couplet 1) / (Refrain) etc.
    { re: /[(（]\s*(Couplet|Refrain|Pont|Intro(?:duction)?|Outro|Conclusion)\s*(\d+)?\s*[)）]/gi,
      map: (_m, label, num) => {
        const L = String(label).toLowerCase();
        const n = Number(num) || 0;
        if (L.startsWith("couplet")) return n ? `[Verse ${n}]` : `[Verse ${++counts.verse}]`;
        if (L.startsWith("refrain")) return n ? `[Chorus ${n}]` : `[Chorus ${++counts.chorus}]`;
        if (L === "pont") return `[Bridge]`;
        if (L.startsWith("intro")) return `[Intro]`;
        if (L === "outro" || L === "conclusion") return `[Outro]`;
        return _m;
      }
    },
  ];
  let out = text;
  for (const p of patterns) out = out.replace(p.re, p.map);
  return out;
}

function _miCjkNumToInt(s) {
  if (s == null) return 0;
  if (/^\d+$/.test(String(s))) return Number(s);
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return map[String(s).trim()] || 0;
}

try { globalThis.cssosNormalizeSongSectionLabels = _miNormalizeSectionLabels; } catch (_) {}

/* Pick the best title: explicit meta.title → vision.suggested_title →
 * sheet_title → cleaned filename → first non-trivial lyric line. */
function _miInferTitle(result) {
  const candidates = [
    result.sheet_title,
    result.vision && result.vision.suggested_title,
    result.meta && result.meta.title,
    result.file_name && String(result.file_name).replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[_·.\-]+/g, " ").trim(),
  ];
  for (const c of candidates) {
    if (c && String(c).trim().length > 0) return String(c).trim();
  }
  // Fall back to first lyric line
  const txt = (result.whisper && result.whisper.text) ||
    (result.midi_lyrics && result.midi_lyrics.text) || "";
  const first = txt.split(/[\n\r.!?。！？,，]/).map((s) => s.trim()).filter(Boolean)[0] || "";
  return first.slice(0, 60);
}

/* Style hint: vision.music_style_hint → tempo_marking → bpm → notation. */
function _miInferStyle(result) {
  if (result.vision && result.vision.music_style_hint) return String(result.vision.music_style_hint).trim();
  if (result.tempo_marking) return String(result.tempo_marking).trim();
  if (result.tempo_bpm) return `${result.tempo_bpm} bpm`;
  if (result.sheet_civilization) return String(result.sheet_civilization).trim();
  return "";
}

function _miTr(en, zh) {
  return typeof globalThis.loginCopy === "function"
    ? globalThis.loginCopy(en, zh || en)
    : en;
}

function _miEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function _miFmtBytes(n) {
  const v = Number(n || 0);
  if (v >= 1024 * 1024) return (v / (1024 * 1024)).toFixed(1) + " MB";
  if (v >= 1024) return (v / 1024).toFixed(1) + " KB";
  return v + " B";
}

function _miFmtSecs(n) {
  const s = Math.max(0, Math.round(Number(n || 0)));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

/* W1694 — 渲染用: 只返回 active !== false 的 tab。`musicSourceTabs()` 仍返回全量,
 * 因为 tabByKey() / 历史状态可能引用被隐藏的 key(隐藏≠删除, 老草稿不炸)。 */
function musicSourceTabsEnabled() {
  return musicSourceTabs().filter((t) => t.active !== false);
}

function musicSourceTabs() {
  return [
    {
      key: "audio",
      icon: "🎵",
      label: _miTr("Audio", "音频"),
      accept: "audio/*,.mp3,.wav,.m4a,.flac,.ogg,.aac",
      active: true,  // W1753 — 上架后解禁。合规三闸: 所有权声明(attestation)+ DRM 拒加密 + ACRCloud 指纹→requires_clearance(命中版权仅私播、禁 marketplace)。
      hint: _miTr(
        "Upload mp3/wav/m4a etc. We extract time-coded lyrics (Whisper) and skip the music stage. Pipeline still generates cover + video + subtitles.",
        "上传 mp3 / wav 等成熟音频。系统用 Whisper 抽取时间戳化的歌词，跳过音乐生成阶段。封面 + 视频 + 字幕仍由 cssMV 渲染。"
      ),
      endpoint: "/api/mv/audio/upload",
      field: "audio",
    },
    {
      key: "video",
      icon: "🎬",
      label: _miTr("Video", "视频"),
      accept: "video/*,.mp4,.mov,.webm,.mkv",
      active: true,  // W1753 — 上架后解禁。合规三闸: 所有权声明(attestation)+ DRM 拒加密 + ACRCloud 指纹→requires_clearance。
      hint: _miTr(
        "Upload mp4/mov etc. We extract the audio track, transcribe with Whisper, and reuse your video as-is. Only subtitles + compose run.",
        "上传 mp4 / mov 等。系统抽取音轨，用 Whisper 转录为字幕，直接复用你的视频画面。只跑字幕 + 合成阶段。"
      ),
      endpoint: "/api/mv/video/upload",
      field: "video",
    },
    {
      key: "midi",
      icon: "🎼",
      label: _miTr("MIDI", "MIDI"),
      accept: ".mid,.midi,audio/midi,audio/x-midi",
      active: true,  // Wave 111B
      hint: _miTr(
        "Upload .mid/.midi. We extract the embedded lyric track + timing, and synthesize reference audio via fluidsynth (TimGM6mb soundfont). If no lyric track, you'll get the synthesized music as instrumental.",
        "上传 .mid / .midi。系统抽取内嵌歌词轨 + 时间戳，并用 fluidsynth + TimGM6mb 音色库合成参考音频。如果文件无歌词轨，你会得到一段纯器乐合成版本。"
      ),
      endpoint: "/api/mv/midi/upload",
      field: "midi",
    },
    {
      key: "musicxml",
      icon: "📝",
      label: _miTr("MusicXML", "MusicXML"),
      accept: ".musicxml,.xml,.mxl,application/vnd.recordare.musicxml+xml,application/xml,text/xml",
      active: true,  // Wave 111B
      hint: _miTr(
        "Upload .musicxml/.xml/.mxl. Lyrics and the exact per-word timeline are read straight from the score (from note durations — nothing is estimated). Faithful transcription: the score is converted, never re-composed.",
        "上传 .musicxml / .xml / .mxl。歌词与逐字时间轴【直接从乐谱解出】(按音符时值精确计算,不做任何估算)。忠实转换:原样还原乐谱,绝不重新作曲。"
      ),
      endpoint: "/api/mv/musicxml/upload",
      field: "musicxml",
    },
    {
      key: "sheet",
      icon: "📜",
      label: _miTr("Sheet music", "歌谱"),
      accept: "image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.webp",
      active: true,  // Wave 111C
      hint: _miTr(
        "Upload a screenshot or PDF of sheet music you have legal access to (numbered notation 简谱, staff notation 五线谱, lead sheet, chord-lyric chart). Claude Vision extracts lyrics + metadata. For sheets behind paywalls, you must log in to that site and capture/download legally — we only OCR what you give us.",
        "上传你合法持有的歌谱截图或 PDF（简谱 / 五线谱 / 弹唱谱 / Lead Sheet）。Claude Vision 识别歌词 + 标题 / 速度 / 调号 / 拍号。需要付费的歌谱请你自己登录歌谱网站合法获取截图 —— 我们只做你提供内容的 OCR，不爬付费网站。"
      ),
      endpoint: "/api/mv/sheet/upload",
      field: "sheet",
    },
    {
      key: "image",
      icon: "🖼️",
      label: _miTr("Image", "图片"),
      accept: "image/*,.jpg,.jpeg,.png,.webp",
      active: true,  // Wave 111A
      hint: _miTr(
        "Upload any image with no music context. Claude Vision describes it and proposes a song prompt; pipeline runs the full stack from there.",
        "上传任意图片（与音乐无任何关联）。Claude Vision 解读画面并自动生成歌词主题；之后走完整 MV 流程。"
      ),
      endpoint: "/api/mv/image/analyze",
      field: "image",
    },
  ];
}

function _miFindTab(key) {
  return musicSourceTabs().find((t) => t.key === key) || null;
}

/* ─── Styles ─── */

function _miInjectStyle() {
  if (document.getElementById("cssos-music-source-tabs-style")) return;
  const st = document.createElement("style");
  st.id = "cssos-music-source-tabs-style";
  st.textContent = [
    ".msrc-card { border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:14px; }",
    /* CSSOS_WAVE_220A 20260518 v14 — track + thumb. */
    ".msrc-tabbar { display:flex; gap:0; overflow-x:auto; scrollbar-width:none; -ms-overflow-style:none; -webkit-overflow-scrolling:touch; padding:4px; margin-bottom:12px; background:rgba(0,245,160,0.10); border:1px solid rgba(0,245,160,0.30); border-radius:999px; align-items:stretch; }",
    ".msrc-tabbar::-webkit-scrollbar { display:none; }",
    ".msrc-tab { flex:1 1 auto; min-width:max-content; display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:9px 16px; box-sizing:border-box; border-radius:0; border:0; background:transparent; color:var(--text); cursor:pointer; font:500 12px/1 -apple-system,system-ui,sans-serif; white-space:nowrap; transition: background 180ms ease, color 180ms ease; }",
    ".msrc-tab.active { border:0 !important; border-left:1px solid rgba(0,245,160,0.30) !important; border-right:1px solid rgba(0,245,160,0.30) !important; border-radius:999px !important; color:var(--text,#fff); font-weight:600; box-shadow:none; }",
    /* v17.1 — inactive curves: ( for before-active, ) for after-active. */
    ".msrc-tabbar > .msrc-tab:has(~ .msrc-tab.active) { border-left:1px solid rgba(0,245,160,0.30) !important; border-radius:999px 0 0 999px !important; }",
    ".msrc-tabbar > .msrc-tab.active ~ .msrc-tab { border-right:1px solid rgba(0,245,160,0.30) !important; border-radius:0 999px 999px 0 !important; }",
    /* 6-hue rotation. */
    ".msrc-tabbar > .msrc-tab:nth-child(6n+1):hover:not(.active) { background:hsla(150,80%,70%,0.22); }",
    ".msrc-tabbar > .msrc-tab:nth-child(6n+2):hover:not(.active) { background:hsla(200,80%,70%,0.22); }",
    ".msrc-tabbar > .msrc-tab:nth-child(6n+3):hover:not(.active) { background:hsla(280,80%,75%,0.22); }",
    ".msrc-tabbar > .msrc-tab:nth-child(6n+4):hover:not(.active) { background:hsla(340,80%,75%,0.22); }",
    ".msrc-tabbar > .msrc-tab:nth-child(6n+5):hover:not(.active) { background:hsla(45,90%,70%,0.22); }",
    ".msrc-tabbar > .msrc-tab:nth-child(6n+6):hover:not(.active) { background:hsla(95,70%,65%,0.22); }",
    ".msrc-tabbar > .msrc-tab:nth-child(6n+1).active { background:hsla(150,80%,55%,0.50) !important; }",
    ".msrc-tabbar > .msrc-tab:nth-child(6n+2).active { background:hsla(200,80%,55%,0.50) !important; }",
    ".msrc-tabbar > .msrc-tab:nth-child(6n+3).active { background:hsla(280,80%,60%,0.50) !important; }",
    ".msrc-tabbar > .msrc-tab:nth-child(6n+4).active { background:hsla(340,80%,60%,0.50) !important; }",
    ".msrc-tabbar > .msrc-tab:nth-child(6n+5).active { background:hsla(45,90%,55%,0.50) !important; }",
    ".msrc-tabbar > .msrc-tab:nth-child(6n+6).active { background:hsla(95,70%,50%,0.50) !important; }",
    ".msrc-tab.coming-soon { opacity:0.55; }",
    /* CSSOS_WAVE_1786 20260727 — Jing: App 端胶囊轨道要【缩短】, 别顶出面板两边。
     * 窄屏(手机/助理小窗)下让胶囊可收缩(flex-basis 0 + min-width 0)并收紧内边距,
     * 六个胶囊就能整条排进轨道, 轨道不再横向溢出。只动尺寸, 几何/配色/交互一律不碰。 */
    "@media (max-width:560px) {" +
    "  .msrc-tabbar { max-width:100%; }" +
    "  .msrc-tab { flex:1 1 0; min-width:0; padding:9px 6px; gap:3px; font-size:11px; }" +
    "  .msrc-tab > span:not(.msrc-tab-icon) { overflow:hidden; text-overflow:ellipsis; }" +
    "  .msrc-tab .msrc-tab-icon { font-size:12px; }" +
    "  .msrc-tab .msrc-tab-badge { display:none; }" +
    /* 同一波第二处 —— Jing:「下面还有 3 个也需要缩短」(输入框 / Choose File 行 / 应用+清除条)。
     * 实测元凶不是这三行本身: 原生 file input 的固有最小宽度顺着 .msrc-pane 往上把 .msrc-card
     * 撑到 399px(容器只有 341px), 于是卡片里所有块级子元素都被拉到同一个超宽宽度。
     * 给这条链上的三个节点封顶(卡片 max-width + pane/file-input 允许收缩)后
     * scrollWidth 402→341 = 容器宽, 三行同时归位。只封宽度, 不动别处。 */
    "  .msrc-card { max-width:100%; box-sizing:border-box; }" +
    "  .msrc-pane { min-width:0; max-width:100%; }" +
    "  .msrc-file-input { min-width:0; max-width:100%; box-sizing:border-box; }" +
    "}",
    ".msrc-tab .msrc-tab-icon { font-size:14px; }",
    ".msrc-tab .msrc-tab-badge { font-size:11px; padding:1px 5px; border-radius:4px; background:rgba(255,200,0,0.18); color:#ffc83d; margin-left:2px; }",
    ".msrc-pane { padding:6px 2px; }",
    ".msrc-pane-title { font-size:13px; font-weight:700; color:var(--text); margin:0 0 6px; }",
    ".msrc-pane-hint { font-size:11.5px; opacity:0.72; line-height:1.5; margin:0 0 12px; }",
    ".msrc-file-row { display:flex; align-items:center; gap:8px; margin-bottom:10px; }",
    ".msrc-file-input { flex:1; padding:8px; border-radius:8px; background:rgba(255,255,255,0.04); border:1px dashed rgba(255,255,255,0.22); color:var(--text); font:inherit; cursor:pointer; }",
    ".msrc-status { font:500 11.5px/1.5 ui-monospace,monospace; min-height:16px; opacity:0.85; margin-top:4px; }",
    ".msrc-status.ok { color:#00f5a0; }",
    ".msrc-status.err { color:#ff6b6b; }",
    ".msrc-status.pending { color:#ffc83d; }",
    ".msrc-progress { display:flex; flex-direction:column; gap:4px; margin-top:4px; }",
    ".msrc-progress-track { position:relative; height:8px; border-radius:6px; background:rgba(255,255,255,0.07); overflow:hidden; border:1px solid rgba(255,255,255,0.08); }",
    ".msrc-progress-fill { position:absolute; left:0; top:0; bottom:0; width:0%; border-radius:6px; transition: width 240ms ease, background-color 320ms ease, filter 320ms ease; box-shadow: 0 0 8px currentColor; }",
    ".msrc-progress-fill.indeterminate { animation: msrcShimmer 1.4s linear infinite; background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%); background-size: 60% 100%; background-repeat: no-repeat; }",
    "@keyframes msrcShimmer { 0% { background-position: -60% 0; } 100% { background-position: 160% 0; } }",
    ".msrc-progress-label { font:600 11px/1.3 ui-monospace,monospace; color:var(--text); opacity:0.9; }",
    ".msrc-progress-label .pct { color:#00f5a0; margin-left:6px; }",
    ".msrc-result { margin-top:10px; padding:10px 12px; border-radius:10px; background:rgba(0,245,160,0.06); border:1px solid rgba(0,245,160,0.22); font-size:12px; line-height:1.55; }",
    ".msrc-result .msrc-result-row { display:flex; justify-content:space-between; padding:2px 0; }",
    ".msrc-result .msrc-result-key { opacity:0.7; }",
    ".msrc-result .msrc-result-val { font-family:ui-monospace,monospace; color:var(--text); }",
    ".msrc-lyrics-preview { margin-top:8px; max-height:140px; overflow-y:auto; padding:8px; border-radius:6px; background:rgba(0,0,0,0.32); font-family:ui-monospace,monospace; font-size:11px; line-height:1.6; color:#9efbcb; white-space:pre-wrap; }",
    ".msrc-vision { margin-top:8px; padding:8px; border-radius:6px; background:rgba(0,0,0,0.32); font-size:12px; color:var(--text); line-height:1.55; }",
    ".msrc-vision-row { padding:3px 0; }",
    ".msrc-vision-key { font-weight:600; color:#9efbcb; }",
    ".msrc-actions { display:flex; gap:8px; margin-top:14px; flex-wrap:wrap; }",
    ".msrc-actions button { padding:7px 14px; border-radius:999px; cursor:pointer; font:600 12px/1.2 -apple-system,system-ui,sans-serif; }",
    ".msrc-actions .msrc-btn-apply { background:linear-gradient(135deg,#00f5a0,#00b87a); color:#0a0d12; border:0; font-weight:700; }",
    ".msrc-actions .msrc-btn-clear { background:transparent; color:var(--text); border:1px solid rgba(255,255,255,0.18); }",
    ".msrc-coming-soon { text-align:center; padding:32px 12px; opacity:0.75; font-size:13px; }",
    ".msrc-clearance-warn { margin-top:10px; padding:8px 10px; border-radius:8px; background:rgba(255,107,107,0.1); border:1px solid rgba(255,107,107,0.32); color:#ff9b9b; font-size:11.5px; line-height:1.5; }",
  ].join("\n");
  /* CSSOS_WAVE_513b 20260530 — strip injected :has() rules (iOS/macOS WebKit crash). */
  if (st.textContent.indexOf(":has(") !== -1) {
    st.textContent = st.textContent.replace(/[^{}]*:has\([^{}]*\{[^{}]*\}/g, "");
  }
  document.head.appendChild(st);
}

/* ─── Render ─── */

function buildMusicSourceUploadCardMarkup() {
  _miInjectStyle();
  const tabs = musicSourceTabsEnabled();   // W1694
  const activeKey = musicSourceUploadState.activeTab || "audio";
  const activeTab = _miFindTab(activeKey) || tabs[0];

  /* CSSOS_WAVE_1782 20260726 — Jing 明确指令:「选中谁，谁在第一个位置」。
   * 这是平台胶囊宪法里的 Dock 规则(选中即成为第一颗) —— 选中项当"凸"的锚点岛,
   * 其余全部凹向它, 整条才读作一条连贯的 凸嵌凹 雕刻带; 锚点在中间时两侧会各断一次。
   *
   * ⚠️ .msrc-tabbar 在 W220.A 永久冻结清单里。本次改动是 Jing 指名的那一条(且授权改函数,
   * 以便高级设置面板同步生效), 只动【顺序】—— 每个 tab 的结构、class、样式一律不碰。 */
  const orderedTabs = tabs.slice().sort((a, b) =>
    (a.key === activeKey ? -1 : 0) - (b.key === activeKey ? -1 : 0));

  const tabBar = orderedTabs.map((t) => {
    const isActive = t.key === activeKey;
    const isComing = !t.active;
    return `<button type="button" class="msrc-tab ${isActive ? "active" : ""} ${isComing ? "coming-soon" : ""}" data-msrc-tab="${_miEsc(t.key)}">
      <span class="msrc-tab-icon">${_miEsc(t.icon)}</span>
      <span>${_miEsc(t.label)}</span>
      ${isComing ? `<span class="msrc-tab-badge">${_miEsc(_miTr("soon", "敬请期待"))}</span>` : ""}
    </button>`;
  }).join("");

  let pane = "";
  if (!activeTab.active) {
    // Wave 111B/C placeholder
    pane = `<div class="msrc-coming-soon">
      <div style="font-size:32px; margin-bottom:8px;">${_miEsc(activeTab.icon)}</div>
      <div style="font-weight:700; color:var(--text); margin-bottom:6px;">${_miEsc(activeTab.label)}</div>
      <div>${_miEsc(activeTab.hint)}</div>
    </div>`;
  } else {
    const fileSlot = musicSourceUploadState[activeKey];
    const result = musicSourceUploadState.result;
    const resultMatchesActive = result && result._tab === activeKey;
    const needsAttest = (activeKey === "audio" || activeKey === "video");
    const attested = !!musicSourceUploadState.attested;
    pane = `<div class="msrc-pane" data-msrc-pane="${_miEsc(activeKey)}">
      <p class="msrc-pane-hint">${_miEsc(activeTab.hint)}</p>
      ${needsAttest ? `
      <label class="msrc-attest-row" style="display:flex;gap:8px;align-items:flex-start;margin:0 0 10px;padding:9px 11px;border-radius:8px;background:rgba(0,245,160,0.06);border:1px solid rgba(0,245,160,0.24);font-size:11.5px;line-height:1.5;cursor:pointer;">
        <input type="checkbox" data-msrc-attest ${attested ? "checked" : ""} style="margin-top:2px;flex:0 0 auto;width:16px;height:16px;cursor:pointer;" />
        <span>${_miEsc(activeKey === "audio"
          ? _miTr("I own or have the rights to use this audio. Uploading material you don't hold the rights to is not permitted.", "我拥有或已获授权使用这段音频。不得上传你不持有版权的内容。")
          : _miTr("I own or have the rights to use this video. Uploading material you don't hold the rights to is not permitted.", "我拥有或已获授权使用这段视频。不得上传你不持有版权的内容。"))}</span>
      </label>` : ""}
      <div class="msrc-file-row">
        <input class="msrc-file-input" type="file" accept="${_miEsc(activeTab.accept)}"
               data-msrc-upload="${_miEsc(activeKey)}"${(needsAttest && !attested) ? " disabled title=\"" + _miEsc(_miTr("Confirm ownership above first", "请先勾选上方所有权声明")) + "\" style=\"opacity:0.45;cursor:not-allowed;\"" : ""} />
      </div>
      ${activeKey === "sheet" ? `
      <div class="msrc-url-row" style="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap;">
        <input type="url" data-msrc-sheet-url placeholder="${_miEsc(_miTr("…or paste a public HTTPS PDF/image URL (IMSLP, raw GitHub, etc.)", "…或粘贴公开 HTTPS PDF/图片 URL（如 IMSLP、GitHub raw 等）"))}"
               style="flex:1 1 260px;min-width:0;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:var(--text);font-size:13px;" />
        <button type="button" data-msrc-sheet-url-go style="padding:8px 14px;border-radius:8px;border:1px solid rgba(0,245,160,0.4);background:rgba(0,245,160,0.12);color:var(--text);font-weight:600;cursor:pointer;">${_miEsc(_miTr("Import URL", "导入 URL"))}</button>
        <span style="font-size:11px;opacity:0.6;flex:1 1 100%;">${_miEsc(_miTr("Tip: you can also paste a screenshot directly (⌘V / Ctrl+V) while this tab is focused.", "提示：聚焦此面板时可直接粘贴截图（⌘V / Ctrl+V）。"))}</span>
      </div>` : ""}
      <div class="msrc-status" data-msrc-status="${_miEsc(activeKey)}">${
        fileSlot
          ? _miEsc(_miTr("File selected: ", "已选择文件：") + (fileSlot.name || _miTr("(unnamed)", "(未命名)")))
          : ""
      }</div>
      ${resultMatchesActive ? _miRenderResultBlock(result) : ""}
      <div class="msrc-actions" data-segmented="2" data-pill-bar>
        <button type="button" class="msrc-btn-apply" data-msrc-apply="${_miEsc(activeKey)}"
                ${resultMatchesActive ? "" : "disabled style=\"opacity:0.45;cursor:not-allowed;\""}>
          ${_miEsc(_miTr("Apply to MV Pipeline", "应用到 MV 管线"))}
        </button>
        <button type="button" class="msrc-btn-clear" data-msrc-clear="${_miEsc(activeKey)}">
          ${_miEsc(_miTr("Clear", "清除"))}
        </button>
      </div>
    </div>`;
  }

  return `<section class="advanced-panel-card msrc-card" data-advanced-panel="music-sources">
    <div class="advanced-panel-card-title">${_miEsc(_miTr("Music Source Uploads", "音乐源上传"))}</div>
    <div class="advanced-panel-note">${_miEsc(_miTr(
      "Pick one of five input types. Your input replaces the matching pipeline stages; the rest still run via cssMV.",
      "选一种输入类型 —— 它会替换对应的 cssMV 流程阶段，其余阶段照常生成。"
    ))}</div>
    <nav class="msrc-tabbar">${tabBar}</nav>
    ${pane}
  </section>`;
}

function _miRenderResultBlock(result) {
  if (!result) return "";
  const lines = [];
  if (result.duration_secs)
    lines.push(`<div class="msrc-result-row"><span class="msrc-result-key">${_miEsc(_miTr("Duration", "时长"))}</span><span class="msrc-result-val">${_miFmtSecs(result.duration_secs)}</span></div>`);
  if (result.width && result.height)
    lines.push(`<div class="msrc-result-row"><span class="msrc-result-key">${_miEsc(_miTr("Size", "尺寸"))}</span><span class="msrc-result-val">${result.width}×${result.height}${result.fps ? " @ " + result.fps + "fps" : ""}</span></div>`);
  if (result.codec || result.vcodec)
    lines.push(`<div class="msrc-result-row"><span class="msrc-result-key">${_miEsc(_miTr("Codec", "编码"))}</span><span class="msrc-result-val">${_miEsc(result.codec || result.vcodec || "")}</span></div>`);
  // MIDI / MusicXML specific
  if (result.tempo_bpm)
    lines.push(`<div class="msrc-result-row"><span class="msrc-result-key">${_miEsc(_miTr("Tempo", "速度"))}</span><span class="msrc-result-val">${result.tempo_bpm} bpm · ${_miEsc(result.time_signature || "")}</span></div>`);
  if (result.note_count)
    lines.push(`<div class="msrc-result-row"><span class="msrc-result-key">${_miEsc(_miTr("Notes", "音符"))}</span><span class="msrc-result-val">${result.note_count} · ${result.track_count || 1} ${_miTr("track(s)", "音轨")}</span></div>`);
  if (result.bytes)
    lines.push(`<div class="msrc-result-row"><span class="msrc-result-key">${_miEsc(_miTr("Size on disk", "占用空间"))}</span><span class="msrc-result-val">${_miFmtBytes(result.bytes)}</span></div>`);
  if (Array.isArray(result.skip_stages) && result.skip_stages.length)
    lines.push(`<div class="msrc-result-row"><span class="msrc-result-key">${_miEsc(_miTr("Skips stages", "跳过阶段"))}</span><span class="msrc-result-val">${_miEsc(result.skip_stages.join(", "))}</span></div>`);
  if (result.has_lyrics === false)
    lines.push(`<div class="msrc-result-row"><span class="msrc-result-key">${_miEsc(_miTr("Lyrics", "歌词"))}</span><span class="msrc-result-val" style="color:#ffc83d;">${_miEsc(_miTr("not embedded — instrumental only", "未嵌入歌词 — 纯器乐"))}</span></div>`);
  // Sheet music specific rows
  if (result._tab === "sheet") {
    if (result.notation_type)
      lines.push(`<div class="msrc-result-row"><span class="msrc-result-key">${_miEsc(_miTr("Notation", "记谱法"))}</span><span class="msrc-result-val">${_miEsc(result.notation_type)}</span></div>`);
    if (result.sheet_title)
      lines.push(`<div class="msrc-result-row"><span class="msrc-result-key">${_miEsc(_miTr("Title", "标题"))}</span><span class="msrc-result-val">${_miEsc(result.sheet_title)}</span></div>`);
    if (result.composer || result.lyricist) {
      const parts = [];
      if (result.composer) parts.push(_miTr("Composer ", "作曲 ") + result.composer);
      if (result.lyricist) parts.push(_miTr("Lyricist ", "作词 ") + result.lyricist);
      lines.push(`<div class="msrc-result-row"><span class="msrc-result-key">${_miEsc(_miTr("Credits", "信息"))}</span><span class="msrc-result-val">${_miEsc(parts.join(" · "))}</span></div>`);
    }
    if (result.key_signature)
      lines.push(`<div class="msrc-result-row"><span class="msrc-result-key">${_miEsc(_miTr("Key", "调号"))}</span><span class="msrc-result-val">${_miEsc(result.key_signature)}</span></div>`);
    if (result.sheet_pages)
      lines.push(`<div class="msrc-result-row"><span class="msrc-result-key">${_miEsc(_miTr("Pages OCRed", "已识别页数"))}</span><span class="msrc-result-val">${result.sheet_pages}</span></div>`);
    if (typeof result.sheet_confidence === "number")
      lines.push(`<div class="msrc-result-row"><span class="msrc-result-key">${_miEsc(_miTr("OCR confidence", "识别置信度"))}</span><span class="msrc-result-val" style="color:${result.sheet_confidence > 0.75 ? "#00f5a0" : result.sheet_confidence > 0.5 ? "#ffc83d" : "#ff9b9b"};">${Math.round(result.sheet_confidence * 100)}%</span></div>`);
  }

  let extra = "";
  // W1750 (111E ②) — audio version chooser. When the backend rendered a
  // melody-muted 伴奏, let the user pick which mix feeds the MV. Fixed 2-way
  // switch → tab-pill constitution Mode 1 (data-segmented="2"). Default = full.
  if (result.backing_asset_url) {
    const isFull = result._chosenVersion !== "backing";
    const activeSrc = isFull ? result.asset_url : result.backing_asset_url;
    extra += `<div style="margin-top:10px;">
      <div style="font:600 11.5px/1.4 ui-monospace,monospace;color:var(--muted);margin-bottom:6px;">${_miEsc(_miTr("🎚 Audio version — pick what the MV uses", "🎚 音频版本 — 选择进入 MV 的版本"))}</div>
      <div data-segmented="2" style="max-width:380px;">
        <button type="button" class="${isFull ? "active" : ""}" data-msrc-audio-version="full">🎵 ${_miEsc(_miTr("Full music", "纯音乐"))}</button>
        <button type="button" class="${!isFull ? "active" : ""}" data-msrc-audio-version="backing">🎤 ${_miEsc(_miTr("Backing (for vocals)", "伴奏（留人声）"))}</button>
      </div>
      <div style="font:500 10.5px/1.4 ui-monospace,monospace;color:var(--muted);margin:5px 0 4px;">${_miEsc(isFull
        ? _miTr("Complete instrumental — melody included.", "完整器乐 — 含旋律主线。")
        : _miTr("Melody muted — room to add vocals later.", "已静音旋律 — 之后可叠加人声。"))}</div>
      ${activeSrc ? `<audio controls preload="none" src="${_miEsc(activeSrc)}" style="width:100%;height:34px;"></audio>` : ""}
    </div>`;
  }
  const _miTitle = _miInferTitle(result);
  const _miStructuredRaw =
    (result.whisper && result.whisper.text && _miStructureLyrics(result.whisper.text)) ||
    (result.midi_lyrics && result.midi_lyrics.text && _miStructureLyrics(result.midi_lyrics.text)) ||
    "";
  // CSSOS_WAVE_111D_LABELS 20260512 — normalize any non-English section
  // labels to bracketed English. Suno can't parse 【第一节】 or similar
  // and will literally sing the label out loud.
  const _miStructured = _miStructuredRaw ? _miNormalizeSectionLabels(_miStructuredRaw) : "";
  // Persist the structured-and-normalised lyrics so Apply uses exactly
  // what the user sees in the editable textarea below.
  if (_miStructured) {
    try { result.lyrics_edited = result.lyrics_edited || _miStructured; } catch (_) {}
  }
  if (_miStructured) {
    // Title chip above the editor — NEVER inside the textarea, so
    // it can't leak to the music engine.
    if (_miTitle) {
      extra += `<div style="font-size:13px;color:var(--text);font-weight:700;margin-top:8px;">[${_miEsc(_miTitle)}]</div>`;
    }
    extra += `<div style="font:500 11.5px/1.4 ui-monospace,monospace;color:var(--muted);margin:6px 0 4px;">
      ${_miEsc(_miTr(
        "✏️ Edit lyrics below — exact text goes to the music engine. Keep section tags in English brackets like [Verse 1] [Chorus 1] — Suno cannot parse 【第一节】 and will sing the label out loud.",
        "✏️ 下方可编辑歌词 —— 编辑后的文本将原样进入音乐引擎。请保持英文方括号小节标签如 [Verse 1] [Chorus 1] —— Suno 无法解析【第一节】这类中文标签，会被当成歌词唱出来。"
      ))}
    </div>`;
    extra += `<textarea class="msrc-lyrics-editor" data-msrc-lyrics-editor="${_miEsc(result._tab || "")}"
      style="width:100%;min-height:240px;max-height:70vh;resize:vertical;
             font:500 12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;
             color:var(--text);background:rgba(0,0,0,0.32);
             border:1px solid rgba(0,245,160,0.28);border-radius:8px;
             padding:10px 12px;outline:none;white-space:pre;overflow:auto;"
      spellcheck="false"
    >${_miEsc(result.lyrics_edited || _miStructured)}</textarea>`;
  }
  if (result.vision) {
    const v = result.vision;
    extra += `<div class="msrc-vision">
      <div class="msrc-vision-row"><span class="msrc-vision-key">${_miEsc(_miTr("Scene", "场景"))}:</span> ${_miEsc(v.description || "")}</div>
      <div class="msrc-vision-row"><span class="msrc-vision-key">${_miEsc(_miTr("Suggested theme", "建议主题"))}:</span> ${_miEsc(v.lyrics_prompt || "")}</div>
      <div class="msrc-vision-row"><span class="msrc-vision-key">${_miEsc(_miTr("Style", "风格"))}:</span> ${_miEsc(v.music_style_hint || "")}</div>
      <div class="msrc-vision-row"><span class="msrc-vision-key">${_miEsc(_miTr("Civilization", "文明"))}:</span> ${_miEsc((typeof globalThis.civDisplayName === "function") ? globalThis.civDisplayName(v.civilization || "", (document.documentElement.lang || navigator.language || "")) : (v.civilization || ""))}</div>
      ${v.suggested_title ? `<div class="msrc-vision-row"><span class="msrc-vision-key">${_miEsc(_miTr("Title", "标题"))}:</span> ${_miEsc(v.suggested_title)}</div>` : ""}
    </div>`;
  }
  let clearance = "";
  if (result.requires_clearance) {
    clearance = `<div class="msrc-clearance-warn">⚠️ ${_miEsc(_miTr(
      "Copyright clearance pending — this work can be played privately, but marketplace listing (Listen / Buyout / Tip) will be disabled until clearance.",
      "版权审核中 —— 可私有播放，但 marketplace 上架（聆听/买断/打赏）将禁用，直到清版完成。"
    ))}</div>`;
  }

  return `<div class="msrc-result">
    <strong style="font-size:12px; color:#00f5a0;">${_miEsc(_miTr("✓ Parsed", "✓ 已解析"))}</strong>
    <div style="margin-top:6px;">${lines.join("")}</div>
    ${extra}
    ${clearance}
  </div>`;
}

function renderMusicSourceUploadPanelMarkup() {
  // CSSOS_WAVE_247 — 过审前屏蔽: 任何调用方都拿到空 markup.
  if (!MUSIC_SOURCE_UPLOAD_ENABLED) return "";
  return buildMusicSourceUploadCardMarkup();
}

function buildAdvancedMusicSourceSettingsSection() {
  return renderMusicSourceUploadPanelMarkup();
}

/* ─── Backend calls ─── */

/* Real-time progress bar with cycling random colors. Two phases:
 *   1. Upload (0–90%) — real bytes via XHR upload.onprogress.
 *   2. Analyze (90–99%) — server processing (Whisper/Vision/ACRCloud);
 *      we don't have server-side progress, so we crawl smoothly toward
 *      99% while the indeterminate shimmer overlay plays.
 * Fill color rotates through a vivid HSL palette every ~600ms. */
function _miMountProgress(statusEl, initialLabel) {
  if (!statusEl) return null;
  statusEl.className = "msrc-status pending";
  statusEl.innerHTML = `<div class="msrc-progress">
    <div class="msrc-progress-track"><div class="msrc-progress-fill" style="background:hsl(160,80%,55%);color:hsl(160,80%,55%);"></div></div>
    <div class="msrc-progress-label"><span class="msrc-progress-text">${_miEsc(initialLabel || "")}</span><span class="pct">0%</span></div>
  </div>`;
  const fill = statusEl.querySelector(".msrc-progress-fill");
  const textEl = statusEl.querySelector(".msrc-progress-text");
  const pctEl = statusEl.querySelector(".pct");
  // Cycle random vivid colors so the bar feels alive
  const colorTimer = setInterval(() => {
    if (!fill || !fill.isConnected) { clearInterval(colorTimer); return; }
    const hue = Math.floor(Math.random() * 360);
    const sat = 70 + Math.floor(Math.random() * 25); // 70–95
    const lum = 50 + Math.floor(Math.random() * 15); // 50–65
    const c = `hsl(${hue},${sat}%,${lum}%)`;
    fill.style.background = c;
    fill.style.color = c; // drives box-shadow glow
  }, 600);
  let crawlTimer = null;
  let crawlPct = 0;
  function setPct(p, label) {
    if (!fill) return;
    crawlPct = Math.max(crawlPct, p);
    fill.style.width = `${crawlPct.toFixed(1)}%`;
    if (pctEl) pctEl.textContent = `${Math.round(crawlPct)}%`;
    if (label != null && textEl) textEl.textContent = label;
  }
  function startAnalyzePhase(label) {
    if (fill) fill.classList.add("indeterminate");
    setPct(90, label);
    if (crawlTimer) clearInterval(crawlTimer);
    // Crawl 90 → 99 over ~30s so the bar still feels alive while server analyzes
    crawlTimer = setInterval(() => {
      if (crawlPct >= 99) return;
      const remain = 99 - crawlPct;
      setPct(crawlPct + Math.max(0.05, remain * 0.03));
    }, 600);
  }
  function finish(label, isError) {
    if (crawlTimer) clearInterval(crawlTimer);
    clearInterval(colorTimer);
    if (fill) fill.classList.remove("indeterminate");
    if (isError) {
      statusEl.className = "msrc-status err";
      statusEl.textContent = label || "";
    } else {
      setPct(100, label);
      // Fade out after a beat so the user sees 100%, then drop the bar
      setTimeout(() => {
        if (!statusEl.isConnected) return;
        statusEl.className = "msrc-status ok";
        statusEl.textContent = label || "";
      }, 600);
    }
  }
  return { setPct, startAnalyzePhase, finish };
}

function _miUploadFile(tab, file, statusEl) {
  if (!tab || !tab.endpoint) return Promise.resolve(null);
  musicSourceUploadPending[tab.key] = true;
  const prog = _miMountProgress(statusEl, _miTr("Uploading…", "上传中…"));
  return new Promise((resolve) => {
    try {
      const form = new FormData();
      form.append(tab.field, file);
      const creationState = globalThis.creationState || {};
      if (creationState.workType) form.append("work_type", creationState.workType);
      if (creationState.language) form.append("language", creationState.language);
      // W1753 — carry the ownership attestation for audio/video (backend requires it).
      if ((tab.key === "audio" || tab.key === "video") && musicSourceUploadState.attested) {
        form.append("attested", "true");
      }
      const xhr = new XMLHttpRequest();
      xhr.open("POST", tab.endpoint, true);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (!prog || !e.lengthComputable) return;
        // Reserve 0–90% for upload; analyze owns 90–100.
        const pct = Math.min(90, (e.loaded / e.total) * 90);
        prog.setPct(pct, _miTr("Uploading…", "上传中…"));
      };
      xhr.upload.onload = () => {
        if (prog) prog.startAnalyzePhase(_miTr("Analyzing…", "解析中…"));
      };
      xhr.onload = () => {
        let j = null;
        try { j = JSON.parse(xhr.responseText); } catch (_e) {}
        if (xhr.status >= 200 && xhr.status < 300 && j && j.ok !== false) {
          if (prog) prog.finish(_miTr("Parsed ✓", "已解析 ✓"), false);
          musicSourceUploadPending[tab.key] = false;
          resolve(j);
          return;
        }
        // Prefer the human-friendly hint, fall back to detail, then code
        const errMsg = (j && (j.hint || j.detail || j.error)) || `upload_failed:${xhr.status}`;
        if (prog) prog.finish(_miTr("Upload failed: ", "上传失败：") + String(errMsg).slice(0, 120), true);
        musicSourceUploadPending[tab.key] = false;
        resolve(null);
      };
      xhr.onerror = () => {
        if (prog) prog.finish(_miTr("Network error", "网络错误"), true);
        musicSourceUploadPending[tab.key] = false;
        resolve(null);
      };
      xhr.send(form);
    } catch (err) {
      console.warn("[mv-source-upload] failed:", err);
      if (prog) prog.finish(_miTr("Upload failed: ", "上传失败：") + String(err.message || err).slice(0, 120), true);
      musicSourceUploadPending[tab.key] = false;
      resolve(null);
    }
  });
}

/* Push the uploaded asset into the MV pipeline state. CSSOS_WAVE_111D 20260512:
 * the previous implementation called `cssosMvPipelinePanelState()` which has
 * never been defined anywhere — so all the `ps.audioUrl = ...` writes
 * silently no-op'd. The real shared mutable state is `globalThis.creationState`,
 * and the lyrics input has id="lyrics-input". This rewrite:
 *   1. Direct-mutates creationState (the canonical creation-flow store)
 *   2. FORCE-overwrites the lyrics textarea (drop the `!input.value` guard
 *      which prevented user re-applies)
 *   3. Stores upload asset URL + skip_stages on creationState for the
 *      pipeline runner to honor when /api/runs/create lands those keys
 *      (full skip-music-stage routing tracked as Wave 111E).
 *   4. Toast message honestly reports what was filled.
 */
function _miApplyResultToPipeline(result) {
  if (!result) return false;
  const filled = [];
  try {
    const cs = globalThis.creationState;
    // 1. Lyrics — prefer the user-edited textarea (lyrics_edited) if present,
    //    else structured-from-source, else raw. ALWAYS run the section-label
    //    normaliser so non-English tags never reach Suno.
    const rawLyrics =
      (result.whisper && result.whisper.text) ||
      (result.midi_lyrics && result.midi_lyrics.has_lyrics && result.midi_lyrics.text) ||
      "";
    const structuredLyrics = rawLyrics ? _miStructureLyrics(rawLyrics) : "";
    const editedLyrics = (result.lyrics_edited && String(result.lyrics_edited).trim()) || "";
    const lyricsText = _miNormalizeSectionLabels(editedLyrics || structuredLyrics || rawLyrics);
    if (lyricsText) {
      // hit EVERY known lyric textarea so whatever the user sees gets it
      const lyricIds = [
        "custom-lyrics", "mvp-lyrics", "creation-lyrics-input",
        "watch-lyrics-editor", "song-seed-lyrics", "lyrics-input",
      ];
      for (const id of lyricIds) {
        const el = document.getElementById(id);
        if (el && (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)) {
          el.value = lyricsText;
          try { el.dataset.cssmvUserTyped = "1"; } catch (_) {}
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      filled.push(_miTr("lyrics", "歌词"));
      if (cs) cs.lyrics = lyricsText;
    }
    // 2. Title — inferred via _miInferTitle, FORCE-overwrite
    const titleHint = _miInferTitle(result);
    if (titleHint) {
      const titleIds = ["creation-title", "title-input", "mvp-title", "song-seed-title"];
      for (const id of titleIds) {
        const el = document.getElementById(id);
        if (el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
          el.value = titleHint;
          try { el.dataset.cssmvUserTyped = "1"; } catch (_) {}
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      filled.push(_miTr("title", "标题"));
      if (cs) cs.prompt = titleHint;
    }
    // 3. Style — inferred via _miInferStyle, FORCE-overwrite
    const styleHint = _miInferStyle(result);
    if (styleHint) {
      const styleIds = [
        "style-input", "creation-music-style", "mvp-style",
        "creation-instrumentation", "creation-vocal-style",
      ];
      for (const id of styleIds) {
        const el = document.getElementById(id);
        if (el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && !el.value) {
          el.value = styleHint;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      filled.push(_miTr("style", "风格"));
      if (cs) cs.musicStyle = cs.musicStyle || styleHint;
    }
    // 4. Mirror upload asset + skip_stages onto creationState for the
    //    pipeline runner. Wave 111E ① (W1749) now consumes these: the Rust
    //    music stage short-circuits to this faithful audio and skips Suno.
    //    W1750 ② — if the user picked the melody-muted 伴奏 version, feed
    //    that URL instead of the full 纯音乐 mix.
    if (cs) {
      cs.userUploadAsset = (result._chosenVersion === "backing" && result.backing_asset_url)
        ? result.backing_asset_url
        : (result.asset_url || null);
      cs.userUploadKind = result._tab || null;
      cs.userUploadSkipStages = Array.isArray(result.skip_stages) ? result.skip_stages.slice() : [];
      cs.userUploadRequiresClearance = !!result.requires_clearance;
      cs.userUploadImportSource = result.import_source || null;
      if (result._tab === "image" && result.asset_url) {
        cs.userUploadCoverUrl = result.asset_url;
      }
      if (result._tab === "sheet" && result.sheet_civilization) {
        cs.civilization = result.sheet_civilization;
      }
    }
    // Also expose for legacy listeners / debug
    globalThis.cssosLastUserUpload = result;

    // CSSOS_WAVE_111D_AUTOLAUNCH_V2 20260512 — Reuse the Person-MV launch
    // pattern so the 6-stage MV Pipeline panel (lyrics / cover / music /
    // video / subtitles / compose capsules + progress bars) becomes
    // immediately visible. Order:
    //   1. Fire input/change on every filled DOM element (already done
    //      above) so creationState + state.songSeed sync.
    //   2. smartFillEmptyAdvancedFields() — civilisation-aware backfill
    //      across the ~25 advanced inputs/selects/sliders that the user
    //      hasn't touched. Same chain as the lyrics magic wand.
    //   3. openMvPipelinePanel({ cinema:true, autoStart:true, seed, focus,
    //      forceNew }) — matches app.person-mv-panel.js line 1128. NO
    //      `hidden:true`, so the 6-stage panel paints front-and-center.
    try {
      const seed = {
        prompt: titleHint || undefined,
        lyrics: lyricsText || undefined,
        style: styleHint || undefined,
      };
      const launch = async () => {
        // Step 1 already done synchronously above.
        // Step 2: civilisation-aware backfill
        try {
          if (typeof globalThis.smartFillEmptyAdvancedFields === "function") {
            await globalThis.smartFillEmptyAdvancedFields();
          }
        } catch (sfErr) {
          console.warn("[mv-source-upload] smartFill failed:", sfErr);
        }
        // Step 3: open the visible 6-stage MV Pipeline panel — person-MV pattern
        if (typeof globalThis.openMvPipelinePanel === "function") {
          try {
            globalThis.openMvPipelinePanel({
              cinema: true,
              autoStart: true,
              forceNew: true,
              seed: seed,
              focus: true,
              // omit `hidden` → panel paints visibly with 6 stage capsules
              personName: titleHint || undefined,
              personMusicStyleHint: styleHint || undefined,
              personIntro: (result.vision && result.vision.lyrics_prompt) || undefined,
            });
            return;
          } catch (mvErr) {
            console.warn("[mv-source-upload] openMvPipelinePanel failed:", mvErr);
          }
        }
        // Fallback: unified entry (still triggers pipeline, less visible)
        if (typeof globalThis.cssmvUnifiedEntry === "function") {
          globalThis.cssmvUnifiedEntry({
            source: "music-source-upload", seed, preferredTab: "mv",
            force: true, focus: true, hidden: false, showMvPipeline: true,
          }).catch((err) => console.warn("[mv-source-upload] unified entry failed:", err));
        }
      };
      // Give DOM dispatchers a tick to settle our forced fills, then launch.
      setTimeout(() => { launch(); }, 60);
    } catch (launchErr) {
      console.warn("[mv-source-upload] auto-launch failed:", launchErr);
    }

    if (typeof globalThis.showToast === "function") {
      const what = filled.length
        ? filled.join(_miTr(" + ", " + "))
        : _miTr("(no fields auto-filled)", "(没有可自动填入的字段)");
      globalThis.showToast(_miTr(
        `Applied ${what}. Launching MV pipeline — sit back and enjoy.`,
        `已填入${what}。正在自动启动 MV 管线，请欣赏。`
      ));
    }
    return true;
  } catch (err) {
    console.warn("[mv-source-upload] apply failed:", err);
    if (typeof globalThis.showToast === "function") {
      globalThis.showToast(_miTr("Apply failed: ", "应用失败：") + String(err.message || err).slice(0, 120));
    }
    return false;
  }
}

/* ─── Bind ─── */

function bindMusicSourceUploadControls(root) {
  if (!(root instanceof Element)) return;
  if (root.dataset.msrcBound === "1") return;
  root.dataset.msrcBound = "1";

  // Delegate everything to root for resilience to re-renders
  root.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    // Tab switch
    const tabBtn = target.closest("[data-msrc-tab]");
    if (tabBtn instanceof HTMLElement) {
      const key = tabBtn.getAttribute("data-msrc-tab");
      if (key && key !== musicSourceUploadState.activeTab) {
        musicSourceUploadState.activeTab = key;
        _miRerender(root);
      }
      return;
    }

    // Apply to pipeline
    // W1750 ② — audio version switch (纯音乐 full mix ⇄ 伴奏 melody-muted).
    const verBtn = target.closest("[data-msrc-audio-version]");
    if (verBtn instanceof HTMLElement) {
      const ver = verBtn.getAttribute("data-msrc-audio-version") === "backing" ? "backing" : "full";
      if (musicSourceUploadState.result) {
        musicSourceUploadState.result._chosenVersion = ver;
        _miRerender(root);
      }
      return;
    }

    const applyBtn = target.closest("[data-msrc-apply]");
    if (applyBtn instanceof HTMLElement && !applyBtn.hasAttribute("disabled")) {
      _miApplyResultToPipeline(musicSourceUploadState.result);
      return;
    }

    // Clear
    const clearBtn = target.closest("[data-msrc-clear]");
    if (clearBtn instanceof HTMLElement) {
      const key = clearBtn.getAttribute("data-msrc-clear");
      if (key) {
        musicSourceUploadState[key] = null;
        if (musicSourceUploadState.result && musicSourceUploadState.result._tab === key) {
          musicSourceUploadState.result = null;
        }
        _miRerender(root);
      }
      return;
    }
  });

  // Live-bind the editable structured-lyrics textarea so edits flow back
  // into musicSourceUploadState.result.lyrics_edited (used on Apply).
  root.addEventListener("input", (e) => {
    const t = e.target;
    if (t instanceof HTMLTextAreaElement && t.hasAttribute("data-msrc-lyrics-editor")) {
      if (musicSourceUploadState.result) {
        musicSourceUploadState.result.lyrics_edited = t.value;
      }
    }
  });

  root.addEventListener("change", async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    // W1753 — ownership attestation toggle (audio/video). Store + re-render so
    // the file input enables. No new pill CSS; plain checkbox gate.
    if (target.hasAttribute("data-msrc-attest")) {
      musicSourceUploadState.attested = target.checked;
      _miRerender(root);
      return;
    }
    const key = target.getAttribute("data-msrc-upload");
    if (!key) return;
    const tab = _miFindTab(key);
    if (!tab || !tab.active) return;
    // W1753 — hard guard: audio/video require the ownership attestation.
    if ((key === "audio" || key === "video") && !musicSourceUploadState.attested) {
      return;
    }
    const file = target.files && target.files[0];
    if (!file) return;

    musicSourceUploadState[key] = file;
    const statusEl = root.querySelector(`[data-msrc-status="${key}"]`);
    if (statusEl) {
      statusEl.className = "msrc-status pending";
    }

    const j = await _miUploadFile(tab, file, statusEl);
    if (!j) return;

    const shaped = _miShapeResult(key, j);
    shaped.file_name = file.name || null;
    musicSourceUploadState.result = shaped;
    _miRerender(root);
  });

  // Sheet-tab URL importer (Wave 111D-D3)
  root.addEventListener("click", async (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const goBtn = t.closest("[data-msrc-sheet-url-go]");
    if (!(goBtn instanceof HTMLElement)) return;
    const inp = root.querySelector("[data-msrc-sheet-url]");
    const url = inp instanceof HTMLInputElement ? inp.value.trim() : "";
    if (!url) return;
    const statusEl = root.querySelector('[data-msrc-status="sheet"]');
    // Reuse the same progress bar component — the server-side fetch
    // doesn't expose byte-level progress, so we start in indeterminate
    // mode (90% crawl + shimmer + cycling random colors).
    const prog = _miMountProgress(statusEl, _miTr("Fetching URL…", "抓取 URL 中…"));
    if (prog) prog.startAnalyzePhase(_miTr("Fetching & analyzing…", "抓取与解析中…"));
    try {
      const cs = globalThis.creationState || {};
      const res = await fetch("/api/mv/sheet/import-url", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, language: cs.language || "en" }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j || j.ok === false) {
        const err = j?.hint || j?.error || `import_failed:${res.status}`;
        throw new Error(err);
      }
      if (prog) prog.finish(_miTr("Imported ✓", "已导入 ✓"), false);
      musicSourceUploadState.result = _miShapeResult("sheet", j);
      _miRerender(root);
    } catch (err) {
      console.warn("[mv-sheet-url] failed:", err);
      if (prog) prog.finish(_miTr("URL import failed: ", "URL 导入失败：") + String(err.message || err).slice(0, 200), true);
    }
  });

  // Sheet-tab clipboard paste (Wave 111D-D2)
  root.addEventListener("paste", async (e) => {
    if (musicSourceUploadState.activeTab !== "sheet") return;
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const it of items) {
      if (it.kind === "file" && (it.type.startsWith("image/") || it.type === "application/pdf")) {
        const f = it.getAsFile();
        if (!f) continue;
        e.preventDefault();
        const tab = _miFindTab("sheet");
        const statusEl = root.querySelector('[data-msrc-status="sheet"]');
        musicSourceUploadState.sheet = f;
        if (statusEl) statusEl.className = "msrc-status pending";
        const j = await _miUploadFile(tab, f, statusEl);
        if (j) {
          musicSourceUploadState.result = _miShapeResult("sheet", j);
          _miRerender(root);
        }
        return;
      }
    }
  });
}

function _miShapeResult(key, j) {
  return {
      _tab: key,
      asset_url: j.asset_url || null,
      backing_asset_url: j.backing_asset_url || null,                                   // W1750 ② 伴奏版
      melody_track_index: (typeof j.melody_track_index === "number") ? j.melody_track_index : -1,
      _chosenVersion: "full",                                                           // "full" 纯音乐 | "backing" 伴奏
      midi_asset_url: j.midi_asset_url || null,
      musicxml_asset_url: j.musicxml_asset_url || null,
      duration_secs: j.meta?.duration_secs || j.meta?.estimated_duration_secs || 0,
      width: j.meta?.width || 0,
      height: j.meta?.height || 0,
      fps: j.meta?.fps || 0,
      codec: j.meta?.codec || null,
      vcodec: j.meta?.vcodec || null,
      tempo_bpm: j.meta?.tempo_bpm || 0,
      time_signature: j.meta?.time_signature || null,
      key_signature: j.meta?.key_signature || null,
      note_count: j.meta?.note_count || 0,
      track_count: j.meta?.track_count || 0,
      // Sheet music specific
      notation_type: j.meta?.notation_type || null,
      composer: j.meta?.composer || null,
      lyricist: j.meta?.lyricist || null,
      tempo_marking: j.meta?.tempo_marking || null,
      sheet_title: j.meta?.title || null,
      sheet_pages: j.sheet_pages || 0,
      sheet_civilization: j.meta?.civilization || null,
      sheet_language_hint: j.meta?.language_hint || null,
      sheet_confidence: j.meta?.confidence || null,
      bytes: j.file?.stored_bytes || j.file?.original_bytes || 0,
      whisper: j.whisper || null,
      vision: j.analysis || null,
      midi_lyrics: j.lyrics || null,
      syllables: j.syllables || null,                                                 // W1751 (111E ③) per-token timeline (MIDI/MusicXML) — passthrough for subtitle engine
      has_lyrics: j.lyrics ? j.lyrics.has_lyrics : null,
      skip_stages: j.skip_stages || [],
      import_source: j.import_source || null,
      requires_clearance: !!j.requires_clearance,
      fingerprint: j.fingerprint || null,
      raw: j,
    };
}

function _miRerender(root) {
  if (!(root instanceof Element)) return;
  root.innerHTML = renderMusicSourceUploadPanelMarkup();
  const inner = root.querySelector('[data-advanced-panel="music-sources"]');
  if (inner instanceof Element) {
    inner.dataset.msrcBound = ""; // reset bind on inner since outer is bound
  }
}

function mountMusicSourceUploadPanel(root) {
  if (!(root instanceof Element)) return;
  bindMusicSourceUploadControls(root);
}

function wireAdvancedMusicSourceUploadIntoAdvancedSettings(root) {
  if (!(root instanceof Element)) return;
  mountMusicSourceUploadPanel(root);
}

function mountMusicSourceUploadTabInSettings(root) {
  if (!(root instanceof Element)) return;
  // CSSOS_WAVE_247 — 过审前整卡片屏蔽: 不渲染, 并隐藏容器避免留空槽.
  if (!MUSIC_SOURCE_UPLOAD_ENABLED) {
    root.innerHTML = "";
    root.style.display = "none";
    return;
  }
  if (root.dataset.musicSourceUploadMounted === "true") {
    // Already mounted, just rerender to reflect current state
    root.innerHTML = renderMusicSourceUploadPanelMarkup();
    return;
  }
  root.dataset.musicSourceUploadMounted = "true";
  root.innerHTML = renderMusicSourceUploadPanelMarkup();
  mountMusicSourceUploadPanel(root);
}

/* ─── Compatibility shims for app.creation-duration.js ─── */
function buildMusicSourceUploadPanelDigest() {
  const loaded = ["audio", "video", "image"].filter((k) => musicSourceUploadState[k]);
  if (!loaded.length) return _miTr("No source file attached.", "未附加任何源文件。");
  return _miTr(`${loaded.length} source(s) attached: ${loaded.join(", ")}`, `已附加 ${loaded.length} 个源：${loaded.join("、")}`);
}

/* Export globals for app.js / app.creation-flow.js / app.creation-duration.js */
globalThis.buildMusicSourceUploadCardMarkup = buildMusicSourceUploadCardMarkup;
globalThis.renderMusicSourceUploadPanelMarkup = renderMusicSourceUploadPanelMarkup;
globalThis.buildAdvancedMusicSourceSettingsSection = buildAdvancedMusicSourceSettingsSection;
globalThis.mountMusicSourceUploadPanel = mountMusicSourceUploadPanel;
globalThis.mountMusicSourceUploadTabInSettings = mountMusicSourceUploadTabInSettings;
globalThis.wireAdvancedMusicSourceUploadIntoAdvancedSettings = wireAdvancedMusicSourceUploadIntoAdvancedSettings;
globalThis.buildMusicSourceUploadPanelDigest = buildMusicSourceUploadPanelDigest;
