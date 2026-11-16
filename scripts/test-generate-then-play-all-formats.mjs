/* W2328 回归 — Jing:「请确保, 从单曲到电影都要求生成就播放。」
 *
 * 核之前并不成立, 四个真缺口:
 *
 * ① 选角面板只写了 triptych / opera 两个 case —— 短剧/连续剧/电影三个胶囊
 *    【点了等于没点】, 提示里一个字不加, 后端当单曲处理。
 *    (那是 W2323 我自己留下的半成品: 把六个胶囊加上了, 没把提示接上。)
 * ② 「多幕歌剧」这种不带数字的说法, 实测让规划器给出 21 场 → 被生成权闸拒绝
 *    (need 21 / have 9) → 一部都建不出来 → 当然无从播放。
 * ③ 等齐【所有】叶子才开播, 对大戏路根本做不到: MAX_SYNC=6, 超过 6 个叶子的作品
 *    其余只落 "[seed]" 占位词, 而引擎明确跳过 seed 叶子 → 等一个这一轮永不到达的状态。
 * ④ 最隐蔽的一条: parts 来自 playbackParts(只收已有媒体的子部)且在 hydrate 那刻定死。
 *    半成品三部曲打开时 parts.count 可能是 1 → 第一部播完就跳去【别的作品】,
 *    第二三部永远不播 —— 直接违反「三部曲必须 1,2,3 连播」的播放顺序铁律。
 *
 * 说明: cssTV 是 Swift, 本测试判的是【源码事实与顺序】, 不是真跑 Swift ——
 * 行为由 xcodebuild + 真机实测覆盖, 这一份守的是"别再退回去"。
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };

const gp = read("tvos/cssTV/GenProgress.swift");
const be = read("tvos/cssTV/CSSBackend.swift");
const pv = read("tvos/cssTV/PlayerView.swift");
const da = read("tvos/cssTV/DigitalActorsView.swift");
const cv = read("tvos/cssTV/CreateView.swift");

/* ───────── ① 六种戏路都真的到得了后端 ───────── */
ok("有一份共用的戏路短语 cssGenFormatPhrase", /func cssGenFormatPhrase/.test(gp));
for (const f of ["triptych", "opera", "shortplay", "series", "film"]) {
  ok(`${f} 有自己的短语`, new RegExp(`case "${f}":\\s*return " — make it`).test(gp),
     `${f} 没短语 = 这个胶囊点了等于没点, 后端当单曲处理`);
}
ok("选角面板改用共用短语(不再自己 switch)",
   /prompt \+= cssGenFormatPhrase\(format\)/.test(da)
     && !/case "opera":\s*prompt \+=/.test(da),
   "一份文案两个入口各写一遍, 就一定会漏掉一半 —— 这正是本波修的那个漏");
ok("导演台也改用共用短语", /let fmtPhrase = cssGenFormatPhrase\(format\)/.test(cv));

/* ───────── ② 结构数字必须说死 ───────── */
for (const [f, needle] of [
  ["opera", /exactly 3 acts and exactly 2 scenes in each act/],
  ["film", /exactly 3 chapters and exactly 2 scenes in each chapter/],
  ["series", /exactly 1 season of exactly 3 episodes/],
  ["shortplay", /exactly 6 episodes/],
  ["triptych", /exactly 3 parts/],
]) ok(`${f} 的短语把数字说死了`, needle.test(gp),
      "不带数字 = 规划器自由发挥 = 21 场 = 被闸拒 = 建不出来");
ok("没有任何戏路还在用含糊的 'multi-act' 说法",
   !/multi-act opera/.test(gp) && !/multi-act opera/.test(da) && !/multi-act opera/.test(cv),
   "「multi-act」正是 21 场那次的原话");

/* ───────── ③ 第一部好了就开播 ───────── */
const iOrdered = be.indexOf("let ordered = workIds");
const iFirstWin = be.search(/if let first = ordered\.first, !pending\.contains\(first\) \{ return \.ready \}/);
const iAllDone = be.indexOf("if pending.isEmpty { return .ready }");
ok("判据有【第一部(按序)好了就 ready】", iFirstWin > 0,
   "等齐所有叶子对 >6 叶的作品永远等不到(其余是 [seed], 引擎跳过)");
ok("第一部那条判据排在【等齐】之前", iFirstWin > 0 && iAllDone > 0 && iFirstWin < iAllDone,
   `first=${iFirstWin} all=${iAllDone} —— 排在后面就永远先撞上"等齐"`);
ok("认的是【按序第一部】而不是任意一部先好",
   iOrdered > 0 && /ordered\.first/.test(be),
   "铁律要的是从第一部开始播, 不是谁先好播谁");
ok("等待预算跟叶子数走, 不写死",
   /max\(maxWaitSeconds, 600 \+ 120 \* workIds\.count\)/.test(be),
   "一部 20 集的剧, 固定 30 分钟会在引擎还在串行干活时就放弃");

/* ───────── ④ 播放顺序铁律: 不许播完第一部就跳走 ───────── */
ok("parts 用尽时会【回头再问服务端】, 而不是直接跳下一个作品",
   /guard work\.isMultiPart, !work\.id\.isEmpty else \{ playQueueItem\(queueIndex \+ 1\); return \}/.test(pv)
     && /await CSSBackend\.fetchWorkById\(wid\)/.test(pv),
   "半成品三部曲 parts.count==1, 不回头问就等于第二三部永不播放(违反 1,2,3 连播)");
ok("有【前缀一致】守卫, 防止跳过中间那一部",
   /let isPrefix = new\.count > known && Array\(new\.prefix\(known\)\)\.map \{ \$0\.id \} == old/.test(pv),
   "playbackParts 只收有媒体的子部: 二还没好、三先好时新列表是 [一,三], "
   + "按下标取就把第二部跳过去了 —— 同样违反铁律");
ok("前缀不一致时宁可不接(走老行为), 不冒险乱序",
   /playQueueItem\(queueIndex \+ 1\)\s*\/\/ 真的没有下一部\(或顺序有洞\), 才离开/.test(pv));
ok("回头问之前先确认用户没切走(work.id == wid)", /guard work\.id == wid else \{ return \}/.test(pv));

/* ───────── 客户端耐心不得短于服务端 ───────── */
/* 判超时必须【限定在 castMV 自己的函数体里】。
 * 我第一版写成全文件搜 "timeoutInterval = 900", 结果它命中了 generateAudio 的 900,
 * 于是在【旧代码上也通过】—— 一个在该失败的时候不失败的判据, 比没有判据更坏。 */
const iCast = be.indexOf("static func castMV(");
const castBody = iCast > 0 ? be.slice(iCast, iCast + 2200) : "";
ok("castMV 自己的超时是 900s, 与 nginx 的 proxy_read_timeout 900s 对齐",
   /req\.timeoutInterval = 900/.test(castBody),
   "300s 比服务端短 → 电视放弃了服务端还在建 → 用户再按一次 → 真的再建一部(今晚实测如此)。"
   + (castBody ? "castMV 体内实测: " + (castBody.match(/req\.timeoutInterval = \d+/) || ["(没找到)"])[0]
               : "没切到 castMV 函数体"));

console.log(`\nW2328  ✅ ${pass}  ❌ ${fail}` + (CAL ? "   (CALIBRATE: 期望有 ❌)" : ""));
process.exit(fail ? 1 : 0);
