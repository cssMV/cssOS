#!/usr/bin/env bash
# W2222 回归 — 顶排横幅(Top Shelf)真正接上平台内容。
#
# Jing:「我们却早早就在 6 社交平台发文说已经实现了。其实一直都还没有实现。」—— 属实。
# 以前顶排显示的是【三张随包的《时间帝国》JPG】, 跟平台有什么、用户在看什么毫无关系。
# 缺的是三块, 缺一块就全盘不成立, 所以三块各自钉住:
#   ① 扩展 entitlements 是【空的】→ 没 App Group 权限, 读也读不到;
#   ② 扩展里写死三张图, 根本没读缓存;
#   ③ 缓存只存封面【URL】, 而扩展进程【没有网络】→ 给 URL 等于没给。
#      真正的活是把封面【下成文件】放进 App Group 共享文件容器。
#
# 校准: CALIBRATE=1 读 git HEAD, ①②③ 应当失败。
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok(){ if [ "$2" = "1" ]; then PASS=$((PASS+1)); echo "  ✅ $1"; else FAIL=$((FAIL+1)); echo "  ❌ $1"; [ -n "${3:-}" ] && echo "       $3"; fi; }
src(){ if [ "${CALIBRATE:-}" = "1" ]; then git show "HEAD:$1" 2>/dev/null || echo ""; else cat "$1" 2>/dev/null || echo ""; fi; }

EXT=$(src tvos/TopShelf/ContentProvider.swift)
ENT=$(src tvos/TopShelf/cssTVTopShelf.entitlements)
CB=$(src tvos/cssTV/CSSBackend.swift)
CV=$(src tvos/cssTV/ContentView.swift)
PLIST=$(src tvos/cssTV-Info.plist)
PBX=$(src tvos/cssTV.xcodeproj/project.pbxproj)

# ① 扩展权限
grep -q "group.CSSStudio.cssTV" <<<"$ENT" && A=1 || A=0
ok "扩展 entitlements 有 App Group 权限" "$A" "原来这份是空的 —— 容器不互通, 写了也读不到"
grep -q "CODE_SIGN_ENTITLEMENTS = TopShelf/cssTVTopShelf.entitlements" <<<"$PBX" && B=1 || B=0
ok "工程确实指向那份 entitlements" "$B"

# ② 扩展读真缓存, 不再写死图
grep -q 'ud.data(forKey: "topshelf_items")' <<<"$EXT" && C=1 || C=0
ok "扩展读 App Group 里的真清单" "$C"
grep -q 'ts-gambit' <<<"$EXT" && D=0 || D=1
ok "代码里不再引用写死的三张图" "$D" "那三张跟平台内容无关, 正是"没实现"的样子"
# 文件本身也要没: 代码不引用但文件还在 = 上架包里仍带着"假实现"的遗骸(585KB 死重量)。
# 首版 ipa 打出来时它们确实还在包里 —— 代码删了不等于包里没了, 必须拆包看。
[ -f tvos/TopShelf/ts-gambit.jpg ] && D2=0 || D2=1
ok "三张图的文件也删了(不在打包目录里)" "$D2"
grep -q 'guard !entries.isEmpty else { return nil }' <<<"$EXT" && E=1 || E=0
ok "拿不到清单就不显示, 不回落假图" "$E" "宁可空着, 也不要再拿三张图冒充已实现"

# ③ 封面必须是本地文件(扩展零网络)
grep -q 'URL(fileURLWithPath: e.file)' <<<"$EXT" && F=1 || F=0
ok "扩展用本地 file:// 图" "$F" "扩展进程没有网络, 远程 URL 在这里渲染不出来"
grep -q 'containerURL(forSecurityApplicationGroupIdentifier: appGroupID)' <<<"$CB" && G=1 || G=0
ok "App 侧把封面下进 App Group 共享【文件容器】" "$G"
# W2224 真机教训: tvOS 不许往 App Group 容器【根目录】写(513 / EPERM "Operation not permitted"),
# 只有 Library/Caches 可写。模拟器完全没这条限制 —— 所以首版在模拟器全绿, 真机上一张图都没落。
grep -q 'appendingPathComponent("Library/Caches", isDirectory: true)' <<<"$CB" && G2=1 || G2=0
ok "缓存目录在 Library/Caches 之下(不是容器根目录)" "$G2" \
   "tvOS 真机: 往容器根目录写 = NSCocoaErrorDomain 513 / EPERM; 这条只有真机暴露得出来"
