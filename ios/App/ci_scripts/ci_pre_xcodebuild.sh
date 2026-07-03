#!/bin/sh
# Xcode Cloud pre-xcodebuild: 自增构建号。
# 每次构建 CI_BUILD_NUMBER 自增(15,16,17…), 加基数 1000 保证 > 历史已上传版本(曾传过 32),
# 且永远单调递增 → 不再报 "bundle version must be higher than the previously uploaded version"。
set -e
NEWV=$((1000 + ${CI_BUILD_NUMBER:-1}))
cd "$CI_PRIMARY_REPOSITORY_PATH/ios/App"
sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9][0-9]*;/CURRENT_PROJECT_VERSION = ${NEWV};/g" App.xcodeproj/project.pbxproj
echo "[ci] CURRENT_PROJECT_VERSION -> ${NEWV}"
