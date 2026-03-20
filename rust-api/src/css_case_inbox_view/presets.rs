use crate::css_case_inbox_view::types::InboxKind;

pub fn inbox_label(inbox: &InboxKind) -> String {
    match inbox {
        InboxKind::Pending => "待处理".into(),
        InboxKind::HighRisk => "高风险".into(),
        InboxKind::FrozenUntilReview => "冻结待复核".into(),
        InboxKind::EscalatedToManual => "已升级人工".into(),
        InboxKind::UpdatedToday => "今日更新".into(),
    }
}

pub fn build_query_for_inbox(
    inbox: &InboxKind,
    today_yyyy_mm_dd: &str,
    limit: Option<usize>,
    offset: Option<usize>,
) -> crate::css_case_query_engine::types::CaseQueryRequest {
    use crate::css_case_query_engine::types::{
        CaseQueryRequest, CaseQueryRiskLevel, CaseQuerySortBy, CaseQuerySortOrder,
        CaseQueryStatusKind,
    };

    match inbox {
        InboxKind::Pending => CaseQueryRequest {
            status: Some(CaseQueryStatusKind::Open),
            subject_kind: None,
            risk_level: None,
            closed_like: Some(false),
            actor_user_id: None,
            updated_after: None,
            updated_before: None,
            has_review: None,
            has_freeze: None,
            has_escalate: None,
            sort_by: Some(CaseQuerySortBy::UpdatedAt),
            sort_order: Some(CaseQuerySortOrder::Desc),
            limit,
            offset,
        },
        InboxKind::HighRisk => CaseQueryRequest {
            status: None,
            subject_kind: None,
            risk_level: Some(CaseQueryRiskLevel::High),
            closed_like: Some(false),
            actor_user_id: None,
            updated_after: None,
            updated_before: None,
            has_review: None,
            has_freeze: None,
            has_escalate: None,
            sort_by: Some(CaseQuerySortBy::UpdatedAt),
            sort_order: Some(CaseQuerySortOrder::Desc),
            limit,
            offset,
        },
        InboxKind::FrozenUntilReview => CaseQueryRequest {
            status: Some(CaseQueryStatusKind::FrozenUntilReview),
            subject_kind: None,
            risk_level: None,
            closed_like: Some(false),
            actor_user_id: None,
            updated_after: None,
            updated_before: None,
            has_review: None,
            has_freeze: Some(true),
            has_escalate: None,
            sort_by: Some(CaseQuerySortBy::UpdatedAt),
            sort_order: Some(CaseQuerySortOrder::Desc),
            limit,
            offset,
        },
        InboxKind::EscalatedToManual => CaseQueryRequest {
            status: Some(CaseQueryStatusKind::EscalatedToManual),
            subject_kind: None,
            risk_level: None,
            closed_like: Some(false),
            actor_user_id: None,
            updated_after: None,
            updated_before: None,
            has_review: None,
            has_freeze: None,
            has_escalate: Some(true),
            sort_by: Some(CaseQuerySortBy::UpdatedAt),
            sort_order: Some(CaseQuerySortOrder::Desc),
            limit,
            offset,
        },
        InboxKind::UpdatedToday => CaseQueryRequest {
            status: None,
            subject_kind: None,
            risk_level: None,
            closed_like: None,
            actor_user_id: None,
            updated_after: Some(format!("{today_yyyy_mm_dd}T00:00:00Z")),
            updated_before: None,
            has_review: None,
            has_freeze: None,
            has_escalate: None,
            sort_by: Some(CaseQuerySortBy::UpdatedAt),
            sort_order: Some(CaseQuerySortOrder::Desc),
            limit,
            offset,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v202_pending_inbox_maps_to_open_and_not_closed() {
        let query = build_query_for_inbox(&InboxKind::Pending, "2026-03-13", Some(20), Some(0));
        assert_eq!(
            query.status,
            Some(crate::css_case_query_engine::types::CaseQueryStatusKind::Open)
        );
        assert_eq!(query.closed_like, Some(false));
    }
}
