# app.js 拆分 — Phase 0 安全流程(循序渐进, 不可鲁莽)

目标(Jing 的最终愿景): 用户点哪个面板→内核加载哪个; 关哪个→销毁哪个内存。极简未来感。
本目录是通往该愿景的**安全锁**: 让 app.js(34k 行)每一刀拆分都【可证明、可回退、过模拟器】。

## 启动时机
**先过苹果审核 → 再上 TypeScript → 再开始拆。** TS 能让"裸调耦合"在编译期暴露, 是拆分的安全网。

## 唯一真风险
经典脚本(非 module)的 **函数声明提升【不跨文件】**。把一个簇拆到单独文件后, 若【更早加载的代码在顶层执行时】
引用了【更晚文件才定义】的函数/常量, 就会 ReferenceError。→ 安全切法: **声明与执行分离**。

## 每刀的固定流程(逐刀重复)
0. **冻结基线**(整轮拆分前做一次):
   `node scripts/appjs-split/verify-split.mjs --freeze public/app.js`  → 生成 app.js.baseline
1. **切片**: 把要抽的簇(连续行)剪到新文件, app.js 留下其余部分。三个文件示例:
   app.core.js(前段) + app.<cluster>.js(被抽簇) + app.tail.js(后段, 含所有顶层执行/boot)。
   **必须是原 app.js 的连续切片, 拼接无缝(连换行都不增减)。**
2. **边界扫描**(下刀后):
   `node scripts/appjs-split/verify-split.mjs --scan public/app.core.js public/app.<cluster>.js public/app.tail.js`
   要求: 除最后的 app.tail.js 外, 其余 part **无顶层执行**(纯声明)。有则调整切点。
3. **字节级证明**:
   `node scripts/appjs-split/verify-split.mjs --verify scripts/appjs-split/parts.json`
   必须 ✓ 字节级一致 — 否则拼接有误, 禁止部署。
4. **改 index.html**: 用 3 个 `<script src>` 按【同顺序】替换原来的 `app.js?v=...` 一行。顺序 = parts.json 顺序。
5. **部署 + 升版本**(sw cache / build.txt / __CSSOS_BUILD)。
6. **模拟器验证(每刀必做)**: iPhone 17 Pro Max 模拟器 → 清缓存重载 → 控制台**零报错** →
   点 People MV / MV Pipeline / 通知 / 私信 + 连开 6 面板看 LRU + 主界面稳。
7. **回退**: 任何异常 → index.html 改回单个 `app.js?v=...`(原文件未删), 一行恢复。

## 推荐拆分顺序(低风险→高价值)
- Phase 1: 纯叶子工具簇(storage/格式化) — 练手立信心。
- Phase 2: **watch-builders(293 个 buildWatch\*)** — 最大行数下降。
- Phase 3: lyrics / music / video / foryou / delivery / engine 功能簇。
- Phase 4(过审+TS 后): 评估懒加载。**watch 子系统整体懒加载** = 移动端首屏最大杠杆
  (W490h 已禁用移动端自动开 watch → 它本就是"点 MV 才开", 具备懒加载前提)。

## 重要: 这几步【现在不做】
现在只交付本工具(Phase 0)。实际下刀在过审 + TS 之后。app.js 此刻一字未动。
