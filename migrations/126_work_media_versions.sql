-- CSSOS_WAVE_2086 20260910 — 作品媒体【一版一行】。
--
-- Jing:「歌词/字幕, 声线/音轨, 画面/视频的存储方式必须是数组, 不要用单一的值,
--        不然很容易被覆盖掉。」「覆盖, 就是删掉。」
--
-- 代价: 2026-08-24 一批重生成把 17 个作品的旧版音乐【原地覆盖】, 永久丢失 ——
-- 唐伯虎三部曲、李白·举杯邀月、苏东坡·千里共婵娟、Jerusalem×2 等。不可恢复。
--
-- 为什么必须动数据结构, 而不是"以后小心点":
--   单值字段(user_works.cover_url / subtitle_take1_json_url、
--   work_language_tracks.audio_url)【结构性地只能装一个】—— 下一次写入必然删掉上一个。
--   靠"记得调用 uploadR2NeverOverwrite"是纪律, 纪律会松; 结构不会。
--   在这张表里, 新版本 = 一条 INSERT, 而 **INSERT 删不掉任何东西**。
--
-- 为什么不用"一个 json 文件里存多个版本"(Jing 原本的提法):
--   那个 json 文件本身又是一个单值 —— 一次覆盖就丢掉【全部】版本, 比现在更惨。
--   所以底层用行, API 层再拼成 json 数组给前端 —— 形态还是他要的那个, 但物理上装不下"只有一个"。
CREATE TABLE IF NOT EXISTS work_media_versions (
  id            BIGSERIAL PRIMARY KEY,
  work_id       UUID NOT NULL,
  kind          TEXT NOT NULL,          -- audio | cover | video | subtitle | lyrics
  lang          TEXT,                   -- 声线/语言; 与语言无关的(封面)留空
  version_no    INTEGER NOT NULL,       -- 1 起递增, 同一 (work, kind, lang) 内唯一
  label         TEXT,                   -- 给用户看的版本名: 「原版旋律」「史诗编曲」
  url           TEXT NOT NULL,          -- 这一版【自己的】地址, 绝不与他版共用
  subtitle_url  TEXT,                   -- 这一版【自己的】字幕(音轨版本用)
  duration_secs INTEGER,
  is_current    BOOLEAN NOT NULL DEFAULT false,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 版本号不可重用: 同一 (作品, 轨类, 声线) 下 version_no 唯一
CREATE UNIQUE INDEX IF NOT EXISTS wmv_version_uniq
  ON work_media_versions (work_id, kind, COALESCE(lang, ''), version_no);

-- 同一份字节只登记一次(重复登记是善意的, 不该产生假版本)
CREATE UNIQUE INDEX IF NOT EXISTS wmv_url_uniq
  ON work_media_versions (work_id, kind, COALESCE(lang, ''), url);

-- 每个 (作品, 轨类, 声线) 只能有一个"当前版本"
CREATE UNIQUE INDEX IF NOT EXISTS wmv_one_current
  ON work_media_versions (work_id, kind, COALESCE(lang, ''))
  WHERE is_current;

CREATE INDEX IF NOT EXISTS wmv_work_kind
  ON work_media_versions (work_id, kind, version_no);

-- 【守门员】同一个 URL 不许被两个版本共用 —— 那正是 W2061/W2086 的病根:
-- 库里留了"旧版"记录, 却和新版指向同一个 key, 记录留住了字节没留住。
-- 这条约束让那种状态在数据库层面直接写不进去。
CREATE OR REPLACE FUNCTION wmv_reject_shared_url() RETURNS TRIGGER AS $$
BEGIN
  -- 判重必须【带上 lang】: 多个语言共用同一条音频是正常的(一首曲子配多语言字幕),
  -- 真正的病根是【同一语言的两个版本】指向同一份字节 —— 那才叫旧版没有自己的地址。
  IF EXISTS (
    SELECT 1 FROM work_media_versions v
     WHERE v.work_id = NEW.work_id AND v.kind = NEW.kind
       AND COALESCE(v.lang, '') = COALESCE(NEW.lang, '')
       AND v.url = NEW.url AND v.id <> COALESCE(NEW.id, -1)
  ) THEN
    RAISE EXCEPTION '同一声线的两个版本共用同一个 URL, 旧版将被覆盖: work=% kind=% lang=% url=%',
      NEW.work_id, NEW.kind, COALESCE(NEW.lang, ''), NEW.url;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wmv_reject_shared_url_trg ON work_media_versions;
CREATE TRIGGER wmv_reject_shared_url_trg
  BEFORE INSERT OR UPDATE ON work_media_versions
  FOR EACH ROW EXECUTE FUNCTION wmv_reject_shared_url();
