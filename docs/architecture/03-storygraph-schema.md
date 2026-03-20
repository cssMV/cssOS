# cssMV StoryGraph Schema Specification v1

## Purpose

StoryGraph is the unified narrative substrate for MV, microdrama, series, cinema, branching stories, and multi-ending stories.

## Top-Level Shape

```ts
interface StoryGraph {
  meta: StoryMeta;
  world?: WorldModel;
  characters: CharacterNode[];
  conflicts: ConflictNode[];
  arcs: ArcNode[];
  threads?: ThreadNode[];
  reveals?: RevealNode[];
  branches?: BranchNode[];
  endings?: EndingNode[];
  motifs?: MotifNode[];
  timeline?: TimelineNode[];
}
```

## MVP Subset

The minimum viable story graph should include:

- `meta`
- `characters`
- `conflicts`
- `arcs`

## Key Design Principles

- mode-agnostic
- narrative-first
- supports compression and expansion
- supports state tracking

## Key Nodes

- `CharacterNode`: goals, fears, contradictions, relationships, knowledge state
- `ConflictNode`: story-driving conflict and stakes
- `ArcNode`: change path and milestones
- `RevealNode`: hook and twist substrate
- `ThreadNode`: multi-thread planning substrate
- `BranchNode`: interactive or alternate-path substrate
- `EndingNode`: ending selection substrate
- `MotifNode`: musical, visual, symbolic recurrence substrate
- `TimelineNode`: chronological or non-linear event substrate

