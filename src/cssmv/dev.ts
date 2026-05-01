import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CssMVEngine } from "./core/cssmv-engine";
import type { ProjectSpec } from "./core/project-spec";
import { MediaCore } from "./media/media-core";
import { OutputPackager } from "./output/output-packager";
import type {
  ArtifactManifest,
  ArtifactManifestEntry,
  RenderExecutionManifest,
  RenderExecutionNode
} from "./schemas/output-package";
import type { RenderHostPlan, RenderHostPlanStage } from "./schemas/render-host-plan";
import type { RenderHostRunbook, RenderHostRunbookStage } from "./schemas/render-host-runbook";
import type { RenderHostProbe } from "./schemas/render-host-probe";
import type { CssMVRunArtifacts } from "./core/cssmv-engine";
import type { RenderedSegment } from "./schemas/rendered-media";
import type { LegalResourceBinding } from "./music/render/types";
import {
  createAudioRenderer,
  createMixChainRenderer,
  createVocalFxChainRenderer,
  createVocalRenderer,
  createVocalSourceRenderer
} from "./music/render";
import {
  buildFreeHostLaunchTemplate,
  resolveFreeHostPresetForResource
} from "./music/render/free-host-presets";
import {
  buildProjectFreeHostFallbackCommand,
  resolveHostExecutable
} from "./music/render/free-host-runtime";
import { executeFreeHostPresetLocally } from "./music/render/free-host-runner";
import { writeStubWav } from "./music/render/stub-audio-renderer";

function loadProjectSpec(): ProjectSpec {
  const examplePath =
    process.env.CSSMV_EXAMPLE_PATH ||
    path.resolve(process.cwd(), "examples", "cssmv", "mv_prompt.json");
  const raw = fs.readFileSync(examplePath, "utf8");
  return JSON.parse(raw) as ProjectSpec;
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(targetPath: string, payload: unknown) {
  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2));
}

function writeText(targetPath: string, payload: string) {
  fs.writeFileSync(targetPath, payload, "utf8");
}

function tryTranscodePublicMp3(sourcePath: string, targetPath: string) {
  if (!fs.existsSync(sourcePath)) return;
  ensureDir(path.dirname(targetPath));
  const ffmpeg = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      sourcePath,
      "-codec:a",
      "libmp3lame",
      "-q:a",
      "2",
      targetPath
    ],
    { stdio: "ignore" }
  );
  if (ffmpeg.status === 0 && fs.existsSync(targetPath)) {
    return;
  }
  try {
    fs.rmSync(targetPath, { force: true });
  } catch {}
}

function artifactDirFor(projectId: string): string {
  return path.resolve(process.cwd(), "artifacts", "cssmv", projectId);
}

function buildArtifactManifest(
  projectId: string,
  mode: ProjectSpec["mode"],
  outDir: string
): ArtifactManifest {
  const entryDefs: Array<Pick<ArtifactManifestEntry, "key" | "fileName" | "kind">> = [
    { key: "project_context", fileName: "project.context.json", kind: "project_context" },
    { key: "story_graph", fileName: "story.graph.json", kind: "story_graph" },
    { key: "narrative_plan", fileName: "narrative.plan.json", kind: "narrative_plan" },
    { key: "scene_plan", fileName: "scene.plan.json", kind: "scene_plan" },
    { key: "music_plan", fileName: "music.plan.json", kind: "music_plan" },
    { key: "rendered_media", fileName: "rendered.media.json", kind: "rendered_media" },
    { key: "output_package", fileName: "output.package.json", kind: "output_package" },
    { key: "audio_preview", fileName: "audio.preview.mp3", kind: "audio_preview" },
    { key: "audio_mix", fileName: "mix.mp3", kind: "audio_mix" },
    { key: "segment_timeline", fileName: "segment.timeline.json", kind: "segment_timeline" },
    { key: "preview_storyboard", fileName: "preview.storyboard.txt", kind: "preview_storyboard" },
    { key: "preview_script", fileName: "preview.script.txt", kind: "preview_script" },
    { key: "video_storyboard_plan", fileName: "video.storyboard.json", kind: "video_storyboard_plan" },
    { key: "video_assemble_plan", fileName: "video.assemble.json", kind: "video_assemble_plan" },
    { key: "render_execution_manifest", fileName: "render.execution.json", kind: "render_execution_manifest" },
    { key: "render_host_plan", fileName: "render.host-plan.json", kind: "render_host_plan" },
    { key: "render_host_runbook", fileName: "render.host-runbook.json", kind: "render_host_runbook" },
    { key: "render_host_probe", fileName: "render.host-probe.json", kind: "render_host_probe" }
  ];

  const entries: ArtifactManifestEntry[] = entryDefs.map(({ key, fileName, kind }) => ({
    key,
    fileName,
    path: path.join(outDir, fileName),
    kind
  }));

  return {
    manifestVersion: "cssmv_artifact_manifest_v1",
    projectId,
    mode,
    artifactDir: outDir,
    generatedAt: new Date().toISOString(),
    entries
  };
}

function normalizePrompt(segment: RenderedSegment) {
  return [segment.label, segment.subtitleText, segment.transitionToNext && `transition ${segment.transitionToNext}`]
    .filter(Boolean)
    .join(" | ");
}

