#!/usr/bin/env python3
# W2306 判定器 —— 「这条字幕有没有越界」只问一个问题:
#   【真有轨会读到它】吗? 读不到的条目不是越界, 是陈旧副本。
#
# 两条教训落在这里:
#  · 身份只能是 URL(W2270/W2302): take→音频→版本行一律按 URL 认, 不按 lang。
#  · ♪N 是哪一版, 问平台真源 loadWorkTakes 的产物(GET /api/works/:id/language-tracks),
#    不在这里照抄一遍 SQL(照抄 = 造第二份真源)。
import json, os, re, subprocess, sys, urllib.request, hashlib
UA='Mozilla/5.0 (Macintosh) cssos-audit'
API='http://127.0.0.1:3000'
WORKS=sys.argv[1:] or ['f4c5e610','82a6f65c']
SEP='\x1f'

def q(sql):
    r=subprocess.run(["psql",os.environ["DATABASE_URL"],"-X","-q","-t","-A","-F",SEP,
                      "-v","ON_ERROR_STOP=1","-c",sql],capture_output=True,text=True,timeout=120)
    if r.returncode!=0: print("QERR",r.stderr[:300]); sys.exit(2)
    return [ln.split(SEP) for ln in r.stdout.strip("\n").split("\n") if ln.strip()]

def get(u,timeout=120):
    try:
        rr=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA}),timeout=timeout)
        return rr.status, rr.read()
    except Exception as e:
        return (getattr(e,'code',None) or -1), b''

_dur={}
def dur(url):
    """实测 = 整条解码。头会撒谎(W2302)。"""
    if url in _dur: return _dur[url]
    v=None
    try:
        p=subprocess.run(['ffmpeg','-nostdin','-v','info','-i',url,'-f','null','-'],
                         capture_output=True,text=True,timeout=1800)
        ts=re.findall(r'time=(\d+):(\d\d):(\d\d\.\d+)',p.stderr)
        if ts:
            h,m,s=ts[-1]; v=round(int(h)*3600+int(m)*60+float(s),2)
    except Exception: v=None
    _dur[url]=v; return v

_sub={}
def sub(url):
    if url in _sub: return _sub[url]
    st,b=get(url)
    if st!=200: r={'err':f'HTTP {st}'}
    else:
        try: j=json.loads(b)
        except Exception as e: j=None; r={'err':f'JSON {e}'}
        if j is not None:
            r={'sha24':hashlib.sha1(b).hexdigest()[:24],'bytes':len(b),'entries':{}}
            for L in (j.get('languages') or []):
                tag=str(L.get('lang') or '')
                nl=0; ends=[]; sung=[]; notok=0; nsec=0
                for s in (L.get('sections') or []):
                    nsec+=1
                    for ln in (s.get('lines') or []):
                        nl+=1
                        tx=str(ln.get('text') or '')
                        tk=ln.get('tokens') or []
                        if not tk: notok+=1
                        e=None
                        for t in tk:
                            if isinstance(t,dict) and t.get('t_end') is not None:
                                e=max(e or 0,float(t['t_end']))
                        if ln.get('t_end') is not None:
                            e=max(e or 0,float(ln['t_end']))
                        if e is None: continue
                        ends.append((e,tx))
                        if not re.match(r'^\s*[\[【(]', tx):   # 非 [Music...] / 非方括号提示
                            sung.append((e,tx))
                r['entries'][tag]={'sections':nsec,'lines':nl,'no_tok':notok,
                                   'end_ms':max(e for e,_ in ends) if ends else None,
                                   'sung_end_ms':max(e for e,_ in sung) if sung else None,
                                   'top':sorted(ends,reverse=True)[:3]}
    _sub[url]=r; return r

def pick_entry(entries, want):
    """照搬 app.emotion-subtitle-engine.js:141-160 的三段: 精确 → 同族 → 占位符兜底"""
    # 引擎的精确匹配是【区分大小写】的 l.lang === lang; _norm 只按 '-' 切
    w=str(want or '')
    for tag in entries:
        if tag==w: return tag,'精确'
    norm=lambda s: (str(s).lower().split('-')[0] or str(s).lower())
    if w:
        for tag in entries:
            if norm(tag)==norm(w): return tag,'同族'
    PH={'','orig','auto','und'}
    if len(entries)==1:
        only=list(entries)[0]
        if str(only).lower() in PH: return only,'占位符兜底'
    return None,'无'

