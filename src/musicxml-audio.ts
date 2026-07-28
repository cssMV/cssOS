/* CSSOS_WAVE_1698 20260710 — 乐谱 → 忠实音频。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 第一原则(Jing, 不可动摇):
 *
 *     这是【转换】, 不是【创作】。
 *     一个音符都不能改, 一句歌词都不能编。乐谱怎么写, 就怎么出。
 *
 * 因此这条链路里【没有任何 AI 环节】:
 *
 *     MusicXML  ──(音高/时值一一对应)──▶  MIDI  ──(采样音源)──▶  WAV  ──▶  MP3
 *                    src/musicxml.ts          @tonejs/midi      fluidsynth   ffmpeg
 *
 * 它就是一台音序器。不会跑调、不会改词、不会即兴、每次结果完全一致。
 * 代价是音色取决于 SoundFont 的质量 —— 这是"忠实"该付的代价, 也是唯一的代价。
 * ══════════════════════════════════════════════════════════════════════════════
 */
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import type { MusicXmlParse, MxNote } from "./musicxml";

/** 系统自带的通用 MIDI 音源(fluidsynth 依赖包带的)。可用 CSSOS_SOUNDFONT 覆盖。 */
const SOUNDFONT_CANDIDATES = [
  process.env.CSSOS_SOUNDFONT || "",
  "/usr/share/sounds/sf3/default-GM.sf3",
  "/usr/share/sounds/sf2/default-GM.sf2",
  "/etc/alternatives/default-GM.sf3",
  "/etc/alternatives/default-GM.sf2",
].filter(Boolean);

export function findSoundFont(): string | null {
  for (const p of SOUNDFONT_CANDIDATES) { try { if (fs.existsSync(p)) return p; } catch { /* ignore */ } }
  return null;
}

/* CSSOS_WAVE_1702 — 声线默认【合唱】(Jing)。圣诗本来就是会众/诗班唱的, 钢琴音色是错的默认。
 *   GM 音色号(0-indexed): 52 Choir Aahs · 53 Voice Oohs · 19 Church Organ · 48 String Ensemble。
 *   注意: 这只改【音色】, 不改任何一个音符的音高与时值 —— 第一原则不受影响。 */
export const GM_CHURCH_ORGAN = 19;   // 教堂管风琴
export const GM_STRING_ENSEMBLE = 48; // 弦乐合奏
export const GM_CHOIR_AAHS = 52;      // 合唱"啊"垫音(注意: 这是乐器音色, 不唱字; 真人声唱词=SVS, 待 GPU)
function defaultProgram(): number {
  const p = Number(process.env.CSSOS_SCORE_GM_PROGRAM);
  // W1704 — Jing: 圣诗默认【教堂管风琴】(不是钢琴, 不是合唱垫音)。
  return Number.isFinite(p) && p >= 0 && p <= 127 ? p : GM_CHURCH_ORGAN;
}
/** 完整配器: 除主奏(管风琴)外, 再叠一层弦乐【同音同时值】—— 只丰满音色, 不加/改一个音符。 */
function wantOrchestra(): boolean {
  return process.env.CSSOS_SCORE_ORCHESTRA === "1";
}

/** MusicXML 解析结果 → 标准 MIDI 文件(Buffer)。音高、起止、时长与乐谱完全一致。 */
export async function buildMidi(
  mx: MusicXmlParse, program = defaultProgram(), orchestra = wantOrchestra(),
): Promise<Buffer> {
  const { Midi } = await import("@tonejs/midi");
  const midi = new Midi();
  midi.header.setTempo(mx.tempo_bpm > 0 ? mx.tempo_bpm : 120);

  // 一个 <part> = 一条 MIDI 轨。多声部谱(SATB)因此保留各自的线条。
  const byPart = new Map<string, MxNote[]>();
  for (const n of mx.notes) {
    const arr = byPart.get(n.part) || [];
    arr.push(n);
    byPart.set(n.part, arr);
  }
  if (!byPart.size) throw new Error("musicxml_no_notes");

  /* CSSOS_WAVE_1712 — Jing「一曲多段: 4 段词 → 旋律重复 4 遍, 唱不同的 4 段词」。
   * 圣诗常是同一旋律配 N 段歌词(<lyric number=1..N> 挂在同一串音符上)。忠实渲染 = 把这串
   * 音符【重复 N 遍】, 每遍偏移 = 段序号 × 单遍时长。单段(N=1)时行为不变。 */
  const verseCount = Math.max(1, (mx.verses && mx.verses.length) || 1);
  const passMs = mx.duration_ms;   // 单遍旋律时长(含尾部休止 → 遍与遍之间的自然气口)
  const layers = orchestra ? [program, GM_STRING_ENSEMBLE] : [program];
  for (const [partId, ns] of byPart) {
    for (const prog of layers) {
      const track = midi.addTrack();
      track.name = layers.length > 1 ? `${partId}-${prog}` : partId;
      track.instrument.number = prog;   // W1704 — 默认教堂管风琴; 完整配器时再叠一层弦乐(同音同时值)
      for (let v = 0; v < verseCount; v++) {
        const offMs = v * passMs;
        for (const n of ns) {
          const durSec = Math.max(0.01, (n.end_ms - n.ts_ms) / 1000);
          track.addNote({
            midi: n.midi,
            time: (n.ts_ms + offMs) / 1000,
            duration: durSec,
            velocity: Math.min(1, Math.max(0.05, (prog === GM_STRING_ENSEMBLE ? n.velocity * 0.6 : n.velocity) / 127)),
          });
        }
      }
    }
  }
  return Buffer.from(midi.toArray());
}

