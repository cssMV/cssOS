# cssMV Video Engine

`build_video_project(ProjectInput)` 是视频引擎主入口。

接入现有 cssMV 链路时：

1. Lyrics Engine 负责产出 `scenes[*].text_block`
2. Scene Script 层负责产出 `scenes[*].visual_script` 与 `scenes[*].duration_secs`
3. Music Engine 负责产出 `music.audio_path` 与 `music.duration_secs`
4. Video Engine 只负责：
   - 可选缩略视频
   - 逐 scene 视频渲染
   - MV 合成
   - 连续性评分

真实视频渲染优先策略：

- 若配置 `CSS_VIDEO_RENDER_CMD`，scene renderer 会把 `scene + plan + output_path` 写到 JSON，并调用外部命令
- 若未配置，则必须提供 `reference_media_paths`，引擎会用 ffmpeg 做 reference-driven 裁切/合成
- 两者都没有时，scene 渲染直接失败，不会伪造成功
