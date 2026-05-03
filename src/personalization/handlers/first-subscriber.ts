// CSSOS_PHASE2_PERSONALIZATION_STAGE_C 20260503 — Jing
//
// Stage C trigger: first_subscriber.
//
// Fires exactly once across the WHOLE platform — when the very first
// paying subscriber lands. Companion to the admin-side celebration
// flow (#263 watcher + #265 fullscreen MV) which notifies the
// founder; this trigger gives the SUBSCRIBER themselves a personal
// gift MV they own, sitting in their /api/personalization/inbox.
//
// Policy:
//   - oneShot           — per-user uniqueness (engine-enforced via
//                         system_gift_audit). The "platform-global
//                         oneness" check is enforced by the caller
//                         (the Stripe checkout webhook) BEFORE
//                         dispatching, since the engine's oneShot
//                         is naturally per-user. See firstPaying-
//                         SubscriberAlreadyHonoured() in
//                         src/index.ts.
//   - costBudgetCents   — 100 (template-rendered, ~0 actual)
//   - respectQuietHours — yes (don't deliver at 3am local time)
//
// Template-only handler — same skeleton as welcomeTrigger. Picks the
// best first_subscriber.<lang>.<v> template for the recipient's
// language, with English fallback. Throws if no template registered;
// engine catches and logs to system_gift_audit.

import type { GiftTrigger } from "../types.js";
import { renderBestTemplateForTrigger } from "../templates/index.js";

export const firstSubscriberTrigger: GiftTrigger = {
  key: "first_subscriber",
  oneShot: true,
  costBudgetCents: 100,
  respectQuietHours: true,
  async generate({ q, target, auditId }) {
    const result = await renderBestTemplateForTrigger(q, {
      triggerKey: "first_subscriber",
      target,
      auditId,
    });
    if (!result) {
      const lang =
        target.preferred_gift_language || target.locale || "(unknown)";
      throw new Error(
        `No 'first_subscriber' template registered for language=${lang} ` +
          "(or English fallback). Drop one under " +
          "personalization-templates/first_subscriber/<lang>.v<n>/ and reboot.",
      );
    }
    return {
      workId: result.workId,
      costCents: result.costCents,
      templateId: result.templateId,
    };
  },
};
