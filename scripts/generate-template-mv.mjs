#!/usr/bin/env node
/*
 * CSSOS_WAVE_220A_TEMPLATE_MV_ORCHESTRATOR 20260519 — Jing
 *
 * Admin-token orchestrator for regenerating the personalization-template
 * MVs (welcome / first_subscriber / birthday). Calls the server-side
 * /api/admin/template-mv/generate endpoint which reads creative_brief
 * from personalization-templates/<trigger>/<lang>.v2/manifest.json and
 * runs the full Suno + Kling pipeline, then writes base.mp3 / base.mp4
 * / cover.png in-place.
 *
 * Usage (run on api-vm where /etc/cssos.env is readable):
 *
 *   # one at a time:
 *   sudo --preserve-env=CSSOS_ADMIN_TOKEN \
 *     bash -c 'source /etc/cssos.env && \
 *       node scripts/generate-template-mv.mjs welcome'
 *
 *   # or all three sequentially:
 *   sudo bash -c 'source /etc/cssos.env && \
 *     for t in welcome first_subscriber birthday; do \
 *       node scripts/generate-template-mv.mjs "$t" || exit 1; \
 *     done'
 *
 * Env required:
 *   CSSOS_ADMIN_TOKEN   — from /etc/cssos.env
 *   CSSOS_BASE_URL      — optional, defaults to https://cssstudio.app
 */

const TRIGGER = process.argv[2];
const LANGUAGE = process.argv[3] || "en";
const ALLOWED = ["welcome", "first_subscriber", "birthday"];

if (!TRIGGER || !ALLOWED.includes(TRIGGER)) {
  console.error(`Usage: node scripts/generate-template-mv.mjs <trigger> [language]`);
  console.error(`  trigger: one of ${ALLOWED.join(" | ")}`);
  console.error(`  language: defaults to "en"`);
  process.exit(64);
}

const TOKEN = (process.env.CSSOS_ADMIN_TOKEN || "").trim();
if (!TOKEN) {
  console.error(
    "CSSOS_ADMIN_TOKEN not set in env.\n" +
    "Try: source /etc/cssos.env && node scripts/generate-template-mv.mjs ...",
  );
  process.exit(78);
}

const BASE = (process.env.CSSOS_BASE_URL || "https://cssstudio.app").replace(/\/+$/, "");
const URL = `${BASE}/api/admin/template-mv/generate`;

const startedAt = Date.now();
console.log(`[gen] trigger=${TRIGGER} language=${LANGUAGE}`);
console.log(`[gen] calling ${URL}`);
console.log(`[gen] this may take 15–25 minutes (Suno + Kling are async)`);

let response;
try {
  response = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Token": TOKEN,
    },
    body: JSON.stringify({ trigger: TRIGGER, language: LANGUAGE }),
    // Suno + Kling combined can run 20+ min, so do not impose a client-side timeout.
  });
} catch (err) {
  console.error("[gen] network error:", err?.message || err);
  process.exit(1);
}

let payload;
try {
  payload = await response.json();
} catch {
  payload = { ok: false, code: "BAD_RESPONSE", status: response.status };
}

const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);

if (!response.ok || !payload.ok) {
  console.error(`[gen] FAILED in ${elapsedMin} min`);
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

console.log(`[gen] ✅ success in ${elapsedMin} min`);
console.log(`[gen] providers:`, payload.providers);
console.log(`[gen] paths:`);
for (const [k, v] of Object.entries(payload.paths || {})) {
  console.log(`        ${k.padEnd(6)} ${v}`);
}
console.log(`[gen] next step: restart cssOS to pick up new assets`);
console.log(`        sudo systemctl restart cssOS.service`);
