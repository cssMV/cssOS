// CSSOS_PHASE2_PERSONALIZATION_TEMPLATES 20260502 #269 — Jing
//
// The render primitive: given a loaded template + target snapshot,
// substitute the recipient's name into the lyric/title templates,
// insert a user_works row owned by the cssOS Curator (so the gift
// inherits the #266 free + priceless rules), and log the render
// for analytics.
//
// What this function does NOT do:
//   • generate any media (templates are pre-rendered)
//   • call kie.ai or any external API
//   • encrypt, watermark, or transform the base assets
//
// Cost is therefore essentially zero — only DB writes.

import type { Pool, PoolClient, QueryResult } from "pg";
import {
  CSSOS_SYSTEM_USER_ID,
  type GiftTargetSnapshot,
} from "../types.js";
import {
  pickLanguageFromTarget,
  pickNameFromTarget,
  prepareNameForTemplate,
} from "./name-safety.js";
import type {
  LoadedTemplate,
  TemplateRenderResult,
} from "./types.js";

type Querier = Pool | PoolClient;

const DEFAULT_MAX_NAME_CHARS = 24;

/**
 * Substitute every `{name}` (case-sensitive) with the prepared name.
 * No other placeholders are honoured — keeping this strict prevents
 * a typo in a template from silently rendering nothing.
 */
function fillNamePlaceholder(template: string, name: string): string {
  if (!template) return "";
  return template.split("{name}").join(name);
}

/**
 * Render a templated gift MV into the database. Returns the new
 * work_id and accounting metadata. The caller (the engine's
 * fireTrigger pipeline) wraps this with audit-row updates.
 *
 * Steps:
 *   1. Pick + prepare the recipient's name.
 *   2. Substitute into title + plain lyrics + ASS lyrics.
 *   3. INSERT user_works (owner = Curator, status='published').
 *   4. INSERT work_market_profiles (free + priceless, defensive
 *      override of the #266 rule even though normalizeWorkTreeRow
 *      would do the same on read).
 *   5. INSERT work_assets rows pointing at the base media URLs.
 *   6. INSERT personalization_template_renders (analytics log).
 */
export async function renderTemplateGift(
  q: Querier,
  args: {
    template: LoadedTemplate;
    target: GiftTargetSnapshot;
    auditId: string | null;
  },
): Promise<TemplateRenderResult> {
  const { template, target, auditId } = args;
  const manifest = template.manifest;

  // 1. Prepare the name. preferred_gift_display_name → display_name
  //    → cleaned email local-part → "Friend".
  const rawName = pickNameFromTarget(target);
  const maxChars = manifest.max_name_chars ?? DEFAULT_MAX_NAME_CHARS;
  const safeName = prepareNameForTemplate(rawName, maxChars);
  const language = pickLanguageFromTarget(target);

  // 2. Substitute placeholders.
  const title = fillNamePlaceholder(manifest.title_template, safeName);
  const subtitle = manifest.subtitle_template
    ? fillNamePlaceholder(manifest.subtitle_template, safeName)
    : null;
  const plainLyrics = fillNamePlaceholder(
    template.plain_lyrics_template,
    safeName,
  );
  // ASS lyrics intentionally use the SAME safe name — ASS subtitle
  // engines are already escaping-aware for the chars we strip in
  // sanitizeNameForEmbedding (curly braces, backslash).
  const _assLyrics = template.ass_lyrics_template
    ? fillNamePlaceholder(template.ass_lyrics_template, safeName)
    : null;

  // 3. Insert the work. owner_user_id = Curator — combined with #266
  //    this means the work is automatically free + priceless to all
  //    viewers (including the recipient).
  //
  //    style/work_type carry hints to the watch panel:
  //      style       → label shown under the title in inbox lists
  //      work_type   → 'single' so the existing playback chain works
  //      structure_role = 'gift' so future UI can surface gifts apart
  //                       from regular user works
  const workInsert = (await q.query(
    `INSERT INTO user_works (
       user_id, title, style, work_type, lyrics_preview,
       status, structure_role, source_run_id,
       cover_image, preview_image_url, preview_video_url,
       suggested_listen_price_cents, suggested_buyout_price_cents
     ) VALUES (
       $1, $2, $3, 'single', $4,
       'published', 'gift', $5,
       $6, $6, $7,
       0, 0
     )
     RETURNING id`,
    [
      CSSOS_SYSTEM_USER_ID,
      title,
      subtitle || manifest.label,
      plainLyrics,
      `personalization:${manifest.id}`, // source_run_id sentinel
      template.base_cover_url,
      template.base_video_url,
    ],
  )) as QueryResult<{ id: string }>;
  const workId = workInsert.rows[0]?.id;
  if (!workId) {
    throw new Error("renderTemplateGift: work insert returned no id");
  }

  // 4. Market profile — free + priceless. The #266 read-time mapper
  //    would force this anyway because Curator is in the admin
  //    allowlist, but writing 0/0/false directly avoids ever showing
  //    a non-zero price even for a microsecond on stale caches.
  await q.query(
    `INSERT INTO work_market_profiles (
       work_id, owner_user_id,
       current_listen_price_cents, current_buyout_price_cents,
       buyout_enabled, tips_enabled, visibility, rights_scope
     ) VALUES (
       $1, $2, 0, 0, false, false, 'public', 'system_priceless'
     )
     ON CONFLICT (work_id) DO UPDATE
       SET current_listen_price_cents = 0,
           current_buyout_price_cents = 0,
           buyout_enabled = false,
           rights_scope = 'system_priceless',
           updated_at = now()`,
    [workId, CSSOS_SYSTEM_USER_ID],
  );

  // 5. Persist the chosen base media as work_assets so the watch
  //    panel's existing asset resolution path picks them up. Only
  //    insert if the table exists — older deployments may not have
  //    work_assets yet (migration 014).
  try {
    await q.query(
      `INSERT INTO work_assets (work_id, asset_kind, asset_url, position)
       VALUES
         ($1, 'preview_video', $2, 0),
         ($1, 'preview_audio', $3, 0),
         ($1, 'cover_image',   $4, 0)
       ON CONFLICT DO NOTHING`,
      [
        workId,
        template.base_video_url,
        template.base_audio_url,
        template.base_cover_url,
      ],
    );
  } catch (e) {
    // work_assets table may not exist yet on this deployment; a NULL
    // here just means the watch panel falls back to the columns we
    // wrote on user_works in step 3. Not fatal.
    console.warn(
      "[personalization-render] work_assets insert skipped (table missing?): %s",
      e instanceof Error ? e.message : String(e),
    );
  }

  // 6. Analytics log — separate from system_gift_audit because we
  //    record the template/name/version snapshot, not the trigger.
  await q.query(
    `INSERT INTO personalization_template_renders
       (template_id, target_user_id, work_id, audit_id,
        embedded_name, embedded_language, manifest_sha256)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      manifest.id,
      target.user_id,
      workId,
      auditId,
      safeName,
      language,
      template.manifest_sha256,
    ],
  );

  return {
    workId,
    templateId: manifest.id,
    manifestSha256: template.manifest_sha256,
    embeddedName: safeName,
    embeddedLanguage: language,
    costCents: 0,
  };
}
