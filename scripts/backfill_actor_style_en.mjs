// CSSOS_WAVE_116 一次性: 把演员 style_descriptor / voice_style 里的中文译成简洁英文(平台默认英文)。
// style 不参与歌词路由(路由读 civilization), 英文对音乐引擎反而更好。跑法: api-vm 上 node scripts/backfill_actor_style_en.mjs
import pg from "pg";
const url = process.env.DATABASE_URL, apiKey = process.env.DEEPSEEK_API_KEY;
if (!url || !apiKey) { console.error("need DATABASE_URL + DEEPSEEK_API_KEY"); process.exit(1); }
const CJK = /[㐀-鿿぀-ヿ]/;

async function translateBatch(items) {
  const list = items.map((r, i) => `${i}. ${r.text}`).join("\n");
  const body = { model: "deepseek-chat", temperature: 0.2, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Translate each numbered short music/character style phrase into concise natural English (keep the ' / ' separators, <=60 chars each, no quotes). Reply STRICT JSON {\"t\":{\"<index>\":\"<english>\"}}." },
      { role: "user", content: list },
    ] };
  const r = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
  const j = await r.json();
  try { var o = JSON.parse(j.choices[0].message.content); return o.t || o.translations || o; }
  catch (e) { console.error("PARSE FAIL:", JSON.stringify(j).slice(0, 300)); return {}; }
}

const client = new pg.Client({ connectionString: url });
await client.connect();
const { rows } = await client.query(`SELECT actor_id, style_descriptor, voice_style FROM digital_actors`);
const jobs = [];
for (const r of rows) {
  if (r.style_descriptor && CJK.test(r.style_descriptor)) jobs.push({ actor_id: r.actor_id, col: "style_descriptor", text: r.style_descriptor });
  if (r.voice_style && CJK.test(r.voice_style)) jobs.push({ actor_id: r.actor_id, col: "voice_style", text: r.voice_style });
}
console.log(`cjk style fields: ${jobs.length}`);
let done = 0;
for (let i = 0; i < jobs.length; i += 25) {
  const batch = jobs.slice(i, i + 25);
  let map = {}; try { map = await translateBatch(batch); } catch (e) { console.warn("fail", i, e.message); }
  if (i === 0) console.error("DEBUG first map:", JSON.stringify(map).slice(0, 300));
  for (let k = 0; k < batch.length; k++) {
    const en = (map[String(k)] || map[k] || "").trim();
    if (!en || CJK.test(en)) continue;
    await client.query(`UPDATE digital_actors SET ${batch[k].col}=$2 WHERE actor_id=$1`, [batch[k].actor_id, en.slice(0, 120)]);
    done++;
  }
  console.log(`  ..${Math.min(i + 25, jobs.length)}/${jobs.length} (updated ${done})`);
}
console.log(`DONE updated=${done}`);
await client.end();
