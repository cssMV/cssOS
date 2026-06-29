#!/usr/bin/env bash
# cssOS GPU 3D worker — Hunyuan3D-2 install (run ON the V100 DLVM box)
# Base image: deeplearning-platform-release/pytorch-2-9-cu129-ubuntu-2204-nvidia-580
# (torch + CUDA 12.9 + NVIDIA driver 580 already present)
set -euo pipefail

echo "[setup] nvidia-smi:"; nvidia-smi || { echo "GPU driver not ready yet (DLVM first-boot installs it). Re-run in a minute."; exit 1; }

sudo mkdir -p /srv/ifilm && sudo chown -R "$USER" /srv/ifilm
cd /srv/ifilm

# --- system deps for mesh / rasterizer / blender headless ---
sudo apt-get update -y
sudo apt-get install -y git build-essential libgl1 libglib2.0-0 libxrender1 \
  libxi6 libxxf86vm1 libxfixes3 libxkbcommon0 ninja-build

# --- python venv (separate from system torch so we pin compatible versions) ---
# DLVM ships a conda 'base' with torch already CUDA-enabled; reuse it.
python3 -c "import torch; print('[setup] torch', torch.__version__, 'cuda', torch.version.cuda, 'avail', torch.cuda.is_available())"

# --- Hunyuan3D-2 ---
if [ ! -d Hunyuan3D-2 ]; then
  git clone --depth 1 https://github.com/Tencent/Hunyuan3D-2.git
fi
cd Hunyuan3D-2
pip install -r requirements.txt
pip install -e .
# texture / paint extra modules (custom rasterizer + differentiable renderer)
( cd hy3dgen/texgen/custom_rasterizer && pip install -e . ) || echo "[setup] WARN custom_rasterizer build failed -> texture bake disabled, shape-only fallback"
( cd hy3dgen/texgen/differentiable_renderer && pip install -e . ) || echo "[setup] WARN diff_renderer build failed -> texture bake disabled"
cd /srv/ifilm

# --- HTTP service deps ---
pip install flask requests trimesh

# --- Blender for GLB->USDZ (reuse atelier's glb2usdz.py logic locally so no round trip) ---
if [ ! -x /usr/local/bin/blender ]; then
  cd /tmp
  BL=blender-4.2.3-linux-x64
  wget -q "https://download.blender.org/release/Blender4.2/${BL}.tar.xz"
  sudo tar -xJf "${BL}.tar.xz" -C /opt/
  sudo ln -sf "/opt/${BL}/blender" /usr/local/bin/blender
  cd /srv/ifilm
fi

echo "[setup] pre-downloading Hunyuan3D-2 weights (first run caches them)…"
python3 - <<'PY' || echo "[setup] weight prefetch deferred to first request"
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
Hunyuan3DDiTFlowMatchingPipeline.from_pretrained('tencent/Hunyuan3D-2')
print("[setup] shape weights cached")
PY

echo "[setup] DONE. Install service: sudo cp /srv/ifilm/hunyuan.service /etc/systemd/system/ && sudo systemctl enable --now hunyuan"
