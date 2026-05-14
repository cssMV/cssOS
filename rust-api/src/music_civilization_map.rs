// CSSOS_WAVE_123 20260514 — Jing
// "音乐引擎，为什么每个人物的MV都是女声抒情的？每个文明的人物应该
//  音乐风格都不一样才对。"
//
// Civilization × Era (× optional Gender) → music style enrichment.
//
// The root cause of "every MV is a female lyrical ballad" is that the
// music_style hint reaching Suno was too generic ("emotional", "cinematic")
// so Suno defaulted to its house style — soft female pop vocals.
//
// This module takes whatever cultural signal we have (civilization name,
// era string, optional gender) and produces an ENRICHED style string that
// names the genre + the vocal register + the lead instruments explicitly,
// so Suno actually differentiates: a Tang-dynasty poet gets 古琴 + male
// classical vocal, a Norse skald gets a war-drum chant, a 1960s figure
// gets era-appropriate pop, etc.
//
// Design: everything is a best-effort keyword match. Unknown civ/era falls
// through to a neutral "varied contemporary" enrichment that at least
// breaks the female-ballad monotony by asking for varied instrumentation.

/// Optional gender hint. We have no `gender` column today, so this is
/// almost always `Unknown` — the civ/era axis carries the differentiation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GenderHint {
    Male,
    Female,
    Unknown,
}

impl GenderHint {
    pub fn from_opt(s: Option<&str>) -> Self {
        match s.map(|x| x.trim().to_lowercase()).as_deref() {
            Some("male") | Some("m") | Some("man") | Some("男") => GenderHint::Male,
            Some("female") | Some("f") | Some("woman") | Some("女") => GenderHint::Female,
            _ => GenderHint::Unknown,
        }
    }
}

/// Coarse era bucket derived from a free-text era string (handles both
/// English and Chinese era labels + raw year ranges).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EraBucket {
    Ancient,    // pre ~500 CE
    Medieval,   // ~500–1400
    EarlyModern, // ~1400–1850
    Modern,     // ~1850–1980
    Contemporary, // ~1980+
    Unknown,
}

fn classify_era(era: &str) -> EraBucket {
    let e = era.trim().to_lowercase();
    if e.is_empty() {
        return EraBucket::Unknown;
    }
    // Explicit keyword hits first
    let ancient_kw = [
        "ancient", "antiquity", "bce", "b.c.", "bc ", "classical antiquity",
        "上古", "先秦", "春秋", "战国", "秦", "汉", "古希腊", "古罗马", "古埃及",
        "神话", "传说", "mytholog", "legend",
    ];
    let medieval_kw = [
        "medieval", "middle age", "dark age", "byzantine", "tang", "song dynasty",
        "唐", "宋", "元", "魏晋", "南北朝", "隋", "中世纪", "feudal",
    ];
    let early_modern_kw = [
        "renaissance", "baroque", "enlightenment", "ming", "qing",
        "明", "清", "文艺复兴", "巴洛克", "启蒙",
    ];
    let modern_kw = [
        "19th century", "20th century", "industrial", "victorian", "romantic era",
        "民国", "近代", "19世纪", "20世纪",
    ];
    let contemporary_kw = [
        "contemporary", "modern", "21st century", "present", "current",
        "当代", "现代", "21世纪",
    ];
    for k in ancient_kw {
        if e.contains(k) {
            return EraBucket::Ancient;
        }
    }
    for k in medieval_kw {
        if e.contains(k) {
            return EraBucket::Medieval;
        }
    }
    for k in early_modern_kw {
        if e.contains(k) {
            return EraBucket::EarlyModern;
        }
    }
    for k in modern_kw {
        if e.contains(k) {
            return EraBucket::Modern;
        }
    }
    for k in contemporary_kw {
        if e.contains(k) {
            return EraBucket::Contemporary;
        }
    }
    // Raw 4-digit year fallback
    if let Some(year) = extract_year(&e) {
        return match year {
            y if y < 500 => EraBucket::Ancient,
            y if y < 1400 => EraBucket::Medieval,
            y if y < 1850 => EraBucket::EarlyModern,
            y if y < 1980 => EraBucket::Modern,
            _ => EraBucket::Contemporary,
        };
    }
    EraBucket::Unknown
}

