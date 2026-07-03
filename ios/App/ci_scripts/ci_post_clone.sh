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

# @capgo/native-purchases@8.3.10 的 podspec 有 bug:第5行 def has_storekit_265_sdk? 定义在
# podspec 顶层,第47行却在 Pod::Spec.new 块里调用它 → CocoaPods 作用域看不到 →
# "undefined method 'has_storekit_265_sdk?' for module Pod",pod install 直接挂(build 12 死因)。
# 我们不需要 STOREKIT_26_5 优化,把那行 xcconfig 改回纯 $(inherited) 即可(等同本地已验证的安全版)。
POD="$CI_PRIMARY_REPOSITORY_PATH/node_modules/@capgo/native-purchases/CapgoNativePurchases.podspec"
[ -f "$POD" ] && sed -i '' "s#.*OTHER_SWIFT_FLAGS.*#    'OTHER_SWIFT_FLAGS' => '\$(inherited)'#" "$POD" || true

# Capacitor 把 webDir + 配置同步进原生工程的这三样是 gitignore 的(ios/.gitignore App/App/public,
# capacitor.config.json, config.xml),CI clone 没有 → Xcode "Copy public/config.xml/capacitor.config.json"
# 资源阶段报 "The file public couldn't be opened"(build 13 的 3 个错误)。用 cap copy 生成它们
# (public-ios-shell 已提交作 webDir,cap copy 只搬运不动 pods,比 cap sync 轻)。
npx --no-install cap copy ios

# 生成 Pods/ 与 xcconfig。
cd "$CI_PRIMARY_REPOSITORY_PATH/ios/App"
pod install --repo-update
