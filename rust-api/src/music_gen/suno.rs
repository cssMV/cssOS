// CSSOS_PHASE2_SUNO 20260419 — Suno v5 HTTP adapter (single-shot MVP).
//
// CSSOS_PHASE2_KIE_PIVOT 20260429 #204 — Jing
// We pivoted from `sunoapi.org` to `kie.ai` (login was unstable on
// sunoapi.org; kie.ai accepts the same `/api/v1/generate` schema and
// gives reliable access on the user's Suno Premier balance via residential
// IP egress). Both gateways speak the same shape, so the adapter is
// gateway-agnostic — only the env vars change. kie.ai REQUIRES a
// `callBackUrl` field in the submit body (sunoapi.org tolerates it),
// so we always emit one. Polling at `/record-info` works the same;
// the callback is just metadata for kie.ai's own logging.
//
// Per Jing 20260419 we target the `kie.ai` gateway (docs at
// https://docs.kie.ai, API base `https://api.kie.ai`). It's the most
// reliable publicly documented way to hit Suno v5 from a server — the raw
// `studio-api.suno.ai` / `api.suno.ai` endpoints are cookie-gated and not
// stable for headless use. The kie.ai shape is the documented one:
// submit → `GET /api/v1/generate/record-info?taskId=` → poll until status
// leaves the pending set → read `data.response.sunoData[0]`.
//
// All tunables (base URL, submit path, poll path, poll interval, model name,
// custom/instrumental modes) are env-overridable so ops can point at an
// alternative gateway (e.g. `studio-api.suno.ai`, a self-hosted wrapper, or a
// region-specific mirror) without a redeploy. Response parsing is defensive
// across several field-name variants so a minor upstream schema tweak doesn't
// break us.
//
// Flow:
//   1. POST {base}{submit_path} with { prompt, model, customMode, instrumental,
//      style, title, lyrics } (only non-empty keys). Bearer auth.
//      Response carries a task id (various names: `taskId`, `task_id`,
//      `data.taskId`, `id`) and sometimes pre-seeded clip ids in an array.
//   2. Poll {base}{poll_path}?taskId=<id> on a fixed cadence.
//      Response `data.status` ∈ {"PENDING","TEXT_SUCCESS","FIRST_SUCCESS",
//      "SUCCESS","SENSITIVE_WORD_ERROR","CREATE_TASK_FAILED","GENERATE_AUDIO_FAILED",
//      "CALLBACK_EXCEPTION",...}. We finish on SUCCESS (or FIRST_SUCCESS when
//      the caller opts into first-clip-early via env).
//   3. Extract `data.response.sunoData[0]` and return the mp3 URL + duration.
//
// The adapter does NOT download the audio — it's the caller's job to snapshot
// the URL into our work_assets storage so the stream keeps working after
// Suno rotates URLs.
//
// All tunables (base URL, submit path, poll path, poll interval, timeout,
// model name, Bearer header name, instrumental/custom mode) come from env so
// ops can tune without a redeploy; defaults reflect the publicly documented
// 2025 official-API shape.

use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::{Deserialize, Serialize};

use super::musicgpt::{MusicGenError, MusicGenRequest, MusicGenResult};

// Defaults target the kie.ai gateway (docs: https://docs.kie.ai).
// `V4_5` is the default per Jing 20260429 #204 — empirically verified on
// kie.ai with the user's Suno Premier balance (V5 may not be available on
// every gateway plan tier; V4_5 is the safe ubiquitous choice). `V5` /
// `V4_5PLUS` / `V4` / `V3_5` remain valid and can be set via SUNO_MODEL
// without a redeploy.
const DEFAULT_BASE_URL: &str = "https://api.kie.ai";
const DEFAULT_SUBMIT_PATH: &str = "/api/v1/generate";
const DEFAULT_POLL_PATH: &str = "/api/v1/generate/record-info";
const DEFAULT_MODEL: &str = "V4_5";
const DEFAULT_POLL_INTERVAL_SECS: u64 = 6;
const DEFAULT_TIMEOUT_SECS: u64 = 600;
const DEFAULT_HTTP_TIMEOUT_SECS: u64 = 60;
// kie.ai REQUIRES `callBackUrl` in the submit body (returns 422 without).
// We don't actually need callbacks — we poll — but we have to send one.
// This URL doesn't need to exist; kie.ai just records the value for its
// own logging. Pointing at our own (404) endpoint keeps it self-documenting.
const DEFAULT_CALLBACK_URL: &str = "https://cssstudio.app/cssapi/v1/suno-callback";

