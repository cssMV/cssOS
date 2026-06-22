#!/usr/bin/env bash
set -euo pipefail

TARGET="${TARGET:-api-vm}"
OLDER_THAN_DAYS="${OLDER_THAN_DAYS:-7}"
KEEP_STATUSES="${KEEP_STATUSES:-RUNNING,INIT}"
DELETE_STATUSES="${DELETE_STATUSES:-FAILED,CANCELLED,UNKNOWN,BROKEN}"
ON_CALENDAR="${ON_CALENDAR:-daily}"

say() {
  printf '[run-prune-timer] %s\n' "$*"
}

build_prune_service() {
  local run_root="$1"
  local script_path="$2"
  cat <<EOF
[Unit]
Description=CSSOS prune historical test runs
After=network-online.target

[Service]
Type=oneshot
Environment=RUN_ROOT=${run_root}
Environment=KEEP_STATUSES=${KEEP_STATUSES}
Environment=DELETE_STATUSES=${DELETE_STATUSES}
ExecStart=${script_path} --older-than-days ${OLDER_THAN_DAYS} --keep-statuses ${KEEP_STATUSES} --delete-statuses ${DELETE_STATUSES} --execute
EOF
}

build_prune_timer() {
  cat <<EOF
[Unit]
Description=Run CSSOS historical test run pruning

[Timer]
OnCalendar=${ON_CALENDAR}
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
EOF
}

install_target() {
  local target="$1"
  local ssh_cmd=(ssh)
  local base_dir="/srv/cssos"
  local script_path="${base_dir}/bin/prune-test-runs-before-date.sh"
  local run_root="${base_dir}/shared/runs"
  local report_file="${base_dir}/shared/ops/maintenance/run-prune.latest.json"
  say "${target}: syncing prune script"
  cat /Users/jing/cssOS/scripts/prune-test-runs-before-date.sh | "${ssh_cmd[@]}" "$target" "sudo tee ${script_path} >/dev/null && sudo chmod +x ${script_path}"
  say "${target}: installing systemd service/timer"
  build_prune_service "$run_root" "$script_path" | sed "s|ExecStart=.*|ExecStart=${script_path} --older-than-days ${OLDER_THAN_DAYS} --keep-statuses ${KEEP_STATUSES} --delete-statuses ${DELETE_STATUSES} --report-file ${report_file} --execute|g" | "${ssh_cmd[@]}" "$target" "sudo mkdir -p $(dirname ${report_file}) && sudo tee /etc/systemd/system/cssos-prune-runs.service >/dev/null"
  build_prune_timer | "${ssh_cmd[@]}" "$target" "sudo tee /etc/systemd/system/cssos-prune-runs.timer >/dev/null"
  "${ssh_cmd[@]}" "$target" "sudo systemctl daemon-reload && sudo systemctl enable --now cssos-prune-runs.timer && systemctl status cssos-prune-runs.timer --no-pager --lines=0"
  say "${target}: timer active"
}

case "${TARGET}" in
  api-vm|all)
    install_target api-vm
    ;;
  *)
    echo "usage: TARGET={api-vm|all} $(basename "$0")" >&2
    exit 1
    ;;
esac
