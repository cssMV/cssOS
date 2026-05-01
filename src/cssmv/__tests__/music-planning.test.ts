import test from "node:test";
import assert from "node:assert/strict";
import type { ProjectSpec } from "../core/project-spec";
import type { NarrativePlanEnvelope } from "../schemas/narrative-plan";
import type { ScenePlan } from "../schemas/scene-plan";
import type { StoryGraph } from "../schemas/story-graph";
import { normalizeGenerationConstraints } from "../music/planning/constraints";
import { adaptToPlanningContext } from "../music/planning/planner-adapter";
import { MusicPlanner } from "../music/planning/planner";
import { createDeterministicSeed } from "../music/planning/seed-control";
import { validateMusicPlanDocument } from "../music/planning/validation";

function buildFixtures(): {
  project: ProjectSpec;
  graph: StoryGraph;
  narrative: NarrativePlanEnvelope;
  scenePlan: ScenePlan;
} {
  return {
    project: {
      projectId: "mv_foundation_001",
      mode: "music_video",
      sourceType: "prompt",
      title: "Sky Signal",
      sourceText: "A luminous anthem with recurring hook and rising bridge.",
      durationSec: 160,
      creative: {
        mood: "heroic guofeng",
        instrumentation: "guzheng, dizi, erhu ensemble",
        ambience: "mist and mountain smoke",
        arrangement_density: 0.82,
        dynamics_curve: "surge and bloom",
        section_form: "high contrast trilogy arc",
        articulation_bias: "flowing legato with lift",
        voicing_register: "wide",
        percussion_activity: 0.74,
        expression_cc_bias: "dramatic theatrical sweep",
        humanization: 0.58,
        tempo_bpm: 104,
        vocal_style: "ascending hook with wave response",
        licensed_style_pack: "guofeng-cinema",
        external_audio_adapter: "kontakt",
        musical_key: "D minor",
        work_type: "opera"
      },
      songSeed: {
        musicStructure: "Intro breathes, chorus returns, bridge lifts, outro echoes.",
        sectionBeats: [
          { section: "Intro", title: "Lift Off", bars: 8, energy: "low", focus: "opening", visualRole: "reveal" },
          { section: "Chorus 1", title: "Signal", bars: 16, energy: "high", focus: "hook", visualRole: "burst" },
          { section: "Bridge", title: "Sky Turn", bars: 12, energy: "high", focus: "lift", visualRole: "drift" }
        ]
      }
    },
    graph: {
      meta: {
        storyId: "sg_mv_foundation_001",
        title: "Sky Signal",
        sourceType: "prompt",
        defaultMode: "music_video",
        tone: "anthemic"
      },
      characters: [{ characterId: "lead", name: "Lead", role: "protagonist" }],
      conflicts: [],
      arcs: []
    },
    narrative: {
      mode: "music_video",
      plan: {
        type: "mv",
        durationSec: 160,
        emotionalCurve: ["setup", "lift", "peak", "resolve"],
        sceneBlocks: [],
        musicStrategy: "hybrid"
      }
    },
    scenePlan: {
      scenes: [
        { sceneId: "scene_001", order: 1, label: "Intro", sourceSection: "Intro", durationSec: 16, dialogueDensity: "low" },
        { sceneId: "scene_002", order: 2, label: "Chorus 1", sourceSection: "Chorus 1", durationSec: 32, dialogueDensity: "low" },
        { sceneId: "scene_003", order: 3, label: "Bridge", sourceSection: "Bridge", durationSec: 24, dialogueDensity: "low" }
      ]
    }
  };
}

test("normalizeGenerationConstraints clamps values and preserves determinism", () => {
  const normalized = normalizeGenerationConstraints({
    mood: "cinematic",
    tempoBpm: 300,
    complexity: 2,
    repetitionStrength: -1,
    rhythmicActivity: 0.7,
    deterministicSeed: "seed_001"
  });

  assert.equal(normalized.tempoBpm, 220);
  assert.equal(normalized.complexity, 1);
  assert.equal(normalized.repetitionStrength, 0);
  assert.equal(normalized.deterministicSeed, "seed_001");
  assert.equal(normalized.dynamicRange, 0.62);
  assert.equal(normalized.melodicContour, "arched");
  assert.equal(normalized.instrumentationProfile, "hybrid");
  assert.equal(normalized.ambienceProfile, "glow");
});

test("createDeterministicSeed is stable for equal inputs", () => {
  const first = createDeterministicSeed(["mv", "hook", 12]);
  const second = createDeterministicSeed(["mv", "hook", 12]);
  const third = createDeterministicSeed(["mv", "hook", 13]);

  assert.equal(first, second);
  assert.notEqual(first, third);
});

