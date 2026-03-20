use crate::css_case_lifecycle_view::types::CssCaseLifecycleView;
use crate::css_case_summary_engine::types::CaseSummarySubjectKind;
use crate::css_case_timeline_explain::types::CssCaseTimelineExplainView;

pub fn build_one_line(
    subject_kind: &CaseSummarySubjectKind,
    subject_id: &str,
    status_label: &str,
    timeline_summary: &str,
) -> String {
    format!(
        "{}:{} 当前状态为{}，{}",
        format!("{:?}", subject_kind).to_lowercase(),
        subject_id,
        status_label,
        timeline_summary
    )
}

pub fn build_three_lines(
    status_label: &str,
    lifecycle_label: &str,
    timeline_summary: &str,
) -> Vec<String> {
    vec![
        format!("当前正式状态：{}。", status_label),
        format!("案件生命周期当前阶段：{}。", lifecycle_label),
        timeline_summary.to_string(),
    ]
}

pub fn lifecycle_current_label(lifecycle: &CssCaseLifecycleView) -> String {
    lifecycle.current_label.clone()
}

pub fn timeline_summary(explain: &CssCaseTimelineExplainView) -> String {
    explain.summary.clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v199_one_line_summary_keeps_subject_and_status() {
        let summary = build_one_line(
            &CaseSummarySubjectKind::Deal,
            "deal_1",
            "冻结待复核",
            "存在关键转折与人工干预。",
        );

        assert!(summary.contains("deal:deal_1"));
        assert!(summary.contains("冻结待复核"));
    }
}
