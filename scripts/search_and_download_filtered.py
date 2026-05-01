#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path


ID_PATTERN = re.compile(r"__\[([A-Za-z0-9_-]{6,})\]\.[A-Za-z0-9]+$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Search YouTube, filter aggressively, then download only accepted videos.")
    parser.add_argument("--query", required=True)
    parser.add_argument("--pool-name", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--archive-file", required=True)
    parser.add_argument("--log-file", required=True)
    parser.add_argument("--yt-dlp-bin", default=str(Path.home() / ".local/bin/yt-dlp"))
    parser.add_argument("--format-selector", default="bv*[height<=720][ext=mp4]/b[height<=720][ext=mp4]/b[ext=mp4]")
    parser.add_argument("--results", type=int, default=12, help="How many accepted downloads to target.")
    parser.add_argument("--search-budget", type=int, default=60, help="How many search metadata candidates to inspect.")
    parser.add_argument("--min-duration", type=float, default=6.0)
    parser.add_argument("--max-duration", type=float, default=90.0)
    parser.add_argument("--title-blacklist-regex", default="")
    parser.add_argument("--title-whitelist-regex", default="")
    parser.add_argument("--channel-blacklist-regex", default="")
    parser.add_argument("--channel-whitelist-regex", default="")
    parser.add_argument("--extra-archive-glob", default="data/meta/*.txt")
    parser.add_argument("--existing-root", default="data/raw_char")
    return parser.parse_args()


def compile_regex(raw: str) -> re.Pattern[str] | None:
    return re.compile(raw) if raw else None


def run_capture(command: list[str]) -> str:
    result = subprocess.run(
        command,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout


def append_log(log_path: Path, message: str) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(message.rstrip() + "\n")


def load_seen_ids(archive_glob: str, existing_root: Path) -> set[str]:
    seen: set[str] = set()

    for path in Path().glob(archive_glob):
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line:
                continue
            seen.add(line.rsplit(" ", 1)[-1])

    if existing_root.exists():
        for path in existing_root.rglob("*"):
            if not path.is_file():
                continue
            match = ID_PATTERN.search(path.name)
            if match:
                seen.add(match.group(1))

    return seen


def fetch_candidates(args: argparse.Namespace) -> list[dict]:
    raw = run_capture(
        [
            args.yt_dlp_bin,
            "--flat-playlist",
            "--dump-json",
            f"ytsearch{args.search_budget}:{args.query}",
        ]
    )
    candidates = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            candidates.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return candidates


def decide_candidate(
    item: dict,
    seen_ids: set[str],
    title_blacklist: re.Pattern[str] | None,
    title_whitelist: re.Pattern[str] | None,
    channel_blacklist: re.Pattern[str] | None,
    channel_whitelist: re.Pattern[str] | None,
    min_duration: float,
    max_duration: float,
) -> tuple[bool, str]:
    video_id = (item.get("id") or "").strip()
    title = (item.get("title") or "").strip()
    channel = (item.get("channel") or item.get("uploader") or "").strip()
    duration = float(item.get("duration") or 0.0)

    if not video_id:
        return False, "missing_id"
    if video_id in seen_ids:
        return False, "already_seen"
    if duration < min_duration or duration > max_duration:
        return False, "duration_out_of_range"
    if title_blacklist and title_blacklist.search(title):
        return False, "title_blacklist"
    if title_whitelist and not title_whitelist.search(title):
        return False, "title_missing_whitelist_signal"
    if channel_blacklist and channel_blacklist.search(channel):
        return False, "channel_blacklist"
    if channel_whitelist and not channel_whitelist.search(channel):
        return False, "channel_missing_whitelist_signal"
    return True, "accepted"


def download_item(args: argparse.Namespace, url: str, output_dir: Path, archive_file: Path) -> None:
    output_template = output_dir / "%(title).120s__[%(id)s].%(ext)s"
    subprocess.run(
        [
            args.yt_dlp_bin,
            "--no-playlist",
            "--ignore-errors",
            "--continue",
            "--no-overwrites",
            "--download-archive",
            str(archive_file),
            "-f",
            args.format_selector,
            url,
            "-o",
            str(output_template),
        ],
        check=False,
    )


def main() -> None:
    args = parse_args()
    log_path = Path(args.log_file)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    archive_file = Path(args.archive_file)
    archive_file.parent.mkdir(parents=True, exist_ok=True)
    archive_file.touch(exist_ok=True)

    title_blacklist = compile_regex(args.title_blacklist_regex)
    title_whitelist = compile_regex(args.title_whitelist_regex)
    channel_blacklist = compile_regex(args.channel_blacklist_regex)
    channel_whitelist = compile_regex(args.channel_whitelist_regex)

    seen_ids = load_seen_ids(args.extra_archive_glob, Path(args.existing_root))
    candidates = fetch_candidates(args)

    append_log(log_path, f"[{args.pool_name}] query={args.query}")
    append_log(log_path, f"[{args.pool_name}] search_candidates={len(candidates)} seen_ids={len(seen_ids)}")

    accepted = 0
    inspected = 0
    for item in candidates:
        inspected += 1
        keep, reason = decide_candidate(
            item,
            seen_ids,
            title_blacklist,
            title_whitelist,
            channel_blacklist,
            channel_whitelist,
            args.min_duration,
            args.max_duration,
        )
        video_id = (item.get("id") or "").strip()
        title = (item.get("title") or "").strip()
        channel = (item.get("channel") or item.get("uploader") or "").strip()
        duration = float(item.get("duration") or 0.0)
        append_log(
            log_path,
            f"[{args.pool_name}] inspect#{inspected} {reason} id={video_id} duration={duration:.1f}s channel={channel} title={title}",
        )
        if not keep:
            continue

        url = item.get("webpage_url") or item.get("url") or f"https://www.youtube.com/watch?v={video_id}"
        download_item(args, url, output_dir, archive_file)
        seen_ids.add(video_id)
        accepted += 1
        append_log(log_path, f"[{args.pool_name}] downloaded id={video_id} url={url}")
        if accepted >= args.results:
            break

    append_log(log_path, f"[{args.pool_name}] accepted={accepted} inspected={inspected}")
    print(f"pool={args.pool_name}")
    print(f"accepted={accepted}")
    print(f"inspected={inspected}")


if __name__ == "__main__":
    main()
