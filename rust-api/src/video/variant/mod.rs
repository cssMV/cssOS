mod generator;
mod selector;
mod types;

pub use generator::generate_variants;
pub use selector::select_best;
pub use types::{VariantConfig, VariantResult};

use anyhow::{anyhow, Result};

pub fn render_scene_with_variants(
    base_prompt: &str,
    config: VariantConfig,
    render_fn: impl Fn(&str, u32) -> Result<String>,
    score_fn: impl Fn(&str) -> f32,
) -> Result<String> {
    let variants = generate_variants(base_prompt, config.variant_count);
    let mut results = Vec::with_capacity(variants.len());

    for variant in variants {
        let output = render_fn(&variant.prompt, config.max_attempts)?;
        let score = score_fn(&output);
        results.push(VariantResult {
            variant_id: variant.id,
            output_path: output,
            score,
        });
    }

    let best = select_best(&results).ok_or_else(|| anyhow!("no variant result"))?;
    Ok(best.output_path)
}

#[cfg(test)]
mod tests {
    use super::{render_scene_with_variants, VariantConfig};

    #[test]
    fn variant_engine_picks_highest_scoring_output() {
        let result = render_scene_with_variants(
            "base prompt",
            VariantConfig {
                variant_count: 3,
                max_attempts: 2,
            },
            |prompt, _attempts| Ok(prompt.to_string()),
            |output| {
                if output.contains("dramatic") {
                    0.9
                } else {
                    0.4
                }
            },
        )
        .expect("variant rendering should succeed");
        assert!(result.contains("dramatic"));
    }
}
