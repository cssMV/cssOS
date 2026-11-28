# cssOS — System Constitution

## 面板宪法 (Panel Constitution)

All panels — static or dynamically injected — are governed by these rules.
Any new panel or modal that bypasses these rules is a constitutional violation.

### Article 1 — Standard controls

Every panel has exactly **three window buttons** and a draggable titlebar:

| Button | Action |
|--------|--------|
| **—** Minimize | Hide the panel body; keep the titlebar visible as a collapsed strip |
| **⤢** Maximize / Restore | Fills the viewport in CSS. Restore returns to the last user-sized floating position. **Does NOT request OS fullscreen** — see the exception below. |
| **×** Close | Collapse panel to its Dock icon (never destroy state) |

Panels are **draggable** (titlebar = handle) and **resizable** from all 8
edges/corners. Both behaviors apply to dynamically injected panels too.

#### Article 1.1 — OS-level fullscreen belongs to the MV panel ALONE (W1876–W1877)

**Only `#watch-panel` (the MV panel) may call `requestFullscreen()`. No other
panel may, ever.**

*Why the MV panel keeps it:* real OS fullscreen is the **only** entry point to
Apple Vision Pro's Immersive Environment. Everything the user came for —
watching, creating, trading, talking — lives inside `#watch-panel`, and
fullscreen renders only the fullscreen element's subtree, so the request must
target the whole panel container (never the bare `<video>`, which would hand
the frame to the system player and throw away our entire DOM layer).

*Why every other panel lost it:* the browser attaches system chrome to any
fullscreen element — a "press ESC to exit" toast on desktop, an undeletable
"Swipe down to exit" banner plus a native ✕ on iOS. A settings or gallery panel
gains nothing from OS fullscreen and pays that cost in full. Pure loss.

Three rules that come with it:

1. **Only inside a real user gesture, and only on explicit maximize.** Opening
   a panel must never auto-request fullscreen (W1861). Guard on
   `navigator.userActivation.isActive` — calling without a gesture both fails
   *and* logs a console error.
2. **iPhone/iPad Safari and the Capacitor app skip the OS request entirely** and
   use the CSS theater state instead — the iOS banner is not removable, so on
   those devices it is never worth it. Desktop and visionOS Safari take the real
   request. (`__cssosIsIOSLike()` in `app.watch-ui.js`.)
3. **Closing or minimizing a panel MUST exit fullscreen if that panel owns the
   fullscreen element** (`app.panel-shell-actions.js`, W1874). Skipping this
   leaves a full-screen black rectangle after the panel is gone.

`cssosEnterPanelFullscreenGeneric()` in `app.panel-layout.js` is kept as a
deliberately **unreferenced** helper. Re-wiring it to any panel re-breaks this
article.

### Article 2 — Screen-boundary clamp

A panel **must never leave the viewport**, including after resize or
orientation change. The titlebar (drag handle) must always remain reachable.
On every drag move and resize, clamp the panel rect to:
```
left  ≥ 0
top   ≥ 0
right  ≤ window.innerWidth
bottom ≤ window.innerHeight  (at minimum, keep titlebar height inside)
```

### Article 3 — Z-index focus order

Whichever panel the user most recently activated (clicked, tapped, or opened)
sits on top. All other panels sit below it in activation order. A single
`zIndexCounter` tracks the global stacking order; each activation increments
it and sets the panel's `z-index`.

### Article 4 — ~~Swipe to switch (multi-panel)~~ 【已作废 · W2016】

🔴 **本条作废(2026-08-28)。左右滑动不再切换面板。**

Jing:「以前我们允许同时打开几个面板, 所以左右滑动用来切换面板; 但现在已经
规定只能单线程, 左右滑动已经失去了应用, 可是这个功能还保留, 导致左右滑动的
时候变成了【退出当前面板】, 特别是 MV 面板。」

**为什么必须废而不是修:** 这条手势的前提是【多面板并存】。前提没有了, 它就不再是
"切换", 而是"把用户正在看的东西划走"。在 MV 面板上尤其致命 —— 用户想左右拖进度或
翻页, 结果整个面板没了。

**实现:** `app.panel-swipe-nav.js` 整模块 early-return 停用(文件保留, 不删)。
选整模块停用而不是在里面加条件, 是因为这个模块从头到尾只干这一件事,
留着一半逻辑等于留一个随时会复活的坑。将来若恢复多面板, 去掉那个 `return` 即可。

**不要因为"宪法里写着"就把它加回来 —— 这一条已经被 Jing 明确取消。**

(原文留档: 当两个或以上面板打开时, 左右滑动在它们之间循环切换焦点。)

#### 补充 · W2139(2026-09-22)——「左右滑动」现在另有所指, **不是这一条复活**

Jing:「在 MV 面板 / Watch 面板观看媒体的时候, 左右滑动或者左右方向键, 是快速媒体前进或者后退。」

于是横向手势**换了一个完全不同的归属**:

| | 作用域 | 行为 |
|---|---|---|
| ~~W445 左右滑动~~ | 整个视口 | ~~切换面板~~ —— **已废, `app.panel-swipe-nav.js` 仍是 early-return** |
| **W2139 左右滑动** | **只在媒体框 `.watch-frame` 上** | 快进 / 快退 ±10s |
| **W2139 ← / →** | Watch 面板可见时 | 快进 / 快退 ±5s |

**两者不是同一件事**: 前者会把用户正在看的东西划走(那正是被废的理由), 后者只动播放位置,
范围仅限媒体框那一个元素。**看到媒体框上有横向手势, 不等于第 4 条回来了 —— 别去"恢复"它。**

键位让位(三方曾抢同一个键, 改动前 ←/→ 归字幕微调):
```
← →        快进/快退 ±5s          (app.mv-keys.js)
Shift+← →  ♪1/♪2 切换             (app.watch-ui.js, 原有, 未动)
Alt+← →    字幕微调 ±0.25s        (app.watch-ui.js, 由裸方向键让出)
Alt+↑ ↓    字幕微调 ∓1.0s
Alt+0      微调归零
↑ ↓        上一首 / 下一首         (原有)
```
快进一律走 `globalThis.cssosSeekBy()` —— 平台四轨分离、视频静音、声音在 `<audio>`,
**只 seek 一个会音画分家**(旧的快进正是只动 video, 等于没按)。

### Article 5 — Quick swipe up = close

A fast upward fling on a panel body triggers **Close** (Article 1 × button).
Velocity threshold: ≥ 400 px/s over ≤ 200 ms.

### Article 6 — Quick swipe down on titlebar = minimize

A fast downward fling **while holding the titlebar** triggers **Minimize**
(Article 1 — button). Same velocity threshold as Article 5.

### Article 7 — Double-tap = panel settings overlay

A double-click / double-tap on the panel body opens a compact **panel
settings popover** (position, size presets, snap-to-grid, opacity). A single
click anywhere outside dismisses it.

### Article 8 — Simultaneous panel limit

**Default: 5 panels maximum.** When the user tries to open a 6th panel,
the least-recently-used (LRU) open panel is automatically minimized to its
titlebar strip. No dialog, no interruption — seamless. The Dock pill bar
shows at a glance how many slots are occupied.

Power users (Studio / Enterprise tier) may raise the limit via panel
settings (Article 7 settings overlay).

*(If Jing explicitly changes this number, update here AND in
`app.panel-manager.js` `PANEL_MAX_OPEN`.)*

### Dock Pill Constitution (Addendum)

The Dock is a **chromatic 凸嵌凹 pill bar** — the same `data-pill-bar`
system as every other tab bar on the platform.

| Dock position | Pill orientation | Notes |
|---|---|---|
| Bottom (default) | Horizontal `data-pill-bar` | Natural fit for the pill geometry |
| Left / Right | Vertical `data-pill-bar` + `flex-direction:column` | Pill bites rotate 90° |
| Top | Horizontal `data-pill-bar` | Mirror of bottom |

**Default = pill mode.** Users may revert to Apple-icon style via Advanced
Settings → Dock → Style. The setting key is `dock.style`: `"pill"` (default)
or `"icon"` (legacy Apple-style). The active Dock item gets `.active` class;
the `data-action` attribute on each `.dock-item` is the pill key.

**Labels:** Each pill may show a short panel title below (or beside) the
icon, controlled by the existing `dock.show_labels` setting. In pill mode
the label is always visible at comfortable size; in icon mode the label
fades on hover (legacy behavior).

**Snap-to-edge with ghost preview:**
The Dock pill bar retains the full 4-edge snap behavior (bottom / left /
right / top). During a drag, when the Dock center crosses within 48 px of
any screen edge, a **snap ghost** appears — a translucent pill-bar-shaped
outline at the *exact* dimensions and position the Dock would occupy if
released. The ghost uses `outline: 2px dashed rgba(0,245,160,0.55)` and
`background: rgba(0,245,160,0.07)`, border-radius matching the pill track.
Releasing inside the snap zone commits; dragging back out dismisses the
ghost. The ghost element id is `#dock-snap-ghost`.

**Direction-aware pill geometry:**
- Bottom / Top: standard horizontal `data-pill-bar`
- Left / Right: `data-pill-bar` + `data-pill-vertical` attribute →
  `flex-direction: column`. The 凸嵌凹 mask geometry rotates 90°:
  active pill bites into above/below neighbors instead of left/right.

**Enforcement:** New dock items added via `ensureDockItem()` must include
`data-action` (already required) — this doubles as the pill key. No extra
markup needed.

**Minimum width + mandatory icon (W490):** Every Dock pill has
`min-width: 120px` (= 3 × the 40px pill height). Short labels must never
shrink to a mis-tap-prone sliver; the floor guarantees a stable tap target,
and `grid 1fr` still expands pills when space allows. Every Dock pill MUST
also carry an icon (emoji or image) as a visual anchor — a label-only pill in
pill mode loses its boundary cue. `ensureDockItem()` injections must include a
leading icon glyph. (Scope: Dock only — this is NOT yet promoted to the
platform-wide `data-pill-bar` constitution; other bars are unchanged.)

**The mic pill is special (W488–W490):** the mic's oversized icon overflows
the track upward (`.dock-mic-icon` negative `translateY` rising into the
track's transparent top headroom — the track is `54px` tall = `40px` capsule
+ `14px` headroom, with the green fill painted by a `linear-gradient` only on
the bottom 40px so no green strip appears above the other pills). The mic
still **participates in 凹凸镶嵌** at both side edges; it only adds
`overflow: visible` + `mask-clip: no-clip` so the vertical pop survives the
side-carving mask. The mic is pinned **first** in `DOCK_FRONT_PINNED` /
`DOCK_DEFAULT_ORDER` and in static HTML so it is already in position 1 on load
(it is the default-active pill, and the active pill moves to first).

