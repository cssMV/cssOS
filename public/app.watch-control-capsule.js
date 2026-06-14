/* CSSOS_WAVE_387 20260524 — Jing「胶囊宪法」
 *
 * 把散落在媒体框【左下角】(🔂循环模式 + For You来源 + ⋯) 和【右下角】
 * (✦风格 / 1×倍速 / ⟳循环 / ⊞画中画 / 🎤分轨 / i信息 / ⛶全屏) 的一堆独立角标
 * 控件, 整合成【右下角的一个胶囊】。
 *
 *   • 胶囊里只留几个关键、常用的: [🔂循环+来源] [1×倍速] [✦风格] [⛶全屏] [⋯]
 *   • 其余的统统收进 ⋯ 菜单(画中画/AirPlay/投屏/静音/下载/分享/收藏/作品信息/
 *     人声分轨——这些原本就在 ⋯ 菜单里或已由 app.watch-ui.js 补进去)。
 *   • 移除【右侧重复的 ⟳ 循环按钮】(左侧 🔂 循环模式已覆盖单曲/列表/关闭)。
 *
 * 做法: 直接【搬移】已存在的按钮 DOM 节点(保留其全部事件与各模块的幂等守卫——
 * 这些守卫都用 screen.querySelector('.cssmv-*') 递归查找, 节点仍在 .watch-screen
 * 子树内, 故不会被重建); 冗余按钮用 CSS display:none 隐藏(仍留在 DOM 里, 这样
 * ⋯ 菜单项 .click() 它们时逻辑照常、模块守卫也照常通过)。让用户在干净的画面里
 * 安心欣赏 MV。 */
