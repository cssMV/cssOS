#!/usr/bin/env python3
# W2305 复核: 把 app.emotion-subtitle-engine.js:141-160 的选条目逻辑【逐行照搬】成 Python,
# 拿每条轨真实的 (lang, subtitle_url) 跑一遍 —— 看它现在到底选中哪一条, 那一条干不干净。
# 不推理"应该能读到", 让判据自己跑。
import json, os, re, subprocess, urllib.request
UA = "Mozilla/5.0 (Macintosh) cssos-audit"
LEAKS = ["The stage opens", "Lighting moves", "Hybrid of traditional", "Lead: Heike biwa",
         "Ambient: Faint wind", "Support: Sh", "Percussion:", "Instrumentation:", "Style of Music"]
W = [("056c5a62", "056c5a62-517c-452a-a34c-3566d942ad6e"),
     ("907f2e2e", "907f2e2e-4d2f-4efe-9995-7e2b14b38c1a")]
def q(sql):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-At", "-F", "|", "-c", sql],
                       capture_output=True, text=True, timeout=60)
    return [l.split("|") for l in r.stdout.strip().split("\n") if l.strip()]
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=90).read()
def _norm(t):  # 引擎的同族归一(zh-CN → zh 这类): 取第一段
    return str(t or "").lower().split("-")[0].split("_")[0]

def pick(doc, lang):
    """照搬引擎: 精确 → 同族 → (仅当全文件只有一条且是占位符且字形对) 兜底"""
    L = doc.get("languages") or []
    want = _norm(lang)
    e = next((x for x in L if x.get("lang") == lang), None)
    how = "精确匹配"
    if e is None and want:
        e = next((x for x in L if _norm(x.get("lang")) == want), None); how = "同族匹配"
    if e is None and len(L) == 1:
        only = L[0]; tag = str(only.get("lang") or "").lower()
        if tag in ("", "orig", "auto", "und"):
            txt = ""
            for sec in (only.get("sections") or [])[:6]:
                for ln in (sec.get("lines") or [])[:8]: txt += " " + str((ln or {}).get("text") or "")
            script = ("ko" if re.search(r"[가-힯]", txt) else
                      "ja" if re.search(r"[぀-ヿ]", txt) else
                      "zh" if re.search(r"[一-鿿]", txt) else
                      "latin" if re.search(r"[A-Za-z]", txt) else "")
            if script == want or (script == "latin" and want and want not in ("zh","ja","ko")):
                e = only; how = "占位符兜底"
    return e, (how if e is not None else "没选中 → 整首空白")

for (w8, wid) in W:
    print("\n=== %s  %s ===" % (w8, q("SELECT left(title,30) FROM user_works WHERE id='%s'::uuid" % wid)[0][0]))
    for r in q("SELECT COALESCE(lang,''), COALESCE(voice,''), COALESCE(subtitle_url,'') "
               "FROM work_language_tracks WHERE work_id='%s'::uuid ORDER BY voice" % wid):
        lang, voice, sub = r
        if not sub: print("   轨 %s/%-9s 没有字幕地址" % (lang, voice)); continue
        doc = json.loads(get(sub))
        tags = [str(x.get("lang","")) for x in (doc.get("languages") or [])]
        e, how = pick(doc, lang)
        if e is None:
            print("   轨 %s/%-9s 文件条目=%s → ‼ %s" % (lang, voice, tags, how)); continue
        body = []
        for s in (e.get("sections") or []):
            for ln in (s.get("lines") or []):
                t = ((ln.get("text") or "") if isinstance(ln, dict) else str(ln)).strip()
                if t and not t.startswith("["): body.append(t)
        leak = [b for b in body if any(k in b for k in LEAKS)]
        ends = [x["t_end"] for s in (e.get("sections") or []) for ln in (s.get("lines") or [])
                for x in (ln.get("tokens") or []) if x.get("t_end") is not None]
        print("   轨 %-4s/%-9s 文件条目=%-32s → 选中 lang=%-6s (%s)  %d 行 · 说明 %d %s · 末 %.1fs"
              % (lang, voice, str(tags), e.get("lang"), how, len(body), len(leak),
                 "✅" if not leak else "‼", max(ends)/1000 if ends else -1))
