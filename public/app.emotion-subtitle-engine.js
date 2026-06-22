/* CSSOS_WAVE_442 20260525 — Jing「情绪字幕引擎」
 *
 * Bridges the subtitle JSON (熟字幕, from WAVE_440/441) to the two
 * existing karaoke/subtitle systems:
 *
 *   1. watchKaraokeTimelineCache.data  — LINE-level cues
 *      [{start_s, end_s, text, emotion, words:[{text,start_s,end_s,emotion,emphasis}]}]
 *      Consumed by renderWatchKaraokeOverlayModule() in app.watch-ui.js.
 *      Drives prev/current/next line display + per-word span generation.
 *
 *   2. globalThis.cssosKaraokeWords    — WORD/CHAR-level array
 *      [{text, t_start, t_end, emotion, weight}]  (t_* in SECONDS)
 *      Consumed by app.karaoke-active-word.js.
 *      Drives the .cssmv-word-hot cursor + emotion glow palette.
 *
 * When subtitle JSON is not yet generated (new work, Python service down,
 * etc.) → falls back to the existing Whisper timeline from track.timeline
 * so the karaoke line display still works (just without emotion data).
 *
 * Public API:
 *   globalThis.cssosEmotionSubtitle.load(track, take)
 *     Async. Fetches subtitle JSON for track.lang at the given take,
 *     populates both caches, triggers renderWatchKaraokeOverlayModule().
 *
 *   globalThis.cssosEmotionSubtitle.reset()
 *     Clear cached data (call on work change).
 */