function buildStoryboardContract(result: CssMVRunArtifacts) {
  const segments = result.renderedMedia.segmentTimeline || [];
  return {
    schema: "css.video.plan.v1",
    lang: "und",
    title: result.projectContext.project.title || result.projectContext.project.projectId,
    shots: segments.map((segment, index) => ({
      id: `video_shot_${String(index).padStart(3, "0")}`,
      prompt: normalizePrompt(segment) || `MV segment ${index + 1}`,
      duration_s: segment.durationSec
    })),
    segments: segments.map((segment, index) => ({
      scene_id: segment.sceneId,
      shot_id: `video_shot_${String(index).padStart(3, "0")}`,
      label: segment.label,
      start_s: segment.startSec,
      end_s: segment.endSec,
      duration_s: segment.durationSec,
      ...(segment.workType ? { work_type: segment.workType } : {}),
      ...(segment.structureNodeId ? { structure_node_id: segment.structureNodeId } : {}),
      ...(segment.parentStructureNodeId ? { parent_structure_node_id: segment.parentStructureNodeId } : {}),
      ...(segment.structureRole ? { structure_role: segment.structureRole } : {}),
      ...(segment.structurePath?.length ? { structure_path: segment.structurePath } : {}),
      ...(segment.transitionToNext ? { transition_to_next: segment.transitionToNext } : {}),
      ...(segment.subtitleText ? { subtitle_text: segment.subtitleText } : {}),
      ...(segment.thumbnailPath ? { thumbnail_path: segment.thumbnailPath } : {})
    })),
    ...(result.outputPackage.workType ? { work_type: result.outputPackage.workType } : {}),
    ...(result.outputPackage.structureTree?.length ? { structure_tree: result.outputPackage.structureTree } : {})
  };
}

function buildAssembleContract(outDir: string, result: CssMVRunArtifacts) {
  const storyboard = buildStoryboardContract(result);
  return {
    schema: "css.video.assemble.v1",
    title: storyboard.title,
    storyboard_path: path.join(outDir, "video.storyboard.json"),
    shots_txt_path: path.join(outDir, "video.shots.txt"),
    out_mp4: path.join(outDir, "video.mp4"),
    shots: storyboard.shots.map((shot) => ({
      id: shot.id,
      path: path.join(outDir, "video", "shots", `${shot.id}.mp4`)
    })),
    segments: storyboard.segments
  };
}

function toRenderExecutionNode(input: {
  rendererId: string;
  rendererVersion: string;
  mode: "stub" | "symbolic" | "licensed_library" | "external_adapter";
  resources?: LegalResourceBinding[] | undefined;
  notes?: string[] | undefined;
}): RenderExecutionNode {
  return {
    rendererId: input.rendererId,
    rendererVersion: input.rendererVersion,
    mode: input.mode,
    resources: (input.resources || []).map((resource) => ({
      kind: resource.kind,
      id: resource.id,
      displayName: resource.displayName,
      ...(resource.requiredAssets?.length ? { requiredAssets: resource.requiredAssets } : {}),
      ...(resource.vendor ? { vendor: resource.vendor } : {}),
      source: resource.source,
      licenseScope: resource.licenseScope,
      ...(resource.licenseLabel ? { licenseLabel: resource.licenseLabel } : {}),
      ...(resource.assetPackageId ? { assetPackageId: resource.assetPackageId } : {}),
      ...(resource.adapterEndpointClass ? { adapterEndpointClass: resource.adapterEndpointClass } : {}),
      ...(resource.renderHostFamily ? { renderHostFamily: resource.renderHostFamily } : {}),
      ...(resource.queueClass ? { queueClass: resource.queueClass } : {}),
      ...(resource.packagingPolicy ? { packagingPolicy: resource.packagingPolicy } : {}),
      ...(resource.deliveryBundleClass ? { deliveryBundleClass: resource.deliveryBundleClass } : {}),
      ...(resource.publicationPolicy ? { publicationPolicy: resource.publicationPolicy } : {}),
      ...(resource.governanceClass ? { governanceClass: resource.governanceClass } : {}),
      ...(resource.complianceEnvelope ? { complianceEnvelope: resource.complianceEnvelope } : {}),
      ...(resource.evidencePolicy ? { evidencePolicy: resource.evidencePolicy } : {}),
      ...(resource.provenanceSealClass ? { provenanceSealClass: resource.provenanceSealClass } : {}),
      ...(resource.deliveryAssuranceClass ? { deliveryAssuranceClass: resource.deliveryAssuranceClass } : {}),
      ...(resource.deliveryTargetClass ? { deliveryTargetClass: resource.deliveryTargetClass } : {}),
      ...(resource.approvalChainClass ? { approvalChainClass: resource.approvalChainClass } : {}),
      ...(resource.dispatchDeadlineClass ? { dispatchDeadlineClass: resource.dispatchDeadlineClass } : {}),
      ...(resource.renderExecutorClass ? { renderExecutorClass: resource.renderExecutorClass } : {}),
      ...(resource.hostReservationPolicy
        ? { hostReservationPolicy: resource.hostReservationPolicy }
        : {}),
      ...(resource.deliveryCheckpointClass
        ? { deliveryCheckpointClass: resource.deliveryCheckpointClass }
        : {}),
      ...(resource.exampleProducts?.length ? { exampleProducts: resource.exampleProducts } : {}),
      ...(resource.recommendedUpgradeIds?.length
        ? { recommendedUpgradeIds: resource.recommendedUpgradeIds }
        : {}),
      ...(resource.upgradeHint ? { upgradeHint: resource.upgradeHint } : {})
    })),
    ...(input.notes?.length ? { notes: input.notes } : {})
  };
}

