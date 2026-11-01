#!/usr/bin/env python3
"""W2265 — 让【这首歌唱的是什么语言】在三处说同一句话。

为什么必须三处一起改: 播放端按 W1961 严格匹配取字幕 —— 轨说 zh、字幕文件标 en 就整首哑掉,
不报错、不降级。只改一处 = 把原本对得上的改成对不上。这正是 W2131 那次的原话:
「修必须两半一起改(轨标签 + 字幕文件标签)」。

三处:
  ① user_works.language          (无语言轨时, 伪轨的 lang 就取它 —— src/index.ts:4515)
  ② work_language_tracks.lang    (有轨时播放端按它取字幕)
  ③ 字幕 JSON 里 languages[].lang(作品级 subtitle-take1.json + 每版 ♪N 的快照)
  外加 work_media_versions.lang  (版本行自己的语言标)

判据不另造: 照搬 src/index.ts:41428 detectLyricLang 的字形映射(字幕写入侧用的就是这一套),
但【逐行取多数】—— 京典模版每节都夹一两行拉丁/希腊古老咒语, 整段式判定会被它们劫持。

安全网:
  · 改前把每条旧值写进 w2265_language_label_backup(可一条 UPDATE…FROM 整体回滚)
  · 每份字幕 JSON 覆盖前, 原文件先原样备份到 artifacts/audit/w2265/<id>--<名>.json
  · 任何一条拿不准(多语言轨不同语言 / 字幕文件里不止一种语言)一律跳过并列出, 绝不猜
默认干跑; --apply 才真写。--only <id,...> 可先试点。幂等: 重跑只会报「已对」, 不重复写。

输入是 /tmp/w2265-plan2.json(由 scripts/audit-language-labels.py 产出, 再补上三处现状)。
2026-11-01 已对 442 个作品执行完毕并逐个核对(三处一致 442 / 不一致 0), 此文件留档备查与复用。
回滚: update user_works u set language=b.old_value from w2265_language_label_backup b
      where b.work_id=u.id and b.place='user_works.language';  (另三处同理, 字幕文件在
      artifacts/audit/w2265/ 下有原件备份)
"""
import os, sys, json, subprocess, urllib.request, collections, tempfile
APPLY = "--apply" in sys.argv
ONLY = None
if "--only" in sys.argv: ONLY=set(sys.argv[sys.argv.index("--only")+1].split(","))
DB=os.environ['DATABASE_URL']; UA={'User-Agent':'cssos-audit/1.0'}
plan=json.load(open('/tmp/w2265-plan2.json'))
if ONLY: plan=[p for p in plan if p['id'] in ONLY]

def psql(sql, fetch=False):
    a=['psql',DB,'-X','-q','-v','ON_ERROR_STOP=1']+(['-t','-A','-c',sql] if fetch else ['-c',sql])
    r=subprocess.run(a,capture_output=True,text=True)
    if r.returncode: raise RuntimeError(r.stderr.strip()[:400])
    return r.stdout.strip()

def r2put(local, key):
    subprocess.run(['sudo','cp','/tmp/r2putkey.mjs','/srv/cssos/current/__r2putkey.mjs'],check=True)
    try:
        r=subprocess.run(['node','__r2putkey.mjs',local,key,'application/json'],
                         cwd='/srv/cssos/current',capture_output=True,text=True)
        if r.returncode: raise RuntimeError(r.stderr.strip()[:300])
        return json.loads(r.stdout.strip())
    finally:
        subprocess.run(['sudo','rm','-f','/srv/cssos/current/__r2putkey.mjs'])

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=40) as r:
        return r.read()

if APPLY:
    psql("""create table if not exists w2265_language_label_backup(
      id bigserial primary key, work_id uuid not null, place text not null,
      ref text, old_value text, new_value text, applied_at timestamptz not null default now());""")

