use crate::css_case_action_log::types::{CaseActionLogKind, CssCaseActionLogRecord};
use crate::css_case_query_engine::types::{
    CaseQueryRequest, CaseQueryResponse, CaseQueryRiskLevel, CaseQueryRow, CaseQuerySortBy,
    CaseQuerySortOrder, CaseQueryStatusKind, CaseQuerySubjectKind,
};
use crate::css_resolution_log::types::{
    CssResolutionLogRecord, ResolutionLogStatus, ResolutionLogSubjectKind,
};

fn subject_kind_to_summary_kind(
    kind: &CaseQuerySubjectKind,
) -> crate::css_case_summary_engine::types::CaseSummarySubjectKind {
    match kind {
        CaseQuerySubjectKind::User => {
            crate::css_case_summary_engine::types::CaseSummarySubjectKind::User
        }
        CaseQuerySubjectKind::Catalog => {
            crate::css_case_summary_engine::types::CaseSummarySubjectKind::Catalog
        }
        CaseQuerySubjectKind::Deal => {
            crate::css_case_summary_engine::types::CaseSummarySubjectKind::Deal
        }
        CaseQuerySubjectKind::Ownership => {
            crate::css_case_summary_engine::types::CaseSummarySubjectKind::Ownership
        }
    }
}

fn risk_level_rank(level: &Option<CaseQueryRiskLevel>) -> i32 {
    match level {
        Some(CaseQueryRiskLevel::Low) => 1,
        Some(CaseQueryRiskLevel::Medium) => 2,
        Some(CaseQueryRiskLevel::High) => 3,
        Some(CaseQueryRiskLevel::Critical) => 4,
        None => 0,
    }
}

fn status_label(status: &CaseQueryStatusKind) -> String {
    match status {
        CaseQueryStatusKind::Open => "处理中".into(),
        CaseQueryStatusKind::Resolved => "已解决".into(),
        CaseQueryStatusKind::Dismissed => "已驳回".into(),
        CaseQueryStatusKind::Released => "已释放".into(),
        CaseQueryStatusKind::EscalatedToManual => "已升级人工处理".into(),
        CaseQueryStatusKind::FrozenUntilReview => "冻结待复核".into(),
    }
}

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

fn derive_action_flags(
    logs: &[CssCaseActionLogRecord],
) -> (Option<String>, bool, bool, bool, Option<String>) {
    let actor_user_id = logs.last().map(|log| log.actor_user_id.clone());
    let has_review = logs
        .iter()
        .any(|log| matches!(log.action, CaseActionLogKind::RequireReview));
    let has_freeze = logs
        .iter()
        .any(|log| matches!(log.action, CaseActionLogKind::Freeze));
    let has_escalate = logs
        .iter()
        .any(|log| matches!(log.action, CaseActionLogKind::Escalate));
    let updated_at = logs.last().map(|log| log.created_at.clone());

    (
        actor_user_id,
        has_review,
        has_freeze,
        has_escalate,
        updated_at,
    )
}

fn row_from_resolution_log(log: &CssResolutionLogRecord) -> CaseQueryRow {
    let subject_kind = match log.subject_kind {
        ResolutionLogSubjectKind::User => CaseQuerySubjectKind::User,
        ResolutionLogSubjectKind::Catalog => CaseQuerySubjectKind::Catalog,
        ResolutionLogSubjectKind::Deal => CaseQuerySubjectKind::Deal,
        ResolutionLogSubjectKind::Ownership => CaseQuerySubjectKind::Ownership,
    };

    let status = match log.status {
        ResolutionLogStatus::Open => CaseQueryStatusKind::Open,
        ResolutionLogStatus::Resolved => CaseQueryStatusKind::Resolved,
        ResolutionLogStatus::Dismissed => CaseQueryStatusKind::Dismissed,
        ResolutionLogStatus::Released => CaseQueryStatusKind::Released,
        ResolutionLogStatus::EscalatedToManual => CaseQueryStatusKind::EscalatedToManual,
        ResolutionLogStatus::FrozenUntilReview => CaseQueryStatusKind::FrozenUntilReview,
    };

    CaseQueryRow {
        case_id: log.case_id.clone(),
        subject_kind,
        subject_id: log.subject_id.clone(),
        status: status.clone(),
        status_label: status_label(&status),
        risk_level: None,
        is_closed_like: log.is_closed_like,
        actor_user_id: Some(log.actor_user_id.clone()),
        updated_at: Some(log.created_at.clone()),
        has_review: false,
        has_freeze: false,
        has_escalate: false,
        one_line_summary: None,
    }
}

