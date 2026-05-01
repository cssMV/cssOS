use serde::{Deserialize, Serialize};

use crate::dag_v3::{OutputKind, VersionMatrix};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BillingUnit {
    PerRun,
    PerOutput,
    PerLang,
    PerVoice,
    PerMinute,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceRule {
    pub engine: String,
    pub version: String,
    pub base_price_usd: f64,
    pub per_lang_usd: f64,
    pub per_voice_usd: f64,
    pub per_output_usd: f64,
    pub karaoke_extra_usd: f64,
    pub market_pack_extra_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BillingBreakdown {
    pub base_price_usd: f64,
    pub langs_price_usd: f64,
    pub voices_price_usd: f64,
    pub outputs_price_usd: f64,
    pub extras_price_usd: f64,
    pub total_price_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct QuotaStatus {
    pub allowed: bool,
    pub remaining_credits_usd: f64,
    pub required_credits_usd: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillingEstimate {
    pub engine: String,
    pub version: String,
    pub langs: usize,
    pub voices: usize,
    pub outputs: usize,
    pub breakdown: BillingBreakdown,
    pub quota: QuotaStatus,
}

// CSSOS_PHASE2_ENGINE_REGISTRY 20260418 —
// Engine/version price table is now a data-driven registry rather than a
// hardcoded match. Ops can tune per-engine prices without a code change via
// env var `CSSMV_ENGINE_PRICES_JSON` (array of PriceRule). New engines are
// added by appending a row in `builtin_registry()` OR by setting the env
// override — both paths respect the "一切参数化 + 一切可扩展" directive.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineCatalogEntry {
    pub engine: String,
    pub version: String,
    /// Pipeline stage this engine serves: `cover`, `lyrics`, `music`, `video`,
    /// `subtitles`, `compose`. A single engine can appear under multiple
    /// stages if applicable.
    pub stage: String,
    /// i18n key for the user-facing label, e.g. `mv.engine.runway.gen4_image`.
    /// Frontend translates via its i18n dictionary; falls back to
    /// `default_label` if the key is missing.
    pub i18n_key: String,
    /// Human fallback label (English) if no i18n entry exists.
    pub default_label: String,
    /// i18n key for a longer description (tooltip).
    pub description_i18n_key: Option<String>,
    /// Whether this engine is marked as default for its stage.
    pub is_default: bool,
    /// Free-form capability tags: `chinese_lyrics`, `commercial`, `fast`, etc.
    /// Lets the frontend filter dropdowns without backend changes.
    pub tags: Vec<String>,
    pub price: PriceRule,
}

/// Built-in engine registry. Each row = one engine+version combination the
/// system supports. Anything the frontend wants to let users pick should live
/// here; the `/api/mv/engines` route returns this list so the UI never
/// hardcodes engine names.
fn builtin_registry() -> Vec<EngineCatalogEntry> {
    let mk = |price: f64| PriceRule {
        engine: String::new(),
        version: String::new(),
        base_price_usd: price,
        per_lang_usd: 0.0,
        per_voice_usd: 0.0,
        per_output_usd: 0.0,
        karaoke_extra_usd: 0.0,
        market_pack_extra_usd: 0.0,
    };
    let apply = |mut rule: PriceRule, engine: &str, version: &str| -> PriceRule {
        rule.engine = engine.to_string();
        rule.version = version.to_string();
        rule
    };

    vec![
        // ---- internal CSSOS baseline (non-3P) --------------------------
        EngineCatalogEntry {
            engine: "cssmv".into(),
            version: "v1.0".into(),
            stage: "compose".into(),
            i18n_key: "mv.engine.cssmv.v1".into(),
            default_label: "CSS MV baseline v1".into(),
            description_i18n_key: Some("mv.engine.cssmv.v1.desc".into()),
            is_default: false,
            tags: vec!["internal".into(), "baseline".into()],
            price: PriceRule {
                engine: "cssmv".into(),
                version: "v1.0".into(),
                base_price_usd: 0.05,
                per_lang_usd: 0.01,
                per_voice_usd: 0.01,
                per_output_usd: 0.01,
                karaoke_extra_usd: 0.01,
                market_pack_extra_usd: 0.02,
            },
        },
        EngineCatalogEntry {
            engine: "cssmv".into(),
            version: "v2.0".into(),
            stage: "compose".into(),
            i18n_key: "mv.engine.cssmv.v2".into(),
            default_label: "CSS MV baseline v2".into(),
            description_i18n_key: Some("mv.engine.cssmv.v2.desc".into()),
            is_default: false,
            tags: vec!["internal".into(), "baseline".into()],
            price: PriceRule {
                engine: "cssmv".into(),
                version: "v2.0".into(),
                base_price_usd: 0.10,
                per_lang_usd: 0.02,
                per_voice_usd: 0.02,
                per_output_usd: 0.02,
                karaoke_extra_usd: 0.02,
                market_pack_extra_usd: 0.03,
            },
        },
        // ---- local/free stages ----------------------------------------
        EngineCatalogEntry {
            engine: "cssmv-local".into(),
            version: "srt-v1".into(),
            stage: "subtitles".into(),
            i18n_key: "mv.engine.cssmv_local.srt_v1".into(),
            default_label: "Local SRT builder".into(),
            description_i18n_key: Some("mv.engine.cssmv_local.srt_v1.desc".into()),
            is_default: true,
            tags: vec!["local".into(), "free".into(), "offline".into()],
            price: apply(mk(0.0), "cssmv-local", "srt-v1"),
        },
        EngineCatalogEntry {
            engine: "cssos-ffmpeg".into(),
            version: "local".into(),
            stage: "compose".into(),
            i18n_key: "mv.engine.cssos_ffmpeg.local".into(),
            default_label: "Local ffmpeg mux".into(),
            description_i18n_key: Some("mv.engine.cssos_ffmpeg.local.desc".into()),
            is_default: true,
            tags: vec!["local".into(), "free".into(), "offline".into()],
            price: apply(mk(0.0), "cssos-ffmpeg", "local"),
        },
        // ---- 3P: Suno v5 (music, default) -----------------------------
        // CSSOS_PHASE2_SUNO 20260419 — Suno v5 is the newest public model on
        // sunoapi.org and became our preferred default per Jing 2026-04-19.
        // Pricing reflects the ~$0.08/track public per-generation rate; ops
        // can override via CSSMV_ENGINE_EXTRA_JSON without touching code.
        EngineCatalogEntry {
            engine: "suno".into(),
            version: "v5".into(),
            stage: "music".into(),
            i18n_key: "mv.engine.suno.v5".into(),
            default_label: "Suno v5".into(),
            description_i18n_key: Some("mv.engine.suno.v5.desc".into()),
            // CSSOS_PHASE2_SUNO_FIRST 20260429 #182 — Jing
            // ElevenLabs in flat-prompt mode produced "一阵轰鸣声" (just a
            // hum, no vocals, no melody). Suno is the lyrics-driven engine
            // that actually sings the user's words — flip back to default.
            is_default: true,
            tags: vec![
                "3p".into(),
                "commercial".into(),
                "vocals".into(),
                "chinese_ok".into(),
                "fast".into(),
            ],
            price: apply(mk(0.08), "suno", "v5"),
        },
        // ---- 3P: MusicGPT (music, fallback) ---------------------------
        EngineCatalogEntry {
            engine: "musicgpt".into(),
            version: "v1.0".into(),
            stage: "music".into(),
            i18n_key: "mv.engine.musicgpt.v1".into(),
            default_label: "MusicGPT v1.0".into(),
            description_i18n_key: Some("mv.engine.musicgpt.v1.desc".into()),
            is_default: false,
            tags: vec!["3p".into(), "commercial".into(), "vocals".into()],
            price: apply(mk(0.40), "musicgpt", "v1.0"),
        },
        // CSSOS_PHASE2_BACKUP_ENGINES 20260419 —
        // Per Jing: "以后每一个引擎环节都要有几个备用引擎供以后选择，不要吊死在一棵树上"
        // Every stage should have 2+ selectable engines so a single upstream
        // outage never blocks creators. Entries below are publicly_selectable
        // scaffolding — the dispatcher in pipeline_mv_api.rs fans them out as
        // real provider integrations land. Until an adapter lands, selecting a
        // not-yet-wired engine falls back to the stage default with a toast
        // so the UI never silently dies.
        // ---- 3P: Suno v4 (music, backup older model) ------------------
        EngineCatalogEntry {
            engine: "suno".into(),
            version: "v4".into(),
            stage: "music".into(),
            i18n_key: "mv.engine.suno.v4".into(),
            default_label: "Suno v4".into(),
            description_i18n_key: Some("mv.engine.suno.v4.desc".into()),
            is_default: false,
            tags: vec![
                "3p".into(),
                "commercial".into(),
                "vocals".into(),
                "chinese_ok".into(),
                "stable".into(),
            ],
            price: apply(mk(0.06), "suno", "v4"),
        },
        // CSSOS_PHASE2_MUSIC_MULTIPROVIDER 20260419 — Udio was removed per
        // Jing: "去掉 Udio 条目——他们的 API 还是受限/邀请制，留着误导用户".
        // The previous entry advertised Udio v1.5 but we never had adapter
        // code or a public API key — any selection silently fell through
        // to MusicGPT. Keeping the comment here so the next person doesn't
        // re-add it without a real adapter and a working invite.
        // ---- 3P: ElevenLabs Music v1 (music, alternate) ---------------
        // CSSOS_PHASE2_MUSIC_MULTIPROVIDER 20260419 — Second non-Suno
        // provider per Jing's directive: "Suno v4 先上，然后 ElevenLabs Music
        // + Stability Audio 2.0 收口". ElevenLabs Music is prompt-driven
        // and returns synchronous audio bytes; the adapter caches the clip
        // to the local work_assets dir and hands a file:// URL back to the
        // pipeline. Priced at MVP street rate; ops can override via the
        // CSSMV_ENGINE_EXTRA_JSON override file.
        EngineCatalogEntry {
            engine: "elevenlabs".into(),
            version: "v1".into(),
            stage: "music".into(),
            i18n_key: "mv.engine.elevenlabs.v1".into(),
            default_label: "ElevenLabs Music v1".into(),
            description_i18n_key: Some("mv.engine.elevenlabs.v1.desc".into()),
            // CSSOS_PHASE2_SUNO_FIRST 20260429 #182 — Jing
            // ElevenLabs flat-prompt mode produced ambient hum without vocals.
            // Demoted from default; it remains a graceful long-form fallback
            // when Suno is unavailable.
            is_default: false,
            tags: vec![
                "3p".into(),
                "commercial".into(),
                "prompt_only".into(),
                "longform".into(),
                "composition_plan".into(),
            ],
            price: apply(mk(0.12), "elevenlabs", "v1"),
        },
        // ---- 3P: Stability Stable Audio 2.0 (music, alternate) --------
        // CSSOS_PHASE2_MUSIC_MULTIPROVIDER 20260419 — Fourth provider.
        // Stable Audio 2.0 is instrumental-leaning (no vocals) and tops out
        // around 190s per clip; the adapter adds an "instrumental
        // arrangement" hint if the caller hands it lyrics so we don't
        // silently drop the user's intent. Shares the STABILITY_API_KEY
        // env with the SDXL cover engine — one key unlocks both services.
        EngineCatalogEntry {
            engine: "stability".into(),
            version: "2.0".into(),
            stage: "music".into(),
            i18n_key: "mv.engine.stability.stable_audio_2".into(),
            default_label: "Stable Audio 2.0".into(),
            description_i18n_key: Some("mv.engine.stability.stable_audio_2.desc".into()),
            is_default: false,
            tags: vec![
                "3p".into(),
                "commercial".into(),
                "instrumental".into(),
                "long_form".into(),
            ],
            price: apply(mk(0.09), "stability", "2.0"),
        },
        // ---- 3P: Runway (video default) -------------------------------
        EngineCatalogEntry {
            engine: "runway".into(),
            version: "gen3".into(),
            stage: "video".into(),
            i18n_key: "mv.engine.runway.gen3".into(),
            default_label: "Runway Gen-3".into(),
            description_i18n_key: Some("mv.engine.runway.gen3.desc".into()),
            is_default: true,
            tags: vec!["3p".into(), "commercial".into(), "image_to_video".into()],
            price: apply(mk(0.60), "runway", "gen3"),
        },
        // ---- 3P: Luma Ray-2 (video, backup) ---------------------------
        EngineCatalogEntry {
            engine: "luma".into(),
            version: "ray-2".into(),
            stage: "video".into(),
            i18n_key: "mv.engine.luma.ray_2".into(),
            default_label: "Luma Ray 2".into(),
            description_i18n_key: Some("mv.engine.luma.ray_2.desc".into()),
            is_default: false,
            tags: vec!["3p".into(), "image_to_video".into(), "smooth_motion".into()],
            price: apply(mk(0.45), "luma", "ray-2"),
        },
        // ---- 3P: Pika 2.1 (video, backup) -----------------------------
        EngineCatalogEntry {
            engine: "pika".into(),
            version: "2.1".into(),
            stage: "video".into(),
            i18n_key: "mv.engine.pika.v2_1".into(),
            default_label: "Pika 2.1".into(),
            description_i18n_key: Some("mv.engine.pika.v2_1.desc".into()),
            is_default: false,
            tags: vec!["3p".into(), "text_to_video".into(), "stylized".into()],
            price: apply(mk(0.35), "pika", "2.1"),
        },
        // ---- 3P: Stability SVD (video, backup, cheap) -----------------
        EngineCatalogEntry {
            engine: "stability".into(),
            version: "svd".into(),
            stage: "video".into(),
            i18n_key: "mv.engine.stability.svd".into(),
            default_label: "Stable Video Diffusion".into(),
            description_i18n_key: Some("mv.engine.stability.svd.desc".into()),
            is_default: false,
            tags: vec!["3p".into(), "cheap".into(), "image_to_video".into()],
            price: apply(mk(0.20), "stability", "svd"),
        },
        // ---- 3P: Cover engines ----------------------------------------
        EngineCatalogEntry {
            engine: "runway".into(),
            version: "gen4-image".into(),
            stage: "cover".into(),
            i18n_key: "mv.engine.runway.gen4_image".into(),
            default_label: "Runway Gen-4 Image".into(),
            description_i18n_key: Some("mv.engine.runway.gen4_image.desc".into()),
            is_default: true,
            tags: vec!["3p".into(), "commercial".into(), "text_to_image".into()],
            price: apply(mk(0.08), "runway", "gen4-image"),
        },
        EngineCatalogEntry {
            engine: "stability".into(),
            version: "sdxl".into(),
            stage: "cover".into(),
            i18n_key: "mv.engine.stability.sdxl".into(),
            default_label: "Stability SDXL".into(),
            description_i18n_key: Some("mv.engine.stability.sdxl.desc".into()),
            is_default: false,
            tags: vec!["3p".into(), "cheap".into(), "text_to_image".into()],
            price: apply(mk(0.05), "stability", "sdxl"),
        },
        // ---- 3P: OpenAI DALL·E 3 (cover, backup) ----------------------
        EngineCatalogEntry {
            engine: "openai".into(),
            version: "dall-e-3".into(),
            stage: "cover".into(),
            i18n_key: "mv.engine.openai.dall_e_3".into(),
            default_label: "OpenAI DALL·E 3".into(),
            description_i18n_key: Some("mv.engine.openai.dall_e_3.desc".into()),
            is_default: false,
            tags: vec!["3p".into(), "quality".into(), "text_to_image".into()],
            price: apply(mk(0.08), "openai", "dall-e-3"),
        },
        // ---- 3P: Ideogram v2 (cover, text-friendly backup) ------------
        EngineCatalogEntry {
            engine: "ideogram".into(),
            version: "v2".into(),
            stage: "cover".into(),
            i18n_key: "mv.engine.ideogram.v2".into(),
            default_label: "Ideogram v2".into(),
            description_i18n_key: Some("mv.engine.ideogram.v2.desc".into()),
            is_default: false,
            tags: vec!["3p".into(), "text_in_image".into(), "text_to_image".into()],
            price: apply(mk(0.07), "ideogram", "v2"),
        },
        // ---- 3P: Subtitle backups (beyond local SRT) ------------------
        EngineCatalogEntry {
            engine: "openai".into(),
            version: "whisper-1".into(),
            stage: "subtitles".into(),
            i18n_key: "mv.engine.openai.whisper_1".into(),
            default_label: "OpenAI Whisper 1".into(),
            description_i18n_key: Some("mv.engine.openai.whisper_1.desc".into()),
            is_default: false,
            tags: vec!["3p".into(), "transcription".into(), "multi_lang".into()],
            price: apply(mk(0.06), "openai", "whisper-1"),
        },
        EngineCatalogEntry {
            engine: "assemblyai".into(),
            version: "v2".into(),
            stage: "subtitles".into(),
            i18n_key: "mv.engine.assemblyai.v2".into(),
            default_label: "AssemblyAI v2".into(),
            description_i18n_key: Some("mv.engine.assemblyai.v2.desc".into()),
            is_default: false,
            tags: vec!["3p".into(), "transcription".into(), "diarization".into()],
            price: apply(mk(0.09), "assemblyai", "v2"),
        },
        // ---- 3P: LLMs for lyrics --------------------------------------
        EngineCatalogEntry {
            engine: "openai".into(),
            version: "gpt-4o-mini".into(),
            stage: "lyrics".into(),
            i18n_key: "mv.engine.openai.gpt_4o_mini".into(),
            default_label: "OpenAI GPT-4o mini".into(),
            description_i18n_key: Some("mv.engine.openai.gpt_4o_mini.desc".into()),
            is_default: true,
            tags: vec!["3p".into(), "cheap".into(), "fast".into(), "chinese_ok".into()],
            price: apply(mk(0.02), "openai", "gpt-4o-mini"),
        },
        EngineCatalogEntry {
            engine: "openai".into(),
            version: "gpt-4o".into(),
            stage: "lyrics".into(),
            i18n_key: "mv.engine.openai.gpt_4o".into(),
            default_label: "OpenAI GPT-4o".into(),
            description_i18n_key: Some("mv.engine.openai.gpt_4o.desc".into()),
            is_default: false,
            tags: vec!["3p".into(), "quality".into(), "chinese_ok".into()],
            price: apply(mk(0.10), "openai", "gpt-4o"),
        },
        EngineCatalogEntry {
            engine: "anthropic".into(),
            version: "claude-haiku-4-5".into(),
            stage: "lyrics".into(),
            i18n_key: "mv.engine.anthropic.claude_haiku_4_5".into(),
            default_label: "Claude Haiku 4.5".into(),
            description_i18n_key: Some("mv.engine.anthropic.claude_haiku_4_5.desc".into()),
            is_default: false,
            tags: vec!["3p".into(), "fast".into(), "chinese_excellent".into()],
            price: apply(mk(0.03), "anthropic", "claude-haiku-4-5"),
        },
        EngineCatalogEntry {
            engine: "anthropic".into(),
            version: "claude-sonnet-4-6".into(),
            stage: "lyrics".into(),
            i18n_key: "mv.engine.anthropic.claude_sonnet_4_6".into(),
            default_label: "Claude Sonnet 4.6".into(),
            description_i18n_key: Some("mv.engine.anthropic.claude_sonnet_4_6.desc".into()),
            is_default: false,
            tags: vec!["3p".into(), "quality".into(), "chinese_excellent".into()],
            price: apply(mk(0.15), "anthropic", "claude-sonnet-4-6"),
        },
    ]
}

/// Load the engine registry, merging env overrides on top of the built-in
/// list. Ops can set `CSSMV_ENGINE_EXTRA_JSON` to a JSON array of
/// `EngineCatalogEntry` to add/override rows without redeploying Rust.
pub fn engine_registry() -> Vec<EngineCatalogEntry> {
    let mut list = builtin_registry();
    if let Ok(extra) = std::env::var("CSSMV_ENGINE_EXTRA_JSON") {
        if !extra.trim().is_empty() {
            if let Ok(rows) = serde_json::from_str::<Vec<EngineCatalogEntry>>(&extra) {
                // Later rows override earlier ones on (engine, version) match.
                for row in rows {
                    list.retain(|e| !(e.engine == row.engine && e.version == row.version));
                    list.push(row);
                }
            }
        }
    }
    list
}

pub fn default_price_rule(engine: &str, version: &str) -> PriceRule {
    for entry in engine_registry() {
        if entry.engine == engine && entry.version == version {
            return entry.price;
        }
    }
    // Fallback for unregistered engines — intentionally conservative so we
    // never silently undercharge. Ops should add an explicit registry row.
    PriceRule {
        engine: engine.into(),
        version: version.into(),
        base_price_usd: 0.20,
        per_lang_usd: 0.03,
        per_voice_usd: 0.03,
        per_output_usd: 0.03,
        karaoke_extra_usd: 0.03,
        market_pack_extra_usd: 0.05,
    }
}

/// Return the list of engines registered for a given stage.
/// `stage` is one of: `cover`, `lyrics`, `music`, `video`, `subtitles`,
/// `compose`. Empty result means no registered engine for that stage.
pub fn engines_for_stage(stage: &str) -> Vec<EngineCatalogEntry> {
    engine_registry()
        .into_iter()
        .filter(|e| e.stage == stage)
        .collect()
}

/// Return the default engine for a stage (first entry with is_default=true),
/// falling back to the first available entry.
pub fn default_engine_for_stage(stage: &str) -> Option<EngineCatalogEntry> {
    let list = engines_for_stage(stage);
    list.iter().find(|e| e.is_default).cloned().or_else(|| list.into_iter().next())
}

pub fn get_user_remaining_credits_usd(_user_id: &str) -> f64 {
    100.0
}

// CSSOS_PHASE2_MV_TIERS 20260419 —
// Three-tier MV cost estimator (Lite / Hybrid / Cinematic) per Jing's
// directive: "先把三档套餐的成本估算器写到 billing_matrix.rs，前端 slider
// 就可以直接读这个". The frontend MV Pipeline panel renders a slider that
// picks between these three bundles so a creator understands which bucket
// the currently-configured pipeline falls into and what it will cost them
// to generate one 5-minute MV.
//
// The tiers differ along one axis only: the share of the output that's
// driven by real AI video vs. Ken Burns over still imagery.
//
//   Lite       : 0%   AI video  — pure cover frames + Ken Burns
//   Hybrid     : 20%  AI video  — key moments animated, rest is Ken Burns
//   Cinematic  : 100% AI video  — every second is an AI clip
//
// Every other stage (lyrics, music, subtitles, compose) is the same across
// tiers; the cover budget scales mildly because Cinematic can get away with
// fewer still frames when motion carries the video.
//
// Gen cost is computed live from `engine_registry()` so that any ops-side
// price override (CSSMV_ENGINE_EXTRA_JSON) automatically flows through to
// the tier estimates — we never hardcode provider prices in two places.

/// One MV tier bundle: a preset cost breakdown + suggested retail prices
/// + engine hints. Serialized directly to the frontend so the slider and
/// the "your current pipeline is Tier X" label can render without any
/// parallel JS price table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MvTier {
    /// Stable id — `lite` | `hybrid` | `cinematic`. Frontend keys off this.
    pub id: String,
    /// i18n key for the tier name, e.g. `mv.tier.hybrid.label`.
    pub i18n_key: String,
    /// English fallback label.
    pub default_label: String,
    /// i18n key for the longer description (slider tooltip).
    pub description_i18n_key: String,
    /// English fallback description.
    pub default_description: String,
    /// Share of the final video that's AI-generated motion. The remainder
    /// is Ken Burns over stills. Used both to describe the tier to the user
    /// and to classify an incoming segment plan into a tier bucket.
    pub ai_video_ratio_pct: u32,
    /// Reference duration used for the cost breakdown. Most songs are 3-5
    /// minutes; we estimate against 300s and let the frontend rescale per
    /// the actual song length if it wants to.
    pub reference_duration_secs: u32,
    /// Approximate number of still frames the cover stage will render.
    /// Cinematic gets fewer because the motion fills the time.
    pub cover_frames: u32,
    /// Seconds of AI video this tier commissions. = reference_duration * ratio.
    pub ai_video_secs: u32,
    /// Engines this tier prefers. The dispatcher may pick a backup at runtime
    /// (per the multiprovider directive) but the estimator costs against these.
    pub engine_hints: MvTierEngineHints,
    /// Per-stage wholesale cost breakdown (USD).
    pub cost_breakdown: MvTierCostBreakdown,
    /// Suggested retail pricing — creator credit required to generate, plus
    /// the buyout / listen retail prices that make the economics work under
    /// the current cssOS royalty split.
    pub pricing: MvTierPricing,
    /// CSSOS_PHASE2_MV_PRICELESS 20260419 — "无价之宝". When true, the tier
    /// does NOT sell exclusive buyouts; only listen royalties flow. This is
    /// the default stance across all three tiers today, matching Jing's
    /// 2026-04-19 decision that an MV should not be transferable:
    ///   "一买断就是另一个用户的了。买断不能3次"
    /// Keeping it as a per-tier flag (rather than a global constant) so
    /// future tiers can opt into buyout if we ever add one.
    pub priceless: bool,
    /// Free-form capability tags so the UI can filter / badge the tier.
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MvTierEngineHints {
    pub cover: Option<String>,
    pub cover_version: Option<String>,
    pub lyrics: Option<String>,
    pub lyrics_version: Option<String>,
    pub music: Option<String>,
    pub music_version: Option<String>,
    pub video: Option<String>,
    pub video_version: Option<String>,
    pub subtitles: Option<String>,
    pub subtitles_version: Option<String>,
    pub compose: Option<String>,
    pub compose_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MvTierCostBreakdown {
    pub cover_usd: f64,
    pub lyrics_usd: f64,
    pub music_usd: f64,
    /// Cost of the AI-video seconds in this tier (0 for Lite).
    pub ai_video_usd: f64,
    /// Cost of the Ken Burns seconds in this tier. Local ffmpeg is free but
    /// we charge a small infra buffer to cover CPU time on the vm.
    pub kenburns_usd: f64,
    pub subtitles_usd: f64,
    pub compose_usd: f64,
    /// Slack for retries, rounding, and one-offs. Kept explicit so ops can
    /// see why the tier total exceeds the sum of the named stages.
    pub buffer_usd: f64,
    pub total_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MvTierPricing {
    /// Wholesale cost to us (sum of cost_breakdown.total_usd).
    pub gen_cost_usd: f64,
    /// What the creator pays in credits to generate one MV at this tier.
    /// gen_cost × markup. The credit is prepaid (existing cssOS model), so
    /// this is never a platform loss — it's just the sticker price on the
    /// MV Pipeline panel's "Generate" button.
    pub creator_credit_usd: f64,
    /// Suggested one-time buyout price (exclusive transfer to one buyer).
    /// Buyout is strictly single-shot: once sold, the song is no longer the
    /// creator's. Subsequent revenue only flows through listen royalties.
    ///
    /// CSSOS_PHASE2_MV_PRICELESS 20260419 — when the tier is marked
    /// `priceless`, this field is forced to 0.0 and the UI must hide the
    /// buyout CTA. We keep the field on the struct so non-priceless future
    /// tiers (or individual opt-ins) can still advertise a buyout price
    /// without a migration.
    pub suggested_buyout_usd: f64,
    /// Suggested per-listen retail price (streaming / karaoke session).
    pub suggested_listen_usd: f64,
    /// What the creator nets per listen after the platform cut (~30%).
    /// Drives the `breakeven_listens` estimate below.
    pub listen_royalty_usd: f64,
    /// Number of listens a creator needs to recoup the creator_credit_usd
    /// assuming zero buyout. Useful copy for the slider tooltip so creators
    /// see the break-even cost right next to the tier price.
    pub breakeven_listens: u32,
}

/// Lookup helper that returns the `base_price_usd` of an engine from the
/// live registry, so tier estimates always reflect whatever ops just tuned
/// via CSSMV_ENGINE_EXTRA_JSON. Returns `fallback` if the engine/version
/// isn't registered (e.g. someone renamed it and forgot to update this
/// file), and logs a stderr warning so the mismatch is noticed.
fn tier_price(engine: &str, version: &str, fallback: f64) -> f64 {
    let registry = engine_registry();
    if let Some(entry) = registry
        .iter()
        .find(|e| e.engine == engine && e.version == version)
    {
        return entry.price.base_price_usd;
    }
    eprintln!(
        "[billing_matrix] mv tier: engine '{}/{}' not in registry — using fallback ${:.2}",
        engine, version, fallback
    );
    fallback
}

/// Markup multiplier applied on top of gen_cost_usd to derive the creator
/// credit price. Kept as a single knob so ops can flatten or steepen margin
/// across all tiers at once via CSSMV_TIER_MARKUP_PCT (default 40% = 1.4x).
fn tier_markup_multiplier() -> f64 {
    std::env::var("CSSMV_TIER_MARKUP_PCT")
        .ok()
        .and_then(|s| s.parse::<f64>().ok())
        .map(|pct| 1.0 + (pct / 100.0))
        .unwrap_or(1.4)
}

/// Platform's cut on each listen royalty. Creator takes (1 - cut) × listen
/// price. Ops can tune via CSSMV_PLATFORM_CUT_PCT (default 30%).
fn platform_cut_pct() -> f64 {
    std::env::var("CSSMV_PLATFORM_CUT_PCT")
        .ok()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(30.0)
        .clamp(0.0, 95.0)
}

fn round_cents(usd: f64) -> f64 {
    (usd * 100.0).round() / 100.0
}

fn build_tier(
    id: &str,
    i18n_key: &str,
    default_label: &str,
    desc_key: &str,
    default_desc: &str,
    ai_video_ratio_pct: u32,
    reference_duration_secs: u32,
    cover_frames: u32,
    suggested_buyout_usd: f64,
    suggested_listen_usd: f64,
    // CSSOS_PHASE2_MV_PRICELESS 20260419 — "无价之宝". When true, the buyout
    // price is zeroed out and the UI hides the buyout CTA. The creator's
    // only revenue path is listen royalties, which is the cssOS default
    // stance for Phase 2.
    priceless: bool,
    tags: Vec<&str>,
) -> MvTier {
    // Engine hints — all tiers share defaults for non-video stages. Video
    // engine for Lite is local ffmpeg (Ken Burns); Hybrid and Cinematic
    // shell out to Runway Gen-3 for the AI-video slice.
    let cover_engine = "runway";
    let cover_version = "gen4-image";
    let lyrics_engine = "anthropic";
    let lyrics_version = "claude-haiku-4-5";
    let music_engine = "suno";
    let music_version = "v5";
    let video_engine = if ai_video_ratio_pct == 0 {
        "cssos-ffmpeg"
    } else {
        "runway"
    };
    let video_version = if ai_video_ratio_pct == 0 {
        "local"
    } else {
        "gen3"
    };
    let subtitles_engine = "cssmv-local";
    let subtitles_version = "srt-v1";
    let compose_engine = "cssos-ffmpeg";
    let compose_version = "local";

    // Per-stage cost derivation.
    let cover_unit = tier_price(cover_engine, cover_version, 0.08);
    let cover_usd = cover_unit * cover_frames as f64;

    let lyrics_usd = tier_price(lyrics_engine, lyrics_version, 0.03);
    let music_usd = tier_price(music_engine, music_version, 0.08);

    // Runway Gen-3 prices per 10s clip (matches the video engine registry
    // row). Scale by number of 10s segments needed to cover ai_video_secs.
    let ai_video_secs = (reference_duration_secs as f64) * (ai_video_ratio_pct as f64) / 100.0;
    let video_clip_price = tier_price(video_engine, video_version, 0.60);
    let ai_video_usd = if ai_video_ratio_pct == 0 {
        0.0
    } else {
        // Round up to whole 10s segments so we never undercharge.
        let segments = (ai_video_secs / 10.0).ceil();
        segments * video_clip_price
    };

    // Ken Burns is local ffmpeg — no provider cost, but we reserve a small
    // infra buffer for CPU time. Scales with the non-AI portion.
    let kenburns_secs = reference_duration_secs as f64 - ai_video_secs;
    let kenburns_usd = (kenburns_secs / 60.0) * 0.02;

    // Subtitles and compose are local — zero provider cost.
    let subtitles_usd = tier_price(subtitles_engine, subtitles_version, 0.0);
    let compose_usd = tier_price(compose_engine, compose_version, 0.0);

    // Buffer scales with tier complexity (more providers => more retries).
    let buffer_usd = match ai_video_ratio_pct {
        0 => 0.20,
        1..=50 => 0.30,
        _ => 0.50,
    };

    let total_usd = round_cents(
        cover_usd
            + lyrics_usd
            + music_usd
            + ai_video_usd
            + kenburns_usd
            + subtitles_usd
            + compose_usd
            + buffer_usd,
    );

    let creator_credit_usd = round_cents(total_usd * tier_markup_multiplier());
    let listen_royalty_usd = round_cents(suggested_listen_usd * (1.0 - platform_cut_pct() / 100.0));
    // CSSOS_PHASE2_MV_PRICELESS 20260419 — force buyout to 0 for priceless
    // tiers so the frontend can key off `priceless` *and* the sentinel price
    // of 0.00 without needing to re-derive the flag.
    let effective_buyout_usd = if priceless { 0.0 } else { suggested_buyout_usd };
    let breakeven_listens = if listen_royalty_usd > 0.0 {
        (creator_credit_usd / listen_royalty_usd).ceil() as u32
    } else {
        0
    };

    MvTier {
        id: id.into(),
        i18n_key: i18n_key.into(),
        default_label: default_label.into(),
        description_i18n_key: desc_key.into(),
        default_description: default_desc.into(),
        ai_video_ratio_pct,
        reference_duration_secs,
        cover_frames,
        ai_video_secs: ai_video_secs.round() as u32,
        engine_hints: MvTierEngineHints {
            cover: Some(cover_engine.into()),
            cover_version: Some(cover_version.into()),
            lyrics: Some(lyrics_engine.into()),
            lyrics_version: Some(lyrics_version.into()),
            music: Some(music_engine.into()),
            music_version: Some(music_version.into()),
            video: Some(video_engine.into()),
            video_version: Some(video_version.into()),
            subtitles: Some(subtitles_engine.into()),
            subtitles_version: Some(subtitles_version.into()),
            compose: Some(compose_engine.into()),
            compose_version: Some(compose_version.into()),
        },
        cost_breakdown: MvTierCostBreakdown {
            cover_usd: round_cents(cover_usd),
            lyrics_usd: round_cents(lyrics_usd),
            music_usd: round_cents(music_usd),
            ai_video_usd: round_cents(ai_video_usd),
            kenburns_usd: round_cents(kenburns_usd),
            subtitles_usd: round_cents(subtitles_usd),
            compose_usd: round_cents(compose_usd),
            buffer_usd: round_cents(buffer_usd),
            total_usd,
        },
        pricing: MvTierPricing {
            gen_cost_usd: total_usd,
            creator_credit_usd,
            suggested_buyout_usd: effective_buyout_usd,
            suggested_listen_usd,
            listen_royalty_usd,
            breakeven_listens,
        },
        priceless,
        tags: tags.into_iter().map(|s| s.to_string()).collect(),
    }
}

/// Return the three standard MV tiers costed against a 5-minute (300s)
/// reference song. Each tier's `cost_breakdown.total_usd` is computed live
/// from the engine registry so ops overrides propagate automatically.
///
/// Current (2026-04-19) sticker prices at default markup. All three tiers
/// ship as "无价之宝" / priceless by default — buyout is disabled, and the
/// creator's only revenue path is listen royalties. See CSSMV_PRICELESS
/// copy on the tier struct for rationale.
///   Lite       ~ $1.50 gen / $2.10 creator credit / no buyout / $0.99 listen
///   Hybrid     ~ $5.00 gen / $7.00 creator credit / no buyout / $0.99 listen
///   Cinematic  ~ $18.80 gen / $26.30 creator credit / no buyout / $0.99 listen
pub fn mv_tiers() -> Vec<MvTier> {
    let reference = std::env::var("CSSMV_TIER_REFERENCE_SECS")
        .ok()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(300);

    vec![
        build_tier(
            "lite",
            "mv.tier.lite.label",
            "Lite",
            "mv.tier.lite.desc",
            "Pure Ken Burns over AI-generated stills. Cheapest to produce, ships in minutes, \
             best for lyric videos and lo-fi audio drops. 无价之宝 — listens only, no buyout.",
            0,
            reference,
            15,
            3.99,
            0.99,
            // priceless: all three tiers ship listens-only by default.
            true,
            vec!["cheapest", "fastest", "kenburns_only", "no_ai_video", "priceless"],
        ),
        build_tier(
            "hybrid",
            "mv.tier.hybrid.label",
            "Hybrid",
            "mv.tier.hybrid.desc",
            "Still frames + Ken Burns for most of the song, with ~20% animated by real AI video \
             at the hooks and choruses. Sweet spot on cost-per-impact. 无价之宝 — listens only, \
             no buyout.",
            20,
            reference,
            15,
            8.99,
            0.99,
            true,
            vec!["balanced", "kenburns_plus_ai", "recommended", "priceless"],
        ),
        build_tier(
            "cinematic",
            "mv.tier.cinematic.label",
            "Cinematic",
            "mv.tier.cinematic.desc",
            "Every second is generated by an AI video model. Highest production value, \
             longest render, highest wholesale cost. For premium releases. 无价之宝 — listens only, \
             no buyout.",
            100,
            reference,
            8,
            29.99,
            0.99,
            true,
            vec!["premium", "full_ai_video", "cinematic", "priceless"],
        ),
    ]
}

/// Classify an ai-video-seconds ratio (0-100) into a tier id. The inputs
/// match the segment-plan structure the frontend ships to /api/mv/compose:
/// sum of `ai_video` segment durations divided by total duration. Lets the
/// backend label a given generation request with its tier after the fact.
///
/// Bucket boundaries are chosen to be a bit wider than the tier centers
/// (0 / 20 / 100) so the user's slider doesn't wobble across labels with
/// every tiny adjustment.
pub fn classify_tier_by_ratio(ai_video_ratio_pct: u32) -> &'static str {
    match ai_video_ratio_pct {
        0..=5 => "lite",
        6..=60 => "hybrid",
        _ => "cinematic",
    }
}

/// Convenience helper: given the raw seconds split from a compose request,
/// return (ratio_pct, tier_id). Keeps the math in one place so the compose
/// handler, the tier endpoint, and any future analytics report the same
/// bucket for the same plan.
pub fn classify_tier_by_seconds(ai_video_secs: f64, total_secs: f64) -> (u32, &'static str) {
    if total_secs <= 0.0 {
        return (0, "lite");
    }
    let ratio = ((ai_video_secs / total_secs) * 100.0).round().clamp(0.0, 100.0) as u32;
    (ratio, classify_tier_by_ratio(ratio))
}

pub fn estimate_price(
    engine: &str,
    version: &str,
    matrix: &VersionMatrix,
    remaining_credits_usd: f64,
) -> BillingEstimate {
    let rule = default_price_rule(engine, version);

    let langs = matrix.langs.len();
    let voices = matrix.voices.len();
    let outputs = matrix.outputs.len();

    let has_karaoke = matrix
        .outputs
        .iter()
        .any(|x| matches!(x, OutputKind::KaraokeMv));
    let has_market_pack = matrix
        .outputs
        .iter()
        .any(|x| matches!(x, OutputKind::MarketPack));

    let base_price_usd = rule.base_price_usd;
    let langs_price_usd = (langs as f64) * rule.per_lang_usd;
    let voices_price_usd = (voices as f64) * rule.per_voice_usd;
    let outputs_price_usd = (outputs as f64) * rule.per_output_usd;

    let mut extras_price_usd = 0.0;
    if has_karaoke {
        extras_price_usd += rule.karaoke_extra_usd;
    }
    if has_market_pack {
        extras_price_usd += rule.market_pack_extra_usd;
    }

    let total_price_usd =
        base_price_usd + langs_price_usd + voices_price_usd + outputs_price_usd + extras_price_usd;

    let quota = QuotaStatus {
        allowed: remaining_credits_usd >= total_price_usd,
        remaining_credits_usd,
        required_credits_usd: total_price_usd,
        reason: if remaining_credits_usd >= total_price_usd {
            None
        } else {
            Some("insufficient_credits".into())
        },
    };

    BillingEstimate {
        engine: engine.into(),
        version: version.into(),
        langs,
        voices,
        outputs,
        breakdown: BillingBreakdown {
            base_price_usd,
            langs_price_usd,
            voices_price_usd,
            outputs_price_usd,
            extras_price_usd,
            total_price_usd,
        },
        quota,
    }
}
