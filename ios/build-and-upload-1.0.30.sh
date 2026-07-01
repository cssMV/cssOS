#!/bin/bash
# CSSOS 1.0(30) — archive + 上传 App Store。含 iOS 27 UIScene 崩溃修复(W1522)。
#
# 🔴 前提(缺一不可, 否则苹果拒收):
#   1. 装【稳定版 Xcode】(非 beta)。把下面 STABLE_XCODE 改成它的路径。
#   2. 正确的上传 Key: AuthKey_35DP8FZLYS.p8 放进 ~/private_keys/ 或 ~/.appstoreconnect/private_keys/
#      并填写 ISSUER_ID(App Store Connect → Users and Access → Integrations → Keys 页顶部的 Issuer ID)。
#
# 用法: bash ios/build-and-upload-1.0.30.sh
set -e

STABLE_XCODE="/Applications/Xcode.app"          # ← 改成你的稳定版 Xcode 路径
API_KEY_ID="35DP8FZLYS"                          # 正确的上传 Key(见 memory apple_asc_upload_key)
ISSUER_ID="__FILL_ME__"                          # ← 填 ASC 的 Issuer ID

if [ ! -d "$STABLE_XCODE" ]; then
  echo "❌ 找不到稳定版 Xcode: $STABLE_XCODE —— 苹果不收 beta Xcode 打的包, 先装稳定版并改本脚本路径。"; exit 1
fi
if [ "$ISSUER_ID" = "__FILL_ME__" ]; then
  echo "❌ 请先在脚本里填 ISSUER_ID。"; exit 1
fi

export DEVELOPER_DIR="$STABLE_XCODE/Contents/Developer"
ROOT="/Users/jing/cssOS/ios"
WS="$ROOT/App/App.xcworkspace"
ARCHIVE="/tmp/cssOS-1.0.30.xcarchive"
EXPORT_DIR="/tmp/cssOS-1.0.30-export"

echo "== Xcode: $($DEVELOPER_DIR/usr/bin/xcodebuild -version | head -1) =="
echo "== 1/3 archive =="
xcodebuild -workspace "$WS" -scheme "App" -configuration Release \
  -destination "generic/platform=iOS" -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates archive

echo "== 2/3 export (app-store) =="
rm -rf "$EXPORT_DIR"
xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$ROOT/ExportOptions.plist" -exportPath "$EXPORT_DIR" \
  -allowProvisioningUpdates

IPA=$(find "$EXPORT_DIR" -name "*.ipa" | head -1)
echo "== 3/3 upload: $IPA =="
xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$API_KEY_ID" --apiIssuer "$ISSUER_ID"

echo "✅ 上传完成。去 App Store Connect 把新构建 1.0(30) 挂到审核版本, 替掉 1.0(29)。"