function buildRenderExecutionManifest(
  spec: ProjectSpec,
  audioArtifacts: ReturnType<ReturnType<typeof createAudioRenderer>["render"]>,
  vocalSourceArtifacts: ReturnType<ReturnType<typeof createVocalSourceRenderer>["render"]>,
  vocalFxArtifacts: ReturnType<ReturnType<typeof createVocalFxChainRenderer>["render"]>,
  vocalArtifacts: ReturnType<ReturnType<typeof createVocalRenderer>["render"]>,
  mixChainArtifacts: ReturnType<ReturnType<typeof createMixChainRenderer>["render"]>
): RenderExecutionManifest {
  const resourceChain = [
    ...(audioArtifacts.resources || []),
    ...(vocalSourceArtifacts.resources || []),
    ...(vocalFxArtifacts.resources || []),
    ...(vocalArtifacts.resources || []),
    ...(mixChainArtifacts.resources || [])
  ];
  const primaryPolicyResource = resourceChain.find(Boolean) || null;
  return {
    schema: "cssmv.render.execution.v1",
    generatedAt: new Date().toISOString(),
    projectId: spec.projectId,
    mode: spec.mode,
    audio: toRenderExecutionNode({
      rendererId: audioArtifacts.provenance.rendererId,
      rendererVersion: audioArtifacts.provenance.rendererVersion,
      mode: audioArtifacts.provenance.mode,
      resources: audioArtifacts.resources,
      notes: audioArtifacts.provenance.notes
    }),
    vocal: toRenderExecutionNode({
      rendererId: vocalArtifacts.rendererId,
      rendererVersion: vocalArtifacts.rendererVersion,
      mode: vocalArtifacts.mode,
      resources: vocalArtifacts.resources,
      notes: vocalArtifacts.notes
    }),
    vocalSource: toRenderExecutionNode({
      rendererId: vocalSourceArtifacts.rendererId,
      rendererVersion: vocalSourceArtifacts.rendererVersion,
      mode: vocalSourceArtifacts.mode,
      resources: vocalSourceArtifacts.resources,
      notes: vocalSourceArtifacts.notes
    }),
    vocalFx: toRenderExecutionNode({
      rendererId: vocalFxArtifacts.rendererId,
      rendererVersion: vocalFxArtifacts.rendererVersion,
      mode: vocalFxArtifacts.mode,
      resources: vocalFxArtifacts.resources,
      notes: vocalFxArtifacts.notes
    }),
    mix: toRenderExecutionNode({
      rendererId: mixChainArtifacts.rendererId,
      rendererVersion: mixChainArtifacts.rendererVersion,
      mode: mixChainArtifacts.mode,
      resources: mixChainArtifacts.resources,
      notes: mixChainArtifacts.notes
    }),
    ...(audioArtifacts.stems?.length ? { stems: audioArtifacts.stems } : {}),
    ...(audioArtifacts.stemPlan?.length ? { stemPlan: audioArtifacts.stemPlan } : {}),
    ...(primaryPolicyResource
      ? {
          deliveryPolicy: {
            ...(primaryPolicyResource.queueClass ? { queueClass: primaryPolicyResource.queueClass } : {}),
            ...(primaryPolicyResource.dispatchWindow
              ? { dispatchWindow: primaryPolicyResource.dispatchWindow }
              : {}),
            ...(primaryPolicyResource.packagingPolicy
              ? { packagingPolicy: primaryPolicyResource.packagingPolicy }
              : {}),
            ...(primaryPolicyResource.deliveryBundleClass
              ? { deliveryBundleClass: primaryPolicyResource.deliveryBundleClass }
              : {}),
            ...(primaryPolicyResource.publicationPolicy
              ? { publicationPolicy: primaryPolicyResource.publicationPolicy }
              : {}),
            ...(primaryPolicyResource.governanceClass
              ? { governanceClass: primaryPolicyResource.governanceClass }
              : {}),
            ...(primaryPolicyResource.complianceEnvelope
              ? { complianceEnvelope: primaryPolicyResource.complianceEnvelope }
              : {}),
            ...(primaryPolicyResource.evidencePolicy
              ? { evidencePolicy: primaryPolicyResource.evidencePolicy }
              : {}),
            ...(primaryPolicyResource.provenanceSealClass
              ? { provenanceSealClass: primaryPolicyResource.provenanceSealClass }
              : {}),
            ...(primaryPolicyResource.deliveryAssuranceClass
              ? { deliveryAssuranceClass: primaryPolicyResource.deliveryAssuranceClass }
              : {}),
            ...(primaryPolicyResource.deliveryTargetClass
              ? { deliveryTargetClass: primaryPolicyResource.deliveryTargetClass }
              : {}),
            ...(primaryPolicyResource.approvalChainClass
              ? { approvalChainClass: primaryPolicyResource.approvalChainClass }
              : {}),
            ...(primaryPolicyResource.dispatchDeadlineClass
              ? { dispatchDeadlineClass: primaryPolicyResource.dispatchDeadlineClass }
              : {}),
            ...(primaryPolicyResource.renderExecutorClass
              ? { renderExecutorClass: primaryPolicyResource.renderExecutorClass }
              : {}),
            ...(primaryPolicyResource.hostReservationPolicy
              ? { hostReservationPolicy: primaryPolicyResource.hostReservationPolicy }
              : {}),
            ...(primaryPolicyResource.deliveryCheckpointClass
              ? { deliveryCheckpointClass: primaryPolicyResource.deliveryCheckpointClass }
              : {}),
            ...(primaryPolicyResource.exampleProducts?.length
              ? { exampleProducts: primaryPolicyResource.exampleProducts }
              : {}),
            ...(primaryPolicyResource.recommendedUpgradeIds?.length
              ? { recommendedUpgradeIds: primaryPolicyResource.recommendedUpgradeIds }
              : {}),
            ...(primaryPolicyResource.upgradeHint
              ? { upgradeHint: primaryPolicyResource.upgradeHint }
              : {})
          }
        }
      : {})
  };
}

