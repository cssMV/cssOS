CREATE TABLE IF NOT EXISTS css_disputes (
    dispute_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL,
    catalog_id TEXT,
    ownership_id TEXT,
    deal_id TEXT,
    user_id TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_css_disputes_catalog
ON css_disputes(catalog_id);

CREATE INDEX IF NOT EXISTS idx_css_disputes_ownership
ON css_disputes(ownership_id);

CREATE INDEX IF NOT EXISTS idx_css_disputes_deal
ON css_disputes(deal_id);

CREATE INDEX IF NOT EXISTS idx_css_disputes_user
ON css_disputes(user_id);
