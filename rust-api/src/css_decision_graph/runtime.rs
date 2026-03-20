use crate::css_decision_graph::types::{
    DecisionGraphEdge, DecisionGraphNode, DecisionGraphView, GraphEdgeKind, GraphNodeKind,
};

pub async fn ensure_node(
    pool: &sqlx::PgPool,
    node_kind: GraphNodeKind,
    source_system: &str,
    source_id: &str,
    label: &str,
    subject_kind: Option<String>,
    subject_id: Option<String>,
    now_rfc3339: &str,
) -> anyhow::Result<DecisionGraphNode> {
    if let Some(existing) =
        crate::css_decision_graph::store_pg::find_node_by_source(pool, source_system, source_id)
            .await?
    {
        return Ok(existing);
    }

    let node = DecisionGraphNode {
        node_id: format!("dgn_{}", uuid::Uuid::new_v4()),
        node_kind,
        source_system: source_system.to_string(),
        source_id: source_id.to_string(),
        label: label.to_string(),
        subject_kind,
        subject_id,
        created_at: now_rfc3339.to_string(),
    };

    crate::css_decision_graph::store_pg::insert_graph_node(pool, &node).await?;
    Ok(node)
}

pub async fn connect(
    pool: &sqlx::PgPool,
    from_node_id: &str,
    to_node_id: &str,
    edge_kind: GraphEdgeKind,
    label: &str,
    now_rfc3339: &str,
) -> anyhow::Result<DecisionGraphEdge> {
    let edge = DecisionGraphEdge {
        edge_id: format!("dge_{}", uuid::Uuid::new_v4()),
        from_node_id: from_node_id.to_string(),
        to_node_id: to_node_id.to_string(),
        edge_kind,
        label: label.to_string(),
        created_at: now_rfc3339.to_string(),
    };

    crate::css_decision_graph::store_pg::insert_graph_edge(pool, &edge).await?;
    Ok(edge)
}

pub async fn append_from_rule_audit(
    pool: &sqlx::PgPool,
    audit: &crate::css_rule_audit::types::CssRuleAuditRecord,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    let audit_node = ensure_node(
        pool,
        GraphNodeKind::RuleAudit,
        "css_rule_audit",
        &audit.audit_id,
        &format!("rule audit: {}", audit.action),
        Some(audit.subject_kind.clone()),
        Some(audit.subject_id.clone()),
        now_rfc3339,
    )
    .await?;

    let policy_node = ensure_node(
        pool,
        GraphNodeKind::PolicyVersion,
        "css_policy_versioning",
        &audit.policy_version_id,
        &format!("policy version {}", audit.policy_version_id),
        None,
        None,
        now_rfc3339,
    )
    .await?;

    let _ = connect(
        pool,
        &audit_node.node_id,
        &policy_node.node_id,
        GraphEdgeKind::UsesPolicyVersion,
        "uses policy version",
        now_rfc3339,
    )
    .await?;

    for check in &audit.checks {
        let rule_node = ensure_node(
            pool,
            GraphNodeKind::PolicyRule,
            "css_policy_engine",
            &check.rule_key,
            &format!("{}={}", check.rule_key, check.rule_value),
            None,
            None,
            now_rfc3339,
        )
        .await?;

        let _ = connect(
            pool,
            &audit_node.node_id,
            &rule_node.node_id,
            GraphEdgeKind::EvaluatesRule,
            &check.outcome,
            now_rfc3339,
        )
        .await?;
    }

    Ok(())
}

