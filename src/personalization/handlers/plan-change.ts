// CSSOS_PHASE2_PERSONALIZATION_STAGE_E 20260503 — Jing
//
// Stage E: plan_upgrade and plan_downgrade triggers.
//
// Unlike welcome / first_subscriber / milestones (all platform-
// global oneShot), plan changes are RECURRING per user — a user
// could go free → starter → pro → starter → pro and we want a
// gift each transition. So neither trigger is oneShot; instead
// they use cooldownDays=7 to suppress accidental double-fires
// (Stripe webhook retries, user re-clicking checkout, race
// between subscription.updated + checkout.session.completed).
//
// Per-trigger annual cap is set high (plan_upgrade=12, plan_downgrade=6)
// to forgive churners while still protecting against runaway loops
// in the audit log.
//
// Both handlers are template-only with English fallback. Caller
// (Stripe webhook in src/index.ts) is responsible for detecting
// the actual tier transition and choosing which trigger to fire
// based on the direction of change.

import type { GiftTrigger } from "../types.js";
import { renderBestTemplateForTrigger } from "../templates/index.js";

export const planUpgradeTrigger: GiftTrigger = {
  key: "plan_upgrade",
  cooldownDays: 7,
  maxFiresPerYear: 12,
  costBudgetCents: 150,
  respectQuietHours: true,
  async generate({ q, target, auditId }) {
    const result = await renderBestTemplateForTrigger(q, {
      triggerKey: "plan_upgrade",
      target,
      auditId,
    });
    if (!result) {
      const lang =
        target.preferred_gift_language || target.locale || "(unknown)";
      throw new Error(
        `No 'plan_upgrade' template registered for language=${lang} ` +
          "(or English fallback). Drop one under " +
          "personalization-templates/plan_upgrade/<lang>.v<n>/ and reboot.",
      );
    }
    return {
      workId: result.workId,
      costCents: result.costCents,
      templateId: result.templateId,
    };
  },
};

export const planDowngradeTrigger: GiftTrigger = {
  key: "plan_downgrade",
  cooldownDays: 7,
  maxFiresPerYear: 6,
  costBudgetCents: 100,
  respectQuietHours: true,
  async generate({ q, target, auditId }) {
    const result = await renderBestTemplateForTrigger(q, {
      triggerKey: "plan_downgrade",
      target,
      auditId,
    });
    if (!result) {
      const lang =
        target.preferred_gift_language || target.locale || "(unknown)";
      throw new Error(
        `No 'plan_downgrade' template registered for language=${lang} ` +
          "(or English fallback). Drop one under " +
          "personalization-templates/plan_downgrade/<lang>.v<n>/ and reboot.",
      );
    }
    return {
      workId: result.workId,
      costCents: result.costCents,
      templateId: result.templateId,
    };
  },
};
