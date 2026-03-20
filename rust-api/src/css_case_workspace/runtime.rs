use crate::css_case_actions_engine::types::CaseActionKind;
use crate::css_case_workspace::types::{
    CaseWorkspaceRequest, CaseWorkspaceSubjectKind, CssCaseWorkspace,
};

fn to_timeline_subject_kind(
    kind: &CaseWorkspaceSubjectKind,
) -> crate::css_timeline_ui_model::types::TimelineUiSubjectKind {
    match kind {
        CaseWorkspaceSubjectKind::User => {
            crate::css_timeline_ui_model::types::TimelineUiSubjectKind::User
        }
        CaseWorkspaceSubjectKind::Catalog => {
            crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Catalog
        }
        CaseWorkspaceSubjectKind::Deal => {
            crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Deal
        }
        CaseWorkspaceSubjectKind::Ownership => {
            crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Ownership
        }
    }
}

pub async fn load_trust_json(
    pool: &sqlx::PgPool,
    subject_kind: &CaseWorkspaceSubjectKind,
    subject_id: &str,
) -> anyhow::Result<serde_json::Value> {
    let value = match subject_kind {
        CaseWorkspaceSubjectKind::User => serde_json::to_value(
            crate::css_trust_api::handlers::get_user_trust_inner(
                pool,
                crate::css_trust_api::types::GetUserTrustRequest {
                    user_id: subject_id.to_string(),
                },
            )
            .await?,
        )?,
        CaseWorkspaceSubjectKind::Catalog => serde_json::to_value(
            crate::css_trust_api::handlers::get_catalog_trust_inner(
                pool,
                crate::css_trust_api::types::GetCatalogTrustRequest {
                    catalog_id: subject_id.to_string(),
                },
            )
            .await?,
        )?,
        CaseWorkspaceSubjectKind::Deal => serde_json::to_value(
            crate::css_trust_api::handlers::get_deal_trust_inner(
                pool,
                crate::css_trust_api::types::GetDealTrustRequest {
                    deal_id: subject_id.to_string(),
                },
            )
            .await?,
        )?,
        CaseWorkspaceSubjectKind::Ownership => serde_json::to_value(
            crate::css_trust_api::handlers::get_ownership_trust_inner(
                pool,
                crate::css_trust_api::types::GetOwnershipTrustRequest {
                    ownership_id: subject_id.to_string(),
                },
            )
            .await?,
        )?,
    };

    Ok(value)
}

pub async fn load_risk_json(
    pool: &sqlx::PgPool,
    subject_kind: &CaseWorkspaceSubjectKind,
    subject_id: &str,
) -> anyhow::Result<serde_json::Value> {
    let value = match subject_kind {
        CaseWorkspaceSubjectKind::User => serde_json::to_value(
            crate::css_risk_api::handlers::get_user_risk_inner(
                pool,
                crate::css_risk_api::types::GetUserRiskRequest {
                    user_id: subject_id.to_string(),
                },
            )
            .await?,
        )?,
        CaseWorkspaceSubjectKind::Catalog => serde_json::to_value(
            crate::css_risk_api::handlers::get_catalog_risk_inner(
                pool,
                crate::css_risk_api::types::GetCatalogRiskRequest {
                    catalog_id: subject_id.to_string(),
                },
            )
            .await?,
        )?,
        CaseWorkspaceSubjectKind::Deal => serde_json::to_value(
            crate::css_risk_api::handlers::get_deal_risk_inner(
                pool,
                crate::css_risk_api::types::GetDealRiskRequest {
                    deal_id: subject_id.to_string(),
                },
            )
            .await?,
        )?,
        CaseWorkspaceSubjectKind::Ownership => serde_json::to_value(
            crate::css_risk_api::handlers::get_ownership_risk_inner(
                pool,
                crate::css_risk_api::types::GetOwnershipRiskRequest {
                    ownership_id: subject_id.to_string(),
                },
            )
            .await?,
        )?,
    };

    Ok(value)
}

pub async fn load_assurance_json(
    pool: &sqlx::PgPool,
    subject_kind: &CaseWorkspaceSubjectKind,
    subject_id: &str,
) -> anyhow::Result<serde_json::Value> {
    let value = match subject_kind {
        CaseWorkspaceSubjectKind::User => serde_json::to_value(
            crate::css_assurance_api::handlers::get_user_assurance_inner(
                pool,
                crate::css_assurance_api::types::GetUserAssuranceRequest {
                    user_id: subject_id.to_string(),
                },
            )
            .await?,
        )?,
        CaseWorkspaceSubjectKind::Catalog => serde_json::to_value(
            crate::css_assurance_api::handlers::get_catalog_assurance_inner(
                pool,
                crate::css_assurance_api::types::GetCatalogAssuranceRequest {
                    catalog_id: subject_id.to_string(),
                },
            )
            .await?,
        )?,
        CaseWorkspaceSubjectKind::Deal => serde_json::to_value(
            crate::css_assurance_api::handlers::get_deal_assurance_inner(
                pool,
                crate::css_assurance_api::types::GetDealAssuranceRequest {
                    deal_id: subject_id.to_string(),
                },
            )
            .await?,
        )?,
        CaseWorkspaceSubjectKind::Ownership => serde_json::to_value(
            crate::css_assurance_api::handlers::get_ownership_assurance_inner(
                pool,
                crate::css_assurance_api::types::GetOwnershipAssuranceRequest {
                    ownership_id: subject_id.to_string(),
                },
            )
            .await?,
        )?,
    };

    Ok(value)
}

