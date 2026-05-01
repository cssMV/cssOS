#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";

const execFileAsync = promisify(execFile);

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
const RUNS_DIR = String(process.env.RUNS_DIR || "/srv/cssos/shared/runs").trim();
const SHARED_ASSETS_DIR = String(
  process.env.SHARED_ASSETS_DIR || "/srv/cssos/shared/assets",
).trim();
const RECENT_DAYS = Math.max(
  1,
  Number.parseInt(String(process.env.WORK_ASSET_AUDIT_DAYS || "14"), 10) || 14,
);
const LIMIT = Math.max(
  1,
  Number.parseInt(String(process.env.WORK_ASSET_AUDIT_LIMIT || "40"), 10) || 40,
);

function printHelp() {
  console.log(`Usage: DATABASE_URL=... node scripts/audit_work_asset_reconciliation.mjs

Environment:
  DATABASE_URL              Required PostgreSQL connection string
  RUNS_DIR                  Defaults to /srv/cssos/shared/runs
  SHARED_ASSETS_DIR         Defaults to /srv/cssos/shared/assets
  WORK_ASSET_AUDIT_DAYS     Defaults to 14
  WORK_ASSET_AUDIT_LIMIT    Defaults to 40
`);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

if (!DATABASE_URL) {
  console.error("[work-asset-audit] DATABASE_URL missing");
  printHelp();
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

function classifySourceRunId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "empty";
  if (/^run_[0-9]{8}_/i.test(raw)) return "run_dir_style";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    return "uuid_style";
  }
  return "other";
}

function classifyAssetValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "empty";
  if (raw.startsWith("data:")) return "inline_data_url";
  if (raw.startsWith("works/")) return "durable_asset_key";
  if (raw.startsWith("runs/")) return "legacy_run_asset_key";
  if (raw.includes("/api/shared-assets/blob?")) return "shared_asset_api";
  if (raw.includes("/cssapi/v1/runs/") && raw.includes("asset_key=")) {
    return "run_ticket_with_asset_key";
  }
  if (/^https?:\/\//i.test(raw)) return "http_url";
  if (raw.startsWith("/")) return "absolute_path";
  return "other";
}

function isFileBackedAsset(kind) {
  return new Set([
    "durable_asset_key",
    "legacy_run_asset_key",
    "shared_asset_api",
    "run_ticket_with_asset_key",
    "http_url",
    "absolute_path",
  ]).has(kind);
}

async function safeDu(targetPath) {
  try {
    const { stdout } = await execFileAsync("du", ["-sk", targetPath], {
      encoding: "utf8",
    });
    const kb = Number.parseInt(String(stdout || "").split(/\s+/)[0] || "0", 10);
    return Number.isFinite(kb) ? kb * 1024 : 0;
  } catch {
    return 0;
  }
}

function readExamplesManifest(sharedAssetsDir) {
  try {
    const manifestPath = path.join(sharedAssetsDir, "examples", "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      return { path: manifestPath, exists: false, entries: [] };
    }
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return {
      path: manifestPath,
      exists: true,
      entries: Array.isArray(parsed) ? parsed : [],
    };
  } catch (error) {
    return {
      path: path.join(sharedAssetsDir, "examples", "manifest.json"),
      exists: true,
      entries: [],
      error: String(error?.message || error),
    };
  }
}

function buildFindings(summary) {
  const findings = [];
  if (summary.db.tableCounts.works === 0 && summary.db.tableCounts.userWorks > 0) {
    findings.push(
      "public.works is unused while public.user_works is active; the canonical work metadata path is already user_works.",
    );
  }
  if (summary.db.tableCounts.workAssets === 0) {
    findings.push(
      "public.work_assets is empty, so completed media is not being registered in a canonical asset table.",
    );
  }
  if (summary.db.recentSourceRunIdShapes.uuid_style > 0) {
    findings.push(
      "Most recent user_works.source_run_id values are UUID-style, not run directory ids, so they no longer map directly to /srv/cssos/shared/runs/<run_id>.",
    );
  }
  if (summary.db.recentPreviewCoverage.withPreviewVideo === 0) {
    findings.push(
      "Recent user_works rows have no preview_video_url, so the works center has no durable media pointer to render or play back completed outputs.",
    );
  }
  if (summary.db.recentInlinePreviewRows > 0) {
    findings.push(
      "Recent user_works rows are storing cover and preview images as inline data URLs; that keeps thumbnails in metadata, but it does not create a durable media asset record.",
    );
  }
  if (summary.db.recentRowsMissingLocalRunDir > 0) {
    findings.push(
      "Recent user_works rows do not have matching local run directories on api-vm, so asset recovery cannot rely on the old run.json tree alone.",
    );
  }
  if (summary.storage.examplesManifest.entries.length > 0) {
    findings.push(
      "shared/assets/examples is populated, but it behaves like a loose media gallery and is not linked back to user_works through work_assets.",
    );
  }
  return findings;
}

