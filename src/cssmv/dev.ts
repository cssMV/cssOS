import fs from "node:fs";
import path from "node:path";
import { CssMVEngine } from "./core/cssmv-engine";
import type { ProjectSpec } from "./core/project-spec";
import type { ArtifactManifest, ArtifactManifestEntry } from "./schemas/output-package";

function loadProjectSpec(): ProjectSpec {
  const examplePath =
    process.env.CSSMV_EXAMPLE_PATH ||
    path.resolve(process.cwd(), "examples", "cssmv", "mv_prompt.json");
  const raw = fs.readFileSync(examplePath, "utf8");
  return JSON.parse(raw) as ProjectSpec;
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(targetPath: string, payload: unknown) {
  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2));
}

function writeText(targetPath: string, payload: string) {
  fs.writeFileSync(targetPath, payload, "utf8");
}

function clampSample(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function frequencyForEnergy(energy: string) {
  const key = String(energy || "").toLowerCase();
  if (key.includes("peak-plus")) return 659.25;
  if (key.includes("peak")) return 587.33;
  if (key.includes("high")) return 523.25;
  if (key.includes("medium-high")) return 440;
  if (key.includes("medium")) return 392;
  if (key.includes("low")) return 329.63;
  return 349.23;
}

function resolveSectionProfile(section: string) {
  const key = String(section || "").toLowerCase();
  if (key.includes("chorus 4")) {
    return {
      scale: [0, 7, 12, 16, 19, 24],
      motif: [0, 4, 5, 4, 2, 4, 5, 4, 2, 0],
      leadBoost: 1.24,
      hook: [0, 7, 12, 7, 5, 4, 2, 0],
      cadence: [12, 7, 5, 4],
      anchor: [0, 7, 12, 7, 0, 7, 12, 5]
    };
  }
  if (key.includes("chorus 3") || key.includes("chorus 2") || key.includes("chorus")) {
    return {
      scale: [0, 4, 7, 11, 12, 16, 19],
      motif: [0, 2, 4, 2, 0, 2, 5, 4, 2, 0],
      leadBoost: 1.14,
      hook: [0, 4, 7, 4, 2, 4, 7, 4],
      cadence: [7, 4, 2, 0],
      anchor: [0, 4, 7, 4, 0, 4, 7, 2]
    };
  }
  if (key.includes("bridge")) {
    return {
      scale: [0, 2, 7, 9, 12, 14, 19],
      motif: [0, 3, 5, 6, 5, 3, 1, 0],
      leadBoost: 0.96,
      hook: [0, 3, 6, 5],
      cadence: [6, 5, 3, 0],
      anchor: [0, 3, 5, 6, 5, 3]
    };
  }
  if (key.includes("outro")) {
    return {
      scale: [0, 3, 7, 10, 12, 15, 19],
      motif: [0, 1, 2, 3, 2, 1, 0],
      leadBoost: 0.9,
      hook: [0, 2, 3, 2],
      cadence: [3, 2, 1, 0],
      anchor: [0, 2, 3, 2, 1, 0]
    };
  }
  if (key.includes("intro")) {
    return {
      scale: [0, 3, 7, 10, 12, 15, 19],
      motif: [0, 2, 3, 2, 0, 1],
      leadBoost: 0.82,
      hook: [0, 1, 2, 1],
      cadence: [2, 1, 0, 0],
      anchor: [0, 1, 2, 1, 0, 0]
    };
  }
  return {
    scale: [0, 3, 7, 10, 12, 15, 19],
    motif: [0, 1, 3, 1, 4, 3, 1, 0],
    leadBoost: 1,
    hook: [0, 3, 1, 0],
    cadence: [3, 1, 0, 0],
    anchor: [0, 1, 3, 1, 4, 3, 1, 0]
  };
}

function buildLeadDegrees(
  sectionProfile: ReturnType<typeof resolveSectionProfile>,
  noteCount: number,
  scale: number[]
) {
  const safeCount = Math.max(4, noteCount || 8);
  const degrees: number[] = [];
  const isChorusLike =
    Array.isArray(sectionProfile.anchor) &&
    sectionProfile.anchor.length >= 4 &&
    Array.isArray(sectionProfile.cadence) &&
    sectionProfile.cadence.length >= 3;

  if (isChorusLike && safeCount >= 8) {
    const anchor = sectionProfile.anchor;
    const cadence = sectionProfile.cadence;
    const phraseWindow = Math.max(0, safeCount - cadence.length);
    for (let i = 0; i < phraseWindow; i += 1) {
      if (i < Math.min(anchor.length, 8)) {
        degrees.push(anchor[i % anchor.length] || 0);
      } else {
        const motif = sectionProfile.motif[i % sectionProfile.motif.length] || 0;
        degrees.push(scale[motif % scale.length] || 0);
      }
    }
    cadence.forEach((degree) => {
      degrees.push(degree || 0);
    });
    return degrees.slice(0, safeCount);
  }

  for (let i = 0; i < safeCount; i += 1) {
    const motif = sectionProfile.motif[i % sectionProfile.motif.length] || 0;
    degrees.push(scale[motif % scale.length] || 0);
  }
  return degrees;
}

function buildMelodicPhrase(
  baseFreq: number,
  startSec: number,
  durationSec: number,
  bars: number,
  energy: string,
  section: string
) {
  const normalizedBars = Math.max(4, Math.min(16, bars || 8));
  const energyKey = String(energy || "").toLowerCase();
  const sectionProfile = resolveSectionProfile(section);
  const energyScale =
    energyKey.includes("peak") || energyKey.includes("high")
      ? [0, 4, 7, 11, 12, 16, 19]
      : sectionProfile.scale;
  const notes = Math.max(4, Math.min(12, normalizedBars));
  const noteDurationSec = durationSec / notes;
  const leadDegrees = buildLeadDegrees(sectionProfile, notes, energyScale);
  const phrase = [];
  for (let i = 0; i < notes; i += 1) {
    const hookWindow = i >= Math.max(0, notes - 4);
    const degree = leadDegrees[i % leadDegrees.length] || 0;
    const freq = baseFreq * Math.pow(2, degree / 12);
    phrase.push({
      freq,
      overtone: freq * (energyKey.includes("peak") ? 2 : 1.5) * sectionProfile.leadBoost,
      startSec: startSec + i * noteDurationSec,
      durationSec: noteDurationSec * (hookWindow ? 0.98 : i % 3 === 2 ? 0.92 : 0.78),
      accent: hookWindow ? 1.12 : i % Math.max(2, Math.round(notes / 4)) === 0 ? 1 : 0.72
    });
  }
  return phrase;
}

function writeStubWav(
  targetPath: string,
  cues: Array<{ durationSec: number; energy?: string; section?: string }>
) {
  const sampleRate = 22050;
  const fallbackDurationSec = 8;
  const totalDurationSec = Math.max(
    fallbackDurationSec,
    Math.min(
      24,
      cues.reduce((sum, cue) => sum + Math.max(0.4, Math.min(3, cue.durationSec || 0)), 0)
    )
  );
  const totalSamples = Math.max(1, Math.floor(totalDurationSec * sampleRate));
  const samples = new Int16Array(totalSamples);
  const normalizedCues = cues.length
    ? cues
    : [{ durationSec: fallbackDurationSec, energy: "medium" }];
  let runningSec = 0;
  normalizedCues.forEach((cue, index) => {
    const durationSec = Math.max(0.6, Math.min(3.2, cue.durationSec || 1.25));
    const bars = Math.max(4, Math.round(durationSec / 0.38));
    const freq = frequencyForEnergy(cue.energy || "medium");
    const section = cue.section || `section_${index + 1}`;
    const phrase = buildMelodicPhrase(
      freq,
      runningSec,
      durationSec,
      bars,
      cue.energy || "medium",
      section
    );
    phrase.forEach((note) => {
      const startSample = Math.max(0, Math.floor(note.startSec * sampleRate));
      const sampleCount = Math.min(
        totalSamples - startSample,
        Math.max(1, Math.floor(note.durationSec * sampleRate))
      );
      const attack = Math.max(1, Math.floor(sampleCount * 0.08));
      const release = Math.max(1, Math.floor(sampleCount * 0.18));
      for (let i = 0; i < sampleCount; i += 1) {
        const t = i / sampleRate;
        const env =
          i < attack
            ? i / attack
            : i > sampleCount - release
              ? Math.max(0, (sampleCount - i) / release)
              : 1;
        const pad = Math.sin(2 * Math.PI * note.freq * t) * 0.31;
        const lead = Math.sin(2 * Math.PI * note.overtone * t) * 0.12;
        const shimmer = Math.sin(2 * Math.PI * note.freq * 0.5 * t) * 0.09;
        const bass = Math.sin(2 * Math.PI * (note.freq / 2) * t) * 0.17;
        const pulse = ((Math.sin(2 * Math.PI * 2 * t) + 1) * 0.5) * 0.08;
        const value = clampSample((pad + lead + bass + pulse) * env * note.accent);
        const hookLift = note.accent > 1 ? shimmer * 0.9 : shimmer * 0.45;
        const harmonic = clampSample(value + hookLift);
        const mixed = clampSample((samples[startSample + i] || 0) / 32767 + harmonic * 0.72);
        samples[startSample + i] = Math.round(mixed * 32767);
      }
    });
    runningSec += durationSec;
    const beatStart = Math.max(0, Math.floor(runningSec * sampleRate) - Math.floor(0.08 * sampleRate));
    for (let i = 0; i < Math.floor(0.08 * sampleRate) && beatStart + i < totalSamples; i += 1) {
      const env = 1 - i / Math.floor(0.08 * sampleRate);
      const thump = Math.sin(2 * Math.PI * 80 * (i / sampleRate)) * 0.28 * env;
      const mixed = clampSample((samples[beatStart + i] || 0) / 32767 + thump);
      samples[beatStart + i] = Math.round(mixed * 32767);
    }
    void index;
  });

  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i += 1) {
    buffer.writeInt16LE(samples[i] || 0, 44 + i * 2);
  }
  fs.writeFileSync(targetPath, buffer);
}

