#!/usr/bin/env node
// CSSOS_I18N_WAVE22 20260508 — Jing
// One-shot batch translator: read existing en/zh strings from public/i18n/dict.js,
// translate the top-N most-used UI strings into ja/ko/es/fr via callLlm, and
// write public/i18n/generated/{locale}.json files.
//
// Usage: node scripts/i18n/translate-batch.mjs [--limit=100] [--locales=ja,ko,es,fr]
//
// In environments without LLM credentials, falls back to seeding the JSON
// files with whatever entries already exist in dict.js for that locale —
// CSSOS_I18N.tr already chains locale → en → zh, so missing keys degrade
// gracefully instead of breaking the UI.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DICT_PATH = path.join(ROOT, "public", "i18n", "dict.js");
const GEN_DIR = path.join(ROOT, "public", "i18n", "generated");

function parseArgs(argv) {
  const out = { limit: 100, locales: ["ja", "ko", "es", "fr"] };
  for (const a of argv.slice(2)) {
    if (a.startsWith("--limit=")) out.limit = parseInt(a.split("=")[1], 10) || 100;
    else if (a.startsWith("--locales=")) out.locales = a.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean);
  }
  return out;
}

function loadDict() {
  const src = fs.readFileSync(DICT_PATH, "utf8");
  const m = src.match(/window\.CSSOS_I18N_DICT\s*=\s*(\{[\s\S]*?\});/);
  if (!m) throw new Error("dict parse failed");
  return new Function("return " + m[1])();
}

async function callLlmTranslate(strings, locale) {
  // Hook point: replace this stub with a real callLlm batch invocation.
  // Returns Map<key, translated>. When no LLM endpoint is reachable we
  // simply return an empty map — caller falls back to existing dict entries.
  const url = process.env.CSSOS_API_BASE
    ? `${process.env.CSSOS_API_BASE}/api/llm/translate-batch`
    : null;
  if (!url) return new Map();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale, sources: strings }),
    });
    if (!r.ok) return new Map();
    const j = await r.json();
    const out = new Map();
    for (const row of j.translations || []) {
      if (row?.key && typeof row.text === "string") out.set(row.key, row.text);
    }
    return out;
  } catch {
    return new Map();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const dict = loadDict().I18N || {};
  const en = dict.en || {};
  const allKeys = Object.keys(en).sort();
  const targetKeys = allKeys.slice(0, args.limit);

  fs.mkdirSync(GEN_DIR, { recursive: true });

  for (const locale of args.locales) {
    const existing = dict[locale] || {};
    const sources = targetKeys.filter((k) => !(k in existing)).map((k) => ({ key: k, text: en[k] }));
    const translations = await callLlmTranslate(sources, locale);

    const entries = { ...existing };
    for (const [k, v] of translations.entries()) entries[k] = v;

    const payload = {
      locale,
      generatedAt: new Date().toISOString(),
      translator: { provider: translations.size ? "callLlm" : "seed-only", mode: "batch" },
      sourceLocale: "en",
      entries,
    };
    const outPath = path.join(GEN_DIR, `${locale}.json`);
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    console.log(`[i18n-batch] ${locale}: ${Object.keys(entries).length} entries (translated ${translations.size}, seeded ${Object.keys(existing).length})`);
  }
}

main().catch((err) => {
  console.error("[i18n-batch] failed:", err);
  process.exit(1);
});
