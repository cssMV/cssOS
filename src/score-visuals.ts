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
    const prompt = faithfulFramePrompt(lineText, styleAnchor, tradition) +
      " Wide cinematic 2.39:1 composition.";
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
