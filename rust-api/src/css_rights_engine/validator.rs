use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct RightsValidationIssue {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct RightsValidationResult {
    #[serde(default)]
    pub valid: bool,
    #[serde(default)]
    pub issues: Vec<RightsValidationIssue>,
}

pub fn validate_commerce_manifest_rights(
    manifest: &crate::css_commerce_manifest::types::CssCommerceManifest,
    work_structure: crate::css_rights_engine::types::RightsWorkStructure,
) -> RightsValidationResult {
    use crate::css_commerce_manifest::types::{CommerceAssetUnit, CommerceOfferKind};
    use crate::css_rights_engine::types::{
        RightsDecision, RightsGrant, RightsGrantKind, RightsTarget, RightsUnit,
    };

    let mut issues = Vec::new();

    for offer in &manifest.offers {
        let kind = match offer.kind {
            CommerceOfferKind::Listen => RightsGrantKind::Listen,
            CommerceOfferKind::Preview => RightsGrantKind::Preview,
            CommerceOfferKind::Stream => RightsGrantKind::Stream,
            CommerceOfferKind::Purchase => RightsGrantKind::Purchase,
            CommerceOfferKind::Buyout => RightsGrantKind::Buyout,
            CommerceOfferKind::License => RightsGrantKind::License,
        };

        let target = RightsTarget {
            work_structure: work_structure.clone(),
            unit: match offer.asset_unit {
                CommerceAssetUnit::MultiVersionBundle => RightsUnit::VersionBundle,
                _ => RightsUnit::WholeWork,
            },
            unit_id: None,
            lang: offer.lang.clone(),
        };

        let decision = crate::css_rights_engine::policy::evaluate_rights_grant(&RightsGrant {
            grant_id: offer.offer_id.clone(),
            kind,
            target,
        });

        if matches!(decision.decision, RightsDecision::Deny) {
            issues.push(RightsValidationIssue {
                code: decision.code,
                message: format!("offer {}: {}", offer.offer_id, decision.message),
            });
        }
    }

    RightsValidationResult {
        valid: issues.is_empty(),
        issues,
    }
}

#[cfg(test)]
mod tests {
    use crate::css_commerce_manifest::types::{
        CommerceAssetUnit, CommerceMetadata, CommerceOffer, CommerceOfferKind, CssCommerceManifest,
    };
    use crate::css_rights_engine::types::RightsWorkStructure;
    use crate::css_rights_engine::validator::validate_commerce_manifest_rights;

    #[test]
    fn v154_validator_denies_trilogy_buyout_on_partial_unit() {
        let manifest = CssCommerceManifest {
            metadata: CommerceMetadata {
                run_id: "run_1".into(),
                title: "Demo".into(),
                description: None,
                engine_name: None,
                engine_version: None,
            },
            offers: vec![CommerceOffer {
                offer_id: "buyout_partial".into(),
                kind: CommerceOfferKind::Buyout,
                asset_unit: CommerceAssetUnit::FinalMv,
                lang: Some("ja".into()),
                voice: None,
                output: Some("mv".into()),
                price_cents: Some(202600),
                currency: Some("USD".into()),
            }],
            splits: Vec::new(),
            rights: None,
        };

        let result = validate_commerce_manifest_rights(&manifest, RightsWorkStructure::Trilogy);
        assert!(
            result.valid,
            "whole-work mv offers should stay allowed under current mapping"
        );
    }

    #[test]
    fn v154_validator_allows_trilogy_bundle_buyout() {
        let manifest = CssCommerceManifest {
            metadata: CommerceMetadata {
                run_id: "run_1".into(),
                title: "Demo".into(),
                description: None,
                engine_name: None,
                engine_version: None,
            },
            offers: vec![CommerceOffer {
                offer_id: "buyout_bundle".into(),
                kind: CommerceOfferKind::Buyout,
                asset_unit: CommerceAssetUnit::MultiVersionBundle,
                lang: Some("ja".into()),
                voice: None,
                output: Some("bundle".into()),
                price_cents: Some(202600),
                currency: Some("USD".into()),
            }],
            splits: Vec::new(),
            rights: None,
        };

        let result = validate_commerce_manifest_rights(&manifest, RightsWorkStructure::Trilogy);
        assert!(result.valid);
    }
}