function toRenderHostPlanStage(
  stage: RenderHostPlanStage["stage"],
  node: RenderExecutionNode | undefined
): RenderHostPlanStage {
  const primary = node?.resources?.[0];
  const hostPreset = resolveFreeHostPresetForResource(primary?.id, stage);
  return {
    stage,
    ...(primary?.id ? { resourceId: primary.id } : {}),
    ...(primary?.displayName ? { displayName: primary.displayName } : {}),
    ...(hostPreset?.id ? { hostPresetId: hostPreset.id } : {}),
    ...(primary?.renderExecutorClass ? { renderExecutorClass: primary.renderExecutorClass } : {}),
    ...(primary?.hostReservationPolicy
      ? { hostReservationPolicy: primary.hostReservationPolicy }
      : {}),
    ...(primary?.deliveryCheckpointClass
      ? { deliveryCheckpointClass: primary.deliveryCheckpointClass }
      : {}),
    ...(primary?.requiredAssets?.length
      ? { requiredAssets: primary.requiredAssets }
      : hostPreset?.requiredAssets?.length
        ? { requiredAssets: hostPreset.requiredAssets }
        : {}),
    ...(primary?.exampleProducts?.length ? { exampleProducts: primary.exampleProducts } : {}),
    ...(primary?.recommendedUpgradeIds?.length
      ? { recommendedUpgradeIds: primary.recommendedUpgradeIds }
      : {}),
    ...(primary?.upgradeHint ? { upgradeHint: primary.upgradeHint } : {}),
    ...((node?.notes?.length || hostPreset?.notes?.length)
      ? { notes: [...(node?.notes || []), ...(hostPreset?.notes || [])] }
      : {})
  };
}

function buildRenderHostPlan(
  spec: ProjectSpec,
  renderExecutionManifest: RenderExecutionManifest
): RenderHostPlan {
  return {
    schema: "cssmv.render.host-plan.v1",
    generatedAt: new Date().toISOString(),
    projectId: spec.projectId,
    mode: spec.mode,
    stages: [
      toRenderHostPlanStage("instrument_host", renderExecutionManifest.audio),
      toRenderHostPlanStage("vocal_source_host", renderExecutionManifest.vocalSource),
      toRenderHostPlanStage("vocal_fx_host", renderExecutionManifest.vocalFx),
      toRenderHostPlanStage("mix_host", renderExecutionManifest.mix)
    ]
  };
}

function toRenderHostRunbookStage(
  projectId: string,
  stage: RenderHostPlanStage
): RenderHostRunbookStage {
  const launch = buildFreeHostLaunchTemplate(stage.hostPresetId || "", projectId);
  const outDir = artifactDirFor(projectId);
  const fallbackCommandTemplate =
    buildProjectFreeHostFallbackCommand(outDir, {
      stage: stage.stage,
      ...(stage.hostPresetId ? { hostPresetId: stage.hostPresetId } : {}),
      outputArtifacts: launch?.outputArtifacts || []
    });
  return {
    stage: stage.stage,
    ...(stage.hostPresetId ? { hostPresetId: stage.hostPresetId } : {}),
    ...(launch?.commandTemplate ? { commandTemplate: launch.commandTemplate } : {}),
    ...(fallbackCommandTemplate ? { fallbackCommandTemplate: fallbackCommandTemplate } : {}),
    ...(launch?.cwdHint ? { cwdHint: launch.cwdHint } : {}),
    ...(launch?.envKeys?.length ? { envKeys: launch.envKeys } : {}),
    ...(launch?.inputArtifacts?.length ? { inputArtifacts: launch.inputArtifacts } : {}),
    ...(launch?.outputArtifacts?.length ? { outputArtifacts: launch.outputArtifacts } : {}),
    ...(stage.notes?.length || launch?.outputArtifacts?.length
      ? {
          notes: [...(stage.notes || []), ...(launch ? [`Expected outputs: ${launch.outputArtifacts.join(", ")}.`] : [])]
        }
      : {})
  };
}

