# cssTV — TestFlight / App Store 提交清单

> tvOS 原生 App「cssTV」(bundle: `CSSStudio.cssTV`, Team `QBG9PRVBYZ`)。
> 定位:**纯欣赏(TV 只看,不创作、不卖任何东西)**。决策 2026-06-26:先纯欣赏上架,创作走 Web/未来 IAP。
> 更新:2026-06-26(随 W1365–W1372 落地)。逐项勾选,空格=未做。

---

## A. 功能完成度(已就绪)

- [x] 首页 HBO 式(侧栏分类 + 2.39 hero + 多行 rails),进入默认焦点落 hero 第一枚激活胶囊
- [x] 影院播放:画音分层、音频主时钟、2.39 画幅、边框进度条
- [x] 逐字情绪字幕(招牌)
- [x] 多语言 / 多声线胶囊(凹凸镶嵌,热切音频+字幕,母语🔒默认)
- [x] 多部连播 + 短视频转幻灯
- [x] 搜索(后端全库)
- [x] ~~创作台~~ **已移除(纯欣赏上架决策)**;CreateView 代码保留未引用,日后接 IAP 可一键恢复(git revert)
- [x] 设备码登录(`cssstudio.app/tv` + 6 位码)
- [x] 分层视差图标 + 静态 Top Shelf 兜底 + Top Shelf carousel 扩展(代码就绪)
- [x] 运行时禁屏保

## B. App Store 合规(3.1.1 等)

- [x] **观看免费**(无 gate / 无价格 / 无购买)
- [x] **创作已移除** → TV 端零数字消费,3.1.1 **彻底无风险**(无 gate/价格/订阅/创作/购买/外部购买引导)
- [x] TV 端全局**无**「充值 / 桌面 / 购买 / 订阅 / 外部站点」字样或按钮(仅保留登录用 `cssstudio.app/tv`,属设备码登录,Apple 允许)
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

### 最短上架路径(已选:纯欣赏)
1. 补 C(隐私政策 + 数据披露)+ D(截图/描述/分级 + demo 账号 + Review Notes)。
2. Archive(Distribution 签名)→ 上传 ASC → TestFlight 内部组,**重点验 Top Shelf carousel 真机轮播**(正式签名应被系统调起)。
3. 提交审核。3.1.1 已无风险(纯欣赏),主要看隐私表填全 + reviewer 能登录。
4. 上架后再迭代:创作回归(走 StoreKit IAP)、桌面黑屏探针、Top Shelf 深链。
