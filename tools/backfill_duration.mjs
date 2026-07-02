#!/usr/bin/env node
// CSSOS 20260701 — work_card_duration 铁律: 补齐缺 duration_secs 的作品(每卡必显时长)。
// 来源优先: work_assets.audio_track_1.url → preview_audio_url。ffprobe 读远程 URL 取时长写回。
// 幂等: 只处理 duration_secs IS NULL/<=0。ffprobe 失败/无音源 → 跳过(卡片仍无时长, 下次可重试)。
import pg from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);

async function probe(url) {
  try {
    const { stdout } = await exec("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", url,
    ], { timeout: 45000 });
    const d = parseFloat(String(stdout).trim());
    return isFinite(d) && d > 0 ? d : null;
  } catch { return null; }
}

async function main() {
  const { rows } = await pool.query(`
    SELECT w.id,
           COALESCE(a.url, w.preview_audio_url) AS audio
      FROM user_works w
      LEFT JOIN work_assets a ON a.work_id=w.id AND a.asset_type='audio_track_1'
     WHERE (w.duration_secs IS NULL OR w.duration_secs<=0)
       AND COALESCE(a.url, w.preview_audio_url) IS NOT NULL
       AND COALESCE(a.url, w.preview_audio_url) <> ''`);
  console.log(`[dur] 待补 ${rows.length}`);
  let done = 0, ok = 0, i = 0;
  async function worker() {
    while (i < rows.length) {
      const r = rows[i++];
      const d = await probe(r.audio);
      if (d) { await pool.query(`UPDATE user_works SET duration_secs=$2 WHERE id=$1`, [r.id, Math.round(d)]); ok++; }
      done++;
      if (done % 20 === 0) console.log(`[dur] ${done}/${rows.length} (补上 ${ok})`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`[dur] 完成: 处理 ${done}, 补上 ${ok}`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
