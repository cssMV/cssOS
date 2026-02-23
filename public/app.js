const dock = document.getElementById("dock");
const toast = document.getElementById("toast");
const logoPanel = document.getElementById("logo-panel");
const foryouPanel = document.getElementById("foryou-panel");
const watchPanel = document.getElementById("watch-panel");
const cssmvPanel = document.getElementById("cssmv-panel");
const lyricsPanel = document.getElementById("lyrics-panel");
const musicPanel = document.getElementById("music-panel");
const videoPanel = document.getElementById("video-panel");
const settingsPanel = document.getElementById("settings-panel");
const languagePanel = document.getElementById("language-panel");
const loginPanel = document.getElementById("login-panel");
const worksPanel = document.getElementById("works-panel");
const lyricsEl = document.getElementById("lyrics");
const watchSubtitle = document.getElementById("watch-subtitle");
const watchVideo = document.getElementById("watch-video");
const watchSvg = document.getElementById("watch-svg");
const musicProgress = document.getElementById("music-progress");
const videoProgress = document.getElementById("video-progress");
const karaProgress = document.getElementById("kara-progress");
const lyricsProgress = document.getElementById("lyrics-progress");
const mirrorTitle = document.querySelector(".mirror-title");
const mirrorSlogan = document.querySelector(".mirror-slogan");
const foryouTitle = document.getElementById("foryou-title");
const foryouStyle = document.getElementById("foryou-style");
const foryouTags = document.getElementById("foryou-tags");
const listenButton = document.getElementById("listen-btn");
const watchButton = document.getElementById("watch-btn");
const mvTitle = document.getElementById("mv-title");
const mvSub = document.getElementById("mv-sub");
const sceneList = document.getElementById("scene-list");
const lyricsGrid = document.getElementById("lyrics-grid");
const musicStyle = document.getElementById("music-style");
const voiceStyle = document.getElementById("voice-style");
const videoScript = document.getElementById("video-script");
const mvTags = document.getElementById("mv-tags");
const mvStats = document.getElementById("mv-stats");
const cameraBoard = document.getElementById("camera-board");
const lyricFlow = document.getElementById("lyric-flow");
const musicTags = document.getElementById("music-tags");
const mixGrid = document.getElementById("mix-grid");
const videoTags = document.getElementById("video-tags");
const cameraList = document.getElementById("camera-list");
const storyboard = document.getElementById("storyboard");
const enterWatchButton = document.getElementById("enter-watch");
const applySettings = document.getElementById("apply-settings");
const randomPaletteButton = document.getElementById("random-palette");
const titleInput = document.getElementById("title-input");
const lyricsInput = document.getElementById("lyrics-input");
const styleInput = document.getElementById("style-input");
const voiceInput = document.getElementById("voice-input");
const bgColorInputs = [
  document.getElementById("bg-color-1"),
  document.getElementById("bg-color-2"),
  document.getElementById("bg-color-3"),
  document.getElementById("bg-color-4")
];

const languageList = document.getElementById("language-list");
const languageListMore = document.getElementById("language-list-more");
const languageMoreButton = document.getElementById("language-more");
const languageStatus = document.getElementById("language-status");
const languageCurrent = document.getElementById("language-current");
const loginList = document.getElementById("login-list");
const loginStatus = document.getElementById("login-status");
const loginUser = document.getElementById("login-user");
const loginLogout = document.getElementById("login-logout");
const versionToggle = document.getElementById("version-toggle");
const versionMenu = document.getElementById("version-menu");
const versionList = document.getElementById("version-list");
const versionCurrentLabel = document.getElementById("version-current");

const LOCALE_KEY = "cssos.locale";
const DEFAULT_LOCALE = "en";
const USER_ROLE_KEY = "cssos.userRole";
const DEFAULT_ROLE = "guest";

