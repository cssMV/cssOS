export interface RenderHostRunbookStage {
  stage: "instrument_host" | "vocal_source_host" | "vocal_fx_host" | "mix_host";
  hostPresetId?: string;
  executionSource?: "external_host" | "project_cli_fallback" | "embedded_runner";
  outputQualityTier?: "placeholder_audio" | "hybrid_hosted" | "host_rendered_audio";
  resolvedExecutable?: string;
  resolvedCommand?: string;
  launchCwd?: string;
  commandTemplate?: string;
  fallbackCommandTemplate?: string;
  cwdHint?: string;
  envKeys?: string[];
  inputArtifacts?: string[];
  outputArtifacts?: string[];
  generatedArtifacts?: string[];
  executionStatus?: "simulated" | "attempted" | "succeeded" | "failed";
  executionLog?: string[];
  notes?: string[];
}

export interface RenderHostRunbook {
  schema: string;
  generatedAt: string;
  projectId: string;
  mode: string;
  stages: RenderHostRunbookStage[];
}
