// CSSOS_WAVE_1755 — Jing: farewell MV on account close.
//
// Fires when a user soft-deletes their own account (POST /api/account/delete).
// The forced full-screen farewell the departing user sees is the client-side
// Canvas MV (app.farewell-moment.js); THIS trigger persists a named farewell
// work owned by the cssOS Curator so it enters the public "For You / 为你创造"
// gallery (free + system_priceless, #266) during the 30-day grace window. The
// scheduled hard-purge job takes it down together with the account.
//
// Policy:
//   - oneShot           — one farewell per user, ever.
//   - respectQuietHours — NO. The user is leaving right now; the farewell must
//                         fire immediately, never queue to a morning flush.
//   - costBudgetCents   — 100 (template-rendered ~0; cap catches regressions).
//
// Template-only: renders the best account_deletion.<lang>.<v> template. When
// no template is registered it throws; the engine records 'failed' and the
// user's deletion still proceeds (dispatch is fire-and-forget at the caller).

import type { GiftTrigger } from "../types.js";
import { renderBestTemplateForTrigger } from "../templates/index.js";

export const accountDeletionTrigger: GiftTrigger = {
  key: "account_deletion",
  oneShot: true,
  costBudgetCents: 100,
  respectQuietHours: false,
  async generate({ q, target, auditId }) {
    const result = await renderBestTemplateForTrigger(q, {
      triggerKey: "account_deletion",
      target,
      auditId,
    });
    if (!result) {
      const lang =
        target.preferred_gift_language || target.locale || "(unknown)";
      throw new Error(
        `No 'account_deletion' template registered for language=${lang} ` +
          "(or English fallback). Drop one under " +
          "personalization-templates/account_deletion/<lang>.v<n>/ and reboot.",
      );
    }
    return {
      workId: result.workId,
      costCents: result.costCents,
      templateId: result.templateId,
    };
  },
};
