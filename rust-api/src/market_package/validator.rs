use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PackageValidationIssue {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PackageValidationResult {
    #[serde(default)]
    pub valid: bool,
    #[serde(default)]
    pub issues: Vec<PackageValidationIssue>,
}

pub fn validate_package(
    pkg: &crate::market_package::types::MarketPackage,
) -> PackageValidationResult {
    let mut issues = Vec::new();

    let has_primary = pkg.assets.iter().any(|asset| {
        matches!(
            asset.kind,
            crate::market_package::types::PackageAssetKind::FinalMv
                | crate::market_package::types::PackageAssetKind::KaraokeMv
                | crate::market_package::types::PackageAssetKind::AudioOnly
        )
    });
    if !has_primary {
        issues.push(PackageValidationIssue {
            code: "missing_primary_asset".into(),
            message: "市场发布包缺少主资产（MV / Karaoke MV / Audio Only）".into(),
        });
    }

    if pkg.metadata.title.trim().is_empty() {
        issues.push(PackageValidationIssue {
            code: "missing_title".into(),
            message: "市场发布包缺少标题".into(),
        });
    }

    if let Some(pricing) = &pkg.pricing {
        if pricing.list_price_cents.is_none() || pricing.currency.is_none() {
            issues.push(PackageValidationIssue {
                code: "invalid_pricing".into(),
                message: "定价信息不完整".into(),
            });
        }
    }

    PackageValidationResult {
        valid: issues.is_empty(),
        issues,
    }
}

#[cfg(test)]
mod tests {
    use crate::market_package::types::{MarketPackage, PackageMetadata, PricingMetadata};
    use crate::market_package::validator::validate_package;

    #[test]
    fn v152_validator_rejects_missing_primary_asset() {
        let result = validate_package(&MarketPackage {
            metadata: PackageMetadata {
                run_id: "run_1".into(),
                title: "Hello".into(),
                description: None,
                author_id: None,
                engine_name: None,
                engine_version: None,
            },
            assets: Vec::new(),
            pricing: None,
            rights: None,
        });

        assert!(!result.valid);
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.code == "missing_primary_asset"));
    }

    #[test]
    fn v152_validator_rejects_incomplete_pricing() {
        let result = validate_package(&MarketPackage {
            metadata: PackageMetadata {
                run_id: "run_1".into(),
                title: "Hello".into(),
                description: None,
                author_id: None,
                engine_name: None,
                engine_version: None,
            },
            assets: vec![crate::market_package::types::PackageAsset {
                kind: crate::market_package::types::PackageAssetKind::AudioOnly,
                path: "/tmp/test.wav".into(),
                lang: None,
                voice: None,
                output: Some("audio_only".into()),
            }],
            pricing: Some(PricingMetadata {
                list_price_cents: Some(99),
                currency: None,
            }),
            rights: None,
        });

        assert!(!result.valid);
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.code == "invalid_pricing"));
    }
}
