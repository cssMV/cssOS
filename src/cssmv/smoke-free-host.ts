import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

type DevSummary = {
  artifactDir?: string;
  projectId?: string;
};

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const stdout = execFileSync(
    process.execPath,
    ["-r", "ts-node/register/transpile-only", "src/cssmv/dev.ts"],
    {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8"
    }
  );
  const summary = JSON.parse(String(stdout || "{}")) as DevSummary;
  const artifactDir = path.resolve(String(summary.artifactDir || ""));
  if (!artifactDir || !fs.existsSync(artifactDir)) {
    throw new Error("cssmv smoke failed: artifactDir not found");
  }

  const probe = readJson(path.join(artifactDir, "render.host-probe.json"));
  const runbook = readJson(path.join(artifactDir, "render.host-runbook.json"));
  const outputPackage = readJson(path.join(artifactDir, "output.package.json"));

  const smokeSummary = {
    projectId: summary.projectId || path.basename(artifactDir),
    artifactDir,
    readinessLevel: probe?.readinessLevel || "unknown",
    hostRenderedAudioActive: Boolean(outputPackage?.audioRenderProvenance?.hostRenderedAudioActive),
    hostExecutionModeSummary: outputPackage?.audioRenderProvenance?.hostExecutionModeSummary || "",
    stageProbe: Array.isArray(probe?.stages)
      ? probe.stages.map((stage: any) => ({
          stage: stage.stage,
          envKey: stage.envKey || "",
          configuredExecutable: stage.configuredExecutable || "",
          executableResolutionSource: stage.executableResolutionSource || "",
          externalHostConfigured: !!stage.externalHostConfigured
        }))
      : [],
    stageRunbook: Array.isArray(runbook?.stages)
      ? runbook.stages.map((stage: any) => ({
          stage: stage.stage,
          executionStatus: stage.executionStatus || "",
          executionSource: stage.executionSource || "",
          outputQualityTier: stage.outputQualityTier || "",
          resolvedExecutable: stage.resolvedExecutable || "",
          resolvedCommand: stage.resolvedCommand || "",
          generatedArtifacts: Array.isArray(stage.generatedArtifacts) ? stage.generatedArtifacts : []
        }))
      : []
  };

  process.stdout.write(`${JSON.stringify(smokeSummary, null, 2)}\n`);
}

main();
