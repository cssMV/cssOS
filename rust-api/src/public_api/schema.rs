use axum::Json;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MvApiSchema {
    pub schema: &'static str,
    pub required_fields: Vec<String>,
    pub optional_fields: Vec<String>,
    pub example: serde_json::Value,
}

pub async fn api_mv_schema() -> Json<MvApiSchema> {
    Json(MvApiSchema {
        schema: "cssapi.public.schema.mv.v1",
        required_fields: vec!["engine".into(), "input".into()],
        optional_fields: vec!["creative".into(), "versions".into()],
        example: serde_json::json!({
            "engine": {
                "name": "cssmv",
                "version": "v3.0"
            },
            "input": {
                "type": "text",
                "text": "cyberpunk night song"
            },
            "versions": {
                "langs": ["en"],
                "voices": ["female"],
                "outputs": ["mv"]
            }
        }),
    })
}
