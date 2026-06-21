# CSS Vision — 从"现在"到"提交" 最终 Checklist(按操作顺序)

状态(2026-06-20): ✅ 编译通过(真机 SDK + 模拟器)· ✅ 模拟器跑通大厅 · ✅ 无内购合规 · ✅ 图标/AASA/鉴权就绪
Team: QBG9PRVBYZ(唯一) · Bundle: app.cssstudio.vision

---

## A. Developer Portal(developer.apple.com)
- [ ] 注册 App ID `app.cssstudio.vision`(Team QBG9PRVBYZ)
- [ ] 勾能力: **Associated Domains**、**Group Activities**(SharePlay)
- [ ] (Sign in with Apple 走 web OAuth, **不需**勾原生 SiwA 能力)

## B. 本机 Xcode(工程已生成,我已 5 次编译 + 模拟器跑通)
- [ ] `cd visionos/CSSImmersive && ./gen.sh`(若又加过文件就重跑一次)
- [ ] Xcode 打开 `CSSImmersive.xcodeproj` → Target → Signing:Team = **QBG9PRVBYZ**,自动签名
- [ ] 选真机 **Apple Vision Pro** → Run

## C. 真机 QA(戴头显走一遍,我代不了)
- [ ] 大厅 Cover Arc:凝视封面放大、捏合进影院
- [ ] 登录门户:凝视魔镜球 → 射光 → **Optic ID 扫眼** → 登录成功
- [ ] 说「CSS」+「创作中国古风《唐伯虎》」→ 创作球(进度↔转速↔呼吸)→ 出片进影院
- [ ] 影院:画有声、**逐字情绪字幕**、环绕银幕、转头切语言
- [ ] 多部:「CSS 创作《唐伯虎》三部曲」
- [ ] Siri:「用 CSS Vision 创作」→ 追问 → 口述 → 接力创作
- [ ] 确认**无任何付费按钮**(打赏/买断/充值已隐藏)
- [ ] 退出干净(无残留窗)

## D. App Store Connect — 建【独立 visionOS App 记录】
- [ ] 新建 App,平台 = **visionOS**,绑定 `app.cssstudio.vision`
- [ ] 填元数据(见 ASC_METADATA_DRAFT.md):名称/副标题/关键词/描述/What's New
- [ ] **隐私问卷**(见草稿表):账号+用户内容+语音;语音=设备端识别只回文本不存录音;均不追踪
- [ ] 类别:娱乐 / 音乐
- [ ] 支持 URL + 隐私政策 URL(复用 cssstudio.app 现有页)
- [ ] **审核备注**(见草稿):web OAuth+Optic ID 登录说明、**首版无内购**、原创无真人、测试账号 + demo 咒语

## E. 截图(必须头显内实拍,模拟器截图也可先用)
- [ ] 大厅 Cover Arc
- [ ] 登录门户(射光那一刻)
- [ ] 创作球(进度中)
- [ ] 影院 + 逐字情绪字幕(招牌!)
- 建议 3–4 张,最少 1 张

## F. Archive & 提交
- [ ] Xcode → destination 选「Any visionOS Device」→ Product → **Archive**
- [ ] Organizer → Distribute App → App Store Connect → Upload
- [ ] ASC 里选该 build → 填齐 → **Submit for Review**

---

## ⚠️ 提交前 3 个最容易被拒的点(已预防)
1. **3.1.1 内购** → 已做无内购边界(`CSSPayments.visionPurchasesEnabled=false`)✅
2. **Sign in with Apple(4.8)** → 我们用 Apple ✅;审核备注已说明 web OAuth+Optic ID 流程
3. **隐私(语音/麦克风)** → usage string 已写 + 问卷答案备好 ✅

## 已就绪(代码侧全部完成,无需再动)
- 编译(真机+模拟器)· 图标(白底分层)· AASA(含 vision AppID)· entitlements(Associated Domains + Group Activities)· 后端(create-single + 鉴权 + 字幕)· 无内购边界
