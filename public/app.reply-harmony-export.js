async function copyWatchReplyRegenerationNodeFetchStubModule(payload) {
  if (!payload) return false;
  const body = JSON.stringify(payload, null, 2);
  const command = [
    "const payload = " + body.split("\n").join("\n"),
    "",
    "const response = await fetch(`${process.env.CSSOS_BASE_URL}/cssapi/v1/music/reply-window-regenerate`, {",
    "  method: 'POST',",
    "  headers: {",
    "    'Content-Type': 'application/json',",
    "    Authorization: `Bearer ${process.env.CSSOS_TOKEN}`",
    "  },",
    "  body: JSON.stringify(payload)",
    "});",
    "",
    "if (!response.ok) {",
    "  throw new Error(`reply-window-regenerate failed: ${response.status} ${await response.text()}`);",
    "}",
    "",
    "const result = await response.json();",
    "console.log(result);"
  ].join("\n");
  try {
    await navigator.clipboard.writeText(command);
    showToast(loginCopy("Node fetch stub copied."));
    return true;
  } catch (_err) {
    showToast(loginCopy("Copy failed on this device."));
    return false;
  }
}

async function copyWatchReplyRegenerationRustReqwestStubModule(payload) {
  if (!payload) return false;
  const body = JSON.stringify(payload, null, 2);
  const command = [
    "let payload = serde_json::json!(" + body.split("\n").join("\n") + ");",
    "",
    "let client = reqwest::Client::new();",
    "let response = client",
    '    .post(format!("{}/cssapi/v1/music/reply-window-regenerate", std::env::var("CSSOS_BASE_URL")?))',
    '    .bearer_auth(std::env::var("CSSOS_TOKEN")?)',
    "    .json(&payload)",
    "    .send()",
    "    .await?;",
    "",
    "if !response.status().is_success() {",
    "    let status = response.status();",
    "    let body = response.text().await.unwrap_or_default();",
    '    anyhow::bail!("reply-window-regenerate failed: {} {}", status, body);',
    "}",
    "",
    "let result: serde_json::Value = response.json().await?;",
    'println!("{}", serde_json::to_string_pretty(&result)?);'
  ].join("\n");
  try {
    await navigator.clipboard.writeText(command);
    showToast(loginCopy("Rust reqwest stub copied."));
    return true;
  } catch (_err) {
    showToast(loginCopy("Copy failed on this device."));
    return false;
  }
}

window.copyWatchReplyRegenerationNodeFetchStubModule = copyWatchReplyRegenerationNodeFetchStubModule;
window.copyWatchReplyRegenerationRustReqwestStubModule = copyWatchReplyRegenerationRustReqwestStubModule;
