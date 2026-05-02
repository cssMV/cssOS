// CSSOS_PHASE2_PERSONALIZATION_FOUNDATION 20260502 #268 — Jing
//
// Read/write helpers for the system_gift_audit table. Every state
// transition for every gift goes through here, so we can later
// answer "did the welcome MV trigger for user X?", "how much did
// the first-subscriber celebration cost across attempts?", etc.

import type { Pool, PoolClient, QueryResult } from "pg";
import type {
  GiftStatus,
  GiftTriggerKey,
  GiftTargetSnapshot,
} from "./types.js";

type Querier = Pool | PoolClient;

export interface AuditRow {
  id: string;
  trigger_event: string;
  trigger_payload: Record<string, unknown> | null;
  target_user_id: string;
  recipient_email: string | null;
  recipient_display_name: string | null;
  recipient_locale: string | null;
  work_id: string | null;
  template_id: string | null;
  status: GiftStatus;
  cost_cents: number;
  livemode: boolean;
  dispatched_at: string | null;
  delivered_at: string | null;
  viewed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Insert a new audit row in the 'pending' state. Returns the new id.
 * The caller transitions to 'generating' / 'delivered' / 'failed'
 * via the helpers below as the gift progresses.
 */
export async function insertAuditRow(
  q: Querier,
  args: {
    triggerKey: GiftTriggerKey;
    target: GiftTargetSnapshot;
    payload: Record<string, unknown> | null;
    livemode: boolean;
    initialStatus?: GiftStatus;
  },
): Promise<string> {
  const result = (await q.query(
    `INSERT INTO system_gift_audit
       (trigger_event, trigger_payload, target_user_id, recipient_email,
        recipient_display_name, recipient_locale, status, livemode)
     VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      args.triggerKey,
      args.payload ? JSON.stringify(args.payload) : null,
      args.target.user_id,
      args.target.email,
      args.target.preferred_gift_display_name || args.target.display_name,
      args.target.preferred_gift_language || args.target.locale,
      args.initialStatus || "pending",
      args.livemode,
    ],
  )) as QueryResult<{ id: string }>;
  const id = result.rows[0]?.id;
  if (!id) throw new Error("insertAuditRow: insert returned no row");
  return id;
}

export async function markGenerating(q: Querier, auditId: string) {
  await q.query(
    `UPDATE system_gift_audit
        SET status='generating', updated_at=now()
      WHERE id=$1`,
    [auditId],
  );
}

export async function markDelivered(
  q: Querier,
  auditId: string,
  workId: string,
  costCents: number,
  templateId?: string | null,
) {
  await q.query(
    `UPDATE system_gift_audit
        SET status='delivered',
            work_id=$2,
            cost_cents=$3,
            template_id=$4,
            delivered_at=now(),
            updated_at=now()
      WHERE id=$1`,
    [auditId, workId, costCents, templateId || null],
  );
}

export async function markViewed(q: Querier, auditId: string) {
  await q.query(
    `UPDATE system_gift_audit
        SET status='viewed',
            viewed_at=COALESCE(viewed_at, now()),
            updated_at=now()
      WHERE id=$1
        AND status IN ('delivered', 'viewed')`,
    [auditId],
  );
}

export async function markFailed(
  q: Querier,
  auditId: string,
  reason: string,
) {
  await q.query(
    `UPDATE system_gift_audit
        SET status='failed',
            failure_reason=$2,
            failed_at=now(),
            updated_at=now()
      WHERE id=$1`,
    [auditId, String(reason).slice(0, 2000)],
  );
}

export async function markRateLimited(
  q: Querier,
  auditId: string,
  reason: string,
) {
  await q.query(
    `UPDATE system_gift_audit
        SET status='rate_limited',
            failure_reason=$2,
            updated_at=now()
      WHERE id=$1`,
    [auditId, String(reason).slice(0, 2000)],
  );
}

export async function markOptedOut(q: Querier, auditId: string) {
  await q.query(
    `UPDATE system_gift_audit
        SET status='opted_out',
            updated_at=now()
      WHERE id=$1`,
    [auditId],
  );
}

/**
 * Look up the user's most recent successful delivery of a given
 * trigger. Used by cooldown checks — a NULL means "never received".
 */
export async function getLatestDelivery(
  q: Querier,
  targetUserId: string,
  triggerKey: GiftTriggerKey,
): Promise<AuditRow | null> {
  const result = (await q.query(
    `SELECT * FROM system_gift_audit
      WHERE target_user_id = $1
        AND trigger_event = $2
        AND status IN ('delivered', 'viewed')
      ORDER BY dispatched_at DESC NULLS LAST
      LIMIT 1`,
    [targetUserId, triggerKey],
  )) as QueryResult<AuditRow>;
  return result.rows[0] || null;
}

/**
 * Count successful deliveries of a trigger to a user in the current
 * calendar year. Used by maxFiresPerYear caps.
 */
export async function countYtdDeliveries(
  q: Querier,
  targetUserId: string,
  triggerKey: GiftTriggerKey,
): Promise<number> {
  const result = (await q.query(
    `SELECT count(*)::int AS n
       FROM system_gift_audit
      WHERE target_user_id = $1
        AND trigger_event = $2
        AND status IN ('delivered', 'viewed')
        AND dispatched_at >= date_trunc('year', now())`,
    [targetUserId, triggerKey],
  )) as QueryResult<{ n: number }>;
  return result.rows[0]?.n || 0;
}

/**
 * Has this user EVER received this trigger? Used by oneShot triggers
 * (welcome, first_subscriber, account_deletion).
 */
export async function hasEverDelivered(
  q: Querier,
  targetUserId: string,
  triggerKey: GiftTriggerKey,
): Promise<boolean> {
  const result = (await q.query(
    `SELECT 1 AS hit FROM system_gift_audit
      WHERE target_user_id = $1
        AND trigger_event = $2
        AND status IN ('delivered', 'viewed', 'generating')
      LIMIT 1`,
    [targetUserId, triggerKey],
  )) as QueryResult<{ hit: number }>;
  return result.rows.length > 0;
}

/**
 * The user's gift inbox — every delivered/viewed gift, newest first.
 * Stage B's frontend lists these so users can revisit their gifts.
 */
export async function listUserGifts(
  q: Querier,
  targetUserId: string,
  limit = 50,
): Promise<AuditRow[]> {
  const result = (await q.query(
    `SELECT * FROM system_gift_audit
      WHERE target_user_id = $1
        AND status IN ('delivered', 'viewed')
      ORDER BY delivered_at DESC NULLS LAST
      LIMIT $2`,
    [targetUserId, Math.max(1, Math.min(200, limit))],
  )) as QueryResult<AuditRow>;
  return result.rows;
}
