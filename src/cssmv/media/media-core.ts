import type { ProjectSpec } from "../core/project-spec";
import type { MusicPlan } from "../schemas/music-plan";
import type { RenderedMedia } from "../schemas/rendered-media";
import type { ScenePlan } from "../schemas/scene-plan";
import {
  buildPreviewStoryboard,
  buildSegmentTimeline,
  tryRenderWithRustVideoEngine,
  type MediaRenderContext
} from "./rust-video-engine";

export class MediaCore {
  render(scenePlan: ScenePlan, musicPlan: MusicPlan, context: MediaRenderContext = {}): RenderedMedia {
    const preferRustVideoEngine = context.preferRustVideoEngine ?? Boolean(context.audioMixPath);
    if (preferRustVideoEngine) {
      const rustResult = tryRenderWithRustVideoEngine(scenePlan, musicPlan, context);
      if (rustResult.renderedMedia) {
        return rustResult.renderedMedia;
      }
      if (context.fallbackToStub === false) {
        throw new Error(rustResult.errorMessage || "rust video engine failed");
      }
      const fallback = this.renderStub(scenePlan, musicPlan, context.project, context.audioMixPath);
      return {
        ...fallback,
        videoEngineDetail: {
          engineId: "cssmv-video-engine",
          mode: "rust_cli_fallback",
          errorMessage: rustResult.errorMessage || "rust video engine failed without stderr"
        }
      };
    }

    if (context.fallbackToStub === false) {
      throw new Error("rust video engine disabled and stub fallback is forbidden");
    }
    return this.renderStub(scenePlan, musicPlan, context.project, context.audioMixPath);
  }

  private renderStub(
    scenePlan: ScenePlan,
    musicPlan: MusicPlan,
    _project?: ProjectSpec,
    audioMixPath?: string
  ): RenderedMedia {
    const videoSegments = scenePlan.scenes.map((scene) => `renders/${scene.sceneId}.mp4`);
    const thumbnails = scenePlan.scenes.map((scene) => `renders/thumb_${scene.sceneId}.jpg`);
    const segmentTimeline = buildSegmentTimeline(scenePlan, musicPlan, videoSegments).map((segment, index) => ({
      ...segment,
      ...(thumbnails[index] ? { thumbnailPath: thumbnails[index] } : {})
    }));
    const totalDurationSec = segmentTimeline.reduce((sum, segment) => sum + segment.durationSec, 0);
    const previewStoryboard = buildPreviewStoryboard(scenePlan);
    const subtitleCues = segmentTimeline.map(
      (segment) =>
        `${segment.startSec.toFixed(0)}-${segment.endSec.toFixed(0)}s · ${segment.label} · ${segment.subtitleText || "instrumental interlude"}`
    );

    return {
      videoSegments,
      ...(segmentTimeline.length ? { segmentTimeline } : {}),
      ...(videoSegments.length > 0
        ? {
            mainCompositeVideo: `renders/main_video__${String(videoSegments.length).padStart(2, "0")}_scenes.mp4`
          }
        : {}),
      ...(musicPlan.previewSegments?.length
        ? {
            audioPreview: `renders/audio_preview__${String(musicPlan.previewSegments.length).padStart(2, "0")}_segments.mp3`
          }
        : {}),
      audioMix: audioMixPath || "renders/mix.mp3",
      subtitleTrack: "renders/subtitles.vtt",
      ...(subtitleCues.length ? { subtitleCues } : {}),
      thumbnails,
      totalDurationSec,
      previewStoryboard,
      previewScript: musicPlan.previewScript ?? [],
      renderProfile: "mv_stub",
      ...(scenePlan.workType ? { workType: scenePlan.workType } : {}),
      ...(scenePlan.structureTree?.length ? { structureTree: scenePlan.structureTree } : {})
    };
  }
}
