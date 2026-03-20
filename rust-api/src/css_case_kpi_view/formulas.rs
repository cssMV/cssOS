pub fn safe_ratio(numerator: usize, denominator: usize) -> Option<f64> {
    if denominator == 0 {
        None
    } else {
        Some(numerator as f64 / denominator as f64)
    }
}

pub fn avg_i64(values: &[i64]) -> Option<i64> {
    if values.is_empty() {
        None
    } else {
        Some(values.iter().sum::<i64>() / values.len() as i64)
    }
}

pub fn is_same_day(ts: &str, today_yyyy_mm_dd: &str) -> bool {
    ts.starts_with(today_yyyy_mm_dd)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v204_safe_ratio_returns_none_for_zero_denominator() {
        assert_eq!(safe_ratio(1, 0), None);
        assert_eq!(safe_ratio(2, 4), Some(0.5));
    }
}
