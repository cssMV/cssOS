use sha2::{Digest, Sha256};

pub fn subject_key(
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: &crate::css_case_delivery_log::types::CaseDeliveryLogMode,
) -> String {
    format!("delivery_object:{target:?}:{mode:?}").to_lowercase()
}

pub fn cache_key(
    req: &crate::css_case_delivery_signals_cache::types::GetDeliverySignalsCacheRequest,
) -> crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheKey {
    crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheKey {
        target: req.target.clone(),
        consecutive_failures: req.consecutive_failures,
        latest_failed: req.latest_failed,
    }
}

pub fn cache_key_hash(
    key: &crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheKey,
) -> anyhow::Result<String> {
    let bytes = serde_json::to_vec(key)?;
    let digest = Sha256::digest(bytes);
    Ok(format!("{digest:x}"))
}

fn view_request_from_legacy(
    req: &crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRequest,
) -> crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheViewRequest {
    let consecutive_failures =
        req.consecutive_failures
            .unwrap_or(if req.delivered { 0 } else { req.failure_streak });

    crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheViewRequest {
        target: crate::css_case_delivery_decision_trace::runtime::api_target_from_log_target(
            &req.target,
        ),
        consecutive_failures,
        latest_failed: !req.delivered,
    }
}

fn envelope_from_parts(
    trust: crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    risk: crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
    explain: crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
    assurance: crate::css_case_delivery_assurance_view::types::CssCaseDeliveryAssuranceView,
    hub: crate::css_case_delivery_signals_hub::types::CssCaseDeliverySignalsHubView,
    cached_at: String,
) -> crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheEnvelope {
    crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheEnvelope {
        trust,
        risk,
        explain,
        assurance,
        hub,
        cached_at,
    }
}

fn payload_from_envelope(
    envelope: &crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheEnvelope,
) -> crate::css_case_delivery_signals_cache::types::DeliverySignalsCachePayload {
    crate::css_case_delivery_signals_cache::types::DeliverySignalsCachePayload {
        trust: envelope.trust.clone(),
        risk: envelope.risk.clone(),
        explain: envelope.explain.clone(),
        assurance: envelope.assurance.clone(),
        hub: envelope.hub.clone(),
    }
}

fn envelope_view_from_parts(
    cache: crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRecord,
    envelope: crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheEnvelope,
) -> crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheEnvelopeView {
    crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheEnvelopeView {
        views: crate::css_case_delivery_signals_cache::types::DeliverySignalsCachedViews {
            trust: envelope.trust.clone(),
            risk: envelope.risk.clone(),
            explain: envelope.explain.clone(),
            assurance: envelope.assurance.clone(),
        },
        cache,
        envelope,
    }
}

