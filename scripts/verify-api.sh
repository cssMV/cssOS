#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-https://cssstudio.app}

curl -sk "$BASE_URL/api/auth/providers" | head -n 120
curl -sk "$BASE_URL/api/me" | head -n 60
curl -sk "$BASE_URL/api/billing/status" | head -n 200
curl -sk -X POST "$BASE_URL/api/billing/usage" | head -n 200
