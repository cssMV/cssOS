use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use std::collections::BTreeMap;

use crate::ready::{QualityScore, QualitySummary, QualityTrend, QualityTrendPoint};
use crate::run_state::RunState;

const SCHEMA_SQL: &str = include_str!("../migrations/20260310_000002_quality_history.sql");
const SCHEMA_SQL_V2: &str =
    include_str!("../migrations/20260311_000003_quality_history_subtitles_delta.sql");
const SCHEMA_SQL_V3: &str = include_str!(
    "../migrations/20260311_000004_quality_history_subtitles_delta_before_improved.sql"
);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualitySnapshot {
    pub run_id: String,
    pub seq: u64,
    pub ts: String,
    pub score: u32,
    pub max: u32,
    pub milestone_ready: bool,
    pub blocking_gate: Option<String>,
    pub subtitles_audio_delta_s: Option<f64>,
    pub subtitles_audio_max_delta_s: Option<f64>,
    pub subtitles_audio_delta_before_s: Option<f64>,
    pub subtitles_audio_delta_improved_s: Option<f64>,
    pub breakdown: BTreeMap<String, u32>,
    pub summary: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityLatest {
    pub run_id: String,
    pub created_at: String,
    pub updated_at: String,
    pub status: String,
    pub quality_score: u32,
    pub quality_max: u32,
    pub milestone_ready: bool,
    pub blocking_gate: Option<String>,
    pub subtitles_audio_delta_s: Option<f64>,
    pub subtitles_audio_max_delta_s: Option<f64>,
    pub subtitles_audio_delta_before_s: Option<f64>,
    pub subtitles_audio_delta_improved_s: Option<f64>,
    pub primary_lang: Option<String>,
    pub title_hint: Option<String>,
    pub artifacts_present: Vec<String>,
    pub final_mv_bytes: Option<u64>,
    pub latest_seq: u64,
}

pub async fn init_db(pool: &PgPool) -> Result<()> {
    for schema in [SCHEMA_SQL, SCHEMA_SQL_V2, SCHEMA_SQL_V3] {
        for stmt in schema.split(";").map(str::trim).filter(|s| !s.is_empty()) {
            sqlx::query(stmt).execute(pool).await?;
        }
    }
    Ok(())
}

fn artifacts_present(st: &RunState) -> Vec<String> {
    let mut out: Vec<String> = st.artifacts.iter().map(|a| a.kind.clone()).collect();
    out.sort();
    out.dedup();
    out
}

fn final_mv_bytes(st: &RunState) -> Option<u64> {
    st.artifacts
        .iter()
        .find(|a| a.kind == "final_mv" || a.kind == "final.mv")
        .and_then(|a| {
            let full_path = st.config.out_dir.join(&a.path);
            std::fs::metadata(full_path).ok().map(|m| m.len())
        })
}

fn title_hint(st: &RunState) -> Option<String> {
    st.commands
        .get("title_hint")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

fn primary_lang(st: &RunState) -> Option<String> {
    st.commands
        .get("lyrics")
        .and_then(|v| v.get("primary_lang"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| Some(st.ui_lang.clone()))
}

pub fn make_snapshot(st: &RunState, qs: &QualityScore, q: &QualitySummary) -> QualitySnapshot {
    let (subtitles_audio_delta_s, subtitles_audio_max_delta_s) = q
        .subtitles_audio_delta
        .as_ref()
        .map(|x| (Some(x.delta_s), Some(x.max_delta_s)))
        .unwrap_or((None, None));
    QualitySnapshot {
        run_id: st.run_id.clone(),
        seq: st.stage_seq,
        ts: st.updated_at.clone(),
        score: qs.score,
        max: qs.max,
        milestone_ready: q.milestone_ready,
        blocking_gate: q.blocking_gate.clone(),
        subtitles_audio_delta_s,
        subtitles_audio_max_delta_s,
        subtitles_audio_delta_before_s: q.subtitles_audio_delta_before_s,
        subtitles_audio_delta_improved_s: q.subtitles_audio_delta_improved_s,
        breakdown: qs.breakdown.clone(),
        summary: Some(serde_json::json!({
            "quality": q,
            "quality_score": qs
        })),
    }
}

pub fn make_latest(st: &RunState, qs: &QualityScore, q: &QualitySummary) -> QualityLatest {
    let (subtitles_audio_delta_s, subtitles_audio_max_delta_s) = q
        .subtitles_audio_delta
        .as_ref()
        .map(|x| (Some(x.delta_s), Some(x.max_delta_s)))
        .unwrap_or((None, None));
    QualityLatest {
        run_id: st.run_id.clone(),
        created_at: st.created_at.clone(),
        updated_at: st.updated_at.clone(),
        status: format!("{:?}", st.status),
        quality_score: qs.score,
        quality_max: qs.max,
        milestone_ready: q.milestone_ready,
        blocking_gate: q.blocking_gate.clone(),
        subtitles_audio_delta_s,
        subtitles_audio_max_delta_s,
        subtitles_audio_delta_before_s: q.subtitles_audio_delta_before_s,
        subtitles_audio_delta_improved_s: q.subtitles_audio_delta_improved_s,
        primary_lang: primary_lang(st),
        title_hint: title_hint(st),
        artifacts_present: artifacts_present(st),
        final_mv_bytes: final_mv_bytes(st),
        latest_seq: st.stage_seq,
    }
}

pub async fn insert_snapshot_if_changed(pool: &PgPool, snapshot: &QualitySnapshot) -> Result<bool> {
    let row = sqlx::query_as::<
        _,
        (
            i32,
            i32,
            bool,
            Option<String>,
            Option<f64>,
            Option<f64>,
            Option<f64>,
            Option<f64>,
            serde_json::Value,
        ),
    >(
        r#"
        SELECT score, max_score, milestone_ready, blocking_gate, subtitles_audio_delta_s, subtitles_audio_max_delta_s,
               subtitles_audio_delta_before_s, subtitles_audio_delta_improved_s, breakdown_json
        FROM run_quality_snapshots
        WHERE run_id = $1
        ORDER BY seq DESC
        LIMIT 1
        "#,
    )
    .bind(&snapshot.run_id)
    .fetch_optional(pool)
    .await?;

    if let Some((
        score,
        max_score,
        milestone_ready,
        blocking_gate,
        subtitles_audio_delta_s,
        subtitles_audio_max_delta_s,
        subtitles_audio_delta_before_s,
        subtitles_audio_delta_improved_s,
        breakdown_json,
    )) = row
    {
        let prev_breakdown: BTreeMap<String, u32> =
            serde_json::from_value(breakdown_json).unwrap_or_default();
        let changed = score as u32 != snapshot.score
            || max_score as u32 != snapshot.max
            || milestone_ready != snapshot.milestone_ready
            || blocking_gate != snapshot.blocking_gate
            || subtitles_audio_delta_s != snapshot.subtitles_audio_delta_s
            || subtitles_audio_max_delta_s != snapshot.subtitles_audio_max_delta_s
            || subtitles_audio_delta_before_s != snapshot.subtitles_audio_delta_before_s
            || subtitles_audio_delta_improved_s != snapshot.subtitles_audio_delta_improved_s
            || prev_breakdown != snapshot.breakdown;
        if !changed {
            return Ok(false);
        }
    }

    let inserted = sqlx::query(
        r#"
        INSERT INTO run_quality_snapshots
          (run_id, seq, ts, score, max_score, milestone_ready, blocking_gate, subtitles_audio_delta_s, subtitles_audio_max_delta_s,
           subtitles_audio_delta_before_s, subtitles_audio_delta_improved_s, breakdown_json, summary_json)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb)
        ON CONFLICT (run_id, seq) DO NOTHING
        "#,
    )
    .bind(&snapshot.run_id)
    .bind(snapshot.seq as i64)
    .bind(&snapshot.ts)
    .bind(snapshot.score as i32)
    .bind(snapshot.max as i32)
    .bind(snapshot.milestone_ready)
    .bind(&snapshot.blocking_gate)
    .bind(snapshot.subtitles_audio_delta_s)
    .bind(snapshot.subtitles_audio_max_delta_s)
    .bind(snapshot.subtitles_audio_delta_before_s)
    .bind(snapshot.subtitles_audio_delta_improved_s)
    .bind(serde_json::to_string(&snapshot.breakdown)?)
    .bind(snapshot.summary.as_ref().map(serde_json::to_string).transpose()?)
    .execute(pool)
    .await?
    .rows_affected();

    Ok(inserted > 0)
}

pub async fn upsert_latest(pool: &PgPool, latest: &QualityLatest) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO run_quality_latest
          (run_id, created_at, updated_at, status, quality_score, quality_max, milestone_ready,
           blocking_gate, subtitles_audio_delta_s, subtitles_audio_max_delta_s, subtitles_audio_delta_before_s, subtitles_audio_delta_improved_s,
           primary_lang, title_hint, artifacts_present_json, final_mv_bytes, latest_seq)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16)
        ON CONFLICT (run_id) DO UPDATE SET
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          status = EXCLUDED.status,
          quality_score = EXCLUDED.quality_score,
          quality_max = EXCLUDED.quality_max,
          milestone_ready = EXCLUDED.milestone_ready,
          blocking_gate = EXCLUDED.blocking_gate,
          subtitles_audio_delta_s = EXCLUDED.subtitles_audio_delta_s,
          subtitles_audio_max_delta_s = EXCLUDED.subtitles_audio_max_delta_s,
          subtitles_audio_delta_before_s = EXCLUDED.subtitles_audio_delta_before_s,
          subtitles_audio_delta_improved_s = EXCLUDED.subtitles_audio_delta_improved_s,
          primary_lang = EXCLUDED.primary_lang,
          title_hint = EXCLUDED.title_hint,
          artifacts_present_json = EXCLUDED.artifacts_present_json,
          final_mv_bytes = EXCLUDED.final_mv_bytes,
          latest_seq = EXCLUDED.latest_seq
        "#,
    )
    .bind(&latest.run_id)
    .bind(&latest.created_at)
    .bind(&latest.updated_at)
    .bind(&latest.status)
    .bind(latest.quality_score as i32)
    .bind(latest.quality_max as i32)
    .bind(latest.milestone_ready)
    .bind(&latest.blocking_gate)
    .bind(latest.subtitles_audio_delta_s)
    .bind(latest.subtitles_audio_max_delta_s)
    .bind(latest.subtitles_audio_delta_before_s)
    .bind(latest.subtitles_audio_delta_improved_s)
    .bind(&latest.primary_lang)
    .bind(&latest.title_hint)
    .bind(serde_json::to_string(&latest.artifacts_present)?)
    .bind(latest.final_mv_bytes.map(|x| x as i64))
    .bind(latest.latest_seq as i64)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn load_latest_two_scores(pool: &PgPool, run_id: &str) -> Result<Vec<QualitySnapshot>> {
    let rows = sqlx::query_as::<
        _,
        (
            String,
            i64,
            String,
            i32,
            i32,
            bool,
            Option<String>,
            Option<f64>,
            Option<f64>,
            Option<f64>,
            Option<f64>,
            serde_json::Value,
            Option<serde_json::Value>,
        ),
    >(
        r#"
        SELECT run_id, seq, ts, score, max_score, milestone_ready, blocking_gate, subtitles_audio_delta_s, subtitles_audio_max_delta_s,
               subtitles_audio_delta_before_s, subtitles_audio_delta_improved_s, breakdown_json, summary_json
        FROM run_quality_snapshots
        WHERE run_id = $1
        ORDER BY seq DESC
        LIMIT 2
        "#,
    )
    .bind(run_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(
            |(
                run_id,
                seq,
                ts,
                score,
                max,
                milestone_ready,
                blocking_gate,
                subtitles_audio_delta_s,
                subtitles_audio_max_delta_s,
                subtitles_audio_delta_before_s,
                subtitles_audio_delta_improved_s,
                breakdown_json,
                summary_json,
            )| {
                QualitySnapshot {
                    run_id,
                    seq: seq as u64,
                    ts,
                    score: score as u32,
                    max: max as u32,
                    milestone_ready,
                    blocking_gate,
                    subtitles_audio_delta_s,
                    subtitles_audio_max_delta_s,
                    subtitles_audio_delta_before_s,
                    subtitles_audio_delta_improved_s,
                    breakdown: serde_json::from_value(breakdown_json).unwrap_or_default(),
                    summary: summary_json,
                }
            },
        )
        .collect())
}

