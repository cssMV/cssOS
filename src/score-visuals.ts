/* CSSOS_WAVE_1703 20260710 — 圣诗 MV 的【忠实画面】。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 第一原则(Jing, 不可动摇)在画面上的落实:
 *
 *     MV 画面必须【忠于歌词】, 不得自由发挥想象力。
 *
 * 这不是"提示词写得虔诚一点"就够了。图像模型的默认先验就是【加戏】——
 * 你给它一句 "I dream of Jeannie", 它会自作主张添上没写的人、没写的场景、
 * 没写的故事。所以约束必须是【显式的负向指令】, 而且要写在 prompt 的末尾
 * (模型对靠后的指令更敏感)。
 *
 * 三条硬约束:
 *   ① 只画这一行歌词【字面说到】的东西。没说的人、物、事件、象征, 一律不画。
 *   ② 抽象句(如 "Happy as the daisies")不许自行编故事, 只呈现该句词语本身唤起的
 *      素朴景象。
 *   ③ 全曲共用【同一个风格锚点】—— 否则 11 帧像 11 个画家画的, 不成一部作品。
 *
 * 画面与音频的时间轴【完全来自乐谱】(lines[].ts_ms), 不做任何估算。
 * ══════════════════════════════════════════════════════════════════════════════
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import sharp from "sharp";

export type ScoreLine = { ts_ms: number | null; text: string };
export type Frame = {
  index: number;
  ts_ms: number;
  end_ms: number;
  text: string;
  prompt: string;
  imagePath?: string;
};

/** 全曲共用的风格锚点。可用环境变量覆盖(例如换成中式水墨圣像风)。 */
export const DEFAULT_STYLE_ANCHOR =
  process.env.CSSOS_SCORE_STYLE ||
  "reverent luminous painterly sacred art, soft natural light, muted harmonious palette, " +
  "the same artistic hand and the same color grade in every frame";

/* W1721 — 每传统的【画面红线】。这是硬约束, 不是风格偏好: 违反造像禁忌是对信众的冒犯。
 * 放在提示词的最末尾(模型对末尾最敏感), 且【不可被 styleAnchor 覆盖】。
 *
 * ⚠️ W1722 全局红线(Jing 2026-07-10)——【任何传统都不得描绘其标志性核心圣人/神像】:
 *   耶稣、穆罕默德、佛陀、诸神、先知、上师……一律不出具象(无脸、无身、无剪影、无背影、无遮面)。
 *   一律以光、自然、建筑、经卷、抽象符号来烘托, 绝不画那个"人"。
 *   —— 这条比"恭敬地画"更强: 不是画得恭敬, 而是【根本不画】核心圣像。适用于每一个传统 + 默认。
 *
 * 原则: 我们只做各传统【自身视为可作音乐】的内容, 且画面绝不越过其造像禁忌。
 */
const UNIVERSAL_NO_HOLY_FIGURE =
  "ABSOLUTE UNIVERSAL CONSTRAINT (applies to EVERY tradition, never violate): do NOT depict the central holy " +
  "figure(s) of this or any faith — no Jesus / Christ, no Muhammad or any prophet, no Buddha or bodhisattva, " +
  "no god or deity, no guru, no saint or divine person — in ANY figurative form (no face, body, silhouette, " +
  "back view, veiled or hidden figure, statue, or icon). Even if the line names such a figure, do NOT draw the " +
  "figure; instead evoke the sacred only through light, sky, nature, water, architecture, scripture, and abstract " +
  "symbols. Never invent a sacred figure the line does not name.";

const TRADITION_FRAME_RULES: Record<string, string[]> = {
  islamic: [
    "This is Islamic devotional music (nasheed).",
    "Keep the imagery strictly aniconic: prefer light, sky, geometric pattern, calligraphic ornament, nature, water, and architecture; avoid human and animal figures entirely in this religious context.",
  ],
  jewish: [
    "This is Jewish devotional music.",
    "Aniconic tradition: evoke the sacred through light, nature, and place — never through a depicted or personified Divine.",
  ],
  sikh: [
    "This is Sikh devotional music.",
    "Aniconic: evoke the sacred through light and nature; never depict God or the Gurus.",
  ],
  buddhist: [
    "This is Buddhist devotional music.",
    "Evoke through temple, lotus, light, mountain, and nature — never through a depicted Buddha or bodhisattva.",
  ],
  hindu: [
    "This is Hindu devotional music.",
    "Evoke through temple, flame, river, lotus, and nature — never through a depicted deity.",
  ],
  christian: [
    "This is Christian devotional music.",
    "Evoke through light, cross, nature, cathedral, and sky — never through a depicted Jesus/Christ, God, or saint.",
  ],
};
const TRADITION_FRAME_RULES_DEFAULT = [
  "Treat this as sacred devotional music; render it with reverence.",
];

