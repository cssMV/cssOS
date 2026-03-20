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

pub fn default_price_rule(engine: &str, version: &str) -> PriceRule {
    match (engine, version) {
        ("cssmv", "v1.0") => PriceRule {
            engine: engine.into(),
            version: version.into(),
            base_price_usd: 0.05,
            per_lang_usd: 0.01,
            per_voice_usd: 0.01,
            per_output_usd: 0.01,
            karaoke_extra_usd: 0.01,
            market_pack_extra_usd: 0.02,
        },
        ("cssmv", "v2.0") => PriceRule {
            engine: engine.into(),
            version: version.into(),
            base_price_usd: 0.10,
            per_lang_usd: 0.02,
            per_voice_usd: 0.02,
            per_output_usd: 0.02,
            karaoke_extra_usd: 0.02,
            market_pack_extra_usd: 0.03,
        },
        _ => PriceRule {
            engine: engine.into(),
            version: version.into(),
            base_price_usd: 0.20,
            per_lang_usd: 0.03,
            per_voice_usd: 0.03,
            per_output_usd: 0.03,
            karaoke_extra_usd: 0.03,
            market_pack_extra_usd: 0.05,
        },
    }
}

pub fn get_user_remaining_credits_usd(_user_id: &str) -> f64 {
    100.0
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
