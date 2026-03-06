use crate::cssapi::error::ApiError;

pub fn map_anyhow(err: anyhow::Error) -> ApiError {
    let msg = format!("{err:#}");
    ApiError::internal("INTERNAL", "internal error").with_details(serde_json::json!({
        "cause": msg
    }))
}

pub fn map_io(err: std::io::Error) -> ApiError {
    ApiError::internal("IO_ERROR", "io error").with_details(serde_json::json!({
        "kind": format!("{:?}", err.kind()),
        "message": err.to_string()
    }))
}

pub fn map_sqlx(err: sqlx::Error) -> ApiError {
    ApiError::internal("DB_ERROR", "database error").with_details(serde_json::json!({
        "message": err.to_string()
    }))
}

pub fn map_serde_json(err: serde_json::Error) -> ApiError {
    ApiError::unprocessable("INVALID_JSON", "invalid json").with_details(serde_json::json!({
        "message": err.to_string(),
        "line": err.line(),
        "column": err.column()
    }))
}
