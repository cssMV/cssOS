use crate::css_signals_hub::types::{
    CssSignal, GetSignalsRequest, SignalKind, SignalSeverity, SignalSubjectKind, SignalsBundle,
};

pub async fn get_user_signals(pool: &sqlx::PgPool, user_id: &str) -> anyhow::Result<SignalsBundle> {
    let mut signals = Vec::new();

    let bundle = crate::css_policy_engine::runtime::get_policy_bundle();
    let (credit, _) = crate::css_governance_timeline::store_pg::get_or_create_credit_profile(
        pool,
        user_id,
        crate::css_policy_engine::runtime::credit_initial_score(),
    )
    .await?;
    let profile =
        crate::css_reputation_engine::store_pg::get_or_create_profile(pool, user_id).await?;
    let penalties = crate::css_reputation_engine::store_pg::list_active_penalties(pool, user_id)
        .await
        .unwrap_or_default();
    let disputes = crate::css_dispute_engine::store_pg::list_open_disputes_for_user(pool, user_id)
        .await
        .unwrap_or_default();

    if credit.score < bundle.credit.low_warning_threshold {
        signals.push(CssSignal {
            signal_kind: SignalKind::CreditLow,
            severity: SignalSeverity::Medium,
            title: "信用分偏低".into(),
            description: format!(
                "当前信用分 {} 低于提醒阈值 {}。",
                credit.score, bundle.credit.low_warning_threshold
            ),
            source_system: Some("css_credit".into()),
            source_id: Some(user_id.to_string()),
        });
    }

    if credit.score < bundle.credit.high_risk_threshold {
        signals.push(CssSignal {
            signal_kind: SignalKind::CreditHighRisk,
            severity: SignalSeverity::High,
            title: "信用高风险".into(),
            description: format!(
                "当前信用分 {} 低于高风险阈值 {}。",
                credit.score, bundle.credit.high_risk_threshold
            ),
            source_system: Some("css_credit".into()),
            source_id: Some(user_id.to_string()),
        });
    }

    if credit.score < bundle.credit.restrict_threshold {
        signals.push(CssSignal {
            signal_kind: SignalKind::CreditRestricted,
            severity: SignalSeverity::High,
            title: "信用进入限制区".into(),
            description: format!(
                "当前信用分 {} 低于限制阈值 {}。",
                credit.score, bundle.credit.restrict_threshold
            ),
            source_system: Some("css_credit".into()),
            source_id: Some(user_id.to_string()),
        });
    }

    if !penalties.is_empty() {
        signals.push(CssSignal {
            signal_kind: SignalKind::ActivePenalty,
            severity: SignalSeverity::High,
            title: "存在活跃处罚".into(),
            description: format!("当前存在 {} 条生效中的处罚。", penalties.len()),
            source_system: Some("css_reputation".into()),
            source_id: Some(user_id.to_string()),
        });
    }

    if !disputes.is_empty() {
        signals.push(CssSignal {
            signal_kind: SignalKind::OpenDisputes,
            severity: if disputes.len() >= 3 {
                SignalSeverity::High
            } else {
                SignalSeverity::Medium
            },
            title: "存在未关闭争议".into(),
            description: format!("当前存在 {} 个未关闭争议。", disputes.len()),
            source_system: Some("css_dispute".into()),
            source_id: Some(user_id.to_string()),
        });
    }

    if disputes.len() >= 3 {
        signals.push(CssSignal {
            signal_kind: SignalKind::ReviewRequired,
            severity: SignalSeverity::High,
            title: "需要人工复核".into(),
            description: "争议数量较多，进入人工复核风险区。".into(),
            source_system: Some("css_review_queue".into()),
            source_id: Some(user_id.to_string()),
        });
    }

    if !penalties.is_empty() || credit.score < bundle.credit.restrict_threshold {
        signals.push(CssSignal {
            signal_kind: SignalKind::Restricted,
            severity: SignalSeverity::High,
            title: "存在限制信号".into(),
            description: "当前用户已进入限制性治理区。".into(),
            source_system: Some("css_moderation".into()),
            source_id: Some(user_id.to_string()),
        });
    }

    if profile.score < 20 {
        signals.push(CssSignal {
            signal_kind: SignalKind::Frozen,
            severity: SignalSeverity::Critical,
            title: "冻结信号".into(),
            description: "当前信誉分极低，存在冻结保护信号。".into(),
            source_system: Some("css_moderation".into()),
            source_id: Some(user_id.to_string()),
        });
    }

    Ok(SignalsBundle {
        subject_kind: SignalSubjectKind::User,
        subject_id: user_id.to_string(),
        signals,
    })
}

