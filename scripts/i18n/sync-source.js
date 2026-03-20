#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  loadI18nDict,
  repoRoot,
  stableObject
} = require("./lib");

function parseArgs(argv) {
  const locales = [];
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--locale" && argv[index + 1]) {
      locales.push(argv[index + 1]);
      index += 1;
    } else if (token.startsWith("--locale=")) {
      locales.push(token.slice("--locale=".length));
    }
  }
  return locales.length ? locales : ["en", "zh"];
}

function findObjectLiteral(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Unable to find marker: ${marker}`);
  }

  const braceStart = source.indexOf("{", start + marker.length - 1);
  if (braceStart === -1) {
    throw new Error(`Unable to find object literal for marker: ${marker}`);
  }

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(braceStart, index + 1);
      }
    }
  }

  throw new Error(`Unable to parse object literal for marker: ${marker}`);
}

function extractLocaleEntries(appSource, locale) {
  const literal = findObjectLiteral(appSource, `Object.assign(I18N.${locale}, {`);
  return Function(`"use strict"; return (${literal});`)();
}

function formatDictSource(I18N) {
  const normalized = Object.fromEntries(
    Object.entries(I18N).map(([locale, entries]) => [locale, stableObject(entries || {})])
  );
  const payload = JSON.stringify({ I18N: normalized }, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");

  return [
    "(function () {",
    `  window.CSSOS_I18N_DICT = ${payload};`,
    "})();",
    ""
  ].join("\n");
}

function main() {
  const locales = parseArgs(process.argv);
  const root = repoRoot();
  const appPath = path.join(root, "public", "app.js");
  const appSource = fs.readFileSync(appPath, "utf8");
  const { dictPath, I18N } = loadI18nDict();

  const merged = {};

  for (const locale of locales) {
    const fromApp = extractLocaleEntries(appSource, locale);
    const before = Object.keys(I18N[locale] || {}).length;
    I18N[locale] = {
      ...(I18N[locale] || {}),
      ...fromApp
    };
    I18N[locale] = stableObject(I18N[locale]);
    merged[locale] = {
      before,
      app: Object.keys(fromApp).length,
      after: Object.keys(I18N[locale]).length
    };
  }

  fs.writeFileSync(dictPath, formatDictSource(I18N), "utf8");

  process.stdout.write(`${JSON.stringify({ dictPath, merged }, null, 2)}\n`);
}

main();