async function readAudit() {
  const tableCountsSql = `
    SELECT
      (SELECT COUNT(*) FROM works) AS works_count,
      (SELECT COUNT(*) FROM user_works) AS user_works_count,
      (SELECT COUNT(*) FROM work_assets) AS work_assets_count
  `;
  const recentSourceShapeSql = `
    SELECT
      CASE
        WHEN source_run_id ~ '^run_[0-9]{8}_' THEN 'run_dir_style'
        WHEN source_run_id ~ '^[0-9a-f-]{36}$' THEN 'uuid_style'
        WHEN COALESCE(TRIM(source_run_id), '') = '' THEN 'empty'
        ELSE 'other'
      END AS source_shape,
      COUNT(*)::int AS count
    FROM user_works
    WHERE created_at >= now() - ($1::text || ' days')::interval
    GROUP BY 1
    ORDER BY 2 DESC
  `;
  const previewCoverageSql = `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE COALESCE(TRIM(cover_image), '') <> '')::int AS with_cover,
      COUNT(*) FILTER (WHERE COALESCE(TRIM(preview_image_url), '') <> '')::int AS with_preview_image,
      COUNT(*) FILTER (WHERE COALESCE(TRIM(preview_video_url), '') <> '')::int AS with_preview_video
    FROM user_works
    WHERE created_at >= now() - ($1::text || ' days')::interval
  `;
  const recentRowsSql = `
    SELECT
      id,
      title,
      created_at,
      source_run_id,
      COALESCE(cover_image, '') AS cover_image,
      COALESCE(preview_image_url, '') AS preview_image_url,
      COALESCE(preview_video_url, '') AS preview_video_url
    FROM user_works
    WHERE created_at >= now() - ($1::text || ' days')::interval
    ORDER BY created_at DESC
    LIMIT $2
  `;
  const dailyRowsSql = `
    SELECT
      DATE(created_at)::text AS day,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE COALESCE(TRIM(cover_image), '') <> '')::int AS with_cover,
      COUNT(*) FILTER (WHERE COALESCE(TRIM(preview_image_url), '') <> '')::int AS with_preview_image,
      COUNT(*) FILTER (WHERE COALESCE(TRIM(preview_video_url), '') <> '')::int AS with_preview_video
    FROM user_works
    WHERE created_at >= now() - ($1::text || ' days')::interval
    GROUP BY 1
    ORDER BY 1 DESC
  `;

  const [tableCountsRes, sourceShapeRes, coverageRes, recentRowsRes, dailyRowsRes] =
    await Promise.all([
      pool.query(tableCountsSql),
      pool.query(recentSourceShapeSql, [String(RECENT_DAYS)]),
      pool.query(previewCoverageSql, [String(RECENT_DAYS)]),
      pool.query(recentRowsSql, [String(RECENT_DAYS), LIMIT]),
      pool.query(dailyRowsSql, [String(RECENT_DAYS)]),
    ]);

  const tableCountsRow = tableCountsRes.rows[0] || {};
  const sourceShapeCounts = {
    run_dir_style: 0,
    uuid_style: 0,
    other: 0,
    empty: 0,
  };
  for (const row of sourceShapeRes.rows) {
    const key = String(row.source_shape || "other");
    sourceShapeCounts[key] = Number(row.count || 0);
  }

  const coverageRow = coverageRes.rows[0] || {};
  const recentRows = recentRowsRes.rows.map((row) => {
    const sourceRunId = String(row.source_run_id || "").trim();
    const sourceShape = classifySourceRunId(sourceRunId);
    const localRunDirPath = sourceRunId ? path.join(RUNS_DIR, sourceRunId) : "";
    const localRunDirExists = Boolean(localRunDirPath && fs.existsSync(localRunDirPath));
    const coverKind = classifyAssetValue(row.cover_image);
    const previewImageKind = classifyAssetValue(row.preview_image_url);
    const previewVideoKind = classifyAssetValue(row.preview_video_url);
    return {
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      source_run_id: sourceRunId,
      source_run_id_shape: sourceShape,
      local_run_dir_exists: localRunDirExists,
      local_run_dir_path: localRunDirExists ? localRunDirPath : null,
      cover_image_kind: coverKind,
      preview_image_kind: previewImageKind,
      preview_video_kind: previewVideoKind,
      has_any_file_backed_asset:
        isFileBackedAsset(coverKind) ||
        isFileBackedAsset(previewImageKind) ||
        isFileBackedAsset(previewVideoKind),
    };
  });

  const recentInlinePreviewRows = recentRows.filter(
    (row) =>
      row.cover_image_kind === "inline_data_url" ||
      row.preview_image_kind === "inline_data_url",
  ).length;
  const recentRowsMissingLocalRunDir = recentRows.filter(
    (row) => row.source_run_id && !row.local_run_dir_exists,
  ).length;

  const examplesManifest = readExamplesManifest(SHARED_ASSETS_DIR);
  const [runsDirBytes, sharedAssetsBytes] = await Promise.all([
    safeDu(RUNS_DIR),
    safeDu(SHARED_ASSETS_DIR),
  ]);

  const summary = {
    generated_at: new Date().toISOString(),
    config: {
      runs_dir: RUNS_DIR,
      shared_assets_dir: SHARED_ASSETS_DIR,
      recent_days: RECENT_DAYS,
      limit: LIMIT,
    },
    db: {
      tableCounts: {
        works: Number(tableCountsRow.works_count || 0),
        userWorks: Number(tableCountsRow.user_works_count || 0),
        workAssets: Number(tableCountsRow.work_assets_count || 0),
      },
      recentSourceRunIdShapes: sourceShapeCounts,
      recentPreviewCoverage: {
        total: Number(coverageRow.total || 0),
        withCover: Number(coverageRow.with_cover || 0),
        withPreviewImage: Number(coverageRow.with_preview_image || 0),
        withPreviewVideo: Number(coverageRow.with_preview_video || 0),
      },
      dailyPreviewCoverage: dailyRowsRes.rows,
      recentInlinePreviewRows,
      recentRowsMissingLocalRunDir,
      recentRows,
    },
    storage: {
      runsDirBytes,
      sharedAssetsBytes,
      examplesManifest: {
        path: examplesManifest.path,
        exists: examplesManifest.exists,
        count: examplesManifest.entries.length,
        sample: examplesManifest.entries.slice(0, 20),
      },
    },
  };
  summary.findings = buildFindings(summary);
  return summary;
}

async function main() {
  const summary = await readAudit();
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error("[work-asset-audit] fatal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
