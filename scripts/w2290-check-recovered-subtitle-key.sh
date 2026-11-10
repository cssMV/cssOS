#!/usr/bin/env bash
# 救回的那几首, 轨挂的字幕是不是【按它自己这段音频寻址】的那一份?
# 平台约定: 快照键 = sha1(audio_url) 前 10 位 → subtitle-take1--a<key>.json
# 这一条必须查: 还原那一刻轨指向占位音, 字幕流程可能把快照按【占位音】的 URL 落了键。
set -u
set -a; . /etc/cssos.env; set +a
ids=$(awk '/^=== \[/{gsub(/^=== \[[0-9]+\] /,"");split($0,a," ");w=a[1]} /FAIL 验收不过: 成品只有 0s/{print w}' /tmp/w2290-batch.log | sort -u)
bad=0; n=0
for w in $ids; do
  n=$((n+1))
  row=$(psql "$DATABASE_URL" -X -q -t -A -F$'\t' -c "
    SELECT left(w.title,20), coalesce(t.audio_url,''), coalesce(t.subtitle_url,''),
           coalesce(b.old_audio_url,'')
      FROM work_language_tracks t JOIN user_works w ON w.id=t.work_id
      LEFT JOIN (SELECT * FROM w2285_placeholder_backup) b ON b.track_id=t.id
     WHERE t.work_id='$w'::uuid AND t.is_default LIMIT 1;")
  IFS=$'\t' read -r title au sub oau <<<"$row"
  k_new=$(printf '%s' "$au"  | sha1sum | cut -c1-10)
  k_old=$(printf '%s' "$oau" | sha1sum | cut -c1-10)
  case "$sub" in
    *"--a$k_new".json) v="✅ 按它自己的音频寻址";;
    *"--a$k_old".json) v="⚠ 这一份是按【占位音】寻址的 —— 音画对不上"; bad=$((bad+1));;
    "")               v="⚠ 空(回退作品级)"; bad=$((bad+1));;
    *subtitle-take1.json) v="⚠ 作品级那一份, 不是自己的快照"; bad=$((bad+1));;
    *)                v="判不了: ${sub: -32}"; bad=$((bad+1));;
  esac
  printf '%-22s %s\n' "$title" "$v"
done
echo
echo "清单 $(echo $ids | wc -w) 首 · 实际核对 $n 首 · 不合格 $bad"
[ "$n" = "$(echo $ids | wc -w)" ] || { echo "FAIL 核对数与清单不符 —— 上面的数不要信"; exit 1; }
exit $([ "$bad" = 0 ] && echo 0 || echo 1)
