use cssos_rust_api::cssapi::openapi::build_openapi;

#[test]
fn openapi_builds_and_serializes() {
    let doc = build_openapi();
    let s = serde_json::to_string(&doc).expect("serialize openapi");
    assert!(s.contains("\"openapi\""));
    assert!(s.contains("/cssapi/v1/runs"));
    assert!(s.contains("/cssapi/v1/openapi.json"));
}