fn extract_year(s: &str) -> Option<i32> {
    let mut digits = String::new();
    for ch in s.chars() {
        if ch.is_ascii_digit() {
            digits.push(ch);
            if digits.len() == 4 {
                return digits.parse().ok();
            }
        } else if !digits.is_empty() && digits.len() >= 3 {
            return digits.parse().ok();
        } else {
            digits.clear();
        }
    }
    None
}

/// Coarse civilization family from a free-text civilization label.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CivFamily {
    Chinese,
    Japanese,
    Korean,
    Indian,
    MiddleEastern,    // Persian / Arab / Mesopotamian
    GreekRoman,
    EuropeanWest,     // post-classical Western Europe
    Slavic,
    Nordic,
    African,
    LatinAmerican,
    SoutheastAsian,
    Indigenous,       // Native American / Oceanic / etc.
    Unknown,
}

fn classify_civ(civ: &str) -> CivFamily {
    let c = civ.trim().to_lowercase();
    if c.is_empty() {
        return CivFamily::Unknown;
    }
    let table: &[(&[&str], CivFamily)] = &[
        (&["chinese", "china", "han", "tang", "song", "ming", "qing", "中华", "中国", "华夏", "汉"], CivFamily::Chinese),
        (&["japan", "japanese", "yamato", "日本", "和"], CivFamily::Japanese),
        (&["korea", "korean", "joseon", "goryeo", "韩", "朝鲜", "高丽"], CivFamily::Korean),
        (&["india", "indian", "hindu", "vedic", "mughal", "印度", "吠陀"], CivFamily::Indian),
        (&["persia", "persian", "arab", "islam", "mesopotam", "babylon", "sumeria", "egypt", "ottoman", "波斯", "阿拉伯", "美索不达米亚", "巴比伦", "埃及", "奥斯曼"], CivFamily::MiddleEastern),
        (&["greek", "greece", "rome", "roman", "hellenic", "希腊", "罗马"], CivFamily::GreekRoman),
        (&["english", "french", "german", "italian", "spanish", "british", "western europe", "european", "celtic", "anglo", "英", "法", "德", "意", "西班牙", "欧洲", "凯尔特"], CivFamily::EuropeanWest),
        (&["russia", "slavic", "polish", "ukrain", "俄", "斯拉夫"], CivFamily::Slavic),
        (&["norse", "viking", "nordic", "scandinav", "icelandic", "北欧", "维京"], CivFamily::Nordic),
        (&["africa", "african", "egyptian-african", "yoruba", "zulu", "ethiopia", "mali", "非洲"], CivFamily::African),
        (&["aztec", "maya", "inca", "latin america", "mexican", "brazil", "andean", "玛雅", "阿兹特克", "印加", "拉丁美洲"], CivFamily::LatinAmerican),
        (&["thai", "viet", "khmer", "indonesia", "malay", "burmese", "东南亚", "越南", "泰国"], CivFamily::SoutheastAsian),
        (&["native american", "indigenous", "oceania", "polynesi", "aboriginal", "maori", "原住民", "土著"], CivFamily::Indigenous),
    ];
    for (keys, fam) in table {
        for k in *keys {
            if c.contains(k) {
                return *fam;
            }
        }
    }
    CivFamily::Unknown
}

