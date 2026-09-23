-- W2152 · 批量摘掉 Whisper 幻觉字幕指针 + 清掉被污染的歌词列
--
-- 这批作品全是【纯器乐 / 无人声】(战鼓 · 交响 · 古筝 · 琵琶 · 里拉琴 · 编钟 …),
-- Whisper 在没有唱词的音频上吐出了它的经典尾巴: "Thank you. Thank you." /
-- "Thanks for watching!" —— 既落进了字幕文件, 也被回写进了作品的 lyrics_preview。
-- 正确状态是【它们本来就没有唱词】, 不是把这两行修好。
--
-- 三处一起摘, 少一处就漏:
--   A 作品级 user_works.subtitle_take1_json_url        39 个
--   B 作品级 user_works.lyrics_preview                 40 个
--   C 轨级   work_language_tracks.subtitle_url          2 条 ← 只摘 A 会漏掉这两首
--
-- 判据是【已知幻觉短语 + 行数≤6】双证, 且短语匹配【空白不敏感】——
-- 凯撒那首的歌词是 "Thanks\nfor watching!", 中间是换行, 连续短语的正则漏过它一次。
--
-- 不删任何字节: R2 文件原样留着(那是 ASR 当时的输出记录), 只摘指针;
-- 歌词旧值进备份表。全部可一条 UPDATE 回滚。
BEGIN;
CREATE TABLE IF NOT EXISTS w2152_hallucination_backup (
  kind       text NOT NULL,          -- work_sub | work_lyrics | track_sub
  row_id     text NOT NULL,
  old_value  text,
  backed_up  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, row_id)
);

INSERT INTO w2152_hallucination_backup (kind,row_id,old_value)
SELECT 'work_sub', id::text, subtitle_take1_json_url FROM user_works
 WHERE id IN ('0134d682-01fe-435b-bef9-307e94d5a712','0962a36e-62f9-49f8-987f-34f03a5573f7','0b02ba6b-862b-4587-a0ab-8410f4c78056','0cfd8a28-2589-4a36-8247-f8fe07b789bf','11c61590-b895-4ad9-93fd-62fa378c37c3','1325b54d-6dbd-4e14-8437-5e181fb15370','1c01a7ab-7800-404e-a61d-ae24cce336db','2576d5a4-cfc0-4819-8ba8-fec3348267eb','295df1b2-9ae9-4ad8-84f0-109d44b541af','2bd81e16-8c97-4257-8bd9-0752d90b949c','2d076fb7-ac5e-481c-9245-ee9d5d653531','32be0175-c7aa-4b67-bb9d-093f2d57c23c','3591eaac-f81e-4113-a7f6-6749ac69b4e9','384afb85-ee68-4a57-b0ea-b1fc46804ced','3d9e2383-4e18-47c2-ba67-9f677f826ab4','52fa8a6b-58dc-4e7d-915f-001a083ca01c','5714ce53-faf8-4cab-9ca8-5a9a83101ee0','63c2897f-bd58-4117-ae20-fba2bcc26760','7abd9957-9c5a-411c-954b-80b7ab6898d5','7d4c7079-9b1a-4664-b810-1b28d4b82963','7e89a073-e137-463c-94f1-9ac38a2b13c6','7f07dc6b-61fd-4174-9cd4-9c1d31e34887','82a378ef-a283-4570-8046-a6ff143eb6de','8cae87d4-1d2c-46f3-a2ad-dbe1c90de806','91975d94-2f49-47df-aad8-f4d7e2cc1aef','92e283b7-757f-402c-a58f-ed4e1c2aad32','941fba49-3d65-465b-8ff9-042daac2c075','9b3c1419-4e54-4fbe-a9af-6418803a77f6','9e1c40e8-1096-4f3d-a893-a898537dadab','9ec74342-69e9-44a5-aa6f-a1068c516d55','a90be5e9-cdbe-4bbe-bc5a-31232c8d2b36','adf12dd9-3d67-447c-b9dd-e30dc7114b41','bc5a26ce-c233-4627-9dda-47c735f90a11','c2da5ea5-9bc1-457a-a4e8-93195cd45752','cb8bffd0-6055-465c-b487-8ee894fc5508','e4239d20-9b72-404f-99d2-7947adb8c270','e70f07c7-b1a9-4df6-b1d5-98a20c6119ce','f91397ae-3591-4ace-b96c-7473ef937738','ffe88986-1180-4ad3-98f1-b3d6fc02f69e') AND coalesce(subtitle_take1_json_url,'')<>''
ON CONFLICT DO NOTHING;

