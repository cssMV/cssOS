/* app.takes.js — CSSOS_WAVE_2116 第3步「前端吃数组」20260919
 *
 * Jing:「默认是 ♪1/♪2, 如果有更多肯定可以 ♪1/♪2/♪3/♪4/♪5/♪6…♪10/♪20。」
 *
 * ── 这个文件存在的唯一理由 ────────────────────────────────────────────────
 * 「这首歌有没有第二版」这件事, 前端过去在【三个地方各判一次】:
 *     app.mv-language-pill.js   take === 2 ? track.alt_audio_url : track.audio_url
 *     app.playlists.js          hasTake2(item) = !!(audio_track_2_url || alt_audio_url)
 *     app.emotion-subtitle-engine.js  takeN === 2 ? subtitle_take2… : subtitle_take1…
 * 三处各写各的, 于是「2」被钉死了三遍。本文件把它收成【一个数组】, 三处都来这里取,
 * 谁也不再自己数。数组长 2 还是长 20, 调用方一行代码都不用改。
 *
 * ── 为什么不直接用后端下发的 takes 就完事 ─────────────────────────────────
 * 因为调用方拿到的东西形态不一样:
 *   · 播放器拿到的是 language-tracks 里的 track(有 takes, 也有老字段)
 *   · 队列拿到的是 feed/卡片 item(【没有】takes, 只有 audio_track_2_url / alt_audio_url)
 * 所以这里做兼容: 有 takes 就直接用, 没有就用老字段【就地拼出同样形状的数组】。
 * 两条路在 N=2 时产出完全一致 —— 这是「帧同一」的硬要求: 改造前后, 有两首歌的作品
 * 在屏幕上必须一模一样, 一个像素都不许动。
 *
 * 无依赖, 纯函数, 不碰 DOM。必须在 app.mv-language-pill.js / app.playlists.js /
 * app.emotion-subtitle-engine.js 【之前】加载。
 */
(function () {
  "use strict";

  function s(v) { return String(v == null ? "" : v).trim(); }

  /* 归一化 URL 做去重键 —— 只比路径, 忽略签名/查询串。
   * 与后端 takeDedupeKey() 同一套规则; 不一致就会出现「后端认为 2 版、前端认为 3 版」。 */
  function key(url) {
    var u = s(url);
    if (!u) return "";
    var q = u.indexOf("?");
    return (q >= 0 ? u.slice(0, q) : u).toLowerCase();
  }

  /**
   * 取一个作品/轨的【全部音频版本】, 永远返回数组(可能为空)。
   * 每项: { take, label, url, duration_secs, subtitle_url, source }
   */
  function takesOf(o) {
    if (!o || typeof o !== "object") return [];

    // ① 后端已经算好了 —— 直接用, 但仍然过一遍去重/补号, 防止老服务端下发脏数据。
    var raw = Array.isArray(o.takes) ? o.takes : null;
    var list = [];
    var seen = Object.create(null);
    function push(url, dur, subUrl, label, source) {
      var u = s(url);
      if (!u) return;
      var k = key(u);
      if (!k || seen[k]) return;
      seen[k] = 1;
      var n = list.length + 1;
      list.push({
        take: n,
        label: s(label) || ("♪" + n),
        url: u,
        duration_secs: (dur == null ? null : Number(dur)) || null,
        subtitle_url: s(subUrl) || null,
        source: source || "legacy",
      });
    }
    if (raw && raw.length) {
      for (var i = 0; i < raw.length; i++) {
        var t = raw[i] || {};
        push(t.url, t.duration_secs, t.subtitle_url, t.label, t.source || "server");
      }
      if (list.length) return list;
    }

    /* ② 回退: 用老字段就地拼。顺序必须是 ♪1=主音轨 → ♪2=备用音轨, 与后端 seed 一致。
     *    卡片/队列 item 用 audio_track_1_url / audio_track_2_url 这套名字;
     *    语言轨用 audio_url / alt_audio_url。两套都收, 因为两种对象都会进这个函数。 */
    push(o.audio_url || o.audio_track_1_url || o.preview_audio_url,
         o.duration_secs, o.subtitle_take1_json_url, null, "legacy");
    push(o.alt_audio_url || o.audio_track_2_url,
         o.alt_duration_secs, o.subtitle_take2_json_url, null, "legacy");
    return list;
  }

  /** 有几版。0 = 这条轨还没有可播的音频。 */
  function takeCount(o) { return takesOf(o).length; }

  /**
   * 第 n 版(1-based)。越界就钳回合法范围 —— 调用方永远拿得到一个能播的东西,
   * 不会因为「♪3 没了」而静默无声。没有任何版本才返回 null。
   */
  function takeAt(o, n) {
    var list = takesOf(o);
    if (!list.length) return null;
    var i = Math.floor(Number(n) || 1);
    if (!(i >= 1)) i = 1;
    if (i > list.length) i = list.length;
    return list[i - 1];
  }

  /** 第 n 版的音频 URL(越界同样钳回)。拿不到返回 ""。 */
  function takeUrl(o, n) { var t = takeAt(o, n); return t ? t.url : ""; }

  /**
   * 第 n 版【自己的】字幕 URL。
   * 版本自带就用自带的; 没有(现存 1307 行全是 NULL)就回退作品级 take1/take2 两列 ——
   * 行为与改造前一致, 但通道已经通了: 以后版本表写了 subtitle_url, 这里自动跟上。
   */
  function takeSubtitleUrl(o, n) {
    /* CSSOS_WAVE_2145 — 【已知的旧版本】没有自己的字幕时, 宁可空白, 绝不借别版的时间轴。
     *
     * 闸必须在这里, 不能放到下面 —— takesOf() 的 legacy 路径(本文件 :77)已经把
     * 【作品级】的 subtitle_take1_json_url 塞进了 take.subtitle_url, 所以"版本自带"
     * 那一行对这些轨【总是】成立, 闸放在它后面等于没放。这些轨在版本表里没有行,
     * 走的正是 legacy 路径。
     *
     * 为什么只对 voice='pre-epic' 关: 作品级那两列装的是【当前那一版】的字幕。
     * 对默认轨回退过去是对的; 对 epic 重出【之前】的那一版音频回退过去, 就是拿新版
     * 的时间轴去对旧版的歌声 —— 字幕从头漂到尾, 比没有字幕更糟, 而且不会报错。
     * W2145 之前它们的 lang 是 'orig-pre-epic', 匹配不上任何字幕条目, 所以一直是空白;
     * 改成真语言后严格匹配【会】命中同语言条目, 这个回退才第一次变得危险。
     *
     * 它自己那一版对齐出来的字幕一旦写进轨的 subtitle_url, 下面第一行就正常返回。 */
    if (String(o && o.voice || "") === "pre-epic") return s(o.subtitle_url);
    var t = takeAt(o, n);
    if (t && t.subtitle_url) return t.subtitle_url;
    if (!o) return "";
    var i = t ? t.take : 1;
    // 老的两列只覆盖 ♪1/♪2; ♪3+ 没有对应列, 回退 take1(总比没字幕强)。
    if (i >= 2 && s(o.subtitle_take2_json_url)) return s(o.subtitle_take2_json_url);
    return s(o.subtitle_take1_json_url);
  }


  globalThis.cssosTakes = {
    of: takesOf, count: takeCount, at: takeAt, url: takeUrl, subtitleUrl: takeSubtitleUrl,
  };
  // 短别名, 调用点读起来干净。
  globalThis.cssosTakesOf = takesOf;
  globalThis.cssosTakeCount = takeCount;
})();