async fn load_risk_json(
    pool: &sqlx::PgPool,
    row: &CaseQueryRow,
) -> anyhow::Result<serde_json::Value> {
    match row.subject_kind {
        CaseQuerySubjectKind::User => serde_json::to_value(
            crate::css_risk_api::handlers::get_user_risk_inner(
                pool,
                crate::css_risk_api::types::GetUserRiskRequest {
                    user_id: row.subject_id.clone(),
                },
            )
            .await?,
        )
        .map_err(Into::into),
        CaseQuerySubjectKind::Catalog => serde_json::to_value(
            crate::css_risk_api::handlers::get_catalog_risk_inner(
                pool,
                crate::css_risk_api::types::GetCatalogRiskRequest {
                    catalog_id: row.subject_id.clone(),
                },
            )
            .await?,
        )
        .map_err(Into::into),
        CaseQuerySubjectKind::Deal => serde_json::to_value(
            crate::css_risk_api::handlers::get_deal_risk_inner(
                pool,
                crate::css_risk_api::types::GetDealRiskRequest {
                    deal_id: row.subject_id.clone(),
                },
            )
            .await?,
        )
        .map_err(Into::into),
        CaseQuerySubjectKind::Ownership => serde_json::to_value(
            crate::css_risk_api::handlers::get_ownership_risk_inner(
                pool,
                crate::css_risk_api::types::GetOwnershipRiskRequest {
                    ownership_id: row.subject_id.clone(),
                },
            )
            .await?,
        )
        .map_err(Into::into),
    }
}

pub async fn build_case_query_row(
    pool: &sqlx::PgPool,
    latest_resolution: &CssResolutionLogRecord,
) -> anyhow::Result<CaseQueryRow> {
    let mut row = row_from_resolution_log(latest_resolution);

    let logs = crate::css_case_action_log::runtime::list_case_logs(pool, &row.case_id)
        .await
        .unwrap_or_default();
    let (actor_user_id, has_review, has_freeze, has_escalate, updated_at) =
        derive_action_flags(&logs);

    row.actor_user_id = actor_user_id.or(row.actor_user_id);
    row.has_review = has_review;
    row.has_freeze = has_freeze;
    row.has_escalate = has_escalate;
    row.updated_at = updated_at.or(row.updated_at);

    let risk_json = load_risk_json(pool, &row).await?;
    row.risk_level = risk_level_from_risk_json(&risk_json);

    let summary = crate::css_case_summary_engine::runtime::build_case_summary(
        pool,
        crate::css_case_summary_engine::types::CaseSummaryRequest {
            case_id: row.case_id.clone(),
            subject_kind: subject_kind_to_summary_kind(&row.subject_kind),
            subject_id: row.subject_id.clone(),
        },
    )
    .await?;

    row.one_line_summary = Some(summary.one_line);
    Ok(row)
}

