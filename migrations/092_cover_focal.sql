-- CSSOS 20260701 — Layer 2「封面人脸焦点」事后补救(旧封面)。
-- 源头已强制 2.39 电影 + 人脸感知构图(此后新封面无需裁切);此两列供【旧封面】
-- 经 face-focal worker(:7898)检测后落库,前端/原生按此设 object-position 永不削头。
-- NULL = 未检测 / 无脸(风景器物封面),前端回落默认偏上裁剪(center 22%)。
ALTER TABLE user_works ADD COLUMN IF NOT EXISTS cover_focal_x REAL;
ALTER TABLE user_works ADD COLUMN IF NOT EXISTS cover_focal_y REAL;
