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
    await statusWatch({ baseUrl, runId, intervalMs });
    return;
  }

  process.stderr.write(
    [
      "unknown command",
      "",
      "examples:",
      "  css pipeline status --watch --run <id> [--base-url https://cssstudio.app] [--interval-ms 500]",
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
