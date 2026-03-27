import fs from "node:fs";
import path from "node:path";
import { CssMVEngine } from "./core/cssmv-engine";
import type { ProjectSpec } from "./core/project-spec";
import type {
  ArtifactManifest,
  ArtifactManifestEntry,
  RenderExecutionManifest,
  RenderExecutionNode
} from "./schemas/output-package";
import type { CssMVRunArtifacts } from "./core/cssmv-engine";
import type { RenderedSegment } from "./schemas/rendered-media";
import type { LegalResourceBinding } from "./music/render/types";
import {
  createAudioRenderer,
  createMixChainRenderer,
  createVocalRenderer
} from "./music/render";

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
    { key: "audio_preview", fileName: "audio.preview.wav", kind: "audio_preview" },
    { key: "audio_mix", fileName: "mix.wav", kind: "audio_mix" },
    { key: "segment_timeline", fileName: "segment.timeline.json", kind: "segment_timeline" },
    { key: "preview_storyboard", fileName: "preview.storyboard.txt", kind: "preview_storyboard" },
    { key: "preview_script", fileName: "preview.script.txt", kind: "preview_script" },
    { key: "video_storyboard_plan", fileName: "video.storyboard.json", kind: "video_storyboard_plan" },
    { key: "video_assemble_plan", fileName: "video.assemble.json", kind: "video_assemble_plan" },
    { key: "render_execution_manifest", fileName: "render.execution.json", kind: "render_execution_manifest" }
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
      ...(resource.dispatchDeadlineClass ? { dispatchDeadlineClass: resource.dispatchDeadlineClass } : {})
    })),
    ...(input.notes?.length ? { notes: input.notes } : {})
  };
}

function buildRenderExecutionManifest(
  spec: ProjectSpec,
  audioArtifacts: ReturnType<ReturnType<typeof createAudioRenderer>["render"]>,
  vocalArtifacts: ReturnType<ReturnType<typeof createVocalRenderer>["render"]>,
  mixChainArtifacts: ReturnType<ReturnType<typeof createMixChainRenderer>["render"]>
): RenderExecutionManifest {
  const resourceChain = [
    ...(audioArtifacts.resources || []),
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
              : {})
          }
        }
      : {})
  };
}

function run() {
  const spec = loadProjectSpec();
  const engine = new CssMVEngine();
  const result = engine.run(spec);
  const outDir = artifactDirFor(spec.projectId);
  const audioRenderer = createAudioRenderer(spec);
  const vocalRenderer = createVocalRenderer(spec);
  const mixChainRenderer = createMixChainRenderer(spec);

  ensureDir(outDir);

  writeJson(path.join(outDir, "project.context.json"), result.projectContext);
  writeJson(path.join(outDir, "story.graph.json"), result.storyGraph);
  writeJson(path.join(outDir, "narrative.plan.json"), result.narrativePlan);
  writeJson(path.join(outDir, "scene.plan.json"), result.scenePlan);
  writeJson(path.join(outDir, "music.plan.json"), result.musicPlan);
  writeJson(path.join(outDir, "rendered.media.json"), result.renderedMedia);
  writeJson(path.join(outDir, "segment.timeline.json"), result.renderedMedia.segmentTimeline || []);
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
    vocalArtifacts,
    mixChainArtifacts
  );
  writeJson(path.join(outDir, "render.execution.json"), renderExecutionManifest);
  const outputPackage = {
    ...result.outputPackage,
    audioPreview: audioArtifacts.previewWavPath,
    audioMix: audioArtifacts.mixWavPath,
    ...(audioArtifacts.stems?.length ? { stems: audioArtifacts.stems } : {}),
    audioRenderProvenance: {
      ...audioArtifacts.provenance,
      voiceRenderer: vocalArtifacts.rendererId,
      mixChain: mixChainArtifacts.rendererId,
      notes: [
        ...(audioArtifacts.provenance.notes || []),
        ...(vocalArtifacts.notes || []),
        ...(mixChainArtifacts.notes || [])
      ]
    },
    artifactManifest,
    renderExecutionManifest
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
