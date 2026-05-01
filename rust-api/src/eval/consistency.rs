use anyhow::Result;
use image::Pixel;

pub fn identity_consistency_score(frame1: &str, frame2: &str) -> Result<f32> {
    let first = image::open(frame1)?.to_rgb8();
    let second = image::open(frame2)?.to_rgb8();
    let width = first.width().min(second.width());
    let height = first.height().min(second.height());
    let mut diff = 0.0f32;

    for y in 0..height {
        for x in 0..width {
            let p1 = first.get_pixel(x, y).channels();
            let p2 = second.get_pixel(x, y).channels();
            diff += ((p1[0] as f32 - p2[0] as f32).abs()
                + (p1[1] as f32 - p2[1] as f32).abs()
                + (p1[2] as f32 - p2[2] as f32).abs())
                / 3.0;
        }
    }

    Ok(diff)
}
