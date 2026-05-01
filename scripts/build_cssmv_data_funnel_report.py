#!/usr/bin/env python3
from __future__ import annotations

import csv
import html
import shutil
from pathlib import Path


REPORT_ROOT = Path("data/reports/cssmv_data_funnel")
PUBLIC_ROOT = Path("/srv/cssos/current/public/probes/cssmv-data-funnel")
SITE_URL = "https://cssstudio.app/probes/cssmv-data-funnel/"


def count_csv_rows(path: Path) -> int:
    if not path.exists():
        return 0
    return len(list(csv.DictReader(path.open(encoding="utf-8"))))


def count_csv_status(path: Path, status: str) -> int:
    if not path.exists():
        return 0
    return sum(1 for row in csv.DictReader(path.open(encoding="utf-8")) if row.get("status") == status)


def count_files(path: Path, suffix: str = ".mp4") -> int:
    if not path.exists():
        return 0
    return sum(1 for p in path.iterdir() if p.is_file() and p.name.endswith(suffix))


def format_ratio(a: int, b: int) -> str:
    if not b:
        return "0.0%"
    return f"{(a / b) * 100:.1f}%"


def build_metrics(repo_root: Path) -> dict[str, int]:
    day3_keep = count_csv_status(repo_root / "data/meta/day3_triage/day3_character_triage.csv", "keep")
    day4_keep = count_csv_rows(repo_root / "data/meta/day4_triage/keep_shortlist/day4_keep_shortlist.csv")
    day5_keep = count_csv_rows(repo_root / "data/meta/day5_replacement_triage/keep_shortlist/char002_replacement_keep_shortlist.csv")
    day6_keep = count_csv_status(repo_root / "data/meta/day6_targeted_triage/day6_targeted_triage.csv", "keep")

    current_raw = sum(
        count_files(repo_root / rel)
        for rel in [
            "data/raw_char/char001",
            "data/raw_char/char002",
            "data/raw_char/char003",
            "data/raw_char/char002_replacements",
            "data/raw_char/char002_shot002_replacements",
            "data/raw_char/char002_shot008_replacements",
        ]
    )

    return {
        "historical_raw_total": 631,
        "current_raw_retained": current_raw,
        "historical_keep_total": day3_keep + day4_keep + day5_keep + day6_keep,
        "clean_set_total": count_csv_rows(repo_root / "data/clean_sets/char002_v1/manifest.csv"),
        "validation_total": count_csv_rows(repo_root / "data/validation/char002_westworld_prelude_i_v1/manifest.csv"),
        "probe_total": count_files(repo_root / "data/validation/char002_westworld_prelude_i_probe_v3/normalized_shots"),
        "day3_keep": day3_keep,
        "day4_keep": day4_keep,
        "day5_keep": day5_keep,
        "day6_keep": day6_keep,
    }


