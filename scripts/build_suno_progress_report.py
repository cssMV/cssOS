#!/usr/bin/env python3
import argparse
import csv
import html
import json
from pathlib import Path


def load_json(path: Path):
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def count_assets(asset_root: Path):
    files = list(asset_root.glob("*")) if asset_root.exists() else []
    return {
        "mp3": sum(1 for p in files if p.suffix == ".mp3"),
        "lyrics": sum(1 for p in files if p.name.endswith(".lyrics.txt")),
        "meta": sum(1 for p in files if p.name.endswith(".suno.json")),
    }


def recent_songs(asset_root: Path, limit: int = 20):
    if not asset_root.exists():
        return []
    files = [p for p in asset_root.glob("*.mp3") if p.is_file()]
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    out = []
    for path in files[:limit]:
        out.append(
            {
                "name": path.name,
                "size": path.stat().st_size,
            }
        )
    return out


def write_field_csvs(repair_plan, export_dir: Path):
    export_dir.mkdir(parents=True, exist_ok=True)
    export_rows = []
    for item in repair_plan.get("field_plans") or []:
        field = str(item.get("field") or "").strip()
        if not field:
            continue
        csv_path = export_dir / f"{field}.csv"
        with csv_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=["field", "batch_index", "sample_id", "title", "audio_path"],
            )
            writer.writeheader()
            for batch in item.get("batches") or []:
                titles = batch.get("titles") or []
                sample_ids = batch.get("sample_ids") or []
                audio_paths = batch.get("audio_paths") or []
                size = max(len(titles), len(sample_ids), len(audio_paths))
                for idx in range(size):
                    writer.writerow(
                        {
                            "field": field,
                            "batch_index": batch.get("batch_index"),
                            "sample_id": sample_ids[idx] if idx < len(sample_ids) else "",
                            "title": titles[idx] if idx < len(titles) else "",
                            "audio_path": audio_paths[idx] if idx < len(audio_paths) else "",
                        }
                    )
        export_rows.append((field, csv_path.name))
    return export_rows


def render_kv_rows(mapping):
    rows = []
    for key, value in mapping.items():
        rows.append(
            f"<tr><td>{html.escape(str(key))}</td><td>{html.escape(str(value))}</td></tr>"
        )
    return "\n".join(rows)


