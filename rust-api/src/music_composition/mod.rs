use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompositionLayerPlan {
    pub schema: &'static str,
    pub title: String,
    pub melody: MelodyLayerPlan,
    pub harmony: HarmonyLayerPlan,
    pub arrangement: ArrangementLayerPlan,
    pub sections: Vec<CompositionSectionPlan>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MelodyLayerPlan {
    pub lead_register: String,
    pub contour_strategy: String,
    pub hook_strategy: String,
    pub note_grouping_strategy: String,
    pub repetition_strategy: String,
    pub variation_strategy: String,
    pub phrase_templates: Vec<MelodyPhraseTemplate>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HarmonyLayerPlan {
    pub tonal_center_hz: f32,
    pub tonal_mode: String,
    pub progression_strategy: String,
    pub tension_curve: String,
    pub cadence_strategy: String,
    pub progression_templates: Vec<HarmonyProgressionTemplate>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArrangementLayerPlan {
    pub instrumentation_focus: String,
    pub groove_strategy: String,
    pub dynamic_arc: String,
    pub transition_strategy: String,
    pub lift_strategy: String,
    pub orchestration_templates: Vec<ArrangementTemplate>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MelodyPhraseTemplate {
    pub section_match: String,
    pub contour: String,
    pub hook_role: String,
    pub note_grouping: Vec<u8>,
    pub hook_restatement: String,
    pub note_groups: Vec<MelodyNoteGroupPlan>,
    pub hook_restatement_passes: Vec<HookRestatementPass>,
    pub repeat_bars: u8,
    pub variation_move: String,
    pub target_degrees: Vec<i32>,
    pub rhythm_cells: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HarmonyProgressionTemplate {
    pub section_match: String,
    pub numeral_path: Vec<String>,
    pub bass_motion: String,
    pub cadence: String,
    pub tension_level: String,
    pub chord_targets: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArrangementTemplate {
    pub section_match: String,
    pub primary_layers: Vec<String>,
    pub rhythm_pattern: String,
    pub texture_goal: String,
    pub lift_move: String,
    pub stem_lanes: Vec<ArrangementStemLane>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArrangementStemLane {
    pub stem: String,
    pub role: String,
    pub density: String,
    pub entry_strategy: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompositionSectionPlan {
    pub section: String,
    pub start_sec: f32,
    pub duration_sec: f32,
    pub tempo_bpm: f32,
    pub energy: String,
    pub melody_role: String,
    pub harmony_role: String,
    pub arrangement_role: String,
    pub phrase_skeleton: MelodyPhraseSkeleton,
    pub progression_frames: Vec<HarmonyProgressionFrame>,
    pub stem_activations: Vec<StemActivationPlan>,
}

#[derive(Debug, Clone)]
pub struct CompositionSectionInput {
    pub section: String,
    pub start_sec: f32,
    pub duration_sec: f32,
    pub tempo_bpm: f32,
    pub root_hz: f32,
    pub energy: String,
    pub style: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MelodyPhraseSkeleton {
    pub phrase_bars: u8,
    pub target_degrees: Vec<i32>,
    pub rhythm_cells: Vec<String>,
    pub note_grouping: Vec<u8>,
    pub hook_restatement: String,
    pub note_groups: Vec<MelodyNoteGroupPlan>,
    pub hook_restatement_passes: Vec<HookRestatementPass>,
    pub cadence_tone: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MelodyNoteGroupPlan {
    pub order: u8,
    pub note_count: u8,
    pub accent_role: String,
    pub contour_move: String,
    pub breath_after: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HookRestatementPass {
    pub order: u8,
    pub role: String,
    pub register_bias: String,
    pub sustain_bias: String,
    pub lyric_density: String,
    pub landing_move: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HarmonyProgressionFrame {
    pub bar_index: u8,
    pub numeral: String,
    pub chord_target: String,
    pub bass_motion: String,
    pub tension_level: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StemActivationPlan {
    pub stem: String,
    pub active_bars: Vec<u8>,
    pub density: String,
    pub entry_strategy: String,
}

pub fn build_composition_layer_plan(
    title: &str,
    sections: &[CompositionSectionInput],
) -> CompositionLayerPlan {
    let lead_register = infer_lead_register(sections);
    let contour_strategy = infer_contour_strategy(sections);
    let hook_strategy = infer_hook_strategy(sections);
    let note_grouping_strategy = infer_note_grouping_strategy(sections);
    let repetition_strategy = infer_repetition_strategy(sections);
    let variation_strategy = infer_variation_strategy(sections);
    let tonal_center_hz = sections
        .first()
        .map(|section| section.root_hz)
        .unwrap_or(220.0);
    let tonal_mode = infer_tonal_mode(sections);
    let progression_strategy = infer_progression_strategy(sections);
    let tension_curve = infer_tension_curve(sections);
    let cadence_strategy = infer_cadence_strategy(sections);
    let instrumentation_focus = infer_instrumentation_focus(sections);
    let groove_strategy = infer_groove_strategy(sections);
    let dynamic_arc = infer_dynamic_arc(sections);
    let transition_strategy = infer_transition_strategy(sections);
    let lift_strategy = infer_lift_strategy(sections);
    let phrase_templates = build_melody_phrase_templates(sections);
    let progression_templates = build_harmony_progression_templates(sections);
    let orchestration_templates = build_arrangement_templates(sections);
    let section_plans = sections
        .iter()
        .map(|section| {
            let phrase_template = choose_phrase_template(section, &phrase_templates);
            let harmony_template = choose_harmony_template(section, &progression_templates);
            let arrangement_template =
                choose_arrangement_template(section, &orchestration_templates);
            CompositionSectionPlan {
                section: section.section.clone(),
                start_sec: section.start_sec,
                duration_sec: section.duration_sec,
                tempo_bpm: section.tempo_bpm,
                energy: section.energy.clone(),
                melody_role: infer_melody_role(section),
                harmony_role: infer_harmony_role(section),
                arrangement_role: infer_arrangement_role(section),
                phrase_skeleton: build_phrase_skeleton(section, phrase_template),
                progression_frames: build_progression_frames(section, harmony_template),
                stem_activations: build_stem_activation_plan(section, arrangement_template),
            }
        })
        .collect::<Vec<_>>();

    CompositionLayerPlan {
        schema: "css.music.composition-layer.v1",
        title: title.to_string(),
        melody: MelodyLayerPlan {
            lead_register,
            contour_strategy,
            hook_strategy,
            note_grouping_strategy,
            repetition_strategy,
            variation_strategy,
            phrase_templates,
        },
        harmony: HarmonyLayerPlan {
            tonal_center_hz,
            tonal_mode,
            progression_strategy,
            tension_curve,
            cadence_strategy,
            progression_templates,
        },
        arrangement: ArrangementLayerPlan {
            instrumentation_focus,
            groove_strategy,
            dynamic_arc,
            transition_strategy,
            lift_strategy,
            orchestration_templates,
        },
        sections: section_plans,
    }
}

fn choose_phrase_template<'a>(
    section: &CompositionSectionInput,
    templates: &'a [MelodyPhraseTemplate],
) -> &'a MelodyPhraseTemplate {
    templates
        .iter()
        .find(|template| template.section_match == section.section)
        .or_else(|| templates.first())
        .expect("melody phrase template missing")
}

fn choose_harmony_template<'a>(
    section: &CompositionSectionInput,
    templates: &'a [HarmonyProgressionTemplate],
) -> &'a HarmonyProgressionTemplate {
    templates
        .iter()
        .find(|template| template.section_match == section.section)
        .or_else(|| templates.first())
        .expect("harmony progression template missing")
}

fn choose_arrangement_template<'a>(
    section: &CompositionSectionInput,
    templates: &'a [ArrangementTemplate],
) -> &'a ArrangementTemplate {
    templates
        .iter()
        .find(|template| template.section_match == section.section)
        .or_else(|| templates.first())
        .expect("arrangement template missing")
}

fn build_phrase_skeleton(
    section: &CompositionSectionInput,
    template: &MelodyPhraseTemplate,
) -> MelodyPhraseSkeleton {
    let estimated_bars = ((section.duration_sec / 2.0).round() as i64).clamp(2, 16) as u8;
    let phrase_bars = estimated_bars.max(template.repeat_bars);
    let cadence_tone = template.target_degrees.last().copied().unwrap_or(1);
    MelodyPhraseSkeleton {
        phrase_bars,
        target_degrees: template.target_degrees.clone(),
        rhythm_cells: template.rhythm_cells.clone(),
        note_grouping: template.note_grouping.clone(),
        hook_restatement: template.hook_restatement.clone(),
        note_groups: template.note_groups.clone(),
        hook_restatement_passes: template.hook_restatement_passes.clone(),
        cadence_tone,
    }
}

fn build_progression_frames(
    section: &CompositionSectionInput,
    template: &HarmonyProgressionTemplate,
) -> Vec<HarmonyProgressionFrame> {
    let estimated_bars = ((section.duration_sec / 2.0).round() as i64).clamp(2, 16) as usize;
    (0..estimated_bars)
        .map(|index| {
            let numeral = template
                .numeral_path
                .get(index % template.numeral_path.len())
                .cloned()
                .unwrap_or_else(|| "i".to_string());
            let chord_target = template
                .chord_targets
                .get(index % template.chord_targets.len())
                .cloned()
                .unwrap_or_else(|| numeral.clone());
            HarmonyProgressionFrame {
                bar_index: (index + 1) as u8,
                numeral,
                chord_target,
                bass_motion: template.bass_motion.clone(),
                tension_level: template.tension_level.clone(),
            }
        })
        .collect()
}

fn build_stem_activation_plan(
    section: &CompositionSectionInput,
    template: &ArrangementTemplate,
) -> Vec<StemActivationPlan> {
    let estimated_bars = ((section.duration_sec / 2.0).round() as i64).clamp(2, 16) as u8;
    template
        .stem_lanes
        .iter()
        .map(|lane| {
            let active_bars = match lane.entry_strategy.as_str() {
                "bar 1" | "downbeat" | "fade-in" | "carry-over" => (1..=estimated_bars).collect(),
                "bar 3" => (3..=estimated_bars.max(3)).collect(),
                "hook pickup" => {
                    let start = estimated_bars.saturating_sub(3).max(1);
                    (start..=estimated_bars).collect()
                }
                "chorus only" | "cadence only" | "final cadence" => vec![estimated_bars],
                "late phrase pickup" => {
                    vec![estimated_bars.saturating_sub(1).max(1), estimated_bars]
                }
                "offbeat" | "riser-led" => {
                    let mut bars = Vec::new();
                    let mut cursor = 2_u8;
                    while cursor <= estimated_bars {
                        bars.push(cursor);
                        cursor = cursor.saturating_add(2);
                    }
                    if bars.is_empty() {
                        bars.push(estimated_bars);
                    }
                    bars
                }
                _ => (1..=estimated_bars).collect(),
            };
            StemActivationPlan {
                stem: lane.stem.clone(),
                active_bars,
                density: lane.density.clone(),
                entry_strategy: lane.entry_strategy.clone(),
            }
        })
        .collect()
}

fn build_melody_phrase_templates(
    sections: &[CompositionSectionInput],
) -> Vec<MelodyPhraseTemplate> {
    sections
        .iter()
        .map(|section| {
            let lower = section.section.to_lowercase();
            if lower.contains("verse") {
                MelodyPhraseTemplate {
                    section_match: section.section.clone(),
                    contour: "stepwise narrative rise".to_string(),
                    hook_role: "seed motif quietly".to_string(),
                    note_grouping: vec![3, 3, 2],
                    hook_restatement: "tease hook fragments in short cells and leave the last cell unresolved".to_string(),
                    note_groups: vec![
                        note_group_plan(1, 3, "soft pickup", "step up", false),
                        note_group_plan(2, 3, "lyric carry", "hover then answer", false),
                        note_group_plan(3, 2, "withheld landing", "fall away", true),
                    ],
                    hook_restatement_passes: vec![
                        hook_pass(1, "seed", "mid-low", "short", "lyric-forward", "defer cadence"),
                        hook_pass(2, "echo", "same register", "trimmed", "fragmented", "leave open"),
                    ],
                    repeat_bars: 2,
                    variation_move: "swap final landing tone every second phrase".to_string(),
                    target_degrees: vec![1, 2, 3, 5],
                    rhythm_cells: vec!["quarter-quarter".into(), "eighth-eighth-quarter".into()],
                }
            } else if lower.contains("chorus") || lower.contains("reprise") {
                MelodyPhraseTemplate {
                    section_match: section.section.clone(),
                    contour: "arched hook apex".to_string(),
                    hook_role: "state main hook in full".to_string(),
                    note_grouping: vec![4, 4, 3, 5],
                    hook_restatement: "restate the hook in two passes: first clean, then with a longer tail and higher apex".to_string(),
                    note_groups: vec![
                        note_group_plan(1, 4, "hook arrival", "rise into anchor tone", false),
                        note_group_plan(2, 4, "mirror answer", "repeat with slight lift", false),
                        note_group_plan(3, 3, "pre-cadence squeeze", "tighten toward apex", false),
                        note_group_plan(4, 5, "release tail", "stretch downward after summit", true),
                    ],
                    hook_restatement_passes: vec![
                        hook_pass(1, "main statement", "mid", "balanced", "clear", "land on hook root"),
                        hook_pass(2, "amplified restatement", "higher", "longer", "slightly wider", "overshoot then resolve"),
                        hook_pass(3, "tail echo", "mid-high", "long tail", "thinned", "glide into cadence"),
                    ],
                    repeat_bars: 4,
                    variation_move: "lift final hook by register or sustain length".to_string(),
                    target_degrees: vec![5, 6, 5, 3, 2, 1],
                    rhythm_cells: vec!["eighth-eighth-eighth-eighth".into(), "half-sustain".into()],
                }
            } else if lower.contains("bridge") {
                MelodyPhraseTemplate {
                    section_match: section.section.clone(),
                    contour: "contrast leap and release".to_string(),
                    hook_role: "deconstruct hook before return".to_string(),
                    note_grouping: vec![2, 3, 3, 2],
                    hook_restatement: "break the hook into offset pickups, then answer it with a stretched landing group".to_string(),
                    note_groups: vec![
                        note_group_plan(1, 2, "offset pickup", "jump upward", false),
                        note_group_plan(2, 3, "fragment spin", "turn around upper neighbor", false),
                        note_group_plan(3, 3, "answer fragment", "descend through tension", false),
                        note_group_plan(4, 2, "landing snap", "drop into return point", true),
                    ],
                    hook_restatement_passes: vec![
                        hook_pass(1, "deconstruction", "upper-mid", "clipped", "sparse", "avoid root"),
                        hook_pass(2, "answer", "mid", "stretched", "lyric-spaced", "prepare return"),
                    ],
                    repeat_bars: 2,
                    variation_move: "increase leap budget and rhythmic offset".to_string(),
                    target_degrees: vec![3, 5, 7, 6, 4],
                    rhythm_cells: vec!["syncopated-quarter".into(), "eighth-rest-eighth".into()],
                }
            } else {
                MelodyPhraseTemplate {
                    section_match: section.section.clone(),
                    contour: "motif echo".to_string(),
                    hook_role: "support long-form continuity".to_string(),
                    note_grouping: vec![4, 2, 2],
                    hook_restatement: "return the hook as a memory trace with smaller end groups and longer release".to_string(),
                    note_groups: vec![
                        note_group_plan(1, 4, "memory recall", "trace the original arc", false),
                        note_group_plan(2, 2, "soft answer", "fold inward", false),
                        note_group_plan(3, 2, "release", "settle downward", true),
                    ],
                    hook_restatement_passes: vec![
                        hook_pass(1, "recall", "mid-low", "gentle", "light", "touch the hook outline"),
                        hook_pass(2, "fade", "lower", "long", "minimal", "dissolve cadence"),
                    ],
                    repeat_bars: 2,
                    variation_move: "thin phrase ending into transition".to_string(),
                    target_degrees: vec![1, 3, 2, 1],
                    rhythm_cells: vec!["whole-sustain".into(), "quarter-rest".into()],
                }
            }
        })
        .collect()
}

fn build_harmony_progression_templates(
    sections: &[CompositionSectionInput],
) -> Vec<HarmonyProgressionTemplate> {
    sections
        .iter()
        .map(|section| {
            let lower = section.section.to_lowercase();
            if lower.contains("verse") {
                HarmonyProgressionTemplate {
                    section_match: section.section.clone(),
                    numeral_path: vec!["i".into(), "VI".into(), "III".into(), "VII".into()],
                    bass_motion: "pedal then falling step".to_string(),
                    cadence: "half".to_string(),
                    tension_level: "restrained".to_string(),
                    chord_targets: vec![
                        "i(add9)".into(),
                        "VImaj7".into(),
                        "III".into(),
                        "Vsus".into(),
                    ],
                }
            } else if lower.contains("chorus") || lower.contains("reprise") {
                HarmonyProgressionTemplate {
                    section_match: section.section.clone(),
                    numeral_path: vec!["i".into(), "VII".into(), "VI".into(), "V".into()],
                    bass_motion: "driving downstep with dominant return".to_string(),
                    cadence: "authentic".to_string(),
                    tension_level: "lifted".to_string(),
                    chord_targets: vec!["i".into(), "VII".into(), "VImaj9".into(), "V".into()],
                }
            } else if lower.contains("bridge") {
                HarmonyProgressionTemplate {
                    section_match: section.section.clone(),
                    numeral_path: vec!["iv".into(), "VI".into(), "ii°".into(), "V".into()],
                    bass_motion: "chromatic push".to_string(),
                    cadence: "deceptive".to_string(),
                    tension_level: "high".to_string(),
                    chord_targets: vec!["ivm".into(), "VI".into(), "iiø".into(), "V7alt".into()],
                }
            } else {
                HarmonyProgressionTemplate {
                    section_match: section.section.clone(),
                    numeral_path: vec!["i".into(), "VI".into()],
                    bass_motion: "pedal drone".to_string(),
                    cadence: "suspended".to_string(),
                    tension_level: "medium".to_string(),
                    chord_targets: vec!["i(no3)".into(), "VI(add2)".into()],
                }
            }
        })
        .collect()
}

fn build_arrangement_templates(sections: &[CompositionSectionInput]) -> Vec<ArrangementTemplate> {
    sections
        .iter()
        .map(|section| {
            let lower = section.section.to_lowercase();
            if lower.contains("intro") {
                ArrangementTemplate {
                    section_match: section.section.clone(),
                    primary_layers: vec!["pad".into(), "pulse".into(), "motif fragment".into()],
                    rhythm_pattern: "slow pulse".to_string(),
                    texture_goal: "world-building".to_string(),
                    lift_move: "hold back drums and sub".to_string(),
                    stem_lanes: vec![
                        ArrangementStemLane {
                            stem: "pad".into(),
                            role: "atmosphere bed".into(),
                            density: "low".into(),
                            entry_strategy: "fade-in".into(),
                        },
                        ArrangementStemLane {
                            stem: "counter".into(),
                            role: "motif fragment".into(),
                            density: "low".into(),
                            entry_strategy: "late phrase pickup".into(),
                        },
                    ],
                }
            } else if lower.contains("verse") {
                ArrangementTemplate {
                    section_match: section.section.clone(),
                    primary_layers: vec![
                        "lead support".into(),
                        "bass".into(),
                        "light percussion".into(),
                    ],
                    rhythm_pattern: "restrained drive".to_string(),
                    texture_goal: "lyric support".to_string(),
                    lift_move: "add counterline near section end".to_string(),
                    stem_lanes: vec![
                        ArrangementStemLane {
                            stem: "bass".into(),
                            role: "ground pulse".into(),
                            density: "medium".into(),
                            entry_strategy: "bar 1".into(),
                        },
                        ArrangementStemLane {
                            stem: "percussion".into(),
                            role: "soft drive".into(),
                            density: "low".into(),
                            entry_strategy: "bar 3".into(),
                        },
                        ArrangementStemLane {
                            stem: "lead".into(),
                            role: "vocal support doubles".into(),
                            density: "low".into(),
                            entry_strategy: "cadence only".into(),
                        },
                    ],
                }
            } else if lower.contains("chorus") || lower.contains("reprise") {
                ArrangementTemplate {
                    section_match: section.section.clone(),
                    primary_layers: vec![
                        "full drums".into(),
                        "strings/pads".into(),
                        "hook doubles".into(),
                        "sub".into(),
                    ],
                    rhythm_pattern: "full lift grid".to_string(),
                    texture_goal: "anthemic expansion".to_string(),
                    lift_move: "open stereo width and octave doubles".to_string(),
                    stem_lanes: vec![
                        ArrangementStemLane {
                            stem: "drums".into(),
                            role: "full groove".into(),
                            density: "high".into(),
                            entry_strategy: "downbeat".into(),
                        },
                        ArrangementStemLane {
                            stem: "strings".into(),
                            role: "harmonic lift".into(),
                            density: "high".into(),
                            entry_strategy: "bar 1".into(),
                        },
                        ArrangementStemLane {
                            stem: "lead".into(),
                            role: "hook doubles".into(),
                            density: "medium".into(),
                            entry_strategy: "hook pickup".into(),
                        },
                        ArrangementStemLane {
                            stem: "sub".into(),
                            role: "low-end impact".into(),
                            density: "medium".into(),
                            entry_strategy: "chorus only".into(),
                        },
                    ],
                }
            } else if lower.contains("bridge") {
                ArrangementTemplate {
                    section_match: section.section.clone(),
                    primary_layers: vec![
                        "contrast texture".into(),
                        "riser".into(),
                        "reduced kick".into(),
                    ],
                    rhythm_pattern: "broken pulse".to_string(),
                    texture_goal: "contrast tension".to_string(),
                    lift_move: "strip foundation then rebuild".to_string(),
                    stem_lanes: vec![
                        ArrangementStemLane {
                            stem: "fx".into(),
                            role: "transition tension".into(),
                            density: "medium".into(),
                            entry_strategy: "riser-led".into(),
                        },
                        ArrangementStemLane {
                            stem: "percussion".into(),
                            role: "fragmented pulse".into(),
                            density: "low".into(),
                            entry_strategy: "offbeat".into(),
                        },
                    ],
                }
            } else {
                ArrangementTemplate {
                    section_match: section.section.clone(),
                    primary_layers: vec!["tail pad".into(), "echo motif".into()],
                    rhythm_pattern: "release".to_string(),
                    texture_goal: "continuity and landing".to_string(),
                    lift_move: "de-layer into ending glow".to_string(),
                    stem_lanes: vec![
                        ArrangementStemLane {
                            stem: "pad".into(),
                            role: "ending glow".into(),
                            density: "low".into(),
                            entry_strategy: "carry-over".into(),
                        },
                        ArrangementStemLane {
                            stem: "choir".into(),
                            role: "afterglow".into(),
                            density: "low".into(),
                            entry_strategy: "final cadence".into(),
                        },
                    ],
                }
            }
        })
        .collect()
}

fn infer_lead_register(sections: &[CompositionSectionInput]) -> String {
    let avg_root = if sections.is_empty() {
        220.0
    } else {
        sections.iter().map(|section| section.root_hz).sum::<f32>() / sections.len() as f32
    };
    if avg_root < 170.0 {
        "low dramatic".to_string()
    } else if avg_root < 280.0 {
        "mid expressive".to_string()
    } else {
        "high luminous".to_string()
    }
}

fn infer_contour_strategy(sections: &[CompositionSectionInput]) -> String {
    let peak_count = sections
        .iter()
        .filter(|section| section.energy.eq_ignore_ascii_case("peak"))
        .count();
    if peak_count >= 2 {
        "arched escalation with repeated summit hooks".to_string()
    } else if sections.len() >= 6 {
        "longform rise with sectional rest points".to_string()
    } else {
        "compact rise-and-release".to_string()
    }
}

fn infer_hook_strategy(sections: &[CompositionSectionInput]) -> String {
    let chorus_like = sections
        .iter()
        .filter(|section| {
            let lower = section.section.to_lowercase();
            lower.contains("chorus") || lower.contains("reprise") || lower.contains("hook")
        })
        .count();
    if chorus_like >= 2 {
        "anchor a recurring chorus hook and restate it with stronger contour on reprises"
            .to_string()
    } else {
        "seed a single memorable hook and preserve it as the melodic identity".to_string()
    }
}

fn infer_note_grouping_strategy(sections: &[CompositionSectionInput]) -> String {
    let longform = sections.len() >= 8;
    let reprise_count = sections
        .iter()
        .filter(|section| section.section.to_ascii_lowercase().contains("reprise"))
        .count();
    if longform && reprise_count > 0 {
        "use asymmetric 3-3-2 and 4-4-3-5 cells, compress the penultimate group before each apex, and reopen the hook with a longer final restatement tail on reprises".to_string()
    } else if longform {
        "use evolving note groups that tighten before each chorus, pivot through smaller bridge pickups, and widen the final cadence group for release"
            .to_string()
    } else {
        "keep compact 3- and 4-note cells, then restate the hook with one expanded release group and a lighter echo pass"
            .to_string()
    }
}

fn note_group_plan(
    order: u8,
    note_count: u8,
    accent_role: &str,
    contour_move: &str,
    breath_after: bool,
) -> MelodyNoteGroupPlan {
    MelodyNoteGroupPlan {
        order,
        note_count,
        accent_role: accent_role.to_string(),
        contour_move: contour_move.to_string(),
        breath_after,
    }
}

fn hook_pass(
    order: u8,
    role: &str,
    register_bias: &str,
    sustain_bias: &str,
    lyric_density: &str,
    landing_move: &str,
) -> HookRestatementPass {
    HookRestatementPass {
        order,
        role: role.to_string(),
        register_bias: register_bias.to_string(),
        sustain_bias: sustain_bias.to_string(),
        lyric_density: lyric_density.to_string(),
        landing_move: landing_move.to_string(),
    }
}

fn infer_repetition_strategy(sections: &[CompositionSectionInput]) -> String {
    if sections.len() >= 8 {
        "repeat every 2 sections, then refresh motif rhythm every 4 sections".to_string()
    } else {
        "repeat core cells within paired phrases".to_string()
    }
}

fn infer_variation_strategy(sections: &[CompositionSectionInput]) -> String {
    let has_bridge = sections
        .iter()
        .any(|section| section.section.to_lowercase().contains("bridge"));
    if has_bridge {
        "reserve the largest interval and rhythmic variation for the bridge, then return to the core hook".to_string()
    } else {
        "use register shifts and cadence substitutions for variation".to_string()
    }
}

fn infer_tonal_mode(sections: &[CompositionSectionInput]) -> String {
    let dark_sections = sections
        .iter()
        .filter(|section| {
            let lower = section.section.to_lowercase();
            lower.contains("verse") || lower.contains("bridge")
        })
        .count();
    if dark_sections >= sections.len().saturating_div(2).max(1) {
        "minor / aeolian leaning".to_string()
    } else {
        "hybrid minor-major cinematic mode".to_string()
    }
}

fn infer_progression_strategy(sections: &[CompositionSectionInput]) -> String {
    let styles = sections
        .iter()
        .map(|section| section.style.as_str())
        .collect::<Vec<_>>();
    if styles.iter().any(|style| *style == "strings") {
        "pedal-tone gravity with evolving upper-structure chords".to_string()
    } else if styles.iter().any(|style| *style == "piano") {
        "voice-led piano cadences with restrained modulation".to_string()
    } else {
        "loop-stable harmonic bed with sectional suspensions".to_string()
    }
}

fn infer_tension_curve(sections: &[CompositionSectionInput]) -> String {
    let total_duration = sections
        .iter()
        .map(|section| section.duration_sec)
        .sum::<f32>();
    if total_duration >= 240.0 {
        "slow-burn cinematic rise across long-form acts".to_string()
    } else {
        "medium arc with late-stage climax".to_string()
    }
}

fn infer_cadence_strategy(sections: &[CompositionSectionInput]) -> String {
    let has_outro = sections
        .iter()
        .any(|section| section.section.to_lowercase().contains("outro"));
    if has_outro {
        "save authentic resolution for the outro; use suspended or half cadences earlier"
            .to_string()
    } else {
        "alternate suspended cadences with one final authentic landing".to_string()
    }
}

fn infer_instrumentation_focus(sections: &[CompositionSectionInput]) -> String {
    let style = sections
        .first()
        .map(|section| section.style.as_str())
        .unwrap_or("synth");
    match style {
        "piano" => "piano-led motif with support pads and restrained low-end".to_string(),
        "strings" => "strings-led cinematic stack with vocal support pads".to_string(),
        "guofeng" => "hybrid acoustic plucks, air pads, and lyrical lead support".to_string(),
        _ => "hybrid synth-orchestral stack with exposed hook lane".to_string(),
    }
}

fn infer_groove_strategy(sections: &[CompositionSectionInput]) -> String {
    let avg_tempo = if sections.is_empty() {
        100.0
    } else {
        sections
            .iter()
            .map(|section| section.tempo_bpm)
            .sum::<f32>()
            / sections.len() as f32
    };
    if avg_tempo < 90.0 {
        "measured pulse with theatrical rubato at transitions".to_string()
    } else if avg_tempo < 120.0 {
        "steady cinematic pulse with sectional lift accents".to_string()
    } else {
        "forward motion grid with chorus lift percussion".to_string()
    }
}

fn infer_dynamic_arc(sections: &[CompositionSectionInput]) -> String {
    let high_energy = sections
        .iter()
        .filter(|section| matches!(section.energy.as_str(), "high" | "peak"))
        .count();
    if high_energy >= sections.len().saturating_div(2).max(1) {
        "high-pressure arc with compressed valleys and wide final lift".to_string()
    } else {
        "breathing arc with distinct verses, bridges, and climactic lift".to_string()
    }
}

fn infer_transition_strategy(sections: &[CompositionSectionInput]) -> String {
    if sections.len() >= 10 {
        "carry one timbral thread across section boundaries to preserve long-form continuity"
            .to_string()
    } else {
        "use risers, reverse tails, and cadence pickups between sections".to_string()
    }
}

fn infer_lift_strategy(sections: &[CompositionSectionInput]) -> String {
    let has_reprise = sections
        .iter()
        .any(|section| section.section.to_lowercase().contains("reprise"));
    if has_reprise {
        "open the spectrum and widen drums/choir on reprise sections".to_string()
    } else {
        "save width, sub, and percussion expansion for the final hook".to_string()
    }
}

fn infer_melody_role(section: &CompositionSectionInput) -> String {
    let lower = section.section.to_lowercase();
    if lower.contains("verse") {
        "narrative lead with restrained interval motion".to_string()
    } else if lower.contains("chorus") || lower.contains("reprise") {
        "primary hook statement".to_string()
    } else if lower.contains("bridge") {
        "contrast phrase with expanded leaps".to_string()
    } else if lower.contains("outro") {
        "resolution echo of the main hook".to_string()
    } else {
        "sectional motif carrier".to_string()
    }
}

fn infer_harmony_role(section: &CompositionSectionInput) -> String {
    let lower = section.section.to_lowercase();
    if lower.contains("bridge") {
        "tension expansion and color shift".to_string()
    } else if lower.contains("chorus") {
        "stable support for melodic hook".to_string()
    } else if lower.contains("outro") {
        "cadential release".to_string()
    } else {
        "progressive support bed".to_string()
    }
}

fn infer_arrangement_role(section: &CompositionSectionInput) -> String {
    let lower = section.section.to_lowercase();
    if lower.contains("intro") {
        "world-building entry".to_string()
    } else if lower.contains("verse") {
        "lyric support with restrained density".to_string()
    } else if lower.contains("chorus") {
        "full-spectrum lift".to_string()
    } else if lower.contains("bridge") {
        "contrast and transition".to_string()
    } else if lower.contains("outro") {
        "controlled release and afterglow".to_string()
    } else {
        "section scaffold".to_string()
    }
}
