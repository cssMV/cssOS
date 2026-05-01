/* CSSOS_PHASE2_CIVILIZATION_BANK 20260418 —
 * Civilization-coherent random pools for lyrics / seed randomization.
 *
 * Why this exists (Jing, 2026-04-18):
 *   The previous randomizer only branched on ja/zh/else with 3–8 item pools.
 *   Same seeds re-hit the same (genre, instrument, vocalStyle) tuples, so the
 *   LLM kept producing near-duplicate songs and we burned $221 in OpenAI
 *   credit re-rolling. This module replaces that 3-branch ladder with a
 *   ~12-civilization taxonomy. Each civilization exposes large, culturally
 *   coherent pools so a single locale selection yields a huge combinatorial
 *   state space without hopping into an unrelated culture.
 *
 *   Design principles:
 *   - Pools are large (8–14 items typical) so combinations cross into the
 *     hundreds of millions per civilization.
 *   - Pools stay *inside* the civilization — no pipa on a Norwegian folk
 *     prompt, no bandoneon on a Kyoto ballad.
 *   - Locale → civilization mapping is explicit; unmapped locales default
 *     to "anglophone" (the LLM then free-styles in the user's language).
 *   - "roam" civilization is a blended pool used when no explicit language
 *     was picked — it intentionally crosses cultures so the UI stays playful.
 *
 * Consumers:
 *   - app.song-seed-settings.js -> randomizeCreationForLyricsRefreshModule
 *   - app.js (legacy copy of the same fn)
 *   - Anything that needs to ask "what's the current civilization tag?" for
 *     the lyrics-diversity-audit (see app.lyrics-diversity-audit.js, which
 *     already honours `item.civilization`).
 *
 * Everything here is pure data + pure helpers; no DOM touches, no I/O.
 */

