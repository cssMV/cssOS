use axum::{
    extract::rejection::JsonRejection,
    extract::{Extension, Json, Path, Query},
    http::HeaderMap,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use base64::Engine;
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::cmp::Reverse;
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;
use utoipa::ToSchema;

use crate::cssapi::error::ApiError;
use crate::cssapi::error_map::map_io;
#[allow(unused_imports)]
use crate::cssapi::problem::Problem;
use crate::cssapi::response::ApiResult;
use crate::dag::topo_order_for_state;
use crate::events;
use crate::run_state::{RetryPolicy, RunConfig, RunState, RunStatus, StageRecord, StageStatus};
use crate::schema_keys::{video_shot_stage_key, VIDEO_ASSEMBLE_STAGE, VIDEO_PLAN_STAGE};
use crate::{jobs, metrics, ready, run_store, runner};

fn env_u64(k: &str, d: u64) -> u64 {
    std::env::var(k)
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(d)
}
fn env_usize(k: &str, d: usize) -> usize {
    std::env::var(k)
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(d)
}
fn env_u32(k: &str, d: u32) -> u32 {
    std::env::var(k)
        .ok()
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(d)
}
fn env_f64(k: &str, d: f64) -> f64 {
    std::env::var(k)
        .ok()
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(d)
}

fn read_json_if_exists<T: for<'de> Deserialize<'de>>(path: &std::path::Path) -> Option<T> {
    let bytes = fs::read(path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn encode_delivery_file_url(run_id: &str, path: &str) -> String {
    let enc = utf8_percent_encode(path, NON_ALPHANUMERIC).to_string();
    format!(
        "/cssapi/v1/runs/{}/music-delivery-artifact?path={}",
        run_id, enc
    )
}

fn guess_delivery_mime(path: &str) -> String {
    let s = path.to_ascii_lowercase();
    if s.ends_with(".wav") {
        return "audio/wav".to_string();
    }
    if s.ends_with(".json") {
        return "application/json".to_string();
    }
    if s.ends_with(".zip") {
        return "application/zip".to_string();
    }
    if s.ends_with(".txt") {
        return "text/plain; charset=utf-8".to_string();
    }
    "application/octet-stream".to_string()
}

fn safe_run_relative_path(run_dir: &std::path::Path, raw_path: &str) -> Option<PathBuf> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return None;
    }
    let rel = trimmed.trim_start_matches("./");
    let joined = run_dir.join(rel);
    let canonical_run_dir = fs::canonicalize(run_dir).ok()?;
    let canonical_file = fs::canonicalize(&joined).ok()?;
    if canonical_file.starts_with(&canonical_run_dir) {
        Some(canonical_file)
    } else {
        None
    }
}

fn push_delivery_asset(
    run_id: &str,
    run_dir: &std::path::Path,
    category: &str,
    label: &str,
    relative_path: &str,
    out: &mut Vec<RunMusicDeliveryArtifactLink>,
) {
    let exists = safe_run_relative_path(run_dir, relative_path)
        .and_then(|p| fs::metadata(p).ok())
        .filter(|m| m.is_file())
        .map(|m| m.len())
        .map(|bytes| {
            out.push(RunMusicDeliveryArtifactLink {
                category: category.to_string(),
                label: label.to_string(),
                relative_path: relative_path.to_string(),
                mime: guess_delivery_mime(relative_path),
                bytes,
                download_url: encode_delivery_file_url(run_id, relative_path),
            });
        })
        .is_some();
    let _ = exists;
}

fn collect_directory_delivery_assets(
    run_id: &str,
    run_dir: &std::path::Path,
    category: &str,
    relative_dir: &str,
    out: &mut Vec<RunMusicDeliveryArtifactLink>,
) {
    let scan_root = run_dir.join(relative_dir.trim_start_matches("./"));
    let Ok(entries) = fs::read_dir(&scan_root) else {
        return;
    };
    let mut files = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let meta = entry.metadata().ok()?;
            if !meta.is_file() || meta.len() == 0 {
                return None;
            }
            let rel = path
                .strip_prefix(run_dir)
                .ok()
                .or_else(|| path.strip_prefix(&scan_root).ok())
                .map(|p| {
                    if p == path {
                        p.to_string_lossy().to_string()
                    } else if path.starts_with(&scan_root) {
                        let base = relative_dir.trim_start_matches("./").trim_end_matches('/');
                        format!("{}/{}", base, p.to_string_lossy())
                    } else {
                        p.to_string_lossy().to_string()
                    }
                })?;
            Some((rel, meta.len()))
        })
        .collect::<Vec<_>>();
    files.sort_by(|a, b| a.0.cmp(&b.0));
    for (rel, bytes) in files {
        let label = std::path::Path::new(&rel)
            .file_name()
            .and_then(|x| x.to_str())
            .unwrap_or("artifact")
            .to_string();
        out.push(RunMusicDeliveryArtifactLink {
            category: category.to_string(),
            label,
            relative_path: format!("./{}", rel),
            mime: guess_delivery_mime(&rel),
            bytes,
            download_url: encode_delivery_file_url(run_id, &format!("./{}", rel)),
        });
    }
}

fn rewrite_bundle_relative_dir() -> &'static str {
    "./build/rewrite_bundles"
}

fn watch_snapshot_relative_dir() -> &'static str {
    "./build/watch_snapshots"
}

fn rewrite_promotion_relative_dir() -> &'static str {
    "./build/rewrite_promotions"
}

fn rewrite_execution_queue_relative_dir() -> &'static str {
    "./build/rewrite_execution_queue"
}

fn rewrite_job_status_relative_dir() -> &'static str {
    "./build/rewrite_job_status"
}

fn rewrite_apply_back_relative_dir() -> &'static str {
    "./build/rewrite_apply_back"
}

fn rewrite_revision_relative_dir() -> &'static str {
    "./build/rewrite_revisions"
}

fn arrangement_revision_manifest_path(run_id: &str) -> std::path::PathBuf {
    run_store::run_dir(run_id)
        .join("build")
        .join("arrangement_revision_manifest.json")
}

fn arrangement_release_candidate_manifest_path(run_id: &str) -> std::path::PathBuf {
    run_store::run_dir(run_id)
        .join("build")
        .join("arrangement_release_candidates.json")
}

fn arrangement_release_relative_dir() -> &'static str {
    "./build/arrangement_releases"
}

fn compliance_ops_relative_dir() -> &'static str {
    "./build/compliance_ops"
}

fn arrangement_release_dir(run_id: &str, candidate_id: &str) -> std::path::PathBuf {
    run_store::run_dir(run_id)
        .join("build")
        .join("arrangement_releases")
        .join(candidate_id)
}

fn bundle_version_name(bundle: &Value, bundle_id: &str) -> String {
    bundle
        .get("version_name")
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| bundle_id.to_string())
}

fn write_json_pretty(path: &std::path::Path, value: &Value) -> std::io::Result<()> {
    run_store::ensure_dir_path(path)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
    let bytes = serde_json::to_vec_pretty(value)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()))?;
    fs::write(path, bytes)
}

fn sanitize_compliance_slug(input: &str, fallback: &str) -> String {
    let slug = input
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() {
        fallback.to_string()
    } else {
        slug
    }
}

fn read_latest_compliance_artifact(run_id: &str, prefix: &str) -> Option<Value> {
    let dir =
        run_store::run_dir(run_id).join(compliance_ops_relative_dir().trim_start_matches("./"));
    let mut entries = fs::read_dir(dir)
        .ok()?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .file_type()
                .map(|kind| kind.is_file())
                .unwrap_or(false)
        })
        .filter(|entry| entry.file_name().to_string_lossy().starts_with(prefix))
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| Reverse(entry.file_name()));
    entries
        .into_iter()
        .find_map(|entry| read_json_if_exists::<Value>(&entry.path()))
}

fn compliance_signature(secret: &str, payload: &Value) -> String {
    let mut hasher = Sha256::new();
    hasher.update(secret.as_bytes());
    hasher.update(b":");
    hasher.update(payload.to_string().as_bytes());
    let digest = hasher.finalize();
    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest {
        out.push_str(&format!("{:02x}", byte));
    }
    out
}

fn parse_compliance_secret_keyset(raw: Option<String>) -> Vec<(String, String)> {
    raw.unwrap_or_default()
        .split(',')
        .filter_map(|entry| {
            let trimmed = entry.trim();
            if trimmed.is_empty() {
                return None;
            }
            let mut parts = trimmed.splitn(2, ':');
            let kid = parts.next().unwrap_or("").trim();
            let secret = parts.next().unwrap_or("").trim();
            if kid.is_empty() || secret.is_empty() {
                None
            } else {
                Some((kid.to_string(), secret.to_string()))
            }
        })
        .collect()
}

fn resolve_compliance_signing_keys() -> Vec<(String, String)> {
    let mut keys =
        parse_compliance_secret_keyset(std::env::var("CSS_MUSIC_COMPLIANCE_WEBHOOK_KEYSET").ok());
    if keys.is_empty() {
        if let Ok(secret) = std::env::var("CSS_MUSIC_COMPLIANCE_WEBHOOK_SECRET") {
            if !secret.trim().is_empty() {
                keys.push(("v1".to_string(), secret));
            }
        }
    }
    keys
}

fn build_ticket_template_fields(
    candidate: Option<&RunMusicArrangementReleaseCandidateEntry>,
    severity: &str,
    note: &Value,
) -> Value {
    serde_json::json!({
        "release_candidate": candidate.map(|entry| entry.candidate_name.clone()).unwrap_or_else(|| "published revision".to_string()),
        "revision_id": candidate.map(|entry| entry.revision_id.clone()),
        "severity": severity,
        "playbook": std::env::var("CSS_MUSIC_COMPLIANCE_TICKET_PLAYBOOK").unwrap_or_else(|_| "music-compliance-escalation".to_string()),
        "owner_team": std::env::var("CSS_MUSIC_COMPLIANCE_OWNER_TEAM").unwrap_or_else(|_| "release-ops/compliance".to_string()),
        "delivery_scope": "music release compliance",
        "note": note.clone()
    })
}

fn build_vendor_field_registry(vendor: &str, base_fields: &Value) -> Value {
    let required = vec![
        "release_candidate",
        "revision_id",
        "severity",
        "owner_team",
        "playbook",
    ];
    let optional = vec!["delivery_scope", "note"];
    serde_json::json!({
        "schema": "cssapi.runs.compliance_ticket_field_registry.v1",
        "vendor": vendor,
        "required_fields": required,
        "optional_fields": optional,
        "field_defaults": base_fields,
    })
}

fn latest_rotation_override(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "rotate_secret_")
}

fn latest_vendor_registry_override(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "update_ticket_registry_")
}

fn latest_reopen_override(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "reopen_compliance_")
}

fn latest_preset_override(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "save_compliance_preset_")
}

fn latest_audit_log_entry(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "audit_compliance_action_")
}

fn latest_actor_identity_entry(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "actor-identity_")
}

fn latest_permission_check_entry(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "permission-check_")
}

fn latest_audit_signature_entry(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "audit-signature_")
}

fn latest_actor_directory_entry(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "save_actor_directory_")
}

fn latest_role_policy_preset_entry(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "save_role_policy_preset_")
}

fn latest_approval_chain_entry(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "approve_compliance_action_")
}

fn latest_approver_routing_entry(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "save_approver_routing_")
}

fn latest_required_signers_entry(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "save_required_signers_")
}

fn latest_release_quorum_entry(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "finalize_release_quorum_")
}

fn latest_locked_publish_gate_entry(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "locked-publish-gate_")
}

fn latest_release_unblock_token_entry(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "release-unblock-token_")
}

fn latest_immutable_publish_authorization_entry(run_id: &str) -> Option<Value> {
    read_latest_compliance_artifact(run_id, "immutable-publish-authorization_")
}

fn current_compliance_scoped_permissions(run_id: &str) -> Value {
    let preset = latest_preset_override(run_id);
    preset
        .as_ref()
        .and_then(|value| value.get("scoped_permissions"))
        .cloned()
        .unwrap_or_else(|| {
            serde_json::json!({
                "rotate_secret": "admin",
                "update_ticket_registry": "editor",
                "reopen_compliance": "operator"
            })
        })
}

fn current_actor_directory(run_id: &str) -> Value {
    latest_actor_directory_entry(run_id)
        .and_then(|value| value.get("directory").cloned())
        .unwrap_or_else(|| {
            serde_json::json!([
                {
                    "actor_id": "local-operator",
                    "actor_name": "Local Operator",
                    "actor_role": "admin",
                    "teams": ["release-ops/compliance"]
                }
            ])
        })
}

fn current_role_policy_presets(run_id: &str) -> Value {
    latest_role_policy_preset_entry(run_id)
        .and_then(|value| value.get("policy_presets").cloned())
        .unwrap_or_else(|| {
            serde_json::json!([
                {
                    "preset_name": "default-ops",
                    "scoped_permissions": current_compliance_scoped_permissions(run_id)
                }
            ])
        })
}

fn current_approver_routing(run_id: &str) -> Value {
    latest_approver_routing_entry(run_id)
        .and_then(|value| value.get("routes").cloned())
        .unwrap_or_else(|| {
            serde_json::json!([
                {
                    "step": "operator_review",
                    "required_role": "operator",
                    "team": "release-ops/compliance"
                },
                {
                    "step": "editor_review",
                    "required_role": "editor",
                    "team": "release-ops/editors"
                }
            ])
        })
}

fn current_required_signers(run_id: &str) -> Value {
    latest_required_signers_entry(run_id)
        .and_then(|value| value.get("required_signers").cloned())
        .unwrap_or_else(|| serde_json::json!(["operator", "editor"]))
}

fn ensure_publish_gate_authorization(
    run_id: &str,
    revision_id: &str,
    candidate_id: Option<&str>,
) -> Result<(), ApiError> {
    let gate = latest_locked_publish_gate_entry(run_id);
    let token = latest_release_unblock_token_entry(run_id);
    let authorization = latest_immutable_publish_authorization_entry(run_id);
    if gate.is_none() && token.is_none() && authorization.is_none() {
        return Ok(());
    }
    let gate_ok = gate
        .as_ref()
        .and_then(|value| value.get("gate_state"))
        .and_then(|value| value.as_str())
        .map(|value| value == "unlocked")
        .unwrap_or(false);
    let token_ok = token
        .as_ref()
        .and_then(|value| value.get("status"))
        .and_then(|value| value.as_str())
        .map(|value| value == "issued")
        .unwrap_or(false);
    let authorization_ok = authorization
        .as_ref()
        .and_then(|value| value.get("authorization_state"))
        .and_then(|value| value.as_str())
        .map(|value| value == "authorized")
        .unwrap_or(false);
    let revision_matches = authorization
        .as_ref()
        .and_then(|value| value.get("revision_id"))
        .and_then(|value| value.as_str())
        .map(|value| value == revision_id)
        .unwrap_or(false);
    let candidate_matches = candidate_id.map(|candidate| {
        authorization
            .as_ref()
            .and_then(|value| value.get("candidate_id"))
            .and_then(|value| value.as_str())
            .map(|value| value == candidate)
            .unwrap_or(false)
    });
    if gate_ok
        && token_ok
        && authorization_ok
        && revision_matches
        && candidate_matches.unwrap_or(true)
    {
        Ok(())
    } else {
        Err(ApiError::forbidden(
            "ARRANGEMENT_PUBLISH_GATE_LOCKED",
            "release publish gate is still locked or missing authorization",
        )
        .with_details(serde_json::json!({
            "revision_id": revision_id,
            "candidate_id": candidate_id,
            "gate_state": gate.and_then(|value| value.get("gate_state").cloned()),
            "token_status": token.and_then(|value| value.get("status").cloned()),
            "authorization_state": authorization.and_then(|value| value.get("authorization_state").cloned())
        })))
    }
}

fn build_blocked_publish_explainer(
    revision_id: &str,
    candidate_id: Option<&str>,
    gate: Option<&Value>,
    token: Option<&Value>,
    authorization: Option<&Value>,
) -> Value {
    let gate_state = gate
        .and_then(|value| value.get("gate_state"))
        .and_then(|value| value.as_str())
        .unwrap_or("missing");
    let token_status = token
        .and_then(|value| value.get("status"))
        .and_then(|value| value.as_str())
        .unwrap_or("missing");
    let authorization_state = authorization
        .and_then(|value| value.get("authorization_state"))
        .and_then(|value| value.as_str())
        .unwrap_or("missing");
    let authorization_revision = authorization
        .and_then(|value| value.get("revision_id"))
        .and_then(|value| value.as_str());
    let authorization_candidate = authorization
        .and_then(|value| value.get("candidate_id"))
        .and_then(|value| value.as_str());
    let mut missing_steps = Vec::new();
    if gate_state != "unlocked" {
        missing_steps.push("unlock_publish_gate".to_string());
    }
    if token_status != "issued" {
        missing_steps.push("issue_release_unblock_token".to_string());
    }
    if authorization_state != "authorized" {
        missing_steps.push("grant_immutable_publish_authorization".to_string());
    }
    if authorization_revision != Some(revision_id) {
        missing_steps.push("authorization_revision_mismatch".to_string());
    }
    if candidate_id.is_some() && authorization_candidate != candidate_id {
        missing_steps.push("authorization_candidate_mismatch".to_string());
    }
    serde_json::json!({
        "schema": "cssapi.runs.blocked_publish_explainer.v1",
        "revision_id": revision_id,
        "candidate_id": candidate_id,
        "blocked": !missing_steps.is_empty(),
        "gate_state": gate_state,
        "token_status": token_status,
        "authorization_state": authorization_state,
        "authorization_revision_id": authorization_revision,
        "authorization_candidate_id": authorization_candidate,
        "missing_steps": missing_steps,
    })
}

fn build_approval_to_publish_trace(
    run_id: &str,
    gate: Option<&Value>,
    token: Option<&Value>,
    authorization: Option<&Value>,
) -> Value {
    let approval_chain = latest_approval_chain_entry(run_id);
    let release_quorum = latest_release_quorum_entry(run_id);
    let signed_approvers = approval_chain
        .as_ref()
        .and_then(|value| value.get("signed_approvers"))
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    let last_approver = signed_approvers.last().cloned();
    let required_signers = current_required_signers(run_id);
    let routing = current_approver_routing(run_id);
    serde_json::json!({
        "schema": "cssapi.runs.approval_to_publish_trace.v1",
        "required_signers": required_signers,
        "approver_routing": routing,
        "signed_approvers": signed_approvers,
        "last_approver": last_approver,
        "quorum_met": release_quorum
            .as_ref()
            .and_then(|value| value.get("quorum_met"))
            .and_then(|value| value.as_bool())
            .unwrap_or(false),
        "quorum_name": release_quorum
            .as_ref()
            .and_then(|value| value.get("quorum_name"))
            .and_then(|value| value.as_str()),
        "gate_state": gate
            .and_then(|value| value.get("gate_state"))
            .and_then(|value| value.as_str())
            .unwrap_or("missing"),
        "token_status": token
            .and_then(|value| value.get("status"))
            .and_then(|value| value.as_str())
            .unwrap_or("missing"),
        "authorization_state": authorization
            .and_then(|value| value.get("authorization_state"))
            .and_then(|value| value.as_str())
            .unwrap_or("missing"),
    })
}

fn resolve_compliance_actor_identity(
    headers: &HeaderMap,
    req: &RunMusicComplianceActionRequest,
) -> Value {
    let actor_id = req
        .actor_id
        .clone()
        .or_else(|| {
            headers
                .get("x-cssmv-actor-id")
                .and_then(|value| value.to_str().ok())
                .map(|value| value.to_string())
        })
        .unwrap_or_else(|| "local-operator".to_string());
    let actor_name = req
        .actor_name
        .clone()
        .or_else(|| {
            headers
                .get("x-cssmv-actor-name")
                .and_then(|value| value.to_str().ok())
                .map(|value| value.to_string())
        })
        .unwrap_or_else(|| actor_id.clone());
    let actor_role = req
        .actor_role
        .clone()
        .or_else(|| {
            headers
                .get("x-cssmv-actor-role")
                .and_then(|value| value.to_str().ok())
                .map(|value| value.to_string())
        })
        .unwrap_or_else(|| "admin".to_string())
        .to_lowercase();
    serde_json::json!({
        "actor_id": actor_id,
        "actor_name": actor_name,
        "actor_role": actor_role
    })
}

fn compliance_role_rank(role: &str) -> u8 {
    match role.trim().to_lowercase().as_str() {
        "admin" => 4,
        "editor" => 3,
        "operator" => 2,
        "viewer" => 1,
        _ => 0,
    }
}

fn required_compliance_scope(action: &str) -> Option<&'static str> {
    match action {
        "rotate_secret" => Some("admin"),
        "update_ticket_registry"
        | "save_compliance_preset"
        | "save_actor_directory"
        | "save_role_policy_preset"
        | "save_approver_routing"
        | "save_required_signers"
        | "ack_backfill" => Some("editor"),
        "reopen_compliance"
        | "notify"
        | "incident_ticket"
        | "audit_compliance_action"
        | "approve_compliance_action"
        | "finalize_release_quorum" => Some("operator"),
        _ => None,
    }
}

fn evaluate_compliance_permission(run_id: &str, action: &str, actor_identity: &Value) -> Value {
    let scoped_permissions = current_compliance_scoped_permissions(run_id);
    let required_scope = required_compliance_scope(action)
        .map(|value| value.to_string())
        .or_else(|| {
            scoped_permissions
                .get(action)
                .and_then(|value| value.as_str())
                .map(|value| value.to_string())
        })
        .unwrap_or_else(|| "operator".to_string());
    let actor_role = actor_identity
        .get("actor_role")
        .and_then(|value| value.as_str())
        .unwrap_or("viewer")
        .to_string();
    let allowed = compliance_role_rank(&actor_role) >= compliance_role_rank(&required_scope);
    serde_json::json!({
        "schema": "cssapi.runs.compliance_permission_check.v1",
        "run_id": run_id,
        "action": action,
        "actor_identity": actor_identity,
        "required_scope": required_scope,
        "configured_scopes": scoped_permissions,
        "allowed": allowed,
        "checked_at": chrono::Utc::now().to_rfc3339()
    })
}

fn resolve_compliance_audit_signing_pair(run_id: &str) -> (String, String) {
    if let Ok(secret) = std::env::var("CSS_MUSIC_COMPLIANCE_AUDIT_SECRET") {
        if !secret.trim().is_empty() {
            return ("audit-v1".to_string(), secret);
        }
    }
    let rotation_override = latest_rotation_override(run_id);
    if let Some(pair) = rotation_override
        .as_ref()
        .and_then(|value| value.get("keyset"))
        .and_then(|value| value.as_str())
        .map(|raw| parse_compliance_secret_keyset(Some(raw.to_string())))
        .and_then(|pairs| pairs.first().cloned())
    {
        return pair;
    }
    resolve_compliance_signing_keys()
        .into_iter()
        .next()
        .unwrap_or_else(|| ("audit-local".to_string(), "cssmv-audit-local".to_string()))
}

fn build_compliance_audit_signature(
    run_id: &str,
    action: &str,
    actor_identity: &Value,
    permission_check: &Value,
    note: Option<&str>,
) -> Value {
    let (kid, secret) = resolve_compliance_audit_signing_pair(run_id);
    let signed_payload = serde_json::json!({
        "run_id": run_id,
        "action": action,
        "actor_identity": actor_identity,
        "permission_check": permission_check,
        "note": note.unwrap_or(""),
    });
    let signature = compliance_signature(&secret, &signed_payload);
    serde_json::json!({
        "schema": "cssapi.runs.compliance_audit_signature.v1",
        "run_id": run_id,
        "action": action,
        "kid": kid,
        "algorithm": "sha256",
        "signature": signature,
        "signed_payload": signed_payload,
        "status": "signed",
        "signed_at": chrono::Utc::now().to_rfc3339()
    })
}

