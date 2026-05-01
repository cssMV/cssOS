#!/bin/bash
# Confirm kie.ai accepts the exact JSON payload our Rust adapter sends
# (customMode=true with lyrics+style+title+callBackUrl).
set -u
KEY=$(sudo grep "^KIE_API_KEY=" /etc/cssos.env | cut -d= -f2-)

echo "--- submit ---"
RESP=$(curl -sS -X POST https://api.kie.ai/api/v1/generate \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"a fierce battle anthem",
    "model":"V4_5",
    "customMode":true,
    "instrumental":false,
    "callBackUrl":"https://cssstudio.app/cssapi/v1/suno-callback",
    "style":"epic orchestral, choir, war drums",
    "tags":"epic orchestral, choir, war drums",
    "lyrics":"[Verse]\nSteel and shadow on the dawn\nThe oath we swore keeps us alive\n\n[Chorus]\nRise, rise, the mount remembers\nWe will not bend, we will not yield",
    "title":"Mount Hermon Test"
  }' \
  --max-time 30)
echo "$RESP"
echo

TASK_ID=$(echo "$RESP" | python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('data', {}).get('taskId', ''))" 2>/dev/null)
echo "taskId: $TASK_ID"
echo "$TASK_ID" > /tmp/kie_taskid.txt
