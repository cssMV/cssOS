#!/usr/bin/env bash
# CSSOS_WAVE_200 20260516 — Jing: dmesg OOM detector cron.
#
# Runs every 2 minutes via cron. Pulls the kernel's last-5-min OOM
# kill records (from journalctl -k), compares against a state file
# of already-seen events, and on each NEW match:
#   1. Appends a structured JSONL line to /srv/cssos/shared/oom-events.jsonl
#   2. Emits a noisy [oom-detector] line to journalctl so anything
#      tailing it sees the spike immediately.
#   3. Captures a 1-line "what was running" snapshot from `ps` so we
#      can correlate which child OOM'd (Suno polling, Whisper align,
#      ffmpeg, video composer, etc.).
#
# Idempotency: state file stores the highest timestamp seen so far;
# only events strictly newer get reported. State file rolls when it
# grows past ~32 KB.
#
# This script is deliberately defensive — every step has a fallback
# so a kernel-log parse failure doesn't break the cron silently.

set -uo pipefail

SHARED_DIR="${CSSOS_SHARED_DIR:-/srv/cssos/shared}"
STATE_FILE="${SHARED_DIR}/oom-detector.state"
EVENTS_FILE="${SHARED_DIR}/oom-events.jsonl"

mkdir -p "$SHARED_DIR"
touch "$STATE_FILE" "$EVENTS_FILE"

LAST_SEEN_TS="$(cat "$STATE_FILE" 2>/dev/null | tail -1 | tr -d '[:space:]')"
[ -z "$LAST_SEEN_TS" ] && LAST_SEEN_TS=0

# Pull OOM-related kernel records from the last 10 minutes. We use
# `journalctl -k` because plain `dmesg` may not be readable without
# CAP_SYSLOG on some distros; journalctl is allowed for systemd-journal
# group members.
WINDOW="10 min ago"

# Match the canonical OOM-killer signatures (multiple kernels phrase
# this slightly differently — cover all common variants).
PATTERN='oom-kill|Out of memory|Killed process|invoked oom-killer|memory cgroup out of memory'

NEW_HIGHWATER="$LAST_SEEN_TS"
NEW_COUNT=0

# Read journalctl with epoch timestamps for stable comparison.
while IFS=$'\t' read -r ts_ms message; do
  [ -z "${ts_ms:-}" ] && continue
  # journalctl --output=short-unix gives "<unix>.<usec>"; convert to
  # millis for comparison without floats.
  ts_int="${ts_ms%%.*}"
  ts_int="${ts_int//[!0-9]/}"
  [ -z "$ts_int" ] && continue
  if [ "$ts_int" -le "$LAST_SEEN_TS" ]; then
    continue
  fi
  if [ "$ts_int" -gt "$NEW_HIGHWATER" ]; then
    NEW_HIGHWATER="$ts_int"
  fi
  NEW_COUNT=$((NEW_COUNT + 1))
  # Top 5 RSS-hungry node / ffmpeg processes for context (best-effort,
  # may be empty if the killer already harvested them).
  TOP_PROCS="$(ps -eo pid,rss,comm,args --sort=-rss 2>/dev/null \
                | awk 'NR<=6 {gsub(/"/,"\\\"",$0); print}' \
                | tr '\n' ';' | head -c 600)"
  # JSON-escape the message (basic): " and \ only.
  esc_msg="${message//\\/\\\\}"
  esc_msg="${esc_msg//\"/\\\"}"
  esc_top="${TOP_PROCS//\\/\\\\}"
  esc_top="${esc_top//\"/\\\"}"
  printf '{"ts":%s,"ts_iso":"%s","message":"%s","top_procs":"%s"}\n' \
    "$ts_int" \
    "$(date -u -d "@${ts_int}" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "")" \
    "$esc_msg" \
    "$esc_top" \
    >> "$EVENTS_FILE"
  logger -t cssos-oom-detector "[oom-detector] NEW oom kill: $message"
  echo "[oom-detector] NEW oom kill: $message" >&2
  # CSSOS_WAVE_202 — push to Slack / Discord / generic webhook / Resend
  # email so the alert reaches a phone within seconds, not the next
  # time someone tails journalctl. Alerter reads sinks from
  # /etc/cssstudio/cssstudio.env; missing ones are skipped silently.
  if [ -x /srv/cssos/bin/cssos-oom-alert.sh ]; then
    printf '{"ts":%s,"ts_iso":"%s","message":"%s","top_procs":"%s","host":"%s"}\n' \
      "$ts_int" \
      "$(date -u -d "@${ts_int}" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "")" \
      "$esc_msg" \
      "$esc_top" \
      "$(hostname -s 2>/dev/null || echo cssos)" \
      | /srv/cssos/bin/cssos-oom-alert.sh >/dev/null 2>&1 || true
  fi
done < <(
  journalctl -k --output=short-unix --since "$WINDOW" --no-pager 2>/dev/null \
    | grep -iE "$PATTERN" \
    | awk -F' ' '{ts=$1; $1=""; sub(/^[ \t]+/,""); print ts"\t"$0}' \
    || true
)

if [ "$NEW_COUNT" -gt 0 ]; then
  echo "$NEW_HIGHWATER" > "$STATE_FILE"
  # Trim events file to last 1000 lines so it doesn't grow unbounded.
  if [ "$(wc -l < "$EVENTS_FILE")" -gt 1000 ]; then
    tail -n 1000 "$EVENTS_FILE" > "${EVENTS_FILE}.tmp" && mv "${EVENTS_FILE}.tmp" "$EVENTS_FILE"
  fi
fi

exit 0
