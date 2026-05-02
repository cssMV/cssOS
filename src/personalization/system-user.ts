// CSSOS_PHASE2_PERSONALIZATION_FOUNDATION 20260502 #268 — Jing
//
// Lookup helper for the cssOS Curator pseudo-user. Cached after the
// first read because it never changes (the migration created it
// idempotently with a fixed id).

import type { Pool, PoolClient, QueryResult } from "pg";
import {
  CSSOS_SYSTEM_USER_ID,
  CSSOS_SYSTEM_USER_EMAIL,
  CSSOS_SYSTEM_USER_DISPLAY_NAME,
} from "./types.js";

type Querier = Pool | PoolClient;

let cached: {
  id: string;
  email: string;
  display_name: string;
} | null = null;

/**
 * Returns the cssOS Curator's identity. The first call hits the
 * database to confirm the row exists (cheap fail-fast — if the
 * migration didn't run, we want to find out at boot, not when the
 * first gift fires). Subsequent calls return the cached value.
 */
export async function getSystemUser(q: Querier) {
  if (cached) return cached;
  const result = (await q.query(
    `SELECT id, email, display_name
       FROM users
      WHERE id = $1`,
    [CSSOS_SYSTEM_USER_ID],
  )) as QueryResult<{ id: string; email: string; display_name: string }>;
  if (!result.rows[0]) {
    throw new Error(
      `cssOS system user (${CSSOS_SYSTEM_USER_ID}) not found in database — ` +
        `migration 018_personalization_engine_foundation.sql may not have run.`,
    );
  }
  cached = {
    id: result.rows[0].id,
    email: result.rows[0].email || CSSOS_SYSTEM_USER_EMAIL,
    display_name:
      result.rows[0].display_name || CSSOS_SYSTEM_USER_DISPLAY_NAME,
  };
  return cached;
}

/**
 * Synchronous accessor for the user_id alone — safe to use without
 * waiting on a DB call because the id is a hardcoded sentinel UUID.
 * Prefer this over getSystemUser() when all you need is the id (e.g.
 * to set owner_user_id on a new MV).
 */
export function getSystemUserIdSync(): string {
  return CSSOS_SYSTEM_USER_ID;
}
