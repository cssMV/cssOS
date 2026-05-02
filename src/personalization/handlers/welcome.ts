// CSSOS_PHASE2_PERSONALIZATION_TRIGGERS 20260502 #270 - Jing
//
// First registered trigger: the new-user welcome MV.
//
// Policy:
//   - oneShot           — every user gets exactly one welcome MV, ever
//   - costBudgetCents   — 100 (template-rendered should be ~0; cap
//                         catches accidentally-expensive future paths)
//   - respectQuietHours — yes (don't fire at 3am user-local-time)
//
// This handler is intentionally template-only: it picks the best
// welcome.<lang>.<v> template for the recipient's language and
// renders it. If no template is registered for that language and
// English isn't available either, the handler throws — the engine
// catches the throw, marks the audit row as 'failed' with a
// human-readable reason, and life continues.
//
// When a real welcome.en.v1 ships under personalization-templates/,
// this trigger immediately starts firing — no code change needed.

import type { GiftTrigger } from "../types.js";
import { renderBestTemplateForTrigger } from "../templates/index.js";

export const welcomeTrigger: GiftTrigger = {
  key: "welcome",
  oneShot: true,
  costBudgetCents: 100,
  respectQuietHours: true,
  async generate({ q, target, auditId }) {
    const result = await renderBestTemplateForTrigger(q, {
      triggerKey: "welcome",
      target,
      auditId,
    });
    if (!result) {
      const lang =
        target.preferred_gift_language || target.locale || "(unknown)";
      throw new Error(
        `No 'welcome' template registered for language=${lang} ` +
          "(or English fallback). Drop one under " +
          "personalization-templates/welcome/<lang>.v<n>/ and reboot.",
      );
    }
    return {
      workId: result.workId,
      costCents: result.costCents,
      templateId: result.templateId,
    };
  },
};
