use cssos_rust_api::cssapi::openapi::build_openapi;

#[test]
fn openapi_v1_generates_and_has_key_paths() {
    let doc = build_openapi();
    let json = serde_json::to_value(&doc).expect("openapi serialize");

    let paths = json.get("paths").expect("paths");
    let has = |p: &str| paths.get(p).is_some();

    assert!(has("/cssapi/v1/openapi.json"));
    assert!(has("/cssapi/v1/runs"));
    assert!(has("/cssapi/v1/runs/{run_id}"));
    assert!(has("/cssapi/v1/runs/{run_id}/status"));
    assert!(has("/cssapi/v1/runs/{run_id}/ready"));
}