export function traditionFrameRules(tradition?: string): string[] {
  const t = String(tradition || "").trim().toLowerCase();
  // 全局红线【永远】排在每传统条款之前, 保证"绝不画核心圣像"对所有传统一体适用。
  return [UNIVERSAL_NO_HOLY_FIGURE, ...(TRADITION_FRAME_RULES[t] || TRADITION_FRAME_RULES_DEFAULT)];
}

/* W1724 — 教训: 纯负向约束("do NOT depict Jesus")对图像模型不可靠 —— 歌词里带
 * Christ/Herr/Gott/Vater 等词, 模型反而照着画(线上真出了耶稣具象封面, 违反红线)。
 * 对策(双保险): ① 把会诱发具象圣像的圣名/神名从文本里【剥掉】(没有引子); ② 提示词以
 * "只画风光/建筑/光, 无任何人物"【正面】开场, 而不只是末尾说"别画"。 */
const FIGURE_TRIGGER_RE =
  /\b(jesus|christ(us|i|e|us)?|messiah|messias|heiland|erl(ö|oe)ser|savio(u)?rs?|lord|herr|herrn|gott(es)?|god|dieu|vater|father|holy\s+ghost|heiliger\s+geist|buddha|bodhisattva|krishna|vishnu|shiva|rama|ganesh(a)?|allah|muhammad|mohammed|prophet|guru|nanak|saint|virgin|madonna|maria|mary)\b/gi;

export function sanitizeLyricForImage(s: string): string {
  return String(s || "").replace(FIGURE_TRIGGER_RE, " ").replace(/\s{2,}/g, " ").trim();
}

/** 封面提示词: 无人物、只借歌词【非人物】意象烘托 + 本传统红线。aniconic-by-construction。 */
export function coverScenePrompt(
  lineText: string, tradition?: string, styleAnchor: string = DEFAULT_STYLE_ANCHOR,
): string {
  const safe = sanitizeLyricForImage(lineText).replace(/\s+/g, " ").trim();
  return [
    `A reverent, FIGURE-FREE sacred cover image for devotional music — wide cinematic 2.39:1.`,
    `Depict ONLY landscape, sky, light, clouds, water, mountains, nature, or the architecture of a place of worship (interior or exterior).`,
    `There must be NO people and NO figures of ANY kind — no face, body, silhouette, back view, statue, or icon, whether human or divine.`,
    safe ? `Let the mood and setting be evoked only by these non-figurative words (never add a figure): "${safe}".` : ``,
    `Style: ${styleAnchor}.`,
    `No text, lettering, captions, watermark, or signature anywhere.`,
    ...traditionFrameRules(tradition),
    `FINAL HARD RULE: if any part of the composition is about to become a person or a holy figure, replace it with light, sky, water, or architecture instead. Absolutely no figures.`,
  ].filter(Boolean).join(" ");
}

/**
 * 把一行歌词变成【忠实画面】的提示词。纯函数, 可测试 —— 纪律必须能被验证, 不能靠自觉。
 *
 * 负向约束放在末尾: 图像模型对靠后的指令更敏感, 而"不要加戏"正是最容易被忽略的那条。
 * 每传统红线(traditionFrameRules)放在【最最后】, 优先级高于一切风格与叙事。
 */
export function faithfulFramePrompt(
  lineText: string,
  styleAnchor: string = DEFAULT_STYLE_ANCHOR,
  tradition?: string,
): string {
  const line = String(lineText || "").trim().replace(/\s+/g, " ");
  return [
    `A single still image depicting ONLY what this one line of the hymn literally says: "${line}".`,
    `Style, identical for every frame of this piece: ${styleAnchor}.`,
    // ── 负向约束(末尾, 最重) ──
    `Depict nothing the line does not state or directly name.`,
    `Do NOT add people, objects, animals, events, symbols, or any story beyond this line.`,
    `Do NOT continue or anticipate the narrative. Do NOT invent a setting the line does not give.`,
    `If the line is abstract, render a plain, quiet scene evoking only its own words — invent nothing.`,
    `No text, no lettering, no captions, no watermark, no signature anywhere in the image.`,
    // ── 每传统画面红线(最末尾, 不可被覆盖) ──
    ...traditionFrameRules(tradition),
  ].join(" ");
}

