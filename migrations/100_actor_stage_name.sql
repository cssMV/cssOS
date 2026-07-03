-- 真人数字演员艺名(可留空)。有艺名则公开展示用艺名,本人姓名留档(name_zh + consent)。
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS stage_name TEXT;
