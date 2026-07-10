/* CSSOS_WAVE_1696 20260710 — 歌谱 → 歌词 + 逐字时间轴 (Phase 1)。
 *
 * Jing:「把整本圣诗歌谱(数字版)一次性反解成歌词/音乐/MV」。第一步、也是最关键的一步:
 * 从 MusicXML 里【精确解出】歌词和每个字唱在第几毫秒。
 *
 * 为什么这条路特别值:
 *   MusicXML 的 <lyric> 是【逐音符挂着】的, 而音符自带 <duration>。所以逐字时间轴是
 *   算术题, 不是推理题 —— 零模型、零人声分离、零强制对齐, 结果是【精确解】。
 *   我们为普通歌曲讨论过的"要不要等 GPU 才能对齐到人工水平", 在这里根本不需要发生。
 *
 * 输出刻意对齐 src/index.ts 里已有的两个形状:
 *   ParsedLyricLine = { ts_ms, text }        WhisperWordTs = { word, ts_ms, end_ms }
 * 与 elevenLabsTranscribe() 的返回同构 → 下游字幕/情绪字幕/波形精修全部零改动接入。
 *
 * 计时模型(MusicXML 的时间就是文档序, 故用 SAX 流式线性扫描):
 *   msPerDiv = 60000 / (bpm × divisions)          // divisions = 每四分音符的细分数
 *   <note>  推进游标(<chord/> 与 <grace/> 不推进);  <rest> 推进但无词
 *   <backup>/<forward>  回退/前进游标(多声部谱靠它对齐)
 *   <sound tempo> / <metronome><per-minute>  中途变速 → 即时重算 msPerDiv
 *   <tie type="start"> 与 <extend/>(melisma) → 把上一个音节的 end 延长到本音符结束
 */
import sax, { type Tag as SaxTag } from "sax";

export type MxLine = { ts_ms: number | null; text: string };
export type MxWord = { word: string; ts_ms: number; end_ms: number };
export type MxVerse = { verse: number; text: string; lines: MxLine[]; words: MxWord[] };
/** 一个发声音符。midi = MIDI 音高号(C4=60)。忠实渲染用这个, 不做任何加工。 */
export type MxNote = { midi: number; ts_ms: number; end_ms: number; velocity: number; part: string };
export type MusicXmlParse = {
  ok: boolean;
  error?: string;
  /** 源谱本身的数据问题(不是解析失败)。真实谱子经常不配平, 必须让上游看得见。 */
  warnings: string[];
  title: string | null;
  composer: string | null;
  tempo_bpm: number;
  divisions: number;
  duration_ms: number;
  verses: MxVerse[];
  /** W1698 — 忠实渲染音频用: 全部声部的音符(音高/起止), 与乐谱一一对应, 零加工。 */
  notes: MxNote[];
};

type Syllable = {
  part: string;
  verse: number;
  text: string;
  syllabic: string;      // single | begin | middle | end
  ts_ms: number;
  end_ms: number;
  endLine: boolean;
};

const DEFAULT_BPM = 120;

