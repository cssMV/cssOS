-- CSSOS_WAVE_587 — 「用我的声音唱」: 每个用户的个人 RVC 声纹模型。
-- 用户录/传一段自己的声音(带同意) → 训练 RVC → 个人声纹入库 → 出现在 🎤 多声线胶囊。
-- voice_key 直接用作 work_language_tracks.voice(如 u_ab12cd34_1), 渲染时按它查到 model_url。
CREATE TABLE IF NOT EXISTS user_voice_models (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL,
  voice_key   TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL DEFAULT 'My Voice',
  gender      TEXT,                                   -- m | f | child
  model_url   TEXT,                                   -- 训练好的 RVC .zip(稳定 URL)
  dataset_url TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',        -- pending | training | ready | failed
  is_public   BOOLEAN NOT NULL DEFAULT false,         -- 私密默认; 仅本人作品可用(除非公开, 如创始人声线)
  consent_at  TIMESTAMPTZ,                            -- 用户明确同意「这是我本人声音, 授权使用」的时间
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_voice_models_user_idx ON user_voice_models (user_id);
CREATE INDEX IF NOT EXISTS user_voice_models_public_idx ON user_voice_models (is_public) WHERE is_public = true;
