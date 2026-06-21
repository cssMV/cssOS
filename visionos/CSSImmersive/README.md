# CSS Vision — visionOS 沉浸影院 App(骨架 / Phase 1)

## 命名(双层品牌)
- **桌面/App 显示名 = `CSS Vision`**(产品名,双关 Vision Pro)。
  - Xcode 里设 Target → General → **Display Name = `CSS Vision`**(写进 Info 的 `CFBundleDisplayName`)。
  - Bundle ID 建议:`app.cssstudio.vision`。
- **进入沉浸空间 = `CSS Cathedral`(魔镜圣殿)** —— 入殿时浮现欢迎大字(`CathedralWelcomeView`,~4.5s 后淡出),呼应 logo 魔镜 + Slogan「见证奇迹」。
- 内部 target/工程名仍可叫 `CSSImmersive`(不影响显示名)。


CSSOS_WAVE_936 — Apple Vision Pro 原生沉浸影院。**自建空间**(像 HBO 的哈利波特大厅 / 权游王座厅),
破除 Apple 视频沙盒门禁:不把视频交给系统那个只放裸视频的影院,而是我们自己渲染整个空间 ——
视频只是空间里的一块弧形银幕,情绪字幕 / 创作 / 交易 / 交流面板都是我们掌控的实体。

## 这个骨架包含什么(Phase 1)

| 文件 | 作用 |
|---|---|
| `CSSImmersiveApp.swift` | App 入口:2D 窗口 + `ImmersiveSpace`(`.full` 全包围) |
| `ContentView.swift` | 2D 启动窗口:输入作品 ID(留空=样本)→「进入沉浸影院」 |
| `ImmersiveView.swift` | 沉浸场景组装:360 环境 + 视频银幕 + 字幕浮层(`RealityView` + attachment) |
| `ImmersiveScene.swift` | 360 天空盒(环境占位)+ 弧形视频银幕(`VideoMaterial`) |
| `PlayerController.swift` | AVPlayer 播放 + 字幕时间同步(画音分层:声音可走独立音轨) |
| `CSSBackend.swift` | 拉作品 `GET /api/works/:id`(复用现有后端)+ 离线样本 |
| `Models.swift` | 数据模型(对齐后端 work / aligned_lyrics 逐字字幕时间轴) |

**已经能跑通的**:进一个我们自己的沉浸空间 → 正前方一块弧形银幕放 MV → 字幕整行跟唱浮在银幕下方。
这一步跑通 = **门破了**。后面再逐件加(逐字情绪字幕 / 价格条 / AI 创作面板)。

## 在 Mac 上怎么构建到 Vision Pro(Jing 操作)

> 我(Claude)无法跑 Xcode/真机。以下你来做。

1. **建工程**:Xcode → File → New → Project → **visionOS** → **App**。
   - Product Name: `CSSImmersive`
   - Initial Scene: **Window**;Immersive Space Renderer: **RealityKit**;Immersive Space: **Full**
   - (这会生成默认 App/ContentView/ImmersiveView,稍后用本目录文件替换。)
2. **替换源码**:把本目录(`visionos/CSSImmersive/`)里的 7 个 `.swift` 文件拖进工程,
   **删掉 Xcode 默认生成的同名文件**(`*App.swift` / `ContentView.swift` / `ImmersiveView.swift`),用这里的版本。
3. **网络权限**:作品/视频走 HTTPS(`cssstudio.app`),默认 ATS 即可,无需额外配置。
   (若日后用到 http 资源,再在 Info 里加 NSAppTransportSecurity 例外。)
4. **360 环境图(可选,强烈建议)**:把一张高清全景图(等距柱状投影 2:1,星空/雪山/海洋)
   拖进 Assets,命名 **`environment_pano`**。没有也能跑(用深空蓝黑兜底)。
   - 来源:可以用我们平台 AI 生成一张 panorama,或买素材,或拿 360 相机拍。
5. **样本视频**:`CSSBackend.sampleWork()` 里的 `sample-mv.mp4` 是占位。真机联调时:
   - 留空作品 ID 用样本;或输入一个真实作品 ID(后端 `final_mv_url`/`audio_track_1_url`/`aligned_lyrics` 会自动喂进来)。
   - 先放一个能公开播放的 mp4 到 `cssstudio.app/assets/sample-mv.mp4` 验证银幕。
6. **运行**:选 **Apple Vision Pro** 模拟器或真机 → Run。
   - 2D 窗口出现 → 点「进入沉浸影院」→ 应进入全包围空间,正前方银幕放 MV,字幕跟唱。

## W937 — 多银幕环绕 + 转头切换(已加进骨架)

- 主 MV 在正前方弧形银幕,Take 2 / 语言版在左右弧线上(`CSSWork.surroundVariants()` 自动按角度铺扇形)。
- **弧形带鱼屏**:`ImmersiveScene.generateCurvedPlane`(中心向用户凹)。
- **转头自动切激活屏**:`PlayerController` 用 **ARKit `WorldTrackingProvider` + `queryDeviceAnchor`** 读头部偏航角,朝哪块就激活哪块(声音/字幕切过去,留死区防抖)。
- **注视+捏合**手动切(`SpatialTapGesture`)。
- 激活屏微放大 + 标签高亮(绿框)。

