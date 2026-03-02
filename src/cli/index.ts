import { statusWatch } from "./status_watch";

function getArg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && i + 1 < process.argv.length) {
    const v = process.argv[i + 1];
    return typeof v === "string" ? v : null;
  }
  return null;
}

function hasArg(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv.join(" ");

  if (argv.length >= 3 && argv[0] === "status" && argv[1] === "--watch") {
    const runId = argv[2];
    if (!runId) {
      process.stderr.write("missing <run_id>\n");
      process.exit(2);
    }
    const baseUrl =
      getArg("--base-url") ||
      getArg("--base") ||
      process.env.CSS_API_BASE_URL ||
      process.env.CSS_API_BASE ||
      "https://cssstudio.app";
    const intervalMs = Number(getArg("--interval-ms") || process.env.CSS_WATCH_INTERVAL_MS || "500");
    const listMax = Number(getArg("--list-max") || process.env.CSS_WATCH_LIST_MAX || "12");
    const debugPids = hasArg("--debug-pids");
    await statusWatch({ baseUrl, runId, intervalMs, listMax, debugPids });
    return;
  }

  if (cmd.startsWith("pipeline status") && hasArg("--watch")) {
    const runId = getArg("--run") || getArg("-r");
    if (!runId) {
      process.stderr.write("missing --run <id>\n");
      process.exit(2);
    }

    const baseUrl =
      getArg("--base-url") ||
      getArg("--base") ||
      process.env.CSS_API_BASE_URL ||
      process.env.CSS_API_BASE ||
      "https://cssstudio.app";

    const intervalMs = Number(getArg("--interval-ms") || "500");
    const listMax = Number(getArg("--list-max") || process.env.CSS_WATCH_LIST_MAX || "12");
    const debugPids = hasArg("--debug-pids");
    await statusWatch({ baseUrl, runId, intervalMs, listMax, debugPids });
    return;
  }

  process.stderr.write(
    [
      "unknown command",
      "",
      "examples:",
      "  css status --watch <id> [--base-url https://cssstudio.app] [--interval-ms 500] [--list-max 12] [--debug-pids]",
      "  css pipeline status --watch --run <id> [--base-url https://cssstudio.app] [--interval-ms 500] [--debug-pids]",
      "",
    ].join("\n") + "\n"
  );
  process.exit(2);
}

main().catch((e: unknown) => {
  if (e instanceof Error) {
    process.stderr.write((e.stack || e.message) + "\n");
  } else {
    process.stderr.write(String(e) + "\n");
  }
  process.exit(1);
});
