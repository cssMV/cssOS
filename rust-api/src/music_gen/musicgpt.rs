// CSSOS_PHASE2_MUSICGPT 20260417 — MusicGPT HTTP adapter (single-shot MVP).
//
// Flow:
//   1. POST {base}/api/public/v1/MusicAI with prompt/style/lyrics
//      - Auth header: `Authorization: <API_KEY>` (MusicGPT accepts the raw key,
//        no Bearer prefix). Some tenants expect `x-api-key`; we send both to be
//        safe — extra header is harmless.
//      - Response carries `task_id` and two `conversion_id`s (MP3 + WAV).
//   2. Poll {base}/api/public/v1/byId?task_id=<id> on a fixed cadence until
//      status == "completed" or we hit the configured timeout.
//   3. Pull `conversion_path_1` (MP3, preferred) or `conversion_path_2` (WAV).
//
// The adapter does NOT download the audio file to local disk — that's the
// caller's job (so they can pipe it into our standard artifact/work_assets
// storage). We just return the final URL + metadata.
//
// All tunables (base URL, poll interval, timeout) come from env so ops can
// tweak without a redeploy; they have sane MVP defaults.

use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::mv_random_inputs;

const DEFAULT_BASE_URL: &str = "https://api.musicgpt.com";
const DEFAULT_POLL_INTERVAL_SECS: u64 = 6;
const DEFAULT_TIMEOUT_SECS: u64 = 600;
const DEFAULT_HTTP_TIMEOUT_SECS: u64 = 60;
// MusicGPT's `/MusicAI` endpoint requires `conversionType` as a query param —
// pydantic 2.5 returns 422 `{"loc":["query","conversionType"],"msg":"Field required"}`
// if it's missing. `MUSIC_AI` is the canonical value for AI music generation.
// Keep this env-overridable per the 一切参数化 principle so ops can switch to
// other conversion flavors without a redeploy.
const DEFAULT_CONVERSION_TYPE: &str = "MUSIC_AI";

#[derive(Debug, Clone)]
pub struct MusicGptConfig {
    pub api_key: String,
    pub base_url: String,
    pub poll_interval: Duration,
    pub overall_timeout: Duration,
    pub http_timeout: Duration,
    pub conversion_type: String,
}

