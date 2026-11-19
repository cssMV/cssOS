# cssTV 1.0.4 (build 42) — What's New

英文是真源(平台宪法: All UI strings are authored in English)。中文为对应译文。
两段都已按「更新说明常驻授权」直接定稿, 不另外过目。

## en-US (primary)

```
Create on the big screen — and watch it the moment it starts.

• Every format now plays while it is still being made. Pick a song, a trilogy,
  an opera, a short drama, a series or a film, and the first finished part starts
  playing while the rest keeps generating in the background.
• Multi-part works play as one piece, in order. A trilogy opens as a whole and
  plays 1 → 2 → 3; an opera plays act by act, scene by scene, without anything
  cutting in between.
• Operas, series and films with acts and scenes now play all the way through.
  Earlier builds could open them but not start them.
• A new progress view shows exactly which stage each part is in — lyrics, music,
  visuals, subtitles — laid out act by act for the longer formats.
• The casting panel now covers all six formats instead of only songs.
```

## zh-Hans

```
在大屏上创作 —— 而且一开始生成就能看。

• 六种戏路现在都是【边生成边播放】。选单曲、三部曲、歌剧、短剧、连续剧或电影,
  第一个做完的分部立刻开播, 其余在后台继续生成。
• 多部作品当成一部、按顺序播。三部曲打开的是整部, 1 → 2 → 3 连播;
  歌剧按幕、按场往下走, 中间不会插进别的东西。
• 带幕和场的歌剧 / 连续剧 / 电影现在能真的播到底 —— 之前的版本打得开, 播不了。
• 新的生成进度视图会显示每个分部走到哪一步(歌词 / 音乐 / 画面 / 字幕),
  长篇按幕分层列出。
• 选角面板从只支持单曲, 补齐到六种戏路。
```

## 这一版相对 1.0.3 真正改了什么(内部记录, 不进商店文案)

| 波次 | 改动 |
|---|---|
| W2320 | cssTV 认多部作品: 三部曲要打开【根】并等三部齐了再播 |
| W2321 | 生成进度条, 两个创作入口共用 |
| W2322 | 六种戏路共用同一条进度视图(歌剧/短剧/连续剧/电影不再被当成单曲) |
| W2323/W2324 | 选角面板补齐六戏路 + 进度视图按【幕·场】两层 |
| W2325 | 接住后端的 `multipart_cinema`(幕→场两层随响应带出) |
| W2328 | 单曲→电影六种戏路都真能「生成就播放」(四个缺口) |
| W2329 | 真正的「一边生成一边播放」—— 不等 castMV 那趟 HTTP 返回 |
| W2330 | 三层树(歌剧/连续剧/电影)根本播不了 —— `playbackParts` 要再下一层 |

W2335–W2339 **不在这一版里** —— 它们全是后端 `src/index.ts`, 一行 Swift 都没有。
