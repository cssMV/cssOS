#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  collectLocaleStats,
  ensureDir,
  loadI18nDict,
  repoRoot,
  stableObject,
  writeJson
} = require("./lib");

function parseArgs(argv) {
  const args = { locales: [], force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--locale" && argv[i + 1]) {
      args.locales.push(argv[i + 1]);
      i += 1;
    } else if (token === "--all") {
      args.all = true;
    } else if (token === "--force") {
      args.force = true;
    }
  }
  return args;
}

function getTargetLocales(allLocales, args) {
  if (args.all) {
    return allLocales.filter((locale) => locale !== "en");
  }
  if (args.locales.length) {
    return [...new Set(args.locales)].filter((locale) => locale !== "en");
  }
  return [];
}

function translateEntriesStub(locale, entries) {
  const out = {};
  for (const [key, english] of Object.entries(entries)) {
    out[key] = english;
  }
  return out;
}

function readExistingGenerated(locale) {
  const filePath = path.join(repoRoot(), "public", "i18n", "generated", `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    return { filePath, entries: {} };
  }
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return {
    filePath,
    entries: payload?.entries && typeof payload.entries === "object" ? payload.entries : {}
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { I18N } = loadI18nDict();
  const stats = collectLocaleStats(I18N, "en");
  const targets = getTargetLocales(stats.locales, args);

  if (!targets.length) {
    process.stdout.write("No target locales selected.\n");
    process.exit(0);
  }

  const root = repoRoot();
  ensureDir(path.join(root, "public", "i18n", "generated"));

  for (const locale of targets) {
    const localeStats = stats.stats.find((item) => item.locale === locale);
    if (!localeStats) continue;
    const existing = readExistingGenerated(locale);
    const english = I18N.en || {};
    const deltaKeys = localeStats.missingKeys.filter(
      (key) => args.force || !(key in existing.entries)
    );
    const sourceEntries = Object.fromEntries(deltaKeys.map((key) => [key, english[key]]));
    const translatedEntries = translateEntriesStub(locale, sourceEntries);

    const payload = {
      locale,
      generatedAt: new Date().toISOString(),
      translator: {
        provider: "stub",
        mode: "skeleton"
      },
      sourceLocale: "en",
      entries: stableObject({
        ...existing.entries,
        ...translatedEntries
      })
    };

    writeJson(existing.filePath, payload);
    process.stdout.write(
      `${locale}: wrote ${Object.keys(translatedEntries).length} generated entries to ${path.relative(root, existing.filePath)}\n`
    );
  }
}

main();
