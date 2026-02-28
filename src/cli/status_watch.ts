type ReadyResp = {
  schema: string;
  run_id: string;
  updated_at: string;
  status: string;
  ready: string[];
  running: string[] | { stage: string }[];
  blocked?: string[];
  done?: string[];
  summary?: {
    total?: number;
    pending?: number;
    running?: number;
    succeeded?: number;
    failed?: number;
    skipped?: number;
    status?: string;
    updated_at?: string;
  };
  dag?: { schema?: string; topo_order?: string[] } | any;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

function fmtList(label: string, xs: string[], max = 12) {
  const items = xs.slice(0, max);
  const more = xs.length > max ? ` (+${xs.length - max})` : "";
  return `${label}: ${items.length ? items.join(", ") : "-"}${more}`;
}

function normalizeRunning(running: ReadyResp["running"]): string[] {
  if (!Array.isArray(running)) return [];
  if (running.length === 0) return [];
  if (typeof running[0] === "string") return running as string[];
  return (running as { stage: string }[]).map((x) => x.stage).filter(Boolean);
}

export async function statusWatch(opts: {
  baseUrl: string;
  runId: string;
  intervalMs?: number;
}) {
  const intervalMs = opts.intervalMs ?? 500;
  const base = opts.baseUrl.replace(/\/+$/, "");
  const url = `${base}/cssapi/v1/runs/${encodeURIComponent(opts.runId)}/ready`;

  for (;;) {
    let data: ReadyResp | null = null;
    let err: string | null = null;

    try {
      const r = await fetch(url, { method: "GET" });
      if (!r.ok) {
        err = `HTTP ${r.status}`;
      } else {
        data = (await r.json()) as ReadyResp;
      }
    } catch (e: unknown) {
      err = e instanceof Error ? e.message : String(e);
    }

    process.stdout.write("\x1b[2J\x1b[H");

    if (err || !data) {
      process.stdout.write(`run=${opts.runId}\n`);
      process.stdout.write(`error=${err || "unknown"}\n`);
      await sleep(intervalMs);
      continue;
    }

    const ready = uniq(data.ready || []);
    const running = uniq(normalizeRunning(data.running));
    const done = (data.done || []).length;
    const blocked = (data.blocked || []).length;

    process.stdout.write(`run=${data.run_id}  status=${data.status}  updated_at=${data.updated_at}\n`);
    if (data.dag?.topo_order?.length) {
      process.stdout.write(`dag=${data.dag.schema || "-"}  nodes=${data.dag.topo_order.length}\n`);
    }
    process.stdout.write("\n");
    process.stdout.write(fmtList("READY", ready) + "\n");
    process.stdout.write(fmtList("RUNNING", running) + "\n");
    process.stdout.write("\n");

    if (data.summary) {
      process.stdout.write(
        `SUMMARY total=${data.summary.total ?? "-"} pending=${data.summary.pending ?? "-"} running=${data.summary.running ?? "-"} succeeded=${data.summary.succeeded ?? "-"} failed=${data.summary.failed ?? "-"} skipped=${data.summary.skipped ?? "-"}\n`
      );
    }

    process.stdout.write(`DONE=${done}  BLOCKED=${blocked}\n`);

    if (
      String(data.status).includes("SUCCEEDED") ||
      String(data.status).includes("FAILED") ||
      String(data.status).includes("CANCELLED")
    ) {
      process.stdout.write("\nfinished\n");
      return;
    }

    await sleep(intervalMs);
  }
}
