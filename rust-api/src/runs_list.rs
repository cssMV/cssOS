use axum::{extract::Query, http::StatusCode, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;
use std::{
    cmp::Reverse,
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Debug, Deserialize)]
pub struct RunsListQuery {
    pub limit: Option<usize>,
    pub status: Option<String>,
}

fn runs_root() -> PathBuf {
    PathBuf::from("build/runs")
}

fn ms(t: SystemTime) -> i64 {
    t.duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub async fn list_runs(Query(q): Query<RunsListQuery>) -> impl IntoResponse {
    let root = runs_root();
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let want_status = q.status.map(|s| s.to_uppercase());

    let mut items: Vec<(i64, serde_json::Value)> = Vec::new();

    let rd = match fs::read_dir(&root) {
        Ok(v) => v,
        Err(e) => {
            return (
                StatusCode::OK,
                Json(json!({
                    "schema":"css.runs.list.v1",
                    "root": root.display().to_string(),
                    "limit": limit as i64,
                    "items": [],
                    "warning": e.to_string()
                })),
            );
        }
    };

    for ent in rd.flatten() {
        let path = ent.path();
        if !path.is_dir() {
            continue;
        }
        let run_id = match path.file_name() {
            Some(v) => v.to_string_lossy().to_string(),
            None => continue,
        };
        let run_json = path.join("run.json");
        if !run_json.exists() {
            continue;
        }
        let mtime = ent
            .metadata()
            .and_then(|m| m.modified())
            .map(ms)
            .unwrap_or(0);

        let txt = fs::read_to_string(&run_json).unwrap_or_else(|_| "{}".into());
        let v: serde_json::Value = serde_json::from_str(&txt).unwrap_or_else(|_| json!({}));
        let st = v
            .get("status")
            .and_then(|x| x.as_str())
            .unwrap_or("UNKNOWN")
            .to_uppercase();

        if let Some(ws) = &want_status {
            if st != *ws {
                continue;
            }
        }

        items.push((
            mtime,
            json!({
                "run_id": run_id,
                "status": st,
                "updated_at_ms": mtime,
                "run_dir": path.display().to_string(),
                "run_json": run_json.display().to_string()
            }),
        ));
    }

    items.sort_by_key(|(t, _)| Reverse(*t));
    let out = items
        .into_iter()
        .take(limit)
        .map(|(_, v)| v)
        .collect::<Vec<_>>();

    (
        StatusCode::OK,
        Json(json!({
            "schema":"css.runs.list.v1",
            "root": root.display().to_string(),
            "limit": limit as i64,
            "status": want_status,
            "items": out
        })),
    )
}