const languageCatalog = {
  popular: [
    { code: "en", label: "English", native: "English", flag: "🇺🇸" },
    { code: "zh", label: "Chinese", native: "中文", flag: "🇨🇳" },
    { code: "es", label: "Spanish", native: "Español", flag: "🇪🇸" },
    { code: "fr", label: "French", native: "Français", flag: "🇫🇷" },
    { code: "de", label: "German", native: "Deutsch", flag: "🇩🇪" },
    { code: "ja", label: "Japanese", native: "日本語", flag: "🇯🇵" },
    { code: "ko", label: "Korean", native: "한국어", flag: "🇰🇷" },
    { code: "pt", label: "Portuguese", native: "Português", flag: "🇧🇷" },
    { code: "ru", label: "Russian", native: "Русский", flag: "🇷🇺" },
    { code: "ar", label: "Arabic", native: "العربية", flag: "🇸🇦" }
  ],
  more: [
    { code: "it", label: "Italian", native: "Italiano", flag: "🇮🇹" },
    { code: "hi", label: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
    { code: "tr", label: "Turkish", native: "Türkçe", flag: "🇹🇷" },
    { code: "vi", label: "Vietnamese", native: "Tiếng Việt", flag: "🇻🇳" },
    { code: "th", label: "Thai", native: "ไทย", flag: "🇹🇭" },
    { code: "id", label: "Indonesian", native: "Bahasa Indonesia", flag: "🇮🇩" }
  ]
};

const I18N = {
  en: {
    "panel.foryou": "For You",
    "panel.watch": "Watch",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "Lyrics Engine",
    "panel.music": "Music Engine",
    "panel.video": "Video Engine",
    "panel.settings": "Advanced Settings",
    "panel.language": "Language",
    "panel.login": "Login",
    "panel.works": "Works Center",
    "label.lyricsEngine": "Lyrics Engine · Random Single/Opera",
    "label.watchBanner": "Karaoke MV · Live Render",
    "label.autoWatch": "Auto Watch Pipeline",
    "label.mvSub": "3 Scene · 12 Shots · Live Karaoke",
    "label.sceneMap": "Scene Map · Flowing Typewriter",
    "label.waveform": "Waveform · Style Render",
    "label.storyboard": "Storyboard · Camera Flow",
    "label.videoScript": "Auto script loaded · 3 scenes ready",
    "status.lyricsEngine": "Lyrics Engine",
    "status.audioEngine": "Audio Engine",
    "status.videoEngine": "Video Engine",
    "status.karaokeSync": "Karaoke Sync",
    "status.composing": "{spell} is composing...",
    "label.style": "Style",
    "label.voice": "Voice",
    "track.leadVocal": "Lead Vocal",
    "track.harmony": "Harmony",
    "track.strings": "Strings",
    "shot.01": "Shot 01",
    "shot.02": "Shot 02",
    "shot.03": "Shot 03",
    "shot.04": "Shot 04",
    "shot.05": "Shot 05",
    "shot.06": "Shot 06",
    "settings.title": "Title",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "Custom Lyrics",
    "settings.lyricsPlaceholder": "Drop your own verses or a full opera...",
    "settings.musicStyle": "Music Style",
    "settings.voiceGender": "Voice Gender",
    "settings.bg1": "Background Color 1",
    "settings.bg2": "Background Color 2",
    "settings.bg3": "Background Color 3",
    "settings.bg4": "Background Color 4",
    "action.listen": "Listen",
    "action.watch": "Watch",
    "action.enterWatch": "Enter Watch",
    "action.randomPalette": "Random Watercolor Palette",
    "action.applyRender": "Apply & Render",
    "dock.mic": "Mic",
    "dock.foryou": "For You",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "Lyrics",
    "dock.music": "Music",
    "dock.video": "Video",
    "dock.watch": "Watch",
    "dock.language": "Language",
    "dock.login": "Login",
    "dock.works": "Works",
    "dock.settings": "Settings",
    "language.subtitle": "Interface Language",
    "language.more": "More languages",
    "language.ready": "Ready",
    "language.generating": "Generating translations...",
    "login.subtitle": "Social Login Gateways",
    "billing.limitReached": "Daily limit reached",
    "login.statusGuest": "Guest",
    "login.statusSigned": "Signed in",
    "login.logout": "Log out",
    "versions.title": "Versions",
    "versions.current": "Current",
    "works.subtitle": "Creator Works Center",
    "works.profileRole": "Creator Studio",
    "works.followers": "Followers",
    "works.circles": "Circles",
    "works.blocked": "Blocked",
    "works.yourWorks": "Your Works",
    "works.comments": "Comments",
    "works.monetization": "Monetization",
    "works.subscription": "Subscription",
    "works.platformShare": "Platform Share",
    "works.fundsFlow":
      "All payments route through the platform account first, then are distributed to creators.",
    "works.status.connected": "API connected",
    "works.action.manage": "Manage",
    "works.action.price": "Set Price",
    "works.action.hide": "Hide",
    "works.action.delete": "Delete",
    "works.action.block": "Block",
    "works.action.follow": "Follow",
    "works.price.access": "View/Listen",
    "works.price.buyout": "Buyout",
    "works.price.tip": "Tip",
    "toast.awakened": "{spell} awakened · 流流流",
    "logo.slogan": "Just say <span class=\"spell\">{spell}</span>, witness the miracle!",
    "action.sayRender": "Say {spell} · Render",
    "label.titlePrefix": "Title · {title}"
  },
  zh: {
    "panel.foryou": "为你生成",
    "panel.watch": "观看",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "歌词引擎",
    "panel.music": "音乐引擎",
    "panel.video": "视频引擎",
    "panel.settings": "高级设置",
    "panel.language": "语言",
    "panel.login": "登录",
    "panel.works": "作品中心",
    "label.lyricsEngine": "歌词引擎 · 随机单曲/歌剧",
    "label.watchBanner": "卡拉OK MV · 实时渲染",
    "label.autoWatch": "自动观看管线",
    "label.mvSub": "3 个场景 · 12 镜头 · 直播卡拉OK",
    "label.sceneMap": "场景地图 · 流动打字机",
    "label.waveform": "波形 · 风格渲染",
    "label.storyboard": "分镜 · 镜头流",
    "label.videoScript": "自动脚本已加载 · 3 个场景就绪",
    "status.lyricsEngine": "歌词引擎",
    "status.audioEngine": "音频引擎",
    "status.videoEngine": "视频引擎",
    "status.karaokeSync": "卡拉OK 同步",
    "status.composing": "{spell} 正在谱写...",
    "label.style": "风格",
    "label.voice": "声线",
    "track.leadVocal": "主唱",
    "track.harmony": "和声",
    "track.strings": "弦乐",
    "shot.01": "镜头 01",
    "shot.02": "镜头 02",
    "shot.03": "镜头 03",
    "shot.04": "镜头 04",
    "shot.05": "镜头 05",
    "shot.06": "镜头 06",
    "settings.title": "标题",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "自定义歌词",
    "settings.lyricsPlaceholder": "输入你自己的诗句或完整歌剧...",
    "settings.musicStyle": "音乐风格",
    "settings.voiceGender": "声线性别",
    "settings.bg1": "背景色 1",
    "settings.bg2": "背景色 2",
    "settings.bg3": "背景色 3",
    "settings.bg4": "背景色 4",
    "action.listen": "聆听",
    "action.watch": "观看",
    "action.enterWatch": "进入观看",
    "action.randomPalette": "随机水彩配色",
    "action.applyRender": "应用并渲染",
    "dock.mic": "麦克风",
    "dock.foryou": "为你生成",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "歌词",
    "dock.music": "音乐",
    "dock.video": "视频",
    "dock.watch": "观看",
    "dock.language": "语言",
    "dock.login": "登录",
    "dock.works": "作品",
    "dock.settings": "设置",
    "language.subtitle": "界面语言",
    "language.more": "更多语言",
    "language.ready": "就绪",
    "language.generating": "正在生成翻译...",
    "login.subtitle": "社交平台登录",
    "billing.limitReached": "今日生成次数已达上限",
    "login.statusGuest": "游客",
    "login.statusSigned": "已登录",
    "login.logout": "退出登录",
    "versions.title": "版本",
    "versions.current": "当前",
    "works.subtitle": "作品中心",
    "works.profileRole": "创作工作室",
    "works.followers": "粉丝",
    "works.circles": "关注圈",
    "works.blocked": "拉黑",
    "works.yourWorks": "我的作品",
    "works.comments": "评论",
    "works.monetization": "变现",
    "works.subscription": "订阅",
    "works.platformShare": "平台分成",
    "works.fundsFlow": "所有资金先进入平台账户，再分发给创作者。",
    "works.status.connected": "API 已连接",
    "works.action.manage": "管理",
    "works.action.price": "定价",
    "works.action.hide": "屏蔽",
    "works.action.delete": "删除",
    "works.action.block": "拉黑",
    "works.action.follow": "关注",
    "works.price.access": "观看/聆听",
    "works.price.buyout": "买断",
    "works.price.tip": "打赏",
    "toast.awakened": "{spell} 苏醒 · 流流流",
    "logo.slogan": "只要说 <span class=\"spell\">{spell}</span>，奇迹就会发生！",
    "action.sayRender": "说出 {spell} · 渲染",
    "label.titlePrefix": "标题 · {title}"
  },
  es: {
    "panel.foryou": "Para ti",
    "panel.watch": "Ver",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "Motor de letras",
    "panel.music": "Motor de música",
    "panel.video": "Motor de video",
    "panel.settings": "Configuración avanzada",
    "panel.language": "Idioma",
    "panel.login": "Iniciar sesión",
    "panel.works": "Centro de obras",
    "label.lyricsEngine": "Motor de letras · Single/Ópera aleatoria",
    "label.watchBanner": "MV Karaoke · Render en vivo",
    "label.autoWatch": "Canal de visualización automática",
    "label.mvSub": "3 escenas · 12 tomas · Karaoke en vivo",
    "label.sceneMap": "Mapa de escenas · Máquina de escribir fluida",
    "label.waveform": "Forma de onda · Render de estilo",
    "label.storyboard": "Storyboard · Flujo de cámara",
    "label.videoScript": "Guion automático cargado · 3 escenas listas",
    "status.lyricsEngine": "Motor de letras",
    "status.audioEngine": "Motor de audio",
    "status.videoEngine": "Motor de video",
    "status.karaokeSync": "Sincronización de Karaoke",
    "status.composing": "{spell} está componiendo...",
    "label.style": "Estilo",
    "label.voice": "Voz",
    "track.leadVocal": "Voz principal",
    "track.harmony": "Armonía",
    "track.strings": "Cuerdas",
    "shot.01": "Toma 01",
    "shot.02": "Toma 02",
    "shot.03": "Toma 03",
    "shot.04": "Toma 04",
    "shot.05": "Toma 05",
    "shot.06": "Toma 06",
    "settings.title": "Título",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "Letras personalizadas",
    "settings.lyricsPlaceholder": "Escribe tus versos o una ópera completa...",
    "settings.musicStyle": "Estilo musical",
    "settings.voiceGender": "Género de voz",
    "settings.bg1": "Color de fondo 1",
    "settings.bg2": "Color de fondo 2",
    "settings.bg3": "Color de fondo 3",
    "settings.bg4": "Color de fondo 4",
    "action.listen": "Escuchar",
    "action.watch": "Ver",
    "action.enterWatch": "Entrar a ver",
    "action.randomPalette": "Paleta acuarela aleatoria",
    "action.applyRender": "Aplicar y renderizar",
    "dock.mic": "Mic",
    "dock.foryou": "Para ti",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "Letras",
    "dock.music": "Música",
    "dock.video": "Video",
    "dock.watch": "Ver",
    "dock.language": "Idioma",
    "dock.login": "Iniciar sesión",
    "dock.works": "Obras",
    "dock.settings": "Ajustes",
    "language.subtitle": "Idioma de la interfaz",
    "language.more": "Más idiomas",
    "language.ready": "Listo",
    "language.generating": "Generando traducciones...",
    "login.subtitle": "Acceso social",
    "billing.limitReached": "Límite diario alcanzado",
    "works.subtitle": "Centro de obras",
    "works.profileRole": "Estudio creador",
    "works.followers": "Seguidores",
    "works.circles": "Círculos",
    "works.blocked": "Bloqueados",
    "works.yourWorks": "Tus obras",
    "works.comments": "Comentarios",
    "works.monetization": "Monetización",
    "works.subscription": "Suscripción",
    "works.platformShare": "Participación de la plataforma",
    "works.fundsFlow":
      "Todos los pagos pasan primero por la cuenta de la plataforma y luego se distribuyen a los creadores.",
    "works.status.connected": "API conectada",
    "works.action.manage": "Gestionar",
    "works.action.price": "Fijar precio",
    "works.action.hide": "Ocultar",
    "works.action.delete": "Eliminar",
    "works.action.block": "Bloquear",
    "works.action.follow": "Seguir",
    "works.price.access": "Ver/Escuchar",
    "works.price.buyout": "Compra total",
    "works.price.tip": "Propina",
    "toast.awakened": "{spell} despertado · 流流流",
    "logo.slogan": "Solo di <span class=\"spell\">{spell}</span>, ¡que suceda el milagro!",
    "action.sayRender": "Di {spell} · Renderizar",
    "label.titlePrefix": "Título · {title}"
  },
  fr: {
    "panel.foryou": "Pour vous",
    "panel.watch": "Regarder",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "Moteur de paroles",
    "panel.music": "Moteur musical",
    "panel.video": "Moteur vidéo",
    "panel.settings": "Paramètres avancés",
    "panel.language": "Langue",
    "panel.login": "Connexion",
    "panel.works": "Centre des œuvres",
    "label.lyricsEngine": "Moteur de paroles · Single/Opéra aléatoire",
    "label.watchBanner": "MV Karaoke · Rendu en direct",
    "label.autoWatch": "Pipeline de visionnage automatique",
    "label.mvSub": "3 scènes · 12 plans · Karaoke en direct",
    "label.sceneMap": "Carte des scènes · Machine à écrire fluide",
    "label.waveform": "Forme d'onde · Rendu de style",
    "label.storyboard": "Storyboard · Flux de caméra",
    "label.videoScript": "Script auto chargé · 3 scènes prêtes",
    "status.lyricsEngine": "Moteur de paroles",
    "status.audioEngine": "Moteur audio",
    "status.videoEngine": "Moteur vidéo",
    "status.karaokeSync": "Synchronisation Karaoke",
    "status.composing": "{spell} compose...",
    "label.style": "Style",
    "label.voice": "Voix",
    "track.leadVocal": "Voix principale",
    "track.harmony": "Harmonie",
    "track.strings": "Cordes",
    "shot.01": "Plan 01",
    "shot.02": "Plan 02",
    "shot.03": "Plan 03",
    "shot.04": "Plan 04",
    "shot.05": "Plan 05",
    "shot.06": "Plan 06",
    "settings.title": "Titre",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "Paroles personnalisées",
    "settings.lyricsPlaceholder": "Saisissez vos vers ou un opéra complet...",
    "settings.musicStyle": "Style musical",
    "settings.voiceGender": "Genre de voix",
    "settings.bg1": "Couleur de fond 1",
    "settings.bg2": "Couleur de fond 2",
    "settings.bg3": "Couleur de fond 3",
    "settings.bg4": "Couleur de fond 4",
    "action.listen": "Écouter",
    "action.watch": "Regarder",
    "action.enterWatch": "Entrer",
    "action.randomPalette": "Palette aquarelle aléatoire",
    "action.applyRender": "Appliquer et rendre",
    "dock.mic": "Mic",
    "dock.foryou": "Pour vous",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "Paroles",
    "dock.music": "Musique",
    "dock.video": "Vidéo",
    "dock.watch": "Regarder",
    "dock.language": "Langue",
    "dock.login": "Connexion",
    "dock.works": "Œuvres",
    "dock.settings": "Paramètres",
    "language.subtitle": "Langue de l'interface",
    "language.more": "Plus de langues",
    "language.ready": "Prêt",
    "language.generating": "Génération des traductions...",
    "login.subtitle": "Passerelles de connexion sociale",
    "billing.limitReached": "Limite quotidienne atteinte",
    "works.subtitle": "Centre des œuvres",
    "works.profileRole": "Studio créateur",
    "works.followers": "Abonnés",
    "works.circles": "Cercles",
    "works.blocked": "Bloqués",
    "works.yourWorks": "Vos œuvres",
    "works.comments": "Commentaires",
    "works.monetization": "Monétisation",
    "works.subscription": "Abonnement",
    "works.platformShare": "Part de la plateforme",
    "works.fundsFlow":
      "Tous les paiements passent d'abord par le compte de la plateforme, puis sont distribués aux créateurs.",
    "works.status.connected": "API connectée",
    "works.action.manage": "Gérer",
    "works.action.price": "Fixer le prix",
    "works.action.hide": "Masquer",
    "works.action.delete": "Supprimer",
    "works.action.block": "Bloquer",
    "works.action.follow": "Suivre",
    "works.price.access": "Voir/Écouter",
    "works.price.buyout": "Rachat",
    "works.price.tip": "Pourboire",
    "toast.awakened": "{spell} éveillé · 流流流",
    "logo.slogan": "Dites <span class=\"spell\">{spell}</span> et le miracle arrive !",
    "action.sayRender": "Dites {spell} · Rendre",
    "label.titlePrefix": "Titre · {title}"
  },
  de: {
    "panel.foryou": "Für dich",
    "panel.watch": "Ansehen",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "Lyrics-Engine",
    "panel.music": "Musik-Engine",
    "panel.video": "Video-Engine",
    "panel.settings": "Erweiterte Einstellungen",
    "panel.language": "Sprache",
    "panel.login": "Anmelden",
    "panel.works": "Werkzentrum",
    "label.lyricsEngine": "Lyrics-Engine · Zufällige Single/Oper",
    "label.watchBanner": "Karaoke MV · Live-Render",
    "label.autoWatch": "Automatische Watch-Pipeline",
    "label.mvSub": "3 Szenen · 12 Shots · Live Karaoke",
    "label.sceneMap": "Szenenkarte · Fließende Schreibmaschine",
    "label.waveform": "Wellenform · Stil-Render",
    "label.storyboard": "Storyboard · Kamerafluss",
    "label.videoScript": "Auto-Skript geladen · 3 Szenen bereit",
    "status.lyricsEngine": "Lyrics-Engine",
    "status.audioEngine": "Audio-Engine",
    "status.videoEngine": "Video-Engine",
    "status.karaokeSync": "Karaoke-Sync",
    "status.composing": "{spell} komponiert...",
    "label.style": "Stil",
    "label.voice": "Stimme",
    "track.leadVocal": "Lead Vocal",
    "track.harmony": "Harmonie",
    "track.strings": "Streicher",
    "shot.01": "Shot 01",
    "shot.02": "Shot 02",
    "shot.03": "Shot 03",
    "shot.04": "Shot 04",
    "shot.05": "Shot 05",
    "shot.06": "Shot 06",
    "settings.title": "Titel",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "Benutzerdefinierte Lyrics",
    "settings.lyricsPlaceholder": "Eigene Verse oder eine ganze Oper eingeben...",
    "settings.musicStyle": "Musikstil",
    "settings.voiceGender": "Stimmgeschlecht",
    "settings.bg1": "Hintergrundfarbe 1",
    "settings.bg2": "Hintergrundfarbe 2",
    "settings.bg3": "Hintergrundfarbe 3",
    "settings.bg4": "Hintergrundfarbe 4",
    "action.listen": "Anhören",
    "action.watch": "Ansehen",
    "action.enterWatch": "Öffnen",
    "action.randomPalette": "Zufällige Aquarellpalette",
    "action.applyRender": "Anwenden & Rendern",
    "dock.mic": "Mic",
    "dock.foryou": "Für dich",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "Lyrics",
    "dock.music": "Musik",
    "dock.video": "Video",
    "dock.watch": "Ansehen",
    "dock.language": "Sprache",
    "dock.login": "Anmelden",
    "dock.works": "Werke",
    "dock.settings": "Einstellungen",
    "language.subtitle": "Oberflächensprache",
    "language.more": "Mehr Sprachen",
    "language.ready": "Bereit",
    "language.generating": "Übersetzungen werden erstellt...",
    "login.subtitle": "Soziale Login-Gateways",
    "billing.limitReached": "Tageslimit erreicht",
    "works.subtitle": "Werkzentrum",
    "works.profileRole": "Creator-Studio",
    "works.followers": "Follower",
    "works.circles": "Kreise",
    "works.blocked": "Blockiert",
    "works.yourWorks": "Deine Werke",
    "works.comments": "Kommentare",
    "works.monetization": "Monetarisierung",
    "works.subscription": "Abo",
    "works.platformShare": "Plattformanteil",
    "works.fundsFlow":
      "Alle Zahlungen laufen zuerst über das Plattformkonto und werden dann an die Creator verteilt.",
    "works.status.connected": "API verbunden",
    "works.action.manage": "Verwalten",
    "works.action.price": "Preis festlegen",
    "works.action.hide": "Ausblenden",
    "works.action.delete": "Löschen",
    "works.action.block": "Sperren",
    "works.action.follow": "Folgen",
    "works.price.access": "Ansehen/Hören",
    "works.price.buyout": "Buyout",
    "works.price.tip": "Trinkgeld",
    "toast.awakened": "{spell} erwacht · 流流流",
    "logo.slogan": "Sag <span class=\"spell\">{spell}</span>, erlebe das Wunder!",
    "action.sayRender": "Sag {spell} · Rendern",
    "label.titlePrefix": "Titel · {title}"
  },
  ja: {
    "panel.foryou": "あなたへ",
    "panel.watch": "視聴",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "歌詞エンジン",
    "panel.music": "音楽エンジン",
    "panel.video": "映像エンジン",
    "panel.settings": "詳細設定",
    "panel.language": "言語",
    "panel.login": "ログイン",
    "panel.works": "作品センター",
    "label.lyricsEngine": "歌詞エンジン · ランダムシングル/オペラ",
    "label.watchBanner": "カラオケ MV · ライブレンダー",
    "label.autoWatch": "自動視聴パイプライン",
    "label.mvSub": "3 シーン · 12 ショット · ライブカラオケ",
    "label.sceneMap": "シーンマップ · フロータイピング",
    "label.waveform": "波形 · スタイルレンダー",
    "label.storyboard": "ストーリーボード · カメラフロー",
    "label.videoScript": "自動スクリプト読込済み · 3 シーン準備完了",
    "status.lyricsEngine": "歌詞エンジン",
    "status.audioEngine": "音声エンジン",
    "status.videoEngine": "映像エンジン",
    "status.karaokeSync": "カラオケ同期",
    "status.composing": "{spell} 作曲中...",
    "label.style": "スタイル",
    "label.voice": "ボイス",
    "track.leadVocal": "リードボーカル",
    "track.harmony": "ハーモニー",
    "track.strings": "ストリングス",
    "shot.01": "ショット 01",
    "shot.02": "ショット 02",
    "shot.03": "ショット 03",
    "shot.04": "ショット 04",
    "shot.05": "ショット 05",
    "shot.06": "ショット 06",
    "settings.title": "タイトル",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "カスタム歌詞",
    "settings.lyricsPlaceholder": "自分の詩やオペラを入力...",
    "settings.musicStyle": "音楽スタイル",
    "settings.voiceGender": "声のタイプ",
    "settings.bg1": "背景色 1",
    "settings.bg2": "背景色 2",
    "settings.bg3": "背景色 3",
    "settings.bg4": "背景色 4",
    "action.listen": "聴く",
    "action.watch": "見る",
    "action.enterWatch": "視聴へ",
    "action.randomPalette": "ランダム水彩パレット",
    "action.applyRender": "適用してレンダー",
    "dock.mic": "マイク",
    "dock.foryou": "あなたへ",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "歌詞",
    "dock.music": "音楽",
    "dock.video": "映像",
    "dock.watch": "視聴",
    "dock.language": "言語",
    "dock.login": "ログイン",
    "dock.works": "作品",
    "dock.settings": "設定",
    "language.subtitle": "インターフェース言語",
    "language.more": "さらに言語",
    "language.ready": "準備完了",
    "language.generating": "翻訳を生成中...",
    "login.subtitle": "ソーシャルログイン",
    "billing.limitReached": "本日の上限に達しました",
    "works.subtitle": "作品センター",
    "works.profileRole": "クリエイタースタジオ",
    "works.followers": "フォロワー",
    "works.circles": "サークル",
    "works.blocked": "ブロック",
    "works.yourWorks": "あなたの作品",
    "works.comments": "コメント",
    "works.monetization": "収益化",
    "works.subscription": "サブスク",
    "works.platformShare": "プラットフォーム分配",
    "works.fundsFlow":
      "すべての支払いはまずプラットフォーム口座に入り、その後クリエイターに分配されます。",
    "works.status.connected": "API 接続済み",
    "works.action.manage": "管理",
    "works.action.price": "価格設定",
    "works.action.hide": "非表示",
    "works.action.delete": "削除",
    "works.action.block": "ブロック",
    "works.action.follow": "フォロー",
    "works.price.access": "視聴/聴取",
    "works.price.buyout": "買い切り",
    "works.price.tip": "チップ",
    "toast.awakened": "{spell} 起動 · 流流流",
    "logo.slogan": "<span class=\"spell\">{spell}</span>と言えば、奇跡が起こる！",
    "action.sayRender": "{spell} と言う · レンダー",
    "label.titlePrefix": "タイトル · {title}"
  },
  ko: {
    "panel.foryou": "당신을 위해",
    "panel.watch": "보기",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "가사 엔진",
    "panel.music": "음악 엔진",
    "panel.video": "비디오 엔진",
    "panel.settings": "고급 설정",
    "panel.language": "언어",
    "panel.login": "로그인",
    "panel.works": "작품 센터",
    "label.lyricsEngine": "가사 엔진 · 랜덤 싱글/오페라",
    "label.watchBanner": "가라오케 MV · 라이브 렌더",
    "label.autoWatch": "자동 시청 파이프라인",
    "label.mvSub": "3 씬 · 12 샷 · 라이브 가라오케",
    "label.sceneMap": "장면 맵 · 흐르는 টাই핑",
    "label.waveform": "파형 · 스타일 렌더",
    "label.storyboard": "스토리보드 · 카메라 플로우",
    "label.videoScript": "자동 스크립트 로드됨 · 3 씬 준비",
    "status.lyricsEngine": "가사 엔진",
    "status.audioEngine": "오디오 엔진",
    "status.videoEngine": "비디오 엔진",
    "status.karaokeSync": "가라오케 동기화",
    "status.composing": "{spell} 작곡 중...",
    "label.style": "스타일",
    "label.voice": "보이스",
    "track.leadVocal": "리드 보컬",
    "track.harmony": "하모니",
    "track.strings": "스트링",
    "shot.01": "샷 01",
    "shot.02": "샷 02",
    "shot.03": "샷 03",
    "shot.04": "샷 04",
    "shot.05": "샷 05",
    "shot.06": "샷 06",
    "settings.title": "제목",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "맞춤 가사",
    "settings.lyricsPlaceholder": "자신의 가사나 오페라를 입력...",
    "settings.musicStyle": "음악 스타일",
    "settings.voiceGender": "보이스 성별",
    "settings.bg1": "배경색 1",
    "settings.bg2": "배경색 2",
    "settings.bg3": "배경색 3",
    "settings.bg4": "배경색 4",
    "action.listen": "듣기",
    "action.watch": "보기",
    "action.enterWatch": "보기로 이동",
    "action.randomPalette": "랜덤 수채화 팔레트",
    "action.applyRender": "적용 및 렌더",
    "dock.mic": "마이크",
    "dock.foryou": "당신을 위해",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "가사",
    "dock.music": "음악",
    "dock.video": "비디오",
    "dock.watch": "보기",
    "dock.language": "언어",
    "dock.login": "로그인",
    "dock.works": "작품",
    "dock.settings": "설정",
    "language.subtitle": "인터페이스 언어",
    "language.more": "더 많은 언어",
    "language.ready": "준비됨",
    "language.generating": "번역 생성 중...",
    "login.subtitle": "소셜 로그인",
    "billing.limitReached": "오늘 한도를 초과했습니다",
    "works.subtitle": "작품 센터",
    "works.profileRole": "크리에이터 스튜디오",
    "works.followers": "팔로워",
    "works.circles": "서클",
    "works.blocked": "차단",
    "works.yourWorks": "내 작품",
    "works.comments": "댓글",
    "works.monetization": "수익화",
    "works.subscription": "구독",
    "works.platformShare": "플랫폼 수수료",
    "works.fundsFlow":
      "모든 결제는 먼저 플랫폼 계정으로 들어간 뒤 크리에이터에게 분배됩니다.",
    "works.status.connected": "API 연결됨",
    "works.action.manage": "관리",
    "works.action.price": "가격 설정",
    "works.action.hide": "숨김",
    "works.action.delete": "삭제",
    "works.action.block": "차단",
    "works.action.follow": "팔로우",
    "works.price.access": "보기/듣기",
    "works.price.buyout": "구매",
    "works.price.tip": "팁",
    "toast.awakened": "{spell} 각성 · 流流流",
    "logo.slogan": "<span class=\"spell\">{spell}</span>을 외치면 기적이!",
    "action.sayRender": "{spell} 말하기 · 렌더",
    "label.titlePrefix": "제목 · {title}"
  },
  pt: {
    "panel.foryou": "Para você",
    "panel.watch": "Assistir",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "Motor de letras",
    "panel.music": "Motor musical",
    "panel.video": "Motor de vídeo",
    "panel.settings": "Configurações avançadas",
    "panel.language": "Idioma",
    "panel.login": "Entrar",
    "panel.works": "Centro de obras",
    "label.lyricsEngine": "Motor de letras · Single/Ópera aleatória",
    "label.watchBanner": "MV Karaoke · Render ao vivo",
    "label.autoWatch": "Pipeline automático de visualização",
    "label.mvSub": "3 cenas · 12 tomadas · Karaoke ao vivo",
    "label.sceneMap": "Mapa de cenas · Digitação fluida",
    "label.waveform": "Forma de onda · Render de estilo",
    "label.storyboard": "Storyboard · Fluxo de câmera",
    "label.videoScript": "Script automático carregado · 3 cenas prontas",
    "status.lyricsEngine": "Motor de letras",
    "status.audioEngine": "Motor de áudio",
    "status.videoEngine": "Motor de vídeo",
    "status.karaokeSync": "Sincronização de Karaoke",
    "status.composing": "{spell} está compondo...",
    "label.style": "Estilo",
    "label.voice": "Voz",
    "track.leadVocal": "Vocal principal",
    "track.harmony": "Harmonia",
    "track.strings": "Cordas",
    "shot.01": "Cena 01",
    "shot.02": "Cena 02",
    "shot.03": "Cena 03",
    "shot.04": "Cena 04",
    "shot.05": "Cena 05",
    "shot.06": "Cena 06",
    "settings.title": "Título",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "Letras personalizadas",
    "settings.lyricsPlaceholder": "Digite seus versos ou uma ópera completa...",
    "settings.musicStyle": "Estilo musical",
    "settings.voiceGender": "Gênero da voz",
    "settings.bg1": "Cor de fundo 1",
    "settings.bg2": "Cor de fundo 2",
    "settings.bg3": "Cor de fundo 3",
    "settings.bg4": "Cor de fundo 4",
    "action.listen": "Ouvir",
    "action.watch": "Assistir",
    "action.enterWatch": "Entrar",
    "action.randomPalette": "Paleta aquarela aleatória",
    "action.applyRender": "Aplicar e renderizar",
    "dock.mic": "Mic",
    "dock.foryou": "Para você",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "Letras",
    "dock.music": "Música",
    "dock.video": "Vídeo",
    "dock.watch": "Assistir",
    "dock.language": "Idioma",
    "dock.login": "Entrar",
    "dock.works": "Obras",
    "dock.settings": "Configurações",
    "language.subtitle": "Idioma da interface",
    "language.more": "Mais idiomas",
    "language.ready": "Pronto",
    "language.generating": "Gerando traduções...",
    "login.subtitle": "Login social",
    "billing.limitReached": "Limite diário atingido",
    "works.subtitle": "Centro de obras",
    "works.profileRole": "Estúdio criador",
    "works.followers": "Seguidores",
    "works.circles": "Círculos",
    "works.blocked": "Bloqueados",
    "works.yourWorks": "Suas obras",
    "works.comments": "Comentários",
    "works.monetization": "Monetização",
    "works.subscription": "Assinatura",
    "works.platformShare": "Parcela da plataforma",
    "works.fundsFlow":
      "Todos os pagamentos passam primeiro pela conta da plataforma e depois são distribuídos aos criadores.",
    "works.status.connected": "API conectada",
    "works.action.manage": "Gerenciar",
    "works.action.price": "Definir preço",
    "works.action.hide": "Ocultar",
    "works.action.delete": "Excluir",
    "works.action.block": "Bloquear",
    "works.action.follow": "Seguir",
    "works.price.access": "Ver/Ouvir",
    "works.price.buyout": "Compra total",
    "works.price.tip": "Gorjeta",
    "toast.awakened": "{spell} desperto · 流流流",
    "logo.slogan": "Diga <span class=\"spell\">{spell}</span>, testemunhe o milagre!",
    "action.sayRender": "Diga {spell} · Renderizar",
    "label.titlePrefix": "Título · {title}"
  },
  ru: {
    "panel.foryou": "Для вас",
    "panel.watch": "Смотреть",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "Движок текста",
    "panel.music": "Музыкальный движок",
    "panel.video": "Видео-движок",
    "panel.settings": "Расширенные настройки",
    "panel.language": "Язык",
    "panel.login": "Вход",
    "panel.works": "Центр работ",
    "label.lyricsEngine": "Движок текста · Случайный сингл/опера",
    "label.watchBanner": "Karaoke MV · Рендер в реальном времени",
    "label.autoWatch": "Автоматический просмотр",
    "label.mvSub": "3 сцены · 12 кадров · Живое Karaoke",
    "label.sceneMap": "Карта сцен · Плавная печать",
    "label.waveform": "Волна · Рендер стиля",
    "label.storyboard": "Сториборд · Поток камеры",
    "label.videoScript": "Сценарий загружен · 3 сцены готовы",
    "status.lyricsEngine": "Движок текста",
    "status.audioEngine": "Аудио-движок",
    "status.videoEngine": "Видео-движок",
    "status.karaokeSync": "Синхронизация Karaoke",
    "status.composing": "{spell} сочиняет...",
    "label.style": "Стиль",
    "label.voice": "Голос",
    "track.leadVocal": "Ведущий вокал",
    "track.harmony": "Гармония",
    "track.strings": "Струнные",
    "shot.01": "Кадр 01",
    "shot.02": "Кадр 02",
    "shot.03": "Кадр 03",
    "shot.04": "Кадр 04",
    "shot.05": "Кадр 05",
    "shot.06": "Кадр 06",
    "settings.title": "Название",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "Свои тексты",
    "settings.lyricsPlaceholder": "Введите свои строки или целую оперу...",
    "settings.musicStyle": "Музыкальный стиль",
    "settings.voiceGender": "Пол голоса",
    "settings.bg1": "Фон 1",
    "settings.bg2": "Фон 2",
    "settings.bg3": "Фон 3",
    "settings.bg4": "Фон 4",
    "action.listen": "Слушать",
    "action.watch": "Смотреть",
    "action.enterWatch": "Перейти",
    "action.randomPalette": "Случайная палитра акварели",
    "action.applyRender": "Применить и рендерить",
    "dock.mic": "Мик",
    "dock.foryou": "Для вас",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "Тексты",
    "dock.music": "Музыка",
    "dock.video": "Видео",
    "dock.watch": "Смотреть",
    "dock.language": "Язык",
    "dock.login": "Вход",
    "dock.works": "Работы",
    "dock.settings": "Настройки",
    "language.subtitle": "Язык интерфейса",
    "language.more": "Больше языков",
    "language.ready": "Готово",
    "language.generating": "Генерация перевода...",
    "login.subtitle": "Социальный вход",
    "billing.limitReached": "Дневной лимит достигнут",
    "works.subtitle": "Центр работ",
    "works.profileRole": "Студия автора",
    "works.followers": "Подписчики",
    "works.circles": "Круги",
    "works.blocked": "Заблокированы",
    "works.yourWorks": "Ваши работы",
    "works.comments": "Комментарии",
    "works.monetization": "Монетизация",
    "works.subscription": "Подписка",
    "works.platformShare": "Доля платформы",
    "works.fundsFlow":
      "Все платежи сначала поступают на счет платформы, затем распределяются создателям.",
    "works.status.connected": "API подключена",
    "works.action.manage": "Управлять",
    "works.action.price": "Назначить цену",
    "works.action.hide": "Скрыть",
    "works.action.delete": "Удалить",
    "works.action.block": "Заблокировать",
    "works.action.follow": "Подписаться",
    "works.price.access": "Смотреть/Слушать",
    "works.price.buyout": "Выкуп",
    "works.price.tip": "Чаевые",
    "toast.awakened": "{spell} пробуждён · 流流流",
    "logo.slogan": "Скажи <span class=\"spell\">{spell}</span> — и случится чудо!",
    "action.sayRender": "Скажи {spell} · Рендер",
    "label.titlePrefix": "Название · {title}"
  },
  ar: {
    "panel.foryou": "لك",
    "panel.watch": "مشاهدة",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "محرك الكلمات",
    "panel.music": "محرك الموسيقى",
    "panel.video": "محرك الفيديو",
    "panel.settings": "إعدادات متقدمة",
    "panel.language": "اللغة",
    "panel.login": "تسجيل الدخول",
    "panel.works": "مركز الأعمال",
    "label.lyricsEngine": "محرك الكلمات · أغنية/أوبرا عشوائية",
    "label.watchBanner": "MV كاراوكي · عرض مباشر",
    "label.autoWatch": "مسار مشاهدة تلقائي",
    "label.mvSub": "3 مشاهد · 12 لقطة · كاراوكي مباشر",
    "label.sceneMap": "خريطة المشاهد · كتابة متدفقة",
    "label.waveform": "موجة · عرض النمط",
    "label.storyboard": "لوحة القصة · تدفق الكاميرا",
    "label.videoScript": "تم تحميل النص · 3 مشاهد جاهزة",
    "status.lyricsEngine": "محرك الكلمات",
    "status.audioEngine": "محرك الصوت",
    "status.videoEngine": "محرك الفيديو",
    "status.karaokeSync": "مزامنة الكاراوكي",
    "status.composing": "{spell} يؤلف...",
    "label.style": "النمط",
    "label.voice": "الصوت",
    "track.leadVocal": "الغناء الرئيسي",
    "track.harmony": "الهارموني",
    "track.strings": "أوتار",
    "shot.01": "لقطة 01",
    "shot.02": "لقطة 02",
    "shot.03": "لقطة 03",
    "shot.04": "لقطة 04",
    "shot.05": "لقطة 05",
    "shot.06": "لقطة 06",
    "settings.title": "العنوان",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "كلمات مخصصة",
    "settings.lyricsPlaceholder": "أدخل أبياتك أو أوبرا كاملة...",
    "settings.musicStyle": "نمط الموسيقى",
    "settings.voiceGender": "نوع الصوت",
    "settings.bg1": "لون الخلفية 1",
    "settings.bg2": "لون الخلفية 2",
    "settings.bg3": "لون الخلفية 3",
    "settings.bg4": "لون الخلفية 4",
    "action.listen": "استماع",
    "action.watch": "مشاهدة",
    "action.enterWatch": "دخول",
    "action.randomPalette": "لوحة ألوان مائية عشوائية",
    "action.applyRender": "تطبيق وعرض",
    "dock.mic": "ميك",
    "dock.foryou": "لك",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "الكلمات",
    "dock.music": "الموسيقى",
    "dock.video": "الفيديو",
    "dock.watch": "مشاهدة",
    "dock.language": "اللغة",
    "dock.login": "تسجيل الدخول",
    "dock.works": "الأعمال",
    "dock.settings": "الإعدادات",
    "language.subtitle": "لغة الواجهة",
    "language.more": "لغات أكثر",
    "language.ready": "جاهز",
    "language.generating": "جارٍ إنشاء الترجمات...",
    "login.subtitle": "تسجيل الدخول الاجتماعي",
    "billing.limitReached": "تم بلوغ الحد اليومي",
    "works.subtitle": "مركز الأعمال",
    "works.profileRole": "استوديو المبدع",
    "works.followers": "المتابعون",
    "works.circles": "الدوائر",
    "works.blocked": "محظورون",
    "works.yourWorks": "أعمالك",
    "works.comments": "التعليقات",
    "works.monetization": "التحويل إلى أرباح",
    "works.subscription": "الاشتراك",
    "works.platformShare": "حصة المنصة",
    "works.fundsFlow":
      "جميع المدفوعات تمر أولاً بحساب المنصة ثم توزَّع على المبدعين.",
    "works.status.connected": "API متصل",
    "works.action.manage": "إدارة",
    "works.action.price": "تحديد السعر",
    "works.action.hide": "إخفاء",
    "works.action.delete": "حذف",
    "works.action.block": "حظر",
    "works.action.follow": "متابعة",
    "works.price.access": "عرض/استماع",
    "works.price.buyout": "شراء كامل",
    "works.price.tip": "إكرامية",
    "toast.awakened": "{spell} استيقظ · 流流流",
    "logo.slogan": "قل <span class=\"spell\">{spell}</span> وشاهد المعجزة!",
    "action.sayRender": "قل {spell} · عرض",
    "label.titlePrefix": "العنوان · {title}"
  },
  it: {
    "panel.foryou": "Per te",
    "panel.watch": "Guarda",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "Motore testi",
    "panel.music": "Motore musicale",
    "panel.video": "Motore video",
    "panel.settings": "Impostazioni avanzate",
    "panel.language": "Lingua",
    "panel.login": "Accesso",
    "panel.works": "Centro opere",
    "label.lyricsEngine": "Motore testi · Singolo/Opera casuale",
    "label.watchBanner": "MV Karaoke · Render live",
    "label.autoWatch": "Pipeline visione automatica",
    "label.mvSub": "3 scene · 12 shot · Karaoke live",
    "label.sceneMap": "Mappa scene · Dattilografia fluida",
    "label.waveform": "Forma d'onda · Render stile",
    "label.storyboard": "Storyboard · Flusso camera",
    "label.videoScript": "Script auto caricato · 3 scene pronte",
    "status.lyricsEngine": "Motore testi",
    "status.audioEngine": "Motore audio",
    "status.videoEngine": "Motore video",
    "status.karaokeSync": "Sync Karaoke",
    "status.composing": "{spell} sta componendo...",
    "label.style": "Stile",
    "label.voice": "Voce",
    "track.leadVocal": "Voce principale",
    "track.harmony": "Armonia",
    "track.strings": "Archi",
    "shot.01": "Shot 01",
    "shot.02": "Shot 02",
    "shot.03": "Shot 03",
    "shot.04": "Shot 04",
    "shot.05": "Shot 05",
    "shot.06": "Shot 06",
    "settings.title": "Titolo",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "Testi personalizzati",
    "settings.lyricsPlaceholder": "Inserisci versi o un'opera completa...",
    "settings.musicStyle": "Stile musicale",
    "settings.voiceGender": "Genere voce",
    "settings.bg1": "Colore sfondo 1",
    "settings.bg2": "Colore sfondo 2",
    "settings.bg3": "Colore sfondo 3",
    "settings.bg4": "Colore sfondo 4",
    "action.listen": "Ascolta",
    "action.watch": "Guarda",
    "action.enterWatch": "Entra",
    "action.randomPalette": "Palette acquerello casuale",
    "action.applyRender": "Applica e renderizza",
    "dock.mic": "Mic",
    "dock.foryou": "Per te",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "Testi",
    "dock.music": "Musica",
    "dock.video": "Video",
    "dock.watch": "Guarda",
    "dock.language": "Lingua",
    "dock.login": "Accesso",
    "dock.works": "Opere",
    "dock.settings": "Impostazioni",
    "language.subtitle": "Lingua dell'interfaccia",
    "language.more": "Altre lingue",
    "language.ready": "Pronto",
    "language.generating": "Generazione traduzioni...",
    "login.subtitle": "Accesso social",
    "billing.limitReached": "Limite giornaliero raggiunto",
    "works.subtitle": "Centro opere",
    "works.profileRole": "Studio creatore",
    "works.followers": "Follower",
    "works.circles": "Cerchie",
    "works.blocked": "Bloccati",
    "works.yourWorks": "Le tue opere",
    "works.comments": "Commenti",
    "works.monetization": "Monetizzazione",
    "works.subscription": "Abbonamento",
    "works.platformShare": "Quota piattaforma",
    "works.fundsFlow":
      "Tutti i pagamenti passano prima dall'account della piattaforma e poi vengono distribuiti ai creatori.",
    "works.status.connected": "API connessa",
    "works.action.manage": "Gestisci",
    "works.action.price": "Imposta prezzo",
    "works.action.hide": "Nascondi",
    "works.action.delete": "Elimina",
    "works.action.block": "Blocca",
    "works.action.follow": "Segui",
    "works.price.access": "Guarda/Ascolta",
    "works.price.buyout": "Acquisto totale",
    "works.price.tip": "Mancia",
    "toast.awakened": "{spell} risvegliato · 流流流",
    "logo.slogan": "Di <span class=\"spell\">{spell}</span>, assisti al miracolo!",
    "action.sayRender": "Di {spell} · Render",
    "label.titlePrefix": "Titolo · {title}"
  },
  hi: {
    "panel.foryou": "आपके लिए",
    "panel.watch": "देखें",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "गीत इंजन",
    "panel.music": "संगीत इंजन",
    "panel.video": "वीडियो इंजन",
    "panel.settings": "उन्नत सेटिंग्स",
    "panel.language": "भाषा",
    "panel.login": "लॉगिन",
    "panel.works": "रचनाएँ केंद्र",
    "label.lyricsEngine": "गीत इंजन · रैंडम सिंगल/ओपेरा",
    "label.watchBanner": "कराओके MV · लाइव रेंडर",
    "label.autoWatch": "ऑटो वॉच पाइपलाइन",
    "label.mvSub": "3 सीन · 12 शॉट · लाइव कराओके",
    "label.sceneMap": "सीन मैप · फ्लो टाइपराइटर",
    "label.waveform": "वेवफॉर्म · स्टाइल रेंडर",
    "label.storyboard": "स्टोरीबोर्ड · कैमरा फ्लो",
    "label.videoScript": "ऑटो स्क्रिप्ट लोडेड · 3 सीन तैयार",
    "status.lyricsEngine": "गीत इंजन",
    "status.audioEngine": "ऑडियो इंजन",
    "status.videoEngine": "वीडियो इंजन",
    "status.karaokeSync": "कराओके सिंक",
    "status.composing": "{spell} कंपोज़ कर रहा है...",
    "label.style": "स्टाइल",
    "label.voice": "आवाज़",
    "track.leadVocal": "लीड वोकल",
    "track.harmony": "हार्मनी",
    "track.strings": "स्ट्रिंग्स",
    "shot.01": "शॉट 01",
    "shot.02": "शॉट 02",
    "shot.03": "शॉट 03",
    "shot.04": "शॉट 04",
    "shot.05": "शॉट 05",
    "shot.06": "शॉट 06",
    "settings.title": "शीर्षक",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "कस्टम लिरिक्स",
    "settings.lyricsPlaceholder": "अपने बोल या पूरी ओपेरा लिखें...",
    "settings.musicStyle": "संगीत शैली",
    "settings.voiceGender": "आवाज़ लिंग",
    "settings.bg1": "पृष्ठभूमि रंग 1",
    "settings.bg2": "पृष्ठभूमि रंग 2",
    "settings.bg3": "पृष्ठभूमि रंग 3",
    "settings.bg4": "पृष्ठभूमि रंग 4",
    "action.listen": "सुनें",
    "action.watch": "देखें",
    "action.enterWatch": "प्रवेश करें",
    "action.randomPalette": "रैंडम वॉटरकलर पैलेट",
    "action.applyRender": "लागू करें और रेंडर",
    "dock.mic": "माइक",
    "dock.foryou": "आपके लिए",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "गीत",
    "dock.music": "संगीत",
    "dock.video": "वीडियो",
    "dock.watch": "देखें",
    "dock.language": "भाषा",
    "dock.login": "लॉगिन",
    "dock.works": "रचनाएँ",
    "dock.settings": "सेटिंग्स",
    "language.subtitle": "इंटरफ़ेस भाषा",
    "language.more": "और भाषाएँ",
    "language.ready": "तैयार",
    "language.generating": "अनुवाद बनाया जा रहा है...",
    "login.subtitle": "सोशल लॉगिन",
    "billing.limitReached": "आज की सीमा पूरी हो गई",
    "works.subtitle": "रचनाएँ केंद्र",
    "works.profileRole": "क्रिएटर स्टूडियो",
    "works.followers": "फ़ॉलोअर्स",
    "works.circles": "सर्कल",
    "works.blocked": "ब्लॉक्ड",
    "works.yourWorks": "आपकी रचनाएँ",
    "works.comments": "टिप्पणियाँ",
    "works.monetization": "आय",
    "works.subscription": "सब्सक्रिप्शन",
    "works.platformShare": "प्लेटफ़ॉर्म हिस्सा",
    "works.fundsFlow":
      "सभी भुगतान पहले प्लेटफ़ॉर्म खाते में जाते हैं, फिर क्रिएटर्स को वितरित होते हैं।",
    "works.status.connected": "API जुड़ा है",
    "works.action.manage": "प्रबंधन",
    "works.action.price": "कीमत तय करें",
    "works.action.hide": "छिपाएँ",
    "works.action.delete": "हटाएँ",
    "works.action.block": "ब्लॉक करें",
    "works.action.follow": "फ़ॉलो करें",
    "works.price.access": "देखें/सुनें",
    "works.price.buyout": "पूरी खरीद",
    "works.price.tip": "टिप",
    "toast.awakened": "{spell} जाग गया · 流流流",
    "logo.slogan": "<span class=\"spell\">{spell}</span> बोलो, चमत्कार देखो!",
    "action.sayRender": "{spell} बोलो · रेंडर",
    "label.titlePrefix": "शीर्षक · {title}"
  },
  tr: {
    "panel.foryou": "Senin için",
    "panel.watch": "İzle",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "Söz motoru",
    "panel.music": "Müzik motoru",
    "panel.video": "Video motoru",
    "panel.settings": "Gelişmiş ayarlar",
    "panel.language": "Dil",
    "panel.login": "Giriş",
    "panel.works": "Eser Merkezi",
    "label.lyricsEngine": "Söz motoru · Rastgele single/opera",
    "label.watchBanner": "Karaoke MV · Canlı render",
    "label.autoWatch": "Otomatik izleme hattı",
    "label.mvSub": "3 sahne · 12 shot · Canlı Karaoke",
    "label.sceneMap": "Sahne haritası · Akışkan yazı",
    "label.waveform": "Dalga formu · Stil render",
    "label.storyboard": "Storyboard · Kamera akışı",
    "label.videoScript": "Otomatik senaryo yüklendi · 3 sahne hazır",
    "status.lyricsEngine": "Söz motoru",
    "status.audioEngine": "Ses motoru",
    "status.videoEngine": "Video motoru",
    "status.karaokeSync": "Karaoke senkron",
    "status.composing": "{spell} besteliyor...",
    "label.style": "Stil",
    "label.voice": "Ses",
    "track.leadVocal": "Ana vokal",
    "track.harmony": "Armoni",
    "track.strings": "Yaylılar",
    "shot.01": "Çekim 01",
    "shot.02": "Çekim 02",
    "shot.03": "Çekim 03",
    "shot.04": "Çekim 04",
    "shot.05": "Çekim 05",
    "shot.06": "Çekim 06",
    "settings.title": "Başlık",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "Özel sözler",
    "settings.lyricsPlaceholder": "Kendi dizelerini veya bir opera yaz...",
    "settings.musicStyle": "Müzik stili",
    "settings.voiceGender": "Ses cinsiyeti",
    "settings.bg1": "Arka plan rengi 1",
    "settings.bg2": "Arka plan rengi 2",
    "settings.bg3": "Arka plan rengi 3",
    "settings.bg4": "Arka plan rengi 4",
    "action.listen": "Dinle",
    "action.watch": "İzle",
    "action.enterWatch": "Giriş",
    "action.randomPalette": "Rastgele suluboya paleti",
    "action.applyRender": "Uygula ve render et",
    "dock.mic": "Mik",
    "dock.foryou": "Senin için",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "Sözler",
    "dock.music": "Müzik",
    "dock.video": "Video",
    "dock.watch": "İzle",
    "dock.language": "Dil",
    "dock.login": "Giriş",
    "dock.works": "Eserler",
    "dock.settings": "Ayarlar",
    "language.subtitle": "Arayüz dili",
    "language.more": "Daha fazla dil",
    "language.ready": "Hazır",
    "language.generating": "Çeviriler oluşturuluyor...",
    "login.subtitle": "Sosyal giriş",
    "billing.limitReached": "Günlük limit doldu",
    "works.subtitle": "Eser Merkezi",
    "works.profileRole": "Yaratıcı Stüdyo",
    "works.followers": "Takipçiler",
    "works.circles": "Çevreler",
    "works.blocked": "Engelliler",
    "works.yourWorks": "Eserlerin",
    "works.comments": "Yorumlar",
    "works.monetization": "Para kazanma",
    "works.subscription": "Abonelik",
    "works.platformShare": "Platform payı",
    "works.fundsFlow":
      "Tüm ödemeler önce platform hesabına gider, ardından içerik üreticilere dağıtılır.",
    "works.status.connected": "API bağlı",
    "works.action.manage": "Yönet",
    "works.action.price": "Fiyat belirle",
    "works.action.hide": "Gizle",
    "works.action.delete": "Sil",
    "works.action.block": "Engelle",
    "works.action.follow": "Takip et",
    "works.price.access": "İzle/Dinle",
    "works.price.buyout": "Satın alma",
    "works.price.tip": "Bahşiş",
    "toast.awakened": "{spell} uyandı · 流流流",
    "logo.slogan": "<span class=\"spell\">{spell}</span> de, mucizeyi gör!",
    "action.sayRender": "{spell} de · Render",
    "label.titlePrefix": "Başlık · {title}"
  },
  vi: {
    "panel.foryou": "Dành cho bạn",
    "panel.watch": "Xem",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "Bộ máy lời",
    "panel.music": "Bộ máy nhạc",
    "panel.video": "Bộ máy video",
    "panel.settings": "Cài đặt nâng cao",
    "panel.language": "Ngôn ngữ",
    "panel.login": "Đăng nhập",
    "panel.works": "Trung tâm tác phẩm",
    "label.lyricsEngine": "Bộ máy lời · Single/Opera ngẫu nhiên",
    "label.watchBanner": "Karaoke MV · Kết xuất trực tiếp",
    "label.autoWatch": "Pipeline xem tự động",
    "label.mvSub": "3 cảnh · 12 cảnh quay · Karaoke trực tiếp",
    "label.sceneMap": "Bản đồ cảnh · Gõ chữ mượt",
    "label.waveform": "Dạng sóng · Kết xuất phong cách",
    "label.storyboard": "Storyboard · Luồng camera",
    "label.videoScript": "Tải kịch bản tự động · 3 cảnh sẵn sàng",
    "status.lyricsEngine": "Bộ máy lời",
    "status.audioEngine": "Bộ máy âm thanh",
    "status.videoEngine": "Bộ máy video",
    "status.karaokeSync": "Đồng bộ Karaoke",
    "status.composing": "{spell} đang sáng tác...",
    "label.style": "Phong cách",
    "label.voice": "Giọng",
    "track.leadVocal": "Giọng chính",
    "track.harmony": "Hòa âm",
    "track.strings": "Dây",
    "shot.01": "Cảnh 01",
    "shot.02": "Cảnh 02",
    "shot.03": "Cảnh 03",
    "shot.04": "Cảnh 04",
    "shot.05": "Cảnh 05",
    "shot.06": "Cảnh 06",
    "settings.title": "Tiêu đề",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "Lời tùy chỉnh",
    "settings.lyricsPlaceholder": "Nhập lời của bạn hoặc cả vở opera...",
    "settings.musicStyle": "Phong cách nhạc",
    "settings.voiceGender": "Giới tính giọng",
    "settings.bg1": "Màu nền 1",
    "settings.bg2": "Màu nền 2",
    "settings.bg3": "Màu nền 3",
    "settings.bg4": "Màu nền 4",
    "action.listen": "Nghe",
    "action.watch": "Xem",
    "action.enterWatch": "Vào xem",
    "action.randomPalette": "Bảng màu nước ngẫu nhiên",
    "action.applyRender": "Áp dụng & kết xuất",
    "dock.mic": "Mic",
    "dock.foryou": "Dành cho bạn",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "Lời",
    "dock.music": "Nhạc",
    "dock.video": "Video",
    "dock.watch": "Xem",
    "dock.language": "Ngôn ngữ",
    "dock.login": "Đăng nhập",
    "dock.works": "Tác phẩm",
    "dock.settings": "Cài đặt",
    "language.subtitle": "Ngôn ngữ giao diện",
    "language.more": "Thêm ngôn ngữ",
    "language.ready": "Sẵn sàng",
    "language.generating": "Đang tạo bản dịch...",
    "login.subtitle": "Đăng nhập mạng xã hội",
    "billing.limitReached": "Đã đạt giới hạn hôm nay",
    "works.subtitle": "Trung tâm tác phẩm",
    "works.profileRole": "Studio sáng tạo",
    "works.followers": "Người theo dõi",
    "works.circles": "Vòng tròn",
    "works.blocked": "Bị chặn",
    "works.yourWorks": "Tác phẩm của bạn",
    "works.comments": "Bình luận",
    "works.monetization": "Kiếm tiền",
    "works.subscription": "Đăng ký",
    "works.platformShare": "Phần nền tảng",
    "works.fundsFlow":
      "Mọi khoản thanh toán đều vào tài khoản nền tảng trước, sau đó phân phối cho người sáng tạo.",
    "works.status.connected": "API đã kết nối",
    "works.action.manage": "Quản lý",
    "works.action.price": "Đặt giá",
    "works.action.hide": "Ẩn",
    "works.action.delete": "Xóa",
    "works.action.block": "Chặn",
    "works.action.follow": "Theo dõi",
    "works.price.access": "Xem/Nghe",
    "works.price.buyout": "Mua đứt",
    "works.price.tip": "Tip",
    "toast.awakened": "{spell} thức tỉnh · 流流流",
    "logo.slogan": "Chỉ cần nói <span class=\"spell\">{spell}</span>, phép màu xuất hiện!",
    "action.sayRender": "Nói {spell} · Kết xuất",
    "label.titlePrefix": "Tiêu đề · {title}"
  },
  th: {
    "panel.foryou": "เพื่อคุณ",
    "panel.watch": "ดู",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "เอนจินเนื้อเพลง",
    "panel.music": "เอนจินเพลง",
    "panel.video": "เอนจินวิดีโอ",
    "panel.settings": "การตั้งค่าขั้นสูง",
    "panel.language": "ภาษา",
    "panel.login": "เข้าสู่ระบบ",
    "panel.works": "ศูนย์ผลงาน",
    "label.lyricsEngine": "เอนจินเนื้อเพลง · ซิงเกิล/โอเปราแบบสุ่ม",
    "label.watchBanner": "Karaoke MV · เรนเดอร์สด",
    "label.autoWatch": "ไปป์ไลน์ดูอัตโนมัติ",
    "label.mvSub": "3 ฉาก · 12 ช็อต · Karaoke สด",
    "label.sceneMap": "แผนที่ฉาก · พิมพ์ไหลลื่น",
    "label.waveform": "คลื่นเสียง · เรนเดอร์สไตล์",
    "label.storyboard": "สตอรีบอร์ด · โฟลว์กล้อง",
    "label.videoScript": "โหลดสคริปต์อัตโนมัติ · 3 ฉากพร้อม",
    "status.lyricsEngine": "เอนจินเนื้อเพลง",
    "status.audioEngine": "เอนจินเสียง",
    "status.videoEngine": "เอนจินวิดีโอ",
    "status.karaokeSync": "ซิงก์ Karaoke",
    "status.composing": "{spell} กำลังแต่งเพลง...",
    "label.style": "สไตล์",
    "label.voice": "เสียง",
    "track.leadVocal": "นักร้องหลัก",
    "track.harmony": "ฮาร์โมนี",
    "track.strings": "เครื่องสาย",
    "shot.01": "ช็อต 01",
    "shot.02": "ช็อต 02",
    "shot.03": "ช็อต 03",
    "shot.04": "ช็อต 04",
    "shot.05": "ช็อต 05",
    "shot.06": "ช็อต 06",
    "settings.title": "ชื่อเรื่อง",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "เนื้อเพลงกำหนดเอง",
    "settings.lyricsPlaceholder": "ใส่เนื้อเพลงหรือโอเปราทั้งเรื่อง...",
    "settings.musicStyle": "สไตล์เพลง",
    "settings.voiceGender": "เพศเสียง",
    "settings.bg1": "สีพื้นหลัง 1",
    "settings.bg2": "สีพื้นหลัง 2",
    "settings.bg3": "สีพื้นหลัง 3",
    "settings.bg4": "สีพื้นหลัง 4",
    "action.listen": "ฟัง",
    "action.watch": "ดู",
    "action.enterWatch": "เข้าสู่การดู",
    "action.randomPalette": "พาเลตสีน้ำสุ่ม",
    "action.applyRender": "ใช้และเรนเดอร์",
    "dock.mic": "ไมค์",
    "dock.foryou": "เพื่อคุณ",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "เนื้อเพลง",
    "dock.music": "เพลง",
    "dock.video": "วิดีโอ",
    "dock.watch": "ดู",
    "dock.language": "ภาษา",
    "dock.login": "เข้าสู่ระบบ",
    "dock.works": "ผลงาน",
    "dock.settings": "ตั้งค่า",
    "language.subtitle": "ภาษาของอินเทอร์เฟซ",
    "language.more": "ภาษาเพิ่มเติม",
    "language.ready": "พร้อม",
    "language.generating": "กำลังสร้างคำแปล...",
    "login.subtitle": "เข้าสู่ระบบโซเชียล",
    "billing.limitReached": "ถึงขีดจำกัดรายวันแล้ว",
    "works.subtitle": "ศูนย์ผลงาน",
    "works.profileRole": "สตูดิโอผู้สร้าง",
    "works.followers": "ผู้ติดตาม",
    "works.circles": "วง",
    "works.blocked": "บล็อกแล้ว",
    "works.yourWorks": "ผลงานของคุณ",
    "works.comments": "ความคิดเห็น",
    "works.monetization": "การสร้างรายได้",
    "works.subscription": "สมัครสมาชิก",
    "works.platformShare": "ส่วนแบ่งแพลตฟอร์ม",
    "works.fundsFlow":
      "การชำระเงินทั้งหมดจะเข้าบัญชีแพลตฟอร์มก่อน แล้วจึงกระจายให้ผู้สร้าง",
    "works.status.connected": "เชื่อมต่อ API แล้ว",
    "works.action.manage": "จัดการ",
    "works.action.price": "ตั้งราคา",
    "works.action.hide": "ซ่อน",
    "works.action.delete": "ลบ",
    "works.action.block": "บล็อก",
    "works.action.follow": "ติดตาม",
    "works.price.access": "ดู/ฟัง",
    "works.price.buyout": "ซื้อขาด",
    "works.price.tip": "ทิป",
    "toast.awakened": "{spell} ตื่นขึ้น · 流流流",
    "logo.slogan": "พูด <span class=\"spell\">{spell}</span> แล้วปาฏิหาริย์เกิดขึ้น!",
    "action.sayRender": "พูด {spell} · เรนเดอร์",
    "label.titlePrefix": "ชื่อเรื่อง · {title}"
  },
  id: {
    "panel.foryou": "Untukmu",
    "panel.watch": "Tonton",
    "panel.cssmv": "CSS MV",
    "panel.lyrics": "Mesin lirik",
    "panel.music": "Mesin musik",
    "panel.video": "Mesin video",
    "panel.settings": "Pengaturan lanjutan",
    "panel.language": "Bahasa",
    "panel.login": "Masuk",
    "panel.works": "Pusat karya",
    "label.lyricsEngine": "Mesin lirik · Single/Opera acak",
    "label.watchBanner": "Karaoke MV · Render langsung",
    "label.autoWatch": "Pipeline tonton otomatis",
    "label.mvSub": "3 adegan · 12 shot · Karaoke langsung",
    "label.sceneMap": "Peta adegan · Pengetikan mengalir",
    "label.waveform": "Gelombang · Render gaya",
    "label.storyboard": "Storyboard · Alur kamera",
    "label.videoScript": "Skrip otomatis dimuat · 3 adegan siap",
    "status.lyricsEngine": "Mesin lirik",
    "status.audioEngine": "Mesin audio",
    "status.videoEngine": "Mesin video",
    "status.karaokeSync": "Sinkronisasi Karaoke",
    "status.composing": "{spell} sedang menggubah...",
    "label.style": "Gaya",
    "label.voice": "Suara",
    "track.leadVocal": "Vokal utama",
    "track.harmony": "Harmoni",
    "track.strings": "Senar",
    "shot.01": "Shot 01",
    "shot.02": "Shot 02",
    "shot.03": "Shot 03",
    "shot.04": "Shot 04",
    "shot.05": "Shot 05",
    "shot.06": "Shot 06",
    "settings.title": "Judul",
    "settings.titlePlaceholder": "嫦娥奔月 / Moon of Chang'e",
    "settings.customLyrics": "Lirik kustom",
    "settings.lyricsPlaceholder": "Masukkan baitmu atau opera penuh...",
    "settings.musicStyle": "Gaya musik",
    "settings.voiceGender": "Gender suara",
    "settings.bg1": "Warna latar 1",
    "settings.bg2": "Warna latar 2",
    "settings.bg3": "Warna latar 3",
    "settings.bg4": "Warna latar 4",
    "action.listen": "Dengarkan",
    "action.watch": "Tonton",
    "action.enterWatch": "Masuk",
    "action.randomPalette": "Palet cat air acak",
    "action.applyRender": "Terapkan & render",
    "dock.mic": "Mic",
    "dock.foryou": "Untukmu",
    "dock.cssmv": "CSS MV",
    "dock.lyrics": "Lirik",
    "dock.music": "Musik",
    "dock.video": "Video",
    "dock.watch": "Tonton",
    "dock.language": "Bahasa",
    "dock.login": "Masuk",
    "dock.works": "Karya",
    "dock.settings": "Pengaturan",
    "language.subtitle": "Bahasa antarmuka",
    "language.more": "Bahasa lainnya",
    "language.ready": "Siap",
    "language.generating": "Membuat terjemahan...",
    "login.subtitle": "Masuk sosial",
    "billing.limitReached": "Batas harian tercapai",
    "works.subtitle": "Pusat karya",
    "works.profileRole": "Studio kreator",
    "works.followers": "Pengikut",
    "works.circles": "Lingkaran",
    "works.blocked": "Diblokir",
    "works.yourWorks": "Karyamu",
    "works.comments": "Komentar",
    "works.monetization": "Monetisasi",
    "works.subscription": "Langganan",
    "works.platformShare": "Porsi platform",
    "works.fundsFlow":
      "Semua pembayaran masuk ke akun platform terlebih dahulu, lalu didistribusikan ke kreator.",
    "works.status.connected": "API tersambung",
    "works.action.manage": "Kelola",
    "works.action.price": "Tetapkan harga",
    "works.action.hide": "Sembunyikan",
    "works.action.delete": "Hapus",
    "works.action.block": "Blokir",
    "works.action.follow": "Ikuti",
    "works.price.access": "Lihat/Dengar",
    "works.price.buyout": "Beli putus",
    "works.price.tip": "Tip",
    "toast.awakened": "{spell} terbangun · 流流流",
    "logo.slogan": "Ucapkan <span class=\"spell\">{spell}</span>, saksikan keajaiban!",
    "action.sayRender": "Ucapkan {spell} · Render",
    "label.titlePrefix": "Judul · {title}"
  }
};

const SOCIAL_KEYS = (() => {
  const meta = document.querySelector('meta[name="social-keys"]');
  if (meta && meta.content) {
    const list = meta.content
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return list.reduce((acc, key) => {
      acc[key.toLowerCase()] = true;
      return acc;
    }, {});
  }
  if (window.CSSOS_SOCIAL_KEYS && typeof window.CSSOS_SOCIAL_KEYS === "object") {
    return window.CSSOS_SOCIAL_KEYS;
  }
  return {};
})();

const socialPlatforms = [
  { id: "apple", icon: "A" },
  { id: "behance", icon: "Be" },
  { id: "discord", icon: "Di" },
  { id: "dribbble", icon: "Dr" },
  { id: "facebook", icon: "Fb" },
  { id: "github", icon: "GH" },
  { id: "gitlab", icon: "GL" },
  { id: "google", icon: "G" },
  { id: "instagram", icon: "Ig" },
  { id: "kakaotalk", icon: "Ka" },
  { id: "line", icon: "Li" },
  { id: "linkedin", icon: "In" },
  { id: "medium", icon: "Me" },
  { id: "pinterest", icon: "Pi" },
  { id: "reddit", icon: "Re" },
  { id: "slack", icon: "Sl" },
  { id: "stackoverflow", icon: "SO" },
  { id: "telegram", icon: "Te" },
  { id: "tiktok", icon: "Tk" },
  { id: "twitch", icon: "Tw" },
  { id: "wechat", icon: "We" },
  { id: "weibo", icon: "Wb" },
  { id: "whatsapp", icon: "Wa" },
  { id: "x", icon: "X" }
];

const PLATFORM_LABELS = {
  en: {
    apple: "Apple",
    behance: "Behance",
    discord: "Discord",
    dribbble: "Dribbble",
    facebook: "Facebook",
    github: "GitHub",
    gitlab: "GitLab",
    google: "Google",
    instagram: "Instagram",
    kakaotalk: "KakaoTalk",
    line: "LINE",
    linkedin: "LinkedIn",
    medium: "Medium",
    pinterest: "Pinterest",
    reddit: "Reddit",
    slack: "Slack",
    stackoverflow: "Stack Overflow",
    telegram: "Telegram",
    tiktok: "TikTok",
    twitch: "Twitch",
    wechat: "WeChat",
    weibo: "Weibo",
    whatsapp: "WhatsApp",
    x: "X"
  },
  zh: {
    apple: "苹果",
    behance: "Behance",
    discord: "Discord",
    dribbble: "Dribbble",
    facebook: "脸书",
    github: "GitHub",
    gitlab: "GitLab",
    google: "谷歌",
    instagram: "Instagram",
    kakaotalk: "KakaoTalk",
    line: "LINE",
    linkedin: "领英",
    medium: "Medium",
    pinterest: "Pinterest",
    reddit: "Reddit",
    slack: "Slack",
    stackoverflow: "Stack Overflow",
    telegram: "Telegram",
    tiktok: "抖音",
    twitch: "Twitch",
    wechat: "微信",
    weibo: "微博",
    whatsapp: "WhatsApp",
    x: "X"
  }
};

const currentLocaleStore = localStorage.getItem(LOCALE_KEY);
let currentLocale = currentLocaleStore || DEFAULT_LOCALE;
let languageTimer = null;

const getLocale = () => currentLocale;

function interpolate(template, vars = {}) {
  return template.replace(/\\{(\\w+)\\}/g, (_, key) => (vars[key] ?? `{${key}}`));
}

function t(key, vars = {}, localeOverride) {
  const locale = localeOverride || currentLocale || DEFAULT_LOCALE;
  const table = I18N[locale] || I18N[DEFAULT_LOCALE];
  const fallback = I18N[DEFAULT_LOCALE] || {};
  const template = table[key] || fallback[key] || "";
  return interpolate(template, vars);
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (!key) return;
    const text = t(key, { spell: state.spell });
    if (text) {
      el.textContent = text;
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (!key) return;
    const text = t(key);
    if (text) {
      el.setAttribute("placeholder", text);
    }
  });
}

