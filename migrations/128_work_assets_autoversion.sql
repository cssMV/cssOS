-- CSSOS_WAVE_2262 20261030 — work_assets 的覆盖【自动登记成版本】。
--
-- Jing 2026-10-30:「work_assets 有个唯一索引, 结构上只能存一个版本。要改, 怎么改, 按你的建议做。」
--
-- 病灶:
--   CREATE UNIQUE INDEX work_assets_work_asset_type_idx
--     ON work_assets (work_id, asset_type) WHERE asset_type <> 'slideshow_frame';
--   → 除幻灯帧外, 每个作品每种资产【结构上只能有一行】。于是每一次
--     `ON CONFLICT ... DO UPDATE SET url=EXCLUDED.url` 都是【原地覆盖】:
--     新地址盖掉旧地址, 旧版本从此在库里没有任何入口。
--     这正是 W2061/W2086 丢掉 17 首旧版音乐的那个形状。
--
-- 为什么【不是】直接把这个唯一索引删掉:
--   删掉之后 work_assets 每个 (work_id, asset_type) 就会有多行, 而全平台有 248 处读它,
--   其中 For You / 货架 / 作品树的主查询都是
--     `LEFT JOIN work_assets final_mv_asset ON ... AND asset_type='final_mv'`
--   —— 多出一行不会报错, 会【把整条结果乘以行数】: 每个作品在每个信息流里重复出现。
--   那是一次性落在所有端上的静默事故, 比它要治的病更重。
--   而且读侧漏改一处就错一处 —— 又回到"靠纪律"。
--
-- 为什么【不是】另建一张归档表:
--   版本表早就有了 —— work_media_versions(W2086, kind=audio|cover|video|subtitle|lyrics,
--   一版一行, 天生无上限), 而且 **多声线胶囊已经在读它**
--   (public/app.mv-language-pill.js、app.lang-flag-pills.js)。
--   再造一张 = 重复造轮子, 且胶囊看不见。
--
-- 做法: 给 work_assets 装一个 BEFORE UPDATE OR DELETE 触发器 ——
--   资产地址被顶掉的那一刻, 把【旧的那一版】登记进 work_media_versions(is_current=false),
--   同时把【新的那一版】登记为 is_current=true。
--   应用层一行代码都不用改, 所以【不存在漏改的写入点】——
--   包括那些我根本不知道的代码路径。结构, 不是纪律。
--
-- 两条安全底线(都已实现):
--   ① 登记失败绝不能打断主写入。整段包在 EXCEPTION WHEN OTHERS THEN NULL 里 ——
--      版本登记是保护措施, 保护措施把被保护的东西弄挂了就是本末倒置。
--      (具体风险: wmv_reject_shared_url 那个守门员遇到重复 URL 会 RAISE, 它在 BEFORE INSERT
--       触发, ON CONFLICT 拦不住它 —— 所以这里先 NOT EXISTS 预检, 再拿 EXCEPTION 兜底。)
--   ② 只登记【地址真的变了】的那一次。url 没变只动 meta 的, 不产生假版本。
--
-- 音轨是特例 —— 只留档, 不认"当前版":
--   work_assets 的 audio_track_1 / audio_track_2 是【两个平格】, 不带声线身份
--   (src/index.ts:8458 的注释原话)。声线/语言的真家在 work_language_tracks + W2116 的 takes。
--   如果为了凑 work_media_versions 的 (work_id, kind, lang) 而给它们编一个 lang,
--   那就是 W2131 的老伤重演: 占位符 lang 会让原版字幕当场哑掉。
--   所以音轨【只把被顶掉的旧地址留档】(is_current 一律 false, 也绝不去动别人的 is_current),
--   保住字节地址而不冒认身份。音轨的版本正解在 takes 系统, 是另一件事。

CREATE OR REPLACE FUNCTION work_assets_autoversion() RETURNS TRIGGER AS $$
DECLARE
  v_kind TEXT;
  v_old_url TEXT;
  v_new_url TEXT;
  v_next INT;
