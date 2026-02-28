import process from "node:process";
import WebSocket from "ws";

type SnapshotEvent = {
  event: "snapshot";
  data: {
    run_id: string;
    updated_at: string;
    status: string;
    ready: string[];
    running: string[];
    summary?: {
      pending?: number;
      running?: number;
      succeeded?: number;
      failed?: number;
      skipped?: number;
    };
  };
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function fmtList(label: string, xs: string[]) {
  return `${label}: ${xs.length ? xs.join(", ") : "-"}`;
}

function toWsUrl(baseUrl: string): string {
  const u = new URL(baseUrl);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/cssapi/v1/ws";
  u.search = "";
  return u.toString();
}

function render(snapshot: SnapshotEvent["data"]) {
  process.stdout.write("\x1b[2J\x1b[H");
  process.stdout.write(fmtList("READY", snapshot.ready || []) + "\n");
  process.stdout.write(fmtList("RUNNING", snapshot.running || []) + "\n");
  process.stdout.write(
    `SUMMARY: pending=${snapshot.summary?.pending ?? "-"} running=${snapshot.summary?.running ?? "-"} succeeded=${snapshot.summary?.succeeded ?? "-"} failed=${snapshot.summary?.failed ?? "-"} skipped=${snapshot.summary?.skipped ?? "-"} status=${snapshot.status} updated_at=${snapshot.updated_at}\n`
  );
}

export async function statusWatch(opts: {
  baseUrl: string;
  runId: string;
  intervalMs?: number;
}) {
  const wsUrl = toWsUrl(opts.baseUrl);

  for (;;) {
    const ws = new WebSocket(wsUrl);

    const code = await new Promise<number>((resolve) => {
      let done = false;
      const finish = (exitCode: number) => {
        if (done) return;
        done = true;
        try {
          ws.close();
        } catch {}
        resolve(exitCode);
      };

      ws.on("open", () => {
        ws.send(JSON.stringify({ run_id: opts.runId }));
      });

      ws.on("message", (buf: WebSocket.RawData) => {
        let ev: SnapshotEvent;
        try {
          ev = JSON.parse(buf.toString()) as SnapshotEvent;
        } catch {
          return;
        }
        if (ev.event !== "snapshot") return;
        const s = ev.data;
        if (!s || s.run_id !== opts.runId) return;
        render(s);

        if (String(s.status).includes("SUCCEEDED")) return finish(0);
        if (String(s.status).includes("FAILED")) return finish(1);
        if (String(s.status).includes("CANCELLED")) return finish(2);
      });

      ws.on("error", () => finish(99));
      ws.on("close", () => finish(99));
    });

    if (code !== 99) {
      process.exit(code);
    }
    process.stderr.write("ws disconnected, reconnecting...\n");
    await sleep(500);
  }
}
