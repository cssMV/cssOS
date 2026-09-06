#!/usr/bin/env python3
"""
MusicXML 歌谱 -> SoulX-Singer metadata JSON (control=score)

契约来自 SoulX-Singer 仓库真样例 example/audio/music.json, 逐位核对过:
  text / phoneme / note_pitch / note_type / duration 五条严格【一音符一 token】, 长度必须相等。
    note_type  1=休止(<SP>, pitch 恒为 0)  2=新词/新音节  3=延音(承接上一个 token 的词)
    phoneme    同一音符上的多个音素用 '-' 连接, 前缀 en_/zh_; 模型内部按 '-' 拆开逐个查 phone_set。
               已验证: CMUdict 用到的 69 个 ARPAbet 音素 100% 落在 SoulX 的 en_ 词表(70 个)内。

一个【故意不替模型拿主意】的地方 —— --align:
  word      整词占一个音符, 拖腔时重复该词并标 note_type=3(仓库英文样例就是这样)
  syllable  按响度原则把词拆成音节, 每个音节各占一个音符(圣诗 "A-ma-zing" 的唱法)
  仓库样例只见过 word 级, 而圣诗必须逐音节。哪种对得上模型的训练分布, 只有在 GPU 上渲染出来听才知道。
  所以这里给的是开关, 不是结论。第一次 GPU 会话就用同一首曲子跑两遍对比。
"""
import argparse, json, re, sys, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

STEP = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
VOWEL = re.compile(r"[AEIOU].*\d$")          # ARPAbet 元音带重音位


def load_musicxml(path: Path) -> ET.Element:
    """.mxl 是 zip, .xml/.musicxml 是裸 XML。"""
    if path.suffix.lower() == ".mxl":
        with zipfile.ZipFile(path) as z:
            names = [n for n in z.namelist()
                     if n.endswith(".xml") and "META-INF" not in n]
            if not names:
                sys.exit(f"{path}: zip 里没有乐谱 XML")
            return ET.fromstring(z.read(names[0]))
    return ET.parse(path).getroot()


def list_parts(root: ET.Element):
    out = []
    for sp in root.iter("score-part"):
        nm = sp.find("part-name")
        out.append((sp.get("id"), (nm.text or "").strip() if nm is not None else ""))
    return out


def extract_notes(root: ET.Element, part_id: str, default_bpm: float):
    """-> [{midi|None(休止), sec, tied_from}] ; 按 divisions + tempo 折算秒。"""
    part = next((p for p in root.findall("part") if p.get("id") == part_id), None)
    if part is None:
        sys.exit(f"找不到声部 {part_id}")
    divisions, bpm = 1, default_bpm
    notes = []
    for measure in part.findall("measure"):
        for el in measure.iter():
            if el.tag == "divisions" and el.text:
                divisions = int(el.text)
            elif el.tag == "sound" and el.get("tempo"):
                bpm = float(el.get("tempo"))
            elif el.tag == "note":
                # 和弦音只保留主音: <chord/> 表示与前一个音同时发声, 不占时间轴
                if el.find("chord") is not None:
                    continue
                dur_el = el.find("duration")
                if dur_el is None or not dur_el.text:
                    continue
                beats = int(dur_el.text) / divisions
                sec = beats * 60.0 / bpm
                if el.find("rest") is not None:
                    notes.append({"midi": None, "sec": sec, "tied_from": False,
                                  "lyric": None, "syllabic": None})
                    continue
                pit = el.find("pitch")
                if pit is None:
                    continue
                alter = pit.find("alter")
                midi = (STEP[pit.find("step").text]
                        + (int(float(alter.text)) if alter is not None and alter.text else 0)
                        + (int(pit.find("octave").text) + 1) * 12)
                tied_from = any(t.get("type") == "stop" for t in el.findall("tie"))
                # 谱子自带歌词时: <lyric><syllabic>single|begin|middle|end</syllabic><text>字</text>
                ly = el.find("lyric")
                lyric_text = lyric_syllabic = None
                if ly is not None:
                    tx = ly.find("text")
                    sy = ly.find("syllabic")
                    lyric_text = (tx.text or "").strip() if tx is not None else None
                    lyric_syllabic = (sy.text or "").strip() if sy is not None else "single"
                # 圆滑线的续音(非起点)与连音线一样, 都是同一个字拖到下一个音符
                in_slur_cont = any(sl.get("type") in ("stop", "continue")
                                   for sl in el.iter("slur"))
                notes.append({"midi": midi, "sec": sec,
                              "tied_from": tied_from or in_slur_cont,
                              "lyric": lyric_text, "syllabic": lyric_syllabic})
    return notes, bpm