fn maybe_refresh_rewrite_promotion_artifacts(run_id: &str, promotion_id: &str, payload: &Value) {
    let run_dir = run_store::run_dir(run_id);
    let promoted_at = payload
        .get("promoted_at")
        .and_then(|v| v.as_str())
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .unwrap_or_else(chrono::Utc::now);
    let elapsed = (chrono::Utc::now() - promoted_at).num_seconds();
    let state = if elapsed >= 2 {
        "applied_back"
    } else if elapsed >= 1 {
        "running"
    } else {
        "queued"
    };
    let queue_rel = format!(
        "{}/{}.json",
        rewrite_execution_queue_relative_dir(),
        promotion_id
    );
    let status_rel = format!(
        "{}/{}.json",
        rewrite_job_status_relative_dir(),
        promotion_id
    );
    let apply_rel = format!(
        "{}/{}.json",
        rewrite_apply_back_relative_dir(),
        promotion_id
    );
    let cue_revision_rel = format!(
        "{}/{}_cue_sheet.json",
        rewrite_revision_relative_dir(),
        promotion_id
    );
    let phrase_revision_rel = format!(
        "{}/{}_phrase_map.json",
        rewrite_revision_relative_dir(),
        promotion_id
    );
    let queue_path = run_dir.join(queue_rel.trim_start_matches("./"));
    let status_path = run_dir.join(status_rel.trim_start_matches("./"));
    let apply_path = run_dir.join(apply_rel.trim_start_matches("./"));
    let cue_revision_path = run_dir.join(cue_revision_rel.trim_start_matches("./"));
    let phrase_revision_path = run_dir.join(phrase_revision_rel.trim_start_matches("./"));

    let queue_payload = serde_json::json!({
        "promotion_id": promotion_id,
        "bundle_id": payload.get("bundle_id").cloned().unwrap_or(Value::Null),
        "version_name": payload.get("version_name").cloned().unwrap_or(Value::Null),
        "target": "provider_rewrite_job",
        "queue_state": "queued",
    });
    let _ = write_json_pretty(&queue_path, &queue_payload);

    let job_status_payload = serde_json::json!({
        "promotion_id": promotion_id,
        "status": state,
        "job_id": format!("provider-job-{}", promotion_id),
        "provider_backend": "cssmv-internal-provider",
        "updated_at": chrono::Utc::now().to_rfc3339(),
    });
    let _ = write_json_pretty(&status_path, &job_status_payload);

    let apply_back_payload = if state == "applied_back" {
        let base_cue =
            read_json_if_exists::<Value>(&run_dir.join("build/audio_provider_cue_sheet.json"))
                .unwrap_or_else(|| serde_json::json!({"cue_segments":[]}));
        let base_phrase =
            read_json_if_exists::<Value>(&run_dir.join("build/audio_provider_phrase_map.json"))
                .unwrap_or_else(|| serde_json::json!({"phrase_segments":[]}));
        let source_phrase_ids = payload
            .get("source_phrase_ids")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        let mut cue_revision = base_cue.clone();
        if let Some(obj) = cue_revision.as_object_mut() {
            obj.insert(
                "revision_meta".to_string(),
                serde_json::json!({
                    "promotion_id": promotion_id,
                    "source": "rewrite_apply_back",
                    "version_name": payload.get("version_name").cloned().unwrap_or(Value::Null),
                    "applied_at": chrono::Utc::now().to_rfc3339(),
                }),
            );
            if let Some(segments) = obj.get_mut("cue_segments").and_then(|v| v.as_array_mut()) {
                for segment in segments.iter_mut() {
                    if let Some(seg) = segment.as_object_mut() {
                        let contour = seg
                            .get("contour")
                            .and_then(|v| v.as_str())
                            .unwrap_or("flowing");
                        seg.insert(
                            "contour".to_string(),
                            Value::String(format!("{} · revised {}", contour, promotion_id)),
                        );
                    }
                }
            }
        }
        let _ = write_json_pretty(&cue_revision_path, &cue_revision);

        let mut phrase_revision = base_phrase.clone();
        if let Some(obj) = phrase_revision.as_object_mut() {
            obj.insert(
                "revision_meta".to_string(),
                serde_json::json!({
                    "promotion_id": promotion_id,
                    "source_phrase_ids": source_phrase_ids,
                    "version_name": payload.get("version_name").cloned().unwrap_or(Value::Null),
                    "applied_at": chrono::Utc::now().to_rfc3339(),
                }),
            );
            if let Some(segments) = obj
                .get_mut("phrase_segments")
                .and_then(|v| v.as_array_mut())
            {
                for segment in segments.iter_mut() {
                    if let Some(items) =
                        segment.get_mut("phrase_map").and_then(|v| v.as_array_mut())
                    {
                        for phrase in items.iter_mut() {
                            if let Some(obj) = phrase.as_object_mut() {
                                let phrase_id =
                                    obj.get("phrase_id").and_then(|v| v.as_str()).unwrap_or("");
                                if payload
                                    .get("source_phrase_ids")
                                    .and_then(|v| v.as_array())
                                    .map(|ids| ids.iter().any(|id| id.as_str() == Some(phrase_id)))
                                    .unwrap_or(false)
                                {
                                    let articulation = obj
                                        .get("articulation")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("adaptive");
                                    obj.insert(
                                        "articulation".to_string(),
                                        Value::String(format!("{}-revised", articulation)),
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
        let _ = write_json_pretty(&phrase_revision_path, &phrase_revision);
        let manifest_path = arrangement_revision_manifest_path(run_id);
        let mut revisions =
            read_json_if_exists::<Vec<RunMusicArrangementRevisionEntry>>(&manifest_path)
                .unwrap_or_default();
        let revision_id = format!("arr_revision_{}", promotion_id);
        let entry = RunMusicArrangementRevisionEntry {
            revision_id: revision_id.clone(),
            created_at: chrono::Utc::now().to_rfc3339(),
            source_promotion_id: promotion_id.to_string(),
            version_name: payload
                .get("version_name")
                .and_then(|v| v.as_str())
                .unwrap_or(promotion_id)
                .to_string(),
            cue_relative_path: cue_revision_rel.clone(),
            phrase_relative_path: phrase_revision_rel.clone(),
            state: "active".to_string(),
            rolled_back_from: None,
            merged_from: vec![promotion_id.to_string()],
        };
        revisions.retain(|item| item.revision_id != revision_id);
        revisions.iter_mut().for_each(|item| {
            if item.state == "active" {
                item.state = "superseded".to_string();
            }
        });
        revisions.push(entry);
        let revisions_json = serde_json::to_value(&revisions).unwrap_or(Value::Array(Vec::new()));
        let _ = write_json_pretty(&manifest_path, &revisions_json);
        serde_json::json!({
            "promotion_id": promotion_id,
            "status": "applied_back",
            "applied_at": chrono::Utc::now().to_rfc3339(),
            "applied_files": [
                "./build/audio_provider_cue_sheet.json",
                "./build/audio_provider_phrase_map.json",
                "./build/audio_provider_midi_draft.json"
            ],
            "revision_files": [
                cue_revision_rel,
                phrase_revision_rel
            ],
            "message": "rewrite promotion has been applied back into arrangement artifacts"
        })
    } else {
        serde_json::json!({
            "promotion_id": promotion_id,
            "status": "pending_apply_back",
            "message": "waiting for provider execution to finish"
        })
    };
    let _ = write_json_pretty(&apply_path, &apply_back_payload);
}

fn list_arrangement_revisions(run_id: &str) -> Vec<RunMusicArrangementRevisionEntry> {
    let path = arrangement_revision_manifest_path(run_id);
    let mut entries =
        read_json_if_exists::<Vec<RunMusicArrangementRevisionEntry>>(&path).unwrap_or_default();
    entries.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    entries
}

fn list_arrangement_release_candidates(
    run_id: &str,
) -> Vec<RunMusicArrangementReleaseCandidateEntry> {
    let path = arrangement_release_candidate_manifest_path(run_id);
    let mut entries = read_json_if_exists::<Vec<RunMusicArrangementReleaseCandidateEntry>>(&path)
        .unwrap_or_default();
    entries.sort_by(|a, b| b.nominated_at.cmp(&a.nominated_at));
    entries
}

fn persist_arrangement_release_candidates(
    run_id: &str,
    entries: &[RunMusicArrangementReleaseCandidateEntry],
) -> Result<(), ApiError> {
    let manifest_path = arrangement_release_candidate_manifest_path(run_id);
    let entries_json = serde_json::to_value(entries).unwrap_or(Value::Array(Vec::new()));
    write_json_pretty(&manifest_path, &entries_json).map_err(|e| {
        ApiError::internal("ARRANGEMENT_RELEASE_CANDIDATE_WRITE_FAILED", &e.to_string())
    })
}

fn refresh_arrangement_release_compliance_artifacts(
    run_id: &str,
    entry: &mut RunMusicArrangementReleaseCandidateEntry,
) -> Result<(), ApiError> {
    let Some(release_dir_rel) = entry.release_dir_relative_path.as_deref() else {
        return Ok(());
    };
    let run_dir = run_store::run_dir(run_id);
    let build_dir = run_dir.join("build");
    let published_at = entry
        .published_at
        .clone()
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
    let release_audit_trail_rel = entry
        .release_audit_trail_relative_path
        .clone()
        .unwrap_or_else(|| format!("{}/release_audit_trail.json", release_dir_rel));
    let downstream_compliance_feed_rel = entry
        .downstream_compliance_feed_relative_path
        .clone()
        .unwrap_or_else(|| format!("{}/downstream_compliance_feed.json", release_dir_rel));
    let compliance_ack_rel = format!("{}/compliance_ack.json", release_dir_rel);
    let regulator_receipt_rel = format!("{}/regulator_receipt.json", release_dir_rel);
    let audit_timeline_rel = format!("{}/audit_timeline.json", release_dir_rel);

    let downstream_receipt =
        read_json_if_exists::<Value>(&build_dir.join("audio_provider_downstream_receipt.json"));
    let receipt_sync =
        read_json_if_exists::<Value>(&build_dir.join("audio_provider_receipt_sync.json"));
    let downstream_delivery = read_json_if_exists::<Value>(
        &build_dir.join("audio_provider_downstream_delivery_report.json"),
    );
    let existing_audit = read_json_if_exists::<Value>(
        &run_dir.join(release_audit_trail_rel.trim_start_matches("./")),
    );

    let ack_status = if downstream_receipt.is_some() || receipt_sync.is_some() {
        "received"
    } else {
        "awaiting_downstream_ack"
    };
    let acked_at = receipt_sync
        .as_ref()
        .and_then(|v| v.get("synced_at"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| {
            downstream_receipt
                .as_ref()
                .and_then(|v| v.get("received_at"))
                .and_then(|v| v.as_str())
                .map(str::to_string)
        })
        .unwrap_or_else(|| published_at.clone());
    let compliance_ack_value = serde_json::json!({
        "schema": "cssapi.runs.arrangement_compliance_ack.v1",
        "candidate_id": entry.candidate_id,
        "candidate_name": entry.candidate_name,
        "revision_id": entry.revision_id,
        "status": ack_status,
        "acked_at": acked_at,
        "source_receipts": {
            "downstream_receipt": downstream_receipt.as_ref().map(|_| "./build/audio_provider_downstream_receipt.json"),
            "receipt_sync": receipt_sync.as_ref().map(|_| "./build/audio_provider_receipt_sync.json"),
            "downstream_delivery": downstream_delivery.as_ref().map(|_| "./build/audio_provider_downstream_delivery_report.json")
        }
    });
    write_json_pretty(
        &run_dir.join(compliance_ack_rel.trim_start_matches("./")),
        &compliance_ack_value,
    )
    .map_err(|e| ApiError::internal("ARRANGEMENT_RELEASE_WRITE_FAILED", &e.to_string()))?;

    let regulator_status = if ack_status == "received" {
        "recorded"
    } else {
        "pending_compliance_ack"
    };
    let regulator_receipt_value = serde_json::json!({
        "schema": "cssapi.runs.arrangement_regulator_receipt.v1",
        "candidate_id": entry.candidate_id,
        "candidate_name": entry.candidate_name,
        "revision_id": entry.revision_id,
        "status": regulator_status,
        "issued_at": acked_at,
        "regulator": "cssMV compliance registry",
        "receipt_number": format!("{}-{}", entry.candidate_id, acked_at.replace([':', '-'], "")),
        "linked_artifacts": {
            "downstream_compliance_feed": downstream_compliance_feed_rel,
            "compliance_ack": compliance_ack_rel,
            "release_audit_trail": release_audit_trail_rel
        }
    });
    write_json_pretty(
        &run_dir.join(regulator_receipt_rel.trim_start_matches("./")),
        &regulator_receipt_value,
    )
    .map_err(|e| ApiError::internal("ARRANGEMENT_RELEASE_WRITE_FAILED", &e.to_string()))?;

    let mut timeline_events = existing_audit
        .as_ref()
        .and_then(|v| v.get("events"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    if downstream_delivery.is_some() {
        timeline_events.push(serde_json::json!({
            "kind": "downstream_compliance_dispatched",
            "path": "./build/audio_provider_downstream_delivery_report.json",
            "at": published_at
        }));
    }
    if downstream_receipt.is_some() {
        timeline_events.push(serde_json::json!({
            "kind": "downstream_receipt_received",
            "path": "./build/audio_provider_downstream_receipt.json",
            "at": acked_at
        }));
    }
    if receipt_sync.is_some() {
        timeline_events.push(serde_json::json!({
            "kind": "downstream_receipt_synced",
            "path": "./build/audio_provider_receipt_sync.json",
            "at": acked_at
        }));
    }
    timeline_events.push(serde_json::json!({
        "kind": "compliance_ack_written",
        "path": compliance_ack_rel,
        "at": acked_at
    }));
    timeline_events.push(serde_json::json!({
        "kind": "regulator_receipt_written",
        "path": regulator_receipt_rel,
        "at": acked_at
    }));
    let audit_timeline_value = serde_json::json!({
        "schema": "cssapi.runs.arrangement_audit_timeline.v1",
        "candidate_id": entry.candidate_id,
        "candidate_name": entry.candidate_name,
        "revision_id": entry.revision_id,
        "status": if ack_status == "received" { "closed_loop" } else { "awaiting_downstream_ack" },
        "events": timeline_events
    });
    write_json_pretty(
        &run_dir.join(audit_timeline_rel.trim_start_matches("./")),
        &audit_timeline_value,
    )
    .map_err(|e| ApiError::internal("ARRANGEMENT_RELEASE_WRITE_FAILED", &e.to_string()))?;

    entry.release_audit_trail_relative_path = Some(release_audit_trail_rel);
    entry.downstream_compliance_feed_relative_path = Some(downstream_compliance_feed_rel);
    entry.compliance_ack_relative_path = Some(compliance_ack_rel);
    entry.regulator_receipt_relative_path = Some(regulator_receipt_rel);
    entry.audit_timeline_relative_path = Some(audit_timeline_rel);
    Ok(())
}

fn build_compliance_dashboard_lane(
    published_revision: Option<&RunMusicArrangementReleaseCandidateEntry>,
    compliance_ack: Option<&Value>,
    regulator_receipt: Option<&Value>,
    audit_timeline: Option<&Value>,
) -> Option<Value> {
    let entry = published_revision?;
    let published_at = entry.published_at.clone()?;
    let ack_status = compliance_ack
        .and_then(|v| v.get("status"))
        .and_then(|v| v.as_str())
        .unwrap_or("awaiting_downstream_ack");
    let regulator_status = regulator_receipt
        .and_then(|v| v.get("status"))
        .and_then(|v| v.as_str())
        .unwrap_or("pending_compliance_ack");
    let timeline_status = audit_timeline
        .and_then(|v| v.get("status"))
        .and_then(|v| v.as_str())
        .unwrap_or("awaiting_downstream_ack");
    Some(serde_json::json!({
        "schema": "cssapi.runs.compliance_dashboard_lane.v1",
        "candidate_id": entry.candidate_id,
        "candidate_name": entry.candidate_name,
        "published_at": published_at,
        "stages": [
            {
                "id": "published_release",
                "label": "Published Release",
                "status": "completed",
                "at": entry.published_at
            },
            {
                "id": "downstream_compliance_ack",
                "label": "Downstream Compliance Ack",
                "status": ack_status,
                "at": compliance_ack.and_then(|v| v.get("acked_at")).cloned()
            },
            {
                "id": "regulator_receipt",
                "label": "Regulator Receipt",
                "status": regulator_status,
                "at": regulator_receipt.and_then(|v| v.get("issued_at")).cloned()
            },
            {
                "id": "audit_timeline",
                "label": "Audit Timeline",
                "status": timeline_status,
                "at": audit_timeline
                    .and_then(|v| v.get("events"))
                    .and_then(|v| v.as_array())
                    .and_then(|arr| arr.last())
                    .and_then(|v| v.get("at"))
                    .cloned()
            }
        ]
    }))
}

fn build_compliance_exception_flags(
    published_revision: Option<&RunMusicArrangementReleaseCandidateEntry>,
    compliance_ack: Option<&Value>,
    regulator_receipt: Option<&Value>,
    audit_timeline: Option<&Value>,
) -> Vec<Value> {
    let Some(entry) = published_revision else {
        return Vec::new();
    };
    let mut flags = Vec::new();
    let ack_status = compliance_ack
        .and_then(|v| v.get("status"))
        .and_then(|v| v.as_str())
        .unwrap_or("missing");
    if ack_status != "received" {
        flags.push(serde_json::json!({
            "level": "warning",
            "code": "COMPLIANCE_ACK_PENDING",
            "title": "Downstream compliance ack pending",
            "detail": format!("Release {} is still waiting for downstream compliance acknowledgment.", entry.candidate_name),
        }));
    }
    let regulator_status = regulator_receipt
        .and_then(|v| v.get("status"))
        .and_then(|v| v.as_str())
        .unwrap_or("missing");
    if regulator_status != "recorded" {
        flags.push(serde_json::json!({
            "level": "warning",
            "code": "REGULATOR_RECEIPT_PENDING",
            "title": "Regulator receipt pending",
            "detail": format!("Release {} has not produced a recorded regulator receipt yet.", entry.candidate_name),
        }));
    }
    let timeline_status = audit_timeline
        .and_then(|v| v.get("status"))
        .and_then(|v| v.as_str())
        .unwrap_or("missing");
    if timeline_status != "closed_loop" {
        flags.push(serde_json::json!({
            "level": "info",
            "code": "AUDIT_TIMELINE_OPEN",
            "title": "Audit timeline still open",
            "detail": format!("Release {} has not closed the compliance loop yet.", entry.candidate_name),
        }));
    }
    flags
}

fn build_compliance_sla_clock(
    published_revision: Option<&RunMusicArrangementReleaseCandidateEntry>,
    compliance_ack: Option<&Value>,
    regulator_receipt: Option<&Value>,
) -> Option<Value> {
    let entry = published_revision?;
    let published_at = entry
        .published_at
        .as_deref()
        .and_then(crate::timeutil::parse_rfc3339_to_epoch_seconds)?;
    let now = crate::timeutil::now_epoch_seconds();
    let ack_at = compliance_ack
        .and_then(|v| v.get("acked_at"))
        .and_then(|v| v.as_str())
        .and_then(crate::timeutil::parse_rfc3339_to_epoch_seconds);
    let regulator_at = regulator_receipt
        .and_then(|v| v.get("issued_at"))
        .and_then(|v| v.as_str())
        .and_then(crate::timeutil::parse_rfc3339_to_epoch_seconds);
    let ack_elapsed = ack_at.unwrap_or(now).saturating_sub(published_at);
    let regulator_elapsed = regulator_at.unwrap_or(now).saturating_sub(published_at);
    let ack_target_s: u64 = 6 * 60 * 60;
    let regulator_target_s: u64 = 24 * 60 * 60;
    Some(serde_json::json!({
        "schema": "cssapi.runs.compliance_sla_clock.v1",
        "candidate_id": entry.candidate_id,
        "candidate_name": entry.candidate_name,
        "published_at": entry.published_at,
        "now_epoch_s": now,
        "windows": [
            {
                "id": "compliance_ack",
                "label": "Compliance Ack",
                "target_s": ack_target_s,
                "elapsed_s": ack_elapsed,
                "remaining_s": ack_target_s.saturating_sub(ack_elapsed),
                "status": if ack_at.is_some() { "completed" } else if ack_elapsed > ack_target_s { "breached" } else { "tracking" }
            },
            {
                "id": "regulator_receipt",
                "label": "Regulator Receipt",
                "target_s": regulator_target_s,
                "elapsed_s": regulator_elapsed,
                "remaining_s": regulator_target_s.saturating_sub(regulator_elapsed),
                "status": if regulator_at.is_some() { "completed" } else if regulator_elapsed > regulator_target_s { "breached" } else { "tracking" }
            }
        ]
    }))
}

fn build_compliance_alert_routing(
    published_revision: Option<&RunMusicArrangementReleaseCandidateEntry>,
    exception_flags: &[Value],
    sla_clock: Option<&Value>,
) -> Option<Value> {
    let entry = published_revision?;
    let has_warning = exception_flags.iter().any(|flag| {
        flag.get("level")
            .and_then(|v| v.as_str())
            .map(|v| v == "warning")
            .unwrap_or(false)
    });
    let breached = sla_clock
        .and_then(|v| v.get("windows"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter().any(|window| {
                window
                    .get("status")
                    .and_then(|v| v.as_str())
                    .map(|s| s == "breached")
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false);
    let severity = if breached {
        "high"
    } else if has_warning {
        "medium"
    } else {
        "low"
    };
    Some(serde_json::json!({
        "schema": "cssapi.runs.compliance_alert_routing.v1",
        "candidate_id": entry.candidate_id,
        "candidate_name": entry.candidate_name,
        "severity": severity,
        "routes": [
            {
                "channel": "dashboard",
                "target": "cssMV compliance dashboard",
                "state": "active"
            },
            {
                "channel": "operator_queue",
                "target": "release-ops/compliance",
                "state": if has_warning || breached { "queued" } else { "standby" }
            },
            {
                "channel": "escalation_lane",
                "target": breached.then_some("release-ops/oncall"),
                "state": if breached { "escalated" } else { "idle" }
            }
        ]
    }))
}

fn build_compliance_escalation_policy(
    published_revision: Option<&RunMusicArrangementReleaseCandidateEntry>,
    exception_flags: &[Value],
    sla_clock: Option<&Value>,
) -> Option<Value> {
    let entry = published_revision?;
    let has_flags = !exception_flags.is_empty();
    let breached_windows = sla_clock
        .and_then(|v| v.get("windows"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|window| {
                    let status = window.get("status").and_then(|v| v.as_str())?;
                    if status == "breached" {
                        Some(
                            window
                                .get("label")
                                .and_then(|v| v.as_str())
                                .unwrap_or("SLA")
                                .to_string(),
                        )
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    Some(serde_json::json!({
        "schema": "cssapi.runs.compliance_escalation_policy.v1",
        "candidate_id": entry.candidate_id,
        "candidate_name": entry.candidate_name,
        "policy_state": if breached_windows.is_empty() {
            if has_flags { "watch" } else { "green" }
        } else {
            "escalated"
        },
        "steps": [
            {
                "order": 1,
                "name": "Review dashboard",
                "condition": "on exception flag",
                "status": if has_flags { "required" } else { "standby" }
            },
            {
                "order": 2,
                "name": "Escalate to release ops",
                "condition": "on SLA breach",
                "status": if breached_windows.is_empty() { "standby" } else { "required" }
            },
            {
                "order": 3,
                "name": "Manual compliance handoff",
                "condition": "after unresolved breach",
                "status": if breached_windows.len() > 1 { "required" } else { "standby" }
            }
        ],
        "breached_windows": breached_windows
    }))
}

fn build_compliance_operator_actions(
    published_revision: Option<&RunMusicArrangementReleaseCandidateEntry>,
    exception_flags: &[Value],
    sla_clock: Option<&Value>,
) -> Vec<Value> {
    let Some(entry) = published_revision else {
        return Vec::new();
    };
    let mut actions = vec![
        serde_json::json!({
            "id": "refresh_dashboard",
            "label": "Refresh Compliance",
            "kind": "refresh",
            "priority": "normal",
            "candidate_id": entry.candidate_id
        }),
        serde_json::json!({
            "id": "review_audit_timeline",
            "label": "Review Audit Timeline",
            "kind": "open_artifact",
            "target_path": entry.audit_timeline_relative_path,
            "priority": "normal",
            "candidate_id": entry.candidate_id
        }),
    ];
    let ack_pending = exception_flags.iter().any(|flag| {
        flag.get("code")
            .and_then(|v| v.as_str())
            .map(|code| code == "COMPLIANCE_ACK_PENDING")
            .unwrap_or(false)
    });
    if ack_pending {
        actions.push(serde_json::json!({
            "id": "open_compliance_ack",
            "label": "Open Compliance Ack",
            "kind": "open_artifact",
            "target_path": entry.compliance_ack_relative_path,
            "priority": "high",
            "candidate_id": entry.candidate_id
        }));
    }
    let breached = sla_clock
        .and_then(|v| v.get("windows"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter().any(|window| {
                window
                    .get("status")
                    .and_then(|v| v.as_str())
                    .map(|s| s == "breached")
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false);
    if breached {
        actions.push(serde_json::json!({
            "id": "escalate_release_ops",
            "label": "Escalate Release Ops",
            "kind": "escalate",
            "priority": "critical",
            "target_team": "release-ops/oncall",
            "candidate_id": entry.candidate_id
        }));
    }
    actions.push(serde_json::json!({
        "id": "save_compliance_preset",
        "label": "Save Compliance Preset",
        "kind": "config",
        "permission_scope": "editor",
        "candidate_id": entry.candidate_id
    }));
    actions.push(serde_json::json!({
        "id": "save_actor_directory",
        "label": "Save Actor Directory",
        "kind": "config",
        "permission_scope": "editor",
        "candidate_id": entry.candidate_id
    }));
    actions.push(serde_json::json!({
        "id": "save_role_policy_preset",
        "label": "Save Role Policy",
        "kind": "config",
        "permission_scope": "editor",
        "candidate_id": entry.candidate_id
    }));
    actions.push(serde_json::json!({
        "id": "approve_compliance_action",
        "label": "Sign Approval Chain",
        "kind": "approval",
        "permission_scope": "operator",
        "candidate_id": entry.candidate_id
    }));
    actions.push(serde_json::json!({
        "id": "save_approver_routing",
        "label": "Save Approver Routing",
        "kind": "config",
        "permission_scope": "editor",
        "candidate_id": entry.candidate_id
    }));
    actions.push(serde_json::json!({
        "id": "save_required_signers",
        "label": "Save Required Signers",
        "kind": "config",
        "permission_scope": "editor",
        "candidate_id": entry.candidate_id
    }));
    actions.push(serde_json::json!({
        "id": "finalize_release_quorum",
        "label": "Finalize Release Quorum",
        "kind": "approval",
        "permission_scope": "operator",
        "candidate_id": entry.candidate_id
    }));
    actions.push(serde_json::json!({
        "id": "review_compliance_audit",
        "label": "Review Compliance Audit",
        "kind": "audit",
        "permission_scope": "operator",
        "candidate_id": entry.candidate_id
    }));
    actions
}

fn write_compliance_action_artifact(
    run_id: &str,
    action: &str,
    payload: &Value,
) -> Result<String, ApiError> {
    let run_dir = run_store::run_dir(run_id);
    let ops_dir = run_dir.join(compliance_ops_relative_dir().trim_start_matches("./"));
    run_store::ensure_dir_path(&ops_dir)
        .map_err(|e| ApiError::internal("COMPLIANCE_OPS_DIR_FAILED", &e.to_string()))?;
    let stamp = chrono::Utc::now().format("%Y%m%dT%H%M%S%.3fZ").to_string();
    let rel = format!(
        "{}/{}_{}.json",
        compliance_ops_relative_dir(),
        action,
        stamp
    );
    write_json_pretty(&run_dir.join(rel.trim_start_matches("./")), payload)
        .map_err(|e| ApiError::internal("COMPLIANCE_OPS_WRITE_FAILED", &e.to_string()))?;
    Ok(rel)
}

fn write_compliance_aux_artifact(
    run_id: &str,
    prefix: &str,
    payload: &Value,
) -> Result<String, ApiError> {
    let run_dir = run_store::run_dir(run_id);
    let file_name = format!(
        "{}_{}.json",
        sanitize_compliance_slug(prefix, "compliance"),
        chrono::Utc::now().format("%Y%m%dT%H%M%S%.3fZ")
    );
    let rel = format!("{}/{}", compliance_ops_relative_dir(), file_name);
    write_json_pretty(&run_dir.join(rel.trim_start_matches("./")), payload)
        .map_err(|e| ApiError::internal("COMPLIANCE_OPS_WRITE_FAILED", &e.to_string()))?;
    Ok(rel)
}

async fn dispatch_compliance_notification_adapter(
    run_id: &str,
    candidate: Option<&RunMusicArrangementReleaseCandidateEntry>,
    base_payload: &Value,
) -> Result<(String, Value), ApiError> {
    let backend = std::env::var("CSS_MUSIC_COMPLIANCE_NOTIFY_BACKEND")
        .unwrap_or_else(|_| "local".to_string())
        .to_lowercase();
    let team = base_payload
        .get("target_team")
        .and_then(|v| v.as_str())
        .unwrap_or("release-ops/compliance");
    let webhook_url = std::env::var("CSS_MUSIC_COMPLIANCE_WEBHOOK_URL").ok();
    let rotation_override = latest_rotation_override(run_id);
    let signing_keys = rotation_override
        .as_ref()
        .and_then(|value| value.get("keyset"))
        .and_then(|value| value.as_str())
        .map(|raw| parse_compliance_secret_keyset(Some(raw.to_string())))
        .filter(|items| !items.is_empty())
        .unwrap_or_else(resolve_compliance_signing_keys);
    let active_kid = rotation_override
        .as_ref()
        .and_then(|value| value.get("active_kid"))
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
        .or_else(|| std::env::var("CSS_MUSIC_COMPLIANCE_WEBHOOK_ACTIVE_KID").ok());
    let active_pair = active_kid
        .as_deref()
        .and_then(|kid| signing_keys.iter().find(|(entry_kid, _)| entry_kid == kid))
        .cloned()
        .or_else(|| signing_keys.first().cloned());
    let auth_mode = if active_pair.is_some() {
        "signed"
    } else {
        "unsigned"
    };
    let payload = serde_json::json!({
        "event": "music_compliance_alert",
        "team": team,
        "candidate_id": candidate.map(|entry| entry.candidate_id.clone()),
        "release_dir": candidate.and_then(|entry| entry.release_dir_relative_path.clone()),
        "release_manifest": candidate.and_then(|entry| entry.release_manifest_relative_path.clone()),
        "note": base_payload.get("note").cloned().unwrap_or(Value::Null)
    });
    let signature = active_pair
        .as_ref()
        .map(|(_, secret)| compliance_signature(secret, &payload));
    let signature_kid = active_pair.as_ref().map(|(kid, _)| kid.clone());
    let mut report = serde_json::json!({
        "schema": "cssapi.runs.compliance_webhook_dispatch.v1",
        "run_id": run_id,
        "candidate_id": candidate.map(|entry| entry.candidate_id.clone()),
        "backend": backend,
        "target_team": team,
        "requested_at": chrono::Utc::now().to_rfc3339(),
        "status": "queued_local_dispatch",
        "auth_mode": auth_mode,
        "rotation": {
            "active_kid": signature_kid,
            "available_kids": signing_keys.iter().map(|(kid, _)| kid.clone()).collect::<Vec<_>>(),
            "key_count": signing_keys.len()
        },
        "signed_headers": {
            "x-cssmv-signature": signature.clone(),
            "x-cssmv-key-id": signature_kid.clone(),
            "x-cssmv-signature-alg": if signature.is_some() { Value::String("sha256".to_string()) } else { Value::Null }
        },
        "payload": payload
    });
    if backend == "webhook" {
        if let Some(url) = webhook_url.clone() {
            let client = reqwest::Client::new();
            let mut request = client.post(&url);
            if let Some(sig) = signature.clone() {
                request = request.header("x-cssmv-signature", sig);
                request = request.header("x-cssmv-signature-alg", "sha256");
                if let Some(kid) = signature_kid.clone() {
                    request = request.header("x-cssmv-key-id", kid);
                }
            }
            match request
                .json(report.get("payload").unwrap_or(&Value::Null))
                .send()
                .await
            {
                Ok(response) => {
                    report["status"] = Value::String(if response.status().is_success() {
                        "webhook_sent".to_string()
                    } else {
                        "webhook_failed".to_string()
                    });
                    report["http_status"] = serde_json::json!(response.status().as_u16());
                    report["webhook_url"] = Value::String(url);
                }
                Err(error) => {
                    report["status"] = Value::String("webhook_error".to_string());
                    report["error"] = Value::String(error.to_string());
                    report["webhook_url"] = Value::String(url);
                }
            }
        } else {
            report["status"] = Value::String("awaiting_webhook_config".to_string());
        }
    }
    let path = write_compliance_aux_artifact(run_id, "notify_adapter", &report)?;
    Ok((path, report))
}

async fn map_compliance_ticket_vendor(
    run_id: &str,
    candidate: Option<&RunMusicArrangementReleaseCandidateEntry>,
    base_payload: &Value,
) -> Result<(String, Value), ApiError> {
    let registry_override = latest_vendor_registry_override(run_id);
    let vendor = registry_override
        .as_ref()
        .and_then(|value| value.get("vendor"))
        .and_then(|value| value.as_str())
        .map(|value| value.to_lowercase())
        .or_else(|| {
            std::env::var("CSS_MUSIC_COMPLIANCE_TICKET_VENDOR")
                .ok()
                .map(|value| value.to_lowercase())
        })
        .unwrap_or_else(|| "local".to_string());
    let note = base_payload.get("note").cloned().unwrap_or(Value::Null);
    let severity = base_payload
        .get("severity")
        .and_then(|v| v.as_str())
        .unwrap_or("high");
    let template_fields = registry_override
        .as_ref()
        .and_then(|value| value.get("field_defaults"))
        .cloned()
        .unwrap_or_else(|| build_ticket_template_fields(candidate, severity, &note));
    let vendor_registry = registry_override
        .as_ref()
        .cloned()
        .unwrap_or_else(|| build_vendor_field_registry(&vendor, &template_fields));
    let mapped_ticket = match vendor.as_str() {
        "jira" => serde_json::json!({
            "project_key": std::env::var("CSS_MUSIC_COMPLIANCE_JIRA_PROJECT").unwrap_or_else(|_| "CMPL".to_string()),
            "issue_type": "Incident",
            "summary": format!("cssMV compliance incident for {}", candidate.map(|entry| entry.candidate_id.as_str()).unwrap_or("published-release")),
            "priority": severity.to_ascii_uppercase(),
            "fields_template": template_fields,
        }),
        "linear" => serde_json::json!({
            "team_key": std::env::var("CSS_MUSIC_COMPLIANCE_LINEAR_TEAM").unwrap_or_else(|_| "REL".to_string()),
            "title": format!("cssMV compliance follow-up {}", candidate.map(|entry| entry.candidate_id.as_str()).unwrap_or("release")),
            "priority": if severity == "high" { 1 } else { 3 },
            "fields_template": template_fields,
        }),
        "service-now" | "servicenow" => serde_json::json!({
            "assignment_group": std::env::var("CSS_MUSIC_COMPLIANCE_SN_GROUP").unwrap_or_else(|_| "release-ops".to_string()),
            "short_description": "cssMV music compliance escalation",
            "impact": "2",
            "fields_template": template_fields,
        }),
        _ => serde_json::json!({
            "queue": "local-compliance",
            "title": format!("cssMV compliance incident {}", candidate.map(|entry| entry.candidate_id.as_str()).unwrap_or("release")),
            "fields_template": template_fields,
        }),
    };
    let mut report = serde_json::json!({
        "schema": "cssapi.runs.compliance_ticket_vendor_mapping.v1",
        "run_id": run_id,
        "candidate_id": candidate.map(|entry| entry.candidate_id.clone()),
        "vendor": vendor,
        "ticket_id": base_payload.get("ticket_id").cloned().unwrap_or(Value::Null),
        "mapped_ticket": mapped_ticket,
        "template_fields": template_fields,
        "field_registry": vendor_registry,
        "status": "mapped",
        "note": note
    });
    if let Ok(url) = std::env::var("CSS_MUSIC_COMPLIANCE_TICKET_WEBHOOK_URL") {
        let outbound = serde_json::json!({
            "run_id": run_id,
            "candidate_id": candidate.map(|entry| entry.candidate_id.clone()),
            "vendor": report.get("vendor").cloned().unwrap_or(Value::Null),
            "ticket": report.get("mapped_ticket").cloned().unwrap_or(Value::Null),
        });
        let client = reqwest::Client::new();
        match client.post(&url).json(&outbound).send().await {
            Ok(response) => {
                report["dispatch"] = serde_json::json!({
                    "backend": "webhook",
                    "url": url,
                    "http_status": response.status().as_u16()
                });
                report["status"] = Value::String(if response.status().is_success() {
                    "mapped_and_sent".to_string()
                } else {
                    "mapped_send_failed".to_string()
                });
            }
            Err(error) => {
                report["dispatch"] = serde_json::json!({
                    "backend": "webhook",
                    "url": url,
                    "error": error.to_string()
                });
                report["status"] = Value::String("mapped_send_error".to_string());
            }
        }
    }
    let path = write_compliance_aux_artifact(run_id, "ticket_mapping", &report)?;
    Ok((path, report))
}

fn build_compliance_ack_reconciliation(
    run_id: &str,
    candidate: Option<&RunMusicArrangementReleaseCandidateEntry>,
    source_path: Option<&str>,
    note: Option<&str>,
) -> Result<(String, Value), ApiError> {
    let run_dir = run_store::run_dir(run_id);
    let source_rel = source_path
        .filter(|path| !path.trim().is_empty())
        .map(|path| path.to_string())
        .or_else(|| candidate.and_then(|entry| entry.compliance_ack_relative_path.clone()));
    let source_value = source_rel.as_deref().and_then(|path| {
        read_json_if_exists::<Value>(&run_dir.join(path.trim_start_matches("./")))
    });
    let regulator = candidate
        .and_then(|entry| entry.regulator_receipt_relative_path.as_deref())
        .and_then(|path| {
            read_json_if_exists::<Value>(&run_dir.join(path.trim_start_matches("./")))
        });
    let audit = candidate
        .and_then(|entry| entry.audit_timeline_relative_path.as_deref())
        .and_then(|path| {
            read_json_if_exists::<Value>(&run_dir.join(path.trim_start_matches("./")))
        });
    let certificate = candidate
        .and_then(|entry| entry.delivery_certificate_relative_path.as_deref())
        .and_then(|path| {
            read_json_if_exists::<Value>(&run_dir.join(path.trim_start_matches("./")))
        });
    let reopen_override = latest_reopen_override(run_id);
    let ack_status = source_value
        .as_ref()
        .and_then(|value| value.get("status"))
        .and_then(|value| value.as_str())
        .unwrap_or("missing");
    let regulator_status = regulator
        .as_ref()
        .and_then(|value| value.get("status"))
        .and_then(|value| value.as_str())
        .unwrap_or("missing");
    let timeline_events = audit
        .as_ref()
        .and_then(|value| value.get("events"))
        .and_then(|value| value.as_array())
        .map(|items| items.len())
        .unwrap_or(0);
    let auto_close_enabled = std::env::var("CSS_MUSIC_COMPLIANCE_AUTO_CLOSE")
        .ok()
        .map(|v| matches!(v.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
        .unwrap_or(true);
    let reopen_on_mismatch = std::env::var("CSS_MUSIC_COMPLIANCE_REOPEN_ON_MISMATCH")
        .ok()
        .map(|v| matches!(v.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
        .unwrap_or(true);
    let resolved =
        source_value.is_some() && regulator.is_some() && audit.is_some() && certificate.is_some();
    let mismatch_reason = if ack_status == "missing" {
        Some("missing_ack_source")
    } else if regulator_status == "missing" {
        Some("missing_regulator_receipt")
    } else if timeline_events == 0 {
        Some("empty_audit_timeline")
    } else {
        None
    };
    let status = if resolved {
        "reconciled"
    } else if source_value.is_some() {
        "partial_reconciliation"
    } else {
        "missing_ack_source"
    };
    let closing_state = if resolved && auto_close_enabled {
        "auto_closed"
    } else if resolved {
        "ready_to_close"
    } else {
        "left_open"
    };
    let explicit_reopen_reason = reopen_override
        .as_ref()
        .and_then(|value| value.get("reopen_reason"))
        .and_then(|value| value.as_str())
        .map(|value| value.to_string());
    let reopen_state = if explicit_reopen_reason.is_some() {
        "reopened"
    } else if mismatch_reason.is_some() && reopen_on_mismatch {
        "reopened"
    } else {
        "not_reopened"
    };
    let report = serde_json::json!({
        "schema": "cssapi.runs.compliance_ack_reconciliation.v1",
        "run_id": run_id,
        "candidate_id": candidate.map(|entry| entry.candidate_id.clone()),
        "source_path": source_rel,
        "status": status,
        "auto_close_enabled": auto_close_enabled,
        "reopen_on_mismatch": reopen_on_mismatch,
        "closing_state": closing_state,
        "reopen_state": reopen_state,
        "reopen_reason": explicit_reopen_reason.or_else(|| mismatch_reason.map(|value| value.to_string())),
        "reconciled_at": chrono::Utc::now().to_rfc3339(),
        "checks": [
            {
                "id": "compliance_ack",
                "present": source_value.is_some(),
                "status": source_value.as_ref().and_then(|value| value.get("status")).cloned().unwrap_or(Value::String("missing".to_string()))
            },
            {
                "id": "regulator_receipt",
                "present": regulator.is_some(),
                "status": regulator.as_ref().and_then(|value| value.get("status")).cloned().unwrap_or(Value::String("missing".to_string()))
            },
            {
                "id": "audit_timeline",
                "present": audit.is_some(),
                "events": timeline_events
            },
            {
                "id": "delivery_certificate",
                "present": certificate.is_some()
            }
        ],
        "note": note
    });
    let path = write_compliance_aux_artifact(run_id, "ack_reconciliation", &report)?;
    Ok((path, report))
}

fn freeze_arrangement_release_artifacts(
    run_id: &str,
    target: &RunMusicArrangementRevisionEntry,
    entry: &mut RunMusicArrangementReleaseCandidateEntry,
) -> Result<(), ApiError> {
    let run_dir = run_store::run_dir(run_id);
    let release_dir = arrangement_release_dir(run_id, &entry.candidate_id);
    run_store::ensure_dir_path(&release_dir)
        .map_err(|e| ApiError::internal("ARRANGEMENT_RELEASE_DIR_FAILED", &e.to_string()))?;
    let cue_src = {
        let candidate = run_dir.join(target.cue_relative_path.trim_start_matches("./"));
        if candidate.exists() {
            candidate
        } else {
            run_dir.join("build").join("audio_provider_cue_sheet.json")
        }
    };
    let phrase_src = {
        let candidate = run_dir.join(target.phrase_relative_path.trim_start_matches("./"));
        if candidate.exists() {
            candidate
        } else {
            run_dir.join("build").join("audio_provider_phrase_map.json")
        }
    };
    let cue_dst = release_dir.join("frozen_cue_sheet.json");
    let phrase_dst = release_dir.join("frozen_phrase_map.json");
    if cue_src.exists() && fs::copy(&cue_src, &cue_dst).is_ok() {
    } else {
        write_json_pretty(
            &cue_dst,
            &serde_json::json!({
                "schema": "cssapi.runs.arrangement_release_frozen_cue.v1",
                "revision_id": target.revision_id,
                "version_name": target.version_name,
                "cue_segments": []
            }),
        )
        .map_err(|e| ApiError::internal("ARRANGEMENT_RELEASE_WRITE_FAILED", &e.to_string()))?;
    }
    if phrase_src.exists() && fs::copy(&phrase_src, &phrase_dst).is_ok() {
    } else {
        write_json_pretty(
            &phrase_dst,
            &serde_json::json!({
                "schema": "cssapi.runs.arrangement_release_frozen_phrase_map.v1",
                "revision_id": target.revision_id,
                "version_name": target.version_name,
                "phrase_segments": []
            }),
        )
        .map_err(|e| ApiError::internal("ARRANGEMENT_RELEASE_WRITE_FAILED", &e.to_string()))?;
    }

    let release_dir_rel = format!(
        "{}/{}",
        arrangement_release_relative_dir(),
        entry.candidate_id
    );
    let release_manifest_rel = format!("{}/release_manifest.json", release_dir_rel);
    let immutable_handoff_rel = format!("{}/immutable_handoff.json", release_dir_rel);
    let release_approval_rel = format!("{}/release_approval.json", release_dir_rel);
    let release_signoff_rel = format!("{}/release_signoff.json", release_dir_rel);
    let delivery_certificate_rel = format!("{}/delivery_certificate.json", release_dir_rel);
    let release_audit_trail_rel = format!("{}/release_audit_trail.json", release_dir_rel);
    let notarized_receipt_rel = format!("{}/notarized_receipt.json", release_dir_rel);
    let downstream_compliance_feed_rel =
        format!("{}/downstream_compliance_feed.json", release_dir_rel);
    let manifest_value = serde_json::json!({
        "schema": "cssapi.runs.arrangement_release_manifest.v1",
        "candidate_id": entry.candidate_id,
        "candidate_name": entry.candidate_name,
        "revision_id": entry.revision_id,
        "version_name": entry.version_name,
        "published_at": entry.published_at,
        "locked_at": entry.locked_at,
        "frozen_artifacts": {
            "cue_sheet": format!("{}/frozen_cue_sheet.json", release_dir_rel),
            "phrase_map": format!("{}/frozen_phrase_map.json", release_dir_rel)
        }
    });
    write_json_pretty(
        &run_dir.join(release_manifest_rel.trim_start_matches("./")),
        &manifest_value,
    )
    .map_err(|e| ApiError::internal("ARRANGEMENT_RELEASE_WRITE_FAILED", &e.to_string()))?;

    let handoff_value = serde_json::json!({
        "schema": "cssapi.runs.arrangement_immutable_handoff.v1",
        "candidate_id": entry.candidate_id,
        "candidate_name": entry.candidate_name,
        "state": entry.state,
        "release_manifest_path": release_manifest_rel,
        "release_dir": release_dir_rel,
        "immutable": true,
        "artifact_paths": {
            "cue_sheet": format!("{}/frozen_cue_sheet.json", release_dir_rel),
            "phrase_map": format!("{}/frozen_phrase_map.json", release_dir_rel)
        }
    });
    write_json_pretty(
        &run_dir.join(immutable_handoff_rel.trim_start_matches("./")),
        &handoff_value,
    )
    .map_err(|e| ApiError::internal("ARRANGEMENT_RELEASE_WRITE_FAILED", &e.to_string()))?;

    let approval_value = serde_json::json!({
        "schema": "cssapi.runs.arrangement_release_approval.v1",
        "candidate_id": entry.candidate_id,
        "candidate_name": entry.candidate_name,
        "revision_id": entry.revision_id,
        "status": "approved",
        "approved_at": entry.published_at,
        "approval_gate": "cssMV release gate",
        "release_manifest_path": release_manifest_rel
    });
    write_json_pretty(
        &run_dir.join(release_approval_rel.trim_start_matches("./")),
        &approval_value,
    )
    .map_err(|e| ApiError::internal("ARRANGEMENT_RELEASE_WRITE_FAILED", &e.to_string()))?;

    let signoff_value = serde_json::json!({
        "schema": "cssapi.runs.arrangement_release_signoff.v1",
        "candidate_id": entry.candidate_id,
        "candidate_name": entry.candidate_name,
        "status": "signed_off",
        "signed_off_at": entry.published_at,
        "signed_by": "cssMV immutable handoff",
        "immutable_handoff_path": immutable_handoff_rel
    });
    write_json_pretty(
        &run_dir.join(release_signoff_rel.trim_start_matches("./")),
        &signoff_value,
    )
    .map_err(|e| ApiError::internal("ARRANGEMENT_RELEASE_WRITE_FAILED", &e.to_string()))?;

    let delivery_certificate_value = serde_json::json!({
        "schema": "cssapi.runs.arrangement_delivery_certificate.v1",
        "candidate_id": entry.candidate_id,
        "candidate_name": entry.candidate_name,
        "revision_id": entry.revision_id,
        "version_name": entry.version_name,
        "certified_at": entry.published_at,
        "immutable": true,
        "certificate_scope": ["release_manifest", "immutable_handoff", "approval", "signoff"],
        "artifact_paths": {
            "release_manifest": release_manifest_rel,
            "immutable_handoff": immutable_handoff_rel,
            "release_approval": release_approval_rel,
            "release_signoff": release_signoff_rel
        }
    });
    write_json_pretty(
        &run_dir.join(delivery_certificate_rel.trim_start_matches("./")),
        &delivery_certificate_value,
    )
    .map_err(|e| ApiError::internal("ARRANGEMENT_RELEASE_WRITE_FAILED", &e.to_string()))?;

    let audit_trail_value = serde_json::json!({
        "schema": "cssapi.runs.arrangement_release_audit_trail.v1",
        "candidate_id": entry.candidate_id,
        "candidate_name": entry.candidate_name,
        "events": [
            {"kind":"release_manifest_written","path": release_manifest_rel, "at": entry.published_at},
            {"kind":"immutable_handoff_written","path": immutable_handoff_rel, "at": entry.published_at},
            {"kind":"release_approval_written","path": release_approval_rel, "at": entry.published_at},
            {"kind":"release_signoff_written","path": release_signoff_rel, "at": entry.published_at},
            {"kind":"delivery_certificate_written","path": delivery_certificate_rel, "at": entry.published_at}
        ],
        "auditable": true
    });
    write_json_pretty(
        &run_dir.join(release_audit_trail_rel.trim_start_matches("./")),
        &audit_trail_value,
    )
    .map_err(|e| ApiError::internal("ARRANGEMENT_RELEASE_WRITE_FAILED", &e.to_string()))?;

    let notarized_receipt_value = serde_json::json!({
        "schema": "cssapi.runs.arrangement_notarized_receipt.v1",
        "candidate_id": entry.candidate_id,
        "candidate_name": entry.candidate_name,
        "issued_at": entry.published_at,
        "notary": "cssMV release notary",
        "receipt_scope": ["immutable_handoff", "delivery_certificate", "release_audit_trail"],
        "artifact_paths": {
            "immutable_handoff": immutable_handoff_rel,
            "delivery_certificate": delivery_certificate_rel,
            "release_audit_trail": release_audit_trail_rel
        }
    });
    write_json_pretty(
        &run_dir.join(notarized_receipt_rel.trim_start_matches("./")),
        &notarized_receipt_value,
    )
    .map_err(|e| ApiError::internal("ARRANGEMENT_RELEASE_WRITE_FAILED", &e.to_string()))?;

    let downstream_compliance_feed_value = serde_json::json!({
        "schema": "cssapi.runs.arrangement_downstream_compliance_feed.v1",
        "candidate_id": entry.candidate_id,
        "candidate_name": entry.candidate_name,
        "status": "ready_for_downstream_compliance",
        "published_at": entry.published_at,
        "compliance_artifacts": {
            "release_manifest": release_manifest_rel,
            "immutable_handoff": immutable_handoff_rel,
            "release_approval": release_approval_rel,
            "release_signoff": release_signoff_rel,
            "delivery_certificate": delivery_certificate_rel,
            "release_audit_trail": release_audit_trail_rel,
            "notarized_receipt": notarized_receipt_rel
        }
    });
    write_json_pretty(
        &run_dir.join(downstream_compliance_feed_rel.trim_start_matches("./")),
        &downstream_compliance_feed_value,
    )
    .map_err(|e| ApiError::internal("ARRANGEMENT_RELEASE_WRITE_FAILED", &e.to_string()))?;

    entry.release_dir_relative_path = Some(release_dir_rel);
    entry.release_manifest_relative_path = Some(release_manifest_rel);
    entry.immutable_handoff_relative_path = Some(immutable_handoff_rel);
    entry.release_approval_relative_path = Some(release_approval_rel);
    entry.release_signoff_relative_path = Some(release_signoff_rel);
    entry.delivery_certificate_relative_path = Some(delivery_certificate_rel);
    entry.release_audit_trail_relative_path = Some(release_audit_trail_rel);
    entry.notarized_receipt_relative_path = Some(notarized_receipt_rel);
    entry.downstream_compliance_feed_relative_path = Some(downstream_compliance_feed_rel);
    refresh_arrangement_release_compliance_artifacts(run_id, entry)?;
    Ok(())
}

fn compute_arrangement_revision_diffs(
    run_id: &str,
    entries: &[RunMusicArrangementRevisionEntry],
) -> Vec<RunMusicArrangementRevisionDiff> {
    let run_dir = run_store::run_dir(run_id);
    entries
        .windows(2)
        .filter_map(|pair| {
            let newer = pair.first()?;
            let older = pair.get(1)?;
            let newer_cue = read_json_if_exists::<Value>(
                &run_dir.join(newer.cue_relative_path.trim_start_matches("./")),
            )?;
            let older_cue = read_json_if_exists::<Value>(
                &run_dir.join(older.cue_relative_path.trim_start_matches("./")),
            )?;
            let newer_phrase = read_json_if_exists::<Value>(
                &run_dir.join(newer.phrase_relative_path.trim_start_matches("./")),
            )?;
            let older_phrase = read_json_if_exists::<Value>(
                &run_dir.join(older.phrase_relative_path.trim_start_matches("./")),
            )?;
            let newer_contour = newer_cue
                .get("cue_segments")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|v| v.get("contour"))
                .and_then(|v| v.as_str());
            let older_contour = older_cue
                .get("cue_segments")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|v| v.get("contour"))
                .and_then(|v| v.as_str());
            let newer_articulation = newer_phrase
                .get("phrase_segments")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|seg| seg.get("phrase_map"))
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|v| v.get("articulation"))
                .and_then(|v| v.as_str());
            let older_articulation = older_phrase
                .get("phrase_segments")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|seg| seg.get("phrase_map"))
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|v| v.get("articulation"))
                .and_then(|v| v.as_str());
            Some(RunMusicArrangementRevisionDiff {
                from_revision_id: older.revision_id.clone(),
                to_revision_id: newer.revision_id.clone(),
                from_version_name: older.version_name.clone(),
                to_version_name: newer.version_name.clone(),
                contour_changed: newer_contour != older_contour,
                articulation_changed: newer_articulation != older_articulation,
                source_promotion_changed: newer.source_promotion_id != older.source_promotion_id,
            })
        })
        .collect()
}

fn list_rewrite_bundle_entries(run_id: &str) -> Vec<RunMusicRewriteBundleEntry> {
    let run_dir = run_store::run_dir(run_id);
    let bundle_dir = run_dir.join("build").join("rewrite_bundles");
    let Ok(entries) = fs::read_dir(&bundle_dir) else {
        return Vec::new();
    };
    let mut out = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if !path.is_file() || path.extension().and_then(|x| x.to_str()) != Some("json") {
                return None;
            }
            let meta = fs::metadata(&path).ok()?;
            let rel = path
                .strip_prefix(&run_dir)
                .ok()?
                .to_string_lossy()
                .replace('\\', "/");
            let bundle = read_json_if_exists::<Value>(&path)?;
            let bundle_id = path.file_stem()?.to_string_lossy().to_string();
            let saved_at = bundle
                .get("saved_at")
                .and_then(|v| v.as_str())
                .or_else(|| bundle.get("exported_at").and_then(|v| v.as_str()))
                .map(|s| s.to_string())
                .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
            let version_name = bundle_version_name(&bundle, &bundle_id);
            Some(RunMusicRewriteBundleEntry {
                bundle_id,
                saved_at,
                version_name,
                relative_path: format!("./{}", rel),
                download_url: encode_delivery_file_url(run_id, &format!("./{}", rel)),
                bytes: meta.len(),
                bundle,
            })
        })
        .collect::<Vec<_>>();
    out.sort_by(|a, b| b.saved_at.cmp(&a.saved_at));
    out
}

fn list_watch_snapshot_entries(run_id: &str) -> Vec<RunMusicWatchSnapshotEntry> {
    let run_dir = run_store::run_dir(run_id);
    let snapshot_dir = run_dir.join("build").join("watch_snapshots");
    let Ok(entries) = fs::read_dir(&snapshot_dir) else {
        return Vec::new();
    };
    let mut out = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if !path.is_file() || path.extension().and_then(|x| x.to_str()) != Some("json") {
                return None;
            }
            let meta = fs::metadata(&path).ok()?;
            let rel = path
                .strip_prefix(&run_dir)
                .ok()?
                .to_string_lossy()
                .replace('\\', "/");
            let payload = read_json_if_exists::<Value>(&path)?;
            let snapshot_id = path.file_stem()?.to_string_lossy().to_string();
            let saved_at = payload
                .get("saved_at")
                .and_then(|v| v.as_str())
                .or_else(|| payload.get("exported_at").and_then(|v| v.as_str()))
                .map(|s| s.to_string())
                .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
            let version_name = bundle_version_name(&payload, &snapshot_id);
            Some(RunMusicWatchSnapshotEntry {
                snapshot_id,
                saved_at,
                version_name,
                relative_path: format!("./{}", rel),
                download_url: encode_delivery_file_url(run_id, &format!("./{}", rel)),
                bytes: meta.len(),
                payload,
            })
        })
        .collect::<Vec<_>>();
    out.sort_by(|a, b| b.saved_at.cmp(&a.saved_at));
    out
}

fn list_rewrite_promotion_entries(run_id: &str) -> Vec<RunMusicRewritePromotionEntry> {
    let run_dir = run_store::run_dir(run_id);
    let promotion_dir = run_dir.join("build").join("rewrite_promotions");
    let Ok(entries) = fs::read_dir(&promotion_dir) else {
        return Vec::new();
    };
    let mut out = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if !path.is_file() || path.extension().and_then(|x| x.to_str()) != Some("json") {
                return None;
            }
            let meta = fs::metadata(&path).ok()?;
            let rel = path
                .strip_prefix(&run_dir)
                .ok()?
                .to_string_lossy()
                .replace('\\', "/");
            let payload = read_json_if_exists::<Value>(&path)?;
            let promotion_id = payload
                .get("promotion_id")
                .and_then(|v| v.as_str())
                .or_else(|| path.file_stem().and_then(|x| x.to_str()))
                .unwrap_or("rewrite_promotion")
                .to_string();
            maybe_refresh_rewrite_promotion_artifacts(run_id, &promotion_id, &payload);
            let promoted_at = payload
                .get("promoted_at")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
            let bundle_id = payload
                .get("bundle_id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let version_name = payload
                .get("version_name")
                .and_then(|v| v.as_str())
                .unwrap_or(&bundle_id)
                .to_string();
            let execution_queue_path = format!(
                "{}/{}.json",
                rewrite_execution_queue_relative_dir(),
                promotion_id
            );
            let job_status_path = format!(
                "{}/{}.json",
                rewrite_job_status_relative_dir(),
                promotion_id
            );
            let apply_back_result_path = format!(
                "{}/{}.json",
                rewrite_apply_back_relative_dir(),
                promotion_id
            );
            Some(RunMusicRewritePromotionEntry {
                promotion_id,
                promoted_at,
                bundle_id,
                version_name,
                relative_path: format!("./{}", rel),
                download_url: encode_delivery_file_url(run_id, &format!("./{}", rel)),
                bytes: meta.len(),
                payload,
                execution_queue_path: Some(execution_queue_path.clone()),
                job_status_path: Some(job_status_path.clone()),
                apply_back_result_path: Some(apply_back_result_path.clone()),
                job_status: read_json_if_exists(
                    &run_dir.join(job_status_path.trim_start_matches("./")),
                ),
                apply_back_result: read_json_if_exists(
                    &run_dir.join(apply_back_result_path.trim_start_matches("./")),
                ),
            })
        })
        .collect::<Vec<_>>();
    out.sort_by(|a, b| b.promoted_at.cmp(&a.promoted_at));
    out
}

fn compute_rewrite_bundle_diffs(
    entries: &[RunMusicRewriteBundleEntry],
) -> Vec<RunMusicRewriteBundleDiff> {
    entries
        .windows(2)
        .filter_map(|pair| {
            let newer = pair.first()?;
            let older = pair.get(1)?;
            let newer_phrases = newer
                .bundle
                .get("source_phrase_ids")
                .and_then(|v| v.as_array())
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let older_phrases = older
                .bundle
                .get("source_phrase_ids")
                .and_then(|v| v.as_array())
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let added_source_phrase_ids = newer_phrases
                .iter()
                .filter(|id| !older_phrases.contains(id))
                .cloned()
                .collect::<Vec<_>>();
            let removed_source_phrase_ids = older_phrases
                .iter()
                .filter(|id| !newer_phrases.contains(id))
                .cloned()
                .collect::<Vec<_>>();
            let newer_ops = newer
                .bundle
                .get("provider_payload")
                .and_then(|v| v.get("rewrite_ops"))
                .and_then(|v| v.as_array())
                .map(|v| v.len())
                .unwrap_or(0) as i64;
            let older_ops = older
                .bundle
                .get("provider_payload")
                .and_then(|v| v.get("rewrite_ops"))
                .and_then(|v| v.as_array())
                .map(|v| v.len())
                .unwrap_or(0) as i64;
            Some(RunMusicRewriteBundleDiff {
                from_bundle_id: older.bundle_id.clone(),
                to_bundle_id: newer.bundle_id.clone(),
                from_version_name: older.version_name.clone(),
                to_version_name: newer.version_name.clone(),
                added_source_phrase_ids,
                removed_source_phrase_ids,
                rewrite_op_delta: newer_ops - older_ops,
                section_changed: older
                    .bundle
                    .get("section")
                    .and_then(|v| v.get("id"))
                    .and_then(|v| v.as_str())
                    != newer
                        .bundle
                        .get("section")
                        .and_then(|v| v.get("id"))
                        .and_then(|v| v.as_str()),
                mode_changed: older.bundle.get("mode").and_then(|v| v.as_str())
                    != newer.bundle.get("mode").and_then(|v| v.as_str()),
            })
        })
        .collect()
}

#[derive(Debug, Deserialize)]
pub struct RunsCreateRequest {
    pub cssl: String,
    pub ui_lang: Option<String>,
    pub tier: Option<String>,
    pub options: Option<Value>,
    pub config: Option<RunConfig>,
    pub retry_policy: Option<RetryPolicy>,
    pub commands: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunMusicDeliveryDashboardResponse {
    pub schema: &'static str,
    pub run_id: String,
    pub status: String,
    pub updated_at: String,
    pub dashboard: Option<crate::audio_provider::ProviderDeliveryDashboardFeed>,
    pub receipt_sync: Option<crate::audio_provider::ProviderReceiptSync>,
    pub publish_state_machine: Option<Value>,
    pub publish_executor: Option<crate::audio_provider::ProviderPublishExecutorReport>,
    pub downstream_delivery: Option<crate::audio_provider::ProviderDownstreamDeliveryReport>,
    pub compliance_ack: Option<Value>,
    pub regulator_receipt: Option<Value>,
    pub audit_timeline: Option<Value>,
    pub compliance_dashboard_lane: Option<Value>,
    pub compliance_exception_flags: Vec<Value>,
    pub compliance_sla_clock: Option<Value>,
    pub compliance_alert_routing: Option<Value>,
    pub compliance_escalation_policy: Option<Value>,
    pub compliance_operator_actions: Vec<Value>,
    pub compliance_webhook_dispatch: Option<Value>,
    pub compliance_ticket_mapping: Option<Value>,
    pub compliance_ack_reconciliation: Option<Value>,
    pub compliance_rotation_control: Option<Value>,
    pub compliance_vendor_registry: Option<Value>,
    pub compliance_reopen_control: Option<Value>,
    pub compliance_preset_control: Option<Value>,
    pub compliance_audit_log: Option<Value>,
    pub compliance_scoped_permissions: Value,
    pub compliance_actor_identity: Option<Value>,
    pub compliance_permission_check: Option<Value>,
    pub compliance_audit_signature: Option<Value>,
    pub compliance_actor_directory: Option<Value>,
    pub compliance_role_policy_presets: Value,
    pub compliance_approval_chain: Option<Value>,
    pub compliance_approver_routing: Value,
    pub compliance_required_signers: Value,
    pub compliance_release_quorum: Option<Value>,
    pub compliance_locked_publish_gate: Option<Value>,
    pub compliance_release_unblock_token: Option<Value>,
    pub compliance_immutable_publish_authorization: Option<Value>,
    pub blocked_publish_explainer: Option<Value>,
    pub approval_to_publish_trace: Option<Value>,
    pub artifact_paths: BTreeMap<String, String>,
    pub package_browser: Vec<RunMusicDeliveryArtifactLink>,
    pub watch_snapshots: Vec<RunMusicWatchSnapshotEntry>,
    pub rewrite_bundles: Vec<RunMusicRewriteBundleEntry>,
    pub rewrite_bundle_diffs: Vec<RunMusicRewriteBundleDiff>,
    pub rewrite_promotions: Vec<RunMusicRewritePromotionEntry>,
    pub arrangement_revisions: Vec<RunMusicArrangementRevisionEntry>,
    pub arrangement_revision_diffs: Vec<RunMusicArrangementRevisionDiff>,
    pub arrangement_revision_head: Option<RunMusicArrangementRevisionEntry>,
    pub arrangement_release_candidates: Vec<RunMusicArrangementReleaseCandidateEntry>,
    pub arrangement_locked_revision: Option<RunMusicArrangementReleaseCandidateEntry>,
    pub arrangement_published_revision: Option<RunMusicArrangementReleaseCandidateEntry>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunMusicDeliveryArtifactLink {
    pub category: String,
    pub label: String,
    pub relative_path: String,
    pub mime: String,
    pub bytes: u64,
    pub download_url: String,
}

#[derive(Debug, Deserialize)]
pub struct RunMusicDeliveryArtifactQuery {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunMusicComplianceActionRequest {
    pub action: String,
    pub candidate_id: Option<String>,
    pub target_path: Option<String>,
    pub target_team: Option<String>,
    pub note: Option<String>,
    pub active_kid: Option<String>,
    pub secret_keyset: Option<String>,
    pub vendor: Option<String>,
    pub required_fields: Option<Vec<String>>,
    pub optional_fields: Option<Vec<String>>,
    pub field_defaults: Option<Value>,
    pub reopen_reason: Option<String>,
    pub preset_name: Option<String>,
    pub scoped_permissions: Option<Value>,
    pub actor_id: Option<String>,
    pub actor_name: Option<String>,
    pub actor_role: Option<String>,
    pub actor_directory: Option<Value>,
    pub role_policy_name: Option<String>,
    pub approval_decision: Option<String>,
    pub approver_routing: Option<Value>,
    pub required_signers: Option<Value>,
    pub quorum_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunMusicComplianceActionResponse {
    pub schema: &'static str,
    pub run_id: String,
    pub action: String,
    pub status: String,
    pub result_path: String,
    pub candidate_id: Option<String>,
    pub adapter_result_path: Option<String>,
    pub adapter_status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunMusicRewriteBundleEntry {
    pub bundle_id: String,
    pub saved_at: String,
    pub version_name: String,
    pub relative_path: String,
    pub download_url: String,
    pub bytes: u64,
    pub bundle: Value,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunMusicWatchSnapshotEntry {
    pub snapshot_id: String,
    pub saved_at: String,
    pub version_name: String,
    pub relative_path: String,
    pub download_url: String,
    pub bytes: u64,
    pub payload: Value,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RunMusicWatchSnapshotSaveRequest {
    pub payload: Value,
    pub version_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunMusicWatchSnapshotSaveResponse {
    pub schema: &'static str,
    pub run_id: String,
    pub entry: RunMusicWatchSnapshotEntry,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RunMusicRewriteBundleSaveRequest {
    pub bundle: Value,
    pub version_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunMusicRewriteBundleSaveResponse {
    pub schema: &'static str,
    pub run_id: String,
    pub entry: RunMusicRewriteBundleEntry,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunMusicRewriteBundleDiff {
    pub from_bundle_id: String,
    pub to_bundle_id: String,
    pub from_version_name: String,
    pub to_version_name: String,
    pub added_source_phrase_ids: Vec<String>,
    pub removed_source_phrase_ids: Vec<String>,
    pub rewrite_op_delta: i64,
    pub section_changed: bool,
    pub mode_changed: bool,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RunMusicRewritePromoteRequest {
    pub bundle_id: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunMusicRewritePromotionEntry {
    pub promotion_id: String,
    pub promoted_at: String,
    pub bundle_id: String,
    pub version_name: String,
    pub relative_path: String,
    pub download_url: String,
    pub bytes: u64,
    pub payload: Value,
    pub execution_queue_path: Option<String>,
    pub job_status_path: Option<String>,
    pub apply_back_result_path: Option<String>,
    pub job_status: Option<Value>,
    pub apply_back_result: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunMusicRewritePromoteResponse {
    pub schema: &'static str,
    pub run_id: String,
    pub entry: RunMusicRewritePromotionEntry,
}

#[derive(Debug, Serialize, Deserialize, ToSchema, Clone)]
pub struct RunMusicArrangementRevisionEntry {
    pub revision_id: String,
    pub created_at: String,
    pub source_promotion_id: String,
    pub version_name: String,
    pub cue_relative_path: String,
    pub phrase_relative_path: String,
    pub state: String,
    pub rolled_back_from: Option<String>,
    pub merged_from: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunMusicArrangementRevisionDiff {
    pub from_revision_id: String,
    pub to_revision_id: String,
    pub from_version_name: String,
    pub to_version_name: String,
    pub contour_changed: bool,
    pub articulation_changed: bool,
    pub source_promotion_changed: bool,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RunMusicArrangementRevisionActionRequest {
    pub revision_id: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunMusicArrangementRevisionActionResponse {
    pub schema: &'static str,
    pub run_id: String,
    pub revision: RunMusicArrangementRevisionEntry,
}

#[derive(Debug, Serialize, Deserialize, ToSchema, Clone)]
pub struct RunMusicArrangementReleaseCandidateEntry {
    pub candidate_id: String,
    pub revision_id: String,
    pub version_name: String,
    pub candidate_name: String,
    pub nominated_at: String,
    pub state: String,
    pub locked_at: Option<String>,
    pub published_at: Option<String>,
    pub release_dir_relative_path: Option<String>,
    pub release_manifest_relative_path: Option<String>,
    pub immutable_handoff_relative_path: Option<String>,
    pub release_approval_relative_path: Option<String>,
    pub release_signoff_relative_path: Option<String>,
    pub delivery_certificate_relative_path: Option<String>,
    pub release_audit_trail_relative_path: Option<String>,
    pub notarized_receipt_relative_path: Option<String>,
    pub downstream_compliance_feed_relative_path: Option<String>,
    pub compliance_ack_relative_path: Option<String>,
    pub regulator_receipt_relative_path: Option<String>,
    pub audit_timeline_relative_path: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RunMusicArrangementReleaseCandidateRequest {
    pub revision_id: String,
    pub candidate_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunMusicArrangementReleaseCandidateResponse {
    pub schema: &'static str,
    pub run_id: String,
    pub entry: RunMusicArrangementReleaseCandidateEntry,
}

pub fn suggest_langs_for(detected: &str) -> Vec<String> {
    match detected {
        "zh" | "zh-cn" | "zh-tw" | "zh-CN" | "zh-TW" => vec!["en", "ja", "ko", "fr"],
        "ja" => vec!["zh", "en", "ko", "fr"],
        "ko" => vec!["zh", "en", "ja", "fr"],
        "fr" => vec!["en", "zh", "ja", "ko"],
        _ => vec!["zh", "ja", "ko", "fr"],
    }
    .into_iter()
    .map(|s| s.to_string())
    .collect()
}

fn voice_extract(req_commands: &Value) -> Option<(String, u64, String, String)> {
    let v = req_commands.get("voice")?;
    let mime = v
        .get("mime")
        .and_then(|x| x.as_str())
        .unwrap_or("audio/webm")
        .to_string();
    let bytes = v.get("bytes").and_then(|x| x.as_u64()).unwrap_or(0);
    let b64 = v
        .get("b64")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let mode = v
        .get("mode")
        .and_then(|x| x.as_str())
        .unwrap_or("single")
        .to_string();
    Some((mime, bytes, b64, mode))
}

fn b64_decode(s: &str) -> Option<Vec<u8>> {
    if s.is_empty() {
        return None;
    }
    base64::engine::general_purpose::STANDARD.decode(s).ok()
}

fn shell_single_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

fn creative_str(cmd: &Value, key: &str) -> String {
    cmd.get("creative")
        .and_then(|v| v.get(key))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string()
}

fn creative_u64(cmd: &Value, key: &str, d: u64) -> u64 {
    cmd.get("creative")
        .and_then(|v| v.get(key))
        .and_then(|v| v.as_u64())
        .unwrap_or(d)
}

fn default_stage_record(timeout_s: u64, outputs: Vec<PathBuf>) -> StageRecord {
    StageRecord {
        status: StageStatus::PENDING,
        started_at: None,
        ended_at: None,
        exit_code: None,
        command: None,
        outputs,
        retries: 0,
        error: None,
        heartbeat_at: None,
        last_heartbeat_at: None,
        timeout_seconds: Some(timeout_s),
        error_code: None,
        pid: None,
        pgid: None,
        meta: Value::Object(Default::default()),
        duration_seconds: None,
    }
}

fn parse_vec3(v: &Value) -> Option<crate::physics_engine::types::Vec3> {
    Some(crate::physics_engine::types::Vec3::new(
        v.get("x")?.as_f64()? as f32,
        v.get("y")?.as_f64()? as f32,
        v.get("z")?.as_f64()? as f32,
    ))
}

fn apply_immersion_config(run_state: &mut RunState, commands: &Value) {
    let Some(immersion) = commands.get("immersion") else {
        return;
    };

    if let Ok(state) = serde_json::from_value::<crate::immersion_engine::state::ImmersionState>(
        immersion
            .get("state")
            .cloned()
            .unwrap_or_else(|| immersion.clone()),
    ) {
        run_state.immersion = state;
    }

    if let Some(zones) = immersion.get("zones") {
        if let Ok(parsed) = serde_json::from_value::<
            Vec<crate::immersion_engine::zones::ImmersionZone>,
        >(zones.clone())
        {
            run_state.immersion_zones = parsed;
        }
    }

    if let Some(pos) = immersion.get("viewer_position").and_then(parse_vec3) {
        run_state.viewer_position = Some(pos);
    }

    let mut presence =
        crate::presence_engine::runtime::PresenceEngine::new(run_state.presence.clone());
    presence.sync_from_immersion(&run_state.immersion);
    presence.set_scene(run_state.immersion.anchor.scene_id.clone());
    if let Some(ids) = immersion
        .get("perceived_by")
        .and_then(|v| serde_json::from_value::<Vec<String>>(v.clone()).ok())
    {
        presence.set_perceived_by(ids);
    }
    run_state.presence = presence.state;
}

fn collect_scene_tags(commands: &Value, run_state: &RunState) -> Vec<String> {
    let mut tags = Vec::new();
    if let Some(arr) = commands
        .get("scene_semantics")
        .and_then(|v| v.get("tags"))
        .and_then(|v| v.as_array())
    {
        tags.extend(
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_lowercase())),
        );
    }
    if let Some(arr) = commands
        .get("creative")
        .and_then(|v| v.get("tags"))
        .and_then(|v| v.as_array())
    {
        tags.extend(
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_lowercase())),
        );
    }
    if let Some(s) = commands
        .get("creative")
        .and_then(|v| v.get("mood"))
        .and_then(|v| v.as_str())
    {
        tags.push(s.to_lowercase());
    }
    tags.push(run_state.cssl.to_lowercase());
    tags
}

fn apply_scene_semantics(run_state: &mut RunState, commands: &Value) {
    let scene_id = commands
        .get("scene_semantics")
        .and_then(|v| v.get("scene_id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| run_state.immersion.anchor.scene_id.clone());
    let tags = collect_scene_tags(commands, run_state);
    let dominant_emotion = commands
        .get("creative")
        .and_then(|v| v.get("mood"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let mut engine = crate::scene_semantics_engine::runtime::SceneSemanticsEngine::new(
        run_state.scene_semantics.clone(),
    );
    engine.plan_and_set(
        crate::scene_semantics_engine::planner::SceneSemanticPlanningInput {
            scene_id,
            tags,
            dominant_relationship: None,
            dominant_emotion,
        },
    );
    run_state.scene_semantics = engine.state;
}

fn stage_is_primary_only(name: &str, matrix: &crate::dag_v3::VersionMatrix) -> bool {
    let parts: Vec<&str> = name.split('.').collect();
    if parts.len() < 2 {
        return true;
    }
    let pl = matrix.primary_lang.as_str();
    let pv = matrix.primary_voice.as_str();
    match parts[0] {
        "lyrics_adapt" | "lyrics_timing" | "subtitles" | "karaoke_map" | "karaoke_ass"
        | "lyrics_lrc" => parts.get(1).copied() == Some(pl),
        "vocals" | "vocals_align" | "mix" | "master" | "render_mv" | "render_karaoke_mv"
        | "render_audio_only" => {
            parts.get(1).copied() == Some(pl) && parts.get(2).copied() == Some(pv)
        }
        _ => true,
    }
}

fn maybe_apply_dag_v3_plan(run_state: &mut RunState, commands: &Value) -> bool {
    let Some(intent_v) = commands.get("intent") else {
        return false;
    };
    let Some(matrix_v) = commands.get("version_matrix") else {
        return false;
    };
    let Ok(intent) = serde_json::from_value::<crate::dag_v3::Intent>(intent_v.clone()) else {
        return false;
    };
    let Ok(matrix) = serde_json::from_value::<crate::dag_v3::VersionMatrix>(matrix_v.clone())
    else {
        return false;
    };

    let mut stages = crate::dag_v3::expand_stages(&intent, &matrix);
    crate::dag_v3::primary_only_filter(&mut stages, &matrix);
    stages.retain(|s| stage_is_primary_only(&s.name.0, &matrix));

    let names: std::collections::BTreeSet<String> =
        stages.iter().map(|s| s.name.0.clone()).collect();
    for s in &mut stages {
        s.deps.retain(|d| names.contains(&d.0));
    }

    run_state.stages.clear();
    run_state.dag.nodes.clear();
    run_state.dag_edges.clear();
    run_state.topo_order.clear();

    for s in &stages {
        let outputs = s.outputs.iter().map(PathBuf::from).collect::<Vec<_>>();
        let mut rec = default_stage_record(run_state.config.stage_timeout_seconds, outputs);
        rec.command = match s.name.0.as_str() {
            "lyrics_primary" => commands["lyrics"]
                .get("command")
                .and_then(|v| v.as_str())
                .map(|x| x.to_string()),
            "music_compose" => commands
                .get("music")
                .and_then(|v| v.as_str())
                .map(|x| x.to_string()),
            n if n.starts_with("vocals.") => commands
                .get("vocals")
                .and_then(|v| v.as_str())
                .map(|x| x.to_string()),
            n if n.starts_with("render_") => commands
                .get("render")
                .and_then(|v| v.as_str())
                .map(|x| x.to_string()),
            _ => Some(
                s.outputs
                    .iter()
                    .map(|p| format!("mkdir -p \"$(dirname \\\"{}\\\")\" && : > \"{}\"", p, p))
                    .collect::<Vec<_>>()
                    .join(" && "),
            ),
        };
        if let Some(map) = rec.meta.as_object_mut() {
            map.insert("commands".into(), commands.clone());
            map.insert(
                "backend_chain".into(),
                serde_json::to_value(crate::dag_v3::fallback_chain_for_stage(&s.name.0))
                    .unwrap_or_else(|_| serde_json::json!([])),
            );
        }
        run_state.stages.insert(s.name.0.clone(), rec);
        run_state.dag.nodes.push(crate::run_state::DagNodeMeta {
            name: s.name.0.clone(),
            deps: s.deps.iter().map(|d| d.0.clone()).collect(),
        });
        run_state.dag_edges.insert(
            s.name.0.clone(),
            s.deps.iter().map(|d| d.0.clone()).collect(),
        );
        run_state.topo_order.push(s.name.0.clone());
    }
    let artifacts = crate::dag_v3::collect_stable_artifacts(&stages);
    let mut artifact_map = serde_json::Map::new();
    for a in artifacts.items {
        artifact_map.insert(a.stable_key, serde_json::json!(a.path));
    }
    run_state.commands["artifact_keys"] = Value::Object(artifact_map);
    run_state.dag.schema = "css.pipeline.dag.v3".to_string();
    true
}
#[derive(Debug, Serialize, ToSchema)]
pub struct RunsCreateResponse {
    pub schema: &'static str,
    pub run_id: String,
    pub status_url: String,
    pub ready_url: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RunsStatusResponse {
    schema: &'static str,
    run_id: String,
    status: RunStatus,
    updated_at: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RunsListQuery {
    pub limit: Option<usize>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RunsListItem {
    run_id: String,
    status: String,
    updated_at_ms: i64,
    run_dir: String,
    run_json: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RunsListResponse {
    schema: &'static str,
    root: String,
    limit: i64,
    status: Option<String>,
    items: Vec<RunsListItem>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct DagReadyMeta {
    schema: String,
    concurrency: usize,
    nodes_total: usize,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RunReadyResponse {
    schema: &'static str,
    run_id: String,
    status: RunStatus,
    dag: DagReadyMeta,
    topo_order: Vec<String>,
    ready: Vec<String>,
    running: Vec<String>,
    summary: ready::ReadySummary,
    summary_text: String,
    video_shots: ready::VideoShotsSummary,
    counters: ready::ReadyCounters,
    running_pids: Vec<ready::RunningPid>,
    mix: ready::MixSummary,
    subtitles: ready::SubtitlesSummary,
    blocking: Vec<ready::BlockingItem>,
    stage_seq: u64,
    last_event: Option<ready::ReadyEvent>,
    event: Option<String>,
    artifacts: serde_json::Value,
    failures: Vec<ReadyFailure>,
    cancel_requested: bool,
    cancelled_at: Option<String>,
    updated_at: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ReadyFailure {
    stage: String,
    error: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RunReadyQuery {
    pub since_seq: Option<u64>,
    pub trend_window: Option<i64>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RunQualityHistoryQuery {
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RunQualityHistoryItem {
    pub ts: String,
    pub seq: u64,
    pub score: u32,
    pub max: u32,
    pub blocking_gate: Option<String>,
    pub subtitles_audio_delta_before_s: Option<f64>,
    pub subtitles_audio_delta_s: Option<f64>,
    pub subtitles_audio_delta_improved_s: Option<f64>,
    pub subtitles_audio_max_delta_s: Option<f64>,
    pub milestone_ready: bool,
    pub breakdown: BTreeMap<String, u32>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RunQualityHistoryResponse {
    pub schema: &'static str,
    pub run_id: String,
    pub items: Vec<RunQualityHistoryItem>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub versions: Option<crate::quality_versions::QualityVersionsView>,
}

fn quality_versions_from_state(
    run_id: &str,
    st: &RunState,
) -> Option<crate::quality_versions::QualityVersionsView> {
    let plan = if st.commands.get("dag_version").and_then(|v| v.as_str()) == Some("v3") {
        run_store::load_run_plan_v3(run_id)
            .ok()
            .or_else(|| crate::dag_v3::bridge::build_execution_plan_from_commands(st).ok())
    } else {
        None
    };
    Some(crate::quality_versions::build_quality_versions_view(
        st,
        plan.as_ref(),
    ))
}
#[derive(Debug, Serialize)]
struct CancelResponse {
    schema: &'static str,
    run_id: String,
    cancel_requested: bool,
    already_done: bool,
    status: String,
    stage_seq: u64,
}

#[utoipa::path(
    get,
    path = "/cssapi/v1/runs",
    tag = "runs",
    params(
        ("limit" = Option<usize>, Query, description = "Result limit, default 50, max 200"),
        ("status" = Option<String>, Query, description = "Filter by run status")
    ),
    responses(
        (status = 200, description = "List runs", body = RunsListResponse,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 500, description = "Server error", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        )
    )
)]
pub async fn runs_list(
    headers: HeaderMap,
    Query(q): Query<RunsListQuery>,
) -> ApiResult<RunsListResponse> {
    let _lang = crate::i18n::pick_lang(None, &headers, None);
    let root = run_store::runs_root();
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let want_status = q.status.map(|s| s.to_uppercase());

    let mut items: Vec<(i64, RunsListItem)> = Vec::new();
    let rd = fs::read_dir(&root).map_err(map_io)?;

    for ent in rd.flatten() {
        let path = ent.path();
        if !path.is_dir() {
            continue;
        }
        let run_id = match path.file_name() {
            Some(v) => v.to_string_lossy().to_string(),
            None => continue,
        };
        let run_json = path.join("run.json");
        if !run_json.exists() {
            continue;
        }

        let mtime = ent
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        let txt = fs::read_to_string(&run_json).unwrap_or_else(|_| "{}".to_string());
        let v: serde_json::Value =
            serde_json::from_str(&txt).unwrap_or_else(|_| serde_json::json!({}));
        let st = v
            .get("status")
            .and_then(|x| x.as_str())
            .unwrap_or("UNKNOWN")
            .to_uppercase();

        if let Some(ws) = &want_status {
            if st != *ws {
                continue;
            }
        }

        items.push((
            mtime,
            RunsListItem {
                run_id,
                status: st,
                updated_at_ms: mtime,
                run_dir: path.display().to_string(),
                run_json: run_json.display().to_string(),
            },
        ));
    }

    items.sort_by_key(|(t, _)| Reverse(*t));
    let out = items
        .into_iter()
        .take(limit)
        .map(|(_, v)| v)
        .collect::<Vec<_>>();

    Ok(Json(RunsListResponse {
        schema: "cssapi.runs.list.v1",
        root: root.display().to_string(),
        limit: limit as i64,
        status: want_status,
        items: out,
    }))
}

#[utoipa::path(
    post,
    path = "/cssapi/v1/runs",
    tag = "runs",
    request_body = serde_json::Value,
    responses(
        (status = 202, description = "Run queued", body = RunsCreateResponse,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 409, description = "Conflict", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 422, description = "Invalid request", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 500, description = "Server error", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        )
    )
)]
pub async fn runs_create(
    headers: HeaderMap,
    body: Result<Json<RunsCreateRequest>, JsonRejection>,
) -> Result<(StatusCode, Json<RunsCreateResponse>), ApiError> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let Json(body) = body.map_err(|e| {
        ApiError::unprocessable(
            "INVALID_REQUEST",
            crate::i18n::t(lang, "invalid_request_body"),
        )
        .with_details(serde_json::json!({
            "reason": e.body_text()
        }))
    })?;

    if jobs::queue::queued_or_running_count().await > 20 {
        return Err(ApiError::too_many_requests(
            "SYSTEM_BUSY",
            crate::i18n::t(lang, "too_many_runs"),
        ));
    }

    let run_id = runner::new_run_id();
    run_store::ensure_run_dir(&run_id).map_err(map_io)?;

    let mut cssl = body.cssl.trim().to_string();
    if cssl.is_empty() {
        let seed = uuid::Uuid::new_v4().to_string();
        cssl = format!("Untitled {}", &seed[..8]);
    }

    let mut run_state = runner::init_run_state(
        run_id.clone(),
        body.ui_lang.unwrap_or_else(|| "en".to_string()),
        body.tier.unwrap_or_else(|| "basic".to_string()),
        cssl.clone(),
    );
    run_state.cssl = cssl.clone();

    let run_dir = run_store::run_dir(&run_id);
    run_state.config.out_dir = run_dir;
    if let Some(cfg) = body.config {
        run_state.config.wiki_enabled = cfg.wiki_enabled;
        run_state.config.civ_linked = cfg.civ_linked;
        run_state.config.heartbeat_interval_seconds = cfg.heartbeat_interval_seconds;
        run_state.config.stage_timeout_seconds = cfg.stage_timeout_seconds;
        run_state.config.stuck_timeout_seconds = cfg.stuck_timeout_seconds;
    }
    if let Some(retry) = body.retry_policy {
        run_state.retry_policy = retry;
    }

    let legacy_compiled = body.commands.as_ref().and_then(|v| {
        serde_json::from_value::<crate::dsl::compile::CompiledCommands>(v.clone()).ok()
    });
    let mut compiled = legacy_compiled.unwrap_or(crate::dsl::compile::CompiledCommands {
        lyrics:
            "mkdir -p ./build && printf '%s\\n' '{\"schema\":\"css.lyrics.v1\",\"lines\":[\"demo\"]}' > ./build/lyrics.json"
                .to_string(),
        music: "mkdir -p ./build && ffmpeg -y -hide_banner -loglevel error -f lavfi -i anullsrc=r=48000:cl=stereo -t 8 -c:a pcm_s16le ./build/music.wav".to_string(),
        vocals: "mkdir -p ./build && ffmpeg -y -hide_banner -loglevel error -f lavfi -i anullsrc=r=48000:cl=stereo -t 8 -c:a pcm_s16le ./build/vocals.wav".to_string(),
        video: "echo \"video handled by video executor\"".to_string(),
        render: "echo \"render handled by runner\"".to_string(),
    });

    let creative = body
        .commands
        .as_ref()
        .and_then(|c| c.get("creative"))
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    let creative_genre = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "genre",
    );
    let creative_mood = creative_str(&serde_json::json!({ "creative": creative.clone() }), "mood");
    let creative_instrument = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "instrument",
    );
    let creative_ambience = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "ambience",
    );
    let creative_instrumentation = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "instrumentation",
    );
    let creative_vocal = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "vocal_gender",
    );
    let creative_vocal_style = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "vocal_style",
    );
    let creative_ensemble_style = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "ensemble_style",
    );
    let creative_dynamics_curve = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "dynamics_curve",
    );
    let creative_section_form = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "section_form",
    );
    let creative_articulation_bias = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "articulation_bias",
    );
    let creative_voicing_register = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "voicing_register",
    );
    let creative_expression_cc_bias = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "expression_cc_bias",
    );
    let creative_inspiration_notes = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "inspiration_notes",
    );
    let creative_licensed_style_pack = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "licensed_style_pack",
    );
    let creative_external_audio_adapter = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "external_audio_adapter",
    );
    let creative_prompt = creative_str(
        &serde_json::json!({ "creative": creative.clone() }),
        "prompt",
    );
    let creative_tempo = creative_u64(
        &serde_json::json!({ "creative": creative.clone() }),
        "tempo_bpm",
        88,
    );
    let creative_arrangement_density = creative
        .get("arrangement_density")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.6_f64)
        .clamp(0.2, 1.0);
    let creative_percussion_activity = creative
        .get("percussion_activity")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.45_f64)
        .clamp(0.0, 1.0);
    let creative_humanization = creative
        .get("humanization")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.35_f64)
        .clamp(0.0, 1.0);

    let mut lyric_lines = vec![cssl.clone()];
    if !creative_genre.is_empty() {
        lyric_lines.push(format!("Style: {}", creative_genre));
    }
    if !creative_mood.is_empty() {
        lyric_lines.push(format!("Mood: {}", creative_mood));
    }
    if !creative_instrument.is_empty() {
        lyric_lines.push(format!("Lead: {}", creative_instrument));
    }
    if !creative_ambience.is_empty() {
        lyric_lines.push(format!("Ambience: {}", creative_ambience));
    }
    if !creative_instrumentation.is_empty() {
        lyric_lines.push(format!("Instrumentation: {}", creative_instrumentation));
    }
    if !creative_vocal.is_empty() {
        lyric_lines.push(format!("Vocal: {}", creative_vocal));
    }
    if !creative_vocal_style.is_empty() {
        lyric_lines.push(format!("Vocal Style: {}", creative_vocal_style));
    }
    if !creative_ensemble_style.is_empty() {
        lyric_lines.push(format!("Ensemble Style: {}", creative_ensemble_style));
    }
    if !creative_dynamics_curve.is_empty() {
        lyric_lines.push(format!("Dynamics Curve: {}", creative_dynamics_curve));
    }
    if !creative_section_form.is_empty() {
        lyric_lines.push(format!("Section Form: {}", creative_section_form));
    }
    if !creative_articulation_bias.is_empty() {
        lyric_lines.push(format!("Articulation Bias: {}", creative_articulation_bias));
    }
    if !creative_voicing_register.is_empty() {
        lyric_lines.push(format!("Voicing Register: {}", creative_voicing_register));
    }
    if !creative_expression_cc_bias.is_empty() {
        lyric_lines.push(format!(
            "Expression CC Bias: {}",
            creative_expression_cc_bias
        ));
    }
    lyric_lines.push(format!(
        "Arrangement Density: {:.2}",
        creative_arrangement_density
    ));
    lyric_lines.push(format!(
        "Percussion Activity: {:.2}",
        creative_percussion_activity
    ));
    lyric_lines.push(format!("Humanization: {:.2}", creative_humanization));
    if !creative_inspiration_notes.is_empty() {
        lyric_lines.push(format!("Inspiration Notes: {}", creative_inspiration_notes));
    }
    if !creative_licensed_style_pack.is_empty() {
        lyric_lines.push(format!(
            "Licensed Style Pack: {}",
            creative_licensed_style_pack
        ));
    }
    if !creative_external_audio_adapter.is_empty() {
        lyric_lines.push(format!(
            "External Audio Adapter: {}",
            creative_external_audio_adapter
        ));
    }
    if !creative_prompt.is_empty() {
        lyric_lines.push(creative_prompt.clone());
    }
    lyric_lines.push("Verse 1: 云阙之上风起，心火未央。".to_string());
    lyric_lines.push("Chorus: 凌霄宝殿，万象成章。".to_string());
    let lyrics_json = serde_json::json!({
        "schema": "css.lyrics.v1",
        "title": cssl.clone(),
        "creative": creative.clone(),
        "lines": lyric_lines
    });
    if let Ok(lyrics_json_text) = serde_json::to_string(&lyrics_json) {
        compiled.lyrics = format!(
            "mkdir -p ./build && printf '%s\\n' {} > ./build/lyrics.json",
            shell_single_quote(&lyrics_json_text)
        );
    }

    let detected_lang = run_state.ui_lang.clone();
    let primary_lang = detected_lang.clone();
    let suggest_langs = suggest_langs_for(&detected_lang);
    let mut commands = serde_json::json!({
        "schema":"css.commands.v1",
        "film_runtime": {
            "enabled": true,
            "mode": "interactive_film"
        },
        "lyrics": {
            "command": compiled.lyrics.clone(),
            "detected_lang": detected_lang,
            "primary_lang": primary_lang,
            "suggest_langs": suggest_langs
        },
        "music": compiled.music.clone(),
        "vocals": compiled.vocals.clone(),
        "render": compiled.render.clone(),
        "video": {
            "schema":"css.video.commands.v1",
            "shots_n": env_usize("VIDEO_SHOTS", 8),
            "resolution": { "w": env_u32("VIDEO_W", 1280), "h": env_u32("VIDEO_H", 720) },
            "fps": env_u32("VIDEO_FPS", 30),
            "seed": env_u64("VIDEO_SEED", 123),
            "duration_s": env_f64("VIDEO_DURATION_S", 8.0),
            "storyboard_path": "./build/video/storyboard.json",
            "shots_dir": "./build/video/shots",
            "shots_list_path": "./build/video/shots.txt",
            "out_mp4": "./build/video/video.mp4"
        }
    });
    if let Some(v) = body.options.as_ref().and_then(|o| o.get("video")) {
        if let Some(x) = v.get("shots_n").and_then(|x| x.as_u64()) {
            commands["video"]["shots_n"] = serde_json::json!(x as usize);
        }
        if let Some(x) = v.get("fps").and_then(|x| x.as_u64()) {
            commands["video"]["fps"] = serde_json::json!(x as u32);
        }
        if let Some(x) = v.get("seed").and_then(|x| x.as_u64()) {
            commands["video"]["seed"] = serde_json::json!(x);
        }
        if let Some(x) = v.get("duration_s").and_then(|x| x.as_f64()) {
            commands["video"]["duration_s"] = serde_json::json!(x);
        }
        if let Some(r) = v.get("resolution") {
            if let Some(x) = r.get("w").and_then(|x| x.as_u64()) {
                commands["video"]["resolution"]["w"] = serde_json::json!(x as u32);
            }
            if let Some(x) = r.get("h").and_then(|x| x.as_u64()) {
                commands["video"]["resolution"]["h"] = serde_json::json!(x as u32);
            }
        }
    }
    if let Some(v) = body.commands.as_ref().and_then(|o| o.get("video")) {
        if let Some(x) = v.get("shots_n").and_then(|x| x.as_u64()) {
            commands["video"]["shots_n"] = serde_json::json!(x as usize);
        }
        if let Some(x) = v.get("fps").and_then(|x| x.as_u64()) {
            commands["video"]["fps"] = serde_json::json!(x as u32);
        }
        if let Some(x) = v.get("seed").and_then(|x| x.as_u64()) {
            commands["video"]["seed"] = serde_json::json!(x);
        }
        if let Some(x) = v.get("duration_s").and_then(|x| x.as_f64()) {
            commands["video"]["duration_s"] = serde_json::json!(x);
        }
        if let Some(r) = v.get("resolution") {
            if let Some(x) = r.get("w").and_then(|x| x.as_u64()) {
                commands["video"]["resolution"]["w"] = serde_json::json!(x as u32);
            }
            if let Some(x) = r.get("h").and_then(|x| x.as_u64()) {
                commands["video"]["resolution"]["h"] = serde_json::json!(x as u32);
            }
        }
    }
    if let Some(v) = body.options.as_ref().and_then(|o| o.get("immersion")) {
        commands["immersion"] = v.clone();
    }
    if let Some(v) = body.options.as_ref().and_then(|o| o.get("film_runtime")) {
        commands["film_runtime"] = v.clone();
    }
    let shots_n = commands["video"]["shots_n"]
        .as_u64()
        .unwrap_or(8)
        .clamp(1, 256) as usize;
    let fps = commands["video"]["fps"]
        .as_u64()
        .unwrap_or(30)
        .clamp(1, 120) as u32;
    let seed = commands["video"]["seed"].as_u64().unwrap_or(123);
    let duration_s = commands["video"]["duration_s"]
        .as_f64()
        .filter(|v| v.is_finite())
        .unwrap_or(8.0)
        .clamp(1.0, 600.0);
    let w = commands["video"]["resolution"]["w"]
        .as_u64()
        .unwrap_or(1280)
        .clamp(160, 7680) as u32;
    let h = commands["video"]["resolution"]["h"]
        .as_u64()
        .unwrap_or(720)
        .clamp(90, 4320) as u32;
    commands["video"]["shots_n"] = serde_json::json!(shots_n);
    commands["video"]["fps"] = serde_json::json!(fps);
    commands["video"]["seed"] = serde_json::json!(seed);
    commands["video"]["duration_s"] = serde_json::json!(duration_s);
    commands["video"]["resolution"]["w"] = serde_json::json!(w);
    commands["video"]["resolution"]["h"] = serde_json::json!(h);
    commands["video"]["creative"] = creative.clone();

    let music_cmd = format!(
        "mkdir -p ./build && ffmpeg -y -hide_banner -loglevel error -f lavfi -i anullsrc=r=48000:cl=stereo -t {} -c:a pcm_s16le ./build/music.wav",
        duration_s
    );
    let vocals_cmd = format!(
        "mkdir -p ./build && ffmpeg -y -hide_banner -loglevel error -f lavfi -i anullsrc=r=48000:cl=stereo -t {} -c:a pcm_s16le ./build/vocals.wav",
        duration_s
    );
    compiled.music = music_cmd.clone();
    compiled.vocals = vocals_cmd.clone();
    commands["music"] = serde_json::json!(music_cmd);
    commands["vocals"] = serde_json::json!(vocals_cmd);
    commands["music_prompt"] = serde_json::json!({
        "title": cssl.clone(),
        "genre": creative_genre,
        "mood": creative_mood,
        "instrument": creative_instrument,
        "instrumentation": creative_instrumentation,
        "ambience": creative_ambience,
        "vocal_gender": creative_vocal,
        "vocal_style": creative_vocal_style,
        "ensemble_style": creative_ensemble_style,
        "arrangement_density": creative_arrangement_density,
        "dynamics_curve": creative_dynamics_curve,
        "section_form": creative_section_form,
        "articulation_bias": creative_articulation_bias,
        "voicing_register": creative_voicing_register,
        "percussion_activity": creative_percussion_activity,
        "expression_cc_bias": creative_expression_cc_bias,
        "humanization": creative_humanization,
        "inspiration_notes": creative_inspiration_notes,
        "licensed_style_pack": creative_licensed_style_pack,
        "external_audio_adapter": creative_external_audio_adapter,
        "tempo_bpm": creative_tempo,
        "prompt": creative_prompt
    });
    if let Some(cmd) = body.commands.as_ref() {
        if let Some(lyrics) = cmd.get("lyrics").and_then(|v| v.as_object()) {
            if let Some(s) = lyrics.get("detected_lang").and_then(|x| x.as_str()) {
                commands["lyrics"]["detected_lang"] = serde_json::json!(s);
            }
            if let Some(s) = lyrics.get("primary_lang").and_then(|x| x.as_str()) {
                commands["lyrics"]["primary_lang"] = serde_json::json!(s);
            }
            if let Some(a) = lyrics.get("suggest_langs").and_then(|x| x.as_array()) {
                commands["lyrics"]["suggest_langs"] = serde_json::json!(a);
            }
        }
        if let Some(voice) = cmd.get("voice") {
            commands["voice"] = voice.clone();
        }
        if let Some(creative) = cmd.get("creative") {
            commands["creative"] = creative.clone();
        }
        if let Some(immersion) = cmd.get("immersion") {
            commands["immersion"] = immersion.clone();
        }
        if let Some(film_runtime) = cmd.get("film_runtime") {
            commands["film_runtime"] = film_runtime.clone();
        }
    }

    run_state.commands = commands.clone();
    apply_immersion_config(&mut run_state, &commands);
    apply_scene_semantics(&mut run_state, &commands);
    let dag_v3_applied = maybe_apply_dag_v3_plan(&mut run_state, &commands);

    if !dag_v3_applied {
        if let Some(rec) = run_state.stages.get_mut("lyrics") {
            rec.status = StageStatus::PENDING;
            rec.command = commands["lyrics"]
                .get("command")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .or_else(|| {
                    commands
                        .get("lyrics")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                });
            rec.outputs = vec![PathBuf::from("./build/lyrics.json")];
        }
        if let Some(rec) = run_state.stages.get_mut("music") {
            rec.status = StageStatus::PENDING;
            rec.command = Some(music_cmd);
            rec.outputs = vec![PathBuf::from("./build/music.wav")];
        }
        if let Some(rec) = run_state.stages.get_mut("vocals") {
            rec.status = StageStatus::PENDING;
            rec.command = Some(vocals_cmd);
            rec.outputs = vec![PathBuf::from("./build/vocals.wav")];
        }
        run_state.stages.insert(
            VIDEO_PLAN_STAGE.into(),
            StageRecord {
                status: StageStatus::PENDING,
                started_at: None,
                ended_at: None,
                exit_code: None,
                command: None,
                outputs: vec![PathBuf::from("./build/video/storyboard.json")],
                retries: 0,
                error: None,
                heartbeat_at: None,
                last_heartbeat_at: None,
                timeout_seconds: Some(run_state.config.stage_timeout_seconds),
                error_code: None,
                pid: None,
                pgid: None,
                meta: Value::Object(Default::default()),
                duration_seconds: None,
            },
        );

        for i in 0..shots_n {
            let shot = video_shot_stage_key(i);
            let out = PathBuf::from(format!("./build/video/shots/{shot}.mp4"));
            run_state.stages.insert(
                shot,
                StageRecord {
                    status: StageStatus::PENDING,
                    started_at: None,
                    ended_at: None,
                    exit_code: None,
                    command: None,
                    outputs: vec![out],
                    retries: 0,
                    error: None,
                    heartbeat_at: None,
                    last_heartbeat_at: None,
                    timeout_seconds: Some(run_state.config.stage_timeout_seconds),
                    error_code: None,
                    pid: None,
                    pgid: None,
                    meta: Value::Object(Default::default()),
                    duration_seconds: None,
                },
            );
        }
        run_state.stages.insert(
            VIDEO_ASSEMBLE_STAGE.into(),
            StageRecord {
                status: StageStatus::PENDING,
                started_at: None,
                ended_at: None,
                exit_code: None,
                command: None,
                outputs: vec![PathBuf::from("./build/video/video.mp4")],
                retries: 0,
                error: None,
                heartbeat_at: None,
                last_heartbeat_at: None,
                timeout_seconds: Some(run_state.config.stage_timeout_seconds),
                error_code: None,
                pid: None,
                pgid: None,
                meta: Value::Object(Default::default()),
                duration_seconds: None,
            },
        );
        run_state.stages.insert(
            "subtitles".into(),
            StageRecord {
                status: StageStatus::PENDING,
                started_at: None,
                ended_at: None,
                exit_code: None,
                command: None,
                outputs: vec![PathBuf::from("./build/subtitles.ass")],
                retries: 0,
                error: None,
                heartbeat_at: None,
                last_heartbeat_at: None,
                timeout_seconds: Some(run_state.config.stage_timeout_seconds),
                error_code: None,
                pid: None,
                pgid: None,
                meta: Value::Object(Default::default()),
                duration_seconds: None,
            },
        );
        run_state.stages.insert(
            "mix".into(),
            StageRecord {
                status: StageStatus::PENDING,
                started_at: None,
                ended_at: None,
                exit_code: None,
                command: None,
                outputs: vec![PathBuf::from("./build/mix.wav")],
                retries: 0,
                error: None,
                heartbeat_at: None,
                last_heartbeat_at: None,
                timeout_seconds: Some(run_state.config.stage_timeout_seconds),
                error_code: None,
                pid: None,
                pgid: None,
                meta: Value::Object(Default::default()),
                duration_seconds: None,
            },
        );
        if let Some(rec) = run_state.stages.get_mut("render") {
            rec.status = StageStatus::PENDING;
            rec.command = None;
            rec.outputs = vec![PathBuf::from("./build/final_mv.mp4")];
        }
        for rec in run_state.stages.values_mut() {
            if let Some(map) = rec.meta.as_object_mut() {
                map.insert("commands".into(), commands.clone());
            }
        }
        let mut dag_nodes: Vec<crate::run_state::DagNodeMeta> = vec![
            crate::run_state::DagNodeMeta {
                name: "lyrics".to_string(),
                deps: vec![],
            },
            crate::run_state::DagNodeMeta {
                name: "music".to_string(),
                deps: vec!["lyrics".to_string()],
            },
            crate::run_state::DagNodeMeta {
                name: "vocals".to_string(),
                deps: vec!["lyrics".to_string(), "music".to_string()],
            },
            crate::run_state::DagNodeMeta {
                name: VIDEO_PLAN_STAGE.to_string(),
                deps: vec!["lyrics".to_string(), "vocals".to_string()],
            },
        ];
        let mut shot_names: Vec<String> = Vec::new();
        for i in 0..shots_n {
            let shot = video_shot_stage_key(i);
            shot_names.push(shot.clone());
            dag_nodes.push(crate::run_state::DagNodeMeta {
                name: shot,
                deps: vec![VIDEO_PLAN_STAGE.to_string()],
            });
        }
        dag_nodes.push(crate::run_state::DagNodeMeta {
            name: VIDEO_ASSEMBLE_STAGE.to_string(),
            deps: shot_names.clone(),
        });
        dag_nodes.push(crate::run_state::DagNodeMeta {
            name: "subtitles".to_string(),
            deps: vec!["lyrics".to_string()],
        });
        dag_nodes.push(crate::run_state::DagNodeMeta {
            name: "mix".to_string(),
            deps: vec!["music".to_string(), "vocals".to_string()],
        });
        dag_nodes.push(crate::run_state::DagNodeMeta {
            name: "render".to_string(),
            deps: vec![
                "lyrics".to_string(),
                "music".to_string(),
                "vocals".to_string(),
                VIDEO_ASSEMBLE_STAGE.to_string(),
                "subtitles".to_string(),
            ],
        });
        run_state.dag.nodes = dag_nodes;
        run_state.dag_edges.clear();
        for n in &run_state.dag.nodes {
            run_state.dag_edges.insert(n.name.clone(), n.deps.clone());
        }
        run_state.video_shots_total = Some(shots_n as u32);
        run_state.topo_order = topo_order_for_state(&run_state);
    }

    if let Some(req_cmd) = body.commands.as_ref() {
        if let Some((mime, bytes, b64, mode)) = voice_extract(req_cmd) {
            let out = run_store::run_dir(&run_id).join("build").join("voice.webm");
            if let Some(parent) = out.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let data = b64_decode(&b64).unwrap_or_default();
            if !data.is_empty() {
                let _ = fs::write(&out, &data);
                run_state.set_artifact_path(
                    "voice",
                    serde_json::json!({
                        "path":"./build/voice.webm",
                        "mime": mime,
                        "bytes": data.len(),
                        "mode": mode
                    }),
                );
            } else {
                run_state.set_artifact_path(
                    "voice",
                    serde_json::json!({
                        "path":"./build/voice.webm",
                        "mime": mime,
                        "bytes": bytes,
                        "mode": mode
                    }),
                );
            }
        }
    }

    if body
        .commands
        .as_ref()
        .and_then(|v| v.get("voice"))
        .is_some()
    {
        let ts = chrono::Utc::now().to_rfc3339();
        let title = run_state.cssl.clone();
        let source = if body
            .commands
            .as_ref()
            .and_then(|v| v.pointer("/voice/bytes"))
            .and_then(|x| x.as_u64())
            .unwrap_or(0)
            > 0
        {
            "voice"
        } else {
            "random"
        };
        run_state.updated_at = ts.clone();
        crate::events::bump_event(
            &mut run_state,
            crate::events::EventKind::VoiceSubmitted,
            "voice",
            "submitted",
            ts,
            Some(serde_json::json!({
                "source": source,
                "title": title
            })),
        );
    }

    let state_path = run_store::run_state_path(&run_id);
    run_store::write_run_state(&state_path, &run_state).map_err(map_io)?;
    events::emit_snapshot(&run_state);
    run_store::write_compiled_commands(&run_id, &compiled).map_err(map_io)?;

    if !jobs::queue::claim_run(&run_id).await {
        return Err(ApiError::conflict(
            "CONFLICT",
            crate::i18n::t(lang, "run_already_queued"),
        ));
    }

    jobs::queue::push_run(run_id.clone(), run_state.tier.clone())
        .await
        .map_err(|_| {
            ApiError::internal(
                "QUEUE_PUSH_FAILED",
                crate::i18n::t(lang, "queue_push_failed"),
            )
        })?;

    metrics::incr_runs_created();

    Ok((
        StatusCode::ACCEPTED,
        Json(RunsCreateResponse {
            schema: "cssapi.runs.create.v1",
            run_id: run_id.clone(),
            status_url: format!("/cssapi/v1/runs/{}/status", run_id),
            ready_url: format!("/cssapi/v1/runs/{}/ready", run_id),
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/cssapi/v1/runs/{run_id}",
    tag = "runs",
    params(
        ("run_id" = String, Path, description = "Run ID")
    ),
    responses(
        (status = 200, description = "Run state JSON", body = serde_json::Value,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 404, description = "Run not found", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 500, description = "Internal error", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        )
    )
)]
pub async fn runs_get(headers: HeaderMap, Path(run_id): Path<String>) -> ApiResult<RunState> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let p = run_store::run_state_path(&run_id);
    let mut s = run_store::read_run_state(&p).map_err(|_| {
        if p.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        }
    })?;
    crate::artifacts::build_artifacts_index(&mut s);
    Ok(Json(s))
}

#[utoipa::path(
    get,
    path = "/cssapi/v1/runs/{run_id}/status",
    tag = "runs",
    params(
        ("run_id" = String, Path, description = "Run ID")
    ),
    responses(
        (status = 200, description = "Run status", body = RunsStatusResponse,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 404, description = "Run not found", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 500, description = "Internal error", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        )
    )
)]
pub async fn runs_status(
    headers: HeaderMap,
    Path(run_id): Path<String>,
) -> ApiResult<RunsStatusResponse> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let p = run_store::run_state_path(&run_id);
    let s = run_store::read_run_state(&p).map_err(|_| {
        if p.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        }
    })?;
    Ok(Json(RunsStatusResponse {
        schema: "cssapi.runs.status.v1",
        run_id: s.run_id,
        status: s.status,
        updated_at: s.updated_at,
    }))
}

#[utoipa::path(
    get,
    path = "/cssapi/v1/runs/{run_id}/ready",
    tag = "runs",
    params(
        ("run_id" = String, Path, description = "Run ID"),
        ("since_seq" = Option<u64>, Query, description = "Long-poll cursor"),
        ("trend_window" = Option<i64>, Query, description = "Quality trend window size, default 20, max 200")
    ),
    responses(
        (status = 200, description = "Ready queue view", body = RunReadyResponse,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 404, description = "Run not found", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 500, description = "Internal error", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        )
    )
)]
pub async fn run_ready(
    Extension(pool): Extension<sqlx::PgPool>,
    headers: HeaderMap,
    Path(run_id): Path<String>,
    Query(q): Query<RunReadyQuery>,
) -> Result<axum::response::Response, ApiError> {
    let state_path = run_store::run_state_path(&run_id);
    let mut state = run_store::read_run_state(&state_path).map_err(|_| {
        let lang = crate::i18n::pick_lang(None, &headers, None);
        if state_path.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        }
    })?;

    let dag_v3_plan = if state.commands.get("dag_version").and_then(|v| v.as_str()) == Some("v3") {
        crate::run_store::load_run_plan_v3(&run_id)
            .ok()
            .or_else(|| crate::dag_v3::bridge::build_execution_plan_from_commands(&state).ok())
    } else {
        None
    };

    if let Some(since) = q.since_seq {
        if state.stage_seq == since {
            if let Some((leader, wall_s)) = ready::compute_slowest_leader(&state) {
                let warn_s = state.config.stuck_timeout_seconds.max(1);
                let status = state
                    .stages
                    .get(&leader)
                    .map(|r| match r.status {
                        crate::run_state::StageStatus::PENDING => "pending",
                        crate::run_state::StageStatus::RUNNING => "running",
                        crate::run_state::StageStatus::SUCCEEDED => "succeeded",
                        crate::run_state::StageStatus::FAILED => "failed",
                        crate::run_state::StageStatus::SKIPPED => {
                            if r.error_code.as_deref() == Some("CANCELLED")
                                || r.error_code.as_deref() == Some("CANCELLED_KILLED")
                            {
                                "cancelled"
                            } else {
                                "skipped"
                            }
                        }
                    })
                    .unwrap_or("unknown");

                let bucket = if status == "running" && wall_s >= warn_s as f64 {
                    ((wall_s as u64).saturating_sub(warn_s)) / 10
                } else {
                    0
                };
                let changed = state.slowest_leader.as_deref() != Some(leader.as_str())
                    || (status == "running"
                        && wall_s >= warn_s as f64
                        && state.slowest_tick.unwrap_or(u64::MAX) != bucket);
                if changed {
                    state.slowest_leader = Some(leader.clone());
                    state.slowest_tick = Some(bucket);
                    let timeline_total_s = ready::compute_timeline_total_wall_s(&state);
                    let ts = chrono::Utc::now().to_rfc3339();
                    state.updated_at = ts.clone();
                    crate::events::bump_event(
                        &mut state,
                        crate::events::EventKind::Slowest,
                        "slowest",
                        "changed",
                        ts,
                        Some(serde_json::json!({
                            "stage": leader,
                            "status": status,
                            "elapsed_s": wall_s,
                            "threshold_s": warn_s,
                            "warn": wall_s >= warn_s as f64,
                            "bucket": bucket,
                            "timeline_total_s": timeline_total_s
                        })),
                    );
                    let _ = run_store::write_run_state(&state_path, &state);
                }
            }
            if state.stage_seq == since {
                let mut resp = StatusCode::NO_CONTENT.into_response();
                resp.headers_mut().insert(
                    axum::http::header::CACHE_CONTROL,
                    "no-store".parse().unwrap(),
                );
                return Ok(resp);
            }
        }
    }

    let lang = crate::i18n::pick_lang(None, &headers, Some(&state.ui_lang));
    let dag = crate::dag::cssmv_dag_active();
    let mut view = ready::compute_ready_view_with_dag_limited(&state, &dag, 64);
    view.summary.quality.versions = quality_versions_from_state(&run_id, &state);
    if let Some(qs) = view.summary.quality_score.as_ref() {
        let quality = &view.summary.quality;
        let snapshot = crate::quality_history::make_snapshot(&state, qs, quality);
        let _ = crate::quality_history::insert_snapshot_if_changed(&pool, &snapshot).await;

        let latest = crate::quality_history::make_latest(&state, qs, quality);
        let _ = crate::quality_history::upsert_latest(&pool, &latest).await;

        if let Ok(trend) =
            crate::quality_history::make_trend_lite(&pool, &run_id, q.trend_window).await
        {
            view.summary.quality_trend = trend;
        }
    }
    let failures = ready::collect_failures(&state)
        .into_iter()
        .map(|(stage, error)| ReadyFailure { stage, error })
        .collect::<Vec<_>>();
    let summary_text = ready::build_summary_i18n(&state, &view, lang);

    let topo_order = ready::topo_order_preferred(&state, dag_v3_plan.as_ref());
    view.summary.timeline = Some(crate::timeline::build_run_timeline(
        &state,
        &topo_order,
        dag_v3_plan.as_ref(),
    ));
    let artifacts_payload = ready::artifacts_view_preferred(&run_id, &state, dag_v3_plan.as_ref());
    let artifact_versions = artifacts_payload.get("versions").and_then(|v| {
        serde_json::from_value::<crate::artifact_versions::ArtifactVersionsView>(v.clone()).ok()
    });
    let quality_versions = view.summary.quality.versions.clone();
    let primary_lang = state
        .commands
        .get("matrix")
        .and_then(|m| m.get("primary_lang"))
        .and_then(|x| x.as_str());
    let primary_voice = state
        .commands
        .get("matrix")
        .and_then(|m| m.get("primary_voice"))
        .and_then(|x| x.as_str());
    view.summary.production_view = Some(crate::production_view::build_production_view(
        view.summary.timeline.as_ref(),
        artifact_versions.as_ref(),
        quality_versions.as_ref(),
        view.summary.billing.as_ref(),
        primary_lang,
        primary_voice,
    ));

    let mut resp = Json(RunReadyResponse {
        schema: "cssapi.runs.ready.v1",
        run_id: state.run_id.clone(),
        status: state.status.clone(),
        dag: DagReadyMeta {
            schema: state.dag.schema.clone(),
            concurrency: runner::concurrency_limit(),
            nodes_total: topo_order.len(),
        },
        topo_order: topo_order,
        ready: view.ready,
        running: view.running,
        summary: view.summary,
        summary_text,
        video_shots: view.video_shots,
        counters: view.counters,
        running_pids: view.running_pids,
        mix: view.mix,
        subtitles: view.subtitles,
        blocking: view.blocking,
        stage_seq: view.stage_seq,
        event: view.last_event.as_ref().map(|e| {
            let k = match e.kind {
                crate::events::EventKind::Stage => "stage",
                crate::events::EventKind::VoiceSubmitted => "voice_submitted",
                crate::events::EventKind::Gate => "gate",
                crate::events::EventKind::Failed => "failed",
                crate::events::EventKind::Cancelled => "cancelled",
                crate::events::EventKind::Timeout => "timeout",
                crate::events::EventKind::Heartbeat => "heartbeat",
                crate::events::EventKind::Slowest => "slowest",
            };
            format!("{}:{}:{}", k, e.stage, e.status)
        }),
        last_event: view.last_event,
        artifacts: artifacts_payload,
        failures,
        cancel_requested: state.cancel_requested,
        cancelled_at: state.cancel_requested_at.clone(),
        updated_at: state.updated_at,
    })
    .into_response();
    resp.headers_mut().insert(
        axum::http::header::CACHE_CONTROL,
        "no-store".parse().unwrap(),
    );
    Ok(resp)
}

#[utoipa::path(
    get,
    path = "/cssapi/v1/runs/{run_id}/quality-history",
    tag = "runs",
    params(
        ("run_id" = String, Path, description = "Run ID"),
        ("limit" = Option<i64>, Query, description = "Max history items, default 500, max 5000")
    ),
    responses(
        (status = 200, description = "Run quality history", body = RunQualityHistoryResponse,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 404, description = "Run not found", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 500, description = "Internal error", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        )
    )
)]
pub async fn run_quality_history(
    Extension(pool): Extension<sqlx::PgPool>,
    headers: HeaderMap,
    Path(run_id): Path<String>,
    Query(q): Query<RunQualityHistoryQuery>,
) -> ApiResult<RunQualityHistoryResponse> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let state_path = run_store::run_state_path(&run_id);
    if !state_path.exists() {
        return Err(ApiError::not_found(
            "RUN_NOT_FOUND",
            crate::i18n::t(lang, "run_not_found"),
        ));
    }

    let st = run_store::read_run_state(&state_path).ok();
    let versions = st
        .as_ref()
        .and_then(|s| quality_versions_from_state(&run_id, s));

    let items = crate::quality_history::load_history(&pool, &run_id, q.limit)
        .await
        .map_err(|_| {
            ApiError::internal("QUALITY_HISTORY_READ_FAILED", "quality history read failed")
        })?
        .into_iter()
        .map(|x| RunQualityHistoryItem {
            ts: x.ts,
            seq: x.seq,
            score: x.score,
            max: x.max,
            blocking_gate: x.blocking_gate,
            subtitles_audio_delta_before_s: x.subtitles_audio_delta_before_s,
            subtitles_audio_delta_s: x.subtitles_audio_delta_s,
            subtitles_audio_delta_improved_s: x.subtitles_audio_delta_improved_s,
            subtitles_audio_max_delta_s: x.subtitles_audio_max_delta_s,
            milestone_ready: x.milestone_ready,
            breakdown: x.breakdown,
        })
        .collect();

    Ok(Json(RunQualityHistoryResponse {
        schema: "cssapi.runs.quality_history.v1",
        run_id,
        items,
        versions,
    }))
}

#[utoipa::path(
    get,
    path = "/cssapi/v1/runs/{run_id}/music-delivery-dashboard",
    tag = "runs",
    params(
        ("run_id" = String, Path, description = "Run ID")
    ),
    responses(
        (status = 200, description = "Music delivery dashboard feed", body = RunMusicDeliveryDashboardResponse,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 404, description = "Run not found", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        )
    )
)]
pub async fn run_music_delivery_dashboard(
    headers: HeaderMap,
    Path(run_id): Path<String>,
) -> ApiResult<RunMusicDeliveryDashboardResponse> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let state_path = run_store::run_state_path(&run_id);
    let state = run_store::read_run_state(&state_path).map_err(|_| {
        if state_path.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        }
    })?;

    let build_dir = run_store::run_dir(&run_id).join("build");
    let dashboard_path = build_dir.join("audio_provider_delivery_dashboard_feed.json");
    let receipt_sync_path = build_dir.join("audio_provider_receipt_sync.json");
    let publish_state_machine_path = build_dir.join("audio_provider_publish_state_machine.json");
    let publish_executor_path = build_dir.join("audio_provider_publish_executor_report.json");
    let downstream_delivery_path = build_dir.join("audio_provider_downstream_delivery_report.json");
    let rewrite_bundles = list_rewrite_bundle_entries(&run_id);
    let watch_snapshots = list_watch_snapshot_entries(&run_id);
    let rewrite_bundle_diffs = compute_rewrite_bundle_diffs(&rewrite_bundles);
    let rewrite_promotions = list_rewrite_promotion_entries(&run_id);
    let arrangement_revisions = list_arrangement_revisions(&run_id);
    let arrangement_revision_diffs =
        compute_arrangement_revision_diffs(&run_id, &arrangement_revisions);
    let arrangement_revision_head = arrangement_revisions
        .iter()
        .find(|entry| entry.state == "active")
        .cloned();
    let mut arrangement_release_candidates = list_arrangement_release_candidates(&run_id);
    let mut release_manifest_dirty = false;
    arrangement_release_candidates.iter_mut().for_each(|entry| {
        if entry.state == "published"
            && refresh_arrangement_release_compliance_artifacts(&run_id, entry).is_ok()
        {
            release_manifest_dirty = true;
        }
    });
    if release_manifest_dirty {
        let _ = persist_arrangement_release_candidates(&run_id, &arrangement_release_candidates);
    }
    let arrangement_locked_revision = arrangement_release_candidates
        .iter()
        .find(|entry| entry.state == "locked")
        .cloned()
        .or_else(|| {
            arrangement_release_candidates
                .iter()
                .find(|entry| entry.state == "published")
                .cloned()
        });
    let arrangement_published_revision = arrangement_release_candidates
        .iter()
        .find(|entry| entry.state == "published")
        .cloned();
    let mut package_browser = Vec::new();

    let mut artifact_paths = BTreeMap::new();
    for (key, path) in [
        ("dashboard", &dashboard_path),
        ("receipt_sync", &receipt_sync_path),
        ("publish_state_machine", &publish_state_machine_path),
        ("publish_executor", &publish_executor_path),
        ("downstream_delivery", &downstream_delivery_path),
    ] {
        if path.exists() {
            artifact_paths.insert(key.to_string(), path.display().to_string());
        }
    }
    if let Some(entry) = arrangement_published_revision.as_ref() {
        for (key, rel) in [
            (
                "compliance_ack",
                entry.compliance_ack_relative_path.as_deref(),
            ),
            (
                "regulator_receipt",
                entry.regulator_receipt_relative_path.as_deref(),
            ),
            (
                "audit_timeline",
                entry.audit_timeline_relative_path.as_deref(),
            ),
        ] {
            if let Some(rel) = rel {
                let path = run_store::run_dir(&run_id).join(rel.trim_start_matches("./"));
                if path.exists() {
                    artifact_paths.insert(key.to_string(), path.display().to_string());
                }
            }
        }
    }
    collect_directory_delivery_assets(
        &run_id,
        &run_store::run_dir(&run_id),
        "stems",
        "./build/stems",
        &mut package_browser,
    );
    collect_directory_delivery_assets(
        &run_id,
        &run_store::run_dir(&run_id),
        "rehearsal",
        "./build/rehearsal",
        &mut package_browser,
    );
    collect_directory_delivery_assets(
        &run_id,
        &run_store::run_dir(&run_id),
        "post",
        "./build/post",
        &mut package_browser,
    );
    collect_directory_delivery_assets(
        &run_id,
        &run_store::run_dir(&run_id),
        "vocals",
        "./build/vocals",
        &mut package_browser,
    );
    collect_directory_delivery_assets(
        &run_id,
        &run_store::run_dir(&run_id),
        "rewrite",
        rewrite_bundle_relative_dir(),
        &mut package_browser,
    );
    collect_directory_delivery_assets(
        &run_id,
        &run_store::run_dir(&run_id),
        "rewrite_execution",
        rewrite_execution_queue_relative_dir(),
        &mut package_browser,
    );
    collect_directory_delivery_assets(
        &run_id,
        &run_store::run_dir(&run_id),
        "rewrite_job_status",
        rewrite_job_status_relative_dir(),
        &mut package_browser,
    );
    collect_directory_delivery_assets(
        &run_id,
        &run_store::run_dir(&run_id),
        "rewrite_apply_back",
        rewrite_apply_back_relative_dir(),
        &mut package_browser,
    );
    collect_directory_delivery_assets(
        &run_id,
        &run_store::run_dir(&run_id),
        "arrangement_revision",
        rewrite_revision_relative_dir(),
        &mut package_browser,
    );
    collect_directory_delivery_assets(
        &run_id,
        &run_store::run_dir(&run_id),
        "compliance_ops",
        compliance_ops_relative_dir(),
        &mut package_browser,
    );
    collect_directory_delivery_assets(
        &run_id,
        &run_store::run_dir(&run_id),
        "release",
        arrangement_release_relative_dir(),
        &mut package_browser,
    );
    push_delivery_asset(
        &run_id,
        &run_store::run_dir(&run_id),
        "arrangement",
        "provider cue sheet",
        "./build/audio_provider_cue_sheet.json",
        &mut package_browser,
    );
    push_delivery_asset(
        &run_id,
        &run_store::run_dir(&run_id),
        "arrangement",
        "provider midi draft",
        "./build/audio_provider_midi_draft.json",
        &mut package_browser,
    );
    push_delivery_asset(
        &run_id,
        &run_store::run_dir(&run_id),
        "arrangement",
        "provider phrase map",
        "./build/audio_provider_phrase_map.json",
        &mut package_browser,
    );
    push_delivery_asset(
        &run_id,
        &run_store::run_dir(&run_id),
        "receipt",
        "downstream receipt",
        "./build/audio_provider_downstream_receipt.json",
        &mut package_browser,
    );
    push_delivery_asset(
        &run_id,
        &run_store::run_dir(&run_id),
        "receipt",
        "receipt sync",
        "./build/audio_provider_receipt_sync.json",
        &mut package_browser,
    );
    push_delivery_asset(
        &run_id,
        &run_store::run_dir(&run_id),
        "publish",
        "publish handoff",
        "./build/audio_provider_publish_handoff.json",
        &mut package_browser,
    );
    push_delivery_asset(
        &run_id,
        &run_store::run_dir(&run_id),
        "publish",
        "publish ledger",
        "./build/audio_provider_publish_ledger.json",
        &mut package_browser,
    );
    push_delivery_asset(
        &run_id,
        &run_store::run_dir(&run_id),
        "publish",
        "delivery dashboard feed",
        "./build/audio_provider_delivery_dashboard_feed.json",
        &mut package_browser,
    );
    let compliance_ack = arrangement_published_revision.as_ref().and_then(|entry| {
        entry
            .compliance_ack_relative_path
            .as_deref()
            .and_then(|path| {
                read_json_if_exists(
                    &run_store::run_dir(&run_id).join(path.trim_start_matches("./")),
                )
            })
    });
    let regulator_receipt = arrangement_published_revision.as_ref().and_then(|entry| {
        entry
            .regulator_receipt_relative_path
            .as_deref()
            .and_then(|path| {
                read_json_if_exists(
                    &run_store::run_dir(&run_id).join(path.trim_start_matches("./")),
                )
            })
    });
    let audit_timeline = arrangement_published_revision.as_ref().and_then(|entry| {
        entry
            .audit_timeline_relative_path
            .as_deref()
            .and_then(|path| {
                read_json_if_exists(
                    &run_store::run_dir(&run_id).join(path.trim_start_matches("./")),
                )
            })
    });
    let compliance_dashboard_lane = build_compliance_dashboard_lane(
        arrangement_published_revision.as_ref(),
        compliance_ack.as_ref(),
        regulator_receipt.as_ref(),
        audit_timeline.as_ref(),
    );
    let compliance_exception_flags = build_compliance_exception_flags(
        arrangement_published_revision.as_ref(),
        compliance_ack.as_ref(),
        regulator_receipt.as_ref(),
        audit_timeline.as_ref(),
    );
    let compliance_sla_clock = build_compliance_sla_clock(
        arrangement_published_revision.as_ref(),
        compliance_ack.as_ref(),
        regulator_receipt.as_ref(),
    );
    let compliance_alert_routing = build_compliance_alert_routing(
        arrangement_published_revision.as_ref(),
        &compliance_exception_flags,
        compliance_sla_clock.as_ref(),
    );
    let compliance_escalation_policy = build_compliance_escalation_policy(
        arrangement_published_revision.as_ref(),
        &compliance_exception_flags,
        compliance_sla_clock.as_ref(),
    );
    let compliance_operator_actions = build_compliance_operator_actions(
        arrangement_published_revision.as_ref(),
        &compliance_exception_flags,
        compliance_sla_clock.as_ref(),
    );
    let compliance_webhook_dispatch = read_latest_compliance_artifact(&run_id, "notify-adapter_");
    let compliance_ticket_mapping = read_latest_compliance_artifact(&run_id, "ticket-mapping_");
    let compliance_ack_reconciliation =
        read_latest_compliance_artifact(&run_id, "ack-reconciliation_");
    let compliance_rotation_control = latest_rotation_override(&run_id);
    let compliance_vendor_registry = latest_vendor_registry_override(&run_id);
    let compliance_reopen_control = latest_reopen_override(&run_id);
    let compliance_preset_control = latest_preset_override(&run_id);
    let compliance_audit_log = latest_audit_log_entry(&run_id);
    let compliance_scoped_permissions = current_compliance_scoped_permissions(&run_id);
    let compliance_actor_identity = latest_actor_identity_entry(&run_id);
    let compliance_permission_check = latest_permission_check_entry(&run_id);
    let compliance_audit_signature = latest_audit_signature_entry(&run_id);
    let compliance_actor_directory = latest_actor_directory_entry(&run_id);
    let compliance_role_policy_presets = current_role_policy_presets(&run_id);
    let compliance_approval_chain = latest_approval_chain_entry(&run_id);
    let compliance_approver_routing = current_approver_routing(&run_id);
    let compliance_required_signers = current_required_signers(&run_id);
    let compliance_release_quorum = latest_release_quorum_entry(&run_id);
    let compliance_locked_publish_gate = latest_locked_publish_gate_entry(&run_id);
    let compliance_release_unblock_token = latest_release_unblock_token_entry(&run_id);
    let compliance_immutable_publish_authorization =
        latest_immutable_publish_authorization_entry(&run_id);
    let approval_to_publish_trace = Some(build_approval_to_publish_trace(
        &run_id,
        compliance_locked_publish_gate.as_ref(),
        compliance_release_unblock_token.as_ref(),
        compliance_immutable_publish_authorization.as_ref(),
    ));
    let blocked_publish_explainer = arrangement_locked_revision
        .as_ref()
        .map(|entry| {
            build_blocked_publish_explainer(
                &entry.revision_id,
                Some(entry.candidate_id.as_str()),
                compliance_locked_publish_gate.as_ref(),
                compliance_release_unblock_token.as_ref(),
                compliance_immutable_publish_authorization.as_ref(),
            )
        })
        .or_else(|| {
            arrangement_revision_head.as_ref().map(|entry| {
                build_blocked_publish_explainer(
                    &entry.revision_id,
                    None,
                    compliance_locked_publish_gate.as_ref(),
                    compliance_release_unblock_token.as_ref(),
                    compliance_immutable_publish_authorization.as_ref(),
                )
            })
        });
    if let Some(entry) = arrangement_published_revision.as_ref() {
        if let Some(path) = entry.release_manifest_relative_path.as_deref() {
            push_delivery_asset(
                &run_id,
                &run_store::run_dir(&run_id),
                "release",
                "release manifest",
                path,
                &mut package_browser,
            );
        }
        if let Some(path) = entry.immutable_handoff_relative_path.as_deref() {
            push_delivery_asset(
                &run_id,
                &run_store::run_dir(&run_id),
                "release",
                "immutable handoff",
                path,
                &mut package_browser,
            );
        }
        if let Some(path) = entry.release_approval_relative_path.as_deref() {
            push_delivery_asset(
                &run_id,
                &run_store::run_dir(&run_id),
                "release",
                "release approval",
                path,
                &mut package_browser,
            );
        }
        if let Some(path) = entry.release_signoff_relative_path.as_deref() {
            push_delivery_asset(
                &run_id,
                &run_store::run_dir(&run_id),
                "release",
                "release sign-off",
                path,
                &mut package_browser,
            );
        }
        if let Some(path) = entry.delivery_certificate_relative_path.as_deref() {
            push_delivery_asset(
                &run_id,
                &run_store::run_dir(&run_id),
                "release",
                "delivery certificate",
                path,
                &mut package_browser,
            );
        }
        if let Some(path) = entry.release_audit_trail_relative_path.as_deref() {
            push_delivery_asset(
                &run_id,
                &run_store::run_dir(&run_id),
                "release",
                "release audit trail",
                path,
                &mut package_browser,
            );
        }
        if let Some(path) = entry.notarized_receipt_relative_path.as_deref() {
            push_delivery_asset(
                &run_id,
                &run_store::run_dir(&run_id),
                "release",
                "notarized receipt",
                path,
                &mut package_browser,
            );
        }
        if let Some(path) = entry.downstream_compliance_feed_relative_path.as_deref() {
            push_delivery_asset(
                &run_id,
                &run_store::run_dir(&run_id),
                "release",
                "downstream compliance feed",
                path,
                &mut package_browser,
            );
        }
        if let Some(path) = entry.compliance_ack_relative_path.as_deref() {
            push_delivery_asset(
                &run_id,
                &run_store::run_dir(&run_id),
                "release",
                "compliance ack",
                path,
                &mut package_browser,
            );
        }
        if let Some(path) = entry.regulator_receipt_relative_path.as_deref() {
            push_delivery_asset(
                &run_id,
                &run_store::run_dir(&run_id),
                "release",
                "regulator receipt",
                path,
                &mut package_browser,
            );
        }
        if let Some(path) = entry.audit_timeline_relative_path.as_deref() {
            push_delivery_asset(
                &run_id,
                &run_store::run_dir(&run_id),
                "release",
                "audit timeline",
                path,
                &mut package_browser,
            );
        }
    }
    push_delivery_asset(
        &run_id,
        &run_store::run_dir(&run_id),
        "watch_archive",
        "watch snapshots",
        watch_snapshot_relative_dir(),
        &mut package_browser,
    );
    push_delivery_asset(
        &run_id,
        &run_store::run_dir(&run_id),
        "package",
        "rehearsal pack",
        "./exports/rehearsal/rehearsal_pack.zip",
        &mut package_browser,
    );
    push_delivery_asset(
        &run_id,
        &run_store::run_dir(&run_id),
        "package",
        "film post pack",
        "./exports/post/film_post_pack.zip",
        &mut package_browser,
    );

    Ok(Json(RunMusicDeliveryDashboardResponse {
        schema: "cssapi.runs.music_delivery_dashboard.v1",
        run_id: run_id.clone(),
        status: format!("{:?}", state.status),
        updated_at: state.updated_at,
        dashboard: read_json_if_exists(&dashboard_path),
        receipt_sync: read_json_if_exists(&receipt_sync_path),
        publish_state_machine: read_json_if_exists(&publish_state_machine_path),
        publish_executor: read_json_if_exists(&publish_executor_path),
        downstream_delivery: read_json_if_exists(&downstream_delivery_path),
        compliance_ack,
        regulator_receipt,
        audit_timeline,
        compliance_dashboard_lane,
        compliance_exception_flags,
        compliance_sla_clock,
        compliance_alert_routing,
        compliance_escalation_policy,
        compliance_operator_actions,
        compliance_webhook_dispatch,
        compliance_ticket_mapping,
        compliance_ack_reconciliation,
        compliance_rotation_control,
        compliance_vendor_registry,
        compliance_reopen_control,
        compliance_preset_control,
        compliance_audit_log,
        compliance_scoped_permissions,
        compliance_actor_identity,
        compliance_permission_check,
        compliance_audit_signature,
        compliance_actor_directory,
        compliance_role_policy_presets,
        compliance_approval_chain,
        compliance_approver_routing,
        compliance_required_signers,
        compliance_release_quorum,
        compliance_locked_publish_gate,
        compliance_release_unblock_token,
        compliance_immutable_publish_authorization,
        blocked_publish_explainer,
        approval_to_publish_trace,
        artifact_paths,
        package_browser,
        watch_snapshots,
        rewrite_bundles,
        rewrite_bundle_diffs,
        rewrite_promotions,
        arrangement_revisions,
        arrangement_revision_diffs,
        arrangement_revision_head,
        arrangement_release_candidates,
        arrangement_locked_revision,
        arrangement_published_revision,
    }))
}

pub async fn run_music_rewrite_bundles_save(
    headers: HeaderMap,
    Path(run_id): Path<String>,
    body: Result<Json<RunMusicRewriteBundleSaveRequest>, JsonRejection>,
) -> ApiResult<RunMusicRewriteBundleSaveResponse> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let state_path = run_store::run_state_path(&run_id);
    let _state = run_store::read_run_state(&state_path).map_err(|_| {
        if state_path.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        }
    })?;
    let Json(req) = body.map_err(|e| ApiError::bad_request("INVALID_JSON", &e.body_text()))?;
    let saved_at = chrono::Utc::now().to_rfc3339();
    let stamp = chrono::Utc::now().format("%Y%m%dT%H%M%S%.3fZ").to_string();
    let bundle_id = format!("rewrite_bundle_{}", stamp);
    let relative_path = format!("{}/{}.json", rewrite_bundle_relative_dir(), bundle_id);
    let file_path = run_store::run_dir(&run_id).join(relative_path.trim_start_matches("./"));
    run_store::ensure_dir_path(&file_path)
        .map_err(|e| ApiError::internal("REWRITE_BUNDLE_DIR_FAILED", &e.to_string()))?;
    let bundle = match req.bundle {
        Value::Object(mut map) => {
            map.insert("saved_at".to_string(), Value::String(saved_at.clone()));
            map.insert("bundle_id".to_string(), Value::String(bundle_id.clone()));
            map.insert(
                "version_name".to_string(),
                Value::String(
                    req.version_name
                        .clone()
                        .filter(|s| !s.trim().is_empty())
                        .unwrap_or_else(|| bundle_id.clone()),
                ),
            );
            Value::Object(map)
        }
        other => serde_json::json!({
            "bundle_version": "cssmv.rewrite.bundle.v1",
            "saved_at": saved_at,
            "bundle_id": bundle_id,
            "version_name": req.version_name.clone().filter(|s| !s.trim().is_empty()).unwrap_or_else(|| bundle_id.clone()),
            "payload": other,
        }),
    };
    let bytes = serde_json::to_vec_pretty(&bundle)
        .map_err(|e| ApiError::internal("REWRITE_BUNDLE_SERIALIZE_FAILED", &e.to_string()))?;
    fs::write(&file_path, &bytes)
        .map_err(|e| ApiError::internal("REWRITE_BUNDLE_WRITE_FAILED", &e.to_string()))?;
    Ok(Json(RunMusicRewriteBundleSaveResponse {
        schema: "cssapi.runs.music_rewrite_bundle_save.v1",
        run_id: run_id.clone(),
        entry: RunMusicRewriteBundleEntry {
            version_name: bundle_version_name(&bundle, &bundle_id),
            bundle_id,
            saved_at,
            relative_path: relative_path.clone(),
            download_url: encode_delivery_file_url(&run_id, &relative_path),
            bytes: bytes.len() as u64,
            bundle,
        },
    }))
}

pub async fn run_music_watch_snapshots_save(
    headers: HeaderMap,
    Path(run_id): Path<String>,
    body: Result<Json<RunMusicWatchSnapshotSaveRequest>, JsonRejection>,
) -> ApiResult<RunMusicWatchSnapshotSaveResponse> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let state_path = run_store::run_state_path(&run_id);
    let _state = run_store::read_run_state(&state_path).map_err(|_| {
        if state_path.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        }
    })?;
    let Json(req) = body.map_err(|e| ApiError::bad_request("INVALID_JSON", &e.body_text()))?;
    let saved_at = chrono::Utc::now().to_rfc3339();
    let stamp = chrono::Utc::now().format("%Y%m%dT%H%M%S%.3fZ").to_string();
    let snapshot_id = format!("watch_snapshot_{}", stamp);
    let relative_path = format!("{}/{}.json", watch_snapshot_relative_dir(), snapshot_id);
    let file_path = run_store::run_dir(&run_id).join(relative_path.trim_start_matches("./"));
    run_store::ensure_dir_path(&file_path)
        .map_err(|e| ApiError::internal("WATCH_SNAPSHOT_DIR_FAILED", &e.to_string()))?;
    let payload = match req.payload {
        Value::Object(mut map) => {
            map.insert("saved_at".to_string(), Value::String(saved_at.clone()));
            map.insert(
                "snapshot_id".to_string(),
                Value::String(snapshot_id.clone()),
            );
            map.insert(
                "version_name".to_string(),
                Value::String(
                    req.version_name
                        .clone()
                        .filter(|s| !s.trim().is_empty())
                        .unwrap_or_else(|| snapshot_id.clone()),
                ),
            );
            Value::Object(map)
        }
        other => serde_json::json!({
            "bundle_version": "cssmv.watch.snapshot.v1",
            "saved_at": saved_at,
            "snapshot_id": snapshot_id,
            "version_name": req.version_name.clone().filter(|s| !s.trim().is_empty()).unwrap_or_else(|| snapshot_id.clone()),
            "payload": other,
        }),
    };
    let bytes = serde_json::to_vec_pretty(&payload)
        .map_err(|e| ApiError::internal("WATCH_SNAPSHOT_SERIALIZE_FAILED", &e.to_string()))?;
    fs::write(&file_path, &bytes)
        .map_err(|e| ApiError::internal("WATCH_SNAPSHOT_WRITE_FAILED", &e.to_string()))?;
    Ok(Json(RunMusicWatchSnapshotSaveResponse {
        schema: "cssapi.runs.music_watch_snapshot_save.v1",
        run_id: run_id.clone(),
        entry: RunMusicWatchSnapshotEntry {
            snapshot_id,
            saved_at,
            version_name: bundle_version_name(&payload, "watch-snapshot"),
            relative_path: relative_path.clone(),
            download_url: encode_delivery_file_url(&run_id, &relative_path),
            bytes: bytes.len() as u64,
            payload,
        },
    }))
}

pub async fn run_music_rewrite_bundle_promote(
    headers: HeaderMap,
    Path(run_id): Path<String>,
    body: Result<Json<RunMusicRewritePromoteRequest>, JsonRejection>,
) -> ApiResult<RunMusicRewritePromoteResponse> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let state_path = run_store::run_state_path(&run_id);
    let _state = run_store::read_run_state(&state_path).map_err(|_| {
        if state_path.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        }
    })?;
    let Json(req) = body.map_err(|e| ApiError::bad_request("INVALID_JSON", &e.body_text()))?;
    let bundles = list_rewrite_bundle_entries(&run_id);
    let Some(bundle_entry) = bundles
        .into_iter()
        .find(|item| item.bundle_id == req.bundle_id)
    else {
        return Err(ApiError::not_found(
            "REWRITE_BUNDLE_NOT_FOUND",
            "rewrite bundle not found",
        ));
    };
    let promoted_at = chrono::Utc::now().to_rfc3339();
    let promotion_id = format!(
        "rewrite_promotion_{}",
        chrono::Utc::now().format("%Y%m%dT%H%M%S%.3fZ")
    );
    let relative_path = format!("{}/{}.json", rewrite_promotion_relative_dir(), promotion_id);
    let file_path = run_store::run_dir(&run_id).join(relative_path.trim_start_matches("./"));
    run_store::ensure_dir_path(&file_path)
        .map_err(|e| ApiError::internal("REWRITE_PROMOTION_DIR_FAILED", &e.to_string()))?;
    let payload = serde_json::json!({
        "promotion_id": promotion_id,
        "promoted_at": promoted_at,
        "run_id": run_id,
        "target": "provider_rewrite_job",
        "bundle_id": bundle_entry.bundle_id,
        "version_name": bundle_entry.version_name,
        "provider_payload": bundle_entry.bundle.get("provider_payload").cloned().unwrap_or(Value::Null),
        "cue_patch_plan": bundle_entry.bundle.get("cue_patch_plan").cloned().unwrap_or(Value::Null),
        "source_phrase_ids": bundle_entry.bundle.get("source_phrase_ids").cloned().unwrap_or(Value::Array(Vec::new())),
        "status": "queued_for_provider",
    });
    let bytes = serde_json::to_vec_pretty(&payload)
        .map_err(|e| ApiError::internal("REWRITE_PROMOTION_SERIALIZE_FAILED", &e.to_string()))?;
    fs::write(&file_path, &bytes)
        .map_err(|e| ApiError::internal("REWRITE_PROMOTION_WRITE_FAILED", &e.to_string()))?;
    maybe_refresh_rewrite_promotion_artifacts(&run_id, &promotion_id, &payload);
    let queue_rel = format!(
        "{}/{}.json",
        rewrite_execution_queue_relative_dir(),
        promotion_id
    );
    let status_rel = format!(
        "{}/{}.json",
        rewrite_job_status_relative_dir(),
        promotion_id
    );
    let apply_rel = format!(
        "{}/{}.json",
        rewrite_apply_back_relative_dir(),
        promotion_id
    );
    Ok(Json(RunMusicRewritePromoteResponse {
        schema: "cssapi.runs.music_rewrite_bundle_promote.v1",
        run_id: run_id.clone(),
        entry: RunMusicRewritePromotionEntry {
            promotion_id: payload
                .get("promotion_id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            promoted_at: payload
                .get("promoted_at")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            bundle_id: bundle_entry.bundle_id,
            version_name: bundle_entry.version_name,
            relative_path: relative_path.clone(),
            download_url: encode_delivery_file_url(&run_id, &relative_path),
            bytes: bytes.len() as u64,
            payload,
            execution_queue_path: Some(queue_rel.clone()),
            job_status_path: Some(status_rel.clone()),
            apply_back_result_path: Some(apply_rel.clone()),
            job_status: read_json_if_exists(
                &run_store::run_dir(&run_id).join(status_rel.trim_start_matches("./")),
            ),
            apply_back_result: read_json_if_exists(
                &run_store::run_dir(&run_id).join(apply_rel.trim_start_matches("./")),
            ),
        },
    }))
}

pub async fn run_music_arrangement_revision_rollback(
    headers: HeaderMap,
    Path(run_id): Path<String>,
    body: Result<Json<RunMusicArrangementRevisionActionRequest>, JsonRejection>,
) -> ApiResult<RunMusicArrangementRevisionActionResponse> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let state_path = run_store::run_state_path(&run_id);
    let _state = run_store::read_run_state(&state_path).map_err(|_| {
        if state_path.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        }
    })?;
    let Json(req) = body.map_err(|e| ApiError::bad_request("INVALID_JSON", &e.body_text()))?;
    let manifest_path = arrangement_revision_manifest_path(&run_id);
    let mut revisions = list_arrangement_revisions(&run_id);
    let Some(target) = revisions
        .iter()
        .find(|item| item.revision_id == req.revision_id)
        .cloned()
    else {
        return Err(ApiError::not_found(
            "ARRANGEMENT_REVISION_NOT_FOUND",
            "arrangement revision not found",
        ));
    };
    let new_id = format!(
        "arr_revision_rollback_{}",
        chrono::Utc::now().format("%Y%m%dT%H%M%S%.3fZ")
    );
    let cue_rel = format!(
        "{}/{}_cue_sheet.json",
        rewrite_revision_relative_dir(),
        new_id
    );
    let phrase_rel = format!(
        "{}/{}_phrase_map.json",
        rewrite_revision_relative_dir(),
        new_id
    );
    let run_dir = run_store::run_dir(&run_id);
    fs::copy(
        run_dir.join(target.cue_relative_path.trim_start_matches("./")),
        run_dir.join(cue_rel.trim_start_matches("./")),
    )
    .map_err(|e| ApiError::internal("ARRANGEMENT_REVISION_COPY_FAILED", &e.to_string()))?;
    fs::copy(
        run_dir.join(target.phrase_relative_path.trim_start_matches("./")),
        run_dir.join(phrase_rel.trim_start_matches("./")),
    )
    .map_err(|e| ApiError::internal("ARRANGEMENT_REVISION_COPY_FAILED", &e.to_string()))?;
    revisions.iter_mut().for_each(|item| {
        if item.state == "active" {
            item.state = "superseded".to_string();
        }
    });
    let revision = RunMusicArrangementRevisionEntry {
        revision_id: new_id,
        created_at: chrono::Utc::now().to_rfc3339(),
        source_promotion_id: target.source_promotion_id.clone(),
        version_name: format!("Rollback {}", target.version_name),
        cue_relative_path: cue_rel,
        phrase_relative_path: phrase_rel,
        state: "active".to_string(),
        rolled_back_from: Some(target.revision_id),
        merged_from: target.merged_from.clone(),
    };
    revisions.push(revision.clone());
    let revisions_json = serde_json::to_value(&revisions).unwrap_or(Value::Array(Vec::new()));
    write_json_pretty(&manifest_path, &revisions_json)
        .map_err(|e| ApiError::internal("ARRANGEMENT_REVISION_WRITE_FAILED", &e.to_string()))?;
    Ok(Json(RunMusicArrangementRevisionActionResponse {
        schema: "cssapi.runs.arrangement_revision_rollback.v1",
        run_id,
        revision,
    }))
}

pub async fn run_music_arrangement_revision_merge_forward(
    headers: HeaderMap,
    Path(run_id): Path<String>,
    body: Result<Json<RunMusicArrangementRevisionActionRequest>, JsonRejection>,
) -> ApiResult<RunMusicArrangementRevisionActionResponse> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let state_path = run_store::run_state_path(&run_id);
    let _state = run_store::read_run_state(&state_path).map_err(|_| {
        if state_path.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        }
    })?;
    let Json(req) = body.map_err(|e| ApiError::bad_request("INVALID_JSON", &e.body_text()))?;
    let manifest_path = arrangement_revision_manifest_path(&run_id);
    let mut revisions = list_arrangement_revisions(&run_id);
    let Some(target) = revisions
        .iter()
        .find(|item| item.revision_id == req.revision_id)
        .cloned()
    else {
        return Err(ApiError::not_found(
            "ARRANGEMENT_REVISION_NOT_FOUND",
            "arrangement revision not found",
        ));
    };
    let active = revisions
        .iter()
        .find(|item| item.state == "active")
        .cloned();
    let new_id = format!(
        "arr_revision_merge_{}",
        chrono::Utc::now().format("%Y%m%dT%H%M%S%.3fZ")
    );
    let cue_rel = format!(
        "{}/{}_cue_sheet.json",
        rewrite_revision_relative_dir(),
        new_id
    );
    let phrase_rel = format!(
        "{}/{}_phrase_map.json",
        rewrite_revision_relative_dir(),
        new_id
    );
    let run_dir = run_store::run_dir(&run_id);
    let mut cue = read_json_if_exists::<Value>(
        &run_dir.join(target.cue_relative_path.trim_start_matches("./")),
    )
    .unwrap_or_else(|| serde_json::json!({"cue_segments":[]}));
    if let Some(obj) = cue.as_object_mut() {
        obj.insert(
            "merge_meta".to_string(),
            serde_json::json!({
                "merged_forward_from": target.revision_id,
                "active_revision": active.as_ref().map(|x| x.revision_id.clone()),
            }),
        );
    }
    write_json_pretty(&run_dir.join(cue_rel.trim_start_matches("./")), &cue)
        .map_err(|e| ApiError::internal("ARRANGEMENT_REVISION_WRITE_FAILED", &e.to_string()))?;
    let mut phrase = read_json_if_exists::<Value>(
        &run_dir.join(target.phrase_relative_path.trim_start_matches("./")),
    )
    .unwrap_or_else(|| serde_json::json!({"phrase_segments":[]}));
    if let Some(obj) = phrase.as_object_mut() {
        obj.insert(
            "merge_meta".to_string(),
            serde_json::json!({
                "merged_forward_from": target.revision_id,
                "active_revision": active.as_ref().map(|x| x.revision_id.clone()),
            }),
        );
    }
    write_json_pretty(&run_dir.join(phrase_rel.trim_start_matches("./")), &phrase)
        .map_err(|e| ApiError::internal("ARRANGEMENT_REVISION_WRITE_FAILED", &e.to_string()))?;
    revisions.iter_mut().for_each(|item| {
        if item.state == "active" {
            item.state = "superseded".to_string();
        }
    });
    let revision = RunMusicArrangementRevisionEntry {
        revision_id: new_id,
        created_at: chrono::Utc::now().to_rfc3339(),
        source_promotion_id: target.source_promotion_id.clone(),
        version_name: format!("Merge {}", target.version_name),
        cue_relative_path: cue_rel,
        phrase_relative_path: phrase_rel,
        state: "active".to_string(),
        rolled_back_from: None,
        merged_from: vec![
            target.revision_id,
            active.map(|item| item.revision_id).unwrap_or_default(),
        ]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect(),
    };
    revisions.push(revision.clone());
    let revisions_json = serde_json::to_value(&revisions).unwrap_or(Value::Array(Vec::new()));
    write_json_pretty(&manifest_path, &revisions_json)
        .map_err(|e| ApiError::internal("ARRANGEMENT_REVISION_WRITE_FAILED", &e.to_string()))?;
    Ok(Json(RunMusicArrangementRevisionActionResponse {
        schema: "cssapi.runs.arrangement_revision_merge_forward.v1",
        run_id,
        revision,
    }))
}

