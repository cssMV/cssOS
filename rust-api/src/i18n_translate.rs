// CSSOS_PHASE2_I18N_MVP 20260418 — LLM-backed i18n runtime translation.
//
// Endpoint: POST /api/i18n/translate
//   Request:  { "locale": "ko", "sources": ["Sign in", "Open Watch", ...],
//               "context": "optional UI context hint" }
//   Response: { "locale": "ko",
//               "translations": [{
//                   "source": "...",
//                   "hash": "...",
//                   "translated": "...",
//                   "cached": true|false
//               }, ...]
//             }
//
// Architecture: english-source is the single source of truth. For any locale
// other than "en", we look up cached translations keyed by
// `(hash(source), locale)` in two tiers:
//   1. In-memory LRU (shared across requests inside one Rust process).
//   2. Postgres `i18n_translations` (shared across all processes + restarts).
// On full miss, we batch-call OpenAI/Anthropic once per request with the
// entire missing set, persist results to both tiers, and return.
//
// Placeholders like `{name}`, `{count}`, `<b>`, `%s` are instructed to pass
// through verbatim. Brand glossary ("CSSOS", "Watch panel"...) is appended to
// the system prompt.
//
// Auth: does NOT require sign-in. UI copy translation is a public good and
// batching dedupes hot strings across all users, so rate-limiting + global
// caching keeps cost bounded without forcing auth on every visitor.

use std::collections::HashMap;
use std::sync::Arc;

