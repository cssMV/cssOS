//! DB accessors for the `engine_credentials` table.
//!
//! All rows carry the ciphertext produced by `crypto::encrypt` — plaintext
//! never reaches the pool. The four normal operations:
//!   - `upsert`  — insert or replace (user, engine) — used by POST/PUT from
//!                 the settings UI.
//!   - `get`     — fetch an active row so we can decrypt and inject the key
//!                 into an outbound request. Returns None when the user has
//!                 no active credential, or the row is revoked/invalid.
//!   - `list`    — every active row for a user, for the settings UI
//!                 (no plaintext leaks — we only expose suffix + metadata).
//!   - `revoke`  — soft-delete by flipping status to `revoked`. Kept as an
//!                 audit trail; a subsequent upsert re-activates via the
//!                 partial-unique index (active rows are unique per (user,
//!                 engine), revoked rows don't collide).
//!
//! `mark_validated` and `mark_invalid` are narrow helpers used by the
//! whoami/test round-trip so we remember which keys are currently live.

use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct EngineCredentialRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub engine_key: String,
    pub encrypted_key: Vec<u8>,
    pub key_suffix: String,
    pub status: String,
    pub last_validated_at: Option<DateTime<Utc>>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Insert or replace the (user, engine) credential. If an active row already
/// exists we overwrite it; revoked rows stay as-is (history) while a new
/// active row is inserted.
pub async fn upsert(
    pool: &PgPool,
    user_id: Uuid,
    engine_key: &str,
    encrypted_key: &[u8],
    key_suffix: &str,
) -> Result<EngineCredentialRow, sqlx::Error> {
    // Revoke any lingering active row first, then insert fresh. This keeps
    // the partial-unique index happy without an ON CONFLICT clause that
    // would break under the `WHERE status <> 'revoked'` predicate.
    sqlx::query(
        "UPDATE engine_credentials SET status = 'revoked', updated_at = now() \
         WHERE user_id = $1 AND engine_key = $2 AND status <> 'revoked'",
    )
    .bind(user_id)
    .bind(engine_key)
    .execute(pool)
    .await?;

    let row = sqlx::query(
        "INSERT INTO engine_credentials \
           (user_id, engine_key, encrypted_key, key_suffix, status) \
         VALUES ($1, $2, $3, $4, 'active') \
         RETURNING id, user_id, engine_key, encrypted_key, key_suffix, status, \
                   last_validated_at, last_used_at, created_at, updated_at",
    )
    .bind(user_id)
    .bind(engine_key)
    .bind(encrypted_key)
    .bind(key_suffix)
    .fetch_one(pool)
    .await?;

    Ok(row_to_credential(&row))
}

/// Fetch the active credential (if any) for a given (user, engine).
pub async fn get(
    pool: &PgPool,
    user_id: Uuid,
    engine_key: &str,
) -> Result<Option<EngineCredentialRow>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT id, user_id, engine_key, encrypted_key, key_suffix, status, \
                last_validated_at, last_used_at, created_at, updated_at \
         FROM engine_credentials \
         WHERE user_id = $1 AND engine_key = $2 AND status = 'active' \
         ORDER BY updated_at DESC LIMIT 1",
    )
    .bind(user_id)
    .bind(engine_key)
    .fetch_optional(pool)
    .await?;
    Ok(row.as_ref().map(row_to_credential))
}

/// List every active credential for the user, for the Settings UI. Ciphertext
/// is included so the caller can quickly check key_suffix; it never leaves
/// the server as-is.
pub async fn list(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<EngineCredentialRow>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, user_id, engine_key, encrypted_key, key_suffix, status, \
                last_validated_at, last_used_at, created_at, updated_at \
         FROM engine_credentials \
         WHERE user_id = $1 AND status = 'active' \
         ORDER BY engine_key ASC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.iter().map(row_to_credential).collect())
}

/// Soft-delete: flip status to 'revoked'. Returns true iff a row was touched.
pub async fn revoke(
    pool: &PgPool,
    user_id: Uuid,
    engine_key: &str,
) -> Result<bool, sqlx::Error> {
    let res = sqlx::query(
        "UPDATE engine_credentials SET status = 'revoked', updated_at = now() \
         WHERE user_id = $1 AND engine_key = $2 AND status = 'active'",
    )
    .bind(user_id)
    .bind(engine_key)
    .execute(pool)
    .await?;
    Ok(res.rows_affected() > 0)
}

/// Stamp `last_validated_at` + flip status to 'active'. Called after a
/// successful whoami() round-trip.
pub async fn mark_validated(
    pool: &PgPool,
    id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE engine_credentials SET status = 'active', \
                last_validated_at = now(), updated_at = now() WHERE id = $1",
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Flip status to 'invalid' (keeps row for history; dispatch falls back to
/// platform key or fails closed depending on policy).
pub async fn mark_invalid(
    pool: &PgPool,
    id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE engine_credentials SET status = 'invalid', updated_at = now() \
         WHERE id = $1",
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Stamp `last_used_at`. Called from the dispatch fork after we successfully
/// use the user's key for a request — lets the settings UI show "last used
/// 5 minutes ago" without a second round-trip.
pub async fn mark_used(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE engine_credentials SET last_used_at = now(), updated_at = now() \
         WHERE id = $1",
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

fn row_to_credential(row: &sqlx::postgres::PgRow) -> EngineCredentialRow {
    EngineCredentialRow {
        id: row.get("id"),
        user_id: row.get("user_id"),
        engine_key: row.get("engine_key"),
        encrypted_key: row.get("encrypted_key"),
        key_suffix: row.get("key_suffix"),
        status: row.get("status"),
        last_validated_at: row.get("last_validated_at"),
        last_used_at: row.get("last_used_at"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}
