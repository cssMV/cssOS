use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseWorkspaceSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseBasicInfo {
    pub case_id: String,
    pub subject_kind: CaseWorkspaceSubjectKind,
    pub subject_id: String,
    pub title: String,
    pub summary: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audit_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dispute_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseWorkspace {
    pub basic: CaseBasicInfo,
    #[serde(default)]
    pub available_actions: Vec<crate::css_case_actions_engine::types::CaseActionKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trust: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub risk: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assurance: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub explain: Option<crate::css_explain_api::types::ExplainResponse>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeline_ui: Option<crate::css_timeline_ui_model::types::CssTimelineUiModel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub case_timeline: Option<crate::css_case_timeline_merge::types::CssCaseTimelineView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeline_explain:
        Option<crate::css_case_timeline_explain::types::CssCaseTimelineExplainView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status_view: Option<crate::css_case_status_view::types::CssCaseStatusView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lifecycle_view: Option<crate::css_case_lifecycle_view::types::CssCaseLifecycleView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary_view: Option<crate::css_case_summary_engine::types::CssCaseSummaryView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inspector: Option<crate::css_inspector_view::types::CssInspectorView>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseWorkspaceRequest {
    pub subject_kind: CaseWorkspaceSubjectKind,
    pub subject_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audit_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dispute_id: Option<String>,
}
