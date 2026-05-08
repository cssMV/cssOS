#!/usr/bin/env node
// CSSOS_I18N_WAVE95 20260508 — Jing
// Real LLM batch translator: read en strings from public/i18n/dict.js,
// translate up to N priority UI strings into ja/ko/es/fr via OpenAI
// (gpt-4o-mini), and merge into public/i18n/generated/{locale}.json.
//
// Manual/seed translations from prior waves are PRESERVED — never overwritten.
// Set OPENAI_API_KEY (and optionally OPENAI_MODEL, OPENAI_BASE_URL) in env.
// Without an API key, falls back to seed-only behaviour.
//
// Usage:
//   node scripts/i18n/translate-batch.mjs [--limit=250] [--locales=ja,ko,es,fr] [--batch=40]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DICT_PATH = path.join(ROOT, "public", "i18n", "dict.js");
const GEN_DIR = path.join(ROOT, "public", "i18n", "generated");

// Load .env.local if present so OPENAI_API_KEY is available without exporting.
function loadEnvLocal() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
}
loadEnvLocal();

const LOCALE_NAMES = {
  ja: "Japanese",
  ko: "Korean",
  es: "Spanish (Spain)",
  fr: "French (France)",
};

// Priority prefixes — most-visible UI surfaces.
const PRIORITY_PREFIXES = new Set([
  "action", "auth", "billing", "common", "dock", "label", "lang", "language",
  "login", "logo", "mic", "mv", "notifications", "overlay", "panel", "passkey",
  "profile", "settings", "shot", "status", "toast", "track", "theme", "watch",
  "works", "about",
]);

function parseArgs(argv) {
  const out = { limit: 250, locales: ["ja", "ko", "es", "fr"], batch: 40 };
  for (const a of argv.slice(2)) {
    if (a.startsWith("--limit=")) out.limit = parseInt(a.split("=")[1], 10) || 250;
    else if (a.startsWith("--locales=")) out.locales = a.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith("--batch=")) out.batch = parseInt(a.split("=")[1], 10) || 40;
  }
  return out;
}

function loadDict() {
  const src = fs.readFileSync(DICT_PATH, "utf8");
  const m = src.match(/window\.CSSOS_I18N_DICT\s*=\s*(\{[\s\S]*?\});/);
  if (!m) throw new Error("dict parse failed");
  return new Function("return " + m[1])();
}

function loadExistingLocale(locale) {
  const p = path.join(GEN_DIR, `${locale}.json`);
  if (!fs.existsSync(p)) return { entries: {} };
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return { entries: {} }; }
}

function isStubValue(v, enValue) {
  // Treat null/undefined/empty/identical-to-en as stub (safe to overwrite).
  if (v == null) return true;
  if (typeof v !== "string") return true;
  if (!v.trim()) return true;
  if (v === enValue) return true;
  return false;
}

async function openaiTranslateBatch(pairs, locale) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return new Map();
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const inputObj = Object.fromEntries(pairs.map(([k, v]) => [k, v]));
  const sys = "You are a professional UI translator. Translate JSON values from English into the requested target language. Preserve placeholders like {name}, {count}, {spell} EXACTLY (do not translate placeholder names). Keep translations natural, concise, and product-UI appropriate. Output STRICT JSON object with the same keys, values translated. No commentary.";
  const user = `Target language: ${LOCALE_NAMES[locale] || locale}\n\nJSON to translate:\n${JSON.stringify(inputObj)}`;
  const body = {
    model,
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  };
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      console.warn(`[i18n-batch] ${locale} HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return new Map();
    }
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const out = new Map();
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim()) out.set(k, v);
    }
    return out;
  } catch (err) {
    console.warn(`[i18n-batch] ${locale} call failed:`, err?.message || err);
    return new Map();
  }
}

function pickPriorityKeys(en, limit) {
  const all = Object.keys(en).sort();
  const priority = all.filter((k) => PRIORITY_PREFIXES.has(k.split(".")[0]));
  return priority.slice(0, limit);
}

async function main() {
  const args = parseArgs(process.argv);
  const dict = loadDict().I18N || {};
  const en = dict.en || {};
  const targetKeys = pickPriorityKeys(en, args.limit);
  const hasKey = !!process.env.OPENAI_API_KEY;

  fs.mkdirSync(GEN_DIR, { recursive: true });
  console.log(`[i18n-batch] selected ${targetKeys.length} priority keys; provider=${hasKey ? "openai" : "seed-only"}`);

  for (const locale of args.locales) {
    const seedDict = dict[locale] || {};
    const existing = loadExistingLocale(locale);
    const merged = { ...seedDict, ...(existing.entries || {}) };

    // Determine which keys still need translation.
    const todo = targetKeys.filter((k) => isStubValue(merged[k], en[k]));
    let translatedCount = 0;
    for (let i = 0; i < todo.length; i += args.batch) {
      const batch = todo.slice(i, i + args.batch).map((k) => [k, en[k]]);
      const got = await openaiTranslateBatch(batch, locale);
      for (const [k, v] of got.entries()) {
        if (isStubValue(merged[k], en[k])) {
          merged[k] = v;
          translatedCount++;
        }
      }
      console.log(`[i18n-batch] ${locale} batch ${Math.floor(i / args.batch) + 1}/${Math.ceil(todo.length / args.batch)} → +${got.size}`);
    }

    const payload = {
      locale,
      generatedAt: new Date().toISOString(),
      translator: { provider: hasKey ? "openai" : "seed-only", mode: "batch", model: process.env.OPENAI_MODEL || "gpt-4o-mini" },
      sourceLocale: "en",
      stats: {
        totalKeys: Object.keys(merged).length,
        priorityKeys: targetKeys.length,
        translatedThisRun: translatedCount,
        priorityCoverage: targetKeys.filter((k) => !isStubValue(merged[k], en[k])).length,
      },
      entries: Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]])),
    };
    const outPath = path.join(GEN_DIR, `${locale}.json`);
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    console.log(`[i18n-batch] ${locale}: total=${payload.stats.totalKeys} priorityCoverage=${payload.stats.priorityCoverage}/${targetKeys.length} (+${translatedCount} this run)`);
  }
}

main().catch((err) => {
  console.error("[i18n-batch] failed:", err);
  process.exit(1);
});
