import csv
import json
import os


RAW_DIR = "data/raw"
CLIPS_DIR = "data/clips"
FRAMES_DIR = "data/frames"
META_DIR = "data/meta"


def main():
    os.makedirs(META_DIR, exist_ok=True)

    raw_files = sorted(
        name for name in os.listdir(RAW_DIR) if name.lower().endswith(".mp4")
    )

    manifest = []

    for raw in raw_files:
        raw_base = os.path.splitext(raw)[0]
        clip_dir = os.path.join(CLIPS_DIR, raw_base)
        frame_dir = os.path.join(FRAMES_DIR, raw_base)

        if not os.path.isdir(clip_dir):
            continue

        clips = sorted(name for name in os.listdir(clip_dir) if name.endswith(".mp4"))

        for clip in clips:
            clip_base = os.path.splitext(clip)[0]
            clip_frames_dir = os.path.join(frame_dir, clip_base)
            frame_count = 0

            if os.path.isdir(clip_frames_dir):
                frame_count = len(
                    [name for name in os.listdir(clip_frames_dir) if name.endswith(".png")]
                )

            manifest.append(
                {
                    "raw_video": raw,
                    "raw_base": raw_base,
                    "clip_file": clip,
                    "clip_path": os.path.join(clip_dir, clip),
                    "frames_dir": clip_frames_dir,
                    "frame_count": frame_count,
                    "character_id": None,
                    "accepted": frame_count >= 8,
                }
            )

    json_path = os.path.join(META_DIR, "stage1_manifest.json")
    with open(json_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2, ensure_ascii=False)

    csv_path = os.path.join(META_DIR, "stage1_manifest.csv")
    with open(csv_path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "raw_video",
                "raw_base",
                "clip_file",
                "clip_path",
                "frames_dir",
                "frame_count",
                "character_id",
                "accepted",
            ],
        )
        writer.writeheader()
        writer.writerows(manifest)

    print(f"saved: {json_path}")
    print(f"saved: {csv_path}")
    print(f"records: {len(manifest)}")


if __name__ == "__main__":
    main()