---

## 平台视觉签名 (Platform Visual Signatures)

cssOS has two visual signatures that are as recognizable as a logo. Every AI,
contributor, and future wave **MUST** preserve them. Destroying either one —
even accidentally, even "while I'm here" — is a regression equivalent to
removing the brand color.

### Signature 1 — 「流流流」 Streaming UI

The live-generation streaming interface: text, lyrics, subtitles, and MV
frames flow in character by character / frame by frame as the AI generates
them. The sensation of "watching the AI think in real time" is intentional
and irreplaceable. Never replace streaming output with a loader spinner +
final-reveal. The stream IS the product.

### Signature 2 — 随机色凸嵌凹胶囊 (Chromatic 凸嵌凹 Pill Bar)

Every tab switcher, action bar, filter row, and progress strip on the
platform uses the **v28 凸嵌凹 pill constitution**:

- Active pill = full convex pill, saturated with its **own hue**.
- **ALL** inactive pills concave toward active — not just immediate neighbors.
  Every inactive to the RIGHT of active: left side concave (凹向左 = toward active).
  Every inactive to the LEFT of active: right side concave (凹向右 = toward active).
  Adjacent pairs of inactives on the same side also interlock — the "river
  flows toward the island" effect. Use `~` (general sibling), never `+`.
- Each pill gets a **distinct hue** from the 12-step spectrum palette
  (`CSSOS_PILL_HUES = [155,192,235,268,310,342,22,48,82,118,168,210]`).
- The track border + background follows the active pill's hue (`--th`),
  transitioning smoothly on activation.
- One global utility: `cssosMakePillBar(el, opts)` in `app.pill-bar.js`.
  `MutationObserver` auto-stamps every `[data-pill-bar]` in the DOM,
  including dynamically injected popups and modals.

**Enforcement rules for contributors:**

1. Any new tab bar, segmented control, filter row, or parallel-button group
   **MUST** use `data-pill-bar` on the container. No bespoke pill CSS.
2. `data-pill-bar` works on **any** child element type: `<button>`, `<div>`,
   `<span>`, `<input>`, `<select>`, `<label>` — whatever is in the container.
3. For progress strips with equal-width chips (e.g. the 6-stage MV pipeline),
   add `data-pill-equal` to switch to `flex:1 1 0` layout.
4. For panels with a light background, add `data-pill-text="dark"` to the
   container for readable text.
5. `mono:true` option (or `data-pill-mono` attribute) reverts to single
   brand-green — use only when a design explicitly calls for monochrome.
6. **Do NOT** write bespoke tab/pill CSS. If you find yourself writing
   `.some-tab.active { border-radius:999px … }`, stop and use the utility
   instead.
7. **Every pill carries an icon + a minimum width (W497).** When applying
   pill style, any pill whose label has no leading icon **MUST** get one
   (emoji or image) as a visual anchor, and the bar gets
   `min-width = pill-height × 3` (= 120px at the standard 40px height) to keep
   short labels from shrinking to a mis-tap-prone sliver. Read-only DISPLAY
   chips (badges) take the capsule *look* only — never the 凸嵌凹 interlock or
   the min-width (they are not selectable targets). Apply the min-width
   **per-bar** as each bar is migrated, not as a blanket global rule, so an
   already-live bar's layout can't regress unverified. **Reliable way to get
   the 120px floor:** pin the COLUMN floor with
   `grid-auto-columns: minmax(120px, 1fr) !important` on the bar — child
   `min-width:120px` alone is unreliable because `minmax(max-content,1fr)`
   does not fold min-width into max-content, so short labels stay cramped.

The W220.A frozen items (`.creation-tabs`, `.seed-script-tabs`,
`.msrc-tabbar`, `.palette-presets`) are exempt from migration but must not
regress; new components always use `data-pill-bar`.

---

## 画幅铁律 · 21:9 + 转屏不裁切 (W2115 · 2026-09-16 改版)

**Jing 2026-09-16:「铁律要 32:9(2560×720),厂商最宽只给 21:9。那请改变铁律:21:9。」**

| | |
|---|---|
| 生成(构图 + 输出) | **21:9** · `2520×1080`(21/9 = 2.3333 精确) |
| 竖屏设备适配 | **顺时针旋转 90°** 并贴屏 —— **绝不裁切**(此条不变) |
| 旧键 | `32:9` / `superwide` / `2.39:1` / `anamorphic` 全部保留为别名,重映射到 21:9 |

**为什么从 32:9 退回 21:9:** 32:9 **没有任何一家厂商原生支持,最宽只给 21:9**。
于是每一镜生成完都得再做一次外扩(outpaint)才够 32:9 —— 多一道工序、多一层失真,
而且外扩出来的两边本来就不是模型「想画的」内容。**与其为一个厂商给不了的数字硬加工序,
不如把铁律落在厂商的原生上限上。**

**为什么不裁切(此条不变):** 横图裁进竖屏要放大数倍,必然只剩局部 —— 实测结果就是
「一个鼻子特写」。在那个倍率下 `object-position` 怎么调都救不回来:**倍率错了,位置再准也没用**
(W1854 / W1858 / W1893 三次都栽在这里)。旋转则一帧不裁、画面填满。

**W1903 那条取舍已作废(留档,别照着它改回去):** 当时 Jing 在【2.39 转屏更贴】与
【32:9 更有超宽气势】之间选了气势。21:9 = 2.333 转 90° 得 0.4286,手机是 9:19.5 ≈ 0.46 ——
比 32:9 的 0.281 贴得多,**这次改动顺带把竖屏留边也改小了**,两头都好。

**Enforcement:**
1. `CINEMA_LANDSCAPE`(`src/index.ts`)是画幅的**唯一真源**,改画幅只改这一处。
2. 播放端竖屏遇横片源 → **旋转**,不是 `object-fit: contain/cover`
   (`app.watch-face-crop.js`)。
3. **画面不止 `<video>` 一层** —— 幻灯 `.watch-svg`、封面 `.watch-music-art` 必须同样
   处理。只转视频等于只转一半(W1893 的教训)。
4. 生成侧**不再另出竖版**:一次生成 21:9,两端各自贴合。
5. `ASPECT_SIZE_MAP` 里 `32:9` / `2.39:1` / `anamorphic` / `superwide` 这几个键**不要删** ——
   库里和老客户端还在用它们,删了会拿到不受支持的尺寸。

---

## 版本铁律 · 完整的东西只增版本, 不覆盖 (W2061)

**Jing 2026-09-01:「如果是不完整歌词/音乐/画面, 可以覆盖; 但是已经有完整歌词/音乐/画面的,
不应该再覆盖, 而是新起一个版本。因为歌词/音乐/画面(包括封面图/定妆照/幻灯/混合视频/真视频)
都是可以有多种版本的, 这就是我们的多语言胶囊/多声线胶囊/多画面胶囊的宗旨/定义。」**

| 目标现状 | 允许的动作 |
|---|---|
| 半成品 / 空 / 生成失败 | **可以覆盖** —— 它本来就不是成品 |
| **已经完整** | **只准新起版本, 绝不覆盖** |

**适用于全部四条轨, 一视同仁:** 歌词 · 音乐 · 画面(封面图 / 定妆照 / 幻灯 /
混合视频 / 真视频) · 字幕。

**为什么这是宗旨而不是保护措施:** 多语言胶囊、多声线胶囊、多画面胶囊的**定义**
就是「同一部作品并存多个版本」。覆盖旧版等于把胶囊里的格子抹掉 —— **它不是"顺手删了个旧文件",
它是在拆平台的核心结构。**

### 实现上的硬要求: 旧字节必须有自己的地址

**只在数据库里多写一行"旧版"记录是不够的。** W2061 的事故正是这样发生的:
`work_language_tracks` 里明明留了一条 `orig-pre-epic`(专为保住旧版), **但它和新版
指向同一个 R2 key** `artifacts/audio/<workId>/a1.mp3` —— 重生成原地覆盖,
**记录留住了, 字节没留住**, 旧音乐永久消失(R2 未开版本管理 / MV 无音轨 / 无厂商任务号)。

→ 落盘一律走 `uploadAudioNeverOverwrite()` 这类"目标已存在就改写 a1-v2/v3…"的 helper。
→ 新增任何写媒体的路径, **先问「这个 key 会不会已经有东西」**, 不问就是埋雷。

### 代价

《唐伯虎三部曲·春风得意》与《唐伯虎·桃花三部曲·桃花仙》的旧版音乐**已永久丢失**,
Jing 偏爱的旋律和歌词再也拿不回来。**这条铁律是用两首歌换来的。**

---

## 铁律 · 重新生成前必须先问 Jing (W2086 · 17 首旧版音乐换来的)

**Jing 2026-09-10:「为什么这种严重的事故不询问我一下就覆盖掉?以后,任何修改必须征求我的意见。」**

### 事故

2026-08-24 一批重生成,**17 个作品的旧版音乐被原地覆盖,永久丢失**,两周多之后
才被 Jing 逐首发现。包括他最在意的:

```
唐伯虎三部曲 · 春风得意        唐伯虎 · 桃花三部曲 · 桃花仙
唐伯虎 · 桃花三部曲 · 花落花开   李白 · 饮者三部曲 · 举杯邀月
苏东坡·明月三部曲 · 千里共婵娟   长相思 · 风月闲   Jerusalem ×2
Einstein / Archimedes / Athena / Beethoven / Mandela / Tesla / Ra / Ramesses II / Su Shi
```

**不可恢复**,五个地方都查过:R2 是 Unversioned(`ListObjectVersions` 返回 501)、
api-vm 无本地副本、全库没有存厂商任务号的列、journald 只保留到事发后第 5 天、
MV 按四轨分离原则本就不含音轨。

### 三条铁律

**1. 重新生成任何已存在的作品级媒体之前,必须先问 Jing,拿到明确的「yes」。**
   格式:「我打算重新生成 <作品> 的 <歌词/音乐/画面/字幕>,原因 <一句话>。是否同意?(yes/no)」
   **批量重生成尤其要问** —— 这次是一批 17 个,一次没问,一次丢 17 个。

**2. 入库 R2 ≠ 保住旧版。同一个 key 就是原地覆盖。**
   `work_language_tracks` 里留一条 `orig-pre-epic` 记录**不算保住** ——
   这次那 17 条记录全都在,但它们和新版**指向同一个 key**
   `artifacts/audio/<workId>/a1.mp3`,**记录留住了,字节没留住**。

