/* W2344 回归 — Jing:「正在播放媒体的播放面板 MV 面板突然退出, 提示内存过载。」
 *
 * Safari 的 "reloaded because it was using significant memory" 不是 JS 堆爆了
 * (实测堆一路在 24~49MB, 上限 4192MB; 连切 6 首歌节点数还是负增长),
 * 爆的是【进程内存】—— 带滤镜的合成面。
 *
 * 浏览器【不会】因为一个层被挡住、或者 opacity:0, 就跳过为它分配滤镜面。
 * 实测 1680×1050 @dpr2 影院态, 滤镜层合计 ~321MB, 其中看不见的占了一半:
 *     .bg-blob × 3      blur(55px)              105MB  ← 被不透明黑面板全挡
 *     #logo-panel       saturate(.8) blur(1px)    8MB  ← 同上
 *     .panel-settings×14 backdrop blur(14px)     32MB  ← 全部 opacity:0, 且面板越多越涨
 * 改完实测 159MB。
 *
 * 这份测试盯三件事, 少一件这个洞就会悄悄回来:
 *   ① .panel-settings 的模糊只能挂在【开着】那条规则上
 *   ② 遮挡判定必须是【量出来的】, 不是猜状态类
 *      (实测把 .maximized 摘掉面板仍然铺满视口 —— 状态类 ≠ 真的盖住了)
 *   ③ 改了独立脚本/CSS 必须 bump ?v= —— 否则浏览器拿旧文件, 等于没改
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

const css = read("public/style.css");
const bridge = read("public/app.has-class-bridge.js");
const html = read("public/index.html");

/* 取出一条规则的声明块 —— 按选择器找, 切到下一个 } 为界。
 * 不用"从串往后数固定字节"那种写法: 平台栽过(窗口写死字节数, 注释一长就切歪)。 */
const ruleBody = (src, selector) => {
  const i = src.indexOf(selector + " {");
  if (i < 0) return null;
  const j = src.indexOf("}", i);
  return j < 0 ? null : src.slice(i, j);
};

console.log("\n① .panel-settings 的模糊只在【开着】时付钱");
const closed = ruleBody(css, "\n.panel-settings");
const open = ruleBody(css, ".panel.show-settings .panel-settings");
ok("关着那条规则里没有 backdrop-filter",
   !!closed && !/backdrop-filter\s*:\s*blur/.test(closed),
   "关着时 opacity:0, 一个像素都看不见, 可 WebKit 照样为它分配并每帧重采样一块等大离屏面。\n" +
   "       实测同时存在 14 个, 而且【面板开得越多越涨】—— 这是会无限长的那一半。");
ok("开着那条规则里有 backdrop-filter(观感没丢)",
   !!open && /backdrop-filter\s*:\s*blur\(14px\)/.test(open),
   "搬走了就要在开着那条补回来, 否则这是一次【视觉改动】, 不是纯优化。");
ok("开着那条带 -webkit- 前缀(Safari 要)",
   !!open && /-webkit-backdrop-filter\s*:\s*blur\(14px\)/.test(open));

console.log("\n② 遮挡判定必须是量出来的");
ok("桥里维护 cssos-bg-occluded",
   /classList\.toggle\("cssos-bg-occluded"/.test(bridge));
ok("判据量【盖满视口】而不是认状态类",
   /getBoundingClientRect\(\)/.test(bridge) &&
   /r\.right >= vw/.test(bridge) && /r\.bottom >= vh/.test(bridge),
   "实测: 把 .maximized 摘掉之后面板仍然铺满视口(cssmv-cinema 还在)。\n" +
   "       拿状态类当'盖住了'会在窗口态误关背景 = 画面少东西。");
ok("半透明面板不算遮挡(alpha < 1 跳过)",
   /Number\(parts\[3\]\) < 1\) continue/.test(bridge) &&
   /Number\(cs\.opacity\) < 1\) continue/.test(bridge),
   "半透明面板后面是真看得见的。只认完全不透明的背景色。");
ok("量不出来时按【没挡住】处理",
   /catch \(_e2\) \{ occluded = false; \}/.test(bridge),
   "宁可多付内存, 也不能让画面少东西 —— 失败方向必须偏安全的那边。");

console.log("\n③ CSS 规则 + 缓存版本号");
ok("style.css 里有 cssos-bg-occluded 的两条规则",
   /body\.cssos-bg-occluded \.bg-blob/.test(css) &&
   /body\.cssos-bg-occluded #logo-panel/.test(css));
ok("blob 用 visibility:hidden + filter:none 双保险",
   /body\.cssos-bg-occluded \.bg-blob \{[^}]*visibility:\s*hidden[^}]*filter:\s*none/s.test(css));
ok("#logo-panel 只摘滤镜, 不整个隐藏",
   (() => { const b = ruleBody(css, "body.cssos-bg-occluded #logo-panel");
            return !!b && /filter:\s*none/.test(b) && !/visibility:\s*hidden/.test(b); })(),
   "主界面里有魔镜视频等活物, 隐藏整块的副作用面太大。");
ok("index.html 的 style.css?v= 已 bump 到 w2344",
   /style\.css\?v=[^"']*w2344/.test(html),
   "平台记过: 非 bundle 的独立 ?v= 不 bump, 浏览器就拿旧文件 = 代码改了但屏幕上没改。");
ok("index.html 的 app.has-class-bridge.js?v= 已 bump 到 w2344",
   /app\.has-class-bridge\.js\?v=[^"']*w2344/.test(html));

console.log("\n④ 没有顺手动那两块【看得见的】光晕(要动必须先问 Jing)");
const watchCss = read("public/style.watch.css");
ok("#watch-svg.glow 的双层 drop-shadow 原样还在",
   /\.watch-svg\.glow \{[^}]*drop-shadow\(0 0 18px rgba\(0, 245, 160, 0\.55\)\)/s.test(watchCss),
   "它在画面上下边缘【看得见】(21:9 画面 1680×703 装在 1680×1050 的框里, 不是铺满)。\n" +
   "       而且紧挨着 W1983 锁死的媒体框光芒 —— 动它必须先拿 Jing 的 yes。");
/* 这条判据改了两次, 两次都是【判据取材】错, 不是代码错 ——
 *   第一版: 以为 drop-shadow 挂在 .mode-playback 那条规则上, 其实那条只有
 *           transition:none, 光晕在上面的 .cssmv-trail 通用规则里。
 *   第二版: 用 /\.cssmv-trail \{[^}]*filter:/ 去框规则体, 可那段 CSS 是模板串,
 *           里面有 ${TRAIL_STROKE_PX} —— [^}]* 在那个 } 上就断了, 永远框不到 filter。
 * 两次都把【根本没动过的东西】报成了改动。所以现在直接认那一行声明本身。 */
ok(".cssmv-trail 的 drop-shadow 原样还在",
   /filter:\s*drop-shadow\(0 0 8px hsl\(var\(--cssmv-bar-hue, 210\), 92%, 62%\)\);/
     .test(read("public/app.watch-stage-bars.js")),
   "80MB 是单块最大的, 但它是播放进度那圈可见光晕。要改先问。");

console.log(`\n${fail === 0 ? "✅ PASS" : "❌ FAIL"}  ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
