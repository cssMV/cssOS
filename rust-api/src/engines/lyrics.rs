use super::*;
use anyhow::Result;
use serde_json::json;

pub async fn run(ctx: &EngineCtx, commands: &serde_json::Value, ui_lang: &str) -> Result<()> {
    let lang = primary_lang(commands, ui_lang);
    let out = lyrics_json_path(&ctx.run_dir);
    let prompt_json = ctx.run_dir.join("./build/lyrics_prompt.json");

    let prompt = json!({
        "schema": "css.lyrics.prompt.v1",
        "lang": lang,
        "title_hint": title_hint(commands),
        "ui_lang": ui_lang,
        "input": commands.get("input").cloned().unwrap_or_else(|| json!({}))
    });
    write_json(&prompt_json, &prompt).await?;

    if let Some(cmdline) = env_cmd("CSS_LYRICS_CMD") {
        run_cmd(
            &cmdline,
            &ctx.run_dir,
            &[
                ("CSS_LANG", lang.clone()),
                ("CSS_TITLE_HINT", title_hint(commands)),
                ("CSS_PROMPT_JSON", prompt_json.to_string_lossy().to_string()),
                ("CSS_OUT_JSON", out.to_string_lossy().to_string()),
            ],
        )
        .await?;
        validate_lyrics_output(&out).await?;
        let qc = crate::quality_config::load_quality_config();
        let gate =
            crate::quality_gates::gate_lyrics_nonempty_lines(&out, qc.min_lyrics_nonempty_lines)
                .await?;
        if !gate.ok {
            return Err(crate::quality_gates::fail_gate(gate));
        }
        return Ok(());
    }

    let v = json!({
        "schema": "css.lyrics.v1",
        "lang": lang,
        "title": title_hint(commands),
        "lines": [
            { "t": 0.0, "text": "cssMV" },
            { "t": 1.5, "text": "from real entrypoint" }
        ]
    });
    write_json(&out, &v).await?;
    validate_lyrics_output(&out).await?;
    let qc = crate::quality_config::load_quality_config();
    let gate = crate::quality_gates::gate_lyrics_nonempty_lines(&out, qc.min_lyrics_nonempty_lines)
        .await?;
    if !gate.ok {
        return Err(crate::quality_gates::fail_gate(gate));
    }
    Ok(())
}