(function () {
  "use strict";
  if (window.__cssosWatchCapsuleInstalled) return;
  window.__cssosWatchCapsuleInstalled = true;

  // CSSOS_WAVE_565 — i18n 文案 + 图标/标签注入。
  function lc(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    try {
      var l = String(document.documentElement.lang || navigator.language || "").toLowerCase();
      return l.indexOf("zh") === 0 ? zh : en;
    } catch (_e) { return en; }
  }
  function labelIconSeg(el, icon, label) {
    if (!el) return;
    if (el.dataset.cssosSeg === "1") {
      // 已注入: 只刷新标签(切语言时)。
      var lb = el.querySelector(".cssmv-seg-label");
      if (lb && lb.textContent !== label) lb.textContent = label;
      return;
    }
    el.dataset.cssosSeg = "1";
    el.innerHTML = "";
    var ico = document.createElement("span"); ico.className = "cssmv-seg-ico"; ico.textContent = icon;
    var lbl = document.createElement("span"); lbl.className = "cssmv-seg-label"; lbl.textContent = label;
    el.appendChild(ico); el.appendChild(lbl);
  }

  var STYLE_ID = "cssmv-capsule-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = [
      // The one capsule — bottom-right, glass pill, auto-hides with the chrome.
      // CSSOS_WAVE_397 20260524 — Jing: 抬到 bottom:110px(与右下角 AI 助理 fab 同高),
      // 不再和 Dock/home-indicator 打架; 左下角。默认可见, 显/隐节奏跟 Dock 走(下方
      // cssmv-cinema 规则), 不再依赖桌面 :hover(触屏无 hover)。
      "#watch-panel .watch-screen .cssmv-capsule{",
      // CSSOS_WAVE_427 20260525 — Jing「AI 助理和左下胶囊条要在同一行」根因: fab 的
      // bottom = calc(safe-area + 110px), 而胶囊条只写了 110px(没加 safe-area)→ 真机上
      // (safe-area≈34px)fab 比胶囊条高出一截, 不对称。统一用同一 safe-area+110 基线,
      // 再上抬 8px 让胶囊中线与更高的 fab 圆中线齐平 → 真正同一行。
      "  position:absolute;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 110px);z-index:26;",
      "  transform:translateY(-8px);",
      // CSSOS_WAVE_558 — 头顶头: gap:0, 无外内边距; 高度由胶囊自身撑起。
      "  display:flex;align-items:center;gap:7px;",
      "  padding:0;border-radius:999px;box-sizing:border-box;",
      // CSSOS_WAVE_552 20260531 — Jing「左下胶囊套了但不准」重设计:
      //   折叠态 = 只显示第一颗(播放模式)胶囊, 干净占地最小;
      //   hover(桌面)/ .is-open(触屏轻触)→ 展开成【半屏可滑动轨道】, 所有 item 等高等形排列,
      //   超出左右滑动; 移开/选完自动收回。只用 transform/opacity/max-width 过渡 → 合成层安全。
      // CSSOS_WAVE_558 20260531 — Jing: 去掉轨道外框, 胶囊【头顶头】(相邻紧贴, gap:0)各自
      // 凹凸镶嵌, 不要外面多余的框。容器纯透明、不模糊、不描边; 立体感全交给每颗胶囊自己。
      "  background:transparent;border:none;box-shadow:none;",
      "  -webkit-backdrop-filter:none;backdrop-filter:none;",
      "  opacity:1;transition:opacity 0.22s cubic-bezier(0.4,0,0.2,1);pointer-events:auto;",
      // 折叠态: 横向滚动容器, 但宽度被 max-width 卡住只露第一颗。
      "  max-width:none;overflow:hidden;",
      "}",
      // ── 折叠态: 只露第一颗(播放模式)。其余段落 max-width:0 收起、不可点。 ──
      // CSSOS_WAVE_567 20260531 — Jing「折叠态只显播放方式, 字体也隐藏」: 不再靠 :first-child(脆弱,
      // 速度段缺失/摊平段重排时会漏出字体)。改为【折叠态隐藏除 #watch-playlist-pill 外的一切直接子元素】,
      // 确保折叠时只有播放方式胶囊。
      // CSSOS_WAVE_588 — Jing「默认别留长长的空轨道」: consolidate() 给容器加了 data-pill-bar →
      // 宪法的深色背景带(!important)盖过本文件的 transparent → 收起态仍是一条长暗带。这里在【收起态】
      // 强制透明 + 收窄到只剩播放胶囊 + 左边贴边; hover/.is-open 展开时宪法带自然回来(轨道才显)。
      "#watch-panel .cssmv-capsule:not(.is-open){",
      "  background:transparent !important;border-color:transparent !important;",
      // CSSOS_WAVE_740 — 折叠态贴合 pill。width:max-content 会按所有子元素【自然宽度求和】(忽略
      // max-width:0)→ 满宽 1222px 透明带(探针实测)。改 width:fit-content + 折叠子元素 display:none
      // (彻底移出布局)→ 容器只剩 pill 宽, 无透明轨道、不挡点击。
      "  width:fit-content !important;min-width:0 !important;max-width:max-content !important;left:6px !important;",
      "}",
      "#watch-panel .cssmv-capsule:not(.is-open) > *:not(#watch-playlist-pill){",
      "  display:none !important;",   // W740 — 折叠态彻底移出布局(原 max-width:0 对 max-content 计宽无效)
      "}",
      // CSSOS_WAVE_588 批1 — 残段(图1)根因: 收起态本应【只显播放方式 Loop list】, 但 playlistPill 里
      // 还含「For You」(第2颗)没收起 → 留一小段。收起态把它也收成 0; hover/展开时回来。
      "#watch-panel .cssmv-capsule:not(.is-open) #watch-playlist-pill > button:nth-of-type(2){",
      "  display:none !important;",   // W740 — For You(第2颗)折叠态也彻底移出, 只剩播放方式
      "  max-width:0 !important;min-width:0 !important;padding:0 !important;margin:0 !important;",
      "  opacity:0 !important;overflow:hidden !important;border:0 !important;pointer-events:none !important;}",
      // ── 展开态(仅 .is-open = 点击/轻触, W678b 取消 hover 展开): 全宽轨道, 所有段落露出 + 横向滑动。 ──
      // CSSOS_WAVE_755 — Jing「这几个胶囊总有多余的透明轨道」: 展开态根因 = consolidate() 给容器加
      // data-pill-bar → 宪法轨道底色 rgba(0,245,160,0.10)+边框(!important)透出 = 长长的淡绿外框/胶囊间
      // 淡轨道。折叠态已透明(W588), 展开态漏了。这里展开态也强制容器全透明(只留各胶囊本身)。
      "#watch-panel .cssmv-capsule.is-open,#watch-panel .cssmv-capsule[data-pill-bar]{",
      "  background:transparent !important;border-color:transparent !important;box-shadow:none !important;}",
      "#watch-panel .cssmv-capsule.is-open{",
      // CSSOS_WAVE_588 — 一改两治:
      //  ① width:max-content → 贴合内容, 让宪法 grid 的 1fr 拿不到多余空间 → 短胶囊(1×)不再被拉伸"两边空"(图1)。
      //  ② max-width:calc(100% - 16px) → 跟随【面板/.watch-screen】宽度(不是 100vw), 非全屏时随面板缩短(图2)。
      "  width:max-content !important;max-width:calc(100% - 16px) !important;",
      "  gap:0 !important;",   // W763 — Jing「让它们咬紧一点」: 展开态段间距 0, 消除段间透明轨道
      "  left:8px !important;overflow-x:auto;overflow-y:hidden;",
      "  flex-wrap:nowrap;scrollbar-width:none;-ms-overflow-style:none;",
      "  scroll-behavior:smooth;-webkit-overflow-scrolling:touch;",
      "}",
      "#watch-panel .cssmv-capsule.is-open::-webkit-scrollbar{display:none;width:0;height:0;}",
      "#watch-panel .cssmv-capsule.is-open > *{",
      "  max-width:none;opacity:1;pointer-events:auto;",
      "  transition:max-width 0.26s cubic-bezier(0.4,0,0.2,1),opacity 0.22s ease,padding 0.26s ease;",
      "}",
      // CSSOS_WAVE_698 — Jing「左下控制条几乎全部无法工作」根因: 折叠态把除第一颗外全部压成
      // max-width:0(探针实测 w=0=不可点), 只有 .is-open 才展开; 而 W678b 取消了桌面 hover 展开 →
      // 桌面只能"点第一颗"展开(还顺带切了播放模式), 控件够不到 = 像"全坏了"。
      // 修: 桌面(hover+fine)恢复 hover 展开(视频控制条标准行为, 零副作用); 触屏仍轻触展开。
      // 特异性必须压过折叠规则 :not(.is-open)>*:not(#watch-playlist-pill)(含 2 个 id), 故用
      // :hover:not(.is-open)>*:not(#watch-playlist-pill) (id 数相同 + 多一个 :hover) 稳赢。
      // CSSOS_WAVE_738 20260613 — Jing「只点击展开, 不再响应 hover(和多语言胶囊一样)」:
      // 取消 W698 的桌面 hover 展开。展开统一靠点击(.is-open, 见下方 JS 捕获处理器,
      // 折叠态点击=只展开、吞掉该次点击不切播放模式)。这里留空。
      "",
      // CSSOS_WAVE_557 20260531 — Jing: ① 统一所有段落为【半透明翠绿】(覆盖前两颗 Loop list/
      // For You 构建器写死的 rgba(0,0,0,0.55) 深色); ② 加【凹凸镶嵌】(胶囊宪法): 顶部高光 +
      // 底部内阴影 = 立体浮起感; ③ 等高(min-height 跟 Dock)。!important 压过内联深色。
      // CSSOS_WAVE_572 — 不再自造段落背景/边框/阴影(交给胶囊宪法 [data-pill-bar]>[data-pill-key] 做真凹凸咬合)。
      // 只留布局相关(flex/换行), 颜色镶嵌全由宪法负责。
      "#watch-panel .cssmv-capsule > *{",
      "  flex:0 0 auto;white-space:nowrap;align-items:center;",
      "  transition:max-width 0.26s cubic-bezier(0.4,0,0.2,1),opacity 0.18s ease,padding 0.26s ease;",
      "}",
      // CSSOS_WAVE_588 批1 — playlist pill 内两颗子按钮(Loop list / For You)此前用【自造 inset box-shadow+边框】,
      // 跟旁边真宪法胶囊(1×/Font/Fullscreen)长得不一样(图2)。改成【与宪法基样式一致】: 同底色、同高度、
      // 同圆角、无 box-shadow、无边框 → 视觉统一。外壳透明, gap:4 让两颗各自成胶囊。
      "#watch-panel .cssmv-capsule #watch-playlist-pill{background:transparent !important;border:none !important;box-shadow:none !important;overflow:visible !important;gap:0 !important;}",
      // 内按钮: 与宪法基样式一致 + 【flex 垂直居中】(治图: Loop list/For You 文字没上下居中)。
      "#watch-panel .cssmv-capsule #watch-playlist-pill > button{",
      "  height:40px !important;min-height:40px !important;border:0 !important;border-radius:999px !important;",
      "  box-shadow:none !important;background:hsla(155,58%,52%,0.12) !important;color:#eafff6 !important;",
      "  display:inline-flex !important;align-items:center !important;justify-content:center !important;line-height:1 !important;}",
      // 凹凸镶嵌: Loop list(第1颗)= 凸(激活态底色); For You(第2颗)= 凹向左(宪法同款左凹 mask + 负边距叠咬)。
      "#watch-panel .cssmv-capsule #watch-playlist-pill > button:nth-of-type(1){background:hsla(155,66%,46%,0.92) !important;color:#fff !important;}",
      "#watch-panel .cssmv-capsule #watch-playlist-pill > button:nth-of-type(2){margin-left:-18px !important;padding-left:30px !important;",
      "  -webkit-mask-image:radial-gradient(circle 20px at 0 50%,transparent 19.5px,#000 20px) !important;mask-image:radial-gradient(circle 20px at 0 50%,transparent 19.5px,#000 20px) !important;}",
      "#watch-panel .cssmv-capsule #watch-playlist-pill > div{display:none !important;}", // 隐藏旧的竖分隔线(改为两颗独立胶囊)
      // CSSOS_WAVE_588 — hover 展开时中间那截【空胶囊】= 无内容的段占了位。空内容的直接子一律隐藏。
      "#watch-panel .cssmv-capsule > [data-pill-key]:empty{display:none !important;}",
      // hover 态: 只提亮底色(与宪法 hover 同口径), 不再用 inset 阴影。
      "#watch-panel .cssmv-capsule > *:hover,#watch-panel .cssmv-capsule #watch-playlist-pill > button:hover{",
      "  background:hsla(155,62%,48%,0.30) !important;box-shadow:none !important;}",
      // CSSOS_WAVE_553 20260531 — Jing 铁律「每个胶囊都要有小图标, 禁止纯标签胶囊」。
      // 这几段原本纯文字(Loop list / For You ▾ / 1×)→ 用 ::before 补图标(不动各自构建器, 稳)。
      // CSSOS_WAVE_555 — 修双图标: 循环模式 label(MODE_LABELS)本身已含 🔁/🔂, 不再 ::before(否则 🔁🔁)。
      // 仅给【无图标】的段补: 列表来源(My Works)📂、倍速(1×)⏩。
      "#watch-panel .cssmv-capsule #watch-playlist-pill button:nth-of-type(2)::before{content:'\\1F4C2';margin-right:5px;font-size:0.92em;}",  // 📂 列表来源
      "#watch-panel .cssmv-capsule .cssmv-speed-btn::before{content:'\\23E9';margin-right:4px;font-size:0.9em;}",     // ⏩ 倍速
      "#watch-panel .cssmv-capsule #watch-playlist-pill button{padding-left:9px;padding-right:9px;}",
      // CSSOS_WAVE_565 20260531 — Jing「字体/全屏加文字标签」: 改为 JS 注入【图标+文字】(见 labelIconSeg),
      // 图标 🎨/⛶ + 标签(tr 双语)。这里只给注入后的内部 span 排版。
      "#watch-panel .cssmv-capsule #watch-style-shift,#watch-panel .cssmv-capsule .cssmv-fs-btn{font-size:11px !important;gap:5px;}",
      "#watch-panel .cssmv-capsule .cssmv-seg-ico{font-size:0.95em;line-height:1;}",
      // CSSOS_WAVE_565 胶囊宪法: 宽度 = 高度 × 3。所有胶囊段最小宽 = 3×自身高度(用 aspect 不好控,
      // 改 min-width:calc(3 * 高度)。高度由 W557 min-height:30px → min-width:90px)。纯图标段也满足比例。
      "#watch-panel .cssmv-capsule > *{min-width:90px !important;justify-content:center;}",
      "#watch-panel .cssmv-capsule #watch-playlist-pill{min-width:0 !important;}", // 外壳不限(内部两颗各自满足)
      "#watch-panel .cssmv-capsule #watch-playlist-pill > button{min-width:90px !important;justify-content:center;}",
      // CSSOS_WAVE_560 20260531 — Jing「默认只显示激活的播放方式胶囊」: 折叠态下, 第一颗(playlist pill)
      // 内部只留【模式按钮(btn1)】, 把【来源按钮(My Works, btn2)】也收起 → 折叠 = 只一颗播放方式胶囊。
      "#watch-panel .cssmv-capsule:not(.is-open) #watch-playlist-pill > button:nth-of-type(2){",
      "  max-width:0 !important;padding-left:0 !important;padding-right:0 !important;margin:0 !important;",
      "  opacity:0 !important;pointer-events:none !important;overflow:hidden;border:none !important;box-shadow:none !important;",
      "}",
      // 摊平出来的动作胶囊样式 + 图标(content 由 JS 设 data-icon, 这里渲染)。
      "#watch-panel .cssmv-capsule .cssmv-flat-act{display:inline-flex;align-items:center;gap:5px;cursor:pointer;font:inherit;font-size:11px;font-weight:600;letter-spacing:.04em;padding:6px 10px;white-space:nowrap;}",
      "#watch-panel .cssmv-capsule .cssmv-flat-act .cssmv-flat-ico{font-size:0.95em;}",
      // CSSOS_WAVE_678b — Jing「默认胶囊两头有透明残留(放大才看得出)」: 折叠态下唯一可见的播放方式胶囊
      // (playlistPill + 第1颗 Loop 按钮)强制【无 mask 凹口 / 无负margin / 实心满圆角】→ 干净一颗实心胶囊。
      // 凹咬 mask 只在 .is-open 展开态才需要(那时才有相邻胶囊咬合)。
      "#watch-panel .cssmv-capsule:not(.is-open) #watch-playlist-pill,",
      "#watch-panel .cssmv-capsule:not(.is-open) #watch-playlist-pill > button:nth-of-type(1),",
      "#watch-panel .cssmv-capsule:not(.is-open) > [data-pill-key]{",
      "  -webkit-mask-image:none !important;mask-image:none !important;margin-left:0 !important;margin-right:0 !important;",
      "  width:auto !important;border-radius:999px !important;}",
      // CSSOS_WAVE_753 — Jing「放大仔细看, 胶囊左右还有透明轨道, 怎么修都修不掉; 请让透明轨道和胶囊一样长」。
      // 真凶: 折叠态外壳 #watch-playlist-pill 是 overflow:visible(137 行)→ 放任任何凹咬残影/子元素
      // 溢出外壳 = 左右那条透明轨道。折叠态强制外壳【圆角 + overflow:hidden + 紧贴内容宽】→ 溢出被裁,
      // 外壳精确等于实心胶囊 = 轨道与胶囊一样长(零溢出)。btn1 取消 90px 撑宽避免空轨道。
      "#watch-panel .cssmv-capsule:not(.is-open) #watch-playlist-pill{",
      "  overflow:hidden !important;border-radius:999px !important;width:fit-content !important;",
      "  min-width:0 !important;max-width:max-content !important;background:transparent !important;}",
      "#watch-panel .cssmv-capsule:not(.is-open) #watch-playlist-pill > button:nth-of-type(1){",
      "  min-width:0 !important;}",
      // Share the Dock's show/hide rhythm: in cinema mode the capsule fades out
      // with the rest of the chrome, and re-appears with the Dock on .is-hovering.
      "#watch-panel.cssmv-cinema .cssmv-capsule{opacity:0;pointer-events:none;transition:opacity 0.9s cubic-bezier(0.4,0,0.2,1);}",
      "#watch-panel.cssmv-cinema.is-hovering .cssmv-capsule{opacity:1;pointer-events:auto;transition:opacity 0.22s cubic-bezier(0.4,0,0.2,1);}",
      // Neutralize the moved children's hard-coded absolute positioning so they
      // lay out inline inside the capsule.
      "#watch-panel .cssmv-capsule > *{",
      "  position:static !important;right:auto !important;left:auto !important;",
      "  top:auto !important;bottom:auto !important;margin:0 !important;",
      "  opacity:1 !important;transform:none !important;",
      "}",
      // CSSOS_WAVE_557 — ✦ 浮在轨道外/上方: 竞争规则 #watch-panel #watch-style-shift(2 IDs) 用
      // absolute+bottom:14px+right:120px+opacity:0 把它钉在右下浮起。用更高特异性(3 IDs)+!important
      // 拉回轨道内同一行、可见、等高。同时盖过 overlays 的 #watch-style-shift.watch-style-shift。
      "#watch-panel .cssmv-capsule #watch-style-shift,",
      "#watch-panel .cssmv-capsule #watch-style-shift.watch-style-shift{",
      "  position:static !important;right:auto !important;left:auto !important;top:auto !important;bottom:auto !important;",
      "  transform:none !important;margin:0 !important;width:auto !important;height:auto !important;",
      "  min-height:30px !important;padding:6px 10px !important;opacity:1 !important;pointer-events:auto !important;",
      "  background:rgba(0,245,160,0.12) !important;border:1px solid rgba(0,245,160,0.22) !important;",
      "  -webkit-backdrop-filter:none !important;backdrop-filter:none !important;",
      "  box-shadow:inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -2px 4px rgba(0,40,28,0.35) !important;",
      "}",
      // The moved fr-buttons keep their look but sit in the row.
      "#watch-panel .cssmv-capsule .cssmv-fr-btn,",
      "#watch-panel .cssmv-capsule #watch-style-shift,",
      "#watch-panel .cssmv-capsule #watch-actions-pill{",
      "  display:inline-flex !important;align-items:center;justify-content:center;",
      "}",
      // Hide the duplicate right-side ⟳ loop + standalone buttons now folded into
      // the ⋯ menu (they remain in the DOM for click()-delegation + guards).
      "#watch-panel .watch-screen .cssmv-loop-btn,",
      "#watch-panel .watch-screen .cssmv-pip-btn,",
      "#watch-panel .watch-screen .cssmv-info-btn,",
      "#watch-panel .watch-screen .cssmv-stem-toggle{display:none !important;}",
      // Old bottom-left pill row collapses once emptied.
      "#watch-panel #watch-pill-row-bl.cssmv-capsule-emptied{display:none !important;}"
    ].join("\n");
    document.head.appendChild(st);
  }

  // Move a node into target (preserving its listeners). Idempotent.
  function moveInto(target, node) {
    if (node && target && node.parentNode !== target) target.appendChild(node);
  }

  function consolidate() {
    var screen = document.querySelector("#watch-panel .watch-screen");
    if (!screen) return;
    injectStyle();

    var cap = screen.querySelector(".cssmv-capsule");
    if (!cap) {
      cap = document.createElement("div");
      cap.className = "cssmv-capsule";
      // CSSOS_WAVE_408 20260524 — Jing「点胶囊会误触, 被当成点屏幕→媒体暂停」: stop
      // taps on the capsule (and the gaps between its buttons) from bubbling to
      // the .watch-screen play/pause / swipe / double-tap-seek handlers.
      ["click", "pointerdown", "mousedown", "touchstart", "dblclick"].forEach(function (ev) {
        cap.addEventListener(ev, function (e) { e.stopPropagation(); }, false);
      });
      screen.appendChild(cap);

      // CSSOS_WAVE_552 — 触屏无 hover: 轻触【折叠态】(第一颗以外区域=折叠时只有第一颗)展开;
      // 选完任意 item 或轻触面板其它地方 → 收回。桌面靠 :hover, 这套不冲突(只加 .is-open)。
      cap.addEventListener("click", function (e) {
        if (!cap.classList.contains("is-open")) {
          // CSSOS_WAVE_738 — 折叠态点击 = 【只展开, 吞掉这次点击】, 不触发第一颗(播放模式)的动作,
          // 和多语言/多声线胶囊一致。捕获阶段 + stopImmediatePropagation 拦在按钮自身监听之前。
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          cap.classList.add("is-open");
          return;
        }
        // 已展开: 点到某个 item(非容器空隙)→ 执行后收回。
        var seg = e.target && e.target.closest ? e.target.closest(".cssmv-capsule > *") : null;
        if (seg && seg.parentNode === cap) {
          setTimeout(function () { cap.classList.remove("is-open"); }, 60);
        }
      }, true);
      // 轻触/点击面板其它地方 → 收回。
      document.addEventListener("pointerdown", function (e) {
        if (!cap.classList.contains("is-open")) return;
        if (!cap.contains(e.target)) cap.classList.remove("is-open");
      }, true);
    }

    // KEY controls → capsule, in a stable left→right order.
    var playlistPill = document.getElementById("watch-playlist-pill"); // 🔂 loop-mode + For You source
    var speed = screen.querySelector(".cssmv-speed-btn");               // 1×
    var style = document.getElementById("watch-style-shift");           // ✦
    var fs = screen.querySelector(".cssmv-fs-btn");                     // ⛶
    var actionsPill = document.getElementById("watch-actions-pill");    // ⋯ (旧入口)

    // CSSOS_WAVE_555 — Jing「摊平 ⋯ 成胶囊轨道」: 不再把 ⋯ 移进轨道, 改为把 ⋯ 里的动作
    // 逐个渲染成胶囊段(去重: 倍速/下载MP4; 去掉: 静音; 滑块→点击循环)。⋯ 入口隐藏。
    if (actionsPill) actionsPill.style.display = "none";

    var KEY = [playlistPill, speed, style, fs];
    KEY.forEach(function (el) { moveInto(cap, el); });

    rebuildFlatActions(cap);

    // CSSOS_WAVE_565 — 给 ✦字体 / ⛶全屏 注入【图标 + 文字标签】(i18n via tr/loginCopy)。幂等。
    labelIconSeg(style, "🎨", lc("Font", "字体"));   // 🎨 字体
    labelIconSeg(fs,    "⛶",       lc("Fullscreen", "全屏")); // ⛶ 全屏

    // 顺序: [模式][来源](=playlistPill 内两颗) [倍速] [✦] [⛶] [...摊平动作]。
    var flat = [].slice.call(cap.querySelectorAll(".cssmv-flat-act"));
    var order = [playlistPill, speed, style, fs].concat(flat).filter(function (el) { return el && el.parentNode === cap; });
    var current = [].slice.call(cap.children).filter(function (el) { return el.style.display !== "none"; });
    var mismatch = order.some(function (el, i) { return current[i] !== el; });
    if (mismatch) order.forEach(function (el) { cap.appendChild(el); });

    // CSSOS_WAVE_572 — 接入【真·胶囊宪法】: cap=data-pill-bar(紧凑+单色绿), 每个直接子=data-pill-key,
    // 播放方式(playlistPill)标 .active(凸)。宪法 CSS 负责真凹凸咬合, 不再用自造阴影。
    try {
      cap.setAttribute("data-pill-bar", "");
      cap.setAttribute("data-pill-compact", "");
      cap.setAttribute("data-pill-mono", "");
      order.forEach(function (el, i) {
        if (el && !el.getAttribute("data-pill-key")) el.setAttribute("data-pill-key", "ctl" + i);
      });
      // 激活 = 第一颗(播放方式)。其余清除 active。
      order.forEach(function (el) { if (el) el.classList.remove("active"); });
      if (playlistPill) playlistPill.classList.add("active");
    } catch (_e) {}

    // Collapse the now-empty bottom-left pill row.
    var bl = document.getElementById("watch-pill-row-bl");
    if (bl && !bl.querySelector("button, [role=button]") && bl.children.length === 0) {
      bl.classList.add("cssmv-capsule-emptied");
    } else if (bl && cap.contains(playlistPill)) {
      bl.classList.add("cssmv-capsule-emptied");
    }
  }

  // CSSOS_WAVE_555 — 把 ⋯ 菜单的动作摊平成胶囊段。去重(倍速/下载MP4)、去静音、滑块→点击循环。
  var SLIDE_STEPS = [0.2, 0.5, 0.85];       // 幻灯: 慢/中/快
  var slideIdx = 1;
  function rebuildFlatActions(cap) {
    if (typeof globalThis.buildMediaActionsModule !== "function") return;
    var acts;
    try { acts = globalThis.buildMediaActionsModule() || []; } catch (_e) { return; }
    // 过滤规则
    var filtered = acts.filter(function (a) {
      var ic = String(a && a.icon || "");
      var lb = String(a && a.label || "");
      if (ic === "🔇" || ic === "🔊") return false;              // 静音 去掉
      if (ic === "⏩") return false;                              // 倍速 重复 去掉(已有速度胶囊)
      if (/Download MP4|下载 ?MP4/i.test(lb)) return false;       // 第二个下载 去掉, 留上面 ⬇ 下载
      return true;
    });
    // 签名: 仅当动作集合(图标+是否滑块)变化才重建, 避免每 tick churn。
    var sig = filtered.map(function (a) { return (a.icon || "") + (a.isSlider ? "#s" : ""); }).join("|");
    if (cap.dataset.flatSig === sig) {
      // 仅刷新动态 label(倍速/画中画/静音已排除; aspect/slideshow 文案可能变)→ 简单起见跳过
      return;
    }
    cap.dataset.flatSig = sig;
    // 清掉旧摊平段
    [].slice.call(cap.querySelectorAll(".cssmv-flat-act")).forEach(function (n) { n.remove(); });
    filtered.forEach(function (a) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cssmv-flat-act";
      btn.dataset.noFrameToggle = "1";
      var ico = document.createElement("span");
      ico.className = "cssmv-flat-ico";
      ico.textContent = a.icon || "•";
      var lbl = document.createElement("span");
      lbl.textContent = a.label || "";
      btn.appendChild(ico);
      btn.appendChild(lbl);
      if (a.isSlider && typeof a.onSliderInput === "function") {
        // 幻灯强度: 点击在 慢/中/快 之间循环。
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          slideIdx = (slideIdx + 1) % SLIDE_STEPS.length;
          try {
            var txt = a.onSliderInput(SLIDE_STEPS[slideIdx]);
            if (txt && typeof globalThis.showToast === "function") globalThis.showToast(String(txt));
          } catch (_e) {}
        });
      } else if (typeof a.onClick === "function") {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          try { a.onClick(); } catch (_e) {}
          // 下次 tick 重建以刷新可能变化的状态(画中画/aspect 文案等)。
          cap.dataset.flatSig = "";
        });
      }
      cap.appendChild(btn);
    });
  }

  var pending = 0;
  function scheduleConsolidate() {
    if (pending) return;
    pending = setTimeout(function () { pending = 0; try { consolidate(); } catch (_e) {} }, 180);
  }

  function boot() {
    // Initial attempts (controls are created lazily as the watch wires up).
    [0, 300, 800, 1500, 3000].forEach(function (ms) { setTimeout(scheduleConsolidate, ms); });
    // Keep consolidating as buttons appear / the watch re-renders.
    var screenHost = document.getElementById("watch-panel") || document.body;
    try {
      var mo = new MutationObserver(scheduleConsolidate);
      mo.observe(screenHost, { childList: true, subtree: true });
    } catch (_e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
