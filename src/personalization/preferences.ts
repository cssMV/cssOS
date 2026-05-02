// CSSOS_PHASE2_PERSONALIZATION_FOUNDATION 20260502 #268 — Jing
//
// Helpers for reading + upserting user_preferences. The personalization
// engine joins users + user_preferences into a GiftTargetSnapshot
// before invoking any handler so triggers don't have to know about
// the prefs table directly.

import type { Pool, PoolClient, QueryResult } from "pg";
import type { GiftTargetSnapshot } from "./types.js";

type Querier = Pool | PoolClient;

interface PrefsRow {
  user_id: string;
  birthday: string | null;
  birthday_timezone: string | null;
  birthday_opt_in: boolean;
  gift_opt_out: boolean;
  quiet_hours_start_local: string | null;
  quiet_hours_end_local: string | null;
  accepted_personalization_terms_at: string | null;
  preferred_gift_language: string | null;
  preferred_gift_display_name: string | null;
}

interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  locale: string | null;
}

/**
 * Resolve a user into a full GiftTargetSnapshot, joining the users
 * row with their personalization preferences. If the user has no
 * preferences row yet, falls back to safe defaults (no birthday, no
 * opt-out, default quiet hours from the table defaults).
 */
export async function buildTargetSnapshot(
  q: Querier,
  userId: string,
): Promise<GiftTargetSnapshot | null> {
  const result = (await q.query(
    `SELECT
       u.id, u.email, u.display_name, u.locale,
       p.birthday, p.birthday_timezone, p.birthday_opt_in,
       p.gift_opt_out,
       p.quiet_hours_start_local, p.quiet_hours_end_local,
       p.preferred_gift_language, p.preferred_gift_display_name,
       p.accepted_personalization_terms_at
       FROM users u
  LEFT JOIN user_preferences p ON p.user_id = u.id
      WHERE u.id = $1`,
    [userId],
  )) as QueryResult<UserRow & Partial<PrefsRow>>;
  const row = result.rows[0];
  if (!row) return null;
  return {
    user_id: row.id,
    email: row.email,
    display_name: row.display_name,
    locale: row.locale,
    preferred_gift_display_name: row.preferred_gift_display_name || null,
    preferred_gift_language: row.preferred_gift_language || null,
    birthday: row.birthday || null,
    birthday_timezone: row.birthday_timezone || null,
    birthday_opt_in: row.birthday_opt_in === true,
    gift_opt_out: row.gift_opt_out === true,
    quiet_hours_start_local: row.quiet_hours_start_local || null,
    quiet_hours_end_local: row.quiet_hours_end_local || null,
  };
}

/**
 * Upsert a user's personalization preferences. Only the keys
 * provided in `patch` are written; everything else is preserved.
 * The first call for a user implicitly creates their prefs row.
 */
export async function upsertUserPreferences(
  q: Querier,
  userId: string,
  patch: Partial<{
    birthday: string | null;
    birthday_timezone: string | null;
    birthday_opt_in: boolean;
    gift_opt_out: boolean;
    quiet_hours_start_local: string | null;
    quiet_hours_end_local: string | null;
    accepted_personalization_terms_at: string | null;
    preferred_gift_language: string | null;
    preferred_gift_display_name: string | null;
  }>,
): Promise<void> {
  const cols = Object.keys(patch).filter(
    (k) => (patch as Record<string, unknown>)[k] !== undefined,
  );
  if (!cols.length) {
    // No-op upsert: just ensure the row exists.
    await q.query(
      `INSERT INTO user_preferences (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
    return;
  }
  const placeholders = cols.map((_, i) => `$${i + 2}`);
  const setClause = cols.map((c, i) => `${c} = $${i + 2}`).join(", ");
  const values = cols.map((c) => (patch as Record<string, unknown>)[c]);
  await q.query(
    `INSERT INTO user_preferences (user_id, ${cols.join(", ")})
       VALUES ($1, ${placeholders.join(", ")})
       ON CONFLICT (user_id) DO UPDATE
         SET ${setClause}, updated_at = now()`,
    [userId, ...values],
  );
}
