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
  async function load(track, take) {
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
            applyToKaraoke(cues, wordArr);
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
      var tracks = (j && j.tracks) || [];
      var def = tracks.find(function (t) { return t.is_default; })
        || tracks.find(function (t) { return t.status === "ready" && t.subtitle_take1_json_url; })
        || tracks.find(function (t) { return t.subtitle_take1_json_url; })
        || tracks[0];
      if (!def) { try { console.info("[emo-sub] no track", workId); } catch (_e) {} return; }
      try { console.info("[emo-sub] loadForWork", workId, "lang=" + def.lang, "hasSubUrl=" + !!def.subtitle_take1_json_url); } catch (_e) {}
      await load(def, 1);
    } catch (e) { try { console.warn("[emo-sub] loadForWork err", e); } catch (_x) {} }
  }

  globalThis.cssosEmotionSubtitle = { load: load, reset: reset, loadForWork: loadForWork };

  try {
    window.addEventListener("cssos:work-id-changed", function (ev) {
      var id = ev && ev.detail && ev.detail.workId;
      // 稍候 700ms 等 watch 面板/媒体元素就位再加载。
      if (id) setTimeout(function () { loadForWork(id); }, 700);
    });
  } catch (_e) {}
})();
