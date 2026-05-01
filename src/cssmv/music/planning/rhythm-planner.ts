import type { RhythmPlan, PhrasePlan, SectionPlan } from "./types";
import type { PlanningContext } from "./planner-adapter";

export class RhythmPlanner {
  build(
    phrases: PhrasePlan[],
    sections: SectionPlan[],
    context: PlanningContext
  ): RhythmPlan[] {
    return phrases.map((phrase) =>
      this.planPhraseRhythm(phrase, sections.find((section) => section.sectionId === phrase.sectionId), context)
    );
  }

  private planPhraseRhythm(
    phrase: PhrasePlan,
    section: SectionPlan | undefined,
    context: PlanningContext
  ): RhythmPlan {
    const activity = context.constraints.rhythmicActivity;
    const releaseLike = phrase.role === "lift" || phrase.role === "release";
    const developmentLike = phrase.variationRole === "development";
    const contrast = context.constraints.sectionContrast;
    const articulationBias = context.constraints.articulationBias;
    const instrumentation = context.constraints.instrumentationProfile;
    const ambience = context.constraints.ambienceProfile;
    const grooveTemplate =
      instrumentation === "guofeng"
        ? section?.sectionType === "bridge"
          ? "floating"
          : releaseLike || (section?.sectionType === "chorus" && contrast > 0.62)
            ? "anthem"
            : activity > 0.72
              ? "pulse"
              : "flowing"
        : releaseLike
        ? "anthem"
        : section?.sectionType === "bridge"
          ? "floating"
          : contrast > 0.72 && section?.sectionType === "chorus"
            ? "march"
          : activity > 0.68
            ? "pulse"
            : "flowing";

    return {
      phraseId: phrase.phraseId,
      grooveTemplate,
      syncopation:
        releaseLike || developmentLike ? "high" : activity > 0.5 || contrast > 0.65 ? "medium" : "low",
      accents: accentPatternForPhrase(phrase, grooveTemplate),
      density:
        releaseLike ? "busy" : activity > 0.52 || contrast > 0.62 ? "steady" : "sparse",
      swing:
        ambience === "mist" || grooveTemplate === "floating"
          ? "light"
          : context.constraints.rhythmicActivity > 0.82
            ? "triplet"
            : "straight",
      microTimingMs:
        articulationBias === "accented"
          ? 8
          : releaseLike
            ? 14
            : grooveTemplate === "floating"
              ? 22
              : activity > 0.65
                ? 18
                : instrumentation === "orchestral"
                  ? 12
                  : 10,
      activityProfile: buildActivityProfile(phrase.bars, phrase.role, phrase.variationRole),
      barAccents: buildBarAccents(phrase.bars, phrase, grooveTemplate),
      pushPullProfile: buildPushPullProfile(phrase.bars, phrase, grooveTemplate)
    };
  }
}

function accentPatternForPhrase(
  phrase: PhrasePlan,
  grooveTemplate: RhythmPlan["grooveTemplate"]
): string[] {
  if (phrase.role === "release") return ["1", "and-2", "4", "and-4"];
  if (phrase.role === "lift") return ["1", "2", "and-3", "4"];
  if (phrase.variationRole === "answer") return ["1", "3", "and-4"];
  if (grooveTemplate === "floating") return ["1", "and-2", "3"];
  return ["1", "3"];
}

function buildActivityProfile(
  bars: number,
  role: PhrasePlan["role"],
  variationRole: PhrasePlan["variationRole"]
): string[] {
  return Array.from({ length: bars }, (_, index) => {
    const lastBar = index === bars - 1;
    if (role === "release") return lastBar ? "burst" : "drive";
    if (role === "lift") return lastBar ? "push" : "build";
    if (variationRole === "answer") return lastBar ? "answer-tail" : "answer";
    if (variationRole === "development") return lastBar ? "turn" : "develop";
    return lastBar ? "cadence" : "hold";
  });
}

function buildBarAccents(
  bars: number,
  phrase: PhrasePlan,
  grooveTemplate: RhythmPlan["grooveTemplate"]
): string[][] {
  return Array.from({ length: bars }, (_, index) => {
    const finalBar = index === bars - 1;
    if (phrase.role === "release") {
      return finalBar ? ["1", "and-2", "3", "and-4"] : ["1", "2", "4"];
    }
    if (phrase.role === "lift") {
      return finalBar ? ["1", "and-3", "4"] : ["1", "2", "and-4"];
    }
    if (phrase.variationRole === "answer") {
      return finalBar ? ["1", "3", "and-4"] : ["1", "and-2"];
    }
    if (grooveTemplate === "floating") {
      return finalBar ? ["1", "3"] : ["1", "and-2", "3"];
    }
    if (grooveTemplate === "pulse") {
      return finalBar ? ["1", "2", "4"] : ["1", "and-2", "3", "4"];
    }
    return finalBar ? ["1", "3"] : ["1", "and-3"];
  });
}

function buildPushPullProfile(
  bars: number,
  phrase: PhrasePlan,
  grooveTemplate: RhythmPlan["grooveTemplate"]
): Array<"laid_back" | "centered" | "pushed"> {
  return Array.from({ length: bars }, (_, index) => {
    const finalBar = index === bars - 1;
    if (phrase.role === "lift" || phrase.role === "release") {
      return finalBar ? "pushed" : "centered";
    }
    if (grooveTemplate === "floating") {
      return finalBar ? "centered" : "laid_back";
    }
    if (phrase.variationRole === "development") {
      return index % 2 === 0 ? "centered" : "pushed";
    }
    return "centered";
  });
}
