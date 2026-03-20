use crate::css_case_trends_view::types::{TrendPoint, TrendSeries};

pub fn is_same_day(ts: &str, yyyy_mm_dd: &str) -> bool {
    ts.starts_with(yyyy_mm_dd)
}

pub fn build_day_buckets(end_date_yyyy_mm_dd: &str, days: usize) -> anyhow::Result<Vec<String>> {
    let end = chrono::NaiveDate::parse_from_str(end_date_yyyy_mm_dd, "%Y-%m-%d")?;
    let mut out = Vec::new();

    for i in (0..days).rev() {
        let day = end - chrono::Duration::days(i as i64);
        out.push(day.format("%Y-%m-%d").to_string());
    }

    Ok(out)
}

pub fn empty_series(key: &str, label: &str, dates: &[String]) -> TrendSeries {
    TrendSeries {
        key: key.to_string(),
        label: label.to_string(),
        points: dates
            .iter()
            .map(|date| TrendPoint {
                date: date.clone(),
                value: 0.0,
            })
            .collect(),
    }
}

pub fn set_point(series: &mut TrendSeries, date: &str, value: f64) {
    if let Some(point) = series.points.iter_mut().find(|point| point.date == date) {
        point.value = value;
    }
}