#[derive(Debug, Clone)]
pub struct SunoConfig {
    pub api_key: String,
    pub base_url: String,
    pub submit_path: String,
    pub poll_path: String,
    pub model: String,
    pub poll_interval: Duration,
    pub overall_timeout: Duration,
    pub http_timeout: Duration,
    /// When true, returns as soon as the first clip is streamable
    /// (status == "FIRST_SUCCESS"). When false, wait for full "SUCCESS".
    pub return_on_first_clip: bool,
    /// Suno's `customMode` — when true the caller supplies style+title+lyrics
    /// explicitly; when false, Suno derives them from `prompt`. We auto-pick:
    /// if the caller provided lyrics OR a music_style, we enable custom mode;
    /// otherwise we default to the simpler "describe" flow.
    pub force_custom_mode: Option<bool>,
    /// kie.ai requires a `callBackUrl` even when the caller polls; this is
    /// the value emitted in the submit body. Tunable via SUNO_CALLBACK_URL.
    pub callback_url: String,
}

impl SunoConfig {
    /// Read config from environment. Returns None when neither SUNO_API_KEY
    /// nor KIE_API_KEY is set so callers can decide whether to error or fall
    /// back. KIE_API_KEY is accepted as an alias because the api-vm env file
    /// uses that name (the gateway is kie.ai).
    pub fn from_env() -> Option<Self> {
        let api_key = std::env::var("SUNO_API_KEY")
            .ok()
            .or_else(|| std::env::var("KIE_API_KEY").ok())?;
        let api_key = api_key.trim().to_string();
        if api_key.is_empty() {
            return None;
        }
        let base_url = std::env::var("SUNO_BASE_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_string());
        let submit_path = std::env::var("SUNO_SUBMIT_PATH")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_SUBMIT_PATH.to_string());
        let poll_path = std::env::var("SUNO_POLL_PATH")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_POLL_PATH.to_string());
        let model = std::env::var("SUNO_MODEL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_MODEL.to_string());
        let poll_interval = std::env::var("SUNO_POLL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_POLL_INTERVAL_SECS);
        let overall_timeout = std::env::var("SUNO_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_TIMEOUT_SECS);
        let http_timeout = std::env::var("SUNO_HTTP_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_HTTP_TIMEOUT_SECS);
        let return_on_first_clip = std::env::var("SUNO_RETURN_FIRST_CLIP")
            .ok()
            .map(|s| {
                let t = s.trim().to_ascii_lowercase();
                t == "1" || t == "true" || t == "yes"
            })
            .unwrap_or(false);
        let force_custom_mode = std::env::var("SUNO_FORCE_CUSTOM_MODE")
            .ok()
            .map(|s| s.trim().to_ascii_lowercase())
            .and_then(|s| match s.as_str() {
                "1" | "true" | "yes" => Some(true),
                "0" | "false" | "no" => Some(false),
                _ => None,
            });
        let callback_url = std::env::var("SUNO_CALLBACK_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_CALLBACK_URL.to_string());
        Some(Self {
            api_key,
            base_url,
            submit_path,
            poll_path,
            model,
            poll_interval: Duration::from_secs(poll_interval),
            overall_timeout: Duration::from_secs(overall_timeout),
            http_timeout: Duration::from_secs(http_timeout),
            return_on_first_clip,
            force_custom_mode,
            callback_url,
        })
    }
}

pub struct SunoClient {
    cfg: SunoConfig,
    http: reqwest::Client,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SunoSubmitAck {
    task_id: String,
}

impl SunoClient {
    pub fn new(cfg: SunoConfig) -> Result<Self, MusicGenError> {
        // CSSOS_PHASE2_SUNO_AUTH_FIX 20260425 #119 — Jing
        // Same shared bug as the ElevenLabs adapter: sending BOTH
        // `Authorization: Bearer` AND `x-api-key` made strict gateways
        // (proxy/CDN/CF Worker) reject with 401 "duplicate auth
        // headers". Send EXACTLY one. Default is Bearer (Suno official
        // API); ops can opt into `x-api-key` for self-hosted wrappers
        // via SUNO_AUTH_HEADER=x-api-key.
        let mut headers = HeaderMap::new();
        let auth_header = std::env::var("SUNO_AUTH_HEADER")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "Authorization".to_string());
        let is_bearer = auth_header.eq_ignore_ascii_case("Authorization");
        let value = if is_bearer {
            format!("Bearer {}", cfg.api_key)
        } else {
            cfg.api_key.clone()
        };
        if let Ok(v) = HeaderValue::from_str(&value) {
            if is_bearer {
                headers.insert(AUTHORIZATION, v);
            } else if let Ok(name) =
                reqwest::header::HeaderName::from_bytes(auth_header.as_bytes())
            {
                headers.insert(name, v);
            }
        }
        let http = reqwest::Client::builder()
            .timeout(cfg.http_timeout)
            .connect_timeout(std::time::Duration::from_secs(10))
            .tcp_keepalive(Some(std::time::Duration::from_secs(30)))
            .pool_max_idle_per_host(2)
            .default_headers(headers)
            .user_agent("cssos-rust-api/phase2-suno")
            .build()?;
        Ok(Self { cfg, http })
    }

    pub fn from_env() -> Result<Self, MusicGenError> {
        match SunoConfig::from_env() {
            Some(cfg) => Self::new(cfg),
            None => Err(MusicGenError::NotConfigured {
                engine: "Suno",
                env_var: "SUNO_API_KEY",
            }),
        }
    }

    /// Submit a generation request and block-poll until it completes or the
    /// configured `overall_timeout` is exceeded.
    pub async fn generate(
        &self,
        req: &MusicGenRequest,
    ) -> Result<MusicGenResult, MusicGenError> {
        let task = self.submit(req).await?;
        let mut result = self.poll_until_done(&task).await?;
        // CSSOS_PHASE2_TIMESTAMPED_LYRICS 20260501 #259 — Jing
        // "请专门接 kie.ai timestamped-lyrics endpoint，把字幕从粗略均分
        //  升级到真 word-level."
        // kie.ai's record-info response does NOT include alignedWords —
        // they live behind a separate POST endpoint that returns
        // word-level timing for a given task_id + audio clip. Fetch it
        // here so MusicGenResult ships with engine-grade timestamps.
        // Best-effort: a failure on this side-call doesn't fail the
        // whole generation — the frontend's even-divide fallback still
        // produces usable subtitles.
        if result.aligned_lyrics.as_ref().map(|v| v.is_empty()).unwrap_or(true) {
            match self.fetch_timestamped_lyrics(&task, result.conversion_id.as_deref()).await {
                Ok(Some(lines)) if !lines.is_empty() => {
                    tracing::info!(
                        target: "cssos::suno::lyrics",
                        task_id = %task.task_id,
                        lines = lines.len(),
                        "fetched timestamped lyrics"
                    );
                    result.aligned_lyrics = Some(lines);
                }
                Ok(_) => {
                    tracing::info!(
                        target: "cssos::suno::lyrics",
                        task_id = %task.task_id,
                        "no timestamped lyrics returned; frontend will even-divide"
                    );
                }
                Err(e) => {
                    tracing::warn!(
                        target: "cssos::suno::lyrics",
                        task_id = %task.task_id,
                        err = %e,
                        "timestamped-lyrics fetch failed (non-fatal)"
                    );
                }
            }
        }
        Ok(result)
    }

    /// Hit kie.ai's `/api/v1/generate/get-timestamped-lyrics` endpoint with
    /// the given task_id (+ optional audioId for multi-clip selection).
    /// Returns parsed AlignedLyricLine[] when the response contains a non-
    /// empty `data.alignedWords` array, None otherwise.
    async fn fetch_timestamped_lyrics(
        &self,
        task: &SunoSubmitAck,
        audio_id: Option<&str>,
    ) -> Result<Option<Vec<crate::music_gen::AlignedLyricLine>>, MusicGenError> {
        let url = format!(
            "{}/api/v1/generate/get-timestamped-lyrics",
            self.cfg.base_url.trim_end_matches('/')
        );
        let mut body = serde_json::Map::new();
        body.insert(
            "taskId".into(),
            serde_json::Value::String(task.task_id.clone()),
        );
        if let Some(aid) = audio_id.filter(|s| !s.is_empty()) {
            body.insert("audioId".into(), serde_json::Value::String(aid.to_string()));
        }
        let resp = self
            .http
            .post(&url)
            .json(&serde_json::Value::Object(body))
            .send()
            .await?;
        let status = resp.status();
        let text = resp.text().await?;
        if !status.is_success() {
            tracing::warn!(
                target: "cssos::suno::lyrics",
                task_id = %task.task_id,
                status = status.as_u16(),
                body = %text.chars().take(280).collect::<String>(),
                "non-2xx from get-timestamped-lyrics"
            );
            return Ok(None);
        }
        let v: serde_json::Value = match serde_json::from_str(&text) {
            Ok(x) => x,
            Err(_) => return Ok(None),
        };
        // Response shape per kie.ai docs:
        //   { code, msg, data: { alignedWords: [{word, start, end, success?}] } }
        // Some accounts return data as an array directly. Handle both.
        let aligned = v
            .get("data")
            .and_then(|d| d.get("alignedWords"))
            .or_else(|| v.get("alignedWords"))
            .or_else(|| {
                v.get("data")
                    .and_then(|d| d.get("hootCer"))
                    .and_then(|h| h.get("alignedWords"))
            });
        let lines = aligned
            .and_then(|x| {
                // Build a synthetic envelope so extract_aligned_lyrics's
                // "Suno alignedWords" branch runs unchanged (it expects
                // either v.metadata.alignedWords or v.alignedWords).
                let mut envelope = serde_json::Map::new();
                envelope.insert("alignedWords".into(), x.clone());
                crate::music_gen::extract_aligned_lyrics(&serde_json::Value::Object(envelope))
            });
        Ok(lines)
    }

    async fn submit(&self, req: &MusicGenRequest) -> Result<SunoSubmitAck, MusicGenError> {
        let url = format!(
            "{}{}",
            self.cfg.base_url.trim_end_matches('/'),
            self.cfg.submit_path
        );

        // Decide customMode: explicit env override wins; otherwise auto-pick
        // based on whether the caller is asking for a specific style/lyrics.
        let has_style = req
            .music_style
            .as_deref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        let has_lyrics = req
            .lyrics
            .as_deref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        let custom_mode = self
            .cfg
            .force_custom_mode
            .unwrap_or(has_style || has_lyrics);

        // CSSOS_PHASE2_MUSIC_VERSIONING 20260419 — per-request version wins
        // over env SUNO_MODEL. Maps user-facing "v3.5" / "v4" / "v4.5" / "v5"
        // → Suno's canonical model names "V3_5" / "V4" / "V4_5" / "V5".
        // Unknown/blank falls back to the env default so ops can still pin
        // a model globally via SUNO_MODEL.
        let effective_model = req
            .version
            .as_deref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(normalize_suno_model)
            .unwrap_or_else(|| self.cfg.model.clone());

        let mut body = serde_json::Map::new();
        // CSSOS_PHASE2_KIE_PROMPT_IS_LYRICS 20260429 #206c — Jing
        //
        // kie.ai's customMode schema is BACKWARDS from what the field name
        // suggests: in customMode the `prompt` field IS the sung lyrics, not
        // the description. The separate `lyrics` field we used to send was
        // silently dropped by kie.ai → Suno generated a 39s "Verse 1 demo"
        // off the title alone (Mount Hermon Oath).
        //
        // Fix: when customMode=true, populate `prompt` with the user's lyrics
        // (preferred) and only fall back to req.prompt (the description) when
        // there are no lyrics. We still emit a `lyrics` field too, for
        // sunoapi.org compatibility (it accepts both shapes).
        let prompt_value: String = if custom_mode {
            req.lyrics
                .as_deref()
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .unwrap_or_else(|| req.prompt.clone())
        } else {
            req.prompt.clone()
        };
        body.insert("prompt".into(), serde_json::Value::String(prompt_value));
        body.insert(
            "model".into(),
            serde_json::Value::String(effective_model),
        );
        body.insert("customMode".into(), serde_json::Value::Bool(custom_mode));
        body.insert(
            "instrumental".into(),
            serde_json::Value::Bool(req.make_instrumental),
        );
        // CSSOS_PHASE2_KIE_PIVOT 20260429 #204 — kie.ai requires callBackUrl
        // (rejects with 422 otherwise). We poll record-info ourselves so the
        // callback is never invoked; the URL just has to be present and
        // syntactically valid. sunoapi.org tolerates this field, so emitting
        // it unconditionally keeps both gateways working.
        body.insert(
            "callBackUrl".into(),
            serde_json::Value::String(self.cfg.callback_url.clone()),
        );
        if let Some(style) = req
            .music_style
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            // Suno uses `style` on the new developer API; older surfaces use
            // `tags`. Emit both to be compatible.
            body.insert(
                "style".into(),
                serde_json::Value::String(style.to_string()),
            );
            body.insert(
                "tags".into(),
                serde_json::Value::String(style.to_string()),
            );
        }
        if let Some(lyrics) = req
            .lyrics
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            body.insert(
                "lyrics".into(),
                serde_json::Value::String(lyrics.to_string()),
            );
        }
        // CSSOS_PHASE2_KIE_PIVOT 20260429 #204 — kie.ai requires `title` when
        // customMode=true. Prefer the caller-supplied title (#207); fall back
        // to deriving from prompt's first line only when none was provided.
        // The fallback is a safety net: in the production MV pipeline the
        // frontend must populate `req.title` with the user's actual song
        // title, because Suno treats `title` as a strong artist/style hint
        // — bad titles ("a fierce battle anthem") tilt the arrangement off.
        if custom_mode {
            let title = req
                .title
                .as_deref()
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .map(|s| {
                    if s.chars().count() > 64 {
                        s.chars().take(64).collect::<String>()
                    } else {
                        s.to_string()
                    }
                })
                .or_else(|| {
                    req.prompt
                        .lines()
                        .next()
                        .map(|s| s.trim())
                        .filter(|s| !s.is_empty())
                        .map(|s| {
                            if s.chars().count() > 64 {
                                s.chars().take(64).collect::<String>()
                            } else {
                                s.to_string()
                            }
                        })
                })
                .unwrap_or_else(|| "Untitled".to_string());
            body.insert("title".into(), serde_json::Value::String(title));
        }

        let body = serde_json::Value::Object(body);
        let resp = self.http.post(&url).json(&body).send().await?;
        let status = resp.status();
        let text = resp.text().await?;
        if !status.is_success() {
            return Err(MusicGenError::Upstream {
                status: status.as_u16(),
                body: text,
            });
        }
        let v: serde_json::Value =
            serde_json::from_str(&text).map_err(|e| MusicGenError::Upstream {
                status: status.as_u16(),
                body: format!("non-json response: {} ({})", e, text),
            })?;

        // The Suno developer API nests fields under `.data` while the raw
        // studio API returns them at the top level. Try both, plus a handful
        // of common field-name variants so a minor upstream tweak doesn't
        // break us.
        let task_id = extract_task_id(&v)
            .ok_or_else(|| {
                let preview: String = text.chars().take(2000).collect();
                tracing::error!(
                    target: "cssos::mv::music",
                    upstream_status = status.as_u16(),
                    top_keys = ?v.as_object().map(|m| m.keys().cloned().collect::<Vec<_>>()).unwrap_or_default(),
                    upstream_body = %preview,
                    "suno: 2xx response missing taskId across all known shapes"
                );
                MusicGenError::MissingField("taskId")
            })?
            .to_string();
        Ok(SunoSubmitAck { task_id })
    }

    async fn poll_until_done(
        &self,
        task: &SunoSubmitAck,
    ) -> Result<MusicGenResult, MusicGenError> {
        let started = std::time::Instant::now();
        let url = format!(
            "{}{}",
            self.cfg.base_url.trim_end_matches('/'),
            self.cfg.poll_path
        );
        loop {
            if started.elapsed() > self.cfg.overall_timeout {
                return Err(MusicGenError::Timeout(self.cfg.overall_timeout));
            }
            let resp = self
                .http
                .get(&url)
                .query(&[("taskId", task.task_id.as_str())])
                .send()
                .await?;
            let status = resp.status();
            let text = resp.text().await?;
            if !status.is_success() {
                // Only a definitive 4xx stops us. 5xx is treated as transient
                // within the overall_timeout budget.
                if status.is_client_error() {
                    return Err(MusicGenError::Upstream {
                        status: status.as_u16(),
                        body: text,
                    });
                }
                tokio::time::sleep(self.cfg.poll_interval).await;
                continue;
            }
            let v: serde_json::Value = match serde_json::from_str(&text) {
                Ok(x) => x,
                Err(_) => {
                    tokio::time::sleep(self.cfg.poll_interval).await;
                    continue;
                }
            };

            let state = extract_state(&v).to_ascii_uppercase();
            // CSSOS_PHASE2_KIE_TRUNCATION_FIX 20260429 #206 — Jing
            // Trace every poll so we can prove (in logs) that we're not
            // returning early. Mount Hermon came back at 2:39/3:19 because
            // the adapter previously fell through `streamAudioUrl`, which
            // is the progressively-rendered URL — partial bytes during
            // FIRST_SUCCESS. The fix is two-fold: (a) only return on the
            // final SUCCESS state, and (b) drop streamAudioUrl entirely
            // from finalize_result so we can never accidentally hand the
            // pipeline an in-progress stream.
            tracing::debug!(
                target: "cssos::suno::poll",
                task_id = %task.task_id,
                state = %state,
                elapsed_secs = started.elapsed().as_secs(),
                "poll tick"
            );
            match state.as_str() {
                "SUCCESS" | "COMPLETE" | "COMPLETED" | "FINISHED" | "DONE" => {
                    // Brief grace so the persistent CDN URL definitely has
                    // the final bytes flushed. kie.ai sometimes flips
                    // `data.status` to SUCCESS a beat before the tempfile
                    // CDN is fully written; 5s is plenty.
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    tracing::info!(
                        target: "cssos::suno::poll",
                        task_id = %task.task_id,
                        elapsed_secs = started.elapsed().as_secs(),
                        "SUCCESS — finalizing"
                    );
                    return Ok(finalize_result(task, v));
                }
                "FIRST_SUCCESS" | "STREAMING" => {
                    // CSSOS_PHASE2_KIE_TRUNCATION_FIX 20260429 #206 — Jing
                    // FIRST_SUCCESS used to be an opt-in early-return. We
                    // now NEVER return here — kie.ai's audioUrl at this
                    // state is set but the file at the CDN is still being
                    // written, which produced 17-second truncations. The
                    // SUNO_RETURN_FIRST_CLIP env knob is left in for ops
                    // emergency override but should not be enabled in
                    // production.
                    if self.cfg.return_on_first_clip {
                        tracing::warn!(
                            target: "cssos::suno::poll",
                            task_id = %task.task_id,
                            "SUNO_RETURN_FIRST_CLIP=1 — returning a possibly-truncated clip"
                        );
                        return Ok(finalize_result(task, v));
                    }
                    tokio::time::sleep(self.cfg.poll_interval).await;
                }
                "SENSITIVE_WORD_ERROR"
                | "CREATE_TASK_FAILED"
                | "GENERATE_AUDIO_FAILED"
                | "CALLBACK_EXCEPTION"
                | "FAILED"
                | "ERROR"
                | "CANCELED"
                | "CANCELLED" => {
                    return Err(MusicGenError::JobFailed(
                        extract_error_message(&v)
                            .unwrap_or_else(|| format!("suno job failed: status={}", state)),
                    ));
                }
                _ => {
                    tokio::time::sleep(self.cfg.poll_interval).await;
                }
            }
        }
    }
}

// ---------------------------------------------------------------- parsing

fn extract_task_id(v: &serde_json::Value) -> Option<&str> {
    fn pick<'a>(o: &'a serde_json::Value, keys: &[&str]) -> Option<&'a str> {
        for k in keys {
            if let Some(s) = o.get(*k).and_then(|x| x.as_str()) {
                if !s.is_empty() {
                    return Some(s);
                }
            }
        }
        None
    }
    let id_keys = ["taskId", "task_id", "id", "jobId", "job_id", "requestId", "request_id"];

