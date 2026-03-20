use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CommerceValidationIssue {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CommerceValidationResult {
    #[serde(default)]
    pub valid: bool,
    #[serde(default)]
    pub issues: Vec<CommerceValidationIssue>,
}

pub fn validate_css_commerce_manifest(
    manifest: &crate::css_commerce_manifest::types::CssCommerceManifest,
) -> CommerceValidationResult {
    let mut issues = Vec::new();

    if manifest.metadata.title.trim().is_empty() {
        issues.push(CommerceValidationIssue {
            code: "missing_title".into(),
            message: "商业清单缺少标题".into(),
        });
    }

    if manifest.offers.is_empty() {
        issues.push(CommerceValidationIssue {
            code: "missing_offers".into(),
            message: "商业清单缺少可售卖版本".into(),
        });
    }

    for offer in &manifest.offers {
        let wants_price = !matches!(
            offer.kind,
            crate::css_commerce_manifest::types::CommerceOfferKind::Preview
        );
        if wants_price && (offer.price_cents.is_none() || offer.currency.is_none()) {
            issues.push(CommerceValidationIssue {
                code: "invalid_offer_pricing".into(),
                message: format!("售卖版本 {} 缺少完整价格信息", offer.offer_id),
            });
        }
    }

    if !manifest.splits.is_empty() {
        let sum: i32 = manifest.splits.iter().map(|split| split.basis_points).sum();
        if sum != 10000 {
            issues.push(CommerceValidationIssue {
                code: "invalid_revenue_split".into(),
                message: "收益分配总和必须等于 10000 basis points".into(),
            });
        }
    }

    CommerceValidationResult {
        valid: issues.is_empty(),
        issues,
    }
}

#[cfg(test)]
mod tests {
    use crate::css_commerce_manifest::types::{
        CommerceMetadata, CommerceOffer, CommerceOfferKind, CssCommerceManifest,
    };
    use crate::css_commerce_manifest::validator::validate_css_commerce_manifest;

    #[test]
    fn v153_validator_requires_offers_and_title() {
        let result = validate_css_commerce_manifest(&CssCommerceManifest {
            metadata: CommerceMetadata {
                run_id: "run_1".into(),
                title: "".into(),
                description: None,
                engine_name: None,
                engine_version: None,
            },
            offers: Vec::new(),
            splits: Vec::new(),
            rights: None,
        });

        assert!(!result.valid);
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.code == "missing_title"));
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.code == "missing_offers"));
    }

    #[test]
    fn v153_validator_rejects_invalid_offer_pricing_and_split_sum() {
        let result = validate_css_commerce_manifest(&CssCommerceManifest {
            metadata: CommerceMetadata {
                run_id: "run_1".into(),
                title: "Demo".into(),
                description: None,
                engine_name: None,
                engine_version: None,
            },
            offers: vec![CommerceOffer {
                offer_id: "listen_default".into(),
                kind: CommerceOfferKind::Listen,
                asset_unit: crate::css_commerce_manifest::types::CommerceAssetUnit::FinalMv,
                lang: None,
                voice: None,
                output: Some("mv".into()),
                price_cents: Some(99),
                currency: None,
            }],
            splits: vec![crate::css_commerce_manifest::types::CommerceSplit {
                party: "author".into(),
                basis_points: 9000,
            }],
            rights: None,
        });

        assert!(!result.valid);
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.code == "invalid_offer_pricing"));
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.code == "invalid_revenue_split"));
    }
}
