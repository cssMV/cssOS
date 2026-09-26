/* W2209 回归 — Jing:「为什么总是久不久就弹出这个废弃的歌词引擎面板?请彻底删掉吧。」
 *
 * 删的是【面板】(窗口壳 + 一切能把它打开的入口), 不是里面的东西 ——
 * #lyrics / #lyric-flow / #lyrics-progress* / #lyrics-grid 是生成流程真在用的数据面:
 * 歌词齐没齐的判据、进度看门狗的字数、seed 回灌判据、creation-flow 最后的兜底歌词源。
 * 删了它们不报错(到处 ?.), 而是【静默改行为】—— 所以本测试两头都判:
 * 面板必须没了, 数据面必须还在。
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
const strip = (s) => s.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/|<!--)/.test(l)).join("\n");

const html = read("public/index.html");
const htmlLive = strip(html);

// ① 面板本体没了
ok("#lyrics-panel 这个面板不存在了",
   !/id="lyrics-panel"/.test(htmlLive),
   "只要这个 id 还在, 任何 openPanel 都能再把它弹出来");
ok("它的窗口壳(标题栏 + 三键 + resize-handle)也没了",
   !/data-i18n="panel\.lyrics"/.test(htmlLive));

// ② 数据面必须原样还在 —— 这是本波最容易搞砸的一半
for (const id of ["lyrics-progress-shell", "lyrics-progress", "lyrics-progress-detail",
                  "lyrics-grid", "lyric-flow"]) {
  ok(`数据面 #${id} 还在`, new RegExp(`id="${id}"`).test(htmlLive),
     "生成流程在写它; 删了不报错, 只会静默改行为");
}
ok('数据面 <pre id="lyrics"> 还在', /<pre class="lyrics engine-lyrics" id="lyrics">/.test(htmlLive),
   "歌词齐没齐的判据 / 进度看门狗 / 兜底歌词源 都读它");
ok("数据面被收进一个永不显示的容器",
   /id="lyrics-engine-surface" hidden[^>]*display:none/.test(htmlLive));

// ③ 每一条【能把它打开】的路都断了
const gone = [
  ["public/app.watch-ui.js",                'lyricsPanel\n      : engine === "music"', "生成开跑时的自动弹出"],
  ["public/app.panel-shortcuts.js",         'l: { action: "lyrics"',                   "l 快捷键"],
  ["public/app.panel-shortcuts.js",         '"#lyrics-panel"',                         "快捷键选择器表"],
  ["public/app.panel-dock-order.js",        '"lyrics": "lyrics-panel"',                "Dock 顺序映射"],
  ["public/app.context-menu.js",            "lyrics: global.lyricsPanel",              "右键菜单"],
  ["public/app.context-menu.js",            '"lyrics-panel": "lyrics"',                "右键菜单反查"],
  ["public/app.i18n-hierarchy-defaults.js", '"lyrics-panel": "lyrics"',                "i18n 层级表"],
  ["public/app.panel-command-settings.js",  '"lyrics-panel": {',                       "快捷键/语音命令注册"],
  ["public/app.panel-settings-markup.js",   '<option value="lyrics">',                 "面板设置下拉项"],
  ["public/app.panel-swipe-nav.js",         '"lyrics-panel":',                         "左右滑动映射"],
  ["public/app.js",                         "click: () => openPanel(lyricsPanel)",     "Dock 动作"],
  ["public/app.js",                         '"lyrics-panel": "lyrics"',                "app.js 的 id→key 表"],
  ["public/app.watch-ui.js",                "[foryouPanel, lyricsPanel,",              "showcase 批量开窗"],
  ["public/app.panel-layout.js",            "lyricsPanel,",                            "showcase 布局顺序"],
];
for (const [f, snippet, what] of gone) {
  ok(`入口已摘: ${what}`, !strip(read(f)).includes(snippet), `${f} 里还留着 ${snippet}`);
}
ok("Dock 默认顺序不再排它",
   !/^\s*"lyrics",$/m.test(strip(read("public/app.js"))));

// ④ 显式早退, 不靠 lyricsPanel 恰好是 null
ok("revealEnginePanel 对 lyrics 显式早退",
   /if \(engine === "lyrics"\) return;/.test(strip(read("public/app.watch-ui.js"))),
   "靠 `if (!panel) return;` 是碰巧不崩, 不是写明了不弹");

// ⑤ null === null 陷阱
const ps = strip(read("public/app.panel-settings.js"));
ok("isLyricsPanel 不再写 panel === lyricsPanel",
   !/isLyricsPanel: panel === lyricsPanel/.test(ps),
   "lyricsPanel 恒为 null, panel 也为 null 时会误判成'这是歌词面板'");
ok("isLyricsPanel 这个键仍在(消费方按名解构)", /isLyricsPanel:/.test(ps));

// ⑥ 缓存键: 改了内容就必须换 ?v=
const changed = [...new Set(gone.map(g => g[0]))].concat([
  "public/app.panel-settings.js", "public/app.i18n-hierarchy-defaults.js",
  "public/app.panel-command-settings.js", "public/app.panel-settings-markup.js",
  "public/app.panel-dock-order.js"]);
const headHtml = execSync("git show HEAD:public/index.html", { encoding: "utf8", maxBuffer: 1 << 28 });
for (const f of [...new Set(changed)]) {
  const base = f.split("/").pop(), esc = base.replace(/\./g, "\\.");
  const v = (html.match(new RegExp(esc + "\\?v=([^\"]+)")) || [])[1];
  const hv = (headHtml.match(new RegExp(esc + "\\?v=([^\"]+)")) || [])[1];
  const same = execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 }) === readFileSync(f, "utf8");
  ok(`${base} 内容改了 ⇒ ?v= 也改了`, same || (v && v !== hv),
     `?v=${v} 与 HEAD 相同但内容已变 —— 浏览器会拿旧字节`);
}

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
