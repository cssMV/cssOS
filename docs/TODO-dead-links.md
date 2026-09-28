# 死链清单（纯查询 · 未改动任何数据）

2026-09-28 · 起因：修三部曲真视频时发现库里有指向 R2 不存在文件的引用。

## 口径

比对 **R2 全量 62,676 个文件名** 与库里 **16,895 条 artifacts 引用**，
来源字段覆盖 4 处：`work_assets.url`（含 final_mv / canonical_mv / 各类素材）·
`user_works.preview_video_url` · `user_works.preview_audio_url` ·
`work_language_tracks.audio_url`。

> 先前口头说的「69 条」只覆盖 `artifacts/mv/` 和 2 个字段，**口径偏窄**。本清单是全量。

## 结论：死链 162 条，但真正影响观看的只有 1 个作品

| 影响等级 | 在架作品数 | 说明 |
|---|---:|---|
| **A · 没声音** | **0** | 无 |
| **B · 没画面** | **1** | 唯一真故障，见下 |
| C · 主视频断但有备份 | 0 | 无 |
| D · 仅 `final_mv` 记录陈旧 | 57 | **播放不受影响** —— 播放端走 `preview_video_url`，那条是活的 |
| （不在架：draft / deleted / 已下架） | 67 | 无用户影响 |

**为什么 D 级不算故障：** `final_mv` 这张表在读取路径上只被 `visual_kind` 的
`meta->engines->video_cents` 用到，URL 本身没有客户端会去取；真正播放用的是
`preview_video_url`。所以 57 个「final_mv 死了」的作品，用户看不出任何异常。
（**但它们迟早要清** —— 哪天有人改成读 final_mv.url，这 57 个会一起黑屏。）

## 唯一真故障

| work_id | 标题 | 断的是 |
|---|---|---|
| `c03c0476` | rainy alley, vinyl store, stea… | `preview_video_url` 指向的文件不存在，且无其它可用画面 |

## 已在本轮修掉的（不在上表内）

- `303372a5` 天地留名 · `402bbe6c` 醉里狂歌：`final_mv` 原指向 404，已改为各自在用的真视频。
- 5 个三部曲根节点的 `preview_video_url` 原是 `canon-*`（一张图的 Ken Burns 慢推，5MB），
  已改为第一部的真视频（200–485MB），`visual_kind` 由 `slides` 变 `video`。

## 动手清理时要注意

1. **不要删 R2 里的文件。** 349 个「孤儿」大多是被新版取代的**旧版**
   （`basho-p1-realvideo` vs 现用的 `-v2`、`rumi-p1-*` vs `rumi-v2-p1-*`），
   按版本铁律本来就该留档。删了就是 W2061/W2086 那两次事故重演。
2. **改 `final_mv.url` 前先看 `preview_video_url`。** 多数情况正确答案就是它。
3. **`work_assets` 没有 `updated_at` 列** —— 改完只能靠回读核对，别指望时间戳。
4. 本清单里 `deleted` / `draft` 的 67 条**不用动**，动了也没人看得见。

附：`deadlinks-report.csv`（162 条全量，含等级 / 作品 / 断掉的字段与文件名）
