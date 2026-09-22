#!/usr/bin/env python3
"""W2133 落地: 按 /tmp/w2133-plan.json 改齐【字幕文件标签】+【轨 lang】。
两半必须一起改(理由见 placeholder-lang-mutes-subtitles 那条教训)。
字幕旧字节先另存 -pre-w2133.json; 轨改动进 w2130_track_lang_backup; 撞唯一键则跳过。"""
import json, subprocess, sys

DB = ["psql", "-h", "127.0.0.1", "-U", "cssstudio", "-d", "cssstudio", "-At"]
B = "r2:cssos-artifacts"
def sh(a, inp=None): return subprocess.run(a, capture_output=True, text=True, input=inp)

plan = json.load(open("/tmp/w2133-plan.json"))
fileok = filesk = trk = trksk = err = 0
for w in plan:
    wid, ch = w["work"], w["changes"]
    raw = sh(["rclone", "cat", f"{B}/works/{wid}/subtitle-take1.json"]).stdout
    try: doc = json.loads(raw)
    except Exception:
        err += 1; print(f"❌ {wid[:8]} 字幕读不回"); continue
    mapping = {c["old"]: c["new"] for c in ch}
    hit = 0
    for L in (doc.get("languages") or []):
        t = str(L.get("lang") or "")
        if t in mapping: L["lang"] = mapping[t]; hit += 1
    finals = [str(L.get("lang") or "") for L in (doc.get("languages") or [])]
    if len(set(finals)) != len(finals):
        filesk += 1; print(f"⏭ {wid[:8]} retag 后会重名 {finals}, 跳过"); continue
    if hit:
        sh(["rclone", "copyto", f"{B}/works/{wid}/subtitle-take1.json",
            f"{B}/works/{wid}/subtitle-take1-pre-w2133.json"])
        body = json.dumps(doc, ensure_ascii=False)
        sh(["rclone", "rcat", f"{B}/works/{wid}/subtitle-take1.json"], inp=body)
        for snap in sh(["rclone", "lsf", f"{B}/works/{wid}/"]).stdout.split():
            if snap.startswith("subtitle-take1--a") and snap.endswith(".json"):
                sh(["rclone", "rcat", f"{B}/works/{wid}/{snap}"], inp=body)
        fileok += 1
    for c in ch:
        old, new = c["old"], c["new"]
        if not old: continue
        q = f"""WITH cand AS (
          SELECT t.id FROM work_language_tracks t
           WHERE t.work_id='{wid}'::uuid AND t.lang='{old}'
             AND NOT EXISTS (SELECT 1 FROM work_language_tracks x
                  WHERE x.work_id=t.work_id AND x.lang='{new}' AND x.voice=t.voice AND x.id<>t.id)
        ), bak AS (
          INSERT INTO w2130_track_lang_backup (track_id, work_id, old_lang, new_lang)
          SELECT t.id, t.work_id, t.lang, '{new}' FROM work_language_tracks t JOIN cand c ON c.id=t.id
          ON CONFLICT (track_id) DO NOTHING RETURNING 1
        ), upd AS (
          UPDATE work_language_tracks t SET lang='{new}', updated_at=now() FROM cand c WHERE t.id=c.id RETURNING 1
        ) SELECT (SELECT count(*) FROM upd);"""
        n = sh(DB + ["-c", q]).stdout.strip()
        if n and n != "0": trk += int(n)
        else: trksk += 1
print(f"\n=== W2133 落地: 清单 {len(plan)} 首, 处理 {len(plan)} 首 ===")
print(f"  字幕文件retag {fileok} 首 · 跳过(会重名) {filesk} 首 · 出错 {err} 首")
print(f"  轨标签改了 {trk} 条 · 无可改/撞键 {trksk} 处")
