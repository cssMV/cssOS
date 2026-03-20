use std::collections::BTreeMap;

fn day_key(ts: &str) -> String {
    ts.chars().take(10).collect()
}

fn trends_summary(
    series: &[crate::css_case_delivery_trends_view::types::DeliveryTrendSeries],
) -> String {
    format!("当前共生成 {} 条交付运营趋势序列。", series.len())
}

fn increment_day(map: &mut BTreeMap<String, f64>, day: String, delta: f64) {
    *map.entry(day).or_insert(0.0) += delta;
}

fn points_from_map(
    map: BTreeMap<String, f64>,
) -> Vec<crate::css_case_delivery_trends_view::types::DeliveryTrendPoint> {
    map.into_iter()
        .map(
            |(day, value)| crate::css_case_delivery_trends_view::types::DeliveryTrendPoint {
                day,
                value,
            },
        )
        .collect()
}

async fn build_resolution_series(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Vec<crate::css_case_delivery_trends_view::types::DeliveryTrendSeries>> {
    use crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState;

    let logs =
        crate::css_case_delivery_resolution_log::store_pg::list_all_delivery_resolution_logs(pool)
            .await
            .unwrap_or_default();

    let mut escalated = BTreeMap::new();
    let mut manual = BTreeMap::new();
    let mut resolution_changes = BTreeMap::new();
    let mut resolved_or_stabilized = BTreeMap::new();

    for log in logs {
        let day = day_key(&log.created_at);
        increment_day(&mut resolution_changes, day.clone(), 1.0);

        match log.state {
            DeliveryResolutionState::Escalated => {
                increment_day(&mut escalated, day, 1.0);
            }
            DeliveryResolutionState::UnderManualIntervention => {
                increment_day(&mut manual, day, 1.0);
            }
            DeliveryResolutionState::Resolved | DeliveryResolutionState::Stabilized => {
                increment_day(&mut resolved_or_stabilized, day, 1.0);
            }
            DeliveryResolutionState::MonitoringOnly => {}
        }
    }

    let mut ratio_map = BTreeMap::new();
    for (day, total) in &resolution_changes {
        let good = resolved_or_stabilized.get(day).copied().unwrap_or(0.0);
        let ratio = if *total == 0.0 { 0.0 } else { good / *total };
        ratio_map.insert(day.clone(), ratio);
    }

    Ok(vec![
        crate::css_case_delivery_trends_view::types::DeliveryTrendSeries {
            key: "daily_escalated_count".into(),
            title: "每日 escalated 数".into(),
            label: "每日 escalated 数".into(),
            points: points_from_map(escalated),
        },
        crate::css_case_delivery_trends_view::types::DeliveryTrendSeries {
            key: "daily_manual_intervention_count".into(),
            title: "每日人工介入数".into(),
            label: "每日人工介入数".into(),
            points: points_from_map(manual),
        },
        crate::css_case_delivery_trends_view::types::DeliveryTrendSeries {
            key: "daily_resolution_change_count".into(),
            title: "每日 resolution 变化数".into(),
            label: "每日 resolution 变化数".into(),
            points: points_from_map(resolution_changes),
        },
        crate::css_case_delivery_trends_view::types::DeliveryTrendSeries {
            key: "daily_resolved_or_stabilized_ratio".into(),
            title: "resolved / stabilized 比例趋势".into(),
            label: "resolved / stabilized 比例趋势".into(),
            points: points_from_map(ratio_map),
        },
    ])
}

async fn build_retry_series(
    pool: &sqlx::PgPool,
) -> anyhow::Result<crate::css_case_delivery_trends_view::types::DeliveryTrendSeries> {
    let logs = crate::css_case_delivery_action_log::store_pg::list_all_delivery_action_logs(pool)
        .await
        .unwrap_or_default();

    let mut retry = BTreeMap::new();

    for log in logs {
        if log.success
            && matches!(
                log.action,
                crate::css_case_delivery_actions_engine::types::DeliveryActionKind::Retry
            )
        {
            increment_day(&mut retry, day_key(&log.created_at), 1.0);
        }
    }

    Ok(
        crate::css_case_delivery_trends_view::types::DeliveryTrendSeries {
            key: "daily_retry_count".into(),
            title: "每日 retry 数".into(),
            label: "每日 retry 数".into(),
            points: points_from_map(retry),
        },
    )
}

fn trim_points(
    points: Vec<crate::css_case_delivery_trends_view::types::DeliveryTrendPoint>,
    days: usize,
) -> Vec<crate::css_case_delivery_trends_view::types::DeliveryTrendPoint> {
    let len = points.len();
    if len <= days {
        points
    } else {
        points[len - days..].to_vec()
    }
}

pub async fn build_delivery_trends_view(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_trends_view::types::DeliveryTrendsViewRequest,
) -> anyhow::Result<crate::css_case_delivery_trends_view::types::CssCaseDeliveryTrendsView> {
    let mut series = build_resolution_series(pool).await?;
    series.push(build_retry_series(pool).await?);

    let days = req.days.unwrap_or(14).max(1);

    for item in &mut series {
        item.points = trim_points(std::mem::take(&mut item.points), days);
    }

    let summary = trends_summary(&series);

    Ok(crate::css_case_delivery_trends_view::types::CssCaseDeliveryTrendsView { summary, series })
}
