import process from "node:process";

type ReadyView = {
  schema: string;
  run_id: string;
  status: string;
  topo_order: string[];
  ready: string[];
  running: string[];
  summary_text?: string;
  summary?: {
    total?: number;
    pending?: number;
    running?: number;
    succeeded?: number;
    failed?: number;
    skipped?: number;
  };
  blocking?: Array<{
    stage: string;
    reason: string;
    missing_deps?: string[];
    bad_outputs?: string[];
  }>;
  cancel_requested?: boolean;
  cancelled_at?: string | null;
  video_shots?: {
    total: number;
    ready: number;
    running: number;
    succeeded: number;
    failed: number;
    pending: number;
  };
  counters?: {
    pending?: number;
    running?: number;
    succeeded?: number;
    failed?: number;
    skipped?: number;
    killed_cancelled?: number;
    killed_timeout?: number;
  };
  running_pids?: Array<{
    stage: string;
    pid?: number | null;
    pgid?: number | null;
  }>;
  subtitles?: {
    status?: string;
    path?: string;
    burnin?: boolean;
    format?: string;
    lang?: string;
    ok?: boolean;
  };
};

function envStr(k: string, d: string) {
  const v = process.env[k];
  return v && v.length > 0 ? v : d;
}

function urlJoin(base: string, path: string) {
  let b = base;
  if (b.endsWith("/")) b = b.slice(0, -1);
  let p = path;
  if (!p.startsWith("/")) p = "/" + p;
  return b + p;
}

function fmtList(xs: string[], max: number) {
  const head = xs.slice(0, max);
  const more = xs.length > max ? ` +${xs.length - max}` : "";
  return head.join(", ") + more;
}

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H");
}

async function fetchReady(baseUrl: string, runId: string): Promise<ReadyView> {
  const u = urlJoin(baseUrl, `/cssapi/v1/runs/${encodeURIComponent(runId)}/ready`);
  const res = await fetch(u, {
    method: "GET",
    headers: { "cache-control": "no-store" },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`ready http=${res.status} ${t}`.trim());
  }
  return (await res.json()) as ReadyView;
}

function isDone(status: string) {
  const s = (status || "").toUpperCase();
  return s.includes("SUCCEEDED") || s.includes("FAILED") || s.includes("CANCELLED");
}

export async function statusWatch(opts: {
  baseUrl: string;
  runId: string;
  intervalMs?: number;
  listMax?: number;
  debugPids?: boolean;
}) {
  const intervalMs = opts.intervalMs ?? Number(envStr("CSS_WATCH_INTERVAL_MS", "500"));
  const listMax = opts.listMax ?? Number(envStr("CSS_WATCH_LIST_MAX", "12"));

  let last: ReadyView | null = null;

  for (;;) {
    let v: ReadyView;
    try {
      v = await fetchReady(opts.baseUrl, opts.runId);
      last = v;
    } catch (e: unknown) {
      clearScreen();
      const msg = e instanceof Error ? e.message : String(e);
      process.stdout.write(`run_id=${opts.runId}\n`);
      process.stdout.write(`error=${msg}\n`);
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }

    const readyN = v.ready?.length || 0;
    const runningN = v.running?.length || 0;
    const s = v.summary || {};
    const vs = v.video_shots || {
      total: 0,
      ready: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      pending: 0,
    };
    const ctr = v.counters || {};

    clearScreen();
    process.stdout.write(`run_id=${v.run_id}\n`);
    process.stdout.write(`status=${v.status}\n`);
    if (v.cancel_requested) {
      process.stdout.write(`cancel requested at=${v.cancelled_at ?? "NA"}\n`);
    }
    process.stdout.write("\n");
    process.stdout.write(`ready(${readyN})=${readyN ? fmtList(v.ready, listMax) : "-"}\n`);
    process.stdout.write(`running(${runningN})=${runningN ? fmtList(v.running, listMax) : "-"}\n`);
    process.stdout.write("\n");
    process.stdout.write(
      `summary total=${s.total ?? "-"} pending=${s.pending ?? "-"} running=${s.running ?? "-"} succeeded=${s.succeeded ?? "-"} failed=${s.failed ?? "-"} skipped=${s.skipped ?? "-"}\n`
    );
    process.stdout.write(`explain ${v.summary_text ?? "NA"}\n`);
    const subs = v.subtitles;
    process.stdout.write(
      `subtitles: ${subs?.ok ? "OK" : "MISS"} status=${subs?.status ?? "NA"} format=${subs?.format ?? "ass"} lang=${subs?.lang ?? "NA"} burnin=${subs?.burnin ? "1" : "0"} ${subs?.path ?? "build/subtitles.ass"}\n`
    );
    process.stdout.write(
      `video_shots total=${vs.total} ready=${vs.ready} running=${vs.running} ok=${vs.succeeded} fail=${vs.failed} pending=${vs.pending}\n`
    );
    process.stdout.write(
      `killed cancelled=${ctr.killed_cancelled ?? 0} timeout=${ctr.killed_timeout ?? 0}\n`
    );
    process.stdout.write(
      `counts pending=${ctr.pending ?? 0} running=${ctr.running ?? 0} succeeded=${ctr.succeeded ?? 0} failed=${ctr.failed ?? 0} skipped=${ctr.skipped ?? 0}\n`
    );
    if (opts.debugPids) {
      const pids = v.running_pids || [];
      for (const p of pids) {
        process.stdout.write(
          `pid stage=${p.stage} pid=${p.pid ?? "NA"} pgid=${p.pgid ?? "NA"}\n`
        );
      }
    }
    const blocks = (v.blocking || []).slice(0, 3);
    for (const b of blocks) {
      const miss = (b.missing_deps || []).slice(0, 6).join(",");
      const bo = (b.bad_outputs || []).slice(0, 2).join(",");
      if (miss) {
        process.stdout.write(`blocked ${b.stage} waiting ${miss}\n`);
      } else if (bo) {
        process.stdout.write(`blocked ${b.stage} bad_outputs ${bo}\n`);
      } else {
        process.stdout.write(`blocked ${b.stage} ${b.reason}\n`);
      }
    }

    if (isDone(v.status)) break;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  if (last) {
    process.stdout.write(`\nfinal_status=${last.status}\n`);
  }
}
