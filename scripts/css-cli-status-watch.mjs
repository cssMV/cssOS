import process from "node:process";

function parseArgs(argv) {
  const out = { run: null, base: "https://cssstudio.app", watch: false, intervalMs: 500 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--run") out.run = argv[++i] || null;
    else if (a === "--base") out.base = (argv[++i] || "").replace(/\/+$/, "");
    else if (a === "--watch") out.watch = true;
    else if (a === "--interval-ms") out.intervalMs = Number(argv[++i] || "500");
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H");
}

function fmtList(arr, empty = "[]") {
  if (!arr || arr.length === 0) return empty;
  return `[${arr.join(", ")}]`;
}

function normalizeStages(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (typeof x === "string") return x;
      if (x && typeof x === "object" && typeof x.stage === "string") return x.stage;
      return null;
    })
    .filter(Boolean);
}

function render(data) {
  const ready = normalizeStages(data.ready);
  const running = normalizeStages(data.running);
  const summary = (data && typeof data.summary === "object" && data.summary) || {};
  const pending = Number(summary.pending ?? 0);
  const runningCount = Number(summary.running ?? running.length);
  const succeeded = Number(summary.succeeded ?? 0);
  const failed = Number(summary.failed ?? 0);
  const skipped = Number(summary.skipped ?? 0);
  const updatedAt = data.updated_at || "";
  const status = String(data.status || "");

  const lines = [];
  lines.push(`READY: ${ready.length ? ready.join(", ") : "-"}`);
  lines.push(`RUNNING: ${running.length ? running.join(", ") : "-"}`);
  lines.push(
    `SUMMARY: pending=${pending} running=${runningCount} succeeded=${succeeded} failed=${failed} skipped=${skipped} status=${status} updated_at=${updatedAt}`
  );
  return lines.join("\n");
}

async function fetchReady(base, runId) {
  const url = `${base}/cssapi/v1/runs/${encodeURIComponent(runId)}/ready`;
  const res = await fetch(url, { method: "GET", headers: { accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`HTTP ${res.status} ${res.statusText} for ${url}\n${text}`);
    err.status = res.status;
    throw err;
  }
  return await res.json();
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.run) {
    process.stderr.write("missing --run <RUN_ID>\n");
    process.exit(1);
  }

  const runId = args.run;
  const base = args.base;
  const intervalMs = 500;

  if (!args.watch) {
    const data = await fetchReady(base, runId);
    process.stdout.write(render(data) + "\n");
    const st = String(data.status || "");
    if (st === "SUCCEEDED") process.exit(0);
    if (st === "FAILED") process.exit(1);
    if (st === "CANCELLED") process.exit(2);
    process.exit(0);
  }

  let last = "";
  for (;;) {
    try {
      const data = await fetchReady(base, runId);
      const out = render(data);

      if (out !== last) {
        clearScreen();
        process.stdout.write(out + "\n");
        last = out;
      }

      const st = String(data.status || "");
      if (st === "SUCCEEDED") process.exit(0);
      if (st === "FAILED") process.exit(1);
      if (st === "CANCELLED") process.exit(2);
    } catch (e) {
      clearScreen();
      process.stdout.write(`status --watch error: ${e?.message || String(e)}\n`);
    }

    await sleep(intervalMs);
  }
}

main().catch((e) => {
  process.stderr.write((e?.stack || e?.message || String(e)) + "\n");
  process.exit(1);
});