pub async fn run_music_arrangement_revision_release_candidate(
    headers: HeaderMap,
    Path(run_id): Path<String>,
    body: Result<Json<RunMusicArrangementReleaseCandidateRequest>, JsonRejection>,
) -> ApiResult<RunMusicArrangementReleaseCandidateResponse> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let state_path = run_store::run_state_path(&run_id);
    let _state = run_store::read_run_state(&state_path).map_err(|_| {
        if state_path.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        }
    })?;
    let Json(req) = body.map_err(|e| ApiError::bad_request("INVALID_JSON", &e.body_text()))?;
    let revisions = list_arrangement_revisions(&run_id);
    let Some(target) = revisions
        .iter()
        .find(|item| item.revision_id == req.revision_id)
        .cloned()
    else {
        return Err(ApiError::not_found(
            "ARRANGEMENT_REVISION_NOT_FOUND",
            "arrangement revision not found",
        ));
    };
    let manifest_path = arrangement_release_candidate_manifest_path(&run_id);
    let mut entries = list_arrangement_release_candidates(&run_id);
    let entry = RunMusicArrangementReleaseCandidateEntry {
        candidate_id: format!(
            "arr_release_candidate_{}",
            chrono::Utc::now().format("%Y%m%dT%H%M%S%.3fZ")
        ),
        revision_id: target.revision_id.clone(),
        version_name: target.version_name.clone(),
        candidate_name: req
            .candidate_name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("Release Candidate {}", target.version_name)),
        nominated_at: chrono::Utc::now().to_rfc3339(),
        state: "candidate".to_string(),
        locked_at: None,
        published_at: None,
        release_dir_relative_path: None,
        release_manifest_relative_path: None,
        immutable_handoff_relative_path: None,
        release_approval_relative_path: None,
        release_signoff_relative_path: None,
        delivery_certificate_relative_path: None,
        release_audit_trail_relative_path: None,
        notarized_receipt_relative_path: None,
        downstream_compliance_feed_relative_path: None,
        compliance_ack_relative_path: None,
        regulator_receipt_relative_path: None,
        audit_timeline_relative_path: None,
    };
    entries.push(entry.clone());
    let entries_json = serde_json::to_value(&entries).unwrap_or(Value::Array(Vec::new()));
    write_json_pretty(&manifest_path, &entries_json).map_err(|e| {
        ApiError::internal("ARRANGEMENT_RELEASE_CANDIDATE_WRITE_FAILED", &e.to_string())
    })?;
    Ok(Json(RunMusicArrangementReleaseCandidateResponse {
        schema: "cssapi.runs.arrangement_release_candidate.v1",
        run_id,
        entry,
    }))
}

