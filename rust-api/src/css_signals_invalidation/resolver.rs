use crate::css_signals_invalidation::types::{
    InvalidationEventKind, InvalidationSubjectKind, InvalidationTarget, SignalsInvalidationEvent,
};
use std::collections::HashSet;

fn dedup_targets(targets: Vec<InvalidationTarget>) -> Vec<InvalidationTarget> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();

    for target in targets {
        let key = (target.subject_kind.clone(), target.subject_id.clone());
        if seen.insert(key) {
            out.push(target);
        }
    }

    out
}

pub async fn resolve_user_related_targets(
    pool: &sqlx::PgPool,
    user_id: &str,
) -> anyhow::Result<Vec<InvalidationTarget>> {
    let mut targets = vec![InvalidationTarget {
        subject_kind: InvalidationSubjectKind::User,
        subject_id: user_id.to_string(),
    }];

    let catalogs =
        crate::css_catalog_engine::store_pg::list_catalogs_by_owner_user_id(pool, user_id)
            .await
            .unwrap_or_default();
    for catalog in catalogs {
        targets.push(InvalidationTarget {
            subject_kind: InvalidationSubjectKind::Catalog,
            subject_id: catalog.catalog_id,
        });
    }

    let ownerships =
        crate::css_ownership_engine::store_pg::list_ownerships_by_owner_user_id(pool, user_id)
            .await
            .unwrap_or_default();
    for ownership in ownerships {
        targets.push(InvalidationTarget {
            subject_kind: InvalidationSubjectKind::Ownership,
            subject_id: ownership.ownership_id,
        });
    }

    Ok(dedup_targets(targets))
}

pub async fn resolve_targets(
    pool: &sqlx::PgPool,
    event: &SignalsInvalidationEvent,
) -> anyhow::Result<Vec<InvalidationTarget>> {
    let mut targets = Vec::new();

    match event.event_kind {
        InvalidationEventKind::CreditChanged
        | InvalidationEventKind::PenaltyActivated
        | InvalidationEventKind::PenaltyReleased
        | InvalidationEventKind::ModerationChanged => {
            if let Some(user_id) = &event.user_id {
                targets.extend(resolve_user_related_targets(pool, user_id).await?);
            }
        }
        InvalidationEventKind::DisputeOpened
        | InvalidationEventKind::DisputeResolved
        | InvalidationEventKind::ReviewOpened
        | InvalidationEventKind::ReviewClosed => {
            if let Some(user_id) = &event.user_id {
                targets.extend(resolve_user_related_targets(pool, user_id).await?);
            }
            if let Some(catalog_id) = &event.catalog_id {
                targets.push(InvalidationTarget {
                    subject_kind: InvalidationSubjectKind::Catalog,
                    subject_id: catalog_id.clone(),
                });
            }
            if let Some(deal_id) = &event.deal_id {
                targets.push(InvalidationTarget {
                    subject_kind: InvalidationSubjectKind::Deal,
                    subject_id: deal_id.clone(),
                });
            }
            if let Some(ownership_id) = &event.ownership_id {
                targets.push(InvalidationTarget {
                    subject_kind: InvalidationSubjectKind::Ownership,
                    subject_id: ownership_id.clone(),
                });
            }
        }
        InvalidationEventKind::DealStatusChanged => {
            if let Some(deal_id) = &event.deal_id {
                targets.push(InvalidationTarget {
                    subject_kind: InvalidationSubjectKind::Deal,
                    subject_id: deal_id.clone(),
                });
            }
        }
        InvalidationEventKind::OwnershipChanged => {
            if let Some(ownership_id) = &event.ownership_id {
                targets.push(InvalidationTarget {
                    subject_kind: InvalidationSubjectKind::Ownership,
                    subject_id: ownership_id.clone(),
                });
            }
            if let Some(user_id) = &event.user_id {
                targets.extend(resolve_user_related_targets(pool, user_id).await?);
            }
        }
    }

    Ok(dedup_targets(targets))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v183_dedup_targets_keeps_unique_subjects() {
        let input = vec![
            InvalidationTarget {
                subject_kind: InvalidationSubjectKind::User,
                subject_id: "u1".into(),
            },
            InvalidationTarget {
                subject_kind: InvalidationSubjectKind::User,
                subject_id: "u1".into(),
            },
            InvalidationTarget {
                subject_kind: InvalidationSubjectKind::Catalog,
                subject_id: "c1".into(),
            },
        ];

        let out = dedup_targets(input);
        assert_eq!(out.len(), 2);
    }
}
