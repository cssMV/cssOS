import type { ProjectSpec } from "../core/project-spec";
import { adaptToPlanningContext } from "./planning/planner-adapter";
import { MusicPlanner } from "./planning/planner";
import { validateMusicPlanDocument } from "./planning/validation";
import type { NarrativePlanEnvelope } from "../schemas/narrative-plan";
import type { MusicPlan, PreviewSegment } from "../schemas/music-plan";
import type { ScenePlan } from "../schemas/scene-plan";
import type { StoryGraph } from "../schemas/story-graph";

function resolveMusicStrategy(narrative: NarrativePlanEnvelope, scenePlan: ScenePlan): MusicPlan["strategy"] {
  if (narrative.mode !== "music_video") {
    return "fragment";
  }

  if (narrative.plan.type !== "mv") {
    return "fragment";
  }

  const durationSec = narrative.plan.durationSec;
  const sceneCount = scenePlan.scenes.length;

  if (durationSec <= 120 || sceneCount <= 2) {
    return "full_song";
  }

  return "hybrid";
}

export class MusicDirector {
  private readonly planner = new MusicPlanner();

  plan(
    graph: StoryGraph,
    narrative: NarrativePlanEnvelope,
    scenePlan: ScenePlan,
    project?: ProjectSpec
  ): MusicPlan {
    const leadMotif = graph.characters[0]?.musicProfile?.themeMotifId;
    const strategy = resolveMusicStrategy(narrative, scenePlan);
    const planningContext = adaptToPlanningContext(project, graph, narrative, scenePlan);
    const planningDocument = this.planner.build(scenePlan, planningContext);
    const planningValidation = validateMusicPlanDocument(planningDocument);
    let runningSec = 0;
    const previewSegments: PreviewSegment[] = scenePlan.scenes.map((scene, index) => {
      const durationSec = Math.max(6, scene.durationSec ?? 12);
      const section = scene.sourceSection || scene.label;
      const sectionKey = section.toLowerCase();
      const visualRole = scene.visualRole || scene.summary || "cinematic progression";
      const energy =
        scene.label.toLowerCase().includes("chorus")
          ? "high"
          : index === 0
            ? "low"
            : index >= Math.max(1, scenePlan.scenes.length - 2)
              ? "peak"
              : "medium";
      const hookRole: PreviewSegment["hookRole"] =
        sectionKey.includes("chorus 4")
          ? "release"
          : sectionKey.includes("chorus")
            ? "return"
            : sectionKey.includes("bridge")
              ? "lift"
              : "setup";
      const segment: PreviewSegment = {
        section,
        title: scene.label,
        startSec: runningSec,
        durationSec,
        bars: Math.max(4, Math.round(durationSec / 2)),
        energy,
        audioCue: `${section} cue driven by ${visualRole}`,
        hookRole
      };
      runningSec += durationSec;
      return segment;
    });
    const previewScript = previewSegments.map(
      (segment) =>
        `${segment.section} · ${segment.title} · ${segment.startSec}s-${segment.startSec + segment.durationSec}s · ${segment.energy} energy · ${segment.hookRole || "setup"} hook role · ${segment.audioCue}`
    );

    return {
      tracks: [
        {
          trackId: "track_main_001",
          label: leadMotif ?? `${narrative.mode}_main_theme`,
          purpose:
            strategy === "full_song"
              ? "Single-song backbone for a compact MV arc"
              : "Primary thematic support with sectional variation",
          stems:
            strategy === "full_song"
              ? ["lead_vocal", "main_harmony", "rhythm_bed"]
              : ["lead_vocal", "choir_lift", "rhythm_bed", "cinematic_fx"],
          texture:
            strategy === "full_song"
              ? "steady melodic line with repeatable refrain"
              : "section-driven arrangement with expanding energy"
        }
      ],
      cues: scenePlan.scenes.map((scene, index) => {
        const preview = previewSegments[index];
        const cueBase = {
          cueId: `cue_${String(index + 1).padStart(3, "0")}`,
          label:
            strategy === "full_song"
              ? `Full-song cue for ${scene.label}`
              : `Section cue for ${scene.label}`,
          targetSceneId: scene.sceneId,
          section: scene.sourceSection || scene.label
        };
        return {
          ...cueBase,
          ...(preview?.bars ? { bars: preview.bars } : {}),
          ...(preview ? { startSec: preview.startSec, durationSec: preview.durationSec } : {}),
          ...(preview?.energy ? { energy: preview.energy } : {}),
          ...(preview?.audioCue ? { arrangementHint: preview.audioCue } : {})
        };
      }),
      strategy,
      structureSummary:
        strategy === "full_song"
        ? "Compact single-song arc with a stable melodic center and repeatable hook."
        : "Hybrid sectional arc with rising chant energy, bridge lift, and final release.",
      previewSegments,
      previewScript,
      sections: planningDocument.sections.map((section) => ({
        sectionId: section.sectionId,
        label: section.label,
        startSec: section.startSec,
        durationSec: section.durationSec,
        bars: section.bars,
        energy: section.energy,
        role: section.sectionType,
        motifIds: planningDocument.phrases
          .filter((phrase) => phrase.sectionId === section.sectionId)
          .map((phrase) => phrase.motifId),
        phrases: planningDocument.phrases
          .filter((phrase) => phrase.sectionId === section.sectionId)
          .map((phrase) => phrase.phraseId)
      })),
      phrases: planningDocument.phrases.map((phrase) => {
        const rhythm = planningDocument.rhythm.find((entry) => entry.phraseId === phrase.phraseId);
        const expression = planningDocument.expression.find((entry) => entry.phraseId === phrase.phraseId);
        const harmony = planningDocument.harmony.find((entry) => entry.phraseId === phrase.phraseId);
        const melody = planningDocument.melody.find((entry) => entry.phraseId === phrase.phraseId);
        const sourceSceneId = planningDocument.sections.find(
          (section) => section.sectionId === phrase.sectionId
        )?.sourceSceneId;
        return {
          phraseId: phrase.phraseId,
          section:
            planningDocument.sections.find((section) => section.sectionId === phrase.sectionId)?.label ||
            phrase.sectionId,
          startSec: phrase.startSec,
          durationSec: phrase.durationSec,
          bars: phrase.bars,
          role: phrase.role,
          motifId: phrase.motifId,
          ...(sourceSceneId ? { sceneId: sourceSceneId } : {}),
          ...(phrase.followsPhraseId ? { followsPhraseId: phrase.followsPhraseId } : {}),
          groove: {
            pocket:
              rhythm?.pushPullProfile?.includes("pushed")
                ? "pushed"
                : rhythm?.microTimingMs && rhythm.microTimingMs >= 16
                  ? "laid_back"
                  : "centered",
            syncopation: rhythm?.syncopation || "medium",
            swing: rhythm?.swing || "straight",
            accentPattern: rhythm?.accents || ["1", "3"],
            ...(rhythm ? { microTimingMs: rhythm.microTimingMs } : {}),
            ...(rhythm?.barAccents ? { barAccentPattern: rhythm.barAccents } : {}),
            ...(rhythm?.activityProfile ? { activityProfile: rhythm.activityProfile } : {}),
            ...(rhythm?.pushPullProfile ? { pushPullProfile: rhythm.pushPullProfile } : {})
          },
          dynamics: {
            intensity: expression?.intensity || "medium",
            density:
              expression?.densityCurve === "thin"
                ? "sparse"
                : expression?.densityCurve === "bloom"
                  ? "wall"
                  : "steady",
            registerFocus:
              expression?.registerContour === "rising"
                ? "high"
                : expression?.registerContour === "wide"
                  ? "wide"
                  : "mid",
            articulation: expression?.articulation || "mixed"
          },
          tension: {
            anchor:
              phrase.role === "release"
                ? "release"
                : phrase.role === "resolve"
                  ? "resolve"
                  : phrase.role === "lift"
                    ? "build"
                    : "entry",
            tension:
              harmony?.tensionHint === "rising"
                ? 0.82
                : harmony?.tensionHint === "resolved"
                  ? 0.3
                  : 0.55,
            release: phrase.role === "release" || phrase.role === "resolve" ? 0.9 : 0.4
          },
          constraints: {
            preserveMotifIds: [phrase.motifId],
            rewriteScope: "phrase",
            cadenceBias:
              harmony?.cadence === "authentic" || harmony?.cadence === "plagal"
                ? "resolved"
                : harmony?.cadence === "open" || harmony?.cadence === "half"
                  ? "open"
                  : "deceptive",
            maxLeapSemitones: planningDocument.constraints.complexity >= 0.65 ? 9 : 6,
            avoidRepetitionWindowBars:
              phrase.variationRole === "repeat"
                ? 2
                : planningDocument.constraints.repetitionStrength >= 0.7
                  ? 4
                  : 2
          },
          ...(melody
            ? {
                melody: {
                  contour: melody.contour,
                  phraseFunction: melody.phraseFunction,
                  hookStrength: melody.hookStrength,
                  targetDegrees: melody.targetDegrees,
                  registerAnchor: melody.registerAnchor,
                  motionBias: melody.motionBias,
                  leapBudget: melody.leapBudget,
                  landingTone: melody.landingTone,
                  ornamentation: melody.ornamentation,
                  repetitionWindowBars: melody.repetitionWindowBars,
                  counterlineRole: melody.counterlineRole,
                  lyricStressMap: melody.lyricStressMap,
                  climaxBar: melody.climaxBar,
                  ...(melody.antecedentPhraseId
                    ? { antecedentPhraseId: melody.antecedentPhraseId }
                    : {})
                }
              }
            : {})
        };
      }),
      generationControl: {
        seed: planningDocument.constraints.deterministicSeed,
        variation: Number((1 - planningDocument.constraints.repetitionStrength).toFixed(2)),
        humanizeMs: Math.round(planningDocument.constraints.rhythmicActivity * 20),
        allowSectionRegeneration: true,
        sampling: {
          temperature: Number((0.45 + planningDocument.constraints.complexity * 0.25).toFixed(2)),
          topP: Number((0.78 + planningDocument.constraints.rhythmicActivity * 0.15).toFixed(2)),
          retryBudget: planningValidation.ok ? 2 : 0
        },
        repairPolicy: {
          onRhythmCollapse: "tighten_grid",
          onStructureDrift: "snap_to_section_plan"
        }
      }
    };
  }
}
