CREATE TABLE IF NOT EXISTS i18n_translations (
  english_hash    TEXT NOT NULL,
  locale          TEXT NOT NULL,
  english_source  TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  context         TEXT,
  provider        TEXT NOT NULL DEFAULT 'openai',
  model           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (english_hash, locale)
);

CREATE INDEX IF NOT EXISTS i18n_translations_locale_idx
  ON i18n_translations (locale);

CREATE INDEX IF NOT EXISTS i18n_translations_created_at_idx
  ON i18n_translations (created_at DESC);
