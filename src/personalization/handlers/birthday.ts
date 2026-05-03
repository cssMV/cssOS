// CSSOS_PHASE2_PERSONALIZATION_STAGE_F 20260503 — Jing
//
// Stage F: birthday trigger + the daily flush cron that powers it.
//
// The cron (runDailyBirthdayFlush) runs once per VM-day. It SELECTs
// every user where:
//   • user_preferences.birthday_opt_in = true
//   • user_preferences.gift_opt_out    = false
//   • EXTRACT(MONTH/DAY FROM birthday) matches today in the user's
//     birthday_timezone
//   • no system_gift_audit row with trigger_key='birthday' AND
//     EXTRACT(YEAR FROM dispatched_at) = current year already exists
//
// Each match → fireTriggerFireAndForget('birthday'). Engine handles
// quiet-hour deferral, cooldowns, etc.
//
// maxFiresPerYear=1 + the per-year audit dedup query above mean a
// user can never get two birthday MVs in the same calendar year
// even if the cron is invoked multiple times in the same day.

import type { GiftTrigger } from "../types.js";
import type { Pool, PoolClient } from "pg";
import { renderBestTemplateForTrigger } from "../templates/index.js";

export const birthdayTrigger: GiftTrigger = {
  key: "birthday",
  oneShot: false,
  cooldownDays: 360, // belt-and-suspenders against same-year double fire
  maxFiresPerYear: 1,
  costBudgetCents: 200,
  respectQuietHours: true,
  async generate({ q, target, auditId }) {
    const result = await renderBestTemplateForTrigger(q, {
      triggerKey: "birthday",
      target,
      auditId,
    });
    if (!result) {
      const lang =
        target.preferred_gift_language || target.locale || "(unknown)";
      throw new Error(
        `No 'birthday' template registered for language=${lang} ` +
          "(or English fallback). Drop one under " +
          "personalization-templates/birthday/<lang>.v<n>/ and reboot.",
      );
    }
    return {
      workId: result.workId,
      costCents: result.costCents,
      templateId: result.templateId,
    };
  },
};

/**
 * Daily birthday cron. Idempotent: callable any number of times per
 * day; users who already received their birthday MV this calendar
 * year are skipped by the SELECT clause.
 *
 * Returns the userIds for whom we dispatched a trigger, useful for
 * structured logging in the cron entry point.
 */
export async function runDailyBirthdayFlush(
  q: Pool | PoolClient,
  fireTriggerFireAndForget: (
    pool: Pool,
    args: {
      triggerKey: "birthday";
      targetUserId: string;
      livemode: boolean;
      payload: Record<string, unknown>;
    },
  ) => void,
  pool: Pool,
): Promise<string[]> {
  // Find users whose local birthday matches "today" in their own
  // timezone, who opted in, didn't opt out, and haven't received
  // a birthday gift this calendar year.
  const { rows } = await q.query(
    `SELECT u.id AS user_id
       FROM user_preferences up
       JOIN users u ON u.id = up.user_id
      WHERE up.birthday_opt_in = true
        AND up.gift_opt_out    = false
        AND up.birthday IS NOT NULL
        AND EXTRACT(MONTH FROM up.birthday) = EXTRACT(
              MONTH FROM (now() AT TIME ZONE COALESCE(up.birthday_timezone, 'UTC'))
            )
        AND EXTRACT(DAY FROM up.birthday) = EXTRACT(
              DAY FROM (now() AT TIME ZONE COALESCE(up.birthday_timezone, 'UTC'))
            )
        AND NOT EXISTS (
          SELECT 1
            FROM system_gift_audit sga
           WHERE sga.target_user_id = u.id
             AND sga.trigger_key   = 'birthday'
             AND EXTRACT(YEAR FROM sga.dispatched_at) =
                 EXTRACT(YEAR FROM now())
             AND sga.status IN ('pending','generating','delivered','viewed')
        )`,
  );
  const userIds: string[] = rows.map((r: any) => String(r.user_id));
  for (const userId of userIds) {
    fireTriggerFireAndForget(pool, {
      triggerKey: "birthday",
      targetUserId: userId,
      livemode: true,
      payload: { source: "birthday-flush", flushed_at: new Date().toISOString() },
    });
  }
  return userIds;
}
