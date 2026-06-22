/* CSSOS_WAVE_561/566 20260531 — Jing「多语言/声线胶囊 = 国旗 + 凹凸镶嵌; 折叠成🌐多语言, hover 展开轨道」。
 * 语言按钮真实结构: #watch-language-pill > button[data-lang][data-take], 激活态 class=.active。
 * 折叠态(默认)只显一颗合成的【🌐 多语言】引导胶囊; hover(桌面)/.is-open(轻触)展开整条语言胶囊轨道。
 * 附加式: 不改 mv-language-pill 构建器; 只注入样式 + 前置国旗 + 折叠交互。胶囊宪法: min-width=高度×3。 */
(function () {
  "use strict";
  if (globalThis.__cssosLangFlagWired) return;
  globalThis.__cssosLangFlagWired = true;

  var FLAG = {
    en: "🇬🇧", english: "🇬🇧", "英": "🇬🇧",
    zh: "🇨🇳", cn: "🇨🇳", "中": "🇨🇳", chinese: "🇨🇳",
    ja: "🇯🇵", jp: "🇯🇵", "日": "🇯🇵", japanese: "🇯🇵",
    ko: "🇰🇷", kr: "🇰🇷", "한": "🇰🇷", "韩": "🇰🇷", korean: "🇰🇷",
    fr: "🇫🇷", "法": "🇫🇷", french: "🇫🇷",
    de: "🇩🇪", "德": "🇩🇪", german: "🇩🇪",
    es: "🇪🇸", "西": "🇪🇸", spanish: "🇪🇸",
    it: "🇮🇹", "意": "🇮🇹", italian: "🇮🇹",
    ru: "🇷🇺", "俄": "🇷🇺", russian: "🇷🇺",
    pt: "🇵🇹", "葡": "🇵🇹", portuguese: "🇵🇹",
    ar: "🇸🇦", "阿": "🇸🇦", arabic: "🇸🇦",
    hi: "🇮🇳", "印": "🇮🇳", hindi: "🇮🇳",
    el: "🇬🇷", "希": "🇬🇷", greek: "🇬🇷",
    la: "🏛", latin: "🏛", "拉": "🏛",
    peo: "🏺", fa: "🇮🇷", sa: "🕉", bo: "☸", ur: "🇵🇰",
    vi: "🇻🇳", is: "🇮🇸", sv: "🇸🇪", sw: "🇰🇪", tr: "🇹🇷", he: "🇮🇱"
  };

  // CSSOS_WAVE_567 — 语言完整单词(用本语言自称, 正好让胶囊较宽、符合宽=高×3)。
  var NAME = {
    en: "English", zh: "中文", ja: "日本語", ko: "한국어", fr: "Français",
    de: "Deutsch", es: "Español", it: "Italiano", ru: "Русский", pt: "Português",
    ar: "العربية", hi: "हिन्दी", el: "Ελληνικά", la: "Latina",
    peo: "𐎠𐎭", fa: "فارسی", sa: "संस्कृत", bo: "བོད", ur: "اردو",
    vi: "Tiếng Việt", is: "Íslenska", sv: "Svenska", sw: "Kiswahili", tr: "Türkçe", he: "עברית"
  };
  function nameFor(code) {
    var s = String(code || "").trim().toLowerCase().replace(/[0-9０-９]+$/, "").trim();
    return NAME[s] || NAME[s.slice(0, 2)] || NAME[s.slice(0, 1)] || code;
  }

  // CSSOS_WAVE_587 — 声线 glyph + 双语名(与 app.add-voice-modal.js 的 VOICES 对齐; auto=原声)。
  var VOICE_GLYPH = {
    auto: "🎙", feminine: "👩", masculine: "👨", childlike: "🧒", duet: "👫",
    androgynous: "🧑", polyphonic_choir: "🎶", raspy: "🔥", operatic: "🎭",
    whisper: "🌬", robotic: "🤖",
    jing: "🎙", // CSSOS_WAVE_587 — 创始人声线(RVC 真人声纹)
    jing_tenor: "🎤" // Jing 男高音版(同声纹 + 升调)
  };
  var VOICE_NAME_EN = {
    auto: "Original", feminine: "Feminine", masculine: "Masculine", childlike: "Childlike",
    duet: "Duet", androgynous: "Androgynous", polyphonic_choir: "Choir", raspy: "Raspy",
    operatic: "Operatic", whisper: "Whisper", robotic: "Robotic",
    jing: "Jing's Voice", jing_tenor: "Jing (Tenor)"
  };
  var VOICE_NAME_ZH = {
    auto: "原声", feminine: "女声", masculine: "男声", childlike: "童声", duet: "二重唱",
    androgynous: "中性声", polyphonic_choir: "合唱", raspy: "沙哑", operatic: "美声",
    whisper: "气声", robotic: "电子声",
    jing: "Jing 声线", jing_tenor: "Jing 男高音"
  };
  function voiceGlyph(v) { return VOICE_GLYPH[String(v || "auto").toLowerCase()] || "🎤"; }
  function voiceName(v) {
    var k = String(v || "auto").toLowerCase();
    var zh = String(document.documentElement.lang || navigator.language || "").toLowerCase().indexOf("zh") === 0;
    return (zh ? VOICE_NAME_ZH[k] : VOICE_NAME_EN[k]) || k;
  }
  function curMode() {
    var m = globalThis.__cssosLangPillMode;
    return (m === "voice") ? "voice" : "lang";
  }

  function flagFor(txt) {
    var s = String(txt || "").trim().toLowerCase();
    var base = s.replace(/[0-9０-９]+$/, "").trim();
    if (FLAG[base]) return FLAG[base];
    var two = base.slice(0, 2);
    if (FLAG[two]) return FLAG[two];
    var one = base.slice(0, 1);
    if (FLAG[one]) return FLAG[one];
    return "🌐";
  }

  function foldedLabel() {
    try {
      if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy("Languages", "多语言");
      var l = String(document.documentElement.lang || navigator.language || "").toLowerCase();
      return l.indexOf("zh") === 0 ? "多语言" : "Languages";
    } catch (_e) { return "Languages"; }
  }

  function injectStyle() {
    if (document.getElementById("cssos-lang-flag-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-lang-flag-style";
    st.textContent = [
      // CSSOS_WAVE_587 — 单行布局: [模式胶囊 🌐多语言 | 🎤多声线] + [一条 cell 轨道]。
      // 不再折叠成单颗; 两个模式胶囊常显, 点谁就只显谁那一类 cell(lang/voice)。
      // CSSOS_WAVE_587 — z-index 抬到 40 + pointer-events:auto: 之前两颗模式胶囊很难点(被字幕/Dock 等层盖住或层级不够)。
      // CSSOS_WAVE_862 — 不再自绝对定位: 由 app.watch-bottom-stack.js 收编为底部 flex 列子元素(单一 owner),
      // 浏览器原生排在价格条上方一行, 永不与价格条/AI助理打架。这里只留视觉/命中属性。
      "#cssos-lang-fold{z-index:40;align-items:center;max-width:92vw;pointer-events:auto;}",
      // CSSOS_WAVE_884/923 — 只有【收进底部栈】后才显示; 否则(还浮在 DOM 出生点/中段)一律藏起, 杜绝"跑中央"。
      // W923 真凶: 旧版用 visibility:hidden, 但子元素(.cssos-mode-cap 等)自带 visibility/pointer 规则会
      // 【覆盖父级 visibility】→ 父藏子显 = 胶囊照样飘在中央。改用 display:none(子元素无法覆盖, 整棵子树消失),
      // 仅当 fold 真在 #cssos-watch-bottomflow 里才 display:inline-flex 显示 → 永不在中段闪现/常驻。
      "#cssos-lang-fold{display:none;}",
      "#cssos-watch-bottomflow #cssos-lang-fold{display:inline-flex;}",
      "#cssos-lang-fold .cssos-mode-cap,#cssos-lang-fold #watch-language-pill,#cssos-lang-fold #watch-language-pill>button{pointer-events:auto !important;}",
      // CSSOS_WAVE_587 — 难点击根因: 宪法凹凸咬合用【负margin+透明遮罩】让相邻胶囊盒子伸进激活胶囊 20px,
      // 那块透明咬口仍然捕获点击 → 偷走激活/模式胶囊边缘的点击。把它们的 z 抬高于相邻咬口, 点击就落自己身上。
      "#cssos-lang-fold #watch-language-pill>button{position:relative;z-index:1;}",
      "#cssos-lang-fold .cssos-mode-cap{z-index:3 !important;}",
      "#cssos-lang-fold #watch-language-pill>button.active{z-index:5 !important;}",
      // CSSOS_WAVE_587d — Jing「只要一条轨道」: 两颗模式胶囊 + cell 全在【同一条】pill-bar(#watch-language-pill)里,
      // 一条连续凹凸镶嵌轨: [🌐多语言·N][🎤多声线·N][cell…]。模式胶囊(.cssos-mode-cap)常显, cell 折叠时隐藏。
      "#watch-language-pill .cssos-mode-cap .cssos-mode-ico{font-size:0.95em;line-height:1;}",
      "#watch-language-pill .cssos-mode-cap .cssos-mode-n{opacity:0.7;font-weight:700;margin-left:2px;}",
      // 折叠/展开: data-expanded 决定显哪类 cell; 模式胶囊永不隐藏(它们不是 .cssos-cell)。
      //  · none → 只剩两颗模式胶囊。 · lang → 接着展开语言 cell。 · voice → 接着展开声线 cell。
      //  · 选了 cell → 收回 none。未选不收。太多横滑。
      // CSSOS_WAVE_587h — 默认收起【只要不是明确 lang/voice 展开就收】: 覆盖 data-expanded=none/缺失/任何非展开值,
      // 防止渲染时机里属性未设 → cell 全露(语言声线混一起)。只有 lang/voice 才放对应 cell 出来。
      // CSSOS_WAVE_678 胶囊宪法 v2 — 门控直接挂 bar 本身(不依赖 #cssos-lang-fold 祖先): 之前选择器要求
      // bar 在 fold 里, render 重建后若没包进 fold → 门控全失效 → 语言/声线 cell 混显 + 两个 guide 全露。
      // 现在每个胶囊头各管各轨: [data-expanded=lang]→只显语言 cell, [voice]→只显声线 cell, 折叠→只剩模式胶囊。
      "#watch-language-pill:not([data-expanded=\"lang\"]):not([data-expanded=\"voice\"]) .cssos-cell{display:none !important;}",
      "#watch-language-pill[data-expanded=\"lang\"]  .cssos-cell-voice,",
      "#watch-language-pill[data-expanded=\"lang\"]  .cssos-voice-guide{display:none !important;}",
      "#watch-language-pill[data-expanded=\"voice\"] .cssos-cell-lang,",
      "#watch-language-pill[data-expanded=\"voice\"] .cssos-lang-guide{display:none !important;}",
      // 非作者的统一 guide(cssos-want-guide, 不带 lang/voice 类)在任一展开模式都显一颗(去重双 Want an MV)。
      "#watch-language-pill:not([data-expanded=\"lang\"]):not([data-expanded=\"voice\"]) .cssos-want-guide{display:none !important;}",
      // cell 紧接着模式胶囊向右展开(transform-origin 左 = 从🎤胶囊处长出); 仅 transform/opacity(合规)。
      "#watch-language-pill{transform-origin:left center;}",
      "#cssos-lang-fold[data-expanded=\"lang\"] #watch-language-pill,",
      "#cssos-lang-fold[data-expanded=\"voice\"] #watch-language-pill{animation:cssosExpandTrack .24s cubic-bezier(.2,.7,.2,1);}",
      "@keyframes cssosExpandTrack{from{transform:scaleX(.55);opacity:0.2}to{transform:scaleX(1);opacity:1}}",
      // CSSOS_WAVE_571 — 不要覆盖宪法 button 的 width/min-width! 宪法用 width:calc(100%+20px) 做左右咬合,
      // 我之前的 min-width:90px !important 把它压死 → 左侧凹口算不出来(只有右侧对)。这里【只】补图标排版。
      "#watch-language-pill > button .lang-flag{font-size:0.95em;line-height:1;}",
      // CSSOS_WAVE_579 — Jing「没凹就是子弹」根治: 上一版我加 grid-auto-columns:max-content 覆盖了宪法的
      // 列定义 minmax(max-content,1fr) → 宪法凹凸咬合的列数学(width:calc(100%+20px)+负margin)崩了 → 变子弹。
      // 【绝不覆盖宪法 grid 列】。宪法 minmax 下限本就是 max-content, 完整单词不会被压; 只需容器可横滑 + 文字不省略。
      // CSSOS_WAVE_587j — Jing「胶囊撑满轨道, 别空一截; Want an MV 别被截断」:
      //  · 轨道高度=胶囊高度(40px)+ 子胶囊撑满(height:100%, 居中), 消除宪法 42px 容器底部的空缝。
      //  · max-width 放宽到 min(96vw,980px), 桌面端 6 颗满文字胶囊放得下不被圆角裁切; 窄屏仍可横滑。
      "#watch-language-pill{overflow-x:auto !important;max-width:min(96vw,980px) !important;height:40px !important;min-height:40px !important;align-items:center !important;scrollbar-width:none;}",
      // CSSOS_WAVE_678j — Jing「别平均胶囊长度, 要自适应」: 宪法列是 minmax(max-content,1fr), 那个 1fr 在轨道比
      // 内容宽时把每颗等分拉成平均宽 → 长文案(Want an MV like this)分不到够宽被截断。语言条单独改 max-content
      //(每颗按内容自适应)+ 左对齐。凹咬靠固定 +20px 重叠, 与基础宽无关, 不受影响。仅覆盖本条, 不动全局宪法。
      "#watch-language-pill{grid-auto-columns:max-content !important;justify-content:start !important;}",
      // CSSOS_WAVE_678o — 兜底防截断: width:calc(100%+20) 在 max-content 网格里会列宽↔width 循环、某些内容下解析偏小
      // → 截断(声线维度 Want an MV li)。给所有凹咬/合并/cell 加 min-width:max-content(地板=内容宽), 永不截断。
      "#watch-language-pill > button.cssos-cell,#watch-language-pill > button.cssos-mode-cap{min-width:max-content !important;}",
      // CSSOS_WAVE_678q — 引导胶囊(Want an MV / 加语言 / 加声线)【退出凹咬宽度】: cc-left 的 width:calc(100%+20px)
      // 在 WebKit 网格里 100% 循环引用解析偏小 → guide 被压窄(既截断、点击区又变小=像点不动)。强制 width:auto
      //+min-width:max-content+无mask+margin归零 → 纯自适应整颗, 永远完整 + 全可点。(guide 不需要凹咬嵌套。)
      "#watch-language-pill > button.cssos-want-guide,#watch-language-pill > button.cssos-lang-guide,#watch-language-pill > button.cssos-voice-guide{",
      "width:auto !important;min-width:max-content !important;margin-left:0 !important;margin-right:0 !important;",
      "-webkit-mask-image:none !important;mask-image:none !important;border-radius:999px !important;}",
      // CSSOS_WAVE_758 — Jing「Want an MV 胶囊总不凹向左边」: 给引导胶囊补【左凹咬】, 但避开 W678q 截断陷阱
      // (那是 width:calc(100%+20px) 在 max-content 网格里循环解析偏小所致)→ 改用【负 margin + 左 mask +
      // 保 max-content/width:auto】: 既凹向左邻、又不截断不缩点击区。仅 Want an MV(want-guide), 加/语言加/声线
      // 引导仍保持实心(它们常在轨道末尾不需要嵌)。
      "#watch-language-pill > button.cssos-want-guide{",
      "margin-left:-20px !important;padding-left:38px !important;width:auto !important;min-width:max-content !important;",
      "border-radius:0 999px 999px 0 !important;z-index:0 !important;",
      "-webkit-mask-image:radial-gradient(circle 20px at 20px 50%,transparent 19.5px,#000 20px) !important;",
      "mask-image:radial-gradient(circle 20px at 20px 50%,transparent 19.5px,#000 20px) !important;}",
      "#watch-language-pill > button{height:40px !important;min-height:40px !important;max-height:40px !important;align-self:center !important;}",
      "#watch-language-pill::-webkit-scrollbar{display:none;}",
      // CSSOS_WAVE_587f — 根因: 全局 @media(pointer:coarse){.lang-name{display:none}} 在【触屏=App】上把所有
      // .lang-name 隐藏 → 胶囊只剩国旗/图标(中文「日本語」「多语言」都没了)。这里强制语言轨内的 .lang-name 常显。
      // CSSOS_WAVE_587g — 根因有二: 全局 .lang-name 基样式是【opacity:0 + translateY】(只在 .lang-card:hover 才显),
      // 且触屏 media query 还 display:none。我的胶囊复用了 .lang-name → 文字一直透明/隐藏。这里全部强制可见。
      "#watch-language-pill .lang-name{display:inline-flex !important;align-items:center !important;margin-left:5px !important;opacity:1 !important;transform:none !important;overflow:visible !important;text-overflow:clip !important;}",
      // CSSOS_WAVE_678p — 二维交叉计数小标(N🎤 / N🌐): 略小、半透明、左留间距, 不抢主名字。
      "#watch-language-pill .cssos-xcount{display:inline-flex !important;align-items:center !important;margin-left:7px !important;font-size:0.82em !important;opacity:0.78 !important;font-weight:600 !important;white-space:nowrap !important;}",
      // CSSOS_WAVE_574 — 不依赖 :has 的【左凹】(JS 给激活左侧的胶囊打 .cssos-laft)。镜像宪法左凹规则,
      // 让左侧胶囊也凹向激活(右边缘咬出弧口), 与右侧 .active~ 对称。",
      "#watch-language-pill > button.cssos-laft{",
      "border-radius:999px 0 0 999px !important;margin-right:-20px !important;width:calc(100% + 20px) !important;",
      "padding-right:36px !important;z-index:0 !important;",
      "-webkit-mask-image:radial-gradient(circle 20px at 100% 50%,transparent 19.5px,#000 20px) !important;",
      "mask-image:radial-gradient(circle 20px at 100% 50%,transparent 19.5px,#000 20px) !important;}",
      // CSSOS_WAVE_675 — Jing「多语言/多声线胶囊很难点击」: 两颗【模式胶囊】退出负margin/透明mask 凹咬
      //(那块透明咬口一直偷点击), 给足实心点击区 + 抬到最高层, 点击稳稳落自己身上。cell 轨仍保留凹咬美学。
      "#watch-language-pill .cssos-mode-cap{margin:0 6px 0 0 !important;width:auto !important;min-width:max-content !important;",
      "padding:0 18px !important;height:40px !important;display:inline-flex !important;align-items:center !important;",
      "justify-content:center !important;cursor:pointer !important;position:relative !important;z-index:8 !important;",
      "-webkit-mask-image:none !important;mask-image:none !important;border-radius:999px !important;}",
      "#watch-language-pill .cssos-mode-cap.cssos-laft{margin-right:6px !important;width:auto !important;padding-right:18px !important;}",
      "#watch-language-pill .cssos-mode-cap *{pointer-events:none !important;}",  // 子元素不拦点击, 全落按钮
      // CSSOS_WAVE_678c 胶囊宪法 v2 ── 统一凹咬模型(paintConcave 全权控制本条, 全局凹凸已跳过本 bar)──
      // 头胶囊按需显隐(非作者单选轴)。
      "#watch-language-pill .cssos-mode-cap.cssos-cap-hidden{display:none !important;}",
      // cc-right: 右边缘碗口, 实体向右延伸 20px 嵌进右邻(= 旧 pill-laft 网格配方: width:calc(100%+20)+负margin)。
      // 【网格布局里, 单负 margin 不产生重叠, 必须配 width:calc 让胶囊实体延伸, 碗口才能咬住邻居】(图: 没咬紧的真凶)。
      "#watch-language-pill > button.cssos-cc-right{border-radius:999px 0 0 999px !important;width:calc(100% + 20px) !important;margin-right:-20px !important;margin-left:0 !important;padding-right:46px !important;",
      "-webkit-mask-image:radial-gradient(circle 20px at 100% 50%,transparent 19.5px,#000 20px) !important;mask-image:radial-gradient(circle 20px at 100% 50%,transparent 19.5px,#000 20px) !important;}",
      // cc-left: 左边缘碗口, 实体向左延伸 20px 嵌进左邻(镜像)。padding-left 必须 >碗口半径(20) + 重叠(20), 否则图标落进碗口透明区被吃(图)。
      "#watch-language-pill > button.cssos-cc-left{border-radius:0 999px 999px 0 !important;width:calc(100% + 20px) !important;margin-left:-20px !important;margin-right:0 !important;padding-left:46px !important;",
      "-webkit-mask-image:radial-gradient(circle 20px at 0 50%,transparent 19.5px,#000 20px) !important;mask-image:radial-gradient(circle 20px at 0 50%,transparent 19.5px,#000 20px) !important;}",
      // cc-solid: 被抱者(被两激活夹住的未激活头)= 实心满圆角无碗口, margin 清零让邻居咬到底。
      "#watch-language-pill > button.cssos-cc-solid{-webkit-mask-image:none !important;mask-image:none !important;border-radius:999px !important;margin:0 !important;}",
      // cc-merge-*: 相邻激活合成【一条连续激活胶囊】—— 内侧削平紧贴, 外侧圆角, 无碗口无分隔, 图标自然分隔。
      // 真凶: 宪法激活态有 border-left+border-right 各1px → 两激活相接处=两条内侧边框叠成分隔线。
      // 合并组只保留【外侧】边框, 删【内侧】边框 → 连成一条无缝激活胶囊。
      // 内侧内边距收紧到 6px(像话筒那样近), 让合体的图标不隔太远; 外侧保持 16px。
      "#watch-language-pill > button.cssos-cc-merge-l{-webkit-mask-image:none !important;mask-image:none !important;border-radius:999px 0 0 999px !important;margin:0 !important;border-right:0 !important;padding-left:16px !important;padding-right:6px !important;}",
      "#watch-language-pill > button.cssos-cc-merge-m{-webkit-mask-image:none !important;mask-image:none !important;border-radius:0 !important;margin:0 !important;border-left:0 !important;border-right:0 !important;padding-left:6px !important;padding-right:6px !important;}",
      "#watch-language-pill > button.cssos-cc-merge-r{-webkit-mask-image:none !important;mask-image:none !important;border-radius:0 999px 999px 0 !important;margin:0 !important;border-left:0 !important;padding-left:6px !important;padding-right:16px !important;}",
      // CSSOS_WAVE_866 — Jing「App 端应是【设置/多声线两个未激活胶囊凹咬包住激活的多语言】, 之前好好的,
      // 是搬 loop 胶囊那波动了无关代码弄坏的」。根治: 【彻底删掉】W697/W865 的 @media(pointer:coarse) 触屏
      // 改写块。那块把 cc-right/cc-left/cc-solid 等的凹咬(width:calc(100%+20)+负margin+mask 碗口)在触屏上
      // 抹平 → App 失去凹凸咬合。现在 App 与桌面【同走 paintConcave 的真凹咬】: ⚙(cc-right 右咬)+ 🎤多声线
      // (cc-left/right 咬向中心)双双凹抱激活的 🌐多语言。W697 当年怕"透明碗口在触屏偷相邻点击"——但这三颗是
      // 大胶囊、点中心即可, 偷点只在密集 cell 轨才明显; 视觉正确优先, 恢复原貌。
      ""
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  // 作者本人判定 + workId 解析(多处复用)。
  function resolveOwn() {
    var isOwn = false, wid = "";
    try {
      var w = (typeof globalThis.cssosCurrentWork === "function") ? globalThis.cssosCurrentWork() : null;
      if (w) { isOwn = !!w.is_own; wid = w.id || w.work_id || ""; }
    } catch (_e) {}
    if (!isOwn || !wid) {
      try {
        var ps = (typeof globalThis.cssosMvPipelinePanelState === "function") ? globalThis.cssosMvPipelinePanelState() : null;
        if (ps) { isOwn = isOwn || !!(ps.is_own || (ps.work && ps.work.is_own)); wid = wid || (ps.workId ? String(ps.workId).split("|")[0] : ""); }
      } catch (_e2) {}
    }
    return { isOwn: isOwn, wid: wid };
  }

  // CSSOS_WAVE_587c — 折叠/展开状态: 'none'(只两颗胶囊) | 'lang' | 'voice'。默认折叠。
  var _expanded = "none";

  // CSSOS_WAVE_587d — 两颗模式胶囊塞进【同一条】轨道(#watch-language-pill)的最前面, 与 cell 同属一条 pill-bar。
  // render() 每次会清空 bar → 这里在 enhance 中保证它们作为前两颗常驻(没有就 prepend)。
  function ensureModeSwitch(fold, bar) {
    if (bar.querySelector(".cssos-mode-cap")) return; // 已在
    var caps = [];
    ["voice", "lang"].forEach(function (mode) { // prepend 逆序 → 最终顺序 lang, voice
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cssos-mode-cap";
      b.dataset.mode = mode;
      b.setAttribute("data-pill-key", "m-" + mode);
      b.innerHTML = '<span class="cssos-mode-ico"></span><span class="lang-name"></span><span class="cssos-mode-n"></span>';
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        // 点同一个已展开的模式 → 收回折叠; 否则激活该模式并展开它的轨道。
        if (curMode() === mode && _expanded === mode) { _expanded = "none"; }
        else { globalThis.__cssosLangPillMode = mode; _expanded = mode; }
        applyState(fold);
        paintModeSwitch(bar);
      }, false);
      bar.insertBefore(b, bar.firstChild);
      caps.push(b);
    });
    return caps;
  }
  // data-mode = 激活高亮的模式; data-expanded = 当前展开的轨道('none' 为折叠)。
  function applyState(fold) {
    fold.setAttribute("data-mode", curMode());
    fold.setAttribute("data-expanded", _expanded);
    // CSSOS_WAVE_678 — 门控同时挂到 bar 本身(选择器 #watch-language-pill[data-expanded]),
    // 即便某次渲染 bar 没被包进 #cssos-lang-fold, 门控仍生效 → 永不混显。
    var bar = (fold.querySelector && fold.querySelector("#watch-language-pill")) || document.getElementById("watch-language-pill");
    if (bar) { bar.setAttribute("data-mode", curMode()); bar.setAttribute("data-expanded", _expanded); paintConcave(bar); }
    // CSSOS_WAVE_884 — Jing「多语言总是跑那么远(屏幕中段)」根治: W870 只 schedule(异步 rAF)且依赖 adopt
    // 的判断, 实测没收进去 → fold 停在 DOM 出生点(中段)。这里【同步直接】把 fold 塞进 #cssos-watch-bottomflow,
    // 绕开 adopt 所有守卫, 每次渲染都保证它在底部栈里(adopt 之后再校正顺序)。bottomflow 还没建出来时,
    // fold 由 CSS(visibility:hidden, 仅 bottomflow 内才显)藏住, 绝不在中段闪现。
    try {
      var _bf = document.getElementById("cssos-watch-bottomflow");
      if (_bf && fold.parentNode !== _bf) _bf.appendChild(fold);
      if (typeof globalThis.cssosScheduleBottomFlow === "function") globalThis.cssosScheduleBottomFlow();
    } catch (_e) {}
  }
  function paintModeSwitch(bar) {
    var caps = bar.querySelectorAll(".cssos-mode-cap");
    if (!caps.length) return;
    var zh = String(document.documentElement.lang || navigator.language || "").toLowerCase().indexOf("zh") === 0;
    // CSSOS_WAVE_587 — 双向计数: 🌐=当前声线有几种语言(bar.dataset.nLang); 🎤=当前语言有几种声线(nVoice)。
    // render() 已算好写进 dataset; 拿不到才回落到 DOM cell 计数。
    var nLang = Number(bar.dataset.nLang || 0) || bar.querySelectorAll(".cssos-cell-lang").length;
    var nVoice = Number(bar.dataset.nVoice || 0) || bar.querySelectorAll(".cssos-cell-voice").length;
    [].slice.call(caps).forEach(function (b) {
      var mode = b.dataset.mode;
      var ico = b.querySelector(".cssos-mode-ico");
      var nm = b.querySelector(".lang-name");
      var nn = b.querySelector(".cssos-mode-n");
      if (mode === "lang") { ico.textContent = "🌐"; nm.textContent = zh ? "多语言" : "Languages"; nn.textContent = nLang > 1 ? ("· " + nLang) : ""; }
      else { ico.textContent = "🎤"; nm.textContent = zh ? "多声线" : "Voices"; nn.textContent = nVoice > 1 ? ("· " + nVoice) : ""; }
      b.classList.toggle("active", curMode() === mode);
      // CSSOS_WAVE_678f — 两个头【永远都显】: 未激活头是宪法凹咬编排的主角(咬向激活组), 不可隐藏。
      b.classList.remove("cssos-cap-hidden");
      // CSSOS_WAVE_587c — 短 title(长串原生 tooltip 浮在轨道上很乱, 见图2)。
      b.title = mode === "lang" ? (zh ? "多语言" : "Languages") : (zh ? "多声线" : "Voices");
    });
  }
  // CSSOS_WAVE_678c 胶囊宪法 v2 — 统一凹咬模型(本条由 paintConcave 全权控制, 全局凹凸已跳过本 bar)。
  // 规则(Jing 定): 激活 cell 永远排最前(头保持 Languages|Voices 固定序); 被两激活夹住的未激活头=实心被抱;
  // 相邻两激活=合并实心(无分隔, 靠图标); 边缘未激活凹向相邻激活; 其余未激活 cell 一律向左凹(包左邻)。
  function paintConcave(bar) {
    if (!bar) return;
    var caps = [].slice.call(bar.querySelectorAll("button.cssos-mode-cap"));
    var langCap = null, voiceCap = null;
    caps.forEach(function (c) { if (c.dataset.mode === "lang") langCap = c; else if (c.dataset.mode === "voice") voiceCap = c; });
    var activeHead = curMode() === "lang" ? langCap : voiceCap;
    var inactiveHead = curMode() === "lang" ? voiceCap : langCap;
    // 可见头(固定 lang,voice 序)。
    var heads = caps.filter(function (c) { return !c.classList.contains("cssos-cap-hidden"); });
    var expanded = (_expanded === "lang" || _expanded === "voice");
    // 展开轨可见 cell(含本模式 cell + 共享 want-guide), 激活 cell 提到最前。
    var cells = [];
    if (expanded) {
      var sel = _expanded === "lang" ? ".cssos-cell-lang,.cssos-want-guide" : ".cssos-cell-voice,.cssos-want-guide";
      cells = [].slice.call(bar.querySelectorAll("button" + sel));
      cells.sort(function (a, b) {
        return (a.classList.contains("active") ? 0 : 1) - (b.classList.contains("active") ? 0 : 1);
      });
    }
    var order = heads.concat(cells);
    // CSSOS_WAVE_678n — 幂等护栏(根治"整条轨道抖动"): 算出当前状态签名, 与上次相同就【直接返回, 不写任何
    // style/class】→ 任何反复调用(applyState/observer/其它)都不再触发重排 → 不抖。仅状态真变时才重绘一次。
    var sig = curMode() + "|" + _expanded + "|" + order.map(function (p) {
      if (p.classList.contains("cssos-mode-cap")) return "C" + p.dataset.mode + (p === activeHead ? "*" : "");
      return "X" + (p.dataset.lang || "") + "/" + (p.dataset.voice || "") + (p.classList.contains("active") ? "*" : "") + (p.className.indexOf("want-guide") >= 0 ? "g" : "");
    }).join(",");
    if (bar.__ccSig === sig) return;
    bar.__ccSig = sig;
    // 状态变了 → 清旧标记 + 内联 order/z, 重绘一次。
    var all = [].slice.call(bar.querySelectorAll("button.cssos-cell,button.cssos-mode-cap"));
    all.forEach(function (p) {
      p.classList.remove("cssos-cc-left", "cssos-cc-right", "cssos-cc-solid", "cssos-cc-merge-l", "cssos-cc-merge-m", "cssos-cc-merge-r");
      p.style.order = ""; p.style.zIndex = "";
    });
    if (!order.length) return;
    // 视觉顺序(z 在分类后按角色定, 见 setZ)。
    order.forEach(function (p, i) { p.style.order = String(i); });
    // 按角色分层 z: 被抱/合并实心(cc-solid)最高, cc-left 次之(链内左高右低), cc-right 最低 →
    // 包者永远在被包者之下, 碗口才能让邻居完整露出(修"选别的语言时 Voices 又被盖"的真凶)。
    function setZ() {
      order.forEach(function (p, i) {
        var z = 100 - i; // 默认/cc-right: 最低层
        if (p.classList.contains("cssos-cc-solid") ||
            p.classList.contains("cssos-cc-merge-l") || p.classList.contains("cssos-cc-merge-m") || p.classList.contains("cssos-cc-merge-r")) z = 1000 - i;
        else if (p.classList.contains("cssos-cc-left")) z = 500 - i;
        p.style.zIndex = String(z);
      });
    }

    function isActive(p) {
      if (!p) return false;
      if (p.classList.contains("cssos-mode-cap")) return p === activeHead;
      return p.classList.contains("active");
    }
    if (!expanded) {
      // v1(只有头): 未激活头凹向激活头。
      order.forEach(function (p) {
        if (p === activeHead) { p.classList.add("cssos-cc-solid"); return; }
        if (p === inactiveHead) {
          var ai = order.indexOf(activeHead), ii = order.indexOf(p);
          p.classList.add(ii > ai ? "cssos-cc-left" : "cssos-cc-right");
        }
      });
      setZ();
      return;
    }
    // v2(展开): 逐胶囊。
    var iiHead = order.indexOf(inactiveHead);
    order.forEach(function (p, i) {
      var left = order[i - 1], right = order[i + 1];
      var la = isActive(left), ra = isActive(right), me = isActive(p);
      if (me) {
        if (la && ra) p.classList.add("cssos-cc-merge-m");         // 激活连续段中部 → 两侧削平
        else if (ra) p.classList.add("cssos-cc-merge-l");          // 激活段左端 → 左圆右平
        else if (la) p.classList.add("cssos-cc-merge-r");          // 激活段右端 → 左平右圆
        else if (iiHead >= 0 && iiHead > i) p.classList.add("cssos-cc-right"); // 孤立激活, 未激活头在右 → 右凹抱它
        else if (iiHead >= 0 && iiHead < i) p.classList.add("cssos-cc-left");  // 未激活头在左 → 左凹抱它
        else p.classList.add("cssos-cc-solid");
      } else if (p === inactiveHead) {
        if (la && ra) p.classList.add("cssos-cc-solid");           // 被两激活夹住 → 实心被抱
        else if (ra) p.classList.add("cssos-cc-right");            // 右邻激活 → 右凹抱
        else p.classList.add("cssos-cc-left");                     // 否则向左凹
      } else {
        p.classList.add("cssos-cc-left");                          // 未激活 cell 一律向左凹(包左邻)
      }
    });
    setZ();
  }

  function enhance() {
    var bar = document.getElementById("watch-language-pill");
    if (!bar) return;
    injectStyle();
    // 胶囊宪法: cell 轨道容器。
    bar.setAttribute("data-pill-bar", "");
    bar.setAttribute("data-pill-compact", "");
    bar.setAttribute("data-pill-mono", "");
    bar.style.position = "static";
    bar.style.transform = "none";
    bar.style.left = "auto";
    // 外层单行包装: [模式胶囊][cell 轨道]。
    var fold = document.getElementById("cssos-lang-fold");
    if (!fold) {
      fold = document.createElement("div");
      fold.id = "cssos-lang-fold";
      bar.parentNode.insertBefore(fold, bar);
      fold.appendChild(bar);
    }
    // CSSOS_WAVE_1110 — Jing「胶囊总跑中央/浮在视频上」真正根治。探针实锤: bar 的父常是 .watch-screen
    //   (不是 fold)。两个 owner 打架: mv-language-pill 把 bar 造成 absolute 挂 .watch-screen, 本函数旧码
    //   只在【首次建 fold】时 fold.appendChild(bar) → fold 已存在但 bar 被甩回 .watch-screen 时不再收编,
    //   bar 留在 .watch-screen 被其居中布局推到正中。改: 每次 enhance 都【强制把 bar 收回 fold】, 并撕掉
    //   W437 残留的 absolute 内联 → bar 永远 static 待在 fold → fold 进底部栈 = 老实做"中间一行"。
    if (bar.parentNode !== fold) fold.appendChild(bar);
    ["position", "left", "right", "top", "bottom", "transform"].forEach(function (p) {
      try { bar.style.removeProperty(p); } catch (_e) {}
    });
    // CSSOS_WAVE_862 — Jing「不是各自在自己的 div 吗? 为什么打架?」根治: 撤掉 W857 的 absolute 钉死。
    // 多语言行交给 app.watch-bottom-stack.js 收编为底部 flex 列子元素(单一 owner), 它会 appendChild 进
    // #cssos-watch-bottomflow 并 makeFlowChild(static), 浏览器原生排在价格条上方一行 → 永不重叠。
    // 这里【绝不】再设 position/left/bottom/transform(两个 owner = W760 之前的「都绝对定位必打架」老路)。
    // CSSOS_WAVE_669 — Jing「取消 hover 展开轨道, 改成点击才展开」: 撤掉桌面 hover(mouseenter/leave)
    // 自动展开/收回。展开统一走【点击模式胶囊「多语言/多声线」】(ensureModeSwitch 里已有, 桌面/移动一致):
    // 点一下展开该模式轨道, 再点收回, 选中真实 cell 自动收回。鼠标划过不再立刻弹轨道。
    /* (原 W587 hover 展开逻辑已移除) */
    // CSSOS_WAVE_587c — 选了某颗真实 cell(非引导胶囊) → 收回折叠(回到两胶囊)。委托一次即可(bar 元素常驻)。
    if (bar.dataset.collapseWired !== "1") {
      bar.dataset.collapseWired = "1";
      bar.addEventListener("click", function (e) {
        var cell = e.target && e.target.closest && e.target.closest("button.cssos-cell");
        if (!cell) return;
        if (cell.classList.contains("cssos-lang-guide") || cell.classList.contains("cssos-voice-guide") || cell.classList.contains("cssos-want-guide")) return;
        _expanded = "none";
        var f = document.getElementById("cssos-lang-fold");
        if (f) applyState(f);
      }, false);
    }
    ensureModeSwitch(fold, bar);
    applyState(fold);
    // CSSOS_WAVE_678c — 选 cell(switchToLanguage→render 改 .active)/重渲染后, 重算凹咬 + 激活前置。
    // 全局凹凸已跳过本 bar, 故本条自带观察器保活(防抖)。幂等。
    if (bar.dataset.ccObserved !== "1") {
      bar.dataset.ccObserved = "1";
      var _ccT = null, _ccObs = null;
      // CSSOS_WAVE_678L — 只监听 childList(cell 重建/重渲染才重算; 选歌走 render 重建会触发)。
      // 【绝不监听 class】: paintConcave 自己改 class → 若监听 class 会自我回灌 → 反复重绘 = "Want an MV"等闪烁。
      var _ccOpts = { childList: true, subtree: true };
      var _ccGo = function () {
        if (_ccT) return;
        _ccT = setTimeout(function () {
          _ccT = null;
          try { if (_ccObs) _ccObs.disconnect(); } catch (_e) {}   // 断开防自触发(paintConcave 改 class)
          try { paintConcave(bar); } catch (_e) {}
          try { if (_ccObs) _ccObs.observe(bar, _ccOpts); } catch (_e) {}
        }, 60);
      };
      try { _ccObs = new MutationObserver(_ccGo); _ccObs.observe(bar, _ccOpts); } catch (_e) {}
    }

    // ── cell 标签重排(语言 cell=国旗+语言名; 声线 cell=声线 glyph+声线名) ──
    var cells = bar.querySelectorAll("button.cssos-cell");
    cells.forEach(function (p) {
      var lang = p.dataset.lang || "";
      var voice = p.dataset.voice || "auto";
      var isVoice = p.classList.contains("cssos-cell-voice");
      if (!p.getAttribute("data-pill-key")) {
        p.setAttribute("data-pill-key", (isVoice ? "v-" : "l-") + lang + "-" + voice);
      }
      var glyph, label, tip;
      if (isVoice) {
        // CSSOS_WAVE_587 — 「原声(auto)」用作品真实声线名显示(如中文女声→「女声」); 未知才退回「原声」。
        var ov = String(bar.dataset.originVoice || "").toLowerCase();
        var effVoice = (voice === "auto" && ov) ? ov : voice;
        glyph = voiceGlyph(effVoice); label = voiceName(effVoice); tip = label + " · " + nameFor(lang);
      }
      else { glyph = flagFor(lang); label = nameFor(lang); tip = label; }
      // CSSOS_WAVE_678p — 二维交叉计数(Jing): 语言 cell 标【有几声线 N🎤】, 声线 cell 标【有几语言 N🌐】。
      // 计数由 mv-language-pill 存进 dataset.xcount/xkind(重排不丢), 这里读出补一个 .cssos-xcount 小 span。仅 >1 显示。
      var xc = parseInt(p.dataset.xcount || "0", 10) || 0;
      var xglyph = p.dataset.xkind === "lang" ? "🌐" : "🎤";
      var xtxt = xc > 1 ? (xc + xglyph) : "";
      var sig = glyph + "|" + label + "|" + xtxt;
      if (p.dataset.cellSig !== sig) {
        p.dataset.cellSig = sig;
        p.innerHTML = "";
        var fs = document.createElement("span"); fs.className = "lang-flag"; fs.textContent = glyph;
        var ls = document.createElement("span"); ls.className = "lang-name"; ls.textContent = label;
        p.appendChild(fs); p.appendChild(ls);
        if (xtxt) { var xs = document.createElement("span"); xs.className = "cssos-xcount"; xs.textContent = xtxt; p.appendChild(xs); }
      }
      p.title = tip + (xc > 1 ? " · " + xtxt : "");
    });
    // ── 上下文引导胶囊(胶囊宪法 v2 / CSSOS_WAVE_678) ──
    // 作者: 两颗各模式引导(语言模式➕加语言 / 声线模式🎤加声线), 由门控按模式 show/hide。
    // 非作者: 只一颗共享「✨ Want an MV like this」(class cssos-want-guide, 不带 lang/voice 类),
    //         任一展开模式都显这一颗 → 根治"两个重复 Want an MV"。
    var zh = String(document.documentElement.lang || navigator.language || "").toLowerCase().indexOf("zh") === 0;
    var own = resolveOwn();
    function mkGuide(cls, key, glyph, label, tip, onClick) {
      var g = bar.querySelector("." + key);
      if (!g) {
        g = document.createElement("button"); g.type = "button"; g.className = cls + " " + key;
        g.setAttribute("data-pill-key", key);
        g.innerHTML = '<span class="lang-flag"></span><span class="lang-name"></span>';
        // CSSOS_WAVE_678k — guide 点击铁布衫: 拦住 pointer/touch/click 冒泡(防触发 watch 暂停/折叠),
        // preventDefault 防默认, 然后可靠执行 onClick(打开创作面板)。
        ["pointerdown", "pointerup", "mousedown", "touchstart", "touchend"].forEach(function (ev) {
          g.addEventListener(ev, function (e) { e.stopPropagation(); }, false);
        });
        g.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); onClick(); }, false);
        bar.appendChild(g);
      } else { g.className = cls + " " + key; }
      g.querySelector(".lang-flag").textContent = glyph;
      g.querySelector(".lang-name").textContent = label;
      g.title = tip;
      return g;
    }
    function rm(sel) { var el = bar.querySelector(sel); if (el) el.remove(); }
    // CSSOS_WAVE_678k — Jing「Want an MV 一直不工作; 要弹 MV 管线/AI 助理, 别触发暂停」。
    // invokeUniversalCreationEntry 全站从未定义 → 旧主路径恒为空操作。改为直接打开 MV 管线
    //(open-shim 会懒加载 mv-pipeline 模块再开), 失败兜底点 AI 助理 FAB。不暂停当前播放。
    // CSSOS_WAVE_679c — Jing 铁律: MV 面板内打开的任何东西(MV 管线/AI 助理)都必须【高于媒体】, 否则被影院
    // 媒体框盖住 = 看着没反应。开面板后把它 z 抬到 watch popover(10055)之上 + display 强制可见(懒加载→重试)。
    var raiseAboveMedia = function (sel, tries) {
      var el = document.querySelector(sel);
      if (el) {
        el.style.zIndex = "10060";
        if (getComputedStyle(el).display === "none") el.style.display = "flex";
        el.style.visibility = "visible"; el.style.opacity = "1";
        return true;
      }
      if (tries > 0) setTimeout(function () { raiseAboveMedia(sel, tries - 1); }, 120);
      return false;
    };
    var makeOwnMv = function () {
      try {
        if (typeof globalThis.openMvPipelinePanel === "function") {
          globalThis.openMvPipelinePanel({ focus: true, forceNew: true });
          raiseAboveMedia("#cssmv-panel", 25); // 懒加载完成前重试 ~3s
          return;
        }
      } catch (_e) {}
      try { var fab = document.getElementById("cssos-agent-fab"); if (fab) { fab.click(); raiseAboveMedia("#cssos-agent-panel", 15); return; } } catch (_e) {}
      try { if (typeof globalThis.cssosLoadPanel === "function") globalThis.cssosLoadPanel("mv-pipeline").then(function () { raiseAboveMedia("#cssmv-panel", 25); }); } catch (_e) {}
    };
    if (own.isOwn) {
      rm(".cssos-want-guide"); // 作者不显共享引导
      mkGuide("cssos-cell cssos-cell-lang", "cssos-lang-guide", "➕",
        zh ? "添加更多语言" : "Add a language",
        zh ? "为这首作品添加多一种语言" : "Add another language to this MV",
        function () { var o = resolveOwn(); if (o.wid && typeof globalThis.cssosOpenAddLanguageModal === "function") globalThis.cssosOpenAddLanguageModal(o.wid); else makeOwnMv(); });
      mkGuide("cssos-cell cssos-cell-voice", "cssos-voice-guide", "🎤",
        zh ? "添加更多声线" : "Add a voice",
        zh ? "为这首作品添加多一种声线(旋律不变, 换声线重唱)" : "Add another voice (same melody, re-sung)",
        function () { var o = resolveOwn(); if (o.wid && typeof globalThis.cssosOpenAddVoiceModal === "function") globalThis.cssosOpenAddVoiceModal(o.wid); else makeOwnMv(); });
    } else {
      rm(".cssos-lang-guide"); rm(".cssos-voice-guide"); // 非作者去掉两颗重复, 只留一颗
      mkGuide("cssos-cell", "cssos-want-guide", "✨",
        zh ? "想要这样的MV?" : "Want an MV like this",
        zh ? "创作你自己的 MV" : "Create your own MV like this",
        makeOwnMv);
    }

    paintModeSwitch(bar);

    // CSSOS_WAVE_588 — 左凹统一: 不再用本组件自己的 .cssos-laft(会与全局兜底 .cssos-pill-laft 双重咬合)。
    // 改为完全交给全局 app.pill-left-concave.js(已统一取【最右 active】作锚点)。这里只清掉历史遗留的 .cssos-laft。
    [].forEach.call(bar.querySelectorAll("button.cssos-laft"), function (p) { p.classList.remove("cssos-laft"); });
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; try { enhance(); } catch (_e) {} }, 120);
  }
  function start() {
    var host = document.getElementById("watch-panel") || document.body;
    try { new MutationObserver(schedule).observe(host, { childList: true, subtree: true }); } catch (_e) {}
    schedule();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else { start(); }
})();
