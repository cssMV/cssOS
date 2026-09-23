import subprocess, json, re, sys
def sh(c,t=600):
    return subprocess.run(["ssh","api-vm",c],capture_output=True,text=True,timeout=t).stdout
rows=[l.split("@|@") for l in sh(
 "PGPASSWORD='Au#20016' psql -h 127.0.0.1 -U cssstudio -d cssstudio -At -F'@|@' -c \""
 "SELECT t.id, t.lang, coalesce(t.subtitle_url,''), replace(replace(coalesce(t.lyrics,''), chr(10), ' '), chr(13), ' '), left(w.title,24) "
 "FROM work_language_tracks t JOIN user_works w ON w.id=t.work_id "
 "WHERE t.voice='pre-epic' AND t.status='ready' AND nullif(t.audio_url,'') IS NOT NULL ORDER BY w.title\"").strip().split("\n") if l.strip()]

# 判据放宽: 凡「对着用户说话 / 在分析这首歌」的口吻。窄判据已经骗过我两次。
META = re.compile(r"(if you (tell|want|.d like|.re working)|\*\*analysis\*\*|actual target language|"
                  r"you.?ve shared|I appreciate|I need to clarify|not a real language|appears to|"
                  r"I notice (that|the)|I.d be happy|here.s (a|the) (translation|breakdown)|as an ai|"
                  r"let me know|original songwriting project|the stage opens)", re.I)

def norm(s): return re.sub(r"[^\w一-鿿぀-ヿ가-힯]+","",s).lower()

bad=[]
print(f"{'作品':<22} {'lang':<5} {'行':>4}  判定")
for tid, lang, sub, lyr, title in rows:
    if not sub: bad.append((title,"没有 subtitle_url")); print(f"{title[:22]:<22} {lang:<5} {'-':>4}  ❌ 无 subtitle_url"); continue
    key=sub.split("cdn.cssstudio.app/",1)[-1]
    try: d=json.loads(sh(f"rclone cat 'r2:cssos-artifacts/{key}' 2>/dev/null | head -c 900000"))
    except Exception: bad.append((title,"取不到")); print(f"{title[:22]:<22} {lang:<5} {'-':>4}  ❌ 取不到"); continue
    ent=[L for L in (d.get("languages") or []) if str(L.get("lang"))==lang]
    if not ent:
        bad.append((title,f"文件里没有 {lang} 条目")); print(f"{title[:22]:<22} {lang:<5} {'-':>4}  ❌ 无该语言条目 (有 {[L.get('lang') for L in d.get('languages') or []]})"); continue
    txt=""; n=0
    for s_ in (ent[0].get("sections") or []):
        for ln in (s_.get("lines") or []):
            n+=1; txt+=str(ln.get("text") or "")+" "
    meta = META.search(txt)
    # 与该轨自己的歌词重合度: 真对齐应当高度重合
    a,b = norm(txt), norm(lyr)
    ov = 0.0
    if a and b:
        step=max(1,len(b)//200); grams={b[i:i+6] for i in range(0,len(b)-6,step)}
        ov = sum(1 for g in grams if g in a)/max(1,len(grams))
    okc = (n>0) and (not meta) and (ov>=0.5)
    tag = "✅" if okc else ("❌元话语:"+meta.group(0)[:22] if meta else ("❌空" if not n else f"❌与歌词重合仅{ov:.0%}"))
    if not okc: bad.append((title,tag))
    print(f"{title[:22]:<22} {lang:<5} {n:>4}  {tag}  重合{ov:.0%} | {txt[:34]}")
print(f"\n合格 {len(rows)-len(bad)}/{len(rows)}")
for t,r in bad: print(f"  ✗ {t[:26]}  {r}")
