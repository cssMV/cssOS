/* CSSOS_PERSON_MV_WAVE23 20260508 — Jing
 *
 * Festival roster powering the homepage "🎊 节日特辑" shelf and dedicated
 * festival pages. Each row maps a date_rule (gregorian:MM-DD or
 * lunar:MM-DD) to featured persons drawn from person_mv_seed.ts.
 *
 * Festivals whose featured_persons aren't ALL present in the seed are
 * skipped at boot (see seedFestivalsOnce in src/index.ts) — they may be
 * surfaced in a later wave when the seed roster expands.
 *
 * Lunar dates: we don't depend on lunar-javascript; the conversion table
 * for 春节/端午/中秋 2024-2030 lives in src/index.ts:LUNAR_DATES.
 */

export type SeedFestival = {
  festival_id: string;
  name_zh: string;
  name_en: string;
  description_zh?: string;
  description_en?: string;
  date_rule: string;          // "lunar:1-1" | "gregorian:12-25"
  emoji?: string;
  theme_color?: string;       // CSS color string for hero background
  featured_persons: string[]; // person_ids
};

export const SEED_FESTIVALS: SeedFestival[] = [
  {
    festival_id: "spring-festival",
    name_zh: "春节",
    name_en: "Lunar New Year",
    description_zh: "辞旧迎新,万家团圆。让中华文明的群星与你共度除夕。",
    description_en: "The Lunar New Year — reunion, renewal, and the long arc of Chinese civilization.",
    date_rule: "lunar:1-1",
    emoji: "🧧",
    theme_color: "#b8240b",
    featured_persons: ["confucius", "qin-shi-huang", "li-bai", "wu-zetian"],
  },
  {
    festival_id: "dragon-boat",
    name_zh: "端午",
    name_en: "Dragon Boat Festival",
    description_zh: "纪念屈子,听江畔风骨。",
    description_en: "Dragon Boat Festival — verses on the river, conscience above the court.",
    date_rule: "lunar:5-5",
    emoji: "🐉",
    theme_color: "#066547",
    featured_persons: ["confucius", "li-bai"],
  },
  {
    festival_id: "mid-autumn",
    name_zh: "中秋",
    name_en: "Mid-Autumn Festival",
    description_zh: "举头望明月。今夜的诗,与李白同饮。",
    description_en: "Mid-Autumn — drink with Li Bai under the same moon.",
    date_rule: "lunar:8-15",
    emoji: "🌕",
    theme_color: "#1a3a6b",
    featured_persons: ["li-bai", "confucius", "wu-zetian"],
  },
  {
    festival_id: "national-day-cn",
    name_zh: "国庆",
    name_en: "National Day (CN)",
    description_zh: "山河岁月,文明长河。",
    description_en: "National Day — the long river of civilization.",
    date_rule: "gregorian:10-1",
    emoji: "🎆",
    theme_color: "#c0282c",
    featured_persons: ["confucius", "qin-shi-huang", "wu-zetian"],
  },
  {
    festival_id: "christmas",
    name_zh: "圣诞",
    name_en: "Christmas",
    description_zh: "西方文明的冬日庆典。",
    description_en: "A winter feast across the Western world.",
    date_rule: "gregorian:12-25",
    emoji: "🎄",
    theme_color: "#0d5d2a",
    featured_persons: ["leonardo-da-vinci", "shakespeare", "newton"],
  },
  {
    festival_id: "easter",
    name_zh: "复活节",
    name_en: "Easter",
    description_zh: "西方春日的复活与新生。",
    description_en: "Spring resurrection — light returns.",
    date_rule: "gregorian:4-1", // approximate Sunday range; treated as a stub anchor
    emoji: "🐣",
    theme_color: "#e8b94a",
    featured_persons: ["leonardo-da-vinci", "shakespeare"],
  },
  {
    festival_id: "diwali",
    name_zh: "排灯节",
    name_en: "Diwali",
    description_zh: "印度文明的光之节。",
    description_en: "The festival of lights — India's deepest celebration.",
    date_rule: "gregorian:11-1", // stub anchor; lunar Hindu calendar varies
    emoji: "🪔",
    theme_color: "#d97706",
    featured_persons: ["buddha", "ashoka", "gandhi"],
  },
  {
    festival_id: "hanukkah",
    name_zh: "光明节",
    name_en: "Hanukkah",
    description_zh: "八夜的光明。",
    description_en: "Eight nights of lights.",
    date_rule: "gregorian:12-15", // stub anchor; Hebrew calendar varies
    emoji: "🕎",
    theme_color: "#1d4ed8",
    featured_persons: ["einstein"],
  },
  {
    festival_id: "labor-day",
    name_zh: "劳动节",
    name_en: "Labour Day",
    description_zh: "劳动者的颂歌。",
    description_en: "An anthem for working hands.",
    date_rule: "gregorian:5-1",
    emoji: "🛠",
    theme_color: "#b91c1c",
    featured_persons: ["marie-curie", "einstein", "gandhi"],
  },
];
