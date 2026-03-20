import { MediaCore } from "../media/media-core";
import { SceneComposer } from "../media/scene-composer";
import { MusicDirector } from "../music/music-director";
import { StoryEngine } from "../narrative/story-engine";
import { NarrativePlannerRouter } from "../narrative/narrative-planner-router";
import { OutputPackager } from "../output/output-packager";
import type { MusicPlan } from "../schemas/music-plan";
import type { NarrativePlanEnvelope } from "../schemas/narrative-plan";
import type { OutputPackage } from "../schemas/output-package";
import type { RenderedMedia } from "../schemas/rendered-media";
import type { ScenePlan } from "../schemas/scene-plan";
import type { StoryGraph } from "../schemas/story-graph";
import { InputAdapter } from "./input-adapter";
import type { ProjectContext, ProjectSpec } from "./project-spec";

export interface CssMVRunArtifacts {
  projectContext: ProjectContext;
  storyGraph: StoryGraph;
  narrativePlan: NarrativePlanEnvelope;
  scenePlan: ScenePlan;
  musicPlan: MusicPlan;
  renderedMedia: RenderedMedia;
  outputPackage: OutputPackage;
}

export class CssMVEngine {
  private readonly inputAdapter = new InputAdapter();
  private readonly storyEngine = new StoryEngine();
  private readonly narrativeRouter = new NarrativePlannerRouter();
  private readonly sceneComposer = new SceneComposer();
  private readonly musicDirector = new MusicDirector();
  private readonly mediaCore = new MediaCore();
  private readonly outputPackager = new OutputPackager();

  run(project: ProjectSpec): CssMVRunArtifacts {
    const projectContext = this.inputAdapter.normalize(project);
    const storyGraph = this.storyEngine.generate(projectContext);
    const narrativePlan = this.narrativeRouter.plan(project, storyGraph);
    const scenePlan = this.sceneComposer.compose(narrativePlan, storyGraph);
    const musicPlan = this.musicDirector.plan(storyGraph, narrativePlan, scenePlan);
    const renderedMedia = this.mediaCore.render(scenePlan, musicPlan);
    const outputPackage = this.outputPackager.package(
      renderedMedia,
      narrativePlan,
      musicPlan,
      scenePlan
    );

    return {
      projectContext,
      storyGraph,
      narrativePlan,
      scenePlan,
      musicPlan,
      renderedMedia,
      outputPackage
    };
  }
}
