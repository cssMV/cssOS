function ensurePullRevealSearchModule(panel, body, options = {}) {
  if (!(panel instanceof HTMLElement) || !(body instanceof HTMLElement)) return null;
  let shell = body.querySelector(".panel-pull-search");
  if (!(shell instanceof HTMLElement)) {
    shell = document.createElement("div");
    shell.className = "panel-pull-search";
    shell.innerHTML = `
      <div class="panel-pull-search-hint">${escapeHtml(loginCopy("Pull down to search"))}</div>
      <div class="panel-pull-search-row">
        <input class="panel-pull-search-input" type="search" />
        <button class="mini-btn ghost panel-pull-search-clear" type="button">${escapeHtml(loginCopy("Clear"))}</button>
      </div>
    `;
    body.insertBefore(shell, body.firstChild);
  }
  const input = shell.querySelector(".panel-pull-search-input");
  const clearButton = shell.querySelector(".panel-pull-search-clear");
  const hint = shell.querySelector(".panel-pull-search-hint");
  if (input instanceof HTMLInputElement) {
    input.placeholder = String(options.placeholder || loginCopy("Search..."));
    input.value = String(options.value || "");
    if (typeof options.onInput === "function" && !input.dataset.boundSearch) {
      input.addEventListener("input", () => options.onInput(input.value));
      input.dataset.boundSearch = "true";
    }
  }
  if (hint instanceof HTMLElement) {
    hint.textContent = String(options.hint || loginCopy("Pull down to search"));
  }
  if (clearButton instanceof HTMLButtonElement) {
    if (!clearButton.dataset.boundSearch) {
      clearButton.addEventListener("click", () => {
        if (input instanceof HTMLInputElement) {
          input.value = "";
          options.onInput?.("");
        }
      });
      clearButton.dataset.boundSearch = "true";
    }
  }
  if (options.enabled === false) {
    shell.hidden = true;
    panel.classList.remove("search-revealed");
    return shell;
  }
  shell.hidden = false;
  const state = panelPullSearchState.get(panel) || { armed: false, startY: 0 };
  if (!shell.dataset.pullBound) {
    body.addEventListener("pointerdown", (event) => {
      state.armed = body.scrollTop <= 6;
      state.startY = event.clientY;
      panelPullSearchState.set(panel, state);
    });
    body.addEventListener("pointermove", (event) => {
      if (!state.armed) return;
      if (body.scrollTop > 8) return;
      const delta = event.clientY - state.startY;
      if (delta > 28) {
        panel.classList.add("search-revealed");
      }
      if (delta < -12) {
        panel.classList.remove("search-revealed");
      }
    });
    body.addEventListener("pointerup", () => {
      state.armed = false;
    });
    body.addEventListener(
      "wheel",
      (event) => {
        if (body.scrollTop > 6) return;
        if (event.deltaY < -18) panel.classList.add("search-revealed");
        if (event.deltaY > 24 && !String(input?.value || "").trim()) panel.classList.remove("search-revealed");
      },
      { passive: true }
    );
    shell.dataset.pullBound = "true";
  }
  return shell;
}

function renderSearchFilterPillsModule(container, config = {}) {
  if (!container) return;
  const pills = [];
  const pushPill = (key, label, value) => {
    const normalized = String(value || "").trim();
    if (!normalized || normalized === "all") return;
    pills.push(`
      <span class="panel-filter-pill" data-filter-key="${escapeHtml(key)}">
        <span>${escapeHtml(label)} · ${escapeHtml(normalized)}</span>
        <button class="panel-filter-pill-remove" type="button" aria-label="${escapeHtml(loginCopy("Remove filter"))}">×</button>
      </span>
    `);
  };
  pushPill("query", loginCopy("Query"), config.query);
  pushPill("author", loginCopy("Author"), config.author);
  pushPill("filter", loginCopy("Filter"), config.filterLabel);
  pushPill("sort", loginCopy("Sort"), config.sortLabel);
  pushPill("price", loginCopy("Price"), config.priceLabel);
  pushPill("time", loginCopy("Time"), config.timeLabel);
  container.innerHTML = `
    <div class="panel-filter-pills ${pills.length ? "" : "is-empty"}">${pills.join("")}</div>
    <button class="mini-btn ghost panel-filter-clear" type="button">${escapeHtml(loginCopy("Clear filters"))}</button>
  `;
}

function clearSearchControlsModule(ids = []) {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el instanceof HTMLInputElement) {
      el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    if (el instanceof HTMLSelectElement) {
      el.selectedIndex = 0;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

function clearSingleSearchControlModule(id, fallbackValue = "") {
  const el = document.getElementById(id);
  if (!el) return;
  if (el instanceof HTMLInputElement) {
    el.value = String(fallbackValue || "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  if (el instanceof HTMLSelectElement) {
    const nextValue = String(fallbackValue || el.options?.[0]?.value || "");
    el.value = nextValue;
    if (el.value !== nextValue && el.options.length) {
      el.selectedIndex = 0;
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

globalThis.renderSearchFilterPillsModule = renderSearchFilterPillsModule;
globalThis.clearSearchControlsModule = clearSearchControlsModule;
globalThis.clearSingleSearchControlModule = clearSingleSearchControlModule;

globalThis.renderSearchFilterPills = renderSearchFilterPillsModule;
globalThis.clearSearchControls = clearSearchControlsModule;
globalThis.clearSingleSearchControl = clearSingleSearchControlModule;
