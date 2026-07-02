#!/usr/bin/env node
// CSSOS 20260701 — Layer 2 回填: 遍历有封面、尚未检测焦点的 user_works,
// 调 face-focal worker(:7898)检测人脸焦点, 写回 cover_focal_x / cover_focal_y。
//
// 运行环境: 需能连 Postgres(DATABASE_URL)+ 能连 worker(FACE_FOCAL_URL)。
// 在 api-vm 上跑最稳(内网直连 DB + 隧道到 worker); 或本机跑走公网。
//
//   DATABASE_URL=... FACE_FOCAL_URL=http://<atelier>:7898 node backfill_cover_focal.mjs
//
// 幂等: 只处理 cover_focal_x IS NULL 的行; 无脸的封面写 x=-1 标记"已检测无脸"(前端回落默认),
//       避免每次重扫。分批 + 限速, 不打爆 worker。
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const FACE_FOCAL_URL = (process.env.FACE_FOCAL_URL || "http://127.0.0.1:7898").replace(/\/$/, "");
const BATCH = Number(process.env.BATCH || 200);
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);

if (!DATABASE_URL) { console.error("missing DATABASE_URL"); process.exit(1); }

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function detect(url) {
  try {
    const r = await fetch(`${FACE_FOCAL_URL}/detect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image_url: url }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.warn("detect failed:", String(e).slice(0, 120));
    return null;
  }
}

async function main() {
  // 健康检查
  try {
    const h = await fetch(`${FACE_FOCAL_URL}/health`, { signal: AbortSignal.timeout(8000) });
    if (!h.ok) throw new Error("worker unhealthy");
    console.log("[backfill] worker OK:", FACE_FOCAL_URL);
  } catch (e) {
    console.error("[backfill] worker 不可达 — 先把 atelier 开机并部署 worker:", String(e).slice(0, 120));
    process.exit(2);
  }

  let total = 0, faces = 0, noface = 0;
  for (;;) {
    const { rows } = await pool.query(
      `SELECT id, cover_image FROM user_works
        WHERE cover_image IS NOT NULL AND cover_image <> '' AND cover_focal_x IS NULL
        ORDER BY created_at DESC
        LIMIT $1`, [BATCH]);
    if (!rows.length) break;

    // 简单并发池
    let i = 0;
    async function worker() {
      while (i < rows.length) {
        const row = rows[i++];
        const det = await detect(row.cover_image);
        if (det && det.found) {
          await pool.query(`UPDATE user_works SET cover_focal_x=$2, cover_focal_y=$3 WHERE id=$1`,
            [row.id, det.focal_x, det.focal_y]);
          faces++;
        } else {
          // 无脸 / 检测失败 → x=-1 标记已扫(前端见 <0 回落默认偏上裁剪), 不再重扫。
          await pool.query(`UPDATE user_works SET cover_focal_x=-1, cover_focal_y=-1 WHERE id=$1`, [row.id]);
          noface++;
        }
        total++;
        if (total % 25 === 0) console.log(`[backfill] ${total} 处理 (脸=${faces} 无脸=${noface})`);
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }
  console.log(`[backfill] 完成: 共 ${total}, 有脸 ${faces}, 无脸 ${noface}`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
