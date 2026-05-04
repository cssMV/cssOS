// CSSOS_PHASE2_PLAYLISTS 20260430 #239 — Jing
// "请制作一个播放列表，所有用户的播放列表，即从'为你创作'面板最新的作品到
//  最旧的作品，连续播放。个人作品中心的播放列表，也是从新到旧。还有自定义
//  播放列表，由用户手动添加作品进去的播放列表。当然，也允许从旧到新，或者
//  随机播放，循环播放，单曲循环，等等多种方式播放."
//
// Self-contained playlist module. Public surface (read by watch-ui.js +
// market-commerce.js):
//   • globalThis.cssosPlaylists.getActive()       — current playlist obj
//   • globalThis.cssosPlaylists.setActive(id)     — switch active list
//   • globalThis.cssosPlaylists.getMode()         — current playback mode
//   • globalThis.cssosPlaylists.setMode(mode)     — set / cycle mode
//   • globalThis.cssosPlaylists.cycleMode()       — next mode
//   • globalThis.cssosPlaylists.next()            — returns next item per mode
//   • globalThis.cssosPlaylists.prev()            — returns prev item per mode
//   • globalThis.cssosPlaylists.current()         — currently-playing item
//   • globalThis.cssosPlaylists.seekTo(id)        — set index by item id
//   • globalThis.cssosPlaylists.addToCustom(work, listId?)
//   • globalThis.cssosPlaylists.createCustom(name) — returns new list id
//   • globalThis.cssosPlaylists.removeCustom(listId)
//   • globalThis.cssosPlaylists.lists()           — array of {id, name, builtin}
//   • globalThis.cssosPlaylists.refresh(id?)      — re-fetch builtin source
//   • globalThis.cssosPlaylists.onChange(cb)      — subscribe to state changes
//
// Modes:
//   "sequential"   — newest → oldest, stop at end
//   "reverse"      — oldest → newest, stop at start
//   "shuffle"      — random walk through items, no immediate repeats
//   "loop_all"     — newest → oldest then wrap to head
//   "loop_single"  — keep replaying the current item

