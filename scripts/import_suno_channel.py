#!/usr/bin/env python3
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_ROOT = REPO_ROOT / "data" / "music_raw" / "suno"
DEFAULT_MANIFEST_DIR = REPO_ROOT / "data" / "manifests"
DEFAULT_ARCHIVE_DIR = REPO_ROOT / "data" / "meta"
DEFAULT_ASSET_GCS_PREFIX = os.environ.get("CSSOS_TRAINING_ASSET_GCS_PREFIX", "").strip()
DEFAULT_COOKIE = os.environ.get("SUNO_COOKIE", "").strip()
DEFAULT_COOKIE_FILE = os.environ.get("SUNO_COOKIE_FILE", "").strip()
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
DEFAULT_FEED_API_BASE = "https://studio-api-prod.suno.com"
PLAYLIST_LINK_RE = re.compile(r'href="(/playlist/[^"]+)"')
PROFILE_CLIPS_RE = re.compile(r'\\"clips\\":(\[.*?\]),\\"stats\\":', re.DOTALL)
PLAYLIST_CLIPS_RE = re.compile(r'\\"playlist_clips\\":(\[.*?\]),\\"image_url\\":', re.DOTALL)
SAFE_NAME_RE = re.compile(r"[^a-z0-9._-]+")


def load_cookie_header(cookie_value: str = "", cookie_file: str = "") -> str:
    raw = str(cookie_value or "").strip()
    path_value = str(cookie_file or "").strip()
    if not raw and path_value:
        path = Path(path_value).expanduser()
        if path.exists():
            raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return ""
    if raw.startswith("[") or raw.startswith("{"):
        try:
            payload = json.loads(raw)
            if isinstance(payload, dict):
                payload = payload.get("cookies") or payload.get("items") or []
            if isinstance(payload, list):
                parts = []
                for item in payload:
                    if not isinstance(item, dict):
                        continue
                    name = str(item.get("name") or "").strip()
                    value = str(item.get("value") or "").strip()
                    domain = str(item.get("domain") or "").strip().lower()
                    if not name or value == "":
                        continue
                    if domain and "suno.com" not in domain:
                        continue
                    parts.append(f"{name}={value}")
                if parts:
                    return "; ".join(parts)
        except Exception:
            pass
    netscape_parts = []
    for line in raw.splitlines():
        text = line.strip()
        if not text or text.startswith("#"):
            continue
        cols = text.split("\t")
        if len(cols) >= 7:
            domain = cols[0].strip().lower()
            name = cols[5].strip()
            value = cols[6].strip()
            if name and "suno.com" in domain:
                netscape_parts.append(f"{name}={value}")
    if netscape_parts:
        return "; ".join(netscape_parts)
    return raw


def build_request_headers(cookie_header: str = ""):
    headers = {"User-Agent": USER_AGENT}
    if cookie_header:
        headers["Cookie"] = cookie_header
    return headers


def infer_bearer_token(cookie_header: str = "") -> str:
    if not cookie_header:
        return ""
    match = re.search(r"__session=([^;]+)", cookie_header)
    return str(match.group(1) if match else "").strip()


def build_api_headers(cookie_header: str = "", bearer_token: str = ""):
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if cookie_header:
        headers["Cookie"] = cookie_header
    if bearer_token:
        headers["Authorization"] = f"Bearer {bearer_token}"
    return headers


def fetch_text(url: str, cookie_header: str = "") -> str:
    request = Request(url, headers=build_request_headers(cookie_header))
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", "ignore")


def post_json(url: str, payload: dict, cookie_header: str = "", bearer_token: str = "", attempts: int = 6):
    body = json.dumps(payload).encode("utf-8")
    last_error = None
    for attempt in range(1, max(1, attempts) + 1):
        request = Request(url, data=body, headers=build_api_headers(cookie_header, bearer_token), method="POST")
        try:
            with urlopen(request, timeout=60) as response:
                return json.loads(response.read().decode("utf-8", "ignore") or "{}")
        except HTTPError as err:
            last_error = err
            if err.code not in {429, 500, 502, 503, 504} or attempt >= attempts:
                raise
            time.sleep(min(20, 1.8 ** attempt))
        except URLError as err:
            last_error = err
            if attempt >= attempts:
                raise
            time.sleep(min(20, 1.8 ** attempt))
    if last_error:
        raise last_error
    return {}


