import type { MusicPlan } from "../../schemas/music-plan";
import type { ProjectSpec } from "../../core/project-spec";
import type { VocalSourceArtifacts, VocalSourceRenderer } from "./types";
import { resolveResourceSelection, toLegalBinding } from "./resource-registry";

class StubVocalSourceRenderer implements VocalSourceRenderer {
  readonly id = "cssmv.render.vocal_source.stub";
  readonly version = "v1";
  readonly mode = "stub" as const;

  render(input: { project: ProjectSpec; musicPlan: MusicPlan; lyrics?: string }): VocalSourceArtifacts {
    void input;
    return {
      rendererId: this.id,
      rendererVersion: this.version,
      mode: this.mode,
      capability: {
        symbolicComposition: false,
        licensedLibraryPlayback: false,
        externalAdapterBridge: false,
        vocalSynthesis: false,
        stemRendering: false,
        mixBusProcessing: false
      },
      notes: [
        "No vocal source backend is configured yet.",
        "Replace with a licensed voicebank, authorized singer synth, or approved external vocal adapter."
      ]
    };
  }
}

class ExternalAdapterVocalSourceRenderer implements VocalSourceRenderer {
  readonly id = "cssmv.render.vocal_source.external_adapter";
  readonly version = "v1";
  readonly mode = "external_adapter" as const;

  constructor(private readonly adapterName: string) {}

  render(input: { project: ProjectSpec; musicPlan: MusicPlan; lyrics?: string }): VocalSourceArtifacts {
    const selection = resolveResourceSelection(input.project, "vocalSynthesis", this.adapterName);
    return {
      rendererId: this.id,
      rendererVersion: this.version,
      mode: this.mode,
      capability: {
        symbolicComposition: false,
        licensedLibraryPlayback: false,
        externalAdapterBridge: true,
        vocalSynthesis: true,
        stemRendering: true,
        mixBusProcessing: false
      },
      resources: toLegalBinding(selection.primary),
      notes: [
        ...selection.rationale,
        `External vocal source adapter placeholder: ${this.adapterName}.`,
        selection.primary?.renderExecutorClass
          ? `Render executor class: ${selection.primary.renderExecutorClass}.`
          : "",
        selection.primary?.hostReservationPolicy
          ? `Host reservation policy: ${selection.primary.hostReservationPolicy}.`
          : "",
        selection.primary?.deliveryCheckpointClass
          ? `Delivery checkpoint class: ${selection.primary.deliveryCheckpointClass}.`
          : "",
        "Attach a lawful singer synth, AI singer endpoint, or external DAW vocal source here."
      ].filter(Boolean)
    };
  }
}

class LicensedVoicebankVocalSourceRenderer implements VocalSourceRenderer {
  readonly id = "cssmv.render.vocal_source.licensed_voicebank";
  readonly version = "v1";
  readonly mode = "licensed_library" as const;

  constructor(private readonly voiceHint: string) {}

  render(input: { project: ProjectSpec; musicPlan: MusicPlan; lyrics?: string }): VocalSourceArtifacts {
    const selection = resolveResourceSelection(
      input.project,
      "vocalSynthesis",
      this.voiceHint || "licensed-voicebank"
    );
    return {
      rendererId: this.id,
      rendererVersion: this.version,
      mode: this.mode,
      capability: {
        symbolicComposition: false,
        licensedLibraryPlayback: true,
        externalAdapterBridge: false,
        vocalSynthesis: true,
        stemRendering: true,
        mixBusProcessing: false
      },
      resources: toLegalBinding(selection.primary),
      notes: [
        ...selection.rationale,
        `Licensed vocal source route selected: ${this.voiceHint || "licensed-voicebank"}.`,
        selection.primary?.renderExecutorClass
          ? `Render executor class: ${selection.primary.renderExecutorClass}.`
          : "",
        selection.primary?.hostReservationPolicy
          ? `Host reservation policy: ${selection.primary.hostReservationPolicy}.`
          : "",
        selection.primary?.deliveryCheckpointClass
          ? `Delivery checkpoint class: ${selection.primary.deliveryCheckpointClass}.`
          : "",
        "Attach an authorized singer model, phoneme lexicon, and legal voicebank package here."
      ].filter(Boolean)
    };
  }
}

export function createVocalSourceRenderer(project: ProjectSpec): VocalSourceRenderer {
  const adapter = String(project.creative?.external_audio_adapter || "").trim();
  if (adapter) {
    const selection = resolveResourceSelection(project, "externalAdapterBridge", adapter);
    if (selection.primary?.defaultVocalRoute === "licensed_voicebank") {
      return new LicensedVoicebankVocalSourceRenderer("licensed-voicebank");
    }
    if (selection.primary?.defaultVocalRoute === "stub") {
      return new StubVocalSourceRenderer();
    }
    return new ExternalAdapterVocalSourceRenderer(adapter);
  }
  const stylePack = String(project.creative?.licensed_style_pack || "").trim();
  if (stylePack) {
    const selection = resolveResourceSelection(project, "licensedLibraryPlayback", stylePack);
    if (selection.primary?.defaultVocalRoute === "stub") {
      return new StubVocalSourceRenderer();
    }
    return new LicensedVoicebankVocalSourceRenderer("licensed-voicebank");
  }
  return new LicensedVoicebankVocalSourceRenderer("free-ai-singer");
}
