#!/usr/bin/env bash
# cssTV → App Store。写成脚本而不是口头步骤, 是因为这里有【两道会白白烧掉一个审核周期】的前提,
# 口头交接必然有一次忘掉。两道都装成硬闸, 不满足就不往下走。
#
#   bash scripts/tvos-appstore-submit.sh              # 归档 → 导出 → 上传(到此为止)
#   bash scripts/tvos-appstore-submit.sh --preflight  # 只查两道闸, 什么都不做
#
# 【为什么不自动提交审核】: 上传一个 build 到 App Store Connect 是可逆的(它只是躺在那儿);
# 「提交审核」是对外、且会在开发者记录上留下结果的一步。那一下留给 Jing 在 ASC 里点,
# 或者他明确说一声我再跑。脚本最后会把位置印出来。
set -uo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRE_ONLY=0; [ "${1:-}" = "--preflight" ] && PRE_ONLY=1

ASC_APP_ID="${ASC_APP_ID:-6784525214}"      # cssTV
BUNDLE_ID="CSSStudio.cssTV"
SCHEME="cssTV"
PROJ="tvos/cssTV.xcodeproj"
OUT="${OUT:-/tmp/csstv-appstore}"

set -a; . ./.env.local; set +a
: "${APP_STORE_CONNECT_KEY_ID:?缺 APP_STORE_CONNECT_KEY_ID}"
: "${APP_STORE_CONNECT_ISSUER_ID:?缺 APP_STORE_CONNECT_ISSUER_ID}"
: "${APP_STORE_CONNECT_KEY_PATH:?缺 APP_STORE_CONNECT_KEY_PATH}"

hr() { printf '\n── %s\n' "$1"; }
FAIL=0

# ── 闸 1: Apple 协议(具体是 PLA · Program License Agreement)─────────────
# 2026-11-19 实测, 两头都问过, 结论一致:
#
#   ① ASC API: 四个端点(apps / certificates / profiles / bundleIds)全回
#      403 FORBIDDEN.REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED → 账号级, 不是 key 权限。
#   ② 直接跑 -exportArchive(不靠推断, 让 Apple 自己说), 它说得更准:
#      "Unable to process request - PLA Update available
#       You currently don't have access to this membership resource. To resolve this
#       issue, your team's Account Holder, Jing Du, must agree to the latest
#       Program License Agreement."
#      "No 'iOS Distribution' signing certificate matching team ID QBG9PRVBYZ
#       with a private key was found."
#
# 所以缺的是 **PLA**(不是税务/银行那几份), 而且 Apple 点名【Account Holder 本人】。
#   https://developer.apple.com/account  → 首页 "Review Agreement" 横幅
#
# 关于证书, 2026-11-19 查清的事实(别再重复排查):
#   · App Store 分发【描述文件】本机有, 有效期到 2027-05-12
#     (tvOS Team Store Provisioning Profile: CSSStudio.cssTV / .TopShelf)
#   · 它引用的证书 "Apple Distribution: Jing Du (QBG9PRVBYZ)" 也没过期
#   · 但那张证书的**私钥不在这台机器上** —— 把证书从描述文件里抠出来导入 keychain,
#     identity 数量仍然是 0。证书没私钥 = 不能签。
#   · 要拿到能用的: 要么从当初造它的那台 Mac 导 .p12, 要么新签一张 ——
#     而新签走的就是 /v1/certificates, 正是 403 的那个端点。
#   · 归档(archive)不需要分发证书, 用开发证书就过了, 所以 ** ARCHIVE SUCCEEDED **
#     不代表能发 —— 卡在下一步 export。
#
# PLA 一签, -allowProvisioningUpdates 会自己把分发证书签出来, 这条链就通了。
# ⚠ 2026-11-19: PLA 刚签完那段时间, 同一分钟内 200 与 403 **交替出现** ——
#   Apple 的边缘节点传播不同步, 两个端点各自还有自己的进度(实测 /v1/apps 先通,
#   /v1/certificates 晚两分钟)。所以【采一次样判不了】: 撞上 403 就把整条路停掉,
#   而其实已经签好了。改成重试到出现一次 200 为止, 并把
#   【没签】与【还在传播】分开说(平台教训: 轮询器不许把"我没查到"渲染成"还没到")。
hr "闸 1 · Apple 协议(ASC API 通不通)"
ASC_TRIES="${ASC_TRIES:-8}"
asc_probe() { node - <<'JS' 2>/dev/null
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
const KID=process.env.APP_STORE_CONNECT_KEY_ID, ISS=process.env.APP_STORE_CONNECT_ISSUER_ID,
      KP=process.env.APP_STORE_CONNECT_KEY_PATH;
const b64=(o)=>Buffer.from(JSON.stringify(o)).toString("base64url");
const now=Math.floor(Date.now()/1000);
const h=b64({alg:"ES256",kid:KID,typ:"JWT"}), p=b64({iss:ISS,iat:now,exp:now+600,aud:"appstoreconnect-v1"});
const der=crypto.createSign("SHA256").update(`${h}.${p}`).sign({key:readFileSync(KP,"utf8"),dsaEncoding:"der"});
let o=2; if(der[1]&0x80) o=2+(der[1]&0x7f);
const rL=der[o+1], r=der.subarray(o+2,o+2+rL), sO=o+2+rL, sL=der[sO+1], s=der.subarray(sO+2,sO+2+sL);
const pad=(b)=>b.length>=32?b.subarray(b.length-32):Buffer.concat([Buffer.alloc(32-b.length),b]);
const jwt=`${h}.${p}.${Buffer.concat([pad(r),pad(s)]).toString("base64url")}`;
const res=await fetch("https://api.appstoreconnect.apple.com/v1/apps?limit=1",{headers:{Authorization:`Bearer ${jwt}`}});
let code=""; const t=await res.text();
try { code=(JSON.parse(t).errors||[{}])[0].code||""; } catch {}
console.log(`${res.status} ${code}`);
JS
}
ASC_CODE=""
for i in $(seq 1 "$ASC_TRIES"); do
  ASC_CODE=$(asc_probe)
  case "$ASC_CODE" in 200*) break ;; esac
  if [ "$i" -lt "$ASC_TRIES" ]; then
    echo "  第 $i/$ASC_TRIES 次: $ASC_CODE —— 等 45s 再试"
    echo "     (刚签过协议就是这样: 边缘节点没同步完, 200/403 会交替。"
    echo "      采一次样分不清【没签】和【还在传播】, 所以这里一定要重试。)"
    sleep 45
  fi