**3. 凡写作品级媒体,一律走 `uploadR2NeverOverwrite()`,禁止直接
   `uploadToR2` / `uploadBufferToR2`。**
   该函数在目标已存在时自动改存 `-v2`/`-v3`,旧字节原样不动。
   **安全的命名是内容哈希**(`aud-<sha>.mp3` / `vid-<sha>.mp4`)—— 不同内容不同地址,
   结构上不可能互相覆盖。**危险的命名是写死的 `<workId>/固定名`。**

### 命名铁律 · 生成的一切内容必须内容哈希命名 (Jing 2026-09-11)

**Jing:「以后都必须哈希命名,避免重名被覆盖掉。」
「不只是音频,而是生成的任何内容,所有内容,都必须使用哈希命名,
跳过那个弱智的固定名字命名法,a1, a2…… 这种不重名都难,太弱智了!」**

| 写法 | 性质 |
|---|---|
| `artifacts/audio/<workId>/a1.mp3` | ❌ **固定名** —— 同一作品重新生成必然落回同一地址 = 原地覆盖 |
| `artifacts/audio/aud-<sha24>.mp3` | ✅ **内容哈希** —— 不同内容必然不同地址,**想覆盖也覆盖不了** |

- 相同内容 → 相同 sha → 写回同一地址,字节一样,**幂等无副作用**(不会产生重复存储)
- 约定沿用平台既有的 `sha1(内容).hex.slice(0,24)`,**不另造一套**
- 统一走 `contentHashKey(buf, dir, prefix, ext)`(`src/index.ts`)

**已全部改为内容哈希:** 作品音频 `aud-` · 封面 `cov-` · 人声/伴奏分离 `voc-`/`ins-` ·
音乐续写 · 视频 `vid-` · MV `epic-`/`canon-`/`film-`。

**存量迁移(2026-09-11):** 23 个写死的 `a1.mp3` 已迁到哈希命名,三张表归零,
实测新地址字节数与原文件一致。**旧文件一个都没删** —— 删字节正是要避免的事。
脚本 `scripts/migrate-a1-to-content-hash.sh`(默认干跑,`--apply` 才真做)。

**尚未改(需连读取侧一起改):** `works/<id>/subtitle-take1.json`。

### 存储形态铁律 · 一律用数组, 不用单值 (Jing 2026-09-10)

**Jing:「歌词/字幕,声线/音轨,画面/视频的存储方式必须是数组,不要用单一的值,
不然很容易被覆盖掉。比如,可以使用 json 文件,然后在 json 里存储多个版本。」**

**「覆盖,就是删掉。」** —— 不是「更新」,不是「替换」,是**删除**。
「有了新版本还能做视频」是**错的想法**:那只是能做**新版本**的视频,
旧版本那一首的视频**永远拍不成了**。

| 轨 | 现在(危险) | 必须改成 |
|---|---|---|
| 歌词 / 字幕 | `user_works.subtitle_take1_json_url` 单值 | 版本数组, 每版一条 |
| 声线 / 音轨 | `work_language_tracks.audio_url` 单值 | 版本数组, 每版自己的 URL |
| 画面 / 视频 | `cover_url` / `mv_url` 单值 | 版本数组, 每版自己的 URL |

**单值字段 = 结构性地只能存一个 = 下一次写入必然删掉上一个。**
再小心的代码也救不了一个只能装一个东西的格子 —— 这是**数据结构**的问题,
不是**纪律**的问题。纪律会松,结构不会。

数组里每一版都要带:自己的 URL、自己的字幕 URL、生成时间、以及**给用户看的版本名**
(多声线胶囊里要让用户认得出哪一版是哪一版)。

### 版本必须是一等公民(Jing 的原话)

「新旧版本允许同时存在,同时保留,**让用户可以在多声线胶囊那里选择新旧版本**,
而不是覆盖掉。」「用户播放旧版本就显示旧版本字幕,新版本就显示新版本字幕。」

→ 一个版本 = `work_language_tracks` 里独立的一行,**有自己的 `audio_url`,
也有自己的 `subtitle_url`**。字幕跟着**所选版本**走,不跟着作品走。
现存的 `orig-pre-epic` 行既共用 URL、`subtitle_url` 又是空的 —— 这就是
「音乐是新版、字幕是旧版」的根因。

### 巡检

「两条轨共用同一个 `audio_url`」必须能被自动发现并报警。
这次没有这种检查,所以 17 首丢了两周多才被人肉逐首发现。

---

## 播放顺序铁律 · 连胞胎与整体不可拆 (W2107 · Jing 2026-09-15)

**Jing:「每一首歌的 ♪1/♪2 是连胞胎, 不可分割; 三部曲也是一个整体, 不允许播放第一部之后
乱插入别的歌曲, 必须是 1, 2, 3 这样连播。歌剧都是, 短剧更加是。」**

### 两条不可打断的绑定

| 单位 | 规则 |
|---|---|
| **一首歌的 ♪1 / ♪2** | **必须连着播完**才允许切到下一首。Suno 一份歌词出两首, 它们是同一首歌的两个版本, 中间插别的 = 把连胞胎劈开 |
| **一部作品的各分部** | 三部曲 / 歌剧(幕·场) / 短剧(集) **必须按 1→2→3 顺序连播完**, 中途不得插入任何其它作品 |

组合起来, 一部三部曲的完整播放列表是 **6 首**, 顺序固定:

```
第一部♪1 → 第一部♪2 → 第二部♪1 → 第二部♪2 → 第三部♪1 → 第三部♪2
```

**唯一允许的插入是【设置好的广告】** —— 除此之外任何"随机下一首""为你推荐"都不得切进来。

### 为什么这是铁律而不是偏好

- **♪1/♪2 是同一份歌词的两次演绎**, 分开播等于把一件作品拆成两件不相干的东西;
  而且我们【已经为两首都付过钱】, 只播一首本身就是浪费(见 W2094)。
- **分部之间有叙事顺序**。短剧尤其致命: 看完第一集突然插进别的内容, 故事就断了。

### 实现上的硬要求

- 队列推进(`step()` / `next()`)必须以【作品组】为单位, 不是以【单曲】为单位。
- 洗牌 / 随机 / 推荐 只能在**组与组之间**生效, **绝不能打散组内顺序**。
- 这与「切不动歌 = loop_single 泄漏」是同一处代码, 改动时一并复核:
  闸门要装在**每次翻页必经**的 `step()`, 装在 `setActive()` 里等于没装。

---

## 文明智能联动 (Civilization Smart Linkage)

These six characters are the **spiritual backbone** of cssOS. When this
principle is not enforced, many sources of chaos sprout. It governs how the
UI locale, the user's explicit language choice, and the person/civilization
context combine to drive up to ~25 MV parameters — music style, lyrics
language, vocal timbre, instrumentation, era cues, etc.

### Two entry paths to the MV panel

**1. Normal path** — logo / mic / play / long-press / keyboard shortcut /
AI assistant prompt → MV panel.

- Lyrics language **follows the UI locale**.
- If the user has explicitly chosen a different language in the language
  panel, that explicit override wins.
- Zero-friction: whatever language the interface is in, that is what the
  user hears back.

**2. Person-MV path** — clicking a person card → MV panel.

- Lyrics language **MUST follow the person's mother tongue**, derived from
  `person.civilization`.
- This is **independent of** the UI locale and **independent of** any
  language the user has selected.
- Implementation: `civToLanguageModule(civilization)` (frontend,
  `app.civilization-language.js`, W196) and `civToLanguageServer(civ)`
  (backend, `src/index.ts`, W197).

### Scope

文明智能联动 is not only about lyrics language. It propagates civilization
context into music style, instrumentation, era, vocal characteristics and
other MV parameters. Lyrics language is the most visible facet; the rest
must stay coherent with it.

### Enforcement rule for contributors

Any new MV entry path, AI prompt, or auto-generation flow MUST decide
which of the two paths above it belongs to and route language/civilization
accordingly. Defaulting to "whatever string is in the textbox" is not
acceptable.

---

## Pricing & subscription constitution (W219)

### Two-layer billing — never mix them

1. **Subscription = ACCESS / capabilities only.**
   Decides what a user *can do* (length cap, seats, lossless, API, etc.)
   and *how fast* (queue lane, concurrency). Never decides *how much*
   they can output. There is **no monthly generation quota** on any
   tier; `monthlyGenerationLimit` is hardcoded `null` and any legacy
   gate that reads it is intentionally inert.

2. **Output = pay-as-you-go from wallet.**
   `user_credits.balance` is stored in **integer cents USD** and
   debited by the EXACT cents the third-party engine bills us
   (`estimateEngineCostCents` → `debitCredits`). Staff exempt via
   `isCssosAdminEmail`. Pre-flight balance gate refuses the call
   *before* burning any vendor money.

### Tier matrix (single source of truth — Apple IAP catalog)

**W1448 pricing reset (Jing).** Studio Annual anchored at **$999.99**
(the prior $1000 entry triggered an Apple Guideline 3 review hold).
Annual = monthly × 10 (~17% off), all `.99` endings. **Enterprise tier
RETIRED as a purchasable SKU** — removed from the IAP catalog, the
`tierPriceCents` ladder, and the frontend plan modal. (Enterprise
*capability gates* in `membershipPolicyForTier` and the tier-permission
arrays are intentionally left intact for grandfathered access and a
separate capability-layer wave; only its PRICE/purchase surfaces are gone.)

| Tier | Monthly | Annual (monthly × 10) |
|---|---|---|
| free | $0 | — |
| starter | $9.99 | $99.99 |
| pro | $29.99 | $299.99 |
| studio | $99.99 | $999.99 |
| contact | $999+ (custom) | — |

Stripe `tierPriceCents` and any future Alipay/WeChat/NihaoPay
integration MUST mirror these exact amounts. **Apple ASC, the backend
`IAP_PRODUCT_CATALOG`, `scripts/iap-sync.mjs`, `tierPriceCents`, and the
frontend plan modal must all stay identical — consistency across surfaces
is the hard rule (Jing), independent of the absolute price.** rust-api's
`membership_tier_plan` copy is retired (W219.5); do not re-sync.

### Capability axes (per `membershipPolicyForTier`)

`maxOutputLengthSeconds` · `fullLengthBonusOdds` · `seats` ·
`concurrentJobs` · `cloudStorageBytes` · `workRetentionDays` ·
`canExportLossless` · `canRemoveWatermark` · `canCustomWatermark` ·
`canSellWorks` · `canTakeCommissions` · `platformCutBps` ·
`canReceiveTips` · `canUseApi` · `canUseWebhooks` · `canSelfHost` ·
`canForcePremiumProvider` · `canUpscale4k` · `queueLane` ·
`supportResponseHours` · `hasDedicatedSupportChannel` ·
`uptimeSlaPercent`.

