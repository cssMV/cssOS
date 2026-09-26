/* W2217 回归 — Jing:「KaraOKe MV · Writing the first line now 这句提示是很早期的提示,
 * 后来我们已经改为【没有歌声只有纯音乐的时候用随机音符表示】, 不再是文字提示。
 * 但这个文字提示还是偶尔出现, 请查找删掉, 保留现在的状态。」
 *
 * 为什么它【偶尔】出现: safeSetWatchSubtitleModule 在 cssosKaraokeOwnsSubtitle() 为真时
 * 直接 return —— 只要有歌声在咬字, 这句根本写不进去。它冒出来的唯一场合恰恰是【没有歌声】
 * 的那一刻, 而那一刻按规矩是【随机音符】的地盘。
 *
 * 本测试两头都判: 这句必须不再被产出; 音符与飘入 emoji 那条路必须原样还在。
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };
const strip = (s) => s.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");

const ui     = strip(read("public/app.watch-ui.js"));
const layout = strip(read("public/app.watch-media-layout-p2100.js"));
const emo    = strip(read("public/app.emotion-subtitle-engine.js"));

// ① 这句不再被任何地方产出
ok("全库没有任何地方再写出这句",
   !/loginCopy\("KaraOKe MV · Writing the first line now"\)/.test(ui),
   "app.watch-ui.js 的 syncWatchSubtitleForWaitingMediaModule 是唯一产出方");
ok("画面已就绪时【什么都不写】, 把这一行让给音符",
   /if \(hasWatchArtworkReadyModule\(\)\) \{\s*\n\s*safeSetWatchSubtitleModule\(""\);/.test(ui),
   "不是补一句别的文案 —— 那一刻按规矩是随机音符的地盘");

// ② 光不写还不够: 状态条要真的收回去
ok("同一支里清掉 #watch-status-info", /cssosClearWatchStatusInfo\?\.\(\)/.test(ui),
   "状态文案会被 status-split 搬进绿带; 绿带没人收 → 出现过一次就赖在画面上");
ok("清除入口复用 status-split 自己的 setStatus, 没另写一份",
   /globalThis\.cssosClearWatchStatusInfo = function \(\) \{ try \{ setStatus\(""\); \}/.test(layout));
ok("没有去动 maybeRedirect 那个全局分支",
   /if \(!text\) \{[\s\S]{0,120}?return;\s*\n\s*\}/.test(layout),
   "改它会波及生成中的状态显示 —— 本波只在该负责的那一处显式清");

// ③ 其余生成状态照旧(本波不是把状态文案一锅端)
for (const s of ["KaraOKe MV · Painting the cover now",
                 "KaraOKe MV · Composing music now",
                 "KaraOKe MV · Rendering video now"]) {
  ok(`保留: ${s}`, ui.includes(s), "它们是真·生成状态, 不是本条要删的那一句");
}
ok("status-split 的检测名单留着这条当兜底",
   /\/Writing the first line\/i,/.test(layout),
   "万一旧缓存里还有人产出它, 至少不会落进 #watch-subtitle");

// ④ 【现在的状态】必须原样还在 —— 随机音符 + 四方飘入 emoji
ok("随机音符仍由情绪字幕引擎的 [Music...] cue 生成",
   /_noteGlyphs = \["♪", "♫", "♬", "♩", "🎵", "🎶"\]/.test(emo),
   "W745/W1109; 本波不许碰它");
ok("音符仍是一簇(3-6 个)且随机错位起点", /_ncount = Math\.min\(6, Math\.max\(3,/.test(emo)
   && /_nrot = Math\.floor\(Math\.random\(\) \* 6\)/.test(emo));
ok("器乐段仍发全 adlib 的 music cue", /text: "\[Music\.\.\.\]"/.test(emo));
ok("间奏/前奏/尾声仍能触发(bracket-only 关键词)", /_instrKw = /.test(emo));
// 飘入 emoji 的实现在 app.emotion-fx.js(引擎那边只有注释), 判据要看真身。
const fx = strip(read("public/app.emotion-fx.js"));
ok("四方飘入的 emoji 那条路还在(cssosMusicGapPulse)",
   /globalThis\.cssosMusicGapPulse = function/.test(fx),
   "Jing:「情绪字幕表现为随机小 emoji 从四方向媒体框飘进」");
ok("真的是【从四条边向内】飘, 不是从天而降",
   /var edge = \(Math\.random\(\) \* 4\) \| 0;/.test(fx)
   && /edge === 0\) \{ sx = along; sy = 2;  dx = 0; dy = into; \}/.test(fx),
   "W721 #6: 0上 1右 2下 3左, 各自向内 into");
ok("密度跟音量走", /nn = 1 \+ Math\.round\(vol \* 6\);/.test(fx));
ok("器乐段真会去调它", /globalThis\.cssosMusicGapPulse\(inferredEmotion\)/.test(strip(read("public/app.watch-ui.js"))),
   "判定: 当前 cue 全是 adlib token(即 [Music...])");

// ⑤ 缓存键
const html = read("public/index.html");
const headHtml = execSync("git show HEAD:public/index.html", { encoding: "utf8", maxBuffer: 1 << 28 });
for (const f of ["public/app.watch-ui.js", "public/app.watch-media-layout-p2100.js"]) {
  const base = f.split("/").pop(), esc = base.replace(/\./g, "\\.");
  const v  = (html.match(new RegExp(esc + "\\?v=([^\"]+)")) || [])[1];
  const hv = (headHtml.match(new RegExp(esc + "\\?v=([^\"]+)")) || [])[1];
  const same = execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 }) === readFileSync(f, "utf8");
  ok(`${base} 内容改了 ⇒ ?v= 也改了`, same || (v && v !== hv));
}

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