def syllabify(phones):
    """ARPAbet 音素串 -> 音节列表。每个音节恰含一个元音, 辅音按最大起音原则归后。"""
    idx = [i for i, p in enumerate(phones) if VOWEL.match(p)]
    if not idx:
        return [phones]
    syls, prev = [], 0
    for n, v in enumerate(idx):
        if n == len(idx) - 1:
            syls.append(phones[prev:])
        else:
            gap = phones[v + 1: idx[n + 1]]          # 两元音之间的辅音团
            keep = 1 if len(gap) > 1 else 0          # 留一个收音, 其余给下一音节起音
            syls.append(phones[prev: v + 1 + keep])
            prev = v + 1 + keep
    return syls


def word_units(word, cmu, align):
    """一个词 -> [(显示文本, [音素,...]), ...]"""
    key = re.sub(r"[^a-z']", "", word.lower())
    prons = cmu.get(key)
    if not prons:
        return None
    phones = prons[0]
    if align == "word":
        return [(word, phones)]
    syls = syllabify(phones)
    if len(syls) == 1:
        return [(word, syls[0])]
    # 多音节词按音节拆到多个音符, 显示文本标出是第几节, 便于人工核对对齐
    return [(f"{word}~{i+1}", syl) for i, syl in enumerate(syls)]


def build_from_score_lyrics(notes, cmu, language):
    """谱子自带 <lyric> —— 对齐信息就在谱子里, 不猜。"""
    text, phoneme, pitch, ntype, dur = [], [], [], [], []
    for n in notes:
        if n["midi"] is None:
            text.append("<SP>"); phoneme.append("<SP>")
            pitch.append(0); ntype.append(1); dur.append(round(n["sec"], 3))
            continue
        w = n.get("lyric")
        if not w or n["tied_from"]:
            if not text or ntype[-1] == 1:
                return None, "拖腔落在休止之后, 谱子的歌词标记有问题"
            text.append(next(t for t in reversed(text) if t != "<SP>"))
            phoneme.append(next(p for p in reversed(phoneme) if p != "<SP>"))
            pitch.append(n["midi"]); ntype.append(3); dur.append(round(n["sec"], 3))
            continue
        key = re.sub(r"[^a-z']", "", w.lower())
        prons = cmu.get(key)
        if not prons:
            return None, f"CMUdict 里没有这个音节: {w!r}(谱子按音节分词时常见, 需人工补音)"
        text.append(w)
        phoneme.append(f"{language}_" + "-".join(prons[0]))
        pitch.append(n["midi"]); ntype.append(2); dur.append(round(n["sec"], 3))
    return {"text": text, "phoneme": phoneme, "note_pitch": pitch,
            "note_type": ntype, "duration": dur}, None


