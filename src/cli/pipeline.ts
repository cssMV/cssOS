import { Command } from "commander";
import { spawn } from "node:child_process";
import path from "node:path";

export function registerPipelineCommands(program: Command): void {
  const pipeline = program.command("pipeline");
  const statusScript = path.resolve(__dirname, "../../scripts/css-cli-status-watch.mjs");

  pipeline
    .command("status")
    .requiredOption("--run <runId>", "run id")
    .option("--watch", "watch mode", false)
    .option("--interval-ms <ms>", "poll interval ms", "500")
    .option("--base <baseUrl>", "base url", process.env.CSS_API_BASE || "https://cssstudio.app")
    .action(async (opts: any) => {
      const args = [
        statusScript,
        "--run",
        String(opts.run),
        "--base",
        String(opts.base || process.env.CSS_API_BASE || "https://cssstudio.app"),
        "--interval-ms",
        String(opts.intervalMs || "500"),
      ];
      if (opts.watch) args.push("--watch");

      const child = spawn(process.execPath, args, { stdio: "inherit" });
      child.on("exit", (code) => process.exit(code ?? 1));
      child.on("error", (err) => {
        process.stderr.write(`failed to launch status watcher: ${String(err)}\n`);
        process.exit(1);
      });
    });
}
