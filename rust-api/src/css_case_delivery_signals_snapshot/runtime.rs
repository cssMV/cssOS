use sha2::{Digest, Sha256};

pub fn subject_key(
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: &crate::css_case_delivery_log::types::CaseDeliveryLogMode,
) -> String {
    crate::css_case_delivery_signals_cache::runtime::subject_key(target, mode)
}

pub fn snapshot_key(
    req: &crate::css_case_delivery_signals_snapshot::types::CaptureDeliverySignalsSnapshotRequest,
) -> crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotKey {
    crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotKey {
        target: req.target.clone(),
        consecutive_failures: req.consecutive_failures,
        latest_failed: req.latest_failed,
    }
}

pub fn snapshot_key_hash(
    key: &crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotKey,
) -> anyhow::Result<String> {
    let bytes = serde_json::to_vec(key)?;
    let digest = Sha256::digest(bytes);
    Ok(format!("{digest:x}"))
}

fn capture_request_from_legacy(
    req: &crate::css_case_delivery_signals_snapshot::types::CreateDeliverySignalsSnapshotRequest,
) -> crate::css_case_delivery_signals_snapshot::types::CaptureDeliverySignalsSnapshotRequest {
    crate::css_case_delivery_signals_snapshot::types::CaptureDeliverySignalsSnapshotRequest {
        target: crate::css_case_delivery_decision_trace::runtime::api_target_from_log_target(
            &req.target,
        ),
        consecutive_failures: req.consecutive_failures.unwrap_or(if req.delivered {
            0
        } else {
            req.failure_streak
        }),
        latest_failed: !req.delivered,
        reason: req.reason.clone(),
    }
}

fn payload_to_envelope(
    payload: crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotPayload,
) -> crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope {
    crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope {
        trust: payload.trust,
        risk: payload.risk,
        explain: payload.explain,
        assurance: payload.assurance,
        signals: payload.hub,
    }
}

fn envelope_from_cache(
    envelope: crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheEnvelope,
) -> crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope {
    crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope {
        trust: envelope.trust,
        risk: envelope.risk,
        explain: envelope.explain,
        assurance: envelope.assurance,
        signals: envelope.hub,
    }
}