TOL=0.5
live_bad=[]; stale_bad=[]; unknown=[]
for pre in WORKS:
    rows=q("SELECT id::text,coalesce(title,'') FROM user_works WHERE id::text LIKE '%s%%'"%pre)
    for wid,title in rows:
        print('='*104); print(f'{pre}  {title}')
        st,b=get(f'{API}/api/works/{wid}/language-tracks')
        if st!=200: print(f'  ‼ 真源接口 HTTP {st} —— 判不了'); unknown.append((pre,'api',st)); continue
        tracks=json.loads(b).get('tracks') or []
        wl=f'https://cdn.cssstudio.app/works/{wid}/subtitle-take1.json'
        print(f'  真源下发 {len(tracks)} 条轨')
        used_subs={}
        print('  --- 可达判定: 每条轨的每颗 ♪, 引擎真会读到的那个条目 ---')
        for t in tracks:
            lang=str(t.get('lang') or ''); voice=str(t.get('voice') or 'auto')
            for tk in (t.get('takes') or []):
                n=tk.get('take'); au=str(tk.get('url') or '')
                su=str(tk.get('subtitle_url') or '').strip() or wl
                used_subs.setdefault(su,set()).add(lang)
                ad=dur(au); info=sub(su)
                if info.get('err'):
                    print(f'   {lang}/{voice} ♪{n}  ‼ 字幕取不到 {info["err"]} —— 判不了')
                    unknown.append((pre,f'{lang}/{voice}♪{n}',info['err'])); continue
                tag,how=pick_entry(info['entries'],lang)
                if tag is None:
                    print(f'   {lang}/{voice} ♪{n}  ‼ 该文件里没有能匹配的条目(有 {list(info["entries"])}) → 这条轨哑')
                    unknown.append((pre,f'{lang}/{voice}♪{n}','NO_ENTRY')); continue
                E=info['entries'][tag]
                e=(E['end_ms'] or 0)/1000.0; se=(E['sung_end_ms'] or 0)/1000.0
                if ad is None:
                    print(f'   {lang}/{voice} ♪{n}  ‼ 音频量不到 —— 判不了'); unknown.append((pre,f'{lang}/{voice}♪{n}','NO_DUR')); continue
                over=e-ad; sover=se-ad
                flag='ok'
                if sover>TOL: flag='唱词越界 ⚠⚠'
                elif over>TOL: flag='尾奏越界 ⚠'
                line=(f'   {lang}/{voice} ♪{n}  {os.path.basename(au)[:30]:32s} '
                      f'{su.split("/")[-1][:36]:38s} [{tag}·{how}] '
                      f'唱末{se:7.1f} 全末{e:7.1f} 音频{ad:7.1f}  {flag}')
                print(line)
                if flag!='ok':
                    live_bad.append(dict(work=pre,wid=wid,title=title,lang=lang,voice=voice,take=n,
                                         audio=au,sub=su,tag=tag,end=e,sung=se,audio_s=ad,kind=flag))
        print('  --- 同一份快照里【没有任何轨会读】的条目(陈旧副本, 不是越界) ---')
        for su,langs in used_subs.items():
            info=sub(su)
            if info.get('err'): continue
            for tag,E in info['entries'].items():
                if tag in langs: continue
                e=(E['end_ms'] or 0)/1000.0
                print(f'   {su.split("/")[-1][:40]:42s} [{tag}] 末{e:7.1f}  ← 读它的轨不播这段音频')
                stale_bad.append(dict(work=pre,sub=su,tag=tag,end=e))
print()
print('#'*104)
print(f'可达的越界(真会被用户听到): {len(live_bad)}')
for x in live_bad:
    print(f'  {x["work"]} {x["lang"]}/{x["voice"]} ♪{x["take"]}  [{x["tag"]}] 唱末{x["sung"]:.1f} 全末{x["end"]:.1f} 音频{x["audio_s"]:.1f}  {x["kind"]}')
print(f'陈旧副本(没有轨会读): {len(stale_bad)}')
print(f'判不了: {len(unknown)}  {unknown}')
print('VERDICT: W2306-judge 结束')
