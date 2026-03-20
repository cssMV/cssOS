# cssMV Overall Architecture v1

## Purpose

Define cssMV as a unified AI narrative media engine rather than a single-purpose MV tool.

## Four Content Shapes

- MV / `music_video`
- microdrama / `microdrama`
- series / `series`
- cinema / `cinema`

## Shared Principle

Different modes should branch in planning, but they should share the same project entry, narrative substrate, media layer, and packaging layer.

## Three Main Layers

### Content Shape Layer

The user-facing forms:

- MV
- microdrama
- series
- cinema

### Narrative Layer

Shared narrative intelligence:

- StoryEngine
- StoryGraph
- ShortDramaCompiler
- EpisodeFlow
- SeriesPlanner
- BranchDirector
- CharacterMemory
- HookEngine

### Media and Output Layer

Shared execution and delivery:

- SceneComposer
- MediaCore
- MusicDirector
- OutputPackager
- TrailerGenerator
- ClipGenerator
- MusicContinuationCard

## Capability Plugins

These should be modeled as capabilities, not hard-coded into one mode:

- `single_line`
- `multi_thread`
- `multi_ending`
- `interactive`

