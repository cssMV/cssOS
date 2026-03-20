use axum::{extract::State, response::IntoResponse, Json};

use crate::css_policy_engine::runtime as policy_runtime;
use crate::css_signals_cache::types::CacheSubjectKind;
use crate::css_signals_hub::types::SignalKind;
use crate::css_trust_api::types::{
    CatalogTrustView, DealTrustView, GetCatalogTrustRequest, GetDealTrustRequest,
    GetOwnershipTrustRequest, GetUserTrustRequest, OwnershipTrustView, TrustPenaltyView,
    TrustResponse, TrustRiskLevel, TrustSubjectKind, UserTrustView,
};
use crate::routes::AppState;

fn derive_risk_level(
    low_credit_warning: bool,
    high_risk: bool,
    review_required: bool,
    restricted: bool,
    frozen: bool,
) -> TrustRiskLevel {
    use TrustRiskLevel::*;

    if frozen {
        Frozen
    } else if review_required {
        ReviewRequired
    } else if restricted {
        Restricted
    } else if high_risk {
        HighRisk
    } else if low_credit_warning {
        LowCreditWarning
    } else {
        Normal
    }
}

pub async fn get_user_trust_inner(
    pool: &sqlx::PgPool,
    req: GetUserTrustRequest,
) -> anyhow::Result<TrustResponse<UserTrustView>> {
    let bundle = policy_runtime::get_policy_bundle();
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
        policy_runtime::credit_initial_score(),
    )
    .await?;
    let profile =
        crate::css_reputation_engine::store_pg::get_or_create_profile(pool, &req.user_id).await?;
    let penalties =
        crate::css_reputation_engine::store_pg::list_active_penalties(pool, &req.user_id)
            .await
            .unwrap_or_default();

    let low_credit_warning = signals
        .signals
        .iter()
        .any(|signal| matches!(signal.signal_kind, SignalKind::CreditLow));
    let high_risk = signals
        .signals
        .iter()
        .any(|signal| matches!(signal.signal_kind, SignalKind::CreditHighRisk));
    let restricted = signals.signals.iter().any(|signal| {
        matches!(
            signal.signal_kind,
            SignalKind::Restricted | SignalKind::CreditRestricted
        )
    }) || penalties.iter().any(|penalty| {
        let kind = format!("{:?}", penalty.kind).to_lowercase();
        kind.contains("disable") || credit.score < bundle.credit.restrict_threshold
    });
    let review_required = signals
        .signals
        .iter()
        .any(|signal| matches!(signal.signal_kind, SignalKind::ReviewRequired));
    let frozen = signals
        .signals
        .iter()
        .any(|signal| matches!(signal.signal_kind, SignalKind::Frozen))
        || matches!(
            profile.level,
            crate::css_reputation_engine::types::ReputationLevel::Suspended
        );
    let open_dispute_count = signals
        .signals
        .iter()
        .find(|signal| matches!(signal.signal_kind, SignalKind::OpenDisputes))
        .and_then(|signal| {
            signal
                .description
                .split_whitespace()
                .find_map(|part| part.parse::<i32>().ok())
        })
        .unwrap_or_default();

    let risk_level = derive_risk_level(
        low_credit_warning,
        high_risk,
        review_required,
        restricted,
        frozen,
    );

    Ok(TrustResponse {
        subject_kind: TrustSubjectKind::User,
        data: UserTrustView {
            user_id: req.user_id,
            credit_score: credit.score,
            low_credit_warning,
            high_risk,
            review_required,
            restricted,
            frozen,
            active_penalties: penalties
                .into_iter()
                .map(|penalty| TrustPenaltyView {
                    kind: format!("{:?}", penalty.kind).to_lowercase(),
                    reason: penalty.reason,
                    ends_at: penalty.ends_at,
                })
                .collect(),
            open_dispute_count,
            risk_level,
        },
    })
}

pub async fn get_catalog_trust_inner(
    pool: &sqlx::PgPool,
    req: GetCatalogTrustRequest,
) -> anyhow::Result<TrustResponse<CatalogTrustView>> {
    let entry =
        crate::css_catalog_engine::store_pg::get_catalog_entry(pool, &req.catalog_id).await?;
    let owner_trust = get_user_trust_inner(
        pool,
        GetUserTrustRequest {
            user_id: entry.owner_user_id.clone(),
        },
    )
    .await?;

    let review_required = matches!(
        owner_trust.data.risk_level,
        TrustRiskLevel::ReviewRequired | TrustRiskLevel::Frozen
    );
    let frozen = matches!(owner_trust.data.risk_level, TrustRiskLevel::Frozen);
    let risk_level = derive_risk_level(
        owner_trust.data.low_credit_warning,
        owner_trust.data.high_risk,
        review_required,
        owner_trust.data.restricted,
        frozen,
    );

    Ok(TrustResponse {
        subject_kind: TrustSubjectKind::Catalog,
        data: CatalogTrustView {
            catalog_id: req.catalog_id,
            owner_user_id: Some(entry.owner_user_id),
            owner_low_credit_warning: owner_trust.data.low_credit_warning,
            owner_high_risk: owner_trust.data.high_risk,
            review_required,
            frozen,
            risk_level,
        },
    })
}

