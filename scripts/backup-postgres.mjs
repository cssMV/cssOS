#!/usr/bin/env node
/* CSSOS Wave 102 — pg_dump → R2 daily backup.
 *
 * Spawns `pg_dump --format=custom --no-owner --no-acl --compress=9` against
 * DATABASE_URL, streams binary output to R2 via @aws-sdk/lib-storage Upload,
 * and logs size + sha256 to the db_backups table.
 *
 * Env:
 *   DATABASE_URL          — pg connection string (required)
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (required)
 *   PG_DUMP_BIN           — override path to pg_dump (default: pg_dump on PATH)
 *
 * Exit codes: 0 ok, 1 config/runtime error, 2 pg_dump failed.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { PassThrough } from "node:stream";
import { Pool } from "pg";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const DATABASE_URL = process.env.DATABASE_URL || "";
const PG_DUMP_BIN = process.env.PG_DUMP_BIN || "pg_dump";
const BUCKET = process.env.R2_BUCKET || "";
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";

function fail(msg, code = 1) {
  console.error(`[backup-postgres] ${msg}`);
  process.exit(code);
}

if (!DATABASE_URL) fail("DATABASE_URL missing");
if (!BUCKET || !ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  fail("R2 env (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET) missing");
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
});

function todayKey() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const iso = now.toISOString().replace(/[:.]/g, "-");
  return `backups/postgres/${yyyy}-${mm}-${dd}/cssos-${iso}.dump`;
}

async function logResult(row) {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  try {
    await pool.query(
      `INSERT INTO db_backups (r2_key, size_bytes, sha256, duration_ms, status, error)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [row.r2_key, row.size_bytes, row.sha256, row.duration_ms, row.status, row.error || null],
    );
  } catch (err) {
    console.error("[backup-postgres] log INSERT failed:", err?.message || err);
  } finally {
    await pool.end().catch(() => {});
  }
}

export async function pruneOldBackups(retentionDays = 30) {
  const cutoff = Date.now() - retentionDays * 24 * 3600 * 1000;
  let ContinuationToken;
  let deleted = 0;
  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: "backups/postgres/",
      ContinuationToken,
    }));
    const old = (list.Contents || []).filter((o) => o.LastModified && o.LastModified.getTime() < cutoff);
    if (old.length) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: old.map((o) => ({ Key: o.Key })) },
      }));
      deleted += old.length;
    }
    ContinuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return deleted;
}

async function runBackup() {
  const key = todayKey();
  const started = Date.now();
  const passthrough = new PassThrough();
  const hasher = createHash("sha256");
  let bytes = 0;

  passthrough.on("data", (chunk) => {
    bytes += chunk.length;
    hasher.update(chunk);
  });

  const args = [
    "--format=custom",
    "--no-owner",
    "--no-acl",
    "--compress=9",
    "-d", DATABASE_URL,
  ];
  console.log(`[backup-postgres] spawning ${PG_DUMP_BIN} → r2://${BUCKET}/${key}`);
  const dump = spawn(PG_DUMP_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });

  dump.stderr.on("data", (b) => process.stderr.write(`[pg_dump] ${b}`));
  dump.stdout.pipe(passthrough);

  const dumpExit = new Promise((resolve, reject) => {
    dump.on("error", reject);
    dump.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump exited code=${code} signal=${signal}`));
    });
  });

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: passthrough,
      ContentType: "application/octet-stream",
    },
    queueSize: 4,
    partSize: 16 * 1024 * 1024,
  });

  try {
    await Promise.all([dumpExit, upload.done()]);
  } catch (err) {
    const duration = Date.now() - started;
    await logResult({
      r2_key: key,
      size_bytes: bytes || null,
      sha256: null,
      duration_ms: duration,
      status: "failed",
      error: String(err?.message || err),
    });
    fail(`backup failed: ${err?.message || err}`, 2);
  }

  const duration = Date.now() - started;
  const sha = hasher.digest("hex");
  console.log(`[backup-postgres] ok size=${bytes}B sha256=${sha} dur=${duration}ms`);
  await logResult({
    r2_key: key,
    size_bytes: bytes,
    sha256: sha,
    duration_ms: duration,
    status: "ok",
  });

  try {
    const pruned = await pruneOldBackups(30);
    if (pruned > 0) console.log(`[backup-postgres] pruned ${pruned} backup(s) older than 30d`);
  } catch (err) {
    console.warn(`[backup-postgres] prune warn: ${err?.message || err}`);
  }
}

runBackup().catch((err) => fail(String(err?.message || err)));
