use crate::css_commerce_manifest::types::{
    CommerceAssetUnit, CommerceMetadata, CommerceOffer, CommerceOfferKind, CommerceRights,
    CommerceSplit, CssCommerceManifest,
};

#[derive(Debug, Clone)]
pub struct CssCommerceBuildInput {
    pub run_id: String,
    pub title: String,
    pub engine_name: String,
    pub engine_version: String,
    pub market_package: crate::market_package::types::MarketPackage,
    pub allow_pricing: bool,
    pub allow_settlement: bool,
}

pub fn build_default_offers(
    pkg: &crate::market_package::types::MarketPackage,
    allow_pricing: bool,
) -> Vec<CommerceOffer> {
    let default_unit = infer_primary_asset_unit(pkg).unwrap_or(CommerceAssetUnit::FinalMv);
    let mut offers = Vec::new();

    offers.push(CommerceOffer {
        offer_id: "listen_default".into(),
        kind: CommerceOfferKind::Listen,
        asset_unit: default_unit,
        lang: None,
        voice: None,
        output: Some("mv".into()),
        price_cents: if allow_pricing { Some(99) } else { None },
        currency: if allow_pricing {
            Some("USD".into())
        } else {
            None
        },
    });

    offers.push(CommerceOffer {
        offer_id: "buyout_default".into(),
        kind: CommerceOfferKind::Buyout,
        asset_unit: CommerceAssetUnit::MultiVersionBundle,
        lang: None,
        voice: None,
        output: Some("bundle".into()),
        price_cents: if allow_pricing { Some(202600) } else { None },
        currency: if allow_pricing {
            Some("USD".into())
        } else {
            None
        },
    });

    offers
}

pub fn build_default_splits(allow_settlement: bool) -> Vec<CommerceSplit> {
    if !allow_settlement {
        return Vec::new();
    }

    vec![
        CommerceSplit {
            party: "author".into(),
            basis_points: 9000,
        },
        CommerceSplit {
            party: "cssstudio_platform".into(),
            basis_points: 1000,
        },
    ]
}

pub fn build_css_commerce_manifest(input: CssCommerceBuildInput) -> CssCommerceManifest {
    CssCommerceManifest {
        metadata: CommerceMetadata {
            run_id: input.run_id,
            title: input.title,
            description: None,
            engine_name: Some(input.engine_name),
            engine_version: Some(input.engine_version),
        },
        offers: build_default_offers(&input.market_package, input.allow_pricing),
        splits: build_default_splits(input.allow_settlement),
        rights: Some(CommerceRights {
            author_id: input.market_package.metadata.author_id.clone(),
            commercial_use_allowed: true,
            resale_allowed: false,
        }),
    }
}

fn infer_primary_asset_unit(
    pkg: &crate::market_package::types::MarketPackage,
) -> Option<CommerceAssetUnit> {
    for asset in &pkg.assets {
        match asset.kind {
            crate::market_package::types::PackageAssetKind::FinalMv => {
                return Some(CommerceAssetUnit::FinalMv);
            }
            crate::market_package::types::PackageAssetKind::KaraokeMv => {
                return Some(CommerceAssetUnit::KaraokeMv);
            }
            crate::market_package::types::PackageAssetKind::AudioOnly => {
                return Some(CommerceAssetUnit::AudioOnly);
            }
            crate::market_package::types::PackageAssetKind::Instrumental => {
                return Some(CommerceAssetUnit::Instrumental);
            }
            crate::market_package::types::PackageAssetKind::VocalsOnly => {
                return Some(CommerceAssetUnit::VocalsOnly);
            }
            _ => {}
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use crate::css_commerce_manifest::builder::{
        build_css_commerce_manifest, build_default_splits, CssCommerceBuildInput,
    };
    use crate::css_commerce_manifest::types::CommerceOfferKind;
    use crate::market_package::types::{
        MarketPackage, PackageAsset, PackageAssetKind, PackageMetadata,
    };

    fn sample_package() -> MarketPackage {
        MarketPackage {
            metadata: PackageMetadata {
                run_id: "run_demo".into(),
                title: "Demo".into(),
                description: None,
                author_id: Some("author_1".into()),
                engine_name: Some("cssmv".into()),
                engine_version: Some("v3.0".into()),
            },
            assets: vec![PackageAsset {
                kind: PackageAssetKind::FinalMv,
                path: "/tmp/demo.mp4".into(),
                lang: None,
                voice: None,
                output: Some("mv".into()),
            }],
            pricing: None,
            rights: None,
        }
    }

    #[test]
    fn v153_builder_creates_default_listen_and_buyout_offers() {
        let manifest = build_css_commerce_manifest(CssCommerceBuildInput {
            run_id: "run_demo".into(),
            title: "Demo".into(),
            engine_name: "cssmv".into(),
            engine_version: "v3.0".into(),
            market_package: sample_package(),
            allow_pricing: true,
            allow_settlement: true,
        });

        assert_eq!(manifest.offers.len(), 2);
        assert!(manifest
            .offers
            .iter()
            .any(|offer| offer.kind == CommerceOfferKind::Listen && offer.price_cents == Some(99)));
        assert!(manifest
            .offers
            .iter()
            .any(|offer| offer.kind == CommerceOfferKind::Buyout
                && offer.price_cents == Some(202600)));
        assert_eq!(manifest.splits.len(), 2);
    }

    #[test]
    fn v153_builder_omits_splits_when_settlement_is_disabled() {
        let splits = build_default_splits(false);
        assert!(splits.is_empty());
    }
}
