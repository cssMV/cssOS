# cssTV — App Store Connect 提交素材(可直接复制粘贴)

> 配套 [TESTFLIGHT_CHECKLIST.md](TESTFLIGHT_CHECKLIST.md)。定位:**纯欣赏**(无创作/无内购/无外部购买)。
> 隐私政策:https://cssstudio.app/privacy.html (已含 tvOS 披露 §9)。更新 2026-06-26。

---

## 1. App Privacy 问卷(ASC「App Privacy」逐项答案)

> cssTV 纯欣赏:浏览公开作品免费、登录可选(设备码)。比 iOS 版收集少——**不收创作内容**。

**Data Used to Track You:** None(不做跨 app/网站追踪,无广告 SDK)。

**Data Linked to You**(登录后,与账号关联):
- **Contact Info → Email Address** — 用途:App Functionality(账号登录/找回)。
- **Identifiers → User ID**(CSS Studio UUID)— 用途:App Functionality。

**Data Not Linked to You**:
- **Usage Data → Product Interaction**(播了哪首/打开哪个面板)— 用途:Analytics + App Functionality。
- **Diagnostics → Crash Data / Performance**(崩溃/性能)— 用途:App Functionality。

**未收集(明确否)**:精确/粗略位置、健康、财务、联系人、照片、浏览历史、搜索历史(站内搜索不留存个人画像)、敏感信息、用户内容(tvOS 无创作)。

> 未登录浏览:仅 Usage/Diagnostics(Not Linked)。登录后追加 Email + User ID(Linked)。

## 2. 商店列表文案(英文默认)

- **App Name:** `cssTV — Emotion Subtitle Cinema`(≤30 字符,可缩 `cssTV`)
- **Subtitle:** `Music videos that sing on screen`(≤30)
- **Promotional Text:** `Watch AI music videos where every word bursts to life — per-word emotion subtitles, in many languages and voices, on your big screen.`
- **Keywords**(≤100 字符,逗号分隔,无空格浪费):
  `music video,karaoke,lyrics,subtitles,MV,cinema,opera,AI music,multilingual,emotion`
- **Description:**
```
cssTV turns your Apple TV into a cinema for AI-generated music videos with a world-first feature: emotion subtitles — every word bursts onto the screen as it's sung, sized and colored by its emotion, in the song's own language and voice.

• Per-word emotion subtitles — the signature of cssOS
• Many languages & voices — switch the language/voice track on the fly
• Widescreen 2.39 cinema with synced visuals
• Operas, trilogies, series and films — multi-part works play back-to-back
• A fresh For You feed, updated continuously

Free to watch. Sign in (optional) to keep your favorites in sync.
```
- **Category:** Primary `Entertainment`,Secondary `Music`
- **Support URL:** `https://cssstudio.app`  **Marketing URL:** `https://cssstudio.app`
- **Privacy Policy URL:** `https://cssstudio.app/privacy.html`

## 3. Review Notes(给审核员,粘到 App Review Information)

```
cssTV is a viewing-only Apple TV app for AI-generated music videos. It is free; there are no in-app purchases, subscriptions, or external purchase links anywhere in the app.

Sign-in is OPTIONAL (only to sync favorites). To sign in:
1. Open the app; focus the logo (top-left) and press Select — a code appears.
2. On any browser go to https://cssstudio.app/tv and enter the 6-digit code.
Demo account (if you prefer pre-signed-in): <填一个可登录的 demo 账号 email/激活方式>

Top Shelf: to see the featured carousel, move the cssTV icon to the TOP row of the Home screen (standard tvOS behavior).

All content is AI-generated or platform-original. No real, identifiable living persons are depicted.
```
> ⚠️ 待你填:demo 账号(给 reviewer 一个能登录的账号,或说明匿名浏览即可——其实未登录也能看,可写 "no account needed to review: browsing is free")。

## 4. 截图 shot-list(tvOS,App Store 需 1920×1080 或 3840×2160)

至少 1 张(建议 3–5 张,App 预览视频更佳):
1. **首页 hero** — 某首作品大幅 2.39 hero + 侧栏 + For You,激活胶囊绿。
2. **影院 + 情绪字幕** — 招牌!逐字爆字幕在画面上炸开(最好抓到爆字瞬间)。
3. **多语言胶囊** — 影院右下凹凸镶嵌语言胶囊(orig/zh… 母语🔒)。
4. **多部连播** — 叠卡/类型徽章(Trilogy/Opera)。
5.(可选)**Top Shelf carousel** — 主屏顶排聚焦时的作品大轮播(需 TestFlight 正式签名才出)。

