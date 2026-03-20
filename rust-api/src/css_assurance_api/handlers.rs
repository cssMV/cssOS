use axum::{extract::State, response::IntoResponse, Json};

use crate::css_assurance_api::types::{
    AssuranceMeasureKind, AssuranceMeasureView, AssuranceResponse, AssuranceSubjectKind,
    CatalogAssuranceView, DealAssuranceView, GetCatalogAssuranceRequest, GetDealAssuranceRequest,
    GetOwnershipAssuranceRequest, GetUserAssuranceRequest, OwnershipAssuranceView,
    UserAssuranceView,
};
use crate::css_risk_api::types::RiskSourceKind;
use crate::css_signals_cache::types::CacheSubjectKind;
use crate::css_signals_hub::types::SignalKind;
use crate::routes::AppState;

pub async fn get_user_assurance_inner(
    pool: &sqlx::PgPool,
    req: GetUserAssuranceRequest,
) -> anyhow::Result<AssuranceResponse<UserAssuranceView>> {
    let signals = crate::css_signals_cache::runtime::get_or_refresh(
        pool,
        CacheSubjectKind::User,
        &req.user_id,
        &chrono::Utc::now().to_rfc3339(),
    )
    .await?
    .entry
    .signals_bundle;
    let trust = crate::css_trust_api::handlers::get_user_trust_inner(
        pool,
        crate::css_trust_api::types::GetUserTrustRequest {
            user_id: req.user_id.clone(),
        },
    )
    .await?;
    let risk = crate::css_risk_api::handlers::get_user_risk_inner(
        pool,
        crate::css_risk_api::types::GetUserRiskRequest {
            user_id: req.user_id.clone(),
        },
    )
    .await?;

    let mut measures = Vec::new();

    measures.push(AssuranceMeasureView {
        kind: AssuranceMeasureKind::TradeProtection,
        enabled: !trust.data.frozen,
        title: "交易保障".into(),
        description: if !trust.data.frozen {
            "当前用户可进入平台标准交易保障流程。".into()
        } else {
            "当前用户已被冻结，不适用标准交易保障流程。".into()
        },
    });

    if signals
        .signals
        .iter()
        .any(|signal| matches!(signal.signal_kind, SignalKind::CreditLow))
    {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::BuyerWarning,
            enabled: true,
            title: "买家提醒".into(),
            description: "当前用户信用偏低，平台将向买家显示提醒。".into(),
        });
    }

    if signals
        .signals
        .iter()
        .any(|signal| matches!(signal.signal_kind, SignalKind::ReviewRequired))
    {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::ManualReviewEnabled,
            enabled: true,
            title: "人工复核".into(),
            description: "当前用户已进入人工复核风险区。".into(),
        });
    }

    if signals
        .signals
        .iter()
        .any(|signal| matches!(signal.signal_kind, SignalKind::Frozen))
    {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::FreezeProtection,
            enabled: true,
            title: "冻结保护".into(),
            description: "平台已启用冻结保护，阻断高风险动作继续执行。".into(),
        });
    }

    if signals.signals.iter().any(|signal| {
        matches!(
            signal.signal_kind,
            SignalKind::Restricted
                | SignalKind::CreditRestricted
                | SignalKind::CreditHighRisk
                | SignalKind::ActivePenalty
        )
    }) || risk.data.overall_high_risk
    {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::ExtraRiskControl,
            enabled: true,
            title: "额外风控保护".into(),
            description: "当前用户已进入增强风控观察范围。".into(),
        });
    }

    if signals.signals.iter().any(|signal| {
        matches!(
            signal.signal_kind,
            SignalKind::Restricted | SignalKind::CreditRestricted
        )
    }) {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::ParticipationRestriction,
            enabled: true,
            title: "参与限制".into(),
            description: "当前用户的部分参与能力已被限制。".into(),
        });
    }

    Ok(AssuranceResponse {
        subject_kind: AssuranceSubjectKind::User,
        data: UserAssuranceView {
            user_id: req.user_id,
            measures,
        },
    })
}

