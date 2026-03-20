ALTER TABLE payout_reconciliations
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NULL;

ALTER TABLE payout_reconciliations
  ADD COLUMN IF NOT EXISTS transfer_attempted_at TIMESTAMPTZ NULL;

ALTER TABLE payout_reconciliations
  ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS payout_reconciliations_status_available_idx
  ON payout_reconciliations(status, available_at, created_at DESC);

UPDATE payout_reconciliations
SET available_at = created_at + INTERVAL '14 days'
WHERE available_at IS NULL
  AND status IN ('pending', 'pending_settlement', 'pending_connected_account', 'transfer_failed');
