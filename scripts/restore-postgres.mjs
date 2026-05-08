#!/usr/bin/env node
/* CSSOS Wave 102 — restore from R2 dump.
 *
 * Usage:
 *   node scripts/restore-postgres.mjs            # restore latest into DATABASE_URL
 *   node scripts/restore-postgres.mjs --key=backups/postgres/.../cssos-...dump
 *   node scripts/restore-postgres.mjs --target-db=postgres://user:pw@host/db
 *   node scripts/restore-postgres.mjs --list     # list last 10 backups, exit
 *
 * Downloads dump from R2, then `pg_restore --clean --if-exists` into target.
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const DATABASE_URL = process.env.DATABASE_URL || "";
const PG_RESTORE_BIN = process.env.PG_RESTORE_BIN || "pg_restore";
const BUCKET = process.env.R2_BUCKET || "";
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const wantList = process.argv.includes("--list");
const explicitKey = arg("key");
const targetDb = arg("target-db") || DATABASE_URL;

function fail(msg, code = 1) { console.error(`[restore-postgres] ${msg}`); process.exit(code); }
if (!DATABASE_URL) fail("DATABASE_URL missing (needed to read backup log)");
if (!BUCKET || !ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) fail("R2 env missing");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
});

async function listRecent() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  try {
    const r = await pool.query(
      `SELECT id, r2_key, size_bytes, status, created_at
         FROM db_backups
         ORDER BY created_at DESC
         LIMIT 10`,
    );
    return r.rows;
  } finally { await pool.end().catch(() => {}); }
}

async function main() {
  const recent = await listRecent();
  if (wantList) {
    console.log(JSON.stringify(recent, null, 2));
    return;
  }
  const key = explicitKey || recent.find((r) => r.status === "ok")?.r2_key;
  if (!key) fail("no backup key (pass --key=... or ensure db_backups has an ok row)");

  const localPath = path.join(tmpdir(), `cssos-restore-${Date.now()}.dump`);
  console.log(`[restore-postgres] downloading r2://${BUCKET}/${key} → ${localPath}`);
  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!obj.Body) fail("empty body from R2");
  await pipeline(obj.Body, createWriteStream(localPath));

  console.log(`[restore-postgres] running ${PG_RESTORE_BIN} → ${targetDb.replace(/:[^@]+@/, ":***@")}`);
  const args = ["--clean", "--if-exists", "--no-owner", "--no-acl", "-d", targetDb, localPath];
  const child = spawn(PG_RESTORE_BIN, args, { stdio: "inherit" });
  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`pg_restore exit ${code}`)));
  });
  console.log("[restore-postgres] ok");
}

main().catch((err) => fail(String(err?.message || err), 2));
