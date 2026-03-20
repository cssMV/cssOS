#!/usr/bin/env bash
set -euo pipefail

ZH_HOST="${ZH_HOST:-zh.cssstudio.app}"
ZH_URL="${ZH_URL:-https://${ZH_HOST}}"
ATTEMPTS="${ATTEMPTS:-12}"
CONNECT_TIMEOUT="${CONNECT_TIMEOUT:-5}"
MAX_TIME="${MAX_TIME:-15}"
PUBLIC_ONLY="${PUBLIC_ONLY:-0}"
MIN_TLS_SUCCESS_RATE="${MIN_TLS_SUCCESS_RATE:-0}"
MIN_HTTP_SUCCESS_RATE="${MIN_HTTP_SUCCESS_RATE:-0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ARTIFACT_DIR="${ARTIFACT_DIR:-${REPO_ROOT}/artifacts/zh-probe}"
PUBLIC_OPS_DIR="${PUBLIC_OPS_DIR:-${REPO_ROOT}/public/ops}"
TS_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

TMP_DIR="$(mktemp -d)"
RESULTS_TSV="${TMP_DIR}/zh-probe-results.tsv"
METADATA_JSON="${TMP_DIR}/zh-probe-metadata.json"
trap 'rm -rf "${TMP_DIR}"' EXIT

worker_script='
set -euo pipefail
label="$1"
url="$2"
resolve="$3"
attempts="$4"
connect_timeout="$5"
max_time="$6"

tls_success=0
http_success=0
reset_count=0
latency_total_ms_sum=0
latency_connect_ms_sum=0
latency_samples=0
http_code_200=0
http_code_301=0
http_code_000=0
http_code_other=0
sample_note=""

for i in $(seq 1 "$attempts"); do
  if [ -n "$resolve" ]; then
    out="$(curl -vkI --connect-timeout "$connect_timeout" --max-time "$max_time" --resolve "$resolve" -k "$url" -o /dev/null -w "__CSSOS_TIMING__ total=%{time_total} connect=%{time_connect} code=%{http_code}" 2>&1 || true)"
  else
    out="$(curl -vkI --connect-timeout "$connect_timeout" --max-time "$max_time" "$url" -o /dev/null -w "__CSSOS_TIMING__ total=%{time_total} connect=%{time_connect} code=%{http_code}" 2>&1 || true)"
  fi

  case "$out" in
    *"SSL connection using"*|*"Server certificate:"*)
      tls_success=$((tls_success + 1))
      ;;
  esac

  case "$out" in
    *"< HTTP/"*|*"HTTP/1.1 200"*|*"HTTP/2 200"*|*"HTTP/1.1 301"*|*"HTTP/2 301"*)
      http_success=$((http_success + 1))
      ;;
  esac

  case "$out" in
    *"Connection reset by peer"*|*"Recv failure"*|*"write:errno=54"*|*"write:errno=104"*)
      reset_count=$((reset_count + 1))
      ;;
  esac

  timing_line="$(printf "%s\n" "$out" | grep "__CSSOS_TIMING__" | tail -n 1 || true)"
  total_seconds="$(printf "%s\n" "$timing_line" | sed -n "s/.*total=\\([0-9.]*\\).*/\\1/p")"
  connect_seconds="$(printf "%s\n" "$timing_line" | sed -n "s/.*connect=\\([0-9.]*\\).*/\\1/p")"
  http_code="$(printf "%s\n" "$timing_line" | sed -n "s/.*code=\\([0-9][0-9][0-9]\\).*/\\1/p")"
  if [ -n "$total_seconds" ] && [ -n "$connect_seconds" ]; then
    total_ms="$(python3 - <<PY
import math
print(int(round(float("$total_seconds") * 1000)))
PY
)"
    connect_ms="$(python3 - <<PY
