#!/usr/bin/env python3
"""W2143 · 给 orig-pre-epic 轨生成【它自己那版音频】的字幕。

Jing 的铁律:「用户播放旧版本就显示旧版本字幕, 新版本就显示新版本字幕。」
实测 18 条用户可见的 pre-epic 轨里, 10 条做不到:
  7 条 完全没字幕(点了 ♪ 胶囊, 听到 epic 之前的旧版, 屏幕一个字都没有)
  3 条 靠引擎把 'orig-pre-epic' 按 '-' 归一化成 'orig' 撞上了旧条目 ——
       那条时间轴是给【另一份音频】对的, 按「宁可空白绝不错配」比空白更糟

⚠ 顺序陷阱(这一波最容易做砸的地方):
  upsertSubtitleJson 是【按语言合并进作品级文件】的。给 pre-epic 音频对齐出来的字幕
  会以真实语言(如 zh)写回作品级文件, 把 epic 版那条【覆盖掉】。
  而实测 39 条 ready 轨里只有 1 条有自己的 subtitle_url —— 其余全靠作品级文件兜底。
  所以必须先让 epic 轨【认领】它现在的字幕, 再去生成 pre-epic 的。

四步, 每步都可单独复验:
  A 备份作品级字幕字节(-pre-w2143.json)
  B 把当前作品级字幕【快照】给 epic(默认)轨, 写进它的 subtitle_url —— 纯拷贝, 不生成、不覆盖
  C 逐首跑 resubtitle?lang=orig-pre-epic(串行), 生成对得上旧音频的字幕
  D 把作品级文件从 A 的备份还原 —— 其它读作品级的地方仍拿到 epic 版
"""
import hashlib, json, subprocess, sys, time

DB = ["psql", "-h", "127.0.0.1", "-U", "cssstudio", "-d", "cssstudio", "-At"]
B = "r2:cssos-artifacts"
def sh(a, inp=None): return subprocess.run(a, capture_output=True, text=True, input=inp).stdout.strip()
def q(sql): return sh(DB + ["-c", sql])

def snap_key(work_id, audio_url):
    """与 upsertSubtitleJson 完全一致的版本快照键: sha1(音频URL) 前 10 位。"""
    tag = hashlib.sha1(audio_url.encode()).hexdigest()[:10]
    return f"works/{work_id}/subtitle-take1--a{tag}.json"

rows = [l.split("\t") for l in open("/tmp/w2143-list.tsv") if l.strip()]
phase = sys.argv[1] if len(sys.argv) > 1 else "all"
print(f"清单 {len(rows)} 首")

if phase in ("all", "AB"):
    okA = okB = 0
    for wid, tid, why, title in rows:
        suburl = q(f"SELECT COALESCE(subtitle_take1_json_url,'') FROM user_works WHERE id='{wid}'")
        main = f"works/{wid}/subtitle-take1.json"
        # A —— 旧字节先另存(铁律: 动任何完整成品之前, 旧字节必须有自己的地址)
        sh(["rclone", "copyto", f"{B}/{main}", f"{B}/works/{wid}/subtitle-take1-pre-w2143.json"])
        a = sh(["rclone", "size", "--json", f"{B}/{main}"])
        b = sh(["rclone", "size", "--json", f"{B}/works/{wid}/subtitle-take1-pre-w2143.json"])
        if a and a == b: okA += 1
        else: print(f"  ❌ A 备份字节对不上 {wid[:8]}"); continue
        # B —— 把当前字幕快照给 epic(默认)轨
        ep = q(f"""SELECT id::text||'|'||COALESCE(audio_url,'') FROM work_language_tracks
                    WHERE work_id='{wid}' AND status='ready'
                      AND lang NOT IN ('orig-pre-epic','orig','auto','')
                    ORDER BY is_default DESC, track_order LIMIT 1""")
        if not ep or "|" not in ep: print(f"  ⚠ B 找不到 epic 轨 {wid[:8]}"); continue
        ep_id, ep_audio = ep.split("|", 1)
        if not ep_audio: print(f"  ⚠ B epic 轨没有 audio_url {wid[:8]}"); continue
        key = snap_key(wid, ep_audio)
        sh(["rclone", "copyto", f"{B}/{main}", f"{B}/{key}"])
        url = "https://cdn.cssstudio.app/" + key
        q(f"UPDATE work_language_tracks SET subtitle_url='{url}', updated_at=now() WHERE id={ep_id}")
        okB += 1
    print(f"=== A 备份 {okA}/{len(rows)} · B epic 轨已认领字幕 {okB}/{len(rows)} ===")

if phase in ("all", "C"):
    # ⚠ 别再套 shell 引号取 token —— 第一版用 bash -lc + 多层引号, 结果取到空串,
    #   10 条全报 ADMIN_TOKEN_REQUIRED。纯 Python 读文件, 没有引号可以吃掉。
    tok = ""
    for line in open("/etc/cssos.env"):
        if line.strip().startswith("CSSOS_ADMIN_TOKEN="):
            tok = line.split("=", 1)[1].strip().strip("'").strip('"')
            break
    if not tok:
        print("❌ 取不到 CSSOS_ADMIN_TOKEN, 中止"); sys.exit(1)
    ok = fail = 0
    for i, (wid, tid, why, title) in enumerate(rows, 1):
        r = sh(["curl", "-s", "-m", "900", "-X", "POST", "-H", f"x-admin-token: {tok}",
                f"http://127.0.0.1:3000/api/admin/resubtitle/{wid}?lang=orig-pre-epic"])
        good = '"ok":true' in r and '"results"' in r and '"ok":true' in r.split('"results"')[-1]
        print(f"  [{i}/{len(rows)}] {'OK  ' if good else 'FAIL'} {title[:28]}" + ("" if good else f"  :: {r[:160]}"))
        ok += 1 if good else 0; fail += 0 if good else 1
    print(f"=== C 生成: 成功 {ok} / 失败 {fail} / 清单 {len(rows)} ===")

if phase in ("all", "D"):
    okD = 0
    for wid, tid, why, title in rows:
        sh(["rclone", "copyto", f"{B}/works/{wid}/subtitle-take1-pre-w2143.json",
            f"{B}/works/{wid}/subtitle-take1.json"])
        okD += 1
    print(f"=== D 作品级文件已从备份还原 {okD}/{len(rows)}(其它读作品级的地方仍拿 epic 版)===")
