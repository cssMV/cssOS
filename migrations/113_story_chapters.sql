-- CSSOS_WAVE_1801 — 长文故事落自己域名 (Jing)
--
-- 病根: 《重写我》12 章正文此刻只存在于 X 和 LinkedIn 的服务器上。三个后果:
--   ① X Article 基本不被 Google 收录 —— 两万多字对搜索引擎不可见;
--   ② 每个数字演员页面本该链到她自己那一章, 读者读完正热 → 直接进「问道」,
--      这条转化链现在是断的, 而它是整件事的商业闭环;
--   ③ 内容不在自己域名下 —— 和「生成的媒体必须落 R2」是同一条道理。
--
-- 本表存正文, 由 GET /story/:slug 服务端整页渲染(SEO 必须在首屏 HTML 里, 不能前端拼)。
-- 同一章的多语种是【多行】, 用 chapter_no 归组, 彼此 hreflang 互链。

CREATE TABLE IF NOT EXISTS story_chapters (
  slug            TEXT PRIMARY KEY,              -- rewrite-me-01-daji-en
  series          TEXT NOT NULL DEFAULT 'rewrite-me',
  chapter_no      INT  NOT NULL,                 -- 1..12, 同章不同语种共用
  lang            TEXT NOT NULL,                 -- BCP-47: en / zh / es / ja / el / ko / hi / he / fr / it / de
  title           TEXT NOT NULL,
  dek             TEXT,                          -- 一句话导语, 供 og:description / 列表页
  body_html       TEXT NOT NULL,                 -- 正文 HTML(<h2>/<p>/<blockquote>/<strong>/<em>)
  hero_image      TEXT,                          -- 5:2 题图 URL
  actor_ids       TEXT[] NOT NULL DEFAULT '{}',  -- 本章出场的数字演员 → 页面底部「面对面」入口
  external_url    TEXT,                          -- 首发那条 X Article, 保留出处
  published_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS story_chapters_series_no_idx ON story_chapters (series, chapter_no, lang);
CREATE INDEX IF NOT EXISTS story_chapters_actor_idx     ON story_chapters USING GIN (actor_ids);

-- 反向指针: 演员页要知道「我的那一章在哪」。
-- 用列而不是每次 GIN 反查, 是因为演员页是热路径(画廊每张卡都可能要它)。
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS story_slug TEXT;