done
echo "  $ASC_CODE"
case "$ASC_CODE" in
  200*) echo "  ✅ 协议在效, ASC API 通" ;;
  *REQUIRED_AGREEMENTS*)
    echo "  ❌ 缺的是 PLA(Program License Agreement)—— 【整条路堵死, 不是这个脚本的问题】"
    echo "     Apple 自己的原话(实测 -exportArchive 时它吐出来的):"
    echo "       \"your team's Account Holder, Jing Du, must agree to the latest"
    echo "        Program License Agreement.\""
    echo "     链条: PLA 没签 → 签不出 Apple Distribution 证书 → 导不出 App Store 包"
    echo "            → 上传不了 → 提交不了。"
    echo "     只有 Account Holder 本人能签, 别人代不了:"
    echo "       https://developer.apple.com/account  → 首页 \"Review Agreement\" 横幅"
    echo "     (个人→组织转换之后 PLA 常常要重新接受。)"
    echo "     注: 归档不需要分发证书, 所以 ARCHIVE SUCCEEDED 不代表能发。"
    FAIL=1 ;;
  *) echo "  ⚠ ASC API 返回了别的东西 —— 当作【没查到】, 不是通过"; FAIL=1 ;;
esac

# ── 闸 2: api-vm ──────────────────────────────────────────────────────────
# 审核员会打开 App。后端死着的时候 cssTV 的 fetchFeed 必然失败 → 掉到代码里写死的
# 单卡兜底(《混沌の海》), 而那张卡的封面在 cssstudio.app 上(= 死的那台), 取不到。
# 屏幕上就是【首页只有一张卡、还没有封面】—— Guideline 2.1 App Completeness 最典型的拒绝理由。
# 2026-11-16 起 api-vm 的 22/443 两个口连续不通。
hr "闸 2 · api-vm(审核员会打开 App)"
if curl -s -o /dev/null -m 12 https://cssstudio.app/api/health; then
  echo "  ✅ 后端通"