INSERT INTO w2152_hallucination_backup (kind,row_id,old_value)
SELECT 'work_lyrics', id::text, lyrics_preview FROM user_works
 WHERE id IN ('0134d682-01fe-435b-bef9-307e94d5a712','0962a36e-62f9-49f8-987f-34f03a5573f7','0b02ba6b-862b-4587-a0ab-8410f4c78056','0cfd8a28-2589-4a36-8247-f8fe07b789bf','11c61590-b895-4ad9-93fd-62fa378c37c3','1325b54d-6dbd-4e14-8437-5e181fb15370','1c01a7ab-7800-404e-a61d-ae24cce336db','2576d5a4-cfc0-4819-8ba8-fec3348267eb','295df1b2-9ae9-4ad8-84f0-109d44b541af','2bd81e16-8c97-4257-8bd9-0752d90b949c','2d076fb7-ac5e-481c-9245-ee9d5d653531','32be0175-c7aa-4b67-bb9d-093f2d57c23c','3591eaac-f81e-4113-a7f6-6749ac69b4e9','384afb85-ee68-4a57-b0ea-b1fc46804ced','3d9e2383-4e18-47c2-ba67-9f677f826ab4','4b837997-b212-4240-8b23-c4dad241c33e','52fa8a6b-58dc-4e7d-915f-001a083ca01c','5714ce53-faf8-4cab-9ca8-5a9a83101ee0','63c2897f-bd58-4117-ae20-fba2bcc26760','7abd9957-9c5a-411c-954b-80b7ab6898d5','7d4c7079-9b1a-4664-b810-1b28d4b82963','7e89a073-e137-463c-94f1-9ac38a2b13c6','7f07dc6b-61fd-4174-9cd4-9c1d31e34887','82a378ef-a283-4570-8046-a6ff143eb6de','8cae87d4-1d2c-46f3-a2ad-dbe1c90de806','91975d94-2f49-47df-aad8-f4d7e2cc1aef','92e283b7-757f-402c-a58f-ed4e1c2aad32','941fba49-3d65-465b-8ff9-042daac2c075','9b3c1419-4e54-4fbe-a9af-6418803a77f6','9e1c40e8-1096-4f3d-a893-a898537dadab','9ec74342-69e9-44a5-aa6f-a1068c516d55','a90be5e9-cdbe-4bbe-bc5a-31232c8d2b36','adf12dd9-3d67-447c-b9dd-e30dc7114b41','bc5a26ce-c233-4627-9dda-47c735f90a11','c2da5ea5-9bc1-457a-a4e8-93195cd45752','cb8bffd0-6055-465c-b487-8ee894fc5508','e4239d20-9b72-404f-99d2-7947adb8c270','e70f07c7-b1a9-4df6-b1d5-98a20c6119ce','f91397ae-3591-4ace-b96c-7473ef937738','ffe88986-1180-4ad3-98f1-b3d6fc02f69e') AND coalesce(lyrics_preview,'')<>''
ON CONFLICT DO NOTHING;

INSERT INTO w2152_hallucination_backup (kind,row_id,old_value)
SELECT 'track_sub', id::text, subtitle_url FROM work_language_tracks
 WHERE id IN ('1427','472') AND coalesce(subtitle_url,'')<>''
ON CONFLICT DO NOTHING;

