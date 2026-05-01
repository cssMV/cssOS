import type { ScenePlan } from "../../schemas/scene-plan";
import type {
  MusicPlanDocument,
  PhrasePlan,
  SectionPlan
} from "./types";
import type { PlanningContext } from "./planner-adapter";
import { HarmonyPlanner } from "./harmony-planner";
import { RhythmPlanner } from "./rhythm-planner";
import { ExpressionPlanner } from "./expression-planner";
import { MelodyPlanner } from "./melody-planner";

export class MusicPlanner {
  private readonly harmonyPlanner = new HarmonyPlanner();
  private readonly rhythmPlanner = new RhythmPlanner();
  private readonly expressionPlanner = new ExpressionPlanner();
  private readonly melodyPlanner = new MelodyPlanner();

  build(scenePlan: ScenePlan, context: PlanningContext): MusicPlanDocument {
    const sections = buildSections(scenePlan);
    const phrases = buildPhrases(sections);
    const harmony = this.harmonyPlanner.build(phrases, sections, context);
    const rhythm = this.rhythmPlanner.build(phrases, sections, context);
    const expression = this.expressionPlanner.build(phrases, sections, context);
    const melody = this.melodyPlanner.build(phrases, sections, context, {
      harmony,
      rhythm,
      expression
    });

    return {
      constraints: context.constraints,
      sections,
      phrases,
      harmony,
      rhythm,
      expression,
      melody,
      trace: {
        seed: context.constraints.deterministicSeed,
        deterministic: true,
        warnings: []
      }
    };
  }
}

function buildSections(scenePlan: ScenePlan): SectionPlan[] {
  let runningSec = 0;
  return scenePlan.scenes.map((scene, index, scenes) => {
    const durationSec = Math.max(6, scene.durationSec ?? 12);
    const label = scene.sourceSection || scene.label;
    const sectionType = inferSectionType(label);
    const energy = inferEnergy(label, index, scenes.length);
    const section: SectionPlan = {
      sectionId: `section_${String(index + 1).padStart(3, "0")}`,
      sourceSceneId: scene.sceneId,
      label,
      sectionType,
      startSec: runningSec,
      durationSec,
      bars: Math.max(4, Math.round(durationSec / 2)),
      energy
    };
    runningSec += durationSec;
    return section;
  });
}

function buildPhrases(sections: SectionPlan[]): PhrasePlan[] {
  const phrases: PhrasePlan[] = [];
  let lastPhraseId: string | undefined;
  sections.forEach((section, sectionIndex) => {
    const splitCount = section.bars >= 12 ? 2 : 1;
    const phraseBars = Math.max(4, Math.round(section.bars / splitCount));
    const phraseDuration = section.durationSec / splitCount;
    for (let index = 0; index < splitCount; index += 1) {
      const phraseId = `${section.sectionId}_phrase_${index + 1}`;
      phrases.push({
        phraseId,
        sectionId: section.sectionId,
        order: phrases.length + 1,
        startSec: section.startSec + phraseDuration * index,
        durationSec: phraseDuration,
        bars: phraseBars,
        role: inferPhraseRole(section.sectionType, index, splitCount),
        variationRole: inferVariationRole(section.sectionType, index, splitCount),
        cadenceIntent: inferCadenceIntent(section.sectionType, index, splitCount),
        motifId: `${section.sectionType}_motif_${sectionIndexToken(sectionIndex, index)}`,
        ...(lastPhraseId ? { followsPhraseId: lastPhraseId } : {})
      });
      lastPhraseId = phraseId;
    }
  });
  return phrases;
}

function inferSectionType(label: string): SectionPlan["sectionType"] {
  const key = label.toLowerCase();
  if (key.includes("intro")) return "intro";
  if (key.includes("pre")) return "pre_chorus";
  if (key.includes("chorus")) return "chorus";
  if (key.includes("bridge")) return "bridge";
  if (key.includes("outro")) return "outro";
  if (key.includes("break")) return "break";
  return "verse";
}

function inferEnergy(label: string, index: number, total: number): SectionPlan["energy"] {
  const key = label.toLowerCase();
  if (key.includes("chorus 4") || key.includes("final") || index === total - 2) return "peak";
  if (key.includes("chorus") || key.includes("bridge")) return "high";
  if (index === 0) return "low";
  return "medium";
}

function inferPhraseRole(
  sectionType: SectionPlan["sectionType"],
  index: number,
  splitCount: number
): PhrasePlan["role"] {
  if (sectionType === "intro") return "setup";
  if (sectionType === "bridge") return index === splitCount - 1 ? "lift" : "response";
  if (sectionType === "chorus") return index === splitCount - 1 ? "release" : "statement";
  if (sectionType === "outro") return "resolve";
  return index === splitCount - 1 && splitCount > 1 ? "response" : "statement";
}

function inferVariationRole(
  sectionType: SectionPlan["sectionType"],
  index: number,
  splitCount: number
): PhrasePlan["variationRole"] {
  if (sectionType === "chorus") return index === 0 ? "primary" : "repeat";
  if (sectionType === "bridge") return "development";
  if (index === splitCount - 1 && splitCount > 1) return "answer";
  return "primary";
}

function inferCadenceIntent(
  sectionType: SectionPlan["sectionType"],
  index: number,
  splitCount: number
): PhrasePlan["cadenceIntent"] {
  if (sectionType === "chorus") return index === splitCount - 1 ? "authentic" : "open";
  if (sectionType === "bridge") return index === splitCount - 1 ? "deceptive" : "half";
  if (sectionType === "outro") return "plagal";
  if (index === splitCount - 1 && splitCount > 1) return "half";
  return "open";
}

function sectionIndexToken(sectionIndex: number, phraseIndex: number): string {
  return `${sectionIndex + 1}_${phraseIndex + 1}`;
}
