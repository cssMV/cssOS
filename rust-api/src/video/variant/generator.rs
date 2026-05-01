use super::types::Variant;

pub fn generate_variants(base_prompt: &str, count: usize) -> Vec<Variant> {
    let count = count.max(1);
    (0..count)
        .map(|index| {
            let prompt = match index {
                0 => format!("{base_prompt}, cinematic lighting, epic film still"),
                1 => format!("{base_prompt}, dramatic lighting, high contrast, intense"),
                2 => format!("{base_prompt}, soft lighting, emotional, shallow depth of field"),
                3 => format!("{base_prompt}, wide shot, grand scale, environment focus"),
                _ => format!("{base_prompt}, stylized cinematic variant {}", index + 1),
            };
            Variant {
                id: format!("v{index}"),
                prompt,
            }
        })
        .collect()
}
