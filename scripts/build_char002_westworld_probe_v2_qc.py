#!/usr/bin/env python3
from __future__ import annotations

import csv
import html
import shutil
from pathlib import Path


PROBE_ROOT = Path("data/validation/char002_westworld_prelude_i_probe_v2")
QC_ROOT = PROBE_ROOT / "qc"
REPORT_ROOT = PROBE_ROOT / "qc_report"
PUBLIC_SLUG = "char002-westworld-prelude-i-probe-v2-qc"
PUBLIC_ROOT = Path("/srv/cssos/current/public/probes") / PUBLIC_SLUG
SITE_ROOT = "https://cssstudio.app"

SHOT_ASSESSMENTS = [
    {
        "shot_id": "video_shot_001",
        "label": "Cold awakening close-up",
        "frame": "shot_001.jpg",
        "tier": "keep",
        "westworld_score": 9,
        "priority_rank": 1,
        "summary": "Single male close-up, controlled performance, wood-panel backdrop feels like an interrogation chamber.",
        "verdict": "Most Westworld-like. Keep as anchor shot.",
        "replace_reason": "",
    },
    {
        "shot_id": "video_shot_006",
        "label": "Threat recognition",
        "frame": "shot_006.jpg",
        "tier": "keep",
        "westworld_score": 7,
        "priority_rank": 2,
        "summary": "Theatrical silhouette on black gives it a staged host-audit feeling, though performance energy is still contemporary.",
        "verdict": "Usable secondary shot. Keep unless a stronger single-subject close-up arrives.",
        "replace_reason": "",
    },
    {
        "shot_id": "video_shot_008",
        "label": "Final hesitation",
        "frame": "shot_008.jpg",
        "tier": "borderline",
        "westworld_score": 6,
        "priority_rank": 3,
        "summary": "Good emotional male close-up, but subtitle pollution and domestic room cues weaken the world model illusion.",
        "verdict": "Borderline useful. Replace after subtitle-free material is available.",
        "replace_reason": "Subtitle burn-in and ordinary room setting break immersion.",
    },
    {
        "shot_id": "video_shot_002",
        "label": "Memory fracture monologue",
        "frame": "shot_002.jpg",
        "tier": "replace",
        "westworld_score": 4,
        "priority_rank": 4,
        "summary": "Single male subject is present, but the standing-room setup reads like casual vlog content rather than premium sci-fi drama.",
        "verdict": "Replace when a tighter, more cinematic male monologue shot is available.",
        "replace_reason": "Too casual and present-day; insufficient Westworld atmosphere.",
    },
    {
        "shot_id": "video_shot_003",
        "label": "Interior doubt",
        "frame": "shot_003.jpg",
        "tier": "replace",
        "westworld_score": 3,
        "priority_rank": 5,
        "summary": "Very dark multi-person composition; identity clarity is low and the frame reads as generic drama coverage.",
        "verdict": "High-priority replacement.",
        "replace_reason": "Too dark, multi-person, and visually ambiguous for identity-locked validation.",
    },
    {
        "shot_id": "video_shot_005",
        "label": "Public mask",
        "frame": "shot_005.jpg",
        "tier": "replace",
        "westworld_score": 2,
        "priority_rank": 6,
        "summary": "The colorful styling and platform branding push this toward pop short-video aesthetics rather than Westworld gravitas.",
        "verdict": "High-priority replacement.",
        "replace_reason": "Logo and modern pop vibe are off-tone.",
    },
    {
        "shot_id": "video_shot_007",
        "label": "Designed identity",
        "frame": "shot_007.jpg",
        "tier": "replace",
        "westworld_score": 1,
        "priority_rank": 7,
        "summary": "Wrong identity and age profile for the male anchor line; interior lighting also feels domestic rather than constructed.",
        "verdict": "Immediate replacement required.",
        "replace_reason": "Wrong person for the current char002 anchor track.",
    },
    {
        "shot_id": "video_shot_004",
        "label": "Audit close-up",
        "frame": "shot_004.jpg",
        "tier": "replace",
        "westworld_score": 1,
        "priority_rank": 8,
        "summary": "Female subject on a white background breaks both identity consistency and world tone.",
        "verdict": "Immediate replacement required.",
        "replace_reason": "Wrong identity and studio backdrop are incompatible with target style.",
    },
]

