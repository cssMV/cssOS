/* CSSOS_WAVE_788 20260614 — Jing「旗舰版要有特殊标记」: ⚜ 旗舰 + ⚡ Epic 双徽章。
 * 独立 defer 脚本(不进 bundle / 零崩站风险)。数据来自公开端点 /api/works/flagships
 * (旗舰=admin_pinned_at; Epic=有 'orig-pre-epic' 备份轨), 三处落点:
 *   ① 作品卡片角标(扫描任意 [data-work-id] 卡 + MutationObserver 跟新卡)
 *   ② MV 影院面板(随 globalThis.cssosCurrentWorkId 显示, #watch-panel 左上角, 很淡)
 *   ③ 专属「⚜ 旗舰精选」墙入口(for-you 面板顶部一个 chip → 全屏 overlay 网格, 点卡即播)
 * 徽章做得很淡(符合 Sora 式若隐若现 + 胶囊宪法), 不抢画面。 */
(function () {
  "use strict";
  if (globalThis.__cssosFlagshipBadges) return;
  globalThis.__cssosFlagshipBadges = true;

  var DATA = { flagship: new Set(), epic: new Set(), items: [], ready: false };
  function tr(en, zh) { return typeof globalThis.loginCopy === "function" ? globalThis.loginCopy(en, zh || en) : en; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function load() {
    return fetch("/api/works/flagships", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) { DATA.flagship = new Set(j.flagshipIds || []); DATA.epic = new Set(j.epicIds || []); DATA.items = j.items || []; DATA.ready = true; }
        return DATA;
      }).catch(function () { return DATA; });
  }

  function injectStyle() {
    if (document.getElementById("cssos-flagship-badge-style")) return;
    var s = document.createElement("style"); s.id = "cssos-flagship-badge-style";
    s.textContent = [
      ".cssos-flagship-badge{position:absolute;top:6px;right:6px;z-index:5;display:flex;gap:4px;pointer-events:none;}",
      ".cssos-flagship-badge span{font:700 9px/1 -apple-system,system-ui,sans-serif;letter-spacing:.04em;padding:3px 6px;border-radius:999px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);white-space:nowrap;}",
      ".cssos-flagship-badge .fb-flag{background:rgba(212,175,55,0.30);color:#ffeab0;border:1px solid rgba(212,175,55,0.55);}",
      ".cssos-flagship-badge .fb-epic{background:rgba(255,150,40,0.26);color:#ffd9a8;border:1px solid rgba(255,150,40,0.5);}",
      /* MV 影院面板: 固定左上, 更淡 */
      "#cssos-mv-flagship-badge{position:absolute;top:10px;left:12px;z-index:8;display:flex;gap:5px;pointer-events:none;opacity:0.82;}",
      "#cssos-mv-flagship-badge span{font:700 10px/1 -apple-system,system-ui,sans-serif;letter-spacing:.05em;padding:4px 8px;border-radius:999px;text-shadow:0 1px 3px rgba(0,0,0,.5);}",
      "#cssos-mv-flagship-badge .fb-flag{background:rgba(212,175,55,0.22);color:#ffeab0;border:1px solid rgba(212,175,55,0.45);}",
      "#cssos-mv-flagship-badge .fb-epic{background:rgba(255,150,40,0.20);color:#ffd9a8;border:1px solid rgba(255,150,40,0.4);}",
      /* 旗舰精选入口 chip */
      // W797 — 实底金 + 深色字 + 加粗放大, 明暗主题都清晰(原来淡金描边在白天几乎看不清)。
      "#cssos-flagship-entry{display:flex;align-items:center;justify-content:center;gap:8px;margin:10px 10px 4px;padding:11px 18px;border-radius:14px;cursor:pointer;width:calc(100% - 20px);box-sizing:border-box;",
      "  font:800 14px/1.1 -apple-system,system-ui,sans-serif;letter-spacing:.06em;color:#2a1c00;background:linear-gradient(180deg,#f6d873,#e7b73f);border:1px solid rgba(150,110,20,0.55);box-shadow:0 2px 10px rgba(212,175,55,0.35);}",
      "#cssos-flagship-entry:active{transform:scale(0.97);}",
      /* overlay 旗舰墙 */
      "#cssos-flagship-wall{position:fixed;inset:0;z-index:2147483600;display:flex;flex-direction:column;background:rgba(4,8,7,0.94);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);}",
      "#cssos-flagship-wall .fw-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;color:#ffeab0;font:800 16px/1.2 -apple-system,system-ui,sans-serif;letter-spacing:.04em;}",
      "#cssos-flagship-wall .fw-close{all:unset;cursor:pointer;font-size:22px;color:#ffeab0;padding:4px 10px;}",
      "#cssos-flagship-wall .fw-scroll{flex:1;overflow-y:auto;padding:0 16px 24px;}",
      "#cssos-flagship-wall .fw-sec{color:#ffeab0;font:800 12px/1.2 -apple-system,system-ui,sans-serif;letter-spacing:.06em;opacity:.85;margin:14px 2px 8px;}",
      "#cssos-flagship-wall .fw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;}",
      "#cssos-flagship-wall .fw-card{all:unset;cursor:pointer;display:flex;flex-direction:column;border-radius:14px;overflow:hidden;background:rgba(255,255,255,0.05);border:1px solid rgba(212,175,55,0.3);position:relative;}",
      "#cssos-flagship-wall .fw-cover{width:100%;aspect-ratio:1/1;object-fit:cover;background:rgba(255,255,255,0.06);}",
      "#cssos-flagship-wall .fw-meta{padding:8px 10px;color:#f4ecd8;font:600 12px/1.3 -apple-system,system-ui,sans-serif;}",
      "#cssos-flagship-wall .fw-civ{display:block;opacity:0.6;font-weight:500;font-size:10px;margin-top:2px;}",
    ].join("\n");
    document.head.appendChild(s);
  }

  function badgeInner(isFlag, isEpic) {
    return (isFlag ? '<span class="fb-flag">⚜ ' + esc(tr("Flagship", "旗舰")) + "</span>" : "")
         + (isEpic ? '<span class="fb-epic">⚡ Epic</span>' : "");
  }

  // ① 作品卡片角标
  function decorateCards(root) {
    if (!DATA.ready) return;
    var scope = (root instanceof Element) ? root : document;
    scope.querySelectorAll("[data-work-id]").forEach(function (card) {
      var id = card.getAttribute("data-work-id"); if (!id) return;
      var flag = DATA.flagship.has(id), epic = DATA.epic.has(id);
      if (!flag && !epic) return;
      if (card.querySelector(":scope > [data-flagship-badge]")) return;   // 幂等
      var host = card.querySelector(".work-cover") || card;
      try { if (getComputedStyle(host).position === "static") host.style.position = "relative"; } catch (_e) {}
      var b = document.createElement("div");
      b.className = "cssos-flagship-badge"; b.setAttribute("data-flagship-badge", "1");
      b.innerHTML = badgeInner(flag, epic);
      host.appendChild(b);
    });
  }

  // ② MV 影院面板
  function decorateMv() {
    if (!DATA.ready) return;
    var panel = document.getElementById("watch-panel"); if (!panel) return;
    var id = String(globalThis.cssosCurrentWorkId || "");
    var flag = DATA.flagship.has(id), epic = DATA.epic.has(id);
    var el = document.getElementById("cssos-mv-flagship-badge");
    var visible = panel && !panel.classList.contains("hidden");
    if (!visible || (!flag && !epic)) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "cssos-mv-flagship-badge"; panel.appendChild(el); }
    var want = badgeInner(flag, epic);
    if (el.innerHTML !== want) el.innerHTML = want;
  }

  // play a flagship item; W797 — 整个旗舰墙当作 scoped 播放池(只在 Epic 之间连播)。
  function playWork(item) {
    var w = (item && typeof item === "object") ? item : { id: String(item || "") };
    var id = String(w.id || "");
    var work = Object.assign({}, w, { __cssosOpenedFrom: "flagship", __cssosPlaylistPool: DATA.items.slice() });
    try {
      if (typeof globalThis.openMarketWorkPreview === "function") { globalThis.openMarketWorkPreview(work, {}); return; }
    } catch (_e) {}
    try { location.href = "/?cssMV=" + encodeURIComponent(id); } catch (_e) {}
  }

  // ③ 旗舰墙 overlay
  function openWall() {
    if (document.getElementById("cssos-flagship-wall")) return;
    injectStyle();
    var ov = document.createElement("div"); ov.id = "cssos-flagship-wall";
    function cardHtml(it) {
      return '<button type="button" class="fw-card" data-fw-id="' + esc(it.id) + '">' +
        (it.cover ? '<img class="fw-cover" loading="lazy" src="' + esc(it.cover) + '" alt="">' : '<div class="fw-cover"></div>') +
        '<div class="cssos-flagship-badge" style="position:absolute;top:6px;right:6px;">' + badgeInner(true, it.epic) + "</div>" +
        '<div class="fw-meta">' + esc(it.title || "") + '<span class="fw-civ">' + esc(it.civ || "") + "</span></div>" +
        "</button>";
    }
    // W799 — 分区: 我的 Epic(用户级, 仅本人可见)在前, 系统旗舰(所有人)在后。
    var mine = DATA.items.filter(function (i) { return i.level === "user"; });
    var sys = DATA.items.filter(function (i) { return i.level !== "user"; });
    var body = "";
    if (mine.length) body += '<div class="fw-sec">' + esc(tr("My Epic", "我的 Epic")) + " · " + mine.length + "</div>" +
      '<div class="fw-grid">' + mine.map(cardHtml).join("") + "</div>";
    body += '<div class="fw-sec">⚜ ' + esc(tr("Flagship Picks", "系统旗舰")) + " · " + sys.length + "</div>" +
      '<div class="fw-grid">' + (sys.map(cardHtml).join("") || ('<div style="color:#bbb;padding:18px;">' + esc(tr("No flagships yet", "暂无旗舰")) + "</div>")) + "</div>";
    ov.innerHTML = '<div class="fw-head"><span>⚜ ' + esc(tr("Flagship Picks", "旗舰精选")) + '</span><button class="fw-close" aria-label="close">×</button></div>' +
      '<div class="fw-scroll">' + body + "</div>";
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) {
      var t = e.target;
      if (t && (t.classList.contains("fw-close") || t.id === "cssos-flagship-wall")) { ov.remove(); return; }
      var card = t && t.closest ? t.closest("[data-fw-id]") : null;
      if (card) { var id = card.getAttribute("data-fw-id"); ov.remove(); var it = null; for (var i = 0; i < DATA.items.length; i++) { if (DATA.items[i].id === id) { it = DATA.items[i]; break; } } playWork(it || { id: id }); }
    });
  }

  // 旗舰精选入口 chip(注入 for-you 面板顶部)
  function ensureEntry() {
    if (!DATA.ready || !DATA.items.length) return;
    var foryou = document.getElementById("foryou-panel"); if (!foryou) return;
    if (foryou.querySelector("#cssos-flagship-entry")) return;
    var chip = document.createElement("button");
    chip.type = "button"; chip.id = "cssos-flagship-entry";
    chip.innerHTML = "⚜ " + esc(tr("Flagship Picks", "旗舰精选")) + " · " + DATA.items.length;
    chip.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openWall(); });
    // W797 — Jing「放到多语言选择器之下, 文字显眼」: 锚到语言胶囊条(#foryou-market-lang-chips)之后;
    // 找不到则回退面板顶部。样式见 injectStyle(实底金 + 深字 + 加粗, 不再模糊难辨)。
    var langBar = document.getElementById("foryou-market-lang-chips")
      || foryou.querySelector("[id*='lang-chip'],[class*='lang-chip']");
    if (langBar && langBar.parentNode) langBar.parentNode.insertBefore(chip, langBar.nextSibling);
    else foryou.insertBefore(chip, foryou.firstChild);
  }

  function tick() { decorateCards(); decorateMv(); ensureEntry(); }

  function start() {
    injectStyle();
    load().then(function () {
      tick();
      // CSSOS_WAVE_794 — 防 CPU 抖动: 观察器回调【去抖 600ms】(原来每次 DOM 变动都跑 decorateCards,
      // 在泄漏/字幕逐字刷新的繁忙页面上空烧 CPU)。徽章本就幂等, 600ms 合批足够及时。
      var _moT = null;
      var mo = new MutationObserver(function () {
        if (!DATA.ready || _moT) return;
        _moT = setTimeout(function () { _moT = null; decorateCards(); ensureEntry(); }, 600);
      });
      try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_e) {}
      setInterval(decorateMv, 1500);   // 跟随当前播放作品
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