cnt=collections.Counter(); skips=[]
for p in plan:
    wid,old,new=p['id'],p['lang'],p['new']
    # ① 作品行
    if APPLY:
        n=psql(f"with u as (update user_works set language='{new}' where id='{wid}' and coalesce(language,'')='{old}' returning 1) select count(*) from u", True)
        if n=='1': psql(f"insert into w2265_language_label_backup(work_id,place,ref,old_value,new_value) values ('{wid}','user_works.language',null,'{old}','{new}')")
        cnt['①作品行']+=int(n)
    else: cnt['①作品行']+=1
    # ② 语言轨 —— 只在【全部轨都是那个旧值】时动, 多语言作品不碰
    tl=set(p['track_langs'])
    if tl:
        # 判据: 轨只有一种语言 → 跟着内容走(哪怕它既不等于旧值也不等于新值 —— 实测有
        # 「作品行 he / 轨 zh / 歌词其实是英文」这种三方各说各话的, 三处统一到内容才有意义)。
        # 一个作品有好几种语言的轨 = 多语言胶囊, 每条轨各有自己的语言, 绝不能一把刷成同一个。
        if len(tl)!=1:
            skips.append((wid,'轨',f"多语言作品(轨语言 {sorted(tl)}) —— 每条轨各有自己的语言, 不碰"))
        elif tl=={new}:
            cnt['②语言轨已对']+=1
        else:
            cur=list(tl)[0]
            if APPLY:
                n=psql(f"with u as (update work_language_tracks set lang='{new}' where work_id='{wid}' and lang='{cur}' returning 1) select count(*) from u",True)
                if int(n): psql(f"insert into w2265_language_label_backup(work_id,place,ref,old_value,new_value) values ('{wid}','work_language_tracks.lang','{n}轨','{cur}','{new}')")
                cnt['②语言轨']+=int(n)
            else: cnt['②语言轨']+=1
    # ②b 版本行 —— 旧值, 外加占位符。
    # 占位符('' / orig / auto / und)不是语言, 是「没人填」。它留在 lang 上的后果和写错一样:
    # loadWorkTakes 按 (lang, voice) 归组, 轨说 en、版本行说 orig → 这一版挂不到那条轨上。
    # 【只动 lang, 绝不碰 voice】—— W2145 把「epic 之前那一版」的身份放在 voice 里, 动它会毁掉旗舰墙的查法。
    if APPLY:
        n=psql(f"with u as (update work_media_versions set lang='{new}' where work_id='{wid}' and (coalesce(lang,'')='{old}' or lower(coalesce(lang,'')) in ('','orig','auto','und')) returning 1) select count(*) from u",True)
        if int(n): psql(f"insert into w2265_language_label_backup(work_id,place,ref,old_value,new_value) values ('{wid}','work_media_versions.lang','{n}行(含占位符)','{old}','{new}')")
        cnt['②b版本行']+=int(n)
    # ③ 字幕 JSON
    for kind,_cached,url in p['docs']:
        # 标签【当场重取】, 不信计划里那份快照。
        # 计划是跑在改动之前的; 拿它当真会在重跑时把【已经改好的】再写一遍 ——
        # 备份键是固定的, 于是第二遍备份覆盖第一遍, 把原件换成改过的件。
        # 试点那一轮正是这样丢了一份原件(库里的 old_value 还在, 所以仍可回滚)。
        try: raw=fetch(url)
        except Exception as e: skips.append((wid,'字幕',f"{kind} 取不到: {type(e).__name__}")); continue
        doc=json.loads(raw.decode())
        tags=[e.get('lang') for e in (doc.get('languages') or [])]
        if tags==[new]: cnt['③字幕已对']+=1; continue
        if len(tags)!=1: skips.append((wid,'字幕',f"{kind} 里有 {tags} 多种语言 —— 不猜改哪一条")); continue
        if not APPLY: cnt['③字幕待改']+=1; continue
        key=url.split('cssstudio.app/',1)[1].split('?')[0]
        bkey='artifacts/audit/w2265/'+wid+'--'+key.replace('/','_')
        with tempfile.NamedTemporaryFile('wb',suffix='.json',delete=False) as f: f.write(raw); bpath=f.name
        r2put(bpath, bkey); os.unlink(bpath)
        oldtag=doc['languages'][0].get('lang')
        doc['languages'][0]['lang']=new
        with tempfile.NamedTemporaryFile('w',suffix='.json',delete=False,encoding='utf-8') as f:
            json.dump(doc,f,ensure_ascii=False); npath=f.name
        r2put(npath,key); os.unlink(npath)
        psql(f"insert into w2265_language_label_backup(work_id,place,ref,old_value,new_value) values ('{wid}','subtitle_json.lang','{kind} {key} (备份 {bkey})','{oldtag}','{new}')")
        cnt['③字幕改了']+=1

print(("【真写】" if APPLY else "【干跑】")+f" 作品 {len(plan)}")
for k,v in cnt.most_common(): print(f"   {k}: {v}")
if skips:
    print(f"\n跳过 {len(skips)} 处(拿不准的一律不猜):")
    for s in skips[:25]: print("   ", s[0], s[1], s[2])