pub async fn make_trend_lite(
    pool: &PgPool,
    run_id: &str,
    window: Option<i64>,
) -> Result<Option<QualityTrend>> {
    let lim = window.unwrap_or(20).clamp(2, 200);
    let mut xs = sqlx::query_as::<
        _,
        (
            String,
            i64,
            String,
            i32,
            i32,
            bool,
            Option<String>,
            Option<f64>,
            Option<f64>,
            Option<f64>,
            Option<f64>,
            serde_json::Value,
            Option<serde_json::Value>,
        ),
    >(
        r#"
        SELECT run_id, seq, ts, score, max_score, milestone_ready, blocking_gate, subtitles_audio_delta_s, subtitles_audio_max_delta_s,
               subtitles_audio_delta_before_s, subtitles_audio_delta_improved_s, breakdown_json, summary_json
        FROM run_quality_snapshots
        WHERE run_id = $1
        ORDER BY seq DESC
        LIMIT $2
        "#,
    )
    .bind(run_id)
    .bind(lim)
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(
        |(
            run_id,
            seq,
            ts,
            score,
            max,
            milestone_ready,
            blocking_gate,
            subtitles_audio_delta_s,
            subtitles_audio_max_delta_s,
            subtitles_audio_delta_before_s,
            subtitles_audio_delta_improved_s,
            breakdown_json,
            summary_json,
        )| {
            QualitySnapshot {
                run_id,
                seq: seq as u64,
                ts,
                score: score as u32,
                max: max as u32,
                milestone_ready,
                blocking_gate,
                subtitles_audio_delta_s,
                subtitles_audio_max_delta_s,
                subtitles_audio_delta_before_s,
                subtitles_audio_delta_improved_s,
                breakdown: serde_json::from_value(breakdown_json).unwrap_or_default(),
                summary: summary_json,
            }
        },
    )
    .collect::<Vec<_>>();
    if xs.is_empty() {
        return Ok(None);
    }
    let latest_snapshot = xs[0].clone();
    let latest = latest_snapshot.score;
    let previous = xs.get(1).map(|x| x.score);
    let delta = previous.map(|p| latest as i32 - p as i32).unwrap_or(0);
    xs.reverse();
    let series = xs.iter().map(|x| x.score).collect();
    let points = xs
        .iter()
        .map(|x| QualityTrendPoint {
            ts: x.ts.clone(),
            score: x.score,
            subtitles_audio_delta_before_s: x.subtitles_audio_delta_before_s,
            subtitles_audio_delta_s: x.subtitles_audio_delta_s,
            subtitles_audio_delta_improved_s: x.subtitles_audio_delta_improved_s,
        })
        .collect();
    Ok(Some(QualityTrend {
        latest,
        previous,
        delta,
        series,
        points,
        component_latest: latest_snapshot.breakdown,
    }))
}