use axum::{extract::State, http::StatusCode, routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use tokio::sync::RwLock;

use crate::llm::{generate_chat, ChatRequest};
use crate::routes::AppState;

const MAX_SOURCES_PER_REQUEST: usize = 200;
const MAX_SOURCE_LENGTH: usize = 4000;
const DEFAULT_ENGINE: &str = "openai";
const DEFAULT_MODEL: &str = "gpt-4o-mini";
const DEFAULT_MAX_TOKENS: u32 = 4096;

pub type MemoryCache = Arc<RwLock<HashMap<(String, String), String>>>;

pub fn memory_cache() -> MemoryCache {
    Arc::new(RwLock::new(HashMap::new()))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/i18n/translate", post(translate_handler))
}

#[derive(Debug, Deserialize)]
pub struct TranslateRequest {
    pub locale: String,
    pub sources: Vec<String>,
    #[serde(default)]
    pub context: Option<String>,
    #[serde(default)]
    pub engine: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub glossary: Option<Vec<GlossaryEntry>>,
}

#[derive(Debug, Deserialize)]
pub struct GlossaryEntry {
    pub term: String,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TranslateResponse {
    pub ok: bool,
    pub locale: String,
    pub translations: Vec<TranslationItem>,
}

#[derive(Debug, Serialize)]
pub struct TranslationItem {
    pub source: String,
    pub hash: String,
    pub translated: String,
    pub cached: bool,
}

pub fn hash_source(source: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(source.as_bytes());
    let digest = hasher.finalize();
    format!("{:x}", digest)
}

fn normalize_locale(raw: &str) -> String {
    raw.trim().to_ascii_lowercase()
}

fn iso_to_human(code: &str) -> &'static str {
    match code.to_ascii_lowercase().as_str() {
        "zh" | "zh-cn" | "zh-hans" => "Simplified Chinese",
        "zh-tw" | "zh-hant" => "Traditional Chinese",
        "ja" | "jp" => "Japanese",
        "ko" | "kr" => "Korean",
        "en" | "en-us" | "en-gb" => "English",
        "es" => "Spanish",
        "fr" => "French",
        "de" => "German",
        "pt" | "pt-br" => "Portuguese",
        "ru" => "Russian",
        "it" => "Italian",
        "ar" => "Arabic",
        "hi" => "Hindi",
        "id" => "Indonesian",
        "th" => "Thai",
        "tr" => "Turkish",
        "vi" => "Vietnamese",
        "nl" => "Dutch",
        "pl" => "Polish",
        "sv" => "Swedish",
        "uk" => "Ukrainian",
        _ => "",
    }
}

async fn translate_handler(
    State(app): State<AppState>,
    Json(body): Json<TranslateRequest>,
) -> Result<Json<TranslateResponse>, (StatusCode, Json<serde_json::Value>)> {
    let locale = normalize_locale(&body.locale);
    if locale.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"ok": false, "error": "missing_locale"})),
        ));
    }
    if body.sources.is_empty() {
        return Ok(Json(TranslateResponse {
            ok: true,
            locale,
            translations: Vec::new(),
        }));
    }
    if body.sources.len() > MAX_SOURCES_PER_REQUEST {
        return Err((
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(json!({
                "ok": false,
                "error": "too_many_sources",
                "limit": MAX_SOURCES_PER_REQUEST,
            })),
        ));
    }

    // Short-circuit: if locale == "en" we are the source-of-truth. Return
    // identity mappings so clients don't accidentally round-trip English.
    if locale == "en" || locale == "en-us" || locale == "en-gb" {
        let items = body
            .sources
            .iter()
            .map(|s| TranslationItem {
                hash: hash_source(s),
                source: s.clone(),
                translated: s.clone(),
                cached: true,
            })
            .collect();
        return Ok(Json(TranslateResponse {
            ok: true,
            locale,
            translations: items,
        }));
    }

    // Collect unique (hash, source) pairs. If the caller sends duplicates we
    // still only translate each once.
    let mut seen: HashMap<String, String> = HashMap::new();
    let mut order: Vec<(String, String)> = Vec::with_capacity(body.sources.len());
    for source in body.sources.iter() {
        if source.len() > MAX_SOURCE_LENGTH {
            return Err((
                StatusCode::PAYLOAD_TOO_LARGE,
                Json(json!({
                    "ok": false,
                    "error": "source_too_long",
                    "limit": MAX_SOURCE_LENGTH,
                })),
            ));
        }
        let h = hash_source(source);
        order.push((h.clone(), source.clone()));
        seen.entry(h).or_insert_with(|| source.clone());
    }

    // Lookup in the two-tier cache.
    let cache = app.i18n_cache.clone();
    let mut resolved: HashMap<String, (String, bool)> = HashMap::new();
    let mut missing: Vec<(String, String)> = Vec::new();

    {
        let guard = cache.read().await;
        for (h, src) in seen.iter() {
            let key = (h.clone(), locale.clone());
            if let Some(translated) = guard.get(&key) {
                resolved.insert(h.clone(), (translated.clone(), true));
            } else {
                missing.push((h.clone(), src.clone()));
            }
        }
    }

    if !missing.is_empty() {
        let hashes: Vec<String> = missing.iter().map(|(h, _)| h.clone()).collect();
        let db_rows = load_from_db(&app.pool, &locale, &hashes).await.map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "ok": false,
                    "error": "i18n_cache_read_failed",
                    "detail": e.to_string(),
                })),
            )
        })?;
        let mut cache_w = cache.write().await;
        missing.retain(|(h, _)| match db_rows.get(h) {
            Some(v) => {
                cache_w.insert((h.clone(), locale.clone()), v.clone());
                resolved.insert(h.clone(), (v.clone(), true));
                false
            }
            None => true,
        });
    }

    // Remaining misses → LLM.
    if !missing.is_empty() {
        let engine = body.engine.clone().unwrap_or_else(|| DEFAULT_ENGINE.into());
        let model = body.model.clone().unwrap_or_else(|| DEFAULT_MODEL.into());
        let translations = call_llm(
            &engine,
            &model,
            &locale,
            &missing,
            body.context.as_deref(),
            body.glossary.as_deref(),
        )
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({
                    "ok": false,
                    "error": "llm_translate_failed",
                    "detail": e,
                })),
            )
        })?;

        // Persist everything the model returned. If the model skipped some
        // entries we keep those unresolved and the caller will see the
        // English source as fallback (see identity-write below).
        let mut cache_w = cache.write().await;
        for (h, src) in missing.iter() {
            let translated = translations.get(h).cloned().unwrap_or_else(|| src.clone());
            let _ = upsert_db(
                &app.pool,
                h,
                &locale,
                src,
                &translated,
                body.context.as_deref(),
                &engine,
                &model,
            )
            .await;
            cache_w.insert((h.clone(), locale.clone()), translated.clone());
            resolved.insert(h.clone(), (translated, false));
        }
    }

    // Rehydrate the response in caller-supplied order.
    let items: Vec<TranslationItem> = order
        .into_iter()
        .map(|(h, src)| {
            let (translated, cached) = resolved
                .get(&h)
                .cloned()
                .unwrap_or_else(|| (src.clone(), false));
            TranslationItem {
                source: src,
                hash: h,
                translated,
                cached,
            }
        })
        .collect();

    Ok(Json(TranslateResponse {
        ok: true,
        locale,
        translations: items,
    }))
}

