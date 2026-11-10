#!/usr/bin/env bash
# W2289 —— 给三首【同语言三条轨共用一份字幕】的作品做成「一版一份字幕」。
#
# Jing 2026-11-09 明确 yes:「给《桃花仙》《举杯邀月》《春风得意》的 zh 三条轨
# (orig / auto / pre-epic)各自按它自己的音频重做一次字幕对齐 …… 只动字幕,
# 不碰任何音频字节。」
#
# ── 现状(实测, 不是推断)─────────────────────────────────────────────────
# 每首 3 条 zh 轨, 但【只有 2 个不同音频】—— pre-epic 与 auto 共用同一个 audio_url
# (这正是 W2086 宪法说「必须能被自动发现并报警」的那种情形, 顺带这两条标的时长还不一样)。
#   orig(默认, 197-208s)  subtitle_url → 【作品级】 subtitle-take1.json
#   auto(328-514s)        subtitle_url 空 → 回退到同一份作品级文件
#   pre-epic(failed)      subtitle_url 空 → 同上
# 于是三条解析到同一份字幕, 而它是按 orig 对齐的 —— auto 那条的音画必然错位。
#
# ── 做法: 两步, 而且【只有该做的那一条才真对齐】────────────────────────
# A. auto 那个音频: 真做一次对齐, 走 ?voice=auto&take=1&snap=1
#    · snap=1 是 W2289 新加的开关 —— 没有它, take=1 会连作品级那份一起重写,
#      而作品级正是 orig 在读、Jing 要求保留的旧情绪字幕。
#    · 落地的快照键是 sha1(audio_url)[:10], 而 pre-epic 共用这个 URL,
#      所以 upsertSubtitleJson 那句按 audio_url 匹配的 UPDATE 会把【两条一起挂上】。
# B. orig 那个音频: 【不重做】, 把现成的作品级文件复制成按它自己音频寻址的快照,
#    再把 orig 的 subtitle_url 指过去。
#    为什么不重做: Jing「不要再重新制作字幕，旧版的情绪字幕很好。请保留。」
#    那一份本来就是按 orig 对齐的, 重做只会换掉一份好东西。复制 = 给它一个
#    不会再被别人覆盖的永久地址(版本铁律: 一版一份自己的 subtitle_url)。
#
# 全程不写任何音频列, 不动 user_works.subtitle_take1_json_url, 作品级文件字节不变
# —— 这三条都在跑完后逐首核对。
#
# 用法(api-vm): bash w2289-per-version-subtitle-3works.sh            # 干跑
#               bash w2289-per-version-subtitle-3works.sh --apply
set -u
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
DB=$(grep -m1 '^DATABASE_URL=' /etc/cssos.env | cut -d= -f2- | tr -d '"')
TOK=$(grep -m1 '^CSSOS_ADMIN_TOKEN=' /etc/cssos.env | cut -d= -f2- | tr -d '"')
[ -n "$DB" ] || { echo "FAIL 没有 DATABASE_URL —— 判不了, 停手"; exit 2; }
[ -n "$TOK" ] || { echo "FAIL 没有 CSSOS_ADMIN_TOKEN —— 判不了, 停手"; exit 2; }
API=http://127.0.0.1:3000
CUR=$(readlink -f /srv/cssos/current)

# r2putkey.mjs 要 R2 的四个环境变量, 它自己不读 /etc/cssos.env。
# 首版没给, 于是它抛 S3 错误、stdout 空; 而我那句又带着 `2>/dev/null`,
# 把真错误整个吞掉, 只剩一句没有信息量的「FAIL 推 R2:」—— 和我今天刚修的
# W2286 静默分支是同一个毛病, 这次犯在自己脚本里。不吞错, 并把变量喂给它。
set -a
eval "$(grep -E '^(R2_ACCOUNT_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_BUCKET)=' /etc/cssos.env)"
set +a
for v in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET; do
  eval "[ -n \"\${$v:-}\" ]" || { echo "FAIL /etc/cssos.env 里没有 $v —— 判不了, 停手"; exit 2; }
