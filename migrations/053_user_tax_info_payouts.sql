-- CSSOS_WAVE105 20260508 — Jing — creator KYC / tax records + payout records.
-- Additive only. tax_id is stored encrypted at rest (AES-256-GCM, see lib).

CREATE TABLE IF NOT EXISTS user_tax_info (
  user_id UUID PRIMARY KEY,
  legal_name TEXT,
  country_code TEXT NOT NULL,
  tax_id TEXT,                       -- encrypted (base64 of iv|tag|ciphertext)
  tax_id_last4 TEXT,                 -- for display (clear)
  tax_id_type TEXT,                  -- 'ssn' | 'ein' | 'individual' | 'vat' | 'other'
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state_region TEXT,
  postal_code TEXT,
  email_for_tax TEXT,
  is_us_taxpayer BOOLEAN,
  business_type TEXT,                -- 'individual' | 'sole_proprietor' | 'llc' | 'corp'
  certified_at TIMESTAMPTZ,
  ip_at_certification TEXT,
  encryption_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payout_records (
  payout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount_usd_cents BIGINT NOT NULL,
  source TEXT NOT NULL,              -- 'affiliate_commission' | 'premium_share'
  status TEXT NOT NULL DEFAULT 'pending',
  external_payout_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payout_records_user_idx
  ON payout_records (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payout_records_status_idx
  ON payout_records (status, created_at DESC);
