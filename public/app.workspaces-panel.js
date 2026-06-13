const WORKSPACE_TOUCH_STORE_KEY = "cssos.workspaceTouches";

function normalizeWorkspaceTitleKeyModule(title = "") {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, " ")
    .replace(/\s*(?:[-·:：]\s*)?(?:part|pt|scene|act|chapter|movement|segment)\s*\d+\b/gi, "")
    .replace(/\s*(?:第\s*[一二三四五六七八九十0-9]+\s*[幕章节部集])\s*$/giu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readWorkspaceTouchesModule() {
  try {
    const raw = globalThis.localStorage?.getItem(WORKSPACE_TOUCH_STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function writeWorkspaceTouchesModule(entries) {
  try {
    globalThis.localStorage?.setItem(WORKSPACE_TOUCH_STORE_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
  } catch (_error) {
    // ignore
  }
}

function recordWorkspaceTouchModule(work = {}) {
  const title = String(work?.title || "").trim();
  const workId = String(work?.id || work?.work_id || work?.local_id || "").trim();
  if (!title || !workId) return false;
  const rows = readWorkspaceTouchesModule().filter((row) => String(row?.id || "").trim() !== workId);
  rows.unshift({
    id: workId,
    title,
    work_type: String(work?.work_type || "").trim(),
    structure_role: String(work?.structure_role || "").trim(),
    status: String(work?.status || "draft").trim(),
    created_at: String(work?.created_at || new Date().toISOString()).trim(),
    updated_at: String(work?.updated_at || work?.created_at || new Date().toISOString()).trim()
  });
  writeWorkspaceTouchesModule(rows.slice(0, 180));
  return true;
}

async function loadWorkspacePanelSnapshotModule() {
  if (!authState.user) {
    return {
      authenticated: false,
      works: [],
      studio: null
    };
  }
  const [worksResult, studioResult] = await Promise.allSettled([
    fetch("/api/works/mine?limit=120", { credentials: "include" }).then((res) => res.json().catch(() => null).then((payload) => ({ res, payload }))),
    fetch("/api/studio/workspace", { credentials: "include" }).then((res) => res.json().catch(() => null).then((payload) => ({ res, payload })))
  ]);

  const worksPayload = worksResult.status === "fulfilled" ? worksResult.value : null;
  const studioPayload = studioResult.status === "fulfilled" ? studioResult.value : null;
  const works = worksPayload?.res?.ok && Array.isArray(worksPayload?.payload?.data?.works)
    ? worksPayload.payload.data.works
    : listLocalWorksForCurrentUser();
  const touched = readWorkspaceTouchesModule();
  const mergedWorks =
    typeof mergeLocalAndRemoteWorks === "function"
      ? mergeLocalAndRemoteWorks(Array.isArray(works) ? works : [], touched)
      : works;
  const studio =
    studioPayload?.res?.ok && studioPayload?.payload?.ok !== false
      ? (studioPayload?.payload?.data || studioPayload?.payload || null)
      : null;
  return {
    authenticated: true,
    works: Array.isArray(mergedWorks) ? mergedWorks : [],
    studio
  };
}

function buildWorkspaceGroupsModule(works = []) {
  const rows = Array.isArray(works) ? works : [];
  const hierarchyRoots =
    typeof globalThis.buildWorkHierarchy === "function"
      ? globalThis.buildWorkHierarchy(rows)
      : rows.filter((work) => !String(work?.parent_work_id || "").trim());
  const operaRootsByKey = new Map(
    hierarchyRoots
      .filter((work) => globalThis.isOperaRootWorkModule?.(work))
      .map((work) => [normalizeWorkspaceTitleKeyModule(String(work?.title || "").trim()), work])
  );
  const groups = new Map();
  rows.forEach((work) => {
    const title = String(work?.title || "").trim() || t("workspaces.untitledWorkspace");
    const key = normalizeWorkspaceTitleKeyModule(title) || title.toLowerCase();
    const createdAt = String(work?.created_at || "");
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        workspaceTitle: title,
        anchorCreatedAt: createdAt,
        works: [],
        scoreRoot: operaRootsByKey.get(key) || null
      });
    }
    const entry = groups.get(key);
    if (createdAt && (!entry.anchorCreatedAt || createdAt < entry.anchorCreatedAt)) {
      entry.anchorCreatedAt = createdAt;
      entry.workspaceTitle = title;
    }
    entry.works.push(work);
  });
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      works: group.works.sort((a, b) => String(b?.created_at || "").localeCompare(String(a?.created_at || "")))
    }))
    .sort((a, b) => String(b?.works?.[0]?.created_at || "").localeCompare(String(a?.works?.[0]?.created_at || "")));
}

