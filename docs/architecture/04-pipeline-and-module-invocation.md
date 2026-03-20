# cssMV Pipeline And Module Invocation v1

## Unified Flow

```text
ProjectSpec
-> InputAdapter / ProjectLoader
-> StoryEngine
-> StoryGraph
-> NarrativePlannerRouter
-> SceneComposer
-> MusicDirector
-> MediaCore
-> HookEngine / EndingResolver
-> OutputPackager
```

Compressed form:

`Input -> StoryGraph -> NarrativePlan -> ScenePlan -> MusicPlan -> RenderedMedia -> OutputPackage`

## Pipeline Phases

1. Input normalization
2. Narrative modeling
3. Mode-level narrative planning
4. Scene and music composition
5. Media rendering and optimization
6. Output packaging and distribution

## Mode Routing

- `music_video` -> `MVPlanner`
- `microdrama` -> `ShortDramaCompiler` + `EpisodeFlow`
- `series` -> `SeriesPlanner`
- `cinema` -> `CinemaPlanner`

## Capability Insert Points

- `multi_thread`: planning stage
- `multi_ending`: planning tail or ending resolution
- `interactive`: branch direction layer

## Persistence Recommendation

Persist intermediate artifacts for debugging and reruns:

- `project.context.json`
- `story.graph.json`
- `narrative.plan.json`
- `scene.plan.json`
- `music.plan.json`
- `rendered.media.json`
- `output.package.json`

