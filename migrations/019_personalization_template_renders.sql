-- CSSOS_PHASE2_PERSONALIZATION_TEMPLATES 20260502 #269 — Jing
-- Stage B step 1: log of every templated render. Distinct from
-- system_gift_audit because:
--   • audit row exists per TRIGGER (one per user-gift attempt)
--   • render row exists per TEMPLATE INSTANTIATION (the actual
--     work_id created from a template + name substitution)
-- Lets us answer: "how many users got welcome.zh.v1?", "what's the
-- distribution of templates over the last 30 days?", "did template
-- welcome.zh.v2 ship cleanly to anyone yet?". Also enables future
-- de-dupe: if we ever want to prevent re-rendering the same template
-- for the same user, we look here.

BEGIN;

CREATE TABLE IF NOT EXISTS personalization_template_renders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which template was used (matches the manifest's id field, e.g.
  -- 'welcome.zh.v1'). Free-form text so registering a new template
  -- never needs a schema change.
  template_id TEXT NOT NULL,

  -- Recipient at render time.
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- The work record produced by the render. NULL only if the render
  -- failed before insert (extremely rare path — typically means the
  -- transaction rolled back).
  work_id UUID,

  -- Audit row that triggered this render (so we can JOIN back to
  -- the policy decision, payload, etc.).
  audit_id UUID REFERENCES system_gift_audit(id) ON DELETE SET NULL,

  -- Snapshot of the embedded name at render time. Useful for
  -- debugging "why does my MV say 'Bob' when I changed my display
  -- name to 'Robert'?" — the render captured the old name.
  embedded_name TEXT,
  embedded_language TEXT,

  -- Manifest sha256 at render time (so we can detect when a render
  -- was made against an older template version).
  manifest_sha256 TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-template counts + recency for analytics.
CREATE INDEX IF NOT EXISTS personalization_template_renders_template_idx
  ON personalization_template_renders (template_id, created_at DESC);

-- Per-user history (so a future "have I ever rendered this template
-- for this user?" check is fast).
CREATE INDEX IF NOT EXISTS personalization_template_renders_target_idx
  ON personalization_template_renders (target_user_id, template_id, created_at DESC);

-- JOIN-friendly index back to audit.
CREATE INDEX IF NOT EXISTS personalization_template_renders_audit_idx
  ON personalization_template_renders (audit_id);

COMMIT;
