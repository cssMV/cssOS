// 修正: 重生成用真神明名(Kali/Yama)命名的反派 → 纯原创名, 禁用任何真实神明/宗教人物名。
import pg from "pg";
import crypto from "crypto";
const url = process.env.DATABASE_URL, apiKey = process.env.DEEPSEEK_API_KEY;
const KEYS = ["hero","villain","antihero","ruler","action","sage","charmer","tragic","comic","enigma","youth"];
const FIX_CIVS = ["Afro-Futurist", "印度文明", "古印度文明", "现代印度", "藏文明"];

async function invent(civ) {
  const body = { model: "deepseek-chat", temperature: 1.0, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `Invent ONE ORIGINAL fictional VILLAIN fitting the given civilization's aesthetic. HARD RULES: the name must be a PURE INVENTION — NOT named after any real deity, god, goddess, prophet, or religious figure (e.g. NOT Kali, Yama, Shiva, Buddha, etc.), NOT a copyrighted character, NOT a real person. Reply STRICT JSON: {"name_en":"<invented English name>","name_zh":"<中文名>","persona":"<中文一句20字内, 该文明风味反派>","appearance":"<English 4-5 comma tags>","gender":"male|female|androgynous","archetypes":["villain","<one more of: ${KEYS.join(",")}>"],"style":"<English style <=40 chars>","voice":"<English voice <=30 chars>"}.` },
      { role: "user", content: `civilization: ${civ}` },
    ] };
  const r = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
  try { return JSON.parse((await r.json()).choices[0].message.content); } catch { return null; }
}
const client = new pg.Client({ connectionString: url });
await client.connect();
for (const civ of FIX_CIVS) {
  let v = null;
  for (let t = 0; t < 3 && !v; t++) { const g = await invent(civ); if (g && g.name_en && !/kali|yama|shiva|buddha|vishnu|brahma/i.test(g.name_en)) v = g; }
  if (!v) { console.warn("skip", civ); continue; }
  const id = "act-villain-civ-" + crypto.createHash("sha1").update(civ).digest("hex").slice(0, 8);
  const arche = (v.archetypes || ["villain"]).filter((k) => KEYS.includes(k)); if (!arche.includes("villain")) arche.unshift("villain");
  const appTags = String(v.appearance || "").split(/[,，]/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
  const facePrompt = `${v.persona}, a striking original synthetic villain character (not a real person), ${appTags.join(", ")}, ${civ} aesthetic, menacing cinematic character portrait, consistent identity across shots`;
  await client.query(`UPDATE digital_actors SET name_en=$2, name_zh=$3, persona=$4, gender=$5, appearance_tags=$6, voice_style=$7, face_prompt=$8, style_descriptor=$9, archetypes=$10, updated_at=now() WHERE actor_id=$1`,
    [id, v.name_en, v.name_zh || v.name_en, v.persona || "", ["male","female","androgynous"].includes(v.gender) ? v.gender : "neutral", appTags, v.voice || "menacing voice", facePrompt, String(v.style || "dark cinematic").slice(0, 60), arche.slice(0, 3)]);
  console.log(`  ~ ${civ} → ${v.name_en} [${arche.join(",")}]`);
}
await client.end();
