import { Pool, PoolClient } from "pg";

let pool: Pool | null = null;

function readPositiveInt(name: string, fallback: number): number {
  const raw = Number.parseInt(String(process.env[name] || "").trim(), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function shouldRetryDbError(error: unknown): boolean {
  const code = String((error as any)?.code || "").trim();
  const message = String((error as any)?.message || "");
  return (
    code === "ECONNRESET" ||
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03" ||
    code === "53300" ||
    /Connection reset by peer/i.test(message) ||
    /terminating connection/i.test(message) ||
    /the database system is starting up/i.test(message)
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDatabaseUrl(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.PGHOST;
  const port = process.env.PGPORT || "5432";
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  if (!host || !database || !user || !password) return null;
  const encoded = encodeURIComponent(password);
  return `postgres://${user}:${encoded}@${host}:${port}/${database}`;
}

export function getDatabaseUrl(): string | null {
  return buildDatabaseUrl();
}

export function getPool(): Pool {
  if (!pool) {
    const url = buildDatabaseUrl();
    if (!url) {
      throw new Error("DATABASE_URL not configured");
    }
    pool = new Pool({
      connectionString: url,
      max: readPositiveInt("CSS_DB_MAX_CONNECTIONS", 5),
      idleTimeoutMillis: readPositiveInt("CSS_DB_IDLE_TIMEOUT_MS", 10000),
      connectionTimeoutMillis: readPositiveInt("CSS_DB_CONNECTION_TIMEOUT_MS", 5000)
    });
  }
  return pool;
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const attempts = readPositiveInt("CSS_NODE_DB_RETRY_ATTEMPTS", 3);
  const baseBackoffMs = readPositiveInt("CSS_NODE_DB_RETRY_BACKOFF_MS", 250);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let client: PoolClient | null = null;
    try {
      client = await getPool().connect();
      return await fn(client);
    } catch (error) {
      lastError = error;
      if (!shouldRetryDbError(error) || attempt >= attempts) {
        throw error;
      }
      await sleep(baseBackoffMs * attempt);
    } finally {
      client?.release();
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError || "database_request_failed"));
}
