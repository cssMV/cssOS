/* CSSOS_PERSON_MV_WAVE16 20260508 — Jing
 *
 * Seed roster for "流派 / 学派" — intellectual / cultural movements that
 * group seeded persons together. Only groups whose ALL declared members
 * exist in person_mv_seed.ts will be inserted (see seedPersonGroupsOnce
 * in src/index.ts).
 */

export type SeedPersonGroupMember = {
  person_id: string;
  role?: string; // founder | member | successor | …
};

export type SeedPersonGroup = {
  group_id: string;
  name_zh: string;
  name_en: string;
  description_zh?: string;
  description_en?: string;
  era?: string;
  civilization?: string;
  visual_theme?: { color?: string; icon?: string };
  members: SeedPersonGroupMember[];
};

export const SEED_PERSON_GROUPS: SeedPersonGroup[] = [
  {
    group_id: "rujia",
    name_zh: "儒家",
    name_en: "Confucianism",
    description_zh: "以礼与仁重建秩序的中华思想流派。",
    description_en: "Chinese school of thought re-grounding order in 礼 and 仁.",
    era: "春秋-战国",
    civilization: "中华文明",
    visual_theme: { color: "#c9a86a", icon: "📜" },
    members: [
      { person_id: "confucius", role: "founder" },
      { person_id: "mencius", role: "successor" },
    ],
  },
  {
    group_id: "daojia",
    name_zh: "道家",
    name_en: "Daoism",
    description_zh: "道法自然，无为而治。",
    description_en: "Way-of-nature philosophy: act without forcing.",
    era: "春秋-战国",
    civilization: "中华文明",
    visual_theme: { color: "#7da89a", icon: "☯" },
    members: [
      { person_id: "laozi", role: "founder" },
      { person_id: "zhuangzi", role: "member" },
    ],
  },
  {
    group_id: "greek_philosophy",
    name_zh: "古希腊哲学",
    name_en: "Greek Philosophy",
    description_zh: "雅典学派——苏格拉底-柏拉图-亚里士多德的师承。",
    description_en: "The Athenian lineage: Socrates → Plato → Aristotle.",
    era: "古典时期",
    civilization: "古希腊文明",
    visual_theme: { color: "#cfd8dc", icon: "🏛" },
    members: [
      { person_id: "socrates", role: "founder" },
      { person_id: "plato", role: "successor" },
      { person_id: "aristotle", role: "successor" },
    ],
  },
  {
    group_id: "roman_empire",
    name_zh: "罗马帝国",
    name_en: "Roman Empire",
    description_zh: "从共和到帝国——凯撒与奥古斯都。",
    description_en: "From republic to empire: Caesar and Augustus.",
    era: "公元前1世纪-公元1世纪",
    civilization: "古罗马文明",
    visual_theme: { color: "#b34a3a", icon: "🦅" },
    members: [
      { person_id: "julius-caesar", role: "founder" },
      { person_id: "augustus", role: "successor" },
    ],
  },
  {
    group_id: "renaissance",
    name_zh: "文艺复兴",
    name_en: "Renaissance",
    description_zh: "好奇心驱动的艺术与科学复兴。",
    description_en: "A rebirth of art and science driven by curiosity.",
    era: "15-17世纪",
    civilization: "欧洲文明",
    visual_theme: { color: "#d4a373", icon: "🎨" },
    members: [
      { person_id: "leonardo-da-vinci", role: "member" },
      { person_id: "shakespeare", role: "member" },
    ],
  },
  {
    group_id: "enlightenment_science",
    name_zh: "启蒙科学",
    name_en: "Enlightenment Science",
    description_zh: "用理性与方程描绘宇宙。",
    description_en: "Mapping the cosmos with reason and equations.",
    era: "17-20世纪",
    civilization: "近现代科学",
    visual_theme: { color: "#6aa9d8", icon: "🔬" },
    members: [
      { person_id: "newton", role: "founder" },
      { person_id: "einstein", role: "successor" },
    ],
  },
];
