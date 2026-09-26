/* W2199 回归 — Jing:「当胶囊头 Takes·6 被选中的时候(轨道上显示的就是它的子胶囊),
 * Languages 胶囊就不应该还处于绿色被选中激活状态, 而是 Takes·6 处于绿色激活状态
 * 和他的一个子胶囊构成双激活胶囊。」
 *
 * 规则一句话:【哪个头展开着, 哪个头就是激活头】——
 * 绿色(.active)与凹咬身份(activeHead)必须是同一条规则, 只改一处会更怪。
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
const flag = read("public/app.lang-flag-pills.js");
const live = flag.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");

// ① 凹咬身份
ok("activeHead 跟着【展开的那个头】走",
   /var activeHead = expandedCap \|\| \(curMode\(\) === "lang" \? langCap : voiceCap\)/.test(live),
   "curMode() 只有 lang/voice 两个值 —— 展开 Takes 时它照样判 Languages");
ok("expandedCap 按 dataset.mode 匹配 _expanded",
   /c\.dataset\.mode === _expanded/.test(live));
ok("inactiveHead 跟着新的 activeHead 推导, 不再写死 curMode",
   /var inactiveHead = \(activeHead === langCap\) \? voiceCap : langCap;/.test(live));

// ② 绿色身份必须同源
ok("模式头的 .active 也跟着展开走",
   /_isExp \? \(_expanded === mode\) : \(curMode\(\) === mode\)/.test(live),
   "凹咬把 Takes 当岛、绿色却画在 Languages 上 = 两套身份打架");
ok("折叠态维持 curMode 语义(_expanded 默认是字符串 none, 不能当假值用)",
   /_expanded === "lang" \|\| _expanded === "voice"[\s\S]{0,80}?_expanded === "take"/.test(live),
   '写成 `_expanded ? …` 会在 "none" 上判真 → 折叠态一个头都不绿');

// ③ 子胶囊不许重复(激活那一对会被 merge 合成一条, 重复就看着像印两遍)
const pill = read("public/app.mv-language-pill.js");
ok("建 take 格子前先清掉轨上同类旧格子",
   /renderTakeCells\(\) \{[\s\S]{0,900}?querySelectorAll\("button\.cssos-cell-take\[data-take\]"\)[\s\S]{0,120}?removeChild/.test(pill),
   "实测现场 take-1..take-6 每个键都有两个元素, 激活那一对被 merge 成一条 → 标签印两遍");

/* ④ 模拟: 头 + 它相邻的激活子胶囊 → merge-l / merge-r(一条连续双激活胶囊) */
const merge = (seq) => {
  // seq: true = 激活。复刻 v2 的 me&&ra → merge-l, me&&la → merge-r
  return seq.map((me, i) => {
    if (!me) return "-";
    const la = !!seq[i - 1], ra = !!seq[i + 1];
    if (la && ra) return "merge-m";
    if (ra) return "merge-l";
    if (la) return "merge-r";
    return "solid";
  });
};
ok("模拟: 激活头紧挨激活子 → merge-l + merge-r(合成一条)",
   JSON.stringify(merge([false, false, true, true, false])) ===
   JSON.stringify(["-", "-", "merge-l", "merge-r", "-"]));
ok("模拟: 激活头没有相邻激活子 → solid(不会错误合并)",
   merge([false, true, false, false])[1] === "solid");

/* ⑤ W2200 — 展开的那个头挪到头组末尾, 紧贴它的子胶囊(否则合不成双激活胶囊) */
ok("展开态把激活头移到 heads 末尾",
   /if \(expanded && activeHead && heads\.indexOf\(activeHead\) >= 0\) \{[\s\S]{0,160}?heads\.filter\([\s\S]{0,80}?\.concat\(\[activeHead\]\);/.test(live),
   "头组固定序 lang,voice,visual,take —— 只有 take 恰好挨着子胶囊, 其余三个合不成一条");
ok("折叠态不挪(没有'展开的头'时头组保持固定序)", /if \(expanded && activeHead/.test(live));
ok("只动视觉次序, 不动 DOM(写的是 style.order)",
   /order\.forEach\(function \(p, i\) \{ p\.style\.order = String\(i\); \}\);/.test(live));

/* 模拟: 四个头 × 每个被展开一次, 激活头都必须紧邻它的子胶囊 */
const HEADS = ["lang", "voice", "visual", "take"];
let adjacentAll = true;
for (const exp of HEADS) {
  const heads = HEADS.filter((h) => h !== exp).concat([exp]);
  const order = heads.concat(["cell-active", "cell-2"]);
  if (order[order.indexOf(exp) + 1] !== "cell-active") adjacentAll = false;
}
ok("模拟: 四个头各展开一次, 激活头都紧邻它的激活子胶囊", adjacentAll);

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
