-- CSSOS_WAVE_112 20260511 — Jing
-- Cities / Landmarks MV — Civilization Universe expansion.
-- Mirror of person_profiles (Wave 110) so the existing pipeline
-- (lyrics + music + cover + video + compose) works verbatim;
-- landmark-specific fields (location, period, related_persons[])
-- enrich the LLM prompt with place-of-event context.

CREATE TABLE IF NOT EXISTS landmark_profiles (
  landmark_id        TEXT PRIMARY KEY,
  name_zh            TEXT NOT NULL,
  name_en            TEXT NOT NULL,
  /* Wikidata-style multi-language labels — populated at seed or
   * via the LLM at ad-hoc creation. Hero card surfaces a few
   * variants below the locale-primary name. */
  name_variants      JSONB NOT NULL DEFAULT '{}'::jsonb,
  /* Free-form short name in the locale of origin (e.g. "长城"
   * for The Great Wall, "コロッセオ" for Colosseum in Japanese). */
  name_native        TEXT,
  /* Latin transliteration if applicable. */
  name_latin         TEXT,
  /* Civilization the landmark primarily belongs to. */
  civilization       TEXT NOT NULL,
  /* Era when the landmark was BUILT (or most relevant period). */
  era                TEXT,
  /* Geographic location string (display-friendly). Precise
   * coordinates live in coordinates column for future map UI. */
  location           TEXT,
  coordinates        JSONB,        -- { "lat": 40.4319, "lng": 116.5704 }
  /* Type / category — temple, palace, monument, city, mountain,
   * cave, ruin, garden, fortress, etc. */
  category           TEXT,
  /* Period/dynasty when built or first commissioned. */
  founded_year       INTEGER,      -- 公元年；BC 用负数
  /* Persons strongly associated with this landmark.
   * Array of person_profiles.person_id. */
  related_persons    TEXT[] NOT NULL DEFAULT '{}',
  /* Notable events tied to this landmark — array of short
   * narrative bullets the LLM can pick from for the story
   * angle. E.g. ["秦始皇巡视", "孟姜女哭长城", "1933 抗日喋血"] */
  notable_events     TEXT[] NOT NULL DEFAULT '{}',
  /* Visual symbols / motifs the cover engine can reference. */
  visual_symbols     TEXT[] NOT NULL DEFAULT '{}',
  /* Era-appropriate music style hint — LLM-populated. */
  music_style_hint   TEXT,
  tone               TEXT,
  /* Influence score — curated heuristic for tier sort. */
  influence_score    INTEGER NOT NULL DEFAULT 0,
  /* Risk / sensitivity notes (e.g. politically charged sites). */
  risk_notes         TEXT[] NOT NULL DEFAULT '{}',
  /* curated | auto | ad_hoc — same lifecycle as person_profiles. */
  source_status      TEXT NOT NULL DEFAULT 'curated',
  /* curation_tier — S = Hall of Fame, A = Notable, B = Compendium. */
  curation_tier      TEXT NOT NULL DEFAULT 'B',
  created_by_user_id UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS landmark_profiles_civ_idx
  ON landmark_profiles (civilization);
CREATE INDEX IF NOT EXISTS landmark_profiles_influence_idx
  ON landmark_profiles (influence_score DESC);
CREATE INDEX IF NOT EXISTS landmark_profiles_source_idx
  ON landmark_profiles (source_status);
CREATE INDEX IF NOT EXISTS landmark_profiles_tier_idx
  ON landmark_profiles (curation_tier);
CREATE INDEX IF NOT EXISTS landmark_profiles_category_idx
  ON landmark_profiles (category);
CREATE INDEX IF NOT EXISTS landmark_profiles_name_variants_gin
  ON landmark_profiles USING GIN (name_variants);
CREATE INDEX IF NOT EXISTS landmark_profiles_related_persons_gin
  ON landmark_profiles USING GIN (related_persons);

/* MVs created against a landmark — analog of person_mvs. The
 * compose pipeline writes here when the seed.__landmarkId is set.
 * Foreign key to landmark_profiles cascades the user-delete path
 * (Wave 109G semantics carry over). */
CREATE TABLE IF NOT EXISTS landmark_mvs (
  mv_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landmark_id        TEXT NOT NULL REFERENCES landmark_profiles(landmark_id) ON DELETE CASCADE,
  work_id            UUID NOT NULL,
  created_by_user_id UUID NOT NULL,
  scenario_seed      TEXT,
  story_angle        TEXT,           -- "built" | "witnessed" | "legend" | "destroyed" | "restored"
  duration_secs      INTEGER,
  approval_status    TEXT NOT NULL DEFAULT 'auto_published',
  visibility         TEXT NOT NULL DEFAULT 'public',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS landmark_mvs_landmark_idx
  ON landmark_mvs (landmark_id);
CREATE INDEX IF NOT EXISTS landmark_mvs_creator_idx
  ON landmark_mvs (created_by_user_id);