import math
print(int(round(float("$connect_seconds") * 1000)))
PY
)"
    latency_total_ms_sum=$((latency_total_ms_sum + total_ms))
    latency_connect_ms_sum=$((latency_connect_ms_sum + connect_ms))
    latency_samples=$((latency_samples + 1))
  fi
  case "$http_code" in
    200) http_code_200=$((http_code_200 + 1)) ;;
    301) http_code_301=$((http_code_301 + 1)) ;;
    000) http_code_000=$((http_code_000 + 1)) ;;
    "") ;;
    *) http_code_other=$((http_code_other + 1)) ;;
  esac

  sample_note="$(printf "%s\n" "$out" | tail -n 3 | tr "\r\t\n" "   " | sed "s/[[:space:]]\\+/ /g")"
done

avg_total_ms=0
avg_connect_ms=0
if [ "$latency_samples" -gt 0 ]; then
  avg_total_ms=$((latency_total_ms_sum / latency_samples))
  avg_connect_ms=$((latency_connect_ms_sum / latency_samples))
fi

printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
  "$label" \
  "$tls_success" \
  "$http_success" \
  "$reset_count" \
  "$attempts" \
  "$avg_total_ms" \
  "$avg_connect_ms" \
  "$http_code_200" \
  "$http_code_301" \
  "$http_code_000" \
  "$http_code_other" \
  "$sample_note"
'

append_result() {
  printf "%s\n" "$1" >> "${RESULTS_TSV}"
}

run_local_probe() {
  local label="$1"
  local url="$2"
  local resolve="${3:-}"
  local line
  line="$(bash -s -- "$label" "$url" "$resolve" "$ATTEMPTS" "$CONNECT_TIMEOUT" "$MAX_TIME" <<<"${worker_script}")"
  append_result "$line"
}

run_remote_probe() {
  local alias="$1"
  local ssh_opts="${2:-}"
  local label="$3"
  local url="$4"
  local resolve="${5:-}"
  local ssh_cmd=(ssh)

  if [[ -n "$ssh_opts" ]]; then
    # shellcheck disable=SC2206
    local extra_opts=($ssh_opts)
    ssh_cmd+=("${extra_opts[@]}")
  fi
  ssh_cmd+=("$alias")

  if ! "${ssh_cmd[@]}" "command -v bash >/dev/null 2>&1 && command -v curl >/dev/null 2>&1" >/dev/null 2>&1; then
    append_result "$(printf "%s\t0\t0\t0\t%s\t0\t0\t0\t0\t%s\t0\t%s" "$label" "$ATTEMPTS" "0" "probe skipped: ssh target unavailable")"
    return 0
  fi

  local line
  line="$("${ssh_cmd[@]}" "bash -s -- '$label' '$url' '$resolve' '$ATTEMPTS' '$CONNECT_TIMEOUT' '$MAX_TIME'" <<<"${worker_script}")"
  append_result "$line"
}

capture_metadata() {
  local api_vm_reachable="unknown"
  local gzvm_reachable="unknown"
  local gzvm_nginx_status="unknown"
  local gzvm_cssos_status="unknown"
  local gzvm_cert_not_after=""

  if [[ "${PUBLIC_ONLY}" != "1" ]]; then
    if ssh api-vm "command -v bash >/dev/null 2>&1" >/dev/null 2>&1; then
      api_vm_reachable="reachable"
    else
      api_vm_reachable="unreachable"
    fi

    if ssh -o RemoteCommand=none -T gzvm "command -v bash >/dev/null 2>&1" >/dev/null 2>&1; then
      gzvm_reachable="reachable"
      gzvm_nginx_status="$(
        ssh -o RemoteCommand=none -T gzvm "systemctl is-active nginx 2>/dev/null || echo unknown" 2>/dev/null \
          | tail -n 1 | tr -d '\r'
      )"
      gzvm_cssos_status="$(
        ssh -o RemoteCommand=none -T gzvm 'if command -v pm2 >/dev/null 2>&1; then pid="$(pm2 pid cssos 2>/dev/null | head -n 1 | tr -d '"'"'"'"'"'"'"'"'[:space:]'"'"'"'"'"'"'"'"')"; if [ -n "$pid" ] && [ "$pid" != "0" ]; then echo online; else echo stopped; fi; else echo unknown; fi' 2>/dev/null \
          | tail -n 1 | tr -d '\r'
      )"
      gzvm_cert_not_after="$(
        ssh -o RemoteCommand=none -T gzvm "if command -v openssl >/dev/null 2>&1; then echo | openssl s_client -servername ${ZH_HOST} -connect ${ZH_HOST}:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | sed 's/notAfter=//'; else echo unknown; fi" 2>/dev/null \
          | tail -n 1 | tr -d '\r'
      )"
    else
      gzvm_reachable="unreachable"
    fi
  fi

  API_VM_REACHABLE="${api_vm_reachable}" \
  GZVM_REACHABLE="${gzvm_reachable}" \
  GZVM_NGINX_STATUS="${gzvm_nginx_status}" \
  GZVM_CSSOS_STATUS="${gzvm_cssos_status}" \
  GZVM_CERT_NOT_AFTER="${gzvm_cert_not_after}" \
  METADATA_JSON="${METADATA_JSON}" \
  python3 - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

