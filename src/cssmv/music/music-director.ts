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
  plan(graph: StoryGraph, narrative: NarrativePlanEnvelope, scenePlan: ScenePlan): MusicPlan {
    const leadMotif = graph.characters[0]?.musicProfile?.themeMotifId;
    const strategy = resolveMusicStrategy(narrative, scenePlan);
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
      previewScript
    };
  }
}
