#!/usr/bin/env node
/* CSSOS Wave 102 — backup/restore roundtrip smoke test.
 *
 * Requires DATABASE_URL pointing to a postgres SUPERUSER on a host where
 * we can `CREATE DATABASE` / `DROP DATABASE`. Will not touch the cssos
 * production DB — uses a temp DB named cssos_backup_smoke_<ts>.
 *
 * Steps:
 *   1. CREATE DATABASE temp
 *   2. CREATE TABLE smoke (id, msg) + INSERT 1 row
 *   3. pg_dump temp (custom format) → /tmp/file.dump
 *   4. DROP DATABASE temp; CREATE DATABASE temp
 *   5. pg_restore --clean --if-exists -d temp file.dump
 *   6. SELECT — verify row present
 *   7. DROP DATABASE temp
 */
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { unlink } from "node:fs/promises";
import { Pool } from "pg";

const ADMIN_URL = process.env.DATABASE_URL || "";
if (!ADMIN_URL) { console.error("DATABASE_URL missing"); process.exit(1); }

const TMP_DB = `cssos_backup_smoke_${Date.now()}`;
const dumpPath = path.join(tmpdir(), `${TMP_DB}.dump`);

function tmpUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${TMP_DB}`;
  return u.toString();
}
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, args, { stdio: "inherit", ...opts });
    c.on("error", reject);
    c.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`)));
  });
}

async function withAdmin(fn) {
  const pool = new Pool({ connectionString: ADMIN_URL, max: 1 });
  try { return await fn(pool); } finally { await pool.end().catch(() => {}); }
}

async function main() {
  console.log(`[smoke] creating ${TMP_DB}`);
  await withAdmin((p) => p.query(`CREATE DATABASE ${TMP_DB}`));

  const tmp = new Pool({ connectionString: tmpUrl(), max: 1 });
  await tmp.query(`CREATE TABLE smoke (id INT PRIMARY KEY, msg TEXT)`);
  await tmp.query(`INSERT INTO smoke (id, msg) VALUES (1, 'hello-roundtrip')`);
  await tmp.end();

  console.log(`[smoke] pg_dump → ${dumpPath}`);
  await run("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "-d", tmpUrl(), "-f", dumpPath]);

  console.log("[smoke] drop + recreate db");
  await withAdmin(async (p) => {
    await p.query(`DROP DATABASE ${TMP_DB}`);
    await p.query(`CREATE DATABASE ${TMP_DB}`);
  });

  console.log("[smoke] pg_restore");
  await run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-acl", "-d", tmpUrl(), dumpPath]);

  const tmp2 = new Pool({ connectionString: tmpUrl(), max: 1 });
  const r = await tmp2.query(`SELECT msg FROM smoke WHERE id=1`);
  await tmp2.end();
  if (r.rows[0]?.msg !== "hello-roundtrip") {
    console.error("[smoke] FAIL — row missing or wrong:", r.rows);
    process.exit(2);
  }
  console.log("[smoke] row present — restore roundtrip OK");

  await withAdmin((p) => p.query(`DROP DATABASE ${TMP_DB}`));
  await unlink(dumpPath).catch(() => {});
  console.log("[smoke] cleanup ok");
}

main().catch(async (err) => {
  console.error("[smoke] failed:", err?.message || err);
  await withAdmin((p) => p.query(`DROP DATABASE IF EXISTS ${TMP_DB}`)).catch(() => {});
  process.exit(2);
});