function getPlatformLabel(platformId) {
  const locale = PLATFORM_LABELS[currentLocale] ? currentLocale : DEFAULT_LOCALE;
  return (
    PLATFORM_LABELS[locale]?.[platformId] ||
    PLATFORM_LABELS[DEFAULT_LOCALE]?.[platformId] ||
    platformId
  );
}

function isSocialEnabled(platformId) {
  if (!SOCIAL_KEYS) return false;
  const direct = SOCIAL_KEYS[platformId];
  if (direct) return true;
  const upper = platformId.toUpperCase();
  if (SOCIAL_KEYS[upper]) return true;
  const snake = platformId.replace(/-/g, "_").toUpperCase();
  return Boolean(SOCIAL_KEYS[snake]);
}

function renderLoginPlatforms() {
  if (!loginList) return;
  loginList.innerHTML = "";
  const enabledMap = new Map(
    authProviders.map((provider) => [
      provider.id,
      {
        enabled: provider.enabled,
        url: provider.url,
        icon: provider.icon
      }
    ])
  );
  const list = socialPlatforms.map((platform) => {
    const record = enabledMap.get(platform.id);
    return {
      id: platform.id,
      icon: record?.icon || platform.icon,
      enabled: record?.enabled ?? isSocialEnabled(platform.id),
      url: record?.url || (record?.enabled ? `/api/auth/${platform.id}` : "")
    };
  });

  list.forEach((platform) => {
    const enabled = Boolean(platform.enabled);
    const card = document.createElement(enabled ? "a" : "div");
    card.className = `login-card ${enabled ? "enabled" : "disabled"}`;
    if (enabled && platform.url) {
      card.href = platform.url;
    }
    card.innerHTML = `
      <div class="login-icon">${platform.icon}</div>
      <div class="login-title">${getPlatformLabel(platform.id)}</div>
    `;
    loginList.appendChild(card);
  });
}

