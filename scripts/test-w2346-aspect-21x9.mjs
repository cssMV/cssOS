/* W2346 回归 — 画幅铁律收紧。
 *
 * Jing 2026-11-20:
 *   「21:9 铁律: 构图, 取景, 输出, 而不要用其他比例的来剪裁, 必须是源输出就是 21:9。」
 *   「不再使用 2.39:1, 改为 21:9。」
 *
 * 两件事, 缺一不可:
 *   ① 我们【发出】的画幅一律 21:9 —— 请求参数、提示词、入库字面量、前端默认值、tvOS 几何。
 *   ② 【接收侧】仍然认 2.39:1 —— 库里和老客户端还在送它。把它删掉不是守铁律, 是造故障。
 *
 * 为什么第 ② 条要写进测试: 「不再使用 X」很容易被下一个人读成「把 X 删干净」。
 * 真删了, 老作品的画幅字段读不出来、老端送上来的请求会被拒 —— 那不是铁律, 那是事故。
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

/* 判据取材只认【代码】, 不认散文 —— 这是 W2344/W2345 连栽两次的地方:
 * 注释里照样会出现 "2.39:1" 这几个字(它是在解释为什么不用它)。 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|#|\*).*$/gm, "");

const srvRaw = read("src/index.ts");
const srv = stripComments(srvRaw);

console.log("\n① 后端: 我们发出的画幅一律 21:9");
ok("没有任何 `aspect_ratio: \"2.39:1\"` 的调用",
   !/aspect_ratio:\s*"2\.39:1"/.test(srv),
   "这是直接发给厂商的画幅。发 2.39:1 → 厂商给不了 → 只能事后裁, 正是铁律禁止的。");
ok("没有把 2.39:1 当默认值",
   !/\|\|\s*"2\.39:1"/.test(srv),
   "默认值是【没人指定时我们自己选的】, 它必须是 21:9。");
ok("没有把 '2.39:1' 写进 INSERT",
   !/'2\.39:1'/.test(srv),
   "入库字面量决定了这个作品以后一直被当成什么画幅。");
ok("提示词里不再写 2.39",
   !/2\.39[:\s]*1?\s*(anamorphic|cinematic)/i.test(srv),
   "提示词是【构图/取景】那一半 —— 告诉模型 2.39, 它就按 2.39 构图。");
ok("次级厂商分支不再退回 16:9 再裁",
   !/:\s*"16:9";\s*\/\/\s*providers use 16:9 internally/.test(srvRaw),
   "原注释是 \"output is composed to 2.39:1 by ffmpeg\" —— 拿 16:9 的源裁超宽,\n" +
   "       裁掉的正是模型本来构图进去的两侧内容。");

console.log("\n② 后端: 接收侧仍然认 2.39:1(删了就是造故障)");
ok("ASPECT_SIZE_MAP 还留着 2.39:1 这个键",
   /"2\.39:1":\s*CINEMA_LANDSCAPE\.size/.test(srvRaw),
   "宪法明写这几个别名键不要删: 库里和老客户端还在用它们。");
ok("callVideoGen 入口仍把 2.39:1 归一化成 21:9",
   /_arIn === "2\.39:1"/.test(srvRaw) && /req\.aspect_ratio = "21:9"/.test(srvRaw));
ok("VideoGenRequest 的类型里仍接受 \"2.39:1\"",
   /aspect_ratio\?:\s*"2\.39:1"/.test(srvRaw),
   "类型收窄了, 老调用方就编译不过 / 老请求就被拒。");

console.log("\n③ 源不是 21:9 必须【吼出来】, 不许静默裁");
ok("real-mv 在拼接前逐镜量了源画幅",
   /\[real-mv\]\[画幅铁律\]/.test(srvRaw) && /ffprobeVideo\(f\)/.test(srvRaw),
   "下面那一步有 crop=, 它会把任何比例裁成 21:9 —— 厂商给了 16:9 我们也看不出来。");
ok("量不到时按【没量到】算, 不按【合规】算",
   /量不到宽高 —— 这是【没量到】, 不是【合规】/.test(srvRaw),
   "平台教训: 校验器必须把「没达成」和「我没查到」分开。");

console.log("\n④ 前端: 默认值与选项");
const ar = read("public/app.aspect-ratio.js");
const arCode = stripComments(ar);
ok("默认画幅解析器一处都不再返回 2.39:1",
   !/return\s*"2\.39:1"/.test(arCode) && /return\s*"21:9"/.test(arCode),
   "桌面横屏的默认画幅就是它定的。");
ok("cinema / anamorphic / 239 三个别名落到 21:9",
   /"cinema":\s*"21:9",\s*"anamorphic":\s*"21:9",\s*"239":\s*"21:9"/.test(arCode));
ok("ASPECT_PRESETS 仍保留 \"2.39:1\" 这个键",
   /"2\.39:1":\s*\{/.test(ar),
   "老作品存的就是这个值; 目录里没有它, 打开就认不出来。");
const wep = read("public/app.work-edit-panel.js");
ok("作品编辑面板的画幅下拉有 21:9 且默认 21:9",
   /<option value="21:9">/.test(wep) && /:\s*"21:9";/.test(wep));
ok("那个下拉的正则认得 21:9(否则 21:9 的作品一打开就被改掉)",
   /\^\(21:9\|2\\\.39:1\|16:9\|1:1\|9:16\)\$/.test(wep),
   "改之前这个正则【没有 21:9】—— 一个 21:9 的作品打开编辑面板, 下拉会静默跳到\n" +
   "       2.39:1, 一保存就把它的画幅改掉了。这是顺带查出来的旧 bug。");

console.log("\n⑤ tvOS: 播放端不许再把 21:9 的源裁成 2.39");
const pv = read("tvos/cssTV/PlayerView.swift");
ok("立了唯一真源常量 CSS_CINEMA_RATIO = 21/9",
   /let CSS_CINEMA_RATIO: CGFloat = 21\.0 \/ 9\.0/.test(pv));
for (const f of ["PlayerView.swift", "ContentView.swift", "SearchView.swift", "IFilmPlayerView.swift"]) {
  const src = read("tvos/cssTV/" + f);
  const code = stripComments(src);
  ok(`${f} 的几何里没有写死的 2.39`,
     !/\/\s*2\.39\b/.test(code) && !/aspectRatio\(2\.39/.test(code) && !/CGFloat\s*=\s*2\.39/.test(code),
     "2.39 的框装 2.3333 的片, resizeAspectFill 会再切掉约 2.4% 的高度 ——\n" +
     "       源已经是对的, 却在播放端被裁了一刀。");
}

console.log(`\n${fail === 0 ? "✅ PASS" : "❌ FAIL"}  ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