async fn build_snapshot_envelope(
    pool: &sqlx::PgPool,
    req: &crate::css_case_delivery_signals_snapshot::types::CaptureDeliverySignalsSnapshotRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope>
{
    let envelope = crate::css_case_delivery_signals_cache::runtime::build_signals_cache_envelope(
        pool,
        &crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheViewRequest {
            target: req.target.clone(),
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    Ok(envelope_from_cache(envelope))
}

pub fn build_delivery_signals_snapshot_record(
    key: crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotKey,
    reason: crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotReason,
    signals: crate::css_case_delivery_signals_hub::types::CssCaseDeliverySignalsHubView,
    created_at: &str,
) -> anyhow::Result<
    crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord,
> {
    let snapshot_id = format!("cdsigsnap_{}", uuid::Uuid::new_v4());
    let snapshot_key_hash = snapshot_key_hash(&key)?;

    Ok(crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord {
        signals_snapshot_id: snapshot_id.clone(),
        snapshot_id,
        subject_kind:
            crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotSubjectKind::DeliveryObject,
        subject_key: snapshot_key_hash.clone(),
        snapshot_key_json: serde_json::to_value(&key)?,
        snapshot_key: key,
        snapshot_key_hash,
        reason,
        signals_json: serde_json::to_value(&signals)?,
        payload_json: serde_json::to_value(&signals)?,
        created_at: created_at.to_string(),
    })
}

fn raw_record_from_envelope(
    key: crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotKey,
    reason: crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotReason,
    envelope: crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope,
    created_at: &str,
    subject: Option<
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotSubject,
    >,
) -> anyhow::Result<
    crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord,
> {
    let snapshot_id = format!("cdsigsnap_{}", uuid::Uuid::new_v4());
    let snapshot_key_hash = snapshot_key_hash(&key)?;
    let subject_key = subject
        .as_ref()
        .map(|item| subject_key(&item.target, &item.mode))
        .unwrap_or_else(|| snapshot_key_hash.clone());

    Ok(crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord {
        signals_snapshot_id: snapshot_id.clone(),
        snapshot_id,
        subject_kind:
            crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotSubjectKind::DeliveryObject,
        subject_key,
        snapshot_key_json: serde_json::to_value(&key)?,
        snapshot_key: key,
        snapshot_key_hash,
        reason,
        signals_json: serde_json::to_value(&envelope.signals)?,
        payload_json: serde_json::to_value(&envelope)?,
        created_at: created_at.to_string(),
    })
}

fn logical_record_from_raw(
    record: crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord,
) -> anyhow::Result<
    crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotLogicalRecord,
> {
    let envelope = parse_envelope_from_raw(&record)?;

    let subject = parse_subject_from_raw(&record);

    Ok(
        crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotLogicalRecord {
            signals_snapshot_id: record.signals_snapshot_id.clone(),
            snapshot_id: record.snapshot_id,
            subject,
            snapshot_key: record.snapshot_key,
            reason: record.reason,
            signals: envelope.signals.clone(),
            envelope,
            created_at: record.created_at,
        },
    )
}

fn parse_subject_from_raw(
    record: &crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord,
) -> Option<crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotSubject> {
    let parts = record.subject_key.split(':').collect::<Vec<_>>();
    if parts.len() != 3 {
        return None;
    }

    let target = match parts[1] {
        "reportbundle" | "report_bundle" => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::ReportBundle
        }
        "dashboard" => crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Dashboard,
        "kpi" => crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Kpi,
        "analytics" => crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Analytics,
        "trends" => crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Trends,
        "alerts" => crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Alerts,
        "digest" => crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Digest,
        "briefingpack" | "briefing_pack" | "briefing" => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Briefing
        }
        _ => return None,
    };

    let mode = match parts[2] {
        "download" => crate::css_case_delivery_log::types::CaseDeliveryLogMode::Download,
        "attachment" => crate::css_case_delivery_log::types::CaseDeliveryLogMode::Attachment,
        "robotpull" | "robot_pull" => {
            crate::css_case_delivery_log::types::CaseDeliveryLogMode::RobotPull
        }
        "apibundle" | "api_bundle" => {
            crate::css_case_delivery_log::types::CaseDeliveryLogMode::ApiBundle
        }
        _ => return None,
    };

    Some(
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotSubject {
            target,
            mode,
        },
    )
}

pub fn parse_envelope_from_raw(
    record: &crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord,
) -> anyhow::Result<crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope>
{
    if let Ok(envelope) = serde_json::from_value::<
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope,
    >(record.payload_json.clone())
    {
        return Ok(envelope);
    }

    let payload = serde_json::from_value::<
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotPayload,
    >(record.payload_json.clone())?;

    Ok(payload_to_envelope(payload))
}

pub async fn capture_delivery_signals_snapshot(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_snapshot::types::CaptureDeliverySignalsSnapshotRequest,
    now_rfc3339: &str,
) -> anyhow::Result<
    crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotLogicalRecord,
> {
    let key = snapshot_key(&req);
    let envelope = build_snapshot_envelope(pool, &req, now_rfc3339).await?;
    let raw = raw_record_from_envelope(key, req.reason, envelope, now_rfc3339, None)?;

    crate::css_case_delivery_signals_snapshot::store_pg::insert_delivery_signals_snapshot(
        pool, &raw,
    )
    .await?;

    logical_record_from_raw(raw)
}

pub async fn create_signals_snapshot(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_snapshot::types::CreateDeliverySignalsSnapshotRequest,
    now_rfc3339: &str,
) -> anyhow::Result<
    crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord,
> {
    let formal_req = capture_request_from_legacy(&req);
    let key = snapshot_key(&formal_req);
    let envelope = build_snapshot_envelope(pool, &formal_req, now_rfc3339).await?;
    let raw = raw_record_from_envelope(
        key,
        req.reason,
        envelope,
        now_rfc3339,
        Some(
            crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotSubject {
                target: req.target,
                mode: req.mode,
            },
        ),
    )?;

    crate::css_case_delivery_signals_snapshot::store_pg::insert_delivery_signals_snapshot(
        pool, &raw,
    )
    .await?;

    Ok(raw)
}

pub async fn get_signals_snapshot(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_snapshot::types::GetDeliverySignalsSnapshotRequest,
) -> anyhow::Result<
    Option<crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord>,
> {
    crate::css_case_delivery_signals_snapshot::store_pg::get_delivery_signals_snapshot(
        pool,
        &req.snapshot_id,
    )
    .await
}

pub async fn get_signals_snapshot_envelope(
    pool: &sqlx::PgPool,
    snapshot_id: &str,
) -> anyhow::Result<
    Option<crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope>,
> {
    match crate::css_case_delivery_signals_snapshot::store_pg::get_delivery_signals_snapshot(
        pool,
        snapshot_id,
    )
    .await?
    {
        Some(record) => Ok(Some(parse_envelope_from_raw(&record)?)),
        None => Ok(None),
    }
}

pub async fn list_delivery_signals_snapshot_history(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotQueryRequest,
) -> anyhow::Result<
    Vec<crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotLogicalRecord>,
>{
    let mut items =
        crate::css_case_delivery_signals_snapshot::store_pg::list_delivery_signals_snapshots_for_subject(
            pool,
            &req.target,
            &req.mode,
        )
        .await
        .unwrap_or_default();

    items.truncate(req.limit.unwrap_or(20));
    Ok(items)
}

pub fn diff_delivery_signals_snapshots(
    from: &crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord,
    to: &crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord,
) -> anyhow::Result<
    crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotDiff,
> {
    use crate::css_case_delivery_signals_snapshot::types::{
        CssCaseDeliverySignalsSnapshotDiff, DeliverySignalsSnapshotDiffItem,
    };

    let from_env = parse_envelope_from_raw(from)?;
    let to_env = parse_envelope_from_raw(to)?;
    let mut changes = Vec::new();

    macro_rules! push_change {
        ($field:expr, $before:expr, $after:expr) => {
            if $before != $after {
                changes.push(DeliverySignalsSnapshotDiffItem {
                    field: $field.into(),
                    before: $before,
                    after: $after,
                });
            }
        };
    }

    push_change!(
        "governance.severity",
        from_env.signals.governance.severity.clone(),
        to_env.signals.governance.severity.clone()
    );
    push_change!(
        "trust.trust_level",
        to_lower_debug(&from_env.trust.trust_level),
        to_lower_debug(&to_env.trust.trust_level)
    );
    push_change!(
        "risk.risk_level",
        to_lower_debug(&from_env.risk.risk_level),
        to_lower_debug(&to_env.risk.risk_level)
    );
    push_change!(
        "assurance.assurance_level",
        to_lower_debug(&from_env.assurance.assurance_level),
        to_lower_debug(&to_env.assurance.assurance_level)
    );
    push_change!(
        "trust.is_trusted",
        from_env.trust.is_trusted.to_string(),
        to_env.trust.is_trusted.to_string()
    );
    push_change!(
        "risk.is_high_risk",
        from_env.risk.is_high_risk.to_string(),
        to_env.risk.is_high_risk.to_string()
    );
    push_change!(
        "assurance.requires_manual_intervention",
        from_env.assurance.requires_manual_intervention.to_string(),
        to_env.assurance.requires_manual_intervention.to_string()
    );
    push_change!(
        "assurance.requires_recovery",
        from_env
            .assurance
            .is_in_mandatory_recovery_queue
            .to_string(),
        to_env.assurance.is_in_mandatory_recovery_queue.to_string()
    );

    Ok(CssCaseDeliverySignalsSnapshotDiff {
        from_snapshot_id: from.snapshot_id.clone(),
        to_snapshot_id: to.snapshot_id.clone(),
        changes,
    })
}

fn to_lower_debug<T: std::fmt::Debug>(value: &T) -> String {
    format!("{value:?}").to_lowercase()
}
