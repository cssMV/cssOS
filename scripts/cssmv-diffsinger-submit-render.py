#!/usr/bin/env python3
import json
import os
import shutil
import sys
import time
import urllib.parse
import urllib.request
import subprocess
from pathlib import Path


def post_json(url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"Content-Type": "application/json"}, method="GET")
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def expand_template(template: str, mapping: dict[str, str]) -> str:
    expanded = str(template or "")
    for key, value in mapping.items():
        expanded = expanded.replace(f"{{{{{key}}}}}", str(value))
    return expanded


def transcode_audio(source_path: Path, target_path: Path) -> None:
    if source_path.resolve() == target_path.resolve():
        return
    target_path.parent.mkdir(parents=True, exist_ok=True)
    if target_path.suffix.lower() == source_path.suffix.lower():
        shutil.copyfile(source_path, target_path)
        return
    if target_path.suffix.lower() == ".mp3":
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(source_path), "-codec:a", "libmp3lame", "-q:a", "2", str(target_path)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return
    if target_path.suffix.lower() == ".wav":
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(source_path), str(target_path)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return
    shutil.copyfile(source_path, target_path)


def clean_vocal_artifacts(audio_path: Path) -> None:
    if not audio_path.exists():
        return
    cleanup_profile = str(os.environ.get("CSSMV_VOCAL_CLEANUP_PROFILE", "siren_dehum_guard")).strip().lower()
    if cleanup_profile in {"", "off", "none", "disabled"}:
        return
    temp_path = audio_path.with_suffix(f".cleanup{audio_path.suffix}")
    filter_chain = ",".join(
        [
            "highpass=f=85",
            "lowpass=f=6800",
            "afftdn=nf=-22",
            "highpass=f=120, lowpass=f=5400",
            "equalizer=f=180:w=80:g=-10",
            "equalizer=f=260:w=90:g=-9",
            "equalizer=f=520:w=140:g=-7",
            "equalizer=f=420:w=110:g=-10",
            "equalizer=f=960:w=180:g=-8",
            "equalizer=f=1800:w=420:g=-6",
            "equalizer=f=3150:w=900:g=-5",
            "equalizer=f=4200:w=1200:g=-6",
            "equalizer=f=5600:w=1200:g=-7",
            "alimiter=limit=0.92",
        ]
    )
    command = ["ffmpeg", "-y", "-i", str(audio_path), "-af", filter_chain]
    if audio_path.suffix.lower() == ".mp3":
        command.extend(["-codec:a", "libmp3lame", "-q:a", "2"])
    command.append(str(temp_path))
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    shutil.move(str(temp_path), str(audio_path))