/** MusicXML(未压缩 XML 文本)→ 歌词 + 逐字时间轴。 */
export function parseMusicXml(xml: string): MusicXmlParse {
  const parser = sax.parser(true, { trim: false, normalize: false });

  let title: string | null = null;
  let composer: string | null = null;
  let bpm = DEFAULT_BPM;
  let divisions = 1;
  let firstDivisions = 1;

  let curPart = "";
  let curMs = 0;               // 当前声部的时间游标(ms)
  let lastStartMs = 0, lastEndMs = 0;
  let maxMs = 0;

  const syllables: Syllable[] = [];
  const warnings: string[] = [];
  const notes: MxNote[] = [];
  let sawRepeat = false;

  // ── 元素栈 + 文本累积 ────────────────────────────────────────────────
  const stack: string[] = [];
  let text = "";
  const inside = (tag: string) => stack.includes(tag);

  // <note> 的临时状态
  let inNote = false;
  let nDuration = 0, nIsRest = false, nIsChord = false, nIsGrace = false, nTieStart = false;
  let nTieStop = false, nUnpitched = false;
  let pStep = "", pAlter = 0, pOctave = 4, nHasPitch = false;
  let nLyrics: Array<{ verse: number; syllabic: string; text: string; extend: boolean; endLine: boolean }> = [];
  // 当前 <lyric>
  let inLyric = false, lVerse = 1, lSyllabic = "", lText = "", lExtend = false, lEndLine = false;

  // 上一个音符是否开启了延音(tie) → 下一个无词音符把上一个音节延长
  let pendingExtend = false;

  const msPerDiv = () => 60000 / (Math.max(1, bpm) * Math.max(1, divisions));

  // credit 里区分 title / composer
  let creditType = "";

  parser.onopentag = (node: SaxTag) => {
    const name = node.name;
    stack.push(name);
    text = "";

    switch (name) {
      case "part":
        curPart = String(node.attributes["id"] || curPart || "P?");
        curMs = 0; lastStartMs = 0; lastEndMs = 0; pendingExtend = false;
        break;
      case "note":
        inNote = true;
        nDuration = 0; nIsRest = false; nIsChord = false; nIsGrace = false; nTieStart = false;
        nTieStop = false; nUnpitched = false; nHasPitch = false; pStep = ""; pAlter = 0; pOctave = 4;
        nLyrics = [];
        break;
      case "pitch": if (inNote) nHasPitch = true; break;
      case "unpitched": if (inNote) nUnpitched = true; break;
      case "repeat": sawRepeat = true; break;
      case "rest": if (inNote) nIsRest = true; break;
      case "chord": if (inNote) nIsChord = true; break;
      case "grace": if (inNote) nIsGrace = true; break;
      case "tie": {
        if (!inNote) break;
        const ty = String(node.attributes["type"] || "");
        if (ty === "start") nTieStart = true;
        else if (ty === "stop") nTieStop = true;
        break;
      }
      case "lyric":
        inLyric = true;
        lVerse = Number(node.attributes["number"] || 1) || 1;
        lSyllabic = ""; lText = ""; lExtend = false; lEndLine = false;
        break;
      case "extend": if (inLyric) lExtend = true; break;
      case "end-line": case "end-paragraph": if (inLyric) lEndLine = true; break;
      case "sound": {
        const t = Number(node.attributes["tempo"]);
        if (Number.isFinite(t) && t > 0) bpm = t;
        break;
      }
      case "credit-type": creditType = ""; break;
    }
  };

  parser.ontext = (t: string) => { text += t; };
  parser.oncdata = (t: string) => { text += t; };

  parser.onclosetag = (name: string) => {
    const val = text.trim();
    switch (name) {
      case "work-title": if (val) title = val; break;
      case "movement-title": if (val && !title) title = val; break;
      case "creator": /* type=composer 在 attributes, 简化: 首个 creator 当 composer */
        if (val && !composer) composer = val; break;
      case "credit-type": creditType = val.toLowerCase(); break;
      case "credit-words":
        if (!title && creditType === "title" && val) title = val;
        else if (!composer && creditType === "composer" && val) composer = val;
        break;

      case "divisions": {
        const d = Number(val);
        if (Number.isFinite(d) && d > 0) { divisions = d; if (firstDivisions === 1) firstDivisions = d; }
        break;
      }
      case "per-minute": {
        const b = Number(val);
        if (Number.isFinite(b) && b > 0) bpm = b;
        break;
      }
      case "duration": {
        const d = Number(val);
        if (!Number.isFinite(d)) break;
        if (inNote) nDuration = d;
        else if (inside("backup")) curMs = Math.max(0, curMs - d * msPerDiv());
        else if (inside("forward")) curMs += d * msPerDiv();
        break;
      }

      case "step": if (inNote) pStep = val.toUpperCase(); break;
      case "alter": if (inNote) { const a = Number(val); if (Number.isFinite(a)) pAlter = a; } break;
      case "octave": if (inNote) { const o = Number(val); if (Number.isFinite(o)) pOctave = o; } break;

      case "syllabic": if (inLyric) lSyllabic = val.toLowerCase(); break;
      case "text": if (inLyric) lText += val; break;
      case "lyric":
        if (inLyric) {
          nLyrics.push({ verse: lVerse, syllabic: lSyllabic || "single", text: lText, extend: lExtend, endLine: lEndLine });
          inLyric = false;
        }
        break;

      case "note": {
        inNote = false;
        const mpd = msPerDiv();
        const durMs = nIsGrace ? 0 : nDuration * mpd;

        let startMs: number, endMs: number;
        if (nIsChord || nIsGrace) {
          // 和弦音/装饰音不推进时间: 与前一音符同起
          startMs = lastStartMs; endMs = nIsChord ? lastEndMs : lastStartMs;
        } else {
          startMs = curMs; endMs = curMs + durMs;
          curMs = endMs; lastStartMs = startMs; lastEndMs = endMs;
        }
        if (endMs > maxMs) maxMs = endMs;

        /* W1698 — 音符产出(忠实渲染的原料)。休止/无音高/装饰音不发声。
         * 延音(tie stop): 与前一个【同声部同音高、首尾相接】的音符合并成一个长音,
         * 而不是断成两个 —— 乐谱上它本来就是一个音。 */
        if (!nIsRest && !nIsGrace && nHasPitch && !nUnpitched && pStep) {
          const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
          const base = SEMI[pStep];
          if (base !== undefined) {
            const midi = (pOctave + 1) * 12 + base + pAlter;
            if (midi >= 0 && midi <= 127) {
              let merged = false;
              if (nTieStop) {
                for (let i = notes.length - 1; i >= 0; i--) {
                  const prev = notes[i]!;
                  if (prev.part !== curPart) continue;
                  if (prev.midi === midi && Math.abs(prev.end_ms - startMs) <= 1) {
                    prev.end_ms = Math.round(endMs); merged = true;
                  }
                  break;
                }
              }
              if (!merged) notes.push({ midi, ts_ms: Math.round(startMs), end_ms: Math.round(endMs), velocity: 80, part: curPart });
            }
          }
        }

        const hasWords = nLyrics.some((l) => l.text.trim().length > 0);

        if (hasWords && !nIsRest) {
          for (const l of nLyrics) {
            if (!l.text.trim()) continue;
            syllables.push({
              part: curPart, verse: l.verse, text: l.text.trim(),
              syllabic: l.syllabic, ts_ms: Math.round(startMs), end_ms: Math.round(endMs),
              endLine: l.endLine,
            });
          }
          pendingExtend = nTieStart;
        } else if (!nIsRest && !nIsChord) {
          // 无词音符: melisma(<extend/>) 或延音(tie) → 把该声部最后一个音节唱到这里
          const wantsExtend = pendingExtend || nLyrics.some((l) => l.extend);
          if (wantsExtend) {
            for (let i = syllables.length - 1; i >= 0; i--) {
              if (syllables[i]!.part === curPart) { syllables[i]!.end_ms = Math.round(endMs); break; }
            }
          }
          pendingExtend = nTieStart;
        } else {
          pendingExtend = false;
        }
        break;
      }
    }
    stack.pop();
    text = "";
  };

  try {
    parser.write(xml).close();
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || "xml_parse_failed", warnings, title, composer, tempo_bpm: bpm, divisions: firstDivisions, duration_ms: 0, verses: [], notes: [] };
  }

  if (!syllables.length) {
    return { ok: false, error: "no_lyrics_found", warnings, title, composer, tempo_bpm: bpm, divisions: firstDivisions, duration_ms: Math.round(maxMs), verses: [], notes };
  }

  // 多声部谱(SATB)常常每个声部都挂词 → 取【音节最多】的那个声部当主旋律。
  const perPart = new Map<string, number>();
  for (const s of syllables) perPart.set(s.part, (perPart.get(s.part) || 0) + 1);
  let bestPart = ""; let bestN = -1;
  for (const [p, n] of perPart) if (n > bestN) { bestN = n; bestPart = p; }

  const verseNums = Array.from(new Set(syllables.filter((s) => s.part === bestPart).map((s) => s.verse))).sort((a, b) => a - b);

  /* W1696 — 源谱质量检测: <syllabic>begin 必须由 end 收尾。真实谱子(连 music21 语料库里的
   * Foster 都)常常不配平 —— 例如 "sum"(begin) 后面跟了 "mer"(single)。这时那个词会被拆开。
   * 我们【绝不猜测性地粘合】: 一旦按"下一个音节无条件收尾"去修, "mer"(误标 begin) + "air"
   * 就会粘成 "merair"。检测出来、报给上游, 比悄悄猜错强。 */
  for (const v of verseNums) {
    const syls = syllables.filter((s) => s.part === bestPart && s.verse === v);
    const nb = syls.filter((s) => s.syllabic === "begin").length;
    const ne = syls.filter((s) => s.syllabic === "end").length;
    if (nb !== ne) {
      warnings.push(`verse ${v}: <syllabic> 不配平 (begin=${nb}, end=${ne}) — 源谱标注有误, 约 ${Math.abs(nb - ne)} 个词可能被拆开或粘连`);
    }
  }
  const quarterMs = 60000 / Math.max(1, bpm);

  const verses: MxVerse[] = verseNums.map((v) => {
    const syls = syllables.filter((s) => s.part === bestPart && s.verse === v).sort((a, b) => a.ts_ms - b.ts_ms);
    const words = assembleWords(syls);
    const lines = groupLines(words, syls, quarterMs);
    return { verse: v, text: lines.map((l) => l.text).join("\n"), lines, words };
  });

  if (sawRepeat) {
    /* 忠实渲染的诚实边界: 反复(以及 volta/DC/DS)需要完整的乐段展开器。v1 不展开,
     * 渲染为【单遍】。这会让音频比实际演奏短 —— 必须让上游看见, 绝不悄悄忽略。 */
    warnings.push("乐谱含反复记号(<repeat>) — v1 不展开乐段, 按【单遍】渲染, 时长会短于实际演奏");
  }
  notes.sort((a, b) => a.ts_ms - b.ts_ms);
  return { ok: true, warnings, title, composer, tempo_bpm: bpm, divisions: firstDivisions, duration_ms: Math.round(maxMs), verses, notes };
}