async fn load_from_db(
    pool: &PgPool,
    locale: &str,
    hashes: &[String],
) -> Result<HashMap<String, String>, sqlx::Error> {
    if hashes.is_empty() {
        return Ok(HashMap::new());
    }
    let hashes_vec: Vec<String> = hashes.to_vec();
    let rows = sqlx::query(
        r#"
        SELECT english_hash, translated_text
          FROM i18n_translations
         WHERE locale = $1
           AND english_hash = ANY($2)
        "#,
    )
    .bind(locale)
    .bind(hashes_vec)
    .fetch_all(pool)
    .await?;
    use sqlx::Row;
    let mut out = HashMap::with_capacity(rows.len());
    for row in rows {
        let h: String = row.try_get("english_hash")?;
        let t: String = row.try_get("translated_text")?;
        out.insert(h, t);
    }
    Ok(out)
}

#[allow(clippy::too_many_arguments)]
async fn upsert_db(
    pool: &PgPool,
    hash: &str,
    locale: &str,
    source: &str,
    translated: &str,
    context: Option<&str>,
    provider: &str,
    model: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO i18n_translations
            (english_hash, locale, english_source, translated_text,
             context, provider, model, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
        ON CONFLICT (english_hash, locale)
        DO UPDATE SET
            translated_text = EXCLUDED.translated_text,
            context = EXCLUDED.context,
            provider = EXCLUDED.provider,
            model = EXCLUDED.model,
            updated_at = now()
        "#,
    )
    .bind(hash)
    .bind(locale)
    .bind(source)
    .bind(translated)
    .bind(context)
    .bind(provider)
    .bind(model)
    .execute(pool)
    .await
    .map(|_| ())
}

