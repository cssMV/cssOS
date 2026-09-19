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


HAN = re.compile(r"[\u4e00-\u9fff]")


def cjk_phones(word, language):
    """汉字 -> SoulX 音素。

    实测 phone_set.json 的中文/粤语音素是【整音节带声调】, 不是声母+韵母:
        zh_zhong1 ✅   zh_zh ❌   zh_ong1 ❌
        yue_ngo5  ✅   yue_ng ❌  yue_o5  ❌
    所以一个汉字 = 一个 token, 不需要像英文那样用 '-' 拼接。

    工具选的是 SoulX 自己 requirements 里那两个的同类:
        zh  -> pypinyin, TONE3 风格, 轻声记作 5(词表里确有 zh_bian5 这类)
        yue -> ToJyutping(SoulX requirements 里就有它)
    实测《声声慢》《唐伯虎》《李白》《苏东坡》真歌词共 52 字, 两种语言各 52/52 命中。

    查不到就返回 None, 交给调用方拒绝 —— 不猜, 不拿近似音顶替。
    """
    if language == "zh":
        try:
            from pypinyin import lazy_pinyin, Style
        except ImportError:
            return None, "缺 pypinyin: pip install pypinyin"
        out = lazy_pinyin(word, style=Style.TONE3, neutral_tone_with_five=True)
        return [p for p in out if p], None
    if language == "yue":
        try:
            import ToJyutping
        except ImportError:
            return None, "缺 ToJyutping: pip install ToJyutping"
        pairs = ToJyutping.get_jyutping_list(word)
        got = [j for _, j in pairs if j]
        if len(got) != len(word):
            return None, f"粤拼没给全: {word!r} {len(word)} 字只查到 {len(got)} 个"
        return got, None
    return None, f"不支持的语言: {language}"


def load_lexicon_overrides(path):
    """人工补音词表 —— CMUdict 查不到时的第二道查询。

    为什么做成外部文件而不是代码里的常量: 这里的每一个音素都是【替歌手做的决定】,
    必须可见、可审、可质疑。文件里每条都要写"依据"(o'er 由 over 推、e'er 由词典
    自己的 ne'er 去掉 N 推), 而不是谁在代码里悄悄塞一行。
    查不到就查不到, 照旧拒绝输出 —— 这张表只是让"已经想清楚的词"不必每次重想。
    """
    if not path or not Path(path).exists():
        return {}
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return {k.lower(): v["phones"] for k, v in raw.items()
            if not k.startswith("_") and isinstance(v, dict) and v.get("phones")}


def join_syllabic_words(notes):
    """按 <syllabic> 把被谱子切开的音节拼回整词。

    谱子存的是【音节】(va / por、Jean / nie), CMUdict 是【整词】词典 ——
    逐个音节去查必然落空, 这正是 Jeannie 那次 'va' 查不到的原因。
    <syllabic> 标签(single / begin / middle / end)恰恰记录了哪几个音节属于同一个词,
    这个信息谱子自己给了, 不用猜。

    返回 [(整词, [该词占据的 note 索引])], 休止和无词音符不入组。
    """
    groups, buf, idxs = [], [], []
    for i, n in enumerate(notes):
        if n["midi"] is None or not n.get("lyric") or n["tied_from"]:
            continue
        syl = (n.get("syllabic") or "single").lower()
        if syl == "single":
            groups.append((n["lyric"], [i]))
        elif syl == "begin":
            buf, idxs = [n["lyric"]], [i]
        elif syl in ("middle", "end"):
            if not buf:                       # end 没有配对的 begin —— 谱子标记坏了
                groups.append((n["lyric"], [i]))
                continue
            buf.append(n["lyric"]); idxs.append(i)
            if syl == "end":
                groups.append(("".join(buf), list(idxs)))
                buf, idxs = [], []
    if buf:                                   # begin 之后没有 end
        groups.append(("".join(buf), list(idxs)))
    return groups


def split_phones_by_syllable(phones, n_syl):
    """把一个整词的音素按音节切开。

    规则(最大音节首原则, English syllabification 的标准做法):
      每个音节恰好一个元音核; 两个元音之间的辅音【归后一个音节】。
      vapor  V-EY1-P-ER0  ->  [V-EY1] [P-ER0]
      amazing AH0-M-EY1-Z-IH0-NG -> [AH0] [M-EY1] [Z-IH0-NG]

    这条规则是替作曲家做的一个决定, 所以配了一道硬闸:
    【词典元音数 ≠ 谱子音节数就直接拒绝】, 不硬凑。实测 vapor/jeannie/summer/
    amazing/wretch/water 六个样本元音数与音节数全部一致 —— 不一致往往意味着
    谱子的音节切分和词典的读法根本不是同一个词。
    """
    vi = [i for i, p in enumerate(phones) if VOWEL.match(p)]
    if len(vi) != n_syl:
        return None
    if n_syl == 1:
        return [list(phones)]
    out, start = [], 0
    for k in range(n_syl - 1):
        # 本音节吃到【自己的元音】为止; 元音之后的辅音留给下一个音节
        end = vi[k] + 1
        out.append(list(phones[start:end]))
        start = end
    out.append(list(phones[start:]))
    return out