pub async fn get_catalog_signals(
    pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<SignalsBundle> {
    let entry = crate::css_catalog_engine::store_pg::get_catalog_entry(pool, catalog_id).await?;
    let owner_user_id = entry.owner_user_id.clone();
    let mut signals = get_user_signals(pool, &owner_user_id).await?.signals;

    let disputes =
        crate::css_dispute_engine::store_pg::list_open_disputes_for_user(pool, &owner_user_id)
            .await
            .unwrap_or_default();

    for dispute in disputes {
        match dispute.kind {
            crate::css_dispute_engine::types::DisputeKind::SelfBidding => {
                signals.push(CssSignal {
                    signal_kind: SignalKind::SelfBiddingViolation,
                    severity: SignalSeverity::Critical,
                    title: "owner 自竞拍违规".into(),
                    description: "检测到 owner 参与自己作品竞拍。".into(),
                    source_system: Some("css_dispute".into()),
                    source_id: Some(dispute.dispute_id),
                });
            }
            crate::css_dispute_engine::types::DisputeKind::SelfAutoBidding => {
                signals.push(CssSignal {
                    signal_kind: SignalKind::SelfAutoBidViolation,
                    severity: SignalSeverity::Critical,
                    title: "owner 自代拍违规".into(),
                    description: "检测到 owner 对自己作品启用自动代拍。".into(),
                    source_system: Some("css_dispute".into()),
                    source_id: Some(dispute.dispute_id),
                });
            }
            crate::css_dispute_engine::types::DisputeKind::SuspiciousPriceManipulation => {
                signals.push(CssSignal {
                    signal_kind: SignalKind::SuspiciousPriceManipulation,
                    severity: SignalSeverity::Critical,
                    title: "疑似价格操纵".into(),
                    description: "检测到 owner 存在疑似价格操纵相关行为。".into(),
                    source_system: Some("css_dispute".into()),
                    source_id: Some(dispute.dispute_id),
                });
            }
            _ => {}
        }
    }

    if signals.iter().any(|signal| {
        matches!(
            signal.signal_kind,
            SignalKind::SelfBiddingViolation
                | SignalKind::SelfAutoBidViolation
                | SignalKind::SuspiciousPriceManipulation
        )
    }) {
        signals.push(CssSignal {
            signal_kind: SignalKind::OwnerBehaviorAnomaly,
            severity: SignalSeverity::Critical,
            title: "owner 行为异常".into(),
            description: "当前 owner 存在异常竞拍或价格操纵相关行为信号。".into(),
            source_system: Some("css_signals_hub".into()),
            source_id: Some(catalog_id.to_string()),
        });
    }

    Ok(SignalsBundle {
        subject_kind: SignalSubjectKind::Catalog,
        subject_id: catalog_id.to_string(),
        signals,
    })
}

pub async fn get_deal_signals(pool: &sqlx::PgPool, deal_id: &str) -> anyhow::Result<SignalsBundle> {
    let deal = crate::css_deal_engine::store_pg::get_deal(pool, deal_id).await?;
    let bundle = crate::css_policy_engine::runtime::get_policy_bundle();
    let mut signals = get_user_signals(pool, &deal.buyer_user_id).await?.signals;

    if deal.price_cents >= bundle.commerce.high_value_trade_cents {
        signals.push(CssSignal {
            signal_kind: SignalKind::HighValueDeal,
            severity: SignalSeverity::High,
            title: "高额交易信号".into(),
            description: format!(
                "当前交易金额 {} 达到或超过高额交易阈值 {}。",
                deal.price_cents, bundle.commerce.high_value_trade_cents
            ),
            source_system: Some("css_deal".into()),
            source_id: Some(deal_id.to_string()),
        });
        signals.push(CssSignal {
            signal_kind: SignalKind::ReviewRequired,
            severity: SignalSeverity::High,
            title: "交易需人工复核".into(),
            description: "当前高额交易进入人工复核风险区。".into(),
            source_system: Some("css_review_queue".into()),
            source_id: Some(deal_id.to_string()),
        });
    }

    Ok(SignalsBundle {
        subject_kind: SignalSubjectKind::Deal,
        subject_id: deal_id.to_string(),
        signals,
    })
}

pub async fn get_ownership_signals(
    pool: &sqlx::PgPool,
    ownership_id: &str,
) -> anyhow::Result<SignalsBundle> {
    let ownership =
        crate::css_ownership_engine::store_pg::get_ownership(pool, ownership_id).await?;
    let signals = get_user_signals(pool, &ownership.owner_user_id)
        .await?
        .signals;

    Ok(SignalsBundle {
        subject_kind: SignalSubjectKind::Ownership,
        subject_id: ownership_id.to_string(),
        signals,
    })
}

pub async fn get_signals(
    pool: &sqlx::PgPool,
    req: GetSignalsRequest,
) -> anyhow::Result<SignalsBundle> {
    match req.subject_kind {
        SignalSubjectKind::User => get_user_signals(pool, &req.subject_id).await,
        SignalSubjectKind::Catalog => get_catalog_signals(pool, &req.subject_id).await,
        SignalSubjectKind::Deal => get_deal_signals(pool, &req.subject_id).await,
        SignalSubjectKind::Ownership => get_ownership_signals(pool, &req.subject_id).await,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v181_signal_kind_serde_uses_snake_case() {
        let encoded = serde_json::to_string(&SignalKind::OwnerBehaviorAnomaly).unwrap();
        assert_eq!(encoded, "\"owner_behavior_anomaly\"");
    }

    #[test]
    fn v181_signal_subject_kind_serde_uses_snake_case() {
        let encoded = serde_json::to_string(&SignalSubjectKind::Ownership).unwrap();
        assert_eq!(encoded, "\"ownership\"");
    }
}
