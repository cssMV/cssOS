ALTER TABLE css_case_delivery_policy_audits
ADD COLUMN IF NOT EXISTS policy_audit_id TEXT;

UPDATE css_case_delivery_policy_audits
SET policy_audit_id = audit_id
WHERE policy_audit_id IS NULL;

ALTER TABLE css_case_delivery_policy_audits
ADD COLUMN IF NOT EXISTS success BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE css_case_delivery_policy_audits
ADD COLUMN IF NOT EXISTS policy_version_id TEXT;

ALTER TABLE css_case_delivery_policy_audits
ADD COLUMN IF NOT EXISTS from_policy_version_id TEXT;

ALTER TABLE css_case_delivery_policy_audits
ADD COLUMN IF NOT EXISTS to_policy_version_id TEXT;

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policy_audits_policy_version_id
ON css_case_delivery_policy_audits(policy_version_id);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policy_audits_actor_user_id
ON css_case_delivery_policy_audits(actor_user_id);
