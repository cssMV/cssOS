# cssMV Repository Structure Design v1

## Recommended Top-Level Structure

```text
src/cssmv/
  core/
  narrative/
  media/
  music/
  modes/
  capabilities/
  output/
  schemas/
```

## Responsibilities

### `core/`

Shared engine entrypoints and pipeline coordination:

- `ProjectSpec`
- `EngineContext`
- `CssMVEngine`
- `Pipeline`

### `schemas/`

Shared cross-module type definitions:

- StoryGraph
- NarrativePlan
- ScenePlan
- MusicPlan
- OutputPackage

### `narrative/`

Narrative construction and planning:

- StoryEngine
- StoryGraph helpers
- EpisodeFlow
- ShortDramaCompiler
- SeriesPlanner
- BranchDirector
- CharacterMemory
- HookEngine

### `media/`

Scene and render orchestration:

- SceneComposer
- MediaCore
- RenderPipeline
- VisualStyleSystem

### `music/`

Music narrative modules:

- MusicDirector
- MusicFragmentDirector
- Soundtrack

### `modes/`

Mode-specific planners and config:

- music video
- microdrama
- series
- cinema

### `capabilities/`

Capability plugins:

- single line
- multi thread
- multi ending
- interactive

### `output/`

Packaging and distribution assets:

- OutputPackager
- TrailerGenerator
- ClipGenerator
- PlatformFormatter
- MusicContinuationCard

