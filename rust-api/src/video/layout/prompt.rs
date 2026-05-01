use crate::video::layout::planner::LayoutPlan;

pub fn build_layout_prompt(plan: &LayoutPlan) -> String {
    let secondary = match &plan.secondary_position {
        Some(position) => format!("secondary subject positioned at {}", position),
        None => String::new(),
    };

    format!(
        "SUBJECT POSITION: {subject}, {secondary}, DEPTH LAYERS: {depth}, FOCUS: {focus}, rule of thirds composition, balanced cinematic framing, clear subject separation, no overlapping confusion, no subject cropped out of frame",
        subject = plan.subject_position,
        secondary = secondary,
        depth = plan.depth_layers,
        focus = plan.focus,
    )
}
