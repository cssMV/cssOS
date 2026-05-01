use crate::css_case_delivery_ops_health::types::{
    CssCaseDeliveryOpsHealthReport, DeliveryOpsHealthReason, DeliveryOpsHealthRequest,
    DeliveryOpsHealthStatus, DeliveryOpsProbeCheck, DeliveryOpsProbeStatus,
};
use crate::css_case_delivery_subscription_engine::types::DeliverySubscriptionStatus;

fn status_from_counts(
    alert_count: usize,
    pending_recovery_count: usize,
    still_failing_count: usize,
    recent_failed_log_count: usize,
) -> DeliveryOpsHealthStatus {
    if still_failing_count > 0 || recent_failed_log_count >= 3 {
        DeliveryOpsHealthStatus::Blocked
    } else if alert_count > 0 || pending_recovery_count > 0 || recent_failed_log_count > 0 {
        DeliveryOpsHealthStatus::Degraded
    } else {
        DeliveryOpsHealthStatus::Healthy
    }
}

fn title_for_status(status: &DeliveryOpsHealthStatus) -> &'static str {
    match status {
        DeliveryOpsHealthStatus::Healthy => "交付运营健康正常",
        DeliveryOpsHealthStatus::Degraded => "交付运营存在风险",
        DeliveryOpsHealthStatus::Blocked => "交付运营需要立即处理",
    }
}

fn summary_for_status(
    status: &DeliveryOpsHealthStatus,
    alert_count: usize,
    pending_recovery_count: usize,
    still_failing_count: usize,
    recent_failed_log_count: usize,
) -> String {
    match status {
        DeliveryOpsHealthStatus::Healthy => format!(
            "当前交付运营整体平稳。alerts={}，pending_recovery={}，recent_failed_logs={}",
            alert_count, pending_recovery_count, recent_failed_log_count
        ),
        DeliveryOpsHealthStatus::Degraded => format!(
            "当前交付运营可继续运行，但需要关注恢复与预警。alerts={}，pending_recovery={}，recent_failed_logs={}",
            alert_count, pending_recovery_count, recent_failed_log_count
        ),
        DeliveryOpsHealthStatus::Blocked => format!(
            "当前交付运营存在阻塞风险。still_failing={}，alerts={}，recent_failed_logs={}",
            still_failing_count, alert_count, recent_failed_log_count
        ),
    }
}

fn build_reasons(
    queue_count: usize,
    alert_count: usize,
    pending_recovery_count: usize,
    still_failing_count: usize,
    recent_failed_log_count: usize,
    active_subscription_count: usize,
) -> Vec<DeliveryOpsHealthReason> {
    let mut reasons = vec![DeliveryOpsHealthReason {
        label: "Queue coverage".into(),
        summary: format!(
            "当前可见 {} 个交付队列，{} 个活跃订阅正在被运营面板覆盖。",
            queue_count, active_subscription_count
        ),
    }];

    if alert_count > 0 {
        reasons.push(DeliveryOpsHealthReason {
            label: "Alert pressure".into(),
            summary: format!(
                "当前检测到 {} 条实时预警，建议优先复核告警标题和异常摘要。",
                alert_count
            ),
        });
    }

    if pending_recovery_count > 0 {
        reasons.push(DeliveryOpsHealthReason {
            label: "Recovery queue".into(),
            summary: format!(
                "恢复队列中仍有 {} 个待处理项，需要继续跟进。",
                pending_recovery_count
            ),
        });
    }

    if still_failing_count > 0 {
        reasons.push(DeliveryOpsHealthReason {
            label: "Still failing".into(),
            summary: format!(
                "有 {} 个对象在重试后仍失败，已经进入阻塞风险区。",
                still_failing_count
            ),
        });
    }

    if recent_failed_log_count > 0 {
        reasons.push(DeliveryOpsHealthReason {
            label: "Failure log pressure".into(),
            summary: format!(
                "最近日志中有 {} 条失败记录，建议检查失败模式是否集中。",
                recent_failed_log_count
            ),
        });
    }

    reasons
}