pub async fn run_music_arrangement_revision_lock(
    headers: HeaderMap,
    Path(run_id): Path<String>,
    body: Result<Json<RunMusicArrangementReleaseCandidateRequest>, JsonRejection>,
) -> ApiResult<RunMusicArrangementReleaseCandidateResponse> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let state_path = run_store::run_state_path(&run_id);
    let _state = run_store::read_run_state(&state_path).map_err(|_| {
        if state_path.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        }
    })?;
    let Json(req) = body.map_err(|e| ApiError::bad_request("INVALID_JSON", &e.body_text()))?;
    let revisions = list_arrangement_revisions(&run_id);
    let Some(target) = revisions
        .iter()
        .find(|item| item.revision_id == req.revision_id)
        .cloned()
    else {
        return Err(ApiError::not_found(
            "ARRANGEMENT_REVISION_NOT_FOUND",
            "arrangement revision not found",
        ));
    };
    let manifest_path = arrangement_release_candidate_manifest_path(&run_id);
    let mut entries = list_arrangement_release_candidates(&run_id);
    let now = chrono::Utc::now().to_rfc3339();
    entries.iter_mut().for_each(|entry| {
        if entry.state == "locked" {
            entry.state = "candidate".to_string();
        }
    });
    let entry = if let Some(existing) = entries
        .iter_mut()
        .find(|entry| entry.revision_id == target.revision_id)
    {
        existing.version_name = target.version_name.clone();
        if let Some(name) = req
            .candidate_name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            existing.candidate_name = name.to_string();
        }
        existing.state = "locked".to_string();
        existing.locked_at = Some(now.clone());
        existing.clone()
    } else {
        let created = RunMusicArrangementReleaseCandidateEntry {
            candidate_id: format!(
                "arr_release_candidate_{}",
                chrono::Utc::now().format("%Y%m%dT%H%M%S%.3fZ")
            ),
            revision_id: target.revision_id.clone(),
            version_name: target.version_name.clone(),
            candidate_name: req
                .candidate_name
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("Locked {}", target.version_name)),
            nominated_at: now.clone(),
            state: "locked".to_string(),
            locked_at: Some(now.clone()),
            published_at: None,
            release_dir_relative_path: None,
            release_manifest_relative_path: None,
            immutable_handoff_relative_path: None,
            release_approval_relative_path: None,
            release_signoff_relative_path: None,
            delivery_certificate_relative_path: None,
            release_audit_trail_relative_path: None,
            notarized_receipt_relative_path: None,
            downstream_compliance_feed_relative_path: None,
            compliance_ack_relative_path: None,
            regulator_receipt_relative_path: None,
            audit_timeline_relative_path: None,
        };
        entries.push(created.clone());
        created
    };
    let entries_json = serde_json::to_value(&entries).unwrap_or(Value::Array(Vec::new()));
    write_json_pretty(&manifest_path, &entries_json)
        .map_err(|e| ApiError::internal("ARRANGEMENT_LOCK_WRITE_FAILED", &e.to_string()))?;
    Ok(Json(RunMusicArrangementReleaseCandidateResponse {
        schema: "cssapi.runs.arrangement_lock_revision.v1",
        run_id,
        entry,
    }))
}