function buildRenderHostRunbook(
  spec: ProjectSpec,
  renderHostPlan: RenderHostPlan
): RenderHostRunbook {
  return {
    schema: "cssmv.render.host-runbook.v1",
    generatedAt: new Date().toISOString(),
    projectId: spec.projectId,
    mode: spec.mode,
    stages: renderHostPlan.stages.map((stage) => toRenderHostRunbookStage(spec.projectId, stage))
  };
}

function buildRenderHostProbe(
  spec: ProjectSpec,
  renderHostRunbook: RenderHostRunbook
): RenderHostProbe {
  const stages = renderHostRunbook.stages.map((stage) => {
    const resolvedHost = resolveHostExecutable({
      commandTemplate: stage.commandTemplate,
      envKeys: stage.envKeys
    });
    return {
      stage: stage.stage,
      ...(stage.hostPresetId ? { hostPresetId: stage.hostPresetId } : {}),
      ...(resolvedHost.envKey ? { envKey: resolvedHost.envKey } : {}),
      ...(resolvedHost.executablePath ? { configuredExecutable: resolvedHost.executablePath } : {}),
      externalHostConfigured: Boolean(stage.commandTemplate && resolvedHost.executablePath),
      fallbackCommandAvailable: Boolean(String(stage.fallbackCommandTemplate || "").trim()),
      commandTemplateAvailable: Boolean(String(stage.commandTemplate || "").trim()),
      executableResolutionSource: resolvedHost.source
    };
  });
  return {
    schema: "cssmv.render.host-probe.v1",
    generatedAt: new Date().toISOString(),
    projectId: spec.projectId,
    mode: spec.mode,
    externalHostStagesAvailable: stages.filter((stage) => stage.externalHostConfigured).length,
    fallbackStagesAvailable: stages.filter((stage) => stage.fallbackCommandAvailable).length,
    readinessLevel: stages.some((stage) => stage.externalHostConfigured)
      ? "external_ready"
      : stages.some((stage) => stage.fallbackCommandAvailable)
        ? "fallback_ready"
        : "embedded_only",
    stages
  };
}

function replaceCommandExecutable(commandTemplate: string, executablePath: string) {
  const trimmed = String(commandTemplate || "").trim();
  if (!trimmed) return trimmed;
  const firstSpace = trimmed.indexOf(" ");
  if (firstSpace === -1) return executablePath;
  return `${executablePath}${trimmed.slice(firstSpace)}`;
}

function rewriteProjectArtifactPaths(commandTemplate: string, outDir: string) {
  const trimmed = String(commandTemplate || "").trim();
  if (!trimmed) return trimmed;
  const projectId = path.basename(outDir);
  const relativeRoot = `artifacts/cssmv/${projectId}`;
  return trimmed.split(relativeRoot).join(outDir);
}

