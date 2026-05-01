#!/usr/bin/env python3
from __future__ import annotations

import csv
import html
import shutil
import subprocess
from pathlib import Path


V2_ROOT = Path("data/validation/char002_westworld_prelude_i_probe_v2")
V2_QC_ROOT = V2_ROOT / "qc"
V3_ROOT = Path("data/validation/char002_westworld_prelude_i_probe_v3")
V3_QC_ROOT = V3_ROOT / "qc"
REPORT_ROOT = V3_ROOT / "qc_compare"
PUBLIC_SLUG = "char002-westworld-prelude-i-probe-v3-qc"
PUBLIC_ROOT = Path("/srv/cssos/current/public/probes") / PUBLIC_SLUG
SITE_ROOT = "https://cssstudio.app"
TIMESTAMPS = [3, 9, 15, 21, 27, 33, 39, 45]

SHOT_ROWS = [
    {
        "shot_id": "video_shot_001",
        "label": "Cold awakening close-up",
        "v2_score": 9,
        "v3_score": 9,
        "status": "unchanged_keep",
        "summary": "Already the strongest shot in v2, so keeping it untouched was the right call.",
        "verdict": "Still a clear anchor shot.",
        "next_action": "Keep.",
    },
    {
        "shot_id": "video_shot_002",
        "label": "Memory fracture monologue",
        "v2_score": 4,
        "v3_score": 4,
        "status": "unchanged_replace",
        "summary": "No replacement was applied here, and it still reads like a present-day room monologue rather than premium sci-fi drama.",
        "verdict": "Still needs replacement.",
        "next_action": "Replace in next round.",
    },
    {
        "shot_id": "video_shot_003",
        "label": "Interior doubt",
        "v2_score": 3,
        "v3_score": 6,
        "status": "improved_borderline",
        "summary": "The new side-profile shot is cleaner and more controlled than the murky multi-person v2 frame, but it is still more generic arthouse than Westworld-specific.",
        "verdict": "Meaningful improvement, but not final.",
        "next_action": "Keep temporarily; upgrade later if a stronger profile close-up arrives.",
    },
    {
        "shot_id": "video_shot_004",
        "label": "Audit close-up",
        "v2_score": 1,
        "v3_score": 8,
        "status": "improved_keep",
        "summary": "This is the biggest win. The dark hotel-room close-up restores male identity consistency and finally gives the 'under observation' feeling the scene wanted.",
        "verdict": "Replacement clearly worked.",
        "next_action": "Keep.",
    },
    {
        "shot_id": "video_shot_005",
        "label": "Public mask",
        "v2_score": 2,
        "v3_score": 7,
        "status": "improved_keep",
        "summary": "The half-lit dark close-up is much closer to the Westworld mask/performance idea than the colorful social-video original.",
        "verdict": "Replacement clearly worked.",
        "next_action": "Keep.",
    },
    {
        "shot_id": "video_shot_006",
        "label": "Threat recognition",
        "v2_score": 7,
        "v3_score": 7,
        "status": "unchanged_keep",
        "summary": "Still a decent theatrical silhouette with the right tension and stage-like darkness.",
        "verdict": "Still usable.",
        "next_action": "Keep unless a stronger single-subject close-up appears.",
    },
    {
        "shot_id": "video_shot_007",
        "label": "Designed identity",
        "v2_score": 1,
        "v3_score": 6,
        "status": "improved_borderline",
        "summary": "The black-stage monologue is far better than the wrong-person v2 shot, but it is still somewhat theatrical and abstract for the identity-design beat.",
        "verdict": "Replacement helped, but this is still a candidate for refinement.",
        "next_action": "Keep for now; replace later if a more cinematic single-person design shot appears.",
    },
    {
        "shot_id": "video_shot_008",
        "label": "Final hesitation",
        "v2_score": 6,
        "v3_score": 6,
        "status": "unchanged_borderline",
        "summary": "This remains emotionally useful, but subtitle pollution and domestic realism still keep it below final quality.",
        "verdict": "Still borderline.",
        "next_action": "Replace later if subtitle-free close-up is found.",
    },
]

STATUS_STYLE = {
    "improved_keep": ("Improved", "#17361f", "#97d8a5"),
    "improved_borderline": ("Improved", "#314119", "#d7e98d"),
    "unchanged_keep": ("Stable", "#15323c", "#8fd1ef"),
    "unchanged_borderline": ("Stable", "#403111", "#f2d17a"),
    "unchanged_replace": ("Needs Replace", "#3d1517", "#ff9d97"),
}


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def extract_frame(video_path: Path, out_path: Path, timestamp_s: int) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-ss",
            str(timestamp_s),
            "-i",
            str(video_path),
            "-frames:v",
            "1",
            "-vf",
            "scale=320:240:force_original_aspect_ratio=decrease,pad=320:240:(ow-iw)/2:(oh-ih)/2:black",
            str(out_path),
        ]
    )


