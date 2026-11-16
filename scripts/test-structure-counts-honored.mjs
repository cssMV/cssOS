/* W2327 回归 — Jing:「3 幕 × 2 场的日本歌剧」, 实得【21 场】, 被生成权闸拒绝
 * (need 21 / have 9), 一部都没建出来, 而 6 场歌词 + 6 张封面的钱已经花掉了。
 * Jing:「两处都改。请从源头改, 确保下一次不需要再这样修改, 直接完整生成。」
 *
 * 根因不是"没听他的话", 是【没有耳朵】: create_work 的入参里从来没有幕数/场数,
 * 场数全由规划 LLM 自己定, 提示里只有一句软约束 "typically 3-12"。
 *
 * 本测试两段:
 *   ① 归一函数【真跑】(从 src/index.ts 真源切出来, 用仓库自带 typescript 真编一遍)
 *      —— 这一段是本波的"保证"所在, 只 grep 字符串证明不了它算得对;
 *   ② 两道闸的【位置】: 花钱闸必须在逐场歌词与封面之前, 建行闸(W2326)必须在第一条
 *      INSERT 之前; 被拒必须退费。
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };

const src = read("src/index.ts");

/* ───────── ① 真源归一函数, 真跑 ───────── */
function liveFns(s) {
  const start = s.indexOf("type CssosStructOuter = {");
  const endMark = s.indexOf("/* Tool schema");
  if (start < 0 || endMark < start) return null;
  const snippet = s.slice(start, endMark);
  const ts = require("typescript");
  const js = ts.transpileModule(
    snippet + "\nmodule.exports = { cssosNormalizeStructurePlan, cssosCountPlanLeaves };",
    { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const mod = { exports: {} };
  try { new Function("module", "exports", "require", js)(mod, mod.exports, require); }
  catch { return null; }
  return (typeof mod.exports.cssosNormalizeStructurePlan === "function") ? mod.exports : null;
}
const fns = liveFns(src);
ok("能从真源取出归一函数并实跑", !!fns,
   "取不出就不要假通过 —— 在测试里抄一份等于没测真源");

if (fns) {
  const { cssosNormalizeStructurePlan: norm, cssosCountPlanLeaves: count } = fns;
  const OPERA = { outer: "Act", inner: "Scene" };
  const FLAT = { outer: "Part", inner: null };

  // Jing 那次的真实形状: 规划器给了 7 幕, 每幕 3 场 = 21 场
  const bloated = Array.from({ length: 7 }, (_v, i) => ({ title: `幕${i + 1}`, sceneCount: 3 }));
  ok("未归一时就是 21 场(复现事故)", count(bloated, true) === 21,
     `实得 ${count(bloated, true)}`);

  const fixed = norm(bloated, OPERA, 3, 2, "主题");
  ok("说死 3 幕 → 恰好 3 幕", fixed.length === 3, `实得 ${fixed.length}`);
  ok("说死每幕 2 场 → 恰好 6 场(21 → 6)", count(fixed, true) === 6,
     `实得 ${count(fixed, true)} —— 这 6 场正好在钱包额度内, 21 场必被拒`);
  ok("每一幕都是 2 场(不是总数对、分布歪)",
     fixed.every((o) => o.sceneCount === 2), JSON.stringify(fixed.map((o) => o.sceneCount)));

  // 补齐方向: 规划器只给 1 幕, 用户要 3 幕
  const thin = [{ title: "唯一一幕", sceneCount: 5 }];
  const padded = norm(thin, OPERA, 3, 2, "主题");
  ok("规划器给得不够时【补齐】到 3 幕", padded.length === 3, `实得 ${padded.length}`);
  ok("补出来的幕带 focus(后面逐场歌词会真写内容, 不是空壳)",
     padded.slice(1).every((o) => String(o.focus || "").length > 0));
  ok("补齐后仍是恰好 6 场", count(padded, true) === 6, `实得 ${count(padded, true)}`);

  /* 最容易漏的一条: scenes 数组存在时, 叶子展开【优先用它】而无视 sceneCount。
   * 只改 sceneCount 不裁 scenes = 这道归一等于没做。 */
  const withScenes = [
    { title: "幕一", scenes: [{ title: "s1" }, { title: "s2" }, { title: "s3" }, { title: "s4" }] },
    { title: "幕二", scenes: [{ title: "t1" }] },
  ];
  const normScenes = norm(withScenes, OPERA, 2, 2, "主题");
  ok("scenes 数组也被裁/补到恰好 2(不只改 sceneCount)",
     normScenes.every((o) => Array.isArray(o.scenes) && o.scenes.length === 2),
     JSON.stringify(normScenes.map((o) => (o.scenes || []).length))
     + " —— 展开侧优先用 scenes, 不裁它这道归一就是摆设");
  ok("带 scenes 时总叶子数也是 4", count(normScenes, true) === 4, `实得 ${count(normScenes, true)}`);

  // 扁平戏路: 没有内层, inner 必须被忽略而不是制造出一层
  const flat = norm([{ title: "A" }, { title: "B" }, { title: "C" }, { title: "D" }], FLAT, 3, 2, "主题");
  ok("扁平戏路(三部曲/短剧)只认 outer, 忽略 inner", flat.length === 3 && count(flat, false) === 3,
     `实得 ${flat.length} 部 / ${count(flat, false)} 叶子`);
  ok("扁平戏路不会被塞进 sceneCount", flat.every((o) => o.sceneCount === undefined));

  // 没说死数字时一个字都不许动(「不选不填→系统算法推荐」)
  const untouched = norm(bloated, OPERA, 0, 0, "主题");
  ok("用户没给数字时【原样不动】, 由规划器自己定",
     untouched.length === 7 && count(untouched, true) === 21,
     "导演自动流铁律: 不填就交给系统, 不是硬塞一个默认值");

  // 上限仍然守得住
  const clamped = norm([{ title: "x" }], OPERA, 3, 9999, "主题", { maxOuter: 5000, maxInner: 120 });
  ok("每幕场数被 maxInner 夹住(防单幕失控)",
     clamped.every((o) => o.sceneCount === 120), JSON.stringify(clamped.map((o) => o.sceneCount)));
}

/* ───────── ② 入参 + 两道闸的位置 ───────── */
ok("工具入参有 outer_count / inner_count",
   /outer_count: \{\s*\n?\s*type: "integer"/.test(src) && /inner_count: \{\s*\n?\s*type: "integer"/.test(src),
   "没有这两个字段, 用户说死的数在结构上就传不进来 —— 这才是 21 场的根因");
ok("读取侧认别名(acts / scenes_per_act / seasons / chapters…)",
   /inp\.outer_count, inp\.acts, inp\.seasons, inp\.chapters/.test(src)
     && /inp\.inner_count, inp\.scenes_per_act/.test(src),
   "模型用更自然的词时不能把用户说死的数丢掉");
ok("数字也写进了规划提示(软约束照样给)",
   /EXACTLY \$\{_reqOuter\}/.test(src) && /the user fixed this/.test(src));
ok("归一只有【一份】规则(内联那份已收口到顶层函数)",
   (src.match(/function cssosNormalizeStructurePlan/g) || []).length === 1
     && /outerPlan = cssosNormalizeStructurePlan\(/.test(src),
   "两份规则 = 下一个人只改对一份");

// 花钱闸: 必须排在逐场歌词(aiLeaves)与封面(renderCover)之前
const segStart = src.indexOf("const capped = leaves.slice(0, MAX_STRUCT)");
const iEarlyGate = src.indexOf("W2327] 闸在花钱之前拒绝");
const iAiLeaves = src.indexOf("const aiLeaves = genPlan.filter");
const iCovers = src.indexOf("const renderCover");
ok("花钱闸存在, 且紧跟在叶子数算出来之后", segStart > 0 && iEarlyGate > segStart,
   `capped=${segStart} gate=${iEarlyGate}`);
ok("【花钱闸排在逐场歌词之前】", iEarlyGate > 0 && iAiLeaves > 0 && iEarlyGate < iAiLeaves,
   `gate=${iEarlyGate} aiLeaves=${iAiLeaves} —— 排在后面 = 先烧 6 次 LLM 再说没权限`);
ok("【花钱闸排在封面之前】", iEarlyGate > 0 && iCovers > 0 && iEarlyGate < iCovers,
   `gate=${iEarlyGate} renderCover=${iCovers} —— 排在后面 = 先烧 6 次出图再说没权限`);
ok("被拒要把 create_work 的预扣【退回去】",
   /generation_gate_refused_before_spend/.test(src),
   "什么都没生成出来就不该收钱 —— 与 W142 对歌词失败的处理一致");

// W2326 那道建行闸不能被这次改动顶掉
const iRowGate = src.search(/checkGenerationGatesOrError\(String\(ctx\.userId\), _gateLeafCount\)/);
const segEnd = src.indexOf("`  After the tool returns work_cards");
const buildSeg = src.slice(src.indexOf("以树结构入库 — root + 子节点"), segEnd);
ok("W2326 的建行闸仍在, 且仍排在第一条 INSERT 之前",
   iRowGate > 0 && buildSeg.indexOf("checkGenerationGatesOrError") >= 0
     && buildSeg.indexOf("checkGenerationGatesOrError") < buildSeg.indexOf("INSERT INTO user_works"),
   "早的那道在'逐部主路径抛异常退回单次大调用'时不会跑, 晚的那道才是权威");
ok("两道闸分工写在注释里(花钱守卫 / 建行守卫)",
   /花钱守卫/.test(src) && /建行守卫/.test(src),
   "不写清楚, 下一个人会把其中一道当重复删掉");

console.log(`\nW2327  ✅ ${pass}  ❌ ${fail}` + (CAL ? "   (CALIBRATE: 期望有 ❌)" : ""));
process.exit(fail ? 1 : 0);
