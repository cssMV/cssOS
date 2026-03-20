use axum::{extract::State, response::IntoResponse, Json};

use crate::css_risk_api::types::{
    CatalogRiskView, DealRiskView, GetCatalogRiskRequest, GetDealRiskRequest,
    GetOwnershipRiskRequest, GetUserRiskRequest, OwnershipRiskView, RiskFactorItem, RiskResponse,
    RiskSeverity, RiskSourceKind, RiskSubjectKind, UserRiskView,
};
use crate::css_signals_cache::types::CacheSubjectKind;
use crate::css_signals_hub::types::SignalKind;
use crate::routes::AppState;

fn has_high_or_critical(factors: &[RiskFactorItem]) -> bool {
    factors
        .iter()
        .any(|factor| matches!(factor.severity, RiskSeverity::High | RiskSeverity::Critical))
}

fn has_review_required(factors: &[RiskFactorItem]) -> bool {
    factors.iter().any(|factor| {
        matches!(
            factor.source_kind,
            RiskSourceKind::ReviewRequired | RiskSourceKind::HighValueDeal
        )
    })
}

pub async fn get_user_risk_inner(
    pool: &sqlx::PgPool,
    req: GetUserRiskRequest,
) -> anyhow::Result<RiskResponse<UserRiskView>> {
    let bundle = crate::css_policy_engine::runtime::get_policy_bundle();
    let signals = crate::css_signals_cache::runtime::get_or_refresh(
        pool,
        CacheSubjectKind::User,
        &req.user_id,
        &chrono::Utc::now().to_rfc3339(),
    )
    .await?
    .entry
    .signals_bundle;
    let (credit, _) = crate::css_governance_timeline::store_pg::get_or_create_credit_profile(
        pool,
        &req.user_id,
        crate::css_policy_engine::runtime::credit_initial_score(),
    )
    .await?;

    let mut factors = Vec::new();

    if signals
        .signals
        .iter()
        .any(|signal| matches!(signal.signal_kind, SignalKind::CreditLow))
    {
        factors.push(RiskFactorItem {
            source_kind: RiskSourceKind::LowCredit,
            severity: if credit.score < bundle.credit.high_risk_threshold {
                RiskSeverity::High
            } else {
                RiskSeverity::Medium
            },
            title: "信用分偏低".into(),
            explanation: format!("当前信用分为 {}。", credit.score),
        });
    }

    if signals
        .signals
        .iter()
        .any(|signal| matches!(signal.signal_kind, SignalKind::ActivePenalty))
    {
        factors.push(RiskFactorItem {
            source_kind: RiskSourceKind::ActivePenalty,
            severity: RiskSeverity::High,
            title: "存在活跃处罚".into(),
            explanation: "当前用户存在生效中的处罚。".into(),
        });
    }

    let dispute_count = signals
        .signals
        .iter()
        .find(|signal| matches!(signal.signal_kind, SignalKind::OpenDisputes))
        .and_then(|signal| {
            signal
                .description
                .split_whitespace()
                .find_map(|part| part.parse::<usize>().ok())
        })
        .unwrap_or_default();
    if dispute_count >= 3 {
        factors.push(RiskFactorItem {
            source_kind: RiskSourceKind::TooManyOpenDisputes,
            severity: RiskSeverity::High,
            title: "未关闭争议过多".into(),
            explanation: format!("当前存在 {} 个未关闭争议。", dispute_count),
        });
    }

    if signals
        .signals
        .iter()
        .any(|signal| matches!(signal.signal_kind, SignalKind::ReviewRequired))
    {
        factors.push(RiskFactorItem {
            source_kind: RiskSourceKind::ReviewRequired,
            severity: RiskSeverity::High,
            title: "需要人工复核".into(),
            explanation: "争议数量已达到人工复核阈值。".into(),
        });
    }

    let overall_high_risk = has_high_or_critical(&factors);
    let overall_review_required = has_review_required(&factors);

    Ok(RiskResponse {
        subject_kind: RiskSubjectKind::User,
        data: UserRiskView {
            user_id: req.user_id,
            overall_high_risk,
            overall_review_required,
            factors,
        },
    })
}

pub async fn get_catalog_risk_inner(
    pool: &sqlx::PgPool,
    req: GetCatalogRiskRequest,
) -> anyhow::Result<RiskResponse<CatalogRiskView>> {
    let entry =
        crate::css_catalog_engine::store_pg::get_catalog_entry(pool, &req.catalog_id).await?;
    let owner_user_id = entry.owner_user_id.clone();
    let owner_risk = get_user_risk_inner(
        pool,
        GetUserRiskRequest {
            user_id: owner_user_id.clone(),
        },
    )
    .await?;

    let mut factors = owner_risk.data.factors;
    let owner_disputes =
        crate::css_dispute_engine::store_pg::list_open_disputes_for_user(pool, &owner_user_id)
            .await
            .unwrap_or_default();

    let has_owner_behavior_issue = owner_disputes.iter().any(|dispute| {
        matches!(
            dispute.kind,
            crate::css_dispute_engine::types::DisputeKind::SelfBidding
                | crate::css_dispute_engine::types::DisputeKind::SelfAutoBidding
                | crate::css_dispute_engine::types::DisputeKind::SuspiciousPriceManipulation
        )
    });

    if has_owner_behavior_issue {
        factors.push(RiskFactorItem {
            source_kind: RiskSourceKind::OwnerBehaviorAnomaly,
            severity: RiskSeverity::Critical,
            title: "owner 行为异常".into(),
            explanation: "当前 owner 存在自竞拍或价格操纵相关风险信号。".into(),
        });
    }

    let overall_high_risk = has_high_or_critical(&factors);
    let overall_review_required = has_review_required(&factors);

    Ok(RiskResponse {
        subject_kind: RiskSubjectKind::Catalog,
        data: CatalogRiskView {
            catalog_id: req.catalog_id,
            owner_user_id: Some(owner_user_id),
            overall_high_risk,
            overall_review_required,
            factors,
        },
    })
}