def parse_profile_clips(page_text: str):
    match = PROFILE_CLIPS_RE.search(page_text)
    if not match:
        return []
    try:
        return json.loads(bytes(match.group(1), "utf-8").decode("unicode_escape"))
    except json.JSONDecodeError:
        return []


def parse_playlist_clips(page_text: str):
    match = PLAYLIST_CLIPS_RE.search(page_text)
    if not match:
        return []
    try:
        playlist_rows = json.loads(bytes(match.group(1), "utf-8").decode("unicode_escape"))
    except json.JSONDecodeError:
        return []
    clips = []
    for row in playlist_rows:
        clip = row.get("clip") if isinstance(row, dict) else None
        if isinstance(clip, dict):
            clips.append(clip)
    return clips


def parse_playlist_urls(page_text: str, base_url: str):
    return sorted({urljoin(base_url, link) for link in PLAYLIST_LINK_RE.findall(page_text)})


def infer_handle(channel_url: str):
    path = urlparse(channel_url).path.strip("/")
    if path.startswith("@"):
        return path[1:]
    return path.split("/")[-1] if path else "suno_channel"


def safe_slug(text: str):
    lowered = str(text or "").strip().lower()
    lowered = lowered.replace("&", " and ")
    lowered = re.sub(r"\s+", "-", lowered)
    lowered = SAFE_NAME_RE.sub("-", lowered)
    lowered = re.sub(r"-{2,}", "-", lowered).strip("-")
    return lowered or "untitled"


def download_file(url: str, destination: Path, cookie_header: str = ""):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 0:
        return False
    request = Request(url, headers=build_request_headers(cookie_header))
    with urlopen(request, timeout=60) as response, destination.open("wb") as handle:
        handle.write(response.read())
    return True


def gcs_join(prefix: str, file_name: str):
    return prefix.rstrip("/") + "/" + file_name.lstrip("/")


def upload_to_gcs(local_path: Path, gcs_uri: str):
    cmd = ["gcloud", "storage", "cp", str(local_path), gcs_uri]
    subprocess.run(cmd, check=True, capture_output=True, text=True)


def write_text(path: Path, value: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding="utf-8")


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def load_archive_ids(path: Path):
    if not path.exists():
        return set()
    ids = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        value = line.strip()
        if value:
            ids.add(value)
    return ids


def append_archive_ids(path: Path, clip_ids):
    existing = load_archive_ids(path)
    merged = existing.union({clip_id for clip_id in clip_ids if str(clip_id).strip()})
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for clip_id in sorted(merged):
            handle.write(f"{clip_id}\n")


def collect_channel_clips(channel_url: str, cookie_header: str = ""):
    bearer_token = infer_bearer_token(cookie_header)
    if bearer_token:
        handle = infer_handle(channel_url)
        cursor = None
        seen = {}
        while True:
            payload = {
                "limit": 100,
                "filters": {"feedType": "profile", "userHandle": handle},
            }
            if cursor:
                payload["cursor"] = cursor
            data = post_json(
                f"{DEFAULT_FEED_API_BASE}/api/feed/v3",
                payload,
                cookie_header=cookie_header,
                bearer_token=bearer_token,
            )
            rows = data.get("clips") or []
            for clip in rows:
                clip_id = str((clip or {}).get("id") or "").strip()
                if clip_id:
                    seen[clip_id] = clip
            next_cursor = str(data.get("next_cursor") or "").strip()
            if not next_cursor or next_cursor == cursor or not rows:
                return list(seen.values()), []
            cursor = next_cursor

    profile_html = fetch_text(channel_url, cookie_header=cookie_header)
    clips = parse_profile_clips(profile_html)
    playlist_urls = parse_playlist_urls(profile_html, channel_url)

    for playlist_url in playlist_urls:
        try:
            playlist_html = fetch_text(playlist_url, cookie_header=cookie_header)
            clips.extend(parse_playlist_clips(playlist_html))
        except Exception:
            continue

    deduped = {}
    for clip in clips:
        clip_id = str(clip.get("id") or "").strip()
        if not clip_id:
            continue
        deduped[clip_id] = clip
    return list(deduped.values()), playlist_urls


