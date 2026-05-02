// CSSOS_PHASE2_PERSONALIZATION_TEMPLATES 20260502 #269 — Jing
//
// Public surface for the templates submodule. Stage B step 2 will
// also export a high-level helper that combines pickBestTemplate +
// renderTemplateGift so triggers don't have to wire it themselves.

export type {
  PersonalizationTemplateManifest,
  LoadedTemplate,
  TemplateAspectRatio,
  TemplateEmotionalTone,
  TemplateRenderResult,
} from "./types.js";

export {
  loadPersonalizationTemplates,
  listLoadedTemplates,
  getTemplateById,
  pickBestTemplateForTarget,
  isLoaded as isPersonalizationTemplateRegistryLoaded,
} from "./registry.js";

export {
  sanitizeNameForEmbedding,
  clampNameLength,
  isRtlName,
  bidiSafeName,
  prepareNameForTemplate,
  pickNameFromTarget,
  pickLanguageFromTarget,
  languageMatchScore,
} from "./name-safety.js";

export { renderTemplateGift } from "./render.js";

import type { Pool, PoolClient } from "pg";
import type { GiftTargetSnapshot, GiftTriggerKey } from "../types.js";
import { pickBestTemplateForTarget } from "./registry.js";
import { renderTemplateGift } from "./render.js";
import type { TemplateRenderResult } from "./types.js";

/**
 * Convenience: pick the best template for (trigger, target), render
 * it, and return the result. This is what most trigger handlers
 * actually want — they shouldn't reach into the registry directly.
 *
 * Returns null if no template is registered for the trigger in any
 * supported language. Caller should fall back to a generated MV
 * (Stage C+) or fail the audit row.
 */
export async function renderBestTemplateForTrigger(
  q: Pool | PoolClient,
  args: {
    triggerKey: GiftTriggerKey;
    target: GiftTargetSnapshot;
    auditId: string | null;
  },
): Promise<TemplateRenderResult | null> {
  const template = pickBestTemplateForTarget(args.triggerKey, args.target);
  if (!template) return null;
  return renderTemplateGift(q, {
    template,
    target: args.target,
    auditId: args.auditId,
  });
}
