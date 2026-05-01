# cssMV Music Planning Foundation

## Why this layer exists

The current engine can already emit valid music artifacts, but much of the musical logic is still embedded in section labels, heuristic energy mapping, and renderer-side defaults. This foundation adds an explicit planning layer between `ScenePlan` and `MusicPlan` so we can improve musicality without rewriting the render path.

## New modules

- `src/cssmv/music/planning/types.ts`
  Defines explicit intermediate representations for section, phrase, harmony, rhythm, expression, and normalized generation constraints.
- `src/cssmv/music/planning/constraints.ts`
  Normalizes user/system controls into bounded, interpretable generation constraints.
- `src/cssmv/music/planning/seed-control.ts`
  Creates deterministic seeds for reproducible planning runs.
- `src/cssmv/music/planning/planner-adapter.ts`
  Maps the current `ProjectSpec` + `StoryGraph` + `NarrativePlanEnvelope` + `ScenePlan` inputs into planning context.
- `src/cssmv/music/planning/planner.ts`
  Builds a deterministic planning document that can later drive richer harmony/rhythm/expression logic.
- `src/cssmv/music/planning/validation.ts`
  Validates cross-reference consistency before the plan is exposed downstream.

## Adoption strategy

1. Keep the existing generation flow intact.
2. Build the planning document inside `MusicDirector`.
3. Project that document onto the existing `MusicPlan` output as optional fields.
4. Let downstream renderers adopt the new fields incrementally.

## Near-term extension points

- Replace heuristic chord labels in `planner.ts` with a true `HarmonyPlanner`.
- Split `RhythmPlan` into groove template selection and bar-level accent generation.
- Add phrase-local regeneration APIs keyed by `sectionId` and `phraseId`.
- Persist planning traces alongside `music.plan.json` for debugging and replay.

## Stage B progress

The planning layer now has dedicated planners for:

- `HarmonyPlanner`
  Owns progression family selection, cadence shaping, tension intent, and bass-motion direction.
- `RhythmPlanner`
  Owns groove template selection, accent profiles, syncopation, microtiming, per-bar activity profiles, and push/pull timing feel.
- `ExpressionPlanner`
  Owns phrase-level intensity, articulation, velocity contour, register contour, and density behavior.

This keeps musicality upgrades composable. Future work should deepen these planners instead of pushing more hardcoded rules back into `MusicDirector`.

The current rhythm layer now exposes:

- phrase-level groove template
- phrase-level syncopation and swing policy
- per-bar activity labels
- per-bar accent patterns
- per-bar push/pull timing feel

That gives downstream renderers a stable place to consume groove information without reverse-engineering it from section names.
