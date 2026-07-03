-- 合成演员可跨文明(多选/全文明)。单 civilization 保留给文明名角; UGC 合成用数组。
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS civilizations TEXT[];
