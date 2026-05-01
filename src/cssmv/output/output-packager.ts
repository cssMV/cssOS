import type { NarrativePlanEnvelope } from "../schemas/narrative-plan";
import type { MusicPlan } from "../schemas/music-plan";
import type { OutputPackage } from "../schemas/output-package";
import type { RenderedMedia } from "../schemas/rendered-media";
import type { ScenePlan } from "../schemas/scene-plan";
import { flattenStructuredLeaves } from "../schemas/structure-tree";

export class OutputPackager {
  package(
    renderedMedia: RenderedMedia,
    narrative: NarrativePlanEnvelope,
    musicPlan: MusicPlan,
    scenePlan: ScenePlan
  ): OutputPackage {
    const previewSeedTitle =
      narrative.mode === "music_video"
        ? renderedMedia.previewStoryboard?.[0]?.split("·")[0]?.replace(/^\d+\.\s*/, "").trim() || ""
        : "";
    const outputPackage: OutputPackage = {
      ...(renderedMedia.audioPreview ? { audioPreview: renderedMedia.audioPreview } : {}),
      ...(renderedMedia.audioMix ? { audioMix: renderedMedia.audioMix } : {}),
      subtitles: renderedMedia.subtitleTrack ? [renderedMedia.subtitleTrack] : [],
      ...(renderedMedia.subtitleCues?.length ? { subtitleCues: renderedMedia.subtitleCues } : {}),
      ...(renderedMedia.segmentTimeline?.length
        ? { segmentTimeline: renderedMedia.segmentTimeline }
        : {}),
      ...(renderedMedia.previewStoryboard?.length
        ? { previewStoryboard: renderedMedia.previewStoryboard }
        : {}),
      ...(renderedMedia.previewScript?.length
        ? { previewScript: renderedMedia.previewScript }
        : {}),
      ...(renderedMedia.workType ? { workType: renderedMedia.workType } : {}),
      ...(renderedMedia.structureTree?.length ? { structureTree: renderedMedia.structureTree } : {}),
      metadata: {
        mode: narrative.mode,
        planType: narrative.plan.type,
        musicStrategy: musicPlan.strategy,
        sceneCount: scenePlan.scenes.length,
        cueCount: musicPlan.cues.length,
        durationSec: renderedMedia.totalDurationSec ?? 0,
        segmentCount: renderedMedia.videoSegments.length,
        trackCount: musicPlan.tracks.length,
        renderProfile: renderedMedia.renderProfile ?? "mv_stub",
        previewSegmentCount: musicPlan.previewSegments?.length ?? 0,
        previewScriptLineCount: renderedMedia.previewScript?.length ?? 0,
        previewStoryboardFrameCount: renderedMedia.previewStoryboard?.length ?? 0,
        subtitleCueCount: renderedMedia.subtitleCues?.length ?? 0,
        transitionCount: scenePlan.transitions?.length ?? 0,
        structureNodeCount: flattenStructuredLeaves(renderedMedia.structureTree || []).length,
        ...(renderedMedia.workType ? { workType: renderedMedia.workType } : {}),
        ...(previewSeedTitle ? { seedTitle: previewSeedTitle } : {})
      }
    };

    if (renderedMedia.mainCompositeVideo) {
      outputPackage.mainVideo = renderedMedia.mainCompositeVideo;
    } else if (renderedMedia.videoSegments[0]) {
      outputPackage.mainVideo = renderedMedia.videoSegments[0];
    }

    outputPackage.clips = renderedMedia.videoSegments;

    return outputPackage;
  }
}