> 截图获取:tvOS 模拟器 `xcrun simctl io <udid> screenshot`,或真机 Apple TV 录屏后截帧。

## 5. 年龄分级问卷要点

- 无暴力/成人/赌博/恐怖;音乐视频娱乐内容 → 预计 **4+ 或 9+**。
- 无用户生成内容审核问题(tvOS 不创作、不评论上传)。
- 不限制 web 访问(仅登录引导 cssstudio.app/tv)。

---

### 仍需你本人提供/操作
- [ ] demo 账号(或确认"匿名浏览即可审核")
- [ ] 截图 / App 预览视频(按 shot-list)
- [ ] 年龄分级问卷在 ASC 里点选
- [ ] App Privacy 问卷按 §1 在 ASC 里点选

---

## 6. ASC 网页填写进度(2026-06-26 由 Claude in Chrome 代填)

App id 6784525214 · tvOS 1.0 · Build **1.0 (2)** 已挂载 · 图标(分层)随 build 已带。

### ✅ 已填(经 ASC 验证保存)
- App Information:Category = Entertainment / Music;Content Rights = No(非第三方);Age Rating = **4+**(全 None/No,UGC=No 策展口径)
- App Privacy:Privacy Policy URL = https://cssstudio.app/privacy.html;数据 = Email + User ID(App Functionality、关联身份、**不追踪**)→ 待你点 **Publish**
- 截图:4 张已上传(01 情绪字幕招牌打头)

### ⏳ 表单已填好、但卡在"电话必填"未能 Save —— 你来收尾
**真凶**:App Review Information → Contact Information → **Phone number 必填**(带 `+` 国家码),空着导致整页 Save 被拒、文本回滚。
1. 填 **Phone number**(如 `+1...` / `+86...`)→ 点 **Save**:这一存,下面这些已在框里的内容就保住了
   - Promotional Text / Description / Keywords / Support URL / Marketing URL(均已键入)
   - Review Notes(已键入)、Contact 姓名+邮箱(Jing / Du / admin@cssstudio.app)、Sign-in required = 取消
2. App Privacy 页点 **Publish**
3. App Encryption = "None of the algorithms"(已答,免出口合规)
4. 版本发布方式默认 = Automatically release(可改 Manually)
5. 最后点 **Add for Review → Submit**

> ⚠️ 教训:ASC 整页 Save 是原子的——任一必填项(如电话)报错,整页(含文本框)都不保存,表现为"文本框反复变空"。

---

## 7. ✅ ASC 全部填妥(2026-06-26)—— 只差点 "Add for Review → Submit"

版本页 **"Unable to Add for Review" 报错已清空,"Add for Review" 按钮已变蓝可点**。全部必填项已保存:

| 项 | 状态 |
|---|---|
| 截图 4 张(01 情绪字幕招牌打头) | ✅ |
| Promotional Text / Description / Keywords / Support+Marketing URL | ✅ |
| Copyright = `2026 CSS Studio` | ✅ |
| Category = Entertainment / Music | ✅ |
| **Pricing = Free**(175 国 $0.00,已 Confirm+Save) | ✅ |
| Age Rating = **4+**(全 None/No,UGC=No 策展口径) | ✅ |
| Content Rights = No(非第三方) | ✅ |
| App Privacy 数据问卷(Email+UserID·App Functionality·关联身份·不追踪)+ **已 Published** | ✅ |
| Privacy Policy URL `https://cssstudio.app/privacy.html` + **Apple TV 隐私政策全文**(tvOS 专用,已粘) | ✅ |
| Review Notes(免内购/免账号即审/Top Shelf 放顶排)/ Contact(Jing Du · admin@cssstudio.app · 电话已补)/ Sign-in required = 取消 | ✅ |
| App Encryption = "None of the algorithms"(免出口合规) | ✅ |
| Build **1.0 (2)** 已挂 + 分层魔镜图标(Included Assets) | ✅ |

### 唯一剩下(Jing 本人点):
**版本页右上 "Add for Review" → Submit**(正式提交审核 = 发布动作,代填工具不代点)。

### 收尾踩坑备忘
- ASC 整页 Save 原子:任一必填(Copyright/电话)报错 → 整页含文本框都不存,表现为"文本框反复变空"。补齐必填后一次 Save 全保住。
- 大 textarea(Promo/Description/Notes)要用真实键盘 type 填(form_input 设值不触发 React onChange);小 input/select 用 form_input 即可。
- tvOS 图标不单独上传,来自 build 的分层 imagestack;ASC 头部小缩略图 build 处理完会自动刷出魔镜图。
- tvOS 专用 "Apple TV Privacy Policy" 要在框里放**政策全文**(电视端读),不是 URL。
