use super::{score_image, RenderContext, RenderScore};

pub fn evaluate_batch(images: &[String], context: &RenderContext) -> Vec<(String, RenderScore)> {
    images
        .iter()
        .map(|image| (image.clone(), score_image(image, context)))
        .collect()
}
