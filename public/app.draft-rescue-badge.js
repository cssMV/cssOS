/* CSSOS_WAVE_546 20260531 — Jing「半成品要能补救」: 作品中心里, 中断/未合成的 draft 作品
 * 此前和成品长得一样(只显示 Live/Hidden), 用户分不清哪些是未完成的半成品, 更无从补救。
 * 本模块【附加式】(不改脆弱的卡片构建器)扫描已渲染的 .work-card, 给 status='draft' 的卡:
 *   ① 打"🚧 草稿 · 未完成"徽标 + 进度(词/封面/曲/视频 哪几步已出);
 *   ② "继续合成"按钮 → openMvPipelinePanel 以该草稿内容做种子, 续跑缺的阶段(计费本就延迟到
 *      最终 complete 才扣, 续跑只补差额);
 *   ③ "编辑"按钮 → openWorkEditPanel(W544)。
 * i18n 铁律: 文案走 drcCopy(en, zh) 按 html[lang], 不硬编码单一语言。 */
(function () {
  "use strict";
  if (globalThis.__cssosDraftRescueWired) return;
  globalThis.__cssosDraftRescueWired = true;

  function isZh() {
    try { return String(document.documentElement.lang || "").toLowerCase().startsWith("zh"); }
    catch (_e) { return false; }
  }
  function drcCopy(en, zh) {
    try {
      if (typeof globalThis.tr === "function") {
        const k = "draftRescue." + en.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
        const v = globalThis.tr(k);
        if (v && v !== k) return v;
      }
    } catch (_e) {}
    return isZh() ? zh : en;
  }
  function toast(m) { try { if (typeof globalThis.showToast === "function") globalThis.showToast(m); } catch (_e) {} }

  function injectStyles() {
    if (document.getElementById("cssos-draft-rescue-style")) return;
    const st = document.createElement("style");
    st.id = "cssos-draft-rescue-style";
    st.textContent = [
      ".cssos-draft-banner{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:8px;",
      "padding:8px 10px;border-radius:10px;background:rgba(255,176,32,0.12);",
      "border:1px solid rgba(255,176,32,0.34);}",
      ".cssos-draft-banner .drc-tag{font-size:12px;font-weight:650;color:#d98a00;letter-spacing:.02em;}",
      ".cssos-draft-banner .drc-steps{font-size:12px;opacity:0.82;}",
      ".cssos-draft-banner .drc-steps .done{color:#2e9b57;}",
      ".cssos-draft-banner .drc-steps .todo{opacity:0.5;}",
      ".cssos-draft-banner .drc-actions{display:flex;gap:8px;margin-left:auto;}",
      ".cssos-draft-banner button{border:0;border-radius:9px;padding:6px 12px;font-size:12px;",
      "cursor:pointer;font-family:inherit;font-weight:600;}",
      ".cssos-draft-banner button.drc-resume{background:#ffb020;color:#3a2600;}",
      ".cssos-draft-banner button.drc-edit{background:transparent;color:#cfd3dc;border:1px solid rgba(255,255,255,0.18);}"
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function findWork(workId) {
    const pools = [globalThis.latestResolvedWorksCollection, globalThis.publicMarketState && globalThis.publicMarketState.works];
    for (const pool of pools) {
      if (Array.isArray(pool)) {
        const hit = pool.find((w) => String(w && (w.id || w.work_id)) === String(workId));
        if (hit) return hit;
      }
    }
    return null;
  }

  function isDraft(work) {
    if (!work) return false;
    const s = String(work.status || "").toLowerCase();
    if (s === "draft") return true;
    // 兜底: 无 status 但既无 final_mv 也无 audio 也无 preview video → 视作未完成。
    if (!s) {
      const hasMedia = work.final_mv_url || work.preview_video_url || work.audio_track_1_url;
      const hasAudio = work.audio_track_1_url;
      if (!hasMedia && !hasAudio) return true;
    }
    return false;
  }

  function stageMarkup(work) {
    const steps = [
      { ok: !!(work.lyrics_preview || work.lyrics_full || work.lyrics_text), en: "Lyrics", zh: "词" },
      { ok: !!(work.cover_image || work.preview_image_url), en: "Cover", zh: "封面" },
      { ok: !!work.audio_track_1_url, en: "Music", zh: "曲" },
      { ok: !!(work.final_mv_url || work.preview_video_url), en: "Video", zh: "视频" }
    ];
    return steps.map((s) =>
      '<span class="' + (s.ok ? "done" : "todo") + '">' + (s.ok ? "✓" : "○") + (isZh() ? s.zh : s.en) + "</span>"
    ).join(" · ");
  }

  function attach(card) {
    if (!(card instanceof HTMLElement)) return;
    if (card.dataset.cssosDraftDone === "1") return;
    const workId = card.getAttribute("data-work-id") || card.dataset.workId || "";
    if (!/^[0-9a-f-]{36}$/i.test(workId)) return;
    const work = findWork(workId);
    if (!work) return;            // 数据没就绪, 下次 sweep 再处理(不标记 done)
    card.dataset.cssosDraftDone = "1";
    if (!isDraft(work)) return;   // 成品, 不加横幅

    injectStyles();
    const banner = document.createElement("div");
    banner.className = "cssos-draft-banner";
    banner.innerHTML =
      '<span class="drc-tag">🚧 ' + drcCopy("Draft · Unfinished", "草稿 · 未完成") + "</span>" +
      '<span class="drc-steps">' + stageMarkup(work) + "</span>" +
      '<span class="drc-actions">' +
        '<button type="button" class="drc-resume">' + drcCopy("Finish it", "继续合成") + "</button>" +
        '<button type="button" class="drc-edit">' + drcCopy("Edit", "编辑") + "</button>" +
      "</span>";
    card.appendChild(banner);

    banner.querySelector(".drc-resume").addEventListener("click", async (e) => {
      e.stopPropagation();
      // CSSOS_WAVE_551 — 先问后端【精确续跑计划】(确保 run 行 + 拿到 missing_stages/已产出资产),
      // 再把计划交给 MV 管线: 只续跑缺失阶段, 复用已产出(Rust 接上后按 stages_done/stage_results 跳过)。
      let plan = null;
      try {
        const r = await fetch("/api/works/" + encodeURIComponent(workId) + "/resume", {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "same-origin", body: "{}"
        });
        plan = await r.json().catch(() => null);
        if (plan && plan.already_complete) {
          toast(drcCopy("Already complete", "作品已完整"));
          if (typeof globalThis.loadMyWorksModule === "function") globalThis.loadMyWorksModule({ force: true });
          return;
        }
      } catch (_e) {}
      const seed = Object.assign({
        work_id: workId,
        source_run_id: (plan && plan.run_id) || work.source_run_id || "",
        run_id: (plan && plan.run_id) || "",
        title: work.title || "",
        lyrics: work.lyrics_full || work.lyrics_preview || work.lyrics_text || "",
        style: work.style || "",
        resume: true,
        missing_stages: (plan && plan.missing_stages) || null,
        stages_done: (plan && plan.stages_done) || null,
        existing_assets: (plan && plan.existing_assets) || null
      }, (plan && plan.seed) || {});
      if (typeof globalThis.openMvPipelinePanel === "function") {
        try {
          globalThis.openMvPipelinePanel({ autoStart: false, seed: seed, focus: true });
          const miss = (plan && Array.isArray(plan.missing_stages)) ? plan.missing_stages.join(" · ") : "";
          toast(drcCopy("Resuming — finishing remaining steps", "续跑剩余步骤") + (miss ? ": " + miss : ""));
          return;
        } catch (_e) {}
      }
      // 兜底: 没有管线入口时, 先让用户编辑修补。
      if (typeof globalThis.openWorkEditPanel === "function") globalThis.openWorkEditPanel(work);
      else toast(drcCopy("Pipeline unavailable", "管线入口不可用"));
    });
    banner.querySelector(".drc-edit").addEventListener("click", (e) => {
      e.stopPropagation();
      if (typeof globalThis.openWorkEditPanel === "function") globalThis.openWorkEditPanel(work);
    });
  }

  function sweep() {
    const list = document.getElementById("works-list");
    if (!list) return;
    list.querySelectorAll(".work-card[data-work-id]").forEach(attach);
  }

  // 列表渲染是异步的 → 用 MutationObserver 持续兜住新渲染的卡; 另加节流 sweep。
  let pending = null;
  function schedule() {
    if (pending) return;
    pending = setTimeout(() => { pending = null; try { sweep(); } catch (_e) {} }, 120);
  }
  function start() {
    const list = document.getElementById("works-list");
    if (!list) { setTimeout(start, 800); return; }
    try {
      new MutationObserver(schedule).observe(list, { childList: true, subtree: true });
    } catch (_e) {}
    schedule();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
  globalThis.cssosSweepDraftRescue = sweep;
})();
