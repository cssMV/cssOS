import type { ProjectSpec } from "../../core/project-spec";
import type { MusicPlan } from "../../schemas/music-plan";
import { writeStubWav } from "./stub-audio-renderer";
import type { AudioRenderArtifacts, AudioRenderer } from "./types";

export class DefaultStubAudioRenderer implements AudioRenderer {
  readonly id = "cssmv.render.audio.stub";
  readonly version = "v1";
  readonly mode = "stub" as const;

  render(input: {
    project: ProjectSpec;
    musicPlan: MusicPlan;
    paths: { previewWavPath: string; mixWavPath: string };
    previewCues: Array<{ durationSec: number; energy?: string; section?: string }>;
    mixCues: Array<{ durationSec: number; energy?: string; section?: string }>;
  }): AudioRenderArtifacts {
    writeStubWav(input.paths.previewWavPath, input.previewCues);
    writeStubWav(input.paths.mixWavPath, input.mixCues);
    return {
      previewWavPath: input.paths.previewWavPath,
      mixWavPath: input.paths.mixWavPath,
      capability: {
        symbolicComposition: true,
        licensedLibraryPlayback: false,
        externalAdapterBridge: false,
        vocalSynthesis: false,
        stemRendering: false,
        mixBusProcessing: false
      },
      stemPlan: [],
      provenance: {
        rendererId: this.id,
        rendererVersion: this.version,
        mode: this.mode,
        notes: [
          "Stub renderer for development only.",
          "Replace with licensed library, external adapter, or vocal/mix chain implementation for production audio."
        ]
      }
    };
  }
}
