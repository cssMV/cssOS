export type RenderHostProbeStage = {
  stage: string;
  hostPresetId?: string;
  envKey?: string;
  configuredExecutable?: string;
  executableResolutionSource?: "env" | "path" | "unresolved";
  externalHostConfigured: boolean;
  fallbackCommandAvailable: boolean;
  commandTemplateAvailable: boolean;
};

export type RenderHostProbe = {
  schema: "cssmv.render.host-probe.v1";
  generatedAt: string;
  projectId: string;
  mode: string;
  externalHostStagesAvailable: number;
  fallbackStagesAvailable: number;
  readinessLevel?: "external_ready" | "fallback_ready" | "embedded_only";
  stages: RenderHostProbeStage[];
};
