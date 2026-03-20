use crate::css_case_inbox_view::types::{CssCaseInboxView, InboxRequest};

pub async fn load_inbox(
    pool: &sqlx::PgPool,
    req: InboxRequest,
    today_yyyy_mm_dd: &str,
) -> anyhow::Result<CssCaseInboxView> {
    let query = crate::css_case_inbox_view::presets::build_query_for_inbox(
        &req.inbox,
        today_yyyy_mm_dd,
        req.limit,
        req.offset,
    );

    let result = crate::css_case_query_engine::runtime::query_cases(pool, query).await?;

    Ok(CssCaseInboxView {
        inbox: req.inbox.clone(),
        label: crate::css_case_inbox_view::presets::inbox_label(&req.inbox),
        total: result.total,
        rows: result.rows,
    })
}
