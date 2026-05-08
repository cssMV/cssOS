#!/usr/bin/env node
/* CSSOS_PERSON_MV_WAVE58 20260508 — Jing
 *
 * Drives the bulk seed expansion against a running cssOS server.
 * Reads data/person-candidates.csv, ships it to the admin endpoint
 * /api/admin/person-mv/persons/bulk-generate, and prints the summary.
 *
 * Resumable: the server skips persons already present (by slugified
 * name_en). Re-running picks up where it left off.
 *
 * Rate limits live server-side: ~5 LLM calls/sec, 1 wiki fetch/sec
 * (Wikimedia REST etiquette). Large batches (>25) are fire-and-forget
 * on the server; this client returns immediately with a `started:true`
 * acknowledgement.
 *
 * Usage:
 *   CSSOS_ADMIN_TOKEN=xxx node scripts/generate-bulk-persons.mjs \
 *       [--csv data/person-candidates.csv] [--limit 50] \
 *       [--base http://localhost:8787]
 */
import fs from "node:fs";
import path from "node:path";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const csvPath = arg("csv", path.join(process.cwd(), "data", "person-candidates.csv"));
const limit = Number(arg("limit", "20"));
const base = arg("base", process.env.CSSOS_BASE_URL || "http://localhost:8787");
const token = process.env.CSSOS_ADMIN_TOKEN || "";

if (!fs.existsSync(csvPath)) {
  console.error(`[bulk-persons] CSV not found: ${csvPath}`);
  process.exit(1);
}
const csv = fs.readFileSync(csvPath, "utf8");

(async () => {
  const url = `${base.replace(/\/$/, "")}/api/admin/person-mv/persons/bulk-generate`;
  console.log(`[bulk-persons] POST ${url} (limit=${limit}, csv=${csvPath})`);
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
    },
    body: JSON.stringify({ csv, limit }),
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  console.log(JSON.stringify(json, null, 2));
  if (!r.ok || json.ok === false) process.exit(2);
})().catch((err) => {
  console.error("[bulk-persons] failed:", err);
  process.exit(3);
});
