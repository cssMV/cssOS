/* CSSOS_WAVE_1839 20260820 — Jing:「标题从头到尾一直显示《春风得意》, 标题/字幕/画面/音乐
 * 都不是同一首歌的信息。我们不是一直都是按照 ID 来读取完整信息的吗?」
 *
 * ── 为什么以前修不好 ───────────────────────────────────────────────────────
 * 标题在页面上有多个落点(#watch-title-text / .watch-title-text / 帧内 .cssmv-mv-title),
 * 而切歌【有好几条路】(队列前进 / CTA 预选 / 手点卡片 / 滚轮 / 方向键 / 循环列表)。
 * 历史修法是【逐条路补】: PR#6 补 openMarketWorkPreview, PR#7 补 applyWatchQueueItemModule,
 * mv-title-sync 再用 MutationObserver 把标题栏【镜像】到帧内标题。
 * 这套的结构性缺陷是: 镜像只能复制标题栏, 【标题栏自己是旧的时候, 它忠实地把旧标题抄到所有地方】。
 * 于是每新增一条切歌路, 就多一次"第一首标题冻住整场"的复发。这已经复发到第三轮。
 *
 * ── 这次换个方向 ─────────────────────────────────────────────────────────
 * 不再追"哪条路忘了写标题", 而是把标题挂到【唯一真源】上:
 *   W121 的契约规定, 任何切歌都必须调 cssosBindToWorkId(id) → 它派发 cssos:work-id-changed。
 *   本模块只听这一个事件, 从 detail.work.title 取标题; 拿不到就【按 workId 去 /api/works/:id 读】
 *   —— 这正是 Jing 那句"依据作品的ID这个唯一的真源去读取作品的全部信息"的字面落地。
 * 于是: 只要一条路遵守契约, 标题就自动正确, 不需要它自己记得写标题。
 * 反过来, 若某条路【没调 bind】, 那是契约违规, 属于另一个可独立发现的 bug(仓库里已有
 * 8 秒一次的 "switch site missed" 自检), 不该由标题这边去打补丁掩盖。
 *
 * ── 三条防串台的闸 ───────────────────────────────────────────────────────
 *  ① 异步读回来要复检 cssosCurrentWorkId() === workId —— 慢请求落地时可能已经切走了,
 *     那一笔必须丢弃, 否则就是"新歌配旧标题", 反而制造串台。
 *  ② 只写标题, 不碰 .panel-title(那是面板名"WATCH", 不是歌名)。
 *  ③ 空标题不写 —— 宁可留着旧的, 也不要闪成空白。 */