pub async fn query_cases(
    pool: &sqlx::PgPool,
    req: CaseQueryRequest,
) -> anyhow::Result<CaseQueryResponse> {
    let latest_logs = crate::css_resolution_log::store_pg::list_latest_resolution_logs(pool)
        .await
        .unwrap_or_default();
    let mut rows = Vec::new();

    for log in latest_logs {
        let row = build_case_query_row(pool, &log).await?;

        if let Some(status) = &req.status {
            if !crate::css_case_query_engine::filters::status_matches(&row, status) {
                continue;
            }
        }

        if let Some(subject_kind) = &req.subject_kind {
            if !crate::css_case_query_engine::filters::subject_kind_matches(&row, subject_kind) {
                continue;
            }
        }

        if let Some(risk_level) = &req.risk_level {
            if !crate::css_case_query_engine::filters::risk_level_matches(&row, risk_level) {
                continue;
            }
        }

        if !crate::css_case_query_engine::filters::bool_matches(row.is_closed_like, req.closed_like)
        {
            continue;
        }

        if let Some(actor_user_id) = &req.actor_user_id {
            if !crate::css_case_query_engine::filters::actor_matches(&row, actor_user_id) {
                continue;
            }
        }

        if !crate::css_case_query_engine::filters::bool_matches(row.has_review, req.has_review) {
            continue;
        }

        if !crate::css_case_query_engine::filters::bool_matches(row.has_freeze, req.has_freeze) {
            continue;
        }

        if !crate::css_case_query_engine::filters::bool_matches(row.has_escalate, req.has_escalate)
        {
            continue;
        }

        if let Some(updated_after) = &req.updated_after {
            if row.updated_at.as_deref().unwrap_or("") < updated_after.as_str() {
                continue;
            }
        }

        if let Some(updated_before) = &req.updated_before {
            if row.updated_at.as_deref().unwrap_or("") > updated_before.as_str() {
                continue;
            }
        }

        rows.push(row);
    }

    match req.sort_by.unwrap_or(CaseQuerySortBy::UpdatedAt) {
        CaseQuerySortBy::UpdatedAt => rows.sort_by(|a, b| a.updated_at.cmp(&b.updated_at)),
        CaseQuerySortBy::Status => rows.sort_by(|a, b| a.status_label.cmp(&b.status_label)),
        CaseQuerySortBy::RiskLevel => {
            rows.sort_by(|a, b| risk_level_rank(&a.risk_level).cmp(&risk_level_rank(&b.risk_level)))
        }
    }

    if matches!(req.sort_order, Some(CaseQuerySortOrder::Desc) | None) {
        rows.reverse();
    }

    let total = rows.len();
    let offset = req.offset.unwrap_or(0);
    let limit = req.limit.unwrap_or(50);
    let rows = rows.into_iter().skip(offset).take(limit).collect();

    Ok(CaseQueryResponse { total, rows })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::css_case_query_engine::types::CaseQueryRiskLevel;

    #[test]
    fn v201_derive_action_flags_detects_review_freeze_and_escalate() {
        let logs = vec![
            CssCaseActionLogRecord {
                log_id: "1".into(),
                case_id: "case:deal:deal_1".into(),
                subject_kind: crate::css_case_action_log::types::CaseActionLogSubjectKind::Deal,
                subject_id: "deal_1".into(),
                action: CaseActionLogKind::RequireReview,
                actor_user_id: "op_1".into(),
                reason: "reason".into(),
                accepted: true,
                result_message: "ok".into(),
                review_id: Some("rev_1".into()),
                created_at: "2026-03-13T00:00:00Z".into(),
            },
            CssCaseActionLogRecord {
                log_id: "2".into(),
                case_id: "case:deal:deal_1".into(),
                subject_kind: crate::css_case_action_log::types::CaseActionLogSubjectKind::Deal,
                subject_id: "deal_1".into(),
                action: CaseActionLogKind::Escalate,
                actor_user_id: "op_2".into(),
                reason: "reason".into(),
                accepted: true,
                result_message: "ok".into(),
                review_id: Some("rev_1".into()),
                created_at: "2026-03-13T01:00:00Z".into(),
            },
            CssCaseActionLogRecord {
                log_id: "3".into(),
                case_id: "case:deal:deal_1".into(),
                subject_kind: crate::css_case_action_log::types::CaseActionLogSubjectKind::Deal,
                subject_id: "deal_1".into(),
                action: CaseActionLogKind::Freeze,
                actor_user_id: "op_3".into(),
                reason: "reason".into(),
                accepted: true,
                result_message: "ok".into(),
                review_id: Some("rev_1".into()),
                created_at: "2026-03-13T02:00:00Z".into(),
            },
        ];

        let (actor, has_review, has_freeze, has_escalate, updated_at) = derive_action_flags(&logs);
        assert_eq!(actor.as_deref(), Some("op_3"));
        assert!(has_review);
        assert!(has_freeze);
        assert!(has_escalate);
        assert_eq!(updated_at.as_deref(), Some("2026-03-13T02:00:00Z"));
    }

    #[test]
    fn v201_risk_level_from_json_uses_highest_factor_severity() {
        let value = serde_json::json!({
            "data": {
                "factors": [
                    {"severity": "medium"},
                    {"severity": "critical"}
                ]
            }
        });

        assert_eq!(
            risk_level_from_risk_json(&value),
            Some(CaseQueryRiskLevel::Critical)
        );
    }
}