BEGIN
  -- 资产类型 → 版本轨。不在表里的(幻灯帧/锁/引擎记录/死链标记/宪法)不登记。
  v_kind := CASE OLD.asset_type
    WHEN 'final_mv'      THEN 'video'
    WHEN 'canonical_mv'  THEN 'video'
    WHEN 'preview_video' THEN 'video'
    WHEN 'audio_track_1' THEN 'audio'
    WHEN 'audio_track_2' THEN 'audio'
    WHEN 'cover_image'   THEN 'cover'
    WHEN 'preview_image' THEN 'cover'
    WHEN 'cover_slide'   THEN 'cover'
    WHEN 'whisper_words' THEN 'subtitle'
    ELSE NULL END;
  IF v_kind IS NULL THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  v_old_url := NULLIF(TRIM(COALESCE(OLD.url, '')), '');
  v_new_url := CASE TG_OP WHEN 'DELETE' THEN NULL
                          ELSE NULLIF(TRIM(COALESCE(NEW.url, '')), '') END;

  -- 地址没变 = 没有新版本, 什么都不做(只动 meta 的更新走这里)
  IF TG_OP = 'UPDATE' AND v_old_url IS NOT DISTINCT FROM v_new_url THEN
    RETURN NEW;
  END IF;
  IF v_old_url IS NULL THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  BEGIN
    -- ① 把【被顶下来的旧版】登记进去(若该 URL 还没登记过)
    IF NOT EXISTS (
      SELECT 1 FROM work_media_versions v
       WHERE v.work_id = OLD.work_id AND v.kind = v_kind
         AND COALESCE(v.lang,'') = '' AND v.url = v_old_url
    ) THEN
      SELECT COALESCE(MAX(version_no), 0) + 1 INTO v_next
        FROM work_media_versions
       WHERE work_id = OLD.work_id AND kind = v_kind AND COALESCE(lang,'') = '';
      INSERT INTO work_media_versions
        (work_id, kind, lang, version_no, label, url, is_current, note, created_at)
      VALUES (OLD.work_id, v_kind, NULL, v_next,
              OLD.asset_type || ' v' || v_next, v_old_url, false,
              'W2262 自动登记: work_assets.' || OLD.asset_type || ' 被覆盖时留存的旧版',
              COALESCE(OLD.created_at, now()));
    END IF;

    -- ② 把【顶上来的新版】登记为当前版(DELETE 时没有新版, 跳过)
    --    音轨除外: 它没有声线身份, 不参与"当前版"的认定(见顶部说明)。
    IF v_new_url IS NOT NULL AND v_kind <> 'audio' THEN
      UPDATE work_media_versions SET is_current = false
       WHERE work_id = NEW.work_id AND kind = v_kind AND COALESCE(lang,'') = '' AND is_current;

      IF EXISTS (
        SELECT 1 FROM work_media_versions v
         WHERE v.work_id = NEW.work_id AND v.kind = v_kind
           AND COALESCE(v.lang,'') = '' AND v.url = v_new_url
      ) THEN
        UPDATE work_media_versions SET is_current = true
         WHERE work_id = NEW.work_id AND kind = v_kind
           AND COALESCE(lang,'') = '' AND url = v_new_url;
      ELSE
        SELECT COALESCE(MAX(version_no), 0) + 1 INTO v_next
          FROM work_media_versions
         WHERE work_id = NEW.work_id AND kind = v_kind AND COALESCE(lang,'') = '';
        INSERT INTO work_media_versions
          (work_id, kind, lang, version_no, label, url, is_current, note)
        VALUES (NEW.work_id, v_kind, NULL, v_next,
                NEW.asset_type || ' v' || v_next, v_new_url, true,
                'W2262 自动登记: work_assets.' || NEW.asset_type || ' 的当前版');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- 版本登记【绝不允许】打断主写入。记一条警告就放行。
    RAISE WARNING '[W2262] 版本自动登记失败(主写入不受影响): work=% type=% err=%',
      OLD.work_id, OLD.asset_type, SQLERRM;
  END;

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS work_assets_autoversion_trg ON work_assets;
CREATE TRIGGER work_assets_autoversion_trg
  BEFORE UPDATE OR DELETE ON work_assets
  FOR EACH ROW EXECUTE FUNCTION work_assets_autoversion();

COMMENT ON FUNCTION work_assets_autoversion() IS
  'W2262 — work_assets 每次换地址, 自动把旧版留在 work_media_versions(多声线胶囊读的就是它)。'
  '唯一索引保持不动: 删它会让 248 处读侧的 LEFT JOIN 变成乘法, 信息流里每个作品重复出现。';
