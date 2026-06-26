# cssTV — TestFlight / App Store 提交清单

> tvOS 原生 App「cssTV」(bundle: `CSSStudio.cssTV`, Team `QBG9PRVBYZ`)。
> 定位:**纯欣赏 + 创作(消费已有余额),TV 端不卖任何东西**。
> 更新:2026-06-25(随 W1365–W1371 落地)。逐项勾选,空格=未做。

---

## A. 功能完成度(已就绪)

- [x] 首页 HBO 式(侧栏分类 + 2.39 hero + 多行 rails),进入默认焦点落 hero 第一枚激活胶囊
- [x] 影院播放:画音分层、音频主时钟、2.39 画幅、边框进度条
- [x] 逐字情绪字幕(招牌)
- [x] 多语言 / 多声线胶囊(凹凸镶嵌,热切音频+字幕,母语🔒默认)
- [x] 多部连播 + 短视频转幻灯
- [x] 搜索(后端全库)
- [x] 创作台「Cast an MV」语音优先(🎙 念「CSS,…」,唤醒词自动剥离)
- [x] 设备码登录(`cssstudio.app/tv` + 6 位码)
- [x] 分层视差图标 + 静态 Top Shelf 兜底 + Top Shelf carousel 扩展(代码就绪)
- [x] 运行时禁屏保

## B. App Store 合规(3.1.1 等)

- [x] **观看免费**(无 gate / 无价格 / 无购买)
- [x] **创作消费已有余额**,余额不足=中性提示("Couldn't start it just now. Please try again."),**零购买引导**
- [x] TV 端全局**无**「充值 / 桌面 / 购买 / 订阅 / 外部站点」字样或按钮(仅保留登录用 `cssstudio.app/tv`,属设备码登录,Apple 允许)
- [ ] ⚠️ **残留风险点(中等,可申辩)**:Apple 审核可能主张「创作=解锁功能,需 IAP」。论证=Netflix/Spotify 式"消费已购、App 内不提购买"。若被拒,退路:(1) 创作改 StoreKit 卖算力,或 (2) TV 暂时移除创作(W1367 已验证可一键移除)
- [ ] **Sign in with Apple(4.8)**:确认设备码登录是否需并列 Apple 登录;如需则加

## C. 隐私 / 法务

- [ ] 隐私政策 URL(App Store Connect 必填 + App 内可达)
- [ ] App Privacy 数据披露表(收集了什么:账号、播放遥测等)
- [ ] 内容合规复核:无真实在世人物、无版权侵权(生成内容 + civ 人物已清)
- [ ] 出口合规(加密)声明(用 HTTPS,通常 exempt)

## D. App Store Connect 素材

- [ ] App 名称 / 副标题 / 关键词 / 描述(英文默认,i18n)
- [ ] tvOS 截图(App Store 规格,展示 hero / 影院 / 情绪字幕 / 多语言)
- [ ] App 预览视频(可选,强烈建议——招牌情绪字幕值得展示)
- [ ] 年龄分级问卷
- [ ] 分类(Entertainment / Music)
- [ ] **审核用 demo 账号**(reviewer 用设备码登录,需提供可登录账号 + 在 Review Notes 写清登录步骤)
- [ ] Review Notes:说明"创作消费账号已有额度,TV 不售卖;Top Shelf 需把图标放顶排"

## E. 构建 / 上传

- [ ] Xcode Archive(Release,真机签名 Distribution)
- [ ] 升 `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`
- [ ] 上传到 App Store Connect(Transporter / Xcode Organizer)
- [ ] TestFlight 内部测试组,真机验:
  - [ ] **Top Shelf carousel 真机显示**(把图标拖顶排;正式签名应被系统调用,验证之前 sideload 验不出的那条)
  - [ ] 登录 / 播放 / 多语言切换 / 创作 全链路
  - [ ] 无崩溃(跑多首、连播、切语言、退出重进)

## F. 已知待办(非阻塞,可上架后做)

- [ ] 桌面端"越播越少黑屏"探针(OOM/媒体回收,另案)
- [ ] 创作 StoreKit 算力内购(若走收费创作路线)
- [ ] Top Shelf 点击深链 `csstv://play/<id>` 直接进影院(需主 App 注册 URL scheme + 处理)

---

### 最短上架路径
1. 补 C(隐私)+ D(素材 + demo 账号)→ Archive 上传 → TestFlight 验 Top Shelf。
2. 提交审核;若因"创作需 IAP"被拒 → 一键 W1367 式移除创作先纯欣赏上架,再迭代 IAP。
