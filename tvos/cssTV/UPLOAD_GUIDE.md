# cssTV — Archive → 上传 App Store Connect

> 工程:`tvos/cssTV.xcodeproj`,scheme `cssTV`,Team `QBG9PRVBYZ`。
> 含主 App `CSSStudio.cssTV` + Top Shelf 扩展 `CSSStudio.cssTV.TopShelf`(版本号必须一致,见下)。
> ⚠️ 上传/登录 Apple 账号、输密码这些由 **Jing 本人**操作(我只给命令,不替你登录/上传)。

---

## 0. 前置(一次性)

- Xcode 已用你的 Apple ID 登录(Settings → Accounts),账号属于该开发团队(QBG9PRVBYZ)。
- App Store Connect 里**已创建 cssTV 这个 App 记录**(Bundle ID `CSSStudio.cssTV`,平台 tvOS)。没有就先在 ASC 建。
- 自动签名会自动拉 Distribution 证书 + Provisioning(CLI 加 `-allowProvisioningUpdates`)。

## 1. 版本号 bump(每次上传都要,build 号必须比上次大)

`MARKETING_VERSION`(对用户,如 1.0)+ `CURRENT_PROJECT_VERSION`(build 号)。
主 App 与扩展**必须同号**——工程里 4 处(主/扩展 × Debug/Release)统一改。

```bash
cd /Users/jing/cssOS/tvos
# 看当前
grep -nE "MARKETING_VERSION|CURRENT_PROJECT_VERSION" cssTV.xcodeproj/project.pbxproj

# 首次上架:营销版本保持 1.0,build 号 1→2(TestFlight 每传一版 +1)
sed -i '' 's/CURRENT_PROJECT_VERSION = 1;/CURRENT_PROJECT_VERSION = 2;/g' cssTV.xcodeproj/project.pbxproj
# (营销版要升时,例如发 1.1:)
# sed -i '' 's/MARKETING_VERSION = 1.0;/MARKETING_VERSION = 1.1;/g' cssTV.xcodeproj/project.pbxproj
```
> 提示:build 号每次提交给 TestFlight 必须唯一且递增,否则 ASC 拒收。

---

## 方式 A:Xcode Organizer(GUI,推荐,最稳)

1. Xcode 打开 `tvos/cssTV.xcodeproj`。
2. 顶部目标选 **cssTV** + 运行目的地选 **Any tvOS Device (arm64)**(不是模拟器)。
3. 菜单 **Product → Archive**(自动 Release 编译 + 打包,含扩展)。
4. 完成后自动弹 **Organizer**(或 Window → Organizer)。选中刚出的 archive → **Distribute App**。
5. 选 **App Store Connect → Upload → Next**(自动签名,让它管 Distribution 证书/描述文件)。
6. 一路 Next → **Upload**。传完去 ASC「TestFlight」标签等处理(几分钟到半小时)。

---

## 方式 B:命令行(可脚本化)

```bash
cd /Users/jing/cssOS/tvos
rm -rf build/cssTV.xcarchive build/export

# 1) Archive(真机 generic 目的地;自动签名拉描述文件)
xcodebuild archive \
  -project cssTV.xcodeproj \
  -scheme cssTV \
  -destination "generic/platform=tvOS" \
  -archivePath build/cssTV.xcarchive \
  -allowProvisioningUpdates

# 2) 导出 .ipa(用仓库里的 ExportOptions.plist;App Store 签名)
xcodebuild -exportArchive \
  -archivePath build/cssTV.xcarchive \
  -exportPath build/export \
  -exportOptionsPlist ExportOptions.plist \
  -allowProvisioningUpdates
# 产物:build/export/cssTV.ipa
```

### 上传(三选一,都由 Jing 本人凭据执行)

**B1. Transporter.app(最省事的 GUI)**：Mac App Store 装「Transporter」→ 登录 Apple ID → 把 `build/export/cssTV.ipa` 拖进去 → Deliver。

**B2. altool + App Store Connect API Key(无需密码,适合脚本)**：
先在 ASC「Users and Access → Integrations → App Store Connect API」建一个 Key,下载 `AuthKey_<KEYID>.p8`,记下 KeyID 和 Issuer ID。
```bash
xcrun altool --upload-app -f build/export/cssTV.ipa -t tvos \
  --apiKey <KEYID> --apiIssuer <ISSUER-UUID>
# .p8 放在 ~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8 即可被自动找到
```

**B3. altool + 专用密码**：appleid.apple.com 生成 App-Specific Password。
```bash
xcrun altool --upload-app -f build/export/cssTV.ipa -t tvos \
  -u <你的AppleID邮箱> -p <app-specific-password>
```

---

## 3. 传完之后(ASC 里)

1. TestFlight → 等构建「Processing」结束 → 加内部测试组 → 真机装,**重点验 Top Shelf 真机轮播**。
2. 填 App 信息:用 [APPSTORE_MATERIALS.md](APPSTORE_MATERIALS.md)(描述/关键词/截图/隐私问卷/Review Notes/分级)。
3. 隐私政策 URL:`https://cssstudio.app/privacy.html`(已上线)。
4. 提交审核。

## 常见坑

- **build 号重复** → ASC 拒收:每次传前 bump `CURRENT_PROJECT_VERSION`。
- **扩展与主 App 版本不一致** → 校验失败:两者 MARKETING/CURRENT 必须同号(sed 已全局替换,无忧)。
- **archive 用了模拟器目的地** → 不能分发:必须 `generic/platform=tvOS`。
- **缺 App 记录** → 上传报 bundle id 找不到:先在 ASC 建好 cssTV App。
- **method 报错**(老 Xcode):把 ExportOptions 的 `app-store-connect` 改回 `app-store`。
