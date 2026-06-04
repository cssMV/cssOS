# Phase B — 精确断点续跑：待办给 Rust 侧

> Node 侧脚手架已完成并上线(W551, 2026-05-31)。Rust 只需"接线"即可实现真·断点续跑。
> 本文档 = Rust 侧需要做的全部事项 + 已就绪的 Node 契约。

## 背景 / 目标
作品输出中断(歌词/封面/音乐/视频/字幕已部分产出,最终合成失败)时,用户应能**只续跑缺失阶段 + 复用已产出**,而不是从头重来。计费本就延迟到 `complete` 才一次性扣(各阶段 `checkpoint` 只累加),所以续跑天然"只补差额"。

## 规范阶段顺序(单一真相源)
```
lyrics → cover → music → video → subtitles → compose
```
常量在 Node: `CSSOS_MV_STAGE_ORDER`(src/index.ts)。与 `cost_breakdown` / `work_assets(final_mv).meta.engine_meta` 的键一致。Rust 侧请用同一组键。

## 已就绪的 Node 契约(Rust/前端直接用)

### 1. 取续跑状态(只读)
`GET /api/works/:work_id/resume-state` (owner-only)
返回:
```jsonc
{
  "ok": true,
  "work_id": "...",
  "status": "draft|ready|...",
  "source_run_id": "<run_id|null>",
  "canonical_stages": ["lyrics","cover","music","video","subtitles","compose"],
  "stages_done": ["lyrics","cover"],      // = run.stages_done ∪ 资产隐含
  "missing_stages": ["music","video","subtitles","compose"],
  "existing_assets": { "final_mv":false,"audio_track_1":false,"subtitle_srt":false,
                       "slideshow_frames":15,"cover":true },
  "run": { "run_id","stages_done","stage_results","accumulated_cost_cents","status","stale_seconds" } | null,
  "seed": { "title","style","work_type","lyrics","language","civilization",
            "tempo_bpm","musical_key","voice_gender","vocal_style","instrumentation",
            "section_form","make_instrumental","video_outline","section_prompts",
            "aspect_ratio","frame_width","frame_height","orientation" },
  "resumable": true
}
```
关键: `stages_done` 由 **run 记录 ∪ 已产出资产** 推导 —— 即使没有 `mv_pipeline_runs` 行(Rust 旧作品)也能反推做到哪一步。

### 2. 发起续跑(编排桩)
`POST /api/works/:work_id/resume` (owner-only)
- 确保有一条 `in_progress` 的 `mv_pipeline_runs`(无则按已产出资产**回填** `stages_done`/`stage_results` 后新建,并回填 `user_works.source_run_id`)。
- 回传:`{ ok, work_id, run_id, minted_run, canonical_stages, stages_done, missing_stages, existing_assets, seed, next:{checkpoint_url, complete_url, abandon_url} }`
- **不执行任何 Rust 阶段** —— 这是脚手架。

### 3. 阶段记账(已存在)
- `POST /api/mv/pipeline-run/checkpoint` — body `{ run_id, stage_done, cost_cents, stage_result, params? }`。
  upsert `mv_pipeline_runs`:把 `stage_done` 并入 `stages_done`,把 `stage_result` 并入 `stage_results`,`accumulated_cost_cents += cost_cents`。**不扣费**。
- `POST /api/mv/pipeline-run/:run_id/complete` — 翻 `status='complete'` 并一次性 `debitCredits(accumulated_cost_cents)`。**只在此扣费** → 续跑只补差额。
- `POST /api/mv/pipeline-run/:run_id/abandon` — `status='abandoned'`,不扣费。
- `GET /api/mv/pipeline-run/pending` — 最近 24h 内 in_progress run(MV 面板开启时提示续跑)。

### 4. 数据库 `mv_pipeline_runs`
`run_id (unique)`, `user_id`, `params jsonb`, `stages_done text[]`, `stage_results jsonb`, `accumulated_cost_cents bigint`, `status('in_progress'|'complete'|'abandoned')`, `updated_at`。

## Rust 侧 TODO(就这些)
1. **各阶段开跑前先读 run 状态**:调 `GET /api/works/:id/resume-state`(或直接查 `mv_pipeline_runs.stages_done` / `stage_results`)。
2. **跳过已完成阶段**:`stages_done` 里的阶段不重跑,直接复用 `stage_results[stage]`(或 `existing_assets` 指向的 `work_assets` 行)。
3. **只跑 `missing_stages`**:按 `CSSOS_MV_STAGE_ORDER` 顺序续跑缺失阶段。
4. **每完成一阶段 checkpoint**:`POST /api/mv/pipeline-run/checkpoint`(同 `run_id`,带 `stage_done`+实际 `cost_cents`+`stage_result`)。
5. **全部完成 complete**:`POST /api/mv/pipeline-run/:run_id/complete`(一次性扣累计成本)。失败/放弃则 `abandon`(不扣)。
6. **复用资产而非重生成**:`stage_results` / `work_assets` 里已有 final_mv/audio_track_1/subtitle/slideshow 时,合成阶段直接引用,不再调第三方引擎。
7. **(可选)新作品也写 run 记录**:目前 Rust 人物 MV 路径不写 `mv_pipeline_runs`(导致旧草稿无 run 行,靠资产反推)。建议新作品也走 checkpoint,让续跑更精确、计费更准。

## 已就绪/无需 Rust 改的部分
- 前端:作品中心草稿"继续合成"按钮已先 `POST /resume` 拿计划,再 `openMvPipelinePanel({seed:{run_id, missing_stages, stages_done, existing_assets, ...}})`(W551)。
- 计费模型:延迟到 complete 才扣 = 续跑只补差额(已是现状)。
- 草稿可见性 + 进度徽标:作品中心已标"🚧 草稿·未完成"+ 词/封面/曲/视频 进度(W546)。
