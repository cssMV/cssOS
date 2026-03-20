use crate::css_decision_graph::types::{
    DecisionGraphEdge, DecisionGraphNode, GraphEdgeKind, GraphNodeKind,
};
use sqlx::Row;

pub const CREATE_CSS_DECISION_GRAPH_NODES_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_decision_graph_nodes (
    node_id TEXT PRIMARY KEY,
    node_kind TEXT NOT NULL,
    source_system TEXT NOT NULL,
    source_id TEXT NOT NULL,
    label TEXT NOT NULL,
    subject_kind TEXT,
    subject_id TEXT,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub const CREATE_CSS_DECISION_GRAPH_EDGES_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_decision_graph_edges (
    edge_id TEXT PRIMARY KEY,
    from_node_id TEXT NOT NULL,
    to_node_id TEXT NOT NULL,
    edge_kind TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub async fn insert_graph_node(
    pool: &sqlx::PgPool,
    node: &DecisionGraphNode,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_decision_graph_nodes (
            node_id, node_kind, source_system, source_id, label,
            subject_kind, subject_id, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        "#,
    )
    .bind(&node.node_id)
    .bind(node_kind_to_db(&node.node_kind))
    .bind(&node.source_system)
    .bind(&node.source_id)
    .bind(&node.label)
    .bind(&node.subject_kind)
    .bind(&node.subject_id)
    .bind(&node.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn insert_graph_edge(
    pool: &sqlx::PgPool,
    edge: &DecisionGraphEdge,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_decision_graph_edges (
            edge_id, from_node_id, to_node_id, edge_kind, label, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        "#,
    )
    .bind(&edge.edge_id)
    .bind(&edge.from_node_id)
    .bind(&edge.to_node_id)
    .bind(edge_kind_to_db(&edge.edge_kind))
    .bind(&edge.label)
    .bind(&edge.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn find_node_by_source(
    pool: &sqlx::PgPool,
    source_system: &str,
    source_id: &str,
) -> anyhow::Result<Option<DecisionGraphNode>> {
    let row = sqlx::query(
        r#"
        SELECT node_id, node_kind, source_system, source_id, label, subject_kind,
               subject_id, created_at::text AS created_at
        FROM css_decision_graph_nodes
        WHERE source_system = $1 AND source_id = $2
        LIMIT 1
        "#,
    )
    .bind(source_system)
    .bind(source_id)
    .fetch_optional(pool)
    .await?;

    row.map(row_to_graph_node).transpose()
}

pub async fn list_edges_from(
    pool: &sqlx::PgPool,
    from_node_id: &str,
) -> anyhow::Result<Vec<DecisionGraphEdge>> {
    let rows = sqlx::query(
        r#"
        SELECT edge_id, from_node_id, to_node_id, edge_kind, label, created_at::text AS created_at
        FROM css_decision_graph_edges
        WHERE from_node_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(from_node_id)
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_graph_edge).collect()
}

pub async fn list_edges_to(
    pool: &sqlx::PgPool,
    to_node_id: &str,
) -> anyhow::Result<Vec<DecisionGraphEdge>> {
    let rows = sqlx::query(
        r#"
        SELECT edge_id, from_node_id, to_node_id, edge_kind, label, created_at::text AS created_at
        FROM css_decision_graph_edges
        WHERE to_node_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(to_node_id)
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_graph_edge).collect()
}

pub async fn list_nodes_for_subject(
    pool: &sqlx::PgPool,
    subject_kind: &str,
    subject_id: &str,
) -> anyhow::Result<Vec<DecisionGraphNode>> {
    let rows = sqlx::query(
        r#"
        SELECT node_id, node_kind, source_system, source_id, label, subject_kind,
               subject_id, created_at::text AS created_at
        FROM css_decision_graph_nodes
        WHERE subject_kind = $1 AND subject_id = $2
        ORDER BY created_at ASC
        "#,
    )
    .bind(subject_kind)
    .bind(subject_id)
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_graph_node).collect()
}

fn node_kind_to_db(kind: &GraphNodeKind) -> &'static str {
    match kind {
        GraphNodeKind::PolicyVersion => "policy_version",
        GraphNodeKind::PolicyRule => "policy_rule",
        GraphNodeKind::RuleAudit => "rule_audit",
        GraphNodeKind::TsDecision => "ts_decision",
        GraphNodeKind::DisputeCase => "dispute_case",
        GraphNodeKind::ModerationCase => "moderation_case",
        GraphNodeKind::ReviewItem => "review_item",
        GraphNodeKind::ReviewDecision => "review_decision",
        GraphNodeKind::GovernanceTimelineEvent => "governance_timeline_event",
        GraphNodeKind::CreditEvent => "credit_event",
        GraphNodeKind::BusinessAction => "business_action",
        GraphNodeKind::User => "user",
        GraphNodeKind::Catalog => "catalog",
        GraphNodeKind::Auction => "auction",
        GraphNodeKind::Deal => "deal",
        GraphNodeKind::Ownership => "ownership",
    }
}

fn node_kind_from_db(value: &str) -> anyhow::Result<GraphNodeKind> {
    match value {
        "policy_version" => Ok(GraphNodeKind::PolicyVersion),
        "policy_rule" => Ok(GraphNodeKind::PolicyRule),
        "rule_audit" => Ok(GraphNodeKind::RuleAudit),
        "ts_decision" => Ok(GraphNodeKind::TsDecision),
        "dispute_case" => Ok(GraphNodeKind::DisputeCase),
        "moderation_case" => Ok(GraphNodeKind::ModerationCase),
        "review_item" => Ok(GraphNodeKind::ReviewItem),
        "review_decision" => Ok(GraphNodeKind::ReviewDecision),
        "governance_timeline_event" => Ok(GraphNodeKind::GovernanceTimelineEvent),
        "credit_event" => Ok(GraphNodeKind::CreditEvent),
        "business_action" => Ok(GraphNodeKind::BusinessAction),
        "user" => Ok(GraphNodeKind::User),
        "catalog" => Ok(GraphNodeKind::Catalog),
        "auction" => Ok(GraphNodeKind::Auction),
        "deal" => Ok(GraphNodeKind::Deal),
        "ownership" => Ok(GraphNodeKind::Ownership),
        other => anyhow::bail!("unknown decision graph node kind: {other}"),
    }
}

fn edge_kind_to_db(kind: &GraphEdgeKind) -> &'static str {
    match kind {
        GraphEdgeKind::UsesPolicyVersion => "uses_policy_version",
        GraphEdgeKind::EvaluatesRule => "evaluates_rule",
        GraphEdgeKind::ProducesDecision => "produces_decision",
        GraphEdgeKind::TriggersDispute => "triggers_dispute",
        GraphEdgeKind::TriggersModeration => "triggers_moderation",
        GraphEdgeKind::TriggersReview => "triggers_review",
        GraphEdgeKind::TriggersCreditChange => "triggers_credit_change",
        GraphEdgeKind::RecordedInTimeline => "recorded_in_timeline",
        GraphEdgeKind::BelongsToSubject => "belongs_to_subject",
        GraphEdgeKind::ExplainsDecision => "explains_decision",
        GraphEdgeKind::ResultsInRestriction => "results_in_restriction",
        GraphEdgeKind::ResultsInFreeze => "results_in_freeze",
        GraphEdgeKind::ResultsInWarning => "results_in_warning",
    }
}

fn edge_kind_from_db(value: &str) -> anyhow::Result<GraphEdgeKind> {
    match value {
        "uses_policy_version" => Ok(GraphEdgeKind::UsesPolicyVersion),
        "evaluates_rule" => Ok(GraphEdgeKind::EvaluatesRule),
        "produces_decision" => Ok(GraphEdgeKind::ProducesDecision),
        "triggers_dispute" => Ok(GraphEdgeKind::TriggersDispute),
        "triggers_moderation" => Ok(GraphEdgeKind::TriggersModeration),
        "triggers_review" => Ok(GraphEdgeKind::TriggersReview),
        "triggers_credit_change" => Ok(GraphEdgeKind::TriggersCreditChange),
        "recorded_in_timeline" => Ok(GraphEdgeKind::RecordedInTimeline),
        "belongs_to_subject" => Ok(GraphEdgeKind::BelongsToSubject),
        "explains_decision" => Ok(GraphEdgeKind::ExplainsDecision),
        "results_in_restriction" => Ok(GraphEdgeKind::ResultsInRestriction),
        "results_in_freeze" => Ok(GraphEdgeKind::ResultsInFreeze),
        "results_in_warning" => Ok(GraphEdgeKind::ResultsInWarning),
        other => anyhow::bail!("unknown decision graph edge kind: {other}"),
    }
}

fn row_to_graph_node(row: sqlx::postgres::PgRow) -> anyhow::Result<DecisionGraphNode> {
    Ok(DecisionGraphNode {
        node_id: row.try_get("node_id")?,
        node_kind: node_kind_from_db(&row.try_get::<String, _>("node_kind")?)?,
        source_system: row.try_get("source_system")?,
        source_id: row.try_get("source_id")?,
        label: row.try_get("label")?,
        subject_kind: row.try_get("subject_kind")?,
        subject_id: row.try_get("subject_id")?,
        created_at: row.try_get("created_at")?,
    })
}

fn row_to_graph_edge(row: sqlx::postgres::PgRow) -> anyhow::Result<DecisionGraphEdge> {
    Ok(DecisionGraphEdge {
        edge_id: row.try_get("edge_id")?,
        from_node_id: row.try_get("from_node_id")?,
        to_node_id: row.try_get("to_node_id")?,
        edge_kind: edge_kind_from_db(&row.try_get::<String, _>("edge_kind")?)?,
        label: row.try_get("label")?,
        created_at: row.try_get("created_at")?,
    })
}