pub async fn append_from_dispute(
    pool: &sqlx::PgPool,
    dispute: &crate::css_dispute_engine::types::CssDisputeCase,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    let subject_kind = dispute
        .catalog_id
        .as_ref()
        .map(|_| "catalog".to_string())
        .or_else(|| dispute.user_id.as_ref().map(|_| "user".to_string()));
    let subject_id = dispute.catalog_id.clone().or(dispute.user_id.clone());

    let dispute_node = ensure_node(
        pool,
        GraphNodeKind::DisputeCase,
        "css_dispute",
        &dispute.dispute_id,
        &dispute.message,
        subject_kind,
        subject_id,
        now_rfc3339,
    )
    .await?;

    if let Some(user_id) = &dispute.user_id {
        let user_node = ensure_node(
            pool,
            GraphNodeKind::User,
            "domain_user",
            user_id,
            &format!("user {}", user_id),
            Some("user".into()),
            Some(user_id.clone()),
            now_rfc3339,
        )
        .await?;

        let _ = connect(
            pool,
            &dispute_node.node_id,
            &user_node.node_id,
            GraphEdgeKind::BelongsToSubject,
            "belongs to user",
            now_rfc3339,
        )
        .await?;
    }

    Ok(())
}

pub async fn append_credit_change(
    pool: &sqlx::PgPool,
    user_id: &str,
    source_system: &str,
    source_id: &str,
    delta: i32,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    let credit_node = ensure_node(
        pool,
        GraphNodeKind::CreditEvent,
        source_system,
        source_id,
        &format!("credit delta {}", delta),
        Some("user".into()),
        Some(user_id.to_string()),
        now_rfc3339,
    )
    .await?;

    let user_node = ensure_node(
        pool,
        GraphNodeKind::User,
        "domain_user",
        user_id,
        &format!("user {}", user_id),
        Some("user".into()),
        Some(user_id.to_string()),
        now_rfc3339,
    )
    .await?;

    let _ = connect(
        pool,
        &credit_node.node_id,
        &user_node.node_id,
        GraphEdgeKind::BelongsToSubject,
        "credit belongs to user",
        now_rfc3339,
    )
    .await?;

    Ok(())
}

pub async fn append_from_review(
    pool: &sqlx::PgPool,
    review: &crate::css_review_queue::types::CssReviewItem,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    let review_node = ensure_node(
        pool,
        GraphNodeKind::ReviewItem,
        "css_review_queue",
        &review.review_id,
        &review.reason,
        Some(format!("{:?}", review.subject_kind).to_lowercase()),
        Some(review.subject_id.clone()),
        now_rfc3339,
    )
    .await?;

    if let Some(actor) = &review.actor_user_id {
        let user_node = ensure_node(
            pool,
            GraphNodeKind::User,
            "domain_user",
            actor,
            &format!("user {}", actor),
            Some("user".into()),
            Some(actor.clone()),
            now_rfc3339,
        )
        .await?;

        let _ = connect(
            pool,
            &review_node.node_id,
            &user_node.node_id,
            GraphEdgeKind::BelongsToSubject,
            "review involves actor",
            now_rfc3339,
        )
        .await?;
    }

    Ok(())
}

pub async fn load_subject_graph(
    pool: &sqlx::PgPool,
    subject_kind: &str,
    subject_id: &str,
) -> anyhow::Result<DecisionGraphView> {
    let nodes =
        crate::css_decision_graph::store_pg::list_nodes_for_subject(pool, subject_kind, subject_id)
            .await?;

    let mut edges = Vec::new();
    for node in &nodes {
        let mut from_edges =
            crate::css_decision_graph::store_pg::list_edges_from(pool, &node.node_id).await?;
        let mut to_edges =
            crate::css_decision_graph::store_pg::list_edges_to(pool, &node.node_id).await?;
        edges.append(&mut from_edges);
        edges.append(&mut to_edges);
    }

    edges.sort_by(|a, b| a.edge_id.cmp(&b.edge_id));
    edges.dedup_by(|a, b| a.edge_id == b.edge_id);

    Ok(DecisionGraphView { nodes, edges })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v175_graph_edge_kind_is_serializable() {
        let edge = GraphEdgeKind::UsesPolicyVersion;
        let json = serde_json::to_string(&edge).expect("serialize edge kind");
        assert!(json.contains("uses_policy_version"));
    }
}
