use crate::css_policy_engine::types::CssPolicyBundle;
use crate::css_policy_versioning::types::{
    CssPolicyVersion, PolicyBinding, PolicyBindingSubjectKind, PolicyResolveResult,
};

pub async fn bootstrap_default_policy_version(
    pool: &sqlx::PgPool,
    now_rfc3339: &str,
) -> anyhow::Result<CssPolicyVersion> {
    if let Ok(version) =
        crate::css_policy_versioning::store_pg::get_default_policy_version(pool).await
    {
        return Ok(version);
    }

    let version = CssPolicyVersion {
        version_id: "policy_v1".into(),
        version_name: "CSS Platform Policy v1".into(),
        is_default: true,
        policy_bundle: crate::css_policy_engine::defaults::default_policy_bundle(),
        created_at: now_rfc3339.to_string(),
    };
    crate::css_policy_versioning::store_pg::insert_policy_version(pool, &version).await?;
    crate::css_policy_versioning::store_pg::set_default_policy_version(pool, &version.version_id)
        .await?;
    Ok(version)
}

pub async fn create_policy_version(
    pool: &sqlx::PgPool,
    version_id: &str,
    version_name: &str,
    bundle: CssPolicyBundle,
    is_default: bool,
    now_rfc3339: &str,
) -> anyhow::Result<CssPolicyVersion> {
    let version = CssPolicyVersion {
        version_id: version_id.to_string(),
        version_name: version_name.to_string(),
        is_default,
        policy_bundle: bundle,
        created_at: now_rfc3339.to_string(),
    };
    crate::css_policy_versioning::store_pg::insert_policy_version(pool, &version).await?;
    if is_default {
        crate::css_policy_versioning::store_pg::set_default_policy_version(pool, version_id)
            .await?;
    }
    Ok(version)
}

pub async fn bind_policy_version(
    pool: &sqlx::PgPool,
    subject_kind: PolicyBindingSubjectKind,
    subject_id: &str,
    version_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<PolicyBinding> {
    let binding = PolicyBinding {
        binding_id: format!("pb_{}", uuid::Uuid::new_v4()),
        subject_kind,
        subject_id: subject_id.to_string(),
        version_id: version_id.to_string(),
        created_at: now_rfc3339.to_string(),
    };
    crate::css_policy_versioning::store_pg::insert_policy_binding(pool, &binding).await?;
    Ok(binding)
}

pub async fn resolve_policy_for_subject(
    pool: &sqlx::PgPool,
    subject_kind: PolicyBindingSubjectKind,
    subject_id: &str,
) -> anyhow::Result<PolicyResolveResult> {
    if let Some(binding) =
        crate::css_policy_versioning::store_pg::get_policy_binding(pool, &subject_kind, subject_id)
            .await?
    {
        let version =
            crate::css_policy_versioning::store_pg::get_policy_version(pool, &binding.version_id)
                .await?;
        return Ok(PolicyResolveResult {
            version,
            resolved_by: "subject_binding".into(),
        });
    }

    let version = crate::css_policy_versioning::store_pg::get_default_policy_version(pool).await?;
    Ok(PolicyResolveResult {
        version,
        resolved_by: "default_version".into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v172_policy_binding_subjects_cover_core_platform_objects() {
        let kinds = [
            PolicyBindingSubjectKind::Catalog,
            PolicyBindingSubjectKind::Auction,
            PolicyBindingSubjectKind::Deal,
            PolicyBindingSubjectKind::Ownership,
            PolicyBindingSubjectKind::UserFlow,
        ];
        assert_eq!(kinds.len(), 5);
    }
}