cert_not_after = os.environ.get("GZVM_CERT_NOT_AFTER", "").strip()
days_remaining = None
if cert_not_after and cert_not_after.lower() != "unknown":
    try:
        expiry = datetime.strptime(cert_not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        delta = expiry - datetime.now(timezone.utc)
        days_remaining = max(0, delta.days)
    except Exception:
        days_remaining = None

payload = {
    "servers": [
        {"server": "api-vm", "reachable": os.environ.get("API_VM_REACHABLE", "unknown")},
        {
            "server": "gzvm",
            "reachable": os.environ.get("GZVM_REACHABLE", "unknown"),
            "nginx_status": os.environ.get("GZVM_NGINX_STATUS", "unknown"),
            "cssos_status": os.environ.get("GZVM_CSSOS_STATUS", "unknown"),
        },
    ],
    "certificate": {
        "server": "gzvm",
        "host": os.environ.get("ZH_HOST", "zh.cssstudio.app"),
        "not_after": cert_not_after,
        "days_remaining": days_remaining,
    },
}

Path(os.environ["METADATA_JSON"]).write_text(
    json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
PY
}

print_table() {
  printf '%-18s %-9s %-10s %-10s %-12s %s\n' "Target" "TLS" "HTTP" "Resets" "Latency" "Note"
  printf '%-18s %-9s %-10s %-10s %-12s %s\n' "------" "---" "----" "------" "-------" "----"
  while IFS=$'\t' read -r label tls_count http_count reset_count attempts avg_total_ms avg_connect_ms http_code_200 http_code_301 http_code_000 http_code_other note; do
    local tls_pct http_pct reset_pct
    tls_pct=$(( tls_count * 100 / attempts ))
    http_pct=$(( http_count * 100 / attempts ))
    reset_pct=$(( reset_count * 100 / attempts ))
    printf '%-18s %-9s %-10s %-10s %-12s %s\n' \
      "$label" \
      "${tls_count}/${attempts} (${tls_pct}%)" \
      "${http_count}/${attempts} (${http_pct}%)" \
      "${reset_count}/${attempts} (${reset_pct}%)" \
      "${avg_total_ms}ms/${avg_connect_ms}ms" \
      "${note:-n/a}"
  done < "${RESULTS_TSV}"
}

write_github_summary() {
  [[ -n "${GITHUB_STEP_SUMMARY:-}" ]] || return 0
  {
    echo "## zh.cssstudio.app probe matrix"
    echo
    echo "| Target | TLS | HTTP | Resets | Note |"
    echo "| --- | --- | --- | --- | --- |"
    while IFS=$'\t' read -r label tls_count http_count reset_count attempts avg_total_ms avg_connect_ms http_code_200 http_code_301 http_code_000 http_code_other note; do
      tls_pct=$(( tls_count * 100 / attempts ))
      http_pct=$(( http_count * 100 / attempts ))
      reset_pct=$(( reset_count * 100 / attempts ))
      printf '| %s | %s/%s (%s%%) | %s/%s (%s%%) | %s/%s (%s%%) | %sms/%sms | 200:%s 301:%s 000:%s other:%s | %s |\n' \
        "$label" \
        "$tls_count" "$attempts" "$tls_pct" \
        "$http_count" "$attempts" "$http_pct" \
        "$reset_count" "$attempts" "$reset_pct" \
        "$avg_total_ms" "$avg_connect_ms" \
        "$http_code_200" "$http_code_301" "$http_code_000" "$http_code_other" \
        "${note:-n/a}"
    done < "${RESULTS_TSV}"
  } >> "${GITHUB_STEP_SUMMARY}"
}

write_outputs() {
  mkdir -p "${ARTIFACT_DIR}" "${PUBLIC_OPS_DIR}"
  RESULTS_TSV="${RESULTS_TSV}" ARTIFACT_DIR="${ARTIFACT_DIR}" PUBLIC_OPS_DIR="${PUBLIC_OPS_DIR}" TS_UTC="${TS_UTC}" STAMP="${STAMP}" METADATA_JSON="${METADATA_JSON}" python3 - <<'PY'
import json
import os
from pathlib import Path

results_path = Path(os.environ["RESULTS_TSV"])
artifact_dir = Path(os.environ["ARTIFACT_DIR"])
public_ops_dir = Path(os.environ["PUBLIC_OPS_DIR"])
timestamp = os.environ["TS_UTC"]
stamp = os.environ["STAMP"]
metadata_path = Path(os.environ["METADATA_JSON"])

rows = []
for line in results_path.read_text(encoding="utf-8").splitlines():
    if not line.strip():
        continue
    parts = line.split("\t", 11)
    if len(parts) < 12:
        continue
    (
        label,
        tls_count,
        http_count,
        reset_count,
        attempts,
        avg_total_ms,
        avg_connect_ms,
        http_code_200,
        http_code_301,
        http_code_000,
        http_code_other,
        note,
    ) = parts
    attempts_i = int(attempts)
    tls_i = int(tls_count)
    http_i = int(http_count)
    reset_i = int(reset_count)
    avg_total_ms_i = int(avg_total_ms)
    avg_connect_ms_i = int(avg_connect_ms)
    http_code_200_i = int(http_code_200)
    http_code_301_i = int(http_code_301)
    http_code_000_i = int(http_code_000)
    http_code_other_i = int(http_code_other)
    rows.append(
        {
            "target": label,
            "tls_success": tls_i,
            "http_success": http_i,
            "reset_count": reset_i,
            "attempts": attempts_i,
            "tls_success_rate": round((tls_i / attempts_i) * 100, 2) if attempts_i else 0,
            "http_success_rate": round((http_i / attempts_i) * 100, 2) if attempts_i else 0,
            "reset_rate": round((reset_i / attempts_i) * 100, 2) if attempts_i else 0,
            "avg_total_latency_ms": avg_total_ms_i,
            "avg_connect_latency_ms": avg_connect_ms_i,
            "http_status_breakdown": {
                "200": http_code_200_i,
                "301": http_code_301_i,
                "000": http_code_000_i,
                "other": http_code_other_i,
            },
            "note": note.strip(),
        }
    )

by_target = {row["target"]: row for row in rows}
local_public = by_target.get("local_public", {})
api_vm_public = by_target.get("api_vm_public", {})
gzvm_public = by_target.get("gzvm_public", {})
gzvm_loopback = by_target.get("gzvm_loopback", {})

if gzvm_public.get("http_success_rate", 0) >= 80 and gzvm_loopback.get("http_success_rate", 0) >= 80:
    if local_public.get("http_success_rate", 0) < 50 or api_vm_public.get("http_success_rate", 0) < 50:
        verdict = "cross_border_path_anomaly"
        summary = "Server path looks healthy from gzvm, but external non-gzvm paths still fail or flap."
    else:
        verdict = "server_recovered"
        summary = "Public and loopback paths are both healthy, which looks like a recovered server path."
elif gzvm_loopback.get("http_success_rate", 0) < 80:
    verdict = "server_side_degradation"
    summary = "Loopback access on gzvm is degraded, so the issue is still inside the server path."
else:
    verdict = "mixed_or_unknown"
    summary = "Some paths are healthy and some are not; more probe samples are needed."

payload = {
    "schema": "cssos.zh_probe_matrix.v1",
    "captured_at": timestamp,
    "conclusion": {
        "verdict": verdict,
        "summary": summary,
        "local_public_http_success_rate": local_public.get("http_success_rate", 0),
        "api_vm_public_http_success_rate": api_vm_public.get("http_success_rate", 0),
        "gzvm_public_http_success_rate": gzvm_public.get("http_success_rate", 0),
        "gzvm_loopback_http_success_rate": gzvm_loopback.get("http_success_rate", 0),
        "local_public_avg_total_latency_ms": local_public.get("avg_total_latency_ms", 0),
        "api_vm_public_avg_total_latency_ms": api_vm_public.get("avg_total_latency_ms", 0),
        "gzvm_public_avg_total_latency_ms": gzvm_public.get("avg_total_latency_ms", 0),
        "gzvm_loopback_avg_total_latency_ms": gzvm_loopback.get("avg_total_latency_ms", 0),
    },
    "targets": rows,
    "metadata": json.loads(metadata_path.read_text(encoding="utf-8")) if metadata_path.exists() else {},
}

artifact_file = artifact_dir / f"{stamp}.json"
latest_file = artifact_dir / "latest.json"
history_file = artifact_dir / "history.ndjson"
public_latest_file = public_ops_dir / "zh-probe-latest.json"
public_history_file = public_ops_dir / "zh-probe-history.json"

artifact_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
latest_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
with history_file.open("a", encoding="utf-8") as fh:
    fh.write(json.dumps(payload, ensure_ascii=False) + "\n")
public_latest_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

history_rows = []
if history_file.exists():
    for raw in history_file.read_text(encoding="utf-8").splitlines():
        if not raw.strip():
            continue
        try:
            history_rows.append(json.loads(raw))
        except json.JSONDecodeError:
            continue
history_rows = history_rows[-48:]
public_history_file.write_text(
    json.dumps(
        {
            "schema": "cssos.zh_probe_history.v1",
            "updated_at": timestamp,
            "count": len(history_rows),
            "samples": history_rows,
        },
        ensure_ascii=False,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)

print(f"[probe] wrote {artifact_file}")
print(f"[probe] updated {latest_file}")
print(f"[probe] updated {public_latest_file}")
print(f"[probe] updated {public_history_file}")
PY
}

enforce_thresholds() {
  local status=0
  while IFS=$'\t' read -r label tls_count http_count _reset_count attempts _avg_total_ms _avg_connect_ms _http_code_200 _http_code_301 _http_code_000 _http_code_other _note; do
    if [[ "$label" != "local_public" ]]; then
      continue
    fi
    local tls_pct http_pct
    tls_pct=$(( tls_count * 100 / attempts ))
    http_pct=$(( http_count * 100 / attempts ))
    if (( tls_pct < MIN_TLS_SUCCESS_RATE )); then
      printf '[probe] FAIL %s TLS success %s%% < %s%%\n' "$label" "$tls_pct" "$MIN_TLS_SUCCESS_RATE" >&2
      status=1
    fi
    if (( http_pct < MIN_HTTP_SUCCESS_RATE )); then
      printf '[probe] FAIL %s HTTP success %s%% < %s%%\n' "$label" "$http_pct" "$MIN_HTTP_SUCCESS_RATE" >&2
      status=1
    fi
  done < "${RESULTS_TSV}"
  return "$status"
}

echo "[probe] zh target: ${ZH_URL}"
echo "[probe] attempts per target: ${ATTEMPTS}"

run_local_probe "local_public" "${ZH_URL}"

if [[ "${PUBLIC_ONLY}" != "1" ]]; then
  run_remote_probe "api-vm" "" "api_vm_public" "${ZH_URL}"
  run_remote_probe "gzvm" "-o RemoteCommand=none -T" "gzvm_public" "${ZH_URL}"
  run_remote_probe "gzvm" "-o RemoteCommand=none -T" "gzvm_loopback" "${ZH_URL}" "${ZH_HOST}:443:127.0.0.1"
fi

capture_metadata
print_table
write_outputs
write_github_summary
enforce_thresholds
