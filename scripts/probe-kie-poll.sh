#!/bin/bash
set -u
KEY=$(sudo grep "^KIE_API_KEY=" /etc/cssos.env | cut -d= -f2-)
TASK_ID=$(cat /tmp/kie_taskid.txt)
echo "polling taskId=$TASK_ID"

for i in $(seq 1 30); do
  RESP=$(curl -sS "https://api.kie.ai/api/v1/generate/record-info?taskId=$TASK_ID" \
    -H "Authorization: Bearer $KEY" --max-time 10)
  STATUS=$(echo "$RESP" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('data',{}).get('status',''))" 2>/dev/null)
  echo "[$i] status=$STATUS"
  if [ "$STATUS" = "SUCCESS" ] || [ "$STATUS" = "FIRST_SUCCESS" ]; then
    echo "$RESP" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
clips = d.get('data', {}).get('response', {}).get('sunoData', [])
print('clips:', len(clips))
for i, c in enumerate(clips):
    print(f'  clip[{i}] audioUrl={c.get(\"audioUrl\",\"\")[:80]}')
    print(f'           streamAudioUrl={c.get(\"streamAudioUrl\",\"\")[:80]}')
    print(f'           duration={c.get(\"duration\")} title={c.get(\"title\")}')
"
    break
  fi
  if [[ "$STATUS" == *"FAILED"* ]] || [[ "$STATUS" == *"ERROR"* ]]; then
    echo "FAILED:"
    echo "$RESP"
    exit 1
  fi
  sleep 12
done
