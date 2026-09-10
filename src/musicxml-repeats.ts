/* CSSOS_WAVE_2086 — 展开 MusicXML 反复记号
 *
 * Jing 2026-09-09:「原曲是唱多少遍的, 就唱多少遍。」
 *
 * 背景: `parseMusicXml` 是流式解析, 没有小节级模型, 遇到 <repeat> 只能记一个
 * `sawRepeat` 然后发警告「v1 不展开乐段, 按单遍渲染, 时长会短于实际演奏」。
 * 实测: 已上线的 23 首圣诗里有 9 首含反复记号 —— 也就是【近一半是短的】。
 *
 * 做法: 在解析【之前】预处理 XML, 把反复段落的小节按演奏顺序复制展开, 再喂给
 * 现有解析器。解析器与整条渲染管线一行不动 —— 这是「先找再动 / 不重复造轮子」。
 *
 * 支持三种实测存在的形态:
 *   1. 只有 backward, 没有 forward     → 从曲首反复 (11 首 BWV 众赞歌)
 *   2. forward + backward times="N"    → 该段共奏 N 遍 (Holy Manna, times="2")
 *   3. 带一房/二房 <ending>            → 奏两遍: 第一遍走一房, 第二遍跳过一房走二房
 *                                        (Amazing Grace / Idumea / Tallis)
 *
 * `times` 的取舍(MusicXML 规范): times「只用于不属于 ending 的 backward repeat」。
 * 所以带 ending 时【忽略 times, 一律两遍】—— Amazing Grace 写的是 times="1",
 * 照字面奏一遍等于没反复, 那是错的。不带 ending 时取 max(2, times)。
 */

type Measure = {
  xml: string;
  hasForward: boolean;
  backwardTimes: number | null;   // null = 此小节无 backward repeat
  endings: Set<number> | null;    // null = 不属于任何房, 每遍都奏
};

const RE_PART = /<part\b[^>]*>[\s\S]*?<\/part>/g;
const RE_MEASURE = /<measure\b[^>]*>[\s\S]*?<\/measure>/g;

function parseMeasure(xml: string): Measure {
  const hasForward = /<repeat\b[^>]*direction\s*=\s*"forward"/.test(xml);
  let backwardTimes: number | null = null;
  const bw = xml.match(/<repeat\b[^>]*direction\s*=\s*"backward"[^>]*>/);
  if (bw) {
    const t = bw[0].match(/times\s*=\s*"(\d+)"/);
    const raw = t?.[1];
    backwardTimes = raw ? Math.max(1, parseInt(raw, 10)) : 2;
  }
  // <ending number="1" .../> 或 number="1,2"
  let endings: Set<number> | null = null;
  for (const m of xml.matchAll(/<ending\b[^>]*number\s*=\s*"([\d, ]+)"/g)) {
    const nums = m[1];
    if (!nums) continue;
    endings = endings || new Set<number>();
    for (const p of nums.split(",")) {
      const n = parseInt(p.trim(), 10);
      if (Number.isFinite(n)) endings.add(n);
    }
  }
  return { xml, hasForward, backwardTimes, endings };
}

/** 一个声部的小节 → 按演奏顺序展开后的小节列表 */
function expandPart(ms: Measure[]): Measure[] {
  const out: Measure[] = [];
  let cursor = 0;        // 尚未输出的第一个小节
  let repeatStart = 0;   // 当前反复段的起点

  const at = (k: number): Measure | undefined => ms[k];
  const push = (k: number) => { const m = ms[k]; if (m) out.push(m); };

  for (let i = 0; i < ms.length; i++) {
    const cur = at(i);
    if (!cur) continue;
    if (cur.hasForward) {
      for (let j = cursor; j < i; j++) push(j);
      cursor = i;
      repeatStart = i;
    }
    if (cur.backwardTimes == null) continue;

    const secStart = repeatStart;
    for (let j = cursor; j < secStart; j++) push(j);

    // 二房及以后的小节跟在 backward 记号【之后】, 要一并纳入这一段
    let voltaEnd = i;
    if (ms.slice(secStart, i + 1).some((m) => m.endings)) {
      let k = i + 1;
      while (k < ms.length && at(k)?.endings) { voltaEnd = k; k++; }
    }
    const hasEndings = ms.slice(secStart, voltaEnd + 1).some((m) => m.endings);
    const passes = hasEndings ? 2 : Math.max(2, cur.backwardTimes || 2);

    for (let p = 1; p <= passes; p++) {
      // 最后一遍要走到 voltaEnd(二房); 之前的遍只走到 backward 记号处
      const stop = (p === passes) ? voltaEnd : i;
      for (let j = secStart; j <= stop; j++) {
        const mj = at(j);
        if (!mj) continue;
        if (mj.endings && !mj.endings.has(p)) continue;   // 这一房不属于本遍
        out.push(mj);
      }
    }
    cursor = voltaEnd + 1;
    repeatStart = voltaEnd + 1;
  }
  for (let j = cursor; j < ms.length; j++) push(j);
  return out;
}

/** 去掉反复/房记号并重排小节号 —— 展开后它们已经没有意义, 留着会让下游重复计算 */
function renumber(measures: Measure[]): string {
  return measures.map((m, idx) => {
    let x = m.xml
      .replace(/<repeat\b[^>]*\/>/g, "")
      .replace(/<ending\b[^>]*\/>/g, "")
      .replace(/<ending\b[^>]*>[\s\S]*?<\/ending>/g, "");
    x = x.replace(/(<measure\b[^>]*?\bnumber\s*=\s*")[^"]*(")/, `$1${idx + 1}$2`);
    return x;
  }).join("");
}

export type ExpandResult = { xml: string; expanded: boolean; notes: string[] };

/** MusicXML 原文 → 展开反复后的 MusicXML。没有反复记号时原样返回。 */
export function expandRepeats(src: string): ExpandResult {
  const notes: string[] = [];
  if (!/<repeat\b/.test(src)) return { xml: src, expanded: false, notes };

  let changed = false;
  const out = src.replace(RE_PART, (partXml) => {
    const raw = partXml.match(RE_MEASURE);
    if (!raw || raw.length === 0) return partXml;
    const ms = raw.map(parseMeasure);
    if (!ms.some((m) => m.backwardTimes != null)) return partXml;

    // backward 但全程没有 forward → 从曲首反复(BWV 众赞歌就是这种)
    const expanded = expandPart(ms);
    if (expanded.length === ms.length) return partXml;
    changed = true;
    notes.push(`声部小节 ${ms.length} → ${expanded.length}`);

    const first = raw[0] as string;
    const last = raw[raw.length - 1] as string;
    const head = partXml.slice(0, partXml.indexOf(first));
    const tail = partXml.slice(partXml.lastIndexOf(last) + last.length);
    return head + renumber(expanded) + tail;
  });

  return { xml: changed ? out : src, expanded: changed, notes };
}
