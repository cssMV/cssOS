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
