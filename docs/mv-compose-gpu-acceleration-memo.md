# MV Compose GPU 加速 — 实施备忘(资金到位后再上)

> 状态:**非紧急 / 性能优化 / 待资金**。这是评估 + 决策备忘,不是已实施方案。
> 写于 2026-06-16。代码引用以当时 `rust-api/src/mv_compose.rs` 为准。

---

## 背景

cssOS 的 **compose 阶段(最终视频合成)是整条 MV 管线最慢的一关**,目前在
**无 GPU 的 api-vm** 上用 CPU `libx264` 编码。W836 已把幻灯档降到
`ultrafast + 24fps`,但 **AI 视频档 / 高分辨率仍慢**。

### 现状(代码核实)

`rust-api/src/mv_compose.rs` 有 **三个 libx264 编码点**:

| 函数 | 行(约) | 用途 | 当前 preset |
|---|---|---|---|
| `render_kenburns` | :945 | 幻灯档 zoompan 运镜 | 见 compose 链 |
| `render_ai_video` | :777 | AI 视频段归一化重编码 | veryfast |
| `compose_xfade_chain` | :610 | xfade 拼接 + 最终编码 | `_all_kb_chain ? ultrafast : veryfast` |

### 画音分层铁律(已核实,任何方案不得破坏)

- **字幕从不烧录** —— `compose_hybrid` 注释 "Subtitle burn-in stays disabled
  (kept independent)" (mv_compose.rs:313),`subtitles=` 滤镜未启用。
- **音频 mux 进视频,但同一音频也作为独立 `work_asset` 单独交付**
  (mv_compose.rs:310)。分层 stem 仍在,可单独剥离。
- 输出必须保持:**视频纯画面、字幕独立 JSON、音轨可单独剥离**。

---

## 三方案对比

| 维度 | ① GPU + NVENC | ② 第三方 API (Shotstack/Creatomate) | ③ kie.ai 视频引擎 |
|---|---|---|---|
| 加速幅度 | 编码 **10–20×** | 云端并行(看排队) | 不适用 |
| 画质 | 同码率接近 x264(NVENC p7);可控 | 平台自有编码,需调 | 不可控 |
| **画音分层** | ✅ 完全保住(只换 `-c:v` flag) | ⚠️ 高风险(默认烧字幕 + 自带 mux) | ❌ kie 是生成非合成,做不了 xfade 时间线 |
| 集成工作量 | 小(改 3 处 flag + 1 台 GPU 机 + 路由) | 大(时间线翻译成厂商 JSON + 重做分层 + 对账单) | 不可行 |
| 成本模型 | GPU VM 固定月租,量越大单位越省 | 按分钟,量越大越贵(线性) | N/A |
| 账单统一 | 自管 | 新增一道账单墙 | 复用 kie 基座(但不适用) |

---

## 推荐:① GPU 实例 + NVENC

理由(按 Jing 最看重的顺序):

1. **画音分层零风险** —— 只把 `-c:v libx264` 换成 `-c:v h264_nvenc`,滤镜图 /
   字幕独立 / 音轨独立交付全部原样保留。②③ 都触碰或做不到这一点。
2. **集成最小** —— 三处编码点改 flag + 一台 GPU 机 + compose job 路由。
3. **成本随量摊薄** —— GPU 固定月租,作品量越大单位成本越低;第三方按分钟线性涨,
   规模化后更贵。

---

## 成本测算公式

### 输入(需 Jing 填三个数)

```
N    = 月成片量(首/月)
T    = 平均成片时长(秒/首)
p_ai = AI 视频档占比(0~1),其余按幻灯档(便宜很多)
```

派生:
```
月渲染时长(分钟) M = N × T / 60
```

### 方案 ① 自建 GPU 月成本

```
Cost_gpu_month = GPU_VM_月租
                 (按需/抢占可更低;只在有 job 时开机则按 渲染机时×时租)

  - 始终在线:  Cost_gpu_month = 固定月租
               (参考:1×NVIDIA T4/L4 各云 ≈ $250–500/mo;抢占式更低)
  - 按需开机:  Cost_gpu_month = (M / 60 / 编码实时倍率) × GPU_时租
               NVENC 编码实时倍率取 10~20×,即 1 分钟成片 ≈ 3–6 秒机时
```

### 方案 ② 第三方 API 月成本

```
Cost_api_month = M × 单价_每分钟
                 (Shotstack/Creatomate 渲染分钟单价,以官网当时报价为准)
```

### 盈亏平衡点

```
令 Cost_gpu_month(始终在线) = Cost_api_month
=>  M_盈亏  = 固定月租 / 单价_每分钟   (分钟/月)

  当 M > M_盈亏  → 自建 GPU 更省
  当 M < M_盈亏  → 第三方更省(但仍受画音分层风险约束,不推荐)
```

> 经验:只要 **月渲染时长上千分钟**,自建 GPU 几乎总是更省;且 ② 的分层风险使其
> 在 cssOS 几乎不可选。按需/抢占式 GPU 把固定月租摊成机时后,盈亏点进一步左移。

---

## 落地顺序(资金到位后)

1. 起一台按需 GPU(L4/T4 起步),装带 NVENC 的 ffmpeg;先在 admin 测试端点跑一首
   旗舰(如 Jerusalem)对比 **画质 + 速度**。
2. NVENC 调参起点:`-c:v h264_nvenc -preset p6/p7 -tune hq -rc vbr -cq 23`,
   对齐当前 x264 观感后再微调。
3. compose job 路由:加一个 `CSSOS_COMPOSE_GPU_URL` env —— 有就走 GPU 机、
   无则回落 api-vm CPU(渐进、可随时回滚)。
4. 真机验证:xfade 接缝 + 字幕仍独立 + 音轨仍可单独剥离,再全量切换。

---

## 不做什么

- 不为加速而启用字幕烧录(违反画音分层铁律)。
- 不把 compose 改投 kie.ai 生成引擎(用途不匹配,做不了精确 xfade 时间线)。
- 第三方 API 仅在 GPU 完全不可得且能证明不破坏分层时才考虑,默认不选。
