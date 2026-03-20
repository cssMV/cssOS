# cssMV Internal Technical Design Master Outline v1

Status: internal master outline

This directory is the architecture entrypoint for cssMV. It consolidates the current design direction for:

- product shape and system positioning
- repository/module boundaries
- StoryGraph schema
- pipeline and invocation flow
- minimum viable development roadmap

## System Positioning

cssMV is a unified AI narrative media engine. It should not be designed as four unrelated products. Instead, it should share one core engine across:

- `music_video`
- `microdrama`
- `series`
- `cinema`

These modes share a common narrative substrate, media layer, and output layer, with optional narrative capabilities such as:

- `single_line`
- `multi_thread`
- `multi_ending`
- `interactive`

## Core Formula

`Input -> StoryGraph -> NarrativePlan -> ScenePlan -> MusicPlan -> RenderedMedia -> OutputPackage`

## Architecture Layers

1. Content mode layer
   - MV
   - microdrama
   - series
   - cinema
2. Narrative layer
   - StoryEngine
   - StoryGraph
   - EpisodeFlow
   - ShortDramaCompiler
   - SeriesPlanner
   - BranchDirector
   - CharacterMemory
   - HookEngine
3. Media layer
   - SceneComposer
   - MediaCore
   - MusicDirector
   - MusicFragmentDirector
4. Output layer
   - OutputPackager
   - TrailerGenerator
   - ClipGenerator
   - MusicContinuationCard
   - PlatformFormatter

## Current Build Strategy

The recommended implementation order is:

1. Establish the shared skeleton
2. Make the MV path usable end-to-end
3. Add the microdrama path on the same skeleton
4. Extend into series and cinema
5. Promote multi-thread, multi-ending, and interactive features as capability plugins

## Documents In This Directory

- [01-overall-architecture.md](/Users/jing/cssOS/docs/architecture/01-overall-architecture.md)
- [02-repository-structure.md](/Users/jing/cssOS/docs/architecture/02-repository-structure.md)
- [03-storygraph-schema.md](/Users/jing/cssOS/docs/architecture/03-storygraph-schema.md)
- [04-pipeline-and-module-invocation.md](/Users/jing/cssOS/docs/architecture/04-pipeline-and-module-invocation.md)
- [05-development-roadmap.md](/Users/jing/cssOS/docs/architecture/05-development-roadmap.md)
- [06-master-outline.md](/Users/jing/cssOS/docs/architecture/06-master-outline.md)

## Recommended Code Alignment

The current TypeScript implementation skeleton lives under `src/cssmv/` and should mirror this architecture:

- `core/`
- `schemas/`
- `narrative/`
- `media/`
- `music/`
- `modes/`
- `capabilities/`
- `output/`