function artifactDirFor(projectId: string): string {
  return path.resolve(process.cwd(), "artifacts", "cssmv", projectId);
}

function buildArtifactManifest(
  projectId: string,
  mode: ProjectSpec["mode"],
  outDir: string
): ArtifactManifest {
  const entryDefs: Array<Pick<ArtifactManifestEntry, "key" | "fileName" | "kind">> = [
    { key: "project_context", fileName: "project.context.json", kind: "project_context" },
    { key: "story_graph", fileName: "story.graph.json", kind: "story_graph" },
    { key: "narrative_plan", fileName: "narrative.plan.json", kind: "narrative_plan" },
    { key: "scene_plan", fileName: "scene.plan.json", kind: "scene_plan" },
    { key: "music_plan", fileName: "music.plan.json", kind: "music_plan" },
    { key: "rendered_media", fileName: "rendered.media.json", kind: "rendered_media" },
    { key: "output_package", fileName: "output.package.json", kind: "output_package" },
    { key: "audio_preview", fileName: "audio.preview.wav", kind: "audio_preview" },
    { key: "preview_storyboard", fileName: "preview.storyboard.txt", kind: "preview_storyboard" },
    { key: "preview_script", fileName: "preview.script.txt", kind: "preview_script" }
  ];

  const entries: ArtifactManifestEntry[] = entryDefs.map(({ key, fileName, kind }) => ({
    key,
    fileName,
    path: path.join(outDir, fileName),
    kind
  }));

  return {
    manifestVersion: "cssmv_artifact_manifest_v1",
    projectId,
    mode,
    artifactDir: outDir,
    generatedAt: new Date().toISOString(),
    entries
  };
}

