use axum::{
    extract::rejection::JsonRejection,
    extract::Json,
    http::{HeaderMap, StatusCode},
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::cssapi::error::ApiError;
use crate::dag_v3::{build_version_matrix, Intent, ProjectMode};
use crate::orchestrator::prompt::{build_prompt, InputType, MvPrompt};
use crate::runs_api::{RunsCreateRequest, RunsCreateResponse};

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateMvRequest {
    pub input_type: InputType,
    pub voice_url: Option<String>,
    pub text_prompt: Option<String>,
    pub lang: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CreateMvResponse {
    pub schema: &'static str,
    pub input_type: String,
    pub mv_prompt: MvPrompt,
    pub run: RunsCreateResponse,
}

#[utoipa::path(
    post,
    path = "/cssapi/v1/mv/create",
    tag = "runs",
    request_body = CreateMvRequest,
    responses(
        (status = 202, description = "MV run queued", body = CreateMvResponse),
        (status = 422, description = "Invalid request", body = crate::cssapi::problem::Problem),
        (status = 500, description = "Server error", body = crate::cssapi::problem::Problem)
    )
)]
pub async fn create_mv(
    headers: HeaderMap,
    body: Result<Json<CreateMvRequest>, JsonRejection>,
) -> Result<(StatusCode, Json<CreateMvResponse>), ApiError> {
    let Json(body) = body.map_err(|e| {
        ApiError::unprocessable("INVALID_REQUEST", "invalid mv create body").with_details(
            serde_json::json!({
                "reason": e.body_text(),
            }),
        )
    })?;

    let lang = body.lang.as_deref().unwrap_or("auto");
    let mv_prompt = build_prompt(
        &body.input_type,
        body.voice_url.as_deref(),
        body.text_prompt.as_deref(),
        lang,
    );
    let primary_lang = if mv_prompt.lang == "auto" {
        "en".to_string()
    } else {
        mv_prompt.lang.clone()
    };
    let intent = Intent {
        mode: ProjectMode::FromScratch,
        primary_lang: primary_lang.clone(),
        target_langs: vec![primary_lang.clone()],
        target_voices: vec!["female".to_string()],
        karaoke: true,
    };
    let matrix = build_version_matrix(&intent);

    let create_req = RunsCreateRequest {
        cssl: mv_prompt.title.clone(),
        ui_lang: Some(primary_lang.clone()),
        tier: Some("basic".to_string()),
        options: None,
        config: None,
        retry_policy: None,
        commands: Some(serde_json::json!({
            "intent": intent,
            "version_matrix": matrix,
            "creative": {
                "genre": mv_prompt.style,
                "mood": mv_prompt.mood,
                "tempo_bpm": mv_prompt.tempo.parse::<u64>().unwrap_or(100),
                "prompt": mv_prompt.lyrics_prompt,
                "video_prompt": mv_prompt.video_prompt,
            },
            "mv": {
                "input_type": format!("{:?}", body.input_type).to_lowercase(),
                "voice_url": body.voice_url,
                "text_prompt": body.text_prompt,
                "lang": body.lang.unwrap_or_else(|| "auto".to_string())
            }
        })),
    };

    let (status, Json(run)) = crate::runs_api::runs_create(headers, Ok(Json(create_req))).await?;

    Ok((
        status,
        Json(CreateMvResponse {
            schema: "cssapi.mv.create.v1",
            input_type: format!("{:?}", body.input_type).to_lowercase(),
            mv_prompt,
            run,
        }),
    ))
}
