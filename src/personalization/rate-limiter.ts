// CSSOS_PHASE2_PERSONALIZATION_FOUNDATION 20260502 #268 — Jing
//
// Pre-flight policy checks every gift trigger goes through before
// the engine actually fires the handler. This lives separate from
// the handlers so a misbehaving trigger can't bypass the limits.

import type { Pool, PoolClient } from "pg";
import {
  countYtdDeliveries,
  getLatestDelivery,
  hasEverDelivered,
} from "./audit.js";
import type {
  GiftTargetSnapshot,
  GiftTrigger,
} from "./types.js";

type Querier = Pool | PoolClient;

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  /**
   * When `allowed=false` AND `silent=true`, the engine should skip
   * the audit insert entirely — the gift "shouldn't fire" is a
   * structural truth (user opted out / oneShot already delivered)
   * not an event worth recording per attempt.
   *
   * When `allowed=false` AND !silent (cooldown, annual cap), the
   * engine still records an audit row with status='rate_limited'
   * so we can see "almost fired but blocked" in analytics.
   */
  silent?: boolean;
  /** If allowed=true, should the gift queue (true) or fire now (false). */
  queueDueToQuietHours?: boolean;
}

/**
 * Run every policy gate against a (target, trigger) pair. Returns
 * a decision the engine acts on. Order of checks:
 *   1. Master opt-out                  → reject
 *   2. oneShot uniqueness              → reject if ever delivered
 *   3. Cooldown days                   → reject if too recent
 *   4. Annual cap                      → reject if YTD count maxed
 *   5. Quiet hours (if respected)      → allow but queue
 */
export async function checkPolicies(
  q: Querier,
  trigger: GiftTrigger,
  target: GiftTargetSnapshot,
): Promise<PolicyDecision> {
  // 1. Master opt-out — silent skip. The user said "no gifts please";
  //    we should not record an audit row per attempt, just leave them
  //    alone.
  if (target.gift_opt_out) {
    return {
      allowed: false,
      silent: true,
      reason: "User has gift_opt_out=true",
    };
  }

  // 2. oneShot uniqueness — silent skip. The user already received
  //    this gift; no need to record "tried again, blocked" rows on
  //    every login / page load.
  if (trigger.oneShot) {
    const seen = await hasEverDelivered(q, target.user_id, trigger.key);
    if (seen) {
      return {
        allowed: false,
        silent: true,
        reason: "oneShot trigger already fired for this user",
      };
    }
  }

  // 3. Cooldown days.
  if (trigger.cooldownDays && trigger.cooldownDays > 0) {
    const last = await getLatestDelivery(q, target.user_id, trigger.key);
    if (last?.dispatched_at) {
      const lastTs = new Date(last.dispatched_at).getTime();
      const cutoff = Date.now() - trigger.cooldownDays * 86400 * 1000;
      if (lastTs > cutoff) {
        const days = Math.ceil((lastTs - cutoff) / 86400 / 1000);
        return {
          allowed: false,
          reason: `Cooldown active — try again in ~${days} days`,
        };
      }
    }
  }

  // 4. Annual cap.
  if (trigger.maxFiresPerYear && trigger.maxFiresPerYear > 0) {
    const ytd = await countYtdDeliveries(q, target.user_id, trigger.key);
    if (ytd >= trigger.maxFiresPerYear) {
      return {
        allowed: false,
        reason: `Annual cap reached (${ytd}/${trigger.maxFiresPerYear})`,
      };
    }
  }

  // 5. Quiet hours.
  let queue = false;
  if (trigger.respectQuietHours) {
    queue = isInQuietHours(target);
  }
  return { allowed: true, queueDueToQuietHours: queue };
}

/**
 * Is the user currently inside their quiet-hours window?
 * Best-effort timezone math — we read the user's birthday_timezone
 * field as a proxy for "user-local timezone" since that's the only
 * tz we collect. Falls back to the server's TZ if none is set.
 *
 * Quiet hours can wrap midnight (start=23:00, end=07:00). The
 * comparison handles both wrapping and non-wrapping windows.
 */
export function isInQuietHours(target: GiftTargetSnapshot): boolean {
  const start = target.quiet_hours_start_local;
  const end = target.quiet_hours_end_local;
  if (!start || !end) return false;
  const tz = target.birthday_timezone || undefined;
  const now = new Date();
  // Format current local time as 'HH:MM:SS' in the target's tz.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: tz,
  });
  const localTime = fmt.format(now); //  e.g. "23:42:11"
  if (start < end) {
    // Non-wrapping: e.g. 13:00–17:00.
    return localTime >= start && localTime < end;
  }
  // Wrapping: e.g. 23:00–07:00.
  return localTime >= start || localTime < end;
}
