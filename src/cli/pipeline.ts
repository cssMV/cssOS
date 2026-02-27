import { Command } from "commander";

type StatusV1 = {
  schema: string;
  run_state_path: string;
  ready: string[];
  stages: { name: string; deps: string[]; status: string }[];
  video?: { shots_count?: number | null; storyboard?: string | null };
};

function nowIso(): string {
  return new Date().toISOString().replace("T", " ").replace("Z", "Z");
}

function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

function padRight(s: string, n: number): string {
  if (s.length >= n) return s;
  return s + " ".repeat(n - s.length);
}

function fmtShots(video?: StatusV1["video"]): string {
  const n = video?.shots_count;
  if (typeof n === "number" && Number.isFinite(n)) return String(n);
  return "-";
}

async function fetchJson(url: string): Promise<any> {
  const r = await fetch(url, { headers: { "accept": "application/json" } });
  const text = await r.text();
  if (!r.ok) {
    let body: any = null;
    try { body = JSON.parse(text); } catch {}
    const msg = body?.message || body?.error || text || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return JSON.parse(text);
}

function render(status: StatusV1, baseUrl: string, path: string, intervalMs: number): void {
  clearScreen();
  const ready = status.ready || [];
  const stages = status.stages || [];
  const maxName = Math.max(5, ...stages.map(s => s.name.length));
  const maxDeps = Math.max(4, ...stages.map(s => (s.deps || []).join(", ").length));

  const head = [
    `css pipeline status --watch`,
    `time=${nowIso()}`,
    `url=${baseUrl}`,
    `path=${path}`,
    `interval_ms=${intervalMs}`,
  ].join("  ");
  process.stdout.write(head + "\n\n");

  process.stdout.write(`Ready: ${ready.length ? ready.join(" -> ") : "(none)"}\n`);
  process.stdout.write(`Video Shots: N=${fmtShots(status.video)}\n\n`);

  process.stdout.write(`${padRight("stage", maxName)}  ${padRight("deps", maxDeps)}  status\n`);
  process.stdout.write(`${"-".repeat(maxName)}  ${"-".repeat(maxDeps)}  ------\n`);
  for (const s of stages) {
    const deps = (s.deps || []).join(", ");
    process.stdout.write(`${padRight(s.name, maxName)}  ${padRight(deps || "-", maxDeps)}  ${s.status}\n`);
  }
  process.stdout.write("\n");
}

export function registerPipelineCommands(program: Command): void {
  const pipeline = program.command("pipeline");

  pipeline
    .command("status")
    .option("--watch", "watch mode", false)
    .option("--interval <ms>", "poll interval ms", "1000")
    .option("--url <baseUrl>", "base url", process.env.CSS_API_URL || "http://127.0.0.1:8081")
    .option("--path <runJsonPath>", "run.json path on server", "build/run.json")
    .action(async (opts: any) => {
      const watch = !!opts.watch;
      const intervalMs = Math.max(200, parseInt(String(opts.interval || "1000"), 10) || 1000);
      const baseUrl = String(opts.url || "http://127.0.0.1:8081").replace(/\/+$/, "");
      const path = String(opts.path || "build/run.json");

      const endpoint = () => `${baseUrl}/api/pipeline/status?path=${encodeURIComponent(path)}`;

      let stopping = false;
      const stop = () => { stopping = true; };
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);

      const once = async () => {
        const data = (await fetchJson(endpoint())) as StatusV1;
        render(data, baseUrl, path, intervalMs);
      };

      if (!watch) {
        await once();
        return;
      }

      while (!stopping) {
        try {
          await once();
        } catch (e: any) {
          clearScreen();
          process.stdout.write(`css pipeline status --watch  time=${nowIso()}\n\n`);
          process.stdout.write(`ERROR: ${String(e?.message || e)}\n`);
          process.stdout.write(`url=${baseUrl} path=${path}\n`);
        }
        await new Promise(r => setTimeout(r, intervalMs));
      }
    });
}
