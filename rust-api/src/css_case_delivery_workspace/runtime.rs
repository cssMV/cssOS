fn workspace_title(target: &crate::css_case_delivery_api::types::DeliveryApiTarget) -> String {
    format!("交付工作区 · {:?}", target)
}

fn workspace_subtitle(
    trust: &crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    risk: &crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
) -> String {
    format!("{} {}", trust.summary, risk.summary)
}

pub async fn build_delivery_workspace(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_workspace::types::DeliveryWorkspaceViewRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_workspace::types::CssCaseDeliveryWorkspace> {
    let trust = crate::css_case_delivery_trust_view::runtime::build_delivery_trust_view(
        pool,
        crate::css_case_delivery_trust_view::types::DeliveryTrustViewRequest {
            target: req.target.clone(),
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    let risk = crate::css_case_delivery_risk_view::runtime::build_delivery_risk_view(
        pool,
        crate::css_case_delivery_risk_view::types::DeliveryRiskViewRequest {
            target: req.target.clone(),
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    let explain = crate::css_case_delivery_explain_view::runtime::build_delivery_explain_view(
        pool,
        crate::css_case_delivery_explain_view::types::DeliveryExplainViewRequest {
            target: req.target.clone(),
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    let assurance =
        crate::css_case_delivery_assurance_view::runtime::build_delivery_assurance_view(
            pool,
            crate::css_case_delivery_assurance_view::types::DeliveryAssuranceViewRequest {
                target: req.target.clone(),
                consecutive_failures: req.consecutive_failures,
                latest_failed: req.latest_failed,
            },
            now_rfc3339,
        )
        .await?;

    let timeline =
        crate::css_case_delivery_timeline_ui_model::runtime::build_delivery_timeline_ui_model(
            pool,
            crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiViewRequest {
                target: req.target.clone(),
                consecutive_failures: req.consecutive_failures,
                latest_failed: req.latest_failed,
            },
        )
        .await?;

    let header = crate::css_case_delivery_workspace::types::DeliveryWorkspaceHeader {
        title: workspace_title(&req.target),
        subtitle: workspace_subtitle(&trust, &risk),
        target: None,
        mode: None,
        summary: Some(workspace_subtitle(&trust, &risk)),
    };

    Ok(
        crate::css_case_delivery_workspace::types::CssCaseDeliveryWorkspace {
            header,
            trust,
            risk,
            explain,
            assurance,
            subject_key: timeline.subject_key.clone(),
            timeline,
            resolution: None,
        },
    )
}

pub async fn build_delivery_workspace_from_legacy(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_workspace::types::DeliveryWorkspaceRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_workspace::types::CssCaseDeliveryWorkspace> {
    let trust =
        crate::css_case_delivery_trust_view::runtime::build_delivery_trust_view_from_legacy(
            pool,
            crate::css_case_delivery_trust_view::types::DeliveryTrustRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
                delivered: req.delivered,
                failure_streak: req.failure_streak,
                consecutive_failures: None,
                retry_still_failing: false,
            },
            now_rfc3339,
        )
        .await?;

    let risk = crate::css_case_delivery_risk_view::runtime::build_delivery_risk_view_from_legacy(
        pool,
        crate::css_case_delivery_risk_view::types::DeliveryRiskRequest {
            target: req.target.clone(),
            mode: req.mode.clone(),
            delivered: req.delivered,
            failure_streak: req.failure_streak,
            consecutive_failures: None,
            retry_still_failing: false,
        },
        now_rfc3339,
    )
    .await?;

    let explain =
        crate::css_case_delivery_explain_view::runtime::build_delivery_explain_view_from_legacy(
            pool,
            crate::css_case_delivery_explain_view::types::DeliveryExplainRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
                delivered: req.delivered,
                failure_streak: req.failure_streak,
                consecutive_failures: None,
                retry_still_failing: false,
            },
            now_rfc3339,
        )
        .await?;

    let assurance =
        crate::css_case_delivery_assurance_view::runtime::build_delivery_assurance_view_from_legacy(
            pool,
            crate::css_case_delivery_assurance_view::types::DeliveryAssuranceRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
                delivered: req.delivered,
                failure_streak: req.failure_streak,
                consecutive_failures: None,
                retry_still_failing: false,
            },
            now_rfc3339,
        )
        .await?;

    let resolution = crate::css_case_delivery_resolution_engine::runtime::resolve_delivery_state(
        pool,
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionRequest {
            target: req.target.clone(),
            mode: req.mode.clone(),
            delivered: req.delivered,
            failure_streak: req.failure_streak,
        },
        now_rfc3339,
    )
    .await?;

    let timeline =
        crate::css_case_delivery_timeline_ui_model::runtime::build_delivery_timeline_ui_model_from_legacy(
            pool,
            crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiModelRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
                limit: req.timeline_limit,
            },
        )
        .await?;

    let summary = if assurance.requires_manual_intervention {
        "current object is in manual intervention workspace".to_string()
    } else if trust.is_high_attention {
        "current object is under high governance attention".to_string()
    } else if trust.is_trusted {
        "current object is controllable and can stay in standard workspace observation".to_string()
    } else if !resolution.summary.is_empty() {
        resolution.summary.clone()
    } else {
        "current object requires deeper inspection".to_string()
    };

    let header = crate::css_case_delivery_workspace::types::DeliveryWorkspaceHeader {
        title: format!("{:?} / {:?}", req.target, req.mode),
        subtitle: summary.clone(),
        target: Some(req.target.clone()),
        mode: Some(req.mode.clone()),
        summary: Some(summary),
    };

    Ok(
        crate::css_case_delivery_workspace::types::CssCaseDeliveryWorkspace {
            subject_key: timeline.subject_key.clone(),
            header,
            resolution: Some(resolution),
            trust,
            risk,
            explain,
            assurance,
            timeline,
        },
    )
}
