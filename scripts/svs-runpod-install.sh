#!/usr/bin/env bash
# SoulX-Singer 装到 RunPod 网络盘 /workspace —— 停机不丢
set -euo pipefail
ROOT=/workspace
REPO=$ROOT/SoulX-Singer
VENV=$ROOT/venv
step(){ echo; echo "======== $* ========"; }

step "1 venv(复用容器自带 torch 2.8 + cu128,不往盘里再下 2.5G torch)"
[ -d "$VENV" ] || python3 -m venv --system-site-packages "$VENV"
source "$VENV/bin/activate"
pip -q install --upgrade pip

step "2 依赖(剥掉 torch/torchaudio/torchcodec 的死钉,其余照装)"
cd "$REPO"
grep -viE '^(torch|torchaudio|torchcodec)==' requirements.txt > /tmp/req.txt
echo "--- 剥掉的行 ---"; grep -iE '^(torch|torchaudio|torchcodec)==' requirements.txt
pip install -q -r /tmp/req.txt 2>&1 | tail -20 || {
  echo "!! 整包装失败,改成逐行装,记下失败的"
  : > /tmp/failed.txt
  while read -r line; do
    [ -z "$line" ] && continue
    pip install -q "$line" >/dev/null 2>&1 || echo "$line" >> /tmp/failed.txt
  done < /tmp/req.txt
  echo "--- 装不上的 ---"; cat /tmp/failed.txt
}
pip -q install "huggingface_hub<1.0"   # >=1.0 会被 transformers 4.41.2 拒收, 别升
pip -q install pypinyin cmudict          # requirements.txt 里没有, 但中文 G2P / CMUdict 要用
export NLTK_DATA=$ROOT/nltk_data
python -m nltk.downloader -d "$NLTK_DATA" cmudict

step "3 torch 还在不在(system-site-packages 可能被覆盖)"
python -c "import torch,torchaudio;print('torch',torch.__version__,'audio',torchaudio.__version__,'cuda',torch.cuda.is_available(),torch.cuda.get_device_name(0))"

step "4 权重"
export HF_HOME=$ROOT/hf
hf download Soul-AILab/SoulX-Singer            --local-dir "$REPO/pretrained_models/SoulX-Singer"
hf download Soul-AILab/SoulX-Singer-Preprocess --local-dir "$REPO/pretrained_models/SoulX-Singer-Preprocess"
ls -la "$REPO/pretrained_models/SoulX-Singer/model.pt"

step "5 仓库自带样例 —— 先证明环境对"
cd "$REPO"
time bash example/infer.sh
echo "--- 产物 ---"
find example/generated -name '*.wav' | while read -r f; do
  echo "  $f  $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null)s"
done
