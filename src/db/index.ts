import { Pool, PoolClient } from "pg";

let pool: Pool | null = null;

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
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
