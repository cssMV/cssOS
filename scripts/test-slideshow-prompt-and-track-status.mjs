/* W2338 回归 — 接 W2336「画面都是有了, 就是一张封面图」的后半句。
 *
 * W2336 修的是【帧送不出去】。这一波修的是【送出去了也长得一样】, 外加两个同族的漏:
 *
 * ① 幻灯提示词半年来既没有文明、也没有本场歌词。
 *    civilization 从 2026-05-13(Wave 138)起被写成 `NULL::text` —— 当年的编译期临时桩,
 *    一留半年。于是【文明智能联动】这条"精神脊梁"根本到不了画面层: 一部日本歌剧的
 *    画面提示词里没有一个字提到日本。再加上提示词只用 title(歌剧六场标题本来就相近),
 *    六场拿到的就是同一个标题的六个变体 —— 肉眼看过去跟一张封面图没差别。
 *    (列一直在: loadMarketWorkDescendantsForRoot 和 take2 的 INSERT 都在生产里读 w.civilization。)
 *
 * ② W2332 那条建轨 INSERT 漏了 status。别处都显式写 'pending' 再 UPDATE 成 'ready'。
 *    后果是【一半功能看不见这条轨】: resubtitle 与 GET /language-tracks 不过滤 status
 *    (所以 W2332「字幕能产出了」那条结论成立), 但 available_langs、多语言/多声线胶囊、
 *    以及几处"默认轨"权威查询都过滤 status='ready' —— 轨建了、字幕有了、胶囊里却是空的。
 *
 * ③ 子部查询还漏着 available_langs(W2336 补了画面那几列, 这是同一个洞的最后一列)。
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

/* ── ① 幻灯提示词 ─────────────────────────────────────────────── */
/* 切到【下一个函数定义】为界, 不写死字节数(W2337b 的教训: 写死就是埋雷)。 */
const iSl = src.indexOf("async function enqueueSlideshowPoolGeneration");
const iSlEnd = src.indexOf("\nasync function ", iSl + 10);
const sl = iSl > 0 && iSlEnd > iSl ? src.slice(iSl, iSlEnd) : "";
ok("幻灯生成器在", sl.length > 500);

ok("civilization 的临时桩已拆(不再是 NULL::text)",
   !/NULL::text AS civilization/.test(sl) && /SELECT title, civilization/.test(sl),
   "桩在这里 = 文明智能联动到不了画面层: 日本歌剧的提示词里没有一个字提到日本");
ok("提示词真的用上了 civilization",
   /work\.civilization \? `set in the \$\{work\.civilization\} cultural frame`/.test(sl),
   "取出来不用等于没取");
ok("提示词带上本场【自己的歌词】—— 六场能不同的唯一来源",
   /depicting this moment: \$\{_sceneLines\}/.test(sl) && /lyrics_preview AS lyr/.test(sl),
   "只用 title 的话, 歌剧六场标题本来就相近 → 同一个标题的六个变体");
ok("歌词剥掉方括号行(曲风/配器/舞台说明不是画面)",
   /\!\/\^\[\[\\u3010\]\/\.test\(l\)/.test(sl) || /\\u3010/.test(sl),
   "与「多行方括号块会被唱出来」是同一类坑的另一面 —— 那边被唱出来, 这边被画出来");
ok("提示词带上曲风", /in the visual mood of \$\{work\.style\}/.test(sl));
ok("没有动那句美学描述(构图/美学归 CINEMA_LANDSCAPE.framing)",
   /well-proportioned natural face, NO ugly or deformed or distorted faces/.test(sl),
   "封面艺术氛围铁律: 美学有它自己的真源, 不在这里改");
ok("歌词摘录有长度上限", /\.slice\(0, 260\)/.test(sl),
   "整份词灌进提示词会把真正要紧的前几项挤掉");

/* ── ② 建轨的 status ─────────────────────────────────────────── */
const iMp = src.indexOf("async function enqueueMultipartPartsGeneration");
const iMpEnd = src.indexOf("\nasync function ", iMp + 10);
const mp = iMp > 0 && iMpEnd > iMp ? src.slice(iMp, iMpEnd) : "";
ok("建轨 INSERT 显式写 status='ready'",
   /is_default, alt_audio_url, status\)/.test(mp) && /true, NULLIF\(\$5,''\), 'ready'\)/.test(mp),
   "漏掉 → available_langs / 多语言胶囊 / 默认轨权威查询全都看不见这条轨(它们过滤 status='ready')");
ok("写 'ready' 是说实话: 插进来那一刻 audio_url 已是落好的 R2 活链",
   /audio_url 已经是落好的 R2 活链|本来就是 ready/.test(mp),
   "别处写 pending 是因为那时音频还没生成 —— 这里不是");

/* ── ③ 子部查询的最后一列 ───────────────────────────────────── */
const iFn = src.indexOf("async function loadMarketWorkDescendantsForRoot");
const iEnd = src.indexOf("\nasync function applyTakeTotalDurationToTree", iFn);
const body = iFn > 0 && iEnd > iFn ? src.slice(iFn, iEnd) : "";
ok("子部查询取出 available_langs",
   /AS available_langs/.test(body),
   "不带 → 多语言胶囊在每一个幕/场上都是空的, 而 root 那一行有");
ok("表达式与主查询一致(按 track_order 排, 只取 ready)",
   /array_agg\(wlt\.lang ORDER BY wlt\.track_order\)/.test(body)
     && /wlt\.status = 'ready'/.test(body),
   "两处分叉就会出现「卡片上有这门语言、点进去没有」");

/* ── 不许退步: W2336 那几列还在 ─────────────────────────────── */
ok("W2336 的画面几列没被这波改掉",
   /AS cover_slides/.test(body) && /AS visual_kind/.test(body) && /AS visual_frames/.test(body),
   "同一条 SELECT 列表 —— 改它的时候最容易顺手碰掉邻居");

console.log(`\nW2338  ✅ ${pass}  ❌ ${fail}` + (CAL ? "   (CALIBRATE: 期望有 ❌)" : ""));
process.exit(fail ? 1 : 0);
