use axum::http::HeaderMap;

pub fn pick_lang(query_lang: Option<&str>, headers: &HeaderMap, fallback: Option<&str>) -> &'static str {
    if let Some(q) = query_lang {
        let qn = q.trim().to_lowercase();
        if qn.starts_with("zh") {
            return "zh";
        }
        if qn.starts_with("en") {
            return "en";
        }
    }
    if let Some(v) = headers.get(axum::http::header::ACCEPT_LANGUAGE) {
        if let Ok(s) = v.to_str() {
            let sn = s.to_lowercase();
            if sn.contains("zh") {
                return "zh";
            }
            if sn.contains("en") {
                return "en";
            }
        }
    }
    if let Some(f) = fallback {
        let fnorm = f.trim().to_lowercase();
        if fnorm.starts_with("zh") {
            return "zh";
        }
    }
    "en"
}

pub fn t(lang: &str, key: &str) -> &'static str {
    if lang != "zh" {
        return match key {
            "invalid_request_body" => "invalid request body",
            "too_many_runs" => "too many runs queued or running",
            "run_already_queued" => "run already queued/running",
            "queue_push_failed" => "failed to queue run",
            "run_read_failed" => "failed to read run state",
            "run_not_found" => "run_id not found",
            "cancel_requested" => "cancel requested",
            "failed" => "failed",
            "cancelled" => "cancelled",
            "done" => "done",
            "running" => "running",
            "ready" => "ready",
            "blocked" => "blocked",
            "waiting" => "waiting",
            "bad_outputs" => "bad_outputs",
            "idle" => "idle",
            _ => "",
        };
    }
    match key {
        "invalid_request_body" => "请求体无效",
        "too_many_runs" => "排队或运行中的任务过多",
        "run_already_queued" => "任务已在队列或运行中",
        "queue_push_failed" => "任务入队失败",
        "run_read_failed" => "读取任务状态失败",
        "run_not_found" => "未找到 run_id",
        "cancel_requested" => "已请求取消",
        "failed" => "失败",
        "cancelled" => "已取消",
        "done" => "完成",
        "running" => "运行中",
        "ready" => "就绪",
        "blocked" => "阻塞",
        "waiting" => "等待",
        "bad_outputs" => "产物异常",
        "idle" => "空闲",
        _ => "",
    }
}
