# 全平台胶囊(Capsule / Pill)风格审计 — 清单

> 目的:让所有面板里的"成排可点控件"统一为胶囊风格。本文档 = **盘点清单**(先看不动)。
> 之后按 §3 一个面板一个面板地套,套完一个在此打勾。日期:2026-05-31。

## 0a. 铁律(Jing 2026-05-31)— 每个胶囊必须带小图标
**禁止纯标签(纯文字)胶囊。** 每一颗胶囊都要有一个小图标(emoji/SVG/字形)在文字前。
- 适用全平台所有面板的所有胶囊(导航/筛选/动作/价格/状态…)。
- 验准每个胶囊时必查此项:无图标 = 不合格,必须补。
- 套新胶囊时也遵守:`图标 + 文案`,文案仍走 tr()/loginCopy()。

## 0. 胶囊标准(单一真相源 — 套的时候都用它)
- **`cssosMakePillBar(containerEl, opts)`** — `public/app.pill-bar.js`(Pill Bar Constitution v28 + Chromatic)。
  带点击/active 态的胶囊条;每个胶囊一种色相(或 `mono:true` 单一品牌绿)。
- **`cssosPillBarStamp(el, textColor)`** — 纯 CSS 盖章(无交互),给静态展示用。
- 容器 `[data-pill-bar]`、子项 `[data-pill-key]`;样式全 `!important`,组件 CSS 压不过。
- 控制胶囊基准:`public/app.watch-control-capsule.js`(右下角"胶囊宪法")。

## 1. 已套胶囊 —— 但「套了 ≠ 准确」,需逐个验准(Jing 提醒 2026-05-31)
> ⚠️ 这些虽已用胶囊/pill,**不能默认正确**。要逐个核对准确性,发现不准就改。验准前一律视为待办。
- ☐ Dock —— `app.dock-pill.js`
- ☐ 欣赏面板右下控制胶囊 —— `app.watch-control-capsule.js`
- ☐ 语言胶囊 —— `app.mv-language-pill.js` / `.watch-language-pill` / `.cssmv-language-pill`
- ☐ 面板筛选胶囊 —— `.panel-filter-pills`(`app.panel-search.js`)
- ☐ 市场/为你创作 筛选条 —— `syncMarketFilterPills`(`app.market-commerce.js`)
- ☐ 作品中心 筛选条 —— `syncWorksFilterPills`(`app.works-center.js`)
- ☐ 音乐输入面板、system-mvs、user-homepage、dm、person-mv-leaderboard —— 已引用 pill-bar

### 1b. 「套了却不准」常见毛病(核对每个胶囊时逐条检查)
- [ ] **active 态错**:当前选中项高亮不对 / 多个同时高亮 / 切换后不更新。
- [ ] **对齐与间距**:胶囊未居中、左右 padding 不均、与相邻控件基线不齐、track 边框与 active 色相不同步。
- [ ] **文字溢出/截断**:长文案(尤其 i18n 其它语言)撑破胶囊或被切;未省略号化。
- [ ] **点击热区**:可点区域 ≠ 视觉胶囊(padding/transparent 区误触或漏触)。
- [ ] **色相错配**:Chromatic 模式色相分配错乱 / 该用 mono 却花了 / track-hue 不跟 active。
- [ ] **语义错位**:胶囊 key 与实际动作不符(点 A 触发 B)、顺序与逻辑不符。
- [ ] **重复/陈旧**:同一处叠了两套胶囊、或旧的非胶囊残留与新胶囊并存。
- [ ] **i18n**:文案硬编码、未走 tr()/loginCopy();切语言后不更新。
- [ ] **合成器安全**:hover/active 用了 filter/box-shadow/背景位移动画(违反防闪铁律),应只 transform/opacity。
- [ ] **隐藏/显示同步**:该随 Dock/idle 一起显隐的没同步(参见控制胶囊宪法)。

## 2. 待统一(⬜ 用的是 mini-btn / cta / chip / ghost-chip,非胶囊;括号=该类按钮出现次数)
按密度排序,密度高的优先收益大:

| 状态 | 面板 / 文件 | ad-hoc 按钮数 | 备注 |
|---|---|---|---|
| 🟡 | `app.market-commerce.js` | 47 | 已有筛选胶囊;卡片内 cta/price-chip 待评估(价格条已是独立胶囊) |
| 🟡 | `app.person-mv-panel.js` | 43 | 已部分用 pill;动作按钮/标签待统一 |
| ⬜ | `app.subscription-panel.js` | 18 | 套餐选择/CTA 按钮 |
| ⬜ | `app.create-cta.js` | 18 | 创建 CTA 按钮组 |
| ⬜ | `app.user-admin-panel.js` | 17 | 管理操作按钮 |
| ⬜ | `app.share-link-router.js` | 14 | 分享落地动作 |
| ⬜ | `app.payments-checkout.js` | 9 | 结账按钮(注意:不规避法务/支付控件) |
| ⬜ | `app.engine-accounts.js` | 8 | BYOK 管理 |
| ⬜ | `app.panel-settings-markup.js` | 7 | 设置项动作 |
| ⬜ | `app.notifications-panel.js` | 7 | 通知动作 |
| ⬜ | `app.tutorials.js` | 6 | 教程导航 |
| ⬜ | `app.login-panel.js` | 6 | 已部分 pill;"先看方案"等按钮 |
| ⬜ | `app.profile-panel.js` | 5 | 资料动作 |
| ⬜ | `app.premium-modal.js` | 4 | 升级 CTA |
| ⬜ | `app.about-panel.js` | 4 | 关于页链接按钮 |
| ⬜ | `app.voice-seed.js` | 4 | 录音/种子动作 |
| ⬜ | `app.work-edit-panel.js`(W544) | — | 保存/取消按钮可胶囊化 |
| ⬜ | `app.draft-rescue-badge.js`(W546) | — | 继续合成/编辑 可胶囊化 |
| ⬜ | 其余 1–2 个: `credit-panel` / `workspaces-panel` / `language-panel` / `delivery-ops-panel` / `dock-settings` / `gift-inbox-panel` / `subscription` 页脚等 | 1–2 | 零散按钮 |

## 3. 套用策略(逐面板执行时遵循)
1. **成排导航/筛选/分段控件** → `cssosMakePillBar`(带 active 态)。
2. **静态展示性标签** → `cssosPillBarStamp`(纯样式)。
3. **单个主 CTA / 价格 / 法务支付控件** → 不强行胶囊化(保持可达性与现有支付/出口合规);价格条已是独立胶囊。
4. **i18n 铁律**:套的过程中所有文案仍走 `tr()`/`loginCopy()`,不硬编码。
5. **合成器安全**:胶囊样式只用 transform/opacity 过渡,不引入 filter/box-shadow 无限动画(防闪铁律)。
6. 每套一个面板:版本 bump + 部署 + 真机看一眼 + 本表打勾,**慢慢来**。

## 4. 进度
- [ ] (示例)第 1 个:`app.subscription-panel.js`
- [ ] 第 2 个:…
> 套一个勾一个。