/**
 * lines(来自乐谱, ts_ms 精确) + 音频总时长 → 帧计划。
 * 每行一帧; 一帧持续到【下一行开始】; 最后一帧持续到音频结束。
 * 时间轴不做任何估算 —— 它本来就是乐谱算出来的。
 */
export function buildFramePlan(
  lines: ScoreLine[],
  audioDurationMs: number,
  styleAnchor: string = DEFAULT_STYLE_ANCHOR,
  tradition?: string,
): Frame[] {
  const usable = lines.filter((l) => l.ts_ms != null && String(l.text || "").trim());
  return usable.map((l, i) => {
    const ts = Number(l.ts_ms);
    const next = usable[i + 1];
    const end = next ? Number(next.ts_ms) : Math.max(ts + 1000, audioDurationMs);
    return { index: i, ts_ms: ts, end_ms: end, text: l.text.trim(), prompt: faithfulFramePrompt(l.text, styleAnchor, tradition) };
  });
}

/* W1712 — 一曲多段的帧计划: 各段的行偏移 i×passMs 后首尾相接, 覆盖全 N 遍时长。
 * 相同歌词行复用同一张图(缓存, 省钱); 不同段的不同词各自成帧。 */
export function buildFramePlanVerses(
  verses: { lines: ScoreLine[] }[], passMs: number, totalMs: number,
  styleAnchor: string = DEFAULT_STYLE_ANCHOR,
  tradition?: string,
): Frame[] {
  const all: ScoreLine[] = [];
  verses.forEach((v, vi) => {
    const off = vi * passMs;
    v.lines.filter((l) => l.ts_ms != null && String(l.text || "").trim())
      .forEach((l) => all.push({ ts_ms: Number(l.ts_ms) + off, text: l.text }));
  });
  all.sort((a, b) => Number(a.ts_ms) - Number(b.ts_ms));
  return buildFramePlan(all, totalMs, styleAnchor, tradition);
}

/** 逐行字幕(SRT)。时间同样来自乐谱, 精确到毫秒。 */
/* CSSOS_WAVE_1706 — 圣诗字幕 JSON: 喂给情绪字幕引擎(app.emotion-subtitle-engine.js)。
 * 形状严格对齐引擎: languages[].sections[].lines[].tokens[]{ text, t_start, t_end, ... }(毫秒)。
 *
 * 忠实原则在这里的落实:
 *   ① 逐字时间 = 乐谱精确解(words[].ts_ms), 零估算 —— 全平台唯一逐字分毫不差的情绪字幕。
 *   ② 【不做逐字情绪分析】: 分析每个字"什么情绪"本身就是一种发挥/诠释, 违反"忠实转换"。
 *      统一给 serene(庄严宁静)+ 低强度柔光。庄严不靠彩纸火花, 靠逐字点亮本身。
 *   ③ reverent:true → 前端据此自动开 cssosReverentMode(砍嘉年华, 留逐字流光)。
 */
export type ScoreWord = { word: string; ts_ms: number; end_ms: number };
export type ScoreVerse = { lines: ScoreLine[]; words: ScoreWord[] };

const REVERENT_EMOTION = "serene";
const REVERENT_INTENSITY = 0.32;   // 柔和, 只够逐字轻点亮; 不爆

function isCjk(t: string): boolean { return /[\u3400-\u9fff\uf900-\ufaff]/.test(t); }