def main():
    parser = argparse.ArgumentParser(description="Build a public HTML progress page for a Suno channel import.")
    parser.add_argument("--channel", required=True)
    parser.add_argument("--asset-root", required=True)
    parser.add_argument("--repair-plan-json", required=True)
    parser.add_argument("--queue-stats-json", required=True)
    parser.add_argument("--archive-file", required=True)
    parser.add_argument("--training-ready-stats-json", default="")
    parser.add_argument("--output-html", required=True)
    args = parser.parse_args()

    asset_root = Path(args.asset_root).expanduser().resolve()
    repair_plan = load_json(Path(args.repair_plan_json).expanduser().resolve())
    queue_stats = load_json(Path(args.queue_stats_json).expanduser().resolve())
    training_ready_stats = load_json(Path(args.training_ready_stats_json).expanduser().resolve()) if args.training_ready_stats_json else {}
    archive_file = Path(args.archive_file).expanduser().resolve()
    output_html = Path(args.output_html).expanduser().resolve()

    asset_counts = count_assets(asset_root)
    recent = recent_songs(asset_root)
    archived_count = 0
    if archive_file.exists():
        archived_count = len([line for line in archive_file.read_text(encoding="utf-8").splitlines() if line.strip()])

    records_seen = int(training_ready_stats.get("records_seen") or 0)
    training_ready_records = int(training_ready_stats.get("training_ready_records") or 0)
    training_ready_rate = 0.0
    if records_seen > 0:
        training_ready_rate = (training_ready_records / records_seen) * 100.0

    field_plan_rows = []
    field_completion_rows = []
    for item in repair_plan.get("field_plans") or []:
        field = str(item.get("field") or "")
        sample_count = int(item.get("sample_count") or 0)
        complete_count = max(records_seen - sample_count, 0) if records_seen else 0
        complete_rate = (complete_count / records_seen * 100.0) if records_seen else 0.0
        progress_width = f"{complete_rate:.1f}%"
        field_plan_rows.append(
            "<tr>"
            f"<td>{html.escape(field)}</td>"
            f"<td>{html.escape(str(sample_count))}</td>"
            f"<td>{html.escape(str(item.get('batch_size') or 0))}</td>"
            f"<td>{html.escape(str(len(item.get('batches') or [])))}</td>"
            "</tr>"
        )
        field_completion_rows.append(
            "<tr>"
            f"<td>{html.escape(field)}</td>"
            f"<td>{html.escape(str(complete_count))}/{html.escape(str(records_seen))}</td>"
            f"<td><div style=\"background:#222833;border-radius:999px;height:10px;overflow:hidden\"><div style=\"width:{progress_width};height:10px;background:linear-gradient(90deg,#87e6a8,#5cc8ff)\"></div></div></td>"
            f"<td>{complete_rate:.1f}%</td>"
            "</tr>"
        )

    priority_rows = []
    for item in repair_plan.get("field_plans") or []:
        batches = item.get("batches") or []
        if not batches:
            continue
        batch = batches[0]
        preview_titles = ", ".join((batch.get("titles") or [])[:3])
        priority_rows.append(
            "<tr>"
            f"<td>{html.escape(str(item.get('field') or ''))}</td>"
            f"<td>{html.escape(str(batch.get('batch_size') or 0))}</td>"
            f"<td>{html.escape(preview_titles)}</td>"
            "</tr>"
        )

    recent_rows = []
    for item in recent:
        recent_rows.append(
            "<tr>"
            f"<td>{html.escape(item['name'])}</td>"
            f"<td>{html.escape(str(item['size']))}</td>"
            "</tr>"
        )

    details_blocks = []
    for item in repair_plan.get("field_plans") or []:
        field = str(item.get("field") or "")
        batches = item.get("batches") or []
        if not batches:
            continue
        first_batch = batches[0]
        sample_items = []
        titles = first_batch.get("titles") or []
        sample_ids = first_batch.get("sample_ids") or []
        audio_paths = first_batch.get("audio_paths") or []
        size = max(len(titles), len(sample_ids), len(audio_paths))
        for idx in range(min(size, 20)):
            title = titles[idx] if idx < len(titles) else ""
            sample_id = sample_ids[idx] if idx < len(sample_ids) else ""
            audio_path = audio_paths[idx] if idx < len(audio_paths) else ""
            sample_items.append(
                f"<tr><td>{html.escape(title)}</td><td>{html.escape(sample_id)}</td><td>{html.escape(audio_path)}</td></tr>"
            )
        details_blocks.append(
            "<details class=\"card\" style=\"margin-bottom:14px\">"
            f"<summary style=\"cursor:pointer;font-weight:700\">{html.escape(field)} · next batch {(first_batch.get('batch_size') or 0)} songs</summary>"
            "<div style=\"margin-top:12px\">"
            "<table><thead><tr><th>Title</th><th>Sample ID</th><th>Audio Path</th></tr></thead><tbody>"
            + "".join(sample_items)
            + "</tbody></table></div></details>"
        )

    export_rows = write_field_csvs(repair_plan, output_html.parent / "exports")
    export_links = []
    for field, file_name in export_rows:
        export_links.append(
            f"<a class=\"pill\" style=\"margin:0 10px 10px 0;text-decoration:none\" href=\"exports/{html.escape(file_name)}\">Export {html.escape(field)} CSV</a>"
        )

    output_html.parent.mkdir(parents=True, exist_ok=True)
    output_html.write_text(
        f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="30">
  <title>Suno Import Progress · {html.escape(args.channel)}</title>
  <style>
    :root {{
      --bg: #0f1115;
      --panel: #171a21;
      --line: #2a2f3a;
      --text: #f3f5f7;
      --muted: #aab3c2;
      --accent: #87e6a8;
      --warn: #ffd479;
    }}
    body {{ margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: linear-gradient(180deg, #0d1014, #121722); color: var(--text); }}
    .wrap {{ max-width: 1080px; margin: 0 auto; padding: 32px 20px 56px; }}
    .hero {{ margin-bottom: 24px; }}
    .hero h1 {{ margin: 0 0 8px; font-size: 32px; }}
    .hero p {{ margin: 0; color: var(--muted); }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin: 24px 0; }}
    .card {{ background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 18px; }}
    .metric {{ font-size: 34px; font-weight: 700; margin: 8px 0 4px; }}
    .label {{ color: var(--muted); font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; }}
    .section {{ margin-top: 26px; }}
    .section h2 {{ font-size: 18px; margin: 0 0 12px; }}
    table {{ width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }}
    td, th {{ padding: 12px 14px; border-bottom: 1px solid var(--line); text-align: left; }}
    th {{ color: var(--muted); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }}
    tr:last-child td {{ border-bottom: 0; }}
    .pill {{ display: inline-block; padding: 6px 10px; border-radius: 999px; background: rgba(135,230,168,0.12); color: var(--accent); border: 1px solid rgba(135,230,168,0.24); }}
    .warn {{ color: var(--warn); }}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>Suno Import Progress</h1>
      <p>Channel <span class="pill">@{html.escape(args.channel)}</span></p>
    </div>

    <div class="grid">
      <div class="card"><div class="label">Imported Songs</div><div class="metric">{asset_counts['mp3']}</div></div>
      <div class="card"><div class="label">Lyrics Sidecars</div><div class="metric">{asset_counts['lyrics']}</div></div>
      <div class="card"><div class="label">Metadata Sidecars</div><div class="metric">{asset_counts['meta']}</div></div>
      <div class="card"><div class="label">Archived Clip IDs</div><div class="metric">{archived_count}</div></div>
      <div class="card"><div class="label">Training Ready</div><div class="metric">{training_ready_records}</div></div>
      <div class="card"><div class="label">Ready Rate</div><div class="metric">{training_ready_rate:.1f}%</div></div>
    </div>

    <div class="section">
      <h2>Annotation Queue</h2>
      <table>
        <tbody>
          {render_kv_rows(queue_stats.get('by_bucket') or {{}})}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Missing Fields</h2>
      <table>
        <tbody>
          {render_kv_rows(repair_plan.get('missing_field_counts') or {{}})}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Repair Plan</h2>
      <table>
        <thead>
          <tr><th>Field</th><th>Samples</th><th>Batch Size</th><th>Batches</th></tr>
        </thead>
        <tbody>
          {"".join(field_plan_rows)}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Field Completion</h2>
      <table>
        <thead>
          <tr><th>Field</th><th>Completed</th><th>Progress</th><th>Rate</th></tr>
        </thead>
        <tbody>
          {"".join(field_completion_rows)}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Next Priority Batch</h2>
      <table>
        <thead>
          <tr><th>Field</th><th>Batch Size</th><th>Sample Preview</th></tr>
        </thead>
        <tbody>
          {"".join(priority_rows)}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Batch Exports</h2>
      <div>{"".join(export_links)}</div>
    </div>

    <div class="section">
      <h2>Expandable Samples</h2>
      {"".join(details_blocks)}
    </div>

    <div class="section">
      <h2>Recent 20 Songs</h2>
      <table>
        <thead>
          <tr><th>Song File</th><th>Bytes</th></tr>
        </thead>
        <tbody>
          {"".join(recent_rows)}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Storage</h2>
      <p class="warn">Auto-refresh every 30 seconds. Training assets are stored on the asset server path, not on the local laptop.</p>
      <table>
        <tbody>
          <tr><td>Asset Root</td><td>{html.escape(str(asset_root))}</td></tr>
          <tr><td>Archive File</td><td>{html.escape(str(archive_file))}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
""",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
