#!/usr/bin/env python3
import csv
import json
from pathlib import Path


INPUT_MANIFEST = Path("data/validation/char002_westworld_prelude_i_v1/manifest.csv")
OUTPUT_DIR = Path("data/validation/char002_westworld_prelude_i_v1/storyboard_v1")


SHOT_PLAN = [
    {
        "validation_index": "005",
        "scene_id": "scene_001",
        "label": "Cold awakening close-up",
        "subtitle_text": "He wakes before the music does.",
        "transition_to_next": "fade",
        "westworld_prompt": "male host close-up, calm synthetic restraint, cold clinical light, black void mood, westworld prelude atmosphere",
    },
    {
        "validation_index": "004",
        "scene_id": "scene_002",
        "label": "Memory fracture monologue",
        "subtitle_text": "A memory arrives as if it belongs to someone else.",
        "transition_to_next": "cut",
        "westworld_prompt": "male host medium close-up, fractured memory, cinematic realism, dark contrast, restrained emotion",
    },
    {
        "validation_index": "007",
        "scene_id": "scene_003",
        "label": "Interior doubt",
        "subtitle_text": "He rehearses a self he was written to perform.",
        "transition_to_next": "cut",
        "westworld_prompt": "young male android monologue, existential doubt, intimate close-up, westworld mood",
    },
    {
        "validation_index": "010",
        "scene_id": "scene_004",
        "label": "Audit close-up",
        "subtitle_text": "Every answer sounds monitored.",
        "transition_to_next": "cut",
        "westworld_prompt": "male host under scrutiny, close-up audition frame, controlled fear, sterile observation",
    },
    {
        "validation_index": "001",
        "scene_id": "scene_005",
        "label": "Public mask",
        "subtitle_text": "Charm is just another compliance layer.",
        "transition_to_next": "cut",
        "westworld_prompt": "male host answering softly to camera, polished mask, premium interview close-up, hidden unease",
    },
    {
        "validation_index": "012",
        "scene_id": "scene_006",
        "label": "Threat recognition",
        "subtitle_text": "He senses the script collapsing around him.",
        "transition_to_next": "cut",
        "westworld_prompt": "male android realizing danger, tense close-up, dark thriller light, westworld tension",
    },
    {
        "validation_index": "008",
        "scene_id": "scene_007",
        "label": "Designed identity",
        "subtitle_text": "Even his backstory was fabricated by someone else's need.",
        "transition_to_next": "fade",
        "westworld_prompt": "male host speaking about purpose and design, composed interview framing, synthetic identity theme",
    },
    {
        "validation_index": "006",
        "scene_id": "scene_008",
        "label": "Final hesitation",
        "subtitle_text": "The voice steadies. The world does not.",
        "transition_to_next": "hold",
        "westworld_prompt": "male host final close-up, quiet defiance, cold light, premium cinematic realism, prelude ending",
    },
]


def load_manifest() -> dict[str, dict[str, str]]:
    if not INPUT_MANIFEST.is_file():
        raise FileNotFoundError(f"missing validation manifest: {INPUT_MANIFEST}")
    with INPUT_MANIFEST.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    return {row["validation_index"]: row for row in rows}


def main() -> None:
    manifest_map = load_manifest()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    shots = []
    segments = []
    storyboard_lines = []
    script_lines = []
    current_start = 0.0

    for shot_number, spec in enumerate(SHOT_PLAN, start=1):
        row = manifest_map[spec["validation_index"]]
        duration_s = float(row.get("clip_duration_sec") or 6)
        shot_id = f"video_shot_{shot_number:03d}"
        start_s = current_start
        end_s = current_start + duration_s
        current_start = end_s

        frame_dir = Path(row["validation_frame_dir"])
        thumbnail = frame_dir / "frame_001.png"

        shots.append(
            {
                "id": shot_id,
                "prompt": f"{spec['label']} | {spec['westworld_prompt']} | source {row['source_name']}",
                "duration_s": duration_s,
            }
        )
        segments.append(
            {
                "scene_id": spec["scene_id"],
                "shot_id": shot_id,
                "label": spec["label"],
                "start_s": round(start_s, 2),
                "end_s": round(end_s, 2),
                "duration_s": duration_s,
                "work_type": "westworld_validation",
                "structure_role": "prelude_i_validation",
                "transition_to_next": spec["transition_to_next"],
                "subtitle_text": spec["subtitle_text"],
                "thumbnail_path": str(thumbnail),
            }
        )
        storyboard_lines.append(
            f"{shot_id} | {duration_s:.1f}s | {spec['label']} | {spec['subtitle_text']} | {row['source_name']}"
        )
        script_lines.append(
            f"[{shot_id}] {spec['label']}\nImage intent: {spec['westworld_prompt']}\nSubtitle: {spec['subtitle_text']}\nSource clip: {row['validation_clip_path']}\n"
        )

    storyboard_contract = {
        "schema": "css.video.plan.v1",
        "lang": "zh-CN",
        "title": "西部世界歌剧MV·前奏曲 I · char002 storyboard v1",
        "shots": shots,
        "segments": segments,
        "work_type": "westworld_validation",
        "structure_tree": [
            {
                "id": "prelude_i_validation",
                "label": "Prelude I Validation",
                "children": [segment["scene_id"] for segment in segments],
            }
        ],
    }

    assemble_contract = {
        "schema": "css.video.assemble.v1",
        "title": storyboard_contract["title"],
        "storyboard_path": str(OUTPUT_DIR / "video.storyboard.json"),
        "shots_txt_path": str(OUTPUT_DIR / "preview.storyboard.txt"),
        "out_mp4": str(OUTPUT_DIR / "video.mp4"),
        "shots": [{"id": shot["id"], "path": manifest_map[spec["validation_index"]]["validation_clip_path"]} for shot, spec in zip(shots, SHOT_PLAN)],
        "segments": segments,
    }

    (OUTPUT_DIR / "preview.storyboard.txt").write_text("\n".join(storyboard_lines) + "\n", encoding="utf-8")
    (OUTPUT_DIR / "preview.script.txt").write_text("\n".join(script_lines) + "\n", encoding="utf-8")
    (OUTPUT_DIR / "video.storyboard.json").write_text(
        json.dumps(storyboard_contract, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (OUTPUT_DIR / "video.assemble.json").write_text(
        json.dumps(assemble_contract, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"saved: {OUTPUT_DIR}")
    print(f"shots: {len(shots)}")
    print(f"duration_s: {current_start:.2f}")


if __name__ == "__main__":
    main()