def build_from_score_lyrics(notes, cmu, language, overrides=None):
    """谱子自带 <lyric> —— 对齐信息就在谱子里, 不猜。"""
    # W2117 —— 先按 <syllabic> 把音节拼回整词查词典, 再把音素分回各音节。
    #   旧做法是拿 'va' 这种半截音节直接查 CMUdict, 必然落空(Jeannie 那次就卡在这里)。
    #   note 索引 -> 该音符应得的音素列表; 拼不出或元音数对不上的词【不进表】,
    #   下面照旧走"查不到就拒绝"的老路, 不会因为这层新逻辑而静默放过。
    overrides = overrides or {}
    syl_phones = {}
    for word, idxs in join_syllabic_words(notes):
        if len(idxs) < 2:
            continue                       # single 音节照旧逐个查, 不绕这一层
        key = re.sub(r"[^a-z']", "", word.lower())
        prons = cmu.get(key) or ([overrides[key]] if key in overrides else None)
        if not prons:
            continue
        parts = split_phones_by_syllable(prons[0], len(idxs))
        if parts is None:
            continue                       # 元音数 != 音节数 -> 不硬分, 留给下面报错
        for i, ph in zip(idxs, parts):
            syl_phones[i] = ph

    text, phoneme, pitch, ntype, dur = [], [], [], [], []
    for idx, n in enumerate(notes):
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
        if language in ("zh", "yue") or HAN.search(w):
            # W2117 —— 中文/粤语走整音节 G2P, 【绝不走 CMUdict】。
            #   旧代码只把 --language 当成前缀用, 查的始终是英文词典 ——
            #   `--language zh` 会产出 zh_AH0-M-EY1 这种带中文前缀的英文音素,
            #   而真正的中文音素长 zh_zhong1 这样。那道可选的 --phone-set 自检
            #   是唯一能拦住它的东西, 忘了加就静默产出垃圾。
            got, err = cjk_phones(w, language if language != "en" else "zh")
            if not got:
                return None, err or f"取不到 {w!r} 的{language}音素"
            phones = got
        elif idx in syl_phones:                    # W2117: 拼词成功, 用分好的那一份
            phones = syl_phones[idx]
        else:
            key = re.sub(r"[^a-z']", "", w.lower())
            prons = cmu.get(key) or ([overrides[key]] if key in overrides else None)
            if not prons:
                return None, (f"CMUdict 里没有这个音节: {w!r}"
                              "(已按 <syllabic> 试过拼词; 仍查不到则需人工补音)")
            phones = prons[0]
        text.append(w)
        phoneme.append(f"{language}_" + "-".join(phones))
        pitch.append(n["midi"]); ntype.append(2); dur.append(round(n["sec"], 3))
    return {"text": text, "phoneme": phoneme, "note_pitch": pitch,
            "note_type": ntype, "duration": dur}, None


def build(notes, lyric_words, cmu, align, language):
    """把歌词铺到音符上, 产出五条等长序列。"""
    text, phoneme, pitch, ntype, dur = [], [], [], [], []
    # 先把每个词展开成【要占几个音符】的单元
    units = []
    for w in lyric_words:
        if language in ("zh", "yue") or HAN.search(w):
            got, err = cjk_phones(w, language if language != "en" else "zh")
            if not got:
                return None, err or f"取不到 {w!r} 的{language}音素"
            u = [[g] for g in got]          # 一字一音节, 每个音节一个 token
        else:
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
    ap.add_argument("--language", default="en", choices=["en", "zh", "yue"])
    ap.add_argument("--lexicon", type=Path,
                    default=Path(__file__).resolve().parent.parent / "docs/svs/ref/lexicon-overrides.json",
                    help="人工补音词表(CMUdict 查不到时的第二道查询)")
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
        ovr = load_lexicon_overrides(a.lexicon)
        if ovr:
            print(f"  人工补音词表: {len(ovr)} 条({', '.join(sorted(ovr))})")
        seq, warn = build_from_score_lyrics(notes, cmu, a.language, ovr)
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
        "language": {"en": "English", "zh": "Mandarin", "yue": "Cantonese"}[a.language],
        "time": [0, int(total * 1000)],
        "duration":   " ".join(f"{d:.2f}" for d in seq["duration"]),
        "text":       " ".join(seq["text"]),
        "phoneme":    " ".join(seq["phoneme"]),
        "note_pitch": " ".join(str(p) for p in seq["note_pitch"]),
        "note_type":  " ".join(str(t) for t in seq["note_type"]),
    }
    a.out.write_text(json.dumps([rec], ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"→ {a.out}  ({lens['text']} token, {total:.1f} 秒, align={a.align})")
    # 仓库自带样例是【单段 51 秒】。更长的单段没有先例, 超了先提醒, 不擅自切段 ——
    # metadata 是分段列表, 真要切也该按乐句切, 那是音乐判断, 不是脚本该替人做的。
    if total > 60:
        print(f"⚠ 单段 {total:.0f} 秒, 超过仓库样例的 51 秒。若渲染异常, "
              f"按乐句拆成多段(每段自带 time=[起,止] 毫秒), 输出会按偏移拼回一条轨。")
    if warn:
        print(f"⚠ {warn}")


if __name__ == "__main__":
    main()