export function scoreToSubtitleJson(
  verses: ScoreVerse[], workId = "score", opts?: { lang?: string; passMs?: number },
): Record<string, unknown> {
  const allText = verses.map((v) => v.words.map((w) => w.word).join("")).join("");
  const lang = opts?.lang || (isCjk(allText) ? "zh" : "en");
  /* W1712 — 一曲多段: 第 i 段唱在第 i 遍旋律上 → 时间整体偏移 i × 单遍时长。
   * passMs 缺省时退回单遍(各段仍会重叠, 仅兼容旧调用); worker 会传真值。 */
  const passMs = Number(opts?.passMs) || 0;

  const sections = verses.map((v, vi) => {
    const off = vi * passMs;
    const words = v.words.slice().sort((a, b) => a.ts_ms - b.ts_ms);
    const lines = v.lines.filter((l) => l.ts_ms != null && String(l.text || "").trim());
    const lineObjs = lines.map((ln, li) => {
      const t0 = Number(ln.ts_ms);
      const t1 = li + 1 < lines.length ? Number(lines[li + 1]!.ts_ms) : Infinity;
      const toks = words.filter((w) => w.ts_ms >= t0 && w.ts_ms < t1).map((w) => ({
        text: w.word,
        t_start: w.ts_ms + off,
        t_end: w.end_ms + off,
        emotion: REVERENT_EMOTION,
        emotion_intensity: REVERENT_INTENSITY,
      }));
      const lineEnd = toks.length ? toks[toks.length - 1]!.t_end : (Number.isFinite(t1) ? t1 + off : t0 + off + 3000);
      return { text: ln.text.trim(), t_start: t0 + off, t_end: lineEnd, tokens: toks };
    });
    return { tag: `verse-${vi + 1}`, emotion: REVERENT_EMOTION, lines: lineObjs };
  });

  return {
    v: 1,
    work_id: workId,
    reverent: true,   // ← 前端: 见此即开 cssosReverentMode(庄严档)
    source: "musicxml",   // 逐字时间来自乐谱, 非 STT 估算
    languages: [{ lang, sections }],
  };
}

export function framesToSrt(frames: Frame[]): string {
  const t = (ms: number) => {
    const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, x = ms % 1000;
    const p = (n: number, w = 2) => String(n).padStart(w, "0");
    return `${p(h)}:${p(m)}:${p(s)},${p(x, 3)}`;
  };
  return frames.map((f, i) =>
    `${i + 1}\n${t(f.ts_ms)} --> ${t(f.end_ms)}\n${f.text}\n`).join("\n");
}

function run(cmd: string, args: string[], timeoutMs = 600_000): Promise<void> {
  return new Promise((resolve, reject) => {
    // W1700 — 与音频渲染同规矩: 一律 nice, 绝不饿死影院 / 面对面。
    const p = spawn("nice", ["-n", "15", cmd, ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr?.on("data", (d) => { err += String(d).slice(0, 4000); });
    const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch { /* ignore */ } reject(new Error(`${cmd}_timeout`)); }, timeoutMs);
    p.on("error", (e) => { clearTimeout(t); reject(e); });
    p.on("close", (c) => { clearTimeout(t); c === 0 ? resolve() : reject(new Error(`${cmd}_failed:${c}:${err.trim().slice(0, 400)}`)); });
  });
}

/**
 * 帧(已下好图) + 忠实音频 → mp4。
 * 图片按乐谱时间轴切换; 逐行字幕烧进画面。视频长度以音频为准(-shortest)。
 */
/** 图像生成器接口(由 index.ts 注入 callImageGen, 单一来源, 不在此复制 KIE 调用)。 */
export type ImageGen = (prompt: string, sizeHint: string) => Promise<{ url?: string; b64?: string } | null>;

/* W1721 — 影院封面(单张 2.39:1)。忠实转换的第一行 → 一张宽银幕封面, 附本传统画面红线。
 * 用于: ① 音频-only 内容也能有封面图上卡; ② 分享 og:image。只出【一张】图, 成本极低。
 * 失败返回 null —— 封面是锦上添花, 绝不因此卡住交付。 */
export async function renderCoverStill(
  lineText: string, tradition: string | undefined, gen: ImageGen, outJpg: string,
  styleAnchor: string = DEFAULT_STYLE_ANCHOR,
): Promise<string | null> {
  try {
    // W1724 — 封面走【无人物场景】提示词(剥圣名 + 正面 aniconic), 不再用逐行忠实提示(会诱发圣像具象)。
    const prompt = coverScenePrompt(lineText, tradition, styleAnchor);
    const r = await gen(prompt, "1280x536");
    if (!r) return null;
    const raw = outJpg.replace(/\.jpg$/i, ".raw.jpg");
    if (r.b64) fs.writeFileSync(raw, Buffer.from(r.b64.replace(/^data:[^,]+,/, ""), "base64"));
    else if (r.url) await downloadTo(r.url, raw);
    else return null;
    if (!(fs.existsSync(raw) && fs.statSync(raw).size > 1024)) return null;
    // 裁成 2.39:1 影院比例(与 MV 统一)。
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", raw,
      "-vf", "scale=1280:536:force_original_aspect_ratio=increase,crop=1280:536", "-q:v", "3", outJpg], 60_000);
    try { fs.unlinkSync(raw); } catch { /* 中间产物 */ }
    if (fs.existsSync(outJpg) && fs.statSync(outJpg).size > 512) return outJpg;
  } catch { /* 封面失败不影响音频/字幕交付 */ }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * W1725 — 确定性封面(零 AI, 保证无人物)。教训见下: AI 出图对"绝不画核心圣人"红线
 * 不可控(负向+正向 aniconic 提示都压不住模型画耶稣的先验, 线上真出过, 已撤)。
 * 改成纯 SVG 合成 → sharp 栅格化: 传统【拱窗剪影 + 色相 + 标题】, 物理上不可能出现人物。
 * 2.39:1(1280×536), 与 MV 统一。
 * ══════════════════════════════════════════════════════════════════════════ */