def build_local_artifacts(
    clip: dict,
    channel_dir: Path,
    download_audio: bool,
    gcs_prefix: str = "",
    keep_local: bool = True,
    cookie_header: str = "",
):
    clip_id = str(clip.get("id") or "").strip()
    title = str(clip.get("title") or clip_id or "untitled").strip()
    prompt = str((clip.get("metadata") or {}).get("prompt") or "").strip()
    tags = clip.get("metadata") or {}
    audio_url = str(clip.get("audio_url") or "").strip()
    base_name = f"{safe_slug(title)}--{clip_id[:8]}"
    audio_path = channel_dir / f"{base_name}.mp3"
    metadata_path = channel_dir / f"{base_name}.suno.json"
    lyrics_path = channel_dir / f"{base_name}.lyrics.txt"
    gcs_audio_uri = gcs_join(gcs_prefix, audio_path.name) if gcs_prefix else ""
    gcs_metadata_uri = gcs_join(gcs_prefix, metadata_path.name) if gcs_prefix else ""
    gcs_lyrics_uri = gcs_join(gcs_prefix, lyrics_path.name) if gcs_prefix and prompt else ""

    downloaded = False
    if download_audio and audio_url:
        downloaded = download_file(audio_url, audio_path, cookie_header=cookie_header)

    metadata = dict(clip)
    metadata["local_audio_path"] = str(audio_path)
    metadata["channel_dir"] = str(channel_dir)
    if gcs_audio_uri:
        metadata["gcs_audio_uri"] = gcs_audio_uri
    if gcs_metadata_uri:
        metadata["gcs_metadata_uri"] = gcs_metadata_uri
    if gcs_lyrics_uri:
        metadata["gcs_lyrics_uri"] = gcs_lyrics_uri
    write_json(metadata_path, metadata)

    if prompt:
        write_text(lyrics_path, prompt + "\n")

    if gcs_prefix:
        if audio_path.exists():
            upload_to_gcs(audio_path, gcs_audio_uri)
        upload_to_gcs(metadata_path, gcs_metadata_uri)
        if prompt and lyrics_path.exists():
            upload_to_gcs(lyrics_path, gcs_lyrics_uri)
        if not keep_local:
            if audio_path.exists():
                audio_path.unlink()
            if metadata_path.exists():
                metadata_path.unlink()
            if lyrics_path.exists():
                lyrics_path.unlink()

    return {
        "clip_id": clip_id,
        "title": title,
        "status": str(clip.get("status") or "").strip(),
        "created_at": str(clip.get("created_at") or "").strip(),
        "prompt": prompt,
        "tags": str(tags.get("tags") or "").strip(),
        "clip_metadata": {
            "genre": str(tags.get("genre") or "").strip(),
            "mood": str(tags.get("mood") or "").strip(),
            "style": str(tags.get("style") or "").strip(),
        },
        "audio_url": audio_url,
        "audio_path": str(audio_path),
        "gcs_audio_uri": gcs_audio_uri or None,
        "metadata_path": str(metadata_path),
        "gcs_metadata_uri": gcs_metadata_uri or None,
        "lyrics_path": str(lyrics_path) if prompt else None,
        "gcs_lyrics_uri": gcs_lyrics_uri or None,
        "downloaded_audio": downloaded,
    }


def run_pipeline(audio_root: Path, source_filter: str):
    cmd = [
        sys.executable,
        str(REPO_ROOT / "scripts" / "run_suno_data_pipeline.py"),
        "--audio-root",
        str(audio_root),
        "--source-filter",
        source_filter,
    ]
    completed = subprocess.run(cmd, capture_output=True, text=True, check=True)
    stdout = completed.stdout.strip()
    return json.loads(stdout.splitlines()[-1]) if stdout else {}


