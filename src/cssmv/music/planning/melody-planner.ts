import type {
  ExpressionPlan,
  HarmonyPlan,
  MelodyPlan,
  PhrasePlan,
  RhythmPlan,
  SectionPlan
} from "./types";
import type { PlanningContext } from "./planner-adapter";

interface MelodyPlannerInputs {
  harmony: HarmonyPlan[];
  rhythm: RhythmPlan[];
  expression: ExpressionPlan[];
}

export class MelodyPlanner {
  build(
    phrases: PhrasePlan[],
    sections: SectionPlan[],
    context: PlanningContext,
    inputs: MelodyPlannerInputs
  ): MelodyPlan[] {
    return phrases.map((phrase, index) =>
      this.planPhraseMelody(
        phrase,
        sections.find((section) => section.sectionId === phrase.sectionId),
        index,
        context,
        inputs
      )
    );
  }

  private planPhraseMelody(
    phrase: PhrasePlan,
    section: SectionPlan | undefined,
    index: number,
    context: PlanningContext,
    inputs: MelodyPlannerInputs
  ): MelodyPlan {
    const harmony = inputs.harmony.find((entry) => entry.phraseId === phrase.phraseId);
    const rhythm = inputs.rhythm.find((entry) => entry.phraseId === phrase.phraseId);
    const expression = inputs.expression.find((entry) => entry.phraseId === phrase.phraseId);
    const contour = resolveContour(phrase, section, context, rhythm);
    const hookStrength = resolveHookStrength(phrase, section, context, harmony, expression);
    const phraseFunction = resolvePhraseFunction(phrase, section);
    const targetDegrees = buildTargetDegrees(phrase, section, context, contour);
    const registerAnchor = resolveRegisterAnchor(phrase, context);
    const leapBudget = resolveLeapBudget(phrase, context, rhythm);
    const motionBias = resolveMotionBias(phrase, hookStrength, context, rhythm, expression);
    const ornamentation = resolveOrnamentation(phrase, section, context, rhythm, expression);
    const landingTone = resolveLandingTone(phrase, section, context, harmony);
    const counterlineRole = resolveCounterlineRole(
      phrase,
      section,
      hookStrength,
      context,
      rhythm,
      expression
    );
    const avoidTextureCues = resolveAvoidTextureCues(context);
    const cleanupTargets = resolveCleanupTargets(avoidTextureCues, context);
    const repetitionWindowBars = hookStrength >= 0.8 ? 2 : hookStrength >= 0.6 ? 3 : 4;

    return {
      phraseId: phrase.phraseId,
      contour,
      phraseFunction,
      hookStrength,
      targetDegrees,
      registerAnchor,
      motionBias,
      leapBudget,
      landingTone,
      ornamentation,
      repetitionWindowBars,
      counterlineRole,
      lyricStressMap: buildLyricStressMap(phrase.bars, phraseFunction, hookStrength),
      avoidTextureCues,
      cleanupTargets,
      climaxBar:
        phrase.role === "release"
          ? Math.max(1, phrase.bars - 1)
          : phrase.role === "lift"
            ? Math.max(1, phrase.bars)
            : Math.max(1, Math.ceil(phrase.bars * 0.65)),
      ...((phrase.variationRole === "answer" || phrase.variationRole === "repeat") &&
      phrase.followsPhraseId
        ? { antecedentPhraseId: phrase.followsPhraseId }
        : {}),
      phraseIndex: index
    };
  }
}

