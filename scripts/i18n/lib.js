const fs = require("fs");
const path = require("path");
const vm = require("vm");

function repoRoot() {
  return path.resolve(__dirname, "..", "..");
}

function loadI18nDict() {
  const dictPath = path.join(repoRoot(), "public", "i18n", "dict.js");
  const source = fs.readFileSync(dictPath, "utf8");
  const sandbox = {
    window: {},
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: dictPath });
  const I18N = sandbox.window?.CSSOS_I18N_DICT?.I18N;
  if (!I18N || typeof I18N !== "object") {
    throw new Error("Failed to load window.CSSOS_I18N_DICT.I18N from public/i18n/dict.js");
  }
  return { dictPath, I18N };
}

function stableObject(input) {
  return Object.fromEntries(
    Object.entries(input).sort(([a], [b]) => a.localeCompare(b))
  );
}

function collectLocaleStats(I18N, defaultLocale = "en") {
  const base = I18N[defaultLocale] || {};
  const baseKeys = Object.keys(base).sort();
  const locales = Object.keys(I18N).sort();

  const stats = locales.map((locale) => {
    const table = I18N[locale] || {};
    const keys = Object.keys(table);
    const missingKeys = baseKeys.filter((key) => !(key in table));
    const extraKeys = keys.filter((key) => !(key in base)).sort();
    return {
      locale,
      totalKeys: keys.length,
      missingCount: missingKeys.length,
      missingKeys,
      extraKeys
    };
  });

  return {
    defaultLocale,
    totalBaseKeys: baseKeys.length,
    baseKeys,
    locales,
    stats
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(targetPath, value) {
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

module.exports = {
  collectLocaleStats,
  ensureDir,
  loadI18nDict,
  repoRoot,
  stableObject,
  writeJson
};
