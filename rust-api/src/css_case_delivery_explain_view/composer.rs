pub fn decisive_rules(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> Vec<String> {
    trace
        .rule_hits
        .iter()
        .filter(|hit| hit.matched)
        .map(|hit| hit.rule_key.clone())
        .collect()
}

fn legacy_decisive_rule(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> Option<String> {
    if trace.evaluation.require_manual_intervention {
        return Some("mode_requires_manual_intervention".into());
    }

    if trace.evaluation.must_deliver {
        return Some("target_is_must_deliver".into());
    }

    if !trace.evaluation.silent_failure_allowed {
        return Some("silent_failure_not_allowed".into());
    }

    decisive_rules(trace).into_iter().next()
}

pub fn severity_text(
    decision: &crate::css_case_delivery_governance::types::CssCaseDeliveryGovernanceDecision,
) -> String {
    format!("{:?}", decision.severity).to_lowercase()
}

pub fn highlights(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> Vec<String> {
    let mut out = Vec::new();

    if trace.decision.escalate {
        out.push("已命中升级条件".into());
    }

    if trace.decision.require_manual_intervention {
        out.push("已命中人工介入条件".into());
    }

    if trace.decision.must_deliver {
        out.push("当前对象属于 must-deliver".into());
    }

    if trace.decision.no_silent_failure {
        out.push("当前对象不允许静默失败".into());
    }

    out.push(format!("当前 policy={}", trace.policy_version_name));
    out
}

pub fn ops_summary(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> String {
    if trace.decision.require_manual_intervention {
        return "该交付对象已命中人工介入条件，运营需优先处理。".into();
    }

    if trace.decision.escalate {
        return "该交付对象已达到升级条件，建议进入更高优先级处理路径。".into();
    }

    if trace.decision.must_deliver && trace.decision.no_silent_failure {
        return "该交付对象属于必须送达目标，不允许静默失败。".into();
    }

    "该交付对象当前未命中最高等级治理动作，可继续按常规路径观察。".into()
}

pub fn management_summary(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> String {
    format!(
        "当前对象引用 {}，治理严重度为 {:?}，升级={}，人工介入={}。",
        trace.policy_version_name,
        trace.decision.severity,
        trace.decision.escalate,
        trace.decision.require_manual_intervention,
    )
}

pub fn reasons(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> Vec<String> {
    trace
        .rule_hits
        .iter()
        .filter(|hit| hit.matched)
        .map(|hit| hit.explanation.clone())
        .collect()
}

pub fn fields(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> crate::css_case_delivery_explain_view::types::DeliveryExplainFields {
    crate::css_case_delivery_explain_view::types::DeliveryExplainFields {
        policy_version: trace.policy_version.clone(),
        must_deliver: trace.evaluation.must_deliver,
        silent_failure_allowed: trace.evaluation.silent_failure_allowed,
        should_escalate: trace.evaluation.should_escalate,
        require_manual_intervention: trace.evaluation.require_manual_intervention,
        consecutive_failures: trace.input.consecutive_failures,
        retry_still_failing: trace.input.retry_still_failing,
        decisive_rules: decisive_rules(trace),
        policy_id: trace.policy_id.clone(),
        decision: format!("{:?}", trace.conclusion.decision).to_lowercase(),
        severity: format!("{:?}", trace.conclusion.severity).to_lowercase(),
        action: format!("{:?}", trace.conclusion.action).to_lowercase(),
        target: format!("{:?}", trace.input.target).to_lowercase(),
        mode: trace
            .input
            .source_mode
            .as_ref()
            .map(|mode| format!("{:?}", mode).to_lowercase())
            .unwrap_or_else(|| "unknown".into()),
        failure_streak: trace.input.consecutive_failures,
        decisive_rule: legacy_decisive_rule(trace),
    }
}

pub fn api_fields(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> crate::css_case_delivery_explain_view::types::DeliveryExplainApiFields {
    crate::css_case_delivery_explain_view::types::DeliveryExplainApiFields {
        policy_version_label: trace.policy_version_name.clone(),
        severity: severity_text(&trace.decision),
        escalate: trace.decision.escalate,
        require_manual_intervention: trace.decision.require_manual_intervention,
        must_deliver: trace.decision.must_deliver,
        no_silent_failure: trace.decision.no_silent_failure,
    }
}

pub fn summary_title(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> String {
    let eval = &trace.evaluation;

    if eval.require_manual_intervention {
        return "需要人工介入".into();
    }

    if eval.should_escalate {
        return "已触发交付升级".into();
    }

    if eval.must_deliver && !eval.silent_failure_allowed {
        return "must-deliver 交付受保护".into();
    }

    "交付治理状态稳定".into()
}

pub fn summary_status(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> String {
    let fields = fields(trace);

    format!("{}/{}/{}", fields.decision, fields.severity, fields.action)
}

pub fn evidence(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> Vec<String> {
    let mut out = vec![
        format!(
            "policy = {} {}",
            trace.policy_id,
            trace
                .policy_version
                .clone()
                .unwrap_or_else(|| format!("v{}", trace.version))
        ),
        format!("target = {:?}", trace.input.target).to_lowercase(),
        format!("delivered = {}", trace.input.delivered.unwrap_or(false)),
        format!(
            "consecutive_failures = {}",
            trace.input.consecutive_failures
        ),
        format!("retry_still_failing = {}", trace.input.retry_still_failing),
    ];

    if let Some(mode) = &trace.input.source_mode {
        out.push(format!("mode = {:?}", mode).to_lowercase());
    }

    out.push(format!("latest_failed = {}", trace.input.latest_failed));

    for rule in trace.rule_hits.iter().filter(|rule| rule.matched) {
        out.push(format!(
            "matched rule: {} ({})",
            rule.rule_key, rule.explanation
        ));
    }

    out
}

pub fn ops_explanation(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> String {
    let mut parts = Vec::new();

    parts.push(format!("当前使用策略版本 {}。", trace.policy_version_name));
    parts.push(format!(
        "输入条件为：target={:?}，连续失败 {}，latest_failed={}。",
        trace.input.target, trace.input.consecutive_failures, trace.input.latest_failed
    ));

    let matched = trace
        .rule_hits
        .iter()
        .filter(|x| x.matched)
        .map(|x| x.label.clone())
        .collect::<Vec<_>>();

    if matched.is_empty() {
        parts.push("当前未命中额外治理规则。".into());
    } else {
        parts.push(format!("当前命中的治理规则包括：{}。", matched.join("、")));
    }

    parts.push(format!(
        "最终治理结果为：severity={:?}，escalate={}，require_manual_intervention={}，must_deliver={}，no_silent_failure={}。",
        trace.decision.severity,
        trace.decision.escalate,
        trace.decision.require_manual_intervention,
        trace.decision.must_deliver,
        trace.decision.no_silent_failure,
    ));

    parts.join(" ")
}
