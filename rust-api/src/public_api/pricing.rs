use axum::Json;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingInfo {
    pub engine: String,
    pub version: String,
    pub base_price_usd: f64,
    pub per_lang_usd: f64,
    pub per_voice_usd: f64,
    pub per_output_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingResponse {
    pub schema: &'static str,
    pub pricing: Vec<PricingInfo>,
}

pub fn list_pricing() -> Vec<PricingInfo> {
    // CSSOS_PHASE2_3P_PRICING_LIST 20260418 — include 3P engines (MusicGPT,
    // Runway gen3/gen4-image, Stability SDXL) in the public pricing feed so
    // clients see per-call prices for third-party engines alongside our own
    // cssmv tiers. billing_matrix::default_price_rule already defines the
    // per-engine prices; this list is the canonical "what we publish" view.
    const ENTRIES: &[(&str, &str)] = &[
        ("cssmv", "v1.0"),
        ("cssmv", "v2.0"),
        ("cssmv", "v3.0"),
        // CSSOS_PHASE2_SUNO 20260419 — Suno v5 is now the default music
        // engine; listed first among the 3P music providers in the public
        // pricing feed so clients see the canonical default price.
        ("suno", "v5"),
        ("musicgpt", "v1.0"),
        ("runway", "gen3"),
        ("runway", "gen4-image"),
        ("stability", "sdxl"),
    ];
    ENTRIES
        .iter()
        .map(|(engine, version)| {
            let r = crate::billing_matrix::default_price_rule(engine, version);
            PricingInfo {
                engine: r.engine,
                version: r.version,
                base_price_usd: r.base_price_usd,
                per_lang_usd: r.per_lang_usd,
                per_voice_usd: r.per_voice_usd,
                per_output_usd: r.per_output_usd,
            }
        })
        .collect()
}

pub async fn api_pricing() -> Json<PricingResponse> {
    Json(PricingResponse {
        schema: "cssapi.public.pricing.v1",
        pricing: list_pricing(),
    })
}
