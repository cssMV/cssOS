/* W2325 回归 — Jing:「请做 B, 后端在 create_work 就建出幕→场两层。」
 *
 * 先把上一轮我自己说错的话纠正在这里, 免得后人照着错的前提改:
 * 【create_work 从 W175 起就真建了 root → act → scene 三层行】。我上一轮只读了扁平那一支
 * (partParentId = rootId), 漏看了它上面 250 行的树型那一支, 于是断言"后端是扁平的"。
 *
 * 真正缺的那一截是【把树带出响应】: 线上 CSSOS_MULTIPART_CINEMA=1, 多部作品走的是
 * shell-only 那条路, 响应只有一个把所有场拉平的 parts_plan —— 幕的归属在路上丢了。
 * 客户端于是永远只能看到"N 个叶子", 画不出「第一幕 · 4 场」。
 *
 * 顺带还暴露了一件更实的事: cssTV 只读 work_cards, 而那条路【根本不返回 work_cards】
 * → 三部曲/歌剧/短剧/连续剧/电影在电视上全都显示成"没创作"。作品其实已经建好了。
 *
 * 本测试四段:
 *   ① splitHierarchy 的第一幕/第一部不再丢自己的名字(用真源函数实跑, 不是看字符串)
 *   ② 后端响应带两层: 场有 parent_id / 幕有 acts_plan / tree 标志
 *   ③ cssTV 接住 multipart_cinema, 并且把 children 也摊平
 *   ④ 后端引擎已在作曲时客户端不再下单(重复计费闸)
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

const idx = read("src/index.ts");
const be  = read("tvos/cssTV/CSSBackend.swift");
const gp  = read("tvos/cssTV/GenProgress.swift");
const cv  = read("tvos/cssTV/CreateView.swift");
const da  = read("tvos/cssTV/DigitalActorsView.swift");

/* ───────── ① splitHierarchy: 实跑真源, 不看字符串 ─────────
 * 把函数体从 src/index.ts 里切出来, 去掉 TS 类型, 用 new Function 实跑。
 * 这样测的是【真的那一份】, 而不是我在测试里抄的一份(抄一份就是造一份)。 */
