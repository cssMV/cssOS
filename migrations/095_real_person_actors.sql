-- CSSOS_WAVE_114 20260702 — Jing「真人数字演员签约(肖像权/声音权授权)」。
-- 重大转向: 之前铁律=清除一切真人(防未授权肖像权)。现在【本人知情同意+核验+授权】的真人可【主动签约】上架
--   = 合法授权模式(同 SAG-AFTRA 数字替身)。抓取/冒充仍严禁; 未核验真人演员绝不上架。
-- 目标: 真人(明星+普通人)+ 虚拟 = 全球最大数字演员市场。

-- ① digital_actors 支持 real_person(放开 CHECK), 加核验/授权字段。
ALTER TABLE digital_actors DROP CONSTRAINT IF EXISTS digital_actors_origin_type_check;
ALTER TABLE digital_actors ADD CONSTRAINT digital_actors_origin_type_check
  CHECK (origin_type IN ('synthetic', 'civilization', 'real_person'));

ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS is_real_person   BOOLEAN NOT NULL DEFAULT false;
-- 核验状态: unverified(刚建) | pending(已提交待审) | verified(通过, 可上架) | rejected。
--   铁律: 只有 verified 的真人演员才 visibility=public 上架。
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified'
  CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));
-- 授权: 本人授予平台的权利(肖像/声音/歌唱 分别可勾), + 授权签署时间 + 版本 + 可撤销。
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS rights_granted   JSONB;   -- {likeness:true,voice:true,singing:true,terms_version:"1.0"}
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS consent_signed_at TIMESTAMPTZ;
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS consent_revoked_at TIMESTAMPTZ;
-- 名人/普通人区分(名人需更高核验 + 经纪公司)。
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS is_public_figure BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS agency_name      TEXT;
-- 采集的肖像/声音资料引用(R2, 私有): 转圈视频/多角度照 + 说/唱样本。
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS likeness_capture JSONB;   -- {turnaround_video_url, photos:[...], captured_at}
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS voice_capture    JSONB;   -- {speech_url, singing_url, rvc_model_ref, captured_at}
-- 戏路(自主设置): 擅长的角色类型/题材(演员自填)。
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS role_range       TEXT;

CREATE INDEX IF NOT EXISTS digital_actors_realperson_idx ON digital_actors (is_real_person, verification_status);

-- ② 身份核验记录(不存原始证件! 只存第三方核验提供商的引用 + 结论 + 审核人)。PII 合规。
CREATE TABLE IF NOT EXISTS actor_verifications (
  verification_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id           TEXT NOT NULL REFERENCES digital_actors(actor_id) ON DELETE CASCADE,
  user_id            UUID NOT NULL,
  method             TEXT NOT NULL DEFAULT 'self_liveness',  -- self_liveness | id_provider | agency_review | manual
  provider           TEXT,                 -- stripe_identity | persona | ...(第三方; 平台不存原始证件)
  provider_ref       TEXT,                 -- 第三方核验会话 id(不透明)
  liveness_ref       TEXT,                 -- 活体自拍/转圈引用(R2 私有)
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected', 'needs_more_info')),
  reviewer_note      TEXT,
  reviewed_by        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS actor_verifications_actor_idx  ON actor_verifications (actor_id);
CREATE INDEX IF NOT EXISTS actor_verifications_status_idx ON actor_verifications (status);

-- ③ 授权书签署审计(不可篡改的同意记录; 撤销也记一条)。
CREATE TABLE IF NOT EXISTS actor_consents (
  consent_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id           TEXT NOT NULL REFERENCES digital_actors(actor_id) ON DELETE CASCADE,
  user_id            UUID NOT NULL,
  action             TEXT NOT NULL DEFAULT 'grant',  -- grant | revoke
  rights             JSONB NOT NULL,                 -- {likeness,voice,singing}
  terms_version      TEXT NOT NULL,
  ip_hash            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS actor_consents_actor_idx ON actor_consents (actor_id);
