use anyhow::{anyhow, Result};
use std::path::Path;
use std::process::Command;

pub fn exec_cmd(cmd: &str) -> Result<()> {
    let status = Command::new("sh").arg("-lc").arg(cmd).status()?;
    if !status.success() {
        return Err(anyhow!("command failed: {cmd}"));
    }
    Ok(())
}

pub fn exec_cmd_in_dir(cmd: &str, cwd: Option<&Path>) -> Result<()> {
    let mut proc = Command::new("sh");
    proc.arg("-lc").arg(cmd);
    if let Some(dir) = cwd {
        proc.current_dir(dir);
    }
    let status = proc.status()?;
    if !status.success() {
        return Err(anyhow!("command failed: {cmd}"));
    }
    Ok(())
}

pub fn wrap_stage_command(stage: &str, cmd: &str) -> String {
    let banner = match stage {
        "lyrics" => Some("cssMV lyrics engine"),
        "music" => Some("cssMV music engine"),
        "vocals" => Some("cssMV vocals engine"),
        "video" | "video_plan" | "video_assemble" => Some("cssMV video engine"),
        "render" => Some("cssMV render engine"),
        _ => None,
    };

    if let Some(msg) = banner {
        format!("echo {q}; {cmd}", q = shell_quote(msg), cmd = cmd)
    } else {
        cmd.to_string()
    }
}

fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}