pub async fn load_explain(
    pool: &sqlx::PgPool,
    req: &CaseWorkspaceRequest,
) -> anyhow::Result<Option<crate::css_explain_api::types::ExplainResponse>> {
    if let Some(audit_id) = &req.audit_id {
        let explain = crate::css_explain_api::handlers::explain_by_audit_inner(
            pool,
            crate::css_explain_api::types::ExplainByAuditRequest {
                audit_id: audit_id.clone(),
                audience: crate::css_explain_api::types::ExplainAudience::Operator,
            },
        )
        .await?;
        return Ok(Some(explain));
    }

    Ok(None)
}

pub async fn load_timeline_ui(
    pool: &sqlx::PgPool,
    req: &CaseWorkspaceRequest,
) -> anyhow::Result<crate::css_timeline_ui_model::types::CssTimelineUiModel> {
    crate::css_timeline_ui_model::runtime::build_timeline_ui_model(
        pool,
        crate::css_timeline_ui_model::types::TimelineUiRequest {
            subject_kind: to_timeline_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await
}

fn to_case_timeline_subject_kind(
    kind: &CaseWorkspaceSubjectKind,
) -> crate::css_case_timeline_merge::types::CaseTimelineSubjectKind {
    match kind {
        CaseWorkspaceSubjectKind::User => {
            crate::css_case_timeline_merge::types::CaseTimelineSubjectKind::User
        }
        CaseWorkspaceSubjectKind::Catalog => {
            crate::css_case_timeline_merge::types::CaseTimelineSubjectKind::Catalog
        }
        CaseWorkspaceSubjectKind::Deal => {
            crate::css_case_timeline_merge::types::CaseTimelineSubjectKind::Deal
        }
        CaseWorkspaceSubjectKind::Ownership => {
            crate::css_case_timeline_merge::types::CaseTimelineSubjectKind::Ownership
        }
    }
}

fn to_case_timeline_explain_subject_kind(
    kind: &CaseWorkspaceSubjectKind,
) -> crate::css_case_timeline_explain::types::CaseTimelineExplainSubjectKind {
    match kind {
        CaseWorkspaceSubjectKind::User => {
            crate::css_case_timeline_explain::types::CaseTimelineExplainSubjectKind::User
        }
        CaseWorkspaceSubjectKind::Catalog => {
            crate::css_case_timeline_explain::types::CaseTimelineExplainSubjectKind::Catalog
        }
        CaseWorkspaceSubjectKind::Deal => {
            crate::css_case_timeline_explain::types::CaseTimelineExplainSubjectKind::Deal
        }
        CaseWorkspaceSubjectKind::Ownership => {
            crate::css_case_timeline_explain::types::CaseTimelineExplainSubjectKind::Ownership
        }
    }
}

fn to_case_status_subject_kind(
    kind: &CaseWorkspaceSubjectKind,
) -> crate::css_case_status_view::types::CaseStatusSubjectKind {
    match kind {
        CaseWorkspaceSubjectKind::User => {
            crate::css_case_status_view::types::CaseStatusSubjectKind::User
        }
        CaseWorkspaceSubjectKind::Catalog => {
            crate::css_case_status_view::types::CaseStatusSubjectKind::Catalog
        }
        CaseWorkspaceSubjectKind::Deal => {
            crate::css_case_status_view::types::CaseStatusSubjectKind::Deal
        }
        CaseWorkspaceSubjectKind::Ownership => {
            crate::css_case_status_view::types::CaseStatusSubjectKind::Ownership
        }
    }
}

fn to_case_lifecycle_subject_kind(
    kind: &CaseWorkspaceSubjectKind,
) -> crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind {
    match kind {
        CaseWorkspaceSubjectKind::User => {
            crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind::User
        }
        CaseWorkspaceSubjectKind::Catalog => {
            crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind::Catalog
        }
        CaseWorkspaceSubjectKind::Deal => {
            crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind::Deal
        }
        CaseWorkspaceSubjectKind::Ownership => {
            crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind::Ownership
        }
    }
}

fn to_case_summary_subject_kind(
    kind: &CaseWorkspaceSubjectKind,
) -> crate::css_case_summary_engine::types::CaseSummarySubjectKind {
    match kind {
        CaseWorkspaceSubjectKind::User => {
            crate::css_case_summary_engine::types::CaseSummarySubjectKind::User
        }
        CaseWorkspaceSubjectKind::Catalog => {
            crate::css_case_summary_engine::types::CaseSummarySubjectKind::Catalog
        }
        CaseWorkspaceSubjectKind::Deal => {
            crate::css_case_summary_engine::types::CaseSummarySubjectKind::Deal
        }
        CaseWorkspaceSubjectKind::Ownership => {
            crate::css_case_summary_engine::types::CaseSummarySubjectKind::Ownership
        }
    }
}

pub async fn load_case_timeline(
    pool: &sqlx::PgPool,
    req: &CaseWorkspaceRequest,
) -> anyhow::Result<crate::css_case_timeline_merge::types::CssCaseTimelineView> {
    crate::css_case_timeline_merge::runtime::build_case_timeline(
        pool,
        crate::css_case_timeline_merge::types::CaseTimelineRequest {
            case_id: crate::css_case_workspace::composer::build_basic_info(req).case_id,
            subject_kind: to_case_timeline_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await
}

pub async fn load_timeline_explain(
    pool: &sqlx::PgPool,
    req: &CaseWorkspaceRequest,
) -> anyhow::Result<crate::css_case_timeline_explain::types::CssCaseTimelineExplainView> {
    crate::css_case_timeline_explain::runtime::build_case_timeline_explain(
        pool,
        crate::css_case_timeline_explain::types::CaseTimelineExplainRequest {
            case_id: crate::css_case_workspace::composer::build_basic_info(req).case_id,
            subject_kind: to_case_timeline_explain_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await
}

pub async fn load_case_status(
    pool: &sqlx::PgPool,
    req: &CaseWorkspaceRequest,
) -> anyhow::Result<crate::css_case_status_view::types::CssCaseStatusView> {
    crate::css_case_status_view::runtime::load_case_status(
        pool,
        crate::css_case_status_view::types::CaseStatusRequest {
            case_id: crate::css_case_workspace::composer::build_basic_info(req).case_id,
            subject_kind: to_case_status_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await
}

pub async fn load_lifecycle_view(
    pool: &sqlx::PgPool,
    req: &CaseWorkspaceRequest,
) -> anyhow::Result<crate::css_case_lifecycle_view::types::CssCaseLifecycleView> {
    crate::css_case_lifecycle_view::runtime::build_case_lifecycle_view(
        pool,
        crate::css_case_lifecycle_view::types::CaseLifecycleRequest {
            case_id: crate::css_case_workspace::composer::build_basic_info(req).case_id,
            subject_kind: to_case_lifecycle_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await
}

pub async fn load_summary_view(
    pool: &sqlx::PgPool,
    req: &CaseWorkspaceRequest,
) -> anyhow::Result<crate::css_case_summary_engine::types::CssCaseSummaryView> {
    crate::css_case_summary_engine::runtime::build_case_summary(
        pool,
        crate::css_case_summary_engine::types::CaseSummaryRequest {
            case_id: crate::css_case_workspace::composer::build_basic_info(req).case_id,
            subject_kind: to_case_summary_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await
}

pub async fn load_inspector(
    pool: &sqlx::PgPool,
    req: &CaseWorkspaceRequest,
) -> anyhow::Result<Option<crate::css_inspector_view::types::CssInspectorView>> {
    let Some(audit_id) = &req.audit_id else {
        return Ok(None);
    };

    let inspector = crate::css_inspector_view::runtime::build_inspector_view(
        pool,
        crate::css_inspector_view::types::InspectorRequest {
            target_kind: crate::css_inspector_view::types::InspectorTargetKind::RuleAudit,
            source_system: "css_rule_audit".into(),
            source_id: audit_id.clone(),
        },
    )
    .await?;

    Ok(Some(inspector))
}

pub async fn build_case_workspace(
    pool: &sqlx::PgPool,
    req: CaseWorkspaceRequest,
) -> anyhow::Result<CssCaseWorkspace> {
    let basic = crate::css_case_workspace::composer::build_basic_info(&req);
    let trust = Some(load_trust_json(pool, &req.subject_kind, &req.subject_id).await?);
    let risk = Some(load_risk_json(pool, &req.subject_kind, &req.subject_id).await?);
    let assurance = Some(load_assurance_json(pool, &req.subject_kind, &req.subject_id).await?);
    let explain = load_explain(pool, &req).await?;
    let timeline_ui = Some(load_timeline_ui(pool, &req).await?);
    let case_timeline = Some(load_case_timeline(pool, &req).await?);
    let timeline_explain = Some(load_timeline_explain(pool, &req).await?);
    let status_view = Some(load_case_status(pool, &req).await?);
    let lifecycle_view = Some(load_lifecycle_view(pool, &req).await?);
    let summary_view = Some(load_summary_view(pool, &req).await?);
    let inspector = load_inspector(pool, &req).await?;

    Ok(CssCaseWorkspace {
        basic,
        available_actions: vec![
            CaseActionKind::Approve,
            CaseActionKind::Reject,
            CaseActionKind::Freeze,
            CaseActionKind::Escalate,
            CaseActionKind::Release,
            CaseActionKind::RequireReview,
        ],
        trust,
        risk,
        assurance,
        explain,
        timeline_ui,
        case_timeline,
        timeline_explain,
        status_view,
        lifecycle_view,
        summary_view,
        inspector,
    })
}
