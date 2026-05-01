#!/usr/bin/env node
import { Pool } from "pg";

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
const ASSET_BUCKET_NAME = String(
  process.env.CSSOS_ASSET_BUCKET || "cssstudio-gpu-cssos-assets-prod",
).trim();
const CONCURRENCY = Math.max(
  1,
  Number.parseInt(String(process.env.WORK_ASSET_BACKFILL_CONCURRENCY || "2"), 10) || 2,
);
const LIMIT = Math.max(
  0,
  Number.parseInt(String(process.env.WORK_ASSET_BACKFILL_LIMIT || "0"), 10) || 0,
);
const EXECUTE = process.argv.includes("--execute");
const HELP = process.argv.includes("--help") || process.argv.includes("-h");

function printHelp() {
  console.log(`Usage: DATABASE_URL=... node scripts/backfill_work_assets.mjs [--execute]

Backfill canonical work_assets rows from existing user_works metadata.
Dry-run by default.

Environment:
  DATABASE_URL                      Required PostgreSQL connection string
  CSSOS_ASSET_BUCKET                Defaults to cssstudio-gpu-cssos-assets-prod
  WORK_ASSET_BACKFILL_CONCURRENCY   Defaults to 2
  WORK_ASSET_BACKFILL_LIMIT         Defaults to 0 (all candidates)
`);
}

if (HELP) {
  printHelp();
  process.exit(0);
}

if (!DATABASE_URL) {
  console.error("[work-asset-backfill] DATABASE_URL missing");
  printHelp();
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: CONCURRENCY + 2,
});

function sanitizeWorkAssetKey(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) return "";
  if (normalized.includes("\\")) return "";
  if (
    !normalized.startsWith("works/") &&
    !normalized.startsWith("examples/") &&
    !normalized.startsWith("music-sources/")
  ) {
    return "";
  }
  return normalized;
}

function buildWorkAssetBlobUrl(assetKey) {
  const safeAssetKey = sanitizeWorkAssetKey(assetKey);
  if (!safeAssetKey) return "";
  return `/api/work-assets/blob?asset_key=${encodeURIComponent(safeAssetKey)}`;
}

function inferWorkAssetExtension(contentType, fallback = "bin") {
  const safeType = String(contentType || "")
    .trim()
    .toLowerCase()
    .split(";")[0];
  if (safeType === "image/png") return "png";
  if (safeType === "image/jpeg") return "jpg";
  if (safeType === "image/webp") return "webp";
  if (safeType === "image/gif") return "gif";
  if (safeType === "image/svg+xml") return "svg";
  return fallback;
}

function decodeDataUrlAsset(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i);
  if (!match) return null;
  const contentType = String(match[1] || "application/octet-stream").trim();
  const payload = String(match[2] || "").trim();
  if (!payload) return null;
  try {
    return {
      contentType,
      buffer: Buffer.from(payload, "base64"),
    };
  } catch {
    return null;
  }
}

function normalizeStoredWorkAssetReference(runId, value) {
  const safeRunId = String(runId || "").trim();
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("works/")) return raw;
  if (raw.startsWith("runs/")) {
    const match = raw.match(/^runs\/([^/]+)\/(.+)$/i);
    const effectiveRunId = String(match?.[1] || safeRunId || "").trim();
    const artifactPath = String(match?.[2] || "").trim();
    const safePath = artifactPath
      .replace(/^[./\\]+/, "")
      .replace(/\\/g, "/")
      .replace(/^build\//i, "");
    if (!effectiveRunId || !safePath) return raw;
    return `works/${effectiveRunId}/${safePath}`;
  }
  return raw;
}

function tryParsePreviewVideoAssetKey(runId, value) {
  const safeRunId = String(runId || "").trim();
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("works/") || raw.startsWith("runs/")) {
    return normalizeStoredWorkAssetReference(safeRunId, raw);
  }
  try {
    const parsed = new URL(raw, "https://cssstudio.app");
    const embeddedAssetKey = String(
      parsed.searchParams.get("asset_key") || "",
    ).trim();
    if (embeddedAssetKey) {
      return normalizeStoredWorkAssetReference(safeRunId, embeddedAssetKey);
    }
    const pathValue = String(parsed.searchParams.get("path") || "").trim();
    const pathRunId =
      parsed.pathname.match(
        /\/cssapi\/v1\/runs\/([^/]+)\/music-delivery-artifact/i,
      )?.[1] || safeRunId;
    if (pathValue && pathRunId) {
      const safePath = pathValue
        .replace(/^[./\\]+/, "")
        .replace(/\\/g, "/")
        .replace(/^build\//i, "");
      return safePath ? `works/${pathRunId}/${safePath}` : "";
    }
  } catch {
    return "";
  }
  return "";
}

