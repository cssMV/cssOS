/* CSSOS_WAVE_1164 20260623 — Jing 指令: 弹窗八方缩放(上/下/左/右 + 四角)。
 *   原生 CSS resize 只给右下角一个手柄, 故自建 8 个边/角手柄(pointer 事件驱动)。
 *   首次抓手柄时把元素「钉」成 fixed + 当前 left/top/width/height(脱离 flex/margin 停靠),
 *   之后按方向改 left/top/width/height(夹在 min/max 内)。
 *   用法: globalThis.cssosMakeResizable(el, {minW,minH,maxW,maxH}). 与拖动(标题栏)并存。 */
(function () {
  "use strict";
  if (globalThis.cssosMakeResizable) return;
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function injectCss() {
    if (document.getElementById("cssos-resizable-css")) return;
    var st = document.createElement("style"); st.id = "cssos-resizable-css";
    st.textContent =
      ".cssos-rz-h{position:absolute;z-index:6;touch-action:none;background:transparent;}" +
      ".cssos-rz-n{top:-5px;left:10px;right:10px;height:10px;cursor:ns-resize;}" +
      ".cssos-rz-s{bottom:-5px;left:10px;right:10px;height:10px;cursor:ns-resize;}" +
      ".cssos-rz-e{right:-5px;top:10px;bottom:10px;width:10px;cursor:ew-resize;}" +
      ".cssos-rz-w{left:-5px;top:10px;bottom:10px;width:10px;cursor:ew-resize;}" +
      ".cssos-rz-ne{top:-6px;right:-6px;width:16px;height:16px;cursor:nesw-resize;}" +
      ".cssos-rz-nw{top:-6px;left:-6px;width:16px;height:16px;cursor:nwse-resize;}" +
      ".cssos-rz-se{bottom:-6px;right:-6px;width:16px;height:16px;cursor:nwse-resize;}" +
      ".cssos-rz-sw{bottom:-6px;left:-6px;width:16px;height:16px;cursor:nesw-resize;}";
    document.head.appendChild(st);
  }
  globalThis.cssosMakeResizable = function (el, opts) {
    if (!el || el.__cssosResizable) return el;
    el.__cssosResizable = true;
    opts = opts || {};
    injectCss();
    var minW = opts.minW || 280, minH = opts.minH || 200;
    function maxW() { return (typeof opts.maxW === "function" ? opts.maxW() : opts.maxW) || (window.innerWidth - 12); }
    function maxH() { return (typeof opts.maxH === "function" ? opts.maxH() : opts.maxH) || (window.innerHeight - 12); }

    // 钉成自由浮动(只做一次)。
    function pin() {
      if (el.__cssosPinned) return;
      el.__cssosPinned = true;
      var r = el.getBoundingClientRect();
      el.style.position = "fixed";
      el.style.margin = "0";
      el.style.left = Math.round(r.left) + "px";
      el.style.top = Math.round(r.top) + "px";
      el.style.width = Math.round(r.width) + "px";
      el.style.height = Math.round(r.height) + "px";
      el.style.right = "auto"; el.style.bottom = "auto";
      el.style.maxWidth = "none"; el.style.maxHeight = "none";
      el.style.resize = "none";
    }

    ["n", "s", "e", "w", "ne", "nw", "se", "sw"].forEach(function (d) {
      var h = document.createElement("div");
      h.className = "cssos-rz-h cssos-rz-" + d;
      el.appendChild(h);
      h.addEventListener("pointerdown", function (e) {
        e.preventDefault(); e.stopPropagation();
        pin();
        var sx = e.clientX, sy = e.clientY;
        var r = el.getBoundingClientRect();
        var sl = r.left, st0 = r.top, sw = r.width, sh = r.height;
        var mw = maxW(), mh = maxH();
        try { h.setPointerCapture(e.pointerId); } catch (_e) {}
        function mv(ev) {
          var dx = ev.clientX - sx, dy = ev.clientY - sy;
          var nl = sl, nt = st0, nw = sw, nh = sh;
          if (d.indexOf("e") >= 0) nw = clamp(sw + dx, minW, mw);
          if (d.indexOf("s") >= 0) nh = clamp(sh + dy, minH, mh);
          if (d.indexOf("w") >= 0) { nw = clamp(sw - dx, minW, mw); nl = sl + (sw - nw); }
          if (d.indexOf("n") >= 0) { nh = clamp(sh - dy, minH, mh); nt = st0 + (sh - nh); }
          // 不让跑出视口
          nl = clamp(nl, 0, window.innerWidth - nw);
          nt = clamp(nt, 0, window.innerHeight - nh);
          el.style.width = nw + "px"; el.style.height = nh + "px";
          el.style.left = nl + "px"; el.style.top = nt + "px";
        }
        function up() {
          document.removeEventListener("pointermove", mv);
          document.removeEventListener("pointerup", up);
        }
        document.addEventListener("pointermove", mv);
        document.addEventListener("pointerup", up);
      });
    });
    return el;
  };
})();