done
TMP=/tmp/w2289; mkdir -p "$TMP"
q() { psql "$DB" -X -q -t -A -c "$1"; }

WORKS="5e048ee6 96174092 f10f71c5"
ok_n=0; fail_n=0

for pre in $WORKS; do
  wid=$(q "SELECT id::text FROM user_works WHERE id::text LIKE '$pre%';")
  # ⚠ 别用 `wc -l` 数行 —— 它数的是【换行符】, 单行且无尾换行时得 0 而不是 1。
  #   首版就是这么写的, 三首全被判成「匹配到 0 个」。好在它错在安全那一侧(拒绝动手)。
  nhit=$(printf '%s' "$wid" | grep -c . || true)
  [ "$nhit" = "1" ] || { echo "FAIL $pre 匹配到 $nhit 个作品 —— 不猜"; fail_n=$((fail_n+1)); continue; }
  title=$(q "SELECT left(coalesce(title,''),26) FROM user_works WHERE id='$wid'::uuid;")
  echo "=== $pre  $title"

  # 作品级文件的【动手前字节指纹】—— 收尾时必须一字不变
  wlvl=$(q "SELECT coalesce(subtitle_take1_json_url,'') FROM user_works WHERE id='$wid'::uuid;")
  [ -n "$wlvl" ] || { echo "   FAIL 作品级字幕地址为空 —— 判不了, 跳过"; fail_n=$((fail_n+1)); continue; }
  curl -s -m 60 -o "$TMP/$pre.before.json" "$wlvl" || true
  before=$(sha1sum "$TMP/$pre.before.json" | cut -c1-16)
  bsz=$(stat -c %s "$TMP/$pre.before.json")
  echo "   作品级字幕 $bsz 字节 sha=$before"
  [ "$bsz" -gt 500 ] || { echo "   FAIL 作品级字幕取不到或太小 —— 判不了, 跳过"; fail_n=$((fail_n+1)); continue; }

  au_auto=$(q "SELECT coalesce(audio_url,'') FROM work_language_tracks WHERE work_id='$wid'::uuid AND lang='zh' AND voice='auto';")
  au_orig=$(q "SELECT coalesce(audio_url,'') FROM work_language_tracks WHERE work_id='$wid'::uuid AND lang='zh' AND voice='orig';")
  [ -n "$au_auto" ] && [ -n "$au_orig" ] || { echo "   FAIL auto/orig 音频取不全 —— 跳过"; fail_n=$((fail_n+1)); continue; }
  [ "$au_auto" != "$au_orig" ] || { echo "   FAIL auto 与 orig 居然同一个音频 —— 那是另一个问题, 停手"; fail_n=$((fail_n+1)); continue; }
  echo "   auto 音频 …${au_auto: -26}"
  echo "   orig 音频 …${au_orig: -26}"

  # ── A: auto 那个音频真做一次对齐(只写快照)────────────────────────────
  # 可重跑: auto 已经挂上【自己的】快照(不是作品级那一份)就跳过 ——
  # 重跑一次对齐不花钱, 但白等几分钟, 而且没有任何收益。
  sub_auto=$(q "SELECT coalesce(subtitle_url,'') FROM work_language_tracks WHERE work_id='$wid'::uuid AND lang='zh' AND voice='auto';")
  tag_auto=$(printf '%s' "$au_auto" | sha1sum | cut -c1-10)
  want_auto="https://cdn.cssstudio.app/works/$wid/subtitle-take1--a$tag_auto.json"
  if [ "$sub_auto" = "$want_auto" ]; then
    echo "   [A] auto 已挂自己的快照, 跳过对齐 …${want_auto: -26}"
  else
  echo "   [A] 对齐 auto 的音频 (voice=auto take=1 snap=1)"
  if [ "$APPLY" = "1" ]; then
    r=$(curl -s -m 1200 -X POST "$API/api/admin/resubtitle/$wid?lang=zh&voice=auto&take=1&snap=1" \
          -H "x-admin-token: $TOK")
  else
    r=$(curl -s -m 180 -X POST "$API/api/admin/resubtitle/$wid?lang=zh&voice=auto&take=1&snap=1&dry=1" \
          -H "x-admin-token: $TOK")
  fi
  echo "       ${r:0:260}"
  case "$r" in *'"ok":true'*) ;; *) echo "   FAIL A 没成 —— 停这一首"; fail_n=$((fail_n+1)); continue;; esac
  fi

  # ── B: orig 那份【复制】成自己的快照(不重做)──────────────────────────
  tag=$(printf '%s' "$au_orig" | sha1sum | cut -c1-10)
  key="works/$wid/subtitle-take1--a$tag.json"
  url="https://cdn.cssstudio.app/$key"
  echo "   [B] orig 快照 $key"
  if [ "$(curl -s -o "$TMP/$pre.exists.json" -w '%{http_code}' "$url")" = "200" ]; then
    if cmp -s "$TMP/$pre.exists.json" "$TMP/$pre.before.json"; then
      echo "       已存在且与作品级字节完全相同 —— 幂等, 接受"
    else
      echo "       FAIL 已存在但字节不同 —— 不覆盖, 停这一首"; fail_n=$((fail_n+1)); continue
    fi
  elif [ "$APPLY" = "1" ]; then
    put=$( cd "$CUR" && node r2putkey.mjs "$TMP/$pre.before.json" "$key" "application/json" 2>&1 )
    case "$put" in
      *'"ok":true'*) ;;
      *) echo "       FAIL 推 R2:"; printf '%s\n' "$put" | tail -4 | sed 's/^/           /'
         fail_n=$((fail_n+1)); continue;;
    esac
    [ "$(curl -s -o /dev/null -w '%{http_code}' "$url")" = "200" ] || { echo "       FAIL 推完 CDN 取不到"; fail_n=$((fail_n+1)); continue; }
    echo "       已复制(字节与作品级一致)"
  else
    echo "       [干跑] 会把作品级那 $bsz 字节复制到这个键"
  fi

  if [ "$APPLY" = "1" ]; then
    # 只在【当前仍指着作品级那一份】时才改 —— 别人动过就不碰
    q "UPDATE work_language_tracks SET subtitle_url='$url', updated_at=now()
        WHERE work_id='$wid'::uuid AND lang='zh' AND voice='orig'
          AND coalesce(subtitle_url,'') = '$wlvl';" >/dev/null
    back=$(q "SELECT coalesce(subtitle_url,'(空)') FROM work_language_tracks WHERE work_id='$wid'::uuid AND lang='zh' AND voice='orig';")
    [ "$back" = "$url" ] || { echo "       FAIL 回读 orig 的 subtitle_url 是 $back"; fail_n=$((fail_n+1)); continue; }
    echo "       orig 的 subtitle_url 已指向自己的快照"
  fi

  # ── 收尾核对: 作品级文件必须一字节未变 ───────────────────────────────
  curl -s -m 60 -o "$TMP/$pre.after.json" "$wlvl" || true
  after=$(sha1sum "$TMP/$pre.after.json" | cut -c1-16)
  if [ "$after" != "$before" ]; then
    echo "   FAIL 作品级字幕被改了($before → $after)——【这是最该防住的事】"
    fail_n=$((fail_n+1)); continue
  fi
  echo "   作品级字幕字节未变 ✓"
  ok_n=$((ok_n+1))
done

echo
echo "汇总: 清单 3 · 过 $ok_n · 不过 $fail_n$([ "$APPLY" = 1 ] || echo '  [干跑]')"
[ $((ok_n + fail_n)) -eq 3 ] || { echo "FAIL 账对不上"; exit 1; }
exit $([ "$fail_n" -gt 0 ] && echo 1 || echo 0)