function normalizeVersionList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map((item) => (typeof item === "string" ? { id: item } : item));
  }
  if (Array.isArray(payload.versions)) {
    return payload.versions.map((item) => (typeof item === "string" ? { id: item } : item));
  }
  return [];
}

async function loadVersions() {
  if (!versionToggle || !versionMenu || !versionList) return;
  try {
    const [currentRes, listRes] = await Promise.all([
      fetch("/version.json", { cache: "no-store" }).catch(() => null),
      fetch("/versions.json", { cache: "no-store" }).catch(() => null)
    ]);
    const currentData = currentRes && currentRes.ok ? await currentRes.json() : null;
    const listData = listRes && listRes.ok ? await listRes.json() : null;
    const current =
      currentData?.version || currentData?.id || listData?.current || "current";
    const versions = normalizeVersionList(listData);
    if (!versions.length) {
      versionToggle.classList.add("is-hidden");
      return;
    }
    if (versionCurrentLabel) {
      versionCurrentLabel.textContent = `${t("versions.current")} · ${current}`;
    }
    versionList.innerHTML = "";
    versions.forEach((entry) => {
      const id = entry.id || entry.version || entry.name;
      if (!id) return;
      const path = entry.path || `/v/${id}/`;
      const label = entry.label || id;
      const item = document.createElement("a");
      item.href = path;
      item.className = `version-item ${id === current ? "active" : ""}`;
      item.innerHTML = `
        <span>${label}</span>
        <span>${entry.createdAt || entry.date || ""}</span>
      `;
      versionList.appendChild(item);
    });
  } catch (err) {
    versionToggle.classList.add("is-hidden");
  }
}

function initVersionSwitcher() {
  if (!versionToggle || !versionMenu) return;
  versionToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    versionMenu.classList.toggle("is-hidden");
  });
  document.addEventListener("click", () => {
    versionMenu.classList.add("is-hidden");
  });
  loadVersions();
}