/** 音节 → 词。syllabic: single 独立成词; begin…middle…end 拼成一个词(Jean+nie = Jeannie)。 */
function assembleWords(syls: Syllable[]): MxWord[] {
  const words: MxWord[] = [];
  let open: { word: string; ts_ms: number; end_ms: number } | null = null;
  const flush = () => { if (open) { words.push(open); open = null; } };

  for (const s of syls) {
    const kind = s.syllabic;
    if (kind === "begin") {
      flush();
      open = { word: s.text, ts_ms: s.ts_ms, end_ms: s.end_ms };
    } else if (kind === "middle" || kind === "end") {
      if (!open) open = { word: "", ts_ms: s.ts_ms, end_ms: s.end_ms };   // 谱子不规范 → 当作新词起头
      open.word += s.text;
      open.end_ms = s.end_ms;
      if (kind === "end") flush();
    } else {                                    // single
      flush();
      words.push({ word: s.text, ts_ms: s.ts_ms, end_ms: s.end_ms });
    }
  }
  flush();
  return words;
}

/** 词 → 行。优先用谱面 <end-line/>; 没有就靠【标点】和【气口(长休止)】断句。 */
function groupLines(words: MxWord[], syls: Syllable[], quarterMs: number): MxLine[] {
  const hasEndLine = syls.some((s) => s.endLine);
  const endLineAt = new Set<number>();
  if (hasEndLine) {
    // 把带 end-line 的音节结束时刻记下, 词的 end_ms 落在其上即断行。
    for (const s of syls) if (s.endLine) endLineAt.add(s.end_ms);
  }

  const lines: MxLine[] = [];
  let buf: MxWord[] = [];
  const flush = () => {
    if (!buf.length) return;
    lines.push({ ts_ms: buf[0]!.ts_ms, text: buf.map((w) => w.word).join(" ") });
    buf = [];
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    buf.push(w);
    if (hasEndLine) {
      if (endLineAt.has(w.end_ms)) flush();
      continue;
    }
    // 无 end-line: ① 词尾标点 ② 与下一个词之间有 ≥1 拍的气口
    const endsSentence = /[,.;:!?，。；：！？]$/.test(w.word);
    const next = words[i + 1];
    const gap = next ? next.ts_ms - w.end_ms : Infinity;
    /* W1696 — 无 <end-line/> 时纯靠标点+气口会【欠分割】(lead sheet 根本不标行, 词与词首尾相接,
     * 气口永远为 0)。补一个"可唱长度"上限, 免得出现 20 个词的巨行。谱面有 end-line 时不走这里。 */
    const tooLong = buf.length >= 9;
    if (endsSentence || gap >= quarterMs || tooLong) flush();
  }
  flush();
  return lines;
}
