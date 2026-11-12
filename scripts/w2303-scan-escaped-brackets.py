#!/usr/bin/env python3
# W2303 受影响面(只读)。判据是【形状】不是关键词:
#   转义方括号 = 行里出现 \[ 或 \【
import os, subprocess
def psql(sql):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-At", "-F", "\t", "-c", sql],
                       capture_output=True, text=True, timeout=180)
    if r.returncode: print(r.stderr[:400]); return []
    return [l.split("\t") for l in r.stdout.strip().split("\n") if l.strip()]

chk = psql(r"""SELECT count(*) FROM user_works WHERE id::text LIKE 'a45dfee6%' AND lyrics_preview ~ '\\[\[【]'""")
print("自检: 已知阳性 a45dfee6 命中 = %s (必须是 1, 是 0 就是判据还错着)" % (chk[0][0] if chk else "?"))
print("=== user_works.lyrics_preview 含转义方括号的作品 ===")
rows = psql(r"""SELECT id, left(title,44),
       (SELECT count(*) FROM unnest(string_to_array(lyrics_preview, E'\n')) ln
        WHERE ln ~ '\\[\[【]')
  FROM user_works WHERE lyrics_preview ~ '\\[\[【]' ORDER BY 3 DESC""")
for r in rows: print("  %s  %-44s  %s 行" % (r[0][:8], r[1], r[2]))
print("  合计 %d 个作品" % len(rows))

print("\n=== work_language_tracks.lyrics 含转义方括号的轨 ===")
rows2 = psql(r"""SELECT work_id, lang, COALESCE(voice,'auto'),
       (SELECT count(*) FROM unnest(string_to_array(lyrics, E'\n')) ln WHERE ln ~ '\\[\[【]')
  FROM work_language_tracks WHERE lyrics ~ '\\[\[【]' ORDER BY 4 DESC""")
for r in rows2[:20]: print("  %s  %-6s %-10s %s 行" % (r[0][:8], r[1], r[2], r[3]))
print("  合计 %d 条轨" % len(rows2))
