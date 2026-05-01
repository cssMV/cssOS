import fs from "node:fs";
import path from "node:path";
import type { RenderHostRunbookStage } from "../../schemas/render-host-runbook";
import { writeStubWav } from "./stub-audio-renderer";

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function shiftCueEnergy(energy: string | undefined, delta: "up" | "down") {
  const key = String(energy || "medium").toLowerCase();
  if (delta === "up") {
    if (key.includes("low")) return "medium";
    if (key.includes("medium")) return "high";
    if (key.includes("high")) return "peak";
    return "peak";
  }
  if (key.includes("peak")) return "high";
  if (key.includes("high")) return "medium";
  if (key.includes("medium")) return "low";
  return "low";
}

function deriveStageCues(
  stage: RenderHostRunbookStage["stage"],
  cues: Array<{ durationSec: number; energy?: string; section?: string }>
) {
  if (stage === "vocal_source_host") {
    return cues.map((cue) => ({
      ...cue,
      energy: shiftCueEnergy(cue.energy, "up"),
      section: `${cue.section || "section"}_vocal_source`
    }));
  }
  if (stage === "vocal_fx_host") {
    return cues.map((cue) => ({
      ...cue,
      energy: shiftCueEnergy(cue.energy, "down"),
      section: `${cue.section || "section"}_vocal_fx`
    }));
  }
  if (stage === "mix_host") {
    return cues.map((cue) => ({
      ...cue,
      energy: "peak",
      section: `${cue.section || "section"}_mix`
    }));
  }
  return cues.map((cue) => ({
    ...cue,
    section: `${cue.section || "section"}_instrument`
  }));
}

function deriveArtifactCues(
  stage: RenderHostRunbookStage["stage"],
  artifact: string,
  cues: Array<{ durationSec: number; energy?: string; section?: string }>
) {
  const key = String(artifact || "").toLowerCase();
  if (stage === "instrument_host" && key.includes("drums")) {
    return cues.map((cue) => ({
      ...cue,
      durationSec: Math.max(0.45, (cue.durationSec || 1) * 0.75),
      energy: "peak",
      section: `${cue.section || "section"}_drums`
    }));
  }
  if (stage === "instrument_host" && key.includes("bass")) {
    return cues.map((cue) => ({
      ...cue,
      energy: "low",
      section: `${cue.section || "section"}_bass`
    }));
  }
  if (stage === "instrument_host" && key.includes("hooks")) {
    return cues.map((cue) => ({
      ...cue,
      energy: "high",
      section: `${cue.section || "section"}_hooks`
    }));
  }
  if (stage === "vocal_source_host" && key.includes("harmony")) {
    return cues.map((cue) => ({
      ...cue,
      energy: "medium",
      section: `${cue.section || "section"}_harmony`
    }));
  }
  if (stage === "vocal_fx_host") {
    return cues.map((cue) => ({
      ...cue,
      energy: shiftCueEnergy(cue.energy, "down"),
      section: `${cue.section || "section"}_fx`
    }));
  }
  return deriveStageCues(stage, cues);
}

export function executeFreeHostPresetLocally(input: {
  outDir: string;
  stage: RenderHostRunbookStage;
  cues: Array<{ durationSec: number; energy?: string; section?: string }>;
}): { executed: boolean; notes: string[] } {
  const presetId = String(input.stage.hostPresetId || "").trim();
  if (!presetId) {
    return { executed: false, notes: ["No host preset id provided for local free-host execution."] };
  }
  const stageCues = deriveStageCues(input.stage.stage, input.cues);
  const outputs = Array.isArray(input.stage.outputArtifacts) ? input.stage.outputArtifacts : [];
  outputs.forEach((artifact) => {
    const targetPath = path.join(input.outDir, artifact);
    ensureDir(path.dirname(targetPath));
    if (/\.wav$/i.test(artifact)) {
      writeStubWav(targetPath, deriveArtifactCues(input.stage.stage, artifact, stageCues));
      return;
    }
    fs.writeFileSync(
      targetPath,
      JSON.stringify(
        {
          generatedBy: "cssmv.free_host_runner",
          hostPresetId: presetId,
          stage: input.stage.stage,
          artifact
        },
        null,
        2
      )
    );
  });
  return {
    executed: outputs.length > 0,
    notes: [
      `Executed local free-host preset: ${presetId}.`,
      outputs.length ? `Generated outputs: ${outputs.join(", ")}.` : "No outputs were declared for this stage."
    ]
  };
}
