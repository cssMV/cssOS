/* W2333/W2334 回归 — Jing:「不要缺失情绪字幕。」
 *
 * 两个叠在一起的缺口:
 *
 * W2333 情绪标注全平台已经坏了: groq 下架了 llama-3.3-70b-versatile → tagWordsWithEmotion
 *   404 → 返回 null → 上游【静默降级】成只存裸时间轴。实测《花の色は》第一场 595 词,
 *   has_emotion=false。不报错、不中断, 只是"情绪"没了 —— 最难发现的那种坏法。
 *
 * W2334 多部作品只有 whisper_words, 从来没有 subtitle-take1.json, 而播放器读的是后者。
 *   Jing 选了【复用已有时间轴合成, 不另花钱】那条(另一条是每部再跑一次 resubtitle,
 *   等于把 whisper 做过的活重做一遍, 20 集的剧就是 20 次)。
 *
 * 本测试守住的是【合成器最容易写错、而且会直接显示在屏幕上】的那一条:
 *   token 的【字】必须取自歌词, 时间才取自词流。
 *   第一版写反了 —— 樱花诗的一行 token 蹦出「銀座」(whisper 听岔的), 行文本却是
 *   「小町の瞳に夜桜が燃える」。逐字字幕是一个字一个字蹦的, 字错了就是满屏错字。
 *
 * 真数据验证(已在生产跑过, 这里只守住代码不退回去):
 *   50/50 行 token 与歌词逐字一致 · 行起点单调 ✅ · 节/行/token 三层都不越界 ✅
 *   · 10 节 50 行(满足 10节40行铁律) · 舞台说明 0 行混入
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
const i0 = src.indexOf("async function cssosSynthSubtitleFromWhisperWords");
const seg = i0 > 0 ? src.slice(i0, i0 + 7000) : "";

/* ── W2333 死模型 ── */
/* 判据必须限定在 tagWordsWithEmotion 【自己的函数体】内。
 * 第一版扫全文件 → 命中了 LLM 路由那一档(28558, 本波【故意没动】, 只报给 Jing)
 * → 在已经修好的代码上也红。判据范围不对, 结论就不对 —— 今晚第二次栽在这上面。 */
const iTag = src.indexOf("async function tagWordsWithEmotion");
const tagBody = iTag > 0 ? src.slice(iTag, iTag + 3000) : "";
ok("情绪标注【自己这一处】不再用已下架的 llama-3.3-70b-versatile",
   iTag > 0 && !/model: "llama-3\.3-70b-versatile"/.test(tagBody),
   "groq 已下架它 → 404 → 情绪静默消失(实测 has_emotion=false)");
ok("换成了实测选出的 qwen3.8-27b, 且留 env 口子",
   /process\.env\.KARAOKE_EMOTION_MODEL \|\| "qwen\/qwen3\.8-27b"/.test(src),
   "选它是拿【真实提示词+真实解析正则】测的: qwen 29/28 行 · gpt-oss-120b 6/28 · gpt-oss-20b 0/28");

/* ── W2334 合成器 ── */
ok("合成器存在", i0 > 0);
ok("【字取歌词】—— token 的字来自行文本, 不是 ASR 词",
   /const chars = \[\.\.\.lineText\]\.filter/.test(seg) && /char: ch,/.test(seg),
   "写反了就会在屏幕上蹦出 whisper 听岔的词(樱花诗里的「銀座」)");
ok("【时间取词流】—— 每字时长由词的真实 onset/offset 均分",
   /wordPer = Math\.max\(0, w\.e - w\.s\) \/ n/.test(seg) && /wordS \+= wordPer/.test(seg),
   "词级时间是真的; 字级是在那一个词内均分(词很短, 这级估算可接受)");
ok("有单调夹(whisper 的词边界自己会重叠)",
   /Math\.max\(wordS, lastEndSec\)/.test(seg) && /lastEndSec = ce/.test(seg),
   "实测源数据有 0.14s 重叠 → 不夹就会出现行起点倒退");
ok("复用 parseLyricsToSections, 不自己切行",
   /parseLyricsToSections\(String\(r\.lyrics_preview/.test(seg),
   "它带着跨行方括号折叠/转义解码/强调剥离 —— 自己切行等于把舞台说明被唱出来那些坑重踩一遍");
ok("复用 upsertSubtitleJson 写入, 不自己传 R2",
   /upsertSubtitleJson\(workId, lang, 1, outSections/.test(seg),
   "写入口统一才有归档/挂轨/互斥那一套");
ok("时间上限按【实测时长】夹, 三层都夹",
   /const capSec = \(Number\(r\.duration_secs\) > 0/.test(seg) && /Math\.min\(sec, capSec\)/.test(seg),
   "W2306 的教训: 只夹 token 不夹行, 等于没夹");
ok("语言标签取不到就【不写】", /没有 language 标签 → 不合成/.test(seg),
   "语言标签铁律: 标错 = 字幕整首哑掉。宁可没有, 不要错的");
ok("默认【不覆盖】已有字幕", /if \(!opts\?\.force && String\(r\.subtitle_take1_json_url/.test(seg));
ok("force 只用于修正合成器自己的坏产出(注释写明)",
   /只用来【修正本函数自己产出的坏字幕】/.test(src));

/* ── 接线 ── */
ok("装在 whisper_words 落库那一处(唯一产出处, 必经)",
   /void cssosSynthSubtitleFromWhisperWords\(workId\)\.catch/.test(src),
   "装在各调用点必漏 —— 闸要装在必经之处");
ok("admin 端点可按 root 批量补, 且串行",
   /api\/admin\/synth-subtitle\/:workId/.test(src)
     && /for \(const id of targets\)/.test(src),
   "铁律: 不要几路并发");

console.log(`\nW2333/W2334  ✅ ${pass}  ❌ ${fail}` + (CAL ? "   (CALIBRATE: 期望有 ❌)" : ""));
process.exit(fail ? 1 : 0);