(function () {
  "use strict";

  // ── Emotion name mapping ──────────────────────────────────────────────────
  // subtitle JSON emotions → CSS karaoke emotion palette classes
  var EMO_MAP = {
    joy:        "joy",
    melancholy: "calm",
    intense:    "ignite",
    tender:     "intimate",
    ecstatic:   "ignite",
    longing:    "resolve",
    triumphant: "ignite",
    haunting:   "grief",
    serene:     "calm",
    grief:      "grief",
    rage:       "ignite",
    hope:       "resolve",
    neutral:    "",
    calm:       "calm",
    intimate:   "intimate",
    ignite:     "ignite",
    resolve:    "resolve",
  };

  function mapEmotion(raw) {
    if (!raw) return "";
    return EMO_MAP[String(raw).toLowerCase().trim()] || "";
  }

  // emotion_intensity 0–1 → karaoke weight 1–5
  function intensityToWeight(intensity) {
    var n = Number(intensity) || 0;
    if (n >= 0.90) return 5;
    if (n >= 0.75) return 4;
    if (n >= 0.58) return 3;
    if (n >= 0.38) return 2;
    return 1;
  }

  // ── Cache ─────────────────────────────────────────────────────────────────
  // Key: subtitle JSON URL. Value: parsed JSON or null (failed).
  var _cache = new Map();   // url → parsed SubtitleJson
  var _fetching = new Map();// url → Promise<SubtitleJson|null>

  function fetchSubtitleJson(url) {
    if (_cache.has(url)) return Promise.resolve(_cache.get(url));
    if (_fetching.has(url)) return _fetching.get(url);
    var p = fetch(url + "?t=" + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        _cache.set(url, data);
        _fetching.delete(url);
        return data;
      })
      .catch(function () {
        _fetching.delete(url);
        return null;
      });
    _fetching.set(url, p);
    return p;
  }

  // ── Convert subtitle JSON → karaoke cues array ────────────────────────────
  // Output format for watchKaraokeTimelineCache.data:
  //   [{start_s, end_s, text, emotion, words:[{text,start_s,end_s,emotion,emphasis}]}]
  function subtitleJsonToCues(subtitleJson, lang) {
    if (!subtitleJson || !Array.isArray(subtitleJson.languages)) return null;
    // CSSOS_WAVE_721 — 内容联动 emoji: 字幕 JSON 顶层 theme_emoji = 本曲内容相关 emoji 池(后端 AI 生成)。
    // 设为全局, emotion-fx 的 confetti/器乐 emoji 用它替代千篇一律的花。无则回退默认。
    try {
      if (Array.isArray(subtitleJson.theme_emoji) && subtitleJson.theme_emoji.length) {
        globalThis.cssosWorkThemeEmoji = subtitleJson.theme_emoji.slice(0, 24);
      }
    } catch (_e) {}
    // CSSOS_WAVE_724 — 整曲音量包络(顶层 vol_curve)→ 全局, 供器乐段 emoji"音量大→多"。
    try {
      var _vc = subtitleJson.vol_curve;
      if (_vc && Array.isArray(_vc.values) && _vc.values.length && _vc.step_ms > 0) {
        globalThis.cssosSongVolumeCurve = _vc;
      } else {
        globalThis.cssosSongVolumeCurve = null;
      }
    } catch (_e) {}
    // CSSOS_WAVE_641 — lang 兜底: track.lang(可能是 'orig'/种子默认轨)对不上时, 退到 zh→en→ja→首个,
    // 保证有字幕可显示(否则旗舰款因 lang 不匹配整段空白)。
    var langEntry = subtitleJson.languages.find(function (l) { return l.lang === lang; })
      || subtitleJson.languages.find(function (l) { return l.lang === "zh"; })
      || subtitleJson.languages.find(function (l) { return l.lang === "en"; })
      || subtitleJson.languages[0];
    if (!langEntry || !Array.isArray(langEntry.sections)) return null;

    var cues = [];
    langEntry.sections.forEach(function (section) {
      var sectionEmo = mapEmotion(section.emotion);
      if (!Array.isArray(section.lines)) return;
      section.lines.forEach(function (line) {
        if (!line.text || !line.text.trim()) return;
        // CSSOS_WAVE_644 — 跳过段落结构标签行(【主歌一 Verse 1】/[Chorus]/[Verse]/[Bridge] 等)。
        // 这些是"生歌词"的结构标记, 不是演唱内容, 绝不该进情绪字幕。任何【整行被 [] 或 【】包裹】
        // 的行一律视为标签丢弃(真实演唱句不会整句被括号包住)。
        var _lt = line.text.trim();
        // CSSOS_WAVE_731p 20260612 — Jing「前奏/间奏/尾声没有 emoji」根因: tag=music 的间奏段
        // 那行文本是 [Music...], 正好被下面"整行被[]包裹=结构标签"的过滤丢掉 → 间奏段从不生成
        // cue → 前端 _isMusicCue 永远 false → 器乐段 emoji 不触发。修: 在过滤【之前】截住间奏行,
        // 发一条【全 adlib 的 music cue】(文本 [Music...]), 让 cssosMusicGapPulse 跟着音量飘 emoji。
        var _secTag = String(section.tag || "").toLowerCase();
        var _bracketOnly = /^[\[【][^\]】]*[\]】]$/.test(_lt);
        // CSSOS_WAVE_745 — Jing「我喜欢这个小音符♪, 前奏/间奏/尾声就用它当歌词」: 整行只是
        // [Intro]/[Interlude]/[Outro]/[前奏]… 等器乐段标签(无唱词)也发 ♪ music cue。仅 bracket-only
        // 行触发(真唱的 intro 有词 → 不是 bracket-only → 不受影响)。
        var _instrKw = /(music|intro|outro|interlude|instrumental|前奏|间奏|尾奏|尾声|序曲|过门)/i;
        var _isMusicLine = _secTag === "music"
          || /^\[?\s*music\b/i.test(_lt) || _lt === "[Music...]"
          || (_bracketOnly && (_instrKw.test(_lt) || _instrKw.test(_secTag)));
        if (_isMusicLine) {
          var _ms = Number(line.t_start || 0) / 1000;
          var _me = Number(line.t_end || 0) / 1000;
          if (!(_me > _ms)) _me = _ms + 4;
          // CSSOS_WAVE_1109 — Jing「前奏/间奏/尾声那个小音符太孤单太小, 几乎看不见」: 换成一簇【各不
          // 相同 + 随机色】的音符。不同字形(♪♫♬♩🎵🎶)+ 循环 6 情绪色(各有独立 kara-c-* 颜色)+ 每段
          // 随机错位起点 → 段段不一样; 前半段依次淡入、全段留存 → 同时可见、更醒目。仍全 adlib(器乐
          // emoji cssosMusicGapPulse 照常)。用户仍可在 ✎微调里往里加真正的拟声词。
          var _noteGlyphs = ["♪", "♫", "♬", "♩", "🎵", "🎶"];
          var _noteEmos = ["joy", "calm", "ignite", "intimate", "resolve", "grief"];
          var _nspan = Math.max(0.001, _me - _ms);
          var _ncount = Math.min(6, Math.max(3, Math.round(_nspan / 2)));
          var _nrot = Math.floor(Math.random() * 6);
          var _noteWords = [];
          for (var _ni = 0; _ni < _ncount; _ni++) {
            _noteWords.push({
              text: _noteGlyphs[(_ni + _nrot) % _noteGlyphs.length],
              start_s: _ms + _nspan * 0.5 * (_ni / _ncount),  // 前半段依次淡入
              end_s: _me,                                      // 全段留存 → 同时可见
              emotion: _noteEmos[(_ni + _nrot) % _noteEmos.length],
              emphasis: 0.5, adlib: true,
            });
          }
          cues.push({
            start_s: _ms,
            end_s: _me,
            text: "[Music...]",
            emotion: sectionEmo,
            words: _noteWords,
            _hasRealTiming: _ms > 0 || _me > 0,
            _cooked: true,
          });
          return;
        }
        if (/^[\[【][^\]】]*[\]】]$/.test(_lt)) return;
        // CSSOS_WAVE_688 — 同样丢弃漏网的 markdown 结构标记行: # 标题行(# The Holy City)、
        // 整行加粗的段落名(**PHO SI-ÔN** / **Đoạn Một** / **Final Chorus**)。真实演唱句不会
        // 整句被 ** 包住, 也不会以 # 开头 → 安全过滤。
        if (/^#{1,6}\s/.test(_lt) || /^[*_]{2}[^*_].*[*_]{2}$/.test(_lt)) return;
        var lineT0 = Number(line.t_start || 0) / 1000; // ms → s
        var lineT1 = Number(line.t_end || 0) / 1000;

        // Build per-char/word array for this line
        var words = [];
        if (Array.isArray(line.tokens) && line.tokens.length) {
          line.tokens.forEach(function (tok) {
            if (!tok.char && !tok.text) return;
            var charText = String(tok.char || tok.text || "");
            var t0 = Number(tok.t_start || 0) / 1000;
            var t1 = Number(tok.t_end || 0) / 1000;
            var emo = mapEmotion(tok.emotion) || sectionEmo;
            var emph = Number(tok.emotion_intensity || 0);
            words.push({
              text:    charText,
              start_s: t0,
              end_s:   t1,
              emotion: emo,
              emphasis: emph,
              pitch:   Number(tok.pitch_hz || 0),   // CSSOS_WAVE_671 ③ 音高旋律线: 透传逐字音高
              adlib:   !!(tok.adlib || line.adlib),  // CSSOS_WAVE_679 — Suno 即兴拟声(呀咦哟), 前端可特殊呈现
            });
          });
        }

        // Check if timing is meaningful (Phase 1 placeholder = all zeros)
        var hasTiming = lineT0 > 0 || lineT1 > 0 ||
          words.some(function (w) { return w.start_s > 0 || w.end_s > 0; });

        var cueEnd = lineT1 > lineT0 ? lineT1 : lineT0 + 3.5;

        // CSSOS_WAVE_648 — 字级(token)时间戳是【占位假数据】(整行所有字都 0.0→0.3s, 见 take1
        // 实测), 不能拿来做逐字咬字 —— 否则 active-word 永远卡在第一个字。检测: 若 token 时间
        // 没有【落在本行 [lineT0,lineT1] 窗口内】(占位的都贴在 0 附近), 判定为假 → 在行内把字
        // 【按字数均匀重分布】到 [lineT0,cueEnd], 但【保留每字的 emotion/emphasis】(招牌情绪)。
        // 行级时间是真的(由上层 forced-align 行对齐), 字级先匀速顶着, 待 B(whisperX)给真字级时间。
        var tokenTimingReal = words.length > 1 &&
          words[words.length - 1].start_s > words[0].start_s + 0.05 &&
          words[0].start_s >= lineT0 - 1;
        if (words.length && !tokenTimingReal) {
          var _span = Math.max(0.4, cueEnd - lineT0);
          var _step = _span / words.length;
          words = words.map(function (w, i) {
            return {
              text:     w.text,
              start_s:  Number((lineT0 + i * _step).toFixed(3)),
              end_s:    Number((lineT0 + (i + 1) * _step).toFixed(3)),
              emotion:  w.emotion,
              emphasis: w.emphasis,
              pitch:    w.pitch,
            };
          });
        }

        cues.push({
          start_s: lineT0,
          end_s:   cueEnd, // 3.5s default if no timing
          text:    line.text.trim(),
          emotion: sectionEmo,
          words:   words.length ? words : undefined,
          _hasRealTiming: hasTiming,
          // CSSOS_WAVE_688 — 熟歌词标记: 来自 subtitle-take.json(whisperX 真对齐)→ 渲染器
          // 据此 1:1 直用时间戳, 不做线性拉伸(见 app.watch-ui.js timelineIsCooked)。
          _cooked: true,
        });
      });
    });

    return cues.length ? cues : null;
  }

  // ── Convert subtitle JSON → cssosKaraokeWords flat array ─────────────────
  // Output: [{text, t_start (s), t_end (s), emotion, weight}]
  function subtitleJsonToWordArray(subtitleJson, lang) {
    if (!subtitleJson || !Array.isArray(subtitleJson.languages)) return null;
    var langEntry = subtitleJson.languages.find(function (l) { return l.lang === lang; });
    if (!langEntry || !Array.isArray(langEntry.sections)) return null;

    var words = [];
    langEntry.sections.forEach(function (section) {
      var sectionEmo = mapEmotion(section.emotion);
      if (!Array.isArray(section.lines)) return;
      section.lines.forEach(function (line) {
        if (!Array.isArray(line.tokens)) return;
        line.tokens.forEach(function (tok) {
          var charText = String(tok.char || tok.text || "").trim();
          if (!charText) return;
          words.push({
            text:    charText,
            t_start: Number(tok.t_start || 0) / 1000,  // ms → s
            t_end:   Number(tok.t_end   || 0) / 1000,
            emotion: mapEmotion(tok.emotion) || sectionEmo,
            weight:  intensityToWeight(tok.emotion_intensity),
          });
        });
      });
    });

    return words.length ? words : null;
  }

  // ── Whisper timeline fallback ─────────────────────────────────────────────
  // When no subtitle JSON is available, convert the raw Whisper word array
  // (from track.timeline = [{word, start, end}]) to proper cue format.
  // Previously the pill fed these directly, but {word,start,end} ≠ {text,start_s,end_s}.
  function whisperToCues(timeline) {
    if (!Array.isArray(timeline) || !timeline.length) return null;
    // Each Whisper token = one cue (single-word lines for now).
    // Better: group into lines of ~8-12 words.
    var lines = [];
    var lineWords = [];
    var lineStart = 0;

    timeline.forEach(function (tok, i) {
      var word = String(tok.word || tok.text || "").trim();
      if (!word) return;
      var t0 = Number(tok.start || tok.t_start || 0);
      var t1 = Number(tok.end   || tok.t_end   || t0 + 0.3);
      if (!lineWords.length) lineStart = t0;
      lineWords.push({ text: word, start_s: t0, end_s: t1, emotion: "", emphasis: 0.3 });

      var isLast = (i === timeline.length - 1);
      var lineFull = lineWords.length >= 10;
      var isPunctEnd = /[.!?。！？,，;；]$/.test(word);

      if (lineFull || isPunctEnd || isLast) {
        lines.push({
          start_s: lineStart,
          end_s: t1,
          text: lineWords.map(function (w) { return w.text; }).join(" "),
          emotion: "",
          words: lineWords.slice(),
          _cooked: true, // CSSOS_WAVE_688 — whisper 词时间也是绝对真时间, 1:1 不拉伸
        });
        lineWords = [];
      }
    });
    return lines.length ? lines : null;
  }

  // ── Feed caches + trigger re-render ──────────────────────────────────────
  function applyToKaraoke(cues, wordArray) {
    // Feed LINE-level cues
    // CSSOS_WAVE_642 — 根因: applyToKaraoke 跑在 watch-ui 懒创建 watchKaraokeTimelineCache 之前时,
    // 旧守卫 `&& globalThis.watchKaraokeTimelineCache` 为假 → cues 被静默丢弃(cache.data 永远 undefined)。
    // 改为【缺则自建】, 保证情绪字幕数据无论时机先后都落进缓存, 渲染器一定有米下锅。
    if (cues) {
      if (!globalThis.watchKaraokeTimelineCache || typeof globalThis.watchKaraokeTimelineCache !== "object") {
        globalThis.watchKaraokeTimelineCache = {};
      }
      globalThis.watchKaraokeTimelineCache.data = cues;
      globalThis.watchKaraokeTimelineCache.pending = false;
      globalThis.watchKaraokeTimelineCache.error = "";
      // CSSOS_WAVE_1108 — 给缓存打上【它属于哪部作品】的戳, 供切歌即清 + 防串台判定使用。
      globalThis.watchKaraokeTimelineCache.workId = _offsetWorkId || "";
    }
    // Feed WORD/CHAR-level array
    if (wordArray) {
      globalThis.cssosKaraokeWords = wordArray;
      // Hand off to karaoke-active-word module if present
      if (typeof globalThis.cssosKaraokeWord?.setWordTimings === "function") {
        globalThis.cssosKaraokeWord.setWordTimings(wordArray);
      }
    }
    // Trigger re-render
    try {
      if (typeof globalThis.renderWatchKaraokeOverlayModule === "function") {
        globalThis.renderWatchKaraokeOverlayModule();
      }
    } catch (_e) {}
  }

  // ── Public load function ─────────────────────────────────────────────────
  async function load(track, take, ownerWorkId) {
    if (!track) return;
    var lang = String(track.lang || "");
    var takeN = (take === 2) ? 2 : 1;
    var subUrl = takeN === 2
      ? (track.subtitle_take2_json_url || track.subtitle_take1_json_url)
      : track.subtitle_take1_json_url;

    if (subUrl) {
      try {
        var data = await fetchSubtitleJson(subUrl);
        try { console.info("[emo-sub] fetched", subUrl, "ok=" + !!data, "langs=" + (data && data.languages ? data.languages.map(function (l) { return l.lang; }).join(",") : "?")); } catch (_e) {}
        if (data) {
          var cues = subtitleJsonToCues(data, lang);
          var wordArr = subtitleJsonToWordArray(data, lang);
          try { console.info("[emo-sub] cues=" + (cues ? cues.length : 0) + " for lang=" + lang); } catch (_e) {}
          if (cues && cues.length) {
            // CSSOS_WAVE_1108 — 防串台守卫: 这次 load 是为 ownerWorkId 发起的。若在 await 期间
            // 用户已切到别的作品(_offsetWorkId 被新 loadForWork 改写), 丢弃这条【迟到的旧结果】,
            // 绝不用上一首的字幕覆盖当前作品(就是"切歌后字幕显示别首歌/残留"的真凶)。
            // 注: 语言胶囊直接调 load(track,take) 不传 ownerWorkId → 守卫自动跳过, 切语言照常。
            if (ownerWorkId && _offsetWorkId && ownerWorkId !== _offsetWorkId) return;
            // CSSOS_WAVE_994 — stash raw cues so the global offset slider can
            // re-shift live without refetching, then feed with offset applied.
            // W1048 — keep pristine + overlay non-destructive token add/delete.
            _pristineCues = cues;
            _pristineWords = wordArr;
            var _merged = _applyTokenEdits(cues, wordArr);
            _rawCues = _merged.cues;
            _rawWords = _merged.words;
            applyWithOffset();
            return; // subtitle JSON applied — done
          }
        }
      } catch (_e) { /* fall through to Whisper fallback */ }
    }

    // Fallback: Whisper timeline from track (convert to proper cue format)
    if (Array.isArray(track.timeline) && track.timeline.length) {
      var fallbackCues = whisperToCues(track.timeline);
      if (fallbackCues) {
        applyToKaraoke(fallbackCues, null);
      }
    }
  }

  function reset() {
    _cache.clear();
    _fetching.clear();
  }

  // CSSOS_WAVE_641 — 自触发: 不再仅依赖语言胶囊的 switchToLanguage(它可能因挂载/时机没跑)。
  // 切作品(cssos:work-id-changed)时, 主动拉该作品的轨道、取默认轨、加载情绪字幕。带日志便于诊断。
  async function loadForWork(workId) {
    try {
      if (!workId) return;
      var r = await fetch("/api/works/" + encodeURIComponent(workId) + "/language-tracks");
      if (!r.ok) { try { console.warn("[emo-sub] tracks fetch", r.status); } catch (_e) {} return; }
      var j = await r.json();
      // CSSOS_WAVE_994 — adopt this work's saved subtitle offset (ms→s) so the
      // stored nudge is applied on load, and the slider edits the right work.
      _offsetWorkId = workId;
      _rawCues = null; _rawWords = null;
      _offsetSec = (Number(j && j.subtitle_offset_ms) || 0) / 1000;
      // W995 — adopt saved per-line offsets (keys are line indices, values ms).
      _lineOffsets = {};
      try {
        var lo = (j && j.subtitle_line_offsets) || {};
        for (var lk in lo) { if (Object.prototype.hasOwnProperty.call(lo, lk)) _lineOffsets[lk] = Number(lo[lk]) || 0; }
      } catch (_e) { _lineOffsets = {}; }
      // W996 — adopt saved per-token offsets {rawStartMs: ms}.
      _tokenOffsets = {};
      try {
        var to = (j && j.subtitle_token_offsets) || {};
        for (var tk in to) { if (Object.prototype.hasOwnProperty.call(to, tk)) _tokenOffsets[tk] = Number(to[tk]) || 0; }
      } catch (_e) { _tokenOffsets = {}; }
      // W1048 — adopt saved token add/delete edits (non-destructive overlay).
      _tokenEdits = { added: [], deleted: {} };
      _pristineCues = null; _pristineWords = null;
      try {
        var te = (j && j.subtitle_token_edits) || {};
        if (Array.isArray(te.added)) {
          te.added.forEach(function (a) {
            if (!a || typeof a !== "object") return;
            var txt = String(a.text == null ? "" : a.text).trim();
            if (!txt) return;
            var t = Number(a.t); if (!isFinite(t) || t < 0) t = 0;
            var ln = (a.line != null && isFinite(Number(a.line)) && Number(a.line) >= 0) ? Math.trunc(Number(a.line)) : null;
            _tokenEdits.added.push({ id: String(a.id || ("u" + Math.round(t * 1000))), text: txt.slice(0, 40), t: t, line: ln, emo: (a.emo == null ? null : String(a.emo).slice(0, 20)) });
          });
        }
        if (Array.isArray(te.deleted)) { te.deleted.forEach(function (k) { var s = String(k == null ? "" : k).trim(); if (s) _tokenEdits.deleted[s] = true; }); }
      } catch (_e) { _tokenEdits = { added: [], deleted: {} }; }
      var tracks = (j && j.tracks) || [];
      var def = tracks.find(function (t) { return t.is_default; })
        || tracks.find(function (t) { return t.status === "ready" && t.subtitle_take1_json_url; })
        || tracks.find(function (t) { return t.subtitle_take1_json_url; })
        || tracks[0];
      if (!def) { try { console.info("[emo-sub] no track", workId); } catch (_e) {} return; }
      try { console.info("[emo-sub] loadForWork", workId, "lang=" + def.lang, "hasSubUrl=" + !!def.subtitle_take1_json_url); } catch (_e) {}
      await load(def, 1, workId);
    } catch (e) { try { console.warn("[emo-sub] loadForWork err", e); } catch (_x) {} }
  }

  // CSSOS_WAVE_994 20260618 — Jing「字幕整体偏移微调(第一期)」: a per-work global
  // time offset (seconds, signed). Playback shifts ALL cue/word times by it so
  // the user can nudge the whole subtitle track earlier/later until it hugs the
  // vocal. Non-destructive: the subtitle JSON is never touched; we re-shift the
  // stashed raw cues live. Persisted via POST /api/works/:id/subtitle-offset.
  var _rawCues = null;
  var _rawWords = null;
  var _offsetSec = 0;
  var _offsetWorkId = "";
  // CSSOS_WAVE_1048 20260620 — Jing「波形精修 v2 · 加/删 token」: 非破坏性字幕 token 增删。
  //   _tokenEdits = { added:[{id,text,t(秒),line,emo}], deleted:{ "<原始字起始ms>": true } }。
  //   _pristineCues/_pristineWords = 未施加增删的原始解析结果(单一真相源)。每次增删都从 pristine
  //   重新合并, 绝不二次叠加。空集(added=[] && deleted={}) → _applyTokenEdits 直接返回原对象,
  //   渲染/编辑器行为与旧版【逐字节完全一致】。
  var _pristineCues = null;
  var _pristineWords = null;
  var _tokenEdits = { added: [], deleted: {} };
  // CSSOS_WAVE_995 — per-line offsets {lineIndex: ms}. Applied on top of the
  // global offset so the user can fine-tune one line that leads/lags the vocal.
  var _lineOffsets = {};
  var _TIME_KEYS = { start_s: 1, end_s: 1, t_start: 1, t_end: 1, start: 1, end: 1 };
  function _cueStart(c) {
    if (typeof c.start_s === "number") return c.start_s;
    if (typeof c.t_start === "number") return c.t_start;
    return 0;
  }
  function _cueEnd(c) {
    if (typeof c.end_s === "number") return c.end_s;
    if (typeof c.t_end === "number") return c.t_end;
    return _cueStart(c) + 3;
  }
  function _wordTime(w) {
    if (typeof w.t_start === "number") return w.t_start;
    if (typeof w.start_s === "number") return w.start_s;
    if (typeof w.start === "number") return w.start;
    return 0;
  }
  // Which raw line (by index) does a raw time fall in? -1 if none.
  function _lineIndexForTime(ranges, t) {
    for (var i = 0; i < ranges.length; i++) {
      if (t >= ranges[i].s - 0.001 && t <= ranges[i].e + 0.001) return i;
    }
    return -1;
  }
  function _hasLineOffsets() {
    for (var k in _lineOffsets) { if (_lineOffsets[k]) return true; }
    return false;
  }
  function _shiftDeep(node, sec) {
    if (Array.isArray(node)) return node.map(function (n) { return _shiftDeep(n, sec); });
    if (node && typeof node === "object") {
      var out = {};
      for (var k in node) {
        if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
        var v = node[k];
        if (_TIME_KEYS[k] && typeof v === "number") {
          out[k] = Math.max(0, v + sec); // never go negative — clamp at song start
        } else if (v && typeof v === "object") {
          out[k] = _shiftDeep(v, sec);
        } else {
          out[k] = v;
        }
      }
      return out;
    }
    return node;
  }
  // CSSOS_WAVE_996 — per-token offsets keyed by raw start ms (rounded). Applied
  // on top of global + line so the waveform editor can pin one word to its onset.
  var _tokenOffsets = {};
  function _tokKey(rawStartSec) { return String(Math.round(rawStartSec * 1000)); }
  function _tokDeltaSec(rawStartSec) {
    var v = _tokenOffsets[_tokKey(rawStartSec)];
    return v ? (v / 1000) : 0;
  }
  function _hasTokenOffsets() { for (var k in _tokenOffsets) { if (_tokenOffsets[k]) return true; } return false; }
  // Shallow-clone an object shifting only known time keys by sec (clamp ≥ 0).
  function _shiftShallow(o, sec) {
    var out = {};
    for (var k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
      var v = o[k];
      out[k] = (_TIME_KEYS[k] && typeof v === "number") ? Math.max(0, v + sec) : v;
    }
    return out;
  }
  function applyWithOffset() {
    if (!_rawCues) return;
    if (!_offsetSec && !_hasLineOffsets() && !_hasTokenOffsets()) { applyToKaraoke(_rawCues, _rawWords); return; }
    var ranges = _rawCues.map(function (c) { return { s: _cueStart(c), e: _cueEnd(c) }; });
    // Cues: shift the line shell by global+line; shift each word by +token too.
    var cues = _rawCues.map(function (c, i) {
      var lineD = _offsetSec + ((_lineOffsets[i] || 0) / 1000);
      var nc = _shiftShallow(c, lineD);
      if (Array.isArray(c.words)) {
        nc.words = c.words.map(function (w) {
          return _shiftShallow(w, lineD + _tokDeltaSec(_wordTime(w)));
        });
      }
      return nc;
    });
    // Flat words: each by global + its line delta + its own token delta.
    var words = null;
    if (_rawWords) {
      words = _rawWords.map(function (w) {
        var li = _lineIndexForTime(ranges, _wordTime(w));
        var lineD = _offsetSec + ((li >= 0 ? (_lineOffsets[li] || 0) : 0) / 1000);
        return _shiftShallow(w, lineD + _tokDeltaSec(_wordTime(w)));
      });
    }
    applyToKaraoke(cues, words);
  }
  // Index of the line currently on screen at the given (or live) audio time,
  // computed against the SHIFTED ranges (what the user actually sees). Returns
  // the nearest line if between lines, -1 if no cues.
  function currentLineIndex(atTime) {
    if (!_rawCues || !_rawCues.length) return -1;
    var t = atTime;
    if (typeof t !== "number") {
      try { var au = document.getElementById("watch-audio-preview"); t = au ? au.currentTime : 0; } catch (_e) { t = 0; }
    }
    var best = -1, bestDist = Infinity;
    for (var i = 0; i < _rawCues.length; i++) {
      var d = _offsetSec + ((_lineOffsets[i] || 0) / 1000);
      var s = _cueStart(_rawCues[i]) + d, e = _cueEnd(_rawCues[i]) + d;
      if (t >= s && t <= e) return i;        // inside a line → that line
      var dist = (t < s) ? (s - t) : (t - e);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    return best;
  }
  function _persistLine(idx) {
    if (!_offsetWorkId) return;
    try {
      fetch("/api/works/" + encodeURIComponent(_offsetWorkId) + "/subtitle-line-offset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: String(idx), offset_ms: Math.trunc(_lineOffsets[idx] || 0) }),
      }).catch(function () {});
    } catch (_e) {}
  }
  // Set an absolute per-line offset (ms). opts.persist (default true) saves.
  function setLineOffset(idx, ms, opts) {
    if (idx == null || idx < 0) return;
    var o = opts || {};
    _lineOffsets[idx] = Math.trunc(Number(ms) || 0);
    applyWithOffset();
    if (o.persist !== false) _persistLine(idx);
  }
  function getLineOffset(idx) { return Math.trunc(_lineOffsets[idx] || 0); }
  // Nudge the line currently on screen by deltaMs. Returns the line index.
  function nudgeCurrentLine(deltaMs, opts) {
    var i = currentLineIndex();
    if (i < 0) return -1;
    setLineOffset(i, (_lineOffsets[i] || 0) + (Number(deltaMs) || 0), opts);
    return i;
  }

  // ── CSSOS_WAVE_996 — per-token API for the waveform editor ──────────────────
  // Set a token's absolute offset (ms) keyed by its RAW start ms. Live; the
  // editor batches drags and calls saveTokenOffsets() once on 保存.
  function setTokenOffset(rawStartMs, ms, opts) {
    var key = String(Math.round(Number(rawStartMs) || 0));
    var v = Math.trunc(Number(ms) || 0);
    if (v === 0) delete _tokenOffsets[key]; else _tokenOffsets[key] = v;
    applyWithOffset();
    if (opts && opts.persist === true) saveTokenOffsets();
  }
  function saveTokenOffsets() {
    if (!_offsetWorkId) return Promise.resolve();
    try {
      return fetch("/api/works/" + encodeURIComponent(_offsetWorkId) + "/subtitle-token-offsets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offsets: _tokenOffsets }),
      }).catch(function () {});
    } catch (_e) { return Promise.resolve(); }
  }
  // ── CSSOS_WAVE_1048 — non-destructive token add/delete overlay ─────────────
  // 是否有生效的增删(无 → 合并函数恒等返回, 老作品零行为变化)。
  function _editsActive() {
    if (_tokenEdits && _tokenEdits.added && _tokenEdits.added.length) return true;
    if (_tokenEdits && _tokenEdits.deleted) { for (var k in _tokenEdits.deleted) { if (_tokenEdits.deleted[k]) return true; } }
    return false;
  }
  // 给定时间 t(秒)定位最合适的 cue 索引: 命中区间优先, 否则 t 之前最近的一行, 否则第 0 行。
  function _cueIndexForTime(cues, t) {
    var best = -1;
    for (var i = 0; i < cues.length; i++) {
      var s = _cueStart(cues[i]), e = _cueEnd(cues[i]);
      if (t >= s && t <= e) return i;
      if (s <= t) best = i;
    }
    return best >= 0 ? best : 0;
  }
  // 把增删施加到 (cues, words), 返回新结构。pristine 永不被改(delete 用 filter 出新数组,
  // add 克隆目标 cue)。空集 → 原样返回(恒等)。
  function _applyTokenEdits(cues, words) {
    if (!cues || !_editsActive()) return { cues: cues, words: words };
    var del = (_tokenEdits && _tokenEdits.deleted) || {};
    // 1) 删除: 按【原始字起始 ms】key 过滤每个 cue 的 words + 扁平 wordArray。
    var outCues = cues.map(function (c) {
      if (!Array.isArray(c.words)) return c;
      var nw = c.words.filter(function (w) { return !del[String(Math.round(_wordTime(w) * 1000))]; });
      if (nw.length === c.words.length) return c; // 本行无删除 → 复用原对象
      var nc = {}; for (var k in c) { if (Object.prototype.hasOwnProperty.call(c, k)) nc[k] = c[k]; }
      nc.words = nw; return nc;
    });
    var outWords = Array.isArray(words)
      ? words.filter(function (w) { return !del[String(Math.round((Number(w.t_start) || 0) * 1000))]; })
      : words;
    // 2) 新增: 每个 added token 插入目标 cue(按 line 或时间)+ 扁平数组, 各自重排。
    var added = (_tokenEdits && _tokenEdits.added) || [];
    added.forEach(function (a) {
      var t = Number(a.t) || 0;
      var txt = String(a.text || "").trim();
      if (!txt) return;
      var dur = 0.5;
      var cw = { text: txt, start_s: t, end_s: t + dur, emotion: a.emo || "", emphasis: 0.6, pitch: 0, adlib: true, _added: true, _addId: a.id };
      var idx = (a.line != null && a.line >= 0 && a.line < outCues.length) ? a.line : _cueIndexForTime(outCues, t);
      var tc = outCues[idx];
      if (tc) {
        var nc2 = {}; for (var k2 in tc) { if (Object.prototype.hasOwnProperty.call(tc, k2)) nc2[k2] = tc[k2]; }
        var ws = Array.isArray(tc.words) ? tc.words.slice() : [];
        ws.push(cw);
        ws.sort(function (p, q) { return _wordTime(p) - _wordTime(q); });
        nc2.words = ws;
        if (t + dur > _cueEnd(nc2)) nc2.end_s = t + dur;
        if (t < _cueStart(nc2)) nc2.start_s = t;
        outCues[idx] = nc2;
      }
      if (Array.isArray(outWords)) outWords.push({ text: txt, t_start: t, t_end: t + dur, emotion: a.emo || "", weight: 1 });
    });
    if (Array.isArray(outWords)) outWords.sort(function (p, q) { return (Number(p.t_start) || 0) - (Number(q.t_start) || 0); });
    return { cues: outCues, words: outWords };
  }
  // 从 pristine 重新合并(增删变更后调用)→ 刷新渲染。
  function _remergeEdits() {
    if (!_pristineCues) return;
    var m = _applyTokenEdits(_pristineCues, _pristineWords);
    _rawCues = m.cues; _rawWords = m.words;
    applyWithOffset();
  }
  // 加一个 token(拟声词/间奏字)。spec = {text, t(秒), line(可空), emo(可空)}。返回该记录。
  function addToken(spec) {
    var t = Number(spec && spec.t); if (!isFinite(t) || t < 0) t = 0;
    var txt = String((spec && spec.text) || "").trim(); if (!txt) return null;
    var id = "u" + Math.round(t * 1000) + "_" + (_tokenEdits.added.length + 1);
    var rec = {
      id: id, text: txt.slice(0, 40), t: Math.round(t * 1000) / 1000,
      line: (spec && spec.line != null && Number(spec.line) >= 0) ? Math.trunc(Number(spec.line)) : null,
      emo: (spec && spec.emo) ? String(spec.emo).slice(0, 20) : null,
    };
    _tokenEdits.added.push(rec);
    _remergeEdits();
    return rec;
  }
  // 删除一个【原始】token(按 rawStartMs)。已加的 token 用 removeAddedToken(id)。
  function deleteToken(rawStartMs) {
    var key = String(Math.round(Number(rawStartMs) || 0));
    _tokenEdits.deleted[key] = true;
    _remergeEdits();
  }
  function undeleteToken(rawStartMs) { delete _tokenEdits.deleted[String(Math.round(Number(rawStartMs) || 0))]; _remergeEdits(); }
  function removeAddedToken(id) {
    if (!id) return;
    _tokenEdits.added = _tokenEdits.added.filter(function (a) { return a.id !== id; });
    _remergeEdits();
  }
  function saveTokenEdits() {
    if (!_offsetWorkId) return Promise.resolve();
    var deletedArr = []; for (var k in _tokenEdits.deleted) { if (_tokenEdits.deleted[k]) deletedArr.push(k); }
    try {
      return fetch("/api/works/" + encodeURIComponent(_offsetWorkId) + "/subtitle-token-edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ added: _tokenEdits.added, deleted: deletedArr }),
      }).catch(function () {});
    } catch (_e) { return Promise.resolve(); }
  }

  // Snapshot for the waveform editor: flattened sung tokens with raw + current
  // (offset-applied) times, plus the volume curve + duration.
  function getEditorModel() {
    if (!_rawCues) return null;
    var ranges = _rawCues.map(function (c) { return { s: _cueStart(c), e: _cueEnd(c) }; });
    var tokens = [];
    _rawCues.forEach(function (c, li) {
      if (!Array.isArray(c.words)) return;
      var lineD = _offsetSec + ((_lineOffsets[li] || 0) / 1000);
      c.words.forEach(function (w) {
        var txt = String(w.text || w.char || "").trim();
        if (!txt || txt === "♪") return; // skip music markers
        var rawS = _wordTime(w);
        var rawE = (typeof w.end_s === "number") ? w.end_s : (typeof w.t_end === "number" ? w.t_end : rawS + 0.4);
        var tokD = _tokDeltaSec(rawS);
        tokens.push({
          text: txt, lineIndex: li,
          rawStartMs: Math.round(rawS * 1000),
          rawStart: rawS, rawEnd: rawE,
          curStart: rawS + lineD + tokD, curEnd: rawE + lineD + tokD,
          tokenOffsetMs: Math.trunc(_tokenOffsets[_tokKey(rawS)] || 0),
          // W1048 — 标记用户新增 token, 供编辑器特殊呈现 + 删除(走 removeAddedToken)。
          added: !!w._added, addId: w._addId || "",
        });
      });
    });
    var dur = 0;
    try { var au = document.getElementById("watch-audio-preview"); dur = (au && au.duration) || 0; } catch (_e) {}
    if (!dur && tokens.length) dur = tokens[tokens.length - 1].curEnd + 4;
    return {
      tokens: tokens,
      volCurve: globalThis.cssosSongVolumeCurve || null,
      duration: dur,
      workId: _offsetWorkId,
    };
  }
  // Live-adjust the current work's subtitle offset. ms signed. opts.persist
  // (default true) saves to the server so it sticks across reloads/devices.
  function setOffset(ms, opts) {
    var o = opts || {};
    var sec = (Number(ms) || 0) / 1000;
    _offsetSec = sec;
    applyWithOffset(); // instant live re-shift
    if (o.persist !== false && _offsetWorkId) {
      try {
        fetch("/api/works/" + encodeURIComponent(_offsetWorkId) + "/subtitle-offset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset_ms: Math.trunc(Number(ms) || 0) }),
        }).catch(function () {});
      } catch (_e) {}
    }
  }
  function getOffsetMs() { return Math.round(_offsetSec * 1000); }

  globalThis.cssosEmotionSubtitle = {
    load: load, reset: reset, loadForWork: loadForWork,
    setOffset: setOffset, getOffsetMs: getOffsetMs,
    // W995 — per-line fine tuning (cinema drag editor).
    currentLineIndex: currentLineIndex,
    setLineOffset: setLineOffset, getLineOffset: getLineOffset,
    nudgeCurrentLine: nudgeCurrentLine,
    getWorkId: function () { return _offsetWorkId; },
    // W996 — waveform per-token editor.
    setTokenOffset: setTokenOffset, saveTokenOffsets: saveTokenOffsets,
    getEditorModel: getEditorModel,
    // W1048 — non-destructive token add/delete.
    addToken: addToken, deleteToken: deleteToken,
    undeleteToken: undeleteToken, removeAddedToken: removeAddedToken,
    saveTokenEdits: saveTokenEdits,
  };

  try {
    window.addEventListener("cssos:work-id-changed", function (ev) {
      var id = ev && ev.detail && ev.detail.workId;
      if (!id) return;
      // CSSOS_WAVE_1108 — 切到【别的】作品时, 立刻把上一首的字幕缓存清空, 别等 700ms 重载完成。
      // 否则这段窗口里渲染器还在用旧 cue → 屏幕显示上一首的残留字幕(就是"切歌字幕串台/对不上"
      // 的现象)。靠 applyToKaraoke 打的 workId 戳判定是否真换了作品。
      try {
        var _c = globalThis.watchKaraokeTimelineCache;
        if (_c && _c.workId && _c.workId !== id) { _c.data = null; _c.pending = true; }
      } catch (_e) {}
      // 稍候 700ms 等 watch 面板/媒体元素就位再加载。
      setTimeout(function () { loadForWork(id); }, 700);
    });
  } catch (_e) {}
})();
