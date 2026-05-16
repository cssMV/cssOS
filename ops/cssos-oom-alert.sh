#!/usr/bin/env bash
# CSSOS_WAVE_202 20260516 — Jing: push OOM events to Slack / Discord /
# generic webhook / Resend email so I see them on my phone within seconds.
#
# Invoked by cssos-oom-detect.sh when a NEW OOM event is recorded.
# Receives the event details on stdin as one JSON line (same shape as
# the JSONL we write to /srv/cssos/shared/oom-events.jsonl).
#
# Reads alert sinks from /etc/cssstudio/cssstudio.env:
#   ADMIN_ALERT_SLACK_WEBHOOK   = https://hooks.slack.com/services/…
#   ADMIN_ALERT_DISCORD_WEBHOOK = https://discord.com/api/webhooks/…
#   ADMIN_ALERT_GENERIC_WEBHOOK = https://your.endpoint/…
#   RESEND_API_KEY              = re_…
#   ADMIN_EMAIL                 = me@example.com
#
# Any subset can be configured; missing ones are skipped silently.
# Every push is best-effort with a 6s curl timeout so a slow / dead
# webhook never blocks the next detector run.

set -uo pipefail

ENV_FILE="${CSSOS_ENV_FILE:-/etc/cssstudio/cssstudio.env}"
if [ -r "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

PAYLOAD="$(cat -)"
[ -z "$PAYLOAD" ] && exit 0

HOST="$(hostname -s 2>/dev/null || echo cssos)"
# Pull the human message out of the JSON (best-effort; fall back to
# the whole payload if jq isn't available or the line is malformed).
MSG="$(printf '%s' "$PAYLOAD" \
       | sed -nE 's/.*"message":"([^"]*)".*/\1/p' \
       | head -1)"
[ -z "$MSG" ] && MSG="$(printf '%s' "$PAYLOAD" | head -c 240)"
TOP="$(printf '%s' "$PAYLOAD" \
      | sed -nE 's/.*"top_procs":"([^"]*)".*/\1/p' \
      | head -1)"

ALERT_TITLE=":rotating_light: cssOS OOM kill on \`$HOST\`"
ALERT_TEXT="$MSG"
[ -n "$TOP" ] && ALERT_TEXT="$ALERT_TEXT

\`\`\`
top RSS at kill:
$TOP
\`\`\`"

CURL="curl -fsS --max-time 6"

# Slack — uses block kit minimal; falls back to plain text format too.
if [ -n "${ADMIN_ALERT_SLACK_WEBHOOK:-}" ]; then
  $CURL -X POST -H "content-type: application/json" \
    --data "$(printf '{"text":"%s\n%s"}' \
              "$(printf '%s' "$ALERT_TITLE" | sed 's/"/\\"/g')" \
              "$(printf '%s' "$ALERT_TEXT" | sed 's/"/\\"/g; s/$/\\n/' | tr -d '\n')")" \
    "$ADMIN_ALERT_SLACK_WEBHOOK" >/dev/null 2>&1 || true
fi

# Discord webhook.
if [ -n "${ADMIN_ALERT_DISCORD_WEBHOOK:-}" ]; then
  $CURL -X POST -H "content-type: application/json" \
    --data "$(printf '{"content":"%s\n%s"}' \
              "$(printf '%s' "$ALERT_TITLE" | sed 's/"/\\"/g')" \
              "$(printf '%s' "$ALERT_TEXT" | sed 's/"/\\"/g; s/$/\\n/' | tr -d '\n')")" \
    "$ADMIN_ALERT_DISCORD_WEBHOOK" >/dev/null 2>&1 || true
fi

# Generic webhook — sends the raw event JSON straight through so the
# user can wire it to Resend / IFTTT / Make / n8n / Zapier / their own
# bot for SMS, push, etc.
if [ -n "${ADMIN_ALERT_GENERIC_WEBHOOK:-}" ]; then
  $CURL -X POST -H "content-type: application/json" \
    --data "$PAYLOAD" \
    "$ADMIN_ALERT_GENERIC_WEBHOOK" >/dev/null 2>&1 || true
fi

# Resend email (HTTP API, no SMTP infra needed). Requires both
# RESEND_API_KEY and ADMIN_EMAIL to be set.
if [ -n "${RESEND_API_KEY:-}" ] && [ -n "${ADMIN_EMAIL:-}" ]; then
  # Escape backticks + double quotes for HTML rendering.
  HTML_MSG="$(printf '%s' "$ALERT_TEXT" | sed 's/"/\&quot;/g; s/</\&lt;/g; s/>/\&gt;/g; s/$/<br>/' | tr -d '\n')"
  $CURL -X POST "https://api.resend.com/emails" \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    -H "content-type: application/json" \
    --data "$(printf '{"from":"alerts@cssstudio.app","to":["%s"],"subject":"%s","html":"<b>%s</b><br><br>%s"}' \
              "$ADMIN_EMAIL" \
              "[cssOS OOM] $HOST" \
              "$(printf '%s' "$ALERT_TITLE" | sed 's/"/\&quot;/g')" \
              "$HTML_MSG")" \
    >/dev/null 2>&1 || true
fi

exit 0
