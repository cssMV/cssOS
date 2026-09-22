#!/usr/bin/env python3
"""W2133 · 把字幕标签与轨标签校正成【内容真正的语言】。默认干跑, --apply 才真改。

为什么不能沿用 W2131 的判据: 那一波的第一优先级是「采信字幕文件里的真实标签」,
前提是标签只是【缺失】(占位符)。这一波的标签是【错的】—— 采信它等于把错误抄一遍。
所以这里一律【从内容的字形反推】, 标签只作参照。

三个必须防住的坑:
 ① 拉丁字形分不出语种(en/fr/de/la/vi… 共用拉丁字母)。拉丁内容一律【不靠字形定语言】,
    只从轨的 lang / 作品 language 里取一个拉丁系的; 取不到就【拒绝, 不猜】。
 ② 同字形多语言: 天城体(hi/sa/mr/ne)、阿拉伯字母(ar/fa/ur/ps/ku)、西里尔(ru/uk/bg/sr)。
    这些只在【现标签不属于该字形家族】时才算错; 属于就放过。
    —— 梵语 sa 用天城体被判 hi 就是这个假阳性(W2030 已定 sa 才对), 照着字形改会改坏。
 ③ 条目互换: 文件里两条的标签可能正好错位(A 标 zh 实为拉丁, B 标 en 实为中文)。
    retag 后若有两条同语言 → 整首拒绝并报出来, 绝不制造重名条目。
"""
import json, re, subprocess, sys

DB = ["psql", "-h", "127.0.0.1", "-U", "cssstudio", "-d", "cssstudio", "-At"]
BUCKET = "r2:cssos-artifacts"
PLACE = {"", "orig", "auto", "und", "orig-pre-epic"}
FAMILY = {
    "deva":   {"hi", "sa", "mr", "ne", "kok", "bho"},
    "arab":   {"ar", "fa", "ur", "ps", "ku", "sd", "ckb"},
    "cyrl":   {"ru", "uk", "bg", "sr", "mk", "be", "kk", "mn"},
    "hani":   {"zh", "yue", "wuu"},
    "kana":   {"ja"},
    "hang":   {"ko"},
    "grek":   {"el", "grc"},
    "hebr":   {"he", "yi"},
}
# 拉丁字形写出来的语言(含用拉丁转写的古语言)
LATIN = {"en","fr","de","es","it","pt","la","vi","id","tr","pl","nl","sv","da","no","fi","cs",
         "ro","hu","sw","yo","haw","zap","eu","ca","gl","af","et","lv","lt","sl","hr","sq","is",
         "ga","cy","mt","tl","ms","uz","az","so","ha","ig","zu","xh","st","tn","rw","mg","ny",
         "sn","qu","ay","gn","nah","akk","sux","egy","hit","non","got","ang","enm","oc","br","co","sc"}

def sh(args, inp=None):
    return subprocess.run(args, capture_output=True, text=True, input=inp).stdout

def script_of(t):
    if re.search(r"[가-힯]", t): return "hang"
    if re.search(r"[぀-ヿ]", t): return "kana"
    if re.search(r"[一-鿿]", t): return "hani"
    if re.search(r"[؀-ۿݐ-ݿ]", t): return "arab"
    if re.search(r"[Ѐ-ӿ]", t): return "cyrl"
    if re.search(r"[Ͱ-Ͽ]", t): return "grek"
    if re.search(r"[֐-׿]", t): return "hebr"
    if re.search(r"[ऀ-ॿ]", t): return "deva"
    if re.search(r"[A-Za-z]", t): return "latn"
    return "?"

DEFAULT_OF = {"hani":"zh","kana":"ja","hang":"ko","arab":"ar","cyrl":"ru","grek":"el","hebr":"he","deva":"hi"}

def is_junk(t):
    """逐字母拆开的污染文本 —— 这不是某种语言, 是坏字幕, 绝不能给它贴标签。
    实例: 'T h e s t a g e o p e n s' / 'l y r i c s n n n 1 n n n'。
    判据: 空白切分后【单字符 token 占一半以上】。真句子不会这样。"""
    toks = t.split()
    if len(toks) < 8: return False
    return sum(1 for x in toks if len(x) == 1) / len(toks) > 0.5

def looks_llm_meta(t):
    """LLM 的元回复被烤进了字幕(实例: 'I appreciate you sharing this, but I need to clarify')。
    也不是语言问题, 是内容事故。"""
    low = t.lower()
    return any(k in low for k in (
        "i appreciate you sharing", "i need to clarify", "i can't help with",
        "as an ai", "i cannot provide", "i'm unable to"))

def entry_text(L):
    return "".join(str(ln.get("text") or "")
                   for sec in (L.get("sections") or []) for ln in (sec.get("lines") or []))

