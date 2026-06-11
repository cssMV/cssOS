# ML Worker 开通参数（6/9 购买）

把平台 100% 的本地重型计算（whisperX / Demucs / SER / audio-analysis）从 web 现机（n1-standard-4, 15GB）搬到这台专用 worker。
worker 只跑 ML 批处理，**不碰线上**；用 Spot 省钱，被回收只是某次批处理重跑，用户无感。

## 关键约束（必须对齐，否则连不通）
- **同 region + 同 VPC 子网**：必须和 api-vm 在同一 region、同一 VPC，才能走**内网 IP**（低延迟、不走公网、不计出网费）。
  - 先查 api-vm 的 region/zone/VPC：
    ```
    gcloud compute instances describe api-vm --format="value(zone,networkInterfaces[0].network,networkInterfaces[0].subnetwork)"
    ```
- **x86**（不是 ARM）：ML 的 torch/ctranslate2/transformers wheels 原样可用，零迁移坑。
- **Spot/抢占式**：批处理可重启，扛得住回收。

## 推荐机型
- **c4-standard-8**（8 vCPU / 32GB，Emerald Rapids，性价比最高）或 **n4-standard-8**（同规格，略便宜）。
- 内存 32GB：彻底消灭"227Mi 空闲 + swap 颠簸"（whisperX medium ~1.5GB + Demucs ~3GB 同时跑也宽裕）。

## gcloud 开通命令（把 ZONE/SUBNET 换成 api-vm 同款）
```bash
gcloud compute instances create cssos-atelier \
  --zone=us-central1-a \                         # ← 改成 api-vm 的 zone
  --machine-type=c4-standard-8 \                 # 或 n4-standard-8
  --provisioning-model=SPOT \
  --instance-termination-action=STOP \           # 回收时 STOP（保留磁盘），不 DELETE
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=80GB \                        # 模型缓存(~5GB) + 临时音频，80GB 够
  --boot-disk-type=pd-balanced \
  --network=default \                            # ← 改成 api-vm 同 VPC
  --subnet=default \                             # ← 改成 api-vm 同子网
  --no-address \                                 # 不要公网 IP（只内网，更安全更省）
  --tags=cssos-atelier
```
> `--no-address` 后，worker 没有公网；装机时用 `gcloud compute ssh cssos-atelier --tunnel-through-iap`（IAP 隧道），无需公网 IP。

## 防火墙：只允许 api-vm 内网访问三个 ML 端口
```bash
# 取 api-vm 内网 IP
APIVM_IP=$(gcloud compute instances describe api-vm --format="value(networkInterfaces[0].networkIP)")
gcloud compute firewall-rules create cssos-ml-internal \
  --network=default \                            # ← 同 VPC
  --direction=INGRESS --action=ALLOW \
  --rules=tcp:7891,tcp:7892,tcp:7893 \
  --source-ranges=${APIVM_IP}/32 \
  --target-tags=cssos-atelier
```
端口：7891=audio-analysis(librosa)，7892=whisperX，7893=Demucs+SER。

## 装机 → 接线 三步
1. **在 worker 上**：跑 `setup-worker.sh`（装系统依赖 + 从 api-vm 拉服务代码 + 建 venv + 装带 MemoryMax 的 systemd 单元）。
2. **在 api-vm 上**：跑 `rewire-api-vm.sh <WORKER_内网IP>`（把 WHISPERX_ALIGN_URL / DEMUCS_URL / AUDIO_ANALYSIS_URL / SER 指向 worker，停掉本机的三件套，重启 node）。
3. 验证：`curl http://<WORKER_IP>:7892/health` 从 api-vm 能通 → 跑一次 resubtitle 确认端到端。

## 成本直觉
- c4-standard-8 按需 ≈ 老 n1-standard-4 的 2-3 倍价；**Spot 打 6-7 折后 ≈ 持平甚至更低**，却拿 3-4× 算力 + 2× 内存。
- worker **空闲时几乎不耗**（批处理才上 CPU）；可进一步加"无任务自动 STOP"省到极致（后续可做）。