function resolveStoredPreviewVideoReference(runId, storedValue) {
  const safeRunId = String(runId || "").trim();
  const raw = String(storedValue || "").trim();
  if (!raw) {
    return {
      previewVideoUrl: null,
      previewVideoAssetKey: null,
    };
  }
  const assetKey = tryParsePreviewVideoAssetKey(safeRunId, raw);
  if (assetKey && safeRunId) {
    return {
      previewVideoUrl: `/cssapi/v1/runs/${encodeURIComponent(
        safeRunId,
      )}/music-delivery-artifact?asset_key=${encodeURIComponent(assetKey)}`,
      previewVideoAssetKey: assetKey,
    };
  }
  return {
    previewVideoUrl: raw,
    previewVideoAssetKey: null,
  };
}

function tryParseWorkBlobAssetKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("works/") || raw.startsWith("runs/")) {
    return normalizeStoredWorkAssetReference("", raw);
  }
  try {
    const parsed = new URL(raw, "https://cssstudio.app");
    return sanitizeWorkAssetKey(parsed.searchParams.get("asset_key") || "");
  } catch {
    return "";
  }
}

function buildWorkBinaryAssetKey(scopeId, workId, assetType, contentType) {
  const safeScopeId =
    String(scopeId || "").trim() || String(workId || "").trim() || "work";
  const extension = inferWorkAssetExtension(contentType, "bin");
  const fileName = assetType === "cover_image" ? "cover" : "preview-frame";
  return `works/${safeScopeId}/user-works/${workId}/${fileName}.${extension}`;
}

async function getGceAccessToken() {
  const response = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    {
      headers: { "Metadata-Flavor": "Google" },
    },
  );
  if (!response.ok) {
    throw new Error(`gce_token_failed:${response.status}`);
  }
  const payload = await response.json().catch(() => null);
  const token = String(payload?.access_token || "").trim();
  if (!token) {
    throw new Error("gce_token_missing");
  }
  return token;
}

async function uploadBucketObject(objectName, body, contentType) {
  const token = await getGceAccessToken();
  const response = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(
      ASSET_BUCKET_NAME,
    )}/o?uploadType=media&name=${encodeURIComponent(objectName)}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": contentType,
      },
      body: new Uint8Array(body),
    },
  );
  if (!response.ok) {
    throw new Error(`gcs_upload_failed:${response.status}`);
  }
  return response.json().catch(() => null);
}

function classifyCandidate(row) {
  const hasInlineImage =
    String(row.cover_image || "").trim().startsWith("data:") ||
    String(row.preview_image_url || "").trim().startsWith("data:");
  const existingAssets = Number(row.asset_count || 0);
  return hasInlineImage || existingAssets === 0;
}

async function readRows() {
  const sql = `
    SELECT
      w.id,
      w.created_at,
      COALESCE(w.source_run_id, '') AS source_run_id,
      COALESCE(w.cover_image, '') AS cover_image,
      COALESCE(w.preview_image_url, '') AS preview_image_url,
      COALESCE(w.preview_video_url, '') AS preview_video_url,
      COUNT(wa.id)::int AS asset_count
    FROM user_works w
    LEFT JOIN work_assets wa ON wa.work_id = w.id
    GROUP BY w.id
    ORDER BY w.created_at DESC
    ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ""}
  `;
  const { rows } = await pool.query(sql);
  return rows.filter(classifyCandidate);
}

async function persistImageAsset({ row, assetType, rawValue, stats }) {
  const raw = String(rawValue || "").trim();
  if (!raw) return null;
  const existingAssetKey = tryParseWorkBlobAssetKey(raw);
  if (existingAssetKey) {
    stats.reused += 1;
    return {
      persistedValue: buildWorkAssetBlobUrl(existingAssetKey) || raw,
      record: {
        assetType,
        url: buildWorkAssetBlobUrl(existingAssetKey) || raw,
        meta: {
          storage_backend: "gcs",
          asset_key: existingAssetKey,
          source: "existing_asset_key",
        },
      },
    };
  }
  const decoded = decodeDataUrlAsset(raw);
  if (!decoded) {
    stats.passthrough += 1;
    return {
      persistedValue: raw,
      record: {
        assetType,
        url: raw,
        meta: {
          storage_backend: "external_url",
          source: "passthrough_url",
        },
      },
    };
  }
  const scopeId = String(row.source_run_id || "").trim() || String(row.id || "").trim();
  const assetKey = buildWorkBinaryAssetKey(
    scopeId,
    row.id,
    assetType,
    decoded.contentType,
  );
  if (EXECUTE) {
    await uploadBucketObject(assetKey, decoded.buffer, decoded.contentType);
  }
  stats.uploaded += 1;
  stats.uploadedBytes += decoded.buffer.byteLength;
  return {
    persistedValue: buildWorkAssetBlobUrl(assetKey) || raw,
    record: {
      assetType,
      url: buildWorkAssetBlobUrl(assetKey) || raw,
      meta: {
        storage_backend: "gcs",
        asset_key: assetKey,
        content_type: decoded.contentType,
        bytes: decoded.buffer.byteLength,
        source: EXECUTE ? "uploaded_data_url" : "planned_upload_data_url",
      },
    },
  };
}