def run_legacy_bridge(request_manifest: Path, artifact_dir: Path, session_dir: Path, audio_outputs: list[Path]) -> int:
    submit_body_file = Path(
        os.environ.get("CSSMV_DIFFSINGER_SUBMIT_BODY_FILE", session_dir / "submit.request.json")
    ).resolve()
    legacy_output_dir = Path(
        os.environ.get("CSSMV_DIFFSINGER_LEGACY_BRIDGE_OUTPUT_DIR", artifact_dir / "hosts" / "diffsinger" / "legacy-bridge")
    ).resolve()
    legacy_output_dir.mkdir(parents=True, exist_ok=True)

    python_bin = os.environ.get("CSSMV_DIFFSINGER_PYTHON", "python3")
    default_bridge_cmd = (
        f"{python_bin} /srv/cssos/current/scripts/cssmv-diffsinger-legacy-bridge.py "
        f"{{{{SUBMIT_REQUEST}}}} {{{{LEGACY_OUTPUT_DIR}}}}"
    )
    template = os.environ.get("CSSMV_DIFFSINGER_LEGACY_BRIDGE_CMD", default_bridge_cmd)
    command = expand_template(
        template,
        {
            "REQUEST_MANIFEST": str(request_manifest),
            "SUBMIT_REQUEST": str(submit_body_file),
            "ARTIFACT_DIR": str(artifact_dir),
            "SESSION_DIR": str(session_dir),
            "LEGACY_OUTPUT_DIR": str(legacy_output_dir),
            "OUTPUT_WAV": str(audio_outputs[0]) if audio_outputs else "",
        },
    )
    completed = subprocess.run(command, shell=True, text=True, capture_output=True, env=os.environ.copy())
    if completed.returncode != 0:
        print(
            "[cssmv-diffsinger-submit-render] legacy bridge failed:\n"
            f"command={command}\nstdout={completed.stdout}\nstderr={completed.stderr}",
            file=sys.stderr,
        )
        return 18

    legacy_summary_path = legacy_output_dir / "legacy-bridge.summary.json"
    legacy_wav_path = Path(
        os.environ.get("CSSMV_DIFFSINGER_LEGACY_WAV_PATH", legacy_output_dir / "vocal.lead.wav")
    )
    if not legacy_wav_path.is_absolute():
        legacy_wav_path = (legacy_output_dir / legacy_wav_path).resolve()

    if not legacy_wav_path.exists() and legacy_summary_path.exists():
        summary = json.loads(legacy_summary_path.read_text(encoding="utf-8"))
        wav_from_summary = str(summary.get("wav", "")).strip()
        if wav_from_summary:
            legacy_wav_path = Path(wav_from_summary).resolve()

    if not legacy_wav_path.exists():
        print(
            f"[cssmv-diffsinger-submit-render] legacy bridge completed but wav missing: {legacy_wav_path}",
            file=sys.stderr,
        )
        return 19

    first_output = audio_outputs[0]
    transcode_audio(legacy_wav_path, first_output)
    clean_vocal_artifacts(first_output)
    for extra in audio_outputs[1:]:
        transcode_audio(first_output, extra)
        clean_vocal_artifacts(extra)

    report_path = session_dir / "submit.result.json"
    report_path.write_text(
        json.dumps(
            {
                "status": "LEGACY_BRIDGE",
                "submit_body_file": str(submit_body_file),
                "legacy_output_dir": str(legacy_output_dir),
                "legacy_summary": str(legacy_summary_path),
                "legacy_wav": str(legacy_wav_path),
                "outputs": [str(path) for path in audio_outputs],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return 0


def main() -> int:
    if len(sys.argv) < 5:
      print("usage: cssmv-diffsinger-submit-render.py <request_manifest> <lyrics_input> <output_manifest> <artifact_dir>", file=sys.stderr)
      return 2

    request_manifest = Path(sys.argv[1]).resolve()
    _lyrics_input = Path(sys.argv[2]).resolve()
    output_manifest = Path(sys.argv[3]).resolve()
    artifact_dir = Path(sys.argv[4]).resolve()
    session_dir = request_manifest.parent

    server_base = os.environ.get("CSSMV_DIFFSINGER_SERVER_BASE_URL", "http://127.0.0.1:9266").rstrip("/")
    submit_body_file = Path(
        os.environ.get("CSSMV_DIFFSINGER_SUBMIT_BODY_FILE", session_dir / "submit.request.json")
    )
    poll_interval = float(os.environ.get("CSSMV_DIFFSINGER_POLL_INTERVAL_SEC", "1.0"))
    poll_timeout = float(os.environ.get("CSSMV_DIFFSINGER_POLL_TIMEOUT_SEC", "240"))

    if not submit_body_file.exists():
        print(f"[cssmv-diffsinger-submit-render] submit body not found: {submit_body_file}", file=sys.stderr)
        return 3

    submit_body = json.loads(submit_body_file.read_text(encoding="utf-8"))
    manifest = json.loads(output_manifest.read_text(encoding="utf-8"))
    outputs = [artifact_dir / item for item in manifest.get("outputArtifacts", [])]
    audio_outputs = [item for item in outputs if item.suffix.lower() in {".wav", ".mp3"}]
    if not audio_outputs:
        print("[cssmv-diffsinger-submit-render] no audio outputs declared", file=sys.stderr)
        return 4

    try:
        models_res = get_json(f"{server_base}/models")
        models = {
            str(item).strip()
            for item in (models_res.get("models", []) if isinstance(models_res, dict) else [])
            if str(item).strip()
        }
    except Exception as error:
        print(f"[cssmv-diffsinger-submit-render] model probe failed, falling back to legacy bridge: {error}", file=sys.stderr)
        return run_legacy_bridge(request_manifest, artifact_dir, session_dir, audio_outputs)

    requested_model = str((submit_body.get("request", submit_body) or {}).get("model", "")).strip()
    if requested_model and requested_model not in models:
        print(
            f"[cssmv-diffsinger-submit-render] requested model '{requested_model}' is not available in MiniEngine; falling back to legacy bridge",
            file=sys.stderr,
        )
        return run_legacy_bridge(request_manifest, artifact_dir, session_dir, audio_outputs)

    try:
        submit_res = post_json(f"{server_base}/submit", submit_body)
    except Exception as error:
        print(f"[cssmv-diffsinger-submit-render] submit failed, falling back to legacy bridge: {error}", file=sys.stderr)
        return run_legacy_bridge(request_manifest, artifact_dir, session_dir, wav_outputs)
    token = str(submit_res.get("token", "")).strip()
    if not token:
        print(f"[cssmv-diffsinger-submit-render] submit returned no token: {submit_res}", file=sys.stderr)
        return 5

    deadline = time.time() + poll_timeout
    status = str(submit_res.get("status", "")).strip()
    while status not in {"FINISHED", "HIT_CACHE"}:
        if time.time() >= deadline:
            print(f"[cssmv-diffsinger-submit-render] polling timed out for token {token}", file=sys.stderr)
            return 6
        time.sleep(poll_interval)
        query_res = post_json(f"{server_base}/query", {"token": token})
        status = str(query_res.get("status", "")).strip()
        if status == "FAILED":
            print(f"[cssmv-diffsinger-submit-render] synthesis failed: {query_res}", file=sys.stderr)
            return 7

    download_url = f"{server_base}/download?{urllib.parse.urlencode({'token': token})}"
    with urllib.request.urlopen(download_url, timeout=120) as response:
        audio_bytes = response.read()

    temp_wav = session_dir / "downloaded.render.wav"
    temp_wav.write_bytes(audio_bytes)
    first_output = audio_outputs[0]
    transcode_audio(temp_wav, first_output)
    clean_vocal_artifacts(first_output)
    for extra in audio_outputs[1:]:
        transcode_audio(first_output, extra)
        clean_vocal_artifacts(extra)
    temp_wav.unlink(missing_ok=True)

    report_path = session_dir / "submit.result.json"
    report_path.write_text(
        json.dumps(
            {
                "server_base": server_base,
                "token": token,
                "status": status,
                "submit_body_file": str(submit_body_file),
                "outputs": [str(path) for path in audio_outputs],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
