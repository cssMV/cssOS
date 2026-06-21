#!/bin/bash
# CSSOS_WAVE_941 — 一键生成 CSS Vision 的 Xcode 工程并打开。
# 用法: cd 到本目录, 跑  bash gen.sh
set -e
cd "$(dirname "$0")"

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "未装 XcodeGen。先装一次:"
  echo "  brew install xcodegen"
  echo "(没装 Homebrew 就先 https://brew.sh 装 brew)"
  exit 1
fi

xcodegen generate
echo "✅ 已生成 CSSImmersive.xcodeproj"
echo "正在打开 Xcode…"
open CSSImmersive.xcodeproj
echo ""
echo "接下来在 Xcode 里:"
echo "  1) 选中工程 → Signing & Capabilities → Team 选你的 Apple ID"
echo "  2) 顶部设备选你的 Apple Vision Pro(真机)"
echo "  3) 按 ▶︎ Run → 进 App 留空作品 ID → 进入 CSS Cathedral"
