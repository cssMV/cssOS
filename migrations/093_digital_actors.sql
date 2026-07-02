-- CSSOS_WAVE_113 20260702 — Jing「数字演员(Digital Actor)立项」Phase 1 地基。
-- 可复用、身份锁定的 AI 演员: 一张锁定脸(参考图 + face_prompt)+ 一副固定嗓音(RVC 声纹)
-- + 一套风格, 可被无限次"选角"进 MV/对话/短剧/电影, 跨作品保持一致。平台自营虚拟经纪公司。
--
-- 铁律(源头堵法律风险): 只做 ① AI 原创合成脸 ② 历史文明人物(公共领域)。
--   绝不接受用户上传【在世真人】脸(肖像权地雷, 见 purge-living-real-people)。
-- 结构镜像 landmark_profiles(Wave 112), 复用现有 MV 生成/图鉴/删除管线。

CREATE TABLE IF NOT EXISTS digital_actors (
  actor_id           TEXT PRIMARY KEY,
  name_zh            TEXT NOT NULL,
  name_en            TEXT NOT NULL,
  name_variants      JSONB NOT NULL DEFAULT '{}'::jsonb,
  name_native        TEXT,
  name_latin         TEXT,
  /* 身份来源: 'synthetic' = AI 原创合成脸(无真人); 'civilization' = 历史文明人物。
   * 铁律: 绝不 'real_person'(在世真人肖像权)。 */
  origin_type        TEXT NOT NULL DEFAULT 'synthetic'
                       CHECK (origin_type IN ('synthetic', 'civilization')),
  /* 文明归属(civilization actor 用; synthetic 可留原创世界观标签)。 */
  civilization       TEXT,
  /* 若 origin_type='civilization', 链到 person_profiles.person_id。 */
  person_id          TEXT,
  /* 人设/简介(母语优先, 英文兜底; 绝不中文硬编码 非中文演员)。 */
  persona            TEXT,
  bio                TEXT,
  /* 🔒 身份锁: 锁定脸的参考图(R2 稳定链, 多角度), 生成时作条件参考保持一致。 */
  reference_images   TEXT[] NOT NULL DEFAULT '{}',
  /* 🔒 身份锁: 供图像引擎复述的固定外貌描述(发型/脸型/肤色/标志特征), 跨镜头锁脸。 */
  face_prompt        TEXT,
  /* 展示封面 + 人脸焦点(复用 Layer 2 :7898)。 */
  cover_image        TEXT,
  cover_focal_x      REAL,
  cover_focal_y      REAL,
  /* 🔒 身份锁: RVC 声纹引用(自建声线基座 voice model id / 描述)+ 声线风格。 */
  voice_model_ref    TEXT,
  voice_style        TEXT,
  /* 外貌轴 — 供选角筛选 + prompt 注入。 */
  gender             TEXT,          -- female | male | androgynous | nonbinary
  age_range          TEXT,          -- teen | young_adult | adult | mature | elder
  appearance_tags    TEXT[] NOT NULL DEFAULT '{}',
  style_descriptor   TEXT,
  tags               TEXT[] NOT NULL DEFAULT '{}',
  /* 3D 出演资产(TripoSR :7897 生成; Vision Pro 空间出演用)。 */
  model_3d_url       TEXT,
  /* ——— 变现(Phase 1: 平台自营溢价演员) ———
   * is_premium: 是否收费选角。cast_price_cents: 每次选角费。
   * license_model: per_cast(按次) | subscription(订阅内免费) | free。 */
  is_premium         BOOLEAN NOT NULL DEFAULT false,
  cast_price_cents   INTEGER NOT NULL DEFAULT 0,
  license_model      TEXT NOT NULL DEFAULT 'free'
                       CHECK (license_model IN ('free', 'per_cast', 'subscription')),
  /* owner_user_id = NULL → 平台自营演员(Phase 1 主体)。
   * 非 NULL → 创作者拥有(Phase 3 UGC 市场 + 版税用)。 */
  owner_user_id      UUID,
  /* Phase 3 UGC 市场版税分成(0~1, 平台抽成 = 1 - 此值)。 */
  creator_royalty    REAL NOT NULL DEFAULT 0,
  visibility         TEXT NOT NULL DEFAULT 'public',
  /* curated | auto | ad_hoc。 */
  source_status      TEXT NOT NULL DEFAULT 'curated',
  /* S = 台柱名角, A = 常青, B = 图鉴。 */
  curation_tier      TEXT NOT NULL DEFAULT 'B',
  /* 人气/热度 — 选角次数驱动的排序启发。 */
  popularity_score   INTEGER NOT NULL DEFAULT 0,
  cast_count         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS digital_actors_origin_idx      ON digital_actors (origin_type);
CREATE INDEX IF NOT EXISTS digital_actors_civ_idx         ON digital_actors (civilization);
CREATE INDEX IF NOT EXISTS digital_actors_person_idx      ON digital_actors (person_id);
CREATE INDEX IF NOT EXISTS digital_actors_owner_idx       ON digital_actors (owner_user_id);
CREATE INDEX IF NOT EXISTS digital_actors_popularity_idx  ON digital_actors (popularity_score DESC);
CREATE INDEX IF NOT EXISTS digital_actors_tier_idx        ON digital_actors (curation_tier);
CREATE INDEX IF NOT EXISTS digital_actors_premium_idx     ON digital_actors (is_premium);
CREATE INDEX IF NOT EXISTS digital_actors_tags_gin        ON digital_actors USING GIN (tags);

-- 选角记录: 哪个演员被选进哪个作品(+ 计费快照, 供分成/统计)。
CREATE TABLE IF NOT EXISTS actor_castings (
  casting_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id           TEXT NOT NULL REFERENCES digital_actors(actor_id) ON DELETE CASCADE,
  work_id            UUID NOT NULL,
  created_by_user_id UUID NOT NULL,
  role_name          TEXT,            -- 该演员在此作品里的角色名(可选)
  cast_price_cents   INTEGER NOT NULL DEFAULT 0,   -- 收费快照(计费时点)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS actor_castings_actor_idx   ON actor_castings (actor_id);
CREATE INDEX IF NOT EXISTS actor_castings_work_idx    ON actor_castings (work_id);
CREATE INDEX IF NOT EXISTS actor_castings_creator_idx ON actor_castings (created_by_user_id);
