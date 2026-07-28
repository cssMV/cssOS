/* W1770 — 「京典模版」复选框 ↔ Section Form 联动(Jing: section_form 也留空 + 用户干预优先)。
 *   · 勾选 → Section Form 填京典十节结构, 标记用户意图(cssmvUserTyped) → 总魔法棒不覆盖、留空扫除不抹。
 *   · 取消 → Section Form 清空 → 交给总魔法棒按文明智能联动随机选一种结构(civ 戳记)。
 *   · 用户直接手输结构 → 复选框自动反映(== 京典才勾上, 否则取消) → 用户手输最高优先。
 *   独立 IIFE(避免 bundle 顶层名冲突)。 */
(function () {
  "use strict";
  var CLASSIC = "Verse 1, Verse 2, Chorus 1, Verse 3, Verse 4, Chorus 2, Bridge, Chorus 3, Chorus 4, Outro";

  function boot() {
    var input = document.getElementById("creation-section-form");
    var cb = document.getElementById("creation-section-form-classic");
    if (!input || !cb) return;
    if (cb.__cssosSfBound) return;
    cb.__cssosSfBound = true;

    // W1770 — 京典 master switch 状态旗标: 供歌词请求(app.run-auth.js)读取 → jingdian:true 传后端,
    //   后端走精确十节京典默认 + 完整 8 条(小节标题/civ曲风唱腔/civ语言+古老咒语/典故/方括号/英文曲风)。
    function setFlag() { try { globalThis.cssosJingdianTemplate = !!cb.checked; } catch (_e) {} }

    cb.addEventListener("change", function () {
      input.__cssosProgrammatic = true;
      if (cb.checked) {
        input.value = CLASSIC;
        if (input.dataset) { input.dataset.cssmvUserTyped = "1"; delete input.dataset.cssmvCivDefault; }
      } else {
        input.value = "";
        if (input.dataset) { delete input.dataset.cssmvUserTyped; delete input.dataset.cssmvCivDefault; }
      }
      input.__cssosProgrammatic = false;
      setFlag();
      // W1770 — 「勾京典 = 一键按当前文明铺满全部 8 条」: 勾选立即调文明智能联动 civ-fill, 把面板可填字段
      //   (声线/器乐/合奏/动态/演奏/密度/humanization…)按【当前文明】一键铺满。只填用户没动过的(isVirgin)
      //   → 文明智能联动 + 用户可逐项覆盖。section_form 已是京典(cssmvUserTyped)→ civ-fill 跳过, 京典保留。
      //   曲风(冻结风格块)+ 歌词侧 8 条(小节标题/civ语言+古老咒语/典故/方括号/英文曲风)由后端按 jingdian 在生成时施加。
      if (cb.checked) {
        try { if (typeof globalThis.cssosApplyCivDefaultsForLyrics === "function") globalThis.cssosApplyCivDefaultsForLyrics(); } catch (_e) {}
      }
      // 让依赖 section_form 的预览/控制台等重算(不触发用户-typed 逻辑: 我们自管 flag)。
      try { if (typeof globalThis.renderCreationConsoleModule === "function") globalThis.renderCreationConsoleModule(); } catch (_e) {}
    });

    input.addEventListener("input", function () {
      if (input.__cssosProgrammatic) return; // 我们自己的程序化写入, 跳过反映
      cb.checked = (String(input.value || "").trim() === CLASSIC);
      setFlag();
    });

    // 初始反映当前值(通常为空 → 不勾)。
    cb.checked = (String(input.value || "").trim() === CLASSIC);
    setFlag();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  // 面板懒加载/重建后补绑。
  try { new MutationObserver(boot).observe(document.documentElement, { childList: true, subtree: true }); } catch (_e) {}
})();
