export interface RenderHostPlanStage {
  stage:
    | "instrument_host"
    | "vocal_source_host"
    | "vocal_fx_host"
    | "mix_host";
  resourceId?: string;
  displayName?: string;
  hostPresetId?: string;
  renderExecutorClass?: string;
  hostReservationPolicy?: string;
  deliveryCheckpointClass?: string;
  requiredAssets?: string[];
  exampleProducts?: string[];
  recommendedUpgradeIds?: string[];
  upgradeHint?: string;
  notes?: string[];
}

export interface RenderHostPlan {
  schema: string;
  generatedAt: string;
  projectId: string;
  mode: string;
  stages: RenderHostPlanStage[];
}