def main():
    parser = argparse.ArgumentParser(
        description="Import a public Suno channel into local training assets and run the Suno data pipeline."
    )
    parser.add_argument("--channel-url", required=True, help="Public Suno channel URL, for example https://suno.com/@yourhandle")
    parser.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    parser.add_argument("--max-clips", type=int, default=0, help="Optional limit for imported clips. 0 means no limit.")
    parser.add_argument("--skip-download", action="store_true", help="Collect metadata only and skip MP3 downloads.")
    parser.add_argument("--skip-pipeline", action="store_true", help="Do not invoke run_suno_data_pipeline.py after import.")
    parser.add_argument(
        "--gcs-prefix",
        default=DEFAULT_ASSET_GCS_PREFIX,
        help="Optional gs:// prefix for direct asset upload, for example gs://bucket/suno/jingdu",
    )
    parser.add_argument(
        "--keep-local",
        action="store_true",
        help="Keep local downloaded files after uploading them to GCS.",
    )
    parser.add_argument(
        "--archive-file",
        default="",
        help="Optional archive file storing previously imported clip_ids. Defaults to data/meta/suno_channel_<handle>.archive.txt",
    )
    parser.add_argument(
        "--source-filter",
        choices=["all", "suno", "unknown"],
        default="all",
        help="Forwarded to run_suno_data_pipeline.py when pipeline execution is enabled.",
    )
    parser.add_argument(
        "--cookie",
        default=DEFAULT_COOKIE,
        help="Optional raw Suno Cookie header value for account-authenticated imports.",
    )
    parser.add_argument(
        "--cookie-file",
        default=DEFAULT_COOKIE_FILE,
        help="Optional file containing raw Cookie text, Netscape cookies, or JSON cookie export.",
    )
    args = parser.parse_args()

    channel_url = args.channel_url.strip()
    handle = infer_handle(channel_url)
    output_root = Path(args.output_root).expanduser().resolve()
    channel_dir = output_root / handle
    gcs_prefix = args.gcs_prefix.strip()
    cookie_header = load_cookie_header(args.cookie, args.cookie_file)
    archive_file = Path(args.archive_file).expanduser().resolve() if args.archive_file else (
        DEFAULT_ARCHIVE_DIR / f"suno_channel_{safe_slug(handle)}.archive.txt"
    )

    if gcs_prefix and not args.keep_local:
        temp_root = Path(tempfile.mkdtemp(prefix=f"suno_import_{safe_slug(handle)}_"))
        channel_dir = temp_root / handle

    clips, playlist_urls = collect_channel_clips(channel_url, cookie_header=cookie_header)
    clips.sort(key=lambda clip: str(clip.get("created_at") or ""), reverse=True)
    archived_ids = load_archive_ids(archive_file)
    clips = [clip for clip in clips if str(clip.get("id") or "").strip() not in archived_ids]
    if args.max_clips > 0:
        clips = clips[: args.max_clips]

    imported = []
    imported_ids = []
    for clip in clips:
        imported.append(
            build_local_artifacts(
                clip,
                channel_dir,
                download_audio=not args.skip_download,
                gcs_prefix=gcs_join(gcs_prefix, handle) if gcs_prefix else "",
                keep_local=args.keep_local,
                cookie_header=cookie_header,
            )
        )
        clip_id = str(clip.get("id") or "").strip()
        if clip_id:
            imported_ids.append(clip_id)

    append_archive_ids(archive_file, imported_ids)

    import_manifest = {
        "schema": "css.suno_channel_import.v1",
        "channel_url": channel_url,
        "handle": handle,
        "channel_dir": str(channel_dir),
        "account_authenticated": bool(cookie_header),
        "gcs_prefix": gcs_join(gcs_prefix, handle) if gcs_prefix else None,
        "archive_file": str(archive_file),
        "playlist_urls": playlist_urls,
        "clips_seen": len(clips),
        "archived_ids_loaded": len(archived_ids),
        "imported": imported,
    }
    manifest_path = DEFAULT_MANIFEST_DIR / f"suno_channel_import.{safe_slug(handle)}.json"
    write_json(manifest_path, import_manifest)

    pipeline_summary = None
    if gcs_prefix and not args.keep_local:
        args.skip_pipeline = True
    if not args.skip_pipeline:
        pipeline_summary = run_pipeline(output_root.parent, args.source_filter)

    summary = {
        "schema": "css.suno_channel_import.summary.v1",
        "ok": True,
        "channel_url": channel_url,
        "handle": handle,
        "channel_dir": str(channel_dir),
        "account_authenticated": bool(cookie_header),
        "gcs_prefix": gcs_join(gcs_prefix, handle) if gcs_prefix else None,
        "archive_file": str(archive_file),
        "clips_imported": len(imported),
        "playlists_seen": len(playlist_urls),
        "manifest_path": str(manifest_path),
        "pipeline_ran": not args.skip_pipeline,
        "pipeline_summary": pipeline_summary,
    }
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
