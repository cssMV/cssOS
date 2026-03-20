use crate::market_package::types::{
    MarketPackage, PackageAsset, PackageAssetKind, PackageMetadata, RightsMetadata,
};

#[derive(Debug, Clone)]
pub struct MarketPackageBuildInput {
    pub run_id: String,
    pub title: String,
    pub assets: Vec<PackageAsset>,
    pub engine_name: String,
    pub engine_version: String,
}

pub fn build_market_package(input: MarketPackageBuildInput) -> MarketPackage {
    MarketPackage {
        metadata: PackageMetadata {
            run_id: input.run_id,
            title: input.title,
            description: None,
            author_id: None,
            engine_name: Some(input.engine_name),
            engine_version: Some(input.engine_version),
        },
        assets: input.assets,
        pricing: None,
        rights: Some(RightsMetadata {
            copyright_notice: None,
            commercial_use_allowed: false,
        }),
    }
}

pub fn infer_assets_from_paths(paths: &[String]) -> Vec<PackageAsset> {
    let mut out = Vec::new();
    for path in paths {
        let lower = path.to_ascii_lowercase();
        let asset = if lower.ends_with("final.mv") || lower.ends_with(".mp4") {
            Some(PackageAsset {
                kind: PackageAssetKind::FinalMv,
                path: path.clone(),
                lang: None,
                voice: None,
                output: Some("mv".into()),
            })
        } else if lower.ends_with("subtitles.ass") || lower.ends_with(".ass") {
            Some(PackageAsset {
                kind: PackageAssetKind::SubtitlesAss,
                path: path.clone(),
                lang: None,
                voice: None,
                output: None,
            })
        } else if lower.ends_with("lyrics.txt") {
            Some(PackageAsset {
                kind: PackageAssetKind::LyricsText,
                path: path.clone(),
                lang: None,
                voice: None,
                output: None,
            })
        } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") || lower.ends_with(".png") {
            Some(PackageAsset {
                kind: PackageAssetKind::CoverImage,
                path: path.clone(),
                lang: None,
                voice: None,
                output: None,
            })
        } else if lower.ends_with(".mp3") || lower.ends_with(".wav") {
            Some(PackageAsset {
                kind: PackageAssetKind::AudioOnly,
                path: path.clone(),
                lang: None,
                voice: None,
                output: Some("audio_only".into()),
            })
        } else {
            None
        };
        if let Some(asset) = asset {
            out.push(asset);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use crate::market_package::builder::infer_assets_from_paths;
    use crate::market_package::types::PackageAssetKind;

    #[test]
    fn v152_infer_assets_detects_primary_and_supporting_files() {
        let assets = infer_assets_from_paths(&[
            "/tmp/out/video.mp4".into(),
            "/tmp/out/subtitles.ass".into(),
            "/tmp/out/cover.png".into(),
            "/tmp/out/audio.wav".into(),
        ]);

        assert!(assets.iter().any(|a| a.kind == PackageAssetKind::FinalMv));
        assert!(assets
            .iter()
            .any(|a| a.kind == PackageAssetKind::SubtitlesAss));
        assert!(assets
            .iter()
            .any(|a| a.kind == PackageAssetKind::CoverImage));
        assert!(assets.iter().any(|a| a.kind == PackageAssetKind::AudioOnly));
    }
}
