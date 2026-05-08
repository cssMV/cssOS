#!/usr/bin/env node
// CSSOS_I18N_WAVE95 20260508 — Jing
// Print per-locale coverage of priority UI keys vs. the en baseline.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DICT_PATH = path.join(ROOT, "public", "i18n", "dict.js");
const GEN_DIR = path.join(ROOT, "public", "i18n", "generated");

const PRIORITY_PREFIXES = new Set([
  "action", "auth", "billing", "common", "dock", "label", "lang", "language",
  "login", "logo", "mic", "mv", "notifications", "overlay", "panel", "passkey",
  "profile", "settings", "shot", "status", "toast", "track", "theme", "watch",
  "works", "about",
]);

function loadDict() {
  const src = fs.readFileSync(DICT_PATH, "utf8");
  const m = src.match(/window\.CSSOS_I18N_DICT\s*=\s*(\{[\s\S]*?\});/);
  if (!m) throw new Error("dict parse failed");
  return new Function("return " + m[1])();
}

function loadLocale(locale) {
  const p = path.join(GEN_DIR, `${locale}.json`);
  if (!fs.existsSync(p)) return { entries: {} };
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const dict = loadDict().I18N || {};
const en = dict.en || {};
const enKeys = Object.keys(en);
const priorityKeys = enKeys.filter((k) => PRIORITY_PREFIXES.has(k.split(".")[0]));

const locales = ["zh", "ja", "ko", "es", "fr"];
console.log(`en baseline: ${enKeys.length} keys (${priorityKeys.length} priority)`);
console.log("");
console.log("locale  total  pri-cov  pri-pct  missing-keys");
for (const locale of locales) {
  const seed = dict[locale] || {};
  const gen = loadLocale(locale).entries || {};
  const merged = { ...seed, ...gen };
  const have = Object.keys(merged).filter((k) => typeof merged[k] === "string" && merged[k].trim() && merged[k] !== en[k]);
  const priCov = priorityKeys.filter((k) => merged[k] && merged[k] !== en[k] && merged[k].trim()).length;
  const pct = ((priCov / priorityKeys.length) * 100).toFixed(1);
  const missingFromEn = enKeys.filter((k) => !(k in merged)).length;
  console.log(`${locale.padEnd(6)} ${String(have.length).padEnd(6)} ${String(priCov).padEnd(8)} ${pct.padStart(5)}%   ${missingFromEn}`);
}