def plan_work(wid, wlang, tracks):
    """返回 (per_entry_plan, refuse_reason)"""
    raw = sh(["rclone", "cat", f"{BUCKET}/works/{wid}/subtitle-take1.json"])
    if not raw.strip(): return None, "字幕文件读不到"
    try: doc = json.loads(raw)
    except Exception: return None, "字幕文件不是合法 JSON"
    langs = doc.get("languages") or []
    if not langs: return None, "字幕文件没有语言条目"
    track_langs = [t for t in tracks if t not in PLACE]
    out = []
    for L in langs:
        tag = str(L.get("lang") or "")
        base = tag.lower().split("-")[0]
        txt = entry_text(L)
        if len(txt.strip()) < 8:
            out.append((tag, tag, "内容太短不动")); continue
        if is_junk(txt):
            return None, f"字幕内容是逐字母拆开的污染(标签 {tag or '(空)'}) —— 不是标签问题"
        if looks_llm_meta(txt):
            return None, f"字幕里烤进了 LLM 元回复(标签 {tag or '(空)'}) —— 不是标签问题"
        sc = script_of(txt)
        if sc == "?":
            out.append((tag, tag, "字形判不出不动")); continue
        if sc == "latn":
            # 坑①(修正版): 拉丁内容【一律不动】。
            #
            # 第一版我拿一张"拉丁系语言白名单"来判, 结果把 mi(毛利语)/gd(苏格兰盖尔语)/
            # yua(尤卡坦玛雅语) 这些【本来就用拉丁字母写】的语言判成错标签, 要改成 en ——
            # 那是把对的改坏。白名单永远列不全, 而列不全的代价是误伤真实语言。
            #
            # 更根本的是: 拉丁字母是几十种语言 + 无数转写方案共用的字形, 从字形【推不出语种】。
            # 按平台的「宁可空白, 绝不错配」, 推不出就不动。
            out.append((tag, tag, "拉丁字形推不出语种, 不动")); continue
        # 坑②: 同字形家族, 标签属于就放过(梵语 sa 用天城体即此类, W2030 已定 sa 才对)
        if base in FAMILY[sc]:
            out.append((tag, tag, f"标签属 {sc} 家族放过")); continue
        fam = FAMILY[sc]
        pick = next((t for t in track_langs if t.lower().split("-")[0] in fam), None) \
            or (wlang if wlang.lower().split("-")[0] in fam else None) or DEFAULT_OF[sc]
        if base in PLACE:
            out.append((tag, pick, f"占位符 {tag or '(空)'} → {pick}(内容是 {sc})")); continue
        other = next((k for k, v in FAMILY.items() if k != sc and base in v), None)
        if other:
            out.append((tag, pick, f"{tag} 是 {other} 字形的语言, 内容却是 {sc} → {pick}")); continue
        if base in LATIN:
            out.append((tag, pick, f"{tag} 是拉丁系语言, 内容却是 {sc} → {pick}")); continue
        # 不认识的语言码 —— 可能是我不知道的、恰好用这个字形的语言。不猜。
        return None, f"标签 {tag} 我判不出它属什么字形, 内容是 {sc} —— 不猜"

    finals = [n for _, n, _ in out]
    if len(set(finals)) != len(finals):
        return None, f"retag 后会有重名条目 {finals} —— 疑似标签互换, 拒绝"
    return out, None

def main():
    apply = "--apply" in sys.argv
    only = None
    for a in sys.argv[1:]:
        if a.startswith("--status="): only = set(a.split("=", 1)[1].split(","))
    q = ("SELECT w.id::text, COALESCE(w.status,'-'), COALESCE(w.language,''), COALESCE(w.title,'-'), "
         "COALESCE((SELECT string_agg(t.lang,',') FROM work_language_tracks t WHERE t.work_id=w.id),'') "
         "FROM user_works w WHERE COALESCE(w.subtitle_take1_json_url,'')<>'' ORDER BY w.created_at")
    rows = [r.split("|") for r in sh(DB + ["-F", "|", "-c", q]).strip().split("\n") if r.strip()]
    todo, refused, noop = [], [], 0
    for wid, st, wlang, title, trk in rows:
        if only and st not in only: continue
        tracks = [x for x in trk.split(",") if x]
        # 只处理核对器报过不符的
        pl, why = plan_work(wid, wlang, tracks)
        if why:
            # 只有确实需要动的才算被拒
            refused.append((wid, st, title, why)); continue
        changes = [(o, n, r) for o, n, r in pl if o != n]
        if not changes: noop += 1; continue
        todo.append((wid, st, wlang, title, tracks, changes))
    print(f"=== 清单 {len([r for r in rows if not only or r[1] in only])} 首, 需要改 {len(todo)} 首 · "
          f"本来就对 {noop} 首 · 拒绝 {len(refused)} 首 ===")
    from collections import Counter
    print("--- 改动方向 ---")
    for k, v in Counter(f"{o or '(空)'}→{n}" for _, _, _, _, _, ch in todo for o, n, _ in ch).most_common(20):
        print(f"  {v:4d}  {k}")
    if refused:
        print("--- 拒绝(不猜, 报给 Jing) ---")
        for wid, st, title, why in refused[:15]:
            print(f"  {wid[:8]} [{st}] {title[:26]}  :: {why}")
        if len(refused) > 15: print(f"  …另有 {len(refused)-15} 首")
    with open("/tmp/w2133-plan.json", "w") as f:
        json.dump([{"work": w, "status": s, "wlang": wl, "title": t, "tracks": tr,
                    "changes": [{"old": o, "new": n, "why": r} for o, n, r in ch]}
                   for w, s, wl, t, tr, ch in todo], f, ensure_ascii=False)
    print(f"\n计划写入 /tmp/w2133-plan.json ({len(todo)} 首)")
    if not apply: print("(干跑, 未改动。要真改加 --apply)")

main()