def build(notes, lyric_words, cmu, align, language):
    """把歌词铺到音符上, 产出五条等长序列。"""
    text, phoneme, pitch, ntype, dur = [], [], [], [], []
    # 先把每个词展开成【要占几个音符】的单元
    units = []
    for w in lyric_words:
        u = word_units(w, cmu, align)
        if u is None:
            return None, f"CMUdict 里没有这个词: {w!r}"
        units.extend(u)
    ui = 0
    pending_slur = False
    for n in notes:
        if n["midi"] is None:
            text.append("<SP>"); phoneme.append("<SP>")
            pitch.append(0); ntype.append(1); dur.append(round(n["sec"], 3))
            pending_slur = False
            continue
        if n["tied_from"] or pending_slur or ui >= len(units):
            # 延音: 承接上一个已发的词/音节
            if not text or ntype[-1] == 1:
                return None, "延音落在了休止之后, 谱子与歌词对不上"
            src_t = next(t for t in reversed(text) if t != "<SP>")
            src_p = next(p for p in reversed(phoneme) if p != "<SP>")
            text.append(src_t); phoneme.append(src_p)
            pitch.append(n["midi"]); ntype.append(3); dur.append(round(n["sec"], 3))
            continue
        disp, phones = units[ui]; ui += 1
        text.append(disp)
        phoneme.append(f"{language}_" + "-".join(phones))
        pitch.append(n["midi"]); ntype.append(2); dur.append(round(n["sec"], 3))
    leftover = len(units) - ui
    return {
        "text": text, "phoneme": phoneme,
        "note_pitch": pitch, "note_type": ntype, "duration": dur,
    }, (f"歌词还剩 {leftover} 个单元没铺完(音符不够)" if leftover > 0 else None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("score", type=Path)
    ap.add_argument("-o", "--out", type=Path, required=True)
    ap.add_argument("--part", help="声部 id (默认列出后退出)")
    ap.add_argument("--lyrics", type=Path, help="歌词文本; 谱子自带 <lyric> 时可省")
    ap.add_argument("--align", choices=["word", "syllable"], default="syllable")
    ap.add_argument("--bpm", type=float, default=90.0, help="谱子没写 tempo 时的默认速度")
    ap.add_argument("--index", default="take1")
    ap.add_argument("--language", default="en", choices=["en", "zh"])
    ap.add_argument("--phone-set", type=Path,
                    help="SoulX phone_set.json; 给了就逐音素校验词表命中")
    a = ap.parse_args()

    root = load_musicxml(a.score)
    parts = list_parts(root)
    if not a.part:
        print("这份谱子的声部:")
        for pid, nm in parts:
            print(f"  {pid}  {nm}")
        print("\n用 --part <id> 指定。Sacred Harp 的旋律在 tenor, 不在 treble。")
        return

    notes, bpm = extract_notes(root, a.part, a.bpm)
    sung = sum(1 for n in notes if n["midi"] is not None)
    print(f"声部 {a.part}: 音符 {len(notes)} 个(发声 {sung}, 休止 {len(notes)-sung}), tempo {bpm}")

    import cmudict
    cmu = cmudict.dict()
    has_score_lyrics = any(n.get("lyric") for n in notes)
    if has_score_lyrics and not a.lyrics:
        print("  谱子自带 <lyric>, 按谱对齐(不猜拖腔位置)")
        seq, warn = build_from_score_lyrics(notes, cmu, a.language)
    else:
        if not a.lyrics:
            sys.exit("这份谱子既没有 <lyric>, 也没给 --lyrics —— "
                     "拖腔该落在哪没有任何依据, 拒绝瞎猜。")
        if not has_score_lyrics:
            print("  ⚠ 谱子无 <lyric> 且无 slur/tie: 拖腔位置无依据, "
                  "以下对齐仅为机械铺排, 必须人工核对")
        words = a.lyrics.read_text(encoding="utf-8").split()
        seq, warn = build(notes, words, cmu, a.align, a.language)
    if seq is None:
        sys.exit(f"失败: {warn}")

    # 自检: 拆开 '-' 后每个音素都必须在 SoulX 词表里, 否则模型侧会静默查空
    if a.phone_set and a.phone_set.exists():
        vocab = set(json.loads(a.phone_set.read_text()))
        bad = set()
        for tok in seq["phoneme"]:
            if tok.startswith("<"):
                continue
            lang, _, body = tok.partition("_")
            for ph in body.split("-"):
                if f"{lang}_{ph}" not in vocab:
                    bad.add(f"{lang}_{ph}")
        if bad:
            sys.exit(f"这些音素不在 SoulX 词表里, 拒绝输出: {sorted(bad)}")
        print(f"  音素自检: {len(seq['phoneme'])} 个 token 全部命中词表 ✅")

    lens = {k: len(v) for k, v in seq.items()}
    if len(set(lens.values())) != 1:
        sys.exit(f"五条序列不等长, 拒绝输出: {lens}")
    total = sum(seq["duration"])

    rec = {
        "index": a.index,
        "language": {"en": "English", "zh": "Mandarin"}[a.language],
        "time": [0, int(total * 1000)],
        "duration":   " ".join(f"{d:.2f}" for d in seq["duration"]),
        "text":       " ".join(seq["text"]),
        "phoneme":    " ".join(seq["phoneme"]),
        "note_pitch": " ".join(str(p) for p in seq["note_pitch"]),
        "note_type":  " ".join(str(t) for t in seq["note_type"]),
    }
    a.out.write_text(json.dumps([rec], ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"→ {a.out}  ({lens['text']} token, {total:.1f} 秒, align={a.align})")
    if warn:
        print(f"⚠ {warn}")


if __name__ == "__main__":
    main()