function liveSplitHierarchy(src) {
  const start = src.indexOf("function splitHierarchy(");
  if (start < 0) return null;
  // 从函数体第一个 { 起配对花括号找结尾(注释里的 { } 不参与 —— 先剥注释反而更容易错, 实测配对就够)
  const i = src.indexOf("{", src.indexOf("| null {", start));
  let depth = 0, end = -1;
  for (let k = i; k < src.length; k += 1) {
    if (src[k] === "{") depth += 1;
    else if (src[k] === "}") { depth -= 1; if (depth === 0) { end = k + 1; break; } }
  }
  if (end < 0) return null;
  /* 去 TS 不手写正则 —— 手写必漏一种标注, 然后得到一个"取不出"的假失败。
   * 用仓库自带的 typescript 把它真编一遍。 */
  const snippet = src.slice(start, end);
  const ts = require("typescript");
  const js = ts.transpileModule(
    "type SceneNode = any; type ActNode = any;\n" + snippet + "\nmodule.exports = splitHierarchy;",
    { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const mod = { exports: {} };
  try { new Function("module", "exports", "require", js)(mod, mod.exports, require); } catch { return null; }
  return typeof mod.exports === "function" ? mod.exports : null;
}
const split = liveSplitHierarchy(idx);
ok("能从 src/index.ts 真源里取出 splitHierarchy 实跑", typeof split === "function",
   "取不出就不要假通过 —— 抄一份到测试里等于没测真源");

if (typeof split === "function") {
  // 复刻 W610/611 组装侧: out.join("\n").trim() → 第一个标记落在第 0 位
  const text = [
    "\n[Act I — 吴宫春晓]",
    "\n[Scene 1 — 吴宫春晓 · 场 1]\n[Verse 1]\n甲\n[Chorus]\n乙",
    "\n[Scene 2 — 吴宫春晓 · 场 2]\n[Verse 1]\n丙\n[Chorus]\n丁",
    "\n[Act II — 会稽沉吟]",
    "\n[Scene 1 — 会稽沉吟 · 场 1]\n[Verse 1]\n戊\n[Chorus]\n己",
  ].join("\n").trim();
  const r = split(text, "Act", "Scene");
  ok("歌剧解析成【树】(nested), 不是扁平", !!r && r.kind === "nested");
  const acts = (r && r.acts) || [];
  ok("幕数 2 · 场数 2+1", acts.length === 2 &&
     acts.reduce((a, x) => a + x.scenes.length, 0) === 3,
     `实得 幕=${acts.length} 场=${acts.reduce((a, x) => a + (x.scenes ? x.scenes.length : 0), 0)}`);
  ok("第一幕保住自己的名字(不是裸 'Act I')",
     !!acts[0] && /吴宫春晓/.test(acts[0].title),
     `实得 ${JSON.stringify(acts[0] && acts[0].title)} —— 组装侧 trim() 让第一个标记落在第 0 位, ` +
     "正则要求前导 \\n, 于是它匹配不上, 副标题被当正文丢掉");

  // 扁平三部曲: 第一部也要拿到乐章名(W604 Jing 要乐章名而不是 "(1/3)")
  const tri = [
    "\n[Part I — 少年的火]\n[Verse 1]\n甲\n[Chorus]\n乙",
    "\n[Part II — 花酒间]\n[Verse 1]\n丙\n[Chorus]\n丁",
    "\n[Part III — 看不穿]\n[Verse 1]\n戊\n[Chorus]\n己",
  ].join("\n").trim();
  const rt = split(tri, "Part", null);
  ok("三部曲仍解析成 3 部", !!rt && rt.kind === "flat" && rt.flat.length === 3,
     `实得 ${rt && rt.kind} / ${rt && rt.flat && rt.flat.length}`);
  ok("第一部也带乐章名(W604: 要「少年的火」不要「(1/3)」)",
     !!rt && !!rt.flat && /少年的火/.test(rt.flat[0].title),
     `实得 ${JSON.stringify(rt && rt.flat && rt.flat[0] && rt.flat[0].title)}`);

  // W1077 兜底不能被这次改动吃掉: LLM 真漏了 [Part I] 时仍要补出 3 部
  const noFirst = [
    "[Verse 1]\n甲\n[Chorus]\n乙",
    "\n[Part II — 花酒间]\n[Verse 1]\n丙\n[Chorus]\n丁",
    "\n[Part III — 看不穿]\n[Verse 1]\n戊\n[Chorus]\n己",
  ].join("\n").trim();
  const rn = split(noFirst, "Part", null);
  ok("W1077 兜底仍在: 真漏了 [Part I] 时照样补成 3 部",
     !!rn && rn.kind === "flat" && rn.flat.length === 3,
     `实得 ${rn && rn.flat && rn.flat.length} 部 —— 这条兜底是《唐伯虎》只出 2 部那次换来的`);
}

/* ───────── ② 后端响应带两层 ───────── */
ok("场带 parent_id —— 场知道自己是哪一幕的",
   /treeScenePlan\.push\(\{[\s\S]{0,260}?parent_id: actId/.test(idx),
   "没有它, 客户端拿到的就只是一串拉平的叶子");
ok("场同时带 act_title / act_sequence(客户端不必再查一次幕)",
   /act_title: act\.title/.test(idx) && /act_sequence: ai \+ 1/.test(idx));
ok("另给一份 acts_plan(幕自己的 id/名字/场数)",
   /const treeActPlan/.test(idx) && /acts_plan: treeActPlan/.test(idx),
   "两份都给是有意的: 一幕的场全建失败时, 没有 acts_plan 那一幕会凭空消失");
ok("幕自己报场数 scene_count —— 不逼客户端数卡片",
   /scene_count: sceneCards\.length/.test(idx));
ok("树型响应打 tree: true 标志", /\n\s*tree: true,\s*\n\s*acts_plan: treeActPlan/.test(idx),
   "客户端按字段读形状, 不按 work_type 猜 —— 「歌剧就一定有场」在今天的库里是错的");
ok("扁平多部明说 tree: false", /\n\s*tree: false,\s*\n\s*acts_plan: \[\],/.test(idx),
   "成一对才有意义: 缺这一半, 客户端又要靠猜");

/* ───────── ③ cssTV 接住 multipart_cinema ───────── */
ok("cssTV 读 multipart_cinema(不再只读 work_cards)",
   /j\?\["multipart_cinema"\] as\? \[String: Any\]/.test(be),
   "线上开关是 1 → 多部作品根本不返回 work_cards → 电视显示成"
   + "「助理只回了文字没真创作」, 而作品其实已经建好");
ok("幕卡从 acts_plan 建, 场卡从 parts_plan 建",
   /mc\["acts_plan"\]/.test(be) && /mc\["parts_plan"\]/.test(be));
ok("场挂到自己的幕上(parent_id), 取不到才退回根",
   /parentWorkId: \(p\["parent_id"\] as\? String\) \?\? root/.test(be));
ok("幕与场【分两段排序】, 不混在一起排",
   /filter \{ \$0\.structureRole == "act" \}\.sorted[\s\S]{0,140}?filter \{ \$0\.structureRole != "act" \}\.sorted/.test(be),
   "幕是 1..N, 场是全局 1..M —— 两套序号混排会把幕插进别人的场中间");
ok("开关关掉时也对: work_cards 的 children 会被摊平",
   /c\["children"\] as\? \[\[String: Any\]\]/.test(be),
   "不摊平则歌剧只剩几张幕卡, 一个叶子都没有, 作曲无从等起");
ok("作品名用根标题, 不拿第一幕的名字冒充",
   /rootTitle: String/.test(be) && /!r\.rootTitle\.isEmpty \? r\.rootTitle/.test(cv)
     && /!r\.rootTitle\.isEmpty \? r\.rootTitle/.test(da));
ok("每幕场数优先用幕自己报的数",
   /act\.declaredSceneCount > 0 \? act\.declaredSceneCount : counted/.test(gp));

/* ───────── ④ 重复计费闸 ───────── */
ok("composeAndWait 有 kickFirst 闸", /kickFirst: Bool = true/.test(be));
ok("kickFirst=false 时一个字都不下单", /if kickFirst \{[\s\S]{0,420}?generateAudio\(workId: first\)/.test(be));
ok("两个创作入口都在后端已点火时关掉下单",
   /kickFirst: !r\.backendDriven/.test(cv) && /kickFirst: !r\.backendDriven/.test(da),
   "multipart_cinema 那条路后端自己已点火 enqueueMultipartPartsGeneration; "
   + "客户端再调 generate-audio 就是第二次下单 —— 此刻音频还没出来, 它会真作一首, 真扣一次钱");

console.log(`\nW2325  ✅ ${pass}  ❌ ${fail}` + (CAL ? "   (CALIBRATE: 期望有 ❌)" : ""));
process.exit(fail ? 1 : 0);
