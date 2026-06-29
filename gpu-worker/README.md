# cssOS GPU 3D worker — Hunyuan3D-2 (旗舰带纹理 3D 角色)

V100 worker，按需开关，出 image→带纹理 GLB/USDZ。镜像 atelier TripoSR 服务契约，
node 端 `imageToUsdzBytes` 只靠 host/port 切引擎：GPU Hunyuan3D 优先 → CPU TripoSR 兜底。

## 0. 前提：CPU 配额
全局 `CPUS_ALL_REGIONS` 默认 12，已被 api-vm(4)+atelier(8) 占满。
建 GPU 机(n1-standard-8=8vCPU)前必须先把它抬到 ≥20。
已提交申请：Case 01e5a328-932c-4c5a-b40f-a40956262664（12→24）。批准后再建机。

## 1. 建 V100 worker（CPU 配额批准后）
```bash
ssh api-vm 'gcloud compute instances create cssos-gpu-3d \
  --project=cssstudio-gpu --zone=us-central1-c \
  --machine-type=n1-standard-8 \
  --accelerator=type=nvidia-tesla-v100,count=1 \
  --provisioning-model=SPOT --instance-termination-action=STOP \
  --maintenance-policy=TERMINATE \
  --image-family=pytorch-2-9-cu129-ubuntu-2204-nvidia-580 \
  --image-project=deeplearning-platform-release \
  --boot-disk-size=150GB --boot-disk-type=pd-ssd \
  --metadata="install-nvidia-driver=True" --scopes=cloud-platform'
```
内网 IP（与 api-vm 同 VPC，端口内网直达，像 atelier :7896/:7892）：
```bash
ssh api-vm 'gcloud compute instances describe cssos-gpu-3d --zone=us-central1-c \
  --project=cssstudio-gpu --format="value(networkInterfaces[0].networkIP)"'
```

## 2. 装服务
把 `setup.sh / hunyuan_server.py / hunyuan.service` 推到 /srv/ifilm，跑 setup.sh，再：
```bash
sudo cp /srv/ifilm/hunyuan.service /etc/systemd/system/
sudo systemctl enable --now hunyuan
curl localhost:7898/        # ok
```

## 3. node 接管线
`imageToUsdzBytes` 优先级（W1488 已有 TripoSR/Replicate/FAL，把 GPU 插到最前）：
1. GPU Hunyuan3D `http://<gpu-ip>:7898/img2usdz`（env `IFILM_HUNYUAN_HOST`）— 旗舰带纹理
2. CPU TripoSR `http://10.128.0.5:7897/img2usdz` — 免费白模兜底
3. Replicate → 4. FAL

## 4. 按需开关（省钱，像 whisperX VM）
旗舰 3D 任务到 → start → 跑 → 闲置 N 分钟 stop。绝不常开。
```bash
ssh api-vm 'gcloud compute instances start cssos-gpu-3d --zone=us-central1-c --project=cssstudio-gpu'
ssh api-vm 'gcloud compute instances stop  cssos-gpu-3d --zone=us-central1-c --project=cssstudio-gpu'
```
V100 Spot ~$0.74/hr；按需批量，每角色 ~1-3 分钱。

## 风险
- Hunyuan3D 的 texture 模块（custom_rasterizer / differentiable_renderer）在 CUDA 12.9 上
  可能编译失败 → 服务自动降级 shape-only（白模）。setup.sh 已捕获并继续；
  若纹理没出，先在机器上单独调这两个扩展的编译。
