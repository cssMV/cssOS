/* app.actor-stage.js — CSSOS_WAVE_2120 20260920
 *
 * Jing:「虚拟演播厅不应该是统一的风格, 而是根据数字演员的时代/风格而设计不同的,
 *        比如妲己的演播厅, 就是根据妲己的实际情况风格设计。」
 *
 * ── 这不是一个新系统, 是文明智能联动的第六个面 ──────────────────────────
 * civilization 已经在驱动曲风、唱腔、歌词语言、乐器、年代。演播厅是同一条法则:
 * 同一个 civilization, 同一套光。所以这个文件的形状刻意照抄
 * app.civ-language-map.js —— 有序子串匹配, 先具体后笼统, 未命中返回空、由调用方回退。
 *
 * ── 演播厅【早就存在】, 这一波只是把写死的颜色换成变量 ────────────────────
 * W1641 已经做了「纯 CSS 抽象演播厅背景(零成本)」: 顶光 + 双侧色光 + 地面渐变。
 * 一间厅本来就只是【4 盏灯 + 1 块地】。所以「每位演员一间自己的厅」不需要生成任何图片,
 * 只需要 10 个数字。零成本, 而且天生可共享 —— 换人只换 portrait 层, 光照参数照常生效。
 *
 * ── 零回归的做法 ────────────────────────────────────────────────────────
 * CSS 里每个 var() 的 fallback 都写成【今天那个一模一样的值】。
 * 所以本模块没加载、没命中、或者出任何错, 屏幕上与改动前【逐字节相同】。
 * 这是故意的: 面对面是 Jing 每天在看的界面, 不接受「我以为没影响」。
 */
