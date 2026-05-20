(function initWatchFontManifest(global){
  const entries = [
  {
    "family": "HengShanMaoBiCaoShu",
    "src": "fonts/HengShanMaoBiCaoShu.ttf",
    "format": "truetype"
  },
  {
    "family": "AQUARIUM",
    "src": "fonts_en/AQUARIUM-2.otf",
    "format": "opentype"
  },
  {
    "family": "Acmedia",
    "src": "fonts_en/Acmedia-2.ttf",
    "format": "truetype"
  },
  {
    "family": "AidianSignatureTi",
    "src": "fonts_en/AidianSignatureTi-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "AliceInWonderland",
    "src": "fonts_en/AliceInWonderland-1GzL0-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Alison",
    "src": "fonts_en/Alison-finch-2.otf",
    "format": "opentype"
  },
  {
    "family": "Allianty",
    "src": "fonts_en/Allianty-2.otf",
    "format": "opentype"
  },
  {
    "family": "Alter",
    "src": "fonts_en/Alter-Bridge-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Amattera",
    "src": "fonts_en/Amattera-Million-2.otf",
    "format": "opentype"
  },
  {
    "family": "Amberllee",
    "src": "fonts_en/Amberllee-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Amelline",
    "src": "fonts_en/Amelline-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Amiela",
    "src": "fonts_en/Amiela-2.otf",
    "format": "opentype"
  },
  {
    "family": "Andromeda",
    "src": "fonts_en/Andromeda-0WGzd-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Anthony",
    "src": "fonts_en/Anthony-Houston-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Artisual Deco",
    "src": "fonts_en/Artisual-Deco-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Ashburton",
    "src": "fonts_en/Ashburton-MVGKJ-2.otf",
    "format": "opentype"
  },
  {
    "family": "Asmelina",
    "src": "fonts_en/Asmelina-Harley-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Austin",
    "src": "fonts_en/Austin-Hearts-2.otf",
    "format": "opentype"
  },
  {
    "family": "Authentica",
    "src": "fonts_en/Authentica-2.otf",
    "format": "opentype"
  },
  {
    "family": "Avaca",
    "src": "fonts_en/Avaca-Davra-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Ayanalove",
    "src": "fonts_en/Ayanalove-2.otf",
    "format": "opentype"
  },
  {
    "family": "Backrush",
    "src": "fonts_en/Backrush-2.otf",
    "format": "opentype"
  },
  {
    "family": "Badlooking",
    "src": "fonts_en/Badlooking-Brush-2.otf",
    "format": "opentype"
  },
  {
    "family": "Balinesse",
    "src": "fonts_en/Balinesse-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Baliung",
    "src": "fonts_en/Baliung-2.otf",
    "format": "opentype"
  },
  {
    "family": "Balymond",
    "src": "fonts_en/Balymond-2.ttf",
    "format": "truetype"
  },
  {
    "family": "BattomGlory",
    "src": "fonts_en/BattomGlory-p7Ryy-2.otf",
    "format": "opentype"
  },
  {
    "family": "Beauty",
    "src": "fonts_en/Beauty-Boutique-2.otf",
    "format": "opentype"
  },
  {
    "family": "Belianty",
    "src": "fonts_en/Belianty-Elesha-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Belinda",
    "src": "fonts_en/Belinda-Heylove-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Bellamy",
    "src": "fonts_en/Bellamy-Stevenson-2.otf",
    "format": "opentype"
  },
  {
    "family": "Berthessa",
    "src": "fonts_en/Berthessa-2.otf",
    "format": "opentype"
  },
  {
    "family": "Blackish",
    "src": "fonts_en/Blackish-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Blogh",
    "src": "fonts_en/Blogh-2.otf",
    "format": "opentype"
  },
  {
    "family": "BoldnessRace",
    "src": "fonts_en/BoldnessRace-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Brightons",
    "src": "fonts_en/Brightons-2.otf",
    "format": "opentype"
  },
  {
    "family": "Brilganttyne",
    "src": "fonts_en/Brilganttyne-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Brogetta",
    "src": "fonts_en/BrogettaRegular-ZV5EK-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Bugis",
    "src": "fonts_en/Bugis-2.ttf",
    "format": "truetype"
  },
  {
    "family": "California sun",
    "src": "fonts_en/California-sun-2.otf",
    "format": "opentype"
  },
  {
    "family": "CastilloSignature",
    "src": "fonts_en/CastilloSignature-rgaey-2.otf",
    "format": "opentype"
  },
  {
    "family": "Cathena",
    "src": "fonts_en/Cathena-vmKE7-2.otf",
    "format": "opentype"
  },
  {
    "family": "Chedaty",
    "src": "fonts_en/Chedaty-2.otf",
    "format": "opentype"
  },
  {
    "family": "Cheerful Day",
    "src": "fonts_en/Cheerful-Day-EaZ4j-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Claudia",
    "src": "fonts_en/Claudia-Laura-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Corna",
    "src": "fonts_en/Corna-2.otf",
    "format": "opentype"
  },
  {
    "family": "Courteous",
    "src": "fonts_en/Courteous-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Cuningham",
    "src": "fonts_en/Cuningham-Singleton-2.otf",
    "format": "opentype"
  },
  {
    "family": "DELMANOMORELLI",
    "src": "fonts_en/DELMANOMORELLI-2.ttf",
    "format": "truetype"
  },
  {
    "family": "David And",
    "src": "fonts_en/David-And-Sovhie-2.otf",
    "format": "opentype"
  },
  {
    "family": "Delisha",
    "src": "fonts_en/Delisha-2.otf",
    "format": "opentype"
  },
  {
    "family": "DilanWhemsy",
    "src": "fonts_en/DilanWhemsy-2.otf",
    "format": "opentype"
  },
  {
    "family": "Display-Magazine-2",
    "src": "fonts_en/Display-Magazine-2.otf",
    "format": "opentype"
  },
  {
    "family": "Display-Magazine-3",
    "src": "fonts_en/Display-Magazine-3.ttf",
    "format": "truetype"
  },
  {
    "family": "Draco",
    "src": "fonts_en/Draco-2.otf",
    "format": "opentype"
  },
  {
    "family": "Ediana",
    "src": "fonts_en/Ediana-PK2JB-2.ttf",
    "format": "truetype"
  },
  {
    "family": "EnglandScript",
    "src": "fonts_en/EnglandScript-2.otf",
    "format": "opentype"
  },
  {
    "family": "Frick0.",
    "src": "fonts_en/Frick0.3-Condensed-2.otf",
    "format": "opentype"
  },
  {
    "family": "Fuel Injection",
    "src": "fonts_en/Fuel-Injection-Normal-2.otf",
    "format": "opentype"
  },
  {
    "family": "Generation",
    "src": "fonts_en/Generation-EaZ2r-2.otf",
    "format": "opentype"
  },
  {
    "family": "Genta",
    "src": "fonts_en/Genta-Font-2.otf",
    "format": "opentype"
  },
  {
    "family": "GingerBiscuitExtrudePul",
    "src": "fonts_en/GingerBiscuitExtrudePul-ZVOWl-2.ttf",
    "format": "truetype"
  },
  {
    "family": "GoodHood",
    "src": "fonts_en/GoodHood-2.otf",
    "format": "opentype"
  },
  {
    "family": "GreenHome",
    "src": "fonts_en/GreenHome-WyZa4-2.ttf",
    "format": "truetype"
  },
  {
    "family": "HFWhale",
    "src": "fonts_en/HFWhale-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Hadnich",
    "src": "fonts_en/HadnichRegular-51x4Z-2.ttf",
    "format": "truetype"
  },
  {
    "family": "HamsleyScript",
    "src": "fonts_en/HamsleyScriptRegular-8MyrJ-2.otf",
    "format": "opentype"
  },
  {
    "family": "Hello",
    "src": "fonts_en/Hello-Hamna-2.otf",
    "format": "opentype"
  },
  {
    "family": "HiJack",
    "src": "fonts_en/HiJack-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Honeybears",
    "src": "fonts_en/Honeybears-2.otf",
    "format": "opentype"
  },
  {
    "family": "Hypeblox",
    "src": "fonts_en/Hypeblox-L3YGZ-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Igoe",
    "src": "fonts_en/Igoe-2.otf",
    "format": "opentype"
  },
  {
    "family": "IronHorse",
    "src": "fonts_en/IronHorseRegular-K78rA-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Jacky",
    "src": "fonts_en/Jacky-Brushes-2.otf",
    "format": "opentype"
  },
  {
    "family": "Jacob and son",
    "src": "fonts_en/Jacob-and-son-2.otf",
    "format": "opentype"
  },
  {
    "family": "Janelotus",
    "src": "fonts_en/Janelotus-2.otf",
    "format": "opentype"
  },
  {
    "family": "Junior",
    "src": "fonts_en/Junior-prince-2.otf",
    "format": "opentype"
  },
  {
    "family": "Katracy",
    "src": "fonts_en/Katracy-2.otf",
    "format": "opentype"
  },
  {
    "family": "KitaharaScript",
    "src": "fonts_en/KitaharaScriptRegular-2.otf",
    "format": "opentype"
  },
  {
    "family": "Klipan",
    "src": "fonts_en/Klipan-Black-2.ttf",
    "format": "truetype"
  },
  {
    "family": "LemonRolls",
    "src": "fonts_en/LemonRolls-2OGol-2.otf",
    "format": "opentype"
  },
  {
    "family": "LittleBirds",
    "src": "fonts_en/LittleBirdsRegular-lg81w-2.ttf",
    "format": "truetype"
  },
  {
    "family": "LocalBreweryTwo",
    "src": "fonts_en/LocalBreweryTwo-Regular-2.otf",
    "format": "opentype"
  },
  {
    "family": "Losttimoh",
    "src": "fonts_en/Losttimoh-2.otf",
    "format": "opentype"
  },
  {
    "family": "Lovelygirly",
    "src": "fonts_en/Lovelygirly-2.otf",
    "format": "opentype"
  },
  {
    "family": "Mango",
    "src": "fonts_en/Mango-Regular-2.otf",
    "format": "opentype"
  },
  {
    "family": "Marchell",
    "src": "fonts_en/Marchell-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Maves",
    "src": "fonts_en/Maves-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Meghatone",
    "src": "fonts_en/Meghatone-Signature-2.ttf",
    "format": "truetype"
  },
  {
    "family": "MonsieurLaDoulaise",
    "src": "fonts_en/MonsieurLaDoulaise-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Montheylin",
    "src": "fonts_en/Montheylin-2.otf",
    "format": "opentype"
  },
  {
    "family": "Montreau",
    "src": "fonts_en/Montreau-Regular-2.otf",
    "format": "opentype"
  },
  {
    "family": "Moreland",
    "src": "fonts_en/Moreland-2.otf",
    "format": "opentype"
  },
  {
    "family": "MrsAlexandra",
    "src": "fonts_en/MrsAlexandra-4BGxW-2.otf",
    "format": "opentype"
  },
  {
    "family": "MrsAlexandraMonogram",
    "src": "fonts_en/MrsAlexandraMonogram-owqeo-3.otf",
    "format": "opentype"
  },
  {
    "family": "Muathuk",
    "src": "fonts_en/Muathuk-2.otf",
    "format": "opentype"
  },
  {
    "family": "Munich",
    "src": "fonts_en/Munich-2.otf",
    "format": "opentype"
  },
  {
    "family": "MySunshine",
    "src": "fonts_en/MySunshine-2.otf",
    "format": "opentype"
  },
  {
    "family": "Nature Green",
    "src": "fonts_en/Nature-Green-Italic-2.otf",
    "format": "opentype"
  },
  {
    "family": "No.013 Sounso Moon",
    "src": "fonts_en/No.013-Sounso-Moon-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Northline",
    "src": "fonts_en/Northline-2.otf",
    "format": "opentype"
  },
  {
    "family": "Pithick",
    "src": "fonts_en/Pithick-Crispy-2.otf",
    "format": "opentype"
  },
  {
    "family": "Polonium",
    "src": "fonts_en/Polonium-3.otf",
    "format": "opentype"
  },
  {
    "family": "Polonium Bold",
    "src": "fonts_en/Polonium-Bold-2.otf",
    "format": "opentype"
  },
  {
    "family": "Qittuny",
    "src": "fonts_en/Qittuny-2.otf",
    "format": "opentype"
  },
  {
    "family": "Qualitative",
    "src": "fonts_en/Qualitative-2.otf",
    "format": "opentype"
  },
  {
    "family": "Qualy Bold",
    "src": "fonts_en/Qualy-Bold-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Rainbow",
    "src": "fonts_en/Rainbow-Universe-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Rastano",
    "src": "fonts_en/Rastano-2.otf",
    "format": "opentype"
  },
  {
    "family": "Rastella",
    "src": "fonts_en/Rastella-2.otf",
    "format": "opentype"
  },
  {
    "family": "Rattnugidari",
    "src": "fonts_en/Rattnugidari-3.ttf",
    "format": "truetype"
  },
  {
    "family": "Realistic",
    "src": "fonts_en/Realistic-2.otf",
    "format": "opentype"
  },
  {
    "family": "Reflisatta",
    "src": "fonts_en/Reflisatta-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Resta",
    "src": "fonts_en/RestaDisplayFont-p7o2Z-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RevijAnovik",
    "src": "fonts_en/RevijAnovik-X3ARG-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Reynatta",
    "src": "fonts_en/Reynatta-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Rivandell",
    "src": "fonts_en/Rivandell-2.otf",
    "format": "opentype"
  },
  {
    "family": "Rough Owl",
    "src": "fonts_en/Rough-Owl-Regular-qZpJd-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Ruottey",
    "src": "fonts_en/Ruottey-2.otf",
    "format": "opentype"
  },
  {
    "family": "Samberia",
    "src": "fonts_en/Samberia-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Siegra",
    "src": "fonts_en/Siegra-2.otf",
    "format": "opentype"
  },
  {
    "family": "Sinethar",
    "src": "fonts_en/Sinethar-0WLLo-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Starshy",
    "src": "fonts_en/Starshy-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Suffer",
    "src": "fonts_en/Suffer-through-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Sweety",
    "src": "fonts_en/Sweety-Sunshine-2.otf",
    "format": "opentype"
  },
  {
    "family": "Timothy Sign",
    "src": "fonts_en/Timothy-Sign-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Undertow",
    "src": "fonts_en/Undertow-3.otf",
    "format": "opentype"
  },
  {
    "family": "Undertow Slab",
    "src": "fonts_en/Undertow-Slab-2.otf",
    "format": "opentype"
  },
  {
    "family": "VILLADICANCE",
    "src": "fonts_en/VILLADICANCE-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Ventus",
    "src": "fonts_en/Ventus-2.otf",
    "format": "opentype"
  },
  {
    "family": "Violet",
    "src": "fonts_en/Violet-Twinkle-2.ttf",
    "format": "truetype"
  },
  {
    "family": "WelcomeValentine",
    "src": "fonts_en/WelcomeValentine-2.otf",
    "format": "opentype"
  },
  {
    "family": "Wilson",
    "src": "fonts_en/Wilson-wells-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Winstonia",
    "src": "fonts_en/Winstonia-2.otf",
    "format": "opentype"
  },
  {
    "family": "Winter",
    "src": "fonts_en/Winter-Sunshine-2.otf",
    "format": "opentype"
  },
  {
    "family": "YouraScript",
    "src": "fonts_en/YouraScript-qZ51x-2.otf",
    "format": "opentype"
  },
  {
    "family": "abington bold",
    "src": "fonts_en/abington-bold-font-2.otf",
    "format": "opentype"
  },
  {
    "family": "angelin",
    "src": "fonts_en/angelin-2.otf",
    "format": "opentype"
  },
  {
    "family": "belights",
    "src": "fonts_en/belights-2.ttf",
    "format": "truetype"
  },
  {
    "family": "branch zystoo",
    "src": "fonts_en/branch-zystoo-Regular-2.otf",
    "format": "opentype"
  },
  {
    "family": "calib resuper condensed",
    "src": "fonts_en/calib-resuper-condensed-regular-2.otf",
    "format": "opentype"
  },
  {
    "family": "celattin",
    "src": "fonts_en/celattin-font-2.ttf",
    "format": "truetype"
  },
  {
    "family": "earga",
    "src": "fonts_en/earga-2.ttf",
    "format": "truetype"
  },
  {
    "family": "far out",
    "src": "fonts_en/far-out-2.ttf",
    "format": "truetype"
  },
  {
    "family": "holly and",
    "src": "fonts_en/holly-and-berries-2.ttf",
    "format": "truetype"
  },
  {
    "family": "karen",
    "src": "fonts_en/karen-2.otf",
    "format": "opentype"
  },
  {
    "family": "nucleo",
    "src": "fonts_en/nucleo-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ractor",
    "src": "fonts_en/ractor-2.ttf",
    "format": "truetype"
  },
  {
    "family": "sharpshooter",
    "src": "fonts_en/sharpshooter-2.ttf",
    "format": "truetype"
  },
  {
    "family": "summer",
    "src": "fonts_en/summer-coast-2.ttf",
    "format": "truetype"
  },
  {
    "family": "the",
    "src": "fonts_en/the-antter-2.ttf",
    "format": "truetype"
  },
  {
    "family": "thinkers",
    "src": "fonts_en/thinkers-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PangMenZhengDaoXiXianTi-2",
    "src": "fonts_cn2/PangMenZhengDaoXiXianTi-2.ttf",
    "format": "truetype"
  }
  ];
  // CSSOS_PHASE2_FONT_404_PRUNE 20260426 #134 — Jing
  // "控制台报错，还是这些字体问题，能不能一次性下载他们？免得每次都报错？"
  //
  // The manifest references ~380 fonts under /fonts_en/<name>.otf|ttf, but
  // that directory was never deployed (only /fonts/HengShanMaoBiCaoShu.ttf
  // and /fonts_cn2/* exist on the server). The browser was firing 380×
  // failed-to-load errors per page load, drowning out useful console output.
  //
  // Strategy: HEAD-probe each unique src ROOT directory exactly ONCE per
  // session, cached in localStorage with a 24h TTL. If `fonts_en/` is
  // missing, prune all `fonts_en/*` entries from the @font-face emit. The
  // system fallback list in app.watch-media-layout-p2100.js (LATIN_FONTS,
  // CJK_FONTS) takes over and the random-font picker still has a healthy
  // pool to draw from. Auto-rehydrates if the catalog ever gets deployed.
  const ROOT_PROBE_KEY = "cssos.fontRootProbe.v1";
  const ROOT_PROBE_TTL_MS = 24 * 3600 * 1000;
  const allRoots = Array.from(new Set(
    entries
      .map((e) => String(e.src || "").split("/")[0])
      .filter(Boolean)
  ));

  function readProbeCache() {
    try {
      const raw = localStorage.getItem(ROOT_PROBE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (Date.now() - Number(parsed.ts || 0) > ROOT_PROBE_TTL_MS) return null;
      return parsed.roots || {};
    } catch (_e) { return null; }
  }
  function writeProbeCache(roots) {
    try {
      localStorage.setItem(ROOT_PROBE_KEY, JSON.stringify({
        ts: Date.now(), roots: roots
      }));
    } catch (_e) { /* quota / private mode — ignore */ }
  }

  async function probeRoots() {
    const cached = readProbeCache();
    if (cached && allRoots.every((r) => cached[r] !== undefined)) {
      return cached;
    }
    const roots = cached || {};
    const probes = allRoots.map(async (root) => {
      // Probe a representative entry from each root folder.
      const sample = entries.find((e) => String(e.src || "").startsWith(root + "/"));
      if (!sample) { roots[root] = false; return; }
      try {
        const resp = await fetch("/" + sample.src, { method: "HEAD", cache: "no-store" });
        roots[root] = resp.ok;
      } catch (_err) {
        roots[root] = false;
      }
    });
    await Promise.all(probes);
    writeProbeCache(roots);
    return roots;
  }

  function injectAvailable(availableRoots) {
    let survivors = entries.filter((e) => {
      const root = String(e.src || "").split("/")[0];
      return availableRoots[root] === true;
    });
    // CSSOS_PHASE2_MOBILE_PAIN_RELIEF 20260505 — Jing
    // Cap @font-face declarations on mobile. 143+ rules + the 58
    // Google Fonts above blew past Safari's mobile font budget;
    // many phones reported "A problem repeatedly occurred" at boot.
    // Sample evenly across the survivors so the picker still has
    // visual variety, just from a smaller pool.
    try {
      const isMobile =
        (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
        (window.innerWidth && window.innerWidth <= 720) ||
        /iPhone|iPod|Android.*Mobile/i.test(String(navigator.userAgent || ""));
      const MOBILE_LOCAL_CAP = 32;
      if (isMobile && survivors.length > MOBILE_LOCAL_CAP) {
        const stride = Math.max(1, Math.floor(survivors.length / MOBILE_LOCAL_CAP));
        const sampled = [];
        for (let i = 0; i < survivors.length && sampled.length < MOBILE_LOCAL_CAP; i += stride) {
          sampled.push(survivors[i]);
        }
        survivors = sampled;
      }
    } catch (_e) { /* fall through with the un-capped list */ }
    global.CSSOS_WATCH_FONT_MANIFEST = survivors;
    const styleId = "cssos-watch-font-manifest-style";
    if (document.getElementById(styleId)) return;
    if (survivors.length === 0) {
      // Nothing exists on the server yet — leave the system-fallback path
      // alone and stay quiet. No @font-face rules → no 404 storm.
      console.info(
        "[font-manifest] All font roots probed missing on server " +
        "(" + Object.keys(availableRoots).filter((r) => !availableRoots[r]).join(", ") +
        "). Falling back to system fonts. Re-deploy the font catalog to " +
        "auto-rehydrate; cache TTL = 24h, clear with localStorage.removeItem('" +
        ROOT_PROBE_KEY + "')."
      );
      return;
    }
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = survivors
      .map((entry) => `@font-face{font-family:"${entry.family.replace(/"/g, "\"")}";src:url("/${encodeURI(entry.src)}") format("${entry.format}");font-display:swap;unicode-range:U+0000-024F,U+2E80-9FFF,U+3000-303F,U+3400-4DBF,U+F900-FAFF,U+FE30-FE4F,U+FF00-FFEF;}`)
      .join("\n");
    document.head.appendChild(style);
    // Silenced 20260506 — keep console clean (only the LOGO survives).
  }

  // Optimistic boot: if the cache says a root is available, inject those
  // immediately so first paint has the fonts. Then probe in the background
  // to catch any fresh 404s. If no cache, set CSSOS_WATCH_FONT_MANIFEST to
  // an empty array temporarily so consumers don't crash on undefined.
  const seedCache = readProbeCache();
  if (seedCache) {
    injectAvailable(seedCache);
  } else {
    global.CSSOS_WATCH_FONT_MANIFEST = [];
  }
  probeRoots().then((roots) => {
    // If we already injected from a stale cache, don't re-inject.
    if (document.getElementById("cssos-watch-font-manifest-style")) return;
    injectAvailable(roots);
  });

  // CSSOS_PHASE2_GOOGLE_FANCY_FONTS 20260504 — Jing
  // "希望，尽快看到这样的字体" (Qwitcher Grypen / Ballet / Rochester /
  // Romanesco …). The local manifest is pruned heavy on CJK — the Latin
  // fancy bucket is starved. Hook a curated set of Google Fonts script /
  // calligraphic / display faces into the same manifest so the 90/10
  // weighted picker has plenty of beautiful Latin (and a few CN) fonts
  // to draw from. CSS-served, no local file dependency, font-display:
  // swap ⇒ never blocks paint.
  const GOOGLE_FANCY_FONTS = [
    // Latin script / calligraphic
    "Qwitcher Grypen", "Ballet", "Rochester", "Romanesco", "Pacifico",
    "Dancing Script", "Great Vibes", "Allura", "Sacramento", "Tangerine",
    "Marck Script", "Parisienne", "Pinyon Script", "Mr Dafoe", "Mrs Saint Delafield",
    "Petit Formal Script", "Italianno", "Yellowtail", "Kaushan Script",
    "Caveat", "Caveat Brush", "Homemade Apple", "Reenie Beanie",
    "Shadows Into Light", "Permanent Marker", "Just Another Hand",
    // Display / decorative
    "Lobster", "Lobster Two", "Bungee Shade", "Monoton", "Faster One",
    "Bowlby One", "Black Ops One", "Cinzel Decorative", "UnifrakturMaguntia",
    "Pirata One", "Almendra Display", "Henny Penny", "Vampiro One",
    "Eater", "Creepster", "Nosifer", "Rubik Glitch", "Rubik Wet Paint",
    "Rubik Beastly", "Bungee Outline", "Rye", "Smokum", "Special Elite",
    // CJK calligraphic (Google supplies these)
    "Ma Shan Zheng", "Liu Jian Mao Cao", "Long Cang",
    "ZCOOL XiaoWei", "ZCOOL KuaiLe", "ZCOOL QingKe HuangYou",
    "Zhi Mang Xing", "Noto Serif SC", "Noto Sans SC"
  ];

  // CSSOS_PHASE2_MOBILE_PAIN_RELIEF 20260505 — Jing
  // "手机端痛点，可以解决吗". Mobile Safari kills the page with
  // "A problem repeatedly occurred" when the boot sequence pulls
  // 58 Google Fonts on top of 143 local @font-face rules — each
  // glyph encountered fans out a WOFF2 fetch + decode, easily
  // exhausting the 4 GB-iPhone tab budget. Detect mobile / narrow
  // viewport and trim the Google list HARD: keep ~10 best-loved
  // script faces only, drop the rest. Desktop sees the full 58.
  function isMobileViewport() {
    try {
      if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true;
      if (window.innerWidth && window.innerWidth <= 720) return true;
      const ua = String(navigator.userAgent || "");
      if (/iPhone|iPod|Android.*Mobile/i.test(ua)) return true;
    } catch (_e) {}
    return false;
  }
  const MOBILE_FANCY_FONTS = [
    "Pacifico", "Dancing Script", "Great Vibes", "Sacramento",
    "Caveat", "Lobster", "Permanent Marker", "Cinzel Decorative",
    "Ma Shan Zheng", "ZCOOL XiaoWei",
  ];
  function injectGoogleFancyFonts() {
    if (document.getElementById("cssos-google-fancy-fonts")) return;
    const fonts = isMobileViewport() ? MOBILE_FANCY_FONTS : GOOGLE_FANCY_FONTS;
    // Build the families= URL fragment. Google's css2 endpoint takes
    // semicolon-separated entries with + for spaces.
    const families = fonts
      .map((f) => "family=" + f.replace(/ /g, "+"))
      .join("&");
    const link = document.createElement("link");
    link.id = "cssos-google-fancy-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?" + families + "&display=swap";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
    // Append entries to the in-memory manifest so the per-token picker
    // (loadFontPools fallback in app.watch-media-overlays.js) treats
    // them as part of the font pool. Empty src signals "external CSS,
    // no local file".
    const existing = Array.isArray(global.CSSOS_WATCH_FONT_MANIFEST)
      ? global.CSSOS_WATCH_FONT_MANIFEST.slice()
      : [];
    const seen = new Set(existing.map((e) => String(e.family || "")));
    const CN_FAM = /[一-鿿]/;
    for (const fam of fonts) {
      if (seen.has(fam)) continue;
      existing.push({
        family: fam,
        src: "",
        format: "external",
        group: CN_FAM.test(fam) ||
               /^(Ma Shan|Liu Jian|Long Cang|ZCOOL|Zhi Mang|Noto (?:Serif|Sans) SC)/i.test(fam)
                 ? "cjk" : "latin"
      });
    }
    global.CSSOS_WATCH_FONT_MANIFEST = existing;
    // Bust the overlays cache so loadFontPools picks up the new entries
    // on next call.
    try {
      if (global.cssmvAssignFontForPiece && typeof global.cssmvAssignFontForPiece === "function") {
        // Stamp the cache invalidation marker — the cache is internal
        // to overlays.js, but it expires every 1s anyway, so we just
        // wait for the next tick.
      }
    } catch (_e) {}
    // Silenced 20260506 — keep console clean.
  }
  // CSSOS_PHASE2_MOBILE_PAIN_RELIEF 20260505 — Jing
  // On mobile, defer Google Fonts injection until first user
  // interaction. The homepage logo + dock don't need fancy fonts;
  // by the time the user taps anything, the network is warm and
  // the boot bundle has already settled. Desktop injects eagerly
  // because the boot budget is comfortable.
  function isMobileFontDefer() {
    try {
      if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true;
      if (window.innerWidth && window.innerWidth <= 720) return true;
      const ua = String(navigator.userAgent || "");
      if (/iPhone|iPod|Android.*Mobile/i.test(ua)) return true;
    } catch (_e) {}
    return false;
  }
  function scheduleGoogleFancyInjection() {
    if (!isMobileFontDefer()) {
      injectGoogleFancyFonts();
      return;
    }
    const oncePer = (fn) => {
      let fired = false;
      return () => { if (fired) return; fired = true; fn(); };
    };
    const fire = oncePer(() => {
      try { injectGoogleFancyFonts(); } catch (_e) {}
    });
    ["pointerdown", "touchstart", "click", "keydown"].forEach((ev) => {
      document.addEventListener(ev, fire, { once: true, passive: true, capture: true });
    });
    // Failsafe: even without interaction, inject after 6s so the
    // watch panel has fonts when the user eventually opens it.
    setTimeout(fire, 6000);
  }
  if (document.head) {
    scheduleGoogleFancyInjection();
  } else {
    document.addEventListener("DOMContentLoaded", scheduleGoogleFancyInjection, { once: true });
  }
})(window);
