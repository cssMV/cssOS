use super::{ProviderExecution, ProviderPlan, ProviderVendor};
use anyhow::Result;
use serde_json::json;
use std::path::Path;

pub fn execute(build_dir: &Path, plan: &ProviderPlan) -> Result<ProviderExecution> {
    let profile = super::provider_profile(plan);
    let mapped_preset = super::map_provider_preset(plan);
    let mapped_articulation = super::map_provider_articulation(plan);
    let library_catalog = super::library_catalog(plan);
    let section_templates = super::section_templates(plan);
    let keyswitch_map = super::keyswitch_map(plan);
    let payload_path = build_dir.join("audio_provider_kontakt.payload.json");
    let payload = json!({
        "provider": "kontakt",
        "engine": "kontakt",
        "library": plan.pack,
        "preset": plan.preset,
        "mapped_preset": mapped_preset,
        "articulation": plan.articulation,
        "mapped_articulation": mapped_articulation,
        "style_hint": plan.style_hint,
        "adapter_uri": plan.adapter_uri,
        "target_duration_s": plan.target_duration_s,
        "tempo_bpm": plan.tempo_bpm,
        "voicing_register": plan.voicing_register,
        "percussion_activity": plan.percussion_activity,
        "expression_cc_bias": plan.expression_cc_bias,
        "humanization": plan.humanization,
        "profile": profile,
        "library_catalog": library_catalog,
        "section_templates": section_templates,
        "keyswitch_map": keyswitch_map,
        "render_target": "instrumental-stub"
    });
    let render_args = vec![
        "--payload".to_string(),
        payload_path.to_string_lossy().to_string(),
        "--library".to_string(),
        plan.pack.clone(),
        "--preset".to_string(),
        mapped_preset,
        "--articulation".to_string(),
        mapped_articulation,
        "--mix-preset".to_string(),
        payload["profile"]["default_mix_preset"]
            .as_str()
            .unwrap_or("modern-wide")
            .to_string(),
        "--section-template".to_string(),
        payload["section_templates"][0]["section_name"]
            .as_str()
            .unwrap_or("verse")
            .to_string(),
        "--keyswitch".to_string(),
        payload["keyswitch_map"][0]["keyswitch"]
            .as_str()
            .unwrap_or("C0")
            .to_string(),
        "--tempo".to_string(),
        plan.tempo_bpm.to_string(),
        "--duration".to_string(),
        plan.target_duration_s.to_string(),
    ];
    std::fs::write(&payload_path, serde_json::to_vec_pretty(&payload)?)?;
    Ok(ProviderExecution {
        vendor: ProviderVendor::Kontakt,
        payload_path,
        midi_draft_path: None,
        phrase_map_path: None,
        stems_plan_path: None,
        render_queue_path: None,
        deliverables_manifest_path: None,
        export_policy_path: None,
        package_layout_path: None,
        delivery_metadata_path: None,
        archive_builder_path: None,
        render_handoff_path: None,
        render_bin: Some("kontakt-render".to_string()),
        render_cmdline: Some(super::format_render_cmdline("kontakt-render", &render_args)),
        render_args,
        payload,
    })
}