TIER_STYLE = {
    "keep": ("Keep", "#17361f", "#97d8a5"),
    "borderline": ("Borderline", "#403111", "#f2d17a"),
    "replace": ("Replace", "#3d1517", "#ff9d97"),
}


def parse_storyboard(path: Path) -> dict[str, dict[str, str]]:
    items: dict[str, dict[str, str]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        shot_id, label, subtitle, source = [part.strip() for part in line.split("|", 3)]
        items[shot_id] = {
            "label": label,
            "subtitle": subtitle,
            "source": source,
        }
    return items


def write_csv(rows: list[dict[str, str]], out_path: Path) -> None:
    fieldnames = [
        "shot_id",
        "label",
        "westworld_score",
        "tier",
        "priority_rank",
        "summary",
        "verdict",
        "replace_reason",
        "subtitle",
        "source",
        "frame",
    ]
    with out_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def build_card(row: dict[str, str]) -> str:
    tier_label, bg, fg = TIER_STYLE[row["tier"]]
    frame_name = row["frame"]
    title = html.escape(row["label"])
    subtitle = html.escape(row["subtitle"])
    summary = html.escape(row["summary"])
    verdict = html.escape(row["verdict"])
    replace_reason = html.escape(row["replace_reason"])
    source = html.escape(row["source"])
    return f"""
    <article class="card">
      <img src="{frame_name}" alt="{title}" />
      <div class="meta">
        <div class="topline">
          <h2>{html.escape(row["shot_id"])} · {title}</h2>
          <span class="pill" style="background:{bg};color:{fg}">{tier_label}</span>
        </div>
        <p class="score">Westworld score: <strong>{row["westworld_score"]}/10</strong> · Replace priority: <strong>{row["priority_rank"]}</strong></p>
        <p>{summary}</p>
        <p><strong>Verdict:</strong> {verdict}</p>
        <p><strong>Subtitle intent:</strong> {subtitle}</p>
        <p><strong>Source clip:</strong> <code>{source}</code></p>
        <p><strong>Replace reason:</strong> {replace_reason or 'None'}</p>
      </div>
    </article>
    """


def build_html(rows: list[dict[str, str]], qc_csv_name: str) -> str:
    cards = "\n".join(build_card(row) for row in rows)
    keep_ids = ", ".join(row["shot_id"] for row in rows if row["tier"] == "keep")
    replace_ids = ", ".join(row["shot_id"] for row in rows if row["tier"] == "replace")
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>char002 Westworld Prelude I Probe V2 QC</title>
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
    body {{ margin: 0; background: radial-gradient(circle at top, #1a1410 0%, #090b0f 45%, #050608 100%); color: var(--text); font-family: Georgia, serif; }}
    main {{ max-width: 1180px; margin: 0 auto; padding: 28px 18px 56px; }}
    h1 {{ font-size: 32px; margin: 0 0 12px; }}
    p {{ line-height: 1.65; color: var(--muted); }}
    a {{ color: #f4d39a; }}
    .hero {{ display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 20px; align-items: start; }}
    .panel {{ background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 18px; backdrop-filter: blur(6px); }}
    video, .sheet {{ width: 100%; border-radius: 16px; background: #000; display: block; }}
    .summary-grid {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }}
    .summary-item {{ background: rgba(255,255,255,0.04); border: 1px solid var(--line); border-radius: 16px; padding: 14px; }}
    .summary-item strong {{ display: block; color: var(--text); margin-bottom: 6px; font-size: 18px; }}
    .cards {{ display: grid; gap: 18px; margin-top: 22px; }}
    .card {{ display: grid; grid-template-columns: 320px 1fr; gap: 16px; background: var(--panel); border: 1px solid var(--line); border-radius: 20px; overflow: hidden; }}
    .card img {{ width: 100%; height: 100%; object-fit: cover; display: block; background: #000; }}
    .meta {{ padding: 16px 16px 18px 0; }}
    .topline {{ display: flex; gap: 12px; align-items: center; justify-content: space-between; }}
    h2 {{ margin: 0; font-size: 20px; }}
    .pill {{ border-radius: 999px; padding: 6px 10px; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }}
    .score strong {{ color: var(--accent); }}
    code {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #e7dbc8; word-break: break-all; }}
    .footer {{ margin-top: 24px; font-size: 14px; }}
    @media (max-width: 960px) {{
      .hero {{ grid-template-columns: 1fr; }}
      .summary-grid {{ grid-template-columns: 1fr; }}
      .card {{ grid-template-columns: 1fr; }}
      .meta {{ padding: 0 16px 18px; }}
    }}
  </style>
</head>
<body>
  <main>
    <h1>char002 · 西部世界歌剧MV·前奏曲 I · Probe V2 镜头质量体检</h1>
    <p>这页用于快速判断当前 8 个验证镜头里，哪些最接近《西部世界》气质，哪些应优先替换。判断标准只看真实视频疗效，不看参数叙事：身份一致性、单人可读性、世界观氛围、字幕/logo 污染、镜头是否像可进入正式渲染链路的素材。</p>
    <section class="hero">
      <div class="panel">
        <video controls playsinline poster="poster.jpg">
          <source src="video.mp4" type="video/mp4" />
        </video>
      </div>
      <div class="panel">
        <img class="sheet" src="contact_sheet.jpg" alt="probe v2 contact sheet" />
      </div>
    </section>
    <section class="summary-grid">
      <div class="summary-item">
        <strong>最像西部世界</strong>
        <span>{html.escape(keep_ids or 'None')}</span>
      </div>
      <div class="summary-item">
        <strong>最该替换</strong>
        <span>{html.escape(replace_ids or 'None')}</span>
      </div>
      <div class="summary-item">
        <strong>结构结论</strong>
        <span>当前 probe 可播，但镜头纯度仍偏低。下一轮应围绕单人男性近景、黑/木背景、无字幕来源继续补抓。</span>
      </div>
    </section>
    <div class="cards">
      {cards}
    </div>
    <p class="footer">CSV report: <a href="{qc_csv_name}">{qc_csv_name}</a></p>
  </main>
</body>
</html>
"""


def main() -> None:
    probe_mp4 = PROBE_ROOT / "probe_v2.mp4"
    poster_jpg = PROBE_ROOT / "poster.jpg"
    storyboard_txt = PROBE_ROOT / "probe.storyboard.txt"

    if not probe_mp4.is_file():
        raise FileNotFoundError(f"missing video: {probe_mp4}")
    if not poster_jpg.is_file():
        raise FileNotFoundError(f"missing poster: {poster_jpg}")
    if not storyboard_txt.is_file():
        raise FileNotFoundError(f"missing storyboard: {storyboard_txt}")
    if not QC_ROOT.is_dir():
        raise FileNotFoundError(f"missing qc frames: {QC_ROOT}")

    storyboard = parse_storyboard(storyboard_txt)
    rows: list[dict[str, str]] = []
    for item in SHOT_ASSESSMENTS:
        merged = dict(item)
        merged.update(storyboard.get(item["shot_id"], {}))
        if not merged.get("label"):
            raise RuntimeError(f"missing storyboard label for {item['shot_id']}")
        rows.append(merged)

    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    report_csv = REPORT_ROOT / "probe_v2_qc.csv"
    report_html = REPORT_ROOT / "index.html"
    write_csv(rows, report_csv)
    report_html.write_text(build_html(rows, report_csv.name), encoding="utf-8")

    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    shutil.copy2(probe_mp4, PUBLIC_ROOT / "video.mp4")
    shutil.copy2(poster_jpg, PUBLIC_ROOT / "poster.jpg")
    shutil.copy2(QC_ROOT / "contact_sheet.jpg", PUBLIC_ROOT / "contact_sheet.jpg")
    shutil.copy2(report_csv, PUBLIC_ROOT / report_csv.name)
    shutil.copy2(report_html, PUBLIC_ROOT / "index.html")
    for row in rows:
        shutil.copy2(QC_ROOT / row["frame"], PUBLIC_ROOT / row["frame"])

    print(f"report_root={REPORT_ROOT}")
    print(f"public_root={PUBLIC_ROOT}")
    print(f"browser_url={SITE_ROOT}/probes/{PUBLIC_SLUG}/")


if __name__ == "__main__":
    main()