grep -q 'print("\[topshelf\] 建目录失败' <<<"$CB" && G3=1 || G3=0
ok "建目录/落盘失败会把错误打出来(不再 try? 吞掉)" "$G3" \
   "原来通篇 try?, 于是出现了'清单 10 条但目录不存在'这种查不出所以然的组合"
grep -q 'guard FileManager.default.fileExists(atPath: dest.path) else' <<<"$CB" && G4=1 || G4=0
ok "清单只收【真的存在】的文件" "$G4" \
   "写失败还 append = 扩展拿到死路径, 顶排静静地什么都不显示"
grep -q 'try data.write(to: dest, options: .atomic)' <<<"$CB" && H=1 || H=0
ok "真的落盘成文件(不是只存 URL)" "$H"
grep -q 'for f in old where f.hasPrefix("ts-") && !keep.contains(f)' <<<"$CB" && I=1 || I=0
ok "每轮清掉没用到的旧图" "$I" "顶排就 10 张, 不清理迟早堆成垃圾场"
grep -q 'private static func stableHash' <<<"$CB" && J=1 || J=0
ok "文件名用稳定哈希" "$J" "Swift 的 hashValue 每次启动换种子, 不能当文件名"
grep -q 'Task.detached(priority: .utility)' <<<"$CB" && K=1 || K=0
ok "下载在后台做, 不卡首页" "$K"

# 深链: 选中顶排要落到那一首
grep -q 'csstv://work/' <<<"$EXT" && L=1 || L=0
ok "每项带 csstv://work/<id> 深链" "$L"
grep -q 'item.displayAction = action' <<<"$EXT" && M=1 || M=0
ok "displayAction 与 playAction 都挂上" "$M"
grep -q 'CFBundleURLSchemes' <<<"$PLIST" && N=1 || N=0
ok "App 注册了 csstv scheme" "$N"
grep -qE 'INFOPLIST_FILE = "?cssTV-Info\.plist"?;' <<<"$PBX" && O=1 || O=0
ok "scheme 那份 plist 在同步目录【之外】" "$O" "放进 cssTV/ 会被同步文件夹当资源再拷一份 → Multiple commands produce Info.plist"
grep -q '.onOpenURL { url in' <<<"$CV" && P=1 || P=0
ok "App 处理深链" "$P"
grep -q 'playQueue = \[CSSWork(id: wid)\]' <<<"$CV" && Q=1 || Q=0
ok "feed 没回来也能直接开那一首" "$Q" "冷启动点顶排最常见; 不等 feed = 不让用户盯着首页干等"

# 打包产物层(只在非校准时跑): scheme 真的进了 Info.plist 且没冲掉生成的键
if [ "${CALIBRATE:-}" = "1" ]; then
  echo "  ⏭  产物层跳过"
else
  APP=$(find "$HOME/Library/Developer/Xcode/DerivedData/cssTV-"*/Build/Products -name 'cssTV.app' -path '*simulator*' 2>/dev/null | head -1)
  if [ -n "$APP" ]; then
    S=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleURLTypes:0:CFBundleURLSchemes:0' "$APP/Info.plist" 2>/dev/null)
    ok "产物 Info.plist 里 scheme = csstv (实测: ${S:-无})" "$([ "$S" = "csstv" ] && echo 1 || echo 0)"
    BID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist" 2>/dev/null)
    ok "合并没冲掉生成的键(CFBundleIdentifier=${BID:-无})" "$([ -n "$BID" ] && echo 1 || echo 0)" \
       "GENERATE_INFOPLIST_FILE=YES + INFOPLIST_FILE 是【合并】, 不是替换 —— 冲掉了 App 就装不上"
    EXTAPP=$(find "$APP" -name '*.appex' | head -1)
    ok "扩展确实打进了 App" "$([ -n "$EXTAPP" ] && echo 1 || echo 0)"
  else
    echo "  ⏭  未找到构建产物(先跑一次 xcodebuild)"
  fi
fi

echo
if [ $FAIL -gt 0 ]; then echo "❌ $PASS 过 / $FAIL 败"; exit 1; else echo "✅ $PASS 过 / 0 败"; fi
