/* W2197 回归 — Jing 截图:「头顶头的胶囊」。
 *
 * 宪法原话:「ALL inactive pills concave toward active」/「零激活会退化成飘椭圆」。
 * 实测(浏览器现场): 折叠态下 🎞Visuals 与 ♪Takes【一个 cc 类都没有】, 缝 0px / 6px,
 * 而其余四个都是 -20px 咬合 —— 各自独立的整椭圆、彼此留缝 = 飘椭圆回归。
 *
 * 根因: paintConcave 的 v1(折叠)分支是当年只有【语言/声线】两个模式时写的,
 * 只认 activeHead 与 inactiveHead。W2088 加了 Visuals、之后又加了 Takes,
 * 这两个新头在折叠态永远拿不到类。
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
const src = read("public/app.lang-flag-pills.js");
const live = src.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");
const v1 = (/if \(!expanded\) \{([\s\S]*?)\n      setZ\(\);/.exec(live) || [])[1] || "";

ok("抠得出折叠态分支(判据本身没瞎)", !!v1);
ok("折叠态不再只认 inactiveHead", !!v1 && !/p === inactiveHead/.test(v1),
   "只认一个头 = Visuals / Takes 永远拿不到类 = 飘椭圆");
ok("折叠态按【激活左右】给所有头分类",
   !!v1 && /i > _ai/.test(v1) && /cssos-cc-left/.test(v1) && /cssos-cc-right/.test(v1));
ok("折叠态也走 addBite(一条缝只许被咬一次)", !!v1 && /addBite\(p, "cssos-cc-left"/.test(v1));
ok("没有激活头时不擅自造一个", !!v1 && /if \(_ai < 0\) return;/.test(v1),
   "宪法说零激活该默认激活第一个, 但那是【有选择语义】的轨; 模式头不该被凭空点亮");
ok("addBite 定义在两个分支之前(v1/v2 共用)",
   live.indexOf("function addBite") > 0 && live.indexOf("function addBite") < live.indexOf("if (!expanded)"));

/* 按真几何模拟: cc-right 右伸 20, cc-left 左伸 20, cc-solid 不伸。
 * 对任意头数、任意激活位置, 要求: ①每个头都有类 ②每条缝只被咬一次(≤20)。 */
const EXT = { "cssos-cc-right": { r: 20, l: 0 }, "cssos-cc-left": { r: 0, l: 20 }, "cssos-cc-solid": { r: 0, l: 0 } };
function assign(n, ai) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(i === ai ? "cssos-cc-solid" : (i > ai ? "cssos-cc-left" : "cssos-cc-right"));
  // addBite: cc-left 撞上左邻的 cc-right → 降 solid
  for (let i = 1; i < n; i++) if (out[i] === "cssos-cc-left" && out[i - 1] === "cssos-cc-right") out[i] = "cssos-cc-solid";
  return out;
}
let allOk = true, noGap = true;
for (let n = 2; n <= 8; n++) for (let ai = 0; ai < n; ai++) {
  const cls = assign(n, ai);
  if (cls.some((c) => !c)) allOk = false;
  for (let i = 1; i < n; i++) {
    const bite = EXT[cls[i - 1]].r + EXT[cls[i]].l;
    if (bite > 20) noGap = false;          // 双咬
    if (bite === 0) noGap = false;         // 留缝 = 飘椭圆
  }
}
ok("模拟 2~8 个头 × 任意激活位: 每个头都拿到类", allOk);
ok("模拟 2~8 个头 × 任意激活位: 每条缝恰好咬一次(不双咬、不留缝)", noGap);

/* W2198 — 窗口三键的点击边界预告(Jing 拍板: 保留方块几何, 只补 1px 分隔边) */
const css = read("public/style.css");
ok("窗口三键补了 1px 右分隔边",
   /\.panel-bar \.panel-actions\.cssmv-pill-bar > \*:not\(:last-child\) \{[\s\S]{0,120}?border-right: 1px solid rgba\(0, 245, 160, 0\.30\) !important;/.test(css),
   "胶囊宪法的中和规则把 .icon-btn 四边 1px 清成 0, 三颗方块之间没有任何分界线");
ok("末位不补(轨道自身右缘就是它的边界)", /:not\(:last-child\)/.test(css));
/* 这一条第一版我写成了 `… === false || true` —— 永远为真, 等于没测。
 * 真要守的是【方块几何没被换成凸嵌凹】: 那条规则里不许出现 mask-image / 负 margin /
 * 999px 圆角, 否则就是偷偷把窗口三键改成了胶囊。 */
const paRule = (/\.panel-bar \.panel-actions\.cssmv-pill-bar > \*:not\(:last-child\) \{([\s\S]*?)\}/.exec(css) || [])[1] || "";
ok("抠得出那条规则(判据本身没瞎)", !!paRule);
ok("保留方块几何: 规则里没有 mask-image / 负 margin / 999px 圆角",
   !!paRule && !/mask-image/.test(paRule) && !/margin[^:]*:\s*-/.test(paRule) && !/999px/.test(paRule),
   "三颗里没有哪一颗该常亮 —— 点亮最小化键会看着像已最小化, 所以不做凸嵌凹");

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