pub async fn get_catalog_assurance_inner(
    pool: &sqlx::PgPool,
    req: GetCatalogAssuranceRequest,
) -> anyhow::Result<AssuranceResponse<CatalogAssuranceView>> {
    let entry =
        crate::css_catalog_engine::store_pg::get_catalog_entry(pool, &req.catalog_id).await?;
    let trust = crate::css_trust_api::handlers::get_catalog_trust_inner(
        pool,
        crate::css_trust_api::types::GetCatalogTrustRequest {
            catalog_id: req.catalog_id.clone(),
        },
    )
    .await?;
    let risk = crate::css_risk_api::handlers::get_catalog_risk_inner(
        pool,
        crate::css_risk_api::types::GetCatalogRiskRequest {
            catalog_id: req.catalog_id.clone(),
        },
    )
    .await?;

    let mut measures = Vec::new();

    measures.push(AssuranceMeasureView {
        kind: AssuranceMeasureKind::TradeProtection,
        enabled: !trust.data.frozen,
        title: "交易保障".into(),
        description: if !trust.data.frozen {
            "当前作品仍处于平台交易保障覆盖范围。".into()
        } else {
            "当前作品处于冻结风险下，交易保障进入阻断模式。".into()
        },
    });

    if trust.data.owner_low_credit_warning {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::BuyerWarning,
            enabled: true,
            title: "买家提醒".into(),
            description: "当前 owner 信用偏低，平台将向买家显示风险提醒。".into(),
        });
    }

    if trust.data.review_required {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::ManualReviewEnabled,
            enabled: true,
            title: "人工复核".into(),
            description: "当前作品已进入人工复核保护流程。".into(),
        });
    }

    if risk.data.overall_high_risk {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::ExtraRiskControl,
            enabled: true,
            title: "额外风控保护".into(),
            description: "当前作品已启用增强风控保护。".into(),
        });
    }

    if trust.data.frozen {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::FreezeProtection,
            enabled: true,
            title: "冻结保护".into(),
            description: "当前作品处于冻结保护中。".into(),
        });
    }

    Ok(AssuranceResponse {
        subject_kind: AssuranceSubjectKind::Catalog,
        data: CatalogAssuranceView {
            catalog_id: req.catalog_id,
            owner_user_id: Some(entry.owner_user_id),
            measures,
        },
    })
}

pub async fn get_deal_assurance_inner(
    pool: &sqlx::PgPool,
    req: GetDealAssuranceRequest,
) -> anyhow::Result<AssuranceResponse<DealAssuranceView>> {
    let deal = crate::css_deal_engine::store_pg::get_deal(pool, &req.deal_id).await?;
    let trust = crate::css_trust_api::handlers::get_deal_trust_inner(
        pool,
        crate::css_trust_api::types::GetDealTrustRequest {
            deal_id: req.deal_id.clone(),
        },
    )
    .await?;
    let risk = crate::css_risk_api::handlers::get_deal_risk_inner(
        pool,
        crate::css_risk_api::types::GetDealRiskRequest {
            deal_id: req.deal_id.clone(),
        },
    )
    .await?;

    let mut measures = Vec::new();

    measures.push(AssuranceMeasureView {
        kind: AssuranceMeasureKind::TradeProtection,
        enabled: !trust.data.frozen,
        title: "交易保障".into(),
        description: "当前交易处于平台交易保障范围内。".into(),
    });

    if risk
        .data
        .factors
        .iter()
        .any(|factor| matches!(factor.source_kind, RiskSourceKind::HighValueDeal))
    {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::HighValueTradeGuard,
            enabled: true,
            title: "高额交易保护".into(),
            description: "当前交易命中高额交易阈值，已启用高额交易保护。".into(),
        });
    }

    if trust.data.review_required {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::ManualReviewEnabled,
            enabled: true,
            title: "人工复核".into(),
            description: "当前交易已启用人工复核保护流程。".into(),
        });
    }

    if trust.data.frozen {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::FreezeProtection,
            enabled: true,
            title: "冻结保护".into(),
            description: "当前交易已进入冻结保护状态。".into(),
        });
    }

    if risk.data.overall_high_risk {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::ExtraRiskControl,
            enabled: true,
            title: "额外风控保护".into(),
            description: "当前交易已启用额外风控保护。".into(),
        });
    }

    Ok(AssuranceResponse {
        subject_kind: AssuranceSubjectKind::Deal,
        data: DealAssuranceView {
            deal_id: req.deal_id,
            buyer_user_id: Some(deal.buyer_user_id),
            seller_user_id: Some(deal.seller_user_id),
            measures,
        },
    })
}