/// Lead instruments for a civ family — era nudges the choice.
fn instruments_for(fam: CivFamily, era: EraBucket) -> &'static str {
    match (fam, era) {
        (CivFamily::Chinese, EraBucket::Ancient | EraBucket::Medieval) => "guqin, xiao flute, pipa, bamboo percussion",
        (CivFamily::Chinese, EraBucket::EarlyModern) => "pipa, erhu, dizi flute, wooden percussion",
        (CivFamily::Chinese, _) => "erhu and guzheng layered over a modern cinematic orchestra",
        (CivFamily::Japanese, EraBucket::Ancient | EraBucket::Medieval | EraBucket::EarlyModern) => "koto, shakuhachi, taiko drums",
        (CivFamily::Japanese, _) => "koto and shakuhachi blended with ambient synth pads",
        (CivFamily::Korean, _) => "gayageum, daegeum flute, janggu drum",
        (CivFamily::Indian, _) => "sitar, tabla, bansuri flute, tanpura drone",
        (CivFamily::MiddleEastern, _) => "oud, ney flute, qanun, frame drum, microtonal strings",
        (CivFamily::GreekRoman, _) => "lyre, aulos, hand percussion, choral chant",
        (CivFamily::EuropeanWest, EraBucket::Medieval) => "lute, hurdy-gurdy, recorder, plainchant choir",
        (CivFamily::EuropeanWest, EraBucket::EarlyModern) => "harpsichord, baroque strings, chamber choir",
        (CivFamily::EuropeanWest, EraBucket::Modern) => "full romantic orchestra, grand piano",
        (CivFamily::EuropeanWest, _) => "cinematic orchestra with contemporary production",
        (CivFamily::Slavic, _) => "balalaika, accordion, deep male choir, string ensemble",
        (CivFamily::Nordic, _) => "war drums, bone flute, throat-sung drone, low brass",
        (CivFamily::African, _) => "djembe, kora, talking drum, call-and-response chorus",
        (CivFamily::LatinAmerican, _) => "andean pan flute, charango, hand percussion",
        (CivFamily::SoutheastAsian, _) => "gamelan, bamboo xylophone, gongs",
        (CivFamily::Indigenous, _) => "native flute, frame drum, nature ambience, group chant",
        (CivFamily::Unknown, _) => "varied acoustic and orchestral instrumentation",
    }
}

/// Genre + mood for a civ family + era.
fn genre_for(fam: CivFamily, era: EraBucket) -> &'static str {
    match (fam, era) {
        (CivFamily::Chinese, EraBucket::Ancient | EraBucket::Medieval) => "classical Chinese court music, 古风 guofeng",
        (CivFamily::Chinese, _) => "modern guofeng fusion",
        (CivFamily::Japanese, EraBucket::Contemporary | EraBucket::Modern) => "neo-traditional Japanese, city-pop influence",
        (CivFamily::Japanese, _) => "traditional Japanese gagaku-inspired",
        (CivFamily::Korean, EraBucket::Contemporary) => "modern Korean with traditional roots",
        (CivFamily::Korean, _) => "Korean court and folk music",
        (CivFamily::Indian, _) => "Hindustani / Carnatic classical raga",
        (CivFamily::MiddleEastern, _) => "Middle Eastern maqam, devotional and epic",
        (CivFamily::GreekRoman, _) => "ancient Mediterranean epic, hymnic",
        (CivFamily::EuropeanWest, EraBucket::Medieval) => "medieval European, sacred and courtly",
        (CivFamily::EuropeanWest, EraBucket::EarlyModern) => "Baroque / Classical era European art music",
        (CivFamily::EuropeanWest, EraBucket::Modern) => "Romantic-era symphonic",
        (CivFamily::EuropeanWest, _) => "contemporary cinematic / art-pop",
        (CivFamily::Slavic, _) => "Slavic folk epic, brooding and grand",
        (CivFamily::Nordic, _) => "Nordic folk, ritual and martial",
        (CivFamily::African, _) => "West African rhythmic, communal and uplifting",
        (CivFamily::LatinAmerican, _) => "Andean / Mesoamerican folk",
        (CivFamily::SoutheastAsian, _) => "Southeast Asian gamelan-rooted",
        (CivFamily::Indigenous, _) => "indigenous ritual and ceremonial",
        (CivFamily::Unknown, EraBucket::Contemporary) => "varied contemporary, avoid generic ballad",
        (CivFamily::Unknown, _) => "varied world fusion, avoid generic ballad",
    }
}

