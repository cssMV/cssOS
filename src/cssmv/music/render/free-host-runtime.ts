import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { RenderHostRunbookStage } from "../../schemas/render-host-runbook";

const HOST_COMMAND_ALIASES: Record<string, string[]> = {
  "free-plugin-host": [
    "carla-headless",
    "carla",
    "element",
    "kushview-element",
    "reaper",
    "surge-xt",
    "surge-xt-cli",
    "dexed",
    "yoshimi",
    "zynaddsubfx",
    "sfizz",
    "fluidsynth"
  ],
  "free-singer-host": [
    "synthesizer-v-studio",
    "synthv",
    "synthesizerv",
    "diffsinger",
    "utau",
    "openutau",
    "enunu",
    "nnsvs"
  ],
  "free-vocal-fx-host": [
    "carla-headless",
    "carla",
    "element",
    "kushview-element",
    "reaper"
  ]
};

function shellEscape(value: string): string {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function defaultCommandLookup(commandName: string): string {
  const target = String(commandName || "").trim();
  if (!target) return "";
  const candidates = [target, ...(HOST_COMMAND_ALIASES[target] || [])];
  for (const candidate of candidates) {
    const lookup = spawnSync(
      process.platform === "win32" ? "where" : "command",
      process.platform === "win32" ? [candidate] : ["-v", candidate],
      {
        shell: process.platform !== "win32",
        encoding: "utf8"
      }
    );
    if (lookup.status !== 0) continue;
    const line = [lookup.stdout, lookup.stderr]
      .join("\n")
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find(Boolean);
    if (line) return line;
  }
  return "";
}

export function resolveHostExecutable(input: {
  commandTemplate?: string | undefined;
  envKeys?: string[] | undefined;
  env?: NodeJS.ProcessEnv | undefined;
  lookupCommand?: (commandName: string) => string;
}): {
  envKey: string;
  executablePath: string;
  source: "env" | "path" | "unresolved";
} {
  const env = input.env || process.env;
  const envKey = (input.envKeys || []).find((key) => String(env[key] || "").trim()) || String(input.envKeys?.[0] || "");
  const configured = envKey ? String(env[envKey] || "").trim() : "";
  if (configured) {
    return {
      envKey,
      executablePath: configured,
      source: "env"
    };
  }
  const commandName = String(input.commandTemplate || "").trim().split(/\s+/, 1)[0] || "";
  const lookupCommand = input.lookupCommand || defaultCommandLookup;
  const resolved = commandName ? String(lookupCommand(commandName) || "").trim() : "";
  if (resolved) {
    return {
      envKey,
      executablePath: resolved,
      source: "path"
    };
  }
  return {
    envKey,
    executablePath: "",
    source: "unresolved"
  };
}

export function buildProjectFreeHostFallbackCommand(outDir: string, stage: RenderHostRunbookStage): string {
  const distCliPath = path.resolve(process.cwd(), "dist/cssmv/music/render/free-host-cli.js");
  const cliPrefix = fs.existsSync(distCliPath)
    ? `${shellEscape(process.execPath)} ${shellEscape(distCliPath)}`
    : `${shellEscape(process.execPath)} -r ts-node/register/transpile-only ${shellEscape(path.resolve(process.cwd(), "src/cssmv/music/render/free-host-cli.ts"))}`;
  const parts = [
    cliPrefix,
    "--out-dir",
    shellEscape(outDir),
    "--stage",
    shellEscape(stage.stage)
  ];
  if (stage.hostPresetId) {
    parts.push("--host-preset", shellEscape(stage.hostPresetId));
  }
  (stage.outputArtifacts || []).forEach((artifact) => {
    parts.push("--output", shellEscape(artifact));
  });
  return parts.join(" ");
}
