use axum::{extract::State, response::IntoResponse, Json};

use crate::css_explain_api::types::{
    ExplainAudience, ExplainByAuditRequest, ExplainByReviewRequest, ExplainBySubjectRequest,
    ExplainResponse,
};
use crate::css_governance_timeline::types::TimelineSubjectKind;
use crate::routes::AppState;

fn subject_kind_from_str(value: &str) -> TimelineSubjectKind {
    match value {
        "catalog" => TimelineSubjectKind::Catalog,
        "auction" => TimelineSubjectKind::Auction,
        "deal" => TimelineSubjectKind::Deal,
        "ownership" => TimelineSubjectKind::Ownership,
        _ => TimelineSubjectKind::User,
    }
}

pub async fn explain_by_audit_inner(
    pool: &sqlx::PgPool,
    req: ExplainByAuditRequest,
) -> anyhow::Result<ExplainResponse> {
    let audit = crate::css_rule_audit::store_pg::get_rule_audit(pool, &req.audit_id).await?;
    let subject_kind = subject_kind_from_str(&audit.subject_kind);

    match req.audience {
        ExplainAudience::Operator => {
            let view = crate::css_reasoning_view::runtime::build_operator_reasoning(
                pool,
                &req.audit_id,
                subject_kind,
                &audit.subject_id,
            )
            .await?;

            Ok(ExplainResponse {
                audience: req.audience,
                summary: view.summary,
                reasons: view
                    .reasons
                    .into_iter()
                    .map(|item| item.explanation)
                    .collect(),
                outcomes: view
                    .outcomes
                    .into_iter()
                    .map(|item| item.description)
                    .collect(),
                suggested_actions: view
                    .suggested_actions
                    .into_iter()
                    .map(|item| item.description)
                    .collect(),
                rule_audit_id: Some(req.audit_id),
                review_id: None,
                subject_kind: Some(audit.subject_kind),
                subject_id: Some(audit.subject_id),
            })
        }
        ExplainAudience::User => {
            let view = crate::css_reasoning_view::runtime::build_user_reasoning(
                pool,
                &req.audit_id,
                subject_kind,
                &audit.subject_id,
            )
            .await?;

            Ok(ExplainResponse {
                audience: req.audience,
                summary: view.summary,
                reasons: view
                    .reasons
                    .into_iter()
                    .map(|item| item.explanation)
                    .collect(),
                outcomes: view
                    .outcomes
                    .into_iter()
                    .map(|item| item.description)
                    .collect(),
                suggested_actions: view
                    .suggested_actions
                    .into_iter()
                    .map(|item| item.description)
                    .collect(),
                rule_audit_id: Some(req.audit_id),
                review_id: None,
                subject_kind: Some(audit.subject_kind),
                subject_id: Some(audit.subject_id),
            })
        }
        ExplainAudience::Api => {
            let view = crate::css_reasoning_view::runtime::build_api_reasoning(pool, &req.audit_id)
                .await?;

            Ok(ExplainResponse {
                audience: req.audience,
                summary: view.summary,
                reasons: view.reason_keys,
                outcomes: view.outcome_labels,
                suggested_actions: view.suggested_action_labels,
                rule_audit_id: Some(req.audit_id),
                review_id: None,
                subject_kind: Some(audit.subject_kind),
                subject_id: Some(audit.subject_id),
            })
        }
    }
}

pub async fn explain_by_review_inner(
    pool: &sqlx::PgPool,
    req: ExplainByReviewRequest,
) -> anyhow::Result<ExplainResponse> {
    let review = crate::css_review_queue::store_pg::get_review_item(pool, &req.review_id).await?;

    Ok(ExplainResponse {
        audience: req.audience,
        summary: review.reason.clone(),
        reasons: vec![review.reason.clone()],
        outcomes: vec![format!(
            "当前审核状态：{}",
            format!("{:?}", review.status).to_lowercase()
        )],
        suggested_actions: vec![],
        rule_audit_id: None,
        review_id: Some(review.review_id),
        subject_kind: Some(format!("{:?}", review.subject_kind).to_lowercase()),
        subject_id: Some(review.subject_id),
    })
}

pub async fn explain_by_subject_inner(
    pool: &sqlx::PgPool,
    req: ExplainBySubjectRequest,
) -> anyhow::Result<ExplainResponse> {
    let audits = crate::css_rule_audit::store_pg::list_rule_audits_for_subject(
        pool,
        &req.subject_kind,
        &req.subject_id,
    )
    .await?;

    if let Some(audit) = audits.first() {
        return explain_by_audit_inner(
            pool,
            ExplainByAuditRequest {
                audit_id: audit.audit_id.clone(),
                audience: req.audience,
            },
        )
        .await;
    }

    let summary = format!(
        "当前 subject {}:{} 暂无可用规则审计解释。",
        req.subject_kind, req.subject_id
    );

    Ok(ExplainResponse {
        audience: req.audience,
        summary: summary.clone(),
        reasons: vec![summary],
        outcomes: vec![],
        suggested_actions: vec![],
        rule_audit_id: None,
        review_id: None,
        subject_kind: Some(req.subject_kind),
        subject_id: Some(req.subject_id),
    })
}

pub async fn explain_by_audit_http(
    State(state): State<AppState>,
    Json(req): Json<ExplainByAuditRequest>,
) -> axum::response::Response {
    match explain_by_audit_inner(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "code": "explain_by_audit_failed",
                "message": err.to_string(),
            })),
        )
            .into_response(),
    }
}

pub async fn explain_by_review_http(
    State(state): State<AppState>,
    Json(req): Json<ExplainByReviewRequest>,
) -> axum::response::Response {
    match explain_by_review_inner(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "code": "explain_by_review_failed",
                "message": err.to_string(),
            })),
        )
            .into_response(),
    }
}

pub async fn explain_by_subject_http(
    State(state): State<AppState>,
    Json(req): Json<ExplainBySubjectRequest>,
) -> axum::response::Response {
    match explain_by_subject_inner(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "code": "explain_by_subject_failed",
                "message": err.to_string(),
            })),
        )
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use crate::css_explain_api::types::ExplainAudience;

    #[test]
    fn v177_subject_fallback_summary_mentions_missing_audit() {
        let resp = super::ExplainResponse {
            audience: ExplainAudience::Api,
            summary: "当前 subject catalog:cat_1 暂无可用规则审计解释。".into(),
            reasons: vec!["当前 subject catalog:cat_1 暂无可用规则审计解释。".into()],
            outcomes: vec![],
            suggested_actions: vec![],
            rule_audit_id: None,
            review_id: None,
            subject_kind: Some("catalog".into()),
            subject_id: Some("cat_1".into()),
        };

        assert!(resp.summary.contains("catalog:cat_1"));
    }
}
