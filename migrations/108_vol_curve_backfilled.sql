-- CSSOS_WAVE_1746 20260711 — Jing「vol_curve 回填」: 标记该作品的字幕 JSON 是否已算过整曲音量包络
--   (vol_curve, 同源 envelope, 供波形绘制 + 自动对齐兜底, 不依赖 CDN CORS)。回填端点据此高效分批、
--   可断点续跑(DB 层跳过已处理, 不重扫)。true = 已填 / 已确认有曲线 / 无音频(终态);
--   瞬时失败(computeVolumeCurve 返回 null / 下载失败)留 false, 下一轮自动重试。
ALTER TABLE user_works ADD COLUMN IF NOT EXISTS vol_curve_backfilled boolean NOT NULL DEFAULT false;