def write_csv(path: Path, metrics: dict[str, int]) -> None:
    fieldnames = ["stage", "count", "ratio_vs_historical_raw"]
    rows = [
        ("historical_raw_total", metrics["historical_raw_total"]),
        ("current_raw_retained", metrics["current_raw_retained"]),
        ("historical_keep_total", metrics["historical_keep_total"]),
        ("clean_set_total", metrics["clean_set_total"]),
        ("validation_total", metrics["validation_total"]),
        ("probe_total", metrics["probe_total"]),
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for stage, count in rows:
            writer.writerow(
                {
                    "stage": stage,
                    "count": count,
                    "ratio_vs_historical_raw": format_ratio(count, metrics["historical_raw_total"]),
                }
            )


def build_html(metrics: dict[str, int]) -> str:
    funnel = [
        ("Historical Raw", metrics["historical_raw_total"]),
        ("Historical Keep", metrics["historical_keep_total"]),
        ("Clean Set V1", metrics["clean_set_total"]),
        ("Validation Pack", metrics["validation_total"]),
        ("Probe V3 Shots", metrics["probe_total"]),
    ]
    max_count = max(count for _, count in funnel) or 1
    cards = []
    for label, count in funnel:
        width = max(8, int((count / max_count) * 100))
        cards.append(
            f"""
      <div class="funnel-row">
        <div class="funnel-label">{html.escape(label)}</div>
        <div class="bar-wrap"><div class="bar" style="width:{width}%"></div></div>
        <div class="funnel-count">{count}</div>
      </div>
"""
        )

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>cssMV Data Funnel</title>
  <style>
    body {{ margin: 0; font-family: Georgia, serif; background: radial-gradient(circle at top, #19130f 0%, #0a0d12 45%, #05070a 100%); color: #f5efe3; }}
    main {{ max-width: 1120px; margin: 0 auto; padding: 32px 20px 60px; }}
    h1 {{ font-size: 34px; margin: 0 0 12px; }}
    p {{ color: #c8c1b4; line-height: 1.65; }}
    .stats {{ display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; margin: 22px 0; }}
    .card {{ background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); border-radius: 18px; padding: 16px; }}
    .card strong {{ display: block; font-size: 24px; margin-bottom: 6px; }}
    .funnel {{ background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); border-radius: 20px; padding: 18px; margin-top: 20px; }}
    .funnel-row {{ display: grid; grid-template-columns: 180px 1fr 90px; gap: 14px; align-items: center; margin: 14px 0; }}
    .funnel-label {{ color: #f2e8d6; }}
    .bar-wrap {{ height: 18px; background: rgba(255,255,255,.06); border-radius: 999px; overflow: hidden; }}
    .bar {{ height: 100%; border-radius: 999px; background: linear-gradient(90deg, #5e4729 0%, #c7a76b 100%); }}
    .funnel-count {{ text-align: right; color: #f4d39a; font-variant-numeric: tabular-nums; }}
    .notes {{ margin-top: 24px; }}
    .notes li {{ margin: 8px 0; color: #d3cbbe; }}
    code {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #f4d39a; }}
    @media (max-width: 900px) {{
      .stats {{ grid-template-columns: 1fr 1fr; }}
      .funnel-row {{ grid-template-columns: 1fr; }}
      .funnel-count {{ text-align: left; }}
    }}
  </style>
</head>
<body>
  <main>
    <h1>cssMV Data Funnel</h1>
    <p>这页只看真实数据漏斗，不看参数宣传。当前阶段我们还在“高纯度素材工程 + 小规模视频验证”阶段，不是在做 Sora 级别的大规模世界模型训练。</p>
    <section class="stats">
      <div class="card"><strong>{metrics["historical_raw_total"]}</strong>累计抓过的 raw</div>
      <div class="card"><strong>{metrics["historical_keep_total"]}</strong>人工筛出 keep</div>
      <div class="card"><strong>{metrics["clean_set_total"]}</strong>进入 clean set v1</div>
      <div class="card"><strong>{metrics["probe_total"]}</strong>真正进入 probe 的 shot</div>
    </section>
    <section class="funnel">
      {''.join(cards)}
    </section>
    <ul class="notes">
      <li><code>631 -> 44</code> 说明历史 raw 到 keep 的整体有效率约为 <strong>{format_ratio(metrics["historical_keep_total"], metrics["historical_raw_total"])}</strong>。</li>
      <li><code>631 -> 23</code> 说明真正进入主线 clean set 的比例约为 <strong>{format_ratio(metrics["clean_set_total"], metrics["historical_raw_total"])}</strong>。</li>
      <li>当前盘上保留的 raw 约 <strong>{metrics["current_raw_retained"]}</strong> 条，是清理过后的工作集，不等于历史累计抓取量。</li>
      <li>目前 `char002` 是唯一真正走通到 `clean -> validation -> probe` 的角色主线。</li>
      <li>分项 keep: Day3={metrics["day3_keep"]}, Day4={metrics["day4_keep"]}, Day5={metrics["day5_keep"]}, Day6={metrics["day6_keep"]}。</li>
    </ul>
  </main>
</body>
</html>
"""


def main() -> None:
    repo_root = Path.cwd()
    metrics = build_metrics(repo_root)
    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    csv_path = REPORT_ROOT / "cssmv_data_funnel.csv"
    html_path = REPORT_ROOT / "index.html"
    write_csv(csv_path, metrics)
    html_path.write_text(build_html(metrics), encoding="utf-8")

    shutil.copy2(csv_path, PUBLIC_ROOT / csv_path.name)
    shutil.copy2(html_path, PUBLIC_ROOT / "index.html")

    print(f"report_root={REPORT_ROOT}")
    print(f"public_root={PUBLIC_ROOT}")
    print(f"browser_url={SITE_URL}")


if __name__ == "__main__":
    main()
