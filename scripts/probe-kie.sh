#!/bin/bash
# Probe kie.ai Suno API to discover endpoint shape.
set -u
KEY=$(sudo grep "^KIE_API_KEY=" /etc/cssos.env | cut -d= -f2-)
echo "key len: ${#KEY}"

echo "--- 1. credit (already verified) ---"
curl -sS https://api.kie.ai/api/v1/chat/credit -H "Authorization: Bearer $KEY" --max-time 10
echo

echo "--- 2. POST /api/v1/generate with minimal payload ---"
curl -sS -X POST https://api.kie.ai/api/v1/generate \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a soft piano melody","customMode":false,"instrumental":true,"model":"V4_5"}' \
  --max-time 30 -w "\nHTTP=%{http_code}\n" | head -c 1000
echo

echo "--- 3. GET /api/v1/generate/record-info?taskId=fakeid ---"
curl -sS "https://api.kie.ai/api/v1/generate/record-info?taskId=fakeid_xxx" \
  -H "Authorization: Bearer $KEY" --max-time 10 -w "\nHTTP=%{http_code}\n" | head -c 600
echo

echo "--- 4. GET / for index/docs hint ---"
curl -sS https://api.kie.ai/ --max-time 10 -w "\nHTTP=%{http_code}\n" | head -c 400
