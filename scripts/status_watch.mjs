function parseArgs(args) {
  let runId = null;
  let base = process.env.CSS_API_BASE || "https://cssstudio.app";
  let intervalMs = 500;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--run" && i + 1 < args.length) {
      runId = args[++i];
      continue;
    }
    if (a === "--base" && i + 1 < args.length) {
      base = args[++i];
      continue;
    }
    if (a === "--interval-ms" && i + 1 < args.length) {
      const n = Number(args[++i]);
      if (Number.isFinite(n) && n > 0) intervalMs = n;
      continue;
    }
    if (!a.startsWith("--") && !runId) {
      runId = a;
      continue;
    }
  }

  return { runId, base: base.replace(/\/+$/, ""), intervalMs };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clear() {
  process.stdout.write("\x1b[2J\x1b[H");
}

function fmtList(xs) {
  if (!xs || xs.length === 0) return "[]";
  return `[${xs.join(", ")}]`;
}

function normalizeRunning(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (typeof x === "string") return x;
      if (x && typeof x === "object" && typeof x.stage === "string") return x.stage;
      return null;
    })
    .filter(Boolean);
}

function countSummary(body, ready, running) {
  const s = body && typeof body.summary === "object" ? body.summary : {};
  let pending = Number(s.pending ?? body.pending ?? ready.length);
  let succeeded = Number(s.succeeded ?? body.succeeded ?? 0);
  let failed = Number(s.failed ?? body.failed ?? 0);

  if (body?.dag?.nodes && Array.isArray(body.dag.nodes)) {
    const total = body.dag.nodes.length;
    if (String(body?.status || "") === "SUCCEEDED" && succeeded === 0 && failed === 0) {
      succeeded = total;
      pending = 0;
    } else if ((!Number.isFinite(pending) || pending === 0) && !(succeeded > 0 || failed > 0)) {
      pending = Math.max(0, total - succeeded - failed - running.length);
    }
  }

  return {
    pending: Number.isFinite(pending) ? pending : 0,
    succeeded: Number.isFinite(succeeded) ? succeeded : 0,
    failed: Number.isFinite(failed) ? failed : 0,
  };
}

export async function statusWatch(args) {
  const { runId, base, intervalMs } = parseArgs(args);
  if (!runId) {
    process.stderr.write(
      "usage: css status --watch <run_id> [--base <url>] [--interval-ms <ms>]\n"
    );
    process.exit(2);
  }

  const url = `${base}/cssapi/v1/runs/${encodeURIComponent(runId)}/ready`;

  for (;;) {
    let body = null;
    let err = null;
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) err = `HTTP ${res.status}`;
      else body = await res.json();
    } catch (e) {
      err = String(e && e.message ? e.message : e);
    }

    clear();
    if (err) {
      process.stdout.write(`run_id: ${runId}\n`);
      process.stdout.write("status: -\n");
      process.stdout.write("updated_at: -\n");
      process.stdout.write("ready:   []\n");
      process.stdout.write("running: []\n");
      process.stdout.write(`summary: pending=0 succeeded=0 failed=0\n`);
      process.stdout.write(`error: ${err}\n`);
      await sleep(intervalMs);
      continue;
    }

    const ready = Array.isArray(body.ready) ? body.ready : [];
    const running = normalizeRunning(body.running);
    const status = String(body.status || "");
    const updatedAt = body.updated_at || body.heartbeat_at || body?.summary?.updated_at || "";
    const summary = countSummary(body, ready, running);

    process.stdout.write(`run_id: ${body.run_id || runId}\n`);
    process.stdout.write(`status: ${status || "-"}\n`);
    process.stdout.write(`updated_at: ${updatedAt || "-"}\n`);
    process.stdout.write(`ready:   ${fmtList(ready)}\n`);
    process.stdout.write(`running: ${fmtList(running)}\n`);
    process.stdout.write(
      `summary: pending=${summary.pending} succeeded=${summary.succeeded} failed=${summary.failed}\n`
    );

    if (status === "SUCCEEDED") process.exit(0);
    if (status === "FAILED" || status === "CANCELLED") process.exit(2);

    await sleep(intervalMs);
  }
}
