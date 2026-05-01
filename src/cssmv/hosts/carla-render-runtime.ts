import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export interface CarlaHostArgs {
  project: string;
  stackOrChain: string;
  planPath: string;
  executionPath: string;
  mode: "instrument" | "fx" | "mix";
  inputStemPath?: string;
}

export interface CarlaRenderContext {
  artifactDir: string;
  sessionDir: string;
  sessionManifestPath: string;
  cueManifestPath: string;
  outputManifestPath: string;
  project: string;
  stackOrChain: string;
  mode: "instrument" | "fx" | "mix";
  inputStemPath: string;
  outputArtifacts: string[];
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonIfExists(filePath: string): any {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function parseCarlaHostArgs(argv: string[]): CarlaHostArgs {
  const readFlag = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? String(argv[index + 1] || "").trim() : "";
  };
  const explicitMode = readFlag("--mode").toLowerCase();
  const project = readFlag("--project");
  const stack = readFlag("--stack");
  const chain = readFlag("--chain");
  const planPath = path.resolve(readFlag("--plan") || ".");
  const executionRaw = readFlag("--execution");
  const executionPath = executionRaw ? path.resolve(executionRaw) : "";
  const inputStemPath = readFlag("--input-stem") ? path.resolve(readFlag("--input-stem")) : "";
  const mode: CarlaHostArgs["mode"] =
    explicitMode === "fx" || explicitMode === "vocal_fx"
      ? "fx"
      : explicitMode === "mix"
        ? "mix"
        : chain
          ? (String(chain).toLowerCase().includes("mix") ? "mix" : "fx")
          : "instrument";
  return {
    project,
    stackOrChain: stack || chain,
    planPath,
    executionPath,
    mode,
    ...(inputStemPath ? { inputStemPath } : {})
  };
}

export function buildCarlaRenderContext(args: CarlaHostArgs): CarlaRenderContext {
  const artifactDir = path.dirname(args.planPath);
  const sessionDir = path.join(artifactDir, "hosts", "carla", args.mode);
  ensureDir(sessionDir);
  const plan = readJsonIfExists(args.planPath);
  const execution = args.executionPath ? readJsonIfExists(args.executionPath) : null;
  const runbook = readJsonIfExists(path.join(artifactDir, "render.host-runbook.json"));
  const currentStage = Array.isArray(runbook?.stages)
    ? runbook.stages.find((stage: any) => {
        if (args.mode === "instrument") return stage?.stage === "instrument_host";
        if (args.mode === "fx") return stage?.stage === "vocal_fx_host";
        return stage?.stage === "mix_host";
      })
    : null;
  const previewSegments = Array.isArray(readJsonIfExists(path.join(artifactDir, "music.plan.json"))?.previewSegments)
    ? readJsonIfExists(path.join(artifactDir, "music.plan.json")).previewSegments
    : [];
  const outputArtifacts = Array.isArray(currentStage?.outputArtifacts) ? currentStage.outputArtifacts : [];
  const sessionManifestPath = path.join(sessionDir, "session.manifest.json");
  const cueManifestPath = path.join(sessionDir, "cues.manifest.json");
  const outputManifestPath = path.join(sessionDir, "outputs.manifest.json");
  fs.writeFileSync(
    sessionManifestPath,
    JSON.stringify(
      {
        generatedBy: "cssmv.carla_render_runtime",
        project: args.project,
        stackOrChain: args.stackOrChain,
        mode: args.mode,
        artifactDir,
        planPath: args.planPath,
        executionPath: args.executionPath,
        inputStemPath: args.inputStemPath || "",
        renderHostPlan: plan,
        renderExecution: execution
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    cueManifestPath,
    JSON.stringify(
      {
        generatedBy: "cssmv.carla_render_runtime",
        mode: args.mode,
        previewSegments
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    outputManifestPath,
    JSON.stringify(
      {
        generatedBy: "cssmv.carla_render_runtime",
        mode: args.mode,
        outputArtifacts
      },
      null,
      2
    )
  );
  return {
    artifactDir,
    sessionDir,
    sessionManifestPath,
    cueManifestPath,
    outputManifestPath,
    project: args.project,
    stackOrChain: args.stackOrChain,
    mode: args.mode,
    inputStemPath: args.inputStemPath || "",
    outputArtifacts
  };
}

export function expandTemplate(template: string, context: CarlaRenderContext): string {
  const replacements: Record<string, string> = {
    "{{PROJECT}}": context.project,
    "{{STACK_OR_CHAIN}}": context.stackOrChain,
    "{{ARTIFACT_DIR}}": context.artifactDir,
    "{{SESSION_DIR}}": context.sessionDir,
    "{{SESSION_MANIFEST}}": context.sessionManifestPath,
    "{{CUE_MANIFEST}}": context.cueManifestPath,
    "{{OUTPUT_MANIFEST}}": context.outputManifestPath,
    "{{INPUT_STEM}}": context.inputStemPath
  };
  return Object.entries(replacements).reduce(
    (acc, [key, value]) => acc.split(key).join(value),
    String(template || "")
  );
}

export function runCarlaRenderTemplate(
  template: string,
  context: CarlaRenderContext
): { status: number | null; stdout: string; stderr: string; command: string } {
  const command = expandTemplate(template, context);
  const result = spawnSync(command, {
    cwd: context.sessionDir,
    shell: true,
    env: process.env,
    encoding: "utf8"
  });
  return {
    status: result.status,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
    command
  };
}

export function verifyExpectedOutputs(context: CarlaRenderContext): string[] {
  return context.outputArtifacts
    .map((artifact) => path.join(context.artifactDir, artifact))
    .filter((targetPath) => fs.existsSync(targetPath));
}