function resolveAvoidTextureCues(context: PlanningContext): string[] {
  const source = [
    context.constraints.mood,
    context.constraints.stylePack,
    context.constraints.adapterPreference,
    context.constraints.workType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const cues = [
    "avoid police-siren glides in synth leads",
    "avoid steady electrical hum in pads and risers",
    "avoid horror riser shrieks and dread stabs",
    "avoid non-pitched industrial clatter in the lead layer",
    "avoid static hiss, alarm pulses, and glitch bursts that mask singable pitch"
  ];
  if (source.includes("electronic") || source.includes("kontakt")) {
    cues.push("avoid harsh upper-mid whine in bright layers");
  }
  return cues;
}

function resolveCleanupTargets(
  avoidTextureCues: string[],
  context: PlanningContext
): Array<"siren_band" | "electrical_hum" | "harsh_whine"> {
  const targets: Array<"siren_band" | "electrical_hum" | "harsh_whine"> = ["siren_band", "electrical_hum"];
  if (
    avoidTextureCues.some((entry) => entry.includes("whine")) ||
    context.constraints.instrumentationProfile === "electronic"
  ) {
    targets.push("harsh_whine");
  }
  return targets;
}

function resolveContour(
  phrase: PhrasePlan,
  section: SectionPlan | undefined,
  context: PlanningContext,
  rhythm: RhythmPlan | undefined
): MelodyPlan["contour"] {
  if (phrase.role === "release") return "soaring_arc";
  if (rhythm?.grooveTemplate === "floating") return "wave";
  if (section?.sectionType === "bridge") return "lift_then_fall";
  if (phrase.variationRole === "answer") return "answering_fall";
  if (context.constraints.melodicContour === "ascending") return "stepwise_rise";
  if (context.constraints.melodicContour === "wave") return "wave";
  if (context.constraints.melodicContour === "grounded") return "pedal_glow";
  return "arched";
}

function resolvePhraseFunction(
  phrase: PhrasePlan,
  section: SectionPlan | undefined
): MelodyPlan["phraseFunction"] {
  if (phrase.role === "release") return "hook";
  if (phrase.role === "lift" || section?.sectionType === "bridge") return "lift";
  if (phrase.role === "resolve") return "cadence";
  if (phrase.variationRole === "answer") return "answer";
  return "statement";
}

function resolveHookStrength(
  phrase: PhrasePlan,
  section: SectionPlan | undefined,
  context: PlanningContext,
  harmony: HarmonyPlan | undefined,
  expression: ExpressionPlan | undefined
): number {
  let base =
    phrase.role === "release"
      ? 0.94
      : phrase.role === "lift"
        ? 0.76
        : phrase.variationRole === "repeat"
          ? 0.72
          : phrase.variationRole === "answer"
            ? 0.58
            : 0.46;
  if (section?.sectionType === "chorus") base += 0.08;
  if (context.constraints.repetitionStrength >= 0.7) base += 0.04;
  if (context.constraints.expressionBias === "theatrical") base += 0.03;
  if (harmony?.tensionHint === "bright" || harmony?.tensionHint === "resolved") base += 0.03;
  if (expression?.intensity === "peak") base += 0.04;
  if (expression?.intensity === "high") base += 0.02;
  return Number(Math.max(0.25, Math.min(1, base)).toFixed(2));
}

function buildTargetDegrees(
  phrase: PhrasePlan,
  section: SectionPlan | undefined,
  context: PlanningContext,
  contour: MelodyPlan["contour"]
): number[] {
  const chorusDegrees =
    context.constraints.instrumentationProfile === "guofeng"
      ? [1, 2, 3, 5, 6]
      : [1, 3, 5, 6, 8];
  const bridgeDegrees =
    context.constraints.instrumentationProfile === "guofeng"
      ? [5, 6, 3, 2]
      : [6, 8, 5, 4];
  const statementDegrees =
    context.constraints.instrumentationProfile === "guofeng"
      ? [1, 2, 3, 2]
      : [1, 3, 2, 1];
  const answerDegrees =
    context.constraints.instrumentationProfile === "guofeng"
      ? [3, 2, 1, 6]
      : [5, 4, 3, 2];
  let degrees =
    phrase.role === "release"
      ? chorusDegrees
      : section?.sectionType === "bridge"
        ? bridgeDegrees
        : phrase.variationRole === "answer"
          ? answerDegrees
          : statementDegrees;
  if (contour === "stepwise_rise") {
    degrees = degrees.slice().sort((a, b) => a - b);
  }
  if (contour === "answering_fall") {
    degrees = degrees.slice().sort((a, b) => b - a);
  }
  return degrees;
}

function resolveRegisterAnchor(
  phrase: PhrasePlan,
  context: PlanningContext
): MelodyPlan["registerAnchor"] {
  if (phrase.role === "release") {
    return context.constraints.voicingRegister === "low" ? "mid" : "high";
  }
  if (context.constraints.voicingRegister === "wide") {
    return phrase.variationRole === "development" ? "mid_high" : "mid";
  }
  if (context.constraints.voicingRegister === "high") return "high";
  if (context.constraints.voicingRegister === "low") return "low";
  return "mid";
}

function resolveMotionBias(
  phrase: PhrasePlan,
  hookStrength: number,
  context: PlanningContext,
  rhythm: RhythmPlan | undefined,
  expression: ExpressionPlan | undefined
): MelodyPlan["motionBias"] {
  if (phrase.role === "release" || hookStrength >= 0.85) return "balanced_lift";
  if (rhythm?.syncopation === "high") return "balanced_lift";
  if (expression?.articulation === "accented") return "contrast_leap";
  if (context.constraints.articulationBias === "legato") return "stepwise";
  if (phrase.variationRole === "development") return "contrast_leap";
  return "stepwise";
}

function resolveLeapBudget(
  phrase: PhrasePlan,
  context: PlanningContext,
  rhythm: RhythmPlan | undefined
): MelodyPlan["leapBudget"] {
  if (phrase.role === "release") {
    return context.constraints.complexity >= 0.7 ? 2 : 1;
  }
  if (rhythm?.density === "busy") return 2;
  if (phrase.variationRole === "development") return 2;
  return context.constraints.instrumentationProfile === "guofeng" ? 1 : 2;
}

function resolveLandingTone(
  phrase: PhrasePlan,
  section: SectionPlan | undefined,
  context: PlanningContext,
  harmony: HarmonyPlan | undefined
): MelodyPlan["landingTone"] {
  if (phrase.cadenceIntent === "authentic" || phrase.role === "resolve") return "tonic";
  if (phrase.cadenceIntent === "half") return "dominant";
  if (phrase.cadenceIntent === "deceptive") return "submediant";
  if (harmony?.tensionHint === "suspended") return "suspended";
  if (section?.sectionType === "bridge") return "suspended";
  return context.constraints.instrumentationProfile === "guofeng" ? "fifth" : "third";
}

function resolveOrnamentation(
  phrase: PhrasePlan,
  section: SectionPlan | undefined,
  context: PlanningContext,
  rhythm: RhythmPlan | undefined,
  expression: ExpressionPlan | undefined
): MelodyPlan["ornamentation"] {
  if (context.constraints.instrumentationProfile === "guofeng") {
    if (phrase.role === "release") return "glide_turn";
    if (section?.sectionType === "bridge") return "grace_fall";
    if (rhythm?.grooveTemplate === "floating") return "grace_fall";
    return "lean";
  }
  if (phrase.role === "release") return "belt_accent";
  if (expression?.articulation === "accented") return "belt_accent";
  if (phrase.variationRole === "development") return "neighbor";
  return "none";
}

function resolveCounterlineRole(
  phrase: PhrasePlan,
  section: SectionPlan | undefined,
  hookStrength: number,
  context: PlanningContext,
  rhythm: RhythmPlan | undefined,
  expression: ExpressionPlan | undefined
): MelodyPlan["counterlineRole"] {
  if (phrase.role === "release") return "octave_doubles";
  if (expression?.densityCurve === "bloom" && rhythm?.density === "busy") return "octave_doubles";
  if (section?.sectionType === "bridge") return "echo_answer";
  if (context.constraints.instrumentationProfile === "guofeng" && hookStrength >= 0.55) {
    return "call_response";
  }
  return "none";
}

function buildLyricStressMap(
  bars: number,
  phraseFunction: MelodyPlan["phraseFunction"],
  hookStrength: number
): Array<"lift" | "settle" | "hold" | "answer"> {
  return Array.from({ length: bars }, (_, index) => {
    const lastBar = index === bars - 1;
    if (phraseFunction === "hook") return lastBar ? "lift" : index % 2 === 0 ? "hold" : "lift";
    if (phraseFunction === "answer") return lastBar ? "settle" : "answer";
    if (phraseFunction === "cadence") return lastBar ? "settle" : "hold";
    return hookStrength >= 0.7 && lastBar ? "lift" : "hold";
  });
}
