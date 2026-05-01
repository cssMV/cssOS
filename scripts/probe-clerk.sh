#!/bin/bash
set -u
COOKIE=$(sudo grep "^SUNO_COOKIE=" /etc/cssos/suno-api.env | cut -d= -f2-)
echo "cookie len: ${#COOKIE}"
echo "---probe auth.suno.com---"
curl -sS -o /tmp/clerk-resp.txt \
  -w "HTTP=%{http_code} BYTES=%{size_download}\n" \
  "https://auth.suno.com/v1/client?__clerk_api_version=2025-11-10&_clerk_js_version=5.117.0" \
  -H "Cookie: $COOKIE" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/605.1.15" \
  --max-time 15
echo "--- response body (first 1000 chars) ---"
head -c 1000 /tmp/clerk-resp.txt
echo
echo "--- response status (parse json) ---"
python3 -c "import json; d=json.load(open('/tmp/clerk-resp.txt')); print('errors:', d.get('errors')); print('response keys:', list(d.get('response',{}).keys()) if d.get('response') else None); print('last_active_session_id:', d.get('response',{}).get('last_active_session_id') if d.get('response') else None); print('sessions count:', len(d.get('response',{}).get('sessions',[]) or []) if d.get('response') else 0)" 2>&1 | head -20