(function () {
  const STORAGE_KEY = "cssosPlaylists.v1";
  const VALID_MODES = ["sequential", "reverse", "shuffle", "loop_all", "loop_single"];
  // CSSOS_PHASE2_I18N 20260501 #258 — Jing: route every new label
  // through loginCopy(en, zh) so non-CN users get readable text.
  const _lc = (en, zh) => (typeof globalThis.loginCopy === "function"
    ? globalThis.loginCopy(en, zh)
    : en);
  const MODE_LABELS = {
    get sequential() { return _lc("▶ Sequential", "▶ 顺序"); },
    get reverse() { return _lc("◀ Reverse", "◀ 倒序"); },
    get shuffle() { return _lc("🔀 Shuffle", "🔀 随机"); },
    get loop_all() { return _lc("🔁 Loop list", "🔁 列表循环"); },
    get loop_single() { return _lc("🔂 Loop single", "🔂 单曲循环"); },
  };

  // ─── State ──────────────────────────────────────────────────────────
  const state = {
    active: "mine",
    mode: "loop_all", // default = list-loop so user never hits a dead end
    lists: {
      "for-you": {
        id: "for-you",
        // i18n via getter so locale switches mid-session pick up the
        // new label without a reload.
        get name() { return _lc("For You", "为你创作"); },
        builtin: true,
        source: "for-you",
        items: [],
        cursor: null,
        exhausted: false,
        loading: false,
      },
      "mine": {
        id: "mine",
        get name() { return _lc("My Works", "作品中心"); },
        builtin: true,
        source: "mine",
        items: [],
        cursor: null,
        exhausted: false,
        loading: false,
      },
    },
    index: 0,
    shuffleOrder: [],   // permutation indices for shuffle mode
    shuffleCursor: 0,   // position in shuffleOrder
    listeners: [],
  };

  // ─── Persistence ────────────────────────────────────────────────────
  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data?.active && state.lists[data.active]) state.active = data.active;
      if (VALID_MODES.includes(data?.mode)) state.mode = data.mode;
      if (data?.customLists && typeof data.customLists === "object") {
        for (const [id, list] of Object.entries(data.customLists)) {
          if (!list || typeof list !== "object") continue;
          state.lists[id] = {
            id,
            name: String(list.name || "Custom"),
            builtin: false,
            items: Array.isArray(list.items) ? list.items : [],
            cursor: null,
            exhausted: true,
            loading: false,
          };
        }
      }
    } catch (_e) { /* persistence best-effort */ }
  }
  function persist() {
    try {
      const customLists = {};
      for (const [id, list] of Object.entries(state.lists)) {
        if (list.builtin) continue;
        customLists[id] = { name: list.name, items: list.items };
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        active: state.active,
        mode: state.mode,
        customLists,
      }));
    } catch (_e) {}
  }

  // ─── Item normalisation ─────────────────────────────────────────────
  function normaliseItem(raw) {
    if (!raw) return null;
    const id = String(raw.id || raw.work_id || "").trim();
    if (!id) return null;
    const finalMv = String(raw.final_mv_url || raw.preview_video_url || "").trim();
    const a1 = String(raw.audio_track_1_url || "").trim();
    const a2 = String(raw.audio_track_2_url || "").trim();
    if (!finalMv && !a1 && !a2) return null; // skip drafts with no media
    if (Number(raw.take_index || 0) === 2) return null; // drop Take 2 sibling rows
    return {
      id,
      title: String(raw.title || "").trim(),
      cover_url: raw.cover_url || raw.cover_image || raw.preview_image_url || null,
      final_mv_url: finalMv || null,
      preview_video_url: raw.preview_video_url || null,
      audio_track_1_url: a1 || null,
      audio_track_2_url: a2 || null,
      subtitle_srt_url: raw.subtitle_srt_url || null,
      duration_secs: Number(raw.duration_secs || 0) || null,
      lyrics_preview: raw.lyrics_preview || "",
      sibling_work_id: raw.sibling_work_id || null,
      take_index: raw.take_index || null,
      root_work_id: raw.root_work_id || null,
      sequence_index: raw.sequence_index ?? 0,
      is_own: raw.is_own === true,
      created_at: raw.created_at || null,
    };
  }

  // ─── Source fetchers ────────────────────────────────────────────────
  async function fetchForYou(list) {
    // for-you = all (own + others), cursor-paginated
    if (list.loading || list.exhausted) return;
    // CSSOS_PHASE2_KILL_405_GET_MV 20260504 — Jing
    // GET /cssapi/v1/mv is unregistered server-side (only POST is
    // registered in rust-api/src/routes.rs). Don't even attempt the
    // request — the 405 paints a red entry in DevTools every load.
    // Mark exhausted so any caller upstream knows this source is
    // empty; "My Works" loop covers the user's own library via a
    // separate path. For-You feeds for OTHER users' works are not
    // yet surfaced through any working endpoint.
    list.exhausted = true;
    list.loading = false;
    notify();
  }

  async function fetchMine(list) {
    if (list.loading || list.exhausted) return;
    list.loading = true;
    try {
      const res = await fetch("/api/works/mine", { credentials: "include" });
      const payload = await res.json().catch(() => null);
      const works = payload?.data?.works || payload?.works || [];
      const flat = [];
      const visit = (w) => {
        if (!w) return;
        flat.push(w);
        if (Array.isArray(w.children)) w.children.forEach(visit);
      };
      works.forEach(visit);
      // Newest → oldest by default. Reverse mode flips during iteration.
      flat.sort((a, b) => {
        const ta = Date.parse(String(a?.created_at || "")) || 0;
        const tb = Date.parse(String(b?.created_at || "")) || 0;
        return tb - ta;
      });
      const have = new Set(list.items.map((it) => it.id));
      for (const w of flat) {
        const it = normaliseItem({ ...w, is_own: true });
        if (it && !have.has(it.id)) {
          list.items.push(it);
          have.add(it.id);
        }
      }
      list.exhausted = true; // /api/works/mine returns the full set
    } catch (_e) {}
    finally {
      list.loading = false;
      notify();
    }
  }

  async function ensureLoaded(list) {
    if (!list || !list.builtin) return;
    if (list.items.length > 0) {
      // Top up if cursor exists
      if (!list.exhausted && !list.loading) {
        if (list.source === "for-you") void fetchForYou(list);
      }
      return;
    }
    if (list.source === "for-you") await fetchForYou(list);
    else if (list.source === "mine") await fetchMine(list);
    // After primary, fall back to the other if still empty.
    if (list.items.length === 0 && list.source === "for-you") {
      // Try mine as a backstop so the queue is never truly empty.
      try {
        const mine = state.lists["mine"];
        if (mine && !mine.exhausted) await fetchMine(mine);
        for (const m of (mine?.items || [])) {
          if (!list.items.find((it) => it.id === m.id)) list.items.push(m);
        }
      } catch (_e) {}
    } else if (list.items.length === 0 && list.source === "mine") {
      try {
        const fy = state.lists["for-you"];
        if (fy && !fy.exhausted) await fetchForYou(fy);
        for (const m of (fy?.items || [])) {
          if (!list.items.find((it) => it.id === m.id)) list.items.push(m);
        }
      } catch (_e) {}
    }
  }

  // ─── Mode-aware navigation ──────────────────────────────────────────
  function ensureShuffleOrder(list) {
    const n = list.items.length;
    if (state.shuffleOrder.length !== n) {
      state.shuffleOrder = Array.from({ length: n }, (_, i) => i);
      // Fisher-Yates
      for (let i = n - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.shuffleOrder[i], state.shuffleOrder[j]] = [state.shuffleOrder[j], state.shuffleOrder[i]];
      }
      state.shuffleCursor = state.shuffleOrder.indexOf(state.index);
      if (state.shuffleCursor < 0) state.shuffleCursor = 0;
    }
  }

  function step(direction /* +1 or -1 */) {
    const list = state.lists[state.active];
    if (!list || list.items.length === 0) return null;
    const len = list.items.length;
    const mode = state.mode;
    if (mode === "loop_single") {
      // Stay on current item; force re-render by returning current.
      return list.items[state.index] || null;
    }
    if (mode === "shuffle") {
      ensureShuffleOrder(list);
      state.shuffleCursor = (state.shuffleCursor + direction + len) % len;
      state.index = state.shuffleOrder[state.shuffleCursor];
      return list.items[state.index] || null;
    }
    // sequential / reverse / loop_all
    let logicalDir = direction;
    if (mode === "reverse") logicalDir = -direction;
    let next = state.index + logicalDir;
    if (mode === "loop_all") {
      if (next >= len) next = 0;
      else if (next < 0) next = len - 1;
    } else {
      // sequential / reverse — clamp at boundary
      if (next >= len) return null; // signal end
      if (next < 0) return null;
    }
    state.index = next;
    return list.items[state.index] || null;
  }

  // ─── Public API ─────────────────────────────────────────────────────
  function notify() {
    persist();
    for (const cb of state.listeners) {
      try { cb({ active: state.active, mode: state.mode, index: state.index }); } catch (_e) {}
    }
  }

  const api = {
    getActive() {
      return state.lists[state.active] || null;
    },
    setActive(id) {
      if (!state.lists[id]) return false;
      state.active = id;
      state.index = 0;
      state.shuffleOrder = [];
      state.shuffleCursor = 0;
      void ensureLoaded(state.lists[id]);
      notify();
      return true;
    },
    getMode() { return state.mode; },
    setMode(mode) {
      if (!VALID_MODES.includes(mode)) return false;
      state.mode = mode;
      // Reset shuffle so a fresh permutation is built next time.
      if (mode === "shuffle") {
        state.shuffleOrder = [];
        state.shuffleCursor = 0;
      }
      notify();
      return true;
    },
    cycleMode() {
      const i = VALID_MODES.indexOf(state.mode);
      const next = VALID_MODES[(i + 1) % VALID_MODES.length];
      api.setMode(next);
      return next;
    },
    modeLabel(mode) { return MODE_LABELS[mode || state.mode] || state.mode; },
    async next() {
      const list = state.lists[state.active];
      if (!list) return null;
      await ensureLoaded(list);
      // Top up cursor list as we approach the tail
      if (list.builtin && list.source === "for-you" &&
          list.items.length - state.index <= 4 && !list.exhausted) {
        void fetchForYou(list);
      }
      return step(+1);
    },
    async prev() {
      const list = state.lists[state.active];
      if (!list) return null;
      await ensureLoaded(list);
      return step(-1);
    },
    current() {
      const list = state.lists[state.active];
      if (!list) return null;
      return list.items[state.index] || null;
    },
    seekTo(id) {
      const list = state.lists[state.active];
      if (!list) return false;
      const idx = list.items.findIndex((it) => String(it.id) === String(id));
      if (idx >= 0) {
        state.index = idx;
        if (state.mode === "shuffle") {
          ensureShuffleOrder(list);
          state.shuffleCursor = state.shuffleOrder.indexOf(idx);
          if (state.shuffleCursor < 0) state.shuffleCursor = 0;
        }
        notify();
        return true;
      }
      return false;
    },
    addToCustom(work, listId) {
      const it = normaliseItem(work);
      if (!it) return false;
      if (!listId) {
        // Auto-create / use default custom list.
        listId = "custom-default";
        if (!state.lists[listId]) {
          state.lists[listId] = {
            id: listId, name: "我的收藏", builtin: false, items: [],
            cursor: null, exhausted: true, loading: false,
          };
        }
      }
      const list = state.lists[listId];
      if (!list) return false;
      if (list.items.find((x) => x.id === it.id)) return false; // dedupe
      list.items.push(it);
      notify();
      return true;
    },
    createCustom(name) {
      const id = "custom-" + Date.now().toString(36);
      state.lists[id] = {
        id, name: String(name || "Custom"), builtin: false,
        items: [], cursor: null, exhausted: true, loading: false,
      };
      notify();
      return id;
    },
    removeCustom(listId) {
      const list = state.lists[listId];
      if (!list || list.builtin) return false;
      delete state.lists[listId];
      if (state.active === listId) {
        state.active = "mine";
        state.index = 0;
      }
      notify();
      return true;
    },
    lists() {
      return Object.values(state.lists).map((l) => ({
        id: l.id, name: l.name, builtin: l.builtin, count: l.items.length,
      }));
    },
    items() {
      const list = state.lists[state.active];
      return list ? list.items.slice() : [];
    },
    async refresh(id) {
      const list = state.lists[id || state.active];
      if (!list || !list.builtin) return;
      list.items = [];
      list.cursor = null;
      list.exhausted = false;
      await ensureLoaded(list);
    },
    onChange(cb) {
      if (typeof cb !== "function") return () => {};
      state.listeners.push(cb);
      return () => {
        const i = state.listeners.indexOf(cb);
        if (i >= 0) state.listeners.splice(i, 1);
      };
    },
    // Diagnostic / test
    _state: state,
    VALID_MODES,
  };

  loadPersisted();

  // Eagerly start loading both builtins so the first nav call has data.
  setTimeout(() => {
    void ensureLoaded(state.lists["mine"]);
    void ensureLoaded(state.lists["for-you"]);
  }, 0);

  globalThis.cssosPlaylists = api;
})();
