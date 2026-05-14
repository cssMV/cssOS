#!/usr/bin/env node
/**
 * CSSOS_WAVE_122 · Backfill slideshow pools for existing works.
 *
 * Walks works missing a full slideshow pool (< POOL_SIZE frames) and
 * triggers async generation by calling the internal admin endpoint.
 * Idempotent: server short-circuits when pool is already full.
 *
 * Run on api-vm:
 *   ssh api-vm 'cd /srv/cssos/repo && node scripts/backfill-slideshow-pools.mjs'
 *
 * Env knobs:
 *   BACKFILL_LIMIT=50           max works to process this run (default 50)
 *   BACKFILL_ORDER=plays|recent ordering strategy (default plays)
 *   BACKFILL_DRY_RUN=1          just list what would be backfilled
 */
import { Client } from "pg";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }
const LIMIT = Number(process.env.BACKFILL_LIMIT || 50);
const ORDER = String(process.env.BACKFILL_ORDER || "plays");
const DRY = process.env.BACKFILL_DRY_RUN === "1";
const POOL_SIZE = Number(process.env.SLIDESHOW_POOL_SIZE || 30);
const BASE_URL = process.env.CSSOS_BASE_URL || "http://127.0.0.1:3000";
const ADMIN_TOKEN = (process.env.CSSOS_INTERNAL_TOKEN || "").trim();

const client = new Client({ connectionString: DB_URL });
await client.connect();
// No `work_plays` table exists yet — fall back to created_at for ordering
// regardless of mode. When a plays-count table arrives, swap in here.
const orderClause = "w.created_at DESC";
const { rows } = await client.query(`
  SELECT w.id, w.title, w.user_id,
         COALESCE((SELECT COUNT(*) FROM work_assets WHERE work_id = w.id AND asset_type = 'slideshow_frame'), 0) AS have
    FROM user_works w
   WHERE COALESCE((SELECT COUNT(*) FROM work_assets WHERE work_id = w.id AND asset_type = 'slideshow_frame'), 0) < $1
   ORDER BY ${orderClause}
   LIMIT $2`, [POOL_SIZE, LIMIT]);
console.log(`📋 ${rows.length} work(s) need backfill (target ${POOL_SIZE} frames each)`);
if (DRY) {
  rows.forEach((r, i) => console.log(`  ${i + 1}. ${r.id} · ${r.title || "(untitled)"} · have ${r.have}/${POOL_SIZE}`));
  await client.end(); process.exit(0);
}
let done = 0, failed = 0;
for (const r of rows) {
  try {
    const res = await fetch(`${BASE_URL}/api/works/${r.id}/slideshow/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cssos-internal": ADMIN_TOKEN },
      body: JSON.stringify({}),
    });
    const j = await res.json().catch(() => null);
    if (res.ok && j?.ok) {
      console.log(`  ✓ ${r.id} → ${j.status}, pool=${j.pool_size}`);
      done++;
    } else {
      console.warn(`  ✗ ${r.id} → ${res.status} ${j?.code || ""}`);
      failed++;
    }
  } catch (err) { console.warn(`  ✗ ${r.id} → ${err.message}`); failed++; }
}
await client.end();
console.log(`\n✅ ${done}/${rows.length} backfilled  (failed ${failed})`);
