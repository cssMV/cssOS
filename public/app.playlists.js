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
      /* CSSOS_WAVE_1970g 20260826 — normaliseItem 是【白名单式】的: 没列进来的字段一律丢掉。
       * 真视频优先排序读的正是这两个字段, 结果排序函数永远拿到 undefined → 三档判定全落到
       * 第 2 档 → 排序等于没做(实测: 列表项 is_real_video_mv 全是 false, 而库里是 t)。
       * 白名单的好处是干净, 代价就是这个 —— 新字段必须记得加进来。 */
      is_real_video_mv: raw.is_real_video_mv === true,
      visual_kind: String(raw.visual_kind || "").trim() || null,
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
    /* CSSOS_WAVE_2089 20260912 — Jing:「请设定置顶的《声声慢三部曲》为默认播放作品。」
     *
     * 为什么之前几轮(W1970e / W1984b)都没成: 那些修法【全都只在 market 这一段内部排序】,
     * 而 For You 的拼装顺序是写死的两段 ——
     *     ① 登录用户自己的作品(/api/works/mine)   ② 平台精选 feed(/api/works/market)
     * 置顶只影响 ②。于是只要是登录用户, 队首永远是他自己最新的真视频作品, 置顶的那首
     * 排在 ① 整段之后, 根本轮不到。改 market 内部的排序再多轮也没用。
     *
     * 修法: 记下 market 段【重排之前】的第一项 —— 服务端已按 COALESCE(pinned_at,
     * admin_pinned_at) DESC 排好, 所以它就是平台置顶的那一首(接口没返回 pin 字段,
     * 只能也【应该】认服务端顺序, 这正是「客户端不要重排服务端顺序」那条)。
     * 最后把它提到整个队列的第 0 位, 排在自己的作品之前。 */
    let _pinnedGroup = [];
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
            /* CSSOS_WAVE_1970h 20260826 — Jing:「用户进入平台, 默认优先播放真视频 MV。」
             * For You 的拼装顺序是【先自己的作品, 再平台精选】, 而自己那段原来只按时间排 ——
             * 于是登录用户永远先播自己最新的作品, 真视频优先在这一段被绕过。
             * 用与市场段【同一套三档判据】, 两段行为一致:
             *   0 显式标记(亲手分镜合成的整片真视频) > 1 老判据认出的视频 > 2 其余
             * 同档内仍是最新优先, 不动 W1885 的结论。 */
            const _tierM = (w) => (w?.is_real_video_mv === true) ? 0
                               : (String(w?.visual_kind || "").toLowerCase() === "video") ? 1 : 2;
            mineFlat.sort((a, b) => {
              const ta = _tierM(a), tb = _tierM(b);
              if (ta !== tb) return ta - tb;
              return (Date.parse(String(b?.created_at || "")) || 0) -
                     (Date.parse(String(a?.created_at || "")) || 0);
            });
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
          /* W2089 — 必须在下面任何 sort 之前取, 否则拿到的就不是服务端的置顶序了。
           * 服务端按 COALESCE(pinned_at, admin_pinned_at) DESC 排, 所以 mktFlat[0] 就是
           * 平台置顶的那一首(接口没返回 pin 字段, 只能也【应该】认服务端顺序)。
           * 取【整组】而不是一个 id: 置顶的是三部曲时, 根节点不在播放列表里(容器无媒体),
           * 只找根的话永远找不到。整组 = 根 + 同 root_work_id 的所有分集。 */
          const _h = mktFlat[0];
          if (_h && _h.id) {
            const _hRoot = String(_h.root_work_id || _h.id || "");
            _pinnedGroup = mktFlat.filter((w) => w && (String(w.id) === String(_h.id)
              || String(w.root_work_id || "") === _hRoot));
          }
          /* CSSOS_WAVE_1885 20260823 —— Jing:「为什么不是从最新到最旧播放?现在的播放顺序是什么?」
           *
           * 旧注释写着"market 已按服务端顺序(热门/最新), 不再二次排序" —— 这个假设是错的。
           * 浏览器实测(623 首队列): 队首是 2026-05-27, 而最新的作品是 2026-08-23, 它被排在
           * 【第 301 位】; 8-19 的在 #389, 7-13 的在 #481。整条队列有 36 个逆序跳变
           * (05-06 → 06-03 → 04-29 → 05-26 …), 因为服务端是按"精选/热门"分组返回的,
           * 组内才有时间序 —— 从来就不是全局最新优先。
           *
           * 于是最新作品要等三百首之后才轮到, 用户观感就是"永远在放那几首老的"。
           * 修法: 追加前按 created_at 全局倒序。这只排 market 这一段, 不动用户自己的作品
           * (那段本来就已倒序, 且必须继续排在最前 —— 自己的新作品优先看到)。 */
          /* CSSOS_WAVE_1970e 20260826 — Jing:「用户进入平台, 默认优先播放真视频 MV。」
           *
           * 服务端(W1970)已经把 is_real_video_mv 排在最前, 但【这一行把它抹掉了】——
           * W1885 当时为了治"最新作品排到第 301 位"加了这次按 created_at 全局倒序,
           * 结果连真视频优先一起重排没了。两条都要: 先真视频, 同组内再最新优先。
           *
           * 判据用 visual_kind === 'video'(市场接口已返回), 不另外造字段。 */
          /* 三档, 不是两档 —— 这一点很关键:
           *   0 显式标记 is_real_video_mv  = 我们【亲手分镜、逐镜生成、合成整片】的真视频 MV
           *   1 visual_kind === 'video'    = 老判据(URL 带 te-trailer / film-)认出来的视频,
           *                                  多半是预告片/片段, 不是整片
           *   2 其余
           * 只分两档的话,「时间的帝国」那几部预告片按老判据也算 video, 且更新 → 压在前面,
           * 于是《李清照》永远轮不到。显式标记必须压过 URL 猜测。 */
          const _tier = (w) => (w?.is_real_video_mv === true) ? 0
                             : (String(w?.visual_kind || "").toLowerCase() === "video") ? 1 : 2;
          /* CSSOS_WAVE_1984b 20260826 — Jing:「设定《声声慢三部曲》为默认播放的三部曲。」
           *   排序修对之后, 三部曲三集确实占据了列表前三位, 但顺序是【倒的】:
           *   怎一个愁字(第三部) → 旧时相识(第二部) → 寻寻觅觅(第一部) ——
           *   因为同档内的 tiebreaker 是 created_at DESC, 而分集正是按 1→2→3 先后生成的。
           *   三部曲必须从第一部开始播, 不是从最后拍完的那部开始。
           *
           *   修法: 同属一部作品(root_work_id 相同)时改用 sequence_index 升序;
           *   跨作品仍旧 created_at DESC —— Jing 的「最新作品优先」是【作品之间】的规则,
           *   不该被推广到【一部作品内部的分集】(这正是我反复犯的"把单向规则对称化")。 */
          const _root = (w) => String(w?.root_work_id || "").trim();
          mktFlat.sort((a, b) => {
            const ta = _tier(a), tb = _tier(b);
            if (ta !== tb) return ta - tb;
            const ra = _root(a), rb = _root(b);
            if (ra && ra === rb) {
              const sa = Number(a?.sequence_index || 0), sb = Number(b?.sequence_index || 0);
              if (sa !== sb) return sa - sb;                       // 同一部作品: 分集正序
            }
            return (Date.parse(String(b?.created_at || "")) || 0) -
                   (Date.parse(String(a?.created_at || "")) || 0);  // 跨作品: 最新优先
          });
          pushUnique(list, have, mktFlat, null);
        }
      } catch (_e) {}
      /* W2089 — 把置顶的那一【组】提到队首(排在"自己的作品"之前)。
       *
       * 两个实测到的坑, 少一个都不成:
       *  ① 三部曲的【根节点不在列表里】—— 容器没有自己的媒体, normaliseItem 把它过滤了。
       *     实测 ssmRootIndex = -1, 所以"按根 id 找位置再提升"一次都不会执行。
       *     → 不能只找根, 要沿服务端顺序找到这一组里【真正能播的】那些。
       *  ② 三部曲在队列里是【倒的】(怎一个愁字 → 旧时相识 → 寻寻觅觅)。
       *     W1984b 的 sequence_index 正序只修了 market 段, 而登录用户这三集是从
       *     "自己的作品"段进来的, 那段只按 tier + created_at 排 → 又倒回去了。
       *     → 提升时按 sequence_index 正序重排这一组, 三部曲从第一部开始播。 */
      if (_pinnedGroup.length) {
        const _want = new Map();
        _pinnedGroup.forEach((w) => { if (w && w.id) _want.set(String(w.id), Number(w.sequence_index || 0)); });
        const _picked = [];
        for (let i = list.items.length - 1; i >= 0; i--) {
          const it = list.items[i];
          if (it && _want.has(String(it.id))) _picked.push(list.items.splice(i, 1)[0]);
        }
        if (_picked.length) {
          _picked.sort((a, b) => (_want.get(String(a.id)) || 0) - (_want.get(String(b.id)) || 0));
          list.items.unshift(..._picked);
        }
      }
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
      // CSSOS_WAVE_1760 — Jing「登录后 loop list 十几首就到头」根因: 不带 limit →
      //   服务端默认只返 20 条(src/index.ts /api/works/mine: `Number(req.query.limit||20)`)
      //   → mine 列表被截成 ~十几首 → loop_all 末尾早早绕回。拉满(服务端上限 1000),与
      //   fetchForYou 的 ?limit=1000 一致(WAVE 253 当年只补了 for-you, 漏了 mine)。
      const res = await fetch("/api/works/mine?limit=1000", { credentials: "include" });
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
  function workGroupBounds(list, index) {
    const items = list.items;
    const cur = items[index];
    if (!cur) return null;
    const key = cur.root_work_id || cur.root_title || null;
    // 仅多部作品(part_total>1 或确有同 root 邻居)才成"部段"; 独立单曲 → null(走真·单曲循环)。
    if (!key || !(Number(cur.part_total) > 1)) return null;
    const sameRoot = (it) => it && (it.root_work_id || it.root_title || null) === key;
    let start = index, end = index;
    while (start - 1 >= 0 && sameRoot(items[start - 1])) start -= 1;
    while (end + 1 < items.length && sameRoot(items[end + 1])) end += 1;
    return end > start ? { start, end } : null;
  }

  /* CSSOS_WAVE_1886 20260823 —— Jing:「不管切歌到哪里了, 标题永远不变, 歌词永远不变,
   * 音乐永远不变, 视频永远不变。为什么切歌不是按照 uuid 切歌的?」
   *
   * ── 根因(浏览器实测锁定) ────────────────────────────────────────────────
   * 平台确实是按 uuid 切歌的 —— 但"换歌"这件事有两半, 只做了一半:
   *   ① 换裸媒体元素(<video>/<audio> 的 src) —— 连播路径做了;
   *   ② 广播"现在是哪一首"(cssos:work-id-changed) —— 连播路径【从来没做】。
   * 全平台有 20 个模块靠 ② 才知道该重绘: app.title-authority(标题) /
   * app.emotion-subtitle-engine(情绪字幕) / app.watch-visual-pills(画面) /
   * app.watch-audio-authority(音频权威) / 弹幕 / 人脸裁切 / 上一首下一首条 …
   * 唯一会广播的是【深链】(app.share-link-router) —— 所以深链打开一首歌一切正常,
   * 自动连播就"标题/歌词/画面/音乐全是上一首的"。同一个 bug 的两张脸。
   *
   * ── 为什么修在这里 ──────────────────────────────────────────────────────
   * step() 是所有切歌路径的【唯一收口】: 自动连播、上下滑、下一首按钮、随机、循环
   * 全部经过它。在这里广播 = 一处修好全部路径, 而不是给每个调用方各打一个补丁。
   * cssosBindToWorkId 内部自带"同一首就不重复广播"的判定, 重复调用是安全的。 */
  function emitSwitch(item) {
    if (!item) return item;
    try {
      if (typeof globalThis.cssosBindToWorkId === "function") {
        globalThis.cssosBindToWorkId(item.id || item.work_id || item, item);
      }
    } catch (_e) {}
    return item;
  }

  function step(direction /* +1 or -1 */) {
    const list = state.lists[state.active];
    if (!list || list.items.length === 0) return null;
    const len = list.items.length;
      /* CSSOS_WAVE_1928 20260824 — Jing:「播放问题一直不解决」实测根因之一。
       *
       * loop_single 是【分享单曲会话】的模式(点开分享链接只循环那一首), 由
       * share-link-router / market-commerce / watch-ui 三处设置。但 mode 是【全局】的,
       * 一旦泄漏到 622 首的 For You 列表, step() 就永远返回当前这首 —— 用户看到的是
       * 「切不动歌、永远播一首」。
       *
       * W731x 修过一次, 但闸装在 setActive() 里 —— 只有【切列表】才还原。实测时活动
       * 列表已经是 for-you, 没人调 setActive, 泄漏进来的 loop_single 永远还原不回来。
       * 闸门装错了位置。
       *
       * 改装在 step() —— 每次翻页都必经的路。判据: 真·单曲会话的标志是列表 id 为
       * share-link, 或列表本来就只有 1 项; 除此之外的多曲列表出现 loop_single 一律
       * 判为泄漏, 就地还原成 loop_all 并持久化(不只是本次绕过, 否则下次又卡)。 */
      if (state.mode === "loop_single" && state.active !== "share-link" && len > 1) {
        try { console.warn("[W1928] loop_single 泄漏到多曲列表(" + state.active + ", " + len + " 首) → 还原 loop_all"); } catch (_e) {}
        state.mode = "loop_all";
        try { persist(); } catch (_e2) {}
      }
    const mode = state.mode;
    if (mode === "loop_single") {
      // 单部循环: 多部作品 → 在本部段内循环(第一集→最后一集→回第一集); 独立单曲 → 原地循环。
      const g = workGroupBounds(list, state.index);
      if (g) {
        const span = g.end - g.start + 1;
        const rel = state.index - g.start;
        const nextRel = ((rel + direction) % span + span) % span;   // 在部段内环绕
        state.index = g.start + nextRel;
        return emitSwitch(list.items[state.index] || null);
      }
      // Stay on current item; force re-render by returning current.
      return emitSwitch(list.items[state.index] || null);
    }
    // CSSOS_WAVE_1187 20260624 — Jing「从 root 播就必须播完整个多部; 从多部的某个枝丫开始播,
    //   就顺着播完整个多部」: 在有序模式(sequential / reverse / loop_all)下, 只要当前 item 属于
    //   多部作品(三部曲/歌剧/短剧/电视剧/电影)且沿 direction 仍在本部段 [start,end] 内 →
    //   先在部段内推进, 保证整部多部作品一次连贯播完, 绝不中途跳到别作品。
    //   只有到了部段边界(最后一部 / 第一部)才落回各模式正常逻辑, 离开本部段。
    //   (shuffle 保持原状: 随机本就无序, 不强行串部段, 避免 shuffleCursor 失同步。)
    if (mode !== "shuffle") {
      const g = workGroupBounds(list, state.index);
      if (g) {
        const within = state.index + direction;
        if (within >= g.start && within <= g.end) {
          state.index = within;
          return emitSwitch(list.items[state.index] || null);
        }
      }
    }
    if (mode === "shuffle") {
      ensureShuffleOrder(list);
      state.shuffleCursor = (state.shuffleCursor + direction + len) % len;
      state.index = state.shuffleOrder[state.shuffleCursor];
      return emitSwitch(list.items[state.index] || null);
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
    return emitSwitch(list.items[state.index] || null);
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
      // CSSOS_WAVE_731x 20260613 — Jing「上滑下滑换不了歌」根因(真机探针: mode=loop_single,
      // len=551): loop_single 是【分享单曲会话】(app.share-link-router setMode("loop_single"))用的,
      // 而 mode 是全局的 → 离开分享、进入多曲列表(for-you 551 首)后它泄漏 → step() 永远返回当前
      // 这首 → 切不了歌。修: 切到【非 share-link 的列表】且当前是 loop_single → 还原为 loop_all
      // (可正常上下滑连播)。真·单曲分享列表(id=share-link)不动。
      if (state.mode === "loop_single" && id !== "share-link") {
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
        /* CSSOS_WAVE_1963 20260825 — Jing:「切歌了好几首, 但是标题一直被扣住不放。」
         * 实测(浏览器现场): seekTo() 之后列表已经在第 0 首, 屏幕标题还挂着上一首。
         *
         * 根因: 切歌【收口】是 emitSwitch() → cssosBindToWorkId() → 派发
         * cssos:work-id-changed, 标题权威(app.title-authority.js)只听这一个事件。
         * step() 每条分支都走 emitSwitch, 唯独 seekTo() 只改 index + notify(),
         * 【没走收口】—— 于是凡是经 seekTo 换的歌, 标题/字幕/画面全收不到通知。
         *
         * seekTo 的调用方不少(连播到尽头回头、点播放列表某一项、CTA 预选、分享链接落地),
         * 所以这一处漏掉等于好几条切歌路一起哑。补上收口即可, 不新增任何机制。 */
        emitSwitch(list.items[idx] || null);
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
    /* CSSOS_WAVE_1864 (Jing:「经常看到 This work is no longer available, 为什么?」) ——
     * 这条提示【和 R2 无关】。它由 market-commerce 在 /api/works/public/:id 返回
     * 404 / WORK_DELETED 时弹出, 意思是"这一项在库里已删除或不可公开", 不是"文件丢了"。
     *
     * 根因在灌列表这一步: 默认列表 "mine" 拉的是 /api/works/mine?limit=1000, 而那个端点
     * 只按 user_id 过滤、【没有任何状态过滤】—— draft / ready / deleted 全都返回。
     * 实测: 已发布可播的只有 135 首, 而播放列表里有 620 项。连播走到那些空壳就弹提示,
     * 于是"经常看到"。作品中心需要看到草稿(那是它的职责), 但【播放列表不需要】。
     *
     * 所以过滤放在这里而不是改 API: 改 API 会让作品中心看不见自己的草稿, 那是另一个功能。
     * 判据只认两件事 —— 没被删, 且确实有可播的媒体。宁可列表短一点, 也不要连播中途撞墙。 */
    populate(listId, works) {
      if (!listId || !state.lists[listId]) return false;
      const list = state.lists[listId];
      const seen = new Set();
      const items = [];
      const playable = (w) => {
        try {
          const st = String(w && w.status || "").toLowerCase();
          if (st === "deleted") return false;
          return !!(w && (w.preview_video_url || w.preview_audio_url || w.final_mv_url
                       || w.audio_track_1_url || w.canonical_mv_url));
        } catch (_e) { return false; }
      };
      let dropped = 0;
      for (const w of (Array.isArray(works) ? works : [])) {
        if (!playable(w)) { dropped++; continue; }
        const it = normaliseItem({ ...w, is_own: list.id === "mine" });
        if (it && !seen.has(it.id)) {
          items.push(it);
          seen.add(it.id);
        }
      }
      if (dropped) { try { console.warn("[playlists] " + listId + ": 过滤掉 " + dropped + " 个不可播项(草稿/未发布/已删除/无媒体), 保留 " + items.length); } catch (_e) {} }
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
