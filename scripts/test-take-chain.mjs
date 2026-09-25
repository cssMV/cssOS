/* W2186/W2187 回归 — Jing:「必须先播放完该首歌所有的 take(除非用户干预),
 * 有多少个 ♪ 就播放多少个 ♪, 才能切歌到另一首歌」+「不同 ♪ 显示该 ♪ 的时长和封面图」。
 *
 * 真根因不是缺功能: app.playlists.js 的 step() 早就实现了 ♪1→♪N 才翻页(W2113/W2116)。
 * 是 seekTo() 无条件 state.take = 1 把它抹掉了 —— 每次结束都在 ♪1↔♪2 之间打转。
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };
const live = (s) => s.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");

// ① 连播: seekTo 只在【换到另一首】时归位 ♪1
const pls = live(read("public/app.playlists.js"));
const seek = /seekTo\(id\)\s*\{([\s\S]{0,700}?)const idx =/.exec(pls);
ok("找到 seekTo 开头(判据本身没瞎)", !!seek);
ok("seekTo 不再无条件把 take 清回 ♪1",
   !!seek && !/^\s*state\.take = 1;/m.test(seek[1]),
   "无条件清零 = 队列刚选好的 ♪2 当场被打回 ♪1, 连播永远走不到第二版");
ok("seekTo 只在目标是【另一首】时才归位",
   !!seek && /_same/.test(seek[1]) && /if \(!_same\) state\.take = 1;/.test(seek[1]));
ok("step() 里 ♪1→♪N 才翻页的闸门仍在原处(W1928 换来的位置不许挪)",
   /if \(state\.take < nTake\) \{ state\.take \+= 1; return emitSwitch\(cur\); \}/.test(pls));

// ② 时长跟着版本走: 真源带 secs, 卡片只读不猜
const pill = live(read("public/app.mv-language-pill.js"));
ok("胶囊登记身份时带上这一版自己的 secs",
   /__cssosActiveTakeCover = \{[\s\S]{0,200}?secs:/.test(pill),
   "不带 secs, 卡片只能自己去作品上查 take —— 查不到就回落作品时长");
const cap = live(read("public/app.watch-cinema-caption.js"));
ok("卡片时长读真源的 secs, 不再拿作品对象去查 take",
   /_takeSecs = Math\.floor\(Number\(_tc\.secs/.test(cap),
   "cssosTakes.at(w, N) 里 w 是作品、take 挂在轨上, 永远取不到");

// ③b W2189 — 胶囊文字: ♪ 紧贴版本号, 版本号与时长用中间圆点隔开
const flag = read("public/app.lang-flag-pills.js");
ok("take 格子里 ♪ 与版本号之间不留间距",
   /\.cssos-cell-take \.lang-name\{margin-left:0 !important;\}/.test(flag),
   "那 5px 来自 .lang-name 的 margin-left(给旗帜+语言名准备的), ♪2 不该被拆开");
ok("版本号与时长用中间圆点", /_sp\.textContent = "\\u00b7\\u00a0" \+ _dur;/.test(pill));

// ③c W2189 — 转化卡等到最后一版放完才弹
const share = live(read("public/app.share-link-router.js"));
ok("转化卡在还有未播的 ♪ 时不弹",
   /maybeNudge = function \(\) \{[\s\S]{0,400}?__cssosTakeState[\s\S]{0,200}?< Number\(_ts\.count\)\) return;/.test(share),
   "♪1 结束只是这首歌的六分之一, 那时弹卡等于中途盖屏");

// ③d W2189 — 卡片没带价格字段时按作品 id 拉一次(feed 路进去显示 ¢69/$5.99 的根因)
const rail = live(read("public/app.watch-social-rail.js"));
ok("右轨缺价格字段时会去拉作品公开信息", /if \(priceFieldsMissing\(w\)\) fetchPrices\(id0\);/.test(rail));
ok("买断价先问拉回来的缓存(买断关闭 = Priceless)",
   /c\.buyoutEnabled === false\) return 0;/.test(rail));

// ③e W2190 — 合成视频让位给每版封面(Jing 拍板)
ok("只对合成命名让位, 真拍视频不碰",
   /\/\(\?:canon\|epic\|film\)-\//.test(pill),
   "canon-/epic-/film- 本来就是拿这几张定妆照烧出来的; 内容哈希 vid- 的真视频绝不能藏");
ok("藏视频走平台那一份, 不自己写",
   /__cssosFallbackHideVideo/.test(pill) && !/visibility[^\n]*hidden[^\n]*important/.test(pill),
   "W1989 的结论: 藏画面靠 visibility 不靠 opacity, 另写一份必然写错");
const fb = live(read("public/app.video-slideshow-fallback.js"));
ok("接管这块屏时, 2.5s 巡检不再把视频还回去",
   /else if \(takeCoverOwnsScreen\(\)\) \{/.test(fb),
   "不给 owner 一个可问的真源, 藏好的视频 3 秒内必被还回去(实测)");
ok("换歌时把接管登记摘掉",
   /__cssosTakeCoverOwnsScreen = null;/.test(fb),
   "不摘会漏到下一首 —— 上一首的登记把 Popol Wuj 的真视频也按住了");
const slides = live(read("public/app.cover-slideshow.js"));
ok("1.5s 兜底优先用【当前这一版】的封面",
   /_currentCoverUrl\(\) \{[\s\S]{0,600}?__cssosActiveTakeCover/.test(slides),
   "不优先就会在切版后 1.5s 内把作品封面盖回去(实测拍到过)");

// ④ 不许再有第二套连播机制(重复造轮子)
for (const f of ["public/app.watch-ui.js", "public/app.up-next-strip.js",
                 "public/app.watch-playback-watchdog.js"]) {
  ok(`${f.split("/").pop()} 里没有平行的连播闸`,
     !/cssosAdvanceTakeChainModule|cssosTakeChainStepModule/.test(read(f)),
     "平台已有 step() 那一套, 再加一套会互相打架(state.take 与 __cssosTakeState 各说各话)");
}

// ⑤ 封面按 take 数出满
const panel = live(read("public/app.mv-pipeline-panel.js"));
ok("定妆照张数按 take 数出满", /state\.coverCount = Math\.max\(_takeCount/.test(panel));

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
