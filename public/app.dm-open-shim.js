/* CSSOS_WAVE_530 20260530 — Jing「用谁加载谁」: dm-panel (31KB) 按需加载的轻量 eager shim.
 *
 * dm-panel 是完整三件套自包含模块(自建 HTML + 自注入 CSS), 由 #dm hash 触发(onHashChange→openPanel),
 * 入口 cssosOpenDmWith 被 watch-ui 安全调用。唯一需要 eager 的是它自挂载的 💌 顶栏按钮(否则没入口
 * 触发首次加载)。本 shim 只做这一件事: 挂一个极小 💌 按钮 → 点击设 #dm(router 的 hash 能力随即按需
 * 加载 dm-panel, 其 onHashChange 自开)→ 移除本 stub 按钮, 让 dm-panel 挂它带未读角标的真按钮。
 * cssosOpenDmWith 的桩 + #dm hash 监听由 app.panel-router.js REGISTRY 负责。 */
(function () {
  "use strict";
  if (globalThis.__cssosDmShimInstalled) return;
  globalThis.__cssosDmShimInstalled = true;

  function realPresent() {
    // dm-panel 加载后会挂 .cssos-dm-host(带未读轮询的真按钮)。
    return !!document.querySelector(".cssos-dm-host");
  }

  function mountStub() {
    if (realPresent()) return;                       // 真按钮已在 → 不挂 stub
    if (document.getElementById("cssos-dm-stub-btn")) return;
    var btn = document.createElement("button");
    btn.id = "cssos-dm-stub-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Messages");
    btn.textContent = "💌";
    btn.style.cssText = "position:fixed;top:10px;right:44px;z-index:9998;width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,0.18);background:rgba(0,0,0,0.4);color:#dde6ff;font-size:16px;cursor:pointer;";
    btn.addEventListener("click", function () {
      try { window.location.hash = "#dm"; } catch (_e) {}
      // dm-panel 加载后会挂自己的真按钮; 移除 stub 避免双按钮。
      try { btn.remove(); } catch (_r) {}
    });
    (document.body || document.documentElement).appendChild(btn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(mountStub, 300); });
  } else {
    setTimeout(mountStub, 300);
  }
})();
