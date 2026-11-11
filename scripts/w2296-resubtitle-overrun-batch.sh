#!/usr/bin/env bash
# W2296 —— 把全库巡检判出的【唱词超出音频 / 假均匀 / 借用】逐版重做字幕。
#
# Jing 2026-11-11 明确 yes:「那 182 处跑起来吧」。
# 清单 = w2294-scan-real-vs-placeholder.py 的真问题, 剔掉了占位音假警报, 不含 BLANK_1。
#
# ── 为什么现在重做才有意义 ───────────────────────────────────────────────
# W2295 之前重做是【白跑】: 三个对齐器一个都不把结果夹回音频长度, 重跑得到一模一样的
# 越界时间轴(《Ἀθηνᾶ》en♪1 实测 283.0s → 重做还是 283.0s)。clamp 上线后同一个版本
# 变成 240.0s, 7/7 修好、平台巡检复判 0 问题 —— 所以这一批才跑。
#
# ── 两条不许破的 ────────────────────────────────────────────────────────
# 1 全程 snap=1: 只写【这一版自己的】快照, 作品级那份一个字节不碰。
#   作品级那份往往正是 orig 轨在读的【旧情绪字幕】—— Jing:「不要再重新制作字幕,
#   旧版的情绪字幕很好。请保留。」每首动手前记它的 sha256, 动完逐首比;
#   一旦变了 → 硬停, 不是继续。
# 2 不碰任何音频列、不碰 user_works、不花厂商钱(对齐走自建 whisperX/MMS)。
#
# 每一版做完当场验: 键 = sha1(它自己那段音频)[:10] · 字幕取得到且是合法 JSON ·
# 【本轨那门语言那一条】的末尾 ≤ 实测时长 + 3s(整份取 max 会指错人, 见 W2293)。
# 「取不到 / 判不了」单列计数, 不混进「成功」也不混进「失败」。
#
# 用法: DATABASE_URL=... bash w2296-resubtitle-overrun-batch.sh <manifest.tsv> [--apply]
#   清单每行: work_id \t lang \t voice \t take \t kind \t title
set -u
MAN="${1:?要清单文件}"
APPLY=0; case " $* " in *" --apply "*) APPLY=1;; esac
: "${DATABASE_URL:?没有 DATABASE_URL}"
TOK=$(grep -m1 '^CSSOS_ADMIN_TOKEN=' /etc/cssos.env | cut -d= -f2- | tr -d '"')
[ -n "$TOK" ] || { echo "FAIL 没有 CSSOS_ADMIN_TOKEN —— 停手"; exit 2; }
API=http://127.0.0.1:3000
UA='Mozilla/5.0 (Macintosh) cssos-audit'
HERE="$(cd "$(dirname "$0")" && pwd)"
PL="$HERE/w2296-perlang-end.py"
[ -f "$PL" ] || { echo "FAIL 少了 $PL —— 判不了, 停手"; exit 2; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
WLDIR="$T/wl"; mkdir -p "$WLDIR"
LOG=/tmp/w2296-done.tsv; BADL=/tmp/w2296-bad.tsv
: > "$LOG"; : > "$BADL"
q() { psql "$DATABASE_URL" -X -q -t -A -c "$1"; }

# 这首作品级字幕的 sha256: 第一次见它就记下来, 之后每次比对
worklevel_sha() {
  local wid=$1 f="$WLDIR/$wid.sha" u
  u=$(q "SELECT coalesce(subtitle_take1_json_url,'') FROM user_works WHERE id='$wid'::uuid;")
  [ -n "$u" ] || { printf '(无)'; return; }
  local tmpf="$T/wl.json" code
  code=$(curl -s -A "$UA" -o "$tmpf" -w '%{http_code}' -m 60 "$u" || echo 000)
  [ "$code" = 200 ] || { printf '(HTTP %s)' "$code"; return; }
  sha256sum "$tmpf" | cut -d' ' -f1
}

plan=$(grep -c . "$MAN" || true)
echo "清单 $plan 处 · 涉及 $(cut -f1 "$MAN" | sort -u | grep -c .) 个作品 · APPLY=$APPLY"
n=0; okn=0; failn=0; unk=0; skipn=0; streak=0

while IFS=$'\t' read -r wid lang voice take kind title; do
  [ -n "${wid:-}" ] || continue
  n=$((n+1))
  printf '[%d/%d] %s  %s/%s ♪%s  %s  %s\n' "$n" "$plan" "${wid:0:8}" "$lang" "$voice" "$take" "$kind" "${title:0:34}"

  # 这一版的音频与实测时长
  if [ "$take" = 1 ]; then col=audio_url; else col=alt_audio_url; fi
  au=$(q "SELECT coalesce($col,'') FROM work_language_tracks
           WHERE work_id='$wid'::uuid AND lang='$lang' AND coalesce(voice,'auto')='$voice' LIMIT 1;")
  if [ -z "$au" ]; then
    # ♪3/♪4 不在轨那两列上, 走版本行(按 url 配, 不按 lang 配 —— W2145)
    au=$(q "SELECT url FROM work_media_versions WHERE work_id='$wid'::uuid AND kind='audio'
             ORDER BY id OFFSET $((take-1)) LIMIT 1;")
  fi
  if [ -z "$au" ]; then
    echo "        ⚠ 取不到这一版的音频地址 —— 判不了, 不动"
    printf '%s\t%s\t%s\t%s\t取不到音频\n' "$wid" "$lang" "$voice" "$take" >>"$BADL"
    unk=$((unk+1)); continue
  fi
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$au" 2>/dev/null | awk '{printf "%d", $1+0.5}')
  if [ -z "${dur:-}" ] || [ "${dur:-0}" -le 0 ]; then
    echo "        ⚠ ffprobe 量不到这段音频 —— 判不了, 不动(clamp 也会因此不夹)"
    printf '%s\t%s\t%s\t%s\t时长量不到\n' "$wid" "$lang" "$voice" "$take" >>"$BADL"
    unk=$((unk+1)); continue
  fi

  # dry: 它会挑哪一版、会写哪条版本行
  dry=$(curl -s -m 120 -X POST -H "x-admin-token: $TOK" \
         "$API/api/admin/resubtitle/$wid?lang=$lang&voice=$voice&take=$take&snap=1&dry=1")
  vrow=$(printf '%s' "$dry" | grep -o '"would_write_version_row":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -z "$vrow" ]; then
    echo "        SKIP dry 没说会写哪条版本行 —— 没有落脚处, 不猜"
    printf '%s\t%s\t%s\t%s\t无版本行\t%s\n' "$wid" "$lang" "$voice" "$take" "$(printf '%s' "$dry" | head -c 160)" >>"$BADL"
    skipn=$((skipn+1)); continue
  fi
  if [ "$APPLY" = 0 ]; then echo "        [干跑] 音频 ${dur}s · 会写版本行 $vrow"; okn=$((okn+1)); continue; fi

  # 动手前: 这首作品级字幕的字节指纹
  shaf="$WLDIR/$wid.sha"
  [ -f "$shaf" ] || worklevel_sha "$wid" > "$shaf"
  before=$(cat "$shaf")

  out=$(curl -s -m 1200 -X POST -H "x-admin-token: $TOK" \
         "$API/api/admin/resubtitle/$wid?lang=$lang&voice=$voice&take=$take&snap=1")
  if ! printf '%s' "$out" | grep -q '"ok":true'; then
    echo "        FAIL 接口没回 ok:true: $(printf '%s' "$out" | head -c 170)"
    printf '%s\t%s\t%s\t%s\t接口失败\t%s\n' "$wid" "$lang" "$voice" "$take" "$(printf '%s' "$out" | head -c 150)" >>"$BADL"
    failn=$((failn+1)); streak=$((streak+1))
    [ "$streak" -ge 5 ] && { echo "!!! 连续 5 个失败 —— 停手, 不要空跑完整批"; break; }
    continue
  fi
  cl=$(printf '%s' "$out" | grep -o '"clamp":{[^}]*}' | head -1)

  # 验: 键 + 取得到 + 本语言末尾在界内
  vs=$(q "SELECT coalesce(subtitle_url,'') FROM work_media_versions
           WHERE work_id='$wid'::uuid AND kind='audio' AND url='$au' LIMIT 1;")
  k=$(printf '%s' "$au" | sha1sum | cut -c1-10)
  bad=""
  case "$vs" in
    '') bad="版本行上没有字幕";;
    *"--a$k".json) ;;
    *) bad="键不是这段音频的";;
  esac
  end="?"
  if [ -z "$bad" ]; then
    code=$(curl -s -A "$UA" -o "$T/new.json" -w '%{http_code}' -m 60 "$vs" || echo 000)
    if [ "$code" != 200 ]; then bad="字幕 HTTP $code(判不了)"
    else
      end=$(python3 -I "$PL" "$T/new.json" "$lang" 2>/dev/null || echo "?")
      if [ "$end" = "?" ]; then bad="取不到本语言的时间轴(判不了)"
      elif [ "$(python3 -c "print(1 if $end > $dur + 3 else 0)")" = 1 ]; then bad="仍越界 ${end}s > ${dur}s"; fi
    fi
  fi

  # 作品级那份必须纹丝不动
  after=$(worklevel_sha "$wid")
  if [ "$after" != "$before" ]; then
    echo "        ‼ 作品级字幕的字节变了! ${before:0:16} → ${after:0:16} —— 硬停"
    printf '%s\t%s\t%s\t%s\t作品级被改动\n' "$wid" "$lang" "$voice" "$take" >>"$BADL"
    failn=$((failn+1)); break
  fi

  if [ -n "$bad" ]; then
    echo "        ⚠ $bad   $cl"
    printf '%s\t%s\t%s\t%s\t%s\n' "$wid" "$lang" "$voice" "$take" "$bad" >>"$BADL"
    case "$bad" in *判不了*) unk=$((unk+1));; *) failn=$((failn+1)); streak=$((streak+1));; esac
    [ "$streak" -ge 5 ] && { echo "!!! 连续 5 个失败 —— 停手"; break; }
  else
    echo "        ✅ 字幕末 ${end}s ≤ 音频 ${dur}s   $cl"
    printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$wid" "$lang" "$voice" "$take" "$end" "$dur" >>"$LOG"
    okn=$((okn+1)); streak=0
  fi
done < "$MAN"

echo
echo "汇总: 清单 $plan · 实际过 $n · 做成 $okn · 失败 $failn · 判不了 $unk · 跳过 $skipn"
[ "$failn" -gt 0 ] || [ "$unk" -gt 0 ] || [ "$skipn" -gt 0 ] && echo "      没过的清单: $BADL"
if [ "$n" != "$plan" ]; then echo "⚠ 清单 $plan 但只过了 $n —— 中途停了, 不是跑完"; exit 1; fi
[ "$failn" = 0 ] || exit 1
