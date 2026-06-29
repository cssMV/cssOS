# GPU 3D 精细模型方案(A 阶段:旗舰逼真)— 摸底报告

> 目标:从免费 CPU TripoSR(白模团块)→ GPU + 带纹理强模型(精细、有色、有细节),
> 做《时间帝国》级旗舰角色。沿用"专用 worker 机 + 按需开关"的省钱打法(像 whisperX VM)。

---

## 1. GPU 选型(GCP us-central1,已查配额)
| GPU | VRAM | 配额现状 | 按需价/小时 | Spot 价 | 评价 |
|---|---|---|---|---|---|
| **L4** | 24GB | **0(要申请)** | ~$0.70 (g2-standard-8) | ~$0.21 | 🥇 性价比最优·长期首选 |
| **V100** | 16GB | **1 ✅ 现成** | ~$2.48 (n1-std-8+V100) | ~$0.74 | 🥈 今天就能开·不用等 |
| **P100** | 16GB | **1 ✅ 现成** | ~$1.46 | ~$0.44 | 可用·更便宜·稍慢 |
| T4 | 16GB | 0(要申请) | ~$0.35 | ~$0.11 | 便宜但旧 |
| A100/H100 | 40-80GB | 0 | $$$$ | — | image→3D 过剩,不必 |

**建议**:① 想今天就跑 → 用 **V100**(配额现成);② 长期最优 → **申请 L4 配额**(Console → IAM & Admin → Quotas → "NVIDIA L4 GPUs" → 申请 1,通常很快批),再迁到 L4 省一半钱。

---

## 2. 模型选型(带纹理、精细)
| 模型 | 输出 | VRAM | 评价 |
|---|---|---|---|
| **Hunyuan3D-2**(腾讯) | 带纹理 GLB | ~6-12GB | 🥇 质量/纹理/显存平衡最好·首选 |
| **TRELLIS**(微软) | 高质带纹理 | ~16GB | 🥈 顶级质量·V100/L4 都行 |
| InstantMesh | 多视图→网格 | ~GPU | 较轻·可选 |

**建议:Hunyuan3D-2**(image→textured GLB,L4/V100 都跑得动,~10-30s/个)。

---

## 3. 架构(沿用 atelier 打法 + 按需省钱)
```
新 GPU worker(g2-standard-8 + L4  或  n1-standard-8 + V100)
  └ Hunyuan3D HTTP 服务 :7898  POST /img2usdz {image_url}
       → Hunyuan3D 出带纹理 GLB → Blender(glb2usdz, 已有)→ USDZ → 返回
node imageToUsdzBytes() 优先级:
  ① GPU Hunyuan3D(精细·旗舰)  ② CPU TripoSR(免费·白模兜底)  ③ Replicate ④ FAL
按需开关(像 whisperX VM):有旗舰 3D 任务 → 开机 → 跑 → 闲置 N 分钟自动停 → 只按用量付费
```

---

## 4. 成本(按需,不常开)
- **按需**:L4 ~$0.70/hr(Spot ~$0.21);V100 ~$2.48/hr(Spot ~$0.74)。
- Hunyuan3D ~10-30s/个 → 批量算 **每个角色 < 1-3 分钱**(L4);或开 1 小时批量出几十个 ~$0.7。
- **绝不常开**(常开 L4 ~$500/月)→ 按需开关,只付用量。
- 一次性:~50GB 磁盘 + 模型权重(~10GB)+ CUDA/torch 安装。

---

## 5. 落地步骤(等 Jing 拍板)
1. **配额**:用 V100(现成)立刻干;或先申请 L4 配额(几分钟~几小时)。
2. **建 GPU worker VM**:g2-standard-8+L4 或 n1-standard-8+1×V100,装 CUDA + torch(GPU)+ Hunyuan3D。
3. **Hunyuan3D HTTP 服务**(镜像 atelier TripoSR 服务,:7898,模型常驻)。
4. **复用 Blender**(glb2usdz 已有,带纹理 GLB 转 USDZ)。
5. **node 接管线**:imageToUsdzBytes 把 GPU Hunyuan3D 放最前(旗舰),CPU TripoSR 兜底。
6. **按需开关控制器**:旗舰任务到 → 启 GPU VM → 跑 → 闲置自动停(省钱)。

> 见 [[blender_worker_glb2usdz_on_atelier]](免费 CPU 路)、[[spatial_multithread_film_apple_exclusive]]。
> 决策:先 B(免费白模,已上线)后 A(本方案,旗舰逼真)。

---

## 6. 🎯 当前决策:先申请 L4 配额(Jing 2026-06-29)
**只能 Jing 在 GCP 控制台点(配额申请绑账号)。精确步骤:**
1. 打开 https://console.cloud.google.com/iam-admin/quotas (选对项目)
2. 顶部筛选框输入 **`NVIDIA L4 GPUs`**(或先搜 `L4`)
3. 勾选 **Region = us-central1** 那一行(当前 limit=0)→ 点 **EDIT QUOTAS**
4. 新值填 **1**(够一台 worker;以后要并行再加)→ 填理由(如 "3D model inference worker")→ 提交
5. 顺手也看一眼 **`GPUs (all regions)`** 这个全局配额,若=0 一并申请 ≥1
6. (想用 Spot 省钱)再搜 **`Preemptible NVIDIA L4 GPUs`** us-central1 申请 1
7. 审批:小额通常几分钟~几小时自动批,会发邮件

**批准后告诉我**,我就:建 g2-standard-8+L4 GPU worker → 装 CUDA+torch+Hunyuan3D → :7898 服务 → 复用 Blender → 接 imageToUsdzBytes(GPU 优先) → 按需开关控制器。约 30-40 分钟搭完,出旗舰级带纹理 3D 角色。

> 在等期间:免费 CPU 灵体白模(已上线)继续用。

---

## 7. 🚫 GCP GPU 自助申请被 Sales 门锁死(2026-06-29 实测结论)
不是填错,是 Google 对这个项目的硬限制。**两个 GPU 闸都锁 0/0 不可自助**:
- `NVIDIA_L4_GPUS` = 0 → Edit 面板: "between 0 and 0 / not eligible / contact Sales"
- **`GPUS_ALL_REGIONS`(全局 GPU 总闸)= 0** → 同样锁死。**这个最致命**: 它否决一切 GPU 创建,
  哪怕分区 `NVIDIA_V100_GPUS`=1 也没用(建 VM 实测 `Quota 'GPUS_ALL_REGIONS' exceeded. Limit: 0`)。
- CPU 类(`CPUS_ALL_REGIONS` 12→24)是自助秒批的,已抬到 24(无 GPU 也用不上,但无害)。

**唯一的 GCP 出口 = contact Google Sales**(可能要 billing 历史/用量承诺;Claude 不替 Jing 发起对外联系)。

### 绕开 GCP 的真实可行路(要旗舰带纹理 3D 又不等 Sales):
1. **Replicate 按次付费**(已集成兜底): 充值后跑 Hunyuan3D/TRELLIS 模型 → 带纹理 GLB → atelier Blender → USDZ。零 GPU 拥有、零配额、~几分钱/次。**最快今天就能出活**。
2. **RunPod / Lambda / Vast.ai 租卡**: 按小时租 GPU 跑 `gpu-worker/` 那套 Hunyuan3D 服务,绕开 GCP。
3. **等 billing 历史攒够(~30天)** 再回 GCP 自助申请(届时大概率解锁)。

> `gpu-worker/`(setup.sh + hunyuan_server.py + hunyuan.service)已就绪,GCP 解锁或换 RunPod 都能直接用。
