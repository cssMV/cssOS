import fs from "node:fs";
import path from "node:path";
import type { RenderHostRunbookStage } from "../../schemas/render-host-runbook";
import { executeFreeHostPresetLocally } from "./free-host-runner";

function readFlag(name: string): string {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return String(process.argv[index + 1] || "").trim();
}

function readRepeatedFlag(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) {
      values.push(String(process.argv[index + 1]));
    }
  }
  return values;
}

function loadCues(outDir: string) {
  const musicPlanPath = path.join(outDir, "music.plan.json");
  if (!fs.existsSync(musicPlanPath)) {
    return [{ durationSec: 1.5, energy: "medium", section: "fallback" }];
  }
  try {
    const raw = JSON.parse(fs.readFileSync(musicPlanPath, "utf8")) as {
      previewSegments?: Array<{ durationSec?: number; energy?: string; section?: string }>;
    };
    const previewSegments = Array.isArray(raw.previewSegments) ? raw.previewSegments : [];
    if (!previewSegments.length) {
      return [{ durationSec: 1.5, energy: "medium", section: "fallback" }];
    }
    return previewSegments.map((segment) => ({
      durationSec: Number(segment.durationSec || 1.25),
      energy: segment.energy || "medium",
      section: segment.section || "segment"
    }));
  } catch {
    return [{ durationSec: 1.5, energy: "medium", section: "fallback" }];
  }
}

function main() {
  const outDir = path.resolve(readFlag("--out-dir") || ".");
  const stage = (readFlag("--stage") || "instrument_host") as RenderHostRunbookStage["stage"];
  const hostPresetId = readFlag("--host-preset");
  const outputArtifacts = readRepeatedFlag("--output");
  const result = executeFreeHostPresetLocally({
    outDir,
    stage: {
      stage,
      hostPresetId,
      outputArtifacts
    },
    cues: loadCues(outDir)
  });
  process.stdout.write(
    JSON.stringify(
      {
        ok: result.executed,
        hostPresetId,
        stage,
        notes: result.notes
      },
      null,
      2
    )
  );
}

main();