pub async fn run_music_arrangement_revision_publish(
    headers: HeaderMap,
    Path(run_id): Path<String>,
    body: Result<Json<RunMusicArrangementReleaseCandidateRequest>, JsonRejection>,
) -> ApiResult<RunMusicArrangementReleaseCandidateResponse> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let state_path = run_store::run_state_path(&run_id);
    let _state = run_store::read_run_state(&state_path).map_err(|_| {
        if state_path.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        }
    })?;
    let Json(req) = body.map_err(|e| ApiError::bad_request("INVALID_JSON", &e.body_text()))?;
    let revisions = list_arrangement_revisions(&run_id);
    let Some(target) = revisions
        .iter()
        .find(|item| item.revision_id == req.revision_id)
        .cloned()
    else {
        return Err(ApiError::not_found(
            "ARRANGEMENT_REVISION_NOT_FOUND",
            "arrangement revision not found",
        ));
    };
    let manifest_path = arrangement_release_candidate_manifest_path(&run_id);
    let mut entries = list_arrangement_release_candidates(&run_id);
    let now = chrono::Utc::now().to_rfc3339();
    let candidate_for_gate = entries
        .iter()
        .find(|entry| entry.revision_id == target.revision_id)
        .map(|entry| entry.candidate_id.as_str());
    ensure_publish_gate_authorization(&run_id, &target.revision_id, candidate_for_gate)?;
    entries.iter_mut().for_each(|entry| {
        if entry.state == "published" {
            entry.state = "candidate".to_string();
            entry.published_at = None;
        }
    });
    let entry = if let Some(existing) = entries
        .iter_mut()
        .find(|entry| entry.revision_id == target.revision_id)
    {
        existing.version_name = target.version_name.clone();
        if let Some(name) = req
            .candidate_name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            existing.candidate_name = name.to_string();
        }
        if existing.locked_at.is_none() {
            existing.locked_at = Some(now.clone());
        }
        existing.state = "published".to_string();
        existing.published_at = Some(now.clone());
        freeze_arrangement_release_artifacts(&run_id, &target, existing)?;
        existing.clone()
    } else {
        let mut created = RunMusicArrangementReleaseCandidateEntry {
            candidate_id: format!(
                "arr_release_candidate_{}",
                chrono::Utc::now().format("%Y%m%dT%H%M%S%.3fZ")
            ),
            revision_id: target.revision_id.clone(),
            version_name: target.version_name.clone(),
            candidate_name: req
                .candidate_name
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("Published {}", target.version_name)),
            nominated_at: now.clone(),
            state: "published".to_string(),
            locked_at: Some(now.clone()),
            published_at: Some(now.clone()),
            release_dir_relative_path: None,
            release_manifest_relative_path: None,
            immutable_handoff_relative_path: None,
            release_approval_relative_path: None,
            release_signoff_relative_path: None,
            delivery_certificate_relative_path: None,
            release_audit_trail_relative_path: None,
            notarized_receipt_relative_path: None,
            downstream_compliance_feed_relative_path: None,
            compliance_ack_relative_path: None,
            regulator_receipt_relative_path: None,
            audit_timeline_relative_path: None,
        };
        freeze_arrangement_release_artifacts(&run_id, &target, &mut created)?;
        entries.push(created.clone());
        created
    };
    let entries_json = serde_json::to_value(&entries).unwrap_or(Value::Array(Vec::new()));
    write_json_pretty(&manifest_path, &entries_json)
        .map_err(|e| ApiError::internal("ARRANGEMENT_PUBLISH_WRITE_FAILED", &e.to_string()))?;
    Ok(Json(RunMusicArrangementReleaseCandidateResponse {
        schema: "cssapi.runs.arrangement_publish_revision.v1",
        run_id,
        entry,
    }))
}

