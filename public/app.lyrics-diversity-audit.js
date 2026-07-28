(function attachLyricsDiversityAudit(global) {
  const T = (en) => (typeof globalThis.loginCopy === "function" ? globalThis.loginCopy(en) : en);

  function buildLyricsFallbackDiversityAuditBridge(history = []) {
    const rows = Array.isArray(history) ? history : [];
    const families = new Set(rows.map((item) => String(item.family || "")).filter(Boolean));
    const titles = new Set(rows.map((item) => String(item.title || "")).filter(Boolean));
    const firstLines = new Set(rows.map((item) => String(item.firstLine || "")).filter(Boolean));
    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          families.size * 24 +
            titles.size * 12 +
            firstLines.size * 8 +
            Math.min(rows.length, 6) * 4
        )
      )
    );
    const level =
      score >= 72
        ? T("healthy spread")
        : score >= 44
          ? T("mixed spread")
          : T("collapsed spread");
    return {
      level,
      score,
      note: `${T("Families")} ${families.size} · ${T("titles")} ${titles.size} · ${T("first lines")} ${firstLines.size} ${T("across")} ${rows.length} ${T("recent seed(s).")}`
    };
  }

  function buildLyricsSeedSpreadCardBridge(history = []) {
    const rows = (Array.isArray(history) ? history : []).slice(-6).reverse();
    return {
      headline: T("Recent seed spread"),
      rows: rows.length
        ? rows.map((item) =>
            `${item.at} · ${item.seedTag || T("no-tag")} · ${item.family || T("unknown family")} · ${item.title || T("untitled")}`
          )
        : [T("No recent seed spread yet.")]
    };
  }

  function buildLyricsRepeatedPhraseAlarmBridge(history = []) {
    const rows = Array.isArray(history) ? history : [];
    const firstLineCounts = new Map();
    rows.forEach((item) => {
      const line = String(item.firstLine || "").trim();
      if (!line) return;
      firstLineCounts.set(line, (firstLineCounts.get(line) || 0) + 1);
    });
    const repeated = [...firstLineCounts.entries()].find(([, count]) => count >= 2);
    const suspiciousPhrases = ["不是口号", "先露出侧脸", "roulette rose", "Surreal cabaret"];
    const suspiciousHit = rows.find((item) =>
      suspiciousPhrases.some((phrase) =>
        [item.firstLine, item.secondLine, item.family, item.title].some((part) =>
          String(part || "").includes(phrase)
        )
      )
    );
    const alert =
      suspiciousHit || repeated
        ? T("repeat risk detected")
        : T("no repeat alarm");
    const note = suspiciousHit
      ? `${T("Suspicious fixed phrase surfaced again near")} "${suspiciousHit.firstLine || suspiciousHit.title || T("unknown")}".`
      : repeated
        ? `${T("Repeated first line")} "${repeated[0]}" ${T("appeared")} ${repeated[1]} ${T("times in recent seeds.")}`
        : T("Recent seeds do not show an obvious repeated-phrase collapse.");
    return { alert, note };
  }

  function buildLyricsUniverseRotationLaneBridge(history = []) {
    const rows = (Array.isArray(history) ? history : []).slice(-6).reverse();
    const civilizations = rows
      .map((item) => String(item.civilization || item.family || "").trim())
      .filter(Boolean);
    const unique = new Set(civilizations);
    return {
      headline: T("Universe rotation lane"),
      note: `${T("Recent rotations")} ${unique.size}/${Math.max(civilizations.length, 1)} ${T("unique worlds.")}`,
      rows: rows.length
        ? rows.map((item) =>
            `${item.at} · ${item.civilization || item.family || T("unknown world")}`
          )
        : [T("No universe rotation history yet.")]
    };
  }

  function buildLyricsTitleRepetitionMeterBridge(history = []) {
    const rows = Array.isArray(history) ? history : [];
    const counts = new Map();
    rows.forEach((item) => {
      const title = String(item.title || "").trim();
      if (!title) return;
      counts.set(title, (counts.get(title) || 0) + 1);
    });
    const repeated = [...counts.entries()].filter(([, count]) => count >= 2);
    const worst = repeated.sort((a, b) => b[1] - a[1])[0];
    return {
      meter: repeated.length
        ? T("title repetition detected")
        : T("title spread looks healthy"),
      note: worst
        ? `"${worst[0]}" ${T("appeared")} ${worst[1]} ${T("times in recent seeds.")}`
        : T("Recent seed titles do not show obvious collisions.")
    };
  }

  function buildLyricsFallbackPhraseBlacklistCardBridge(history = []) {
    const rows = Array.isArray(history) ? history : [];
    const blacklist = ["不是口号", "先露出侧脸", "roulette rose", "Surreal cabaret", "玉京长歌"];
    const hits = blacklist.filter((phrase) =>
      rows.some((item) =>
        [item.title, item.firstLine, item.secondLine, item.family, item.civilization].some((part) =>
          String(part || "").includes(phrase)
        )
      )
    );
    return {
      headline: T("Fallback phrase blacklist"),
      note: hits.length
        ? `${T("Flagged phrases seen recently:")} ${hits.join(" · ")}`
        : T("No blacklisted fallback phrases were seen in recent seeds.")
    };
  }

  function buildLyricsDiversityTimelineStripBridge(history = []) {
    const rows = (Array.isArray(history) ? history : []).slice(-8);
    if (!rows.length) {
      return {
        headline: T("No diversity timeline yet"),
        chips: [T("Waiting for more lyric generations.")]
      };
    }
    const chips = rows.map((item, index) => {
      const family = String(item.family || item.civilization || T("unknown")).trim();
      const shortFamily = family.length > 18 ? `${family.slice(0, 18)}…` : family;
      return `${index + 1}. ${item.title || T("untitled")} · ${shortFamily}`;
    });
    return {
      headline: T("Diversity timeline strip"),
      chips
    };
  }

  function buildLyricsTitleCollisionWatchlistBridge(history = []) {
    const rows = Array.isArray(history) ? history : [];
    const counts = new Map();
    rows.forEach((item) => {
      const title = String(item.title || "").trim();
      if (!title) return;
      counts.set(title, (counts.get(title) || 0) + 1);
    });
    const collisions = [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1]);
    return {
      headline: T("Title collision watchlist"),
      rows: collisions.length
        ? collisions.map(([title, count]) =>
            `"${title}" ${T("repeated")} ${count} ${T("times")}`
          )
        : [T("No repeated titles in recent history.")]
    };
  }

  function buildLyricsBlacklistHitHistoryBridge(history = []) {
    const rows = Array.isArray(history) ? history : [];
    const blacklist = ["不是口号", "先露出侧脸", "roulette rose", "Surreal cabaret", "玉京长歌"];
    const hits = rows
      .map((item) => {
        const matched = blacklist.filter((phrase) =>
          [item.title, item.firstLine, item.secondLine, item.family, item.civilization].some((part) =>
            String(part || "").includes(phrase)
          )
        );
        if (!matched.length) return null;
        return `${item.at} · ${item.title || T("untitled")} · ${matched.join(" / ")}`;
      })
      .filter(Boolean);
    return {
      headline: T("Blacklist hit history"),
      rows: hits.length
        ? hits
        : [T("No blacklist hits in recent lyric history.")]
    };
  }

  global.buildLyricsFallbackDiversityAuditBridge = buildLyricsFallbackDiversityAuditBridge;
  global.buildLyricsSeedSpreadCardBridge = buildLyricsSeedSpreadCardBridge;
  global.buildLyricsRepeatedPhraseAlarmBridge = buildLyricsRepeatedPhraseAlarmBridge;
  global.buildLyricsUniverseRotationLaneBridge = buildLyricsUniverseRotationLaneBridge;
  global.buildLyricsTitleRepetitionMeterBridge = buildLyricsTitleRepetitionMeterBridge;
  global.buildLyricsFallbackPhraseBlacklistCardBridge = buildLyricsFallbackPhraseBlacklistCardBridge;
  global.buildLyricsDiversityTimelineStripBridge = buildLyricsDiversityTimelineStripBridge;
  global.buildLyricsTitleCollisionWatchlistBridge = buildLyricsTitleCollisionWatchlistBridge;
  global.buildLyricsBlacklistHitHistoryBridge = buildLyricsBlacklistHitHistoryBridge;
})(globalThis);
