#!/usr/bin/env bash
set -euo pipefail

API_BASE_LOCAL="${API_BASE_LOCAL:-http://127.0.0.1:8081}"
API_BASE_PUBLIC="${API_BASE_PUBLIC:-https://cssstudio.app}"

check() {
  local url="$1"
  local expect_ct="$2"
  echo "==> $url"
  local out
  out="$(curl -sS -D - -o /dev/null "$url")"
  local code
  code="$(printf '%s\n' "$out" | awk 'NR==1{print $2}')"
  local ctype
  ctype="$(printf '%s\n' "$out" | awk 'BEGIN{IGNORECASE=1}/^content-type:/{print $2; exit}' | tr -d '\r')"

  if [[ "$code" != "200" ]]; then
    echo "FAIL: expected HTTP 200, got $code"
    printf '%s\n' "$out"
    exit 1
  fi

  if [[ "$ctype" != *"$expect_ct"* ]]; then
    echo "FAIL: expected content-type containing '$expect_ct', got '$ctype'"
    printf '%s\n' "$out"
    exit 1
  fi

  echo "OK: HTTP $code, content-type=$ctype"
}

check "$API_BASE_LOCAL/cssapi/v1/openapi.json" "application/json"
check "$API_BASE_LOCAL/cssapi/v1/docs" "text/html"
check "$API_BASE_PUBLIC/cssapi/v1/openapi.json" "application/json"
check "$API_BASE_PUBLIC/cssapi/v1/docs" "text/html"

echo "All cssapi docs checks passed."