pub async fn run_music_delivery_artifact(
    headers: HeaderMap,
    Path(run_id): Path<String>,
    Query(q): Query<RunMusicDeliveryArtifactQuery>,
) -> axum::response::Response {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let state_path = run_store::run_state_path(&run_id);
    if !state_path.exists() {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "schema":"css.error.v1",
                "code":"RUN_NOT_FOUND",
                "message": crate::i18n::t(lang, "run_not_found")
            })),
        )
            .into_response();
    }
    let run_dir = run_store::run_dir(&run_id);
    let Some(file_path) = safe_run_relative_path(&run_dir, &q.path) else {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "schema":"css.error.v1",
                "code":"ARTIFACT_PATH_INVALID",
                "path": q.path
            })),
        )
            .into_response();
    };
    let Ok(meta) = fs::metadata(&file_path) else {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "schema":"css.error.v1",
                "code":"ARTIFACT_NOT_FOUND",
                "path": q.path
            })),
        )
            .into_response();
    };
    if !meta.is_file() || meta.len() == 0 {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "schema":"css.error.v1",
                "code":"ARTIFACT_EMPTY",
                "path": q.path
            })),
        )
            .into_response();
    }
    let mime = guess_delivery_mime(&q.path);
    let bytes = match fs::read(&file_path) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "schema":"css.error.v1",
                    "code":"ARTIFACT_READ_FAILED",
                    "path": q.path
                })),
            )
                .into_response()
        }
    };
    ([(axum::http::header::CONTENT_TYPE, mime)], bytes).into_response()
}

