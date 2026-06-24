"use strict";(function(){"use strict";if(globalThis.__cssosDmShimInstalled)return;globalThis.__cssosDmShimInstalled=!0;function realPresent(){return!!document.querySelector(".cssos-dm-host")}function mountStub(){if(!realPresent()&&!document.getElementById("cssos-dm-stub-btn")){var btn=document.createElement("button");btn.id="cssos-dm-stub-btn",btn.type="button",btn.setAttribute("aria-label","Messages"),btn.textContent="💌",btn.style.cssText="position:fixed;top:10px;right:44px;z-index:9998;width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,0.18);background:rgba(0,0,0,0.4);color:#dde6ff;font-size:16px;cursor:pointer;",btn.addEventListener("click",function(){try{window.location.hash="#dm"}catch{}try{btn.remove()}catch{}}),(document.body||document.documentElement).appendChild(btn)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",function(){setTimeout(mountStub,300)}):setTimeout(mountStub,300)})(),(function(){"use strict";if(window.__cssosContestLlmMounted)return;window.__cssosContestLlmMounted=!0;const ZH=/^zh/i.test(String(globalThis.currentLocale||navigator.language||"en")),T=(en,zh)=>ZH?zh:en,safe=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[m]);function injectStyles(){if(document.getElementById("cssos-contest-llm-style"))return;const s=document.createElement("style");s.id="cssos-contest-llm-style",s.textContent=`
      .cssos-contest-llm-badge {
        display: inline-flex; align-items: center; gap: 4px;
        background: rgba(120,160,255,0.18); color: inherit;
        border: 0; border-radius: 999px; padding: 2px 8px;
        font-size: 11px; font-weight: 600; cursor: pointer;
        margin-left: 6px;
      }
      .cssos-contest-llm-badge:hover { background: rgba(120,160,255,0.30); }
      .cssos-contest-llm-bubble {
        margin-top: 6px; padding: 8px 10px; border-radius: 8px;
        background: rgba(255,255,255,0.06); font-size: 12px; line-height: 1.5;
        border: 1px solid rgba(255,255,255,0.10); white-space: pre-wrap;
      }
      .cssos-contest-llm-bubble[hidden] { display: none; }
      html[data-theme="light"] .cssos-contest-llm-badge {
        background: rgba(0,160,100,0.18); color: #0f3a2a;
      }
      html[data-theme="light"] .cssos-contest-llm-badge:hover {
        background: rgba(0,160,100,0.30);
      }
      html[data-theme="light"] .cssos-contest-llm-bubble {
        background: rgba(0,160,100,0.06); border-color: rgba(0,160,100,0.20); color: #0f3a2a;
      }
    `,document.head.appendChild(s)}async function decorateEntry(el){if(!el||el.__cssosScored)return;el.__cssosScored=!0;const eid=el.getAttribute("data-contest-entry-id");if(eid)try{const j=await(await fetch(`/api/contests/entries/${encodeURIComponent(eid)}/score`,{credentials:"include"})).json();if(!j||!j.ok||!j.score)return;const score=j.score;injectStyles();const badge=document.createElement("button");badge.type="button",badge.className="cssos-contest-llm-badge",badge.title=T("LLM judge score","AI 评分"),badge.innerHTML=`🤖 ${T("Score","评分")}: ${Number(score.overall).toFixed(1)}`;const bubble=document.createElement("div");bubble.className="cssos-contest-llm-bubble",bubble.hidden=!0;const parts=[];score.creativity!=null&&parts.push(`${T("Creativity","创意")}: ${Number(score.creativity).toFixed(1)}`),score.craft!=null&&parts.push(`${T("Craft","制作")}: ${Number(score.craft).toFixed(1)}`),score.relevance!=null&&parts.push(`${T("Relevance","切题")}: ${Number(score.relevance).toFixed(1)}`),bubble.innerHTML=`<div style="font-weight:600;margin-bottom:4px;">${safe(parts.join("  ·  "))}</div>${safe(score.reasoning||"")}`,badge.addEventListener("click",()=>{bubble.hidden=!bubble.hidden}),el.appendChild(badge),el.appendChild(bubble)}catch{}}function scan(){document.querySelectorAll("[data-contest-entry-id]").forEach(decorateEntry)}window.cssosRenderContestLeaderboard=async function(container,contestId){if(!(!container||!contestId)){injectStyles(),container.innerHTML=globalThis.cssosSkeletonRowsMarkup?globalThis.cssosSkeletonRowsMarkup(5,T("Loading leaderboard…","加载排行榜…")):`<div style="opacity:0.6;font-size:12px;">${T("Loading leaderboard…","加载排行榜…")}</div>`;try{const j=await(await fetch(`/api/contests/${encodeURIComponent(contestId)}/leaderboard`,{credentials:"include"})).json();if(!j||!j.ok){container.innerHTML=`<div style="opacity:0.6;font-size:12px;">${T("Failed to load.","加载失败。")}</div>`;return}const rows=j.leaderboard||[];if(!rows.length){container.innerHTML=`<div style="opacity:0.6;font-size:12px;">${T("No entries yet.","暂无作品。")}</div>`;return}const html='<ol style="padding-left:20px;font-size:13px;line-height:1.6;">'+rows.map((row,i)=>{const score=(row.final_score*100).toFixed(1),llm=row.llm_overall==null?"—":Number(row.llm_overall).toFixed(1);return`<li>#${i+1} <span style="opacity:0.7">entry ${safe(row.entry_id.slice(0,8))}</span>
            · ${T("votes","票数")}: ${row.vote_count}
            · 🤖 ${llm}
            · ${T("score","综合")}: ${score}</li>`}).join("")+`</ol><div style="font-size:11px;opacity:0.55;margin-top:6px;">${safe(j.formula||"")}</div>`;container.innerHTML=html}catch{container.innerHTML=`<div style="opacity:0.6;font-size:12px;">${T("Failed to load.","加载失败。")}</div>`}}},document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>setTimeout(scan,300)):setTimeout(scan,300);let pending=0;const obs=new MutationObserver(()=>{pending||(pending=setTimeout(()=>{pending=0,scan()},500))});try{obs.observe(document.body,{childList:!0,subtree:!0})}catch{}})();