    // Developer API: { code, msg, data: { taskId } }
    if let Some(d) = v.get("data") {
        if let Some(id) = pick(d, &id_keys) {
            return Some(id);
        }
        // { data: [{ id }, ...] }
        if let Some(arr) = d.as_array() {
            if let Some(first) = arr.first() {
                if let Some(id) = pick(first, &id_keys) {
                    return Some(id);
                }
            }
        }
        // { data: { tasks: [{ taskId }] } } or { data: { clips: [...] } }
        for nested_key in &["tasks", "clips", "items", "results"] {
            if let Some(arr) = d.get(*nested_key).and_then(|x| x.as_array()) {
                if let Some(first) = arr.first() {
                    if let Some(id) = pick(first, &id_keys) {
                        return Some(id);
                    }
                }
            }
        }
    }
    // { result: { taskId } } / { response: { taskId } }
    for outer in &["result", "response", "task", "payload"] {
        if let Some(o) = v.get(*outer) {
            if let Some(id) = pick(o, &id_keys) {
                return Some(id);
            }
        }
    }
    // Top-level task id (older studio API / some self-hosted wrappers).
    if let Some(id) = pick(v, &id_keys) {
        return Some(id);
    }
    // Top-level array of clips: [{ id }, { id }]
    if let Some(arr) = v.as_array() {
        if let Some(first) = arr.first() {
            if let Some(id) = pick(first, &id_keys) {
                return Some(id);
            }
        }
    }
    // { taskIds: [...] } / { ids: [...] }
    for arr_key in &["taskIds", "ids", "task_ids"] {
        if let Some(arr) = v.get(*arr_key).and_then(|x| x.as_array()) {
            if let Some(s) = arr.first().and_then(|x| x.as_str()) {
                if !s.is_empty() {
                    return Some(s);
                }
            }
        }
    }
    None
}

