// CSSOS_PHASE2_PERSONALIZATION_STAGE_D 20260503 — Jing
//
// Stage D: subscriber-count milestone triggers. Each is one-shot
// platform-globally (the 100th subscriber happens exactly once),
// per-user one-shot trivially follows. The platform-global gate is
// enforced by the caller (Stripe checkout webhook) the same way
// Stage C's first_subscriber works — the engine's oneShot is
// per-user; "exactly one fire ever" is checked in src/index.ts via
// system_gift_audit before dispatch.
//
// Templates live under personalization-templates/<key>/<lang>.v<n>/.
// Each handler is identical except for its key + budget — kept in
// one file so adding the milestion_M (or whatever) only needs one
// new factory call.

import type { GiftTrigger, GiftTriggerKey } from "../types.js";
import { renderBestTemplateForTrigger } from "../templates/index.js";

function buildMilestoneTrigger(
  key: GiftTriggerKey,
  costBudgetCents: number,
): GiftTrigger {
  return {
    key,
    oneShot: true,
    costBudgetCents,
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

// Budgets scale modestly with milestone gravity: each one is still a
// pre-rendered template (≈0¢ actual), the cap just catches future
// hand-crafted milestones that get more elaborate.
export const milestone100Trigger = buildMilestoneTrigger("milestone_100", 100);
export const milestone1000Trigger = buildMilestoneTrigger(
  "milestone_1000",
  200,
);
export const milestone10000Trigger = buildMilestoneTrigger(
  "milestone_10000",
  500,
);
export const milestone100000Trigger = buildMilestoneTrigger(
  "milestone_100000",
  1000,
);
