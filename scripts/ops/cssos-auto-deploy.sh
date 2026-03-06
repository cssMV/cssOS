#!/usr/bin/env bash
set -euo pipefail

SERVICES=(
  cssOS.service
  cssos-rust-api.service
  cssos-registry.service
)

for svc in "${SERVICES[@]}"; do
  if systemctl list-unit-files "$svc" >/dev/null 2>&1; then
    systemctl restart "$svc"
  fi
done

if systemctl list-unit-files nginx.service >/dev/null 2>&1; then
  systemctl reload nginx.service || true
fi