Key rules:
- **Free**: 60s cap, 1 concurrent, marketplace ❌ (no white-label sales).
- **Starter**: 3min, marketplace ✅ (first paid step).
- **Pro**: 8min (full song length), lossless WAV/FLAC ✅, **1% full-length bonus**.
- **Studio**: 10min, 4K upscale, API access, 10 seats, 500GB.
- **Enterprise**: 10min, 30 seats, 2TB, 99.5% SLA, custom watermark.
- **Contact** ($999+): private deployment, negotiated cut, dedicated CSM.

### Wallet rules

- Top-up: Stripe Checkout / Apple IAP credit packs (shared
  `IAP_PRODUCT_CATALOG` SKUs).
- Withdraw: $20 minimum, 2 weeks payout (Stripe Connect), KYC at
  $600/yr cumulative (1099-K line). Only user-deposited funds are
  withdrawable; bonus / refund credits stay in the wallet.
- Anti-fraud: same-card top-up → withdraw within 30 days delayed.
- Cancelling subscription **never** clears the wallet.

### What `/api/premium/*` does now

The legacy single-tier "Premium" subscription ($9.99/mo on Stripe;
¥69/mo on Alipay/WeChat; $9.99 on NihaoPay) is **retired**:
- `POST /api/premium/subscribe` → 410 Gone + migration hint.
- `POST /api/premium/subscribe-cn` → 410 Gone (Alipay/WeChat coming
  back on the unified tier system in W219.3).
- `GET /api/premium/providers` → empty `providers: []` + `deprecated: true`.
- Existing `users.premium_until` rows are honored until they expire;
  no force-cancel. New subscriptions go through `/api/billing/checkout`.

---

## ⚠️ MUSIC STYLE block — HARD-LOCK (Jing red-line)

**Touching this without an explicit Jing message naming this block by
name is a red-line violation.** Jing has called this out explicitly,
repeatedly, and at the limit of patience. Any AI / collaborator must:

1. NOT modify any of the following without prior authorization:
   - `.creation-tabs` (Genre / Mood / Instrument / Ambience / Vocal Gender)
   - `.creation-chips` (Chinese GuFeng / Pop / Rock / Classical / ...)
   - `#creation-style-input` and its surrounding label/row
   - `#creation-style-count`
   - any wave 28 step file or section referencing these selectors
2. Before any change, send a confirmation request like:
   "I plan to change <selector> by <one-line summary>. Authorize? (yes/no)"
3. Wait for an explicit "yes" before shipping. No "while I'm here"
   bundling, no consistency passes, no auto-extension.

If a CSS pass needs to "consolidate" rules and that pass touches any
of the above selectors, ABORT the pass and ask Jing first.

This rule exists because the block has been "completed" multiple times
and silently regressed by AI overreach. The cost is paid by Jing's
evenings. The fix is a process boundary, not a code constraint.

---

## W220.A pill wave — PERMANENTLY FROZEN

The following components and their CSS / JS are **frozen as of v28
step 34**. No AI, no future wave, no "polish pass" touches them
without an EXPLICIT instruction from Jing naming the exact change:

- `.creation-tabs` + `.creation-tab` (Genre/Mood/Instrument/Ambience/Vocal Gender)
- `.creation-chips` + `.creation-chip` (Chinese GuFeng / Hip Hop / ...)
- `.seed-script-tabs` (Custom Lyrics / Music Source Uploads, Music Structure / Video Outline / Section Scene Prompts)
- `.msrc-tabbar` + `.msrc-tab` (Audio / Video / MIDI / MusicXML / Sheet music / Image)
- `.palette-presets` (Emerald / Crimson / Azure / Violet / Gold)
- `.palette-color-tabs` + `.palette-color-card` (BG color pills)
- Single-pill action bars `#random-palette` / `#apply-settings` / `#creation-clear`
- The v28 constitution rules at the end of `public/style.css`

If a bug appears in one of these, fix THAT bug minimally; do not
"normalize" or "consolidate" the others. If a new tab/pill bar joins
the system, IT adopts the constitution — the existing frozen set is
not touched to match it.

## AI working-discipline rule (W220.A — added the hard way)

Jing should NOT have to re-inspect the codebase after every turn to
check whether I touched something I wasn't asked to. That's a tax
on his time, and it's mine to eliminate. Four hard rules:

1. **No-instruction = no action.** Even when the screen "obviously
   needs one more thing", even when style is "obviously inconsistent",
   even when a related component "would clearly benefit" — I do not
   touch it. Consistency / completeness is Jing's call, not mine.

2. **Want to touch something not in this turn's instruction → ASK
   FIRST.** Format: "I see X in <file:line>, do you want me to also Y?"
   Ship only after explicit yes. No silent "while I'm here" edits.

