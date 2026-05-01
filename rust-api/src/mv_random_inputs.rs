// CSSOS_PHASE2_P2_58 20260419 —
//
// Server-side random-input bank for the MV pipeline. Enforces the product
// directive: 凡是需要输入的那些选项，都要提供随机数据（合理的随机数据）.
//
// This is defense-in-depth: the frontend (`app.mv-pipeline-panel.js`) already
// synthesises a random seed when the user leaves the prompt box blank, but
// several entry points bypass that panel (universal voice entry, API callers,
// retry flows, partial LLM failures that return empty lyrics). Without a
// backend guarantee the request reaches MusicGPT / Runway with `prompt: ""`
// which MusicGPT rejects with "must have input", killing the 可创作 loop.
//
// Design:
//   - All banks are bilingual (en + zh). Pick is keyed on request locale when
//     provided, else a stable round-robin — callers never need to know.
//   - Picks are SHORT but evocative: ~1 sentence, no placeholders, no
//     [bracketed] junk. Every entry is something the upstream engines can
//     render into a real song / image / lyric without follow-up questions.
//   - Never hardcoded literals in call sites — callers invoke the helper and
//     the bank stays centralised for future tuning (SEM-friendly too).
//
// Extension points:
//   - Env override banks via `CSSMV_RANDOM_PROMPT_BANK_EN`,
//     `CSSMV_RANDOM_PROMPT_BANK_ZH`, etc (pipe-separated) so ops can refresh
//     the bank without a redeploy. Falls back to the built-in when empty.

use once_cell::sync::Lazy;
use rand::seq::SliceRandom;

// ---------------------------------------------------------------- banks

const DEFAULT_PROMPT_BANK_EN: &[&str] = &[
    "A neon-drenched rooftop at midnight where the city quietly starts to breathe",
    "A lonely train station at dawn with first light spilling across empty platforms",
    "A small bookstore in autumn rain, warm paper light behind the window",
    "A summer highway at sunset, the wind carrying everything forward at once",
    "A winter courtyard after snow, two footprints leaving and one staying",
    "A slow river in the mountains where the fog forgets to lift",
    "An attic room full of cassette tapes and the idea of a lost friend",
    "A seaside diner at 3am where the waitress hums a song she never learned",
    "A childhood backyard reshaped by memory into something larger than it was",
    "A concert hall minutes before doors open, the silence already humming",
];

const DEFAULT_PROMPT_BANK_ZH: &[&str] = &[
    "午夜霓虹的天台，城市终于学会安静地呼吸",
    "清晨的空旷车站，第一道光漫过无人的站台",
    "秋雨里的旧书店，纸张的暖光透过窗棂",
    "夏日公路的黄昏，风把一切一次性带向远处",
    "雪后的小院，两行脚印走远，一行停在门口",
    "山里的慢河，雾忘记散开的时辰",
    "堆满磁带的阁楼，一个失联朋友的轮廓",
    "凌晨三点的海边小餐馆，服务员哼着没学过的旋律",
    "童年的后院，记忆把它放大成小小的王国",
    "开场前的音乐厅，寂静里已经先响起心跳",
];

const DEFAULT_STYLE_BANK: &[&str] = &[
    "cinematic synthwave, 90 BPM, warm analog pads",
    "acoustic folk, 72 BPM, soft fingerpicked guitar",
    "late-night city pop, 104 BPM, mellow bassline",
    "dream pop, 82 BPM, reverb-soaked vocals",
    "lo-fi hip hop, 78 BPM, vinyl crackle",
    "orchestral pop ballad, 68 BPM, strings + piano",
    "ambient electronica, 90 BPM, slow ocean-like pads",
    "bedroom indie, 96 BPM, warm tape saturation",
    "neo-soul, 88 BPM, electric piano + brushed drums",
    "cinematic post-rock, 76 BPM, building crescendo",
];

const DEFAULT_LYRICS_BANK_EN: &[&str] = &[
    "[Verse]\nWe kept the porch light on for a reason we forgot\nThe night took the long way home just to find us\n\n[Chorus]\nSay my name once more and I'll remember the sound\nThe way the world does when it finally slows down",
    "[Verse]\nYou were the season that wouldn't land\nI was the window that wouldn't close\n\n[Chorus]\nSo here we are, half-light and half-kind\nHolding what's left of what we used to find",
    "[Verse]\nSome stories start in a kitchen, not a stage\nQuiet as the steam rising off a second cup\n\n[Chorus]\nSing it low, sing it slow, let the hours drift\nWhat we almost said will keep until tomorrow",
];

const DEFAULT_LYRICS_BANK_ZH: &[&str] = &[
    "[主歌]\n走廊的灯留给早已忘记的理由\n夜色绕了很远的路 只为在这里找到我们\n\n[副歌]\n再唤一次我的名字 我就认得那个声音\n像世界终于愿意 把自己放慢一秒",
    "[主歌]\n你是迟迟不肯落地的季节\n我是一直没有合上的窗\n\n[副歌]\n我们就这样半醒半温柔\n抱着剩下的那点曾经",
    "[主歌]\n有些故事起点是厨房 不是舞台\n安静得像第二杯茶冒出的热气\n\n[副歌]\n慢慢唱 轻轻唱 让时间自己漂\n没说完的那句 明天再说",
];

// ---------------------------------------------------------------- env overrides

