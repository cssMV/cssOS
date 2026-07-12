// CSSOS_PHASE2_PERSONALIZATION_STAGE_H 20260503 — Jing
//
// Stage H: anniversary triggers.
//
// Two flavours:
//   • anniversary_marriage — user submits their marriage date in
//     user_preferences (separate table column lands in a future
//     migration — for now treated as a generic anniversary).
//   • anniversary_other    — any approved custom anniversary the
//     user opted into (graduation, business founding, etc.).
//
// Both fire from the same daily anniversary-flush cron pattern as
// birthday; this file holds only the trigger handlers. The cron
// itself can crib runDailyBirthdayFlush() in birthday.ts when an
// anniversary date column ships.
//
// Per-year cap = 1 each (you can't have a 5th anniversary twice in
// the same year). Cooldown 360 days for double-fire safety.

import type { GiftTrigger } from "../types.js";
import type { Pool, PoolClient } from "pg";
import { renderBestTemplateForTrigger } from "../templates/index.js";

function buildAnniversaryTrigger(
  key: "anniversary_marriage" | "anniversary_other",
): GiftTrigger {
  return {
    key,
    oneShot: false,
    cooldownDays: 360,
    maxFiresPerYear: 1,
    costBudgetCents: 200,
    respectQuietHours: true,
    async generate({ q, target, auditId }) {
      const result = await renderBestTemplateForTrigger(q, {
        triggerKey: key,
        target,
        auditId,
      });
      if (!result) {
        const lang =
          target.preferred_gift_language || target.locale || "(unknown)";
        throw new Error(
          `No '${key}' template registered for language=${lang} ` +
            "(or English fallback). Drop one under " +
            `personalization-templates/${key}/<lang>.v<n>/ and reboot.`,
        );
      }
      return {
        workId: result.workId,
        costCents: result.costCents,
        templateId: result.templateId,
      };
    },
  };
}

export const anniversaryMarriageTrigger = buildAnniversaryTrigger(
  "anniversary_marriage",
);
export const anniversaryOtherTrigger = buildAnniversaryTrigger(
  "anniversary_other",
);

// CSSOS_PHASE2_PERSONALIZATION_STAGE_H2 20260712 — Jing
//
// Daily anniversary flush cron. The Stage H date columns finally
// shipped (migration 109_user_anniversary_dates.sql), so this is the
// direct sibling of runDailyBirthdayFlush() in birthday.ts:
//
//   • up.anniversary_opt_in = true   (per-feature opt-in)
//   • up.gift_opt_out       = false  (master switch still wins)
//   • EXTRACT(MONTH/DAY) of the anniversary date matches "today" in the
//     user's own timezone (reusing up.birthday_timezone as the single
//     home-timezone column — a user has one local day boundary)
//   • no system_gift_audit row this calendar year for that trigger_event
//     (NB: the real audit column is `trigger_event`, NOT `trigger_key`)
//
// Marriage + custom "other" anniversaries are matched independently so
// a user with both on the same day gets both gifts. maxFiresPerYear=1
// per trigger + the per-year audit dedup below make double-fire
// impossible even if the cron runs several times per local day.

type AnniversaryTriggerKey = "anniversary_marriage" | "anniversary_other";

async function flushOneAnniversaryKind(
  q: Pool | PoolClient,
  fireTriggerFireAndForget: (
    pool: Pool,
    args: {
      triggerKey: AnniversaryTriggerKey;
      targetUserId: string;
      livemode: boolean;
      payload: Record<string, unknown>;
    },
  ) => void,
  pool: Pool,
  triggerKey: AnniversaryTriggerKey,
  dateColumn: "anniversary_marriage_date" | "anniversary_other_date",
): Promise<string[]> {
  // NB: dateColumn is an internal literal (never user input), so string
  // interpolation here is injection-safe.
  const { rows } = await q.query(
    `SELECT u.id AS user_id
       FROM user_preferences up
       JOIN users u ON u.id = up.user_id
      WHERE up.anniversary_opt_in = true
        AND up.gift_opt_out       = false
        AND up.${dateColumn} IS NOT NULL
        AND EXTRACT(MONTH FROM up.${dateColumn}) = EXTRACT(
              MONTH FROM (now() AT TIME ZONE COALESCE(up.birthday_timezone, 'UTC'))
            )
        AND EXTRACT(DAY FROM up.${dateColumn}) = EXTRACT(
              DAY FROM (now() AT TIME ZONE COALESCE(up.birthday_timezone, 'UTC'))
            )
        AND NOT EXISTS (
          SELECT 1
            FROM system_gift_audit sga
           WHERE sga.target_user_id = u.id
             AND sga.trigger_event = $1
             AND EXTRACT(YEAR FROM sga.dispatched_at) =
                 EXTRACT(YEAR FROM now())
             AND sga.status IN ('pending','generating','delivered','viewed')
        )`,
    [triggerKey],
  );
  const userIds: string[] = rows.map((r: any) => String(r.user_id));
  for (const userId of userIds) {
    fireTriggerFireAndForget(pool, {
      triggerKey,
      targetUserId: userId,
      livemode: true,
      payload: {
        source: "anniversary-flush",
        kind: triggerKey,
        flushed_at: new Date().toISOString(),
      },
    });
  }
  return userIds;
}

/**
 * Daily anniversary cron. Idempotent: callable any number of times per
 * day; users who already received a given anniversary MV this calendar
 * year are skipped by the SELECT clause. Marriage and "other"
 * anniversaries are flushed independently.
 *
 * Returns the userIds for whom we dispatched a trigger (marriage first,
 * then other), useful for structured logging in the cron entry point.
 */
export async function runDailyAnniversaryFlush(
  q: Pool | PoolClient,
  fireTriggerFireAndForget: (
    pool: Pool,
    args: {
      triggerKey: AnniversaryTriggerKey;
      targetUserId: string;
      livemode: boolean;
      payload: Record<string, unknown>;
    },
  ) => void,
  pool: Pool,
): Promise<string[]> {
  const marriage = await flushOneAnniversaryKind(
    q,
    fireTriggerFireAndForget,
    pool,
    "anniversary_marriage",
    "anniversary_marriage_date",
  );
  const other = await flushOneAnniversaryKind(
    q,
    fireTriggerFireAndForget,
    pool,
    "anniversary_other",
    "anniversary_other_date",
  );
  return [...marriage, ...other];
}
