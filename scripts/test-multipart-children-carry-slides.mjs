/* W2336 / W2336b 回归 — Jing:「画面都是有了, 就是一张封面图。」
 *
 * 这件事【不花一分钱】: 幻灯帧早就生成好、也早就付过钱了(《花の色は》实测 12 叶 × 6 帧 = 71 帧),
 * 只是多部作品的【子部查询】从来没把 cover_slides / visual_frames / available_langs
 * 这几列 SELECT 出来。子部 cover_slides=undefined → cssTV 的 slideFrames 退回
 * [coverURL] 单张 → 三幕六场从头到尾一张封面图。
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 【这份测试自己栽过一次, 所以它现在长这样】
 *
 * W2336 版本的它是 11/0 全绿的 —— 而功能在真机上【完全没生效】。
 * 因为它和我犯了同一个错: 只检查了 loadMarketWorkDescendantsForRoot(单数),
 * 可 /api/works/market 的主路径走的是 loadMarketWorkDescendants(复数)。
 * 判据限定在"本函数体内"是对的, 但【函数挑错了】, 于是在坏代码上照样全绿。
 *
 * 子部查询一共三个, 而且各缺一套不同的列:
 *     loadMineWorkDescendants          /api/works/mine → For You 第一段「自己的作品」
 *     loadMarketWorkDescendants        /api/works/market 主路径          ← 真正在跑的
 *     loadMarketWorkDescendantsForRoot fillMarketStructuredChildren 兜底
 *
 * 所以本测试做两件事, 缺一不可:
 *   ① 三个函数【逐个】查四列 —— 补一个漏两个就报红
 *   ② 锁住【子部查询只有三个】—— 将来有人加第四个, 这里直接失败, 逼他把列带上。
 *      ②才是真正的闸: ①只能守住已知的三个, ②守住"还会不会冒出第四个"。
 *
 * 检测"什么算子部查询": 函数体里有 `w.parent_work_id IS NOT NULL`
 * (只取分部、不取根, 这是子部查询的签名), 而不是靠函数名像不像。
 *
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };

const src = read("src/index.ts");

/* ── 切出每个顶层函数的函数体 ─────────────────────────────────────────
 * 第一版写成"从这个 async function 切到下一个 async function", 结果中间夹着的
 * 普通 `function` 不算边界 —— readSse 的"函数体"一路吞掉了后面三个真正的子部查询,
 * 于是它"四列全有", 还把"恰好三个"那条闸顶掉了。
 * 顶层函数的结尾是【顶格的 `}`】, 按它切才准。 */
const starts = [];
const re = /\n(?:async )?function ([A-Za-z0-9_]+)/g;
let m;
while ((m = re.exec(src))) starts.push({ name: m[1], at: m.index + 1 });
const bodyOf = (i) => {
  const end = src.indexOf("\n}", starts[i].at);
  return src.slice(starts[i].at, end > 0 ? end + 2 : src.length);
};

/* ── 谁是子部查询: 看【取不取分部】, 不看名字 ─────────────────────── */
const descendantFns = starts
  .map((s, i) => ({ name: s.name, body: bodyOf(i) }))
  .filter((f) => /w\.parent_work_id IS NOT NULL/.test(f.body));

console.log(`\n子部查询(按 "w.parent_work_id IS NOT NULL" 认, 不按名字): ${descendantFns.length} 个`);
descendantFns.forEach((f) => console.log(`   · ${f.name}`));
console.log("");

const EXPECTED = ["loadMineWorkDescendants",
                  "loadMarketWorkDescendants",
                  "loadMarketWorkDescendantsForRoot"];

/* ② 结构闸 —— 先判这个, 它比逐列检查更要紧 */
ok(`子部查询恰好 ${EXPECTED.length} 个, 且就是已知那三个`,
   descendantFns.length === EXPECTED.length &&
   EXPECTED.every((n) => descendantFns.some((f) => f.name === n)),
   `实际 ${descendantFns.length} 个: ${descendantFns.map((f) => f.name).join(", ")}\n` +
   `       多出来的那个【也必须带上下面四列】, 否则同一个洞再开一次。\n` +
   `       (W2336 就是因为只补了一个、测试也只查一个, 全绿但没生效。)`);

/* ① 三个函数逐个查四列 */
const COLS = [
  ["cover_slides",
   "不取 → 子部 cover_slides=undefined → cssTV slideFrames 退回单张封面 → 一张封面图到底"],
  ["visual_kind",
   "多画面胶囊按它标 video/hybrid/slides; 子部读不到就只能当幻灯"],
  ["visual_frames",
   "进度/画面数量显示要它; 注意后端回的是字符串(count(*) 走 LooseInt)"],
  ["available_langs",
   "不取 → 多语言 / 多声线胶囊在每一个幕·场上都是空的, 而 root 那行有"],
];

for (const fn of descendantFns) {
  for (const [col, hint] of COLS) {
    ok(`${fn.name} 取出 ${col}`,
       new RegExp(`AS ${col}\\b`).test(fn.body),
       hint);
  }
  ok(`${fn.name} 的 visual_kind 判据带 hybrid 分支`,
     /'hybrid'/.test(fn.body),
     "主查询有 hybrid, 子部没有 = 同一件事两个答案。平台宪法: 两处判据分叉 = UI 上撒谎");
}

console.log(`\n${fail === 0 ? "✅ PASS" : "❌ FAIL"}  ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