pub async fn get_deal_risk_inner(
    pool: &sqlx::PgPool,
    req: GetDealRiskRequest,
) -> anyhow::Result<RiskResponse<DealRiskView>> {
    let deal = crate::css_deal_engine::store_pg::get_deal(pool, &req.deal_id).await?;
    let bundle = crate::css_policy_engine::runtime::get_policy_bundle();
    let buyer_risk = get_user_risk_inner(
        pool,
        GetUserRiskRequest {
            user_id: deal.buyer_user_id.clone(),
        },
    )
    .await?;

    let mut factors = buyer_risk.data.factors;
    if deal.price_cents >= bundle.commerce.high_value_trade_cents {
        factors.push(RiskFactorItem {
            source_kind: RiskSourceKind::HighValueDeal,
            severity: RiskSeverity::High,
            title: "高额交易".into(),
            explanation: format!("当前交易金额 {} 命中高额交易阈值。", deal.price_cents),
        });
    }

    let overall_high_risk = has_high_or_critical(&factors);
    let overall_review_required = has_review_required(&factors);

    Ok(RiskResponse {
        subject_kind: RiskSubjectKind::Deal,
        data: DealRiskView {
            deal_id: req.deal_id,
            buyer_user_id: Some(deal.buyer_user_id),
            seller_user_id: Some(deal.seller_user_id),
            overall_high_risk,
            overall_review_required,
            factors,
        },
    })
}

pub async fn get_ownership_risk_inner(
    pool: &sqlx::PgPool,
    req: GetOwnershipRiskRequest,
) -> anyhow::Result<RiskResponse<OwnershipRiskView>> {
    let ownership =
        crate::css_ownership_engine::store_pg::get_ownership(pool, &req.ownership_id).await?;
    let owner_risk = get_user_risk_inner(
        pool,
        GetUserRiskRequest {
            user_id: ownership.owner_user_id.clone(),
        },
    )
    .await?;

    Ok(RiskResponse {
        subject_kind: RiskSubjectKind::Ownership,
        data: OwnershipRiskView {
            ownership_id: req.ownership_id,
            owner_user_id: Some(ownership.owner_user_id),
            overall_high_risk: owner_risk.data.overall_high_risk,
            overall_review_required: owner_risk.data.overall_review_required,
            factors: owner_risk.data.factors,
        },
    })
}

pub async fn get_user_risk_http(
    State(state): State<AppState>,
    Json(req): Json<GetUserRiskRequest>,
) -> axum::response::Response {
    match get_user_risk_inner(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "code": "get_user_risk_failed",
                "message": err.to_string(),
            })),
        )
            .into_response(),
    }
}

pub async fn get_catalog_risk_http(
    State(state): State<AppState>,
    Json(req): Json<GetCatalogRiskRequest>,
) -> axum::response::Response {
    match get_catalog_risk_inner(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "code": "get_catalog_risk_failed",
                "message": err.to_string(),
            })),
        )
            .into_response(),
    }
}

pub async fn get_deal_risk_http(
    State(state): State<AppState>,
    Json(req): Json<GetDealRiskRequest>,
) -> axum::response::Response {
    match get_deal_risk_inner(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "code": "get_deal_risk_failed",
                "message": err.to_string(),
            })),
        )
            .into_response(),
    }
}

pub async fn get_ownership_risk_http(
    State(state): State<AppState>,
    Json(req): Json<GetOwnershipRiskRequest>,
) -> axum::response::Response {
    match get_ownership_risk_inner(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "code": "get_ownership_risk_failed",
                "message": err.to_string(),
            })),
        )
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::{has_high_or_critical, has_review_required};
    use crate::css_risk_api::types::{RiskFactorItem, RiskSeverity, RiskSourceKind};

    #[test]
    fn v179_high_or_critical_detects_high_factor() {
        let factors = vec![RiskFactorItem {
            source_kind: RiskSourceKind::LowCredit,
            severity: RiskSeverity::High,
            title: "x".into(),
            explanation: "x".into(),
        }];
        assert!(has_high_or_critical(&factors));
    }

    #[test]
    fn v179_review_required_detects_high_value_deal() {
        let factors = vec![RiskFactorItem {
            source_kind: RiskSourceKind::HighValueDeal,
            severity: RiskSeverity::High,
            title: "x".into(),
            explanation: "x".into(),
        }];
        assert!(has_review_required(&factors));
    }
}
