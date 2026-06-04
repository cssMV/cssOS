-- CSSOS_WAVE_544 20260531 — Jing「每个作品的信息都要完整, 否则编辑时找不到」
-- 根因: 桌面默认输出电影超宽 2.39:1, 但宽高比/分辨率/朝向从不入库 →
--   回放无从还原 → 退回 16:9 / App 按设备拉伸成 9:16 观感。
-- 修复: 把 MV 管线的画幅信息 + mood/ambience 作为作品行的一等字段持久化。
-- 全部 IF NOT EXISTS, 幂等可重跑。

ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS aspect_ratio TEXT,            -- 例: '2.39:1' / '16:9' / '9:16' / '1:1'
  ADD COLUMN IF NOT EXISTS frame_width  INTEGER,         -- 渲染像素宽, 例 2560
  ADD COLUMN IF NOT EXISTS frame_height INTEGER,         -- 渲染像素高, 例 1072
  ADD COLUMN IF NOT EXISTS orientation  TEXT,            -- 'ultra-wide' | 'landscape' | 'square' | 'portrait'
  ADD COLUMN IF NOT EXISTS mood         TEXT,            -- 高级设置: 情绪
  ADD COLUMN IF NOT EXISTS ambience     TEXT;            -- 高级设置: 环境音/氛围
