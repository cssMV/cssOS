#!/bin/bash
set -u
KEY=$(sudo grep "^KIE_API_KEY=" /etc/cssos.env | cut -d= -f2-)
TASK_ID="${1:-889162b94e8d6fb0f96051ced8dfd8bf}"
echo "querying kie.ai taskId=$TASK_ID"
curl -sS "https://api.kie.ai/api/v1/generate/record-info?taskId=$TASK_ID" \
  -H "Authorization: Bearer $KEY" --max-time 15 \
  | python3 -m json.tool 2>/dev/null | head -100