async fn call_llm(
    engine: &str,
    model: &str,
    locale: &str,
    missing: &[(String, String)],
    context: Option<&str>,
    glossary: Option<&[GlossaryEntry]>,
) -> Result<HashMap<String, String>, String> {
    let human = {
        let h = iso_to_human(locale);
        if h.is_empty() {
            locale.to_string()
        } else {
            format!("{} ({})", h, locale)
        }
    };

    let mut system = String::new();
    system.push_str(
        "You are a professional UI localization engine. Translate the provided \
         English source strings into the target language. Output JSON only.\n\n\
         Rules:\n\
         1. Preserve ALL placeholder tokens exactly as they appear. Placeholders \
         include `{name}`, `{count}`, `{0}`, `%s`, `%d`, `<b>`, `</b>`, HTML tags, \
         and Markdown tokens. Do NOT translate, reorder, or remove them.\n\
         2. Preserve product names and brand terms exactly. CSSOS, Watch panel, \
         Dock, MV, are brand terms — do NOT translate unless the glossary says so.\n\
         3. Keep the translation concise and natural for UI copy — prefer short, \
         idiomatic phrasing over literal translation.\n\
         4. Punctuation: use the target language's conventional punctuation (e.g. \
         full-width for CJK).\n\
         5. If a source string is already in the target language, repeat it \
         verbatim.\n\
         6. Return a JSON object: `{ \"translations\": [{\"hash\": \"...\", \
         \"translated\": \"...\"}, ...] }` in the same order as input.",
    );
    system.push_str(&format!("\n\nTarget language: {}.", human));
    if let Some(ctx) = context {
        if !ctx.trim().is_empty() {
            system.push_str(&format!("\nUI context hint: {}", ctx.trim()));
        }
    }
    if let Some(g) = glossary {
        if !g.is_empty() {
            system.push_str("\nGlossary:");
            for entry in g.iter().take(50) {
                if let Some(note) = entry.note.as_deref() {
                    system.push_str(&format!("\n  - {}: {}", entry.term, note));
                } else {
                    system.push_str(&format!("\n  - {}", entry.term));
                }
            }
        }
    }

    let mut user = String::new();
    user.push_str("Translate the following UI strings. Return JSON only.\n\n");
    user.push_str("Input JSON:\n");
    let input_array: Vec<serde_json::Value> = missing
        .iter()
        .map(|(h, src)| {
            json!({
                "hash": h,
                "source": src,
            })
        })
        .collect();
    user.push_str(
        &serde_json::to_string_pretty(&json!({ "sources": input_array }))
            .unwrap_or_else(|_| "[]".to_string()),
    );

    let req = ChatRequest {
        model: model.to_string(),
        system: Some(system),
        user,
        max_tokens: DEFAULT_MAX_TOKENS,
        temperature: Some(0.2),
    };

    let result = generate_chat(engine, &req)
        .await
        .map_err(|e| format!("{}", e))?;

    // The LLM is instructed to return a JSON object with a translations array.
    // Try to extract it robustly: model may occasionally wrap with ```json ```.
    let cleaned = strip_code_fences(&result.text);
    let parsed: serde_json::Value =
        serde_json::from_str(&cleaned).map_err(|e| format!("parse_json_failed: {}", e))?;
    let arr = parsed
        .get("translations")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "missing 'translations' array".to_string())?;
    let mut out = HashMap::with_capacity(arr.len());
    for item in arr.iter() {
        let h = item.get("hash").and_then(|v| v.as_str()).unwrap_or("");
        let t = item.get("translated").and_then(|v| v.as_str()).unwrap_or("");
        if !h.is_empty() && !t.is_empty() {
            out.insert(h.to_string(), t.to_string());
        }
    }
    Ok(out)
}

fn strip_code_fences(s: &str) -> String {
    let trimmed = s.trim();
    if let Some(stripped) = trimmed.strip_prefix("```json") {
        return stripped.trim_start_matches('\n').trim_end_matches("```").trim().to_string();
    }
    if let Some(stripped) = trimmed.strip_prefix("```") {
        return stripped.trim_start_matches('\n').trim_end_matches("```").trim().to_string();
    }
    trimmed.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_is_deterministic() {
        assert_eq!(hash_source("Sign in"), hash_source("Sign in"));
        assert_ne!(hash_source("Sign in"), hash_source("Sign In"));
    }

    #[test]
    fn iso_maps_common_locales() {
        assert_eq!(iso_to_human("ko"), "Korean");
        assert_eq!(iso_to_human("ja"), "Japanese");
        assert_eq!(iso_to_human("ZH"), "Simplified Chinese");
    }

    #[test]
    fn strip_fences_handles_plain_and_fenced() {
        assert_eq!(strip_code_fences("{\"a\":1}"), "{\"a\":1}");
        assert_eq!(
            strip_code_fences("```json\n{\"a\":1}\n```"),
            "{\"a\":1}"
        );
    }
}
