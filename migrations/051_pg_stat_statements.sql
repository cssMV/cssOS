-- CSSOS_WAVE101 20260508 — Jing — enable pg_stat_statements for slow query trap.
-- May fail if shared_preload_libraries does not include pg_stat_statements;
-- runtime code degrades gracefully to "extension not enabled" message.

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
