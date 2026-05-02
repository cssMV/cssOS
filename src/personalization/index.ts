// CSSOS_PHASE2_PERSONALIZATION_FOUNDATION 20260502 #268 — Jing
//
// Public entry point for the personalization engine. Callers (Stripe
// webhook, plan-change handler, login flow, birthday cron, etc.)
// invoke fireTrigger() with the trigger key + target user; the engine
// handles policy enforcement, audit logging, and dispatching to the
// registered handler.
//
// Stage A only ships the engine itself — there are no triggers
// registered yet. Stages B / C / D add the actual welcome / first-
// subscriber / milestone handlers.

export {
  CSSOS_SYSTEM_USER_ID,
  CSSOS_SYSTEM_USER_EMAIL,
  CSSOS_SYSTEM_USER_DISPLAY_NAME,
} from "./types.js";
export type {
  GiftTriggerKey,
  GiftStatus,
  GiftTargetSnapshot,
  GiftTrigger,
  GenerateArgs,
  GenerateResult,
  FireTriggerArgs,
  FireTriggerResult,
} from "./types.js";
export { registerGiftTrigger, listRegisteredTriggers } from "./triggers.js";
export { registerAllPersonalizationTriggers } from "./handlers/index.js";
export { getSystemUser, getSystemUserIdSync } from "./system-user.js";
export { listUserGifts, markViewed } from "./audit.js";
export {
  buildTargetSnapshot,
  upsertUserPreferences,
} from "./preferences.js";
// Template subsystem — opt-in import, but re-exported here for the
// common case where a trigger handler just wants to pick + render.
export {
  loadPersonalizationTemplates,
  listLoadedTemplates,
  getTemplateById,
  pickBestTemplateForTarget,
  renderTemplateGift,
  renderBestTemplateForTrigger,
  isPersonalizationTemplateRegistryLoaded,
} from "./templates/index.js";
export type {
  PersonalizationTemplateManifest,
  LoadedTemplate,
  TemplateAspectRatio,
  TemplateEmotionalTone,
  TemplateRenderResult,
} from "./templates/index.js";

import type { Pool, PoolClient } from "pg";
import {
  insertAuditRow,
  markGenerating,
  markDelivered,
  markFailed,
  markRateLimited,
  markOptedOut,
} from "./audit.js";
import { buildTargetSnapshot } from "./preferences.js";
import { checkPolicies } from "./rate-limiter.js";
import { getRegisteredTrigger } from "./triggers.js";
import type {
  FireTriggerArgs,
  FireTriggerResult,
  GiftTriggerKey,
} from "./types.js";

type Querier = Pool | PoolClient;

/**
 * Fire a gift trigger for a user. Pipeline:
 *
 *   1. Resolve trigger from registry            → 'failed' if unknown
 *   2. Resolve target (user + prefs join)       → 'failed' if user gone
 *   3. Insert audit row (status='pending')
 *   4. Run policy gates (opt-out, cooldown, ...)
 *      → 'opted_out' / 'rate_limited' if blocked
 *   5. Mark 'generating', call trigger.generate()
 *   6. On success: mark 'delivered' with workId + cost
 *      On failure: mark 'failed' with reason
 *
 * Errors thrown by the handler are caught and recorded — they do
 * NOT propagate to the caller, because the caller is usually a
 * webhook or background job that shouldn't be derailed by a single
 * gift miss. Inspect the audit row if you need the failure reason.
 *
 * NB: Stage A's policies do not yet implement quiet-hours queueing
 * (it's a pass-through, queueDueToQuietHours decision is logged but
 * the trigger fires immediately anyway). The deferred-flush job
 * comes in Stage F alongside birthdays.
 */
export async function fireTrigger(
  q: Querier,
  args: FireTriggerArgs,
): Promise<FireTriggerResult> {
  const { triggerKey, targetUserId, payload, livemode } = args;
  const log = (...m: unknown[]) =>
    console.log("[personalization]", triggerKey, targetUserId, ...m);

  // 1. Resolve trigger.
  const trigger = getRegisteredTrigger(triggerKey);
  if (!trigger) {
    log("trigger not registered — skipping");
    return {
      status: "failed",
      auditId: null,
      workId: null,
      reason: `Trigger ${triggerKey} not registered`,
    };
  }

  // 2. Resolve target.
  const target = await buildTargetSnapshot(q, targetUserId);
  if (!target) {
    log("target user not found");
    return {
      status: "failed",
      auditId: null,
      workId: null,
      reason: `User ${targetUserId} not found`,
    };
  }

  // 3. Insert audit row.
  const auditId = await insertAuditRow(q, {
    triggerKey,
    target,
    payload: payload || null,
    livemode: livemode !== false,
  });

  // 4. Policy gates.
  const decision = await checkPolicies(q, trigger, target);
  if (!decision.allowed) {
    if (target.gift_opt_out) {
      await markOptedOut(q, auditId);
      log("opted_out:", decision.reason);
      return {
        status: "opted_out",
        auditId,
        workId: null,
        ...(decision.reason ? { reason: decision.reason } : {}),
      };
    }
    await markRateLimited(q, auditId, decision.reason || "blocked");
    log("rate_limited:", decision.reason);
    return {
      status: "rate_limited",
      auditId,
      workId: null,
      ...(decision.reason ? { reason: decision.reason } : {}),
    };
  }
  if (decision.queueDueToQuietHours) {
    log("quiet hours flagged — Stage A still fires immediately");
    // Stage F will branch here to leave status='pending' and let the
    // morning flush job dispatch. For now we proceed.
  }

  // 5 + 6. Mark generating, call handler, record outcome.
  await markGenerating(q, auditId);
  try {
    const result = await trigger.generate({
      q,
      target,
      payload: payload || {},
      auditId,
      livemode: livemode !== false,
    });
    if (
      trigger.costBudgetCents &&
      trigger.costBudgetCents > 0 &&
      result.costCents > trigger.costBudgetCents
    ) {
      console.warn(
        "[personalization] %s exceeded budget: %d > %d (auditId=%s)",
        triggerKey,
        result.costCents,
        trigger.costBudgetCents,
        auditId,
      );
    }
    await markDelivered(
      q,
      auditId,
      result.workId,
      result.costCents,
      result.templateId,
    );
    log("delivered work_id=%s cost=%d", result.workId, result.costCents);
    return {
      status: "delivered",
      auditId,
      workId: result.workId,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await markFailed(q, auditId, reason);
    log("failed:", reason);
    return {
      status: "failed",
      auditId,
      workId: null,
      reason,
    };
  }
}

/**
 * Convenience wrapper for callers that don't need the result —
 * fire-and-forget. Errors are still logged but never thrown.
 */
export function fireTriggerFireAndForget(
  q: Querier,
  args: FireTriggerArgs,
): void {
  fireTrigger(q, args).catch((err) => {
    console.error(
      "[personalization] unexpected error:",
      args.triggerKey,
      args.targetUserId,
      err,
    );
  });
}