function tryRunFreeHostStage(
  outDir: string,
  stage: RenderHostRunbookStage,
  cues: Array<{ durationSec: number; energy?: string; section?: string }>
): {
  executionStatus: RenderHostRunbookStage["executionStatus"];
  executionLog: string[];
  executionSource?: RenderHostRunbookStage["executionSource"];
  outputQualityTier?: RenderHostRunbookStage["outputQualityTier"];
  resolvedExecutable?: string;
  resolvedCommand?: string;
  launchCwd?: string;
} {
  const fallbackCommand = String(stage.fallbackCommandTemplate || "").trim();
  const resolvedHost = resolveHostExecutable({
    commandTemplate: stage.commandTemplate,
    envKeys: stage.envKeys
  });
  const envKey = resolvedHost.envKey;
  const executablePath = resolvedHost.executablePath;
  if (!stage.commandTemplate || !executablePath) {
    if (fallbackCommand) {
      const fallbackCwd = process.cwd();
      const fallbackResult = spawnSync(fallbackCommand, {
        cwd: fallbackCwd,
        shell: true,
        env: process.env,
        encoding: "utf8"
      });
      const fallbackOutput = [fallbackResult.stdout, fallbackResult.stderr].filter(Boolean).join("\n").trim();
      if (fallbackResult.status === 0) {
        return {
          executionStatus: "succeeded",
          executionSource: "project_cli_fallback",
          outputQualityTier: "hybrid_hosted",
          resolvedExecutable: fallbackCommand.split(/\s+/, 1)[0] || "node",
          resolvedCommand: fallbackCommand,
          launchCwd: fallbackCwd,
          executionLog: [
            resolvedHost.source === "path"
              ? "Host executable was not pinned via env; used project free-host CLI fallback after PATH-level probe."
              : envKey
                ? `No executable configured in ${envKey}; used project free-host CLI fallback instead.`
                : "No executable environment key configured; used project free-host CLI fallback instead.",
            ...(fallbackOutput ? [fallbackOutput] : [])
          ]
        };
      }
    }
    const localResult = executeFreeHostPresetLocally({ outDir, stage, cues });
    return {
      executionStatus: localResult.executed ? "succeeded" : "simulated",
      ...(localResult.executed ? { executionSource: "embedded_runner" as const } : {}),
      ...(localResult.executed ? { outputQualityTier: "placeholder_audio" as const } : {}),
      ...(localResult.executed ? { resolvedExecutable: "embedded_runner" } : {}),
      ...(localResult.executed
        ? { resolvedCommand: `embedded_runner:${stage.hostPresetId || stage.stage}` }
        : {}),
      ...(localResult.executed ? { launchCwd: outDir } : {}),
      executionLog: [
        resolvedHost.source === "path"
          ? "Executable could not be launched from PATH; falling back to placeholder output generation."
          : envKey
            ? `No executable configured in ${envKey}; falling back to placeholder output generation.`
            : "No executable environment key configured; falling back to placeholder output generation.",
        ...localResult.notes
      ]
    };
  }
  const command = rewriteProjectArtifactPaths(
    replaceCommandExecutable(stage.commandTemplate, executablePath),
    outDir
  );
  const cwd = stage.cwdHint ? path.resolve(process.cwd(), stage.cwdHint) : outDir;
  const result = spawnSync(command, {
    cwd,
    shell: true,
    env: process.env,
    encoding: "utf8"
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  if (result.status === 0) {
    return {
      executionStatus: "succeeded",
      executionSource: "external_host",
      outputQualityTier: "host_rendered_audio",
      resolvedExecutable: executablePath,
      resolvedCommand: command,
      launchCwd: cwd,
      executionLog: [
        `Executed host stage via ${envKey}.`,
        ...(output ? [output] : [])
      ]
    };
  }
  const localResult = executeFreeHostPresetLocally({ outDir, stage, cues });
  return {
    executionStatus: localResult.executed ? "failed" : "failed",
    ...(localResult.executed ? { executionSource: "embedded_runner" as const } : {}),
    ...(localResult.executed ? { outputQualityTier: "placeholder_audio" as const } : {}),
    resolvedExecutable: executablePath,
    resolvedCommand: command,
    launchCwd: cwd,
    executionLog: [
      `Host launch failed via ${envKey} with status ${String(result.status ?? "unknown")}.`,
      ...(output ? [output] : []),
      "Falling back to placeholder output generation.",
      ...localResult.notes
    ]
  };
}

function materializeFreeHostOutputs(
  outDir: string,
  runbook: RenderHostRunbook,
  cues: Array<{ durationSec: number; energy?: string; section?: string }>
) {
  runbook.stages = runbook.stages.map((stage) => {
    const launchResult = tryRunFreeHostStage(outDir, stage, cues);
    (stage.outputArtifacts || []).forEach((artifact) => {
      const targetPath = path.join(outDir, artifact);
      ensureDir(path.dirname(targetPath));
      if (fs.existsSync(targetPath) && launchResult.executionStatus === "succeeded") return;
      if (/\.wav$/i.test(artifact)) {
        writeStubWav(targetPath, cues);
        return;
      }
      if (/\.json$/i.test(artifact)) {
        writeJson(targetPath, {
          generatedBy: "cssmv.free_host_placeholder",
          stage: stage.stage,
          hostPresetId: stage.hostPresetId || null,
          artifact
        });
        return;
      }
      writeText(
        targetPath,
        [
          "CSSMV free host placeholder artifact",
          `stage=${stage.stage}`,
          `hostPresetId=${stage.hostPresetId || ""}`,
          `artifact=${artifact}`
        ].join("\n")
      );
    });
    const generatedArtifacts = (stage.outputArtifacts || []).filter((artifact) =>
      fs.existsSync(path.join(outDir, artifact))
    );
    return {
      ...stage,
      ...(generatedArtifacts.length ? { generatedArtifacts } : {}),
      ...(launchResult.executionSource ? { executionSource: launchResult.executionSource } : {}),
      ...(launchResult.outputQualityTier ? { outputQualityTier: launchResult.outputQualityTier } : {}),
      ...(launchResult.resolvedExecutable ? { resolvedExecutable: launchResult.resolvedExecutable } : {}),
      ...(launchResult.resolvedCommand ? { resolvedCommand: launchResult.resolvedCommand } : {}),
      ...(launchResult.launchCwd ? { launchCwd: launchResult.launchCwd } : {}),
      ...(launchResult.executionStatus ? { executionStatus: launchResult.executionStatus } : {}),
      ...(launchResult.executionLog.length ? { executionLog: launchResult.executionLog } : {})
    };
  });
}

function collectGeneratedAudioArtifacts(outDir: string) {
  const stems: Array<{ role: string; path: string }> = [];
  const findExisting = (...fileNames: string[]) => {
    for (const fileName of fileNames) {
      const targetPath = path.join(outDir, fileName);
      if (fs.existsSync(targetPath)) return targetPath;
    }
    return "";
  };
  const register = (role: string, fileName: string) => {
    const targetPath = findExisting(fileName, fileName.replace(/\.mp3$/i, ".wav"));
    if (!targetPath) return;
    stems.push({ role, path: targetPath });
  };
  register("music_bed", "stems/music_bed.wav");
  register("drums", "stems/drums.wav");
  register("bass", "stems/bass.wav");
  register("hooks", "stems/hooks.wav");
  register("lead_vocal", "vocal.lead.mp3");
  register("double_vocal", "vocal.harmony.mp3");
  register("vocal_fx", "vocal.lead.fx.mp3");
  const previewPath = findExisting("audio.preview.mp3", "audio.preview.wav");
  const mixPath = findExisting("mix.mp3", "mix.wav");
  return {
    stems,
    audioPreview: previewPath,
    audioMix: mixPath
  };
}

function run() {
  const spec = loadProjectSpec();
  const engine = new CssMVEngine();
  const result = engine.run(spec);
  const mediaCore = new MediaCore();
  const outputPackager = new OutputPackager();
  const outDir = artifactDirFor(spec.projectId);
  const audioRenderer = createAudioRenderer(spec);
  const vocalSourceRenderer = createVocalSourceRenderer(spec);
  const vocalFxChainRenderer = createVocalFxChainRenderer(spec);
  const vocalRenderer = createVocalRenderer(spec);
  const mixChainRenderer = createMixChainRenderer(spec);

  ensureDir(outDir);

  writeJson(path.join(outDir, "project.context.json"), result.projectContext);
  writeJson(path.join(outDir, "story.graph.json"), result.storyGraph);
  writeJson(path.join(outDir, "narrative.plan.json"), result.narrativePlan);
  writeJson(path.join(outDir, "scene.plan.json"), result.scenePlan);
  writeJson(path.join(outDir, "music.plan.json"), result.musicPlan);
  const audioArtifacts = audioRenderer.render({
    project: spec,
    musicPlan: result.musicPlan,
    paths: {
      previewWavPath: path.join(outDir, "audio.preview.wav"),
      mixWavPath: path.join(outDir, "mix.wav")
    },
    previewCues: (result.musicPlan.previewSegments || []).map((segment) => ({
      durationSec: segment.durationSec,
      energy: segment.energy,
      section: segment.section
    })),
    mixCues: (result.musicPlan.previewSegments || []).map((segment) => ({
      durationSec: segment.durationSec,
      energy:
        segment.hookRole === "release"
          ? "peak"
          : segment.hookRole === "lift"
            ? "high"
            : segment.energy,
      section: segment.section
    }))
  });
  const vocalSourceArtifacts = vocalSourceRenderer.render({
    project: spec,
    musicPlan: result.musicPlan,
    lyrics: spec.songSeed?.lyrics
  });
  const vocalFxArtifacts = vocalFxChainRenderer.render({
    project: spec,
    musicPlan: result.musicPlan,
    sourceStemPath: vocalSourceArtifacts.stemPath
  });
  const vocalArtifacts = vocalRenderer.render({
    project: spec,
    musicPlan: result.musicPlan,
    lyrics: spec.songSeed?.lyrics
  });
  const mixChainArtifacts = mixChainRenderer.render({
    project: spec,
    musicPlan: result.musicPlan,
    ...(audioArtifacts.stems ? { stems: audioArtifacts.stems } : {}),
    mixWavPath: audioArtifacts.mixWavPath
  });
  tryTranscodePublicMp3(audioArtifacts.previewWavPath, path.join(outDir, "audio.preview.mp3"));
  tryTranscodePublicMp3(audioArtifacts.mixWavPath, path.join(outDir, "mix.mp3"));
  writeText(
    path.join(outDir, "preview.storyboard.txt"),
    (result.renderedMedia.previewStoryboard || []).join("\n")
  );
  writeText(
    path.join(outDir, "preview.script.txt"),
    (result.renderedMedia.previewScript || []).join("\n")
  );
  writeJson(path.join(outDir, "video.storyboard.json"), buildStoryboardContract(result));
  writeJson(path.join(outDir, "video.assemble.json"), buildAssembleContract(outDir, result));
  const artifactManifest = buildArtifactManifest(spec.projectId, spec.mode, outDir);
  const renderExecutionManifest = buildRenderExecutionManifest(
    spec,
    audioArtifacts,
    vocalSourceArtifacts,
    vocalFxArtifacts,
    vocalArtifacts,
    mixChainArtifacts
  );
  const renderHostPlan = buildRenderHostPlan(spec, renderExecutionManifest);
  const renderHostRunbook = buildRenderHostRunbook(spec, renderHostPlan);
  const renderHostProbe = buildRenderHostProbe(spec, renderHostRunbook);
  writeJson(path.join(outDir, "render.execution.json"), renderExecutionManifest);
  writeJson(path.join(outDir, "render.host-plan.json"), renderHostPlan);
  writeJson(path.join(outDir, "render.host-probe.json"), renderHostProbe);
  materializeFreeHostOutputs(outDir, renderHostRunbook, (result.musicPlan.previewSegments || []).map((segment) => ({
    durationSec: segment.durationSec,
    energy: segment.energy,
    section: segment.section
  })));
  writeJson(path.join(outDir, "render.host-runbook.json"), renderHostRunbook);
  const generatedArtifacts = collectGeneratedAudioArtifacts(outDir);
  const previousSyntheticSetting = process.env.CSS_VIDEO_ALLOW_SYNTHETIC;
  if (!previousSyntheticSetting) {
    process.env.CSS_VIDEO_ALLOW_SYNTHETIC = "1";
  }
  let finalRenderedMedia;
  try {
    finalRenderedMedia = mediaCore.render(result.scenePlan, result.musicPlan, {
      project: spec,
      audioMixPath: generatedArtifacts.audioMix || audioArtifacts.mixWavPath,
      artifactRootDir: outDir,
      preferRustVideoEngine: true,
      fallbackToStub: false
    });
  } finally {
    if (!previousSyntheticSetting) {
      delete process.env.CSS_VIDEO_ALLOW_SYNTHETIC;
    } else {
      process.env.CSS_VIDEO_ALLOW_SYNTHETIC = previousSyntheticSetting;
    }
  }
  writeJson(path.join(outDir, "rendered.media.json"), finalRenderedMedia);
  writeJson(path.join(outDir, "segment.timeline.json"), finalRenderedMedia.segmentTimeline || []);
  writeText(
    path.join(outDir, "preview.storyboard.txt"),
    (finalRenderedMedia.previewStoryboard || []).join("\n")
  );
  const packagedRenderedMedia = outputPackager.package(
    finalRenderedMedia,
    result.narrativePlan,
    result.musicPlan,
    result.scenePlan
  );
  const outputPackage = {
    ...packagedRenderedMedia,
    audioPreview: generatedArtifacts.audioPreview || audioArtifacts.previewWavPath,
    audioMix: generatedArtifacts.audioMix || audioArtifacts.mixWavPath,
    ...((generatedArtifacts.stems.length ? generatedArtifacts.stems : (audioArtifacts.stems || [])).length
      ? {
          stems: generatedArtifacts.stems.length
            ? generatedArtifacts.stems
            : (audioArtifacts.stems || [])
        }
      : {}),
    audioRenderProvenance: {
      ...audioArtifacts.provenance,
      voiceRenderer: vocalArtifacts.rendererId,
      vocalSourceRenderer: vocalSourceArtifacts.rendererId,
      vocalFxRenderer: vocalFxArtifacts.rendererId,
      mixChain: mixChainArtifacts.rendererId,
      ...(renderHostRunbook.stages.length
        ? {
            outputQualityTier: renderHostRunbook.stages.some(
              (stage) => stage.outputQualityTier === "host_rendered_audio"
            )
              ? "host_rendered_audio"
              : renderHostRunbook.stages.some(
                    (stage) => stage.outputQualityTier === "hybrid_hosted"
                  )
                ? "hybrid_hosted"
                : "placeholder_audio"
          }
        : {}),
      ...(renderHostRunbook.stages.length
        ? {
            hostExecutionModeSummary: renderHostRunbook.stages.some(
              (stage) => stage.outputQualityTier === "host_rendered_audio"
            )
              ? "real free host active"
              : renderHostRunbook.stages.some(
                    (stage) => stage.outputQualityTier === "hybrid_hosted"
                  )
                ? "hybrid host fallback active"
                : "placeholder host fallback active"
          }
        : {}),
      ...(renderHostRunbook.stages.length
        ? {
            hostRenderedAudioActive: renderHostRunbook.stages.some(
              (stage) => stage.outputQualityTier === "host_rendered_audio"
            )
          }
        : {}),
      ...(renderHostRunbook.stages.length
        ? {
            executionSources: renderHostRunbook.stages
              .map((stage) => stage.executionSource || "")
              .filter(Boolean)
          }
        : {}),
      ...(renderHostRunbook.stages.length
        ? {
            generatedArtifacts: Array.from(
              new Set(
                renderHostRunbook.stages.flatMap((stage) =>
                  Array.isArray(stage.generatedArtifacts) ? stage.generatedArtifacts : []
                )
              )
            )
          }
        : {}),
      ...(renderHostRunbook.stages.length
        ? {
            hostLaunchCommands: Array.from(
              new Set(
                renderHostRunbook.stages
                  .map((stage) => String(stage.resolvedCommand || "").trim())
                  .filter(Boolean)
              )
            )
          }
        : {}),
      ...(renderHostRunbook.stages.length
        ? {
            hostStageSummaries: renderHostRunbook.stages.map((stage) => ({
              stage: stage.stage,
              ...(stage.executionSource ? { executionSource: stage.executionSource } : {}),
              ...(stage.outputQualityTier ? { outputQualityTier: stage.outputQualityTier } : {}),
              ...(stage.executionStatus ? { executionStatus: stage.executionStatus } : {}),
              ...(stage.resolvedExecutable ? { resolvedExecutable: stage.resolvedExecutable } : {}),
              ...(stage.resolvedCommand ? { resolvedCommand: stage.resolvedCommand } : {}),
              ...(stage.launchCwd ? { launchCwd: stage.launchCwd } : {}),
              ...(Array.isArray(stage.generatedArtifacts) && stage.generatedArtifacts.length
                ? { generatedArtifacts: stage.generatedArtifacts }
                : {})
            }))
          }
        : {}),
      notes: [
        ...(audioArtifacts.provenance.notes || []),
        ...(vocalSourceArtifacts.notes || []),
        ...(vocalFxArtifacts.notes || []),
        ...(vocalArtifacts.notes || []),
        ...(mixChainArtifacts.notes || [])
      ]
    },
    artifactManifest,
    renderExecutionManifest,
    renderHostPlan,
    renderHostRunbook,
    renderHostProbe
  };
  writeJson(path.join(outDir, "output.package.json"), outputPackage);
  writeJson(path.join(outDir, "artifact.manifest.json"), artifactManifest);

  const summary = {
    projectId: spec.projectId,
    mode: spec.mode,
    mainVideo: outputPackage.mainVideo ?? null,
    subtitleCount: outputPackage.subtitles?.length ?? 0,
    musicStrategy: result.musicPlan.strategy,
    artifactDir: outDir,
    artifactManifest: path.join(outDir, "artifact.manifest.json")
  };

  console.log(JSON.stringify(summary, null, 2));
}

run();
