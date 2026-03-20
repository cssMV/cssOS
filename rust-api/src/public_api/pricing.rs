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
    ["v1.0", "v2.0", "v3.0"]
        .iter()
        .map(|version| {
            let r = crate::billing_matrix::default_price_rule("cssmv", version);
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
