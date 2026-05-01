use super::types::VariantResult;

pub fn select_best(results: &[VariantResult]) -> Option<VariantResult> {
    results
        .iter()
        .max_by(|left, right| {
            left.score
                .partial_cmp(&right.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .cloned()
}
