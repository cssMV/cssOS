pub fn stage_simple(name: &str) -> String {
    name.to_string()
}

pub fn stage_lang(prefix: &str, lang: &str) -> String {
    format!("{}.{}", prefix, lang)
}

pub fn stage_lang_voice(prefix: &str, lang: &str, voice: &str) -> String {
    format!("{}.{}.{}", prefix, lang, voice)
}

pub fn stage_video_shot(i: usize) -> String {
    format!("video_shot_{:03}", i)
}

pub fn render_path_mv(lang: &str, voice: &str) -> String {
    format!("render/{}/{}/final_mv.mp4", lang, voice)
}

pub fn render_path_karaoke(lang: &str, voice: &str) -> String {
    format!("render/{}/{}/karaoke_mv.mp4", lang, voice)
}

pub fn mix_path(lang: &str, voice: &str) -> String {
    format!("mix/{}/{}.wav", lang, voice)
}

pub fn vocals_path(lang: &str, voice: &str) -> String {
    format!("vocals/{}/{}.wav", lang, voice)
}

pub fn lyrics_path(lang: &str) -> String {
    format!("lyrics/{}.json", lang)
}

pub fn subtitles_path(lang: &str) -> String {
    format!("subtitles/{}.ass", lang)
}

pub fn karaoke_ass_path(lang: &str) -> String {
    format!("karaoke/{}.ass", lang)
}