async fn build_cache_envelope(
    pool: &sqlx::PgPool,
    req: &crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheViewRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheEnvelope> {
    let trust = crate::css_case_delivery_trust_view::runtime::build_delivery_trust_view(
        pool,
        crate::css_case_delivery_trust_view::types::DeliveryTrustViewRequest {
            target: req.target.clone(),
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    let risk = crate::css_case_delivery_risk_view::runtime::build_delivery_risk_view(
        pool,
        crate::css_case_delivery_risk_view::types::DeliveryRiskViewRequest {
            target: req.target.clone(),
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    let explain = crate::css_case_delivery_explain_view::runtime::build_delivery_explain_view(
        pool,
        crate::css_case_delivery_explain_view::types::DeliveryExplainViewRequest {
            target: req.target.clone(),
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    let assurance =
        crate::css_case_delivery_assurance_view::runtime::build_delivery_assurance_view(
            pool,
            crate::css_case_delivery_assurance_view::types::DeliveryAssuranceViewRequest {
                target: req.target.clone(),
                consecutive_failures: req.consecutive_failures,
                latest_failed: req.latest_failed,
            },
            now_rfc3339,
        )
        .await?;

    let hub = crate::css_case_delivery_signals_hub::runtime::build_delivery_signals_hub(
        pool,
        crate::css_case_delivery_signals_hub::types::DeliverySignalsHubViewRequest {
            target: req.target.clone(),
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    Ok(envelope_from_parts(
        trust,
        risk,
        explain,
        assurance,
        hub,
        now_rfc3339.to_string(),
    ))
}

pub async fn build_signals_cache_envelope(
    pool: &sqlx::PgPool,
    req: &crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheViewRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheEnvelope> {
    build_cache_envelope(pool, req, now_rfc3339).await
}

pub async fn build_signals_cache_envelope_from_legacy(
    pool: &sqlx::PgPool,
    req: &crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheEnvelope> {
    build_cache_envelope(pool, &view_request_from_legacy(req), now_rfc3339).await
}

pub fn build_cache_record(
    key: crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheKey,
    signals: crate::css_case_delivery_signals_hub::types::CssCaseDeliverySignalsHubView,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRecord> {
    let key_hash = cache_key_hash(&key)?;

    Ok(
        crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRecord {
            signals_cache_id: format!("cdsigc_{}", uuid::Uuid::new_v4()),
            cache_key: key,
            key_hash,
            signals,
            created_at: now_rfc3339.to_string(),
            updated_at: now_rfc3339.to_string(),
        },
    )
}

pub async fn refresh_delivery_signals_cache(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_cache::types::RefreshDeliverySignalsCacheRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRecord> {
    let get_req = crate::css_case_delivery_signals_cache::types::GetDeliverySignalsCacheRequest {
        target: req.target.clone(),
        consecutive_failures: req.consecutive_failures,
        latest_failed: req.latest_failed,
    };
    let key = cache_key(&get_req);

    let signals = crate::css_case_delivery_signals_hub::runtime::build_delivery_signals_hub(
        pool,
        crate::css_case_delivery_signals_hub::types::DeliverySignalsHubViewRequest {
            target: req.target,
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    let record = build_cache_record(key, signals, now_rfc3339)?;
    crate::css_case_delivery_signals_cache::store_pg::upsert_delivery_signals_cache(pool, &record)
        .await?;
    Ok(record)
}

pub async fn refresh_delivery_signals_cache_from_legacy(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_signals_cache::types::DeliverySignalsLegacyRecord> {
    let view_req = view_request_from_legacy(&req);
    let formal = refresh_delivery_signals_cache(
        pool,
        crate::css_case_delivery_signals_cache::types::RefreshDeliverySignalsCacheRequest {
            target: view_req.target.clone(),
            consecutive_failures: view_req.consecutive_failures,
            latest_failed: view_req.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    let envelope = build_cache_envelope(pool, &view_req, now_rfc3339).await?;

    Ok(
        crate::css_case_delivery_signals_cache::types::DeliverySignalsLegacyRecord {
            cache_id: formal.signals_cache_id,
            key: crate::css_case_delivery_signals_cache::types::DeliverySignalsLegacyKey {
                target: req.target,
                mode: req.mode,
            },
            payload: payload_from_envelope(&envelope),
            updated_at: formal.updated_at,
        },
    )
}

pub async fn refresh_signals_cache(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_signals_cache::types::CssCaseDeliverySignalsCacheRecord>
{
    let record = refresh_delivery_signals_cache(
        pool,
        crate::css_case_delivery_signals_cache::types::RefreshDeliverySignalsCacheRequest {
            target: view_request_from_legacy(&req).target,
            consecutive_failures: view_request_from_legacy(&req).consecutive_failures,
            latest_failed: view_request_from_legacy(&req).latest_failed,
        },
        now_rfc3339,
    )
    .await?;
    crate::css_case_delivery_signals_cache::store_pg::raw_record_from_delivery_signals_cache_record(
        record,
    )
}

pub async fn get_delivery_signals_cache(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_cache::types::GetDeliverySignalsCacheRequest,
) -> anyhow::Result<Option<crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRecord>>
{
    let key = cache_key(&req);
    let key_hash = cache_key_hash(&key)?;
    crate::css_case_delivery_signals_cache::store_pg::get_delivery_signals_cache_by_hash(
        pool, &key_hash,
    )
    .await
}

pub async fn get_delivery_signals_cache_from_legacy(
    pool: &sqlx::PgPool,
    target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
) -> anyhow::Result<
    Option<crate::css_case_delivery_signals_cache::types::DeliverySignalsLegacyRecord>,
> {
    crate::css_case_delivery_signals_cache::store_pg::get_delivery_signals_cache_by_subject_key(
        pool,
        &subject_key(&target, &mode),
    )
    .await
}

pub async fn get_signals_cache(
    pool: &sqlx::PgPool,
    target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
) -> anyhow::Result<
    Option<crate::css_case_delivery_signals_cache::types::CssCaseDeliverySignalsCacheRecord>,
> {
    crate::css_case_delivery_signals_cache::store_pg::get_signals_cache_by_subject_key(
        pool,
        &subject_key(&target, &mode),
    )
    .await
}

pub async fn get_signals_cache_envelope(
    pool: &sqlx::PgPool,
    target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
) -> anyhow::Result<
    Option<crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheEnvelope>,
> {
    let record = get_delivery_signals_cache_from_legacy(pool, target, mode).await?;

    Ok(record.map(|record| {
        envelope_from_parts(
            record.payload.trust,
            record.payload.risk,
            record.payload.explain,
            record.payload.assurance,
            record.payload.hub,
            record.updated_at,
        )
    }))
}

pub async fn get_or_build_delivery_signals_cache(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_cache::types::GetDeliverySignalsCacheRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRecord> {
    if let Some(record) = get_delivery_signals_cache(pool, req.clone()).await? {
        return Ok(record);
    }

    refresh_delivery_signals_cache(
        pool,
        crate::css_case_delivery_signals_cache::types::RefreshDeliverySignalsCacheRequest {
            target: req.target,
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await
}

pub async fn get_or_build_signals_cache_envelope(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheEnvelope> {
    if let Some(cached) =
        get_signals_cache_envelope(pool, req.target.clone(), req.mode.clone()).await?
    {
        return Ok(cached);
    }

    build_signals_cache_envelope_from_legacy(pool, &req, now_rfc3339).await
}

pub async fn get_or_build_signals_cache_envelope_view(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_cache::types::GetDeliverySignalsCacheRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheEnvelopeView>
{
    let cache = get_or_build_delivery_signals_cache(pool, req.clone(), now_rfc3339).await?;
    let envelope = envelope_from_parts(
        crate::css_case_delivery_trust_view::runtime::build_delivery_trust_view(
            pool,
            crate::css_case_delivery_trust_view::types::DeliveryTrustViewRequest {
                target: req.target.clone(),
                consecutive_failures: req.consecutive_failures,
                latest_failed: req.latest_failed,
            },
            now_rfc3339,
        )
        .await?,
        crate::css_case_delivery_risk_view::runtime::build_delivery_risk_view(
            pool,
            crate::css_case_delivery_risk_view::types::DeliveryRiskViewRequest {
                target: req.target.clone(),
                consecutive_failures: req.consecutive_failures,
                latest_failed: req.latest_failed,
            },
            now_rfc3339,
        )
        .await?,
        crate::css_case_delivery_explain_view::runtime::build_delivery_explain_view(
            pool,
            crate::css_case_delivery_explain_view::types::DeliveryExplainViewRequest {
                target: req.target.clone(),
                consecutive_failures: req.consecutive_failures,
                latest_failed: req.latest_failed,
            },
            now_rfc3339,
        )
        .await?,
        crate::css_case_delivery_assurance_view::runtime::build_delivery_assurance_view(
            pool,
            crate::css_case_delivery_assurance_view::types::DeliveryAssuranceViewRequest {
                target: req.target,
                consecutive_failures: req.consecutive_failures,
                latest_failed: req.latest_failed,
            },
            now_rfc3339,
        )
        .await?,
        cache.signals.clone(),
        cache.updated_at.clone(),
    );

    Ok(envelope_view_from_parts(cache, envelope))
}

pub async fn get_or_refresh_delivery_signals_cache(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_signals_cache::types::DeliverySignalsLegacyRecord> {
    if let Some(existing) =
        get_delivery_signals_cache_from_legacy(pool, req.target.clone(), req.mode.clone()).await?
    {
        return Ok(existing);
    }

    refresh_delivery_signals_cache_from_legacy(pool, req, now_rfc3339).await
}
