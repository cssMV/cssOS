import { statusWatch } from "./status_watch.mjs";

export async function run(argv) {
  const [cmd, sub, ...rest] = argv;
  if (cmd === "status" && sub === "--watch") {
    return statusWatch(rest);
  }

  process.stderr.write(
    "usage:\n  css status --watch <run_id> [--base <url>] [--interval-ms <ms>]\n"
  );
  process.exit(2);
}
