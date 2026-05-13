-- CSSOS_WAVE_119 20260513 — Jing
-- System-generated MV provenance + write-protection.
--
--   system_origin = NULL          → normal user-created work, all current rules apply
--                 = 'anniversary'  → auto-generated for a birth/death anniversary
--                 = 'festival'     → auto-generated for a festival (120 future)
--                 = 'admin'        → manually created by admin via curation
--
-- All system_origin != NULL works are owned by the system admin user
-- (resolved via SYSTEM_ADMIN_USER_ID env, fallback to first is_admin=true
-- user). They are FORCED to: visibility=public, all prices=0, buyout
-- disabled, tips enabled. Any UPDATE on these rows that tries to change
-- pricing or transfer ownership is rejected at the SQL trigger level.

ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS system_origin TEXT;

CREATE INDEX IF NOT EXISTS user_works_system_origin_idx
  ON user_works (system_origin) WHERE system_origin IS NOT NULL;

-- For anniversary dedup: never generate the same person × event_type
-- on the same calendar day twice. (person_id, event_type, date_key).
CREATE TABLE IF NOT EXISTS anniversary_generation_log (
  id           BIGSERIAL PRIMARY KEY,
  person_id    TEXT NOT NULL,
  event_type   TEXT NOT NULL,          -- 'birth' | 'death'
  date_key     TEXT NOT NULL,          -- 'MM-DD' for annual recurrence
  work_id      UUID REFERENCES user_works(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (person_id, event_type, date_key)
);

CREATE INDEX IF NOT EXISTS anniversary_generation_log_date_idx
  ON anniversary_generation_log (date_key);

-- Trigger: refuse pricing/visibility/buyout/listen mutations on
-- system-generated works. The system_origin flag stays sacred.
CREATE OR REPLACE FUNCTION cssos_protect_system_works()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.system_origin IS NOT NULL THEN
    -- Allow: title/style/lyrics_preview/cover_image refreshes (curation)
    -- Block: ownership transfer, pricing escape, system_origin tamper
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'cssos_system_work_immutable: cannot reassign ownership';
    END IF;
    IF NEW.system_origin IS DISTINCT FROM OLD.system_origin THEN
      RAISE EXCEPTION 'cssos_system_work_immutable: cannot change system_origin flag';
    END IF;
    -- suggested_listen/buyout > 0 silently rejected (kept at 0)
    NEW.suggested_listen_price_cents := 0;
    NEW.suggested_buyout_price_cents := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cssos_protect_system_works_trig ON user_works;
CREATE TRIGGER cssos_protect_system_works_trig
  BEFORE UPDATE ON user_works
  FOR EACH ROW EXECUTE FUNCTION cssos_protect_system_works();