/* CSSOS_WAVE_1700 — 所有渲染子进程一律 `nice -n 15` 降优先级。
 *
 * 这是「影院和面对面永远不卡」的【物理保证】, 不是 best-effort:
 * Linux 调度器会让 nice 19 的进程在 CPU 争抢时几乎完全让位给普通优先级的进程。
 * 于是即便批渲染把 4 个核跑满, 实时的 API / 音频权威 / f2f 依旧抢得到时间片。
 * 队列限并发是"少占", nice 是"占了也让" —— 两道闸, 缺一不可。 */
function run(cmd: string, args: string[], timeoutMs = 180_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("nice", ["-n", "15", cmd, ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr?.on("data", (d) => { err += String(d).slice(0, 2000); });
    const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch { /* ignore */ } reject(new Error(`${cmd}_timeout`)); }, timeoutMs);
    p.on("error", (e) => { clearTimeout(t); reject(e); });
    p.on("close", (code) => {
      clearTimeout(t);
      if (code === 0) resolve();
      else reject(new Error(`${cmd}_failed:${code}:${err.trim().slice(0, 300)}`));
    });
  });
}

/** volumedetect 读出真实峰值(dB)。只分析不产出, 很快。读不到就当 0dB(不加增益)。 */
async function measurePeakDb(wavPath: string): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn("nice", ["-n", "15", "ffmpeg", "-hide_banner", "-i", wavPath, "-af", "volumedetect", "-f", "null", "-"],
      { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr?.on("data", (d) => { err += String(d); });
    p.on("error", () => resolve(0));
    p.on("close", () => {
      const m = err.match(/max_volume:\s*(-?[\d.]+) dB/);
      const v = m && m[1] ? Number(m[1]) : NaN;
      resolve(Number.isFinite(v) ? v : 0);
    });
  });
}

export type RenderedScore = { mp3Path: string; wavPath: string; midiPath: string; soundfont: string };

/**
 * 乐谱 → mp3(忠实渲染)。调用方负责清理返回的临时文件。
 * `outDir` 给定时把成品放那里, 否则用系统临时目录。
 */
export async function renderScoreToAudio(mx: MusicXmlParse, outDir?: string): Promise<RenderedScore> {
  const sf = findSoundFont();
  if (!sf) throw new Error("soundfont_not_found");

  const dir = outDir || fs.mkdtempSync(path.join(os.tmpdir(), "score_"));
  fs.mkdirSync(dir, { recursive: true });
  const stem = `score-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const midiPath = path.join(dir, `${stem}.mid`);
  const wavPath = path.join(dir, `${stem}.wav`);
  const mp3Path = path.join(dir, `${stem}.mp3`);

  fs.writeFileSync(midiPath, await buildMidi(mx));   // 音色默认合唱, 见 defaultProgram()

  // fluidsynth: 离线渲染(-ni 不进交互, -F 输出文件, -r 采样率, -g 增益防削波)
  await run("fluidsynth", ["-ni", "-g", "0.8", "-r", "44100", "-F", wavPath, sf, midiPath]);
  if (!fs.existsSync(wavPath) || fs.statSync(wavPath).size < 1024) throw new Error("fluidsynth_empty_output");

  /* CSSOS_WAVE_1699 — 峰值归一化(取代 loudnorm)。两个理由, 后一个更重要:
   *
   *  (1) 快 3.3 倍: 实测 70s 曲子, loudnorm 3372ms vs 本方案 1026ms。loudnorm 曾占整条
   *      链路 86% 的时间 —— 比真正的音符合成(525ms)还贵 6 倍。
   *  (2) 【更忠实】: loudnorm 是【动态处理】(LRA 会压缩强弱对比), 会改变乐谱写明的力度
   *      关系。纯增益只是整体音量, 每个采样点的相对关系分毫不动。对"一个音符都不能改"
   *      的第一原则来说, 动态压缩本身就是越界。
   *
   * 做法: volumedetect 量出真实峰值(只分析不产出, 很快), 再用一次 volume=XdB 推到 -1.5dB。 */
  const peakDb = await measurePeakDb(wavPath);
  const gainDb = (-1.5 - peakDb).toFixed(2);
  await run("ffmpeg", ["-y", "-loglevel", "error", "-i", wavPath,
    "-af", "volume=" + gainDb + "dB",
    "-codec:a", "libmp3lame", "-q:a", "2", mp3Path]);
  if (!fs.existsSync(mp3Path) || fs.statSync(mp3Path).size < 1024) throw new Error("ffmpeg_empty_output");

  return { mp3Path, wavPath, midiPath, soundfont: sf };
}
