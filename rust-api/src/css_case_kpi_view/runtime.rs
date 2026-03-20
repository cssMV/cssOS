use std::collections::HashMap;

use crate::css_case_action_log::types::CssCaseActionLogRecord;
use crate::css_case_kpi_view::types::{CaseKpiRequest, CssCaseKpiView};
use crate::css_case_query_engine::types::CaseQueryRiskLevel;
use crate::css_resolution_log::types::{
    CssResolutionLogRecord, ResolutionLogStatus, ResolutionLogSubjectKind,
};

fn risk_level_from_risk_json(v: &serde_json::Value) -> Option<CaseQueryRiskLevel> {
    let factors = v
        .get("data")
        .and_then(|data| data.get("factors"))
        .and_then(|factors| factors.as_array())?;

    let top = factors
        .iter()
        .filter_map(|factor| factor.get("severity").and_then(|x| x.as_str()))
        .max_by_key(|severity| match *severity {
            "critical" => 4,
            "high" => 3,
            "medium" => 2,
            "low" => 1,
            _ => 0,
        })?;

    match top {
        "low" => Some(CaseQueryRiskLevel::Low),
        "medium" => Some(CaseQueryRiskLevel::Medium),
        "high" => Some(CaseQueryRiskLevel::High),
        "critical" => Some(CaseQueryRiskLevel::Critical),
        _ => None,
    }
}

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

fn compute_avg_resolution_seconds(
    latest_resolution_logs: &[CssResolutionLogRecord],
    first_seen: &HashMap<String, String>,
) -> Option<i64> {
    let mut durations = Vec::new();

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

        durations.push((end_dt - start_dt).num_seconds());
    }

    crate::css_case_kpi_view::formulas::avg_i64(&durations)
}

fn compute_created_today_count(
    first_seen: &HashMap<String, String>,
    today_yyyy_mm_dd: &str,
) -> usize {
    first_seen
        .values()
        .filter(|ts| crate::css_case_kpi_view::formulas::is_same_day(ts, today_yyyy_mm_dd))
        .count()
}

fn compute_resolved_today_count(
    latest_resolution_logs: &[CssResolutionLogRecord],
    today_yyyy_mm_dd: &str,
) -> usize {
    latest_resolution_logs
        .iter()
        .filter(|log| {
            log.is_closed_like
                && crate::css_case_kpi_view::formulas::is_same_day(
                    &log.created_at,
                    today_yyyy_mm_dd,
                )
        })
        .count()
}

async fn load_risk_json(
    pool: &sqlx::PgPool,
    subject_kind: &ResolutionLogSubjectKind,
    subject_id: &str,
) -> anyhow::Result<serde_json::Value> {
    match subject_kind {
        ResolutionLogSubjectKind::User => serde_json::to_value(
            crate::css_risk_api::handlers::get_user_risk_inner(
                pool,
                crate::css_risk_api::types::GetUserRiskRequest {
                    user_id: subject_id.to_string(),
                },
            )
            .await?,
        )
        .map_err(Into::into),
        ResolutionLogSubjectKind::Catalog => serde_json::to_value(
            crate::css_risk_api::handlers::get_catalog_risk_inner(
                pool,
                crate::css_risk_api::types::GetCatalogRiskRequest {
                    catalog_id: subject_id.to_string(),
                },
            )
            .await?,
        )
        .map_err(Into::into),
        ResolutionLogSubjectKind::Deal => serde_json::to_value(
            crate::css_risk_api::handlers::get_deal_risk_inner(
                pool,
                crate::css_risk_api::types::GetDealRiskRequest {
                    deal_id: subject_id.to_string(),
                },
            )
            .await?,
        )
        .map_err(Into::into),
        ResolutionLogSubjectKind::Ownership => serde_json::to_value(
            crate::css_risk_api::handlers::get_ownership_risk_inner(
                pool,
                crate::css_risk_api::types::GetOwnershipRiskRequest {
                    ownership_id: subject_id.to_string(),
                },
            )
            .await?,
        )
        .map_err(Into::into),
    }
}

async fn compute_high_risk_to_manual_ratio(
    pool: &sqlx::PgPool,
    latest_resolution_logs: &[CssResolutionLogRecord],
) -> anyhow::Result<Option<f64>> {
    let mut high_risk_total = 0usize;
    let mut escalated_total = 0usize;

    for log in latest_resolution_logs {
        let risk_json = load_risk_json(pool, &log.subject_kind, &log.subject_id).await?;
        let risk_level = risk_level_from_risk_json(&risk_json);

        if matches!(
            risk_level,
            Some(CaseQueryRiskLevel::High) | Some(CaseQueryRiskLevel::Critical)
        ) {
            high_risk_total += 1;

            if matches!(log.status, ResolutionLogStatus::EscalatedToManual) {
                escalated_total += 1;
            }
        }
    }

    Ok(crate::css_case_kpi_view::formulas::safe_ratio(
        escalated_total,
        high_risk_total,
    ))
}

async fn compute_frozen_to_release_ratio(
    pool: &sqlx::PgPool,
    case_ids: &[String],
) -> anyhow::Result<Option<f64>> {
    let mut frozen_cases = 0usize;
    let mut released_cases = 0usize;

    for case_id in case_ids {
        let logs =
            crate::css_resolution_log::store_pg::list_resolution_logs_for_case(pool, case_id)
                .await
                .unwrap_or_default();

        let had_frozen = logs
            .iter()
            .any(|x| matches!(x.status, ResolutionLogStatus::FrozenUntilReview));

        if had_frozen {
            frozen_cases += 1;

            let later_released = logs
                .iter()
                .any(|x| matches!(x.status, ResolutionLogStatus::Released));

            if later_released {
                released_cases += 1;
            }
        }
    }

    Ok(crate::css_case_kpi_view::formulas::safe_ratio(
        released_cases,
        frozen_cases,
    ))
}

fn compute_closed_like_ratio(latest_resolution_logs: &[CssResolutionLogRecord]) -> Option<f64> {
    let total = latest_resolution_logs.len();
    let closed_like = latest_resolution_logs
        .iter()
        .filter(|x| x.is_closed_like)
        .count();

    crate::css_case_kpi_view::formulas::safe_ratio(closed_like, total)
}

pub async fn build_case_kpi_view(
    pool: &sqlx::PgPool,
    req: CaseKpiRequest,
) -> anyhow::Result<CssCaseKpiView> {
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
    let case_ids = latest_resolution_logs
        .iter()
        .map(|x| x.case_id.clone())
        .collect::<Vec<_>>();

    Ok(CssCaseKpiView {
        avg_resolution_seconds: compute_avg_resolution_seconds(
            &latest_resolution_logs,
            &first_seen,
        ),
        created_today_count: compute_created_today_count(&first_seen, &req.today_yyyy_mm_dd),
        resolved_today_count: compute_resolved_today_count(
            &latest_resolution_logs,
            &req.today_yyyy_mm_dd,
        ),
        high_risk_to_manual_ratio: compute_high_risk_to_manual_ratio(pool, &latest_resolution_logs)
            .await?,
        frozen_to_release_ratio: compute_frozen_to_release_ratio(pool, &case_ids).await?,
        closed_like_ratio: compute_closed_like_ratio(&latest_resolution_logs),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v204_compute_created_today_count_uses_first_seen_day() {
        let mut first_seen = HashMap::new();
        first_seen.insert("case:1".into(), "2026-03-13T01:00:00Z".into());
        first_seen.insert("case:2".into(), "2026-03-12T23:59:59Z".into());
        assert_eq!(compute_created_today_count(&first_seen, "2026-03-13"), 1);
    }
}