/// Vocal register description. Without a gender column we lean on era +
/// civ conventions to pick a register that BREAKS the female-ballad
/// default — explicit gender wins when supplied.
fn vocal_for(fam: CivFamily, era: EraBucket, gender: GenderHint) -> &'static str {
    match gender {
        GenderHint::Male => match (fam, era) {
            (CivFamily::GreekRoman, _) | (CivFamily::Nordic, _) | (CivFamily::Slavic, _) => "deep resonant male voice, epic chant",
            (CivFamily::EuropeanWest, EraBucket::EarlyModern) => "operatic male tenor",
            (CivFamily::Chinese, EraBucket::Ancient | EraBucket::Medieval) => "refined male classical voice, 文人 scholar tone",
            _ => "expressive male lead vocal",
        },
        GenderHint::Female => match (fam, era) {
            (CivFamily::EuropeanWest, EraBucket::EarlyModern) => "operatic female soprano",
            (CivFamily::Chinese, _) => "clear female classical voice, 婉约 elegant tone",
            _ => "expressive female lead vocal",
        },
        // Unknown gender — pick a register that's era/civ-distinctive so
        // it does NOT collapse into the soft-female-pop default.
        GenderHint::Unknown => match (fam, era) {
            (CivFamily::Nordic, _) => "powerful gang-vocal chant, mixed low voices",
            (CivFamily::GreekRoman, _) => "hymnic mixed chorus",
            (CivFamily::Slavic, _) => "deep mixed choir",
            (CivFamily::African, _) => "call-and-response group vocals",
            (CivFamily::Indigenous, _) => "communal ceremonial chant",
            (CivFamily::EuropeanWest, EraBucket::Medieval) => "monastic plainchant choir",
            (CivFamily::EuropeanWest, EraBucket::EarlyModern) => "classical mixed chorus",
            (CivFamily::Chinese, EraBucket::Ancient | EraBucket::Medieval) => "alternating male and female classical voices",
            (CivFamily::Indian, _) => "ornamented classical voice with raga melisma",
            (CivFamily::MiddleEastern, _) => "devotional voice with microtonal ornamentation",
            _ => "varied vocal arrangement (not a soft female ballad)",
        },
    }
}

/// Build an enriched music_style string. `base_style` is whatever the
/// caller already had (user input / random bank). We APPEND the cultural
/// enrichment so the user's explicit choice still leads.
///
/// Returns `None` when we have zero usable signal (no civ AND no era) —
/// caller should keep the original style untouched in that case.
pub fn enrich_music_style(
    civilization: Option<&str>,
    era: Option<&str>,
    gender: Option<&str>,
    base_style: &str,
) -> Option<String> {
    let civ_raw = civilization.unwrap_or("").trim();
    let era_raw = era.unwrap_or("").trim();
    if civ_raw.is_empty() && era_raw.is_empty() {
        return None;
    }
    let fam = classify_civ(civ_raw);
    let era_bucket = classify_era(era_raw);
    // If both are unknown, the enrichment is too vague to help — bail.
    if fam == CivFamily::Unknown && era_bucket == EraBucket::Unknown {
        return None;
    }
    let g = GenderHint::from_opt(gender);
    let genre = genre_for(fam, era_bucket);
    let instruments = instruments_for(fam, era_bucket);
    let vocal = vocal_for(fam, era_bucket, g);

    let base = base_style.trim();
    let enriched = if base.is_empty() {
        format!("{genre}; {vocal}; lead instruments: {instruments}")
    } else {
        // User's style leads, cultural enrichment refines.
        format!("{base}; rendered as {genre}; {vocal}; lead instruments: {instruments}")
    };
    Some(enriched)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tang_poet_gets_guqin_not_female_ballad() {
        let s = enrich_music_style(Some("Chinese"), Some("Tang dynasty"), None, "emotional")
            .expect("should enrich");
        assert!(s.contains("guqin"), "{s}");
        assert!(s.contains("guofeng") || s.contains("classical Chinese"), "{s}");
        assert!(!s.to_lowercase().contains("soft female ballad pop"));
    }

    #[test]
    fn norse_skald_gets_war_drums() {
        let s = enrich_music_style(Some("Norse"), Some("Viking age"), None, "")
            .expect("should enrich");
        assert!(s.contains("war drums") || s.contains("chant"), "{s}");
    }

    #[test]
    fn explicit_gender_wins() {
        let s = enrich_music_style(Some("Greek"), Some("ancient"), Some("male"), "epic")
            .expect("should enrich");
        assert!(s.contains("male"), "{s}");
    }

    #[test]
    fn no_signal_returns_none() {
        assert!(enrich_music_style(None, None, None, "whatever").is_none());
        assert!(enrich_music_style(Some(""), Some(""), None, "x").is_none());
    }

    #[test]
    fn unknown_civ_known_era_still_enriches() {
        let s = enrich_music_style(Some("Atlantis"), Some("ancient"), None, "dreamy");
        assert!(s.is_some(), "known era alone should enrich");
    }
}
