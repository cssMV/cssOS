use std::collections::HashMap;

use crate::css_case_action_log::types::CssCaseActionLogRecord;
use crate::css_case_trends_view::types::{CaseTrendsRequest, CssCaseTrendsView, TrendSeries};
use crate::css_resolution_log::types::{CssResolutionLogRecord, ResolutionLogStatus};

fn build_case_first_seen_map(
    action_logs: &[CssCaseActionLogRecord],
    resolution_logs: &[CssResolutionLogRecord],
) -> HashMap<String, String> {
    let mut first_seen = HashMap::new();

    for log in action_logs {
        first_seen
            .entry(log.case_id.clone())
            .and_modify(|v: &mut String| {
                if log.created_at < *v {
                    *v = log.created_at.clone();
                }
            })
            .or_insert_with(|| log.created_at.clone());
    }

    for log in resolution_logs {
        first_seen
            .entry(log.case_id.clone())
            .and_modify(|v: &mut String| {
                if log.created_at < *v {
                    *v = log.created_at.clone();
                }
            })
            .or_insert_with(|| log.created_at.clone());
    }

    first_seen
}

fn compute_daily_created_cases(
    dates: &[String],
    first_seen: &HashMap<String, String>,
) -> TrendSeries {
    let mut series = crate::css_case_trends_view::aggregations::empty_series(
        "daily_created_cases",
        "每日新增 case 数",
        dates,
    );

    for date in dates {
        let count = first_seen
            .values()
            .filter(|ts| crate::css_case_trends_view::aggregations::is_same_day(ts, date))
            .count();
        crate::css_case_trends_view::aggregations::set_point(&mut series, date, count as f64);
    }

    series
}

fn compute_daily_closed_cases(
    dates: &[String],
    resolution_logs: &[CssResolutionLogRecord],
) -> TrendSeries {
    let mut series = crate::css_case_trends_view::aggregations::empty_series(
        "daily_closed_cases",
        "每日结案数",
        dates,
    );

    for date in dates {
        let count = resolution_logs
            .iter()
            .filter(|log| {
                log.is_closed_like
                    && crate::css_case_trends_view::aggregations::is_same_day(&log.created_at, date)
            })
            .count();
        crate::css_case_trends_view::aggregations::set_point(&mut series, date, count as f64);
    }

    series
}

fn compute_daily_frozen_cases(
    dates: &[String],
    resolution_logs: &[CssResolutionLogRecord],
) -> TrendSeries {
    let mut series = crate::css_case_trends_view::aggregations::empty_series(
        "daily_frozen_cases",
        "每日冻结数",
        dates,
    );

    for date in dates {
        let count = resolution_logs
            .iter()
            .filter(|log| {
                matches!(log.status, ResolutionLogStatus::FrozenUntilReview)
                    && crate::css_case_trends_view::aggregations::is_same_day(&log.created_at, date)
            })
            .count();
        crate::css_case_trends_view::aggregations::set_point(&mut series, date, count as f64);
    }

    series
}

fn compute_daily_escalated_cases(
    dates: &[String],
    resolution_logs: &[CssResolutionLogRecord],
) -> TrendSeries {
    let mut series = crate::css_case_trends_view::aggregations::empty_series(
        "daily_escalated_cases",
        "每日升级人工数",
        dates,
    );

    for date in dates {
        let count = resolution_logs
            .iter()
            .filter(|log| {
                matches!(log.status, ResolutionLogStatus::EscalatedToManual)
                    && crate::css_case_trends_view::aggregations::is_same_day(&log.created_at, date)
            })
            .count();
        crate::css_case_trends_view::aggregations::set_point(&mut series, date, count as f64);
    }

    series
}

async fn compute_daily_high_risk_ratio(
    pool: &sqlx::PgPool,
    dates: &[String],
) -> anyhow::Result<TrendSeries> {
    let mut series = crate::css_case_trends_view::aggregations::empty_series(
        "daily_high_risk_ratio",
        "高风险占比趋势",
        dates,
    );

    for date in dates {
        let result = crate::css_case_query_engine::runtime::query_cases(
            pool,
            crate::css_case_query_engine::types::CaseQueryRequest {
                status: None,
                subject_kind: None,
                risk_level: None,
                closed_like: None,
                actor_user_id: None,
                updated_after: Some(format!("{date}T00:00:00Z")),
                updated_before: Some(format!("{date}T23:59:59Z")),
                has_review: None,
                has_freeze: None,
                has_escalate: None,
                sort_by: None,
                sort_order: None,
                limit: Some(10_000),
                offset: Some(0),
            },
        )
        .await?;

        let total = result.rows.len();
        let high = result
            .rows
            .iter()
            .filter(|row| {
                matches!(
                    row.risk_level,
                    Some(crate::css_case_query_engine::types::CaseQueryRiskLevel::High)
                        | Some(crate::css_case_query_engine::types::CaseQueryRiskLevel::Critical)
                )
            })
            .count();
        let ratio = if total == 0 {
            0.0
        } else {
            high as f64 / total as f64
        };

        crate::css_case_trends_view::aggregations::set_point(&mut series, date, ratio);
    }

    Ok(series)
}

pub async fn build_case_trends_view(
    pool: &sqlx::PgPool,
    req: CaseTrendsRequest,
) -> anyhow::Result<CssCaseTrendsView> {
    let dates = crate::css_case_trends_view::aggregations::build_day_buckets(
        &req.end_date_yyyy_mm_dd,
        req.days,
    )?;
    let all_action_logs = crate::css_case_action_log::store_pg::list_all_action_logs(pool)
        .await
        .unwrap_or_default();
    let all_resolution_logs = crate::css_resolution_log::store_pg::list_all_resolution_logs(pool)
        .await
        .unwrap_or_default();
    let first_seen = build_case_first_seen_map(&all_action_logs, &all_resolution_logs);

    Ok(CssCaseTrendsView {
        daily_created_cases: compute_daily_created_cases(&dates, &first_seen),
        daily_closed_cases: compute_daily_closed_cases(&dates, &all_resolution_logs),
        daily_frozen_cases: compute_daily_frozen_cases(&dates, &all_resolution_logs),
        daily_escalated_cases: compute_daily_escalated_cases(&dates, &all_resolution_logs),
        daily_high_risk_ratio: compute_daily_high_risk_ratio(pool, &dates).await?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v206_created_series_uses_first_seen_dates() {
        let dates = vec!["2026-03-12".to_string(), "2026-03-13".to_string()];
        let mut first_seen = HashMap::new();
        first_seen.insert("case_1".to_string(), "2026-03-13T10:00:00Z".to_string());

        let series = compute_daily_created_cases(&dates, &first_seen);
        assert_eq!(series.points[0].value, 0.0);
        assert_eq!(series.points[1].value, 1.0);
    }
}
