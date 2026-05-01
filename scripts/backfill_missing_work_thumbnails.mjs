#!/usr/bin/env node
import { Pool } from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DATABASE_URL = process.env.DATABASE_URL || "";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://127.0.0.1:8080";
const RUNS_DIR = process.env.RUNS_DIR || "/srv/cssos/shared/runs";
const CONCURRENCY = Math.max(1, Number.parseInt(process.env.THUMB_BACKFILL_CONCURRENCY || "2", 10) || 2);
const LIMIT = Math.max(0, Number.parseInt(process.env.THUMB_BACKFILL_LIMIT || "0", 10) || 0);

if (!DATABASE_URL) {
  console.error("[thumb-backfill] DATABASE_URL missing");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: CONCURRENCY + 1 });

function lyricLines(input) {
  return String(input || "")
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

async function readRows() {
  const sql = `
    SELECT id, title, COALESCE(lyrics_preview, '') AS lyrics_preview,
           COALESCE(style, '') AS style,
           COALESCE(source_run_id, '') AS source_run_id
    FROM user_works
    WHERE COALESCE(TRIM(cover_image), '') = ''
    ORDER BY created_at DESC
    ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ""}
  `;
  const { rows } = await pool.query(sql);
  return rows;
}

async function updateCover(workId, imageDataUrl) {
  await pool.query(
    `UPDATE user_works
        SET cover_image = $2,
            updated_at = now()
      WHERE id = $1
        AND COALESCE(TRIM(cover_image), '') = ''`,
    [workId, imageDataUrl]
  );
}

async function extractFrameDataUrl(sourceRunId) {
  const safeRunId = String(sourceRunId || "").trim();
  if (!safeRunId) return "";
  const candidates = [
    `${RUNS_DIR}/${safeRunId}/build/final_mv.mp4`,
    `${RUNS_DIR}/${safeRunId}/build/video/video.mp4`
  ];
  for (const input of candidates) {
    try {
      const { stdout } = await execFileAsync(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-ss",
          "1.2",
          "-i",
          input,
          "-frames:v",
          "1",
          "-vf",
          "scale=1024:1024:force_original_aspect_ratio=increase,crop=1024:1024",
          "-f",
          "image2pipe",
          "-vcodec",
          "webp",
          "-"
        ],
        { encoding: "buffer", maxBuffer: 16 * 1024 * 1024 }
      );
      if (stdout?.length) {
        return `data:image/webp;base64,${stdout.toString("base64")}`;
      }
    } catch (_error) {
      // try next candidate
    }
  }
  return "";
}

async function generateThumbnailDataUrl(row) {
  const res = await fetch(`${APP_BASE_URL.replace(/\/+$/, "")}/api/cssmv/thumbnail`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: String(row?.title || "").trim() || "CSS MV",
      subtitle: String(row?.style || "").trim(),
      lyrics: lyricLines(row?.lyrics_preview)
    })
  });
  if (!res.ok) {
    throw new Error(`thumbnail_http_${res.status}`);
  }
  const raw = await res.json().catch(() => null);
  const data = raw?.data && typeof raw.data === "object" ? raw.data : raw;
  const image = String(data?.image_data_url || data?.image_url || "").trim();
  if (!image) {
    throw new Error("thumbnail_empty");
  }
  return image;
}

async function processRow(row, counters) {
  const workId = String(row?.id || "").trim();
  if (!workId) return;
  let image = "";
  let method = "";
  try {
    image = await extractFrameDataUrl(row?.source_run_id);
    method = image ? "frame" : "";
    if (!image) {
      image = await generateThumbnailDataUrl(row);
      method = "generate";
    }
    await updateCover(workId, image);
    counters.success += 1;
    if (method === "frame") counters.frame += 1;
    if (method === "generate") counters.generated += 1;
    console.log(`[thumb-backfill] ok ${counters.done + 1}/${counters.total} ${workId} via ${method}`);
  } catch (error) {
    counters.failed += 1;
    console.error(`[thumb-backfill] fail ${workId}: ${String(error?.message || error)}`);
  } finally {
    counters.done += 1;
  }
}

async function main() {
  const rows = await readRows();
  const counters = {
    total: rows.length,
    done: 0,
    success: 0,
    failed: 0,
    frame: 0,
    generated: 0
  };
  console.log(`[thumb-backfill] start total=${rows.length} concurrency=${CONCURRENCY}`);
  let index = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, rows.length || 1) }, async () => {
    while (index < rows.length) {
      const current = rows[index];
      index += 1;
      await processRow(current, counters);
    }
  });
  await Promise.all(workers);
  console.log(
    `[thumb-backfill] done success=${counters.success} failed=${counters.failed} frame=${counters.frame} generated=${counters.generated}`
  );
}

main()
  .catch((error) => {
    console.error("[thumb-backfill] fatal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
