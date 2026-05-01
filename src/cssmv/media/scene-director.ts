import type { ProjectSpec } from "../core/project-spec";
import type { NarrativePlanEnvelope } from "../schemas/narrative-plan";
import type { SceneNode, ScenePlan } from "../schemas/scene-plan";
import type { StoryGraph } from "../schemas/story-graph";

function inferSectionType(scene: SceneNode): string {
  const source = `${scene.sourceSection || ""} ${scene.label}`.toLowerCase();
  if (source.includes("intro")) return "intro";
  if (source.includes("pre")) return "pre_chorus";
  if (source.includes("chorus")) return "chorus";
  if (source.includes("bridge")) return "bridge";
  if (source.includes("outro")) return "outro";
  if (source.includes("verse")) return "verse";
  return "passage";
}

function inferEmotionalBeat(
  index: number,
  total: number,
  sectionType: string
): NonNullable<SceneNode["emotionalBeat"]> {
  if (sectionType === "chorus") return index === total - 1 && total > 2 ? "release" : "peak";
  if (sectionType === "bridge") return "lift";
  if (index === 0) return "setup";
  if (index === total - 1) return "resolve";
  if (index >= Math.max(1, total - 2)) return "release";
  return "lift";
}

function inferEnergyProfile(
  sectionType: string,
  beat: NonNullable<SceneNode["emotionalBeat"]>
): NonNullable<SceneNode["energyProfile"]> {
  if (beat === "peak") return "peak";
  if (beat === "release") return "high";
  if (sectionType === "chorus" || sectionType === "bridge") return "high";
  if (beat === "setup") return "low";
  return "medium";
}

function inferShotType(
  index: number,
  total: number,
  beat: NonNullable<SceneNode["emotionalBeat"]>
): NonNullable<SceneNode["shotType"]> {
  if (beat === "peak") return "wide";
  if (beat === "resolve") return "aerial";
  if (index === 0) return "wide";
  if (index >= total - 2) return "close_medium";
  return "medium";
}

function inferCameraMove(
  beat: NonNullable<SceneNode["emotionalBeat"]>,
  sectionType: string
): NonNullable<SceneNode["cameraMove"]> {
  if (beat === "peak") return "orbit";
  if (beat === "release") return "crane";
  if (sectionType === "bridge") return "push";
  if (beat === "setup") return "glide";
  return "push";
}

function buildVisualScript(scene: SceneNode, protagonistName: string, project: ProjectSpec): string {
  const subject = protagonistName || "the lead figure";
  const title = project.title || project.songSeed?.title || "cssMV";
  const section = scene.sourceSection || scene.label;
  const beat = scene.emotionalBeat || "lift";
  const shot = scene.shotType || "medium";
  const move = scene.cameraMove || "glide";
  const prompt = scene.visualPrompt || scene.summary || scene.label;
  const energy = scene.energyProfile || "medium";
  return [
    `${title} ${section} sequence centered on ${subject}.`,
    `Play the scene as a ${energy} ${beat} beat with a ${shot} shot and ${move} camera motion.`,
    prompt,
    scene.visualRole ? `Visual role: ${scene.visualRole}.` : "",
    "Keep the protagonist readable, preserve continuity, and avoid static dead frames."
  ]
    .filter(Boolean)
    .join(" ");
}

export class SceneDirector {
  direct(
    scenePlan: ScenePlan,
    narrative: NarrativePlanEnvelope,
    graph: StoryGraph,
    project: ProjectSpec
  ): ScenePlan {
    const protagonistName = graph.characters[0]?.name || "Lead";
    const totalScenes = scenePlan.scenes.length;
    const scenes = scenePlan.scenes.map((scene, index) => {
      const sectionType = inferSectionType(scene);
      const emotionalBeat = inferEmotionalBeat(index, totalScenes, sectionType);
      const energyProfile = inferEnergyProfile(sectionType, emotionalBeat);
      const shotType = inferShotType(index, totalScenes, emotionalBeat);
      const cameraMove = inferCameraMove(emotionalBeat, sectionType);
      const cameraLanguage =
        project.creative?.licensed_style_pack ||
        project.creative?.prompt ||
        (narrative.mode === "music_video" ? "gliding lyrical escalation" : "cinematic progression");
      const visualPrompt =
        scene.visualPrompt ||
        scene.summary ||
        `${scene.label} staged as ${energyProfile} ${sectionType} imagery`;
      const directorNotes = [
        `beat=${emotionalBeat}`,
        `energy=${energyProfile}`,
        `shot=${shotType}`,
        `move=${cameraMove}`
      ];

      return {
        ...scene,
        sectionType,
        emotionalBeat,
        energyProfile,
        shotType,
        cameraMove,
        cameraLanguage,
        visualPrompt,
        visualScript: buildVisualScript(
          {
            ...scene,
            emotionalBeat,
            energyProfile,
            shotType,
            cameraMove,
            visualPrompt
          },
          protagonistName,
          project
        ),
        directorNotes
      };
    });

    return {
      ...scenePlan,
      scenes
    };
  }
}