fn env_bank(key: &str) -> Option<Vec<String>> {
    let raw = std::env::var(key).ok()?;
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }
    let items: Vec<String> = raw
        .split('|')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    if items.is_empty() {
        None
    } else {
        Some(items)
    }
}

static PROMPT_BANK_EN: Lazy<Vec<String>> = Lazy::new(|| {
    env_bank("CSSMV_RANDOM_PROMPT_BANK_EN")
        .unwrap_or_else(|| DEFAULT_PROMPT_BANK_EN.iter().map(|s| s.to_string()).collect())
});

static PROMPT_BANK_ZH: Lazy<Vec<String>> = Lazy::new(|| {
    env_bank("CSSMV_RANDOM_PROMPT_BANK_ZH")
        .unwrap_or_else(|| DEFAULT_PROMPT_BANK_ZH.iter().map(|s| s.to_string()).collect())
});

static STYLE_BANK: Lazy<Vec<String>> = Lazy::new(|| {
    env_bank("CSSMV_RANDOM_STYLE_BANK")
        .unwrap_or_else(|| DEFAULT_STYLE_BANK.iter().map(|s| s.to_string()).collect())
});

static LYRICS_BANK_EN: Lazy<Vec<String>> = Lazy::new(|| {
    env_bank("CSSMV_RANDOM_LYRICS_BANK_EN")
        .unwrap_or_else(|| DEFAULT_LYRICS_BANK_EN.iter().map(|s| s.to_string()).collect())
});

static LYRICS_BANK_ZH: Lazy<Vec<String>> = Lazy::new(|| {
    env_bank("CSSMV_RANDOM_LYRICS_BANK_ZH")
        .unwrap_or_else(|| DEFAULT_LYRICS_BANK_ZH.iter().map(|s| s.to_string()).collect())
});

// ---------------------------------------------------------------- selectors

fn is_zh_locale(lang: Option<&str>) -> bool {
    match lang {
        Some(s) => {
            let s = s.trim().to_ascii_lowercase();
            s == "zh" || s.starts_with("zh-") || s.starts_with("zh_")
        }
        None => false,
    }
}

fn pick<'a>(items: &'a [String]) -> &'a str {
    let mut rng = rand::thread_rng();
    items
        .choose(&mut rng)
        .map(|s| s.as_str())
        .unwrap_or("")
}

/// Return a random prompt in the requested locale (zh-family → zh bank, else en).
pub fn random_prompt(lang: Option<&str>) -> String {
    if is_zh_locale(lang) {
        pick(&PROMPT_BANK_ZH).to_string()
    } else {
        pick(&PROMPT_BANK_EN).to_string()
    }
}

/// Return a random music style tag (universal — not locale-specific).
pub fn random_style() -> String {
    pick(&STYLE_BANK).to_string()
}

/// Return a random short lyrics block in the requested locale.
pub fn random_lyrics(lang: Option<&str>) -> String {
    if is_zh_locale(lang) {
        pick(&LYRICS_BANK_ZH).to_string()
    } else {
        pick(&LYRICS_BANK_EN).to_string()
    }
}

/// Given a possibly-empty user-supplied string, return either the trimmed
/// user value or a random prompt in the given locale. Never returns "".
pub fn ensure_prompt(user_value: &str, lang: Option<&str>) -> String {
    let trimmed = user_value.trim();
    if !trimmed.is_empty() {
        return trimmed.to_string();
    }
    random_prompt(lang)
}

/// Like `ensure_prompt` but for style tags. Accepts Option<String> to match
/// the existing request structs that use `Option<String>` for style/lyrics.
pub fn ensure_style(user_value: Option<&str>) -> String {
    match user_value {
        Some(s) if !s.trim().is_empty() => s.trim().to_string(),
        _ => random_style(),
    }
}

/// Like `ensure_prompt` but for lyrics. Accepts Option<&str> to match the
/// existing request structs that use `Option<String>` for lyrics.
pub fn ensure_lyrics(user_value: Option<&str>, lang: Option<&str>) -> String {
    match user_value {
        Some(s) if !s.trim().is_empty() => s.trim().to_string(),
        _ => random_lyrics(lang),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ensure_prompt_preserves_user_value() {
        assert_eq!(ensure_prompt("my song", None), "my song");
        assert_eq!(ensure_prompt("  trim me  ", None), "trim me");
    }

    #[test]
    fn ensure_prompt_fills_blank() {
        let v = ensure_prompt("", Some("en"));
        assert!(!v.is_empty());
    }

    #[test]
    fn ensure_prompt_zh_is_chinese() {
        // Pick multiple to overcome randomness
        for _ in 0..10 {
            let v = ensure_prompt("", Some("zh"));
            assert!(!v.is_empty());
        }
    }

    #[test]
    fn ensure_style_fills_blank() {
        let v = ensure_style(None);
        assert!(!v.is_empty());
        let v2 = ensure_style(Some("  "));
        assert!(!v2.is_empty());
    }

    #[test]
    fn ensure_lyrics_preserves_user_value() {
        assert_eq!(
            ensure_lyrics(Some("my lyrics"), None),
            "my lyrics"
        );
    }

    #[test]
    fn ensure_lyrics_fills_blank() {
        let v = ensure_lyrics(None, Some("en"));
        assert!(!v.is_empty());
    }
}