function updateComposingText() {
  if (!watchSubtitle) return;
  watchSubtitle.textContent = t("status.composing", { spell: state.spell });
}

function renderLanguageButtons(container, languages) {
  if (!container) return;
  container.innerHTML = "";
  languages.forEach((lang) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lang-card";
    button.dataset.lang = lang.code;
    button.innerHTML = `
      <span class="lang-flag">${lang.flag}</span>
      <span class="lang-name">${lang.label}</span>
      <span class="lang-native">${lang.native}</span>
    `;
    button.addEventListener("click", () => setLocale(lang.code));
    container.appendChild(button);
  });
}

function updateLanguageSelection() {
  document.querySelectorAll(".lang-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.lang === currentLocale);
  });
}

function updateLanguageStatus(textKey) {
  if (!languageStatus) return;
  languageStatus.textContent = t(textKey);
}

function updateLanguageCurrent() {
  if (!languageCurrent) return;
  const list = [...languageCatalog.popular, ...languageCatalog.more];
  const current = list.find((lang) => lang.code === currentLocale);
  if (current) {
    languageCurrent.textContent = `${current.flag} ${current.label} · ${current.native}`;
  }
}

function setLocale(locale) {
  if (!locale) return;
  if (!I18N[locale]) {
    locale = DEFAULT_LOCALE;
  }
  currentLocale = locale;
  localStorage.setItem(LOCALE_KEY, locale);
  document.documentElement.lang = locale;
  clearTimeout(languageTimer);
  updateLanguageStatus("language.generating");
  const delay = locale === DEFAULT_LOCALE ? 0 : 420;
  languageTimer = setTimeout(() => {
    applyI18n();
    updateComposingText();
    renderLoginPlatforms();
    updateLoginUI();
    loadVersions();
    updateLanguageStatus("language.ready");
    updateLanguageSelection();
    updateLanguageCurrent();
  }, delay);
}

function initLanguagePanel() {
  renderLanguageButtons(languageList, languageCatalog.popular);
  renderLanguageButtons(languageListMore, languageCatalog.more);
  updateLanguageSelection();
  updateLanguageCurrent();
  if (languageMoreButton && languageListMore) {
    languageMoreButton.addEventListener("click", () => {
      languageListMore.classList.toggle("is-hidden");
    });
  }
  if (currentLocale && I18N[currentLocale]) {
    document.documentElement.lang = currentLocale;
    applyI18n();
    updateComposingText();
    renderLoginPlatforms();
  } else {
    setLocale(DEFAULT_LOCALE);
  }
  updateLanguageStatus("language.ready");
}
const DEFAULT_SPELL = "CSS";

const LOCAL_FALLBACK_MP4 =
  "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAABQVtZGF0AAACrwYF//+r3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NSByMzIyMiBiMzU2MDVhIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTExIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj0yNCBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAAFpliIQAO//+906/AptO4yoDklcK9sqkJlm5UmsB8qYAAAMAAAMAAAMAkIRx7muVyT1mgAAAL2AI2DJhyBRBFxCBHBniWEKHSMoAAAMAAAMAAAMAAAMAAAMA/YEAAAASQZokbEO//qmWAAADAAADAOWAAAAADkGeQniF/wAAAwAAAwEPAAAADgGeYXRCvwAAAwAAAwF3AAAADgGeY2pCvwAAAwAAAwF3AAAAGEGaaEmoQWiZTAh3//6plgAAAwAAAwDlgQAAABBBnoZFESwv/wAAAwAAAwEPAAAADgGepXRCvwAAAwAAAwF3AAAADgGep2pCvwAAAwAAAwF3AAAAGEGarEmoQWyZTAh3//6plgAAAwAAAwDlgAAAABBBnspFFSwv/wAAAwAAAwEPAAAADgGe6XRCvwAAAwAAAwF3AAAADgGe62pCvwAAAwAAAwF3AAAAF0Ga8EmoQWyZTAhv//6nhAAAAwAAAwHHAAAAEEGfDkUVLC//AAADAAADAQ8AAAAOAZ8tdEK/AAADAAADAXcAAAAOAZ8vakK/AAADAAADAXcAAAAXQZs0SahBbJlMCG///qeEAAADAAADAccAAAAQQZ9SRRUsL/8AAAMAAAMBDwAAAA4Bn3F0Qr8AAAMAAAMBdwAAAA4Bn3NqQr8AAAMAAAMBdwAAABZBm3hJqEFsmUwIV//+OEAAAAMAABsxAAAAEEGflkUVLC//AAADAAADAQ8AAAAOAZ+1dEK/AAADAAADAXcAAAAOAZ+3akK/AAADAAADAXcAAARnbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAABBIAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAA5J0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAABBIAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAoAAAAFoAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAQSAAAEAAABAAAAAAMKbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAwAAAAMgBVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAACtW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAnVzdGJsAAAAwXN0c2QAAAAAAAAAAQAAALFhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAoABaABIAAAASAAAAAAAAAABFUxhdmM2Mi4xMS4xMDAgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAAN2F2Y0MBZAAe/+EAGmdkAB6s2UCgL/lwEQAAAwABAAADADAPFi2WAQAGaOvjyyLA/fj4AAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAACZPAAAAAAAAABhzdHRzAAAAAAAAAAEAAAAZAAACAAAAABRzdHNzAAAAAAAAAAEAAAABAAAA2GN0dHMAAAAAAAAAGQAAAAEAAAQAAAAAAQAACgAAAAABAAAEAAAAAAEAAAAAAAAAAQAAAgAAAAABAAAKAAAAAAEAAAQAAAAAAQAAAAAAAAABAAACAAAAAAEAAAoAAAAAAQAABAAAAAABAAAAAAAAAAEAAAIAAAAAAQAACgAAAAABAAAEAAAAAAEAAAAAAAAAAQAAAgAAAAABAAAKAAAAAAEAAAQAAAAAAQAAAAAAAAABAAACAAAAAAEAAAoAAAAAAQAABAAAAAABAAAAAAAAAAEAAAIAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAAZAAAAAQAAAHhzdHN6AAAAAAAAAAAAAAAZAAADEQAAABYAAAASAAAAEgAAABIAAAAcAAAAFAAAABIAAAASAAAAHAAAABQAAAASAAAAEgAAABsAAAAUAAAAEgAAABIAAAAbAAAAFAAAABIAAAASAAAAGgAAABQAAAASAAAAEgAAABRzdGNvAAAAAAAAAAEAAAAwAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2Mi4zLjEwMA==";

const panelSettingsDefaults = new WeakMap();

let inactivityTimer;
let typingTimer;
let progressTimer;
let topZ = 10;
let lastTrailTime = 0;
let lastTrailPoint = null;
let watchTriggered = false;
let cssmvTriggered = false;
let typingState = { paused: false, canceled: false };
let sceneRows = [];
let videoJobId = null;
let videoJobPoll = null;
let watchVideoUrl = null;
let ambientTrailTime = 0;
let ambientTrailPoint = null;
let lyricsTargetLength = 0;
let playbackRetry = 0;
let playbackTimer = null;
let manualPlayHinted = false;

const engineStates = {
  lyrics: "running",
  music: "running",
  video: "running",
  kara: "running"
};
const dockClickTimers = new Map();
const LONGPRESS_MS = 600;
const CLICK_DELAY = 220;
const TRAIL_INTERVAL = 70;

const lyricBank = [
  {
    title: "嫦娥奔月",
    lines: [
      "Verse 1 · 月影引航",
      "云海轻翻，玉阶点亮夜的青芒",
      "你把人间的灯火藏进袖里",
      "",
      "Verse 2 · 人间回响",
      "风把旧梦吹向天河的彼岸",
      "我在流光里喊你一声——回望",
      "",
      "Chorus 1 · 潮汐合唱",
      "唱吧，穿越苍穹的誓言",
      "一句CSS点亮归途",
      "",
      "Verse 3 · 广寒孤旅",
      "桂树微响，时间在月宫起舞",
      "你的影子长成琴弦",
      "",
      "Verse 4 · 星河写信",
      "我把心事写成光，投向故乡",
      "梦在指尖发芽",
      "",
      "Chorus 2 · 天门回响",
      "唱吧，银河替你推开天窗",
      "一声CSS穿透长夜",
      "",
      "Bridge · 归途之门",
      "潮汐翻页，尘世与月宫同频",
      "我们在静光里相认",
      "",
      "Chorus 3 · 梦之回声",
      "唱吧，未来在我们肩上发亮",
      "流流流的光一路起航",
      "",
      "Chorus 4 · 月光誓言",
      "唱吧，直到天边被唤醒",
      "一声CSS把爱带回",
      "",
      "Outro · 归来",
      "人间与月宫，只隔一声CSS",
      "我们同唱流流流，梦就起航"
    ]
  },
  {
    title: "流光之城",
    lines: [
      "Verse 1 · 城市苏醒",
      "霓虹是河流，街道在呼吸",
      "你点亮CSS，我听见电光歌唱",
      "",
      "Verse 2 · 玻璃之海",
      "楼群像浪，心跳化作光",
      "我们在未来街口相望",
      "",
      "Chorus 1 · 演出开启",
      "唱吧，屏幕化作舞台",
      "一句CSS点亮全城",
      "",
      "Verse 3 · 引擎风暴",
      "音乐引擎拉起风，视频引擎铺开海",
      "脚步变成鼓点",
      "",
      "Verse 4 · 人声波纹",
      "每一句歌词都有光的轮廓",
      "我们把现在写成明天的传说",
      "",
      "Chorus 2 · 未来合唱",
      "唱吧，霓虹替我们作证",
      "一声CSS让心发亮",
      "",
      "Bridge · 夜色转场",
      "穿过高楼与云层，我们向上",
      "让城市听见我们的名字",
      "",
      "Chorus 3 · 电子之心",
      "唱吧，电流成为和声",
      "流流流的光一路回响",
      "",
      "Chorus 4 · 光之誓言",
      "唱吧，直到晨曦降临",
      "一句CSS写下奇迹",
      "",
      "Outro · 落幕",
      "城市仍在呼吸，你我仍在歌唱"
    ]
  }
];

const styleTagMap = {
  "Chinese GuFeng": ["GuFeng", "Pipa", "Moonlit", "Jade", "Silk", "Temple"],
  "Neo-Opera": ["Opera", "Stage", "Vibrato", "Crimson", "Spotlight"],
  "Future Ballad": ["Ballad", "Neon", "Synth", "Halo", "Dreamline"],
  "Cyber Folk": ["Folk", "Circuit", "Pulse", "Hologram", "Glow"]
};

const mvTagBank = ["KaraOK", "Flow", "Celestial", "Live", "Mythic", "Glass"];
const videoTagBank = ["Storyboard", "Cinematic", "Long Take", "4K", "Stage FX", "Haze"];
const cameraMoveBank = ["Dolly In", "Orbit", "Crane Rise", "Silk Pan", "Slow Zoom", "Parallax"];
const lensBank = ["35mm", "50mm", "85mm", "Wide", "Tele", "Macro"];
const mixBank = ["Lead Vocal", "Harmony", "Strings", "Pipa", "Synth Pad", "Bass", "Percussion"];
const flowBank = ["Verse", "Chorus", "Bridge", "Hook", "Outro"];
const starPalette = [
  {
    c1: "#f8fff0",
    c2: "#aafee0",
    glow: "rgba(248, 255, 240, 0.6)",
    haze: "rgba(180, 255, 230, 0.4)",
    haze2: "rgba(120, 240, 255, 0.3)"
  },
  {
    c1: "#00f5a0",
    c2: "#0bf7ff",
    glow: "rgba(0, 245, 160, 0.7)",
    haze: "rgba(0, 245, 160, 0.45)",
    haze2: "rgba(11, 247, 255, 0.35)"
  },
  {
    c1: "#0bf7ff",
    c2: "#00f5a0",
    glow: "rgba(11, 247, 255, 0.7)",
    haze: "rgba(11, 247, 255, 0.45)",
    haze2: "rgba(0, 245, 160, 0.3)"
  },
  {
    c1: "#c9ffe9",
    c2: "#0bf7ff",
    glow: "rgba(201, 255, 233, 0.7)",
    haze: "rgba(190, 255, 234, 0.45)",
    haze2: "rgba(11, 247, 255, 0.28)"
  }
];

const state = {
  title: lyricBank[0].title,
  baseLines: lyricBank[0].lines,
  lines: lyricBank[0].lines,
  spell: DEFAULT_SPELL,
  style: styleInput ? styleInput.value : "Chinese GuFeng",
  voice: voiceInput ? voiceInput.value : "Feminine"
};

const authState = {
  user: null,
  role: DEFAULT_ROLE,
  tier: DEFAULT_ROLE
};

let authProviders = [];

const getUserRole = () =>
  (authState.role ||
    window.CSSOS_USER_ROLE ||
    localStorage.getItem(USER_ROLE_KEY) ||
    DEFAULT_ROLE ||
    "guest").toString();

const billingState = {
  tier: DEFAULT_ROLE,
  remaining: null,
  limit: null
};

const DAILY_LIMITS = {
  guest: 1,
  user: 10,
  starter: 30,
  pro: Infinity
};

function getDailyLimit(role) {
  return DAILY_LIMITS[role] ?? DAILY_LIMITS.guest;
}

function getUsageKey() {
  const id = authState.user?.id || "guest";
  return `cssos.usage.${id}`;
}