async function buildAssetPlan(row, stats) {
  const assetRecords = [];
  const updates = {};
  const cover = await persistImageAsset({
    row,
    assetType: "cover_image",
    rawValue: row.cover_image,
    stats,
  });
  if (cover?.record) {
    assetRecords.push(cover.record);
    if (cover.persistedValue && cover.persistedValue !== row.cover_image) {
      updates.cover_image = cover.persistedValue;
    }
  }
  const previewImage = await persistImageAsset({
    row,
    assetType: "preview_image",
    rawValue: row.preview_image_url,
    stats,
  });
  if (previewImage?.record) {
    assetRecords.push(previewImage.record);
    if (
      previewImage.persistedValue &&
      previewImage.persistedValue !== row.preview_image_url
    ) {
      updates.preview_image_url = previewImage.persistedValue;
    }
  }

  const effectiveRunId =
    String(row.source_run_id || "").trim() || String(row.id || "").trim();
  const storedPreviewVideoRef =
    normalizeStoredWorkAssetReference(
      effectiveRunId,
      tryParsePreviewVideoAssetKey(effectiveRunId, row.preview_video_url) ||
        row.preview_video_url,
    ) ||
    null;
  const previewVideoRef = resolveStoredPreviewVideoReference(
    effectiveRunId,
    storedPreviewVideoRef,
  );
  if (storedPreviewVideoRef) {
    assetRecords.push({
      assetType: "preview_video",
      url: previewVideoRef.previewVideoUrl || storedPreviewVideoRef,
      meta: previewVideoRef.previewVideoAssetKey
        ? {
            storage_backend: "run_artifact_resolver",
            asset_key: previewVideoRef.previewVideoAssetKey,
            run_id: effectiveRunId,
            source: "preview_video_asset_key",
          }
        : {
            storage_backend: "external_url",
            source: "passthrough_url",
          },
    });
    stats.previewVideoRegistered += 1;
  }
  return { assetRecords, updates };
}

async function processRow(row, stats) {
  const { assetRecords, updates } = await buildAssetPlan(row, stats);
  stats.plannedAssetRows += assetRecords.length;
  if (!EXECUTE) {
    console.log(
      `[work-asset-backfill] plan work=${row.id} asset_rows=${assetRecords.length} update_cover=${Boolean(
        updates.cover_image,
      )} update_preview=${Boolean(updates.preview_image_url)}`,
    );
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (updates.cover_image || updates.preview_image_url) {
      await client.query(
        `UPDATE user_works
         SET cover_image = COALESCE($2, cover_image),
             preview_image_url = COALESCE($3, preview_image_url),
             updated_at = now()
         WHERE id = $1`,
        [row.id, updates.cover_image || null, updates.preview_image_url || null],
      );
    }
    for (const asset of assetRecords) {
      await client.query(
        `INSERT INTO work_assets (work_id, asset_type, url, meta)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (work_id, asset_type)
         DO UPDATE SET url = EXCLUDED.url, meta = EXCLUDED.meta`,
        [row.id, asset.assetType, asset.url, JSON.stringify(asset.meta || {})],
      );
    }
    await client.query("COMMIT");
    stats.updatedRows += 1;
    console.log(
      `[work-asset-backfill] ok work=${row.id} asset_rows=${assetRecords.length}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const rows = await readRows();
  const stats = {
    scanned: rows.length,
    updatedRows: 0,
    plannedAssetRows: 0,
    uploaded: 0,
    uploadedBytes: 0,
    reused: 0,
    passthrough: 0,
    previewVideoRegistered: 0,
    failed: 0,
  };
  console.log(
    `[work-asset-backfill] start mode=${EXECUTE ? "execute" : "dry-run"} rows=${rows.length} concurrency=${CONCURRENCY}`,
  );
  let index = 0;
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, Math.max(rows.length, 1)) },
    async () => {
      while (index < rows.length) {
        const current = rows[index];
        index += 1;
        try {
          await processRow(current, stats);
        } catch (error) {
          stats.failed += 1;
          console.error(
            `[work-asset-backfill] fail work=${current?.id || "unknown"} ${String(
              error?.message || error,
            )}`,
          );
        }
      }
    },
  );
  await Promise.all(workers);
  console.log(
    JSON.stringify(
      {
        kind: "work_asset_backfill",
        mode: EXECUTE ? "execute" : "dry-run",
        bucket: ASSET_BUCKET_NAME,
        ...stats,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[work-asset-backfill] fatal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