function run() {
  const spec = loadProjectSpec();
  const engine = new CssMVEngine();
  const result = engine.run(spec);
  const outDir = artifactDirFor(spec.projectId);

  ensureDir(outDir);

  writeJson(path.join(outDir, "project.context.json"), result.projectContext);
  writeJson(path.join(outDir, "story.graph.json"), result.storyGraph);
  writeJson(path.join(outDir, "narrative.plan.json"), result.narrativePlan);
  writeJson(path.join(outDir, "scene.plan.json"), result.scenePlan);
  writeJson(path.join(outDir, "music.plan.json"), result.musicPlan);
  writeJson(path.join(outDir, "rendered.media.json"), result.renderedMedia);
  writeStubWav(
    path.join(outDir, "audio.preview.wav"),
    (result.musicPlan.previewSegments || []).map((segment) => ({
      durationSec: segment.durationSec,
      energy: segment.energy,
      section: segment.section
    }))
  );
  writeText(
    path.join(outDir, "preview.storyboard.txt"),
    (result.renderedMedia.previewStoryboard || []).join("\n")
  );
  writeText(
    path.join(outDir, "preview.script.txt"),
    (result.renderedMedia.previewScript || []).join("\n")
  );
  const artifactManifest = buildArtifactManifest(spec.projectId, spec.mode, outDir);
  const outputPackage = {
    ...result.outputPackage,
    audioPreview: path.join(outDir, "audio.preview.wav"),
    artifactManifest
  };
  writeJson(path.join(outDir, "output.package.json"), outputPackage);
  writeJson(path.join(outDir, "artifact.manifest.json"), artifactManifest);

  const summary = {
    projectId: spec.projectId,
    mode: spec.mode,
    mainVideo: outputPackage.mainVideo ?? null,
    subtitleCount: outputPackage.subtitles?.length ?? 0,
    musicStrategy: result.musicPlan.strategy,
    artifactDir: outDir,
    artifactManifest: path.join(outDir, "artifact.manifest.json")
  };

  console.log(JSON.stringify(summary, null, 2));
}

run();