fn build_probe_checks(
    queue_count: usize,
    alert_count: usize,
    pending_recovery_count: usize,
    still_failing_count: usize,
    recent_failed_log_count: usize,
    active_subscription_count: usize,
) -> Vec<DeliveryOpsProbeCheck> {
    let mut checks = vec![DeliveryOpsProbeCheck {
        key: "api_runtime".into(),
        label: "API runtime".into(),
        status: DeliveryOpsProbeStatus::Pass,
        summary: "Ops health report completed successfully and returned a live snapshot.".into(),
    }];

    checks.push(DeliveryOpsProbeCheck {
        key: "queue_visibility".into(),
        label: "Queue visibility".into(),
        status: if queue_count == 0 {
            DeliveryOpsProbeStatus::Fail
        } else {
            DeliveryOpsProbeStatus::Pass
        },
        summary: if queue_count == 0 {
            "No delivery queues are currently visible to the ops console.".into()
        } else {
            format!(
                "{} delivery queues are visible in the current ops snapshot.",
                queue_count
            )
        },
    });

    checks.push(DeliveryOpsProbeCheck {
        key: "subscription_coverage".into(),
        label: "Subscription coverage".into(),
        status: if active_subscription_count > 0 && queue_count == 0 {
            DeliveryOpsProbeStatus::Fail
        } else if active_subscription_count == 0 {
            DeliveryOpsProbeStatus::Warn
        } else {
            DeliveryOpsProbeStatus::Pass
        },
        summary: if active_subscription_count > 0 && queue_count == 0 {
            format!(
                "{} active subscriptions exist but no delivery queues are visible.",
                active_subscription_count
            )
        } else if active_subscription_count == 0 {
            "No active delivery subscriptions are currently being monitored.".into()
        } else {
            format!(
                "{} active subscriptions are covered by the current ops console snapshot.",
                active_subscription_count
            )
        },
    });

    checks.push(DeliveryOpsProbeCheck {
        key: "recovery_backlog".into(),
        label: "Recovery backlog".into(),
        status: if still_failing_count > 0 {
            DeliveryOpsProbeStatus::Fail
        } else if pending_recovery_count > 0 {
            DeliveryOpsProbeStatus::Warn
        } else {
            DeliveryOpsProbeStatus::Pass
        },
        summary: if still_failing_count > 0 {
            format!(
                "{} recovery items are still failing after retry and need operator action.",
                still_failing_count
            )
        } else if pending_recovery_count > 0 {
            format!(
                "{} recovery items are still pending and should be reviewed soon.",
                pending_recovery_count
            )
        } else {
            "Recovery queue is currently clear.".into()
        },
    });

    checks.push(DeliveryOpsProbeCheck {
        key: "failure_pressure".into(),
        label: "Failure pressure".into(),
        status: if recent_failed_log_count >= 3 {
            DeliveryOpsProbeStatus::Fail
        } else if recent_failed_log_count > 0 || alert_count > 0 {
            DeliveryOpsProbeStatus::Warn
        } else {
            DeliveryOpsProbeStatus::Pass
        },
        summary: if recent_failed_log_count >= 3 {
            format!(
                "{} recent failed logs indicate concentrated delivery pressure.",
                recent_failed_log_count
            )
        } else if recent_failed_log_count > 0 || alert_count > 0 {
            format!(
                "Recent failed logs={}, active alerts={}; keep watching the current delivery window.",
                recent_failed_log_count, alert_count
            )
        } else {
            "No recent failed-log pressure or active alerts were detected.".into()
        },
    });

    checks
}

fn build_suggested_actions(
    status: &DeliveryOpsHealthStatus,
    still_failing_count: usize,
    alert_count: usize,
    pending_recovery_count: usize,
) -> Vec<String> {
    let mut actions = Vec::new();

    if matches!(status, DeliveryOpsHealthStatus::Blocked) {
        actions.push("优先检查仍失败的恢复项，并执行定向重试或人工接管。".into());
    }
    if alert_count > 0 {
        actions.push("逐条确认预警是否仍然活跃，并同步异常影响范围。".into());
    }
    if pending_recovery_count > 0 {
        actions.push("清理恢复队列，确认待恢复对象是否已经被最新执行覆盖。".into());
    }
    if still_failing_count == 0 && alert_count == 0 && pending_recovery_count == 0 {
        actions.push("维持当前巡检节奏，并继续观察最新交付日志。".into());
    }

    actions
}

pub async fn build_delivery_ops_health(
    pool: &sqlx::PgPool,
    req: DeliveryOpsHealthRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryOpsHealthReport> {
    let preview_limit = req.preview_limit.or(Some(6));
    let recovery_limit = req.recovery_limit.or(Some(8));
    let ops_console = crate::css_case_delivery_ops_console::runtime::build_delivery_ops_console(
        pool,
        crate::css_case_delivery_ops_console::types::DeliveryOpsConsoleRequest {
            preview_limit,
            recovery_limit,
            days: req.days,
        },
    )
    .await?;

    let subscriptions =
        crate::css_case_delivery_subscription_engine::store_pg::list_delivery_subscriptions(pool)
            .await?;
    let logs = crate::css_case_delivery_log::store_pg::list_all_delivery_logs(pool).await?;

    let subscription_count = subscriptions.len();
    let active_subscription_count = subscriptions
        .iter()
        .filter(|item| matches!(item.status, DeliverySubscriptionStatus::Active))
        .count();
    let queue_count = ops_console.dashboard.metrics.len();
    let alert_count = ops_console.alerts.alerts.len();
    let pending_recovery_count = ops_console.recovery.summary.pending_recovery_count;
    let still_failing_count = ops_console.recovery.summary.still_failing_count;
    let recent_failed_log_count = logs.iter().take(12).filter(|item| !item.succeeded).count();
    let status = status_from_counts(
        alert_count,
        pending_recovery_count,
        still_failing_count,
        recent_failed_log_count,
    );
    let probe_checks = build_probe_checks(
        queue_count,
        alert_count,
        pending_recovery_count,
        still_failing_count,
        recent_failed_log_count,
        active_subscription_count,
    );

    Ok(CssCaseDeliveryOpsHealthReport {
        title: title_for_status(&status).into(),
        summary: summary_for_status(
            &status,
            alert_count,
            pending_recovery_count,
            still_failing_count,
            recent_failed_log_count,
        ),
        status: status.clone(),
        checked_at: now_rfc3339.to_string(),
        api_status: "ok".into(),
        subscription_count,
        active_subscription_count,
        queue_count,
        alert_count,
        pending_recovery_count,
        still_failing_count,
        recent_failed_log_count,
        probe_checks,
        reasons: build_reasons(
            queue_count,
            alert_count,
            pending_recovery_count,
            still_failing_count,
            recent_failed_log_count,
            active_subscription_count,
        ),
        suggested_actions: build_suggested_actions(
            &status,
            still_failing_count,
            alert_count,
            pending_recovery_count,
        ),
    })
}