def write_contact_sheet(image_paths: list[Path], output_path: Path) -> None:
    if not image_paths:
        return
    layout = []
    for index in range(len(image_paths)):
        col = index % 4
        row = index // 4
        layout.append(f"{col * 320}_{row * 240}")
    command = ["ffmpeg", "-y", "-loglevel", "error"]
    for image_path in image_paths:
        command.extend(["-i", str(image_path)])
    command.extend(
        [
            "-filter_complex",
            f"xstack=inputs={len(image_paths)}:layout={'|'.join(layout)}",
            str(output_path),
        ]
    )
    run(command)


def write_csv(rows: list[dict[str, str]], out_path: Path) -> None:
    fieldnames = [
        "shot_id",
        "label",
        "v2_score",
        "v3_score",
        "delta",
        "status",
        "summary",
        "verdict",
        "next_action",
        "v2_frame",
        "v3_frame",
    ]
    with out_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def build_html(rows: list[dict[str, str]], csv_name: str) -> str:
    improved = ", ".join(row["shot_id"] for row in rows if int(row["delta"]) > 0)
    still_replace = ", ".join(
        row["shot_id"] for row in rows if row["next_action"].lower().startswith("replace")
    )
    cards = []
    for row in rows:
        badge, bg, fg = STATUS_STYLE[row["status"]]
        cards.append(
            f"""
    <article class="card">
      <div class="compare">
        <div class="frame"><img src="{row['v2_frame']}" alt="{html.escape(row['label'])} v2" /><span>V2</span></div>
        <div class="frame"><img src="{row['v3_frame']}" alt="{html.escape(row['label'])} v3" /><span>V3</span></div>
      </div>
      <div class="meta">
        <div class="topline">
          <h2>{html.escape(row['shot_id'])} · {html.escape(row['label'])}</h2>
          <span class="pill" style="background:{bg};color:{fg}">{badge}</span>
        </div>
        <p class="score">V2 <strong>{row['v2_score']}</strong> → V3 <strong>{row['v3_score']}</strong> (delta {row['delta']})</p>
        <p>{html.escape(row['summary'])}</p>
        <p><strong>Verdict:</strong> {html.escape(row['verdict'])}</p>
        <p><strong>Next action:</strong> {html.escape(row['next_action'])}</p>
      </div>
    </article>
"""
        )
    cards_html = "\n".join(cards)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>char002 Westworld Prelude I Probe V3 QC Compare</title>
  <style>
    :root {{
      --bg: #090b0f;
      --panel: rgba(255,255,255,0.05);
      --line: rgba(255,255,255,0.08);
      --text: #f5efe3;
      --muted: #c8c1b4;
      --accent: #d6b97d;
    }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; background: radial-gradient(circle at top, #17120e 0%, #090b0f 45%, #050608 100%); color: var(--text); font-family: Georgia, serif; }}
    main {{ max-width: 1240px; margin: 0 auto; padding: 28px 18px 56px; }}
    h1 {{ font-size: 32px; margin: 0 0 12px; }}
    p {{ line-height: 1.65; color: var(--muted); }}
    a {{ color: #f4d39a; }}
    .hero {{ display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 20px; }}
    .panel {{ background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 18px; }}
    video, .sheet {{ width: 100%; border-radius: 16px; display: block; background: #000; }}
    .summary-grid {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }}
    .summary-item {{ background: rgba(255,255,255,0.04); border: 1px solid var(--line); border-radius: 16px; padding: 14px; }}
    .summary-item strong {{ display: block; color: var(--text); margin-bottom: 6px; font-size: 18px; }}
    .cards {{ display: grid; gap: 18px; margin-top: 22px; }}
    .card {{ background: var(--panel); border: 1px solid var(--line); border-radius: 20px; overflow: hidden; }}
    .compare {{ display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1px solid var(--line); }}
    .frame {{ position: relative; background: #000; }}
    .frame img {{ width: 100%; display: block; }}
    .frame span {{ position: absolute; top: 10px; left: 10px; font-size: 12px; background: rgba(0,0,0,.6); padding: 4px 8px; border-radius: 999px; }}
    .meta {{ padding: 16px; }}
    .topline {{ display: flex; gap: 12px; align-items: center; justify-content: space-between; }}
    h2 {{ margin: 0; font-size: 20px; }}
    .pill {{ border-radius: 999px; padding: 6px 10px; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }}
    .score strong {{ color: var(--accent); }}
    .footer {{ margin-top: 24px; font-size: 14px; }}
    @media (max-width: 960px) {{
      .hero {{ grid-template-columns: 1fr; }}
      .summary-grid {{ grid-template-columns: 1fr; }}
      .compare {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <main>
    <h1>char002 · 西部世界歌剧MV·前奏曲 I · Probe V3 对比 QC</h1>
    <p>这页逐 shot 对比 v2 与 v3。重点不是参数，而是替换后的真实疗效: 画面是不是更像《西部世界》、身份是否更稳、以及哪些 shot 仍然需要继续换。</p>
    <section class="hero">
      <div class="panel">
        <video controls playsinline poster="poster.jpg">
          <source src="video.mp4" type="video/mp4" />
        </video>
      </div>
      <div class="panel">
        <img class="sheet" src="contact_sheet_v3.jpg" alt="probe v3 contact sheet" />
      </div>
    </section>
    <section class="summary-grid">
      <div class="summary-item">
        <strong>明显变好</strong>
        <span>{html.escape(improved or 'None')}</span>
      </div>
      <div class="summary-item">
        <strong>还要继续换</strong>
        <span>{html.escape(still_replace or 'None')}</span>
      </div>
      <div class="summary-item">
        <strong>结论</strong>
        <span>V3 的替换是有效的，特别是 shot 004 和 005。当前最弱位点已经从“错误人物/风格严重跑偏”收敛到“还有 refinement 空间”。</span>
      </div>
    </section>
    <div class="cards">
      {cards_html}
    </div>
    <p class="footer">CSV report: <a href="{csv_name}">{csv_name}</a></p>
  </main>
</body>
</html>
"""


def main() -> None:
    probe_v3 = V3_ROOT / "probe_v3.mp4"
    poster = V3_ROOT / "poster.jpg"
    if not probe_v3.is_file():
        raise FileNotFoundError(f"missing video: {probe_v3}")
    if not poster.is_file():
        raise FileNotFoundError(f"missing poster: {poster}")
    if not V2_QC_ROOT.is_dir():
        raise FileNotFoundError(f"missing v2 qc: {V2_QC_ROOT}")

    V3_QC_ROOT.mkdir(parents=True, exist_ok=True)
    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)

    v3_frames: list[Path] = []
    for index, timestamp in enumerate(TIMESTAMPS, start=1):
        out_frame = V3_QC_ROOT / f"shot_{index:03d}.jpg"
        extract_frame(probe_v3, out_frame, timestamp)
        v3_frames.append(out_frame)
    write_contact_sheet(v3_frames, V3_QC_ROOT / "contact_sheet_v3.jpg")

    rows = []
    for index, base in enumerate(SHOT_ROWS, start=1):
        frame_name = f"shot_{index:03d}.jpg"
        rows.append(
            {
                **base,
                "delta": str(base["v3_score"] - base["v2_score"]),
                "v2_frame": f"v2_{frame_name}",
                "v3_frame": f"v3_{frame_name}",
            }
        )

    csv_path = REPORT_ROOT / "probe_v3_qc_compare.csv"
    html_path = REPORT_ROOT / "index.html"
    write_csv(rows, csv_path)
    html_path.write_text(build_html(rows, csv_path.name), encoding="utf-8")

    shutil.copy2(probe_v3, PUBLIC_ROOT / "video.mp4")
    shutil.copy2(poster, PUBLIC_ROOT / "poster.jpg")
    shutil.copy2(V3_QC_ROOT / "contact_sheet_v3.jpg", PUBLIC_ROOT / "contact_sheet_v3.jpg")
    shutil.copy2(csv_path, PUBLIC_ROOT / csv_path.name)
    shutil.copy2(html_path, PUBLIC_ROOT / "index.html")

    for index in range(1, 9):
        frame_name = f"shot_{index:03d}.jpg"
        shutil.copy2(V2_QC_ROOT / frame_name, PUBLIC_ROOT / f"v2_{frame_name}")
        shutil.copy2(V3_QC_ROOT / frame_name, PUBLIC_ROOT / f"v3_{frame_name}")

    print(f"report_root={REPORT_ROOT}")
    print(f"public_root={PUBLIC_ROOT}")
    print(f"browser_url={SITE_ROOT}/probes/{PUBLIC_SLUG}/")


if __name__ == "__main__":
    main()
