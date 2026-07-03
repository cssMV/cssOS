// CSSOS_WAVE_116 — 让每个文明至少有一个反派。对缺反派的文明, 用 DeepSeek 生成一个【原创】文明风味反派入库。
// 原创合成(零版权)。跑法: api-vm 上 node scripts/seed_villain_per_civ.mjs
import pg from "pg";
import crypto from "crypto";
const url = process.env.DATABASE_URL, apiKey = process.env.DEEPSEEK_API_KEY;
if (!url || !apiKey) { console.error("need DATABASE_URL + DEEPSEEK_API_KEY"); process.exit(1); }
const KEYS = ["hero","villain","antihero","ruler","action","sage","charmer","tragic","comic","enigma","youth"];

async function invent(civ) {
  const body = { model: "deepseek-chat", temperature: 0.9, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `Invent ONE ORIGINAL fictional VILLAIN character that fits the aesthetic of the given civilization/mythology. Must be an original creation (NOT a copyrighted or trademarked character, NOT a real living person, NOT a 20th-century dictator). Reply STRICT JSON: {"name_en":"<original English stage name>","name_zh":"<中文名>","persona":"<中文, 一句20字内, 该文明风味的反派设定>","appearance":"<English, 4-5 comma-separated visual tags>","gender":"male|female|androgynous","archetypes":["villain","<one more from: ${KEYS.join(",")}>"],"style":"<English music/art style, <=40 chars>","voice":"<English voice descriptor, <=30 chars>"}. Always include "villain" as the first archetype.` },
      { role: "user", content: `civilization: ${civ}` },
    ] };
  const r = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
  const j = await r.json();
  try { return JSON.parse(j.choices[0].message.content); } catch { return null; }
}

const client = new pg.Client({ connectionString: url });
await client.connect();
const { rows } = await client.query(`
  WITH civs AS (SELECT DISTINCT civilization c FROM digital_actors WHERE civilization IS NOT NULL),
       vil AS (SELECT DISTINCT civilization c FROM digital_actors WHERE 'villain'=ANY(archetypes))
  SELECT c.c FROM civs c LEFT JOIN vil v ON v.c=c.c WHERE v.c IS NULL ORDER BY c.c`);
console.log(`civs needing a villain: ${rows.length}`);
let made = 0;
for (const { c: civ } of rows) {
  const v = await invent(civ);
  if (!v || !v.name_en) { console.warn("skip (no gen):", civ); continue; }
  const arche = (v.archetypes || ["villain"]).filter((k) => KEYS.includes(k)); if (!arche.includes("villain")) arche.unshift("villain");
  const id = "act-villain-civ-" + crypto.createHash("sha1").update(civ).digest("hex").slice(0, 8);
  const appTags = String(v.appearance || "").split(/[,，]/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
  const facePrompt = `${v.persona}, a striking original synthetic villain character (not a real person), ${appTags.join(", ")}, ${civ} aesthetic, menacing cinematic character portrait, consistent identity across shots`;
  await client.query(
    `INSERT INTO digital_actors (actor_id, name_zh, name_en, origin_type, civilization, persona, gender,
        appearance_tags, voice_style, face_prompt, style_descriptor, tags, archetypes,
        is_premium, cast_price_cents, license_model, source_status, curation_tier, popularity_score)
     VALUES ($1,$2,$3,'synthetic',$4,$5,$6,$7,$8,$9,$10,$11,$12,true,199,'per_cast','curated','B',50)
     ON CONFLICT (actor_id) DO UPDATE SET persona=EXCLUDED.persona, archetypes=EXCLUDED.archetypes, updated_at=now()`,
    [id, v.name_zh || v.name_en, v.name_en, civ, v.persona || "", ["male","female","androgynous"].includes(v.gender) ? v.gender : "neutral",
     appTags, v.voice || "menacing voice", facePrompt, String(v.style || "dark cinematic").slice(0, 60), ["villain", "myth", "legend"], arche.slice(0, 3)]);
  made++;
  console.log(`  + ${civ} → ${v.name_en} [${arche.join(",")}]`);
}
console.log(`DONE created=${made}`);
await client.end();
