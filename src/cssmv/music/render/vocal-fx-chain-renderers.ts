import type { MusicPlan } from "../../schemas/music-plan";
import type { ProjectSpec } from "../../core/project-spec";
import type { VocalFxChainArtifacts, VocalFxChainRenderer } from "./types";
import { resolveResourceSelection, toLegalBinding } from "./resource-registry";

class StubVocalFxChainRenderer implements VocalFxChainRenderer {
  readonly id = "cssmv.render.vocal_fx.stub";
  readonly version = "v1";
  readonly mode = "stub" as const;

  render(input: { project: ProjectSpec; musicPlan: MusicPlan; sourceStemPath?: string }): VocalFxChainArtifacts {
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
        "No dedicated vocal FX chain is configured yet.",
        "Replace with an authorized correction, EQ, compression, de-essing, air, reverb, and delay chain."
      ]
    };
  }
}

class ExternalAdapterVocalFxChainRenderer implements VocalFxChainRenderer {
  readonly id = "cssmv.render.vocal_fx.external_adapter";
  readonly version = "v1";
  readonly mode = "external_adapter" as const;

  constructor(private readonly adapterName: string) {}

  render(input: { project: ProjectSpec; musicPlan: MusicPlan; sourceStemPath?: string }): VocalFxChainArtifacts {
    const selection = resolveResourceSelection(input.project, "externalAdapterBridge", this.adapterName);
    return {
      rendererId: this.id,
      rendererVersion: this.version,
      mode: this.mode,
      capability: {
        symbolicComposition: false,
        licensedLibraryPlayback: false,
        externalAdapterBridge: true,
        vocalSynthesis: false,
        stemRendering: true,
        mixBusProcessing: true
      },
      resources: toLegalBinding(selection.primary),
      notes: [
        ...selection.rationale,
        `External vocal FX adapter placeholder: ${this.adapterName}.`,
        "Expected chain: pitch correction -> EQ -> compressor -> de-esser -> exciter/air -> reverb -> delay."
      ].filter(Boolean)
    };
  }
}

class LicensedLibraryVocalFxChainRenderer implements VocalFxChainRenderer {
  readonly id = "cssmv.render.vocal_fx.licensed_library";
  readonly version = "v1";
  readonly mode = "licensed_library" as const;

  constructor(private readonly sourceHint: string) {}

  render(input: { project: ProjectSpec; musicPlan: MusicPlan; sourceStemPath?: string }): VocalFxChainArtifacts {
    const selection = resolveResourceSelection(input.project, "mixBusProcessing", this.sourceHint || "vocal-fx");
    return {
      rendererId: this.id,
      rendererVersion: this.version,
      mode: this.mode,
      capability: {
        symbolicComposition: false,
        licensedLibraryPlayback: true,
        externalAdapterBridge: false,
        vocalSynthesis: false,
        stemRendering: true,
        mixBusProcessing: true
      },
      resources: toLegalBinding(selection.primary),
      notes: [
        ...selection.rationale,
        `Licensed vocal FX chain selected: ${this.sourceHint || "vocal-fx"}.`,
        "Expected chain: pitch correction -> EQ -> compressor -> de-esser -> exciter/air -> reverb -> delay."
      ].filter(Boolean)
    };
  }
}

export function createVocalFxChainRenderer(project: ProjectSpec): VocalFxChainRenderer {
  const adapter = String(project.creative?.external_audio_adapter || "").trim();
  if (adapter) {
    const selection = resolveResourceSelection(project, "externalAdapterBridge", adapter);
    if (selection.primary?.defaultMixRoute === "stub") {
      return new StubVocalFxChainRenderer();
    }
    const preferredMixChain = selection.primary?.preferredMixChain || adapter;
    if (selection.primary?.defaultMixRoute === "external_adapter") {
      return new ExternalAdapterVocalFxChainRenderer(adapter);
    }
    return new LicensedLibraryVocalFxChainRenderer(preferredMixChain);
  }
  const stylePack = String(project.creative?.licensed_style_pack || "").trim();
  if (stylePack) {
    const selection = resolveResourceSelection(project, "licensedLibraryPlayback", stylePack);
    if (selection.primary?.defaultMixRoute === "stub") {
      return new StubVocalFxChainRenderer();
    }
    return new LicensedLibraryVocalFxChainRenderer(selection.primary?.preferredMixChain || stylePack);
  }
  return new LicensedLibraryVocalFxChainRenderer("free-vocal-chain");
}
