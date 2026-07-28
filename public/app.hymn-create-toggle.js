/* W1766 — 创作入口「圣诗音乐」复选框 → 展开各教派子项胶囊(胶囊宪法 data-pill-bar, 自适应宽)。
 *   Jing:「创作入口加一个复选框圣诗音乐, 用户选中→显示子项各个教派, 我们开放给用户来创作。」
 *
 *   · 教派清单复用 app.hymn-gallery.js 导出的 globalThis.CSSOS_HYMN_TRADITIONS(不两处维护)。
 *   · 选中教派 → 设 globalThis.cssosCreationHymn = { enabled, tradition, name } 供创作管线读取。
 *     (真正把"某教派圣诗"喂进生成参数 = 文明智能联动那一波的活儿; 这里先把上下文旗标立好。)
 *   · 全部挂在【非冻结】的 .settings-body 里, 不碰 .creation-tabs/.creation-chips/#creation-style-input 等红线块。
 *
 *   独立 IIFE(避免 bundle 顶层 const 冲突)。 */
(function () {
  "use strict";

  function boot() {
    var check = document.getElementById("hymn-create-check");
    var wrap = document.getElementById("hymn-denom-wrap");
    var bar = document.getElementById("hymn-denom-bar");
    if (!check || !wrap || !bar) return;          // markup 不在(该页无创作面板)→ 静默退出
    if (check.__cssosHymnBound) return;           // 幂等
    check.__cssosHymnBound = true;

    var trads = Array.isArray(globalThis.CSSOS_HYMN_TRADITIONS) ? globalThis.CSSOS_HYMN_TRADITIONS : [];

    function metaFor(key) {
      for (var i = 0; i < trads.length; i++) { if (trads[i].key === key) return trads[i]; }
      return { key: key, name: key };
    }

    function buildBar() {
      if (bar.childElementCount) return;          // 只填一次
      bar.innerHTML = trads.map(function (tr) {
        return '<button type="button" data-pill-key="' + tr.key + '">' +
          '<span style="margin-right:5px;">' + (tr.sym || "◈") + "</span>" +
          "<span>" + tr.name + "</span></button>";
      }).join("");
      if (typeof globalThis.cssosMakePillBar === "function") {
        var initial = (globalThis.cssosCreationHymn && globalThis.cssosCreationHymn.tradition) ||
          (trads[0] && trads[0].key);
        globalThis.cssosMakePillBar(bar, {
          activeKey: initial,
          textColor: "dark",                      // 创作面板浅底 → 深字(胶囊宪法 data-pill-text=dark)
          onActivate: function (key) {
            var m = metaFor(key);
            globalThis.cssosCreationHymn = { enabled: !!check.checked, tradition: key, name: m.name };
          },
        });
      }
    }

    function sync() {
      var on = !!check.checked;
      wrap.hidden = !on;
      if (on) {
        buildBar();
        var active = bar.querySelector("[data-pill-key].active");
        var key = active ? active.getAttribute("data-pill-key") : (trads[0] && trads[0].key);
        var m = metaFor(key);
        globalThis.cssosCreationHymn = { enabled: true, tradition: key, name: m.name };
      } else {
        globalThis.cssosCreationHymn = { enabled: false, tradition: null, name: null };
      }
    }

    check.addEventListener("change", sync);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
