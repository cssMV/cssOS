use axum::Json;

use crate::cssapi::error::ApiError;

pub type ApiResult<T> = Result<Json<T>, ApiError>;
