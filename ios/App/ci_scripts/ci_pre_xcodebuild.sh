#!/bin/sh
# Xcode Cloud pre-xcodebuild: 自增构建号, 永远 > 历史已上传(TestFlight 最高 32)。
# 提交的 pbxproj 已抬到 1100; 这里再叠加 CI_BUILD_NUMBER 保证每次构建单调递增且更高。
set -e
NEWV=$((1100 + ${CI_BUILD_NUMBER:-1}))
cd "$CI_PRIMARY_REPOSITORY_PATH/ios/App"
sed -i '' -E "s/(CURRENT_PROJECT_VERSION[[:space:]]*=[[:space:]]*)[0-9]+;/\1${NEWV};/g" App.xcodeproj/project.pbxproj
echo "[ci] target build number = ${NEWV}; actual in pbxproj:"
grep -n "CURRENT_PROJECT_VERSION" App.xcodeproj/project.pbxproj || true
