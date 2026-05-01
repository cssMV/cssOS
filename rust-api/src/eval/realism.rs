use anyhow::Result;

pub fn realism_score(frame_path: &str) -> Result<f32> {
    let img = image::open(frame_path)?.to_rgb8();
    let mut variance = 0.0f32;
    let mut mean = 0.0f32;
    let mut count = 0.0f32;

    for pixel in img.pixels() {
        let val = (pixel[0] as f32 + pixel[1] as f32 + pixel[2] as f32) / 3.0;
        mean += val;
        count += 1.0;
    }

    if count == 0.0 {
        return Ok(0.0);
    }

    mean /= count;

    for pixel in img.pixels() {
        let val = (pixel[0] as f32 + pixel[1] as f32 + pixel[2] as f32) / 3.0;
        variance += (val - mean).powf(2.0);
    }

    variance /= count;
    Ok(variance)
}
