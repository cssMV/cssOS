use crate::video::style::profile::StyleProfile;

pub fn build_style_prompt(style: &StyleProfile) -> String {
    format!(
        "GLOBAL STYLE LOCK: profile {name}, color grading: {color}, lighting: {light}, texture: {texture}, camera style: {camera}, MUST maintain identical visual style across all frames, no color shift, no lighting change, no style drift",
        name = style.name,
        color = style.color_grading,
        light = style.lighting,
        texture = style.texture,
        camera = style.camera,
    )
}