test("planning adapter and planner build a sectioned music document", () => {
  const { project, graph, narrative, scenePlan } = buildFixtures();
  const context = adaptToPlanningContext(project, graph, narrative, scenePlan);
  const planner = new MusicPlanner();
  const doc = planner.build(scenePlan, context);

  assert.equal(doc.sections.length, 3);
  assert.ok(doc.phrases.length >= doc.sections.length);
  assert.equal(doc.sections[1]?.sectionType, "chorus");
  assert.equal(context.constraints.tempoBpm, 104);
  assert.equal(context.constraints.melodicContour, "ascending");
  assert.equal(context.constraints.voicingRegister, "wide");
  assert.equal(context.constraints.instrumentationProfile, "guofeng");
  assert.equal(context.constraints.ambienceProfile, "mist");
  assert.equal(context.constraints.expressionBias, "theatrical");
  assert.equal(context.constraints.adapterPreference, "kontakt");
  assert.equal(context.constraints.workType, "opera");
  assert.ok(doc.rhythm.some((entry) => entry.grooveTemplate === "anthem"));
  assert.ok(doc.harmony.some((entry) => entry.cadence === "authentic"));
  assert.ok(doc.phrases.some((phrase) => phrase.variationRole === "development"));
  assert.equal(doc.melody.length, doc.phrases.length);
  assert.ok(doc.melody.some((entry) => entry.phraseFunction === "hook"));
  assert.ok(doc.melody.some((entry) => entry.contour === "soaring_arc"));
  assert.ok(doc.melody.every((entry) => entry.targetDegrees.length >= 4));
  assert.ok(doc.melody.every((entry) => entry.lyricStressMap.length > 0));
  assert.ok(doc.rhythm.every((entry) => entry.activityProfile.length > 0));
  assert.ok(doc.rhythm.every((entry) => entry.barAccents.length === entry.activityProfile.length));
  assert.ok(doc.rhythm.every((entry) => entry.pushPullProfile.length === entry.activityProfile.length));
  assert.equal(doc.trace.deterministic, true);
});

test("chorus and bridge phrases receive differentiated cadence and groove behavior", () => {
  const { project, graph, narrative, scenePlan } = buildFixtures();
  const context = adaptToPlanningContext(project, graph, narrative, scenePlan);
  const planner = new MusicPlanner();
  const doc = planner.build(scenePlan, context);

  const chorusPhrase = doc.phrases.find((phrase) => phrase.sectionId === "section_002");
  const chorusReleasePhrase = doc.phrases.find(
    (phrase) => phrase.sectionId === "section_002" && phrase.role === "release"
  );
  const bridgePhrase = doc.phrases.find((phrase) => phrase.sectionId === "section_003");
  const chorusHarmony = doc.harmony.find((entry) => entry.phraseId === chorusPhrase?.phraseId);
  const bridgeHarmony = doc.harmony.find((entry) => entry.phraseId === bridgePhrase?.phraseId);
  const bridgeRhythm = doc.rhythm.find((entry) => entry.phraseId === bridgePhrase?.phraseId);
  const chorusMelody = doc.melody.find((entry) => entry.phraseId === chorusReleasePhrase?.phraseId);
  const bridgeMelody = doc.melody.find((entry) => entry.phraseId === bridgePhrase?.phraseId);

  assert.equal(chorusPhrase?.variationRole, "primary");
  assert.equal(chorusHarmony?.cadence, "open");
  assert.equal(bridgePhrase?.variationRole, "development");
  assert.equal(bridgeHarmony?.cadence, "half");
  assert.equal(bridgeRhythm?.grooveTemplate, "floating");
  assert.equal(bridgeRhythm?.pushPullProfile[0], "laid_back");
  assert.ok(bridgeRhythm?.barAccents.every((bar) => bar.length > 0));
  assert.equal(chorusMelody?.phraseFunction, "hook");
  assert.equal(chorusMelody?.contour, "soaring_arc");
  assert.equal(chorusMelody?.motionBias, "balanced_lift");
  assert.ok(Array.isArray(chorusMelody?.avoidTextureCues));
  assert.ok(chorusMelody?.avoidTextureCues?.some((entry) => entry.includes("siren")));
  assert.ok(chorusMelody?.cleanupTargets?.includes("electrical_hum"));
  assert.equal(bridgeMelody?.phraseFunction, "lift");
  assert.equal(bridgeMelody?.counterlineRole, "echo_answer");
  assert.equal(bridgeMelody?.ornamentation, "grace_fall");
  const chorusExpression = doc.expression.find((entry) => entry.phraseId === chorusReleasePhrase?.phraseId);
  assert.equal(chorusExpression?.densityCurve, "bloom");
  assert.equal(chorusExpression?.registerContour, "wide");
});

test("validateMusicPlanDocument catches missing references", () => {
  const { project, graph, narrative, scenePlan } = buildFixtures();
  const context = adaptToPlanningContext(project, graph, narrative, scenePlan);
  const planner = new MusicPlanner();
  const doc = planner.build(scenePlan, context);
  doc.harmony[0] = {
    ...doc.harmony[0]!,
    phraseId: "missing_phrase"
  };

  const result = validateMusicPlanDocument(doc);

  assert.equal(result.ok, false);
  assert.ok(result.errors[0]?.includes("missing phrase"));
});
