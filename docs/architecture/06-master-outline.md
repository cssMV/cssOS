# cssMV Internal Technical Design Master Outline v1

## One-Sentence Positioning

cssMV is not four products. It is one engine with four content forms.

## Unified System Statement

cssMV should be treated as a unified AI narrative media engine capable of generating:

- MV
- microdrama
- series
- cinema

while supporting:

- music-driven storytelling
- multi-thread planning
- multi-ending resolution
- interactive branching

## Architectural Commitments

- one shared `ProjectSpec`
- one shared `StoryGraph`
- one shared pipeline backbone
- one shared output contract
- mode-specific planning only where necessary

## Immediate Engineering Priority

Keep the current priority on the MV pipeline while reserving the correct shared architecture for later narrative expansion.

## Implementation Order

1. shared skeleton
2. MV MVP
3. microdrama MVP
4. series and cinema extension
5. advanced narrative capabilities

