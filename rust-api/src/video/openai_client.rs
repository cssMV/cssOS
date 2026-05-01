use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use base64::Engine;
use reqwest::blocking::multipart::{Form, Part};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAiImageRequest {
    pub prompt: String,
    pub size: String,
    pub quality: String,
    pub output_format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAiImageAsset {
    pub output_path: String,
    pub revised_prompt: Option<String>,
}

pub fn can_use_openai_image_pipeline() -> bool {
    std::env::var("OPENAI_API_KEY")
        .ok()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
}

pub fn generate_image_asset(
    request: &OpenAiImageRequest,
    output_path: &Path,
) -> Result<OpenAiImageAsset> {
    let client = Client::new();
    let api_key = std::env::var("OPENAI_API_KEY").context("OPENAI_API_KEY is required")?;
    let model = std::env::var("OPENAI_IMAGE_MODEL")
        .or_else(|_| std::env::var("CSS_OPENAI_IMAGE_MODEL"))
        .unwrap_or_else(|_| "gpt-image-1".to_string());
    let endpoint = std::env::var("CSS_OPENAI_IMAGE_URL")
        .unwrap_or_else(|_| "https://api.openai.com/v1/images/generations".to_string());
    let payload = json!({
        "model": model,
        "prompt": request.prompt,
        "size": request.size,
        "quality": request.quality,
        "output_format": request.output_format,
        "background": "opaque"
    });
    let response = client
        .post(&endpoint)
        .bearer_auth(&api_key)
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .context("requesting OpenAI image")?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().unwrap_or_default();
        return Err(anyhow!("OpenAI image request failed: {} {}", status, body));
    }
    let json: serde_json::Value = response.json()?;
    let item = json
        .get("data")
        .and_then(serde_json::Value::as_array)
        .and_then(|items| items.first())
        .ok_or_else(|| anyhow!("missing image result in OpenAI response"))?;
    let image_base64 = item
        .get("b64_json")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| anyhow!("missing image bytes in OpenAI response"))?;
    let revised_prompt = item
        .get("revised_prompt")
        .and_then(serde_json::Value::as_str)
        .map(ToString::to_string);
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(image_base64)
        .context("decoding OpenAI image bytes")?;
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_path, bytes)?;
    Ok(OpenAiImageAsset {
        output_path: output_path.to_string_lossy().to_string(),
        revised_prompt,
    })
}

pub fn generate_image(api_key: &str, prompt: &str, output_path: &str) -> Result<()> {
    let _ = api_key;
    let request = OpenAiImageRequest {
        prompt: prompt.to_string(),
        size: "1536x1024".to_string(),
        quality: "medium".to_string(),
        output_format: "png".to_string(),
    };
    let _ = generate_image_asset(&request, Path::new(output_path))?;
    Ok(())
}

pub fn edit_image_with_reference(
    api_key: &str,
    prompt: &str,
    reference_image_path: &Path,
    output_path: &str,
) -> Result<()> {
    let _ = api_key;
    let client = Client::new();
    let api_key = std::env::var("OPENAI_API_KEY").context("OPENAI_API_KEY is required")?;
    let model = std::env::var("OPENAI_IMAGE_MODEL")
        .or_else(|_| std::env::var("CSS_OPENAI_IMAGE_MODEL"))
        .unwrap_or_else(|_| "gpt-image-1".to_string());
    let endpoint = std::env::var("CSS_OPENAI_IMAGE_EDITS_URL")
        .unwrap_or_else(|_| "https://api.openai.com/v1/images/edits".to_string());
    let image_bytes = fs::read(reference_image_path).with_context(|| {
        format!(
            "reading reference image for edit {}",
            reference_image_path.display()
        )
    })?;
    let image_part = Part::bytes(image_bytes)
        .file_name(
            reference_image_path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("reference.png")
                .to_string(),
        )
        .mime_str("image/png")
        .context("setting mime for image edit part")?;
    let form = Form::new()
        .text("model", model)
        .text("prompt", prompt.to_string())
        .text("size", "1536x1024".to_string())
        .text("quality", "medium".to_string())
        .text("output_format", "png".to_string())
        .text("input_fidelity", "high".to_string())
        .part("image", image_part);
    let response = client
        .post(&endpoint)
        .bearer_auth(&api_key)
        .multipart(form)
        .send()
        .context("requesting OpenAI image edit")?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().unwrap_or_default();
        return Err(anyhow!("OpenAI image edit failed: {} {}", status, body));
    }
    let json: serde_json::Value = response.json()?;
    let item = json
        .get("data")
        .and_then(serde_json::Value::as_array)
        .and_then(|items| items.first())
        .ok_or_else(|| anyhow!("missing image edit result in OpenAI response"))?;
    let image_base64 = item
        .get("b64_json")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| anyhow!("missing edited image bytes in OpenAI response"))?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(image_base64)
        .context("decoding OpenAI image edit bytes")?;
    let output_path = Path::new(output_path);
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_path, bytes)?;
    Ok(())
}

pub fn generate_images(
    api_key: &str,
    prompt: &str,
    count: usize,
    scene_id: u32,
) -> Result<Vec<String>> {
    let mut outputs = Vec::with_capacity(count);
    for index in 0..count {
        let path = format!("output/scene_{}_{}.png", scene_id, index);
        generate_image(api_key, prompt, &path)?;
        outputs.push(path);
    }
    Ok(outputs)
}

pub fn asset_output_path(dir: &Path, basename: &str, index: usize, format: &str) -> PathBuf {
    dir.join(format!(
        "{basename}_{index:02}.{}",
        format.to_ascii_lowercase()
    ))
}
