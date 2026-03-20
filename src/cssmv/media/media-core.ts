import type { MusicPlan } from "../schemas/music-plan";
import type { RenderedMedia } from "../schemas/rendered-media";
import type { ScenePlan } from "../schemas/scene-plan";

export class MediaCore {
  render(scenePlan: ScenePlan, musicPlan: MusicPlan): RenderedMedia {
    const videoSegments = scenePlan.scenes.map((scene) => `renders/${scene.sceneId}.mp4`);
    const totalDurationSec = scenePlan.scenes.reduce((sum, scene) => sum + (scene.durationSec ?? 0), 0);
    const previewStoryboard = scenePlan.scenes.map((scene, index) => {
      const prompt = scene.visualPrompt || scene.summary || "cinematic mv preview frame";
      const role = scene.visualRole || "performance beat";
      return `${String(index + 1).padStart(2, "0")}. ${scene.label} · ${role} · ${prompt}`;
    });

    return {
      videoSegments,
      ...(videoSegments.length > 0
        ? {
            mainCompositeVideo: `renders/main_video__${String(videoSegments.length).padStart(2, "0")}_scenes.mp4`
          }
        : {}),
      ...(musicPlan.previewSegments?.length
        ? {
            audioPreview: `renders/audio_preview__${String(musicPlan.previewSegments.length).padStart(2, "0")}_segments.wav`
          }
        : {}),
      audioMix: `renders/${musicPlan.tracks[0]?.trackId ?? "main"}.wav`,
      subtitleTrack: "renders/subtitles.vtt",
      thumbnails: ["renders/thumb_001.jpg"],
      totalDurationSec,
      previewStoryboard,
      previewScript: musicPlan.previewScript ?? [],
      renderProfile: "mv_stub"
    };
  }
}
