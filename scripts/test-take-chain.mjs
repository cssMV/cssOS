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

// ③ 胶囊里 ♪N 与时长之间必须有不会被压掉的空格
ok("♪N 与时长之间有不间断空格", /_sp\.textContent = "\\u00a0" \+ _dur;/.test(pill),
   '没有它 "♪6 5:04" 会被读成 "♪65:04"');

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