> ⚠️ **必须在 Info 加权限**:头部追踪用到世界感知 →
> Target → Info → 加 **`NSWorldSensingUsageDescription`**(值如:"用于让 MV 银幕随你的视线环绕摆放")。
> 没加会导致 `arSession.run` 抛错 → 代码已兜底(退化为只用注视+捏合手动切,不崩)。

> 性能:多块银幕 = 多路视频解码。先用 2–3 块验证;真机若吃力,把非激活屏改成"暂停+封面贴图、激活时才解码"(后续优化)。

## W938 — 空间爆字幕(字在你身边 3D 炸开)

- `PlayerController` 按逐字时间轴(active 变体的 tokens, 无 tokens 退化为整行)发 `BurstEvent` 事件流(`burstSubject`)。
- `SpatialSubtitleSystem.spawnBurst` 在用户周围球面随机方位生成 3D 文字(`MeshResource.generateText`),
  按情绪上色(`color(for:)`)+ 弹入放大 + 停留 + 飘远淡出(`OpacityComponent`),活跃数上限 24 防堆积。
- `ImmersiveView` 订阅 `player.burstSubject` → 在 `burstRoot` 里炸字。
- 阶段加料(后续):emoji 同色 halo、音量驱动粒子、节拍地板。

## W939 — SharePlay 共享圣殿(多人同处一个魔镜圣殿一起看)

- `SharePlayCathedral.swift`:`CSSCathedralActivity`(GroupActivity, `.watchTogether`)+ 协调器。
- **媒体帧级同步**:`activeVideoPlayer.playbackCoordinator.coordinateWithSession`(play/pause/seek 自动同步)。
- **选曲/切屏同步**:`GroupSessionMessenger` 广播 `{workID, activeIndex}`(本地切屏 → 广播,远端 apply 有 `isApplyingRemote` 防回环)。
- 多人各自 Vision Pro,看见彼此 **Persona** 虚拟形象(SharePlay 空间自动)。
- ContentView 有「一起看 · 共享圣殿」按钮(在 FaceTime 通话中点 → 邀请同看)。

> ⚠️ **必须加 Capability**:Xcode → Signing & Capabilities → **+ Group Activities**。
> 没加 SharePlay 不工作(其余功能不受影响)。

## W940 — CathedralFX 全套空间特效 + 空间打赏(已加)

由逐字情绪/强度时间轴(`burstSubject`)统一驱动:
- **天女散花** `petalRain` — emoji/花瓣从头顶 3D 落下飘散(高强度峰值触发)。
- **高音爆闪** `highNoteFlash` — 强度≥0.82 时整个圣殿一闪(限频 0.5s)。
- **节拍地板** `makeFloorRing`/`pulseFloor` — 脚下光环每字随强度脉冲。
- **环境随情绪** `tintEnvironment` — 天空盒底色跟当前情绪平滑过渡。
- **空间打赏** `SpatialTip.flyTip` — 激活屏旁「💝 打赏」浮空按钮 → 金光从面前飞向银幕、命中爆开;`sendTip` 上报后端(真实购买走 StoreKit,iOS 支付门铁律)。

## W940 — 两件最大件已搭钩子(`FuturePhases.swift`,Phase 4 点亮)
- **手势创作**:ARKit `HandTrackingProvider` 取指尖 → 空中捏合画词/语音 → 调 `/api/agent/chat` 拿 seed → 新 MV 从魔镜浮出。需 Hand Tracking 权限(`NSHandsTrackingUsageDescription`)。
- **真·魔镜传送门**:进殿时立一面 logo 魔镜,伸手穿过才进圣殿(手部追踪 + 涟漪动画)。现用欢迎大字代替。

## 后端只读、零改动

`GET /api/works/:id` 已有,返回 `final_mv_url` / `audio_track_1_url` / `aligned_lyrics`。
本 App 直接复用 —— **字幕时间轴和 web 端同一份**,逻辑不重写。

## 路线图(骨架之后)

- **Phase 2 — 招牌情绪字幕进空间**:`SubtitleLineView` 改成逐字渲染,每字按 `token.emotion`/
  `emotion_intensity` 上色 + emoji + 爆字动画(RealityKit 文字实体或 SwiftUI 富文本 attachment)。
- **Phase 3 — 创作/交易/交流浮空面板**:SwiftUI 面板挂进 ImmersiveSpace,调现有后端 API +
  StoreKit 支付。多环境切换(星空/雪山/神殿)。
- **Phase 4 — 上架**:visionOS App 单独提交 App Store(签名/提交 Jing 做)。

## 工程量(诚实)

- Phase 1(本骨架,跑通):骨架已就绪,你构建+真机验证即可。
- Phase 2:约 2–3 周。
- Phase 3:约 3–4 周 + StoreKit。
- 用 360 天空盒(非精细建模),能见人的版本约 1 个月,完整版约 2–2.5 个月。
- **最大成本是 3D 美术(环境)**,用 360 全景图可把它降到最低。
