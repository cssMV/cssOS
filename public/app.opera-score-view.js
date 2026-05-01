function operaScoreActsModule(work = {}) {
  const children = Array.isArray(work?.children) ? work.children : [];
  if (!children.length) return [];
  return children.filter((child) => {
    const role = String(child?.structure_role || "").trim().toLowerCase();
    const type = String(child?.work_type || "").trim().toLowerCase();
    return role === "act" || (type === "opera" && Array.isArray(child?.children) && child.children.length);
  });
}

function operaScoreScenesModule(act = {}) {
  return (Array.isArray(act?.children) ? act.children : []).filter((scene) => {
    const role = String(scene?.structure_role || "").trim().toLowerCase();
    return role === "scene" || !Array.isArray(scene?.children) || !scene.children.length;
  });
}

function isOperaRootWorkModule(work = {}) {
  const workType = String(work?.work_type || "").trim().toLowerCase();
  return workType === "opera" && operaScoreActsModule(work).length > 0;
}

function operaScoreStatusToneModule(status = "") {
  const normalized = String(status || "").trim().toLowerCase();
  if (["succeeded", "completed", "published", "ready", "live"].includes(normalized)) return "ready";
  if (["running", "queued", "init", "pending", "processing"].includes(normalized)) return "active";
  if (["failed", "error", "canceled", "cancelled"].includes(normalized)) return "error";
  return "idle";
}

function operaScoreSceneLabelModule(scene = {}, index = 0) {
  const title = String(scene?.title || "").trim();
  if (!title) return loginCopy(`Scene ${index + 1}`);
  const parts = title.split(/[：:]/).map((part) => String(part || "").trim()).filter(Boolean);
  return parts[parts.length - 1] || title;
}

function summarizeOperaScoreModule(work = {}) {
  const acts = operaScoreActsModule(work);
  const scenes = acts.flatMap((act) => operaScoreScenesModule(act));
  const statusBreakdown = scenes.reduce(
    (acc, scene) => {
      const tone = operaScoreStatusToneModule(scene?.status || "");
      acc[tone] += 1;
      return acc;
    },
    { ready: 0, active: 0, error: 0, idle: 0 }
  );
  const latestUpdatedAt = [work, ...acts, ...scenes]
    .map((entry) => String(entry?.updated_at || entry?.created_at || "").trim())
    .filter(Boolean)
    .sort()
    .pop() || "";
  return {
    acts,
    sceneCount: scenes.length,
    statusBreakdown,
    latestUpdatedAt
  };
}

function buildOperaScoreOverviewMarkupModule(work = {}, options = {}) {
  if (!isOperaRootWorkModule(work)) return "";
  const compact = options?.compact === true;
  const summary = summarizeOperaScoreModule(work);
  const title = String(work?.title || "").trim() || loginCopy("Opera Score View");
  const meta = [
    loginCopy(`${summary.acts.length} acts`),
    loginCopy(`${summary.sceneCount} scenes`),
    summary.statusBreakdown.ready
      ? loginCopy(`${summary.statusBreakdown.ready} ready`)
      : "",
    summary.statusBreakdown.active
      ? loginCopy(`${summary.statusBreakdown.active} active`)
      : ""
  ].filter(Boolean);
  return `
    <section class="opera-score-card ${compact ? "is-compact" : ""}">
      <div class="opera-score-head">
        <div>
          <div class="opera-score-eyebrow">${escapeHtml(loginCopy("Full Score View"))}</div>
          <div class="opera-score-title">${escapeHtml(title)}</div>
          <div class="opera-score-summary">${escapeHtml(meta.join(" · "))}</div>
        </div>
        ${summary.latestUpdatedAt ? `<div class="works-note">${escapeHtml(summary.latestUpdatedAt)}</div>` : ""}
      </div>
      <div class="opera-score-lanes">
        ${summary.acts.map((act, actIndex) => {
          const scenes = operaScoreScenesModule(act);
          return `
            <article class="opera-score-lane">
              <div class="opera-score-lane-head">
                <button class="opera-score-lane-title opera-score-jump" type="button" data-opera-jump-work-id="${escapeHtml(String(act?.id || act?.work_id || act?.local_id || ""))}">
                  ${escapeHtml(String(act?.title || loginCopy(`Act ${actIndex + 1}`)))}
                </button>
                <div class="opera-score-lane-meta">${escapeHtml(loginCopy(`${scenes.length} scenes`))}</div>
              </div>
              <div class="opera-score-pips">
                ${scenes.map((scene, sceneIndex) => {
                  const tone = operaScoreStatusToneModule(scene?.status || "");
                  return `<button class="opera-score-pip opera-score-jump is-${escapeHtml(tone)}" type="button" data-opera-jump-work-id="${escapeHtml(String(scene?.id || scene?.work_id || scene?.local_id || ""))}" title="${escapeHtml(operaScoreSceneLabelModule(scene, sceneIndex))}">${sceneIndex + 1}</button>`;
                }).join("")}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function jumpToOperaScoreWorkModule(workId, options = {}) {
  const targetId = String(workId || "").trim();
  if (!targetId) return false;
  if (options.openWorksPanel !== false) {
    globalThis.openWorksPanelModule?.();
  }
  window.setTimeout(() => {
    const selectors = [
      `[data-work-id="${CSS.escape(targetId)}"]`,
      `.work-hierarchy-item[data-work-child-id="${CSS.escape(targetId)}"]`,
      `summary[data-work-child-id="${CSS.escape(targetId)}"]`
    ];
    const target = document.querySelector(selectors.join(", "));
    if (!(target instanceof HTMLElement)) return;
    target.closest(".work-hierarchy-item")?.setAttribute("open", "open");
    target.scrollIntoView?.({ block: "center", behavior: "smooth" });
    target.classList.add("is-score-target");
    window.setTimeout(() => target.classList.remove("is-score-target"), 1600);
  }, 80);
  return true;
}

function bindOperaScoreJumpTargetsModule(container) {
  if (!(container instanceof Element)) return 0;
  const buttons = [...container.querySelectorAll("[data-opera-jump-work-id]")];
  buttons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      jumpToOperaScoreWorkModule(button.getAttribute("data-opera-jump-work-id"));
    });
  });
  return buttons.length;
}

Object.assign(globalThis, {
  operaScoreActsModule,
  operaScoreScenesModule,
  isOperaRootWorkModule,
  summarizeOperaScoreModule,
  buildOperaScoreOverviewMarkupModule,
  jumpToOperaScoreWorkModule,
  bindOperaScoreJumpTargetsModule
});