pub async fn run_music_compliance_action(
    headers: HeaderMap,
    Path(run_id): Path<String>,
    body: Result<Json<RunMusicComplianceActionRequest>, JsonRejection>,
) -> ApiResult<RunMusicComplianceActionResponse> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let state_path = run_store::run_state_path(&run_id);
    let _state = run_store::read_run_state(&state_path).map_err(|_| {
        if state_path.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        }
    })?;
    let Json(req) = body.map_err(|e| ApiError::bad_request("INVALID_JSON", &e.body_text()))?;
    let action = req.action.trim().to_lowercase();
    if action.is_empty() {
        return Err(ApiError::bad_request(
            "COMPLIANCE_ACTION_REQUIRED",
            "compliance action is required",
        ));
    }
    let entries = list_arrangement_release_candidates(&run_id);
    let published = req
        .candidate_id
        .as_deref()
        .and_then(|id| entries.iter().find(|entry| entry.candidate_id == id))
        .cloned()
        .or_else(|| {
            entries
                .iter()
                .find(|entry| entry.state == "published")
                .cloned()
        });
    let now = chrono::Utc::now().to_rfc3339();
    let note = req.note.clone();
    let target_path = req.target_path.clone();
    let requested_keyset = req.secret_keyset.clone().unwrap_or_default();
    let parsed_keyset = parse_compliance_secret_keyset(Some(requested_keyset.clone()));
    let actor_identity = resolve_compliance_actor_identity(&headers, &req);
    let actor_identity_payload = serde_json::json!({
        "schema": "cssapi.runs.compliance_actor_identity.v1",
        "run_id": run_id,
        "action": action,
        "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
        "actor_identity": actor_identity,
        "status": "resolved",
        "resolved_at": now
    });
    let actor_identity_path =
        write_compliance_aux_artifact(&run_id, "actor-identity", &actor_identity_payload)?;
    let permission_check = evaluate_compliance_permission(&run_id, &action, &actor_identity);
    let permission_check_path =
        write_compliance_aux_artifact(&run_id, "permission-check", &permission_check)?;
    let audit_signature = build_compliance_audit_signature(
        &run_id,
        &action,
        &actor_identity,
        &permission_check,
        note.as_deref(),
    );
    let audit_signature_path =
        write_compliance_aux_artifact(&run_id, "audit-signature", &audit_signature)?;
    if !permission_check
        .get("allowed")
        .and_then(|value| value.as_bool())
        .unwrap_or(false)
    {
        return Err(ApiError::forbidden(
            "COMPLIANCE_PERMISSION_DENIED",
            "actor does not have permission for this compliance action",
        )
        .with_details(serde_json::json!({
            "action": action,
            "required_scope": permission_check.get("required_scope").cloned().unwrap_or(Value::Null),
            "actor_identity": actor_identity,
            "actor_identity_path": actor_identity_path,
            "permission_check_path": permission_check_path,
            "audit_signature_path": audit_signature_path
        })));
    }
    let scoped_permissions = req
        .scoped_permissions
        .clone()
        .unwrap_or_else(|| current_compliance_scoped_permissions(&run_id));
    let actor_directory = req
        .actor_directory
        .clone()
        .unwrap_or_else(|| current_actor_directory(&run_id));
    let approver_routing = req
        .approver_routing
        .clone()
        .unwrap_or_else(|| current_approver_routing(&run_id));
    let required_signers = req
        .required_signers
        .clone()
        .unwrap_or_else(|| current_required_signers(&run_id));
    let role_policy_name = req.role_policy_name.clone().unwrap_or_else(|| {
        req.preset_name
            .clone()
            .unwrap_or_else(|| "default-ops".to_string())
    });
    let mut payload = match action.as_str() {
        "save_compliance_preset" => serde_json::json!({
            "schema": "cssapi.runs.compliance_preset.v1",
            "action": action,
            "run_id": run_id,
            "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
            "preset_name": req.preset_name.clone().unwrap_or_else(|| "default-ops".to_string()),
            "active_kid": req.active_kid.clone(),
            "keyset": requested_keyset,
            "vendor": req.vendor.clone().unwrap_or_else(|| "local".to_string()),
            "required_fields": req.required_fields.clone().unwrap_or_default(),
            "optional_fields": req.optional_fields.clone().unwrap_or_default(),
            "field_defaults": req.field_defaults.clone().unwrap_or(Value::Object(Default::default())),
            "reopen_reason": req.reopen_reason.clone(),
            "scoped_permissions": scoped_permissions.clone(),
            "status": "preset_saved",
            "saved_at": now,
            "note": note
        }),
        "save_actor_directory" => serde_json::json!({
            "schema": "cssapi.runs.compliance_actor_directory.v1",
            "action": action,
            "run_id": run_id,
            "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
            "directory": actor_directory,
            "status": "actor_directory_saved",
            "saved_at": now,
            "note": note
        }),
        "save_role_policy_preset" => serde_json::json!({
            "schema": "cssapi.runs.compliance_role_policy_preset.v1",
            "action": action,
            "run_id": run_id,
            "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
            "policy_presets": serde_json::json!([
                {
                    "preset_name": role_policy_name,
                    "scoped_permissions": scoped_permissions.clone()
                }
            ]),
            "status": "role_policy_saved",
            "saved_at": now,
            "note": note
        }),
        "save_approver_routing" => serde_json::json!({
            "schema": "cssapi.runs.compliance_approver_routing.v1",
            "action": action,
            "run_id": run_id,
            "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
            "routes": approver_routing,
            "status": "approver_routing_saved",
            "saved_at": now,
            "note": note
        }),
        "save_required_signers" => serde_json::json!({
            "schema": "cssapi.runs.compliance_required_signers.v1",
            "action": action,
            "run_id": run_id,
            "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
            "required_signers": required_signers.clone(),
            "status": "required_signers_saved",
            "saved_at": now,
            "note": note
        }),
        "audit_compliance_action" => serde_json::json!({
            "schema": "cssapi.runs.compliance_audit_log.v1",
            "action": action,
            "run_id": run_id,
            "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
            "note": note,
            "scoped_permissions": current_compliance_scoped_permissions(&run_id),
            "status": "audit_logged",
            "logged_at": now
        }),
        "rotate_secret" => serde_json::json!({
            "schema": "cssapi.runs.compliance_signing_rotation.v1",
            "action": action,
            "run_id": run_id,
            "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
            "active_kid": req.active_kid.clone(),
            "keyset": requested_keyset,
            "available_kids": parsed_keyset.iter().map(|(kid, _)| kid.clone()).collect::<Vec<_>>(),
            "key_count": parsed_keyset.len(),
            "status": "rotation_updated",
            "rotated_at": now,
            "note": note
        }),
        "update_ticket_registry" => serde_json::json!({
            "schema": "cssapi.runs.compliance_ticket_registry.v1",
            "action": action,
            "run_id": run_id,
            "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
            "vendor": req.vendor.clone().unwrap_or_else(|| "local".to_string()),
            "required_fields": req.required_fields.clone().unwrap_or_default(),
            "optional_fields": req.optional_fields.clone().unwrap_or_default(),
            "field_defaults": req.field_defaults.clone().unwrap_or(Value::Object(Default::default())),
            "status": "registry_updated",
            "updated_at": now,
            "note": note
        }),
        "reopen_compliance" => serde_json::json!({
            "schema": "cssapi.runs.compliance_reopen_action.v1",
            "action": action,
            "run_id": run_id,
            "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
            "target_path": target_path,
            "reopen_reason": req.reopen_reason.clone().or(note.clone()),
            "status": "reopened",
            "reopened_at": now
        }),
        "notify" => serde_json::json!({
            "schema": "cssapi.runs.compliance_notification_backend.v1",
            "action": action,
            "run_id": run_id,
            "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
            "target_team": req.target_team.clone().unwrap_or_else(|| "release-ops/compliance".to_string()),
            "sent_at": now,
            "status": "queued_notification",
            "note": note
        }),
        "incident_ticket" => serde_json::json!({
            "schema": "cssapi.runs.compliance_incident_ticket.v1",
            "action": action,
            "run_id": run_id,
            "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
            "ticket_id": format!("comp-inc-{}", chrono::Utc::now().format("%Y%m%d%H%M%S")),
            "opened_at": now,
            "status": "open",
            "severity": "high",
            "note": note
        }),
        "ack_backfill" => serde_json::json!({
            "schema": "cssapi.runs.compliance_ack_backfill.v1",
            "action": action,
            "run_id": run_id,
            "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
            "source_path": target_path,
            "backfilled_at": now,
            "status": "backfilled",
            "note": note
        }),
        "approve_compliance_action" => {
            let mut signed_approvers = latest_approval_chain_entry(&run_id)
                .and_then(|value| value.get("signed_approvers").cloned())
                .and_then(|value| value.as_array().cloned())
                .unwrap_or_default();
            signed_approvers.push(serde_json::json!({
                "actor": actor_identity.clone(),
                "decision": req.approval_decision.clone().unwrap_or_else(|| "approved".to_string()),
                "signature_kid": audit_signature.get("kid").cloned().unwrap_or(Value::Null),
                "timestamp": now
            }));
            let expected = required_signers
                .as_array()
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .filter_map(|value| value.as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>();
            let signed_roles = signed_approvers
                .iter()
                .filter_map(|entry| {
                    entry
                        .get("actor")
                        .and_then(|actor| actor.get("actor_role"))
                        .and_then(|value| value.as_str())
                        .map(|value| value.to_string())
                })
                .collect::<Vec<_>>();
            let missing = expected
                .iter()
                .filter(|role| !signed_roles.iter().any(|signed| signed == *role))
                .cloned()
                .collect::<Vec<_>>();
            serde_json::json!({
                "schema": "cssapi.runs.compliance_approval_chain.v1",
                "action": action,
                "run_id": run_id,
                "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
                "approval_decision": req.approval_decision.clone().unwrap_or_else(|| "approved".to_string()),
                "approval_note": note,
                "approver": actor_identity.clone(),
                "required_scope": permission_check.get("required_scope").cloned().unwrap_or(Value::Null),
                "audit_signature": audit_signature.clone(),
                "approver_routing": approver_routing.clone(),
                "required_signers": required_signers.clone(),
                "signed_approvers": signed_approvers,
                "missing_signers": missing,
                "approval_chain": serde_json::json!([
                    {
                        "step": "requested",
                        "status": "completed",
                        "actor": actor_identity.clone(),
                        "timestamp": now
                    },
                    {
                        "step": "signed",
                        "status": "completed",
                        "kid": audit_signature.get("kid").cloned().unwrap_or(Value::Null),
                        "timestamp": now
                    },
                    {
                        "step": "quorum_pending",
                        "status": if missing.is_empty() { "completed" } else { "pending" },
                        "required_signers": required_signers.clone(),
                        "timestamp": now
                    }
                ]),
                "status": "approval_recorded",
                "approved_at": now
            })
        }
        "finalize_release_quorum" => {
            let signed_roles = latest_approval_chain_entry(&run_id)
                .and_then(|value| value.get("signed_approvers").cloned())
                .and_then(|value| value.as_array().cloned())
                .unwrap_or_default()
                .into_iter()
                .filter_map(|entry| {
                    entry
                        .get("actor")
                        .and_then(|actor| actor.get("actor_role"))
                        .and_then(|value| value.as_str())
                        .map(|value| value.to_string())
                })
                .collect::<Vec<_>>();
            let expected = required_signers
                .as_array()
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .filter_map(|value| value.as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>();
            let missing = expected
                .iter()
                .filter(|role| !signed_roles.iter().any(|signed| signed == *role))
                .cloned()
                .collect::<Vec<_>>();
            serde_json::json!({
                "schema": "cssapi.runs.compliance_release_quorum.v1",
                "action": action,
                "run_id": run_id,
                "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
                "quorum_name": req.quorum_name.clone().unwrap_or_else(|| "final-release-gate".to_string()),
                "required_signers": required_signers.clone(),
                "signed_roles": signed_roles,
                "missing_signers": missing,
                "quorum_met": missing.is_empty(),
                "status": if missing.is_empty() { "quorum_met" } else { "quorum_pending" },
                "checked_at": now,
                "note": note
            })
        }
        _ => {
            return Err(ApiError::bad_request(
                "COMPLIANCE_ACTION_UNSUPPORTED",
                "unsupported compliance action",
            ))
        }
    };
    if let Some(map) = payload.as_object_mut() {
        map.insert("actor_identity".to_string(), actor_identity.clone());
        map.insert("permission_check".to_string(), permission_check.clone());
        map.insert("audit_signature".to_string(), audit_signature.clone());
        map.insert(
            "actor_identity_path".to_string(),
            Value::String(actor_identity_path.clone()),
        );
        map.insert(
            "permission_check_path".to_string(),
            Value::String(permission_check_path.clone()),
        );
        map.insert(
            "audit_signature_path".to_string(),
            Value::String(audit_signature_path.clone()),
        );
    }
    if action == "finalize_release_quorum"
        && payload
            .get("quorum_met")
            .and_then(|value| value.as_bool())
            .unwrap_or(false)
    {
        let gate_payload = serde_json::json!({
            "schema": "cssapi.runs.locked_publish_gate.v1",
            "run_id": run_id,
            "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
            "revision_id": published.as_ref().map(|entry| entry.revision_id.clone()),
            "gate_state": "unlocked",
            "quorum_name": payload.get("quorum_name").cloned().unwrap_or(Value::Null),
            "issued_at": now
        });
        let gate_path =
            write_compliance_aux_artifact(&run_id, "locked_publish_gate", &gate_payload)?;
        let token_payload = serde_json::json!({
            "schema": "cssapi.runs.release_unblock_token.v1",
            "run_id": run_id,
            "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
            "revision_id": published.as_ref().map(|entry| entry.revision_id.clone()),
            "status": "issued",
            "token_hint": format!("unblock-{}", chrono::Utc::now().format("%Y%m%d%H%M%S")),
            "issued_at": now
        });
        let token_path =
            write_compliance_aux_artifact(&run_id, "release_unblock_token", &token_payload)?;
        let authorization_payload = serde_json::json!({
            "schema": "cssapi.runs.immutable_publish_authorization.v1",
            "run_id": run_id,
            "candidate_id": published.as_ref().map(|entry| entry.candidate_id.clone()),
            "revision_id": published.as_ref().map(|entry| entry.revision_id.clone()),
            "authorization_state": "authorized",
            "immutable": true,
            "authorized_at": now,
            "source_quorum_path": Value::String("generated".to_string())
        });
        let authorization_path = write_compliance_aux_artifact(
            &run_id,
            "immutable_publish_authorization",
            &authorization_payload,
        )?;
        if let Some(map) = payload.as_object_mut() {
            map.insert(
                "locked_publish_gate_path".to_string(),
                Value::String(gate_path),
            );
            map.insert(
                "release_unblock_token_path".to_string(),
                Value::String(token_path),
            );
            map.insert(
                "immutable_publish_authorization_path".to_string(),
                Value::String(authorization_path),
            );
        }
    }
    let result_path = write_compliance_action_artifact(&run_id, &action, &payload)?;
    let (adapter_result_path, adapter_status) = match action.as_str() {
        "save_compliance_preset" => (Some(result_path.clone()), Some("preset_saved".to_string())),
        "save_actor_directory" => (
            Some(result_path.clone()),
            Some("actor_directory_saved".to_string()),
        ),
        "save_role_policy_preset" => (
            Some(result_path.clone()),
            Some("role_policy_saved".to_string()),
        ),
        "save_approver_routing" => (
            Some(result_path.clone()),
            Some("approver_routing_saved".to_string()),
        ),
        "save_required_signers" => (
            Some(result_path.clone()),
            Some("required_signers_saved".to_string()),
        ),
        "approve_compliance_action" => (
            Some(result_path.clone()),
            Some("approval_recorded".to_string()),
        ),
        "finalize_release_quorum" => (
            Some(result_path.clone()),
            payload
                .get("status")
                .and_then(|value| value.as_str())
                .map(|value| value.to_string()),
        ),
        "audit_compliance_action" => (Some(result_path.clone()), Some("audit_logged".to_string())),
        "rotate_secret" => (
            Some(result_path.clone()),
            Some("rotation_updated".to_string()),
        ),
        "notify" => {
            let (path, report) =
                dispatch_compliance_notification_adapter(&run_id, published.as_ref(), &payload)
                    .await?;
            (
                Some(path),
                report
                    .get("status")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            )
        }
        "update_ticket_registry" => (
            Some(result_path.clone()),
            Some("registry_updated".to_string()),
        ),
        "incident_ticket" => {
            let (path, report) =
                map_compliance_ticket_vendor(&run_id, published.as_ref(), &payload).await?;
            (
                Some(path),
                report
                    .get("status")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            )
        }
        "reopen_compliance" => {
            let (path, report) = build_compliance_ack_reconciliation(
                &run_id,
                published.as_ref(),
                req.target_path.as_deref(),
                req.reopen_reason.as_deref().or(req.note.as_deref()),
            )?;
            (
                Some(path),
                report
                    .get("reopen_state")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            )
        }
        "ack_backfill" => {
            let (path, report) = build_compliance_ack_reconciliation(
                &run_id,
                published.as_ref(),
                req.target_path.as_deref(),
                req.note.as_deref(),
            )?;
            (
                Some(path),
                report
                    .get("status")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            )
        }
        _ => (None, None),
    };
    Ok(Json(RunMusicComplianceActionResponse {
        schema: "cssapi.runs.compliance_action.v1",
        run_id,
        action,
        status: payload
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("ok")
            .to_string(),
        result_path,
        candidate_id: published.map(|entry| entry.candidate_id),
        adapter_result_path,
        adapter_status,
    }))
}

async fn run_cancel(
    headers: HeaderMap,
    Path(run_id): Path<String>,
) -> Result<(StatusCode, Json<CancelResponse>), ApiError> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let p = run_store::run_state_path(&run_id);
    if !p.exists() {
        return Err(ApiError::not_found(
            "RUN_NOT_FOUND",
            crate::i18n::t(lang, "run_not_found"),
        ));
    }
    let mut s = run_store::read_run_state(&p)
        .map_err(|_| ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found")))?;
    if matches!(
        s.status,
        RunStatus::SUCCEEDED | RunStatus::FAILED | RunStatus::CANCELLED
    ) {
        return Ok((
            StatusCode::OK,
            Json(CancelResponse {
                schema: "cssapi.runs.cancel.v1",
                run_id,
                cancel_requested: s.cancel_requested,
                already_done: true,
                status: format!("{:?}", s.status),
                stage_seq: s.stage_seq,
            }),
        ));
    }
    if !s.cancel_requested {
        s.cancel_requested = true;
        s.cancel_requested_at = Some(chrono::Utc::now().to_rfc3339());
        s.updated_at = chrono::Utc::now().to_rfc3339();
        let ts = s.updated_at.clone();
        crate::events::bump_event(
            &mut s,
            crate::events::EventKind::Cancelled,
            "run",
            "cancel_requested",
            ts,
            Some(serde_json::json!({"cancel_requested": true})),
        );
    }
    run_store::write_run_state(&p, &s).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        } else {
            map_io(e)
        }
    })?;

    Ok((
        StatusCode::ACCEPTED,
        Json(CancelResponse {
            schema: "cssapi.runs.cancel.v1",
            run_id,
            cancel_requested: true,
            already_done: false,
            status: format!("{:?}", s.status),
            stage_seq: s.stage_seq,
        }),
    ))
}

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    Router::new()
        .route("/cssapi/v1/runs", post(runs_create).get(runs_list))
        .route(
            "/cssapi/v1/mv/create",
            post(crate::orchestrator::trigger::create_mv),
        )
        .route("/cssapi/v1/runs/:run_id", get(runs_get))
        .route("/cssapi/v1/runs/:run_id/status", get(runs_status))
        .route("/cssapi/v1/runs/:run_id/ready", get(run_ready))
        .route(
            "/cssapi/v1/runs/:run_id/music-delivery-dashboard",
            get(run_music_delivery_dashboard),
        )
        .route(
            "/cssapi/v1/runs/:run_id/music-rewrite-bundles",
            post(run_music_rewrite_bundles_save),
        )
        .route(
            "/cssapi/v1/runs/:run_id/music-watch-snapshots",
            post(run_music_watch_snapshots_save),
        )
        .route(
            "/cssapi/v1/runs/:run_id/music-rewrite-bundles/promote",
            post(run_music_rewrite_bundle_promote),
        )
        .route(
            "/cssapi/v1/runs/:run_id/music-arrangement-revisions/rollback",
            post(run_music_arrangement_revision_rollback),
        )
        .route(
            "/cssapi/v1/runs/:run_id/music-arrangement-revisions/merge-forward",
            post(run_music_arrangement_revision_merge_forward),
        )
        .route(
            "/cssapi/v1/runs/:run_id/music-arrangement-revisions/release-candidate",
            post(run_music_arrangement_revision_release_candidate),
        )
        .route(
            "/cssapi/v1/runs/:run_id/music-arrangement-revisions/lock",
            post(run_music_arrangement_revision_lock),
        )
        .route(
            "/cssapi/v1/runs/:run_id/music-arrangement-revisions/publish",
            post(run_music_arrangement_revision_publish),
        )
        .route(
            "/cssapi/v1/runs/:run_id/music-delivery-artifact",
            get(run_music_delivery_artifact),
        )
        .route(
            "/cssapi/v1/runs/:run_id/music-compliance-actions",
            post(run_music_compliance_action),
        )
        .route(
            "/cssapi/v1/runs/:run_id/quality-history",
            get(run_quality_history),
        )
        .route("/cssapi/v1/runs/:run_id/cancel", post(run_cancel))
}