pub async fn load_history(
    pool: &PgPool,
    run_id: &str,
    limit: Option<i64>,
) -> Result<Vec<QualitySnapshot>> {
    let lim = limit.unwrap_or(500).clamp(1, 5000);
    let rows = sqlx::query_as::<
        _,
        (
            String,
            i64,
            String,
            i32,
            i32,
            bool,
            Option<String>,
            Option<f64>,
            Option<f64>,
            Option<f64>,
            Option<f64>,
            serde_json::Value,
            Option<serde_json::Value>,
        ),
    >(
        r#"
        SELECT run_id, seq, ts, score, max_score, milestone_ready, blocking_gate, subtitles_audio_delta_s, subtitles_audio_max_delta_s,
               subtitles_audio_delta_before_s, subtitles_audio_delta_improved_s, breakdown_json, summary_json
        FROM run_quality_snapshots
        WHERE run_id = $1
        ORDER BY seq DESC
        LIMIT $2
        "#,
    )
    .bind(run_id)
    .bind(lim)
    .fetch_all(pool)
    .await?;

    let mut out = rows
        .into_iter()
        .map(
            |(
                run_id,
                seq,
                ts,
                score,
                max,
                milestone_ready,
                blocking_gate,
                subtitles_audio_delta_s,
                subtitles_audio_max_delta_s,
                subtitles_audio_delta_before_s,
                subtitles_audio_delta_improved_s,
                breakdown_json,
                summary_json,
            )| {
                QualitySnapshot {
                    run_id,
                    seq: seq as u64,
                    ts,
                    score: score as u32,
                    max: max as u32,
                    milestone_ready,
                    blocking_gate,
                    subtitles_audio_delta_s,
                    subtitles_audio_max_delta_s,
                    subtitles_audio_delta_before_s,
                    subtitles_audio_delta_improved_s,
                    breakdown: serde_json::from_value(breakdown_json).unwrap_or_default(),
                    summary: summary_json,
                }
            },
        )
        .collect::<Vec<_>>();
    out.sort_by_key(|x| x.seq);
    Ok(out)
}