(function installCivilizationBank(global) {
  "use strict";

  // -------------------------------------------------------------- LOCALE MAP
  // Maps normalized locale codes (lowercase, base language only) to a
  // civilization key. Unmapped locales resolve to "anglophone".
  //
  // Keep the lookup conservative: when in doubt pick anglophone rather than
  // guess. The user can still override via advanced settings.
  const LOCALE_TO_CIVILIZATION = Object.freeze({
    zh: "sinosphere_zh",
    "zh-cn": "sinosphere_zh",
    "zh-tw": "sinosphere_zh",
    "zh-hk": "sinosphere_zh",
    ja: "sinosphere_ja",
    ko: "sinosphere_ko",
    vi: "southeast_asia_mainland",
    th: "southeast_asia_mainland",
    id: "nusantara",
    ms: "nusantara",
    ar: "arab",
    he: "levant",
    fa: "persianate",
    hi: "indic",
    bn: "indic",
    ur: "indic",
    en: "anglophone",
    es: "iberoamerica",
    pt: "lusophone",
    fr: "francophonie",
    it: "italianate",
    de: "germanic",
    nl: "germanic",
    ru: "slavic",
    uk: "slavic",
    pl: "slavic",
    cs: "slavic",
    tr: "anatolia",
    sw: "east_african",
    yo: "west_african",
    af: "southern_african"
  });

  // -------------------------------------------------------------- MOOD POOLS
  // Shared mood vocabulary — civilizations can extend this with a handful of
  // culture-flavoured moods via `moodAccent`. Moods are genre-agnostic so we
  // keep them in one pool and let each civilization add its own flavour.
  const UNIVERSAL_MOODS = Object.freeze([
    "bittersweet", "bright", "contemplative", "defiant", "dreamy", "ecstatic",
    "elegiac", "fierce", "hopeful", "intimate", "jubilant", "longing",
    "melancholy", "nocturnal", "playful", "restless", "reverent", "serene",
    "sultry", "tender", "triumphant", "wistful", "yearning", "enchanted"
  ]);

  // ------------------------------------------------------------- KEY / TEMPO
  // Keep the key set musical rather than just alphabetical — add a couple of
  // common modal keys so we don't always bias toward C major.
  const COMMON_KEYS = Object.freeze([
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
    "Cm", "Dm", "Em", "Fm", "Gm", "Am", "Bm"
  ]);

  // ------------------------------------------------------------- CIVILIZATIONS
  // Each civilization:
  //   code:           stable id stored in lyrics-diversity-audit history
  //   label:          human-readable (en fallback; UI can re-localize later)
  //   genres:         10–14 items, culturally coherent
  //   instruments:    10–14 items
  //   vocalStyles:    6–10 items
  //   ensembles:      6–10 items
  //   instrumentation: 5–8 comma-separated phrases for the LLM prompt
  //   moodAccent:     3–6 extra moods unique to this civilization
  //   titleHints:     6–10 conceptual keywords the LLM can riff on
  //   promptFrame:    one-line cultural frame appended to the LLM prompt
  const CIVILIZATIONS = Object.freeze({
    sinosphere_zh: {
      code: "sinosphere_zh",
      label: "Sinosphere (Mandarin)",
      genres: [
        "Chinese GuFeng", "Chinese Pop", "C-Pop Ballad", "Xinyao Folk",
        "Cantopop", "Mandopop Rock", "Chinese Ambient", "Chinese Jazz",
        "Chinese Rap", "Chinese Orchestral", "Chinese R&B", "Chinese Indie"
      ],
      instruments: [
        "Guzheng", "Dizi", "Pipa", "Erhu", "Yangqin", "Ruan", "Xiao",
        "Guqin", "Suona", "Piano", "Violin", "Cello", "String Ensemble",
        "Fingerpicked Guitar"
      ],
      vocalStyles: [
        "airy close-mic", "lyric belt", "soft opera shimmer", "choral unison",
        "restrained falsetto", "xiqu-inflected bel canto", "whisper-to-belt",
        "breath-led phrasing"
      ],
      ensembles: [
        "chamber ensemble", "silk-and-bamboo trio", "cinematic orchestra",
        "synth-pop band", "acoustic quartet", "string quintet",
        "guqin-and-xiao duo", "modern Chinese chamber"
      ],
      instrumentation: [
        "guzheng, dizi, low strings",
        "pipa, yangqin, brushed drums",
        "erhu, grand piano, sub bass pad",
        "guqin, bamboo flute, soft percussion",
        "suona, taiko-style drums, cello",
        "fingerpicked guitar, erhu, cello"
      ],
      moodAccent: ["ink-wash serene", "moonlit longing", "jade-green pride", "lantern-festival warm"],
      titleHints: ["月", "长安", "江湖", "故园", "风起", "千山", "青衫", "夜行"],
      promptFrame: "Cultural frame: Sinosphere (Mandarin). Favor poetic imagery, seasonal metaphors, reserved emotion."
    },

    sinosphere_ja: {
      code: "sinosphere_ja",
      label: "Sinosphere (Japanese)",
      genres: [
        "J-Pop", "City Pop", "J-Rock", "J-Ballad", "Anime Opening",
        "Kayokyoku", "Shibuya-kei", "J-Folk", "J-Indie", "Vocaloid",
        "Japanese Classical", "Visual Kei"
      ],
      instruments: [
        "Piano", "Electric Guitar", "Acoustic Guitar", "Violin", "Flute",
        "Shakuhachi", "Koto", "Shamisen", "Taiko", "Synthesizer",
        "String Ensemble", "Cello", "Drum Kit"
      ],
      vocalStyles: [
        "airy close-mic", "lyric belt", "soft opera shimmer", "choral unison",
        "breath-led phrasing", "kawaii-bright", "whisper-to-belt",
        "enka-inflected vibrato"
      ],
      ensembles: [
        "chamber ensemble", "synth-pop band", "cinematic orchestra",
        "city-pop quintet", "anime-ending quartet", "acoustic trio",
        "shakuhachi-and-koto duo"
      ],
      instrumentation: [
        "koto, shakuhachi, brushed drums",
        "electric guitar, synth pad, punchy kit",
        "grand piano, string quartet, soft percussion",
        "shamisen, taiko, sub bass",
        "synth arp, glassy rhodes, live drums",
        "flute, cello, fingerpicked guitar"
      ],
      moodAccent: ["cherry-blossom wistful", "neon-rainy", "natsumeshi nostalgic", "tatami-quiet"],
      titleHints: ["桜", "夜行列車", "東京", "夏の午後", "蛍", "雨音", "旅の途中", "灯り"],
      promptFrame: "Cultural frame: Japanese. Favor image-led verses, delicate metaphors, cinematic restraint."
    },

    sinosphere_ko: {
      code: "sinosphere_ko",
      label: "Sinosphere (Korean)",
      genres: [
        "K-Pop", "K-Ballad", "K-Indie", "K-R&B", "K-Hiphop", "Korean Folk",
        "Korean Jazz", "Trot", "K-Rock", "Korean OST", "Korean Acoustic",
        "Korean Classical"
      ],
      instruments: [
        "Piano", "Gayageum", "Haegeum", "Daegeum", "Janggu", "Acoustic Guitar",
        "Electric Guitar", "Synth Pad", "Violin", "Cello", "String Ensemble",
        "Drum Kit"
      ],
      vocalStyles: [
        "airy close-mic", "lyric belt", "soft opera shimmer",
        "breath-led phrasing", "whisper-to-belt", "trot-tinged vibrato",
        "rap-cadence hybrid", "choral unison"
      ],
      ensembles: [
        "chamber ensemble", "synth-pop band", "cinematic orchestra",
        "ballad quartet", "indie-trio", "gayageum-and-strings duo",
        "hiphop rhythm section"
      ],
      instrumentation: [
        "gayageum, piano, sub bass pad",
        "haegeum, string ensemble, brushed drums",
        "synth arp, electric piano, punchy kit",
        "acoustic guitar, cello, soft percussion",
        "daegeum, janggu, warm bass"
      ],
      moodAccent: ["seasonal farewell", "street-neon quiet", "mountain-ridge bright", "noraebang earnest"],
      titleHints: ["한강", "새벽", "골목길", "봄바람", "겨울밤", "서울", "노을", "빗소리"],
      promptFrame: "Cultural frame: Korean. Favor emotional candor, seasonal motifs, conversational-to-belt dynamics."
    },

    southeast_asia_mainland: {
      code: "southeast_asia_mainland",
      label: "Mainland Southeast Asia",
      genres: [
        "V-Pop", "Vietnamese Bolero", "Luk Thung", "Mor Lam", "Thai Pop",
        "Khmer Pop", "Indie SEA", "SEA R&B", "SEA Folk", "SEA Acoustic",
        "Tropical House", "Cinematic SEA"
      ],
      instruments: [
        "Đàn Bầu", "Đàn Tranh", "Khim", "Khene", "Saw U", "Ranat Ek",
        "Acoustic Guitar", "Electric Guitar", "Piano", "Synthesizer",
        "Congas", "Flute"
      ],
      vocalStyles: [
        "airy close-mic", "bolero croon", "luk thung slide", "breath-led phrasing",
        "whisper-to-belt", "lyric belt", "humid-night murmur"
      ],
      ensembles: [
        "tropical quartet", "bolero trio", "chamber ensemble",
        "synth-pop band", "indie duo", "string-and-khim duo"
      ],
      instrumentation: [
        "đàn tranh, soft synth pad, brushed drums",
        "ranat ek, congas, acoustic guitar",
        "khene, flute, warm bass",
        "saw u, piano, string pad",
        "acoustic guitar, percussion, sub bass"
      ],
      moodAccent: ["monsoon ache", "street-market bright", "river-town tender", "dusk-bus nostalgic"],
      titleHints: ["dòng sông", "đêm mưa", "สายลม", "โคมไฟ", "ក្ដី", "trưa hè", "ngõ vắng"],
      promptFrame: "Cultural frame: Mainland Southeast Asia. Favor rainy-season imagery, street-life color, tender understatement."
    },

    nusantara: {
      code: "nusantara",
      label: "Nusantara (Maritime SEA)",
      genres: [
        "Indo-Pop", "Dangdut", "Keroncong", "Gambus", "Malay Pop", "Indie Nusa",
        "Tropical Ballad", "Nusa R&B", "Island Folk", "Nusa Acoustic",
        "Indo Jazz", "Cinematic Nusa"
      ],
      instruments: [
        "Gamelan", "Kendang", "Gambus", "Sasando", "Angklung", "Suling",
        "Acoustic Guitar", "Electric Guitar", "Piano", "Synthesizer",
        "Congas", "String Ensemble"
      ],
      vocalStyles: [
        "airy close-mic", "gambus melisma", "dangdut slide", "breath-led phrasing",
        "whisper-to-belt", "lyric belt", "island-breeze murmur"
      ],
      ensembles: [
        "keroncong quintet", "gamelan ensemble", "tropical quartet",
        "chamber ensemble", "synth-pop band", "acoustic trio"
      ],
      instrumentation: [
        "gamelan bell wash, kendang, warm bass",
        "gambus, angklung, brushed drums",
        "suling, acoustic guitar, soft percussion",
        "synth pad, congas, electric piano",
        "sasando, string pad, sub bass"
      ],
      moodAccent: ["island-dusk tender", "monsoon-port longing", "kampung warmth", "ocean-breeze bright"],
      titleHints: ["laut", "kampung halaman", "senja", "merantau", "pulau", "ombak", "malam di teluk"],
      promptFrame: "Cultural frame: Nusantara (Indonesian/Malay). Favor sea, island, longing-for-home motifs."
    },

    indic: {
      code: "indic",
      label: "Indic",
      genres: [
        "Hindi Pop", "Bollywood", "Ghazal", "Qawwali", "Bhangra",
        "Indian Classical", "Indian Folk", "Indie Desi", "Sufi Pop",
        "Indian R&B", "Indian Electronic", "Carnatic Fusion"
      ],
      instruments: [
        "Sitar", "Tabla", "Harmonium", "Sarangi", "Bansuri", "Santoor",
        "Mridangam", "Dholak", "Veena", "Piano", "Acoustic Guitar",
        "String Ensemble"
      ],
      vocalStyles: [
        "khayal-inflected belt", "ghazal legato", "qawwali call-and-response",
        "airy close-mic", "breath-led phrasing", "filmy belt",
        "taan-run ornamentation", "whisper-to-belt"
      ],
      ensembles: [
        "classical trio", "filmy orchestra", "ghazal quartet",
        "qawwali ensemble", "indie duo", "chamber fusion"
      ],
      instrumentation: [
        "sitar, tabla, string pad",
        "bansuri, harmonium, dholak",
        "sarangi, santoor, soft percussion",
        "veena, mridangam, warm bass",
        "tabla, piano, string ensemble"
      ],
      moodAccent: ["monsoon devotional", "festival-bright", "twilight-raga contemplative", "wedding-procession joyous"],
      titleHints: ["बारिश", "रात का सफर", "دل", "वादा", "सावन", "गलियाँ", "चाँदनी"],
      promptFrame: "Cultural frame: Indic. Favor raga-adjacent ornamentation references, monsoon/festival imagery, devotional or filmy pacing."
    },

    arab: {
      code: "arab",
      label: "Arab Musical Tradition",
      genres: [
        "Arabic Pop", "Khaleeji", "Mahraganat", "Arabic R&B", "Tarab",
        "Arabic Indie", "Shaabi", "Arabic Jazz", "Andalusi", "Raï",
        "Arabic Cinematic", "Arabic Electronic"
      ],
      instruments: [
        "Oud", "Qanun", "Ney", "Riq", "Darbuka", "Buzuq", "Kamancheh",
        "Mijwiz", "Piano", "Acoustic Guitar", "String Ensemble", "Synth Pad"
      ],
      vocalStyles: [
        "tarab melisma", "airy close-mic", "maqam-inflected belt",
        "breath-led phrasing", "shaabi chant", "whisper-to-belt",
        "qasida recitation", "lyric belt"
      ],
      ensembles: [
        "takht ensemble", "firqa orchestra", "chamber fusion",
        "synth-pop band", "acoustic trio", "andalusi nuba ensemble"
      ],
      instrumentation: [
        "oud, qanun, riq",
        "ney, kamancheh, darbuka",
        "buzuq, piano, soft percussion",
        "mijwiz, synth pad, warm bass",
        "string ensemble, darbuka, oud"
      ],
      moodAccent: ["desert-dawn longing", "courtyard warmth", "midnight-cafe smoke", "pilgrim-road reverent"],
      titleHints: ["ليل", "طريق الشام", "حبيبي", "صحراء", "قمر", "قهوة", "وعد"],
      promptFrame: "Cultural frame: Arab. Favor maqam-adjacent melodic shapes, desert/courtyard/longing imagery, tarab dynamics."
    },

    persianate: {
      code: "persianate",
      label: "Persianate",
      genres: [
        "Persian Pop", "Persian Classical", "Tasnif", "Ghazal", "Dastgah Fusion",
        "Persian Indie", "Persian Jazz", "Sufi Pop", "Persian Electronic",
        "Persian Cinematic", "Folk Persian", "Persian R&B"
      ],
      instruments: [
        "Tar", "Setar", "Santur", "Ney", "Tombak", "Daf", "Kamancheh",
        "Qanun", "Piano", "Acoustic Guitar", "String Ensemble", "Synth Pad"
      ],
      vocalStyles: [
        "dastgah-inflected belt", "tahrir ornamentation", "airy close-mic",
        "breath-led phrasing", "ghazal legato", "sufi chant",
        "whisper-to-belt", "lyric belt"
      ],
      ensembles: [
        "classical Persian ensemble", "chamber fusion", "acoustic trio",
        "synth-pop band", "sufi chorus", "tombak-and-strings quartet"
      ],
      instrumentation: [
        "setar, santur, tombak",
        "ney, kamancheh, daf",
        "tar, piano, string pad",
        "santur, qanun, soft percussion",
        "acoustic guitar, setar, warm bass"
      ],
      moodAccent: ["nightingale-longing", "rose-garden tender", "qashqai-road nostalgic", "mystic-quiet reverent"],
      titleHints: ["شب", "باغ", "راز", "مسافر", "ستاره", "صدای قدم"],
      promptFrame: "Cultural frame: Persianate. Favor classical poetic imagery, dastgah-adjacent ornament references, mystic pacing."
    },

    anglophone: {
      code: "anglophone",
      label: "Anglophone",
      genres: [
        "Pop", "Rock", "Indie", "R&B", "Soul", "Folk", "Country",
        "Singer-Songwriter", "Alt-Rock", "Dream Pop", "Electronic Pop",
        "Soft Rock", "Lo-Fi", "Gospel-Infused Pop"
      ],
      instruments: [
        "Acoustic Guitar", "Electric Guitar", "Bass Guitar", "Piano",
        "Drum Kit", "Synthesizer", "Violin", "Saxophone", "Trumpet",
        "Banjo", "Harmonica", "Organ", "Pedal Steel"
      ],
      vocalStyles: [
        "airy close-mic", "lyric belt", "soul rasp", "breath-led phrasing",
        "conversational speak-sing", "choral unison", "whisper-to-belt",
        "country twang", "falsetto glide", "indie-grit delivery"
      ],
      ensembles: [
        "indie quartet", "rock four-piece", "singer-songwriter trio",
        "gospel choir", "chamber-pop sextet", "synth-pop band",
        "country band", "acoustic duo"
      ],
      instrumentation: [
        "electric guitar, bass, punchy kit",
        "grand piano, cello, brushed drums",
        "acoustic guitar, pedal steel, warm bass",
        "analog bass, polysynth pad, live drums",
        "organ, horn layer, snappy drums"
      ],
      moodAccent: ["porch-light tender", "neon-highway defiant", "late-night diner", "stadium triumph"],
      titleHints: ["highway", "good years", "ghost in the room", "back of your car", "low light", "hold on"],
      promptFrame: "Cultural frame: Anglophone. Favor conversational verses, concrete imagery, chorus-driven hooks."
    },

    iberoamerica: {
      code: "iberoamerica",
      label: "Iberoamerica",
      genres: [
        "Latin Pop", "Reggaeton", "Bachata", "Bolero", "Ranchera", "Cumbia",
        "Flamenco Pop", "Latin R&B", "Latin Indie", "Latin Jazz",
        "Bossa-Inflected Pop", "Nueva Canción"
      ],
      instruments: [
        "Classical Guitar", "Cajón", "Bongos", "Congas", "Accordion",
        "Trumpet", "Maracas", "Clave", "Timbales", "Piano",
        "Acoustic Guitar", "String Ensemble", "Bandoneón"
      ],
      vocalStyles: [
        "flamenco melisma", "bolero croon", "reggaeton flow", "airy close-mic",
        "ranchera belt", "breath-led phrasing", "whisper-to-belt",
        "nueva canción warmth"
      ],
      ensembles: [
        "mariachi-adjacent ensemble", "bolero trio", "cumbia band",
        "flamenco palo ensemble", "Latin-jazz quintet", "reggaeton rhythm section"
      ],
      instrumentation: [
        "classical guitar, cajón, hand claps",
        "bongos, congas, trumpet",
        "accordion, timbales, warm bass",
        "bandoneón, piano, soft percussion",
        "acoustic guitar, string pad, congas"
      ],
      moodAccent: ["patio-dusk tender", "carnival-bright", "cantina-late longing", "tropical-sunset ecstatic"],
      titleHints: ["noche", "olas", "corazón", "el sur", "te veo", "luz de luna"],
      promptFrame: "Cultural frame: Iberoamerica. Favor coastal/patio imagery, rhythmic drive, direct emotional address."
    },

    lusophone: {
      code: "lusophone",
      label: "Lusophone",
      genres: [
        "Bossa Nova", "MPB", "Samba", "Fado", "Forró", "Brazilian Pop",
        "Brazilian R&B", "Tropicália", "Kizomba", "Brazilian Jazz",
        "Brazilian Indie", "Axé"
      ],
      instruments: [
        "Classical Guitar", "Cavaquinho", "Berimbau", "Pandeiro", "Surdo",
        "Piano", "Saxophone", "Trumpet", "Portuguese Guitar", "Accordion",
        "Acoustic Guitar", "Double Bass"
      ],
      vocalStyles: [
        "bossa whisper", "samba bounce", "fado saudade", "airy close-mic",
        "breath-led phrasing", "lyric belt", "forró call-and-response",
        "whisper-to-belt"
      ],
      ensembles: [
        "bossa trio", "samba bateria-light", "fado duo",
        "MPB quartet", "forró band", "Brazilian-jazz quintet"
      ],
      instrumentation: [
        "classical guitar, pandeiro, double bass",
        "cavaquinho, surdo, warm brass",
        "piano, brushed drums, saxophone",
        "portuguese guitar, strings, soft percussion",
        "accordion, triangle, acoustic bass"
      ],
      moodAccent: ["saudade tender", "beira-mar quiet", "carnaval joyous", "samba-bar nostalgic"],
      titleHints: ["mar", "saudade", "manhã", "rua de abril", "violão", "luar"],
      promptFrame: "Cultural frame: Lusophone. Favor saudade, sea/coffee/rua imagery, rhythmic but conversational phrasing."
    },

    francophonie: {
      code: "francophonie",
      label: "Francophonie",
      genres: [
        "Chanson Française", "French Pop", "Yé-Yé", "French Indie", "Variété",
        "French Electronic", "French Hip-Hop", "French R&B", "Gypsy Jazz",
        "French Cinematic", "Zouk", "Afro-Française"
      ],
      instruments: [
        "Accordion", "Piano", "Acoustic Guitar", "Electric Guitar", "Violin",
        "Cello", "Double Bass", "Saxophone", "Trumpet", "Synthesizer",
        "Drum Kit", "Organ"
      ],
      vocalStyles: [
        "chanson spoken-to-sung", "airy close-mic", "breath-led phrasing",
        "cabaret belt", "whisper-to-belt", "yé-yé bright", "lyric belt",
        "parlé-chanté hybrid"
      ],
      ensembles: [
        "chanson trio", "gypsy-jazz quartet", "chamber-pop quintet",
        "synth-pop band", "cabaret ensemble", "French-indie trio"
      ],
      instrumentation: [
        "accordion, double bass, brushed drums",
        "grand piano, cello, soft percussion",
        "electric guitar, synth pad, punchy kit",
        "violin, gypsy guitar, warm bass",
        "acoustic guitar, trumpet, organ"
      ],
      moodAccent: ["boulevard-rain tender", "cafe-smoke wistful", "metro-late quiet", "riviera-bright"],
      titleHints: ["pluie de Paris", "nuit bleue", "métro dernier", "la Seine", "un matin", "promenade"],
      promptFrame: "Cultural frame: Francophonie. Favor café/rain/metro imagery, parlé-chanté delivery, literary verses."
    },

    italianate: {
      code: "italianate",
      label: "Italianate",
      genres: [
        "Italian Pop", "Canzone d'Autore", "Italian Rock", "Operatic Pop",
        "Italo-Disco", "Italian Indie", "Italian R&B", "Tarantella-Adjacent",
        "Italian Jazz", "Cinema Italia", "Neapolitan Song", "Italian Folk"
      ],
      instruments: [
        "Mandolin", "Accordion", "Classical Guitar", "Piano", "Violin",
        "Cello", "Acoustic Guitar", "Electric Guitar", "Tambourine",
        "Synthesizer", "Drum Kit", "Organ"
      ],
      vocalStyles: [
        "operatic belt", "airy close-mic", "cantautore conversational",
        "breath-led phrasing", "lyric belt", "whisper-to-belt",
        "italo-disco cool", "tarantella swagger"
      ],
      ensembles: [
        "operatic chamber", "canzone trio", "italo-disco band",
        "chamber-pop quintet", "jazz club quartet", "cantautore duo"
      ],
      instrumentation: [
        "mandolin, accordion, brushed drums",
        "grand piano, cello, soft percussion",
        "classical guitar, tambourine, warm bass",
        "synth bass, analog pad, punchy kit",
        "violin, organ, acoustic guitar"
      ],
      moodAccent: ["piazza-dusk tender", "amalfi-bright", "vespa-late wistful", "campanile-quiet reverent"],
      titleHints: ["pioggia di maggio", "una strada", "ti aspetto", "notte romana", "il mare", "domani"],
      promptFrame: "Cultural frame: Italianate. Favor piazza/mare/cinema imagery, cantautore intimacy, operatic swells."
    },

    germanic: {
      code: "germanic",
      label: "Germanic",
      genres: [
        "Liedermacher", "German Pop", "Schlager", "Krautrock", "German Indie",
        "Deutsch-Rock", "Electronic Pop", "German R&B", "Chamber-Folk",
        "German Cinematic", "Neue Deutsche Welle", "Dutch Pop"
      ],
      instruments: [
        "Acoustic Guitar", "Electric Guitar", "Piano", "Accordion", "Cello",
        "Violin", "Synthesizer", "Drum Kit", "Bass Guitar", "Clarinet",
        "Harmonium", "Organ"
      ],
      vocalStyles: [
        "liedermacher spoken-to-sung", "airy close-mic", "breath-led phrasing",
        "schlager warmth", "lyric belt", "whisper-to-belt",
        "krautrock detached", "chamber-folk intimate"
      ],
      ensembles: [
        "liedermacher duo", "chamber-pop quintet", "krautrock quartet",
        "synth-pop band", "indie-rock four-piece", "cabaret ensemble"
      ],
      instrumentation: [
        "acoustic guitar, cello, brushed drums",
        "analog synth, motorik drums, warm bass",
        "grand piano, clarinet, soft percussion",
        "electric guitar, organ, punchy kit",
        "accordion, violin, double bass"
      ],
      moodAccent: ["autumn-lane tender", "bahnhof-late wistful", "alpine-bright", "hauptstadt-grey contemplative"],
      titleHints: ["Regen am Abend", "Heimweg", "Lichter", "Berlin im Winter", "unter Sternen", "Stille"],
      promptFrame: "Cultural frame: Germanic. Favor measured verses, seasonal/urban imagery, restrained delivery."
    },

    slavic: {
      code: "slavic",
      label: "Slavic",
      genres: [
        "Slavic Pop", "Russian Chanson", "Estrada", "Romani-Influenced",
        "Balkan Pop", "Slavic Indie", "Slavic Rock", "Slavic Folk",
        "Slavic Electronic", "Slavic Cinematic", "Bard Song", "Slavic R&B"
      ],
      instruments: [
        "Balalaika", "Bayan", "Domra", "Gusli", "Accordion", "Violin",
        "Cello", "Acoustic Guitar", "Electric Guitar", "Piano",
        "Synthesizer", "Drum Kit"
      ],
      vocalStyles: [
        "bard spoken-to-sung", "airy close-mic", "breath-led phrasing",
        "estrada belt", "whisper-to-belt", "lyric belt",
        "romani melisma", "chanson growl"
      ],
      ensembles: [
        "bard duo", "chamber folk quartet", "Balkan brass band",
        "estrada quintet", "indie rock four-piece", "Slavic-jazz trio"
      ],
      instrumentation: [
        "balalaika, bayan, warm bass",
        "domra, violin, soft percussion",
        "grand piano, cello, brushed drums",
        "accordion, acoustic guitar, double bass",
        "synth pad, electric guitar, punchy kit"
      ],
      moodAccent: ["steppe-wind longing", "winter-train quiet", "kitchen-table warm", "birch-forest reverent"],
      titleHints: ["снег", "последний поезд", "фонари", "дорога домой", "тишина", "ніч", "кроки"],
      promptFrame: "Cultural frame: Slavic. Favor seasonal/railway/kitchen imagery, literary verses, minor-mode warmth."
    },

    anatolia: {
      code: "anatolia",
      label: "Anatolia",
      genres: [
        "Turkish Pop", "Arabesk", "Türkü", "Özgün Müzik", "Fantezi",
        "Turkish Indie", "Turkish Rock", "Anadolu Rock", "Turkish R&B",
        "Turkish Electronic", "Sufi Pop", "Turkish Jazz"
      ],
      instruments: [
        "Saz", "Bağlama", "Oud", "Kanun", "Ney", "Darbuka", "Kemençe",
        "Zurna", "Piano", "Acoustic Guitar", "Electric Guitar", "Synth Pad"
      ],
      vocalStyles: [
        "arabesk melisma", "airy close-mic", "breath-led phrasing",
        "türkü warmth", "whisper-to-belt", "lyric belt", "sufi chant",
        "fantezi belt"
      ],
      ensembles: [
        "saz-led trio", "fasıl ensemble", "anadolu-rock quartet",
        "chamber fusion", "synth-pop band", "sufi chorus"
      ],
      instrumentation: [
        "saz, darbuka, warm bass",
        "bağlama, ney, soft percussion",
        "oud, kanun, brushed drums",
        "electric guitar, synth pad, punchy kit",
        "kemençe, piano, string pad"
      ],
      moodAccent: ["bosphorus-dusk tender", "anatolian-road longing", "ezan-quiet reverent", "meyhane-late wistful"],
      titleHints: ["gece yolu", "deniz kenarı", "çay bahçesi", "uzak şehir", "kar", "hasret"],
      promptFrame: "Cultural frame: Anatolia. Favor makam-adjacent melodic shapes, road/sea/teahouse imagery, longing."
    },

    levant: {
      code: "levant",
      label: "Levant",
      genres: [
        "Levantine Pop", "Tarab", "Mahraganat", "Mizrahi Pop", "Armenian Pop",
        "Levant Indie", "Levant R&B", "Levant Jazz", "Dabke-Adjacent",
        "Levant Cinematic", "Sufi Pop", "Maqam Fusion"
      ],
      instruments: [
        "Oud", "Qanun", "Ney", "Darbuka", "Riq", "Buzuq", "Duduk",
        "Mizmar", "Piano", "Acoustic Guitar", "String Ensemble", "Synth Pad"
      ],
      vocalStyles: [
        "tarab melisma", "airy close-mic", "breath-led phrasing",
        "maqam-inflected belt", "whisper-to-belt", "lyric belt",
        "mizrahi ornamentation", "sufi chant"
      ],
      ensembles: [
        "takht ensemble", "chamber fusion", "dabke band",
        "synth-pop band", "acoustic trio", "maqam chorus"
      ],
      instrumentation: [
        "oud, qanun, riq",
        "ney, duduk, darbuka",
        "buzuq, piano, warm bass",
        "mizmar, synth pad, brushed drums",
        "string ensemble, darbuka, oud"
      ],
      moodAccent: ["olive-grove tender", "old-city reverent", "seaside-dusk wistful", "procession-bright"],
      titleHints: ["שמים", "القدس", "Երեկո", "بحر", "زيتون", "ליל"],
      promptFrame: "Cultural frame: Levant. Favor old-city/olive-grove/sea imagery, tarab dynamics, maqam-adjacent ornament."
    },

    east_african: {
      code: "east_african",
      label: "East African",
      genres: [
        "Bongo Flava", "Afro-Fusion", "East-African Gospel", "Taarab",
        "Swahili Pop", "Amapiano-Influenced", "Swahili R&B", "Rumba-Lingala",
        "Indie EA", "East-African Cinematic", "Nyatiti-Infused", "Chakacha"
      ],
      instruments: [
        "Nyatiti", "Kora", "Djembe", "Marimba", "Mbira", "Orutu",
        "Acoustic Guitar", "Electric Guitar", "Piano", "Synthesizer",
        "Bass Guitar", "Percussion Kit"
      ],
      vocalStyles: [
        "taarab melisma", "airy close-mic", "breath-led phrasing",
        "gospel belt", "whisper-to-belt", "lyric belt",
        "amapiano log-drum vocal", "rumba-lingala soaring"
      ],
      ensembles: [
        "taarab ensemble", "afro-fusion quartet", "gospel choir",
        "amapiano rhythm section", "chamber fusion", "acoustic trio"
      ],
      instrumentation: [
        "nyatiti, djembe, warm bass",
        "marimba, mbira, soft percussion",
        "acoustic guitar, log drums, sub bass",
        "orutu, synth pad, punchy kit",
        "piano, rumba-lingala guitar, brushed drums"
      ],
      moodAccent: ["coast-breeze tender", "matatu-bright", "mountain-quiet reverent", "night-market joyous"],
      titleHints: ["pwani", "nyota", "mvua ya Desemba", "safari ya usiku", "mwanga", "upendo"],
      promptFrame: "Cultural frame: East African. Favor coast/mountain/matatu imagery, groove-forward delivery."
    },

    west_african: {
      code: "west_african",
      label: "West African",
      genres: [
        "Afrobeats", "Afrobeat (classic)", "Highlife", "Juju", "Afro-Soul",
        "Alté", "West-African Gospel", "Mande-Influenced", "Mbalax",
        "Afro-R&B", "Afro-House", "Griot-Pop"
      ],
      instruments: [
        "Kora", "Balafon", "Talking Drum", "Djembe", "Ngoni", "Sabar",
        "Electric Guitar", "Bass Guitar", "Synthesizer", "Keyboard",
        "Horns Section", "Percussion Kit"
      ],
      vocalStyles: [
        "griot declamation", "airy close-mic", "afrobeats conversational",
        "breath-led phrasing", "gospel belt", "whisper-to-belt",
        "alté dreamy", "lyric belt"
      ],
      ensembles: [
        "afrobeats rhythm section", "highlife band", "mbalax ensemble",
        "griot-pop trio", "gospel choir", "chamber fusion"
      ],
      instrumentation: [
        "kora, balafon, warm bass",
        "talking drum, electric guitar, log drums",
        "ngoni, synth pad, soft percussion",
        "horns section, sabar, punchy kit",
        "keyboard, djembe, sub bass"
      ],
      moodAccent: ["lagos-dusk bright", "griot-reverent", "market-joyous", "harmattan-wistful"],
      titleHints: ["jollof nights", "harmattan", "Accra rain", "moonlight dance", "griot's song", "Lagos sunset"],
      promptFrame: "Cultural frame: West African. Favor groove-forward verses, market/harmattan/lagos imagery, call-and-response."
    },

    southern_african: {
      code: "southern_african",
      label: "Southern African",
      genres: [
        "Amapiano", "Kwaito", "Maskandi", "Mbaqanga", "South-African Jazz",
        "SA Gospel", "Afro-House", "SA Indie", "Bacardi", "SA R&B",
        "Afro-Tech", "Boeremusiek"
      ],
      instruments: [
        "Log Drum", "Marimba", "Mbira", "Concertina", "Acoustic Guitar",
        "Electric Guitar", "Synthesizer", "Piano", "Bass Guitar",
        "Percussion Kit", "Saxophone", "Keyboard"
      ],
      vocalStyles: [
        "amapiano log-drum vocal", "airy close-mic", "maskandi chant",
        "breath-led phrasing", "whisper-to-belt", "kwaito rap",
        "gospel belt", "mbaqanga groan"
      ],
      ensembles: [
        "amapiano collective", "mbaqanga band", "kwaito crew",
        "SA-jazz quintet", "gospel choir", "maskandi duo"
      ],
      instrumentation: [
        "log drums, shakers, sub bass",
        "marimba, mbira, warm bass",
        "concertina, acoustic guitar, soft percussion",
        "synth pad, keyboard, punchy kit",
        "saxophone, piano, brushed drums"
      ],
      moodAccent: ["highveld-dusk contemplative", "township-joyous", "karoo-quiet reverent", "coastal-bright"],
      titleHints: ["sunset over the veld", "ekhaya", "abantwana", "iAfrika", "karoo rain", "street gospel"],
      promptFrame: "Cultural frame: Southern African. Favor log-drum/marimba textures, township/veld imagery, groove-forward."
    },

    // Blended cross-cultural pool used when no explicit language is selected.
    // Smaller per-category than a focused civilization because we *want* users
    // to feel the draw to pick a language; still larger than the old 3-branch
    // fallback.
    roam: {
      code: "roam",
      label: "Cross-Cultural Roam",
      genres: [
        "Pop", "Rock", "Jazz", "R&B", "EDM", "Folk", "Country", "Classical",
        "Indie", "Soul", "Cinematic", "Ambient", "Electronic Pop",
        "Chamber-Folk"
      ],
      instruments: [
        "Piano", "Acoustic Guitar", "Electric Guitar", "Bass Guitar",
        "Drum Kit", "Violin", "Cello", "Saxophone", "Trumpet",
        "Synthesizer", "Harp", "Flute", "Organ"
      ],
      vocalStyles: [
        "airy close-mic", "lyric belt", "soft opera shimmer", "soul rasp",
        "choral unison", "breath-led phrasing", "whisper-to-belt",
        "conversational speak-sing"
      ],
      ensembles: [
        "chamber ensemble", "synth-pop band", "cinematic orchestra",
        "indie quartet", "jazz quintet", "singer-songwriter trio",
        "festival percussion circle"
      ],
      instrumentation: [
        "grand piano, cello, brushed drums",
        "analog bass, polysynth pad, punchy kit",
        "chamber strings, horn layer, soft percussion",
        "electric guitar, bass, live drums",
        "acoustic guitar, violin, warm bass"
      ],
      moodAccent: ["late-night tender", "travel-bright", "festival joyous", "memory-wistful"],
      titleHints: ["horizon", "last train", "blue hour", "home again", "lantern", "open road"],
      promptFrame: "Cultural frame: cross-cultural. No strict civilization; favor cinematic, travel-led imagery."
    }
  });

  // -------------------------------------------------------------- ACCESSORS
  function normalizeLocaleCode(input) {
    const raw = String(input || "").trim().toLowerCase();
    if (!raw) return "";
    // Accept "zh-CN" → "zh-cn", strip anything past a second dash.
    return raw.replace(/_/g, "-").split(".")[0];
  }

  function resolveCivilizationKey(locale) {
    const code = normalizeLocaleCode(locale);
    if (!code) return "roam";
    if (LOCALE_TO_CIVILIZATION[code]) return LOCALE_TO_CIVILIZATION[code];
    const base = code.split("-")[0];
    if (LOCALE_TO_CIVILIZATION[base]) return LOCALE_TO_CIVILIZATION[base];
    return "anglophone";
  }

  function getCivilization(locale) {
    const key = resolveCivilizationKey(locale);
    return CIVILIZATIONS[key] || CIVILIZATIONS.anglophone;
  }

  function getCivilizationByKey(key) {
    return CIVILIZATIONS[key] || CIVILIZATIONS.anglophone;
  }

  // When the user didn't explicitly pick a language we want each re-roll to
  // hop civilizations rather than stay pinned to "anglophone". Given a seed,
  // deterministically pick one of the non-roam civilizations.
  function pickRoamCivilization(seed) {
    const keys = Object.keys(CIVILIZATIONS).filter((k) => k !== "roam");
    const pickFn = typeof global.seededPick === "function" ? global.seededPick : null;
    if (pickFn) {
      const picked = pickFn(keys, seed, 0);
      if (picked && CIVILIZATIONS[picked]) return CIVILIZATIONS[picked];
    }
    // Fallback: simple modulo pick.
    const safeSeed = Number.isFinite(seed) ? (seed >>> 0) : 0;
    return CIVILIZATIONS[keys[safeSeed % keys.length]] || CIVILIZATIONS.anglophone;
  }

  // Combine universal moods with civilization-specific accents into one pool.
  function getMoodPoolForCivilization(civ) {
    const accent = civ && Array.isArray(civ.moodAccent) ? civ.moodAccent : [];
    return UNIVERSAL_MOODS.concat(accent);
  }

  function listCivilizationKeys() {
    return Object.keys(CIVILIZATIONS);
  }

  function listLocaleCodes() {
    return Object.keys(LOCALE_TO_CIVILIZATION);
  }

  // -------------------------------------------------------------- SEED NONCE
  // Breaks the Date.now() collision problem: two rapid randomize clicks within
  // the same millisecond would otherwise produce the same seed. We add a
  // crypto nonce so identical titles clicked twice still diverge.
  function generateSeedNonce() {
    try {
      const arr = new Uint32Array(2);
      (global.crypto || global.msCrypto).getRandomValues(arr);
      return `${arr[0].toString(36)}${arr[1].toString(36)}`;
    } catch (_err) {
      return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    }
  }

  // --------------------------------------------------------------------- EXPORT
  global.CSSOS_CIVILIZATION_BANK = {
    CIVILIZATIONS,
    LOCALE_TO_CIVILIZATION,
    UNIVERSAL_MOODS,
    COMMON_KEYS,
    normalizeLocaleCode,
    resolveCivilizationKey,
    getCivilization,
    getCivilizationByKey,
    pickRoamCivilization,
    getMoodPoolForCivilization,
    listCivilizationKeys,
    listLocaleCodes,
    generateSeedNonce
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
