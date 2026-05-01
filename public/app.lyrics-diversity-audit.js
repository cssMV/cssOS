(function attachLyricsDiversityAudit(global) {
  const dashboardCopy = (...args) => global.dashboardCopy(...args);

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
        ? dashboardCopy("healthy spread", "多样性健康")
        : score >= 44
          ? dashboardCopy("mixed spread", "多样性一般")
          : dashboardCopy("collapsed spread", "多样性塌缩");
    return {
      level,
      score,
      note: dashboardCopy(
        `Families ${families.size} · titles ${titles.size} · first lines ${firstLines.size} across ${rows.length} recent seed(s).`,
        `最近 ${rows.length} 次 seed 里，家族 ${families.size} 个 · 标题 ${titles.size} 个 · 首句 ${firstLines.size} 个。`
      )
    };
  }

  function buildLyricsSeedSpreadCardBridge(history = []) {
    const rows = (Array.isArray(history) ? history : []).slice(-6).reverse();
    return {
      headline: dashboardCopy("Recent seed spread", "最近 seed 扩散"),
      rows: rows.length
        ? rows.map((item) =>
            dashboardCopy(
              `${item.at} · ${item.seedTag || "no-tag"} · ${item.family || "unknown family"} · ${item.title || "untitled"}`,
              `${item.at} · ${item.seedTag || "无标记"} · ${item.family || "未知家族"} · ${item.title || "未命名"}`
            )
          )
        : [dashboardCopy("No recent seed spread yet.", "当前还没有最近 seed 扩散记录。")]
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
        ? dashboardCopy("repeat risk detected", "检测到重复风险")
        : dashboardCopy("no repeat alarm", "未发现重复报警");
    const note = suspiciousHit
      ? dashboardCopy(
          `Suspicious fixed phrase surfaced again near "${suspiciousHit.firstLine || suspiciousHit.title || "unknown"}".`,
          `可疑固定短语再次出现，位置接近“${suspiciousHit.firstLine || suspiciousHit.title || "未知"}”。`
        )
      : repeated
        ? dashboardCopy(
            `Repeated first line "${repeated[0]}" appeared ${repeated[1]} times in recent seeds.`,
            `重复首句“${repeated[0]}”在最近 seed 中出现了 ${repeated[1]} 次。`
          )
        : dashboardCopy(
            "Recent seeds do not show an obvious repeated-phrase collapse.",
            "最近几次 seed 暂时没有出现明显的重复句塌缩。"
          );
    return { alert, note };
  }

  function buildLyricsUniverseRotationLaneBridge(history = []) {
    const rows = (Array.isArray(history) ? history : []).slice(-6).reverse();
    const civilizations = rows
      .map((item) => String(item.civilization || item.family || "").trim())
      .filter(Boolean);
    const unique = new Set(civilizations);
    return {
      headline: dashboardCopy("Universe rotation lane", "宇宙轮换轨道"),
      note: dashboardCopy(
        `Recent rotations ${unique.size}/${Math.max(civilizations.length, 1)} unique worlds.`,
        `最近轮换 ${unique.size}/${Math.max(civilizations.length, 1)} 个独特宇宙。`
      ),
      rows: rows.length
        ? rows.map((item) =>
            dashboardCopy(
              `${item.at} · ${item.civilization || item.family || "unknown world"}`,
              `${item.at} · ${item.civilization || item.family || "未知宇宙"}`
            )
          )
        : [dashboardCopy("No universe rotation history yet.", "当前还没有宇宙轮换历史。")]
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
        ? dashboardCopy("title repetition detected", "检测到标题撞车")
        : dashboardCopy("title spread looks healthy", "标题分布看起来健康"),
      note: worst
        ? dashboardCopy(
            `"${worst[0]}" appeared ${worst[1]} times in recent seeds.`,
            `“${worst[0]}”在最近 seed 中出现了 ${worst[1]} 次。`
          )
        : dashboardCopy(
            "Recent seed titles do not show obvious collisions.",
            "最近几次 seed 标题暂时没有明显撞车。"
          )
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
      headline: dashboardCopy("Fallback phrase blacklist", "fallback 短语黑名单"),
      note: hits.length
        ? dashboardCopy(
            `Flagged phrases seen recently: ${hits.join(" · ")}`,
            `最近命中的黑名单短语：${hits.join(" · ")}`
          )
        : dashboardCopy(
            "No blacklisted fallback phrases were seen in recent seeds.",
            "最近几次 seed 没有命中黑名单短语。"
          )
    };
  }

  function buildLyricsDiversityTimelineStripBridge(history = []) {
    const rows = (Array.isArray(history) ? history : []).slice(-8);
    if (!rows.length) {
      return {
        headline: dashboardCopy("No diversity timeline yet", "当前还没有随机性时间线"),
        chips: [dashboardCopy("Waiting for more lyric generations.", "等待更多歌词生成样本。")]
      };
    }
    const chips = rows.map((item, index) => {
      const family = String(item.family || item.civilization || "unknown").trim();
      const shortFamily = family.length > 18 ? `${family.slice(0, 18)}…` : family;
      return dashboardCopy(
        `${index + 1}. ${item.title || "untitled"} · ${shortFamily}`,
        `${index + 1}. ${item.title || "未命名"} · ${shortFamily || "未知"}`
      );
    });
    return {
      headline: dashboardCopy("Diversity timeline strip", "随机性时间线条"),
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
      headline: dashboardCopy("Title collision watchlist", "标题撞车观察名单"),
      rows: collisions.length
        ? collisions.map(([title, count]) =>
            dashboardCopy(`"${title}" repeated ${count} times`, `“${title}”重复了 ${count} 次`)
          )
        : [dashboardCopy("No repeated titles in recent history.", "最近历史里没有重复标题。")]
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
        return dashboardCopy(
          `${item.at} · ${item.title || "untitled"} · ${matched.join(" / ")}`,
          `${item.at} · ${item.title || "未命名"} · ${matched.join(" / ")}`
        );
      })
      .filter(Boolean);
    return {
      headline: dashboardCopy("Blacklist hit history", "黑名单命中历史"),
      rows: hits.length
        ? hits
        : [dashboardCopy("No blacklist hits in recent lyric history.", "最近歌词历史里没有黑名单命中。")]
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
