/* W2336 回归 — Jing:「画面都是有了, 就是一张封面图。可以是真视频吗?」
 *
 * 前半句才是本波修的东西, 而且它【不花一分钱】:
 *   幻灯帧早就生成好、也早就付过钱了(《花の色は》实测 12 叶 × 6 帧 = 71 帧),
 *   只是 loadMarketWorkDescendantsForRoot —— 多部作品【子部】那条查询 ——
 *   从来没把 cover_slides / visual_kind / visual_frames 这几列 SELECT 出来。
 *   子部的 cover_slides=undefined → cssTV 的 slideFrames 退回 [coverURL] 单张
 *   → 三幕六场从头到尾一张封面图。
 *
 * 为什么只在多部作品上发作: root 走 /api/works/market 主查询(那边三列都有),
 * 子部(幕/场/分部/take2)走本函数补齐。W1346 当年给本函数补过【能不能播】那几列
 * (audio/mv URL), 漏了【画面是什么】那几列 —— 同一个 SELECT 列表, 同一类漏法。
 *
 * 判据必须【限定在本函数体内】: 主查询里这三列一直都有, 扫全文件会在没修的代码上也绿。
 * (今晚第四次提醒自己: 判据范围不对, 结论就不对。)
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

const src = read("src/index.ts");

/* ── 子部查询(本波的唯一改动处)──────────────────────────────── */
const iFn = src.indexOf("async function loadMarketWorkDescendantsForRoot");
const iEnd = src.indexOf("\nasync function applyTakeTotalDurationToTree", iFn);
const body = iFn > 0 && iEnd > iFn ? src.slice(iFn, iEnd) : "";
ok("子部查询函数在", body.length > 500);

ok("子部查询取出 cover_slides(幻灯帧)",
   /AS cover_slides/.test(body),
   "不取 → 每个场 cover_slides=undefined → cssTV slideFrames 退回单张封面 → 一张封面图到底");
ok("子部查询取出 visual_kind(这条画面到底是什么)",
   /AS visual_kind/.test(body),
   "多画面胶囊要按它标 video/hybrid/slides; 子部读不到就只能当幻灯");
ok("子部查询取出 visual_frames(几张)",
   /AS visual_frames/.test(body),
   "胶囊要标「N 张」, 数字必须真");
ok("子部查询取出 is_real_video_mv 列本身",
   /w\.is_real_video_mv\b/.test(body),
   "W1970h 的教训: 只在 CASE 里【用】了它却没 SELECT 出来 = 前端读到 undefined");

/* 判据不许分叉 —— 两处判据不同就等于在 UI 上撒谎(W1880 原话)。 */
ok("真视频判据与主查询一致: 认 video_cents / te-trailer / film-",
   /engines'->>'video_cents/.test(body) && /te-trailer/.test(body) && /\/film-/.test(body),
   "逐字照抄主查询那段 CASE, 不另写一份");
ok("绝不拿「有没有 mp4」当真视频判据",
   !/final_mv_asset\.url IS NOT NULL\s*THEN\s*'video'/i.test(body)
     && !/preview_video_url IS NOT NULL\s*THEN\s*'video'/i.test(body),
   "平台的 mp4 很多是我们自己用封面拼的幻灯片视频(canon-/epic-), 按 mp4 判 = 撒谎");

/* ── 取出来还得送到端上: 深层绝对化必须认 cover_slides 且递归子部 ── */
const iAbs = src.indexOf("function absolutizeMarketNodeMediaDeep");
const absBody = iAbs > 0 ? src.slice(iAbs, iAbs + 700) : "";
ok("深层绝对化认 cover_slides 数组",
   /Array\.isArray\(node\.cover_slides\)/.test(absBody),
   "幻灯帧是根相对路径; 不补 host, 原生端(cssTV/cssVision)加载不到");
ok("深层绝对化递归进 children",
   /node\.children\.forEach\(/.test(absBody) && /absolutizeMarketNodeMediaDeep\(child\)/.test(absBody),
   "只处理 root 等于没处理 —— 本波要修的恰恰是子部");

/* ── 端上的兜底不许退化: 真的没有帧时仍退回单张封面, 不能黑屏 ── */
const tv = read("tvos/cssTV/Models.swift");
const iSl = tv.indexOf("var slideFrames: [String]");
const slBody = iSl > 0 ? tv.slice(iSl, iSl + 420) : "";
ok("cssTV: 有帧就放帧",
   /let a = \(coverSlides \?\? \[\]\)/.test(slBody) && /if !a\.isEmpty \{ return a \}/.test(slBody));
ok("cssTV: 真的没帧仍退回单张封面(不黑屏)",
   /if let c = coverURL, !c\.isEmpty \{ return \[c\] \}/.test(slBody),
   "幻灯这一形态永远要有东西可放");

console.log(`\nW2336  ✅ ${pass}  ❌ ${fail}` + (CAL ? "   (CALIBRATE: 期望有 ❌)" : ""));
process.exit(fail ? 1 : 0);
