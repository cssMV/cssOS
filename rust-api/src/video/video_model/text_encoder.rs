pub fn encode_text(text: &str) -> Vec<f32> {
    let mut values = vec![0.0; 1024];
    for (index, byte) in text.bytes().enumerate() {
        values[index % 1024] += byte as f32 / 255.0;
    }
    values
}