(function () {
  "use strict";
  if (globalThis.cssosStageForActor) return;

  /* 今天那一组(W1641 原值)。既是兜底, 也是「通用演播厅」本身 —— 原创演员没有
   * civilization 时用它, 观感与改动前完全一致。 */
  var BASE = {
    id: "hall-default",
    title_zh: "通用演播厅", title_en: "House stage",
    key:   "rgba(0,245,160,0.13)",
    left:  "rgba(70,130,220,0.11)",
    right: "rgba(180,70,170,0.10)",
    bg:    ["#0a1712", "#05100c", "#020906"],
    floor: "rgba(0,245,160,0.045)"
  };

  /* 按 civilization 分的厅。先具体后笼统 —— 匹配是子串, 顺序决定谁先中。
   * 每一组的三盏灯都有【叙事理由】, 不是随手挑的好看颜色:
   * 顶光 = 这个文明的主光源(火把/烛台/天光/霓虹), 左右两盏 = 一对张力。 */
  var CIV_HALLS = [
    /* 中华神话 —— 商周之前的神话时空。青铜火光 vs 冷玉月光, 两不相融。 */
    { match: ["中华神话", "中華神話", "Chinese Mythology"], rig: {
      id: "hall-shang-bronze", title_zh: "青铜 · 神话时空", title_en: "Bronze mythic hall",
      key: "rgba(214,158,74,0.17)", left: "rgba(126,158,150,0.10)", right: "rgba(178,58,38,0.15)",
      bg: ["#16110c", "#0c0806", "#050302"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-cacd74a1bec2e3ccdf7cac35.webp",
      floor: "rgba(214,158,74,0.055)" } },

    /* 中华文明 —— 文人的厅: 墨、绢、宣纸。灯是烛与月, 不是火把。 */
    { match: ["中华文明", "中華文明", "中国古代", "先秦", "汉朝", "唐朝", "宋朝", "明朝", "清朝",
              "Chinese Civilization", "Ancient China"], rig: {
      id: "hall-ink-court", title_zh: "墨色 · 文人厅", title_en: "Ink scholar hall",
      key: "rgba(196,180,150,0.14)", left: "rgba(84,120,132,0.13)", right: "rgba(168,140,104,0.09)",
      bg: ["#101211", "#0a0c0c", "#040606"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-d48deae01e29d83bc35fe17d.webp",
      floor: "rgba(180,170,145,0.05)" } },

    /* 日本神话 —— 狐火。青绿的鬼火 vs 提灯的橙。 */
    { match: ["日本神话", "日本神話", "Japanese Mythology"], rig: {
      id: "hall-foxfire", title_zh: "狐火 · 异界", title_en: "Fox-fire hall",
      key: "rgba(190,160,90,0.14)", left: "rgba(90,200,170,0.15)", right: "rgba(150,90,160,0.09)",
      bg: ["#0a1310", "#060d0b", "#030706"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-e8c7ca7e488c98fedf026b7b.webp",
      floor: "rgba(90,200,170,0.05)" } },

    /* 日本古典 —— 平安/室町的室内: 障子纸的漫射天光, 榻榻米。 */
    { match: ["日本古典", "日本文明", "Japanese Classical", "Heian"], rig: {
      id: "hall-shoji", title_zh: "障子 · 素白厅", title_en: "Shoji hall",
      key: "rgba(228,220,198,0.13)", left: "rgba(190,150,120,0.08)", right: "rgba(120,140,130,0.10)",
      bg: ["#12110e", "#0b0a08", "#040404"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-5672e49a7e1b2a47439f4823.webp",
      floor: "rgba(210,200,178,0.045)" } },

    { match: ["朝鲜古典", "朝鮮", "Joseon", "Korean"], rig: {
      id: "hall-dancheong", title_zh: "丹青 · 宫阙", title_en: "Dancheong hall",
      key: "rgba(200,170,120,0.14)", left: "rgba(170,80,80,0.09)", right: "rgba(70,130,150,0.13)",
      bg: ["#0f1113", "#090b0c", "#040506"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-dc6482848fcb0543fa9a2a71.webp",
      floor: "rgba(190,165,125,0.05)" } },

    /* 北欧神话 —— 半明半暗, 极夜。冰蓝为主, 没有暖色。 */
    { match: ["北欧神话", "北歐", "Norse", "Nordic"], rig: {
      id: "hall-halflight", title_zh: "半明半暗 · 极夜", title_en: "Half-light hall",
      key: "rgba(170,200,220,0.12)", left: "rgba(40,50,62,0.11)", right: "rgba(60,90,120,0.16)",
      bg: ["#0b1014", "#070b0e", "#030506"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-e659c0d472a30f01eecac319.webp",
      floor: "rgba(150,180,200,0.045)" } },

    { match: ["古希腊神话", "古希腊", "Greek"], rig: {
      id: "hall-marble", title_zh: "白石 · 日照", title_en: "Marble hall",
      key: "rgba(232,222,196,0.15)", left: "rgba(206,160,96,0.09)", right: "rgba(96,140,160,0.12)",
      bg: ["#12120f", "#0b0b09", "#040404"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-06ca412845dfe7eacab41531.webp",
      floor: "rgba(224,214,188,0.05)" } },

    { match: ["古罗马文明", "古罗马", "Roman"], rig: {
      id: "hall-porphyry", title_zh: "斑岩 · 列柱", title_en: "Porphyry hall",
      key: "rgba(216,186,130,0.15)", left: "rgba(140,52,58,0.13)", right: "rgba(120,130,140,0.09)",
      bg: ["#130f0e", "#0c0908", "#040303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-4e0339262d9b1b8638c9626c.webp",
      floor: "rgba(210,180,126,0.05)" } },

    { match: ["古埃及神话", "古埃及", "Egypt"], rig: {
      id: "hall-sandstone", title_zh: "砂岩 · 长日", title_en: "Sandstone hall",
      key: "rgba(228,186,108,0.16)", left: "rgba(70,130,140,0.09)", right: "rgba(178,120,60,0.13)",
      bg: ["#151109", "#0d0a06", "#050403"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-f2b00fd3e16b1a826e14ca4e.webp",
      floor: "rgba(226,186,110,0.055)" } },

    { match: ["美索不达米亚", "Mesopotamia", "Sumer", "Babylon"], rig: {
      id: "hall-ziggurat", title_zh: "泥砖 · 星台", title_en: "Ziggurat hall",
      key: "rgba(206,170,110,0.14)", left: "rgba(150,90,60,0.13)", right: "rgba(90,110,150,0.10)",
      bg: ["#131009", "#0b0906", "#040303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-90d68f3241328e111d0c4083.webp",
      floor: "rgba(200,168,112,0.05)" } },

    { match: ["波斯文明", "波斯", "Persia", "Zoroastr"], rig: {
      id: "hall-lapis", title_zh: "青金 · 拜火", title_en: "Lapis fire hall",
      key: "rgba(226,170,80,0.15)", left: "rgba(50,80,170,0.14)", right: "rgba(180,70,60,0.09)",
      bg: ["#0b0d16", "#07080e", "#030305"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-99cf37509465c6640c4d5810.webp",
      floor: "rgba(220,170,88,0.05)" } },

    { match: ["阿拉伯文明", "阿拉伯", "Arab", "Islamic"], rig: {
      id: "hall-muqarnas", title_zh: "钟乳拱 · 灯影", title_en: "Muqarnas hall",
      key: "rgba(222,190,124,0.15)", left: "rgba(60,120,120,0.13)", right: "rgba(150,120,80,0.09)",
      bg: ["#101109", "#0a0a06", "#040403"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-5b00c0cac3b22e10590bdac0.webp",
      floor: "rgba(216,186,124,0.05)" } },

    { match: ["印度教神话", "印度神话", "Hindu"], rig: {
      id: "hall-temple-lamp", title_zh: "庙灯 · 浓彩", title_en: "Temple lamp hall",
      key: "rgba(232,164,72,0.17)", left: "rgba(70,140,120,0.10)", right: "rgba(180,50,90,0.14)",
      bg: ["#150e0a", "#0d0806", "#050303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-532433fc14460750791e6f8d.webp",
      floor: "rgba(230,166,76,0.055)" } },

    { match: ["印度文明", "India"], rig: {
      id: "hall-sandal", title_zh: "檀香 · 静室", title_en: "Sandalwood hall",
      key: "rgba(226,190,130,0.14)", left: "rgba(110,140,120,0.09)", right: "rgba(170,110,70,0.12)",
      bg: ["#12100b", "#0b0907", "#040403"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-423806e030e88cd2c99f3927.webp",
      floor: "rgba(220,188,132,0.05)" } },

    { match: ["希伯来文明", "希伯来", "Hebrew"], rig: {
      id: "hall-first-light", title_zh: "初光 · 旷远", title_en: "First light hall",
      key: "rgba(236,226,200,0.15)", left: "rgba(120,130,120,0.11)", right: "rgba(190,170,130,0.08)",
      bg: ["#101110", "#0a0b0a", "#040404"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-d3f376eee06fcb86d0034dfd.webp",
      floor: "rgba(230,220,196,0.045)" } },

    { match: ["凯尔特文明", "凯尔特", "Celtic", "Welsh"], rig: {
      id: "hall-mist-harp", title_zh: "雾 · 竖琴", title_en: "Mist harp hall",
      key: "rgba(186,204,190,0.13)", left: "rgba(70,110,90,0.13)", right: "rgba(150,140,110,0.08)",
      bg: ["#0c100d", "#070a08", "#030504"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-3ef5c2da6d9a0da74d49b6cf.webp",
      floor: "rgba(180,200,186,0.045)" } },

    { match: ["斯拉夫神话", "斯拉夫", "Slavic"], rig: {
      id: "hall-black-choir", title_zh: "黑木 · 合唱", title_en: "Black timber hall",
      key: "rgba(180,170,160,0.11)", left: "rgba(90,70,90,0.14)", right: "rgba(60,80,90,0.10)",
      bg: ["#0d0c0e", "#080809", "#030304"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-7ca0d07315cbaa5301b09c9d.webp",
      floor: "rgba(160,152,146,0.04)" } },

    { match: ["文艺复兴欧洲", "文艺复兴", "Renaissance"], rig: {
      id: "hall-chiaroscuro", title_zh: "明暗 · 画室", title_en: "Chiaroscuro hall",
      key: "rgba(224,186,120,0.16)", left: "rgba(130,60,50,0.12)", right: "rgba(90,100,110,0.08)",
      bg: ["#120e0a", "#0b0806", "#040303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-a9d854d7b41f5ea1645972e2.webp",
      floor: "rgba(218,182,122,0.05)" } },

    { match: ["启蒙欧洲", "启蒙", "Enlightenment", "Versailles"], rig: {
      id: "hall-gilded", title_zh: "镀金 · 将倾", title_en: "Gilded hall",
      key: "rgba(230,190,110,0.17)", left: "rgba(200,120,130,0.12)", right: "rgba(180,160,200,0.08)",
      bg: ["#14100c", "#0d0a08", "#050403"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-12614b3c170f322508851014.webp",
      floor: "rgba(230,190,112,0.05)" } },

    { match: ["近现代欧洲", "近现代科学", "Modern Science"], rig: {
      id: "hall-chalkboard", title_zh: "黑板 · 台灯", title_en: "Chalk and lamp hall",
      key: "rgba(216,206,182,0.13)", left: "rgba(80,110,130,0.12)", right: "rgba(170,150,110,0.08)",
      bg: ["#0e100f", "#080a09", "#030404"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-845b6c7ae0b1455c398cc179.webp",
      floor: "rgba(206,198,178,0.045)" } },

    { match: ["近代欧洲", "西方文明", "European", "Western"], rig: {
      id: "hall-candlewax", title_zh: "烛蜡 · 长廊", title_en: "Candlewax hall",
      key: "rgba(222,190,138,0.14)", left: "rgba(120,110,90,0.08)", right: "rgba(100,80,110,0.12)",
      bg: ["#110f0d", "#0a0908", "#040303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-62199d078db273b38fb2877e.webp",
      floor: "rgba(216,186,138,0.05)" } },

    { match: ["葡萄牙", "Portug", "巴西", "Brazil"], rig: {
      id: "hall-atlantic", title_zh: "大西洋 · 黄昏", title_en: "Atlantic dusk hall",
      key: "rgba(226,178,126,0.14)", left: "rgba(60,100,130,0.14)", right: "rgba(190,130,110,0.09)",
      bg: ["#0d1013", "#08090c", "#030405"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-d398a77f5530abab640e1e83.webp",
      floor: "rgba(214,176,132,0.05)" } },

    { match: ["阿兹特克", "Aztec", "玛雅", "Maya", "安第斯", "Andean"], rig: {
      id: "hall-obsidian", title_zh: "黑曜 · 羽饰", title_en: "Obsidian hall",
      key: "rgba(214,170,90,0.15)", left: "rgba(160,60,60,0.10)", right: "rgba(40,130,110,0.14)",
      bg: ["#0c100e", "#070a09", "#030404"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-9fd603a79c642517bdd43875.webp",
      floor: "rgba(206,166,94,0.05)" } },

    /* ── 原创/架空系(演员表里真有这几类) ── */
    { match: ["Cyberpunk", "赛博"], rig: {
      id: "hall-neon-rain", title_zh: "霓虹 · 雨", title_en: "Neon rain hall",
      key: "rgba(120,220,240,0.14)", left: "rgba(60,120,240,0.11)", right: "rgba(230,60,150,0.15)",
      bg: ["#080c12", "#05080c", "#020305"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-04f5c6a7a9803563b955fccf.webp",
      floor: "rgba(110,210,235,0.05)" } },
    { match: ["Neo-Futurist", "未来"], rig: {
      id: "hall-lab", title_zh: "实验室 · 冷光", title_en: "Cold lab hall",
      key: "rgba(200,230,240,0.13)", left: "rgba(60,150,170,0.12)", right: "rgba(90,110,140,0.09)",
      bg: ["#090d0f", "#06090a", "#020404"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-de64f900056efaf78dbe9c97.webp",
      floor: "rgba(190,224,236,0.045)" } },
    { match: ["Dark Fantasy", "黑暗奇幻"], rig: {
      id: "hall-ashen", title_zh: "灰烬 · 王座", title_en: "Ashen hall",
      key: "rgba(190,170,150,0.12)", left: "rgba(150,50,40,0.14)", right: "rgba(70,60,80,0.10)",
      bg: ["#100d0c", "#0a0807", "#040303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-9b4019b360eba6ea687b7a87.webp",
      floor: "rgba(180,160,142,0.045)" } },
    { match: ["Dark Carnival", "马戏"], rig: {
      id: "hall-carnival", title_zh: "游艺 · 歪斜", title_en: "Carnival hall",
      key: "rgba(240,180,80,0.16)", left: "rgba(200,50,110,0.15)", right: "rgba(90,180,140,0.10)",
      bg: ["#120a0e", "#0b0609", "#040204"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-638718fc9c55037f438aa9e7.webp",
      floor: "rgba(236,176,84,0.055)" } },
    { match: ["Noir", "黑色电影"], rig: {
      id: "hall-venetian", title_zh: "百叶 · 冷烟", title_en: "Venetian blind hall",
      key: "rgba(216,214,206,0.13)", left: "rgba(70,90,110,0.13)", right: "rgba(40,45,55,0.10)",
      bg: ["#0b0c0d", "#070808", "#030303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-702c7873b58f61ba34eb16c9.webp",
      floor: "rgba(200,200,194,0.04)" } },
    /* ── 非洲 ── */
    { match: ["约鲁巴", "Yoruba"], rig: {
      id: "hall-yoruba", title_zh: "铜雕 · 靛蓝", title_en: "Bronze and indigo hall",
      key: "rgba(228,180,90,0.16)", left: "rgba(50,70,160,0.14)", right: "rgba(180,90,60,0.10)",
      bg: ["#0d0f14", "#08090d", "#030305"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-42d832f310b2e005b659f1b2.webp",
      floor: "rgba(224,178,94,0.055)" } },
    { match: ["阿散蒂", "Ashanti", "马里帝国", "Mali"], rig: {
      id: "hall-goldweight", title_zh: "金衡 · 红土", title_en: "Goldweight hall",
      key: "rgba(236,190,90,0.17)", left: "rgba(170,80,50,0.14)", right: "rgba(90,120,80,0.09)",
      bg: ["#140f0a", "#0c0806", "#040303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-50a35bf359caa656e2302fb3.webp",
      floor: "rgba(232,188,94,0.055)" } },
    { match: ["祖鲁", "Zulu"], rig: {
      id: "hall-shield", title_zh: "牛皮盾 · 草原", title_en: "Hide shield hall",
      key: "rgba(224,196,140,0.15)", left: "rgba(150,70,50,0.13)", right: "rgba(90,110,70,0.10)",
      bg: ["#110f0b", "#0a0907", "#040403"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-fb5ed08ed51056a43623ab47.webp",
      floor: "rgba(218,192,142,0.05)" } },
    { match: ["斯瓦希里", "Swahili"], rig: {
      id: "hall-coral-port", title_zh: "珊瑚石 · 季风", title_en: "Coral port hall",
      key: "rgba(230,208,164,0.15)", left: "rgba(50,120,140,0.14)", right: "rgba(190,140,90,0.09)",
      bg: ["#0c1012", "#07090b", "#030405"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-c906f8f07791f106bf45007a.webp",
      floor: "rgba(224,204,166,0.05)" } },
    { match: ["埃塞俄比亚", "Ethiopia", "Axum"], rig: {
      id: "hall-rock-church", title_zh: "凿岩 · 圣堂", title_en: "Rock-hewn hall",
      key: "rgba(222,174,110,0.15)", left: "rgba(140,60,50,0.13)", right: "rgba(90,110,120,0.09)",
      bg: ["#120e0b", "#0b0807", "#040303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-1f32828c2fe442967e520b7f.webp",
      floor: "rgba(216,172,114,0.05)" } },
    { match: ["现代非洲", "非洲", "Africa"], rig: {
      id: "hall-afro-modern", title_zh: "当代非洲 · 烈色", title_en: "Modern Africa hall",
      key: "rgba(240,190,80,0.17)", left: "rgba(60,160,140,0.11)", right: "rgba(200,60,90,0.15)",
      bg: ["#0f0d0c", "#090808", "#030303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-387166034b3f2c7423970613.webp",
      floor: "rgba(236,188,86,0.055)" } },

    /* ── 大洋洲 ── */
    { match: ["波利尼西亚", "Polynesia"], rig: {
      id: "hall-lagoon", title_zh: "礁湖 · 星辰导航", title_en: "Lagoon hall",
      key: "rgba(200,226,226,0.14)", left: "rgba(180,150,100,0.09)", right: "rgba(40,130,150,0.15)",
      bg: ["#081013", "#05090c", "#020405"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-c5faa6464cc3b3d9276a8839.webp",
      floor: "rgba(190,220,222,0.05)" } },
    { match: ["毛利", "Maori", "Māori"], rig: {
      id: "hall-greenstone", title_zh: "绿玉 · 雕纹", title_en: "Greenstone hall",
      key: "rgba(206,200,170,0.14)", left: "rgba(40,120,90,0.15)", right: "rgba(140,70,50,0.10)",
      bg: ["#0a0f0c", "#060908", "#020404"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-00646e064bc42afa801037cd.webp",
      floor: "rgba(200,196,168,0.05)" } },
    { match: ["澳洲原住民", "澳大利亚原住民", "Aborigin"], rig: {
      id: "hall-ochre", title_zh: "赭石 · 旱地", title_en: "Ochre hall",
      key: "rgba(234,178,100,0.16)", left: "rgba(110,90,70,0.09)", right: "rgba(170,80,50,0.14)",
      bg: ["#130e09", "#0b0806", "#040303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-e7f24546a37cc00a1572fe3c.webp",
      floor: "rgba(230,176,104,0.055)" } },

    /* ── 东南亚 ── */
    { match: ["高棉吴哥", "吴哥", "Khmer", "Angkor"], rig: {
      id: "hall-angkor", title_zh: "砂岩塔 · 藤蔓", title_en: "Angkor hall",
      key: "rgba(214,192,140,0.14)", left: "rgba(60,110,80,0.14)", right: "rgba(160,120,80,0.09)",
      bg: ["#0c0f0b", "#070908", "#030404"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-d021c3e375adbf0e61ef576a.webp",
      floor: "rgba(208,188,142,0.05)" } },
    { match: ["缅甸蒲甘", "蒲甘", "缅甸", "Bagan", "Burm", "Myanmar"], rig: {
      id: "hall-pagoda-dawn", title_zh: "塔林 · 晨雾", title_en: "Pagoda dawn hall",
      key: "rgba(236,196,130,0.16)", left: "rgba(150,160,170,0.09)", right: "rgba(180,110,70,0.13)",
      bg: ["#120f0b", "#0b0807", "#040303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-02cdca482ae0da398ce0e0f4.webp",
      floor: "rgba(232,194,134,0.055)" } },
    { match: ["泰国", "暹罗", "Thai", "Siam"], rig: {
      id: "hall-gold-lacquer", title_zh: "金漆 · 朱红", title_en: "Gold lacquer hall",
      key: "rgba(240,198,96,0.17)", left: "rgba(190,60,60,0.14)", right: "rgba(80,140,120,0.09)",
      bg: ["#130d0b", "#0b0707", "#040303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-72b5445636c4c15a47eebede.webp",
      floor: "rgba(236,196,100,0.055)" } },
    { match: ["印尼爪哇", "爪哇", "Java", "Indonesia"], rig: {
      id: "hall-batik", title_zh: "蜡染 · 铜锣", title_en: "Batik gamelan hall",
      key: "rgba(218,180,120,0.15)", left: "rgba(70,120,130,0.09)", right: "rgba(120,70,50,0.14)",
      bg: ["#110e0c", "#0a0807", "#040303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-b0d096274fc9a5e5518c51f1.webp",
      floor: "rgba(212,178,124,0.05)" } },
    { match: ["马来", "Malay"], rig: {
      id: "hall-songket", title_zh: "金线织 · 海港", title_en: "Songket hall",
      key: "rgba(226,194,130,0.15)", left: "rgba(50,110,120,0.14)", right: "rgba(170,120,90,0.09)",
      bg: ["#0c0f10", "#07090a", "#030404"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-a8c8bee3421ce609e6811cd4.webp",
      floor: "rgba(220,190,134,0.05)" } },
    { match: ["菲律宾", "Philippin"], rig: {
      id: "hall-capiz", title_zh: "贝壳窗 · 群岛", title_en: "Capiz shell hall",
      key: "rgba(232,218,190,0.15)", left: "rgba(190,150,110,0.09)", right: "rgba(60,120,140,0.13)",
      bg: ["#0c0f11", "#07090b", "#030405"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-60a8a59b49040ed1b7af440e.webp",
      floor: "rgba(226,214,190,0.05)" } },

    /* ── 内亚 / 高原 ── */
    { match: ["蒙古", "Mongol"], rig: {
      id: "hall-steppe", title_zh: "草原 · 长风", title_en: "Steppe hall",
      key: "rgba(216,206,178,0.14)", left: "rgba(70,100,130,0.14)", right: "rgba(160,120,70,0.09)",
      bg: ["#0d0f11", "#08090b", "#030404"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-5bfc9d41d604b34767a45514.webp",
      floor: "rgba(210,202,178,0.05)" } },
    { match: ["藏文明", "西藏", "Tibet"], rig: {
      id: "hall-thangka", title_zh: "唐卡 · 高原光", title_en: "Thangka hall",
      key: "rgba(238,206,120,0.17)", left: "rgba(50,110,150,0.11)", right: "rgba(170,50,60,0.14)",
      bg: ["#110d0c", "#0a0708", "#040303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-89517c0078215eee3e1e186d.webp",
      floor: "rgba(234,204,124,0.055)" } },
    { match: ["中华佛教神话", "佛教神话", "佛教", "Buddhis"], rig: {
      id: "hall-lotus", title_zh: "莲座 · 金身", title_en: "Lotus hall",
      key: "rgba(234,204,140,0.16)", left: "rgba(110,140,130,0.09)", right: "rgba(150,110,60,0.12)",
      bg: ["#110f0b", "#0a0907", "#040403"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-2e355e1e8e8ce15a51baa8ba.webp",
      floor: "rgba(230,202,144,0.05)" } },

    /* ── 地中海 / 近东补漏 ── */
    { match: ["拜占庭", "Byzan"], rig: {
      id: "hall-mosaic-gold", title_zh: "金底 · 镶嵌", title_en: "Gold mosaic hall",
      key: "rgba(238,200,110,0.17)", left: "rgba(60,80,150,0.13)", right: "rgba(150,60,70,0.09)",
      bg: ["#0f0d10", "#09080a", "#030304"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-bad42a0d74d962de705a45ed.webp",
      floor: "rgba(234,198,114,0.055)" } },
    { match: ["腓尼基", "Phoenic"], rig: {
      id: "hall-tyrian", title_zh: "推罗紫 · 航路", title_en: "Tyrian purple hall",
      key: "rgba(214,186,140,0.14)", left: "rgba(110,50,120,0.14)", right: "rgba(50,110,130,0.10)",
      bg: ["#0c0b10", "#07070a", "#030304"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-621531a99a1995c7edcfc4ca.webp",
      floor: "rgba(208,182,142,0.05)" } },
    { match: ["苏美尔", "托勒密埃及", "埃及"], rig: {
      id: "hall-reed-clay", title_zh: "苇与泥 · 最早的字", title_en: "Reed and clay hall",
      key: "rgba(224,190,132,0.15)", left: "rgba(90,120,140,0.09)", right: "rgba(160,110,60,0.13)",
      bg: ["#12100a", "#0b0907", "#040403"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-ec582742fd054d08f52b7dbe.webp",
      floor: "rgba(218,186,134,0.05)" } },
    { match: ["印加", "Inca"], rig: {
      id: "hall-cusco", title_zh: "巨石 · 高地", title_en: "Cusco stonework hall",
      key: "rgba(224,206,176,0.14)", left: "rgba(150,70,50,0.13)", right: "rgba(60,110,120,0.10)",
      bg: ["#0e0f0e", "#08090a", "#030404"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-e7d15055015a53c639331d19.webp",
      floor: "rgba(218,202,176,0.05)" } },

    /* ── 欧美补漏 ── */
    { match: ["巴洛克", "Baroque"], rig: {
      id: "hall-baroque", title_zh: "巴洛克 · 重帷", title_en: "Baroque hall",
      key: "rgba(228,188,118,0.16)", left: "rgba(80,90,110,0.09)", right: "rgba(120,40,50,0.14)",
      bg: ["#110d0b", "#0a0707", "#040303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-6998085c118a8033ff44c3d0.webp",
      floor: "rgba(222,184,120,0.05)" } },
    { match: ["古典主义欧洲", "古典主义", "Classical Europe"], rig: {
      id: "hall-neoclassic", title_zh: "新古典 · 素白柱", title_en: "Neoclassical hall",
      key: "rgba(234,228,210,0.15)", left: "rgba(100,120,140,0.11)", right: "rgba(190,170,130,0.08)",
      bg: ["#101110", "#0a0b0a", "#040404"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-6605e59f7a88579637bba444.webp",
      floor: "rgba(228,222,206,0.045)" } },
    { match: ["浪漫主义", "Romantic"], rig: {
      id: "hall-romantic", title_zh: "浪漫派 · 风暴天", title_en: "Romantic storm hall",
      key: "rgba(220,196,150,0.14)", left: "rgba(160,90,70,0.10)", right: "rgba(70,80,120,0.15)",
      bg: ["#0d0d10", "#08080a", "#030304"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-f8f2b5e85f6b76709f58f52d.webp",
      floor: "rgba(214,192,152,0.05)" } },
    { match: ["现代北欧", "Scandinav"], rig: {
      id: "hall-nordic-modern", title_zh: "北欧现代 · 素木", title_en: "Nordic modern hall",
      key: "rgba(228,228,224,0.14)", left: "rgba(120,140,150,0.11)", right: "rgba(180,160,130,0.08)",
      bg: ["#0e0f0f", "#090a0a", "#030404"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-126bef81ea5fd021de3bd6bb.webp",
      floor: "rgba(222,222,218,0.045)" } },
    { match: ["近现代北美", "北美", "America"], rig: {
      id: "hall-newworld", title_zh: "新大陆 · 钢与玻璃", title_en: "New world hall",
      key: "rgba(224,222,214,0.14)", left: "rgba(170,140,100,0.09)", right: "rgba(70,110,150,0.13)",
      bg: ["#0c0d0f", "#070809", "#030304"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-6c78e4c0eb46b73a76d07c89.webp",
      floor: "rgba(218,216,210,0.045)" } },

    { match: ["Cosmic", "宇宙"], rig: {
      id: "hall-void", title_zh: "虚空 · 星尘", title_en: "Void hall",
      key: "rgba(150,170,230,0.13)", left: "rgba(110,60,180,0.14)", right: "rgba(40,90,140,0.10)",
      bg: ["#070811", "#04050a", "#010104"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-dbaf1c7595c4073cfebfb9f2.webp",
      floor: "rgba(140,160,220,0.045)" } },

    /* ── 笼统尾巴(必须在最后)──────────────────────────────────────────
     * 实测教训: 生产库里 343 位演员, 第一版有 110 位落回通用厅 —— 因为子串匹配
     * 认得「近代欧洲」却认不得「浪漫主义欧洲」, 认得「印度文明」却认不得「莫卧儿印度」。
     * 「先具体后笼统」这条, 前半截我写了, 后半截忘了写。这几条就是那个后半截。 */
    { match: ["中华", "中国", "华夏"], rig: {
      id: "hall-ink-court", title_zh: "墨色 · 文人厅", title_en: "Ink scholar hall",
      key: "rgba(196,180,150,0.14)", left: "rgba(84,120,132,0.13)", right: "rgba(168,140,104,0.09)",
      bg: ["#101211", "#0a0c0c", "#040606"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-d48deae01e29d83bc35fe17d.webp",
      floor: "rgba(180,170,145,0.05)" } },
    { match: ["印度", "India"], rig: {
      id: "hall-sandal", title_zh: "檀香 · 静室", title_en: "Sandalwood hall",
      key: "rgba(226,190,130,0.14)", left: "rgba(170,110,70,0.12)", right: "rgba(110,140,120,0.09)",
      bg: ["#12100b", "#0b0907", "#040403"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-423806e030e88cd2c99f3927.webp",
      floor: "rgba(220,188,132,0.05)" } },
    { match: ["日本", "Japan"], rig: {
      id: "hall-shoji", title_zh: "障子 · 素白厅", title_en: "Shoji hall",
      key: "rgba(228,220,198,0.13)", left: "rgba(120,140,130,0.10)", right: "rgba(190,150,120,0.08)",
      bg: ["#12110e", "#0b0a08", "#040404"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-5672e49a7e1b2a47439f4823.webp",
      floor: "rgba(210,200,178,0.045)" } },
    { match: ["欧洲", "Europe", "西方", "Western"], rig: {
      id: "hall-candlewax", title_zh: "烛蜡 · 长廊", title_en: "Candlewax hall",
      key: "rgba(222,190,138,0.14)", left: "rgba(100,80,110,0.12)", right: "rgba(120,110,90,0.08)",
      bg: ["#110f0d", "#0a0908", "#040303"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-62199d078db273b38fb2877e.webp",
      floor: "rgba(216,186,138,0.05)" } }
  ];

  /* 戏路只【调强弱】, 不换颜色 —— 颜色归文明, 气质归戏路。
   * 三个系数分别乘在 顶光 / 侧光 / 地面 的 alpha 上。 */
  var ARCH_TONE = {
    tragic:  { key: 0.82, side: 1.12, floor: 0.80 },  // 顶光收, 侧光张 → 人陷在明暗之间
    villain: { key: 0.72, side: 1.25, floor: 0.75 },  // 顶光更暗, 侧光更硬
    enigma:  { key: 0.88, side: 1.15, floor: 0.85 },  // 两侧拉开, 中间留不确定
    ruler:   { key: 1.18, side: 0.92, floor: 1.10 },  // 顶光压场, 王座感
    sage:    { key: 1.06, side: 0.80, floor: 1.00 },  // 光更匀, 不制造戏剧
    charmer: { key: 1.04, side: 1.06, floor: 1.08 },  // 整体抬暖
    action:  { key: 1.10, side: 1.18, floor: 0.95 },
    comic:   { key: 1.12, side: 1.10, floor: 1.10 }
  };

  /* 专门设计过的厅 —— 按 actor_id 直接命中, 优先于 civilization。
   * 只在【为某位演员单独做过美术方向】时才加进来, 不是每个人都要有。 */
  var ACTOR_HALLS = {
    /* 妲己(W2120 美术方向稿)。三句 style_descriptor 各对应一层:
     *   shang bronze bells  → 顶光 青铜火把的琥珀
     *   a burning capital   → 左侧 远处焚城的暗红(压低, 是地平线不是火焰)
     *   three thousand years of hearsay → 右侧 冷玉青白的月, 与火对峙、互不相融
     * archetypes 是 tragic+enigma —— 光必须是冷的、远的、有距离的, 不是暖昧的。
     * (Jing 当初把她从 villain/charmer 改成 tragic/enigma, 正是为了不让
     *  模型「把史书的判词画成脸」; 同一条理由原样适用于她的厅。) */
    "act-legend-daji": {
      id: "hall-chaoge", title_zh: "朝歌 · 三千年众口", title_en: "Chaoge · three thousand years of hearsay",
      /* ⚠ 左右是【看着真图定的, 不是想当然】: 生成出来的背幕里, 焚城的门洞在画面【右侧】约 70%,
       * 而我原先把暗红火光放在左边 —— 火会打在错误的一侧, 与背幕自相矛盾。
       * 所以这里 left = 冷玉青白的月, right = 远处焚城的暗红。
       * 教训: 灯位只有对着真背幕才定得准, 凭稿子想是会反的。 */
      key: "rgba(214,158,74,0.17)", left: "rgba(126,158,150,0.10)", right: "rgba(178,58,38,0.16)",
      bg: ["#16110c", "#0c0806", "#050302"], plate: "https://cdn.cssstudio.app/artifacts/stage/stage-cb2b4bbc9b3d84953a6e92c5.webp",
      floor: "rgba(214,158,74,0.055)",
      /* 第二层 · 背幕图(W2121, 3 credits 生成一次, 永久使用, 每多一个观众成本为零)。
       * 内容哈希命名, 已落我们自己的 R2。生成时的硬约束是【无人 + 平光】——
       * 方向光归上面那几盏 CSS 灯, 打在所有人身上, 这才是这间厅能借给别人的前提。 */
      plate: "https://cdn.cssstudio.app/artifacts/stage/stage-cb2b4bbc9b3d84953a6e92c5.webp",
      skip_arch: true,   // 已经按 tragic+enigma 调过了, 不要再乘一次

      /* 第三层「三千年众口」—— 她这间厅独有的那一层, 也是三句 style_descriptor 里
       * 最难画的一句。做法是【文字分层后退】: 越往后越密、越糊、越暗, 全部背光。
       *
       * 最前那一层只有五个字 ——「惟婦言是用」,《尚書·牧誓》, 现存最早的指控就只有这么多。
       * 她身后那两层是后世一千年、两千五百年陆续加上去的酒池肉林与九尾。
       * 所以这一层不是装饰, 它就是 persona 那句话本身:
       *「最早的指控只说王听了她的话 —— 酒池肉林是一千年后加的, 九尾是两千五百年后加的。」
       *
       * 纯文字 + CSS blur, 零生成成本。层序从远到近(数组顺序 = 画的顺序)。 */
      layers: [
        { text: "妖妃 惑主 亡国 九尾 狐媚 祸水 炮烙 酒池 肉林 剖心 蛊惑 倾城\n" +
                "妖妃 惑主 亡国 九尾 狐媚 祸水 炮烙 酒池 肉林 剖心 蛊惑 倾城\n" +
                "妖妃 惑主 亡国 九尾 狐媚 祸水 炮烙 酒池 肉林 剖心 蛊惑 倾城",
          size: 15, blur: 7, opacity: 0.26, scale: 1.5, spacing: 0.42, color: "#cbb894", top: "4%" },
        { text: "酒池肉林 炮烙之刑 剖比干心\n妲己之言是從 九尾之狐 塗山之女",
          size: 19, blur: 2.6, opacity: 0.2, scale: 1.14, spacing: 0.34, color: "#d8c5a2", top: "16%" },
        { text: "昬棄厥肆祀弗答",
          size: 25, blur: 0.6, opacity: 0.32, scale: 1, spacing: 0.3, color: "#e6d3ac", top: "31%" },
        { text: "惟婦言是用", note: "《尚書 · 牧誓》",
          size: 40, blur: 0, opacity: 0.9, scale: 1, spacing: 0.34, color: "#f5e3bc", top: "46%", glow: true }
      ]
    }
  };

  /* rgba(r,g,b,a) → 乘 alpha。看不懂的字符串原样返回(绝不把一盏灯弄没)。 */
  function scaleAlpha(color, mul) {
    var m = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/.exec(String(color || ""));
    if (!m || !(mul > 0)) return color;
    var a = Math.max(0, Math.min(1, parseFloat(m[4]) * mul));
    return "rgba(" + m[1] + "," + m[2] + "," + m[3] + "," + a.toFixed(3) + ")";
  }

  function pickCiv(civ) {
    var s = String(civ || "").trim().toLowerCase();
    if (!s) return null;
    for (var i = 0; i < CIV_HALLS.length; i++) {
      var e = CIV_HALLS[i];
      for (var j = 0; j < e.match.length; j++) {
        if (s.indexOf(String(e.match[j]).toLowerCase()) !== -1) return e.rig;
      }
    }
    return null;   // 未命中 → 调用方回退 BASE(= 今天的通用厅)
  }

  /**
   * 一位演员的演播厅。永远返回一个可用的 rig, 绝不返回 null。
   * @param {object} a  /api/actors 的演员对象(需要 actor_id / civilization / archetypes)
   */
  function cssosStageForActor(a) {
    if (!a || typeof a !== "object") return BASE;
    var named = ACTOR_HALLS[String(a.actor_id || "")];
    if (named) return named;

    var rig = pickCiv(a.civilization);
    if (!rig) return BASE;

    var arch = Array.isArray(a.archetypes) ? a.archetypes : [];
    var tone = null;
    for (var i = 0; i < arch.length; i++) {
      var t = ARCH_TONE[String(arch[i] || "").toLowerCase()];
      if (t) { tone = t; break; }     // 第一个认得的戏路说了算, 不叠加(叠加会互相抵消成一团灰)
    }
    if (!tone) return rig;

    return {
      id: rig.id + "+" + arch[0],
      title_zh: rig.title_zh, title_en: rig.title_en,
      key:   scaleAlpha(rig.key,   tone.key),
      left:  scaleAlpha(rig.left,  tone.side),
      right: scaleAlpha(rig.right, tone.side),
      bg:    rig.bg,
      floor: scaleAlpha(rig.floor, tone.floor),
      layers: rig.layers || null,     // 戏路只调光, 不动第三层
      plate:  rig.plate  || null      // 背幕图跟着厅走
    };
  }

  function esc(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* 厅里那些【垫在灯光之下】的层, 统一挂在一个容器里, 好整体装卸。
   *   .cssos-hall-plate  背幕图(第二层, 可选)
   *   .cssos-hall-layer  文字/图形层(第三层, 可选) —— 妲己的「三千年众口」就是它
   * z-index 0: 与 ::before / ::after 同级、在它们之后画, 仍在演员画面(z-index 1)之下。
   * 全部 pointer-events:none —— 它们是布景, 不许挡住任何可点的东西。 */
  var LAYER_HOST = "cssos-hall-layers";

  function clearLayers(el) {
    try {
      var old = el.querySelector(":scope > ." + LAYER_HOST);
      if (old) old.remove();
    } catch (e) {
      try { var n = el.firstElementChild; while (n) { var nx = n.nextElementSibling;
        if (n.className === LAYER_HOST) n.remove(); n = nx; } } catch (e2) {}
    }
  }

  function renderLayers(el, rig) {
    clearLayers(el);
    var hasPlate = rig && typeof rig.plate === "string" && rig.plate;
    var hasLayers = rig && Array.isArray(rig.layers) && rig.layers.length;
    if (!hasPlate && !hasLayers) return;

    var host = document.createElement("div");
    host.className = LAYER_HOST;
    host.style.cssText = "position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden";

    /* 背幕图垫在最底下。故意压暗 + 轻微去饱和: 它是【布景】不是【画面】,
     * 抢了主角的眼睛就本末倒置; 而且 CSS 那几盏灯要能在它上面看得出来。 */
    if (hasPlate) {
      var plate = document.createElement("div");
      plate.className = "cssos-hall-plate";
      plate.style.cssText = "position:absolute;inset:0;background-size:cover;background-position:center;"
        /* 这三个数是【对着真背幕肉眼调的, 不是拍脑袋】: .5/.62 那一档把编钟和饕餮纹
         * 压得几乎看不见 —— 花了钱生成的东西被自己的滤镜吃掉了一半。
         * .62/.78 这一档细节读得出来, 演员仍然清清楚楚站在前面。
         * 换了新背幕要重调, 别照搬。 */
        + "opacity:.62;filter:saturate(.82) brightness(.78);"
        + "background-image:url('" + String(rig.plate).replace(/'/g, "%27") + "')";
      host.appendChild(plate);
    }

    if (hasLayers) {
      rig.layers.forEach(function (L) {
        if (!L || !L.text) return;
        var d = document.createElement("div");
        d.className = "cssos-hall-layer";
        var glow = L.glow ? ";text-shadow:0 0 34px rgba(214,158,74,.55),0 2px 2px rgba(0,0,0,.8)" : "";
        d.style.cssText = "position:absolute;left:0;right:0;top:" + (L.top || "20%")
          + ";display:flex;flex-direction:column;align-items:center;gap:10px;"
          + "filter:blur(" + (Number(L.blur) || 0) + "px);opacity:" + (Number(L.opacity) || 0.25) + ";"
          + "transform:scale(" + (Number(L.scale) || 1) + ")";
        d.innerHTML =
          '<div style="color:' + esc(L.color || "#e6d3ac") + ';font-size:' + (Number(L.size) || 16) + 'px;'
          + 'letter-spacing:' + (Number(L.spacing) || 0.3) + 'em;line-height:2;text-align:center;'
          + 'white-space:pre-line;font-family:\'Noto Serif SC\',Georgia,serif' + glow + '">' + esc(L.text) + '</div>'
          + (L.note
              ? '<div style="color:rgba(214,190,150,.6);font-size:11px;letter-spacing:.22em">' + esc(L.note) + '</div>'
              : "");
        host.appendChild(d);
      });
    }

    // 插在最前面, 让后面的演员画面/字幕自然盖在上面
    if (el.firstChild) el.insertBefore(host, el.firstChild); else el.appendChild(host);
  }

  /**
   * 把一间厅挂到某个 DOM 元素上(写 CSS 变量 + 垫层)。
   * 传 null / 不传 rig 就全部清掉 → CSS 的 fallback 生效 = 回到今天的通用厅。
   */
  function cssosApplyStage(el, rig) {
    if (!el || !el.style) return;
    if (!rig) {
      ["--hall-key", "--hall-left", "--hall-right", "--hall-bg1", "--hall-bg2", "--hall-bg3", "--hall-floor"]
        .forEach(function (k) { try { el.style.removeProperty(k); } catch (e) {} });
      try { el.removeAttribute("data-hall"); } catch (e) {}
      clearLayers(el);
      return;
    }
    try { renderLayers(el, rig); } catch (e) {}
    var bg = Array.isArray(rig.bg) ? rig.bg : BASE.bg;
    try {
      el.style.setProperty("--hall-key",   rig.key   || BASE.key);
      el.style.setProperty("--hall-left",  rig.left  || BASE.left);
      el.style.setProperty("--hall-right", rig.right || BASE.right);
      el.style.setProperty("--hall-bg1",   bg[0] || BASE.bg[0]);
      el.style.setProperty("--hall-bg2",   bg[1] || BASE.bg[1]);
      el.style.setProperty("--hall-bg3",   bg[2] || BASE.bg[2]);
      el.style.setProperty("--hall-floor", rig.floor || BASE.floor);
      el.setAttribute("data-hall", rig.id || "hall-default");   // 好排查: 一眼看出这是谁的厅
    } catch (e) {}
  }

  Object.assign(globalThis, {
    cssosStageForActor: cssosStageForActor,
    cssosApplyStage: cssosApplyStage,
    cssosStageBase: BASE,
    /* 共享演播厅的接口已经在这里了: 传任意演员的 rig 给任意元素即可。
     * 「让 A 用 B 的厅」= cssosApplyStage(stageEl, cssosStageForActor(B))。
     * 之所以不用改任何东西就能共享, 是因为一间厅只是十来个数字, 不是一张烘焙好的合成图 ——
     * 方向光在 CSS 层、打在所有人身上, 换人不会穿帮。 */
    cssosStageById: function (actorId) { return ACTOR_HALLS[String(actorId || "")] || null; }
  });
})();
