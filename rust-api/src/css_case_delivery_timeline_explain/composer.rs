use crate::css_case_delivery_timeline_explain::types::{
    DeliveryTimelineExplainNodeRole, DeliveryTimelineExplainedImportance,
    DeliveryTimelineExplainedNode,
};

pub fn is_decisive_action(title: &str) -> bool {
    let t = title.to_lowercase();
    t.contains("retry")
        || t.contains("requiremanualintervention")
        || t.contains("require_manual_intervention")
        || t.contains("escalateops")
        || t.contains("escalate_ops")
}

pub fn is_decisive_signal(body: &str) -> bool {
    let b = body.to_lowercase();
    b.contains("untrusted") || b.contains("risky")
}

pub fn importance_of_node(
    node: &crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedNode,
) -> DeliveryTimelineExplainedImportance {
    use crate::css_case_delivery_timeline_explain::types::DeliveryTimelineExplainedImportance as I;
    use crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedSource as S;

    match node.source {
        S::Action => {
            if is_decisive_action(&node.title) {
                I::Decisive
            } else {
                I::TurningPoint
            }
        }
        S::Signal => {
            if is_decisive_signal(&node.body) {
                I::Decisive
            } else if node.is_pivot {
                I::TurningPoint
            } else {
                I::Informational
            }
        }
    }
}

pub fn explanation_of_node(
    node: &crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedNode,
    importance: &DeliveryTimelineExplainedImportance,
) -> String {
    match importance {
        DeliveryTimelineExplainedImportance::Decisive => {
            format!("该节点直接改变了对象的后续状态或处理结果：{}。", node.title)
        }
        DeliveryTimelineExplainedImportance::TurningPoint => {
            format!("该节点构成时间线中的关键转折：{}。", node.title)
        }
        DeliveryTimelineExplainedImportance::Informational => {
            format!("该节点主要用于记录上下文状态：{}。", node.title)
        }
    }
}

fn legacy_role_from_importance(
    importance: &DeliveryTimelineExplainedImportance,
) -> DeliveryTimelineExplainNodeRole {
    match importance {
        DeliveryTimelineExplainedImportance::Decisive => DeliveryTimelineExplainNodeRole::Decisive,
        DeliveryTimelineExplainedImportance::TurningPoint => {
            DeliveryTimelineExplainNodeRole::KeyTurningPoint
        }
        DeliveryTimelineExplainedImportance::Informational => {
            DeliveryTimelineExplainNodeRole::Informational
        }
    }
}

pub fn explained_node(
    node: &crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedNode,
) -> DeliveryTimelineExplainedNode {
    let importance = importance_of_node(node);
    let explanation = explanation_of_node(node, &importance);

    DeliveryTimelineExplainedNode {
        title: node.title.clone(),
        body: node.body.clone(),
        created_at: node.created_at.clone(),
        source: node.source.clone(),
        importance: importance.clone(),
        explanation,
        node_id: node.node_id.clone(),
        timestamp: node.timestamp.clone(),
        role: legacy_role_from_importance(&importance),
    }
}

pub fn explain_summary(nodes: &[DeliveryTimelineExplainedNode]) -> String {
    let decisive = nodes
        .iter()
        .filter(|x| matches!(x.importance, DeliveryTimelineExplainedImportance::Decisive))
        .count();
    let turning = nodes
        .iter()
        .filter(|x| {
            matches!(
                x.importance,
                DeliveryTimelineExplainedImportance::TurningPoint
            )
        })
        .count();

    format!(
        "该时间线包含 {} 个决定性节点，{} 个关键转折节点。",
        decisive, turning
    )
}

pub fn key_findings(nodes: &[DeliveryTimelineExplainedNode]) -> Vec<String> {
    let mut findings = Vec::new();

    for node in nodes {
        match node.importance {
            DeliveryTimelineExplainedImportance::Decisive => {
                findings.push(format!("决定性节点：{}", node.title));
            }
            DeliveryTimelineExplainedImportance::TurningPoint => {
                findings.push(format!("关键转折：{}", node.title));
            }
            DeliveryTimelineExplainedImportance::Informational => {}
        }
    }

    findings
}

pub fn build_explained_nodes(
    timeline: &crate::css_case_delivery_timeline_merge::types::CssCaseDeliveryTimelineMerge,
) -> Vec<DeliveryTimelineExplainedNode> {
    timeline.nodes.iter().map(explained_node).collect()
}
