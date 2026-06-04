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
    var langEntry = subtitleJson.languages.find(function (l) { return l.lang === lang; });
    if (!langEntry || !Array.isArray(langEntry.sections)) return null;

    var cues = [];
    langEntry.sections.forEach(function (section) {
      var sectionEmo = mapEmotion(section.emotion);
      if (!Array.isArray(section.lines)) return;
      section.lines.forEach(function (line) {
        if (!line.text || !line.text.trim()) return;
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
            });
          });
        }

        // Check if timing is meaningful (Phase 1 placeholder = all zeros)
        var hasTiming = lineT0 > 0 || lineT1 > 0 ||
          words.some(function (w) { return w.start_s > 0 || w.end_s > 0; });

        cues.push({
          start_s: lineT0,
          end_s:   lineT1 > lineT0 ? lineT1 : lineT0 + 3.5, // 3.5s default if no timing
          text:    line.text.trim(),
          emotion: sectionEmo,
          words:   (hasTiming && words.length) ? words : undefined,
          _hasRealTiming: hasTiming,
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
        });
        lineWords = [];
      }
    });
    return lines.length ? lines : null;
  }

  // ── Feed caches + trigger re-render ──────────────────────────────────────
  function applyToKaraoke(cues, wordArray) {
    // Feed LINE-level cues
    if (cues && globalThis.watchKaraokeTimelineCache) {
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
        if (data) {
          var cues = subtitleJsonToCues(data, lang);
          var wordArr = subtitleJsonToWordArray(data, lang);
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

  globalThis.cssosEmotionSubtitle = { load: load, reset: reset };
})();
