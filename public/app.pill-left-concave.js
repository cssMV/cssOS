/* CSSOS_WAVE_576 20260531 — Jing「胶囊宪法: 凹向激活。左边胶囊不向右凹」根治(全平台通用)。
 *
 * 根因(决定性): app.pill-bar.js 注入宪法 CSS 前, 为防 iOS WebKit :has 崩溃, 用正则【整条剥掉所有
 * 含 :has( 的规则】。而宪法的【左侧凹向激活】正是 `:has(~[data-pill-key].active)` —— 被剥掉了。
 * 所以全平台(iOS)所有胶囊条的【左凹】本来就不生效, 只有右凹(用老组合器 .active~ 没被剥)。
 *
 * 修法: 一个通用兜底 —— 给任意 [data-pill-bar] 里【激活胶囊左侧的所有胶囊】打 .cssos-pill-laft,
 * 配一条【不含 :has】的左凹规则(镜像宪法左凹)。语言条/控制胶囊/价格条/Dock 一次性全修。
 * 节流: MutationObserver(attributes:class) + 250ms 轮询。 */
(function () {
  "use strict";
  if (globalThis.__cssosPillLeftConcaveWired) return;
  globalThis.__cssosPillLeftConcaveWired = true;

  function injectStyle() {
    if (document.getElementById("cssos-pill-laft-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-pill-laft-style";
    // 镜像宪法左凹: 左圆右平 + 负右margin咬入激活 + 右边缘 radial mask 弧口。不用 :has, iOS 安全。
    // CSSOS_WAVE_577 — 特异性必须【高于】宪法基础规则 [data-pill-bar]>[data-pill-key](0,2,0, 含 mask-image:none!important)。
    // 用 [data-pill-bar] > [data-pill-key].cssos-pill-laft = (0,3,0) 稳赢, 不受 <style> 注入顺序影响。
    st.textContent =
      "[data-pill-bar] > [data-pill-key].cssos-pill-laft{" +
      "border-radius:999px 0 0 999px !important;" +
      "margin-right:-20px !important;" +
      "width:calc(100% + 20px) !important;" +
      "padding-right:36px !important;" +
      "z-index:0 !important;" +
      "-webkit-mask-image:radial-gradient(circle 20px at 100% 50%,transparent 19.5px,#000 20px) !important;" +
      "mask-image:radial-gradient(circle 20px at 100% 50%,transparent 19.5px,#000 20px) !important;" +
      "}";
    (document.head || document.documentElement).appendChild(st);
  }

  function apply() {
    var bars = document.querySelectorAll("[data-pill-bar]");
    bars.forEach(function (bar) {
      var kids = [].slice.call(bar.children).filter(function (c) {
        return c.getAttribute && c.getAttribute("data-pill-key") != null;
      });
      // CSSOS_WAVE_588 — 多 active 时(如多语言: 模式胶囊 + 播放中的 cell 都标 .active)取【最右】active 作锚点,
      // 让它左侧所有胶囊都凹向它; findIndex(第一个)会锚错(只让模式胶囊前那几颗凹)。
      // CSSOS_WAVE_678c — 语言条(#watch-language-pill)整条交给 app.lang-flag-pills.js 的 paintConcave
      // (统一凹咬模型 + 激活前置 + 头/cell 区别处理), 全局左凹一律不插手; 清掉历史 laft 防双系统打架。
      if (bar.id === "watch-language-pill") {
        kids.forEach(function (c) { c.classList.remove("cssos-pill-laft"); });
        return;
      }
      var activeIdx = -1;
      kids.forEach(function (c, i) { if (c.classList.contains("active")) activeIdx = i; });
      kids.forEach(function (c, i) {
        // CSSOS_WAVE_678b — 模式头(🌐多语言/🎤多声线)永远实心, 绝不咬合(否则 Languages 头会 calc(100%+20px) 盖住 Voices 头, 图1)。
        if (c.classList.contains("cssos-mode-cap")) { c.classList.remove("cssos-pill-laft"); return; }
        if (activeIdx >= 0 && i < activeIdx) c.classList.add("cssos-pill-laft");
        else c.classList.remove("cssos-pill-laft");
      });
    });
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; try { injectStyle(); apply(); } catch (_e) {} }, 80);
  }
  function start() {
    injectStyle();
    try {
      new MutationObserver(schedule).observe(document.body, {
        childList: true, subtree: true, attributes: true, attributeFilter: ["class"]
      });
    } catch (_e) {}
    setInterval(schedule, 250);
    schedule();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else { start(); }
})();
