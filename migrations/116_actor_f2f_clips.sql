-- CSSOS_WAVE_1830 — 面对面的演员从静态图变成会动的人 (Jing, 2026-08-16)
--
-- 背景: 面对面(Face on Face)里, 用户那一侧是【真摄像头视频】, 演员那一侧却是一张
--   静态封面 + 一片 CSS 动嘴贴片。一边活的一边死的, 视频通话的语法立不住。
--
-- Jing 看完妲己试片:「数字演员动得很自然, 如果让人物说话的时候, 嘴唇也动一下就更加完美了。」
--   → 每位演员存【两态】:
--       f2f_idle_url — 待机(安静听你说, 嘴闭合)
--       f2f_talk_url — 说话(嘴唇自然开合)
--   面对面已有的 .speaking class 直接切换这两条, 不必接唇形同步引擎。
--
-- 为什么不是实时对口型: 平台没接 talking-head/lipsync 引擎(hedra/heygen/wav2lip 一个都没有),
--   接一个是另一个量级的工程。两态循环片是【今天就能上】的九成效果, 成本 $0.65/条、一次性。
--
-- 为什么存 URL 而不是存文件路径: 这两条片子和 MV 一样走 /artifacts/mv/ 静态目录,
--   落我们自己域名(生成即落库铁律 [[all-generated-media-must-persist-to-r2]]);
--   存全 URL 前端直接用, 不必再拼。
--
-- 允许为 NULL: 278 位演员里只有故事主角先铺。没有片子的一律回落到现有静态封面,
--   一行都不会坏 —— 这是刻意的, 铺开可以慢慢来。

ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS f2f_idle_url TEXT;
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS f2f_talk_url TEXT;
