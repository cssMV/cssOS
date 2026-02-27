use serde_json::Value;
use std::{fs, path::Path};

pub fn write_dag_html<P: AsRef<Path>>(out_path: P, dag_export_json: &Value) -> anyhow::Result<()> {
    let json_str = serde_json::to_string(dag_export_json)?;
    let html = format!(r#"<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>cssMV DAG</title>
<style>
:root {{ --bg:#0b0f1a; --card:#121a2a; --muted:#9aa4b2; --text:#e6edf3; --ok:#1fda81; --fail:#ff5b5b; --run:#f7c948; --pend:#7aa2ff; --unk:#9aa4b2; }}
body {{ margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background:var(--bg); color:var(--text); }}
header {{ padding:16px 18px; border-bottom:1px solid rgba(255,255,255,.08); display:flex; gap:12px; align-items:center; }}
h1 {{ font-size:16px; margin:0; letter-spacing:.2px; }}
small {{ color:var(--muted); }}
main {{ padding:16px 18px; display:grid; grid-template-columns: 360px 1fr; gap:14px; }}
.card {{ background:var(--card); border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:12px; }}
.row {{ display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px dashed rgba(255,255,255,.08); }}
.row:last-child {{ border-bottom:none; }}
.badge {{ font-size:12px; padding:2px 8px; border-radius:999px; border:1px solid rgba(255,255,255,.12); color:var(--text); }}
.badge.OK {{ border-color: rgba(31,218,129,.4); }}
.badge.FAILED {{ border-color: rgba(255,91,91,.45); }}
.badge.RUNNING {{ border-color: rgba(247,201,72,.45); }}
.badge.PENDING {{ border-color: rgba(122,162,255,.45); }}
.badge.UNKNOWN {{ border-color: rgba(154,164,178,.35); color:var(--muted); }}

.grid {{ display:flex; gap:12px; align-items:flex-start; overflow:auto; padding-bottom:6px; }}
.col {{ min-width: 260px; }}
.col h3 {{ font-size:12px; margin:0 0 8px 0; color:var(--muted); font-weight:600; }}
.node {{ background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:10px; margin-bottom:10px; }}
.node .top {{ display:flex; justify-content:space-between; align-items:center; gap:10px; }}
.node .name {{ font-weight:650; font-size:13px; }}
.node .meta {{ color:var(--muted); font-size:12px; margin-top:6px; display:flex; gap:10px; flex-wrap:wrap; }}
.kv {{ display:flex; gap:6px; }}
.k {{ color:var(--muted); }}
a {{ color: #9bd2ff; text-decoration:none; }}
a:hover {{ text-decoration:underline; }}
pre {{ white-space:pre-wrap; word-break:break-word; margin:0; font-size:12px; color:var(--muted); }}
</style>
</head>
<body>
<header>
  <h1>cssMV DAG</h1>
  <small id="subtitle"></small>
</header>
<main>
  <section class="card">
    <div class="row"><div>Schema</div><div class="badge" id="schema"></div></div>
    <div class="row"><div>Nodes</div><div id="nodes_count"></div></div>
    <div class="row"><div>Edges</div><div id="edges_count"></div></div>
    <div class="row"><div>Artifacts</div><div id="artifacts_count"></div></div>
    <div style="margin-top:10px;">
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">Artifacts (graph)</div>
      <pre id="artifacts"></pre>
    </div>
  </section>
  <section class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;">
      <div style="font-weight:650;">Topological view</div>
      <small style="color:var(--muted);">Offline single-file</small>
    </div>
    <div class="grid" id="grid"></div>
  </section>
</main>

<script>
const DAG = {json_str};

function badgeClass(status) {{
  const s = (status||"UNKNOWN").toUpperCase();
  if (s.includes("FAIL")) return "FAILED";
  if (s.includes("RUN")) return "RUNNING";
  if (s.includes("OK") || s.includes("DONE") || s.includes("SUCCESS")) return "OK";
  if (s.includes("PEND")) return "PENDING";
  return "UNKNOWN";
}}

function topoLayers(nodes, edges) {{
  const indeg = new Map();
  const out = new Map();
  for (const n of nodes) {{ indeg.set(n.id, 0); out.set(n.id, []); }}
  for (const e of edges) {{
    if (!indeg.has(e.to) || !out.has(e.from)) continue;
    indeg.set(e.to, indeg.get(e.to)+1);
    out.get(e.from).push(e.to);
  }}
  const q = [];
  for (const [id,d] of indeg.entries()) if (d===0) q.push(id);

  const layerOf = new Map();
  for (const id of q) layerOf.set(id, 0);

  const order = [];
  while (q.length) {{
    const id = q.shift();
    order.push(id);
    const base = layerOf.get(id) || 0;
    for (const to of out.get(id) || []) {{
      indeg.set(to, indeg.get(to)-1);
      const cand = base + 1;
      const prev = layerOf.get(to);
      layerOf.set(to, prev==null ? cand : Math.max(prev, cand));
      if (indeg.get(to)===0) q.push(to);
    }}
  }}

  const maxLayer = Math.max(0, ...Array.from(layerOf.values()));
  const layers = Array.from({{length:maxLayer+1}}, ()=>[]);
  const byId = new Map(nodes.map(n=>[n.id,n]));
  for (const id of order) {{
    const l = layerOf.get(id) || 0;
    if (byId.has(id)) layers[l].push(byId.get(id));
  }}

  const missing = nodes.filter(n=>!layerOf.has(n.id));
  if (missing.length) layers.push(missing);

  return layers;
}}

function fmtMs(v) {{
  if (v==null) return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  if (n < 1000) return `${{n}}ms`;
  return `${{(n/1000).toFixed(2)}}s`;
}}

(function render() {{
  document.getElementById("schema").textContent = DAG.schema || "unknown";
  document.getElementById("schema").className = "badge " + badgeClass(DAG.schema||"UNKNOWN");

  const nodes = DAG.nodes || [];
  const edges = DAG.edges || [];
  const artifacts = DAG.artifacts || {{}};

  document.getElementById("nodes_count").textContent = String(nodes.length);
  document.getElementById("edges_count").textContent = String(edges.length);
  document.getElementById("artifacts_count").textContent = String(Object.keys(artifacts).length);
  document.getElementById("artifacts").textContent = JSON.stringify(artifacts, null, 2);

  const layers = topoLayers(nodes, edges);
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  layers.forEach((layer, idx) => {{
    const col = document.createElement("div");
    col.className = "col";
    const h = document.createElement("h3");
    h.textContent = `Layer ${{idx}}`;
    col.appendChild(h);

    layer.forEach(n => {{
      const card = document.createElement("div");
      card.className = "node";
      const top = document.createElement("div");
      top.className = "top";
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = n.id;

      const b = document.createElement("span");
      const st = (n.status||"UNKNOWN").toUpperCase();
      b.className = "badge " + badgeClass(st);
      b.textContent = st;

      top.appendChild(name);
      top.appendChild(b);
      card.appendChild(top);

      const meta = document.createElement("div");
      meta.className = "meta";

      const deps = Array.isArray(n.deps) ? n.deps : [];
      const kv1 = document.createElement("div");
      kv1.className = "kv";
      kv1.innerHTML = `<span class="k">deps</span><span>${{deps.length ? deps.join(", ") : "-"}}</span>`;
      meta.appendChild(kv1);

      const kv2 = document.createElement("div");
      kv2.className = "kv";
      kv2.innerHTML = `<span class="k">dur</span><span>${{fmtMs(n.duration_ms) || "-"}}</span>`;
      meta.appendChild(kv2);

      card.appendChild(meta);
      col.appendChild(card);
    }});

    grid.appendChild(col);
  }});

  const sub = document.getElementById("subtitle");
  sub.textContent = `nodes=${{nodes.length}} edges=${{edges.length}}`;
}})();
</script>
</body>
</html>
"#);

    if let Some(parent) = out_path.as_ref().parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(out_path, html)?;
    Ok(())
}
