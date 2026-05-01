#!/usr/bin/env bash
set -euo pipefail

TARGET="${TARGET:-api-vm}"
BUCKET="${BUCKET:-gs://cssstudio-gpu-cssos-assets-prod}"
MIN_AGE_DAYS="${MIN_AGE_DAYS:-0.08}"
MAX_RUNS="${MAX_RUNS:-50}"
ON_CALENDAR="${ON_CALENDAR:-hourly}"
EXECUTE="${EXECUTE:-0}"
LOCAL_PRUNE_MODE="${LOCAL_PRUNE_MODE:-none}"

say() {
  printf '[work-archive-timer] %s\n' "$*"
}

build_archive_service() {
  local run_root="$1"
  local script_path="$2"
  local report_file="$3"
  cat <<EOF
[Unit]
Description=CSSOS archive successful works to asset storage
After=network-online.target

[Service]
Type=oneshot
Environment=BUCKET=${BUCKET}
Environment=RUN_ROOT=${run_root}
ExecStart=${script_path} --bucket ${BUCKET} --run-root ${run_root} --min-age-days ${MIN_AGE_DAYS} --max-runs ${MAX_RUNS} --report-file ${report_file}$([[ "${EXECUTE}" == "1" ]] && printf ' --execute')
EOF
}

build_archive_timer() {
  cat <<EOF
[Unit]
Description=Run CSSOS successful work archival

[Timer]
OnCalendar=${ON_CALENDAR}
Persistent=true
RandomizedDelaySec=15m

[Install]
WantedBy=timers.target
EOF
}

install_target() {
  local target="$1"
  local ssh_cmd=(ssh)
  local base_dir="/srv/cssos"
  if [[ "$target" == "gzvm" ]]; then
    ssh_cmd=(ssh -o RemoteCommand=none -T)
    base_dir="/home/ubuntu/cssOS"
  fi
  local script_path="${base_dir}/bin/archive-successful-works-to-gcs.sh"
  local run_root="${base_dir}/shared/runs"
  local report_file="${base_dir}/shared/ops/maintenance/work-archive.latest.json"
  if [[ "$target" == "gzvm" ]]; then
    run_root="${base_dir}/runs"
  fi
  say "${target}: syncing archive script"
  cat /Users/jing/cssOS/scripts/archive-successful-works-to-gcs.sh | "${ssh_cmd[@]}" "$target" "sudo tee ${script_path} >/dev/null && sudo chmod +x ${script_path}"
  say "${target}: installing systemd service/timer"
  build_archive_service "$run_root" "$script_path" "$report_file" \
    | sed "s|ExecStart=.*|ExecStart=/usr/bin/flock -n /tmp/cssos-archive-works.lock ${script_path} --bucket ${BUCKET} --run-root ${run_root} --min-age-days ${MIN_AGE_DAYS} --max-runs ${MAX_RUNS} --report-file ${report_file} --local-prune-mode ${LOCAL_PRUNE_MODE}$([[ \"${EXECUTE}\" == \"1\" ]] && printf ' --execute')|g" \
    | "${ssh_cmd[@]}" "$target" "sudo mkdir -p $(dirname "${report_file}") && sudo tee /etc/systemd/system/cssos-archive-works.service >/dev/null"
  build_archive_timer | "${ssh_cmd[@]}" "$target" "sudo tee /etc/systemd/system/cssos-archive-works.timer >/dev/null"
  "${ssh_cmd[@]}" "$target" "sudo systemctl daemon-reload && sudo systemctl enable --now cssos-archive-works.timer && systemctl status cssos-archive-works.timer --no-pager --lines=0"
  say "${target}: timer active"
}

case "${TARGET}" in
  api-vm)
    install_target api-vm
    ;;
  gzvm)
    install_target gzvm
    ;;
  all)
    install_target api-vm
    install_target gzvm
    ;;
  *)
    echo "usage: TARGET={api-vm|gzvm|all} $(basename "$0")" >&2
    exit 1
    ;;
esac
