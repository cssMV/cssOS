#!/usr/bin/env node

const path = require("path");
const {
  collectLocaleStats,
  loadI18nDict,
  repoRoot,
  stableObject,
  writeJson
} = require("./lib");

function main() {
  const { I18N } = loadI18nDict();
  const root = repoRoot();
  const stats = collectLocaleStats(I18N, "en");
  const generatedAt = new Date().toISOString();

  const registry = {
    generatedAt,
    defaultLocale: stats.defaultLocale,
    totalBaseKeys: stats.totalBaseKeys,
    locales: stats.locales,
    keys: stats.baseKeys
  };

  const missing = {
    generatedAt,
    defaultLocale: stats.defaultLocale,
    totalBaseKeys: stats.totalBaseKeys,
    locales: stableObject(
      Object.fromEntries(
        stats.stats.map((item) => [
          item.locale,
          {
            totalKeys: item.totalKeys,
            missingCount: item.missingCount,
            missingKeys: item.missingKeys,
            extraKeys: item.extraKeys
          }
        ])
      )
    )
  };

  writeJson(path.join(root, "public", "i18n", "registry.json"), registry);
  writeJson(path.join(root, "public", "i18n", "missing.json"), missing);

  const summary = stats.stats
    .map((item) => `${item.locale}: missing=${item.missingCount}, total=${item.totalKeys}`)
    .join("\n");
  process.stdout.write(`${summary}\n`);
}

main();