const COVER_WIN: Record<string, string> = {
  round:    "M0,1 L0,0.15 C0,0.04 0.12,0 0.5,0 C0.88,0 1,0.04 1,0.15 L1,1 Z",
  onion:    "M0,1 L0,0.30 C0,0.16 0.30,0.22 0.32,0.12 C0.34,0.05 0.44,0.02 0.5,0 C0.56,0.02 0.66,0.05 0.68,0.12 C0.70,0.22 1,0.16 1,0.30 L1,1 Z",
  ogee:     "M0,1 L0,0.30 C0.12,0.30 0.30,0.24 0.42,0.07 C0.46,0.02 0.48,0 0.5,0 C0.52,0 0.54,0.02 0.58,0.07 C0.70,0.24 0.88,0.30 1,0.30 L1,1 Z",
  shikhara: "M0,1 L0,0.30 Q0.30,0.24 0.5,0 Q0.70,0.24 1,0.30 L1,1 Z",
  stupa:    "M0,1 L0,0.30 C0,0.15 0.22,0.08 0.44,0.075 L0.47,0.075 L0.5,0 L0.53,0.075 L0.56,0.075 C0.78,0.08 1,0.15 1,0.30 L1,1 Z",
  eaves:    "M0,1 L0,0.30 L0.05,0.19 C0.11,0.25 0.17,0.23 0.23,0.21 L0.5,0.05 L0.77,0.21 C0.83,0.23 0.89,0.25 0.95,0.19 L1,0.30 L1,1 Z",
  tablet:   "M0,1 L0,0.16 C0,0.05 0.10,0.03 0.24,0.03 C0.38,0.03 0.47,0.05 0.47,0.16 L0.47,0.19 L0.53,0.19 L0.53,0.16 C0.53,0.05 0.62,0.03 0.76,0.03 C0.90,0.03 1,0.05 1,0.16 L1,1 Z",
  lotus:    "M0,1 L0,0.30 C0,0.20 0.06,0.17 0.14,0.21 C0.13,0.11 0.23,0.07 0.30,0.15 C0.34,0.05 0.44,0.02 0.5,0 C0.56,0.02 0.66,0.05 0.70,0.15 C0.77,0.07 0.87,0.11 0.86,0.21 C0.94,0.17 1,0.20 1,0.30 L1,1 Z",
};
// tradition → { hue, shape, name }。christian 的 hue 由 id/title 哈希在宝石色里取(和卡片彩窗呼应)。
const COVER_TRAD: Record<string, { hue: number | null; shape: string; name: string }> = {
  christian: { hue: null, shape: "round", name: "CHRISTIAN" },
  catholic:  { hue: 42,   shape: "round", name: "CATHOLIC" },
  orthodox:  { hue: 45,   shape: "onion", name: "ORTHODOX" },
  buddhist:  { hue: 38,   shape: "stupa", name: "BUDDHIST" },
  taoist:    { hue: 0,    shape: "eaves", name: "TAOIST" },
  islamic:   { hue: 158,  shape: "ogee",  name: "ISLAMIC" },
  hindu:     { hue: 26,   shape: "shikhara", name: "HINDU" },
  jewish:    { hue: 220,  shape: "tablet", name: "JEWISH" },
  sikh:      { hue: 30,   shape: "onion", name: "SIKH" },
  bahai:     { hue: 275,  shape: "lotus", name: "BAHÁ'Í" },
  secular:   { hue: 250,  shape: "round", name: "SACRED" },
  other:     { hue: 200,  shape: "round", name: "SACRED" },
};
const COVER_CHRISTIAN_HUES = [4, 214, 145, 42, 275, 190, 32, 100];

