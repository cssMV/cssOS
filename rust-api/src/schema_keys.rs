pub const STABLE_KEYS_V46: [&str; 5] = [
    "final.mv",
    "subtitles.ass",
    "mix.wav",
    "lyrics.json",
    "video.mp4",
];

pub fn stable_keys_v46() -> Vec<String> {
    STABLE_KEYS_V46.iter().map(|s| (*s).to_string()).collect()
}

pub fn stable_keys_v46_ref() -> &'static [&'static str] {
    &STABLE_KEYS_V46
}