(function () {
  "use strict";
  if (globalThis.__cssosTitleAuthorityWired) return;
  globalThis.__cssosTitleAuthorityWired = true;

  /* CSSOS_WAVE_1887 20260823 —— Jing:「不管切歌到哪里了, 标题永远不变。」
   *
   * 本模块的契约和三条防串台闸都是对的, 广播也确实收到了(W1886 修好后实测到事件带着
   * 正确的新标题"时间的帝国(电影预告)")—— 但它把标题写进了【屏幕上没人看的四个元素】。
   * MV 面板右上角真正显示的那行是 .cssmv-mv-title, 从来不在这个清单里。
   * 于是标题权威一直在忠实地更新四个不可见的容器, 用户看到的那行永远停在第一首。
   *
   * (这个元素我在 W1857 查"标题不限宽"时就踩过一次: 当时改了 #cssos-watch-caption,
   *  改完没效果, 才发现可见的是 .cssmv-mv-title。同一个坑踩第二次, 这次写进注释。) */
  var TITLE_SINKS = ["#watch-title-text", ".watch-title-text", ".watch-frame-title", "#watch-frame-title",
                     ".cssmv-mv-title", "#cssos-watch-caption"];

  function applyTitle(t) {
    var title = String(t || "").trim();
    if (!title) return;                                   // 闸③
    /* CSSOS_WAVE_1888 —— 公布权威值。app.mv-title-sync.js 是 2026-05 写的"标题镜像"兜底
     * (把面板标题栏文字镜像进画面大标题), 当年用来救那些【不广播】的切歌路径。
     * 它的五个取值源如今有四个在 DOM 里已不存在, 只剩 .panel-title, 而连播不更新那个元素
     * → 它会拿着陈旧文字, 在权威刚写对之后立刻覆盖回去。实测写入序列:
     *     render:废墟孤影 → render:时间的帝国·对弈(预告) → DOM 定格在旧标题。
     * 治冻结的药变成了冻结本身。这里留下权威值, 让镜像知道该让位。 */
    try { globalThis.__cssosTitleAuthorityValue = title; } catch (_e) {}
    for (var i = 0; i < TITLE_SINKS.length; i++) {
      var els = document.querySelectorAll(TITLE_SINKS[i]);
      for (var j = 0; j < els.length; j++) {
        try { if (els[j].textContent !== title) els[j].textContent = title; } catch (_e) {}
      }
    }
    // 帧内大标题由 watch-media-overlays 拥有, 只能通过它的 API 重绘
    try {
      if (typeof globalThis.cssmvRenderMvArtTitle === "function") globalThis.cssmvRenderMvArtTitle(title);
    } catch (_e) {}
  }


  /* 合成部件 id 形如 <uuid>__part_3 —— 序号即第几部。 */
  function partIndexOf(partId) {
    var m = String(partId || "").match(/__(?:part|act)_(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  }
  /* 从 root 的 structure_plan 里按序号取这一部的小标题。plan 的形状历来不统一,
   * 三种常见写法都兜一下, 取不到就返回空(交给上层兜底), 绝不猜。 */
  function titleFromPlan(work, partId) {
    var n = partIndexOf(partId);
    if (!n) return "";
    try {
      var plan = work.structure_plan || work.plan || null;
      if (typeof plan === "string") plan = JSON.parse(plan);
      var arr = (plan && (plan.parts || plan.sections || plan.children)) || (Array.isArray(plan) ? plan : null);
      if (!Array.isArray(arr) || !arr.length) return "";
      var it = arr[n - 1];
      if (!it) return "";
      return String((typeof it === "string" ? it : (it.title || it.name || it.label)) || "").trim();
    } catch (_e) { return ""; }
  }
  /* 最后一道: 任何情况下都不许把 __part_N / 裸 uuid 显示给用户。 */
  function scrubSynthetic(t, work, partId) {
    var s = String(t || "").trim();
    if (/__(?:part|act)_\d+/i.test(s) || /^[0-9a-f-]{30,}$/i.test(s)) s = "";
    if (!s) {
      var rootT = String((work && (work.root_title || work._root_title || work.title)) || "").trim();
      rootT = rootT.replace(/__(?:part|act)_\d+/ig, "").trim();
      var n = partIndexOf(partId);
      if (rootT && n) return rootT + " · " + n;
      return rootT;
    }
    return s;
  }
  function stillCurrent(workId) {
    try {
      return typeof globalThis.cssosCurrentWorkId !== "function"
        || String(globalThis.cssosCurrentWorkId() || "") === String(workId);
    } catch (_e) { return true; }
  }

  window.addEventListener("cssos:work-id-changed", function (ev) {
    var d = (ev && ev.detail) || {};
    var workId = String(d.workId || "").trim();
    var work = d.work || null;
    var partId = String(d.partId || "").trim();
    /* W1839 (Jing:「请去掉这些 __part_N, 要显示小标题, 如春风得意/花酒间/看不穿」)
     * 三部曲的每一部要显示【它自己的小标题】。取值优先级:
     *   ① 部件自己的标题(part_title / title) —— 这才是"春风得意"
     *   ② 合成部件常只带 <root>__part_N 这样的 id, 标题得从 structure_plan 里按序号取
     *   ③ 实在没有 → 用 root 标题 + "第 N 部", 也绝不把 __part_N 露给用户看 */
    var t = String((work && (work.part_title || work.title || work.name)) || "").trim();
    if (!t && work && partId) t = titleFromPlan(work, partId);
    t = scrubSynthetic(t, work, partId);
    if (t) { applyTitle(t); return; }
    if (!workId) return;
    /* 没带作品对象 → 按 ID 去读。这是本模块存在的理由: 标题的来源永远是 ID, 不是别的 DOM。 */
    fetch("/api/works/" + encodeURIComponent(workId), { credentials: "include" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var w = j && (j.data && (j.data.work || j.data) || j.work);
        var t2 = String((w && w.title) || "").trim();
        if (t2 && stillCurrent(workId)) applyTitle(t2);   // 闸①
      })
      .catch(function () {});
  }, { passive: true });
})();