else
  echo "  ❌ https://cssstudio.app 不通 —— 审核员会看到【首页只有一张卡、没有封面】"
  echo "     Guideline 2.1 App Completeness。这一趟十有八九被拒, 还要白等几天。"
  echo "     停机真因(2026-11-19 查实): 【不是机器崩溃, 是项目计费被关】——"
  echo "       This API method requires billing to be enabled on project #cssstudio-gpu"
  echo "     去 Compute Engine 点开机只会再撞一次这个错。正确入口:"
  echo "       https://console.cloud.google.com/billing/enable?project=cssstudio-gpu"
  echo "     注: Cloud SQL 和 api-vm 在【同一个项目】, 计费一关两个一起停,"
  echo "         备份的定时器也在这台 VM 上 —— 机器停着备份就不跑。"
  FAIL=1
fi

if [ "$PRE_ONLY" = "1" ]; then
  hr "只查闸, 结束"; [ "$FAIL" = "0" ] && echo "两道闸都过了, 可以跑不带 --preflight 的。" || echo "有闸没过, 见上。"
  exit "$FAIL"
fi
[ "$FAIL" = "0" ] || { hr "停"; echo "有闸没过 —— 【什么都没做】。先解决上面的, 再跑一次。"; exit 1; }

# ── 归档 → 导出 → 上传 ────────────────────────────────────────────────────
VER=$(grep -m1 -oE 'MARKETING_VERSION = [0-9.]+' "$PROJ/project.pbxproj" | awk '{print $3}' | tr -d ';')
BLD=$(grep -m1 -oE 'CURRENT_PROJECT_VERSION = [0-9]+' "$PROJ/project.pbxproj" | awk '{print $3}' | tr -d ';')
hr "要发的是 cssTV $VER (build $BLD)"
rm -rf "$OUT"; mkdir -p "$OUT"

hr "归档"
xcodebuild archive -project "$PROJ" -scheme "$SCHEME" -configuration Release \
  -destination 'generic/platform=tvOS' -archivePath "$OUT/cssTV.xcarchive" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$APP_STORE_CONNECT_KEY_PATH" \
  -authenticationKeyID "$APP_STORE_CONNECT_KEY_ID" \
  -authenticationKeyIssuerID "$APP_STORE_CONNECT_ISSUER_ID" \
  || { echo "❌ 归档失败"; exit 1; }

hr "导出 App Store 包"
xcodebuild -exportArchive -archivePath "$OUT/cssTV.xcarchive" \
  -exportOptionsPlist tvos/ExportOptions.plist -exportPath "$OUT/export" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$APP_STORE_CONNECT_KEY_PATH" \
  -authenticationKeyID "$APP_STORE_CONNECT_KEY_ID" \
  -authenticationKeyIssuerID "$APP_STORE_CONNECT_ISSUER_ID" \
  || { echo "❌ 导出失败(多半还是证书/描述文件)"; exit 1; }
IPA=$(ls "$OUT/export"/*.ipa 2>/dev/null | head -1)
[ -n "$IPA" ] || { echo "❌ 没找到 .ipa"; exit 1; }
# 只信 ipa 自己的 codesign, 不信 find-identity(平台记过的坑)。
hr "验签(只信 ipa 的 codesign)"
T=$(mktemp -d); (cd "$T" && unzip -q "$IPA" && codesign -dv --verbose=2 Payload/cssTV.app 2>&1 \
  | grep -E "Authority|TeamIdentifier" | head -3); rm -rf "$T"

hr "上传到 App Store Connect"
xcrun altool --upload-app -f "$IPA" -t tvos \
  --apiKey "$APP_STORE_CONNECT_KEY_ID" --apiIssuer "$APP_STORE_CONNECT_ISSUER_ID" \
  || { echo "❌ 上传失败"; exit 1; }

hr "上传完成 —— 到此为止, 【没有提交审核】"
cat <<EOF
  build $BLD 已经躺在 App Store Connect 里(处理要几分钟到半小时)。

  剩下两步是对外的、会在开发者记录上留结果的, 所以留给人:
    1. 更新说明: tvos/WHATS-NEW-1.0.4.md 里 en-US / zh-Hans 两段直接粘
    2. 选上这个 build → 提交审核

  ASC: https://appstoreconnect.apple.com/apps/$ASC_APP_ID/distribution
EOF