pub async fn get_ownership_assurance_inner(
    pool: &sqlx::PgPool,
    req: GetOwnershipAssuranceRequest,
) -> anyhow::Result<AssuranceResponse<OwnershipAssuranceView>> {
    let ownership =
        crate::css_ownership_engine::store_pg::get_ownership(pool, &req.ownership_id).await?;
    let trust = crate::css_trust_api::handlers::get_ownership_trust_inner(
        pool,
        crate::css_trust_api::types::GetOwnershipTrustRequest {
            ownership_id: req.ownership_id.clone(),
        },
    )
    .await?;
    let risk = crate::css_risk_api::handlers::get_ownership_risk_inner(
        pool,
        crate::css_risk_api::types::GetOwnershipRiskRequest {
            ownership_id: req.ownership_id.clone(),
        },
    )
    .await?;

    let mut measures = Vec::new();

    if trust.data.owner_low_credit_warning {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::BuyerWarning,
            enabled: true,
            title: "买家提醒".into(),
            description: "当前 owner 信用偏低，平台将提供风险提醒。".into(),
        });
    }

    if trust.data.restricted {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::OwnershipTransferRestriction,
            enabled: true,
            title: "转让限制".into(),
            description: "当前 ownership 相关操作已启用转让限制保护。".into(),
        });
    }

    if risk.data.overall_high_risk {
        measures.push(AssuranceMeasureView {
            kind: AssuranceMeasureKind::ExtraRiskControl,
            enabled: true,
            title: "额外风控保护".into(),
            description: "当前 ownership 已启用额外风控保护。".into(),
        });
    }

    Ok(AssuranceResponse {
        subject_kind: AssuranceSubjectKind::Ownership,
        data: OwnershipAssuranceView {
            ownership_id: req.ownership_id,
            owner_user_id: Some(ownership.owner_user_id),
            measures,
        },
    })
}

pub async fn get_user_assurance_http(
    State(state): State<AppState>,
    Json(req): Json<GetUserAssuranceRequest>,
) -> axum::response::Response {
    match get_user_assurance_inner(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "code": "get_user_assurance_failed",
                "message": err.to_string(),
            })),
        )
            .into_response(),
    }
}

pub async fn get_catalog_assurance_http(
    State(state): State<AppState>,
    Json(req): Json<GetCatalogAssuranceRequest>,
) -> axum::response::Response {
    match get_catalog_assurance_inner(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "code": "get_catalog_assurance_failed",
                "message": err.to_string(),
            })),
        )
            .into_response(),
    }
}

pub async fn get_deal_assurance_http(
    State(state): State<AppState>,
    Json(req): Json<GetDealAssuranceRequest>,
) -> axum::response::Response {
    match get_deal_assurance_inner(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "code": "get_deal_assurance_failed",
                "message": err.to_string(),
            })),
        )
            .into_response(),
    }
}

pub async fn get_ownership_assurance_http(
    State(state): State<AppState>,
    Json(req): Json<GetOwnershipAssuranceRequest>,
) -> axum::response::Response {
    match get_ownership_assurance_inner(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "code": "get_ownership_assurance_failed",
                "message": err.to_string(),
            })),
        )
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use crate::css_assurance_api::types::{AssuranceMeasureKind, AssuranceMeasureView};

    #[test]
    fn v180_measure_kind_serializes_as_snake_case() {
        let measure = AssuranceMeasureView {
            kind: AssuranceMeasureKind::HighValueTradeGuard,
            enabled: true,
            title: "x".into(),
            description: "y".into(),
        };
        let json = serde_json::to_value(measure).expect("serialize assurance measure");
        assert_eq!(json["kind"], "high_value_trade_guard");
    }
}
