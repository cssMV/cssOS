// CSSOS_PHASE2_PERSONALIZATION_STAGE_G 20260503 — Jing
//
// Stage G: feedback_adopted trigger.
//
// Fires when a user's bug report or feature request was actually
// shipped. Caller is responsible for detecting "adoption" — usually
// an admin-ops endpoint that ties a github commit / changelog row
// back to the original feedback submitter's user_id.
//
// Not oneShot — a power user can have several feedback items
// adopted over time, each one earns its own "thank you" MV. The
// cooldown prevents a single adoption batch from spamming.

import type { GiftTrigger } from "../types.js";
import { renderBestTemplateForTrigger } from "../templates/index.js";

export const feedbackAdoptedTrigger: GiftTrigger = {
  key: "feedback_adopted",
  cooldownDays: 14,
  maxFiresPerYear: 8,
  costBudgetCents: 200,
  respectQuietHours: true,
  async generate({ q, target, auditId }) {
    const result = await renderBestTemplateForTrigger(q, {
      triggerKey: "feedback_adopted",
      target,
      auditId,
    });
    if (!result) {
      const lang =
        target.preferred_gift_language || target.locale || "(unknown)";
      throw new Error(
        `No 'feedback_adopted' template registered for language=${lang} ` +
          "(or English fallback). Drop one under " +
          "personalization-templates/feedback_adopted/<lang>.v<n>/ and reboot.",
      );
    }
    return {
      workId: result.workId,
      costCents: result.costCents,
      templateId: result.templateId,
    };
  },
};