fn extract_state(v: &serde_json::Value) -> String {
    // Developer API: data.status
    if let Some(s) = v
        .get("data")
        .and_then(|d| d.get("status"))
        .and_then(|x| x.as_str())
    {
        return s.to_string();
    }
    // Top-level status variants.
    if let Some(s) = v
        .get("status")
        .or_else(|| v.get("state"))
        .and_then(|x| x.as_str())
    {
        return s.to_string();
    }
    // Array shape: if all clips report complete, treat as SUCCESS.
    if let Some(arr) = v.as_array() {
        if !arr.is_empty()
            && arr.iter().all(|c| {
                c.get("status")
                    .and_then(|x| x.as_str())
                    .map(|s| {
                        let u = s.to_ascii_uppercase();
                        u == "COMPLETE" || u == "COMPLETED" || u == "STREAMING"
                    })
                    .unwrap_or(false)
            })
        {
            return "SUCCESS".into();
        }
    }
    "PENDING".into()
}

/// Map a user-facing version string to Suno's canonical model name.
///
/// Accepts common forms (`v4`, `V4`, `4`, `v4.5`, `4_5`, `v5`, ...) and
/// returns the Suno API's expected uppercase+underscore form (`V4`, `V4_5`,
/// `V5`, `V3_5`). Anything already in canonical form round-trips unchanged.
///
/// This is the only place version-string normalization happens — keeps the
/// "UI version vs upstream model" mapping in one spot so ops can tune it
/// without hunting through the submit body builder.
fn normalize_suno_model(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return "V5".into();
    }
    let upper = trimmed.to_ascii_uppercase();
    // Already canonical (e.g. "V4_5"): just strip dots and prepend V if missing.
    let stripped = upper.trim_start_matches('V');
    let normalized_body = stripped.replace('.', "_");
    format!("V{}", normalized_body)
}

