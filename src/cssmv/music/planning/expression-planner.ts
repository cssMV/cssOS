import type { ExpressionPlan, PhrasePlan, SectionPlan } from "./types";
import type { PlanningContext } from "./planner-adapter";

export class ExpressionPlanner {
  build(phrases: PhrasePlan[], sections: SectionPlan[], context: PlanningContext): ExpressionPlan[] {
    return phrases.map((phrase) =>
      this.planPhraseExpression(phrase, sections.find((section) => section.sectionId === phrase.sectionId), context)
    );
  }

  private planPhraseExpression(
    phrase: PhrasePlan,
    section: SectionPlan | undefined,
    context: PlanningContext
  ): ExpressionPlan {
    const dynamicRange = context.constraints.dynamicRange;
    const contour = context.constraints.melodicContour;
    const expressionBias = context.constraints.expressionBias;
    const ambience = context.constraints.ambienceProfile;
    return {
      phraseId: phrase.phraseId,
      intensity:
        expressionBias === "theatrical" && section?.sectionType === "chorus"
          ? "peak"
          : phrase.role === "release"
          ? "peak"
          : dynamicRange > 0.72 && phrase.role === "statement"
            ? "high"
          : phrase.role === "lift" || section?.energy === "high"
            ? "high"
            : phrase.role === "setup"
              ? "low"
              : "medium",
      articulation:
        expressionBias === "intimate"
          ? "legato"
          : context.constraints.articulationBias === "legato"
          ? "legato"
          : context.constraints.articulationBias === "accented"
            ? "accented"
            : phrase.variationRole === "answer"
              ? "mixed"
              : phrase.role === "release"
                ? "accented"
                : phrase.role === "response"
                  ? "staccato"
                  : "legato",
      velocityContour:
        expressionBias === "dramatic" && phrase.role !== "setup"
          ? "surge"
          : dynamicRange > 0.7 && phrase.role === "statement"
          ? "ramp_up"
          : phrase.role === "release"
            ? "surge"
            : phrase.role === "lift"
              ? "wave"
              : phrase.variationRole === "development"
                ? "ramp_up"
                : "flat",
      registerContour:
        context.constraints.voicingRegister === "wide"
          ? "wide"
          : contour === "ascending" || phrase.role === "lift" || phrase.role === "release"
            ? "rising"
            : phrase.variationRole === "development"
              ? "wide"
              : section?.sectionType === "outro"
                ? "lifted"
                : "grounded",
      densityCurve:
        ambience === "cathedral" && section?.sectionType !== "intro"
          ? "bloom"
          : dynamicRange > 0.72 && section?.sectionType === "chorus"
          ? "bloom"
          : phrase.role === "release"
            ? "bloom"
            : phrase.variationRole === "development"
              ? "thick"
              : phrase.role === "response"
                ? "balanced"
                : "thin"
    };
  }
}
