#!/usr/bin/env bash
# SoulX-Singer 一键装机 (AWS g5.xlarge / Deep Learning OSS Nvidia AMI, Ubuntu 22.04)
#
# 用法:  ssh ubuntu@<IP> 'bash -s' < scripts/svs-gpu-bootstrap.sh
#
# ⚠️ 本脚本【尚未在真机上跑过】—— 机器还没开。步骤依据仓库 README 与 requirements.txt
#    (2026-09-05 拉取)写成, 不是照记忆写的; 但第一次跑必然要按实际报错微调。
#    每一步都有独立的成功判据, 失败就停在那一步, 不会假装跑完。
set -euo pipefail

ROOT=/opt/svs
REPO=$ROOT/SoulX-Singer
step() { echo; echo "=============== $* ==============="; }

step "0/6 确认 GPU 与驱动"
nvidia-smi --query-gpu=name,compute_cap,memory.total,driver_version --format=csv
CAP=$(nvidia-smi --query-gpu=compute_cap --format=csv,noheader | head -1)
echo "compute capability = $CAP  (sageattention 要 8.0+; 7.5=T4 可能要关掉它)"

step "1/6 系统依赖"
sudo apt-get update -qq
sudo apt-get install -y -qq git git-lfs ffmpeg build-essential python3.10-venv >/dev/null
git lfs install --skip-repo

step "2/6 取仓库"
sudo mkdir -p $ROOT && sudo chown "$USER" $ROOT
[ -d "$REPO/.git" ] || git clone --depth 1 https://github.com/Soul-AILab/SoulX-Singer.git "$REPO"
cd "$REPO"

step "3/6 建 venv 并装依赖 (python 3.10, torch 2.2.0)"
[ -d .venv ] || python3.10 -m venv .venv
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
pip install -q -U huggingface_hub
python -c "import torch; print('torch', torch.__version__, 'cuda可用', torch.cuda.is_available(), torch.cuda.get_device_name(0))"

step "4/6 下权重 (SVS ~2.8GB + 预处理模型)"
hf download Soul-AILab/SoulX-Singer           --local-dir pretrained_models/SoulX-Singer
hf download Soul-AILab/SoulX-Singer-Preprocess --local-dir pretrained_models/SoulX-Singer-Preprocess
ls -la pretrained_models/SoulX-Singer/model.pt

step "5/6 跑仓库自带样例 —— 先证明环境对, 再谈我们自己的谱子"
# 这一步用它自带的中文 music.json + zh_prompt.mp3, 与我们的数据无关。
# 它出声了, 才说明 GPU/权重/依赖三样都对。
time bash example/infer.sh
echo "--- 产物 ---"
find example/generated -name '*.wav' -o -name '*.mp3' | head
for f in $(find example/generated -name '*.wav' | head -3); do
  echo "  $f  $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null) 秒"
done

step "6/6 完成"
cat <<'NOTE'
环境已就绪。下一步(在本机做):
  1. 把 scripts/svs-score-to-soulx.py 产出的 JSON scp 上来
  2. 换掉 infer.sh 里的 target_metadata_path, 渲染我们自己的谱子
     —— 这一步是全世界没人验证过的路径, 出问题先看 phoneme 是不是查表落空
  3. 同曲跑 --align word 与 syllable 两版, 听差异, 定默认
  4. 记下 RTF, 算每分钟人声成本

⚠️ 用完记得 stop 实例(省 $1/小时; 硬盘每月十几块, 环境和权重都还在)。
   整个项目结束才 terminate。
NOTE