async function fetchMe() {
  try {
    const res = await fetch("/api/me", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    authState.user = data.user || null;
    authState.role = data.role || DEFAULT_ROLE;
    authState.tier = data.tier || authState.role || DEFAULT_ROLE;
    updateLoginUI();
    fetchBillingStatus();
  } catch (err) {
    // ignore
  }
}

function updateLoginUI() {
  if (loginStatus) {
    loginStatus.textContent = authState.user ? t("login.statusSigned") : t("login.statusGuest");
  }
  if (loginUser) {
    if (authState.user) {
      const label = authState.user.name || authState.user.email || authState.user.id;
      loginUser.textContent = label || "";
    } else {
      loginUser.textContent = "";
    }
  }
  if (loginLogout) {
    loginLogout.style.display = authState.user ? "inline-flex" : "none";
  }
}

async function fetchAuthProviders() {
  try {
    const res = await fetch("/api/auth/providers", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    authProviders = Array.isArray(data.providers) ? data.providers : [];
    renderLoginPlatforms();
  } catch (err) {
    // ignore
  }
}

function consumeLocalUsage() {
  const today = new Date().toISOString().slice(0, 10);
  const raw = localStorage.getItem(getUsageKey());
  const data = raw ? JSON.parse(raw) : { date: today, count: 0 };
  if (data.date !== today) {
    data.date = today;
    data.count = 0;
  }
  const limit = getDailyLimit(getUserRole());
  if (limit !== Infinity && data.count >= limit) {
    showToast(t("billing.limitReached") || "Daily limit reached");
    return false;
  }
  data.count += 1;
  localStorage.setItem(getUsageKey(), JSON.stringify(data));
  return true;
}

async function consumeGeneration() {
  try {
    const res = await fetch("/api/billing/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({})
    });
    if (res.ok) {
      const data = await res.json();
      billingState.tier = data.tier || billingState.tier;
      billingState.remaining = data.remaining;
      billingState.limit = data.limit;
      if (!data.allowed) {
        showToast(t("billing.limitReached") || "Daily limit reached");
        return false;
      }
      return true;
    }
  } catch (err) {
    // fallback to local counters
  }
  return consumeLocalUsage();
}

async function fetchBillingStatus() {
  try {
    const res = await fetch("/api/billing/status", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      billingState.tier = data.tier || billingState.tier;
      billingState.remaining = data.remaining;
      billingState.limit = data.limit;
    }
  } catch (err) {
    // ignore
  }
}

const panels = [
  logoPanel,
  foryouPanel,
  watchPanel,
  cssmvPanel,
  lyricsPanel,
  musicPanel,
  videoPanel,
  settingsPanel,
  languagePanel,
  loginPanel,
  worksPanel
];

const dockByPanel = {
  "foryou-panel": "foryou",
  "watch-panel": "watch",
  "cssmv-panel": "cssmv",
  "lyrics-panel": "lyrics",
  "music-panel": "music",
  "video-panel": "video",
  "settings-panel": "settings",
  "language-panel": "language",
  "login-panel": "login",
  "works-panel": "works"
};
const MIN_PANEL_WIDTH = 320;
const MIN_PANEL_HEIGHT = 240;

function showDock() {
  dock.classList.remove("hidden");
}

function hideDock() {
  dock.classList.add("hidden");
}

function resetInactivityTimer() {
  showDock();
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(hideDock, 10000);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function typewriter(el, text, speed = 24, callback) {
  clearTimeout(typingTimer);
  el.textContent = "";
  let i = 0;
  if (lyricsProgress) setProgress(lyricsProgress, 0);

  const step = () => {
    if (typingState.canceled) {
      if (lyricsProgress) setProgress(lyricsProgress, 0);
      return;
    }
    if (typingState.paused) {
      typingTimer = setTimeout(step, 120);
      return;
    }
    el.textContent += text.charAt(i);
    i += 1;
    if (lyricsProgress) {
      const pct = text.length ? Math.min(100, (i / text.length) * 100) : 0;
      setProgress(lyricsProgress, pct);
    }
    if (i < text.length) {
      typingTimer = setTimeout(step, speed);
    } else if (callback) {
      if (lyricsProgress) setProgress(lyricsProgress, 100);
      callback();
    }
  };

  step();
}

function setProgress(el, value) {
  el.style.width = `${value}%`;
}

function resetVideoPreview() {
  if (!watchVideo) return;
  watchVideo.pause?.();
  watchVideo.removeAttribute("src");
  watchVideo.load?.();
  if (watchVideoUrl) {
    URL.revokeObjectURL(watchVideoUrl);
    watchVideoUrl = null;
  }
  if (watchSvg) {
    watchSvg.removeAttribute("src");
    watchSvg.style.display = "none";
  }
  watchVideo.style.display = "";
}

function setVideoFromArtifact(uri) {
  if (!watchVideo || !uri) return false;
  if (!uri.startsWith("data:")) {
    watchVideo.src = uri;
    watchVideo.muted = true;
    watchVideo.playsInline = true;
    watchVideo.load?.();
    return true;
  }
  const [meta, data] = uri.split(",");
  if (!data) return false;
  const mimeMatch = meta.match(/data:([^;]+);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "video/mp4";
  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    watchVideoUrl = URL.createObjectURL(blob);
    watchVideo.src = watchVideoUrl;
    watchVideo.muted = true;
    watchVideo.playsInline = true;
    watchVideo.load?.();
    watchVideo.style.display = "";
    if (watchSvg) watchSvg.style.display = "none";
    return true;
  } catch (err) {
    return false;
  }
}

function setSvgPreview(uri) {
  if (!watchSvg || !uri) return false;
  watchSvg.src = uri;
  watchSvg.style.display = "block";
  watchSvg.classList.add("glow");
  if (watchVideo) watchVideo.style.display = "none";
  return true;
}

function clearPlaybackRetry() {
  if (playbackTimer) {
    clearTimeout(playbackTimer);
    playbackTimer = null;
  }
  playbackRetry = 0;
}

function promptManualPlay(message) {
  manualPlayHinted = true;
  if (watchSubtitle) watchSubtitle.textContent = message;
  showToast(message);
}

function attemptVideoPlayback(options = {}) {
  if (!watchVideo || !watchVideo.src) return;
  const maxRetries = options.maxRetries ?? 5;
  const interval = options.interval ?? 900;
  const allowFallback = options.allowFallback ?? false;
  clearPlaybackRetry();

  const tryPlay = () => {
    if (!watchVideo || !watchVideo.src) return;
    const playPromise = watchVideo.play?.();
    if (!playPromise || typeof playPromise.then !== "function") return;
    playPromise
      .then(() => {
        clearPlaybackRetry();
        manualPlayHinted = false;
        if (watchSubtitle) watchSubtitle.textContent = "KaraOK MV · Playing";
      })
      .catch(() => {
        playbackRetry += 1;
        if (playbackRetry <= maxRetries) {
          showToast(`Auto retry ${playbackRetry}/${maxRetries}`);
          playbackTimer = setTimeout(tryPlay, interval);
          return;
        }
        if (allowFallback) {
          useLocalVideoFallback(state.title, `${state.style} ${state.voice} cinematic mv`);
        }
        promptManualPlay("Autoplay blocked · Tap to play");
      });
  };

  tryPlay();
}

function initVideoPlaybackControls() {
  if (!watchVideo) return;
  watchVideo.addEventListener("canplay", () => {
    attemptVideoPlayback({ maxRetries: 2 });
  });
  watchVideo.addEventListener("error", () => {
    useLocalVideoFallback(state.title, `${state.style} ${state.voice} cinematic mv`);
    attemptVideoPlayback({ maxRetries: 2 });
  });
  const clickTarget = document.querySelector(".watch-screen");
  if (clickTarget) {
    clickTarget.addEventListener("click", () => {
      if (!watchVideo?.src) return;
      attemptVideoPlayback({ maxRetries: 0 });
      if (manualPlayHinted) {
        showToast("Playback resumed");
      }
    });
  }
}

async function playLatestVideoFromRegistry() {
  try {
    const res = await fetch(
      "/api/registry/v1/jobs/latest?capability_id=video.gan.v1&status=succeeded"
    );
    if (!res.ok) return false;
    const payload = await res.json();
    const job = payload?.job || payload;
    if (!job) return false;
    const artifacts = job.artifacts || [];
    const videoArtifact = artifacts.find((item) => item.name === "video_preview.mp4");
    const svgArtifact = artifacts.find((item) => item.name === "video_preview.svg");
    if (videoArtifact && setVideoFromArtifact(videoArtifact.uri)) {
      watchSubtitle.textContent = "KaraOK MV · Preview";
      attemptVideoPlayback({ allowFallback: true });
      return true;
    }
    if (svgArtifact) {
      setSvgPreview(svgArtifact.uri);
      watchSubtitle.textContent = "KaraOK MV · Preview";
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

function useLocalVideoFallback(title, subtitle) {
  const ok = setVideoFromArtifact(LOCAL_FALLBACK_MP4);
  if (ok) {
    watchSubtitle.textContent = "KaraOK MV · Preview (Local)";
    attemptVideoPlayback({ maxRetries: 2 });
    return;
  }
  setSvgPreview(buildLocalVideoPreviewSvg(title, subtitle));
  watchSubtitle.textContent = "KaraOK MV · Preview (Local)";
}

async function requestVideoPreview(title, lines) {
  if (!watchVideo) return;
  if (videoJobPoll) {
    clearInterval(videoJobPoll);
    videoJobPoll = null;
  }
  videoJobId = null;
  resetVideoPreview();
  const prompt = `${state.style} ${state.voice} cinematic mv`;
  const payload = {
    capability_id: "video.gan.v1",
    inputs: [],
    params: {
      v: 1,
      title,
      prompt,
      duration_sec: 6,
      lyrics: { lines }
    }
  };
  try {
    const res = await fetch("/api/registry/v1/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      useLocalVideoFallback(title, prompt);
      showToast(`Video offline · Local preview (${res.status})`);
      return;
    }
    const payload = await res.json();
    const jobId = payload?.job?.id || payload?.id;
    if (!jobId) {
      useLocalVideoFallback(title, prompt);
      return;
    }
    videoJobId = jobId;
    pollVideoJob(videoJobId);
  } catch (err) {
    useLocalVideoFallback(title, prompt);
    showToast("Video offline · Local preview");
  }
}

function buildLocalVideoPreviewSvg(title, subtitle) {
  const safeTitle = String(title || "CSS MV").replace(/</g, "&lt;");
  const safeSubtitle = String(subtitle || "Local preview").replace(/</g, "&lt;");
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <radialGradient id="g" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#00f5a0" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="#0b6f55" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#020302" stop-opacity="0.95"/>
    </radialGradient>
    <filter id="blur">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
  </defs>
  <rect width="1280" height="720" fill="#020302"/>
  <circle cx="620" cy="360" r="280" fill="url(#g)"/>
  <circle cx="680" cy="320" r="220" fill="url(#g)" opacity="0.6" filter="url(#blur)"/>
  <text x="50%" y="48%" text-anchor="middle" font-family="Syne, sans-serif" font-size="72" fill="#eafff6" letter-spacing="8">${safeTitle}</text>
  <text x="50%" y="56%" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-size="28" fill="#9fead1" letter-spacing="6">${safeSubtitle}</text>
</svg>`
    )
  );
}

function pollVideoJob(jobId) {
  if (!jobId) return;
  let busy = false;
  videoJobPoll = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const res = await fetch(`/api/registry/v1/jobs/${jobId}`);
      if (!res.ok) {
        busy = false;
        return;
      }
      const payload = await res.json();
      const job = payload?.job || payload;
      if (job.status === "succeeded") {
        const artifacts = job.artifacts || [];
        const videoArtifact = artifacts.find((item) => item.name === "video_preview.mp4");
        const svgArtifact = artifacts.find((item) => item.name === "video_preview.svg");
        if (videoArtifact && watchVideo) {
          if (setVideoFromArtifact(videoArtifact.uri)) {
            attemptVideoPlayback({ allowFallback: true });
          } else {
            useLocalVideoFallback(state.title, `${state.style} ${state.voice} cinematic mv`);
          }
          watchSubtitle.textContent = "KaraOK MV · Preview";
        } else if (svgArtifact) {
          setSvgPreview(svgArtifact.uri);
          watchSubtitle.textContent = "KaraOK MV · Preview";
        } else {
          watchSubtitle.textContent = "KaraOK MV · Ready";
        }
        clearInterval(videoJobPoll);
        videoJobPoll = null;
      } else if (job.status === "failed") {
        watchSubtitle.textContent = "KaraOK MV · Failed";
        clearInterval(videoJobPoll);
        videoJobPoll = null;
      }
    } catch (err) {
      // keep polling
    } finally {
      busy = false;
    }
  }, 1200);
}

function resetTypingState() {
  typingState = { paused: false, canceled: false };
  if (lyricsEl) {
    lyricsEl.classList.remove("paused", "canceled");
  }
  setEngineState("lyrics", "running");
  if (lyricsProgress) setProgress(lyricsProgress, 0);
}

function cycleLyricsState() {
  if (!lyricsEl || typingState.canceled) return;
  if (!typingState.paused) {
    typingState.paused = true;
    lyricsEl.classList.add("paused");
    setEngineState("lyrics", "paused");
    showToast("Lyrics paused");
    return;
  }
  typingState.canceled = true;
  lyricsEl.classList.remove("paused");
  lyricsEl.classList.add("canceled");
  clearTimeout(typingTimer);
  setEngineState("lyrics", "canceled");
  showToast("Lyrics canceled");
}

function initLyricsControls() {
  if (!lyricsEl) return;
  lyricsEl.addEventListener("click", cycleLyricsState);
}

function setEngineState(engine, state) {
  engineStates[engine] = state;
  const cards = document.querySelectorAll(".status-card");
  const indexMap = { lyrics: 0, music: 1, video: 2, kara: 3 };
  const card = cards[indexMap[engine]];
  if (!card) return;
  const titleEl = card.querySelector(".status-title");
  if (!card.dataset.baseTitle && titleEl) {
    card.dataset.baseTitle = titleEl.textContent;
  }
  card.classList.remove("paused", "canceled", "running");
  if (state === "paused") {
    card.classList.add("paused");
  }
  if (state === "running") {
    card.classList.add("running");
  }
  if (state === "canceled") {
    card.classList.add("canceled");
    const progressEl =
      engine === "lyrics"
        ? lyricsProgress
        : engine === "music"
          ? musicProgress
          : engine === "video"
            ? videoProgress
            : karaProgress;
    if (progressEl) setProgress(progressEl, 0);
  }
  if (titleEl) {
    const base = card.dataset.baseTitle || titleEl.textContent;
    const suffix =
      state === "paused" ? " · Paused" : state === "canceled" ? " · Canceled" : "";
    titleEl.textContent = `${base}${suffix}`;
  }
  if (engine === "video" && state === "canceled") {
    pruneSceneRows();
    sceneRows.forEach((entry) => {
      const current = entry?.statusEl?.dataset?.state || "queued";
      if (["done", "delete", "canceled"].includes(current)) return;
      setSceneState(entry.row, entry.statusEl, "canceled");
    });
  }
}

function cycleEngineState(engine) {
  if (engine === "lyrics") {
    cycleLyricsState();
    return;
  }
  const state = engineStates[engine];
  if (state === "running") {
    setEngineState(engine, "paused");
    showToast(`${engine} paused`);
    return;
  }
  if (state === "paused") {
    setEngineState(engine, "canceled");
    showToast(`${engine} canceled`);
  }
}

function initEngineControls() {
  const cards = document.querySelectorAll(".status-card");
  const engines = ["lyrics", "music", "video", "kara"];
  cards.forEach((card, index) => {
    const engine = engines[index];
    if (!engine) return;
    card.dataset.engine = engine;
    card.addEventListener("click", () => cycleEngineState(engine));
  });
}

function resetEngineStates() {
  setEngineState("lyrics", "running");
  setEngineState("music", "running");
  setEngineState("video", "running");
  setEngineState("kara", "running");
}

function animateProgress() {
  let music = 0;
  let video = 0;
  let kara = 0;
  watchTriggered = false;
  clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (engineStates.lyrics === "running" && lyricsProgress) {
      const current = lyricsEl?.textContent?.length || 0;
      const pct = lyricsTargetLength ? Math.min(100, (current / lyricsTargetLength) * 100) : 0;
      setProgress(lyricsProgress, pct);
    }
    if (engineStates.music === "running") {
      music = Math.min(100, music + 6 + Math.random() * 6);
    }
    if (engineStates.video === "running") {
      video = Math.min(100, video + 4 + Math.random() * 5);
    }
    if (engineStates.kara === "running") {
      kara = Math.min(100, kara + 5 + Math.random() * 6);
    }
    setProgress(musicProgress, music);
    setProgress(videoProgress, video);
    setProgress(karaProgress, kara);
    syncSceneProgress(video);
    if (!watchTriggered && video >= 70) {
      watchTriggered = true;
      openPanel(watchPanel);
      layoutShowcasePanels();
    }
    if (music >= 100 && video >= 100 && kara >= 100) {
      clearInterval(progressTimer);
      watchSubtitle.textContent = "KaraOK MV · Ready";
    }
  }, 420);
}

function focusPanel(panel) {
  if (!panel) return;
  topZ += 1;
  panel.style.zIndex = `${topZ}`;
  panels.forEach((item) => {
    if (!item) return;
    item.classList.remove("panel-front");
  });
  panel.classList.add("panel-front");
  panel.classList.add("panel-active");
  setTimeout(() => panel.classList.remove("panel-active"), 600);
}

function openPanel(panel) {
  if (!panel) return;
  panel.classList.remove("hidden");
  panel.dataset.minimized = "false";
  focusPanel(panel);
  updateDockVisibility();
  layoutShowcasePanels();
}

function updateDockVisibility() {
  Object.entries(dockByPanel).forEach(([panelId, action]) => {
    const panel = document.getElementById(panelId);
    const dockItem = document.querySelector(`.dock-item[data-action=\"${action}\"]`);
    if (!panel || !dockItem) return;
    if (panel.classList.contains("hidden")) {
      dockItem.classList.remove("is-hidden");
    } else {
      dockItem.classList.add("is-hidden");
    }
  });
}

function initPanelStack() {
  panels.forEach((panel, index) => {
    if (!panel) return;
    panel.style.zIndex = `${topZ + index}`;
  });
  topZ += panels.length;
  focusPanel(logoPanel);
}

function pickRandom(list, count) {
  const pool = [...list];
  const picked = [];
  while (pool.length && picked.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function storePanelState(panel) {
  panel.dataset.restore = JSON.stringify({
    left: panel.style.left || "",
    top: panel.style.top || "",
    width: panel.style.width || "",
    height: panel.style.height || "",
    transform: panel.style.transform || ""
  });
}

function restorePanel(panel) {
  const restore = panel.dataset.restore ? JSON.parse(panel.dataset.restore) : {};
  panel.style.left = restore.left || "";
  panel.style.top = restore.top || "";
  panel.style.width = restore.width || "";
  panel.style.height = restore.height || "";
  panel.style.transform = restore.transform || "";
  panel.classList.remove("maximized");
  panel.dataset.maximized = "false";
}

function togglePanelMaximize(panel) {
  if (!panel) return;
  const isMaximized = panel.dataset.maximized === "true";
  if (isMaximized) {
    restorePanel(panel);
  } else {
    storePanelState(panel);
    panel.style.left = "50%";
    panel.style.top = "50%";
    panel.style.transform = "translate(-50%, -50%)";
    panel.style.width = "min(92vw, 1200px)";
    panel.style.height = "min(82vh, 760px)";
    panel.classList.add("maximized");
    panel.dataset.maximized = "true";
  }
  focusPanel(panel);
}

function openAndMaximize(panel) {
  openPanel(panel);
  togglePanelMaximize(panel);
}

function spawnDragTrail(event) {
  const now = performance.now();
  if (now - lastTrailTime < TRAIL_INTERVAL) return;
  lastTrailTime = now;
  const prev = lastTrailPoint;
  const dt = prev ? now - prev.time : 16;
  const dx = prev ? event.clientX - prev.x : 0;
  const dy = prev ? event.clientY - prev.y : 0;
  const dist = Math.hypot(dx, dy);
  const speed = dt > 0 ? dist / dt : 0;
  const count = Math.min(7, Math.max(1, Math.round(speed * 3)));
  const spacing = Math.min(32, Math.max(6, speed * 20));
  const dirX = dist > 0 ? dx / dist : 0;
  const dirY = dist > 0 ? dy / dist : 0;
  const hazeCount = Math.min(4, Math.max(1, Math.round(speed * 1.8)));
  const hazeSize = 40 + Math.min(speed * 120, 120);

  for (let i = 0; i < count; i += 1) {
    const trail = document.createElement("div");
    trail.className = "drag-trail star";
    const size = 8 + Math.random() * 10 + Math.min(speed * 6, 8);
    const rotation = Math.floor(Math.random() * 360);
    const color = starPalette[Math.floor(Math.random() * starPalette.length)];
    const offset = i * spacing;
    const jitter = (Math.random() - 0.5) * 4;

    trail.style.left = `${event.clientX - dirX * offset + jitter}px`;
    trail.style.top = `${event.clientY - dirY * offset + jitter}px`;
    trail.style.setProperty("--trail-size", `${size}px`);
    trail.style.setProperty("--trail-rot", `${rotation}deg`);
    trail.style.setProperty("--trail-color", color.c1);
    trail.style.setProperty("--trail-color-2", color.c2);
    trail.style.setProperty("--trail-glow", color.glow);
    trail.style.setProperty("--trail-haze", color.haze);
    trail.style.setProperty("--trail-haze-2", color.haze2);
    trail.style.setProperty("--trail-life", `${0.6 + Math.min(speed * 0.4, 0.6)}s`);

    document.body.appendChild(trail);
    setTimeout(() => trail.remove(), 900);
  }

  for (let i = 0; i < hazeCount; i += 1) {
    const nebula = document.createElement("div");
    nebula.className = "drag-trail nebula";
    const size = hazeSize + Math.random() * 40;
    const rotation = Math.floor(Math.random() * 360);
    const color = starPalette[Math.floor(Math.random() * starPalette.length)];
    const offset = i * (spacing * 0.8);
    const jitter = (Math.random() - 0.5) * 14;

    nebula.style.left = `${event.clientX - dirX * offset + jitter}px`;
    nebula.style.top = `${event.clientY - dirY * offset + jitter}px`;
    nebula.style.setProperty("--trail-nebula-size", `${size}px`);
    nebula.style.setProperty("--trail-rot", `${rotation}deg`);
    nebula.style.setProperty("--trail-haze", color.haze);
    nebula.style.setProperty("--trail-haze-2", color.haze2);
    nebula.style.setProperty("--trail-life", `${1.1 + Math.min(speed * 0.8, 1.2)}s`);

    document.body.appendChild(nebula);
    setTimeout(() => nebula.remove(), 1400);
  }

  lastTrailPoint = { x: event.clientX, y: event.clientY, time: now };
}

function spawnAmbientTrail(event) {
  const now = performance.now();
  if (now - ambientTrailTime < 140) return;
  ambientTrailTime = now;
  const prev = ambientTrailPoint;
  const dt = prev ? now - prev.time : 16;
  const dx = prev ? event.clientX - prev.x : 0;
  const dy = prev ? event.clientY - prev.y : 0;
  const dist = Math.hypot(dx, dy);
  const speed = dt > 0 ? dist / dt : 0;
  const count = speed > 0.6 ? 2 : 1;
  const sizeBase = 6 + Math.min(speed * 6, 6);

  for (let i = 0; i < count; i += 1) {
    const trail = document.createElement("div");
    trail.className = "drag-trail star ambient";
    const size = sizeBase + Math.random() * 6;
    const rotation = Math.floor(Math.random() * 360);
    const color = starPalette[Math.floor(Math.random() * starPalette.length)];
    const jitter = (Math.random() - 0.5) * 8;
    trail.style.left = `${event.clientX + jitter}px`;
    trail.style.top = `${event.clientY + jitter}px`;
    trail.style.setProperty("--trail-size", `${size}px`);
    trail.style.setProperty("--trail-rot", `${rotation}deg`);
    trail.style.setProperty("--trail-color", color.c1);
    trail.style.setProperty("--trail-color-2", color.c2);
    trail.style.setProperty("--trail-glow", color.glow);
    trail.style.setProperty("--trail-haze", color.haze);
    trail.style.setProperty("--trail-haze-2", color.haze2);
    trail.style.setProperty("--trail-life", `${1.1 + Math.min(speed * 0.6, 0.6)}s`);
    document.body.appendChild(trail);
    setTimeout(() => trail.remove(), 1200);
  }

  ambientTrailPoint = { x: event.clientX, y: event.clientY, time: now };
}

function attachAmbientTrail() {
  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      const target = event.target;
      if (!target) return;
      if (
        target.closest(".panel") ||
        target.closest(".dock") ||
        target.closest(".panel-settings") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("textarea")
      ) {
        return;
      }
      spawnAmbientTrail(event);
    },
    { passive: true }
  );
}

function setPanelPosition(panel, left, top) {
  const rect = panel.getBoundingClientRect();
  const maxLeft = Math.max(0, window.innerWidth - rect.width);
  const maxTop = Math.max(0, window.innerHeight - rect.height);
  const clampedLeft = Math.min(Math.max(0, left), maxLeft);
  const clampedTop = Math.min(Math.max(0, top), maxTop);
  panel.style.left = `${clampedLeft}px`;
  panel.style.top = `${clampedTop}px`;
  panel.style.transform = "none";
}

function layoutShowcasePanels() {
  const order = [
    foryouPanel,
    cssmvPanel,
    watchPanel,
    lyricsPanel,
    musicPanel,
    videoPanel,
    settingsPanel
  ].filter(Boolean);
  const visible = order.filter(
    (panel) =>
      !panel.classList.contains("hidden") &&
      panel.dataset.userMoved !== "true" &&
      panel.id !== "logo-panel"
  );
  if (!visible.length) return;

  const spacing = 26;
  const paddingX = 32;
  const paddingY = 88;
  const minWidth = 340;
  const maxWidth = 520;
  const availableWidth = Math.max(0, window.innerWidth - paddingX * 2);
  const columns = Math.max(
    1,
    Math.min(3, Math.floor((availableWidth + spacing) / (minWidth + spacing)))
  );
  const panelWidth = Math.max(
    minWidth,
    Math.min(maxWidth, Math.floor((availableWidth - spacing * (columns - 1)) / columns))
  );

  visible.forEach((panel) => {
    panel.classList.add("showcase-panel");
    panel.style.width = `${panelWidth}px`;
    if (!panel.classList.contains("panel-collapsed") && panel.dataset.maximized !== "true") {
      panel.style.height = "";
    }
  });

  const rowHeights = [];
  visible.forEach((panel, index) => {
    const row = Math.floor(index / columns);
    const rect = panel.getBoundingClientRect();
    rowHeights[row] = Math.max(rowHeights[row] || 0, rect.height);
  });

  const rowOffsets = [];
  let offset = paddingY;
  rowHeights.forEach((height, row) => {
    rowOffsets[row] = offset;
    offset += height + spacing;
  });

  const maxHeight = window.innerHeight - paddingY;
  let overflowIndex = visible.length;
  for (let row = 0; row < rowHeights.length; row += 1) {
    if (rowOffsets[row] + rowHeights[row] > maxHeight) {
      overflowIndex = row * columns;
      break;
    }
  }

  visible.forEach((panel, index) => {
    if (index >= overflowIndex) return;
    const row = Math.floor(index / columns);
    const col = index % columns;
    const left = paddingX + col * (panelWidth + spacing);
    const top = rowOffsets[row] ?? paddingY;
    setPanelPosition(panel, left, top);
  });

  if (overflowIndex < visible.length) {
    const lastVisibleIndex = Math.max(0, overflowIndex - 1);
    const anchor = visible[lastVisibleIndex];
    const anchorRect = anchor ? anchor.getBoundingClientRect() : null;
    const baseLeft = anchorRect ? anchorRect.left : paddingX;
    const baseTop = anchorRect ? Math.min(anchorRect.top + 24, window.innerHeight - 260) : paddingY;
    const barHeight = anchor?.querySelector(".panel-bar")?.offsetHeight || 56;
    const offsetStep = barHeight + 8;
    visible.slice(overflowIndex).forEach((panel, idx) => {
      const offset = offsetStep * (idx + 1);
      const left = Math.min(baseLeft + offset, window.innerWidth - panelWidth - paddingX);
      const top = Math.min(baseTop + offset, window.innerHeight - 200);
      setPanelPosition(panel, left, top);
    });
  }
}

function clampPanelInViewport(panel) {
  if (!panel) return;
  if (!panel.style.left && !panel.style.top) return;
  const rect = panel.getBoundingClientRect();
  const maxLeft = Math.max(0, window.innerWidth - rect.width);
  const maxTop = Math.max(0, window.innerHeight - rect.height);
  const clampedLeft = Math.min(Math.max(0, rect.left), maxLeft);
  const clampedTop = Math.min(Math.max(0, rect.top), maxTop);
  panel.style.left = `${clampedLeft}px`;
  panel.style.top = `${clampedTop}px`;
  panel.style.transform = "none";
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return null;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = ((hue % 360) + 360) % 360;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (hh < 60) {
    r = c;
    g = x;
  } else if (hh < 120) {
    r = x;
    g = c;
  } else if (hh < 180) {
    g = c;
    b = x;
  } else if (hh < 240) {
    g = x;
    b = c;
  } else if (hh < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const m = l - c / 2;
  const toHex = (value) => {
    const v = Math.round((value + m) * 255);
    return v.toString(16).padStart(2, "0");
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function applyBackgroundPalette() {
  const alphas = [0.6, 0.55, 0.5, 0.7];
  bgColorInputs.forEach((input, index) => {
    if (!input) return;
    const rgb = hexToRgb(input.value);
    if (!rgb) return;
    const color = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alphas[index] || 0.28})`;
    document.documentElement.style.setProperty(`--wc${index + 1}`, color);
  });
}

function formatSlogan(spell) {
  return `Just say <span class="spell">${spell}</span>, witness the miracle!`;
}

function formatApplyLabel(spell) {
  return `Say ${spell} · Render`;
}

function formatToast(spell) {
  return `${spell} awakened · 流流流`;
}

function formatComposing(spell) {
  return `${spell} is composing...`;
}

function replaceSpell(text, from, to) {
  if (!text) return text;
  return text.split(from).join(to);
}

function replaceSpellInLines(lines, from, to) {
  if (!lines) return [];
  return lines.map((line) => replaceSpell(line, from, to));
}

function buildLyricsText(title, lines) {
  return `Title · ${title}\n\n${lines.join("\n")}`;
}

function applySpell(spell, options = {}) {
  const { force = false, refreshPanels = true } = options;
  const next = spell.trim() || DEFAULT_SPELL;
  const prev = state.spell;
  if (!force && next === prev) return;
  state.spell = next;

  if (mirrorTitle) mirrorTitle.textContent = next;
  if (mirrorSlogan) mirrorSlogan.innerHTML = formatSlogan(next);
  if (applySettings) applySettings.textContent = formatApplyLabel(next);
  if (toast) toast.textContent = formatToast(next);

  if (watchSubtitle && watchSubtitle.textContent.includes(prev)) {
    watchSubtitle.textContent = replaceSpell(watchSubtitle.textContent, prev, next);
  }

  if (refreshPanels && state.baseLines) {
    clearTimeout(typingTimer);
    const baseText = state.baseLines.join("\n");
    if (baseText.includes(DEFAULT_SPELL)) {
      state.lines = replaceSpellInLines(state.baseLines, DEFAULT_SPELL, next);
    } else {
      state.lines = replaceSpellInLines(state.lines || state.baseLines, prev, next);
    }
    updateEnginePanels(state.title, state.lines);
    if (lyricsEl) {
      lyricsEl.textContent = buildLyricsText(state.title, state.lines);
    }
  }
}

function randomizePalette() {
  const baseHue = 140 + Math.random() * 70;
  const spread = 12 + Math.random() * 18;
  const palette = [
    hslToHex(baseHue - spread, 52 + Math.random() * 18, 18 + Math.random() * 14),
    hslToHex(baseHue + spread, 48 + Math.random() * 22, 22 + Math.random() * 16),
    hslToHex(baseHue + spread * 2, 58 + Math.random() * 20, 30 + Math.random() * 18),
    hslToHex(baseHue - spread * 2, 45 + Math.random() * 20, 20 + Math.random() * 14)
  ];

  bgColorInputs.forEach((input, index) => {
    if (!input) return;
    input.value = palette[index] || input.value;
  });
  applyBackgroundPalette();
  showToast("Watercolor palette randomized");
}

function groupScenes(lines) {
  const scenes = [];
  let current = null;
  lines.forEach((line) => {
    if (/^(Scene|Verse|Chorus|Bridge|Outro)/i.test(line)) {
      if (current) scenes.push(current);
      current = { title: line, lines: [] };
      return;
    }
    if (current && line.trim()) {
      current.lines.push(line);
    }
  });
  if (current) scenes.push(current);
  return scenes;
}

function clearChildren(el) {
  if (!el) return;
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

const SCENE_STATE_CLASSES = ["queued", "rendering", "paused", "canceled", "done", "delete"];

function setSceneState(row, statusEl, state) {
  if (!row || !statusEl) return;
  const next = state || "queued";
  row.dataset.state = next;
  statusEl.dataset.state = next;
  row.classList.remove(...SCENE_STATE_CLASSES, "delete-armed");
  statusEl.classList.remove(...SCENE_STATE_CLASSES);
  row.classList.add(next);
  statusEl.classList.add(next);
  if (next === "delete") {
    row.classList.add("delete-armed");
  }
  statusEl.textContent = next === "delete" ? "DELETE" : next.toUpperCase();
}

function pruneSceneRows() {
  sceneRows = sceneRows.filter((entry) => entry && entry.row && entry.row.isConnected);
}

function syncSceneProgress(videoValue) {
  pruneSceneRows();
  if (!sceneRows.length) return;
  if (engineStates.video !== "running") return;
  const total = sceneRows.length;
  const doneTarget = Math.min(total, Math.floor((videoValue / 100) * total));
  sceneRows.forEach((entry, index) => {
    if (!entry || !entry.statusEl || !entry.row) return;
    const current = entry.statusEl.dataset.state || "queued";
    if (["paused", "canceled", "delete"].includes(current)) return;
    if (index < doneTarget) {
      if (current !== "done") setSceneState(entry.row, entry.statusEl, "done");
      return;
    }
    if (index === doneTarget && doneTarget < total && videoValue < 100) {
      if (current !== "rendering") setSceneState(entry.row, entry.statusEl, "rendering");
      return;
    }
    if (current !== "queued") setSceneState(entry.row, entry.statusEl, "queued");
  });
}

function renderSceneList(scenes) {
  if (!sceneList) return;
  clearChildren(sceneList);
  sceneRows = [];
  scenes.forEach((scene, index) => {
    const item = document.createElement("div");
    item.className = "scene-item";

    const sceneIndex = document.createElement("span");
    const sceneTitle = document.createElement("span");
    const sceneStatus = document.createElement("span");

    const parts = scene.title.split("·");
    sceneIndex.textContent = parts[0]?.trim() || `Scene ${index + 1}`;
    sceneTitle.textContent = parts[1]?.trim() || "Flow";
    const initialState = index === 0 ? "rendering" : "queued";
    sceneStatus.className = "scene-status";
    setSceneState(item, sceneStatus, initialState);
    item.addEventListener("click", () => {
      cycleSceneStatus(sceneStatus);
    });

    item.appendChild(sceneIndex);
    item.appendChild(sceneTitle);
    item.appendChild(sceneStatus);
    sceneList.appendChild(item);
    sceneRows.push({ row: item, statusEl: sceneStatus });
  });
}

function renderLyricsGrid(scenes) {
  if (!lyricsGrid) return;
  clearChildren(lyricsGrid);
  scenes.forEach((scene) => {
    const card = document.createElement("div");
    card.className = "engine-card";

    const title = document.createElement("div");
    title.className = "engine-title";
    title.textContent = scene.title;

    const excerpt = document.createElement("p");
    excerpt.textContent = scene.lines.slice(0, 2).join(" / ");

    card.appendChild(title);
    card.appendChild(excerpt);
    lyricsGrid.appendChild(card);
  });
}

function renderTags(container, tags) {
  if (!container) return;
  clearChildren(container);
  tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag;
    container.appendChild(chip);
  });
}

function setForyouCompact(enabled) {
  if (!foryouPanel) return;
  if (enabled) {
    foryouPanel.classList.add("foryou-compact");
  } else {
    foryouPanel.classList.remove("foryou-compact");
  }
}

function cycleSceneStatus(statusEl) {
  if (!statusEl) return;
  const current = statusEl.dataset.state || "";
  const row = statusEl.closest(".scene-item");
  if (!row) return;
  if (current === "done") {
    setSceneState(row, statusEl, "delete");
    showToast("Click again to delete");
    return;
  }
  if (current === "delete") {
    row.remove();
    pruneSceneRows();
    showToast("Scene removed");
    return;
  }
  let next = "paused";
  let toastMessage = "Scene paused";
  if (current === "paused") {
    next = "rendering";
    toastMessage = "Scene resumed";
  } else if (current === "rendering") {
    next = "canceled";
    toastMessage = "Scene canceled";
  } else if (current === "canceled") {
    next = "queued";
    toastMessage = "Scene continued";
  } else if (current === "queued") {
    next = "paused";
    toastMessage = "Scene paused";
  }
  setSceneState(row, statusEl, next);
  showToast(toastMessage);
}

function renderStats(container, stats) {
  if (!container) return;
  clearChildren(container);
  stats.forEach((stat) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    const value = document.createElement("span");
    value.textContent = stat.value;
    card.textContent = `${stat.label}`;
    card.appendChild(value);
    container.appendChild(card);
  });
}

function renderCameraBoard(scenes) {
  if (!cameraBoard) return;
  clearChildren(cameraBoard);
  scenes.forEach((scene, index) => {
    const row = document.createElement("div");
    row.className = "camera-row";

    const label = document.createElement("strong");
    label.textContent = `Scene ${index + 1}`;

    const move = document.createElement("span");
    move.textContent = pickRandom(cameraMoveBank, 1)[0];

    const lens = document.createElement("span");
    lens.className = "camera-mode";
    lens.textContent = pickRandom(lensBank, 1)[0];

    row.appendChild(label);
    row.appendChild(move);
    row.appendChild(lens);
    cameraBoard.appendChild(row);
  });
}

function renderLyricFlow(scenes) {
  if (!lyricFlow) return;
  clearChildren(lyricFlow);
  scenes.forEach((scene, index) => {
    const row = document.createElement("div");
    row.className = "flow-row";

    const time = document.createElement("span");
    const minutes = String(index).padStart(2, "0");
    const seconds = String((index * 12) % 60).padStart(2, "0");
    time.textContent = `${minutes}:${seconds}`;

    const bar = document.createElement("div");
    bar.className = "flow-bar";
    const fill = document.createElement("span");
    fill.style.width = `${60 + Math.random() * 30}%`;
    bar.appendChild(fill);

    const label = document.createElement("span");
    const parts = scene.title.split("·");
    label.textContent = parts[1]?.trim() || flowBank[index % flowBank.length];

    row.appendChild(time);
    row.appendChild(bar);
    row.appendChild(label);
    lyricFlow.appendChild(row);
  });
}

function renderMixGrid() {
  if (!mixGrid) return;
  clearChildren(mixGrid);
  pickRandom(mixBank, 5).forEach((layer) => {
    const card = document.createElement("div");
    card.className = "mix-card";

    const title = document.createElement("div");
    title.className = "mix-title";
    title.textContent = layer;

    const level = document.createElement("div");
    level.className = "mix-level";
    const fill = document.createElement("span");
    fill.style.width = `${55 + Math.random() * 40}%`;
    level.appendChild(fill);

    card.appendChild(title);
    card.appendChild(level);
    mixGrid.appendChild(card);
  });
}

function buildShots(count) {
  const total = Math.max(6, count * 4);
  return Array.from({ length: total }, (_, index) => ({
    id: index + 1,
    move: pickRandom(cameraMoveBank, 1)[0],
    lens: pickRandom(lensBank, 1)[0]
  }));
}

function renderStoryboard(shots) {
  if (!storyboard) return;
  clearChildren(storyboard);
  shots.slice(0, 8).forEach((shot) => {
    const frame = document.createElement("div");
    frame.className = "story-frame";
    frame.textContent = `Shot ${String(shot.id).padStart(2, "0")} · ${shot.move}`;
    storyboard.appendChild(frame);
  });
}

function renderCameraList(shots) {
  if (!cameraList) return;
  clearChildren(cameraList);
  shots.slice(0, 4).forEach((shot) => {
    const item = document.createElement("div");
    item.className = "camera-item";
    item.textContent = `Shot ${String(shot.id).padStart(2, "0")}`;
    const detail = document.createElement("span");
    detail.textContent = `${shot.move} · ${shot.lens}`;
    item.appendChild(detail);
    cameraList.appendChild(item);
  });
}

function buildStyleTags(style, voice) {
  const base = styleTagMap[style] ? pickRandom(styleTagMap[style], 4) : pickRandom(mvTagBank, 4);
  return [...new Set([...base, voice])];
}

function updateEnginePanels(title, lines) {
  const style = styleInput ? styleInput.value : state.style;
  const voice = voiceInput ? voiceInput.value : state.voice;
  const scenes = groupScenes(lines);
  const resolvedScenes = scenes.length
    ? scenes
    : [{ title: "Scene 1 · Flow", lines: lines.filter(Boolean).slice(0, 3) }];
  const shots = buildShots(resolvedScenes.length);
  const stats = [
    { label: "Tempo", value: `${72 + Math.floor(Math.random() * 26)} BPM` },
    { label: "Energy", value: `${70 + Math.floor(Math.random() * 25)}%` },
    { label: "Render", value: `${84 + Math.floor(Math.random() * 12)}%` },
    { label: "Sync", value: `${88 + Math.floor(Math.random() * 10)}%` }
  ];
  const styleTags = buildStyleTags(style, voice);
  const mvTagSet = [...new Set([...styleTags, ...pickRandom(mvTagBank, 2)])];
  const videoTagSet = [...new Set([...pickRandom(videoTagBank, 3), ...pickRandom(mvTagBank, 1)])];

  if (mvTitle) mvTitle.textContent = title;
  if (foryouTitle) foryouTitle.textContent = title;
  if (foryouStyle) foryouStyle.textContent = `${style} · ${voice}`;
  if (mvSub)
    mvSub.textContent = `${resolvedScenes.length} Scene · ${shots.length} Shots · Live Karaoke`;
  if (videoScript)
    videoScript.textContent = `Auto script loaded · ${resolvedScenes.length} scenes ready`;
  if (musicStyle) musicStyle.textContent = style;
  if (voiceStyle) voiceStyle.textContent = voice;

  renderSceneList(resolvedScenes);
  renderLyricsGrid(resolvedScenes);
  renderTags(mvTags, mvTagSet);
  renderStats(mvStats, stats);
  renderCameraBoard(resolvedScenes);
  renderLyricFlow(resolvedScenes);
  renderTags(musicTags, styleTags);
  renderMixGrid();
  renderTags(videoTags, videoTagSet);
  renderStoryboard(shots);
  renderCameraList(shots);
  renderTags(foryouTags, styleTags);

  state.title = title;
  state.lines = lines;
  state.style = style;
  state.voice = voice;
}

async function startCreation(customTitle, customLyrics) {
  const allowed = await consumeGeneration();
  if (!allowed) return;
  const selection = lyricBank[Math.floor(Math.random() * lyricBank.length)];
  const title = customTitle || selection.title;
  const baseLines = customLyrics?.trim()
    ? customLyrics.trim().split("\n")
    : selection.lines;
  const lines = replaceSpellInLines(baseLines, DEFAULT_SPELL, state.spell);
  const lyricText = buildLyricsText(title, lines);
  lyricsTargetLength = lyricText.length;

  watchSubtitle.textContent = "KaraOK MV · Rendering";
  cssmvTriggered = false;
  watchTriggered = false;
  resetTypingState();
  resetEngineStates();
  setForyouCompact(false);
  cssmvPanel.classList.add("hidden");
  watchPanel.classList.add("hidden");
  updateDockVisibility();
  typewriter(lyricsEl, lyricText, 18, () => {
    setForyouCompact(true);
    if (!cssmvTriggered) {
      cssmvTriggered = true;
      openPanel(cssmvPanel);
      layoutShowcasePanels();
    }
  });
  animateProgress();
  updateEnginePanels(title, lines);
  requestVideoPreview(title, lines);
  state.baseLines = baseLines;
  state.lines = lines;
  openPanel(foryouPanel);
  layoutShowcasePanels();
}

function handleMicClick() {
  showToast(formatToast(state.spell));
  startCreation();
}

function handleMicLongPress() {
  const custom = window.prompt("Say the title", "嫦娥奔月");
  if (custom) {
    startCreation(custom);
  }
}

function cycleSelect(selectEl) {
  if (!selectEl || !selectEl.options.length) return "";
  const next = (selectEl.selectedIndex + 1) % selectEl.options.length;
  selectEl.selectedIndex = next;
  return selectEl.value;
}

function refreshEngines() {
  const selection = lyricBank[Math.floor(Math.random() * lyricBank.length)];
  updateEnginePanels(selection.title, selection.lines);
  showToast("Engines refreshed · 流流流");
}

function cycleMusicStyle() {
  const style = cycleSelect(styleInput);
  updateEnginePanels(state.title, state.lines);
  if (style) showToast(`Style · ${style}`);
}

function cycleVoice() {
  const voice = cycleSelect(voiceInput);
  updateEnginePanels(state.title, state.lines);
  if (voice) showToast(`Voice · ${voice}`);
}

function shuffleStoryboard() {
  updateEnginePanels(state.title, state.lines);
  showToast("Storyboard shuffled");
}

function resetSettings() {
  if (titleInput) titleInput.value = "";
  if (lyricsInput) lyricsInput.value = "";
  if (styleInput) styleInput.selectedIndex = 0;
  if (voiceInput) voiceInput.selectedIndex = 0;
  updateEnginePanels(state.title, state.lines);
  showToast("Settings reset");
}

const dockActionMap = {
  mic: {
    click: handleMicClick,
    dblclick: () => openPanel(settingsPanel),
    longpress: handleMicLongPress
  },
  foryou: {
    click: () => openPanel(foryouPanel),
    dblclick: () => startCreation(),
    longpress: () => openPanel(lyricsPanel)
  },
  cssmv: {
    click: () => openPanel(cssmvPanel),
    dblclick: () => openPanel(watchPanel),
    longpress: () => openPanel(videoPanel)
  },
  lyrics: {
    click: () => openPanel(lyricsPanel),
    dblclick: refreshEngines,
    longpress: () => openPanel(settingsPanel)
  },
  music: {
    click: () => openPanel(musicPanel),
    dblclick: cycleMusicStyle,
    longpress: cycleVoice
  },
  video: {
    click: () => openPanel(videoPanel),
    dblclick: shuffleStoryboard,
    longpress: () => openPanel(watchPanel)
  },
  watch: {
    click: () => openPanel(watchPanel),
    dblclick: () => openAndMaximize(watchPanel),
    longpress: () => openPanel(cssmvPanel)
  },
  login: {
    click: () => openPanel(loginPanel),
    dblclick: () => openAndMaximize(loginPanel),
    longpress: () => openPanel(worksPanel)
  },
  works: {
    click: () => openPanel(worksPanel),
    dblclick: () => openAndMaximize(worksPanel),
    longpress: () => openPanel(loginPanel)
  },
  settings: {
    click: () => openPanel(settingsPanel),
    dblclick: () => startCreation(titleInput.value.trim(), lyricsInput.value.trim()),
    longpress: resetSettings
  }
};

function handleDockAction(action, type) {
  const mapping = dockActionMap[action];
  if (!mapping) return;
  const handler = mapping[type];
  if (handler) handler();
}

function attachDockEvents() {
  document.querySelectorAll(".dock-item").forEach((item) => {
    const action = item.dataset.action;
    let suppressClick = false;
    let longPressId;

    const triggerAction = (type) => {
      handleDockAction(action, type);
      item.classList.add("active");
      setTimeout(() => item.classList.remove("active"), 600);
    };

    item.addEventListener("click", () => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      clearTimeout(dockClickTimers.get(action));
      const timer = setTimeout(() => triggerAction("click"), CLICK_DELAY);
      dockClickTimers.set(action, timer);
    });

    item.addEventListener("dblclick", () => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      clearTimeout(dockClickTimers.get(action));
      triggerAction("dblclick");
    });

    item.addEventListener("pointerdown", () => {
      suppressClick = false;
      clearTimeout(longPressId);
      longPressId = setTimeout(() => {
        suppressClick = true;
        triggerAction("longpress");
      }, LONGPRESS_MS);
    });

    item.addEventListener("pointerup", () => {
      clearTimeout(longPressId);
    });

    item.addEventListener("pointerleave", () => {
      clearTimeout(longPressId);
    });
  });
}

function attachPanelDrag() {
  document.querySelectorAll(".panel").forEach((panel) => {
    const handle =
      panel.querySelector(".panel-bar") || panel.querySelector("[data-drag-handle]");
    if (!handle) return;
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;

    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".panel-actions")) return;
      if (event.target.closest("button")) return;
      if (panel.classList.contains("panel-locked")) return;
      panel.dataset.userMoved = "true";
      panel.classList.remove("showcase-panel");
      if (panel.dataset.maximized === "true") {
        restorePanel(panel);
      }
      dragging = true;
      panel.classList.add("dragging");
      focusPanel(panel);
      const rect = panel.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      spawnDragTrail(event);
      const proposedLeft = event.clientX - offsetX;
      const proposedTop = event.clientY - offsetY;
      setPanelPosition(panel, proposedLeft, proposedTop);
    });

    const stopDrag = (event) => {
      dragging = false;
      panel.classList.remove("dragging");
      handle.releasePointerCapture(event.pointerId);
    };

    handle.addEventListener("pointerup", stopDrag);
    handle.addEventListener("pointercancel", stopDrag);
  });
}

function attachPanelBarActions() {
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.addEventListener("dblclick", (event) => {
      if (event.target.closest(".panel-actions")) return;
      if (event.target.closest(".panel-settings")) return;
      if (
        event.target.closest("button") ||
        event.target.closest("input") ||
        event.target.closest("select") ||
        event.target.closest("textarea")
      ) {
        return;
      }
      togglePanelSettings(panel);
    });
  });
}

function attachResize() {
  document.querySelectorAll(".panel").forEach((panel) => {
    const handle = panel.querySelector(".resize-handle");
    if (!handle) return;
    let resizing = false;

    handle.addEventListener("pointerdown", (event) => {
      if (panel.classList.contains("panel-locked")) return;
      panel.dataset.userMoved = "true";
      panel.classList.remove("showcase-panel");
      resizing = true;
      if (panel.dataset.maximized === "true") {
        restorePanel(panel);
      }
      panel.classList.add("dragging");
      focusPanel(panel);
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener("pointermove", (event) => {
      if (!resizing) return;
      const rect = panel.getBoundingClientRect();
      const maxWidth = Math.max(MIN_PANEL_WIDTH, window.innerWidth - rect.left);
      const maxHeight = Math.max(MIN_PANEL_HEIGHT, window.innerHeight - rect.top);
      const width = Math.min(
        Math.max(MIN_PANEL_WIDTH, event.clientX - rect.left),
        maxWidth
      );
      const height = Math.min(
        Math.max(MIN_PANEL_HEIGHT, event.clientY - rect.top),
        maxHeight
      );
      panel.style.width = `${width}px`;
      panel.style.height = `${height}px`;
    });

    const stopResize = (event) => {
      resizing = false;
      panel.classList.remove("dragging");
      handle.releasePointerCapture(event.pointerId);
    };

    handle.addEventListener("pointerup", stopResize);
    handle.addEventListener("pointercancel", stopResize);
  });
}

function attachPanelFocus() {
  panels.forEach((panel) => {
    if (!panel) return;
    panel.addEventListener("pointerdown", () => focusPanel(panel), true);
    panel.addEventListener("click", () => focusPanel(panel), true);
  });
}

function attachLogoPanelActions() {
  if (!logoPanel) return;
  const mirror = logoPanel.querySelector(".mirror");
  const handleDblClick = (event) => {
    if (event.target.closest(".panel-settings")) return;
    if (
      event.target.closest("button") ||
      event.target.closest("input") ||
      event.target.closest("select") ||
      event.target.closest("textarea")
    ) {
      return;
    }
    event.preventDefault();
    togglePanelSettings(logoPanel);
  };

  logoPanel.addEventListener("dblclick", handleDblClick);
  if (mirror) {
    mirror.addEventListener("dblclick", handleDblClick);
  }
}

function minimizeToDock(panel) {
  panel.classList.add("hidden");
  panel.dataset.minimized = "true";
  updateDockVisibility();
  const action = dockByPanel[panel.id];
  if (!action) return;
  const dockItem = document.querySelector(`.dock-item[data-action=\"${action}\"]`);
  if (!dockItem) return;
  dockItem.classList.add("active");
  setTimeout(() => dockItem.classList.remove("active"), 600);
}

function togglePanelLock(panel) {
  panel.classList.toggle("panel-locked");
  if (panel.classList.contains("panel-locked")) {
    focusPanel(panel);
  }
}

function togglePanelCollapse(panel) {
  if (!panel) return;
  const bar = panel.querySelector(".panel-bar");
  if (!bar) return;
  const isCollapsed = panel.classList.contains("panel-collapsed");
  if (isCollapsed) {
    panel.classList.remove("panel-collapsed");
    const restoreHeight = panel.dataset.collapseHeight ?? "";
    panel.style.height = restoreHeight;
    if (panel.dataset.collapseMaximized === "true") {
      panel.dataset.collapseMaximized = "false";
      panel.dataset.maximized = "true";
      panel.classList.add("maximized");
    }
    panel.dataset.collapseHeight = "";
    return;
  }
  panel.dataset.collapseHeight = panel.style.height || "";
  if (panel.dataset.maximized === "true") {
    panel.dataset.collapseMaximized = "true";
    panel.dataset.maximized = "false";
    panel.classList.remove("maximized");
  } else {
    panel.dataset.collapseMaximized = "false";
  }
  panel.classList.add("panel-collapsed");
  panel.style.height = `${bar.offsetHeight}px`;
}

function togglePanelSettings(panel) {
  panel.classList.toggle("show-settings");
  focusPanel(panel);
}

function attachPanelActions() {
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.querySelectorAll(".panel-actions .icon-btn").forEach((button) => {
      const action =
        button.dataset.action || button.getAttribute("aria-label") || "";
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (action === "settings") togglePanelSettings(panel);
        if (action === "minimize") togglePanelCollapse(panel);
        if (action === "lock") togglePanelLock(panel);
        if (action === "close") minimizeToDock(panel);
      });
    });
  });
}

function buildPanelSettings(panel) {
  if (panel.querySelector(".panel-settings")) return;

  const titleEl = panel.querySelector(".panel-title");
  const isLogoPanel = panel.id === "logo-panel";
  const rect = panel.getBoundingClientRect();
  const computed = window.getComputedStyle(panel);
  const blurMatch =
    (typeof computed.backdropFilter === "string"
      ? computed.backdropFilter.match(/blur\\((\\d+(?:\\.\\d+)?)px\\)/)
      : null) ||
    (typeof computed.webkitBackdropFilter === "string"
      ? computed.webkitBackdropFilter.match(/blur\\((\\d+(?:\\.\\d+)?)px\\)/)
      : null);
  const blur = blurMatch ? parseFloat(blurMatch[1]) : 18;
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  const opacity = parseFloat(panel.dataset.panelOpacity || "0");
  const accent = panel.style.getPropertyValue("--panel-accent") || "";

  panel.dataset.panelBlur = panel.dataset.panelBlur || `${blur}`;
  panel.dataset.panelWidth = panel.dataset.panelWidth || `${width}`;
  panel.dataset.panelHeight = panel.dataset.panelHeight || `${height}`;
  panel.dataset.panelOpacity = panel.dataset.panelOpacity || `${opacity}`;
  panel.dataset.panelAccent = panel.dataset.panelAccent || accent;

  const settings = document.createElement("div");
  settings.className = "panel-settings";
  settings.innerHTML = `
    <div class="panel-settings-title">Panel Settings</div>
    <label data-setting-block="title">
      Title
      <input type="text" data-setting="title" />
    </label>
    ${
      isLogoPanel
        ? `
      <label>
        Incantation
        <input type="text" data-setting="spell" />
      </label>
    `
        : ""
    }
    <label>
      Accent Color
      <input type="color" data-setting="accent" />
    </label>
    <label>
      Glass Opacity
      <input type="range" min="0" max="0.9" step="0.05" data-setting="opacity" />
    </label>
    <label>
      Blur (px)
      <input type="range" min="0" max="28" step="1" data-setting="blur" />
    </label>
    <div class="row">
      <label>
        Width (px)
        <input type="number" min="320" max="1400" step="10" data-setting="width" />
      </label>
      <label>
        Height (px)
        <input type="number" min="240" max="1000" step="10" data-setting="height" />
      </label>
    </div>
    ${
      isLogoPanel
        ? `
      <div class="panel-settings-title">Mirror Media</div>
      <label>
        Mirror Image 1
        <input type="file" accept="image/*" data-setting="mirror-image-1" />
      </label>
      <label>
        Mirror Image 2
        <input type="file" accept="image/*" data-setting="mirror-image-2" />
      </label>
      <label>
        Mirror Video
        <input type="file" accept="video/*" data-setting="mirror-video" />
      </label>
    `
        : ""
    }
    <div class="actions">
      <button type="button" class="cta ghost" data-setting="reset">Reset</button>
    </div>
  `;

  panel.appendChild(settings);

  const titleInput = settings.querySelector('[data-setting="title"]');
  const titleBlock = settings.querySelector('[data-setting-block="title"]');
  if (!titleEl) {
    titleBlock.style.display = "none";
  } else {
    titleInput.value = titleEl.textContent.trim();
    titleInput.addEventListener("input", () => {
      titleEl.textContent = titleInput.value || titleEl.textContent;
    });
  }

  const accentInput = settings.querySelector('[data-setting="accent"]');
  const opacityInput = settings.querySelector('[data-setting="opacity"]');
  const blurInput = settings.querySelector('[data-setting="blur"]');
  const widthInput = settings.querySelector('[data-setting="width"]');
  const heightInput = settings.querySelector('[data-setting="height"]');
  const resetButton = settings.querySelector('[data-setting="reset"]');
  const mirrorImgInput1 = settings.querySelector('[data-setting="mirror-image-1"]');
  const mirrorImgInput2 = settings.querySelector('[data-setting="mirror-image-2"]');
  const mirrorVideoInput = settings.querySelector('[data-setting="mirror-video"]');
  const spellInput = settings.querySelector('[data-setting="spell"]');
  let mirrorA = null;
  let mirrorB = null;
  let mirrorVideo = null;

  const storedAccent = panel.dataset.panelAccent;
  accentInput.value = storedAccent && storedAccent.startsWith("#") ? storedAccent : "#00f5a0";
  opacityInput.value = panel.dataset.panelOpacity;
  blurInput.value = panel.dataset.panelBlur;
  widthInput.value = panel.dataset.panelWidth;
  heightInput.value = panel.dataset.panelHeight;

  const applyOpacity = () => {
    panel.dataset.panelOpacity = opacityInput.value;
    panel.style.backgroundColor = `rgba(0, 0, 0, ${opacityInput.value})`;
  };

  const applyBlur = () => {
    panel.dataset.panelBlur = blurInput.value;
    panel.style.backdropFilter = `blur(${blurInput.value}px)`;
    panel.style.webkitBackdropFilter = `blur(${blurInput.value}px)`;
  };

  const applySize = () => {
    panel.dataset.panelWidth = widthInput.value;
    panel.dataset.panelHeight = heightInput.value;
    panel.style.width = `${widthInput.value}px`;
    panel.style.height = `${heightInput.value}px`;
    clampPanelInViewport(panel);
  };

  const applyAccent = () => {
    panel.dataset.panelAccent = accentInput.value;
    panel.style.setProperty("--panel-accent", accentInput.value);
  };

  accentInput.addEventListener("input", applyAccent);
  opacityInput.addEventListener("input", applyOpacity);
  blurInput.addEventListener("input", applyBlur);
  widthInput.addEventListener("change", applySize);
  heightInput.addEventListener("change", applySize);

  if (isLogoPanel) {
    mirrorA = panel.querySelector(".mirror-img.mirror-a");
    mirrorB = panel.querySelector(".mirror-img.mirror-b");
    mirrorVideo = panel.querySelector(".mirror-video");
    const useImages = () => {
      panel.classList.remove("mirror-video-active");
      if (mirrorVideo) {
        mirrorVideo.pause();
        mirrorVideo.removeAttribute("src");
        mirrorVideo.load();
      }
    };

    if (mirrorImgInput1 && mirrorA) {
      mirrorImgInput1.addEventListener("change", () => {
        const file = mirrorImgInput1.files?.[0];
        if (!file) return;
        mirrorA.src = URL.createObjectURL(file);
        useImages();
      });
    }

    if (mirrorImgInput2 && mirrorB) {
      mirrorImgInput2.addEventListener("change", () => {
        const file = mirrorImgInput2.files?.[0];
        if (!file) return;
        mirrorB.src = URL.createObjectURL(file);
        useImages();
      });
    }

    if (mirrorVideoInput && mirrorVideo) {
      mirrorVideoInput.addEventListener("change", () => {
        const file = mirrorVideoInput.files?.[0];
        if (!file) return;
        mirrorVideo.src = URL.createObjectURL(file);
        mirrorVideo.play().catch(() => {});
        panel.classList.add("mirror-video-active");
      });
    }

    if (spellInput) {
      spellInput.value = state.spell;
      spellInput.addEventListener("input", () => {
        applySpell(spellInput.value, { force: true, refreshPanels: true });
      });
    }
  }

  resetButton.addEventListener("click", () => {
    const defaults = panelSettingsDefaults.get(panel);
    if (!defaults) return;
    if (titleEl && defaults.title) titleEl.textContent = defaults.title;
    accentInput.value = defaults.accent || "#00f5a0";
    opacityInput.value = defaults.opacity;
    blurInput.value = defaults.blur;
    widthInput.value = defaults.width;
    heightInput.value = defaults.height;
    applyAccent();
    applyOpacity();
    applyBlur();
    applySize();

    if (isLogoPanel) {
      if (mirrorA) mirrorA.src = "assets/mirror-1.webp";
      if (mirrorB) mirrorB.src = "assets/mirror-2.webp";
      panel.classList.remove("mirror-video-active");
      if (mirrorVideo) {
        mirrorVideo.pause();
        mirrorVideo.removeAttribute("src");
        mirrorVideo.load();
      }
      if (mirrorImgInput1) mirrorImgInput1.value = "";
      if (mirrorImgInput2) mirrorImgInput2.value = "";
      if (mirrorVideoInput) mirrorVideoInput.value = "";
      if (spellInput) spellInput.value = DEFAULT_SPELL;
      applySpell(DEFAULT_SPELL, { force: true, refreshPanels: true });
    }
  });

  panelSettingsDefaults.set(panel, {
    title: titleEl ? titleEl.textContent.trim() : "",
    accent: panel.dataset.panelAccent,
    opacity: opacityInput.value,
    blur: blurInput.value,
    width: widthInput.value,
    height: heightInput.value
  });
}

function initPanelSettings() {
  document.querySelectorAll(".panel").forEach((panel) => {
    buildPanelSettings(panel);
  });
}

applySettings.addEventListener("click", () => {
  const customLyrics = lyricsInput.value.trim();
  const customTitle = titleInput.value.trim();
  startCreation(customTitle, customLyrics);
  openPanel(foryouPanel);
});

if (randomPaletteButton) {
  randomPaletteButton.addEventListener("click", randomizePalette);
}

if (enterWatchButton) {
  enterWatchButton.addEventListener("click", async () => {
    openPanel(watchPanel);
    if (!videoJobId) {
      const ok = await playLatestVideoFromRegistry();
      if (!ok) {
        showToast("No video ready yet");
      }
    }
  });
}

if (listenButton) {
  listenButton.addEventListener("click", () => openPanel(musicPanel));
}

if (watchButton) {
  watchButton.addEventListener("click", async () => {
    openPanel(watchPanel);
    if (!videoJobId) {
      await playLatestVideoFromRegistry();
    }
  });
}

initVideoPlaybackControls();

if (styleInput) {
  styleInput.addEventListener("change", () => updateEnginePanels(state.title, state.lines));
}

if (voiceInput) {
  voiceInput.addEventListener("change", () => updateEnginePanels(state.title, state.lines));
}

bgColorInputs.forEach((input) => {
  if (!input) return;
  input.addEventListener("input", applyBackgroundPalette);
});

["mousemove", "keydown", "touchstart"].forEach((eventName) => {
  window.addEventListener(eventName, resetInactivityTimer, { passive: true });
});

resetInactivityTimer();
initPanelStack();
updateDockVisibility();
applySpell(state.spell, { force: true, refreshPanels: false });
updateEnginePanels(state.title, state.lines);
applyBackgroundPalette();
attachDockEvents();
attachPanelDrag();
attachPanelBarActions();
attachResize();
attachPanelFocus();
attachPanelActions();
attachLogoPanelActions();
initPanelSettings();
initEngineControls();
initLyricsControls();
initLanguagePanel();
fetchMe();
fetchAuthProviders();
fetchBillingStatus();
initVersionSwitcher();
if (loginLogout) {
  loginLogout.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (err) {
      // ignore
    }
    authState.user = null;
    authState.role = DEFAULT_ROLE;
    authState.tier = DEFAULT_ROLE;
    updateLoginUI();
    fetchBillingStatus();
  });
}
attachAmbientTrail();

window.addEventListener("resize", () => {
  panels.forEach((panel) => clampPanelInViewport(panel));
  layoutShowcasePanels();
});
