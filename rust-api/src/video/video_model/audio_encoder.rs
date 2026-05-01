pub fn encode_audio(features: &[f32]) -> Vec<f32> {
    let mut values = vec![0.0; 1024];
    for (index, feature) in features.iter().enumerate() {
        values[index % 1024] += *feature;
    }
    values
}