fn extract_error_message(v: &serde_json::Value) -> Option<String> {
    v.get("data")
        .and_then(|d| d.get("errorMessage").or_else(|| d.get("error")))
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            v.get("message")
                .or_else(|| v.get("msg"))
                .or_else(|| v.get("error"))
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
        })
}

fn extract_first_clip(v: &serde_json::Value) -> Option<&serde_json::Value> {
    // Developer API: data.response.sunoData[]
    if let Some(arr) = v
        .get("data")
        .and_then(|d| d.get("response"))
        .and_then(|r| r.get("sunoData"))
        .and_then(|x| x.as_array())
    {
        if let Some(first) = arr.first() {
            return Some(first);
        }
    }
    // Developer API alt: data.clips[]
    if let Some(arr) = v
        .get("data")
        .and_then(|d| d.get("clips"))
        .and_then(|x| x.as_array())
    {
        if let Some(first) = arr.first() {
            return Some(first);
        }
    }
    // Studio API: top-level array of clips.
    if let Some(arr) = v.as_array() {
        if let Some(first) = arr.first() {
            return Some(first);
        }
    }
    None
}

fn finalize_result(task: &SunoSubmitAck, v: serde_json::Value) -> MusicGenResult {
    let clip = extract_first_clip(&v).cloned().unwrap_or_else(|| v.clone());

    // CSSOS_PHASE2_KIE_TRUNCATION_FIX 20260429 #206 — ONLY use the persistent
    // CDN URL (`audioUrl`). Previously we fell back to `streamAudioUrl` when
    // audioUrl was empty, but streamAudioUrl is the in-progress streaming
    // endpoint — downloading from it during FIRST_SUCCESS truncated the
    // Mount Hermon song from 199s → 182s. By the time we reach
    // finalize_result we have already gated on data.status == "SUCCESS"
    // plus a 5s grace, so audioUrl MUST be populated; if it isn't we'd
    // rather emit an empty-URL warning than ship partial bytes.
    let audio_url = clip
        .get("audioUrl")
        .or_else(|| clip.get("audio_url"))
        .and_then(|x| x.as_str())
        .unwrap_or_default()
        .to_string();
    if audio_url.is_empty() {
        tracing::warn!(
            target: "cssos::suno::finalize",
            task_id = %task.task_id,
            "SUCCESS reached but audioUrl is empty — caller will see no playable URL"
        );
    }

    let duration_secs = clip
        .get("duration")
        .or_else(|| clip.get("duration_secs"))
        .and_then(|x| x.as_f64());

    let title = clip
        .get("title")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());

    let conversion_id = clip
        .get("id")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());

    // CSSOS_PHASE2_ALIGNED_LYRICS 20260426 #148-D — Jing
    // Suno v5 returns word-level alignment under
    // `clip.metadata.alignedWords` (or `aligned_words` depending on API rev).
    // Extract from `clip` first (the per-clip envelope we already located),
    // then fall back to the top-level payload `v` in case the field migrates.
    let aligned_lyrics = crate::music_gen::extract_aligned_lyrics(&clip)
        .or_else(|| crate::music_gen::extract_aligned_lyrics(&v));

    // CSSOS_PHASE2_DUAL_TRACK 20260430 #208 — Jing
    // Suno always returns 2 takes per generation. Surface clip[1] as
    // alt_audio_url so the frontend can offer a Take 1 / Take 2 toggle in
    // the Watch panel without making a second generation request.
    let (alt_audio_url, alt_duration_secs, alt_conversion_id) = extract_second_clip(&v)
        .map(|c2| {
            let url = c2
                .get("audioUrl")
                .or_else(|| c2.get("audio_url"))
                .and_then(|x| x.as_str())
                .unwrap_or_default()
                .to_string();
            let dur = c2
                .get("duration")
                .or_else(|| c2.get("duration_secs"))
                .and_then(|x| x.as_f64());
            let cid = c2
                .get("id")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string());
            (
                if url.is_empty() { None } else { Some(url) },
                dur,
                cid,
            )
        })
        .unwrap_or((None, None, None));

    MusicGenResult {
        task_id: task.task_id.clone(),
        conversion_id,
        audio_url,
        format: "mp3".to_string(),
        duration_secs,
        title,
        raw: v,
        aligned_lyrics,
        alt_audio_url,
        alt_duration_secs,
        alt_conversion_id,
    }
}

/// CSSOS_PHASE2_DUAL_TRACK 20260430 #208 — same pickers as
/// `extract_first_clip` but for the second clip, so the Watch panel can
/// offer a Take 1 / Take 2 toggle off a single generation.
fn extract_second_clip(v: &serde_json::Value) -> Option<&serde_json::Value> {
    if let Some(arr) = v
        .get("data")
        .and_then(|d| d.get("response"))
        .and_then(|r| r.get("sunoData"))
        .and_then(|x| x.as_array())
    {
        if let Some(second) = arr.get(1) {
            return Some(second);
        }
    }
    if let Some(arr) = v
        .get("data")
        .and_then(|d| d.get("clips"))
        .and_then(|x| x.as_array())
    {
        if let Some(second) = arr.get(1) {
            return Some(second);
        }
    }
    if let Some(arr) = v.as_array() {
        if let Some(second) = arr.get(1) {
            return Some(second);
        }
    }
    None
}
