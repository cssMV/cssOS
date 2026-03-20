CREATE TABLE IF NOT EXISTS css_case_delivery_logs (
    delivery_log_id TEXT PRIMARY KEY,
    subscription_id TEXT,
    subscriber_id TEXT,
    target TEXT NOT NULL,
    format TEXT NOT NULL,
    mode TEXT NOT NULL,
    delivered BOOLEAN NOT NULL,
    message TEXT NOT NULL,
    payload_name TEXT,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_logs_subscription
ON css_case_delivery_logs(subscription_id);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_logs_subscriber
ON css_case_delivery_logs(subscriber_id);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_logs_target
ON css_case_delivery_logs(target);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_logs_mode
ON css_case_delivery_logs(mode);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_logs_created_at
ON css_case_delivery_logs(created_at);
