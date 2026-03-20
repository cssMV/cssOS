use std::collections::HashMap;

use crate::css_case_action_log::types::CssCaseActionLogRecord;
use crate::css_case_analytics_view::types::{
    AnalyticsBucket, CaseAnalyticsRequest, CssCaseAnalyticsView,
};
use crate::css_case_query_engine::types::{
    CaseQueryRequest, CaseQueryResponse, CaseQueryRow, CaseQuerySortBy, CaseQuerySortOrder,
    CaseQueryStatusKind,
};
use crate::css_resolution_log::types::CssResolutionLogRecord;

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

fn compute_most_frozen_subjects(rows: &[CaseQueryRow]) -> Vec<AnalyticsBucket> {
    let total = rows.len();
    let mut counts: HashMap<String, usize> = HashMap::new();

    for row in rows {
        if matches!(row.status, CaseQueryStatusKind::FrozenUntilReview) {
            *counts
                .entry(crate::css_case_analytics_view::aggregations::subject_label(
                    &row.subject_kind,
                ))
                .or_insert(0) += 1;
        }
    }

    let mut out = counts
        .into_iter()
        .map(|(key, count)| AnalyticsBucket {
            key: key.clone(),
            label: key,
            count,
            ratio: crate::css_case_analytics_view::aggregations::safe_ratio(count, total),
            avg_seconds: None,
        })
        .collect::<Vec<_>>();

    out.sort_by(|a, b| b.count.cmp(&a.count));
    out
}

fn compute_most_escalated_subjects(rows: &[CaseQueryRow]) -> Vec<AnalyticsBucket> {
    let total = rows.len();
    let mut counts: HashMap<String, usize> = HashMap::new();

    for row in rows {
        if matches!(row.status, CaseQueryStatusKind::EscalatedToManual) || row.has_escalate {
            *counts
                .entry(crate::css_case_analytics_view::aggregations::subject_label(
                    &row.subject_kind,
                ))
                .or_insert(0) += 1;
        }
    }

    let mut out = counts
        .into_iter()
        .map(|(key, count)| AnalyticsBucket {
            key: key.clone(),
            label: key,
            count,
            ratio: crate::css_case_analytics_view::aggregations::safe_ratio(count, total),
            avg_seconds: None,
        })
        .collect::<Vec<_>>();

    out.sort_by(|a, b| b.count.cmp(&a.count));
    out
}

fn compute_longest_resolution_subjects(
    latest_resolution_logs: &[CssResolutionLogRecord],
    first_seen: &HashMap<String, String>,
) -> Vec<AnalyticsBucket> {
    let mut grouped: HashMap<String, Vec<i64>> = HashMap::new();

    for log in latest_resolution_logs {
        if !log.is_closed_like {
            continue;
        }

        let Some(start) = first_seen.get(&log.case_id) else {
            continue;
        };

        let Ok(start_dt) = chrono::DateTime::parse_from_rfc3339(start) else {
            continue;
        };
        let Ok(end_dt) = chrono::DateTime::parse_from_rfc3339(&log.created_at) else {
            continue;
        };

        let key = format!("{:?}", log.subject_kind).to_lowercase();
        grouped
            .entry(key)
            .or_default()
            .push((end_dt - start_dt).num_seconds());
    }

    let mut out = grouped
        .into_iter()
        .map(|(key, values)| AnalyticsBucket {
            key: key.clone(),
            label: key,
            count: values.len(),
            ratio: None,
            avg_seconds: crate::css_case_analytics_view::aggregations::avg_i64(&values),
        })
        .collect::<Vec<_>>();

    out.sort_by(|a, b| b.avg_seconds.cmp(&a.avg_seconds));
    out
}

fn compute_risk_to_resolution_outcomes(rows: &[CaseQueryRow]) -> Vec<AnalyticsBucket> {
    let total = rows.len();
    let mut counts: HashMap<String, usize> = HashMap::new();

    for row in rows {
        let Some(risk_level) = &row.risk_level else {
            continue;
        };

        let key = format!(
            "{} -> {}",
            crate::css_case_analytics_view::aggregations::risk_label(risk_level),
            format!("{:?}", row.status).to_lowercase()
        );
        *counts.entry(key).or_insert(0) += 1;
    }

    let mut out = counts
        .into_iter()
        .map(|(key, count)| AnalyticsBucket {
            key: key.clone(),
            label: key,
            count,
            ratio: crate::css_case_analytics_view::aggregations::safe_ratio(count, total),
            avg_seconds: None,
        })
        .collect::<Vec<_>>();

    out.sort_by(|a, b| b.count.cmp(&a.count));
    out
}

async fn load_query_sample(pool: &sqlx::PgPool) -> anyhow::Result<CaseQueryResponse> {
    crate::css_case_query_engine::runtime::query_cases(
        pool,
        CaseQueryRequest {
            status: None,
            subject_kind: None,
            risk_level: None,
            closed_like: None,
            actor_user_id: None,
            updated_after: None,
            updated_before: None,
            has_review: None,
            has_freeze: None,
            has_escalate: None,
            sort_by: Some(CaseQuerySortBy::UpdatedAt),
            sort_order: Some(CaseQuerySortOrder::Desc),
            limit: Some(10_000),
            offset: Some(0),
        },
    )
    .await
}

pub async fn build_case_analytics_view(
    pool: &sqlx::PgPool,
    _req: CaseAnalyticsRequest,
) -> anyhow::Result<CssCaseAnalyticsView> {
    let query_result = load_query_sample(pool).await?;
    let latest_resolution_logs =
        crate::css_resolution_log::store_pg::list_latest_resolution_logs(pool)
            .await
            .unwrap_or_default();
    let all_action_logs = crate::css_case_action_log::store_pg::list_all_action_logs(pool)
        .await
        .unwrap_or_default();
    let all_resolution_logs = crate::css_resolution_log::store_pg::list_all_resolution_logs(pool)
        .await
        .unwrap_or_default();
    let first_seen = build_case_first_seen_map(&all_action_logs, &all_resolution_logs);

    Ok(CssCaseAnalyticsView {
        most_frozen_subjects: compute_most_frozen_subjects(&query_result.rows),
        most_escalated_subjects: compute_most_escalated_subjects(&query_result.rows),
        longest_resolution_subjects: compute_longest_resolution_subjects(
            &latest_resolution_logs,
            &first_seen,
        ),
        risk_to_resolution_outcomes: compute_risk_to_resolution_outcomes(&query_result.rows),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::css_case_query_engine::types::{CaseQueryRiskLevel, CaseQuerySubjectKind};

    #[test]
    fn v205_freeze_aggregation_counts_rows() {
        let rows = vec![CaseQueryRow {
            case_id: "case_1".into(),
            subject_kind: CaseQuerySubjectKind::Deal,
            subject_id: "deal_1".into(),
            status: CaseQueryStatusKind::FrozenUntilReview,
            status_label: "冻结待复核".into(),
            risk_level: Some(CaseQueryRiskLevel::High),
            is_closed_like: false,
            actor_user_id: None,
            updated_at: None,
            has_review: false,
            has_freeze: true,
            has_escalate: false,
            one_line_summary: None,
        }];

        let buckets = compute_most_frozen_subjects(&rows);
        assert_eq!(buckets.first().map(|x| x.key.as_str()), Some("deal"));
        assert_eq!(buckets.first().map(|x| x.count), Some(1));
    }
}