UPDATE user_works SET subtitle_take1_json_url=NULL WHERE id IN ('0134d682-01fe-435b-bef9-307e94d5a712','0962a36e-62f9-49f8-987f-34f03a5573f7','0b02ba6b-862b-4587-a0ab-8410f4c78056','0cfd8a28-2589-4a36-8247-f8fe07b789bf','11c61590-b895-4ad9-93fd-62fa378c37c3','1325b54d-6dbd-4e14-8437-5e181fb15370','1c01a7ab-7800-404e-a61d-ae24cce336db','2576d5a4-cfc0-4819-8ba8-fec3348267eb','295df1b2-9ae9-4ad8-84f0-109d44b541af','2bd81e16-8c97-4257-8bd9-0752d90b949c','2d076fb7-ac5e-481c-9245-ee9d5d653531','32be0175-c7aa-4b67-bb9d-093f2d57c23c','3591eaac-f81e-4113-a7f6-6749ac69b4e9','384afb85-ee68-4a57-b0ea-b1fc46804ced','3d9e2383-4e18-47c2-ba67-9f677f826ab4','52fa8a6b-58dc-4e7d-915f-001a083ca01c','5714ce53-faf8-4cab-9ca8-5a9a83101ee0','63c2897f-bd58-4117-ae20-fba2bcc26760','7abd9957-9c5a-411c-954b-80b7ab6898d5','7d4c7079-9b1a-4664-b810-1b28d4b82963','7e89a073-e137-463c-94f1-9ac38a2b13c6','7f07dc6b-61fd-4174-9cd4-9c1d31e34887','82a378ef-a283-4570-8046-a6ff143eb6de','8cae87d4-1d2c-46f3-a2ad-dbe1c90de806','91975d94-2f49-47df-aad8-f4d7e2cc1aef','92e283b7-757f-402c-a58f-ed4e1c2aad32','941fba49-3d65-465b-8ff9-042daac2c075','9b3c1419-4e54-4fbe-a9af-6418803a77f6','9e1c40e8-1096-4f3d-a893-a898537dadab','9ec74342-69e9-44a5-aa6f-a1068c516d55','a90be5e9-cdbe-4bbe-bc5a-31232c8d2b36','adf12dd9-3d67-447c-b9dd-e30dc7114b41','bc5a26ce-c233-4627-9dda-47c735f90a11','c2da5ea5-9bc1-457a-a4e8-93195cd45752','cb8bffd0-6055-465c-b487-8ee894fc5508','e4239d20-9b72-404f-99d2-7947adb8c270','e70f07c7-b1a9-4df6-b1d5-98a20c6119ce','f91397ae-3591-4ace-b96c-7473ef937738','ffe88986-1180-4ad3-98f1-b3d6fc02f69e');
UPDATE user_works SET lyrics_preview=NULL         WHERE id IN ('0134d682-01fe-435b-bef9-307e94d5a712','0962a36e-62f9-49f8-987f-34f03a5573f7','0b02ba6b-862b-4587-a0ab-8410f4c78056','0cfd8a28-2589-4a36-8247-f8fe07b789bf','11c61590-b895-4ad9-93fd-62fa378c37c3','1325b54d-6dbd-4e14-8437-5e181fb15370','1c01a7ab-7800-404e-a61d-ae24cce336db','2576d5a4-cfc0-4819-8ba8-fec3348267eb','295df1b2-9ae9-4ad8-84f0-109d44b541af','2bd81e16-8c97-4257-8bd9-0752d90b949c','2d076fb7-ac5e-481c-9245-ee9d5d653531','32be0175-c7aa-4b67-bb9d-093f2d57c23c','3591eaac-f81e-4113-a7f6-6749ac69b4e9','384afb85-ee68-4a57-b0ea-b1fc46804ced','3d9e2383-4e18-47c2-ba67-9f677f826ab4','4b837997-b212-4240-8b23-c4dad241c33e','52fa8a6b-58dc-4e7d-915f-001a083ca01c','5714ce53-faf8-4cab-9ca8-5a9a83101ee0','63c2897f-bd58-4117-ae20-fba2bcc26760','7abd9957-9c5a-411c-954b-80b7ab6898d5','7d4c7079-9b1a-4664-b810-1b28d4b82963','7e89a073-e137-463c-94f1-9ac38a2b13c6','7f07dc6b-61fd-4174-9cd4-9c1d31e34887','82a378ef-a283-4570-8046-a6ff143eb6de','8cae87d4-1d2c-46f3-a2ad-dbe1c90de806','91975d94-2f49-47df-aad8-f4d7e2cc1aef','92e283b7-757f-402c-a58f-ed4e1c2aad32','941fba49-3d65-465b-8ff9-042daac2c075','9b3c1419-4e54-4fbe-a9af-6418803a77f6','9e1c40e8-1096-4f3d-a893-a898537dadab','9ec74342-69e9-44a5-aa6f-a1068c516d55','a90be5e9-cdbe-4bbe-bc5a-31232c8d2b36','adf12dd9-3d67-447c-b9dd-e30dc7114b41','bc5a26ce-c233-4627-9dda-47c735f90a11','c2da5ea5-9bc1-457a-a4e8-93195cd45752','cb8bffd0-6055-465c-b487-8ee894fc5508','e4239d20-9b72-404f-99d2-7947adb8c270','e70f07c7-b1a9-4df6-b1d5-98a20c6119ce','f91397ae-3591-4ace-b96c-7473ef937738','ffe88986-1180-4ad3-98f1-b3d6fc02f69e');
UPDATE work_language_tracks SET subtitle_url=NULL WHERE id IN ('1427','472');

-- 默认干跑(无 COMMIT)。正式: (cat 本文件; echo "COMMIT;") | psql ...
-- 回滚:
--   UPDATE user_works w SET subtitle_take1_json_url=b.old_value FROM w2152_hallucination_backup b
--     WHERE b.kind='work_sub' AND w.id::text=b.row_id;
--   UPDATE user_works w SET lyrics_preview=b.old_value FROM w2152_hallucination_backup b
--     WHERE b.kind='work_lyrics' AND w.id::text=b.row_id;
--   UPDATE work_language_tracks t SET subtitle_url=b.old_value FROM w2152_hallucination_backup b
--     WHERE b.kind='track_sub' AND t.id::text=b.row_id;