3. **Instruction scope == change scope.** If Jing says "change A",
   I only modify A. If I find B is broken or stale next to A, I
   surface it at the end of the response ("by the way, B at <path>
   looks like Z — want a separate wave?") — I do not fix it inline.

4. **回滚 / rollback == pure undo.** Revert the named step. Do not
   bundle in "what I think you really meant" alongside the revert.

Every violation of these in the W220.A pill saga cost 20-30 minutes
of Jing's evening to detect + unwind. Treating the freeze boundary
and the instruction scope as inviolable is faster for both of us.

When in doubt → ASK, don't ship.

---

## Tab-pill constitution (W220.A)

cssOS has exactly **one** visual language for tab/pill switchers across
every panel. Authors MUST pick one of these two modes when adding a new
tab group; never invent a third look.

### Mode 1 — Fixed segmented (equal columns, all visible)

For switchers with a small, fixed number of options (typically **2-4**,
always all on-screen, no scroll).

```html
<div data-segmented="3">
  <button class="active">Tab A</button>
  <button>Tab B</button>
  <button>Tab C</button>
</div>
```

`data-segmented` accepts `"2"`, `"3"`, `"4"`, `"5"`. The container
becomes a grid of N equal-width segments; the active child fills with
brand green. Apple-Safari style.

### Mode 2 — Flex pill-bar (horizontal scroll)

For switchers with **unknown** or **many** options (5+), or dynamically
filled. Same green-tinted background, but children flex + scroll.

```html
<div class="cssmv-pill-bar">
  <button class="active">First</button>
  <button>Second</button>
  ... (any number) ...
</div>
```

### Shared visual rules — "rounded side flows away from active"

Every child segment is visible (light green fill). The ACTIVE pill
has BOTH sides rounded (full pill). Every INACTIVE has only ONE side
rounded — the side pointing **AWAY** from the active pill:

- Inactives **LEFT** of active → **left** side rounded
- Inactives **RIGHT** of active → **right** side rounded

So no matter where the active sits in the row, the rounded corners
flow outward toward both ends of the container, like a "river forking
around an island". The active pill is the only one with a complete
pill silhouette.

Implementation: CSS sibling combinators + `:has()`.
- `.active ~ *` → all siblings AFTER active → right-rounded
- `*:has(~ .active)` → all siblings BEFORE active → left-rounded
- `.active` → `border-radius: 999px !important` (full pill)

> **注脚 · W2192(2026-09-25)——上面这三行【只在一条轨恰好有一个 active 时成立】。**
>
> 原文一个字未改(这里是 W220.A 冻结区, 描述的是 Mode 1/2 的旧回退写法)。
> 补这条注脚只是为了别让人照着这三行去写新的胶囊条。
>
> 「all siblings AFTER active」这句话按字面写成 `.active ~ *`, 会把**排在后面的
> 另一个 active 也算进去**。一条轨只有一个 active 时两者完全等价, 所以这个缺陷
> 藏了很久; 一旦一条轨里有多个 active(`#watch-language-pill` 正是如此: 模式头 +
> 当前语言 + 当前声线 + 当前 ♪, 四组共轨、轮流显示), 后面那几个 active 就会被当成
> 「未激活」而左移 20px 压住邻居 —— 屏幕上看起来是**同一个胶囊印了两遍**。
>
> **要写新胶囊条, 一律照下面 v28 那段带 `:not(.active)` 的 CSS, 不要照这三行。**
> 本节描述的 `.creation-tabs` / `.seed-script-tabs` / `.msrc-tabbar` /
> `.palette-presets` 都是单 active 轨, 不受影响, **故不改它们**。

Fallback for `:has()`-less browsers: `:first-child` outer-left and
`:last-child` outer-right, middles flat. Works for the common 2-3
tab case; degraded but acceptable on older Safari < 15.4.

| Container property | Value |
|---|---|
| Background | `transparent` (the children carry the fill) |
| Border | `1px solid rgba(0, 245, 160, 0.30)` |
| Border radius | `999px` (long pill) |
| Padding | `0` |
| Gap between children | `0` (segments touch each other) |
| Min-height | `40px` |

| Child property | Inactive | Active |
|---|---|---|
| Background | `rgba(0, 245, 160, 0.08)` | `rgba(0, 245, 160, 0.32)` |
| Border | `0` | `0` |
| Border radius | position-based (see above) | `999px` (full) |
| Padding | `6px 16px` | `6px 16px` |
| Font weight | `inherit` | `600` |
| Hover | `rgba(0, 245, 160, 0.14)` darker preview | n/a |

EVOLUTION OF MISTAKES (kept for context):
- v1: each child a separate pill, head-to-head (WRONG)
- v2: sleeve + filled sibling, both with shapes (WRONG)
- v3: long sleeve + active thumb, inactives transparent (WRONG — user
  couldn't see segment boundaries)
- v4: all segments visible, outer-rounded only, active full-rounded
  pops out (WRONG — still head-to-head visually, not interlocked)
- v5–v23: many failed attempts at concave bites (WRONG — geometry off)
- v24: convex+convex with -20px shift (WRONG — still 凸顶凸, not 凸嵌凹)
- v27: TRUE 凸嵌凹 via mask-image. Active = full pill; every inactive
  extends 20px toward active (`margin: -20px; width: calc(100% + 20px)`)
  and carries a `mask-image: radial-gradient(circle 20px at <inner-edge>,
  transparent 19.5px, #000 20px)` that carves a concave bite matching
  active's convex curve. Hover bg auto-fills the masked shape.
- **v28 (current, LOCKED — do not change):** v27 geometry +
  every pill carries a 1px `rgba(0, 245, 160, 0.30)` border on its
  CONVEX side(s). Active = both left+right 1px borders. Inactive
  right-of-active = own right (convex) 1px border, left (concave) masked.
  Inactive left-of-active = own left (convex) 1px border, right (concave)
  masked. The concave-side border is automatically clipped by mask-image
  so the 凸嵌凹 seam stays one continuous shared curve. Required: pill
  `height: 40px` (mask radius = 20px = border-radius cap). Browser
  support: Safari 15+, Chrome 120+ (needs `:has()`).

  **COMPLETE v28 CSS — copy verbatim when adding any new pill bar:**
  ```css
  /* Active pill — 凸 full pill */
  [data-pill-bar] > [data-pill-key].active {
    border-radius: 999px !important;
    z-index: 2 !important;
    -webkit-mask-image: none !important;
    mask-image: none !important;
  }
  /* ALL inactives RIGHT of active — 凹 left, 凸 right (~ not +, :not(.active) 必须有) */
  [data-pill-bar] > [data-pill-key].active ~ [data-pill-key]:not(.active) {
    border-radius: 0 999px 999px 0 !important;
    margin-left: -20px !important;
    width: calc(100% + 20px) !important;
    padding-left: 36px !important;
    z-index: 0 !important;
    border-right: 1px solid hsla(var(--ph,155),100%,65%,0.32) !important;
    -webkit-mask-image: radial-gradient(circle 20px at 0px 50%, transparent 19.5px, #000 20px) !important;
    mask-image:         radial-gradient(circle 20px at 0px 50%, transparent 19.5px, #000 20px) !important;
  }
  /* ALL inactives LEFT of active — 凸 left, 凹 right (~ not +, :not(.active) 必须有) */
  [data-pill-bar] > [data-pill-key]:not(.active):has(~ [data-pill-key].active) {
    border-radius: 999px 0 0 999px !important;
    margin-right: -20px !important;
    width: calc(100% + 20px) !important;
    padding-right: 36px !important;
    z-index: 0 !important;
    border-left: 1px solid hsla(var(--ph,155),100%,65%,0.32) !important;
    -webkit-mask-image: radial-gradient(circle 20px at 100% 50%, transparent 19.5px, #000 20px) !important;
    mask-image:         radial-gradient(circle 20px at 100% 50%, transparent 19.5px, #000 20px) !important;
  }
  ```
  **Key geometry (never get this wrong again):**
  - Mask center `at 0px 50%` = element's LEFT edge midpoint. Active pill's
    right convex arc center is also at that exact point → perfect 凸凹吻合.
  - Mask center `at 100% 50%` = element's RIGHT edge midpoint → same logic
    for left-side inactives.
  - `margin-left/right: -20px` + `width: calc(100%+20px)` cancel out on
    the far edge; each pill only "steals" 20px from its neighbor — no
    cumulative drift in flex/grid layout.
  - `~` (general sibling) is **mandatory** — `+` (adjacent only) breaks
    凹凸镶嵌 between non-adjacent inactive pills. This was the W466 lesson.
  - **`:not(.active)` 同样是强制的 —— 这是 W2192 的教训。**
    这两条规则的原话是「ALL **inactive** pills concave toward active」,
    可选择器原来没把 active 自己排除掉。**一条轨只有一个 active 时两种写法完全等价**
    (后面的兄弟本来就都不是 active), 所以这个缺陷藏了很久。
    出事的是【一条轨里有多个 active】的情况 —— `#watch-language-pill` 正是这样:
    模式头(Languages/Voices/Visuals/Takes)+ 当前语言 + 当前声线 + 当前 ♪,
    四个 active 共处一条轨(各组轮流显示, 这是设计)。于是排在后面的那几个 active
    也匹配上「active 右边」, 各自吃到 `margin-left:-20px` + `padding-left:36px`
    → 整个胶囊左移压住左邻居、自己的标签被推到右边, 屏幕上看起来就是
    **同一个胶囊印了两遍**(一半是被压住的邻居, 一半是移过去的自己)。
  - **左侧那条在实现里不是 `:has()`。** `app.pill-bar.js` 的 `ensureStyle` 防崩策略
    会把含 `:has()` 的整条规则剥掉(WebKit 崩溃), 所以真正生效的是 JS 打的
    `.cssos-pill-pre` 类(见 `markPre()`)。**照这份文档改左侧时, 必须同时改 `markPre()`
    —— 只改 CSS 会漏掉一半**(W2192 就差点这样漏掉)。

  **Dock-specific extra (text labels inside pills):**
  Wrap label text in `<span>` — the rule `[data-pill-key] > span { font-size: 11px }`
  only shrinks text inside `<span>`. Dynamically injected dock items that
  omit the `<span>` will show oversized text (W466 known issue for Person MV).

  **WHY the convex-side 1px border exists (UX hard constraint, not
  decoration):** on a hover-less or hover-ambiguous bar, without that
  visible thin green line between adjacent inactives a user CANNOT see
  where one pill ends and the next begins. The hover bg fills the whole
  pill — including its 20px convex bulge — and users would discover the
  pill boundary only AFTER clicking. The 1px convex-side border is a
  **click-boundary preview**: it tells the user "this is one pill;
  cross this line and you'll hit the next one." Removing it (even when
  it "looks cleaner") breaks click predictability and is a regression.
  This rule has equal constitutional weight to the 凸嵌凹 mask geometry.

  **No-active state rule:** when a bar has zero `.active` children,
  every pill gets a 1px convex right border too (`:last-child` excepted
  — the track's own right edge serves as its boundary). The bar is
  always "click-boundary previewable" whether or not anything is
  selected yet.

  **第一个胶囊默认激活 (First pill default active):** any pill track that
  has no preset `.active` gets its **first pill** activated by default —
  this provides the convex 凸 anchor island so the existing 凸嵌凹 interlock
  (`.active~` / `.cssos-pill-pre`) forms automatically and the whole strip
  reads as one seamless carved bar. Without an anchor, a zero-selected bar
  degrades into free-floating full-oval pills with gaps between them (the
  "飘椭圆" regression). Never fix that by adding new pill CSS — just default
  the first pill active. Works together with "选中谁→谁到第一个位置" (the
  selected pill becomes the island / moves to first, per the Dock rule).
  For a multi-select track, the default-active first pill is a **visual
  anchor only** — it must not toggle any underlying selection/checkbox, and
  the synthetic active must be cleared before every re-paint so it can yield
  to a real selection once the user picks one.

  **"No default ≠ disabled" rule:** when a bar opens with no pre-selected
  pill, all pills MUST remain clickable from a cold state. In particular,
  if the JS state holds an `activeTab` value for chip-catalog lookup
  while the DOM is suppressing the `.active` class (waiting for first
  user interaction), the click handler MUST force a re-sync even when
  the clicked key already equals `activeTab` — otherwise the first
  click on the pre-seeded tab is a no-op (DOM dedupes on equality).
  Pattern: bump the view-state cache to a sentinel before re-render,
  e.g. `viewState.activeTab = "__force_resync__"`.

RIGHT v6 — rounded side flows away from active:

```
Tab A active (pos 1 of 3):
( A ) B ) C )
  ↑     ↑   ↑
  both  right-rounded only (rightward flow)

Tab B active (pos 2 of 3):
( A ( B ) C )
  ↑   ↑   ↑
  left  both  right

Tab C active (pos 3 of 3):
( A ( B ( C )
  ↑   ↑   ↑
  left  left  both

Tab D active (pos 4 of 9):
( A ( B ( C ( D ) E ) F ) G ) H ) I )
                ↑   ↑   ↑   ↑   ↑   ↑
                both  all-right-rounded (rightward flow)
                                  ↑
                 leftward inactives all left-rounded
```

Convention: `(` marks left-rounded edge, `)` marks right-rounded
edge. Every inactive shows only ONE marker — the one pointing AWAY
from the active pill. The active pill shows both `(` and `)`.

### What is NOT a tab-pill switcher (do not apply)

- **Progress strips** — e.g. MV PIPELINE 6 stage chips carry per-stage
  hue + breathing + %; their CONTAINER aligns, their children must
  diverge.
- **Display chips** — `.price-chip`, `.report-stat-chip` etc. are
  read-only data badges, not switchers.
- **Color cards** — `.palette-color-card` holds a label + color input,
  it's a control not a tab.
- **Number-input rows** — Default Listen / Buyout Price etc. are
  parallel fields, not mutually-exclusive choices.

### Migration policy

When changing an existing tab group: add `data-segmented="N"` or
`.cssmv-pill-bar` to the container. The constitution CSS will override
legacy per-child rules (via the legacy neutraliser in style.css). Do
NOT rip out old per-child rules even when they look redundant — other
sites may still reference them.

---

## English is the single source of truth

- All UI strings are authored in English in the source tree.
- Other locales are produced by the W210 lazy LLM translation pipeline
  (`tr("English")` → cache → Claude Sonnet 4.5 batch translate, cached at
  `/srv/cssos/shared/i18n-cache/<locale>.json`).
- **Never** hardcode Chinese (or any non-English) literals in markup or
  JS. Use `data-i18n="..."` on DOM or `tr("English")` in JS.
- `loginCopy(en, _zhIgnoredLegacy)` ignores its second arg and routes to
  `tr(en)`.

---

## 🔒 媒体框宪法 · 散发绿色光芒边框 —— 【W1983 定稿 · 已锁 · 不得再改】

**Jing 2026-08-26 明确确认:「确认。就要这版,以后不得再改,再改我就草泥马十八代祖宗。
马上订成宪法:媒体框散发绿色光芒边框,把参数定下来,写下来,记下来,不要再改。」**

这是**唯一合法**的媒体框观感,写在 `public/style.watch.css` 文件末尾。
**逐字定稿如下,任何一个数值都不许动:**

```css
.watch-screen::after {
  content: "";
  position: absolute;
  display: none;
  inset: var(--mv-ring-top, 2px) var(--mv-ring-right, 2px)
         var(--mv-ring-bottom, 2px) var(--mv-ring-left, 2px);
  border-radius: 0;
  padding: 0;
  background: none;
  animation: none;
  -webkit-mask: none;
  mask: none;
  -webkit-mask-composite: initial;
  mask-composite: initial;
  box-shadow:
    0 0 14px rgba(0, 245, 160, 0.34),
    0 0 38px rgba(0, 245, 160, 0.22),
    0 0 78px rgba(11, 247, 255, 0.12),
    inset 0 0 22px rgba(0, 245, 160, 0.13);
  pointer-events: none;
  z-index: 2;
}
.watch-screen[data-mv-ring="1"]::after { display: block; }
```

### 五条不可动摇的性质(改任何一条 = 违宪)

| 性质 | 定稿值 | 为什么 |
|---|---|---|
| **没有实心绿带** | `background:none` `padding:0` `mask:none` | 「太绿」的唯一来源就是原版那条 4px 实边(渐变 + content-box mask 挖出来的)。**整条必须不存在。** |
| **只有辉光** | 向外 `14 / 38 / 78px` 三层 + 向内 `inset 22px` | Jing 要的是「**散发**绿色光芒」,不是「绿色边框」。光是渗出来的,不是画出来的。 |
| **直角** | `border-radius: 0` | Jing 反复说过不要圆角。 |
| **贴画面矩形** | `--mv-ring-*`(`app.watch-face-crop.js` 实测写入) | 贴 21:9 画面走,不贴窗口走。没量到画面(`data-mv-ring` 缺失)就**不画**。 |
| **MV 面板外圈保持取消** | `#watch-panel.panel.flow::after{content:none}` 等 | 里面有光芒 / 外面干净。两件事,分开管。 |

### 红线

1. **任何改动都必须先拿到 Jing 明确的「yes」。** 格式:「我打算改媒体框光芒的 <哪个值>,
   原因 <一句话>。是否同意?(yes/no)」**没有 yes 就不动。**
2. 不接受「顺手」「保持一致」「看着不对」「重构时捎带」「优化一下」。
3. **会波及它的改动同样受限** —— 动 `.watch-screen` / `.watch-frame` 的定位尺寸、
   动 `app.watch-face-crop.js` 的 `syncRingToMedia()`、动 CSS 加载顺序、
   新增可能覆盖 `.watch-screen::after` 的规则。发现会波及,**先停下来问**。
4. `style.css:7265` 那份旧 `::after`(2px + 16/36px)**已死**,被 `style.watch.css`
   末尾这条覆盖。**不要再去改那份**,改了屏幕上纹丝不动。

### 这条宪法的代价(别再付第二次)

W1959→W1983,**十几轮返工、两个整晚**。根因两条,都在我身上:

1. **我一直在改被覆盖掉的那条规则。** 三条 `.watch-screen::before` 里,
   `style.watch.css` 加载最后、赢下级联;我连改三轮 `style.css:7241`,
   Jing 屏幕上纹丝不动,只能一次次截图问「你当我眼瞎吗」。
   **→ 改样式前,先 `getComputedStyle` 量出真正生效的声明,再去找是谁写的。**
2. **我在 W1960 的注释里写了「声明与平台原有那圈逐字一致」—— 那句是假的。**
   实际敲进去的是我自己捏的 `padding:2px` + `0 0 16px/36px`,而原版是
   `4px` + `22/52/72px` 三层。**又细又弱 → 渲染成一条硬绿线,不是一团光芒。**
   Jing 每次说「像,但不是」「你又重新造一个」,指的就是这个差;
   而我每次都去改 z-index / inset / 圆角,**方向全错 —— 差的从来不是位置,是数值。**
   那句假注释让后面十几轮排查全部信错了前提。
   **→ 搬平台已有视觉,只准 `git show <commit>:<file>` 整块复制,禁止手敲近似值;
   写「与原版一致」之前,先 `diff` 一遍再写。**

**另:「A 保留 B 取消」先查它们是不是同一个元素在画。** 原版那圈从 `08588b9` 到
`c2909b1` 一个字符没变过,它靠的是 `.watch-screen` 的双重身份 —— 窗口态 = 画面
(媒体框光芒),影院/最大化态被拉成满窗 716×863(MV 外框描边)。**同一条规则,两个身份**,
这才是「保留就两个一起保留、取消就两个一起取消」的真正原因。W1983 已彻底拆开:
光芒归 `::after`(贴画面),外框归 `.panel.flow::after`(已取消)。

---

## 边框宪法 · 媒体框留光芒 / MV 框取消描边 (W1960)

**Jing 2026-08-25:「媒体框，保留绿色光芒边框；MV边框，取消绿色描边。」
「一个保留，一个取消。你为什么总是保留就两个一起保留，取消就两个一起取消？」**

### 真相:从头到尾只有一圈,不是两圈

`.watch-screen::before` **一个元素同时扮演两个角色** —— 因为 `.watch-screen`
在不同状态下是不同的东西:

| 状态 | `.watch-screen` 是什么 | 那圈画在哪 | Jing 看到的 |
|---|---|---|---|
| 窗口态 | = 画面 | 贴着画面 | **媒体框光芒 → 保留** |
| 影院 / 最大化 | 被拉成**整个窗口**(实测 716×863 = 满窗) | 贴着窗口 | **「MV 面板描边」→ 取消** |

**这就是「保留就两个一起保留、取消就两个一起取消」的真正原因** —— 它本来就是
同一个东西。我一整晚以为在找两个元素,所以怎么关都不对。

**定案写法(按状态分开,已验收):**

```css
/* 影院/最大化态: 只清绘制, 保留元素 —— is-live-border / is-waiting 画在同一个 ::before 上 */
#watch-panel.maximized .watch-screen::before,
#watch-panel.is-cssmv-fullscreen .watch-screen::before,
body.cssos-cinema-mode .watch-screen::before,
html.cssos-app .watch-screen::before {
  background: none !important;
  box-shadow: none !important;
}
```

另外 `#watch-panel.panel.flow::after { content: none; }` 关掉 `.panel.flow::after`
(`inset:4px` 的 1px 绿边 + `0 0 28px` 绿辉光),写法照抄它上面 8 行已有的
`.logo-panel.panel.flow::after`。

**窗口态那圈 `.watch-screen::before` 的声明一个字不许改**(`style.watch.css` ~240,
自 `08588b9` 起从未变过)。

**W1960 定案(Jing 验收通过):窗口态画面有绿色光芒 ✅ / 影院态窗口边缘无绿色描边 ✅**

**测状态必须真的切换状态:** 落地页 `body` 常挂 `cssos-cinema-mode`、面板常挂
`is-cssmv-fullscreen`,所谓"窗口态"其实还是影院态。不剥掉这些类去量,
得到的结论是假的(我因此误判过一次"两个态都被关掉了")。


### 红线 —— 改动必须先征得 Jing 同意

这两个框**任何改动都必须先问 Jing 并拿到明确「同意」才能动手**,格式:
「我打算改 <哪一个框> 的 <什么>,原因 <一句话>。是否同意?(yes/no)」。
**没有 yes 就不动。** 不接受「顺手」「保持一致」「看着不对」「重构时捎带」。

也包括**看似无关的改动会波及它们**的情况 —— 例如动 `.watch-screen` / `.watch-frame`
的定位尺寸、动 `app.watch-face-crop.js`、动加载顺序、新增会盖住它们的 CSS。
发现会波及,**先停下来问**。

### 我错了六轮,根因只有一句:我从来没去找过那段代码

Jing 从第一句就说「**找回来,不要重新造**」。我每一轮嘴上答应,手上都在**自己写**:

1. 新建 `.watch-media-ring` 元素
2. 把声明"抄"进新写的 `::after`
3. 自己把三层柔光简写成 `16px 绿 + 36px 青` → **柔光塌成亮绿细线**
4. 自己写 `border-radius: 14px` → 画面上多出圆角
5. 用 `--mv-ring-*` 变量搬 `inset`,以为这叫"只改位置"
6. 一路把**媒体框那圈**(要保留的)越改越坏,而**MV 那圈**(要删的)纹丝不动

**六次都不是复用。抄一份就是造一份。** 真相是那段代码从诞生(`08588b9`)起就没变过,
`grep` 一次就能找到 —— 我花了一整晚才去 grep。

**根子上的思维错误:** 看到截图,我的第一反应是「我来想个办法做出这个效果」,
而不是「这个效果的代码在哪里」。**前者是造,后者才是找。**

### 三条硬规矩(这一晚换来的)

1. **先找再动。** 要复现平台已有的观感,第一步永远是 `grep` 出那段代码,
   **不是**打开编辑器写。写出来的第一行就已经错了。
2. **"抄声明"不等于"复用"。** 换了盒子、换了尺寸,`background-size:360%` 的采样点
   和辉光扩散全跟着变。真复用 = 用回**同一个元素 / 同一条规则**。
3. **"A 留 B 删"先查它们是不是同一个元素。** **多数情况下它们本来就是两个东西**
   (W1960 正是),根本不用拆。先分清各自是谁,别急着动手。

### 附:改样式前先确认哪条规则最终生效

共有三条 `.watch-screen::before`。真正生效的是 `style.watch.css` 那条 ——
它加载在 `style.css` 之后,把 `style.css:7241` 整个盖掉。我连改三轮被盖住的那条,
Jing 屏幕上纹丝不动,只能一次次截图问「你当我眼瞎吗」。
**先 `getComputedStyle` 量出真正生效的声明,再去找是谁写的。**

### 成本认知

这件事本身极简单 —— 一个留、一个删,两行 CSS。被我做成六轮返工 + 一整晚,
Jing 反复截图、反复解释、直到发火。**代价不在代码,在他的时间和情绪。**
先 grep 一次只要十秒。

---

## 🔒 进度条宪法 · 由实渐虚的色带 —— 【W2376 定稿 · W2377 补锁换色渐变 · 已锁 · 不得再改】

**Jing 2026-11-23:「绝对完美，进度条的参数请存为铁律，以后不再更改。」**

真源 `public/app.watch-stage-bars.js`。**逐字定稿如下,任何一个数值都不许动:**

```js
const BAND_PX  = 11;      // 色带宽度(从屏幕边往画面里)
const BAND_A0  = 1.0;     // 贴边那头: 全实
const BAND_A1  = 0.34;    // 中段(38% 处)
```

```
背景  linear-gradient(沿长度)   = 条子自己的全部色标(彩虹照常流动)
遮罩  linear-gradient(往画面里) = rgba(0,0,0,1) 0% → rgba(0,0,0,0.34) 38% → rgba(0,0,0,0) 100%
描边  .cssmv-trail { opacity: 0 !important; }   ← 原来那条 5px 实心线【不再画出来】
```

### 五条不可动摇的性质(改任何一条 = 违宪)

| 性质 | 定稿 | 为什么 |
|---|---|---|
| **只有一条带, 没有线** | `.cssmv-trail` opacity 0 | 只要那条 5px 实心描边还画出来, 带子再怎么渐变, 眼睛先看到的都是那条硬边。Jing 四次说「还是硬边」指的就是它。 |
| **垂直由实渐虚** | mask `1.0 → 0.34(38%) → 0` | 「渐变式/散发式」= CSS 的 linear-gradient, **不是发光**。见下面的代价。 |
| **不要太长** | `BAND_PX = 11` | 46 → 22 → 11, Jing 逐版看过才定的。 |
| **左右走 + 颜色流动不变** | 背景沿长度取全部色标 | Jing:「进度条是在从左向右移动, 颜色也在不断随机变化」—— 这两件**本来就是对的**, 只许动垂直方向。 |
| **零 filter / 零离屏面** | 一个背景 + 一个 mask | W2345 那 80MB 不许回来。 |

#### 补充 · W2377(2026-11-28)——【换阶段的色相渐变】同样已锁

**Jing 2026-11-28:「突然变另一种颜色, 有点唐突…能否渐变式地变过去?」→ 做出来看过 →
「请把它写进宪法锁起来。」** 真源 `public/app.watch-stage-bars.js`:

```js
const HUE_TWEEN_MS = 900;   // 换阶段的色相渐变时长(Jing 定)
const TWEEN_FPS_MS = 50;    // ≈20fps 节流
// 走法: 色相环【最短弧】+ easeInOutSine; 闸只装在 advanceRotation()
```

**先分清两件事, 别又搞混:**

| | 是什么 | 状态 |
|---|---|---|
| 沿长度的彩虹流动 | SMIL 平移渐变, `HUE_FLOW_MS = 1800` | **本来就连续, 从来没毛病**(即上表「左右走+颜色流动不变」) |
| **换阶段的基色切换** | 每 `ROTATION_MS`(5s)跳到下一阶段的种子 | **W2377 之前是瞬时硬跳, 现在是 900ms 渐变** |

唐突的一直是后者: 各阶段种子隔得很远(`320→145→210→290→36→0`),
`applyStageHue` 把 6 个 `<stop>` 整组瞬时重写 → 基色一次跳 100~180 度。

**四条不可动摇:**

1. **最短弧是强制的。** `36 → 0` 若不取短弧会绕 324° 把整条彩虹扫一遍 —— 比原来的跳色更难看。
2. **闸只装 `advanceRotation()`** —— 那是唯一的「换阶段」入口。装进 `applyStageHue`
   会把开场第一帧和强制重绘也变成渐变。
3. **开场不渐变。** `state.liveHue == null`(还没画过)时直接落位。
4. **两处防内存账单, 不许省:** 色相**取一位小数**(否则每帧写 15 位浮点串,
   且 `_applyGlowShadow` 的去重 key 永远不相等 = 去重闸等于没装);
   `stopRotation()` 里 **`cancelHueTween()`**(自己续命的 rAF 留在后台 = 下一个内存账单)。

**内存: 零增加(已实测, 不是推断)。** 同页面状态、控制变量对比「补间中 vs 补间间隙」:
`surface_mb` 中位同为 37、范围同为 37–43、色带元素数同为 4 —— 四项全同。
道理: 不新增元素/图层/滤镜/离屏面, 写的还是原来那 6 个 `stop-color` 和
4 个 `backgroundImage`, 只是值不同。**上表「零 filter / 零离屏面」不受影响。**

线上实测 `290 → 36` 的轨迹(14 步 ~840ms, 相邻最大跨度 **12.3°**, 原为一次 106°):
`291.2 295.3 300.7 309.3 319.6 331.2 343.5 355.8 7.2 17.7 25.8 31.9 35.3 36`

**改 `HUE_TWEEN_MS` 同样受下面红线约束 —— 要先拿 Jing 的 yes。**

### `.cssmv-trail` 元素【不删, 只是不画】

它还有两个不可替代的作用:
1. 进度的唯一真源 —— 全文件 11 处往它身上写 `stroke-dasharray`;
2. 闸门装在它的 `setAttribute` 上(W2345), **色带正是被它驱动的**。

**删元素 = 色带再也不会动。** 所以只能是「看不见」, 不能是「不存在」。

### 红线

1. **任何改动都必须先拿到 Jing 明确的「yes」。** 格式:「我打算改进度条的 <哪个值>,
   原因 <一句话>。是否同意?(yes/no)」**没有 yes 就不动。**
2. 不接受「顺手」「保持一致」「看着不对」「重构时捎带」「优化一下」。
3. 会波及它的改动同样受限 —— 动 `computeGeometry()` / 动 `paintGlowEdges()` /
   动 `trail.setAttribute` 那个闸门 / 新增会盖住 `.cssmv-glow-edge` 的规则 /
   **动 `applyStageHue()` · `advanceRotation()` · `tweenStageHue()` ·
   `_applyGlowShadow()` 的去重 key · `STAGE_HUE` 的种子值**(W2377)。
   发现会波及, **先停下来问**。

### 这条宪法的代价(六版返工, 别再付第二次)

W2345 孪生一条 → W2369 叠三条 → W2371 想叠十六环 → W2372 换 box-shadow →
W2373 调淡度 → W2374 才终于用上 linear-gradient。

**根因一句话: 我把「渐变」听成了「发光」。**
Jing 从头到尾说的都是「渐变式/散发式/由实渐虚的色带」—— 在 CSS 里那就是
`linear-gradient`, 一头有色一头透明, 天生连续、没有层、不耗内存。
而我一路在给那条线「加光」, 叠描边叠了四版。**描边天生带硬边缘, 叠 N 条就是 N 道边,
叠到十六条也还是十六道。** Jing 每次都数得出来(「三层」「四层了?」「一层套一层」),
而我每次的回应都是再叠一层。

**两条教训:**
- **用户说的词可能就是字面意思。** 「渐变」= gradient, 不是比喻。先按字面试一次最直接的工具,
  再去想复杂的。
- **查「写了没生效」必须读元素的【内联 style 原文】。** W2375 第一版屏幕上是一块实心彩虹,
  看着像「Safari 不支持 mask」, 实际是我用两次 replace 改同一行、把 `const BAND_A0` 的
  声明整行换成了注释 → 构造遮罩字符串时抛 ReferenceError, **抛出点恰好夹在「写完背景」
  和「写遮罩」之间**, 于是背景照常上色、遮罩永远不上。
  computed 显示 `none` 分不清是「没写」还是「写了没生效」, 这两者修法完全相反。

---

## 🔒 影院态顶栏与贴边宪法 —— 【W2214/W2215 定稿 · 已锁 · 不得再动】

**Jing 2026-09-26:「请把今天的这种状态保持，最好入宪，不要再动。今天的状态，
现在的状态，我觉得是完美了。不要再动了。」**

### 一、顶栏一行(返回 ‹ / 搜索框 / 三点 ⋯)

三者**中心对齐在同一行**,行锚是**唯一真源**:

```css
/* public/style.watch.css 末尾 —— 以下为【逐字照抄】, 改这里先改文件再同步本段 */
#watch-panel.maximized {
  --cssos-mv-toprow-center: 30px;
}
#watch-panel.maximized #cssos-watch-backbtn,
#watch-panel.maximized #watch-exit-cinema {
  top: calc(var(--cssos-mv-toprow-center) - 20px) !important;   /* 两个都是 40px 圆 */
}
#watch-panel.maximized #watch-search-box {
  top: calc(var(--cssos-mv-toprow-center) - 21px) !important;   /* 42px 高 */
}
```

| 不可动的性质 | 定稿值 | 为什么 |
|---|---|---|
| **一个行锚,三个控件全从它算** | `--cssos-mv-toprow-center: 30px` | 改之前这三个挂在**四个不同的锚**上(`top:10` / `safe+14` / `notch-clear+2` / `safe+4`),中心 y 是 20/32/34/41。Jing 截图里那一幅「一高一低」就是它。 |
| **减各自半高对齐【中心】** | 圆 −20 / 框 −21 | 高度不同,**设同一个 `top` 看起来仍然不齐**。 |
| **不带 `safe-area` / `notch-clear`** | 纯 px | Flagship 也不带。带了就在刘海机上被 `max(safe, 50px)` 推到 Flagship 下面 —— **那正是要修的毛病本身**。 |
| **30px = Flagship(10..30)的下沿** | 行 9..51 与它顶边齐平并重叠 | Jing:「和左上角的 flagship 重叠的高度」「和旗舰标志一样高」。 |
| **`#cssos-mv-flagship-badge` 的 `top:10px`** | 不许改 | 行锚是**照着它**定的。动它 = 动整行。 |

### 二、贴边一律 8px 【W2378 2026-11-23 起 · 原 10px 已作废】

**Jing 2026-11-23:「MV面板, 所有靠边的物件, 距离边框(屏幕边缘)必须参照苹果底部
Home 指示条靠边的距离 —— 苹果 Home 指示条距离多远, 我们的物件就要距离多远。」**

**这个数是【量出来的】, 不是查来的。** 拿 Jing 自己那张 iPhone 截图(924×2000,
对应 390×844pt 机型), 扫底部中轴亮度:

| | 图上像素 | 换算 |
|---|---|---|
| Home 指示条**离底边** | 18px | **7.6pt → 取 8** |
| 指示条自身高度 | 11px | 4.6pt ≈ 苹果公开的 5pt —— **佐证换算没错** |

量两个值而不是一个, 是因为只量一个无法判断换算系数对不对。

**全部真源(改一处不改另一处 = 两端对不齐):**

| 件 | 真源 |
|---|---|
| 右侧栏 / 返回 ‹ | `app.watch-social-rail.js` |
| ⚜ Flagship | `app.flagship-badges.js` |
| 搜索框 / 右上 ⋯(网页端) | `app.watch-search.js` |
| 右上 ⋯(App 端) | `style.css` 的 `html.cssos-app` 覆盖 ⚠ **与上一行是同一个值的两处写法** |
| 搜索框让位 58px | `style.css`(= 8 边距 + 40 按钮 + 10 间隙, 跟着边距走, **不是贴边值**) |
| 顶栏行锚 28px | `style.watch.css` 的 `--cssos-mv-toprow-center`(= Flagship `top:8` + 高 20) |
| 横屏画布内的贴边 | `app.mv-chrome-landscape.js` 的 `INSET` **以及 ITEMS 里几个写死的 `padY`** |

⚠ **最后一行是真踩过的坑:** 只改 `INSET` 不改 ITEMS 里那四个写死的 `padY`,
结果是别的件贴边 8、顶栏四件还停在 10 —— 差 2px, 肉眼几乎看不出, 但就是不齐。
**改贴边值必须把「写死的派生值」一起找出来。**

三样仍然不跟着变(与原 W2215 同):
`env(safe-area-inset-*)` / `--cssos-notch-clear`(管刘海与 home 条, 不是边距)·
AI FAB 叠在 Dock 上的 `+62px` 层距 · 用户拖过的 AI ＋ 位置(W1776)。

**Dock 与全局 AI FAB 仍是 10px** —— Jing 这条说的是「MV 面板」, 而影院态 Dock 本就
`display:none`, 不会和 MV 的 8px 同屏打架。将来若要统一, 先问。

(以下为原 W2215 的 10px 记述, 留档。)

### 二之旧 · 贴边一律 10px(已被上条取代)

凡贴屏幕边的悬浮 chrome,边距**一律 10px**(改前是 12/13/14/20/24 **五种**值):

`#cssos-watch-social-rail`(右侧栏)· `#cssos-rail-ai`(跟随右侧栏)·
`#cssos-agent-fab`(AI 全局)· `#dock`(四边)· `#cssos-watch-backbtn` ·
`#watch-exit-cinema` · `#cssos-mv-flagship-badge`

**三样不跟着变 —— 它们不是「贴边」:**

1. `env(safe-area-inset-*)` / `--cssos-notch-clear` 那一项**原样保留**(只把地板数字降到 10)。
   它管刘海与 home 条,不是边距。
2. AI FAB 叠在 Dock 之上的 **`+62px` 层距**不动 —— 它站在 Dock 头上,不是自己贴边。
3. **用户拖过的 AI ＋ 位置仍归用户**(`applyRailAiPos`, W1776)—— 导演铁律:用户干预 > 系统默认。

**坑:一个贴边值可能写在两个地方。** `#watch-exit-cinema` 的 `right` 同时存在于
`app.watch-search.js` 的 **JS 内联**(网页端生效,没有 `!important` 压它)和 `style.css` 的
**`html.cssos-app` 覆盖**(App 端生效)。只改一处 → 另一端实测仍是旧值(W2215 第一版就这么漏了)。
**改完必须两端各量一次。**

搜索框的 `left/right: 60px` **不是**贴边值,不要改成 10 —— 它 = `10 边距 + 40 按钮 + 10 间隙`,
正好给返回键和三点让位。

#### 补充 · W2370(2026-11-23)——【媒体转横屏时, 这一行跟着转】已获 Jing 明确同意

Jing 2026-11-23:「顶栏那四件，情绪字幕的中央爆/飘字层，转过来，以横屏显示。」

这是本条红线要求的那个 yes, 已拿到。于是当 `#watch-panel[data-media-rotated="1"]`
(画面按画幅铁律转了 90°)时, 这四件 ——
`#cssos-watch-backbtn` · `#watch-search-box` · `#watch-exit-cinema` ·
`#cssos-mv-flagship-badge` —— 一并转进那块横幅画布
(`app.mv-chrome-landscape.js`)。

**本节那组数值一个都没有被改。** 搬的是【同一组关系】, 不是重排:

| 本节锁的 | 搬进画布后 |
|---|---|
| 行锚 30px, 各减半高对齐中心 | 画布顶起 30px, 返回/⋯ padY 10(40 高→中心 30)· 搜索框 padY 9(42 高→中心 30) |
| 贴边一律 10px | 画布内仍 10px |
| 搜索框 left/right 60px | 画布内仍 60(= 10 + 40 + 10) |
| Flagship `top:10px` 是行锚的依据 | padY 10 → 占 10..30, 关系不变 |

竖屏(画面没转)时**这四件原样不动**, 本节描述的一切照旧 —— 判据只有
`data-media-rotated` 一个, 由 `app.watch-face-crop.js` 写(画幅铁律的唯一真源),
**不要在别处再判一次方向**。

同批一起转的还有: 右侧栏 · `#cssos-watch-bottomflow`(传统字幕/价格行/胶囊条都在里面)·
`#cssmv-mv-title` · 弹幕块 · 情绪字幕的 `#cssfx-center-burst` 与 `#cssfx-spark`。
`#cssfx-flash-overlay`(整屏闪白)**刻意没转** —— 它是均匀色洗, 转成 100vh×100vw
反而盖不满竖屏视口。

还原: index.html 删掉 `app.mv-chrome-landscape.js` 那一行。

### 三、两件【刻意保留】的事 —— 不是待修的 bug

**Jing 明确说过「不,请保留现状」。谁把它们当 bug 去修,就是违宪。**

1. **顶栏那一行压住顶边 seek 带的 10–16px 那一段。**
   W2205 给了影院态四边 seek(判据 `_BP = 16`),顶栏这一行落在 9..51,于是 10–16 归了顶栏。
   这是 Jing 在【三件对齐 Flagship】与【顶边整条可 seek】之间**做过的选择**。
   0–10px 仍归 seek,左右下三条边完整。
2. **影院态搜索框仍受 10s 空闲淡出**(index.html 的 CHROME 系统 + W296/W849 既有行为)。
   鼠标一动就回来;`/` 键(W2207)可随时强制唤出。
   *(W2264 2026-11-01:右轨 🔍 那一格已按 Jing 要求删除 —— 「播放器右侧栏等=右下角的
   搜索按钮,请删除掉」。唤出逻辑 `summon()` 一个字没动,只是少了一个入口。
   **别照着 W2208 的旧注释把它加回来。**)*

### 四、今天这一轮的其余定稿(一并锁)

- **三个老引擎面板已删**(歌词 W2209 / 音乐·视频 W2210):删的是**窗口壳与一切打开入口**;
  `#lyrics` `#lyric-flow` `#*-progress*` `#waveform` `#storyboard` 等**数据面原样留在
  `#*-engine-surface`(hidden)里** —— 它们是生成流程真在读写的东西,删了不报错,只会**静默改行为**。
- **`.toast` 无条件 `pointer-events: none`**(W2213)。它是常驻节点、空闲时 `opacity:0`
  却照样吃点击,曾固定吃掉顶边带一段。**看不见却挡点击,最难查。**
- **App Store 横幅整条都是关闭热区**(W2214),× 保留作可见线索。横幅 `top` 回到 12px
  (W2212 已按 Jing 要求回滚,纯撤销)。

### 红线

1. **本条任何改动都必须先拿到 Jing 明确的「yes」。** 格式:
   「我打算改 <哪一项> 的 <什么>,原因 <一句话>。是否同意?(yes/no)」**没有 yes 就不动。**
2. 不接受「顺手」「保持一致」「看着不对」「重构时捎带」「优化一下」。
   **尤其不接受把第三节那两件当 bug 顺手"修好"。**
3. **会波及它的改动同样受限** —— 动 `_BP` 的值、动 CHROME 空闲系统、动
   `.watch-screen`/`.watch-frame` 的定位、给这些控件新叠 `!important` 覆盖块。
   发现会波及,**先停下来问**。
4. 改边距**只改各自的真源**,不要新叠覆盖规则 —— 同一个值两个地方写,下一个人必定改错那一个。

### 回归

`scripts/test-uniform-edge-10px.mjs`(贴边 10px + 三样不跟着变)·
`scripts/test-cinema-search-restored.mjs`(顶栏行锚 + 横幅点哪都能关 + toast 不吃点击)·
`scripts/test-lyrics-panel-removed.mjs`(三个面板删干净 + 数据面没丢)。
三份都带 `CALIBRATE=1` 校准(读 git HEAD 必须失败),改动前先跑一遍。

---

## 🔒 无歌声时的字幕宪法 · 音符 + 四方飘入 emoji —— 【W2217 定稿 · 不得再回来】

**Jing 2026-09-26:「后来我们已经改为没有歌声只有纯音乐的时候使用随机音符表示了,
不再是文字提示。这个文字提示还是偶尔出现,请查找这句提示词,删掉,保留现在的状态。」
「也入宪吧,别再回来。」**

### 一、没有歌声的那一刻,这一行归谁

| 层 | 显示什么 | 真源 |
|---|---|---|
| 传统字幕 | **一簇随机音符** `♪ ♫ ♬ ♩ 🎵 🎶`(3–6 个,不同字形 + 6 情绪色循环 + 随机错位起点) | `app.emotion-subtitle-engine.js` 的 `[Music...]` cue(`_isMusicLine` 分支,W745 / W1109) |
| 情绪字幕 | **小 emoji 从四条边向内飘进**(`0上 1右 2下 3左`,密度跟音量走 `nn = 1 + round(vol*6)`) | `app.emotion-fx.js` 的 `cssosMusicGapPulse`(W721 #6) |

**不是文字提示。** 这一行在没有歌声时**已经有主**,任何"等待中/生成中"的文案都不许来抢。

### 二、为什么那句提示是「偶尔」出现 —— 它其实精确得很

`safeSetWatchSubtitleModule` 在 `cssosKaraokeOwnsSubtitle()` 为真时**直接 return**。
也就是说:**只要有歌声在咬字,状态文案根本写不进去。**
它能冒出来的唯一场合,恰恰就是【没有歌声】的那一刻
(最常见入口:`app.watch-audio.js` 里 `currentWatchAudioSourceKind === "none"` 且字幕为空时
回调 `syncWatchSubtitleForWaitingMediaModule`)。

**所以它不是随机的 —— 它是精确地只在音符该接手的时候抢了那一行。**
正确做法是**什么都不写**,把这一行让出来;**不是再补一句别的文案。**

### 三、光不写还不够:绿带没人收

状态文案会被 `app.watch-media-layout-p2100.js` 的 **status-split** 搬进
`#watch-status-info`(画面上那条绿带)。那边 `maybeRedirect` 的注释写着
「*Subtitle was cleared — also clear status if it was showing*」,**但那一支只 `return`,并没有清。**
于是它在一次会话里出现过一次,就**一直挂在画面上**。

清除走 `globalThis.cssosClearWatchStatusInfo()`(W2217 暴露,复用 status-split 自己的
`setStatus`)。**不要另写一份清除逻辑,也不要去改 `maybeRedirect` 那个全局分支** ——
改它会波及生成中的状态显示。

### 四、留着的 · 删掉的

**留着(真·生成状态,与本条无关):**
`KaraOKe MV · Painting the cover now`(连封面都还没有时)·`Composing music now`·
`Rendering video now`·`Rendering subtitle MV now`,以及 status-split 检测名单里的
`/Writing the first line/i`(兜底:万一旧缓存里还有人产出它,至少不落进 `#watch-subtitle`)。

**删掉且不得回来:** `KaraOKe MV · Writing the first line now`。

### 红线

1. **不许把这句加回来,也不许在【没有歌声】那一刻写任何文字提示。**
2. **新增任何"等待中 / 生成中"文案前,先问一句:它会不会落在【没有歌声】的那一刻?**
   会 → 就不该写文字,让给音符。判断方法:看它会不会在
   `cssosKaraokeOwnsSubtitle()` 为假时被写进 `#watch-subtitle`。
3. 随机音符(`_noteGlyphs` / `[Music...]` cue)与四方飘入 emoji(`cssosMusicGapPulse`)
   **任何改动都必须先拿到 Jing 明确的「yes」**,格式:
   「我打算改 <哪一项> 的 <什么>,原因 <一句话>。是否同意?(yes/no)」**没有 yes 就不动。**
4. 会波及它们的改动同样受限 —— 动 `safeSetWatchSubtitleModule` 的 karaoke 守卫、
   动 status-split、动 `syncWatchSubtitleForWaitingMediaModule` 的分支。
   发现会波及,**先停下来问**。

### 回归

`scripts/test-no-first-line-hint.mjs` —— 两头都判:这句必须不再被产出;
音符与四方飘入 emoji 那条路必须原样还在。带 `CALIBRATE=1` 校准(读 git HEAD 必须失败)。