pub async fn create_run_from_dag_plan(
    _app: &crate::routes::AppState,
    req: &crate::orchestrator::request::CreateMvApiRequest,
    plan: &crate::dag_v3::plan::DagExecutionPlan,
) -> anyhow::Result<String> {
    let cssl = req
        .creative
        .title
        .clone()
        .or_else(|| match &req.input {
            crate::orchestrator::request::InputRequest::Text { text } => Some(text.clone()),
            _ => None,
        })
        .unwrap_or_else(|| "Untitled".to_string());

    let mut commands = crate::orchestrator::build::build_run_commands(req);
    let matrix = crate::orchestrator::normalize::normalize_version_matrix(&req.versions);
    let intent = crate::dag_v3::Intent {
        mode: crate::dag_v3::ProjectMode::FromScratch,
        primary_lang: matrix.primary_lang.0.clone(),
        target_langs: matrix.langs.iter().map(|x| x.0.clone()).collect(),
        target_voices: matrix.voices.iter().map(|x| x.0.clone()).collect(),
        karaoke: matrix
            .outputs
            .iter()
            .any(|x| matches!(x, crate::dag_v3::OutputKind::KaraokeMv)),
    };
    commands["intent"] = serde_json::to_value(intent)?;
    commands["version_matrix"] = serde_json::to_value(matrix.clone())?;

    let remaining = crate::billing_matrix::get_user_remaining_credits_usd("demo-user");
    let estimate = crate::billing_matrix::estimate_price(
        &req.engine.name,
        &req.engine.version,
        &matrix,
        remaining,
    );
    commands["billing"] = serde_json::to_value(&estimate)?;

    let create_req = RunsCreateRequest {
        cssl,
        ui_lang: req.versions.primary_lang.clone(),
        tier: Some("basic".to_string()),
        options: None,
        config: None,
        retry_policy: None,
        commands: Some(commands),
    };

    let (_status, Json(resp)) = runs_create(HeaderMap::new(), Ok(Json(create_req)))
        .await
        .map_err(|e| anyhow::anyhow!("runs_create failed: {}", format!("{}", e)))?;

    run_store::save_run_plan_v3(&resp.run_id, plan)?;
    run_store::save_run_artifacts_index(&resp.run_id, &plan.artifacts)?;

    Ok(resp.run_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderMap;
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    static RUNS_DIR_TEST_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn v115_smoke_ready_and_history_share_same_versions_shape() {
        let _guard = RUNS_DIR_TEST_LOCK.lock().expect("lock");
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("cssos-v115-smoke-{}", ts));
        std::fs::create_dir_all(&root).expect("mkdir");
        std::env::set_var("CSS_RUNS_DIR", root.to_string_lossy().to_string());

        let run_id = "run_v115_smoke";
        let mut st = crate::runner::init_run_state(
            run_id.to_string(),
            "en".to_string(),
            "basic".to_string(),
            "smoke".to_string(),
        );
        st.commands = serde_json::json!({
            "dag_version": "v3",
            "matrix": {
                "primary_lang": "en",
                "primary_voice": "female"
            }
        });
        if let Some(rec) = st.stages.get_mut("render") {
            rec.meta = serde_json::json!({
                "quality_gates": [{
                    "ok": true,
                    "code": "VIDEO_DURATION_OK",
                    "reason": "",
                    "metrics": {},
                    "version": {"lang":"en","voice":"female","output":"mv"}
                }]
            });
        }

        let state_path = crate::run_store::run_state_path(run_id);
        crate::run_store::ensure_run_dir(run_id).expect("ensure run dir");
        crate::run_store::write_run_state(&state_path, &st).expect("save run state");
        let plan = crate::dag_v3::plan::DagExecutionPlan {
            stages: vec![],
            topo_order: vec![],
            artifacts: crate::dag_v3::artifacts::ArtifactIndex::default(),
        };
        crate::run_store::save_run_plan_v3(run_id, &plan).expect("save plan");

        let ready_versions = quality_versions_from_state(run_id, &st).expect("ready versions");
        let history_versions = quality_versions_from_state(run_id, &st).expect("history versions");
        assert_eq!(
            serde_json::to_value(&ready_versions).expect("to value"),
            serde_json::to_value(&history_versions).expect("to value")
        );
        assert_eq!(ready_versions.items.len(), 1);
        let item = &ready_versions.items[0];
        assert_eq!(item.key.lang.as_deref(), Some("en"));
        assert_eq!(item.key.voice.as_deref(), Some("female"));
        assert_eq!(item.key.output.as_deref(), Some("mv"));
        assert!(item.ok);
    }

    #[tokio::test]
    async fn music_delivery_dashboard_reads_audio_provider_artifacts() {
        let _guard = RUNS_DIR_TEST_LOCK.lock().expect("lock");
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("cssos-music-dashboard-{}", ts));
        std::fs::create_dir_all(&root).expect("mkdir");
        std::env::set_var("CSS_RUNS_DIR", root.to_string_lossy().to_string());

        let run_id = "run_music_dashboard";
        let state_path = crate::run_store::run_state_path(run_id);
        crate::run_store::ensure_run_dir(run_id).expect("ensure run dir");

        let state = crate::runner::init_run_state(
            run_id.to_string(),
            "zh".to_string(),
            "dev".to_string(),
            "dashboard".to_string(),
        );
        crate::run_store::write_run_state(&state_path, &state).expect("save run state");

        let build_dir = crate::run_store::run_dir(run_id).join("build");
        std::fs::create_dir_all(&build_dir).expect("build dir");
        std::fs::write(
            build_dir.join("audio_provider_delivery_dashboard_feed.json"),
            serde_json::to_vec_pretty(&crate::audio_provider::ProviderDeliveryDashboardFeed {
                state: "published".to_string(),
                ready_for_delivery: true,
                publish_complete: true,
                backend: "webhook".to_string(),
                latest_action: "published".to_string(),
                job_id: Some("job-42".to_string()),
                publish_url: Some("https://example.invalid/releases/42".to_string()),
                export_root: Some("./exports".to_string()),
                receipt_path: Some("./build/audio_provider_downstream_receipt.json".to_string()),
                notes: vec!["ready".to_string()],
            })
            .expect("serialize dashboard"),
        )
        .expect("write dashboard");
        std::fs::write(
            build_dir.join("audio_provider_receipt_sync.json"),
            serde_json::to_vec_pretty(&crate::audio_provider::ProviderReceiptSync {
                synced: true,
                backend: "webhook".to_string(),
                job_id: Some("job-42".to_string()),
                publish_url: Some("https://example.invalid/releases/42".to_string()),
                receipt_path: Some("./build/audio_provider_downstream_receipt.json".to_string()),
                message: "synced".to_string(),
            })
            .expect("serialize receipt"),
        )
        .expect("write receipt");
        std::fs::create_dir_all(build_dir.join("stems")).expect("stems dir");
        std::fs::write(build_dir.join("stems/strings.wav"), b"RIFFdemo-wave").expect("write stem");
        std::fs::write(
            build_dir.join("audio_provider_cue_sheet.json"),
            br#"{"vendor":"internal","profile_name":"test","target_duration_s":180,"cue_segments":[{"start_sec":0.0,"duration_sec":30.0,"source_section":"Verse 1","template_name":"verse","intensity":"mid","contour":"lift","layer_roles":["lead","strings"],"asset_patches":["Lead","Strings"],"keyswitches":["C0"],"bar_start":1,"bar_end":8,"chord_slots":["C","G","Am","F"],"velocity_curve":[72,78,84,88],"note_density":0.7}]}"#,
        )
        .expect("write cue sheet");
        std::fs::create_dir_all(root.join(run_id).join("exports/rehearsal"))
            .expect("rehearsal dir");
        std::fs::write(
            root.join(run_id)
                .join("exports/rehearsal/rehearsal_pack.zip"),
            b"PKdemo",
        )
        .expect("write zip");

        let Json(resp) = run_music_delivery_dashboard(HeaderMap::new(), Path(run_id.to_string()))
            .await
            .expect("dashboard api");
        assert_eq!(resp.run_id, run_id);
        assert_eq!(
            resp.dashboard.as_ref().and_then(|x| x.job_id.as_deref()),
            Some("job-42")
        );
        assert_eq!(
            resp.receipt_sync
                .as_ref()
                .and_then(|x| x.publish_url.as_deref()),
            Some("https://example.invalid/releases/42")
        );
        assert!(resp.artifact_paths.contains_key("dashboard"));
        assert!(resp
            .package_browser
            .iter()
            .any(|item| item.category == "stems" && item.relative_path.ends_with("strings.wav")));
        assert!(resp
            .package_browser
            .iter()
            .any(|item| item.category == "arrangement"
                && item
                    .relative_path
                    .ends_with("audio_provider_cue_sheet.json")));
        assert!(resp
            .package_browser
            .iter()
            .any(|item| item.category == "package"
                && item.relative_path.ends_with("rehearsal_pack.zip")));
    }

    #[tokio::test]
    async fn music_rewrite_bundle_save_and_dashboard_history_work() {
        let _guard = RUNS_DIR_TEST_LOCK.lock().expect("lock");
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("cssos-music-rewrite-bundle-{}", ts));
        std::fs::create_dir_all(&root).expect("mkdir");
        std::env::set_var("CSS_RUNS_DIR", root.to_string_lossy().to_string());

        let run_id = "run_music_rewrite_bundle";
        let state_path = crate::run_store::run_state_path(run_id);
        crate::run_store::ensure_run_dir(run_id).expect("ensure run dir");
        let state = crate::runner::init_run_state(
            run_id.to_string(),
            "zh".to_string(),
            "dev".to_string(),
            "rewrite".to_string(),
        );
        crate::run_store::write_run_state(&state_path, &state).expect("save run state");

        let Json(saved) = run_music_rewrite_bundles_save(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicRewriteBundleSaveRequest {
                version_name: Some("Verse Lift v1".to_string()),
                bundle: serde_json::json!({
                    "bundle_version": "cssmv.rewrite.bundle.v1",
                    "mode": "mutation",
                    "section": {"id":"verse-1","label":"Verse 1","template":"verse"},
                    "source_phrase_ids": ["phrase-a", "phrase-b"],
                }),
            })),
        )
        .await
        .expect("save rewrite bundle");
        assert_eq!(saved.run_id, run_id);
        assert_eq!(
            saved.entry.bundle.get("mode").and_then(|v| v.as_str()),
            Some("mutation")
        );
        assert_eq!(saved.entry.version_name, "Verse Lift v1");
        assert!(saved.entry.relative_path.contains("rewrite_bundles"));

        let Json(promoted) = run_music_rewrite_bundle_promote(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicRewritePromoteRequest {
                bundle_id: saved.entry.bundle_id.clone(),
            })),
        )
        .await
        .expect("promote rewrite bundle");
        assert_eq!(promoted.entry.bundle_id, saved.entry.bundle_id);
        assert_eq!(promoted.entry.version_name, "Verse Lift v1");
        assert_eq!(
            promoted
                .entry
                .job_status
                .as_ref()
                .and_then(|v| v.get("status"))
                .and_then(|v| v.as_str()),
            Some("queued")
        );

        let promotion_path = crate::run_store::run_dir(run_id)
            .join(promoted.entry.relative_path.trim_start_matches("./"));
        let mut promotion_payload: Value =
            read_json_if_exists(&promotion_path).expect("promotion payload");
        if let Some(obj) = promotion_payload.as_object_mut() {
            obj.insert(
                "promoted_at".to_string(),
                Value::String((chrono::Utc::now() - chrono::TimeDelta::seconds(3)).to_rfc3339()),
            );
        }
        std::fs::write(
            &promotion_path,
            serde_json::to_vec_pretty(&promotion_payload).expect("serialize promotion payload"),
        )
        .expect("rewrite promotion payload");

        let Json(resp) = run_music_delivery_dashboard(HeaderMap::new(), Path(run_id.to_string()))
            .await
            .expect("dashboard api");
        assert_eq!(resp.rewrite_bundles.len(), 1);
        assert_eq!(resp.rewrite_promotions.len(), 1);
        assert!(resp.rewrite_promotions[0].job_status.is_some());
        assert!(resp.rewrite_promotions[0].apply_back_result.is_some());
        assert!(resp.rewrite_promotions[0]
            .apply_back_result
            .as_ref()
            .and_then(|v| v.get("revision_files"))
            .and_then(|v| v.as_array())
            .is_some());
        assert_eq!(
            resp.rewrite_bundles[0]
                .bundle
                .get("section")
                .and_then(|v| v.get("id"))
                .and_then(|v| v.as_str()),
            Some("verse-1")
        );
        assert_eq!(resp.rewrite_bundles[0].version_name, "Verse Lift v1");
        assert!(resp
            .package_browser
            .iter()
            .any(|item| item.category == "rewrite" && item.relative_path.ends_with(".json")));
        assert!(resp
            .package_browser
            .iter()
            .any(|item| item.category == "rewrite_job_status"
                && item.relative_path.ends_with(".json")));
        assert!(resp
            .package_browser
            .iter()
            .any(|item| item.category == "arrangement_revision"
                && item.relative_path.ends_with(".json")));

        let head = resp
            .arrangement_revision_head
            .clone()
            .expect("revision head");
        let Json(rollback) = run_music_arrangement_revision_rollback(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicArrangementRevisionActionRequest {
                revision_id: head.revision_id.clone(),
            })),
        )
        .await
        .expect("rollback revision");
        assert!(rollback.revision.version_name.starts_with("Rollback "));

        let Json(merged) = run_music_arrangement_revision_merge_forward(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicArrangementRevisionActionRequest {
                revision_id: head.revision_id.clone(),
            })),
        )
        .await
        .expect("merge-forward revision");
        assert!(merged.revision.version_name.starts_with("Merge "));

        let Json(candidate) = run_music_arrangement_revision_release_candidate(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicArrangementReleaseCandidateRequest {
                revision_id: head.revision_id.clone(),
                candidate_name: Some("Spring RC".to_string()),
            })),
        )
        .await
        .expect("nominate release candidate");
        assert_eq!(candidate.entry.candidate_name, "Spring RC");
        assert_eq!(candidate.entry.state, "candidate");

        let Json(locked) = run_music_arrangement_revision_lock(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicArrangementReleaseCandidateRequest {
                revision_id: head.revision_id.clone(),
                candidate_name: Some("Spring Lock".to_string()),
            })),
        )
        .await
        .expect("lock revision");
        assert_eq!(locked.entry.state, "locked");

        let Json(published) = run_music_arrangement_revision_publish(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicArrangementReleaseCandidateRequest {
                revision_id: head.revision_id.clone(),
                candidate_name: Some("Spring Publish".to_string()),
            })),
        )
        .await
        .expect("publish revision");
        assert_eq!(published.entry.state, "published");
        assert!(published.entry.release_manifest_relative_path.is_some());
        assert!(published.entry.immutable_handoff_relative_path.is_some());
        assert!(published.entry.release_approval_relative_path.is_some());
        assert!(published.entry.release_signoff_relative_path.is_some());
        assert!(published.entry.delivery_certificate_relative_path.is_some());
        assert!(published.entry.release_audit_trail_relative_path.is_some());
        assert!(published.entry.notarized_receipt_relative_path.is_some());
        assert!(published
            .entry
            .downstream_compliance_feed_relative_path
            .is_some());
        assert!(published.entry.compliance_ack_relative_path.is_some());
        assert!(published.entry.regulator_receipt_relative_path.is_some());
        assert!(published.entry.audit_timeline_relative_path.is_some());

        let Json(resp_after_publish) =
            run_music_delivery_dashboard(HeaderMap::new(), Path(run_id.to_string()))
                .await
                .expect("dashboard after publish");
        assert!(!resp_after_publish.arrangement_release_candidates.is_empty());
        assert_eq!(
            resp_after_publish
                .arrangement_locked_revision
                .as_ref()
                .map(|entry| entry.revision_id.clone()),
            Some(head.revision_id.clone())
        );
        assert_eq!(
            resp_after_publish
                .arrangement_published_revision
                .as_ref()
                .map(|entry| entry.revision_id.clone()),
            Some(head.revision_id.clone())
        );
        assert!(resp_after_publish.compliance_dashboard_lane.is_some());
        assert!(resp_after_publish.compliance_sla_clock.is_some());
        assert!(!resp_after_publish.compliance_exception_flags.is_empty());
        assert!(resp_after_publish.compliance_alert_routing.is_some());
        assert!(resp_after_publish.compliance_escalation_policy.is_some());
        assert!(!resp_after_publish.compliance_operator_actions.is_empty());
        assert!(resp_after_publish
            .package_browser
            .iter()
            .any(|item| item.category == "release" && item.relative_path.ends_with(".json")));
        assert!(resp_after_publish.package_browser.iter().any(|item| {
            item.category == "release" && item.label.to_lowercase().contains("certificate")
        }));
        assert!(resp_after_publish.package_browser.iter().any(|item| {
            item.category == "release" && item.label.to_lowercase().contains("notarized")
        }));
        assert!(resp_after_publish.package_browser.iter().any(|item| {
            item.category == "release" && item.label.to_lowercase().contains("compliance ack")
        }));
        assert!(resp_after_publish.package_browser.iter().any(|item| {
            item.category == "release" && item.label.to_lowercase().contains("regulator receipt")
        }));
        assert!(resp_after_publish.package_browser.iter().any(|item| {
            item.category == "release" && item.label.to_lowercase().contains("audit timeline")
        }));

        let Json(notify_action) = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "notify".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: None,
                target_team: Some("release-ops/oncall".to_string()),
                note: Some("test notify".to_string()),
                active_kid: None,
                secret_keyset: None,
                vendor: None,
                required_fields: None,
                optional_fields: None,
                field_defaults: None,
                reopen_reason: None,
                preset_name: None,
                scoped_permissions: None,
                actor_id: None,
                actor_name: None,
                actor_role: None,
                actor_directory: None,
                role_policy_name: None,
                approval_decision: None,
                approver_routing: None,
                required_signers: None,
                quorum_name: None,
            })),
        )
        .await
        .expect("notify action");
        assert_eq!(notify_action.status, "queued_notification");
        assert_eq!(
            notify_action.adapter_status.as_deref(),
            Some("queued_local_dispatch")
        );
        assert!(notify_action.adapter_result_path.is_some());

        let Json(ticket_action) = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "incident_ticket".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: None,
                target_team: None,
                note: Some("test ticket".to_string()),
                active_kid: None,
                secret_keyset: None,
                vendor: None,
                required_fields: None,
                optional_fields: None,
                field_defaults: None,
                reopen_reason: None,
                preset_name: None,
                scoped_permissions: None,
                actor_id: None,
                actor_name: None,
                actor_role: None,
                actor_directory: None,
                role_policy_name: None,
                approval_decision: None,
                approver_routing: None,
                required_signers: None,
                quorum_name: None,
            })),
        )
        .await
        .expect("incident ticket action");
        assert_eq!(ticket_action.status, "open");
        assert_eq!(ticket_action.adapter_status.as_deref(), Some("mapped"));
        assert!(ticket_action.adapter_result_path.is_some());

        let Json(backfill_action) = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "ack_backfill".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: published.entry.compliance_ack_relative_path.clone(),
                target_team: None,
                note: Some("test backfill".to_string()),
                active_kid: None,
                secret_keyset: None,
                vendor: None,
                required_fields: None,
                optional_fields: None,
                field_defaults: None,
                reopen_reason: None,
                preset_name: None,
                scoped_permissions: None,
                actor_id: None,
                actor_name: None,
                actor_role: None,
                actor_directory: None,
                role_policy_name: None,
                approval_decision: None,
                approver_routing: None,
                required_signers: None,
                quorum_name: None,
            })),
        )
        .await
        .expect("ack backfill action");
        assert_eq!(backfill_action.status, "backfilled");
        assert_eq!(
            backfill_action.adapter_status.as_deref(),
            Some("reconciled")
        );
        assert!(backfill_action.adapter_result_path.is_some());

        let Json(rotation_action) = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "rotate_secret".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: None,
                target_team: None,
                note: Some("test rotate".to_string()),
                active_kid: Some("kid-b".to_string()),
                secret_keyset: Some("kid-a:alpha,kid-b:beta".to_string()),
                vendor: None,
                required_fields: None,
                optional_fields: None,
                field_defaults: None,
                reopen_reason: None,
                preset_name: None,
                scoped_permissions: None,
                actor_id: None,
                actor_name: None,
                actor_role: None,
                actor_directory: None,
                role_policy_name: None,
                approval_decision: None,
                approver_routing: None,
                required_signers: None,
                quorum_name: None,
            })),
        )
        .await
        .expect("rotation action");
        assert_eq!(
            rotation_action.adapter_status.as_deref(),
            Some("rotation_updated")
        );

        let Json(registry_action) = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "update_ticket_registry".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: None,
                target_team: None,
                note: Some("test registry".to_string()),
                active_kid: None,
                secret_keyset: None,
                vendor: Some("jira".to_string()),
                required_fields: Some(vec!["summary".to_string(), "owner_team".to_string()]),
                optional_fields: Some(vec!["note".to_string()]),
                field_defaults: Some(serde_json::json!({"owner_team":"release-ops/compliance"})),
                reopen_reason: None,
                preset_name: None,
                scoped_permissions: None,
                actor_id: None,
                actor_name: None,
                actor_role: None,
                actor_directory: None,
                role_policy_name: None,
                approval_decision: None,
                approver_routing: None,
                required_signers: None,
                quorum_name: None,
            })),
        )
        .await
        .expect("registry action");
        assert_eq!(
            registry_action.adapter_status.as_deref(),
            Some("registry_updated")
        );

        let Json(reopen_action) = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "reopen_compliance".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: published.entry.compliance_ack_relative_path.clone(),
                target_team: None,
                note: Some("test reopen".to_string()),
                active_kid: None,
                secret_keyset: None,
                vendor: None,
                required_fields: None,
                optional_fields: None,
                field_defaults: None,
                reopen_reason: Some("manual_review_required".to_string()),
                preset_name: None,
                scoped_permissions: None,
                actor_id: None,
                actor_name: None,
                actor_role: None,
                actor_directory: None,
                role_policy_name: None,
                approval_decision: None,
                approver_routing: None,
                required_signers: None,
                quorum_name: None,
            })),
        )
        .await
        .expect("reopen action");
        assert_eq!(reopen_action.adapter_status.as_deref(), Some("reopened"));

        let Json(preset_action) = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "save_compliance_preset".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: None,
                target_team: None,
                note: Some("test preset".to_string()),
                active_kid: Some("kid-b".to_string()),
                secret_keyset: Some("kid-a:alpha,kid-b:beta".to_string()),
                vendor: Some("jira".to_string()),
                required_fields: Some(vec!["summary".to_string()]),
                optional_fields: Some(vec!["note".to_string()]),
                field_defaults: Some(serde_json::json!({"owner_team":"release-ops/compliance"})),
                reopen_reason: Some("manual_review_required".to_string()),
                preset_name: Some("ops-default".to_string()),
                scoped_permissions: Some(serde_json::json!({
                    "rotate_secret":"admin",
                    "update_ticket_registry":"editor",
                    "reopen_compliance":"operator"
                })),
                actor_id: None,
                actor_name: None,
                actor_role: None,
                actor_directory: None,
                role_policy_name: None,
                approval_decision: None,
                approver_routing: None,
                required_signers: None,
                quorum_name: None,
            })),
        )
        .await
        .expect("preset action");
        assert_eq!(
            preset_action.adapter_status.as_deref(),
            Some("preset_saved")
        );

        let Json(audit_action) = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "audit_compliance_action".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: None,
                target_team: None,
                note: Some("test audit".to_string()),
                active_kid: None,
                secret_keyset: None,
                vendor: None,
                required_fields: None,
                optional_fields: None,
                field_defaults: None,
                reopen_reason: None,
                preset_name: None,
                scoped_permissions: None,
                actor_id: None,
                actor_name: None,
                actor_role: None,
                actor_directory: None,
                role_policy_name: None,
                approval_decision: None,
                approver_routing: None,
                required_signers: None,
                quorum_name: None,
            })),
        )
        .await
        .expect("audit action");
        assert_eq!(audit_action.adapter_status.as_deref(), Some("audit_logged"));

        let Json(actor_directory_action) = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "save_actor_directory".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: None,
                target_team: None,
                note: Some("test actor directory".to_string()),
                active_kid: None,
                secret_keyset: None,
                vendor: None,
                required_fields: None,
                optional_fields: None,
                field_defaults: None,
                reopen_reason: None,
                preset_name: None,
                scoped_permissions: None,
                actor_id: Some("ops-admin".to_string()),
                actor_name: Some("Ops Admin".to_string()),
                actor_role: Some("admin".to_string()),
                actor_directory: Some(serde_json::json!([
                    {"actor_id":"ops-admin","actor_name":"Ops Admin","actor_role":"admin"},
                    {"actor_id":"release-editor","actor_name":"Release Editor","actor_role":"editor"},
                    {"actor_id":"operator-1","actor_name":"Operator One","actor_role":"operator"}
                ])),
                role_policy_name: None,
                approval_decision: None,
                approver_routing: None,
                required_signers: None,
                quorum_name: None,
            })),
        )
        .await
        .expect("actor directory action");
        assert_eq!(
            actor_directory_action.adapter_status.as_deref(),
            Some("actor_directory_saved")
        );

        let Json(role_policy_action) = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "save_role_policy_preset".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: None,
                target_team: None,
                note: Some("test role policy".to_string()),
                active_kid: None,
                secret_keyset: None,
                vendor: None,
                required_fields: None,
                optional_fields: None,
                field_defaults: None,
                reopen_reason: None,
                preset_name: None,
                scoped_permissions: Some(serde_json::json!({
                    "rotate_secret":"admin",
                    "update_ticket_registry":"editor",
                    "reopen_compliance":"operator"
                })),
                actor_id: Some("release-editor".to_string()),
                actor_name: Some("Release Editor".to_string()),
                actor_role: Some("editor".to_string()),
                actor_directory: None,
                role_policy_name: Some("release-ops-default".to_string()),
                approval_decision: None,
                approver_routing: None,
                required_signers: None,
                quorum_name: None,
            })),
        )
        .await
        .expect("role policy action");
        assert_eq!(
            role_policy_action.adapter_status.as_deref(),
            Some("role_policy_saved")
        );

        let Json(routing_action) = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "save_approver_routing".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: None,
                target_team: None,
                note: Some("test approver routing".to_string()),
                active_kid: None,
                secret_keyset: None,
                vendor: None,
                required_fields: None,
                optional_fields: None,
                field_defaults: None,
                reopen_reason: None,
                preset_name: None,
                scoped_permissions: None,
                actor_id: Some("release-editor".to_string()),
                actor_name: Some("Release Editor".to_string()),
                actor_role: Some("editor".to_string()),
                actor_directory: None,
                role_policy_name: None,
                approval_decision: None,
                approver_routing: Some(serde_json::json!([
                    {"step":"operator_review","required_role":"operator","team":"release-ops/compliance"},
                    {"step":"editor_review","required_role":"editor","team":"release-ops/editors"}
                ])),
                required_signers: None,
                quorum_name: None,
            })),
        )
        .await
        .expect("routing action");
        assert_eq!(
            routing_action.adapter_status.as_deref(),
            Some("approver_routing_saved")
        );

        let Json(required_signers_action) = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "save_required_signers".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: None,
                target_team: None,
                note: Some("test required signers".to_string()),
                active_kid: None,
                secret_keyset: None,
                vendor: None,
                required_fields: None,
                optional_fields: None,
                field_defaults: None,
                reopen_reason: None,
                preset_name: None,
                scoped_permissions: None,
                actor_id: Some("release-editor".to_string()),
                actor_name: Some("Release Editor".to_string()),
                actor_role: Some("editor".to_string()),
                actor_directory: None,
                role_policy_name: None,
                approval_decision: None,
                approver_routing: None,
                required_signers: Some(serde_json::json!(["operator", "editor"])),
                quorum_name: None,
            })),
        )
        .await
        .expect("required signers action");
        assert_eq!(
            required_signers_action.adapter_status.as_deref(),
            Some("required_signers_saved")
        );

        let Json(approval_action) = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "approve_compliance_action".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: None,
                target_team: None,
                note: Some("approved by operator".to_string()),
                active_kid: None,
                secret_keyset: None,
                vendor: None,
                required_fields: None,
                optional_fields: None,
                field_defaults: None,
                reopen_reason: None,
                preset_name: None,
                scoped_permissions: None,
                actor_id: Some("operator-1".to_string()),
                actor_name: Some("Operator One".to_string()),
                actor_role: Some("operator".to_string()),
                actor_directory: None,
                role_policy_name: None,
                approval_decision: Some("approved".to_string()),
                approver_routing: None,
                required_signers: None,
                quorum_name: None,
            })),
        )
        .await
        .expect("approval action");
        assert_eq!(
            approval_action.adapter_status.as_deref(),
            Some("approval_recorded")
        );

        let Json(editor_approval_action) = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "approve_compliance_action".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: None,
                target_team: None,
                note: Some("approved by editor".to_string()),
                active_kid: None,
                secret_keyset: None,
                vendor: None,
                required_fields: None,
                optional_fields: None,
                field_defaults: None,
                reopen_reason: None,
                preset_name: None,
                scoped_permissions: None,
                actor_id: Some("release-editor".to_string()),
                actor_name: Some("Release Editor".to_string()),
                actor_role: Some("editor".to_string()),
                actor_directory: None,
                role_policy_name: None,
                approval_decision: Some("approved".to_string()),
                approver_routing: None,
                required_signers: None,
                quorum_name: None,
            })),
        )
        .await
        .expect("editor approval action");
        assert_eq!(
            editor_approval_action.adapter_status.as_deref(),
            Some("approval_recorded")
        );

        let Json(quorum_action) = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "finalize_release_quorum".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: None,
                target_team: None,
                note: Some("quorum finalize".to_string()),
                active_kid: None,
                secret_keyset: None,
                vendor: None,
                required_fields: None,
                optional_fields: None,
                field_defaults: None,
                reopen_reason: None,
                preset_name: None,
                scoped_permissions: None,
                actor_id: Some("operator-1".to_string()),
                actor_name: Some("Operator One".to_string()),
                actor_role: Some("operator".to_string()),
                actor_directory: None,
                role_policy_name: None,
                approval_decision: None,
                approver_routing: None,
                required_signers: Some(serde_json::json!(["operator", "editor"])),
                quorum_name: Some("release-gate-v1".to_string()),
            })),
        )
        .await
        .expect("quorum action");
        assert_eq!(quorum_action.adapter_status.as_deref(), Some("quorum_met"));

        let Json(resp_after_ops) =
            run_music_delivery_dashboard(HeaderMap::new(), Path(run_id.to_string()))
                .await
                .expect("dashboard after compliance ops");
        assert!(resp_after_ops
            .package_browser
            .iter()
            .any(|item| item.category == "compliance_ops"));
        assert!(resp_after_ops.compliance_webhook_dispatch.is_some());
        assert!(resp_after_ops.compliance_ticket_mapping.is_some());
        assert!(resp_after_ops.compliance_ack_reconciliation.is_some());
        assert_eq!(
            resp_after_ops
                .compliance_webhook_dispatch
                .as_ref()
                .and_then(|value| value.get("auth_mode"))
                .and_then(|value| value.as_str()),
            Some("unsigned")
        );
        assert_eq!(
            resp_after_ops
                .compliance_webhook_dispatch
                .as_ref()
                .and_then(|value| value.get("rotation"))
                .and_then(|value| value.get("key_count"))
                .and_then(|value| value.as_u64()),
            Some(0)
        );
        assert!(resp_after_ops
            .compliance_ticket_mapping
            .as_ref()
            .and_then(|value| value.get("template_fields"))
            .is_some());
        assert_eq!(
            resp_after_ops
                .compliance_rotation_control
                .as_ref()
                .and_then(|value| value.get("active_kid"))
                .and_then(|value| value.as_str()),
            Some("kid-b")
        );
        assert_eq!(
            resp_after_ops
                .compliance_rotation_control
                .as_ref()
                .and_then(|value| value.get("key_count"))
                .and_then(|value| value.as_u64()),
            Some(2)
        );
        assert_eq!(
            resp_after_ops
                .compliance_vendor_registry
                .as_ref()
                .and_then(|value| value.get("vendor"))
                .and_then(|value| value.as_str()),
            Some("jira")
        );
        assert!(resp_after_ops
            .compliance_ticket_mapping
            .as_ref()
            .and_then(|value| value.get("field_registry"))
            .is_some());
        assert_eq!(
            resp_after_ops
                .compliance_ack_reconciliation
                .as_ref()
                .and_then(|value| value.get("closing_state"))
                .and_then(|value| value.as_str()),
            Some("auto_closed")
        );
        assert_eq!(
            resp_after_ops
                .compliance_ack_reconciliation
                .as_ref()
                .and_then(|value| value.get("reopen_state"))
                .and_then(|value| value.as_str()),
            Some("reopened")
        );
        assert_eq!(
            resp_after_ops
                .compliance_reopen_control
                .as_ref()
                .and_then(|value| value.get("reopen_reason"))
                .and_then(|value| value.as_str()),
            Some("manual_review_required")
        );
        assert_eq!(
            resp_after_ops
                .compliance_preset_control
                .as_ref()
                .and_then(|value| value.get("preset_name"))
                .and_then(|value| value.as_str()),
            Some("ops-default")
        );
        assert!(resp_after_ops.compliance_audit_log.is_some());
        assert_eq!(
            resp_after_ops
                .compliance_scoped_permissions
                .get("rotate_secret")
                .and_then(|value| value.as_str()),
            Some("admin")
        );
        assert!(resp_after_ops.compliance_actor_identity.is_some());
        assert!(resp_after_ops.compliance_permission_check.is_some());
        assert!(resp_after_ops.compliance_audit_signature.is_some());
        assert!(resp_after_ops.compliance_actor_directory.is_some());
        assert_eq!(
            resp_after_ops
                .compliance_actor_directory
                .as_ref()
                .and_then(|value| value.get("directory"))
                .and_then(|value| value.as_array())
                .map(|items| items.len()),
            Some(3)
        );
        assert_eq!(
            resp_after_ops
                .compliance_role_policy_presets
                .as_array()
                .and_then(|items| items.first())
                .and_then(|value| value.get("preset_name"))
                .and_then(|value| value.as_str()),
            Some("release-ops-default")
        );
        assert_eq!(
            resp_after_ops
                .compliance_approval_chain
                .as_ref()
                .and_then(|value| value.get("approval_decision"))
                .and_then(|value| value.as_str()),
            Some("approved")
        );
        assert_eq!(
            resp_after_ops
                .compliance_release_quorum
                .as_ref()
                .and_then(|value| value.get("quorum_met"))
                .and_then(|value| value.as_bool()),
            Some(true)
        );
        assert_eq!(
            resp_after_ops
                .compliance_locked_publish_gate
                .as_ref()
                .and_then(|value| value.get("gate_state"))
                .and_then(|value| value.as_str()),
            Some("unlocked")
        );
        assert_eq!(
            resp_after_ops
                .compliance_release_unblock_token
                .as_ref()
                .and_then(|value| value.get("status"))
                .and_then(|value| value.as_str()),
            Some("issued")
        );
        assert_eq!(
            resp_after_ops
                .compliance_immutable_publish_authorization
                .as_ref()
                .and_then(|value| value.get("authorization_state"))
                .and_then(|value| value.as_str()),
            Some("authorized")
        );
        assert_eq!(
            resp_after_ops
                .compliance_approval_chain
                .as_ref()
                .and_then(|value| value.get("signed_approvers"))
                .and_then(|value| value.as_array())
                .map(|items| items.len()),
            Some(2)
        );

        let denied = run_music_compliance_action(
            HeaderMap::new(),
            Path(run_id.to_string()),
            Ok(Json(RunMusicComplianceActionRequest {
                action: "rotate_secret".to_string(),
                candidate_id: published.entry.candidate_id.clone().into(),
                target_path: None,
                target_team: None,
                note: Some("denied rotate".to_string()),
                active_kid: Some("kid-c".to_string()),
                secret_keyset: Some("kid-c:gamma".to_string()),
                vendor: None,
                required_fields: None,
                optional_fields: None,
                field_defaults: None,
                reopen_reason: None,
                preset_name: None,
                scoped_permissions: Some(serde_json::json!({
                    "rotate_secret":"admin",
                    "update_ticket_registry":"editor",
                    "reopen_compliance":"operator"
                })),
                actor_id: Some("viewer-1".to_string()),
                actor_name: Some("Viewer".to_string()),
                actor_role: Some("viewer".to_string()),
                actor_directory: None,
                role_policy_name: None,
                approval_decision: None,
                approver_routing: None,
                required_signers: None,
                quorum_name: None,
            })),
        )
        .await;
        assert!(denied.is_err());

        let Json(resp_after_denied) =
            run_music_delivery_dashboard(HeaderMap::new(), Path(run_id.to_string()))
                .await
                .expect("dashboard after denied compliance op");
        assert_eq!(
            resp_after_denied
                .compliance_permission_check
                .as_ref()
                .and_then(|value| value.get("allowed"))
                .and_then(|value| value.as_bool()),
            Some(false)
        );
        assert_eq!(
            resp_after_denied
                .compliance_actor_identity
                .as_ref()
                .and_then(|value| value.get("actor_identity"))
                .and_then(|value| value.get("actor_role"))
                .and_then(|value| value.as_str()),
            Some("viewer")
        );
    }
}