pub async fn get_deal_trust_inner(
    pool: &sqlx::PgPool,
    req: GetDealTrustRequest,
) -> anyhow::Result<TrustResponse<DealTrustView>> {
    let deal = crate::css_deal_engine::store_pg::get_deal(pool, &req.deal_id).await?;
    let buyer_trust = get_user_trust_inner(
        pool,
        GetUserTrustRequest {
            user_id: deal.buyer_user_id.clone(),
        },
    )
    .await?;

    let review_required = matches!(
        buyer_trust.data.risk_level,
        TrustRiskLevel::ReviewRequired | TrustRiskLevel::Frozen
    );
    let frozen = matches!(buyer_trust.data.risk_level, TrustRiskLevel::Frozen);
    let risk_level = derive_risk_level(
        buyer_trust.data.low_credit_warning,
        buyer_trust.data.high_risk,
        review_required,
        buyer_trust.data.restricted,
        frozen,
    );

    Ok(TrustResponse {
        subject_kind: TrustSubjectKind::Deal,
        data: DealTrustView {
            deal_id: req.deal_id,
            buyer_user_id: Some(deal.buyer_user_id),
            seller_user_id: Some(deal.seller_user_id),
            review_required,
            high_risk: buyer_trust.data.high_risk,
            frozen,
            risk_level,
        },
    })
}

pub async fn get_ownership_trust_inner(
    pool: &sqlx::PgPool,
    req: GetOwnershipTrustRequest,
) -> anyhow::Result<TrustResponse<OwnershipTrustView>> {
    let ownership =
        crate::css_ownership_engine::store_pg::get_ownership(pool, &req.ownership_id).await?;
    let owner_trust = get_user_trust_inner(
        pool,
        GetUserTrustRequest {
            user_id: ownership.owner_user_id.clone(),
        },
    )
    .await?;

    let risk_level = derive_risk_level(
        owner_trust.data.low_credit_warning,
        owner_trust.data.high_risk,
        owner_trust.data.review_required,
        owner_trust.data.restricted,
        owner_trust.data.frozen,
    );

    Ok(TrustResponse {
        subject_kind: TrustSubjectKind::Ownership,
        data: OwnershipTrustView {
            ownership_id: req.ownership_id,
            owner_user_id: Some(ownership.owner_user_id),
            owner_low_credit_warning: owner_trust.data.low_credit_warning,
            owner_high_risk: owner_trust.data.high_risk,
            restricted: owner_trust.data.restricted,
            risk_level,
        },
    })
}

pub async fn get_user_trust_http(
    State(state): State<AppState>,
    Json(req): Json<GetUserTrustRequest>,
) -> axum::response::Response {
    match get_user_trust_inner(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "code": "get_user_trust_failed",
                "message": err.to_string(),
            })),
        )
            .into_response(),
    }
}

pub async fn get_catalog_trust_http(
    State(state): State<AppState>,
    Json(req): Json<GetCatalogTrustRequest>,
) -> axum::response::Response {
    match get_catalog_trust_inner(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "code": "get_catalog_trust_failed",
                "message": err.to_string(),
            })),
        )
            .into_response(),
    }
}

pub async fn get_deal_trust_http(
    State(state): State<AppState>,
    Json(req): Json<GetDealTrustRequest>,
) -> axum::response::Response {
    match get_deal_trust_inner(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "code": "get_deal_trust_failed",
                "message": err.to_string(),
            })),
        )
            .into_response(),
    }
}

pub async fn get_ownership_trust_http(
    State(state): State<AppState>,
    Json(req): Json<GetOwnershipTrustRequest>,
) -> axum::response::Response {
    match get_ownership_trust_inner(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "code": "get_ownership_trust_failed",
                "message": err.to_string(),
            })),
        )
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::derive_risk_level;
    use crate::css_trust_api::types::TrustRiskLevel;

    #[test]
    fn v178_risk_level_prioritizes_frozen() {
        assert_eq!(
            derive_risk_level(true, true, true, true, true),
            TrustRiskLevel::Frozen
        );
    }

    #[test]
    fn v178_risk_level_prioritizes_review_required_over_restricted() {
        assert_eq!(
            derive_risk_level(true, true, true, true, false),
            TrustRiskLevel::ReviewRequired
        );
    }
}