function buildWorkspaceGroupMarkupModule(group) {
  const works = Array.isArray(group?.works) ? group.works : [];
  const latest = works[0] || {};
  const types = [...new Set(works.map((work) => String(work?.work_type || work?.structure_role || "single")).filter(Boolean))];
  const scoreMarkup =
    typeof globalThis.buildOperaScoreOverviewMarkupModule === "function" && group?.scoreRoot
      ? globalThis.buildOperaScoreOverviewMarkupModule(group.scoreRoot, { compact: true })
      : "";
  return `
    <article class="workspace-card">
      <div class="workspace-card-head">
        <div>
          <div class="work-title">${escapeHtml(String(group?.workspaceTitle || t("workspaces.workspace")))}</div>
          <div class="work-tags">${escapeHtml(
            t("workspaces.outputsMeta", {
              count: works.length,
              types: types.join(" / ") || t("workspaces.singleType")
            })
          )}</div>
        </div>
        <div class="works-note">${escapeHtml(String(latest?.updated_at || latest?.created_at || ""))}</div>
      </div>
      ${scoreMarkup}
      <div class="workspace-card-list">
        ${works.slice(0, 6).map((work) => `
          <div class="workspace-line">
            <div>
              <div class="workspace-line-title">${escapeHtml(String(work?.title || t("workspaces.untitledWork")))}</div>
              <div class="work-tags">${escapeHtml(String(work?.status || "draft"))}${(globalThis.cssosFmtDur && globalThis.cssosFmtDur(work)) ? " · ♪ " + escapeHtml(globalThis.cssosFmtDur(work)) : ""}</div>
            </div>
            <button class="mini-btn ghost tiny" type="button" data-workspace-open-work="${escapeHtml(String(work?.id || work?.local_id || ""))}">
              ${escapeHtml(t("action.open"))}
            </button>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function buildWorkspacesPanelMarkupModule(snapshot) {
  if (!snapshot?.authenticated) {
    return `
      <div class="works-section">
        <div class="section-title">${escapeHtml(t("workspaces.creativeTitle"))}</div>
        <div class="comment-card">
          <div class="comment-text">${escapeHtml(t("workspaces.signInHint"))}</div>
        </div>
      </div>
    `;
  }

  const groups = buildWorkspaceGroupsModule(snapshot.works);
  const studio = snapshot.studio?.workspace || null;
  return `
    <div class="works-section">
      <div class="section-title">${escapeHtml(t("workspaces.ruleTitle"))}</div>
      <div class="comment-card">
        <div class="comment-text">${escapeHtml(t("workspaces.ruleBody"))}</div>
        <div class="works-note">${escapeHtml(
          studio
            ? t("workspaces.studioReady", {
                name: String(studio.name || "").trim() || t("workspaces.workspace")
              })
            : t("workspaces.mvpHint")
        )}</div>
      </div>
    </div>
    <div class="works-grid">
      <div class="works-section">
        <div class="section-title">${escapeHtml(t("workspaces.groupedTitle"))}</div>
        <div class="workspace-grid">
          ${groups.length
            ? groups.map((group) => buildWorkspaceGroupMarkupModule(group)).join("")
            : `<div class="works-note">${escapeHtml(t("workspaces.empty"))}</div>`}
        </div>
      </div>
    </div>
  `;
}

function getWorkspacesPanelModule() {
  const panel = document.getElementById("workspaces-panel");
  return panel instanceof HTMLElement ? panel : null;
}

function openWorkspaceFromPanelModule(workId) {
  const targetId = String(workId || "").trim();
  if (!targetId) return false;
  globalThis.openWorksPanelModule?.();
  window.setTimeout(() => {
    const selector = `[data-work-id="${CSS.escape(targetId)}"], [data-work-child-id="${CSS.escape(targetId)}"]`;
    document.querySelector(selector)?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, 80);
  return true;
}

async function renderWorkspacesPanelModule() {
  const content = document.getElementById("workspaces-panel-content");
  if (!(content instanceof HTMLElement)) return false;
  content.innerHTML = (globalThis.cssosSkeletonRowsMarkup
    ? globalThis.cssosSkeletonRowsMarkup(4, t("workspaces.loading"))
    : `<div class="works-note">${escapeHtml(t("workspaces.loading"))}</div>`);
  const snapshot = await loadWorkspacePanelSnapshotModule();
  content.innerHTML = buildWorkspacesPanelMarkupModule(snapshot);
  globalThis.bindOperaScoreJumpTargetsModule?.(content);
  content.querySelectorAll("[data-workspace-open-work]").forEach((button) => {
    button.addEventListener("click", () => openWorkspaceFromPanelModule(button.getAttribute("data-workspace-open-work")));
  });
  return true;
}

function openWorkspacesPanelModule() {
  const panel = getWorkspacesPanelModule();
  if (!(panel instanceof HTMLElement)) return false;
  openPanel?.(panel, { focus: true, layout: true });
  panel.classList.remove("hidden");
  panel.dataset.minimized = "false";
  globalThis.clampPanelInViewport?.(panel);
  globalThis.focusPanelBridge?.(panel);
  globalThis.bringPanelToFrontBridge?.(panel, { repeatPasses: 3 });
  void renderWorkspacesPanelModule();
  return true;
}

Object.assign(globalThis, {
  normalizeWorkspaceTitleKeyModule,
  readWorkspaceTouchesModule,
  buildWorkspaceGroupsModule,
  buildWorkspacesPanelMarkupModule,
  getWorkspacesPanelModule,
  recordWorkspaceTouchModule,
  renderWorkspacesPanelModule,
  writeWorkspaceTouchesModule,
  openWorkspacesPanelModule
});
