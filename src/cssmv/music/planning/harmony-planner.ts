import type { HarmonyPlan, PhrasePlan, SectionPlan } from "./types";
import type { PlanningContext } from "./planner-adapter";

export class HarmonyPlanner {
  build(
    phrases: PhrasePlan[],
    sections: SectionPlan[],
    context: PlanningContext
  ): HarmonyPlan[] {
    return phrases.map((phrase, index) =>
      this.planPhraseHarmony(phrase, sections.find((section) => section.sectionId === phrase.sectionId), index, context)
    );
  }

  private planPhraseHarmony(
    phrase: PhrasePlan,
    section: SectionPlan | undefined,
    index: number,
    context: PlanningContext
  ): HarmonyPlan {
    const stable = context.constraints.harmonicStability >= 0.6;
    const cadence = phrase.cadenceIntent;
    const palette = selectProgressionPalette(stable, section?.sectionType, context);
    const theatrical = context.constraints.expressionBias === "theatrical";
    const progression = cadenceAdjustedProgression(
      palette[index % palette.length] ?? palette[0] ?? ["I", "V", "vi", "IV"],
      cadence
    );

    return {
      phraseId: phrase.phraseId,
      progression,
      harmonicRhythm:
        phrase.role === "lift" || phrase.role === "release"
          ? "fast"
          : phrase.bars >= 8
            ? "medium"
            : "slow",
      tensionHint:
        theatrical && phrase.role === "release"
          ? "bright"
          : cadence === "authentic" || cadence === "plagal"
          ? "resolved"
          : context.constraints.sectionContrast > 0.72 && phrase.role === "statement"
            ? "bright"
          : phrase.role === "lift"
            ? "rising"
            : phrase.variationRole === "development"
              ? "bright"
              : phrase.role === "response"
                ? "suspended"
                : "stable",
      bassMotion:
        context.constraints.instrumentationProfile === "guofeng" && phrase.role === "response"
          ? "stepwise"
          : context.constraints.melodicContour === "ascending" && phrase.role !== "resolve"
          ? "arched"
          : phrase.role === "lift"
          ? "arched"
          : phrase.role === "response"
            ? "stepwise"
            : phrase.variationRole === "development"
              ? "jumping"
              : "pedal",
      cadence
    };
  }
}

function selectProgressionPalette(
  stable: boolean,
  sectionType: SectionPlan["sectionType"] | undefined,
  context: PlanningContext
): string[][] {
  const highContrast = context.constraints.sectionContrast > 0.7;
  const stylePack = context.constraints.stylePack.toLowerCase();
  const guofeng = context.constraints.instrumentationProfile === "guofeng" || stylePack.includes("guofeng");
  if (sectionType === "chorus") {
    return stable
      ? [
          guofeng ? ["i", "bVII", "iv", "V"] : ["I", "V", "vi", "IV"],
          highContrast ? ["I", "bVII", "IV", "V"] : ["IV", "I", "V", "vi"]
        ]
      : [
          ["i", "bVI", "III", "bVII"],
          ["i", "iv", "bVI", "V"]
        ];
  }

  if (sectionType === "bridge") {
    return stable
      ? [
          ["vi", "IV", "I", "V"],
          ["ii", "V", "I", "vi"]
        ]
      : [
          ["i", "iv", "bVII", "bIII"],
          ["i", "bVI", "iv", "V"]
        ];
  }

  return stable
    ? [
        highContrast ? ["I", "V/vi", "vi", "IV"] : ["I", "iii", "IV", "V"],
        ["vi", "IV", "I", "V"]
      ]
    : [
        ["i", "bVII", "bVI", "bVII"],
        ["i", "iv", "bVI", "bVII"]
      ];
}

function cadenceAdjustedProgression(base: string[], cadence: PhrasePlan["cadenceIntent"]): string[] {
  const progression = [...base];
  if (progression.length === 0) {
    return progression;
  }
  progression[progression.length - 1] =
    cadence === "authentic"
      ? "I"
      : cadence === "plagal"
        ? "IV-I"
        : cadence === "deceptive"
          ? "vi"
          : cadence === "half"
            ? "V"
            : progression[progression.length - 1]!;
  return progression;
}
