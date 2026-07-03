#!/bin/sh
# Xcode Cloud post-clone hook.
# 仓库不提交 Pods/ 和 node_modules/(见 ios/.gitignore + .gitignore),
# 而 Capacitor 的 Podfile 用 ../../node_modules/@capacitor/* 引用 pod,
# 所以 clone 后必须先装 Node 依赖再 pod install,否则 Pods-App.release.xcconfig
# 不存在 → xcodebuild archive exit 65(这正是 build 10/11 失败的原因)。
set -e
set -x

# Xcode Cloud 镜像默认无 Node、CocoaPods 需自备。
export HOMEBREW_NO_INSTALL_CLEANUP=1
export HOMEBREW_NO_AUTO_UPDATE=1
brew install node cocoapods

# 装 JS 依赖(pod 只需要 @capacitor/* 与 @capgo/* 这些包目录存在)。
# --ignore-scripts 跳过 sharp 等原生 postinstall(构建机不需要,省时也避免误挂)。
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm ci --ignore-scripts --no-audit --no-fund

# 生成 Pods/ 与 xcconfig。webDir(public-ios-shell)已随仓库提交,无需 cap sync。
cd "$CI_PRIMARY_REPOSITORY_PATH/ios/App"
pod install --repo-update
