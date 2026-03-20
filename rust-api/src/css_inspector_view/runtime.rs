use crate::css_inspector_view::types::{
    CssInspectorView, InspectorDecisionGraphPanel, InspectorExplainPanel, InspectorRequest,
    InspectorRuleAuditPanel, InspectorSnapshotPanel, InspectorTargetKind,
};

fn timeline_subject_to_str(
    kind: &crate::css_governance_timeline::types::TimelineSubjectKind,
) -> &'static str {
    match kind {
        crate::css_governance_timeline::types::TimelineSubjectKind::User => "user",
        crate::css_governance_timeline::types::TimelineSubjectKind::Catalog => "catalog",
        crate::css_governance_timeline::types::TimelineSubjectKind::Auction => "auction",
        crate::css_governance_timeline::types::TimelineSubjectKind::Deal => "deal",
        crate::css_governance_timeline::types::TimelineSubjectKind::Ownership => "ownership",
    }
}

fn timeline_subject_to_snapshot_kind(
    kind: &crate::css_governance_timeline::types::TimelineSubjectKind,
) -> crate::css_signals_snapshot::types::SnapshotSubjectKind {
    match kind {
        crate::css_governance_timeline::types::TimelineSubjectKind::User => {
            crate::css_signals_snapshot::types::SnapshotSubjectKind::User
        }
        crate::css_governance_timeline::types::TimelineSubjectKind::Catalog
        | crate::css_governance_timeline::types::TimelineSubjectKind::Auction => {
            crate::css_signals_snapshot::types::SnapshotSubjectKind::Catalog
        }
        crate::css_governance_timeline::types::TimelineSubjectKind::Deal => {
            crate::css_signals_snapshot::types::SnapshotSubjectKind::Deal
        }
        crate::css_governance_timeline::types::TimelineSubjectKind::Ownership => {
            crate::css_signals_snapshot::types::SnapshotSubjectKind::Ownership
        }
    }
}

pub async fn inspect_governance_timeline_item(
    pool: &sqlx::PgPool,
    source_id: &str,
) -> anyhow::Result<CssInspectorView> {
    let entry =
        crate::css_governance_timeline::store_pg::get_timeline_entry(pool, source_id).await?;
    let raw = serde_json::to_value(&entry)?;
    let snapshots = crate::css_signals_snapshot::store_pg::list_snapshots_for_subject(
        pool,
        &timeline_subject_to_snapshot_kind(&entry.subject_kind),
        &entry.subject_id,
    )
    .await
    .unwrap_or_default();
    let graph = crate::css_decision_graph::runtime::load_subject_graph(
        pool,
        timeline_subject_to_str(&entry.subject_kind),
        &entry.subject_id,
    )
    .await
    .ok();

    Ok(CssInspectorView {
        target_kind: InspectorTargetKind::GovernanceTimelineItem,
        source_panel: crate::css_inspector_view::composer::source_panel(
            "css_governance_timeline",
            source_id,
            raw,
        ),
        snapshot_panel: Some(InspectorSnapshotPanel { snapshots }),
        replay_panel: None,
        rule_audit_panel: None,
        decision_graph_panel: Some(InspectorDecisionGraphPanel { graph }),
        explain_panel: None,
    })
}

pub async fn inspect_snapshot(
    pool: &sqlx::PgPool,
    source_id: &str,
) -> anyhow::Result<CssInspectorView> {
    let snapshot = crate::css_signals_snapshot::store_pg::get_snapshot(pool, source_id).await?;
    let raw = serde_json::to_value(&snapshot)?;

    Ok(CssInspectorView {
        target_kind: InspectorTargetKind::Snapshot,
        source_panel: crate::css_inspector_view::composer::source_panel(
            "css_signals_snapshot",
            source_id,
            raw,
        ),
        snapshot_panel: Some(InspectorSnapshotPanel {
            snapshots: vec![snapshot],
        }),
        replay_panel: None,
        rule_audit_panel: None,
        decision_graph_panel: None,
        explain_panel: None,
    })
}

pub async fn inspect_rule_audit(
    pool: &sqlx::PgPool,
    source_id: &str,
) -> anyhow::Result<CssInspectorView> {
    let audit = crate::css_rule_audit::store_pg::get_rule_audit(pool, source_id).await?;
    let raw = serde_json::to_value(&audit)?;
    let explain = crate::css_explain_api::handlers::explain_by_audit_inner(
        pool,
        crate::css_explain_api::types::ExplainByAuditRequest {
            audit_id: audit.audit_id.clone(),
            audience: crate::css_explain_api::types::ExplainAudience::Operator,
        },
    )
    .await
    .ok();
    let graph = crate::css_decision_graph::runtime::load_subject_graph(
        pool,
        &audit.subject_kind,
        &audit.subject_id,
    )
    .await
    .ok();

    Ok(CssInspectorView {
        target_kind: InspectorTargetKind::RuleAudit,
        source_panel: crate::css_inspector_view::composer::source_panel(
            "css_rule_audit",
            source_id,
            raw,
        ),
        snapshot_panel: None,
        replay_panel: None,
        rule_audit_panel: Some(InspectorRuleAuditPanel { audit: Some(audit) }),
        decision_graph_panel: Some(InspectorDecisionGraphPanel { graph }),
        explain_panel: explain.map(|explain| InspectorExplainPanel {
            explain: Some(explain),
        }),
    })
}

pub async fn inspect_timeline_ui_item(
    pool: &sqlx::PgPool,
    source_system: &str,
    source_id: &str,
) -> anyhow::Result<CssInspectorView> {
    match source_system {
        "css_governance_timeline" => inspect_governance_timeline_item(pool, source_id).await,
        "css_rule_audit" => inspect_rule_audit(pool, source_id).await,
        "css_signals_snapshot" => inspect_snapshot(pool, source_id).await,
        _ => {
            let raw = serde_json::json!({
                "source_system": source_system,
                "source_id": source_id,
                "message": "当前 source 暂未实现专用检查器，先返回原始引用。"
            });

            Ok(CssInspectorView {
                target_kind: InspectorTargetKind::TimelineUiItem,
                source_panel: crate::css_inspector_view::composer::source_panel(
                    source_system,
                    source_id,
                    raw,
                ),
                snapshot_panel: None,
                replay_panel: None,
                rule_audit_panel: None,
                decision_graph_panel: None,
                explain_panel: None,
            })
        }
    }
}

pub async fn build_inspector_view(
    pool: &sqlx::PgPool,
    req: InspectorRequest,
) -> anyhow::Result<CssInspectorView> {
    match req.target_kind {
        InspectorTargetKind::GovernanceTimelineItem => {
            inspect_governance_timeline_item(pool, &req.source_id).await
        }
        InspectorTargetKind::RuleAudit => inspect_rule_audit(pool, &req.source_id).await,
        InspectorTargetKind::Snapshot => inspect_snapshot(pool, &req.source_id).await,
        InspectorTargetKind::TimelineUiItem => {
            inspect_timeline_ui_item(pool, &req.source_system, &req.source_id).await
        }
        _ => {
            let raw = serde_json::json!({
                "source_system": req.source_system,
                "source_id": req.source_id,
                "message": "该 target_kind 的检查器骨架已预留，后续可扩展。"
            });

            Ok(CssInspectorView {
                target_kind: req.target_kind,
                source_panel: crate::css_inspector_view::composer::source_panel(
                    &req.source_system,
                    &req.source_id,
                    raw,
                ),
                snapshot_panel: None,
                replay_panel: None,
                rule_audit_panel: None,
                decision_graph_panel: None,
                explain_panel: None,
            })
        }
    }
}
