import type { ProjectSpec } from "../../core/project-spec";
import type { NarrativePlanEnvelope } from "../../schemas/narrative-plan";
import type { ScenePlan } from "../../schemas/scene-plan";
import type { StoryGraph } from "../../schemas/story-graph";
import { normalizeGenerationConstraints, type ConstraintInput } from "./constraints";
import { createDeterministicSeed } from "./seed-control";
import type { GenerationConstraints } from "./types";

export interface PlanningContext {
  constraints: ReturnType<typeof normalizeGenerationConstraints>;
}

export function adaptToPlanningContext(
  project: ProjectSpec | undefined,
  graph: StoryGraph,
  narrative: NarrativePlanEnvelope,
  scenePlan: ScenePlan
): PlanningContext {
  const songSeed = project?.songSeed;
  const creative = project?.creative;
  const mood = graph.meta.tone || songSeed?.musicStyle || "lyrical";
  const totalBars = scenePlan.scenes.reduce((sum, scene) => sum + Math.max(4, Math.round((scene.durationSec ?? 12) / 2)), 0);
  const sectionLengthBias =
    totalBars <= 32 ? "compact" : totalBars >= 72 ? "expanded" : "balanced";
  const deterministicSeed = createDeterministicSeed([
    project?.projectId,
    graph.meta.storyId,
    narrative.mode,
    scenePlan.scenes.map((scene) => scene.label).join("/")
  ]);

  const input: ConstraintInput = {
    mood: creative?.mood || mood,
    tempoBpm: creative?.tempo_bpm ?? inferTempo(songSeed?.musicStructure, narrative),
    complexity: inferComplexity(scenePlan.scenes.length, creative),
    instrumentationProfile: inferInstrumentationProfile(creative),
    ambienceProfile: inferAmbienceProfile(creative),
    expressionBias: inferExpressionBias(creative),
    stylePack: String(creative?.licensed_style_pack || creative?.genre || "core"),
    adapterPreference: String(creative?.external_audio_adapter || "internal"),
    musicalKey: String(creative?.musical_key || "auto"),
    language: String(creative?.language || graph.meta.language || "auto"),
    workType: String(creative?.work_type || songSeed?.workType || "song"),
    sectionLengthBias,
    repetitionStrength: songSeed?.sectionBeats?.some((beat) => beat.section.toLowerCase().includes("chorus"))
      ? 0.74
      : 0.55,
    harmonicStability: inferHarmonicStability(narrative, creative),
    rhythmicActivity: creative?.percussion_activity ?? (songSeed?.styleTags?.length ? 0.62 : 0.5),
    dynamicRange: inferDynamicRange(creative),
    sectionContrast: inferSectionContrast(scenePlan.scenes.length, creative),
    melodicContour: inferMelodicContour(creative, songSeed),
    articulationBias: inferArticulationBias(creative),
    voicingRegister: inferVoicingRegister(creative),
    deterministicSeed,
    regenerationScope: "full"
  };

  return {
    constraints: normalizeGenerationConstraints(input)
  };
}

function inferTempo(musicStructure: string | undefined, narrative: NarrativePlanEnvelope): number {
  const text = String(musicStructure || "").toLowerCase();
  if (text.includes("anthem") || text.includes("explode")) return 108;
  if (text.includes("breathe") || text.includes("echo")) return 82;
  if (narrative.plan.type === "mv" && narrative.plan.durationSec >= 180) return 94;
  return 88;
}

function inferComplexity(sceneCount: number, creative: ProjectSpec["creative"]): number {
  const fromDensity = Number(creative?.arrangement_density);
  if (Number.isFinite(fromDensity)) {
    return Math.max(0, Math.min(1, 0.35 + fromDensity * 0.55));
  }
  return sceneCount >= 6 ? 0.72 : 0.48;
}

function inferHarmonicStability(
  narrative: NarrativePlanEnvelope,
  creative: ProjectSpec["creative"]
): number {
  const dynamicsText = String(creative?.dynamics_curve || "").toLowerCase();
  const sectionForm = String(creative?.section_form || "").toLowerCase();
  if (dynamicsText.includes("volatile") || sectionForm.includes("through-composed")) return 0.42;
  if (narrative.plan.type === "mv" && narrative.plan.musicStrategy === "full_song") return 0.68;
  return 0.56;
}

