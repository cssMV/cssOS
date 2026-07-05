# cssTV 创作 & 多线程电影《时间帝国》— 实施蓝图

> 愿景(Jing):用户导演按住 Siri Remote 话筒说
> **「请用 cssTV 开拍多线程 3D 电影《时间帝国》」**,然后坐沙发上等着欣赏,后台**边出边播**。
> 先 built 到 Apple TV 真机 + 后台验证;资金到位再真开拍。**某一天,一定要实现。**

## 现状(已就位)

- **cssTV = 原生 tvOS app**(`tvos/cssTV`),同步文件夹(`PBXFileSystemSynchronizedRootGroup`,无排除)→
  `CreateView.swift` / `AudioMeter.swift` 一直在编译目标里,没有被从项目里删。
- 创作当年只是被 **W1367 从侧栏移除**(`ContentView.swift`,为纯欣赏过审)。
- 后端**多线程互动电影引擎**已在:`/api/ifilm/:id/{graph,direct,next,beat-video,threads,constitution,avatar,touch}`
  + `IFILM_SAMPLE_TIMEEMPIRE`(earth/mars 双线程 + 多结局)。首页 trailer「Empire of Time」即它。
- 后端已能把「电影」归类为 `work_type:"film"`(`classify`,`src/index.ts:5584`),`/api/agent/chat` 接受 film。

## Slice 1 — 恢复 cssTV 创作入口 ✅(本次,纯代码,待你 Xcode build)

`ContentView.swift`:
- 侧栏加回 **`Create`** 行(`wand.and.stars` → `onCreate()`),`orderedItems` 纳入 `.create`。
- `CategorySidebar` 加 `onCreate` 闭包;主视图加 `@State showCreate` + `.fullScreenCover { CreateView(auth:) }`。
- 路径:侧栏 Create → `CreateView`(已存在)→ 按住 🎙 说「CSS,…」→ `CSSBackend.castMV` → `/api/agent/chat`
  → 生成 → For You 出现。**通用创作即刻可用**(含 `work_type:film` 的电影型 MV)。

**上机:** 在 Xcode 打开 `tvos/cssTV.xcodeproj` → build 到真机 / TestFlight(同 iOS 流程)。后端无需再动。

## Slice 2 — agent 认「《时间帝国》/ 多线程电影」→ 挂 ifilm 引擎(未做,待批)

在 `/api/agent/chat` 的意图层加:命中 `多线程|《时间帝国》|Empire of Time|interactive film` →
不是走普通 MV 管线,而是返回/触发 `ifilm` 意图:`{ intent:"ifilm", ifilm_id:"time-empire" }`,
由 tvOS 打开互动电影播放屏(Slice 3)。**注意**:动的是线上 agent LLM 流,要小心 + 单独验证。

## Slice 3 — tvOS 原生互动电影播放屏(最大,先方案后动)

`PlayerView` 现在只播一个 MV URL。互动电影要新建一屏 `IFilmPlayerView`:

1. **开局**:`GET /api/ifilm/:id/graph` 取 beats/threads/edges;`/constitution` 取角色声线。
2. **边出边播**:进入 beat → `POST /api/ifilm/:id/beat-video`(懒渲染该拍视频,落 R2)→ 播;
   期间下一拍预渲染(流流流:让沙发上"看着它生成")。
3. **遥控当导演**:方向键/语音 → `POST /api/ifilm/:id/direct`(用户此刻的影响)+ `/next`(推进/收束线程);
   分支多结局由 `edges` 驱动,遥控选支线。
4. **多演员锁脸**:beat 的 `video_prompt` + cast 走 **P4a 双脸定帧 → image-to-video**(已接入 `/api/mv/video`),
   不同时代人物**跨时空同台**、逐拍一致。
5. **语音入口**:`AudioMeter.swift` + Siri Remote 听写 → 「CSS,开拍《时间帝国》」→ 直接进 `IFilmPlayerView`。

## 硬约束(必须记住)

- **App Store 3.1.1**:cssTV 当年为过审关创作(「对买闭嘴」)。重开创作 = 你对审核风险的决定;
  文案继续遵守「绝不提站外购买/充值」(`CreateView` 已合规)。
- **构建在你那侧**:此环境不能 build/提交 tvOS,Swift 代码我写、Xcode build + TestFlight 你来。
- **先不开拍**:Slice 1 只恢复入口,不触发真实生成;真开拍等资金到位。

## 里程碑

- [x] Slice 1 代码(侧栏 Create 恢复 + CreateView 接线)
- [ ] Xcode build 到 Apple TV 真机 + 后台验证(Jing)
- [ ] Slice 2 agent → ifilm 路由(待批)
- [ ] Slice 3 `IFilmPlayerView` 互动电影播放屏(先评审方案)
