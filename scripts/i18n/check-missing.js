#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { collectLocaleStats, loadI18nDict, repoRoot } = require("./lib");

function readBaseline(root) {
  const baselinePath = path.join(root, "scripts", "i18n", "missing-en-baseline.json");
  if (!fs.existsSync(baselinePath)) {
    return { baselinePath, keys: [] };
  }
  const payload = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  return {
    baselinePath,
    keys: Array.isArray(payload?.keys) ? payload.keys.slice().sort() : []
  };
}

function extractHtmlKeys(html) {
  const keys = new Set();
  const patterns = [
    /data-i18n="([^"]+)"/g,
    /data-i18n-placeholder="([^"]+)"/g,
    /data-i18n-aria="([^"]+)"/g,
    /data-i18n-html="([^"]+)"/g
  ];
  for (const pattern of patterns) {
    let match = null;
    while ((match = pattern.exec(html))) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function extractJsKeys(js) {
  const keys = new Set();
  const patterns = [
    /\bt\(\s*["']([^"']+)["']/g,
    /\bsafeT\(\s*["']([^"']+)["']/g
  ];
  for (const pattern of patterns) {
    let match = null;
    while ((match = pattern.exec(js))) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function main() {
  const root = repoRoot();
  const { I18N } = loadI18nDict();
  const stats = collectLocaleStats(I18N, "en");
  const englishKeys = new Set(stats.baseKeys);
  const strictLocales = process.argv
    .slice(2)
    .filter((token) => token.startsWith("--strict-locale="))
    .map((token) => token.slice("--strict-locale=".length))
    .filter(Boolean);

  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const referencedKeys = new Set([
    ...extractHtmlKeys(html),
    ...extractJsKeys(appJs)
  ]);

  const missingEnglishKeys = [...referencedKeys]
    .filter((key) => !englishKeys.has(key))
    .sort();

  const baseline = readBaseline(root);
  const baselineSet = new Set(baseline.keys);
  const newMissingEnglishKeys = missingEnglishKeys.filter((key) => !baselineSet.has(key));

  if (newMissingEnglishKeys.length) {
    process.stderr.write(
      `Missing new en source keys (${newMissingEnglishKeys.length}):\n${newMissingEnglishKeys.join("\n")}\n`
    );
    process.exit(1);
  }

  const strictViolations = stats.stats
    .filter((item) => strictLocales.includes(item.locale) && item.missingCount > 0)
    .map((item) => `${item.locale}: ${item.missingCount} missing keys`);

  if (strictViolations.length) {
    process.stderr.write(
      `Strict locale check failed:\n${strictViolations.join("\n")}\n`
    );
    process.exit(1);
  }

  const localeSummary = stats.stats
    .filter((item) => item.locale !== "en")
    .map((item) => `${item.locale}: missing=${item.missingCount}`)
    .join("\n");

  process.stdout.write(
    [
      "No new missing en source keys.",
      `Baseline debt: ${missingEnglishKeys.length}`,
      `Baseline file: ${path.relative(root, baseline.baselinePath)}`,
      localeSummary
    ].join("\n") + "\n"
  );
}

main();
