(function initWatchFontManifest(global){
  const entries = [
  {
    "family": "HengShanMaoBiCaoShu",
    "src": "fonts/HengShanMaoBiCaoShu.ttf",
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
