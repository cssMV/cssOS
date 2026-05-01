#!/bin/bash
set -u
KEY=$(sudo grep "^KIE_API_KEY=" /etc/cssos.env | cut -d= -f2-)

echo "--- 1. POST /api/v1/generate with callBackUrl (instrumental, short) ---"
RESP=$(curl -sS -X POST https://api.kie.ai/api/v1/generate \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"a soft piano melody",
    "customMode":false,
    "instrumental":true,
    "model":"V4_5",
    "callBackUrl":"https://cssstudio.app/cssapi/v1/suno-callback"
  }' \
  --max-time 30)
echo "$RESP"
echo
TASK_ID=$(echo "$RESP" | python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('data', {}).get('taskId', ''))" 2>/dev/null)
echo "extracted taskId: $TASK_ID"
echo

if [ -n "$TASK_ID" ]; then
  echo "--- 2. immediately poll record-info ---"
  curl -sS "https://api.kie.ai/api/v1/generate/record-info?taskId=$TASK_ID" \
    -H "Authorization: Bearer $KEY" --max-time 10 -w "\nHTTP=%{http_code}\n" | python3 -m json.tool 2>/dev/null | head -60
  echo
  echo "--- 3. wait 30s and poll again ---"
  sleep 30
  curl -sS "https://api.kie.ai/api/v1/generate/record-info?taskId=$TASK_ID" \
    -H "Authorization: Bearer $KEY" --max-time 10 | python3 -m json.tool 2>/dev/null | head -80
fi
