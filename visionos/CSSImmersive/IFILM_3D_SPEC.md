# cssOS 3D 多线程互动电影 — 正式技术规格 (W1474–1476)

> Vision Pro 独家。用户像"神"一样观看一个**每次都不同、实时现写**的虚拟宇宙,
> 可**有限参与**(绕角色走、触碰、让女主跳舞),但**改不了结局**(只能"选边",出不了图)。
> 后端出逻辑+素材,visionOS 纯表演。

---

## 0. 核心哲学(不可违背)
1. **线程现写不固定**:每次播放、每个用户看到的剧情线都不一样(LLM 实时生成 + per-session seed)。
2. **固定的只有"宪法"**:世界观/人物/铁律/**结局集**。所有现写线程最终坠入结局集之一。
3. **有边界的互动**:无害风味请求(跳舞/微笑/触碰)→ 角色欣然反应;根本改变(背叛/杀害/跳结局)→ 角色有意志地拒绝,故事不离轨。
4. **后端=大脑,前端=身体**:所有推理/生成在后端;visionOS 只渲染 + 采集交互 + 回传。

---

## 1. 混合渲染架构(三层)

```
┌─ 环绕空间视频银幕(N 块, 复用 WAVE_937)─────────┐
│   铺"世界"与多条线程; 立体景深; 逐块点亮(边写边演)  │
│   素材: beat.video_prompt → 预渲染空间视频(MV-HEVC) │
├─ 中央 / 关键位 实时 3D 角色(RealityKit + USDZ)────┤
│   主角们 = 带骨骼 USDZ; 可绕行 / 触碰 / 反应        │
│   驱动: 导演 beat.line(+voice_url) + /touch 微反应   │
├─ 招牌情绪字幕层(SpatialSubtitleSystem, 已有)──────┤
│   beat.line 逐字爆 + 中央反应                       │
└──────────────────────────────────────────────────┘
        ▲ 同一个导演大脑(后端, 已上线)
```

**为什么混合**:`绕行+触碰+反应` 只有实时 3D(USDZ)能做(视频视角钉死);但全场景做 3D 太重、AI 还不能实时生成 rigged 角色。所以**少数主角用实时 3D,世界/群演/远景用空间视频**。

---

## 2. 后端 API 合约(均已上线, base = https://cssstudio.app)

### 2.1 `GET /api/ifilm/:id/constitution`
进沉浸时拉一次。返回固定宪法,用来摆场 + 知道边界。
```json
{ "ok": true, "constitution": {
  "title": "时间的帝国",
  "premise": "…世界观…",
  "characters": [ { "name": "林墨", "role": "男主·时间观测者…" }, … ],
  "rails": [ "林墨与苏晚彼此深爱,不会互相伤害…", … ],
  "endings": [ { "id": "human_win", "label": "人类守住时间线", "synopsis": "…" },
               { "id": "mars_control", "label": "火星操控·被规训世界", "synopsis": "…" } ],
  "max_beats": 6
} }
```

### 2.2 `POST /api/ifilm/:id/next` — 生成式导演(每个转场/凝视/手势/语音点调一次)
visionOS **自己持有 session 状态**逐次回传(`beats/step/tension/seed`)。
请求:
```json
{ "beats": ["前情摘要1","摘要2"], "step": 2, "tension": 0.3, "seed": 4242,
  "gaze": "林墨", "gesture": "握拳", "utterance": "守住时间线" }
```
响应:
```json
{ "ok": true,
  "beat": { "thread":"开场","speaker":"林墨","line":"守住时间线,是我们的责任",
            "synopsis":"…","video_prompt":"…2.39 电影感画面提示…" },
  "voice_url": "https://cdn.cssstudio.app/artifacts/ifilm-voice/<hash>.mp3",
  "reaction": "苏晚柔和地看着林墨",      // 角色对【用户本次影响】的微反应, 可空
  "tension": 0.35,
  "rail_enforced": false,               // true = 用户试图越轨被挡下
  "converged": false,                   // true = 已坠入结局
  "ending_id": "human_win",             // 仅 converged 时
  "ending_label": "人类守住时间线",
  "session": { "beats":[…], "step":3, "tension":0.35, "seed":4242 } // 原样下次回传
}
```
**用法**:`voice_url` 给角色播声;`beat.line` 进情绪字幕;`reaction` 中央爆字 + 角色微动作;`converged` → 演结局。

### 2.3 `POST /api/ifilm/:id/touch` — 触碰/凝视即时微反应(不推进剧情)
3D 里"伸手碰主角"那层。轻量、快。
请求:`{ "character": "林墨", "touch": "伸手轻触他的肩膀" }`
响应:
```json
{ "ok": true, "character":"林墨", "line":"", "motion":"转头看你", "emotion":"惊讶",
  "voice_url": null }   // 有台词时才有 voice_url
```
**用法**:`motion` → 触发该角色对应反应动画(见 §4 动画库);`emotion` → 表情 blendshape;`voice_url` → 若有台词则播。

---

## 3. visionOS 实现(RealityKit + ImmersiveSpace)

### 3.1 进场流程(挂在现有 GateRouter → ImmersiveView)
1. `GET /constitution` → 拿人物 + 结局集 + 铁律。
2. 摆 **N 块环绕空间视频银幕**(复用 `surroundVariants()` / `placeOnArc`);先占位(封面/加载)。
3. 加载 **主角 USDZ 实体**(见 §4),放在用户前方可绕行处(`WorldAnchor`,非 head-anchored,这样用户能绕)。
4. 初始化 session: `{beats:[], step:0, tension:0, seed: 随机}`。
5. `POST /next` 拿首个 beat → 银幕放视频 + 角色播 `voice_url` + 字幕。

### 3.2 交互采集 → 调后端
| 用户动作 | visionOS 采集 | 调用 |
|---|---|---|
| 凝视某角色 | `HoverEffect` / gaze target → 角色名 | `/next` 带 `gaze` |
| 手势(捏合/握拳/挥手) | `SpatialEventGesture` / ARKit hand | `/next` 带 `gesture` |
| 说话 | `SFSpeechRecognizer` (语音转文字) | `/next` 带 `utterance` |
| **触碰角色** | ARKit `HandTrackingProvider` + 角色 `CollisionComponent` 碰撞 | `/touch` 带 `character`+`touch` |
| 自然转场(beat 播完) | 计时/视频 end | `/next`(空交互) |

### 3.3 表演回放
- **语音**:`AVAudioPlayerNode` 或 `AVPlayer` 播 `voice_url`,空间化锚到该角色实体(`SpatialAudioComponent`)。
- **口型**:简易方案 = 播声时驱动 `jawOpen` blendshape 随音量(amplitude → jaw);进阶 = 离线音素 lip-sync。
- **字幕**:`beat.line` → 现有 `SpatialSubtitleSystem` 逐字爆 + `reaction` 中央。
- **结局**:`converged` → 切到结局演出(对应银幕 + 角色终场动画)。

---

## 4. 🔑 3D 角色管线(这是真正要解决的核心)

USDZ 角色需:**网格 + 骨骼(skeleton)+ 蒙皮 + blendshapes(表情)+ 动画库**。来源三档(从快到理想):

### 档 A — 立即可做(MVP):预制 rigged 角色 + 动画重定向
- 用 **Reallusion Character Creator / Mixamo / Ready Player Me** 产出带骨骼人形 → 导出 USDZ(或 FBX→USD via Reality Composer Pro)。
- **Mixamo 动画库**重定向到骨骼:`idle / talk / nod / step_back / turn_to_look / dance / refuse_headshake`(覆盖 §2.3 的 motion 词表)。
- 表情用 **ARKit 52 blendshapes** 标准(`jawOpen / mouthSmile / browInnerUp …`)→ emotion 词映射。
- **每部电影手工配几个主角**(像配音一样,一次性),其余用空间视频。

### 档 B — 半自动:照片/封面 → 3D 头身
- 角色封面(我们已有)→ 第三方 photo-to-3D-avatar(如 Avaturn / RPM from photo)→ rigged USDZ。
- 后端可加端点把作品角色封面送去生成 avatar、存 R2、回 USDZ url(下轮我做)。

### 引擎路由 + GLB→USDZ 转换(W1484)
`/avatar` 引擎链:**FAL Hyper3D/Rodin(直出 USDZ)→ 没余额自动回退 Replicate `firtoz/trellis`(出 GLB)**。
（kie 无 image→3D 引擎，已实测 422/500，故不走 kie。）响应 `format` 字段标 `usdz` 或 `glb`。

⚠️ **RealityKit 不能直接加载 GLB**，拿到 `.glb` 的 model_url 需先转 USDZ：
- **本机一次性**：`Reality Composer Pro` 或 Xcode 自带 → 把 .glb 拖进去导出 .usdz；或命令行
  `xcrun usdconvert input.glb output.usdz`（部分 Xcode 版本支持 glTF 输入）。
- **Mac 服务器批量**：Apple [`usdzconvert`](https://developer.apple.com/augmented-reality/tools/)（USD Python Tools）支持 `usdzconvert in.glb out.usdz`。
- **App 内运行时(进阶)**：用 [GLTFKit2](https://github.com/warrenm/GLTFKit2) 直接把 GLB 加载成 RealityKit/SceneKit 实体，免离线转换。M1 推荐：拿到 .glb 先离线转 .usdz 回填，或前端用 GLTFKit2。
- **最省心**：见档 A，直接用预制 rigged USDZ（免转换+能动）。
`IFilmModelLoader`（InteractiveFilm.swift）目前只认 USDZ；遇 `.glb` 的 model_url 需走上述转换或 GLTFKit2。

### 档 C — 北极星:实时/近实时生成 rigged 3D 角色
- 等 AI 3D 角色生成成熟(Gaussian splatting + auto-rig)。届时导演的 `beat` 直接驱动新生成角色。

### 角色 ↔ 后端绑定
- `constitution.characters[].name` ↔ 一个 USDZ 资源(本地 bundle 或 R2 url)。
- 后端下轮加 `character.model_url`(USDZ)字段;visionOS 按名加载。
- `motion` 词表 = 双方约定的动画 clip 名(idle/talk/turn_to_look/step_back/dance/refuse…)。

---

## 5. 多线程银幕(并行现写)
- 每条 thread 一块环绕银幕(`screen-<i>`,复用 W937 + 渐进点亮)。
- visionOS 可并行对**每条活跃线程**各跑一个 session(各自 `seed`/`beats`),`setActive(i)` 决定哪条出声+被聚焦(捏头切看)。
- 收束:任一线程 `converged` → 进入结局集演出;其余线程渐隐。

---

## 6. 关键铁律(给 visionOS)
- 角色用 **WorldAnchor**(世界锚)不要 head-anchor → 用户才能**绕着走**。
- 触碰 = ARKit 手部关节 entity 与角色 `CollisionComponent` 碰撞 → 防误触做个最小停留阈值。
- 越轨(`rail_enforced:true`)→ 演"角色有意志地拒绝"(`refuse` 动画 + reaction 台词),**绝不照做**。
- 所有"逻辑判断"都问后端,visionOS **不自己决定剧情**(铁律:前端纯表演)。
- 画幅/字幕/烟花复用现有 `SpatialSubtitleSystem` / `fireworkShell`,别重写。

---

## 7. 落地阶段
| 阶段 | 内容 | 谁 |
|---|---|---|
| ✅ M0 | 导演大脑(constitution/next/touch)+ 角色语音 + 护栏 | 后端(已上线) |
| M1 | visionOS: 拉 constitution + 单主角 USDZ(档 A)+ /next 字幕语音 + /touch 触碰反应 | Xcode(你) |
| M2 | 环绕空间视频银幕(beat.video_prompt → 预渲染)+ 多线程 | 后端备料 + 你 |
| M3 | 多主角 3D + 手势/语音全交互 + 结局演出 | 你 |
| M4(北极星) | 实时生成 3D 角色 + 实时视频 | 等 AI 成熟 |

---

## 8. 后端进度
- [x] **角色 ↔ 音色/模型绑定**(W1481): `constitution.characters[]` 现带 `gender / voice_id(ElevenLabs) / model_hint`。
      `model_hint` = `{male|female|neutral}_{adult|elder|youth}` → visionOS 映射到 bundle 内预制 rigged USDZ。
      同性别角色自动分到不同嗓子。`/next`、`/touch` 用说话角色的专属音色。
- [x] **beat.video_prompt → seedance 预渲染空间视频缓存**(W1477,边写边备料)。
- [x] **任意 film 自动生成宪法**(W1480)。
- [x] **photo → avatar USDZ**(W1482): `POST /api/ifilm/:id/avatar {character}` → 生成肖像 →
      FAL Hyper3D/Rodin image-to-3D(**直出 USDZ**)→ R2 → 写 `characters[].model_url`。异步缓存,
      点火 pending → 轮询 ready。**注**: 出的是【静态网格】(可绕行/触碰/语音/高亮反应, 身体不动画);
      真·rigged 可动角色(全身动作/lip-sync)要 Ready Player Me / Avaturn 头像流(GLB+骨骼), 下一档。

### 第 8 章全部完成 ✅ — 互动电影后端基座齐活
visionOS 拿 `/constitution` → 每角色有 `voice_id`(专属嗓)+ `model_hint`(预制档)+ `model_url`(现生成静态 USDZ);
`/next`(现写剧情+语音+逐字字幕+视频备料)、`/touch`(触碰反应)、`/threads`(多线程)、`/avatar`(3D 模型)、`/beat-video`(银幕画面)全部就绪。逻辑+素材全在后端,前端纯表演。

### visionOS 加载角色模型
```
for ch in constitution.characters:
    let url = ch.model_url ?? presetUSDZ(ch.model_hint)   // model_url 优先, 否则按档位用 bundle 预制
    放置 USDZ(WorldAnchor) → 绑 voice(播 /next 或 /touch 返回的 voice_url, 已是该角色专属音色)
```

> 见记忆 `spatial_multithread_film_apple_exclusive`、`native_app_player_rebind_and_source_fix`。
> 后端代码: src/index.ts `CSSOS_WAVE_1474/1475/1476`(directIFilmNext / ifilmSpeak / /touch)。
