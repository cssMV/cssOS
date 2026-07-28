import sharp from "sharp";
import fs from "fs";

const BASE = "https://cssstudio.app";
async function pull(p, extract) {
  try {
    const r = await fetch(BASE + p);
    if (!r.ok) return [];
    return extract(await r.json());
  } catch { return []; }
}
const urls = [];
urls.push(...await pull("/api/works/flagships", j => (j?.items||[]).map(x=>String(x?.cover||""))));
urls.push(...await pull("/api/works/market?limit=24", j => { const it=j?.items||j?.data||[]; return (Array.isArray(it)?it:[]).map(x=>String(x?.cover||x?.cover_image||x?.cover_url||"")); }));
urls.push(...await pull("/api/person-mv/discover/hot", j => (j?.data?.persons||[]).map(x=>String(x?.top_cover||""))));
const EPHEMERAL=/(^|\.)(replicate\.delivery|fal\.media|pbxt\.|oaidalleapiprodscus|blob\.core\.windows\.net)/i;
const seen=new Set(); const pool=[];
for (const u of urls){ if(!/^https?:\/\//i.test(u))continue; if(seen.has(u))continue; let h=""; try{h=new URL(u).hostname;}catch{continue;} if(EPHEMERAL.test(h))continue; seen.add(u); pool.push(u); }
console.log("pool size:", pool.length);
const pick = pool.slice().sort(()=>Math.random()-0.5).slice(0,3);
console.log("picked:", pick.map(u=>u.slice(0,60)));

const W=1200,H=630,GAP=4, panelW=Math.floor((W-GAP*2)/3);
const comps=[]; let x=0;
for (const url of pick){
  try{ const r=await fetch(url,{redirect:"follow"}); if(r.ok){ const raw=Buffer.from(await r.arrayBuffer());
    const panel=await sharp(raw,{failOn:"none"}).resize(panelW,H,{fit:"cover",position:"attention"}).toBuffer();
    comps.push({input:panel,left:x,top:0}); } }catch(e){ console.log("skip",e.message); }
  x+=panelW+GAP;
}
const GREEN="#00f5a0";
const svg=`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>
<linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0.42" stop-color="#040608" stop-opacity="0"/><stop offset="1" stop-color="#040608" stop-opacity="0.96"/></linearGradient>
<linearGradient id="lvig" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#040608" stop-opacity="0.6"/><stop offset="1" stop-color="#040608" stop-opacity="0"/></linearGradient></defs>
<rect x="0" y="0" width="${W}" height="${H}" fill="url(#scrim)"/><rect x="0" y="0" width="560" height="${H}" fill="url(#lvig)"/>
<rect x="0" y="0" width="${W}" height="5" fill="${GREEN}"/>
<g font-family="Helvetica, Arial, sans-serif">
<rect x="56" y="46" width="196" height="42" rx="21" fill="${GREEN}"/>
<text x="80" y="75" font-size="23" font-weight="700" fill="#06120e" letter-spacing="1.5">CSS STUDIO</text>
<text x="52" y="${H-116}" font-size="112" font-weight="800" fill="${GREEN}">cssOS</text>
<text x="58" y="${H-64}" font-size="39" font-weight="700" fill="#f0f4f6">Watch + create AI music videos — with sound</text>
<text x="${W-56}" y="${H-32}" font-size="33" font-weight="700" fill="${GREEN}" text-anchor="end">cssstudio.app</text></g></svg>`;
comps.push({input:Buffer.from(svg),left:0,top:0});
const out=await sharp({create:{width:W,height:H,channels:3,background:{r:8,g:10,b:12}}}).composite(comps).png().toBuffer();
fs.writeFileSync("scratchpad/og/dynamic-test.png", out);
console.log("panels composited:", comps.length-1, "bytes:", out.length);
