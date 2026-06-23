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
    // CSSOS_WAVE_1107 — 升级: 独立单曲=1部作品, 多部作品在整部内循环 → 统称"单部循环"。
    get loop_single() { return _lc("🔂 Loop work", "🔂 单部循环"); },
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
      // CSSOS_WAVE_822 20260616 — Jing「加一个 Epic 列表, 仿 Epic 墙: 用户个人 Epic → 平台 Epic」。
      "epic": {
        id: "epic",
        get name() { return _lc("⚡ Epic", "⚡ Epic"); },
        builtin: true,
        source: "epic",
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
      // CSSOS_WAVE_1092 — 多部作品上下文(供 up-next 卡显示三部曲/歌剧/剧集 N 部 + 第几/共几)
      work_type: String(raw.work_type || "").trim() || null,
      part_index: Number(raw._part_index || 0) || null,
      part_total: Number(raw._part_total || 0) || null,
      root_title: raw._root_title || null,
      root_work_type: raw._root_work_type || null,
      is_own: raw.is_own === true,
      created_at: raw.created_at || null,
      // CSSOS_WAVE_262 20260521 — Jing: 携带"作者"身份, 供媒体框左上角头像
      // 显示作者(而非当前用户) + 关注/DM/打赏对作者生效. 之前这里丢了 owner_*
      // → 切歌后 pipelineState.ownerId 空 → 头像回退到自己 → DM/打赏永远灰.
      owner_id: String(raw.owner_id || raw.owner_user_id || raw.user_id || "").trim() || null,
      owner_name: String(raw.owner_name || "").trim() || null,
      owner_avatar_url: String(raw.owner_avatar_url || "").trim() || null,
    };
  }

  // ─── Source fetchers ────────────────────────────────────────────────
  // CSSOS_WAVE_250 20260520 — Jing: TikTok 式"为你创作"混合队列.
  // 进主界面自动播放: 登录用户先播自己的全部作品(最新→最旧), 播完
  // 无缝接平台精选 feed (/api/works/market); Guest 直接精选. 这样队列
  // 永远有内容连播. 旧的 GET /cssapi/v1/mv 已废弃, 改用 market 端点.
  function flattenWorksTree(works) {
    const flat = [];
    const visit = (w, parent) => {
      if (!w) return;
      // CSSOS_WAVE_1092 — Jing「Next-up 卡显示多部作品」: 拍平时给每个 part 盖上多部上下文
      //   (第几/共几 + root 类型 + root 标题), 让 up-next 卡能显示"三部曲 1/3"等。root 容器
      //   常无媒体被丢弃, 所以信息必须下沉到各 part。
      if (parent && Array.isArray(parent.children) && parent.children.length > 1) {
        const sibs = parent.children;
        w._part_index = sibs.indexOf(w) + 1;
        w._part_total = sibs.length;
        w._root_title = String(parent.title || "").trim();
        w._root_work_type = String(parent.work_type || w.work_type || "").trim();
      }
      flat.push(w);
      if (Array.isArray(w.children)) w.children.forEach((c) => visit(c, w));
    };
    (Array.isArray(works) ? works : []).forEach((w) => visit(w, null));
    return flat;
  }
  function pushUnique(list, have, rawItems, ownFlag) {
    for (const w of rawItems) {
      const it = normaliseItem(ownFlag == null ? w : { ...w, is_own: ownFlag });
      if (it && !have.has(it.id)) {
        list.items.push(it);
        have.add(it.id);
      }
    }
  }
  // CSSOS_WAVE_390 20260524 — Jing QA: the heavy limit=1000 market query can
  // 500 (timeout) under concurrent boot DB load — it succeeds in isolation.
  // Retry transient 5xx/network failures a few times with backoff so a flaky
  // first attempt doesn't leave the For-You queue empty.
  async function fetchWorksWithRetry(url, tries) {
    tries = tries || 3;
    for (let i = 0; i < tries; i += 1) {
      try {
        const r = await fetch(url, { credentials: "include" });
        if (r.ok) return await r.json().catch(() => null);
        if (r.status < 500) return null; // 4xx → don't bother retrying
      } catch (_e) { /* network blip → retry */ }
      await new Promise((res) => setTimeout(res, 400 * (i + 1)));
    }
    return null;
  }

  async function fetchForYou(list) {
    if (list.loading || list.exhausted) return;
    list.loading = true;
    const have = new Set(list.items.map((it) => it.id));
    const loggedIn = !!(globalThis.authState && globalThis.authState.user);
    let anySuccess = false;
    try {
      // 1 · 登录用户: 先放自己的作品 (最新→最旧)
      if (loggedIn) {
        try {
          // CSSOS_WAVE_253 20260520 — Jing: 拉满 (服务端上限 1000), 不要默认
          // 的 20 条 —— 否则队列被截断, loop_all 在末尾早早回头. 要播完
          // 全部可播放作品(normaliseItem 已过滤无媒体的)才按模式回头.
          const p = await fetchWorksWithRetry("/api/works/mine?limit=1000");
          if (p) {
            anySuccess = true;
            const mineFlat = flattenWorksTree(p?.data?.works || p?.works || []);
            mineFlat.sort((a, b) =>
              (Date.parse(String(b?.created_at || "")) || 0) -
              (Date.parse(String(a?.created_at || "")) || 0));
            pushUnique(list, have, mineFlat, true);
          }
        } catch (_e) { /* mine fetch failed — fall through to market */ }
      }
      // 2 · 追加平台精选 feed (所有人), 去重 — 永远有内容连播
      try {
        const p = await fetchWorksWithRetry("/api/works/market?limit=1000");
        if (p) {
          anySuccess = true;
          const mktFlat = flattenWorksTree(p?.data?.works || p?.works || []);
          // market 已按服务端顺序 (热门/最新), 不再二次排序; 仅追加在自己作品之后.
          pushUnique(list, have, mktFlat, null);
        }
      } catch (_e) {}
    } catch (_e) {}
    finally {
      // CSSOS_WAVE_390 — only mark exhausted when a source actually responded.
      // Previously this was set unconditionally, so a transient double-failure
      // pinned the For-You queue EMPTY for the whole session (fetchForYou
      // early-returns when exhausted). Now a flaky boot lets a later trigger retry.
      list.exhausted = anySuccess;
      list.loading = false;
      notify();
    }
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

  // CSSOS_WAVE_822 — Epic 列表取数: /api/works/flagships 已返回【用户个人 Epic 在前 + 平台系统 Epic 在后】,
  // 音轨取 is_default(=epic-render 设的 Epic 轨)→ COALESCE preview_audio_url。仿 Epic 墙顺序连播。
  async function fetchEpic(list) {
    if (list.loading) return;
    list.loading = true;
    try {
      const res = await fetch("/api/works/flagships", { credentials: "include" });
      const payload = await res.json().catch(() => null);
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const have = new Set(list.items.map((it) => it.id));
      for (const w of items) {
        const it = normaliseItem({
          ...w,
          cover_image: w.cover || w.cover_image || w.cover_url,
          audio_track_1_url: w.audio_track_1_url || w.preview_audio_url,
          preview_video_url: w.preview_video_url,
        });
        if (it && !have.has(it.id)) { list.items.push(it); have.add(it.id); }
      }
      list.exhausted = true;
    } catch (_e) {}
    finally { list.loading = false; notify(); }
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
    else if (list.source === "epic") await fetchEpic(list);
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

  // CSSOS_WAVE_1107 20260622 — Jing「单曲循环 升级为 单部循环」: 一首独立歌 = 1 部作品, 多部作品
  //   (三部曲/歌剧/短剧/电视剧/电影)= N 部。当前 item 属于多部作品时, 返回它在列表里【同 root 的
  //   连续部段】范围 [start,end](含)。据此 loop_single 在【整部作品内】从第一集播到最后一集再循环,
  //   绝不中途跳到别的作品 / 被插队。标识同 root 用 root_work_id, 缺失再退回 root_title。
  // CSSOS_WAVE_1113c 20260623 — Jing「单部循环无效, 只循环第一首」根因之一: 原判据要 part_total>1,
  //   但搜索灌进来的 item 常没有 part_total → 退回单曲。改为【纯按同 root 连续判定】, 不依赖 part_total:
  //   root 卡用自身 id, 子部用 root_work_id/parent_work_id → 同一作品的 root+各部 key 一致, 连续≥2 即成"部段"。
  function _groupKey(it) {
    if (!it) return null;
    return String(it.root_work_id || it.parent_work_id || it.id || it.work_id || it.root_title || "").trim() || null;
  }
  function workGroupBounds(list, index) {
    const items = list.items;
    const cur = items[index];
    if (!cur) return null;
    const key = _groupKey(cur);
    if (!key) return null;
    const sameRoot = (it) => _groupKey(it) === key;
    let start = index, end = index;
    while (start - 1 >= 0 && sameRoot(items[start - 1])) start -= 1;
    while (end + 1 < items.length && sameRoot(items[end + 1])) end += 1;
    return end > start ? { start, end } : null;   // ≥2 个同 root 连续 = 多部作品的部段
  }

  function step(direction /* +1 or -1 */) {
    const list = state.lists[state.active];
    if (!list || list.items.length === 0) return null;
    const len = list.items.length;
    const mode = state.mode;
    if (mode === "loop_single") {
      // 单部循环: 多部作品 → 在本部段内循环(第一集→最后一集→回第一集); 独立单曲 → 原地循环。
      const g = workGroupBounds(list, state.index);
      if (g) {
        const span = g.end - g.start + 1;
        const rel = state.index - g.start;
        const nextRel = ((rel + direction) % span + span) % span;   // 在部段内环绕
        state.index = g.start + nextRel;
        return list.items[state.index] || null;
      }
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
      const _prev = state.active;
      state.active = id;
      state.index = 0;
      state.shuffleOrder = [];
      state.shuffleCursor = 0;
      // CSSOS_WAVE_731x — loop_single 曾从【分享单曲会话】(share-link)泄漏到 for-you(551 首)→ 切不了歌。
      // CSSOS_WAVE_1113c 20260623 — Jing「单部循环无效」根因: 原逻辑【任何】切到非 share-link 列表都把
      //   loop_single 还原成 loop_all → 把用户主动选的【单部循环】也误伤了。改为【只在离开 share-link 时】
      //   还原(那才是泄漏源); 用户在 for-you 主动选的 loop_single(=单部循环)予以保留。
      if (state.mode === "loop_single" && id !== "share-link" && _prev === "share-link") {
        state.mode = "loop_all";
      }
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
    // CSSOS_PHASE2_SCOPED_PLAYLIST 20260504 — Jing
    // "请确保这样：从'为你创作'打开作品，那就顺序循环播放'为你创作'
    //  所有的作品；同理，'作品中心'，某个用户的作品中心，也都是这样".
    // Lets the For You / Works Center bindings hand the playlist module
    // the EXACT works array the user is seeing on screen. The list is
    // marked exhausted so no background fetch reorders it. Pair with
    // setActive(listId) + seekTo(clickedWorkId) so the next/prev walk
    // is bounded to the panel the user opened from.
    populate(listId, works) {
      if (!listId || !state.lists[listId]) return false;
      const list = state.lists[listId];
      const seen = new Set();
      const items = [];
      for (const w of (Array.isArray(works) ? works : [])) {
        const it = normaliseItem({ ...w, is_own: list.id === "mine" });
        if (it && !seen.has(it.id)) {
          items.push(it);
          seen.add(it.id);
        }
      }
      list.items = items;
      list.exhausted = true;
      list.loading = false;
      // Reset shuffle permutation so a fresh order is built next time
      // shuffle mode is invoked (avoids stale indices).
      state.shuffleOrder = [];
      state.shuffleCursor = 0;
      notify();
      return true;
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

  // Eagerly start loading builtins so the first nav call has data + the
  // playlist menu shows accurate counts immediately.
  // CSSOS_WAVE_822 — Epic 也预取(轻量 ≤50 条), 否则菜单显示 "⚡ Epic (0)"。
  // 平台系统 Epic(31)总会有; 登录后再 refresh 一次把【个人 Epic】也计入(31+个人)。
  setTimeout(() => {
    void ensureLoaded(state.lists["mine"]);
    void ensureLoaded(state.lists["for-you"]);
    void ensureLoaded(state.lists["epic"]);
  }, 0);
  // 登录态就绪后重取 Epic, 把个人 Epic 计入(首取可能在登录前 → 只拿到系统 31)。
  try {
    setTimeout(() => {
      if (globalThis.authState && globalThis.authState.user) {
        const ep = state.lists["epic"];
        if (ep) { ep.items = []; ep.exhausted = false; void fetchEpic(ep); }
      }
    }, 4000);
  } catch (_e) {}

  globalThis.cssosPlaylists = api;
})();
