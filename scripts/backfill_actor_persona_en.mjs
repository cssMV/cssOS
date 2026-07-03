// CSSOS_WAVE_116 一次性: 把演员 persona 里的中文译成简洁英文(平台默认英文; 详情页直接显示 persona)。
// persona 也喂 face_prompt/showcase, 英文更好。跑法: api-vm 上 node scripts/backfill_actor_persona_en.mjs
import pg from "pg";
const url = process.env.DATABASE_URL, apiKey = process.env.DEEPSEEK_API_KEY;
if (!url || !apiKey) { console.error("need DATABASE_URL + DEEPSEEK_API_KEY"); process.exit(1); }
const CJK = /[㐀-鿿぀-ヿ]/;

async function translateBatch(items) {
  const list = items.map((r, i) => `${i}. ${r.text}`).join("\n");
  const body = { model: "deepseek-chat", temperature: 0.2, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Translate each numbered digital-actor persona/character-description into vivid concise English (keep it a short evocative phrase, <=120 chars each, no quotes). Reply STRICT JSON {\"t\":{\"<index>\":\"<english>\"}}." },
      { role: "user", content: list },
    ] };
  const r = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
  const j = await r.json();
  try { var o = JSON.parse(j.choices[0].message.content); return o.t || o.translations || o; } catch { return {}; }
}

const client = new pg.Client({ connectionString: url });
await client.connect();
const { rows } = await client.query(`SELECT actor_id, persona FROM digital_actors WHERE persona IS NOT NULL AND persona<>''`);
const jobs = rows.filter((r) => CJK.test(r.persona)).map((r) => ({ actor_id: r.actor_id, text: r.persona }));
console.log(`cjk persona: ${jobs.length}`);
let done = 0;
for (let i = 0; i < jobs.length; i += 25) {
  const batch = jobs.slice(i, i + 25);
  let map = {}; try { map = await translateBatch(batch); } catch (e) { console.warn("fail", i, e.message); }
  for (let k = 0; k < batch.length; k++) {
    const en = (map[String(k)] || map[k] || "").trim();
    if (!en || CJK.test(en)) continue;
    await client.query(`UPDATE digital_actors SET persona=$2 WHERE actor_id=$1`, [batch[k].actor_id, en.slice(0, 600)]);
    done++;
  }
  console.log(`  ..${Math.min(i + 25, jobs.length)}/${jobs.length} (updated ${done})`);
}
console.log(`DONE updated=${done}`);
await client.end();
