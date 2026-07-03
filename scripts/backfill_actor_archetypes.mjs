// CSSOS_WAVE_116 一次性回填: 给现有数字演员打戏路大类。跨语言(中/英/…)故用 LLM 批量分类。
// 只回填 archetypes 为空的; 每人 1-2 个大类, key 取自固定表。跑法: 在 api-vm 上 `node scripts/backfill_actor_archetypes.mjs`。
import pg from "pg";

const KEYS = ["hero","villain","antihero","ruler","action","sage","charmer","tragic","comic","enigma","youth"];
const GUIDE = "hero=righteous protagonist; villain=evil antagonist; antihero=morally-gray rogue/rebel; ruler=king/queen/emperor/power; action=warrior/fighter/hardened; sage=wise mentor/scholar/mage; charmer=alluring lover/diva/idol; tragic=sorrowful/fallen/martyr; comic=jester/trickster/funny; enigma=cold/mysterious/masked; youth=young/prodigy/coming-of-age";

const url = process.env.DATABASE_URL;
const apiKey = process.env.DEEPSEEK_API_KEY;
if (!url || !apiKey) { console.error("need DATABASE_URL + DEEPSEEK_API_KEY"); process.exit(1); }
const base = "https://api.deepseek.com";
const MODEL = "deepseek-chat";

async function classify(batch) {
  const list = batch.map((r, i) => `${i}. ${r.name_en || r.name_zh}: ${String(r.persona || r.role_range || r.style_descriptor || r.civilization || "").slice(0, 160)}`).join("\n");
  const body = {
    model: MODEL, temperature: 0.2, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `You tag digital-actor casting archetypes. Allowed keys ONLY: ${KEYS.join(", ")}. Meanings: ${GUIDE}. For each numbered actor pick the 1-2 BEST-fitting keys. Reply STRICT JSON {"tags":{"<index>":["key1","key2"]}} using the numeric index. Never invent keys.` },
      { role: "user", content: list },
    ],
  };
  const r = await fetch(`${base}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
  const j = await r.json();
  const txt = j?.choices?.[0]?.message?.content || "{}";
  let map = {};
  try { map = JSON.parse(txt).tags || {}; } catch {}
  return map;
}

const client = new pg.Client({ connectionString: url });
await client.connect();
const { rows } = await client.query(
  `SELECT actor_id, name_en, name_zh, persona, role_range, style_descriptor, civilization
     FROM digital_actors WHERE cardinality(archetypes)=0 ORDER BY actor_id`);
console.log(`to classify: ${rows.length}`);
let updated = 0, empty = 0;
for (let i = 0; i < rows.length; i += 25) {
  const batch = rows.slice(i, i + 25);
  let map = {};
  try { map = await classify(batch); } catch (e) { console.warn("batch fail", i, e.message); }
  for (let k = 0; k < batch.length; k++) {
    const tags = (map[String(k)] || map[k] || []).filter((t) => KEYS.includes(t)).slice(0, 2);
    if (!tags.length) { empty++; continue; }
    await client.query(`UPDATE digital_actors SET archetypes=$2 WHERE actor_id=$1`, [batch[k].actor_id, tags]);
    updated++;
  }
  console.log(`  ..${Math.min(i + 25, rows.length)}/${rows.length} (updated ${updated})`);
}
console.log(`DONE updated=${updated} left_empty=${empty}`);
await client.end();