function inferDynamicRange(creative: ProjectSpec["creative"]): number {
  const density = Number(creative?.arrangement_density);
  const humanization = Number(creative?.humanization);
  const dynamicBias = String(creative?.dynamics_curve || "").toLowerCase();
  const base =
    (Number.isFinite(density) ? density * 0.45 : 0.28) +
    (Number.isFinite(humanization) ? humanization * 0.2 : 0.07) +
    (dynamicBias.includes("surge") || dynamicBias.includes("swell") ? 0.2 : 0.1);
  return Math.max(0, Math.min(1, base));
}

function inferSectionContrast(sceneCount: number, creative: ProjectSpec["creative"]): number {
  const formText = String(creative?.section_form || "").toLowerCase();
  const inspiration = String(creative?.inspiration_notes || "").toLowerCase();
  const base = sceneCount >= 5 ? 0.62 : 0.48;
  if (formText.includes("contrast") || formText.includes("trilogy") || inspiration.includes("opera")) {
    return Math.min(1, base + 0.2);
  }
  return base;
}

function inferMelodicContour(
  creative: ProjectSpec["creative"],
  songSeed: ProjectSpec["songSeed"]
): GenerationConstraints["melodicContour"] {
  const contourText = [creative?.vocal_style, creative?.prompt, songSeed?.musicStructure].join(" ").toLowerCase();
  if (contourText.includes("ascending") || contourText.includes("rise")) return "ascending";
  if (contourText.includes("wave") || contourText.includes("call")) return "wave";
  if (contourText.includes("low chant") || contourText.includes("grounded")) return "grounded";
  return "arched";
}

function inferArticulationBias(creative: ProjectSpec["creative"]): GenerationConstraints["articulationBias"] {
  const text = String(creative?.articulation_bias || creative?.vocal_style || "").toLowerCase();
  if (text.includes("legato") || text.includes("flowing")) return "legato";
  if (text.includes("accent") || text.includes("punch")) return "accented";
  return "mixed";
}

function inferVoicingRegister(creative: ProjectSpec["creative"]): GenerationConstraints["voicingRegister"] {
  const text = String(creative?.voicing_register || "").toLowerCase();
  if (text.includes("wide")) return "wide";
  if (text.includes("high")) return "high";
  if (text.includes("low")) return "low";
  return "mid";
}

function inferInstrumentationProfile(
  creative: ProjectSpec["creative"]
): GenerationConstraints["instrumentationProfile"] {
  const text = [
    creative?.instrumentation,
    creative?.instrument,
    creative?.ensemble_style,
    creative?.licensed_style_pack
  ]
    .join(" ")
    .toLowerCase();
  if (text.includes("guzheng") || text.includes("erhu") || text.includes("pipa") || text.includes("guofeng")) {
    return "guofeng";
  }
  if (text.includes("orchestra") || text.includes("strings") || text.includes("symph")) {
    return "orchestral";
  }
  if (text.includes("synth") || text.includes("electro") || text.includes("edm")) {
    return "electronic";
  }
  if (text.includes("piano") || text.includes("acoustic") || text.includes("guitar")) {
    return "acoustic";
  }
  return "hybrid";
}

function inferAmbienceProfile(
  creative: ProjectSpec["creative"]
): GenerationConstraints["ambienceProfile"] {
  const text = [creative?.ambience, creative?.inspiration_notes].join(" ").toLowerCase();
  if (text.includes("cathedral") || text.includes("hall") || text.includes("opera")) return "cathedral";
  if (text.includes("mist") || text.includes("fog") || text.includes("smoke")) return "mist";
  if (text.includes("dry") || text.includes("close")) return "dry";
  return "glow";
}

function inferExpressionBias(
  creative: ProjectSpec["creative"]
): GenerationConstraints["expressionBias"] {
  const text = [creative?.expression_cc_bias, creative?.vocal_style, creative?.prompt].join(" ").toLowerCase();
  if (text.includes("theatrical") || text.includes("opera")) return "theatrical";
  if (text.includes("dramatic") || text.includes("surge")) return "dramatic";
  if (text.includes("intimate") || text.includes("whisper") || text.includes("close")) return "intimate";
  return "natural";
}
