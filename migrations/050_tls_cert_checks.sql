-- CSSOS_WAVE100 20260508 — Jing — TLS / cert validity monitor.
-- Daily probe records expiry headroom; admin alert when <14 days. Additive.

CREATE TABLE IF NOT EXISTS tls_cert_checks (
  id BIGSERIAL PRIMARY KEY,
  hostname TEXT NOT NULL,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  days_remaining INTEGER,
  issuer TEXT,
  ok BOOLEAN NOT NULL,
  error TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tls_cert_checks_host_ts_idx
  ON tls_cert_checks (hostname, checked_at DESC);