impl MusicGptConfig {
    /// Read config from environment. Returns None when MUSICGPT_API_KEY is
    /// empty/unset so callers can decide whether to error or fall back.
    pub fn from_env() -> Option<Self> {
        let api_key = std::env::var("MUSICGPT_API_KEY").ok()?;
        let api_key = api_key.trim().to_string();
        if api_key.is_empty() {
            return None;
        }
        let base_url = std::env::var("MUSICGPT_BASE_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_string());
        let poll_interval = std::env::var("MUSICGPT_POLL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_POLL_INTERVAL_SECS);
        let overall_timeout = std::env::var("MUSICGPT_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_TIMEOUT_SECS);
        let http_timeout = std::env::var("MUSICGPT_HTTP_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_HTTP_TIMEOUT_SECS);
        let conversion_type = std::env::var("MUSICGPT_CONVERSION_TYPE")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_CONVERSION_TYPE.to_string());
        Some(Self {
            api_key,
            base_url,
            poll_interval: Duration::from_secs(poll_interval),
            overall_timeout: Duration::from_secs(overall_timeout),
            http_timeout: Duration::from_secs(http_timeout),
            conversion_type,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicGenRequest {
    pub prompt: String,
    #[serde(default)]
    pub music_style: Option<String>,
    #[serde(default)]
    pub lyrics: Option<String>,
    #[serde(default)]
    pub make_instrumental: bool,
    #[serde(default)]
    pub voice_id: Option<String>,
    // CSSOS_PHASE2_MUSIC_VERSIONING 20260419 — per-request version override.
    // Each adapter interprets this string according to its own provider's
    // model naming (e.g. Suno "v4" → model "V4"; ElevenLabs "v1" → no-op;
    // Stable Audio "2.0" → model "stable-audio-2-0"). Blank/None means the
    // adapter falls back to its env default. This is the primary mechanism
    // by which the engine-selection UI controls which model actually runs.
    #[serde(default)]
    pub version: Option<String>,
    /// CSSOS_PHASE2_TARGET_DURATION 20260426 #148-C — Jing
    /// Caller-supplied target track duration in seconds. Each adapter
    /// translates this onto its provider's native length parameter:
    ///   - ElevenLabs Music: `music_length_ms` (clamped 30000..300000)
    ///   - Stable Audio:    `duration` seconds (clamped 30..190)
    ///   - Suno + MusicGPT: ignored (their continuation/duration story is
    ///     opaque or paid-only; falls back to upstream defaults)
    /// None ⇒ engine default. Phase 1 only ElevenLabs honors it
    /// meaningfully; Phase 2 adds Suno continuation chains for >4min.
    #[serde(default)]
    pub target_duration_secs: Option<u32>,
    /// CSSOS_PHASE2_KIE_TITLE 20260429 #207 — Jing
    /// Explicit song title. Used by Suno-family engines as the `title`
    /// field in customMode. Skipping this and deriving from `prompt[:64]`
    /// produced laughable titles like "a fierce battle anthem", which Suno
    /// then treated as an artist-tag hint and tilted the whole arrangement
    /// off-style. The frontend should pass the user's actual song title
    /// here (e.g. "Mount Hermon Oath"); empty/None ⇒ adapter falls back to
    /// its current prompt-derived heuristic.
    #[serde(default)]
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicGenResult {
    pub task_id: String,
    pub conversion_id: Option<String>,
    pub audio_url: String,
    pub format: String,
    pub duration_secs: Option<f64>,
    pub title: Option<String>,
    pub raw: serde_json::Value,
    /// CSSOS_PHASE2_ALIGNED_LYRICS 20260426 #148-D — Jing
    /// Per-line/word timing extracted from the upstream payload by
    /// `crate::music_gen::extract_aligned_lyrics`. None when the engine
    /// doesn't expose alignment (MusicGPT, Stable Audio) or when extraction
    /// fails. Downstream `/api/mv/subtitles` uses this when present and falls
    /// back to even-divide otherwise — so existing engines don't regress.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aligned_lyrics: Option<Vec<crate::music_gen::AlignedLyricLine>>,
    /// CSSOS_PHASE2_DUAL_TRACK 20260430 #208 — Jing
    /// Suno (and any future engine that returns multiple variants per
    /// generation) gives back 2 clips by default. We expose them as
    /// "Take 1" (the primary `audio_url` above) and "Take 2" (this
    /// optional alt). Single-track engines (ElevenLabs, MusicGPT, Stable
    /// Audio) leave this `None`. Caller decides whether to render two
    /// MV variants or just offer audio-only A/B compare.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alt_audio_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alt_duration_secs: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alt_conversion_id: Option<String>,
}

#[derive(Debug, Error)]
pub enum MusicGenError {
    // CSSOS_PHASE2_MUSIC_NOTCONFIGURED_ENGINE 20260425 #95 — This enum is
    // shared by ALL music adapters (musicgpt, suno, elevenlabs, stability).
    // The Display string used to hardcode "MusicGPT" so an ElevenLabs
    // NotConfigured error showed up in the UI as "MusicGPT is not
    // configured (set MUSICGPT_API_KEY)" — extremely confusing. Carry
    // the engine label + env var name so each adapter's NotConfigured
    // names itself correctly.
    #[error("{engine} is not configured (set {env_var})")]
    NotConfigured { engine: &'static str, env_var: &'static str },
    // CSSOS_PHASE2_MUSIC_ERR_ENGINE_LABEL 20260425 #100 — Drop the
    // hardcoded "MusicGPT" prefix from every variant. An ElevenLabs 422
    // would print "MusicGPT responded with status 422: Invalid model id:
    // eleven_music_v1" — the body made it clear it was ElevenLabs, but
    // the prefix lied. Variant shapes unchanged to keep call-site churn
    // zero; just swap the Display string to "music engine".
    #[error("music engine transport error: {0}")]
    Transport(#[from] reqwest::Error),
    #[error("music engine responded with status {status}: {body}")]
    Upstream { status: u16, body: String },
    #[error("music engine job timed out after {0:?}")]
    Timeout(Duration),
    #[error("music engine job failed: {0}")]
    JobFailed(String),
    #[error("music engine response was missing a required field: {0}")]
    MissingField(&'static str),
}

pub struct MusicGptClient {
    cfg: MusicGptConfig,
    http: reqwest::Client,
}

impl MusicGptClient {
    pub fn new(cfg: MusicGptConfig) -> Result<Self, MusicGenError> {
        let mut headers = HeaderMap::new();
        if let Ok(v) = HeaderValue::from_str(&cfg.api_key) {
            headers.insert(AUTHORIZATION, v.clone());
            headers.insert("x-api-key", v);
        }
        // CSSOS_PHASE2_MUSICGPT_CLIENT_TUNE 20260425 #119 — Jing
        // Long-running poll loops (5+ min) over a flaky upstream were
        // burning sockets and triggering NetworkError mid-poll. Three
        // tuning knobs:
        //   1. tcp_keepalive — keep the socket warm between polls so
        //      intermediate hops (NAT, LB, etc.) don't drop us silently
        //   2. connect_timeout — fail fast on dead-target rather than
        //      waiting the full http_timeout for connect to fail
        //   3. pool_max_idle_per_host=2 — we only need 1 active poll
        //      socket; 32 (reqwest default) wastes file descriptors
        //      and never gets reaped during a single job
        // Bonus: HTTP/2 explicitly enabled so MusicGPT's CDN can
        // multiplex submit + poll over the same connection when the
        // server supports it.
        let http = reqwest::Client::builder()
            .timeout(cfg.http_timeout)
            .connect_timeout(std::time::Duration::from_secs(10))
            .tcp_keepalive(Some(std::time::Duration::from_secs(30)))
            .pool_max_idle_per_host(2)
            .pool_idle_timeout(Some(std::time::Duration::from_secs(90)))
            .http1_only() // MusicGPT is HTTP/1.1; explicit pin avoids
                          // ALPN renegotiation on every request
            .default_headers(headers)
            .user_agent("cssos-rust-api/phase2-musicgpt")
            .build()?;
        Ok(Self { cfg, http })
    }

    pub fn from_env() -> Result<Self, MusicGenError> {
        match MusicGptConfig::from_env() {
            Some(cfg) => Self::new(cfg),
            None => Err(MusicGenError::NotConfigured {
                engine: "MusicGPT",
                env_var: "MUSICGPT_API_KEY",
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
        self.poll_until_done(&task).await
    }

    async fn submit(&self, req: &MusicGenRequest) -> Result<SubmitAck, MusicGenError> {
        // MusicGPT requires `conversionType` as a URL query param (pydantic 422
        // if missing). Everything else goes in the JSON body.
        //
        // CSSOS_PHASE2_MUSICGPT_RANDOM_BACKFILL 20260419 —
        // MusicGPT's /MusicAI endpoint has kept returning "must have input"
        // on smoke tests even when pipeline_mv_api.rs does the mv_random_inputs
        // backfill at the route layer. Causes we've seen or suspect:
        //   1. Alternate call paths (voice entry, retry flows, direct API
        //      callers, future smoke-test harnesses) that bypass the route-
        //      level backfill and land here with prompt/style/lyrics blank.
        //   2. MusicGPT sometimes requires BOTH a non-empty `music_style` and
        //      EITHER non-empty `lyrics` OR `make_instrumental=true`; our
        //      previous submit body omitted empty optional fields entirely,
        //      which their pydantic validator can still reject depending on
        //      the conversionType mode.
        //
        // Defense-in-depth fix: apply the same random-bank fallbacks inside
        // the adapter itself, so no matter who calls MusicGptClient::generate
        // with an under-specified MusicGenRequest, we never let an empty
        // prompt/style leave this function. Lyrics stay optional (we set
        // make_instrumental=true when lyrics are absent so MusicGPT's "vocal
        // track without lyrics" rejection is dodged).
        let backfilled = backfill_request_for_musicgpt(req);

        let url = format!("{}/api/public/v1/MusicAI", self.cfg.base_url);
        let mut body = serde_json::Map::new();
        body.insert(
            "prompt".into(),
            serde_json::Value::String(backfilled.prompt.clone()),
        );
        body.insert(
            "music_style".into(),
            serde_json::Value::String(backfilled.music_style.clone()),
        );
        body.insert(
            "make_instrumental".into(),
            serde_json::Value::Bool(backfilled.make_instrumental),
        );
        if let Some(lyrics) = backfilled
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
        if let Some(voice) = backfilled
            .voice_id
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            body.insert(
                "voice_id".into(),
                serde_json::Value::String(voice.to_string()),
            );
        }
        let body = serde_json::Value::Object(body);
        // CSSOS_PHASE2_MUSICGPT_RUNTIME_TRACE 20260424 #95 —
        // Jing keeps seeing the pipeline's music stage fail with a
        // conversionType-shaped 422 even though the adapter code, the
        // deployed binary strings, and a direct curl against the same
        // endpoint all prove `conversionType=MUSIC_AI` is being sent.
        // Log the ground truth (base_url + conversion_type + body keys)
        // at request-submit time so we can see runtime state next run.
        tracing::info!(
            target: "cssos::mv::music",
            base_url = %self.cfg.base_url,
            conversion_type = %self.cfg.conversion_type,
            conversion_type_len = self.cfg.conversion_type.len(),
            prompt_len = backfilled.prompt.len(),
            style_len = backfilled.music_style.len(),
            has_lyrics = backfilled.lyrics.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false),
            make_instrumental = backfilled.make_instrumental,
            body_keys = ?body.as_object().map(|m| m.keys().cloned().collect::<Vec<_>>()).unwrap_or_default(),
            "musicgpt: submit about to send"
        );
        let resp = self
            .http
            .post(&url)
            .query(&[("conversionType", self.cfg.conversion_type.as_str())])
            .json(&body)
            .send()
            .await?;
        let status = resp.status();
        let text = resp.text().await?;
        if !status.is_success() {
            // CSSOS_PHASE2_MUSICGPT_422_TRACE 20260424 #95 — Jing still sees
            // MusicGPT failing in production while direct curls against the
            // same endpoint succeed. Log the full upstream response body at
            // ERROR level whenever we get a non-2xx so the failure mode (is
            // it pydantic-422 / is it "music style too long" / is it a rate
            // limit / etc.) is visible in journalctl without re-deploying a
            // tracing binary. Body is trimmed to 2000 chars to keep log
            // lines bounded for well-behaved responses.
            let preview: String = text.chars().take(2000).collect();
            tracing::error!(
                target: "cssos::mv::music",
                upstream_status = status.as_u16(),
                upstream_body = %preview,
                body_len = text.len(),
                "musicgpt: upstream non-success response"
            );
            // CSSOS_PHASE2_MUSICGPT_RANDOM_BACKFILL 20260419 —
            // When MusicGPT returns 422 Unprocessable Entity, surface the
            // exact `loc` path from its pydantic error so ops can see which
            // field is missing without grepping upstream logs. We keep the
            // raw body too for forward-compat with future error shapes.
            let body_with_hint = explain_422(status.as_u16(), &text);
            return Err(MusicGenError::Upstream {
                status: status.as_u16(),
                body: body_with_hint,
            });
        }
        // CSSOS_PHASE2_MUSICGPT_PARSE_TRACE 20260425 #95 — log parse failures
        // and successful body shape so MissingField("task_id") becomes
        // diagnosable. The previous code only mapped parse-fail to Upstream
        // without logging it, so a 200-with-junk-body went silent.
        let v: serde_json::Value = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(e) => {
                let preview: String = text.chars().take(2000).collect();
                tracing::error!(
                    target: "cssos::mv::music",
                    upstream_status = status.as_u16(),
                    parse_error = %e,
                    upstream_body = %preview,
                    body_len = text.len(),
                    "musicgpt: 2xx body failed to parse as JSON"
                );
                return Err(MusicGenError::Upstream {
                    status: status.as_u16(),
                    body: format!("non-json response: {} ({})", e, text),
                });
            }
        };
        tracing::info!(
            target: "cssos::mv::music",
            upstream_status = status.as_u16(),
            top_keys = ?v.as_object().map(|m| m.keys().cloned().collect::<Vec<_>>()).unwrap_or_default(),
            has_task_id = v.get("task_id").is_some(),
            "musicgpt: parsed 2xx response"
        );
        let task_id = v
            .get("task_id")
            .and_then(|x| x.as_str())
            .or_else(|| v.get("taskId").and_then(|x| x.as_str()))
            .ok_or(MusicGenError::MissingField("task_id"))?
            .to_string();
        let conversion_id = v
            .get("conversion_id_1")
            .or_else(|| v.get("conversion_id"))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string());
        Ok(SubmitAck {
            task_id,
            conversion_id,
        })
    }

    async fn poll_until_done(
        &self,
        task: &SubmitAck,
    ) -> Result<MusicGenResult, MusicGenError> {
        let started = std::time::Instant::now();
        let url = format!("{}/api/public/v1/byId", self.cfg.base_url);
        // CSSOS_PHASE2_MUSICGPT_504_RESILIENCE 20260425 #107 — Jing
        // ("音乐引擎冒烟. 504 Gateway Time-out 504 Gateway Time-out
        //   nginx/1.18.0 (Ubuntu)，请改进一下"). MusicGPT's nginx
        // sometimes returns 502/503/504 transiently when the upstream
        // worker is busy at the very end of generation (~94% in the
        // user's screenshot). The previous code already retried 5xx,
        // but only logically — if reqwest itself errored (TCP reset,
        // connection drop, body-read timeout) the `?` would propagate
        // and abort the whole job. We now:
        //   1. Treat reqwest send/text errors as TRANSIENT and retry
        //      with exponential backoff (capped) instead of bailing.
        //   2. Apply backoff on 5xx as well so we don't hammer nginx.
        //   3. Stop only when overall_timeout elapses or upstream
        //      returns 4xx / job-failed / job-canceled.
        let base_delay = self.cfg.poll_interval;
        let max_delay = std::time::Duration::from_secs(30);
        let mut transient_streak: u32 = 0;
        loop {
            if started.elapsed() > self.cfg.overall_timeout {
                return Err(MusicGenError::Timeout(self.cfg.overall_timeout));
            }
            // CSSOS_PHASE2_MUSICGPT_POLL_CONVERSIONTYPE 20260425 #95 —
            // The /byId polling endpoint *also* requires conversionType as a
            // query param. Submit() succeeded with HTTP 200 + valid task_id,
            // but the next poll request 422'd with
            //   {"loc":["query","conversionType"],"msg":"Field required"}
            // That 422 was misattributed to the submit call by the user's UI
            // because both produce identical Display strings. Fix is symmetric
            // to the submit path: always pin conversionType on the GET too.
            let send_result = self
                .http
                .get(&url)
                .query(&[
                    ("task_id", task.task_id.as_str()),
                    ("conversionType", self.cfg.conversion_type.as_str()),
                ])
                .send()
                .await;
            let resp = match send_result {
                Ok(r) => r,
                Err(e) => {
                    // Network-level failure (TCP reset, body timeout, DNS,
                    // TLS, etc.). Treat as transient — back off and try
                    // again until the overall timeout fires.
                    transient_streak = transient_streak.saturating_add(1);
                    let delay = backoff_delay(base_delay, max_delay, transient_streak);
                    tracing::warn!(
                        engine = "musicgpt",
                        task_id = %task.task_id,
                        attempt = transient_streak,
                        backoff_secs = delay.as_secs(),
                        error = %e,
                        "musicgpt poll transport error — retrying"
                    );
                    tokio::time::sleep(delay).await;
                    continue;
                }
            };
            let status = resp.status();
            let text = match resp.text().await {
                Ok(t) => t,
                Err(e) => {
                    transient_streak = transient_streak.saturating_add(1);
                    let delay = backoff_delay(base_delay, max_delay, transient_streak);
                    tracing::warn!(
                        engine = "musicgpt",
                        task_id = %task.task_id,
                        attempt = transient_streak,
                        backoff_secs = delay.as_secs(),
                        error = %e,
                        "musicgpt poll body-read error — retrying"
                    );
                    tokio::time::sleep(delay).await;
                    continue;
                }
            };
            if !status.is_success() {
                // Transient upstream hiccups are allowed; only a definitive 4xx
                // stops us. We treat 5xx (incl. 502/503/504 from nginx in
                // front of MusicGPT) as retryable within the overall window
                // with exponential backoff so we don't dogpile.
                if status.is_client_error() {
                    return Err(MusicGenError::Upstream {
                        status: status.as_u16(),
                        body: text,
                    });
                }
                transient_streak = transient_streak.saturating_add(1);
                let delay = backoff_delay(base_delay, max_delay, transient_streak);
                tracing::warn!(
                    engine = "musicgpt",
                    task_id = %task.task_id,
                    upstream_status = status.as_u16(),
                    attempt = transient_streak,
                    backoff_secs = delay.as_secs(),
                    "musicgpt poll 5xx — retrying"
                );
                tokio::time::sleep(delay).await;
                continue;
            }
            // Success status reached → reset transient streak so a clean
            // 200 in the middle of a flaky session restores normal cadence.
            transient_streak = 0;
            let v: serde_json::Value = match serde_json::from_str(&text) {
                Ok(x) => x,
                Err(_) => {
                    tokio::time::sleep(self.cfg.poll_interval).await;
                    continue;
                }
            };
            let state = v
                .get("status")
                .and_then(|x| x.as_str())
                .or_else(|| v.get("conversion_status").and_then(|x| x.as_str()))
                .unwrap_or("pending")
                .to_ascii_lowercase();
            match state.as_str() {
                "completed" | "success" | "succeeded" | "done" => {
                    return Ok(finalize_result(task, v));
                }
                "failed" | "error" | "canceled" | "cancelled" => {
                    return Err(MusicGenError::JobFailed(
                        v.get("error")
                            .and_then(|x| x.as_str())
                            .unwrap_or("job failed")
                            .to_string(),
                    ));
                }
                _ => {
                    // CSSOS_PHASE2_MUSICGPT_ADAPTIVE_POLL 20260425 #119 — Jing
                    // Two new behaviours:
                    //   1. Adaptive interval: poll every 3 s for the first
                    //      45 s (catches sub-minute jobs immediately), then
                    //      settle to the configured interval. Drops the
                    //      "wait the full 6 s when the result has been
                    //      ready for 5 s" tax that was making short jobs
                    //      feel slow.
                    //   2. Surface upstream progress hint if MusicGPT
                    //      sends one (`progress: 0..1` or `percent: 0..100`).
                    //      Logged at INFO so ops can correlate, and
                    //      future SSE work can stream it to the frontend.
                    if let Some(pct) = read_progress_hint(&v) {
                        tracing::debug!(
                            engine = "musicgpt",
                            task_id = %task.task_id,
                            upstream_progress_pct = pct,
                            "musicgpt poll: upstream progress hint"
                        );
                    }
                    let elapsed = started.elapsed();
                    let poll_delay = if elapsed < std::time::Duration::from_secs(45) {
                        // Eager: 3 s within the first 45 s
                        std::time::Duration::from_secs(3)
                            .min(self.cfg.poll_interval)
                    } else {
                        self.cfg.poll_interval
                    };
                    tokio::time::sleep(poll_delay).await;
                }
            }
        }
    }
}

// CSSOS_PHASE2_MUSICGPT_ADAPTIVE_POLL 20260425 #119 — Jing
// Try to extract a 0..100 progress percentage from common upstream
// response shapes. None when MusicGPT doesn't include a hint.
fn read_progress_hint(v: &serde_json::Value) -> Option<f64> {
    // Try percent (0..100) first.
    for key in ["percent", "progress_percent", "percentage"] {
        if let Some(n) = v.get(key).and_then(|x| x.as_f64()) {
            if (0.0..=100.0).contains(&n) {
                return Some(n);
            }
        }
    }
    // Then progress (0..1 fraction).
    for key in ["progress", "progress_fraction", "completion"] {
        if let Some(n) = v.get(key).and_then(|x| x.as_f64()) {
            if (0.0..=1.0).contains(&n) {
                return Some(n * 100.0);
            }
            if (0.0..=100.0).contains(&n) {
                return Some(n);
            }
        }
    }
    None
}

#[derive(Debug, Clone)]
struct SubmitAck {
    task_id: String,
    conversion_id: Option<String>,
}

// CSSOS_PHASE2_MUSICGPT_504_RESILIENCE 20260425 #107 — Jing
// Exponential backoff with a hard cap. attempt counter starts at 1 on the
// first failure. Doubles each step: poll_interval, 2x, 4x, 8x, … up to
// max_delay. The cap stops us from waiting tens of minutes on a long
// streak before we re-check.
fn backoff_delay(
    base: std::time::Duration,
    cap: std::time::Duration,
    attempt: u32,
) -> std::time::Duration {
    if attempt == 0 {
        return base;
    }
    let pow = attempt.min(8); // 2^8 = 256x — way more than cap, but safe
    let multiplier = 1u64.checked_shl(pow.saturating_sub(1)).unwrap_or(1);
    let secs = base.as_secs().saturating_mul(multiplier);
    let candidate = std::time::Duration::from_secs(secs);
    if candidate > cap {
        cap
    } else {
        candidate
    }
}

fn finalize_result(task: &SubmitAck, v: serde_json::Value) -> MusicGenResult {
    // MusicGPT exposes `conversion_path_1` (MP3) and `conversion_path_2` (WAV).
    // We prefer MP3 because it's universally playable in <audio> and roughly
    // 10x smaller, which matters when we store it as a work asset.
    let mp3 = v
        .get("conversion_path_1")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());
    let wav = v
        .get("conversion_path_2")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());
    let (audio_url, format) = match (mp3, wav) {
        (Some(u), _) => (u, "mp3".to_string()),
        (_, Some(u)) => (u, "wav".to_string()),
        _ => (
            v.get("audio_url")
                .and_then(|x| x.as_str())
                .unwrap_or_default()
                .to_string(),
            "mp3".to_string(),
        ),
    };
    let duration_secs = v
        .get("conversion_duration")
        .or_else(|| v.get("duration"))
        .and_then(|x| x.as_f64());
    let title = v
        .get("title")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());

    // CSSOS_PHASE2_ALIGNED_LYRICS 20260426 #148-D — Jing
    // MusicGPT does not currently expose per-line timing; the extractor
    // returns None and downstream subtitles fall back to even-divide.
    let aligned_lyrics = crate::music_gen::extract_aligned_lyrics(&v);

    MusicGenResult {
        task_id: task.task_id.clone(),
        conversion_id: task.conversion_id.clone(),
        audio_url,
        format,
        duration_secs,
        title,
        raw: v,
        aligned_lyrics,
        // CSSOS_PHASE2_DUAL_TRACK 20260430 #208 — MusicGPT only returns
        // a single track. Suno returns 2; only that adapter populates these.
        alt_audio_url: None,
        alt_duration_secs: None,
        alt_conversion_id: None,
    }
}

// CSSOS_PHASE2_MUSICGPT_RANDOM_BACKFILL 20260419 —
// Normalized, fully-populated MusicGenRequest that we actually serialize to the
// wire. `prompt` and `music_style` are always non-empty (random-bank fallback);
// `lyrics` and `voice_id` stay optional, and `make_instrumental` is flipped
// on when the caller asked for vocals but gave us no lyrics (MusicGPT rejects
// that combination on certain conversionType modes).
#[derive(Debug, Clone)]
struct BackfilledRequest {
    prompt: String,
    music_style: String,
    lyrics: Option<String>,
    make_instrumental: bool,
    voice_id: Option<String>,
}

fn backfill_request_for_musicgpt(req: &MusicGenRequest) -> BackfilledRequest {
    // Prompt: never empty. mv_random_inputs picks a sane zh/en fallback when
    // the user value is blank. We pass `None` for locale so the helper's
    // auto-detect runs against whatever text the user did type.
    let prompt = mv_random_inputs::ensure_prompt(&req.prompt, None);
    // CSSOS_PHASE2_MUSICGPT_422_LIMITS 20260424 #95 — MusicGPT enforces a
    // 200-char prompt limit. Truncating by CHARACTER (not byte) so Chinese
    // + emoji content isn't split mid-codepoint.
    let prompt = truncate_chars(prompt, 200);

    // Music style: same treatment. MusicGPT returns 422 on empty music_style
    // under conversionType=MUSIC_AI for at least one tenant, so we ALWAYS
    // send a non-empty string.
    let music_style = mv_random_inputs::ensure_style(req.music_style.as_deref());
    // CSSOS_PHASE2_MUSICGPT_422_LIMITS 20260424 #95 — MusicGPT returns 422
    // UNPROCESSABLE_CONTENT "Music Style cannot be more than 300 characters"
    // when the style exceeds 300 chars. Truncate defensively so we never
    // emit a request that we know the upstream will reject.
    let music_style = truncate_chars(music_style, 300);

    // Lyrics + instrumental mode are coupled:
    //   - If caller explicitly asked for instrumental, honor it and drop lyrics.
    //   - If caller supplied non-empty lyrics, pass them through as-is.
    //   - Otherwise fill with a random-bank lyric and keep vocals on — this
    //     matches "give him random but reasonable inputs" and is safer than
    //     silently switching to instrumental when the user picked a voice.
    let mut make_instrumental = req.make_instrumental;
    let lyrics_user = req.lyrics.as_deref().map(|s| s.trim()).unwrap_or("");
    let lyrics: Option<String> = if make_instrumental {
        None
    } else if !lyrics_user.is_empty() {
        // CSSOS_PHASE2_MUSICGPT_422_LIMITS 20260424 #95 — MusicGPT's lyrics
        // field has a 2000-char limit; we truncate defensively by character
        // count to avoid 422s on long lyric blocks.
        Some(truncate_chars(lyrics_user.to_string(), 2000))
    } else {
        // No voice picked AND no lyrics AND not explicitly instrumental →
        // if we also lack a voice_id, fall back to instrumental so MusicGPT
        // doesn't error on "vocal track without lyrics or voice".
        let has_voice = req
            .voice_id
            .as_deref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .is_some();
        if has_voice {
            Some(mv_random_inputs::ensure_lyrics(None, None))
        } else {
            make_instrumental = true;
            None
        }
    };

    let voice_id = req
        .voice_id
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    BackfilledRequest {
        prompt,
        music_style,
        lyrics,
        make_instrumental,
        voice_id,
    }
}

// CSSOS_PHASE2_MUSICGPT_422_LIMITS 20260424 #95 —
// Truncate a string to at most `max_chars` Unicode scalar values (not bytes).
// MusicGPT's field limits are expressed in characters in their 422 error
// messages ("Music Style cannot be more than 300 characters"). Using
// `str::len()` (byte length) as the cutoff would either over-count (Chinese
// at 3 bytes/char) or split codepoints; `.chars().take(N)` is the correct
// primitive here. Returns the original string when it's already within limit
// so the common case allocates nothing new beyond the `collect`.
fn truncate_chars(s: String, max_chars: usize) -> String {
    if s.chars().count() <= max_chars {
        return s;
    }
    s.chars().take(max_chars).collect()
}

// CSSOS_PHASE2_MUSICGPT_RANDOM_BACKFILL 20260419 —
// Pydantic 2.5 returns 422 with a structured `detail` array like:
//   {"detail":[{"loc":["body","music_style"],"msg":"Field required","type":"missing"}, ...]}
// We peel that apart and prepend a human-readable hint to the raw body so the
// error trail surfaced in our logs / API responses tells ops exactly which
// field to look at, without them having to re-read pydantic internals. On any
// parse miss we fall back to the raw text — never worse than before.
fn explain_422(status: u16, body: &str) -> String {
    if status != 422 {
        return body.to_string();
    }
    let Ok(v) = serde_json::from_str::<serde_json::Value>(body) else {
        return body.to_string();
    };
    let Some(details) = v.get("detail").and_then(|d| d.as_array()) else {
        return body.to_string();
    };
    let mut parts: Vec<String> = Vec::new();
    for item in details {
        let loc = item
            .get("loc")
            .and_then(|l| l.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|x| x.as_str().map(|s| s.to_string()))
                    .collect::<Vec<_>>()
                    .join(".")
            })
            .unwrap_or_else(|| "?".to_string());
        let msg = item
            .get("msg")
            .and_then(|m| m.as_str())
            .unwrap_or("unknown");
        parts.push(format!("{}: {}", loc, msg));
    }
    if parts.is_empty() {
        return body.to_string();
    }
    format!("422 field errors [{}] — raw: {}", parts.join("; "), body)
}