function coverMapPath(d: string, x0: number, y0: number, w: number, h: number): string {
  return d.replace(/([MLCQZ])([^MLCQZ]*)/g, (_m, cmd, nums) => {
    if (cmd === "Z") return "Z";
    const a = String(nums).trim().split(/[ ,]+/).filter((s: string) => s !== "").map(Number);
    let out = cmd;
    for (let i = 0; i < a.length; i += 2) out += (i ? " " : "") + (x0 + a[i]! * w).toFixed(2) + "," + (y0 + a[i + 1]! * h).toFixed(2);
    return out;
  });
}
function coverEsc(s: string): string { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function coverWrap(title: string, per: number): string[] {
  const words = String(title).trim().split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > per && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) lines.push(cur);
  if (lines.length > 3) { lines.length = 3; lines[2] = lines[2]!.replace(/.{1,2}$/, "…"); }
  return lines;
}
function coverHueFor(tradition: string | undefined, seed: string): number {
  const t = String(tradition || "secular").toLowerCase();
  const meta = COVER_TRAD[t] || COVER_TRAD.secular!;
  if (meta.hue != null) return meta.hue;
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COVER_CHRISTIAN_HUES[h % COVER_CHRISTIAN_HUES.length]!;
}

export function buildCoverSvg(title: string, tradition: string | undefined, seed = ""): string {
  const t = String(tradition || "secular").toLowerCase();
  const meta = COVER_TRAD[t] || COVER_TRAD.secular!;
  const hue = coverHueFor(tradition, seed || title);
  const W = 1280, H = 536, bx = 150, by = 66, bw = 300, bh = 404, cx = bx + bw / 2;
  const winPath = coverMapPath(COVER_WIN[meta.shape] || COVER_WIN.round!, bx, by, bw, bh);
  const lines = coverWrap(title || "Sacred Score", 18);
  const tSize = lines.length >= 3 ? 44 : 52, tx = 560;
  const startY = H / 2 - ((lines.length - 1) * (tSize + 8)) / 2 - 14;
  const titleEls = lines.map((ln, i) => `<text x="${tx}" y="${(startY + i * (tSize + 8)).toFixed(0)}" font-family="DejaVu Serif, 'Noto Serif CJK SC', serif" font-size="${tSize}" font-weight="700" fill="#f4ecd6">${coverEsc(ln)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},42%,19%)"/><stop offset="1" stop-color="hsl(${hue},48%,8%)"/></linearGradient>
<radialGradient id="glow" cx="${(cx / W).toFixed(3)}" cy="0.46" r="0.42"><stop offset="0" stop-color="hsl(${hue},70%,78%)" stop-opacity="0.85"/><stop offset="0.55" stop-color="hsl(${hue},60%,50%)" stop-opacity="0.28"/><stop offset="1" stop-color="hsl(${hue},60%,50%)" stop-opacity="0"/></radialGradient>
<linearGradient id="win" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="hsl(${hue},75%,72%)"/><stop offset="0.6" stop-color="hsl(${hue},66%,50%)"/><stop offset="1" stop-color="hsl(${hue},60%,32%)"/></linearGradient>
<filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="26"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<ellipse cx="${cx}" cy="250" rx="360" ry="300" fill="url(#glow)"/>
<path d="${winPath}" fill="hsl(${hue},70%,60%)" opacity="0.55" filter="url(#soft)"/>
<path d="${winPath}" fill="url(#win)" stroke="hsl(${hue},80%,80%)" stroke-width="2" stroke-opacity="0.5"/>
<line x1="${cx}" y1="${by + 30}" x2="${cx}" y2="${by + bh}" stroke="rgba(20,14,4,0.28)" stroke-width="2"/>
<line x1="${cx - 60}" y1="${by + 120}" x2="${cx - 60}" y2="${by + bh}" stroke="rgba(20,14,4,0.18)" stroke-width="2"/>
<line x1="${cx + 60}" y1="${by + 120}" x2="${cx + 60}" y2="${by + bh}" stroke="rgba(20,14,4,0.18)" stroke-width="2"/>
${titleEls}
<text x="${tx}" y="${(startY + lines.length * (tSize + 8) + 16).toFixed(0)}" font-family="DejaVu Serif, serif" font-size="20" letter-spacing="3" fill="hsl(${hue},45%,74%)">${coverEsc(meta.name)} · SACRED SCORE</text>
</svg>`;
}

/** 确定性封面 → jpg。零 AI, 不需要 _imageGen, 也不吃 KIE。失败返回 null(不阻断交付)。 */
export async function renderDeterministicCover(
  title: string, tradition: string | undefined, outJpg: string, seed = "",
): Promise<string | null> {
  try {
    const svg = buildCoverSvg(title || "Sacred Score", tradition, seed);
    await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(outJpg);
    if (fs.existsSync(outJpg) && fs.statSync(outJpg).size > 512) return outJpg;
  } catch (e) { console.warn("[score-render] deterministic cover failed:", (e as Error)?.message || e); }
  return null;
}

/** 逐帧出图并落盘为 jpg。返回带 imagePath 的帧。失败的帧被丢弃(assembleMv 会跳过)。 */
export async function renderFramesToImages(
  frames: Frame[], gen: ImageGen, workDir: string, sizeHint = "1280x536",
): Promise<Frame[]> {
  fs.mkdirSync(workDir, { recursive: true });
  const out: Frame[] = [];
  for (const f of frames) {
    try {
      const r = await gen(f.prompt, sizeHint);
      if (!r) { continue; }
      const jpg = path.join(workDir, `frame-${String(f.index).padStart(3, "0")}.jpg`);
      if (r.b64) {
        fs.writeFileSync(jpg, Buffer.from(r.b64.replace(/^data:[^,]+,/, ""), "base64"));
      } else if (r.url) {
        await downloadTo(r.url, jpg);
      } else { continue; }
      if (fs.existsSync(jpg) && fs.statSync(jpg).size > 1024) out.push({ ...f, imagePath: jpg });
    } catch { /* 单帧失败不拖垮整部 */ }
  }
  return out;
}

async function downloadTo(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`img_download_${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

/** W1714 — 从 mp4 抽一帧作分享海报(og:image)。取第 3 秒(避开淡入黑场)。 */
export async function extractPoster(mp4Path: string, outJpg: string): Promise<string | null> {
  try {
    await run("ffmpeg", ["-y", "-loglevel", "error", "-ss", "3", "-i", mp4Path, "-frames:v", "1", "-q:v", "3", outJpg], 60_000);
    if (fs.existsSync(outJpg) && fs.statSync(outJpg).size > 512) return outJpg;
  } catch { /* 海报是锦上添花, 失败不影响 MV */ }
  return null;
}

export async function assembleMv(opts: {
  frames: Frame[]; audioPath: string; outPath: string; workDir: string; width?: number; height?: number;
}): Promise<string> {
  const { frames, audioPath, outPath, workDir } = opts;
  // W1721 — 影院 2.39:1 宽银幕, 统一平台 MV 风格(旧 16:9 已弃)。1280/2.39 ≈ 536(偶数, 合 yuv420p)。
  const W = opts.width || 1280, H = opts.height || 536;
  const usable = frames.filter((f) => f.imagePath && fs.existsSync(f.imagePath));
  if (!usable.length) throw new Error("no_frames");

  // concat demuxer: 每帧一段, duration = 该行在乐谱上的实际时长。
  const listPath = path.join(workDir, "frames.txt");
  const lines: string[] = [];
  for (const f of usable) {
    lines.push(`file '${f.imagePath!.replace(/'/g, "'\\''")}'`);
    lines.push(`duration ${((f.end_ms - f.ts_ms) / 1000).toFixed(3)}`);
  }
  lines.push(`file '${usable[usable.length - 1]!.imagePath!.replace(/'/g, "'\\''")}'`);  // concat 要求重复末帧
  fs.writeFileSync(listPath, lines.join("\n"));

  const srtPath = path.join(workDir, "lines.srt");
  fs.writeFileSync(srtPath, framesToSrt(usable));

  const vf = [
    `scale=${W}:${H}:force_original_aspect_ratio=increase`,
    `crop=${W}:${H}`,
    `subtitles=${srtPath.replace(/[\\:]/g, "\\$&")}:force_style='FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Alignment=2,MarginV=40'`,
  ].join(",");

  await run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "concat", "-safe", "0", "-i", listPath,
    "-i", audioPath,
    "-vf", vf,
    "-r", "25",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-shortest",
    outPath,
  ]);
  if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 4096) throw new Error("mv_empty_output");
  return outPath;
}
