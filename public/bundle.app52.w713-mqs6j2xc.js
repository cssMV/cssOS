"use strict";(function(){"use strict";var STYLE_ID="cssos-rating-badge-style";function injectStyle(){if(!document.getElementById(STYLE_ID)){var s=document.createElement("style");s.id=STYLE_ID,s.textContent=["[data-content-rating]{position:relative;}",".cssos-rating-chip{position:absolute;top:6px;right:6px;height:16px;min-width:16px;padding:0 6px;border-radius:8px;font-size:10px;line-height:16px;font-weight:600;color:#fff;pointer-events:none;text-align:center;letter-spacing:0.3px;box-shadow:0 1px 3px rgba(0,0,0,0.5);z-index:5;}",".cssos-rating-chip[data-r='PG']{background:#137a3b;}",".cssos-rating-chip[data-r='13']{background:#c79100;color:#1a1100;}",".cssos-rating-chip[data-r='18']{background:#b1311e;}"].join(`
`),document.head.appendChild(s)}}function chipHtml(rating){return rating==="PG"?{r:"PG",emoji:"🟢",text:"PG"}:rating==="13+"?{r:"13",emoji:"🟡",text:"13+"}:rating==="18+"?{r:"18",emoji:"🔴",text:"18+"}:null}function decorate(node){if(node instanceof HTMLElement){var rating=node.getAttribute("data-content-rating");if(rating&&!node.querySelector(":scope > .cssos-rating-chip")){var meta=chipHtml(rating);if(meta){var chip=document.createElement("span");chip.className="cssos-rating-chip",chip.setAttribute("data-r",meta.r),chip.textContent=meta.emoji+" "+meta.text,node.appendChild(chip)}}}}function scan(root){(root||document).querySelectorAll("[data-content-rating]").forEach(decorate)}injectStyle(),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",function(){scan(document)}):scan(document);var mo=new MutationObserver(function(muts){muts.forEach(function(m){m.addedNodes.forEach(function(n){n instanceof HTMLElement&&(n.hasAttribute&&n.hasAttribute("data-content-rating")&&decorate(n),scan(n))}),m.type==="attributes"&&m.target instanceof HTMLElement&&decorate(m.target)})});mo.observe(document.documentElement,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["data-content-rating"]}),globalThis.cssosRatingBadgesScan=scan})(),(function(){"use strict";function tr(en,zh){if(typeof globalThis.CSSOS_I18N?.tr=="function")try{return String(globalThis.CSSOS_I18N.tr(en))}catch{}var locale=globalThis.CSSOS_I18N&&globalThis.CSSOS_I18N.getCurrentLocale&&globalThis.CSSOS_I18N.getCurrentLocale()||"en";return/^zh/i.test(String(locale))&&zh?zh:en}var STYLE_ID="cssos-mv-comments-share-style";function injectStyle(){if(!document.getElementById(STYLE_ID)){var s=document.createElement("style");s.id=STYLE_ID,s.textContent=["#cssos-mv-comments{position:fixed;top:0;right:0;bottom:0;width:min(420px,90vw);background:rgba(4,10,8,0.97);border-left:1px solid rgba(0,245,160,0.25);z-index:9400;display:flex;flex-direction:column;color:#daffee;font:14px/1.45 -apple-system,system-ui,sans-serif;transform:translateX(100%);transition:transform .25s ease;}","#cssos-mv-comments.is-open{transform:translateX(0);}","#cssos-mv-comments .cmh-header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(0,245,160,0.18);}","#cssos-mv-comments .cmh-title{font-weight:700;}","#cssos-mv-comments .cmh-close{background:transparent;color:#00f5a0;border:0;cursor:pointer;font-size:18px;}","#cssos-mv-comments .cmh-input{padding:10px 12px;border-bottom:1px solid rgba(0,245,160,0.15);}","#cssos-mv-comments .cmh-input textarea{width:100%;background:#0c1d16;color:#daffee;border:1px solid rgba(0,245,160,0.25);border-radius:8px;padding:8px;font:13px/1.4 inherit;resize:vertical;min-height:60px;box-sizing:border-box;}","#cssos-mv-comments .cmh-input button{margin-top:6px;background:#00f5a0;color:#06100b;border:0;border-radius:999px;padding:6px 16px;font-weight:700;cursor:pointer;}","#cssos-mv-comments .cmh-input button:disabled{opacity:0.5;cursor:default;}","#cssos-mv-comments .cmh-list{flex:1;overflow-y:auto;padding:10px 12px;}","#cssos-mv-comments .cmh-item{display:flex;gap:10px;margin-bottom:14px;}","#cssos-mv-comments .cmh-item[data-depth='1']{margin-left:24px;}","#cssos-mv-comments .cmh-item[data-depth='2']{margin-left:48px;}","#cssos-mv-comments .cmh-item[data-depth='3']{margin-left:72px;}","#cssos-mv-comments .cmh-toggle{background:transparent;color:rgba(0,245,160,0.85);border:0;cursor:pointer;font-size:11px;padding:2px 0;margin-left:38px;display:block;}","html[data-theme='light'] #cssos-mv-comments{background:rgba(252,255,253,0.97);color:#0a1f14;border-left:1px solid rgba(0,140,90,0.25);}","html[data-theme='light'] #cssos-mv-comments .cmh-name{color:#0a1f14;}","html[data-theme='light'] #cssos-mv-comments .cmh-body{color:rgba(10,31,20,0.9);}","html[data-theme='light'] #cssos-mv-comments .cmh-input textarea{background:#fff;color:#0a1f14;border-color:rgba(0,140,90,0.25);}","#cssos-mv-comments .cmh-avatar{width:28px;height:28px;border-radius:50%;background:#0c1d16;object-fit:cover;flex-shrink:0;}","#cssos-mv-comments .cmh-name{font-weight:600;color:#fff;font-size:13px;cursor:pointer;}","#cssos-mv-comments .cmh-time{font-size:11px;color:rgba(218,255,238,0.5);margin-left:6px;}","#cssos-mv-comments .cmh-body{font-size:13px;color:rgba(218,255,238,0.88);margin-top:2px;white-space:pre-wrap;word-break:break-word;}","#cssos-mv-comments .cmh-actions{margin-top:4px;font-size:11px;color:rgba(0,245,160,0.7);}","#cssos-mv-comments .cmh-actions button{background:transparent;color:rgba(0,245,160,0.7);border:0;cursor:pointer;font-size:11px;padding:0 6px 0 0;}","#cssos-mv-comments .cmh-empty{padding:30px 0;text-align:center;color:rgba(218,255,238,0.55);}","#cssos-mv-comments .cmh-reactions{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;}","#cssos-mv-comments .cmh-rx{background:transparent;color:rgba(218,255,238,0.7);border:1px solid rgba(0,245,160,0.18);border-radius:999px;padding:1px 7px;font-size:12px;cursor:pointer;line-height:1.4;display:inline-flex;align-items:center;gap:3px;}","#cssos-mv-comments .cmh-rx:hover{border-color:rgba(0,245,160,0.45);}","#cssos-mv-comments .cmh-rx.is-mine{background:rgba(0,245,160,0.18);border-color:rgba(0,245,160,0.55);color:#daffee;}","#cssos-mv-comments .cmh-rx-count{font-size:11px;opacity:0.85;}",".cssos-verified{display:inline-block;margin-left:3px;color:#1d9bf0;font-size:0.95em;line-height:1;vertical-align:baseline;}",".pmv-comments-summary{margin:0 0 14px;padding:10px 12px;border-radius:10px;background:linear-gradient(180deg,rgba(0,245,160,0.08),rgba(0,245,160,0.02));border:1px solid rgba(0,245,160,0.22);}",".pmv-comments-summary .pmv-cs-head{display:flex;align-items:center;justify-content:space-between;font-size:12px;font-style:italic;color:rgba(0,245,160,0.85);margin-bottom:4px;}",".pmv-comments-summary .pmv-cs-refresh{background:transparent;color:rgba(0,245,160,0.85);border:0;cursor:pointer;font-size:13px;padding:0 4px;}",".pmv-comments-summary p{margin:0;font-size:13px;color:#daffee;}",".cssos-toast{position:fixed;left:50%;bottom:30px;transform:translateX(-50%);background:rgba(0,245,160,0.95);color:#06100b;padding:8px 18px;border-radius:999px;font-weight:700;z-index:9500;box-shadow:0 6px 20px rgba(0,0,0,0.4);}"].join(""),document.head.appendChild(s)}}function el(tag,attrs,children){var n=document.createElement(tag);if(attrs)for(var k in attrs)k==="onclick"?n.addEventListener("click",attrs[k]):k==="innerHTML"?n.innerHTML=attrs[k]:n.setAttribute(k,attrs[k]);return(children||[]).forEach(function(c){c!=null&&n.appendChild(typeof c=="string"?document.createTextNode(c):c)}),n}function defaultAvatar(){return"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%230c1d16'/><circle cx='16' cy='13' r='6' fill='%2300f5a0' opacity='0.5'/><ellipse cx='16' cy='28' rx='10' ry='6' fill='%2300f5a0' opacity='0.5'/></svg>"}function toast(msg){var t=document.createElement("div");t.className="cssos-toast",t.textContent=msg,document.body.appendChild(t),setTimeout(function(){t.remove()},2200)}function escapeHtmlMention(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function renderMentions(html){return String(html||"").replace(/@([a-zA-Z0-9_-]{2,32})/g,function(_m,h){return'<a href="#u/'+escapeHtmlMention(h)+'" style="color:#00f5a0;text-decoration:none;font-weight:600">@'+escapeHtmlMention(h)+"</a>"})}globalThis.cssosReportTarget=async function(kind,id){var reasons=["spam","harassment","copyright","nsfw","factual_error","other"],pick=window.prompt(tr("Report reason — type one of:","举报原因，输入其一：")+`
`+reasons.join(", "),"spam");if(pick){if(pick=String(pick).trim().toLowerCase(),reasons.indexOf(pick)<0){toast(tr("Unknown reason","未知原因"));return}try{var r=await fetch("/api/reports",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({target_kind:kind,target_id:id,reason_code:pick})}),j=await r.json();j.ok?toast(tr("Report submitted","举报已提交")):j.code==="ALREADY_REPORTED_TODAY"?toast(tr("Already reported today","今日已举报")):toast(tr("Report failed","举报失败"))}catch{toast(tr("Report failed","举报失败"))}}},globalThis.cssosBlockUser=async function(username){if(username&&window.confirm(tr("Block @"+username+"?","屏蔽 @"+username+"？")))try{var r=await fetch("/api/users/"+encodeURIComponent(username)+"/block",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:"{}"}),j=await r.json();j.ok?toast(j.blocked?tr("Blocked","已屏蔽"):tr("Unblocked","已取消屏蔽")):toast(tr("Block failed","屏蔽失败"))}catch{toast(tr("Block failed","屏蔽失败"))}};function attachMentionAutocomplete(ta){var menu=null,debounceT=null;function close2(){menu&&menu.parentNode&&menu.parentNode.removeChild(menu),menu=null}function ensureMenu(){return menu||(menu=document.createElement("div"),menu.style.cssText="position:absolute;z-index:9600;background:#0c1d16;border:1px solid rgba(0,245,160,0.35);border-radius:8px;padding:4px;max-height:240px;overflow-y:auto;min-width:180px;font:13px/1.4 inherit;color:#daffee;box-shadow:0 6px 24px rgba(0,0,0,0.5);",document.body.appendChild(menu),menu)}function position(){if(menu){var rect=ta.getBoundingClientRect();menu.style.left=window.scrollX+rect.left+8+"px",menu.style.top=window.scrollY+rect.bottom+4+"px"}}function render(items){var m=ensureMenu();if(m.innerHTML="",!items.length){close2();return}items.forEach(function(u){var row=document.createElement("div");row.style.cssText="padding:6px 10px;border-radius:6px;cursor:pointer;display:flex;gap:8px;align-items:center;",row.onmouseover=function(){row.style.background="rgba(0,245,160,0.12)"},row.onmouseout=function(){row.style.background="transparent"},row.onclick=function(){insertMention(u.username)};var img=document.createElement("img");img.src=u.avatar_url||defaultAvatar(),img.alt="",img.style.cssText="width:20px;height:20px;border-radius:50%;";var label=document.createElement("span");label.textContent="@"+u.username+(u.display_name&&u.display_name!==u.username?" · "+u.display_name:""),row.appendChild(img),row.appendChild(label),m.appendChild(row)}),position()}function currentTokenInfo(){var v=ta.value||"",caret=ta.selectionStart||v.length,head=v.slice(0,caret),match=/(^|\s)@([a-zA-Z0-9_-]{0,32})$/.exec(head);return match?{start:caret-match[2].length,end:caret,query:match[2]}:null}function insertMention(handle){var info=currentTokenInfo(),v=ta.value||"";if(!info)ta.value=v+(v&&!/\s$/.test(v)?" ":"")+"@"+handle+" ";else{ta.value=v.slice(0,info.start)+handle+" "+v.slice(info.end);var pos=info.start+handle.length+1;ta.setSelectionRange(pos,pos)}ta.focus(),close2()}async function fetchSuggestions(q){try{var r=await fetch("/api/users/autocomplete?q="+encodeURIComponent(q)+"&limit=10",{credentials:"include"}),j=await r.json();return j&&j.ok&&Array.isArray(j.items)?j.items:[]}catch{return[]}}ta.addEventListener("input",function(){var info=currentTokenInfo();if(!info){close2();return}debounceT&&clearTimeout(debounceT),debounceT=setTimeout(async function(){var items=await fetchSuggestions(info.query.toLowerCase()||"a");if(!items.length){close2();return}render(items)},200)}),ta.addEventListener("keydown",function(ev){if(menu&&(ev.key==="Escape"&&(ev.preventDefault(),close2()),ev.key==="Tab")){var first=menu.firstChild;first&&first.click&&(ev.preventDefault(),first.click())}}),ta.addEventListener("blur",function(){setTimeout(close2,200)})}function fmtTime(iso){if(!iso)return"";var d=new Date(iso),diff=(Date.now()-d.getTime())/1e3;return diff<60?tr("just now","刚刚"):diff<3600?Math.floor(diff/60)+"m":diff<86400?Math.floor(diff/3600)+"h":d.toLocaleDateString()}var currentMvId=null,currentReplyTo=null;async function fetchComments(mvId){var r=await fetch("/api/person-mv/mvs/"+encodeURIComponent(mvId)+"/comments?limit=50",{credentials:"include"}),j=await r.json();return j.ok?{items:j.items||[],summary:j.summary||null}:{items:[],summary:null}}async function refreshSummary(mvId){try{var r=await fetch("/api/person-mv/mvs/"+encodeURIComponent(mvId)+"/comments/summarize",{method:"POST",credentials:"include"}),j=await r.json();j.ok?(toast(tr("Summary refreshed","众议已刷新")),refresh()):toast(tr("Refresh failed","刷新失败"))}catch{toast(tr("Refresh failed","刷新失败"))}}function isAdminUser(){var u=globalThis.CSSOS_CURRENT_USER||null;return!!(u&&(u.role==="admin"||u.is_admin))}async function postComment(mvId,body,parentId){var r=await fetch("/api/person-mv/mvs/"+encodeURIComponent(mvId)+"/comments",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({body,parent_id:parentId||null})}),j=await r.json();if(!j.ok)throw new Error(j.code||"FAILED");return j.comment}async function deleteComment(cid){var r=await fetch("/api/person-mv/comments/"+encodeURIComponent(cid),{method:"DELETE",credentials:"include"}),j=await r.json();return!!j.ok}var COMMENT_REACTION_EMOJIS=["👍","❤️","🔥","😢","😂","🙏"];async function toggleReaction(commentId,emoji,btn){btn.disabled=!0;try{var r=await fetch("/api/comments/"+encodeURIComponent(commentId)+"/react",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({emoji})}),j=await r.json();if(!j||!j.ok){toast(tr("Reaction failed","表态失败"));return}var bar=btn.parentNode;if(!bar)return;bar.innerHTML="",buildReactionBar(commentId,j.counts||{},j.my||[]).childNodes.forEach(function(n){bar.appendChild(n)})}catch{toast(tr("Reaction failed","表态失败"))}finally{btn.disabled=!1}}function buildReactionBar(commentId,counts,mine){var wrap=el("div",{class:"cmh-reactions"},[]),mineSet={};return(mine||[]).forEach(function(e){mineSet[e]=!0}),COMMENT_REACTION_EMOJIS.forEach(function(em){var n=Number((counts||{})[em]||0),b=el("button",{class:"cmh-rx"+(mineSet[em]?" is-mine":""),title:em,onclick:function(){if(!(globalThis.CSSOS_CURRENT_USER&&globalThis.CSSOS_CURRENT_USER.id)){toast(tr("Sign in to react","请先登录"));return}toggleReaction(commentId,em,b)}},[]);if(b.appendChild(document.createTextNode(em)),n>0){var cnt=el("span",{class:"cmh-rx-count"},[String(n)]);b.appendChild(cnt)}wrap.appendChild(b)}),wrap}function buildItem(c,currentUserId,depth){var d=Math.min(3,Math.max(0,depth|0)),item=el("div",{class:"cmh-item","data-depth":String(d)},[el("img",{class:"cmh-avatar",src:c.avatar_url||defaultAvatar(),alt:""}),el("div",{style:"flex:1;min-width:0"},[el("div",{},[el("span",{class:"cmh-name",onclick:function(){(c.username||c.user_id)&&(location.hash="#u/"+(c.username||c.user_id))}},[c.display_name||c.username||tr("Anonymous","匿名")]),c.verified?el("span",{class:"cssos-verified",title:tr("Verified creator","认证创作者")},["✅"]):null,el("span",{class:"cmh-time"},[fmtTime(c.created_at)])]),c.deleted?el("div",{class:"cmh-body",style:"font-style:italic;opacity:0.5"},[tr("(deleted)","(已删除)")]):el("div",{class:"cmh-body",innerHTML:renderMentions(c.body_html||"")},[]),c.deleted?null:buildReactionBar(c.id,c.reactions||{},c.my_reactions||[]),c.deleted?null:el("div",{class:"cmh-actions"},[el("button",{onclick:function(){setReplyTo(c)}},[tr("Reply","回复")]),currentUserId&&currentUserId===c.user_id?el("button",{onclick:async function(){confirm(tr("Delete this comment?","删除此评论？"))&&await deleteComment(c.id)&&refresh()}},[tr("Delete","删除")]):null,currentUserId&&currentUserId!==c.user_id?el("button",{onclick:function(){globalThis.cssosReportTarget("comment",c.id)}},["🚩 "+tr("Report","举报")]):null,currentUserId&&currentUserId!==c.user_id&&c.username?el("button",{onclick:function(){globalThis.cssosBlockUser(c.username)}},["🚫 "+tr("Block","屏蔽")]):null])])]);return item}function setReplyTo(c){currentReplyTo=c.id;var ta=document.querySelector("#cssos-mv-comments textarea");ta&&(ta.placeholder=tr("Reply to ","回复 ")+(c.display_name||c.username||"..."),ta.focus())}async function refresh(){var list=document.querySelector("#cssos-mv-comments .cmh-list");if(!list||!currentMvId)return;list.innerHTML="";var data=await fetchComments(currentMvId),items=data.items||[],summary=data.summary||null;if(summary&&summary.text){var head=el("div",{class:"pmv-cs-head"},[el("span",{},["💬 "+tr("Crowd take","众议")+" · "+(summary.count||items.length)+" "+tr("comments","条评论")])]);if(isAdminUser()){var btn=el("button",{class:"pmv-cs-refresh",title:tr("Regenerate summary","重新生成"),onclick:function(){refreshSummary(currentMvId)}},["↻"]);head.appendChild(btn)}var sumBox=el("div",{class:"pmv-comments-summary"},[head,el("p",{},[String(summary.text)])]);list.appendChild(sumBox)}var me=globalThis.CSSOS_CURRENT_USER&&globalThis.CSSOS_CURRENT_USER.id||null;if(!items.length){list.appendChild(el("div",{class:"cmh-empty"},[tr("Be the first to comment.","抢沙发吧。")]));return}var byId={},roots=[];items.forEach(function(c){byId[c.id]={c,children:[]}}),items.forEach(function(c){var node=byId[c.id];c.parent_id&&byId[c.parent_id]?byId[c.parent_id].children.push(node):roots.push(node)});function walk(node,depth){if(list.appendChild(buildItem(node.c,me,depth)),!!node.children.length){var collapsed=node.children.length>3&&depth>=1,visible=collapsed?node.children.slice(0,0):node.children,rendered=[];if(visible.forEach(function(ch){walk(ch,depth+1)}),collapsed){var btn2=el("button",{class:"cmh-toggle",onclick:function(){btn2.remove(),node.children.forEach(function(ch){walk(ch,depth+1)})}},[tr(node.children.length+" replies",node.children.length+" 条回复")]);list.appendChild(btn2)}}}roots.forEach(function(n){walk(n,0)})}function close(){var d=document.getElementById("cssos-mv-comments");d&&(d.classList.remove("is-open"),setTimeout(function(){d.parentNode&&d.remove()},250)),currentMvId=null,currentReplyTo=null}async function open(mvId){if(mvId){injectStyle();var existing=document.getElementById("cssos-mv-comments");existing&&existing.remove(),currentMvId=mvId,currentReplyTo=null;var ta=el("textarea",{maxlength:"500",placeholder:tr("Write a comment…  (try @ to mention)","写下你的评论…  (输入 @ 提及他人)")});attachMentionAutocomplete(ta);var sendBtn=el("button",{},[tr("Post","发送")]);sendBtn.addEventListener("click",async function(){var body=(ta.value||"").trim();if(body){sendBtn.disabled=!0;var list=document.querySelector("#cssos-mv-comments .cmh-list"),optimistic=el("div",{class:"cmh-item"+(currentReplyTo?" is-reply":""),style:"opacity:.6"},[el("img",{class:"cmh-avatar",src:defaultAvatar(),alt:""}),el("div",{style:"flex:1"},[el("div",{},[el("span",{class:"cmh-name"},[tr("Posting…","发送中…")])]),el("div",{class:"cmh-body"},[body])])]);list&&list.appendChild(optimistic);try{await postComment(mvId,body,currentReplyTo),ta.value="",currentReplyTo=null,ta.placeholder=tr("Write a comment…","写下你的评论…"),await refresh()}catch(e){toast(tr("Post failed","发送失败")+(e&&e.message?": "+e.message:"")),optimistic.parentNode&&optimistic.remove()}sendBtn.disabled=!1}});var drawer=el("div",{id:"cssos-mv-comments"},[el("div",{class:"cmh-header"},[el("span",{class:"cmh-title"},["💬 "+tr("Comments","评论")]),el("button",{class:"cmh-close",onclick:close},["✕"])]),el("div",{class:"cmh-input"},[ta,el("br"),sendBtn]),el("div",{class:"cmh-list"},[el("div",{class:"cmh-empty"},[tr("Loading…","加载中…")])])]);document.body.appendChild(drawer),requestAnimationFrame(function(){drawer.classList.add("is-open")}),refresh()}}function shortcodeFromShareUrl(u){try{var m=String(u||"").match(/\/m\/([0-9a-zA-Z]{4,12})/);return m?m[1]:""}catch{return""}}function origin(){try{return location.origin||""}catch{return""}}async function copyText(s){try{return await navigator.clipboard.writeText(s),!0}catch{try{return prompt(tr("Copy this:","复制："),s),!0}catch{return!1}}}function chooseShareMode(j){var sc=shortcodeFromShareUrl(j.share_url),embedSrc=origin()+"/embed/"+sc,embedHtml='<iframe src="'+embedSrc+'" width="640" height="360" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>',pick=typeof window<"u"&&window.confirm?window.confirm(tr(`OK = copy share link
Cancel = copy embed code`,`确定 = 复制链接
取消 = 复制嵌入代码`)):!0;return pick?{kind:"link",text:j.share_url}:{kind:"embed",text:embedHtml}}async function share(mvId){if(mvId)try{var r=await fetch("/api/person-mv/mvs/"+encodeURIComponent(mvId)+"/share",{credentials:"include"}),j=await r.json();if(!j.ok)throw new Error(j.code||"FAILED");var payload={title:j.og_title||"CSS Studio MV",text:j.og_description||"",url:j.share_url};if(typeof navigator.share=="function")try{await navigator.share(payload);return}catch{}var pick=chooseShareMode(j),ok=await copyText(pick.text);ok&&toast(pick.kind==="embed"?tr("Embed code copied","嵌入代码已复制"):tr("Link copied","链接已复制"))}catch{toast(tr("Share failed","分享失败"))}}document.addEventListener("click",function(ev){for(var t=ev.target;t&&t!==document.body;){if(t.dataset&&t.dataset.cssosMvComments){ev.preventDefault(),open(t.dataset.cssosMvComments);return}if(t.dataset&&t.dataset.cssosMvShare){ev.preventDefault(),share(t.dataset.cssosMvShare);return}t=t.parentNode}}),globalThis.openPersonMvComments=open,globalThis.sharePersonMv=share})(),(function(){"use strict";if(globalThis.cssosMountInCinema)return;globalThis.cssosMountInCinema=function(el){if(!el)return el;var host=document.fullscreenElement||document.webkitFullscreenElement||document.body;try{host.appendChild(el)}catch{try{document.body.appendChild(el)}catch{}}return el};var POPUP_SELS=["#cssos-work-comments",".css-pay-picker-backdrop",".cssos-author-menu","#cssos-card-ctx","#cssos-share-dialog",".cssos-gift-modal",".cssos-workgift-modal"];globalThis.cssosCloseOtherPopups=function(keepSel){if(POPUP_SELS.forEach(function(s){if(s!==keepSel)try{document.querySelectorAll(s).forEach(function(el){try{el.remove()}catch{}})}catch{}}),keepSel!=="#cssos-embed-pick"){var ep=document.getElementById("cssos-embed-pick");if(ep)try{ep.remove()}catch{}}};function _closeAllCinemaPopups(){try{globalThis.cssosCloseOtherPopups("");var ep=document.getElementById("cssos-embed-pick");ep&&ep.remove()}catch{}}["cssos:panelclose","cssos:cinema-exit","cssos:watch-close"].forEach(function(ev){document.addEventListener(ev,_closeAllCinemaPopups,!0),window.addEventListener(ev,_closeAllCinemaPopups)})})(),(function(){"use strict";if(globalThis.cssosMakeResizable)return;function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v))}function injectCss(){if(!document.getElementById("cssos-resizable-css")){var st=document.createElement("style");st.id="cssos-resizable-css",st.textContent=".cssos-rz-h{position:absolute;z-index:6;touch-action:none;background:transparent;}.cssos-rz-n{top:-5px;left:10px;right:10px;height:10px;cursor:ns-resize;}.cssos-rz-s{bottom:-5px;left:10px;right:10px;height:10px;cursor:ns-resize;}.cssos-rz-e{right:-5px;top:10px;bottom:10px;width:10px;cursor:ew-resize;}.cssos-rz-w{left:-5px;top:10px;bottom:10px;width:10px;cursor:ew-resize;}.cssos-rz-ne{top:-6px;right:-6px;width:16px;height:16px;cursor:nesw-resize;}.cssos-rz-nw{top:-6px;left:-6px;width:16px;height:16px;cursor:nwse-resize;}.cssos-rz-se{bottom:-6px;right:-6px;width:16px;height:16px;cursor:nwse-resize;}.cssos-rz-sw{bottom:-6px;left:-6px;width:16px;height:16px;cursor:nesw-resize;}",document.head.appendChild(st)}}globalThis.cssosMakeResizable=function(el,opts){if(!el||el.__cssosResizable)return el;el.__cssosResizable=!0,opts=opts||{},injectCss();var minW=opts.minW||280,minH=opts.minH||200;function maxW(){return(typeof opts.maxW=="function"?opts.maxW():opts.maxW)||window.innerWidth-12}function maxH(){return(typeof opts.maxH=="function"?opts.maxH():opts.maxH)||window.innerHeight-12}function pin(){if(!el.__cssosPinned){el.__cssosPinned=!0;var r=el.getBoundingClientRect();el.style.position="fixed",el.style.margin="0",el.style.left=Math.round(r.left)+"px",el.style.top=Math.round(r.top)+"px",el.style.width=Math.round(r.width)+"px",el.style.height=Math.round(r.height)+"px",el.style.right="auto",el.style.bottom="auto",el.style.maxWidth="none",el.style.maxHeight="none",el.style.resize="none"}}return["n","s","e","w","ne","nw","se","sw"].forEach(function(d){var h=document.createElement("div");h.className="cssos-rz-h cssos-rz-"+d,el.appendChild(h),h.addEventListener("pointerdown",function(e){e.preventDefault(),e.stopPropagation(),pin();var sx=e.clientX,sy=e.clientY,r=el.getBoundingClientRect(),sl=r.left,st0=r.top,sw=r.width,sh=r.height,mw=maxW(),mh=maxH();try{h.setPointerCapture(e.pointerId)}catch{}function mv(ev){var dx=ev.clientX-sx,dy=ev.clientY-sy,nl=sl,nt=st0,nw=sw,nh=sh;d.indexOf("e")>=0&&(nw=clamp(sw+dx,minW,mw)),d.indexOf("s")>=0&&(nh=clamp(sh+dy,minH,mh)),d.indexOf("w")>=0&&(nw=clamp(sw-dx,minW,mw),nl=sl+(sw-nw)),d.indexOf("n")>=0&&(nh=clamp(sh-dy,minH,mh),nt=st0+(sh-nh)),nl=clamp(nl,0,window.innerWidth-nw),nt=clamp(nt,0,window.innerHeight-nh),el.style.width=nw+"px",el.style.height=nh+"px",el.style.left=nl+"px",el.style.top=nt+"px"}function up(){document.removeEventListener("pointermove",mv),document.removeEventListener("pointerup",up)}document.addEventListener("pointermove",mv),document.addEventListener("pointerup",up)})}),el}})(),(function(){"use strict";if(globalThis.__cssosWorkCommentsWired)return;globalThis.__cssosWorkCommentsWired=!0;function tr(en,zh){try{if(typeof globalThis.loginCopy=="function")return globalThis.loginCopy(en,zh)}catch{}var zhLoc=!1;try{zhLoc=String(document.documentElement.lang||"").slice(0,2)==="zh"}catch{}return zhLoc?zh:en}function esc(s){return String(s??"").replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]})}function fmtDur(s){return s=Math.round(Number(s)||0),s<=0?"":"♪ "+Math.floor(s/60)+":"+("0"+s%60).slice(-2)}function toast(m){try{typeof globalThis.showToast=="function"&&globalThis.showToast(m)}catch{}}function notifyChanged(){try{document.dispatchEvent(new CustomEvent("cssos:comments-changed",{detail:{workId:currentWorkId}}))}catch{}}function injectCss(){if(!document.getElementById("cssos-work-comments-css")){var s=document.createElement("style");s.id="cssos-work-comments-css",s.textContent="#cssos-work-comments{position:fixed;inset:0;z-index:10058;display:flex;align-items:flex-start;justify-content:flex-end;background:rgba(0,0,0,0.32);backdrop-filter:blur(3px);font:500 14px/1.45 -apple-system,system-ui,sans-serif;}#cssos-work-comments .cwc-sheet{width:min(400px,84vw);max-height:78vh;margin:0 76px 0 0;display:flex;flex-direction:column;position:relative;overflow:visible;}background:rgba(15,18,24,0.99);border:1px solid rgba(255,255,255,0.12);border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,0.6);color:rgba(255,255,255,0.95);}@media (max-width:560px){#cssos-work-comments{align-items:flex-end;justify-content:center;}#cssos-work-comments .cwc-sheet{width:100%;margin:0;border-radius:18px 18px 0 0;}}#cssos-work-comments .cwc-head{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);}#cssos-work-comments .cwc-head b{flex:1;font-size:15px;}#cssos-work-comments .cwc-x{background:transparent;border:0;color:#fff;font-size:20px;cursor:pointer;width:32px;height:32px;border-radius:50%;}#cssos-work-comments .cwc-list{flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:12px;min-height:120px;}#cssos-work-comments .cwc-item{display:flex;gap:10px;}#cssos-work-comments .cwc-item.is-reply{margin-left:38px;}#cssos-work-comments .cwc-av{width:32px;height:32px;border-radius:50%;object-fit:cover;flex:0 0 auto;background:#2a6cf0;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;overflow:hidden;}#cssos-work-comments .cwc-av img{width:100%;height:100%;object-fit:cover;}#cssos-work-comments .cwc-name{font-weight:600;font-size:12.5px;color:#dfe7ff;}#cssos-work-comments .cwc-text{font-size:13.5px;color:#eee;margin-top:1px;word-break:break-word;white-space:pre-wrap;}#cssos-work-comments .cwc-text.is-deleted{opacity:0.5;font-style:italic;}#cssos-work-comments .cwc-embed{margin-top:6px;display:flex;align-items:center;gap:9px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:7px;cursor:pointer;max-width:300px;}#cssos-work-comments .cwc-embed img,#cssos-work-comments .cwc-embed .cwc-embed-ph{width:42px;height:42px;border-radius:7px;object-fit:cover;flex:0 0 auto;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;}#cssos-work-comments .cwc-embed .cwc-embed-t{flex:1;min-width:0;font-weight:600;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}#cssos-work-comments .cwc-embed .cwc-embed-play{color:#00f5a0;font-size:16px;}#cssos-work-comments .cwc-actions{margin-top:3px;display:flex;gap:14px;}#cssos-work-comments .cwc-actions button{background:transparent;border:0;color:#9aa3b2;font-size:11.5px;cursor:pointer;padding:0;}#cssos-work-comments .cwc-actions button:hover{color:#fff;}#cssos-work-comments .cwc-foot{border-top:1px solid rgba(255,255,255,0.08);padding:10px 14px;display:flex;flex-direction:column;gap:8px;}#cssos-work-comments .cwc-replychip,#cssos-work-comments .cwc-embedchip{display:none;align-items:center;gap:6px;font-size:11.5px;color:#bcd;background:rgba(0,245,160,0.1);border:1px solid rgba(0,245,160,0.3);border-radius:999px;padding:3px 10px;align-self:flex-start;}#cssos-work-comments .cwc-replychip button,#cssos-work-comments .cwc-embedchip button{background:transparent;border:0;color:#9aa3b2;cursor:pointer;font-size:13px;}#cssos-work-comments .cwc-composer{display:flex;gap:8px;align-items:flex-end;}#cssos-work-comments textarea{flex:1;resize:none;box-sizing:border-box;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.16);border-radius:10px;padding:9px 11px;color:#fff;font:inherit;height:40px;min-height:40px;max-height:120px;overflow-y:auto;line-height:1.35;}#cssos-work-comments .cwc-attach{box-sizing:border-box;height:40px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.16);color:#fff;border-radius:10px;padding:0 13px;cursor:pointer;font-size:16px;flex:0 0 auto;}#cssos-work-comments .cwc-post{box-sizing:border-box;height:40px;display:flex;align-items:center;justify-content:center;background:rgba(0,245,160,0.22);border:1px solid rgba(0,245,160,0.6);color:#fff;border-radius:10px;padding:0 16px;cursor:pointer;font-weight:700;flex:0 0 auto;}#cssos-work-comments .cwc-empty{opacity:0.55;text-align:center;font-size:12.5px;padding:26px 0;}",document.head.appendChild(s)}}var currentWorkId="",currentReplyTo=null,embedWorkId="",embedWorkTitle="";function avatarNode(name,url){var av=document.createElement("div");if(av.className="cwc-av",url){var im=document.createElement("img");im.src=url,im.alt="",av.appendChild(im)}else av.textContent=(String(name||"?").trim().charAt(0)||"?").toUpperCase();return av}function playEmbed(workId){try{if(typeof globalThis.openMarketWorkPreview=="function"){globalThis.openMarketWorkPreview(workId);return}if(typeof globalThis.cssosOpenAssistantWithPrompt=="function")return}catch{}}async function refresh(){var listEl=document.querySelector("#cssos-work-comments .cwc-list");if(listEl)try{var r=await fetch("/api/works/"+encodeURIComponent(currentWorkId)+"/comments?limit=200",{credentials:"include"}),j=await r.json().catch(function(){return null}),items=j&&j.items||[];if(listEl.innerHTML="",!items.length){var em=document.createElement("div");em.className="cwc-empty",em.textContent=tr("No comments yet — be the first.","还没有评论 — 来抢沙发。"),listEl.appendChild(em);return}items.forEach(function(c){var item=document.createElement("div");item.className="cwc-item"+(c.parent_id?" is-reply":""),item.appendChild(avatarNode(c.display_name||c.username,c.avatar_url));var main=document.createElement("div");main.style.flex="1",main.style.minWidth="0";var nm=document.createElement("div");nm.className="cwc-name",nm.textContent=c.display_name||c.username||tr("User","用户"),main.appendChild(nm);var tx=document.createElement("div");if(tx.className="cwc-text"+(c.deleted?" is-deleted":""),c.deleted?tx.textContent=tr("[deleted]","[已删除]"):tx.innerHTML=c.body_html||"",main.appendChild(tx),c.embed&&c.embed.work_id){var emb=document.createElement("div");emb.className="cwc-embed";var edur=fmtDur(c.embed.duration_secs);emb.innerHTML=(c.embed.cover?'<img src="'+esc(c.embed.cover)+'" alt="">':'<span class="cwc-embed-ph">🎵</span>')+'<span class="cwc-embed-t">'+esc(c.embed.title||tr("A work","一首作品"))+(edur?'<span style="display:block;font-weight:500;font-size:10.5px;color:#9aa3b2;">'+esc(edur)+"</span>":"")+'</span><span class="cwc-embed-play">▶</span>',emb.addEventListener("click",function(){playEmbed(c.embed.work_id)}),main.appendChild(emb)}var acts=document.createElement("div");if(acts.className="cwc-actions",!c.deleted){var rep=document.createElement("button");rep.textContent=tr("Reply","回复"),rep.addEventListener("click",function(){setReplyTo(c.id,c.display_name||c.username)}),acts.appendChild(rep)}if(c.can_delete&&!c.deleted){var del=document.createElement("button");del.textContent=tr("Delete","删除"),del.addEventListener("click",async function(){try{var dr=await fetch("/api/works/"+encodeURIComponent(currentWorkId)+"/comments/"+encodeURIComponent(c.id),{method:"DELETE",credentials:"include"});dr.ok?(await refresh(),notifyChanged()):toast(tr("Delete failed","删除失败"))}catch{toast(tr("Delete failed","删除失败"))}}),acts.appendChild(del)}main.appendChild(acts),item.appendChild(main),listEl.appendChild(item)})}catch{listEl.innerHTML='<div class="cwc-empty">'+esc(tr("Failed to load comments.","评论加载失败。"))+"</div>"}}function setReplyTo(id,name){currentReplyTo=id;var chip=document.querySelector("#cssos-work-comments .cwc-replychip");chip&&(chip.style.display="flex",chip.querySelector("[data-rt]").textContent=tr("Replying to ","回复 ")+(name||""));var ta=document.querySelector("#cssos-work-comments textarea");ta&&ta.focus()}function clearReplyTo(){currentReplyTo=null;var chip=document.querySelector("#cssos-work-comments .cwc-replychip");chip&&(chip.style.display="none")}function setEmbed(id,title){embedWorkId=id,embedWorkTitle=title||"";var chip=document.querySelector("#cssos-work-comments .cwc-embedchip");chip&&(chip.style.display="flex",chip.querySelector("[data-et]").textContent="🎵 "+(title||tr("A work","一首作品")))}function clearEmbed(){embedWorkId="",embedWorkTitle="";var chip=document.querySelector("#cssos-work-comments .cwc-embedchip");chip&&(chip.style.display="none")}async function loadMyWorks(pl){pl.innerHTML='<div style="opacity:.6;text-align:center;padding:16px;">'+esc(tr("Loading…","加载中…"))+"</div>";var items=[];try{var st=globalThis.cssosPlaylists&&globalThis.cssosPlaylists._state,mine=st&&st.lists&&st.lists.mine&&st.lists.mine.items;mine&&mine.length&&(items=mine.slice())}catch{}if(!items.length)try{var r=await fetch("/api/works/mine?limit=60",{credentials:"include"}),j=await r.json().catch(function(){return null});items=j&&(j.works||j.items||j.data)||[]}catch{pl.innerHTML='<div style="opacity:.7;text-align:center;padding:16px;">'+esc(tr("Failed to load.","加载失败。"))+' <button data-retry style="background:transparent;border:0;color:#00f5a0;cursor:pointer;font:inherit;text-decoration:underline;">'+esc(tr("Retry","重试"))+"</button></div>";var rb=pl.querySelector("[data-retry]");rb&&rb.addEventListener("click",function(){loadMyWorks(pl)});return}if(items=items.filter(function(w){return w&&!w.parent_work_id&&(w.id||w.work_id)}),!items.length){pl.innerHTML='<div style="opacity:.6;text-align:center;padding:16px;">'+esc(tr("No works.","暂无作品。"))+"</div>";return}pl.__allItems=items,renderEmbedList(pl,pl.__searchQuery||"")}var EMBED_BATCH=10;function renderEmbedList(pl,query){var all=pl.__allItems||[],q=String(query||"").trim().toLowerCase();if(pl.__filtered=q?all.filter(function(w){var hay=((w.title||"")+" "+(w.owner_display_name||w.owner_name||"")+" "+(w.id||w.work_id||"")).toLowerCase();return hay.indexOf(q)>=0}):all,pl.__rendered=0,pl.scrollTop=0,pl.innerHTML="",!pl.__filtered.length){pl.innerHTML='<div style="opacity:.6;text-align:center;padding:16px;">'+esc(tr("No matches.","无匹配。"))+"</div>";return}appendEmbedBatch(pl)}function appendEmbedBatch(pl){for(var f=pl.__filtered||[],start=pl.__rendered||0,end=Math.min(start+EMBED_BATCH,f.length),i=start;i<end;i++)pl.appendChild(buildEmbedRow(f[i]));pl.__rendered=end}function buildEmbedRow(w){var cover=String(w.cover_image||w.preview_image_url||w.cover_url||""),wid=String(w.id||w.work_id||""),ds=Number(w.duration_secs||w.audio_duration_secs||w.final_duration_secs||w.duration||0)||0,durTxt=ds>0?Math.floor(ds/60)+":"+String(Math.floor(ds%60)).padStart(2,"0"):"",owner=String(w.owner_display_name||w.owner_name||"").trim(),meta=[];owner&&meta.push(esc(owner)),durTxt&&meta.push("♪ "+durTxt),meta.push('<span style="font-family:ui-monospace,monospace;opacity:.55;font-size:0.78em;">ID '+esc(wid.slice(0,8))+"</span>");var row=document.createElement("button");return row.type="button",row.style.cssText="display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:transparent;border:none;border-radius:10px;padding:8px;cursor:pointer;color:#fff;font:inherit;",row.addEventListener("mouseenter",function(){row.style.background="rgba(0,245,160,0.1)"}),row.addEventListener("mouseleave",function(){row.style.background="transparent"}),row.innerHTML='<div style="position:relative;width:56px;height:56px;flex:0 0 auto;border-radius:8px;overflow:hidden;background:rgba(255,255,255,0.08);">'+(cover?'<img src="'+esc(cover)+'" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;">':'<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;">🎵</span>')+(durTxt?'<span style="position:absolute;right:2px;bottom:2px;background:rgba(0,0,0,0.66);color:#fff;font:600 9px/1 ui-monospace,monospace;padding:2px 4px;border-radius:4px;">'+durTxt+"</span>":"")+'</div><div style="flex:1;min-width:0;"><div style="font:600 14px/1.3 -apple-system,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(w.title||"Untitled")+'</div><div style="font:500 11px/1.3 -apple-system,system-ui,sans-serif;color:rgba(218,255,238,0.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+meta.join(" · ")+"</div></div>",row.addEventListener("click",function(){setEmbed(wid,String(w.title||""));var pk=document.getElementById("cssos-embed-pick");pk&&pk.remove()}),row}function openEmbedPicker(){var old=document.getElementById("cssos-embed-pick");old&&old.remove();var pick=document.createElement("div");pick.id="cssos-embed-pick",pick.style.cssText="position:fixed;inset:0;z-index:10062;background:transparent;";var card=document.createElement("div");card.style.cssText="position:fixed;width:min(360px,82vw);max-height:60vh;display:flex;flex-direction:column;background:rgba(15,18,24,0.99);border:1px solid rgba(255,255,255,0.16);border-radius:14px;padding:14px;color:#fff;box-shadow:0 14px 44px rgba(0,0,0,0.6);font:500 14px/1.4 -apple-system,system-ui,sans-serif;",card.innerHTML='<div style="font-weight:700;margin-bottom:8px;font-size:13px;display:flex;align-items:center;gap:6px;"><span style="font-size:15px;">🎵</span>'+esc(tr("Attach a work","嵌入一首作品"))+'</div><div style="position:relative;margin-bottom:8px;"><span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);opacity:.55;pointer-events:none;font-size:14px;">🔍</span><input data-embed-search type="search" placeholder="'+esc(tr("Search your works…","搜索你的作品…"))+'" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.16);border-radius:10px;padding:8px 11px 8px 34px;color:#fff;font:inherit;" /></div><div data-pl style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:7px;min-height:80px;"></div>',pick.appendChild(card);var _si=card.querySelector("[data-embed-search]"),_pl=card.querySelector("[data-pl]");_si&&_pl&&_si.addEventListener("input",function(){_pl.__searchQuery=_si.value,renderEmbedList(_pl,_si.value)}),_pl&&_pl.addEventListener("scroll",function(){_pl.scrollTop+_pl.clientHeight>=_pl.scrollHeight-60&&appendEmbedBatch(_pl)},{passive:!0}),pick.addEventListener("click",function(e){e.target===pick&&pick.remove()}),(globalThis.cssosMountInCinema||function(el){(document.fullscreenElement||document.body).appendChild(el)})(pick);try{var btn=document.querySelector("#cssos-work-comments .cwc-attach"),vw=window.innerWidth||360,vh=window.innerHeight||640,cw=Math.min(300,vw*.76);if(btn){var br=btn.getBoundingClientRect();card.style.left=Math.max(8,Math.min(br.left,vw-cw-8))+"px",card.style.bottom=Math.max(8,vh-br.top+8)+"px"}else card.style.left="12px",card.style.bottom="80px"}catch{card.style.left="12px",card.style.bottom="80px"}loadMyWorks(card.querySelector("[data-pl]"))}async function postComment(){var ta=document.querySelector("#cssos-work-comments textarea"),body=ta?(ta.value||"").trim():"";if(!(!body&&!embedWorkId)){var postBtn=document.querySelector("#cssos-work-comments .cwc-post");postBtn&&(postBtn.disabled=!0);try{var r=await fetch("/api/works/"+encodeURIComponent(currentWorkId)+"/comments",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({body,parent_id:currentReplyTo||void 0,embed_work_id:embedWorkId||void 0})}),j=await r.json().catch(function(){return null});r.ok&&j&&j.ok?(ta&&(ta.value=""),clearReplyTo(),clearEmbed(),await refresh(),notifyChanged()):toast(j&&j.code==="AUTH_REQUIRED"?tr("Sign in to comment.","登录后才能评论。"):tr("Post failed","发送失败"))}catch{toast(tr("Network error","网络错误"))}postBtn&&(postBtn.disabled=!1)}}function open(workId){if(workId=String(workId||"").trim(),!!workId){try{typeof globalThis.cssosCloseOtherPopups=="function"&&globalThis.cssosCloseOtherPopups("#cssos-work-comments")}catch{}injectCss();var old=document.getElementById("cssos-work-comments");old&&old.remove(),currentWorkId=workId,currentReplyTo=null,embedWorkId="",embedWorkTitle="";var overlay=document.createElement("div");overlay.id="cssos-work-comments",overlay.innerHTML='<div class="cwc-sheet"><div class="cwc-head"><b>'+esc(tr("Comments","评论"))+'</b><button class="cwc-x" aria-label="close">✕</button></div><div class="cwc-list"></div><div class="cwc-foot"><div class="cwc-replychip"><span data-rt></span><button data-rt-x>✕</button></div><div class="cwc-embedchip"><span data-et></span><button data-et-x>✕</button></div><div class="cwc-composer"><button class="cwc-attach" title="'+esc(tr("Attach a work","嵌入作品"))+'">🎵</button><textarea rows="1" maxlength="2000" placeholder="'+esc(tr("Write a comment…","写下你的评论…"))+'"></textarea><button class="cwc-post">'+esc(tr("Post","发送"))+"</button></div></div></div>",(globalThis.cssosMountInCinema||function(el){(document.fullscreenElement||document.body).appendChild(el)})(overlay);try{var sheet=overlay.querySelector(".cwc-sheet"),rail=document.getElementById("cssos-watch-social-rail"),topPx=rail?Math.max(8,Math.round(rail.getBoundingClientRect().top)):Math.round((window.innerHeight||600)*.18);if(sheet){sheet.style.marginTop=topPx+"px",sheet.style.maxHeight="calc(100vh - "+topPx+"px - 14px)";try{typeof globalThis.cssosMakeResizable=="function"&&globalThis.cssosMakeResizable(sheet,{minW:300,minH:240})}catch{}}}catch{}overlay.addEventListener("click",function(e){e.target===overlay&&overlay.remove()}),overlay.querySelector(".cwc-x").addEventListener("click",function(){overlay.remove()}),overlay.querySelector(".cwc-attach").addEventListener("click",openEmbedPicker),overlay.querySelector(".cwc-post").addEventListener("click",postComment),overlay.querySelector("[data-rt-x]").addEventListener("click",clearReplyTo),overlay.querySelector("[data-et-x]").addEventListener("click",clearEmbed);var ta=overlay.querySelector("textarea");ta.addEventListener("input",function(){ta.style.height="auto",ta.style.height=Math.max(40,Math.min(120,ta.scrollHeight))+"px"}),ta.addEventListener("keydown",function(e){(e.metaKey||e.ctrlKey)&&e.key==="Enter"&&postComment()}),refresh()}}globalThis.cssosOpenWorkComments=open})(),(function(){"use strict";if(globalThis.__cssosCardCtxWired)return;globalThis.__cssosCardCtxWired=!0;function tr(en,zh){try{if(typeof globalThis.loginCopy=="function")return globalThis.loginCopy(en,zh)}catch{}var zhLoc=!1;try{zhLoc=String(document.documentElement.lang||"").slice(0,2)==="zh"}catch{}return zhLoc?zh:en}function workIdFrom(el){for(var t=el,depth=0;t&&t.nodeType===1&&t!==document.body&&depth<14;){var ds=t.dataset||{},id=ds.workId||ds.workid||ds.mvId||ds.cssmv||ds.cssosWorkId||t.getAttribute&&(t.getAttribute("data-work-id")||t.getAttribute("data-mv-id"))||"";if(id=String(id||"").trim(),id&&id!=="#"&&id.length>6)return id;t=t.parentNode,depth++}return""}function closeMenu(){var m=document.getElementById("cssos-card-ctx");m&&m.remove(),document.removeEventListener("mousedown",onAway,!0),document.removeEventListener("scroll",closeMenu,!0)}function onAway(e){var m=document.getElementById("cssos-card-ctx");m&&!m.contains(e.target)&&closeMenu()}function showMenu(x,y,workId){closeMenu();try{typeof globalThis.cssosCloseOtherPopups=="function"&&globalThis.cssosCloseOtherPopups("#cssos-card-ctx")}catch{}var menu=document.createElement("div");menu.id="cssos-card-ctx",menu.style.cssText="position:fixed;z-index:2147483646;min-width:180px;background:rgba(10,12,16,0.97);border:1px solid rgba(255,255,255,0.16);border-radius:11px;padding:6px;box-shadow:0 12px 40px rgba(0,0,0,0.6);font:500 13px/1.4 -apple-system,system-ui,sans-serif;color:#fff;user-select:none;";var item=document.createElement("button");item.type="button",item.style.cssText="display:flex;align-items:center;gap:10px;width:100%;background:transparent;border:0;color:inherit;padding:9px 12px;border-radius:7px;cursor:pointer;font:inherit;text-align:left;",item.innerHTML='<span style="font-size:15px;width:20px;text-align:center;">🔗</span><span style="flex:1;">'+tr("Share link","分享链接")+"</span>",item.addEventListener("mouseenter",function(){item.style.background="rgba(255,255,255,0.08)"}),item.addEventListener("mouseleave",function(){item.style.background="transparent"}),item.addEventListener("click",function(){closeMenu();try{typeof globalThis.openCssosShareDialog=="function"?globalThis.openCssosShareDialog({workId}):typeof globalThis.sharePersonMv=="function"?globalThis.sharePersonMv(workId):typeof globalThis.showToast=="function"&&globalThis.showToast(tr("Share unavailable.","分享暂不可用。"))}catch{}}),menu.appendChild(item),(globalThis.cssosMountInCinema||function(el){(document.fullscreenElement||document.body).appendChild(el)})(menu);var vw=window.innerWidth||360,vh=window.innerHeight||640,mw=menu.offsetWidth||180,mh=menu.offsetHeight||44;menu.style.left=Math.max(8,Math.min(x,vw-mw-8))+"px",menu.style.top=Math.max(8,Math.min(y,vh-mh-8))+"px",setTimeout(function(){document.addEventListener("mousedown",onAway,!0),document.addEventListener("scroll",closeMenu,!0)},0)}document.addEventListener("contextmenu",function(e){var id=workIdFrom(e.target);id&&(e.preventDefault(),showMenu(e.clientX,e.clientY,id))});var lpTimer=null,lpId="",lpX=0,lpY=0;function lpCancel(){lpTimer&&(clearTimeout(lpTimer),lpTimer=null),lpId=""}document.addEventListener("touchstart",function(e){if(!e.touches||e.touches.length!==1){lpCancel();return}var id=workIdFrom(e.target);if(id){var t=e.touches[0];lpX=t.clientX,lpY=t.clientY,lpId=id,lpTimer=setTimeout(function(){if(lpId){try{navigator.vibrate&&navigator.vibrate(12)}catch{}showMenu(lpX,lpY,lpId),lpCancel()}},500)}},{passive:!0}),document.addEventListener("touchmove",function(e){if(!(!lpTimer||!e.touches||!e.touches[0])){var t=e.touches[0];(Math.abs(t.clientX-lpX)>10||Math.abs(t.clientY-lpY)>10)&&lpCancel()}},{passive:!0}),document.addEventListener("touchend",lpCancel,{passive:!0}),document.addEventListener("touchcancel",lpCancel,{passive:!0})})(),(function(){"use strict";try{if(document.documentElement.classList.contains("cssos-app")||window.matchMedia&&window.matchMedia("(max-width: 820px)").matches)return}catch{}function tr(en,zh){if(typeof globalThis.CSSOS_I18N?.tr=="function")try{return String(globalThis.CSSOS_I18N.tr(en))}catch{}var locale=globalThis.CSSOS_I18N&&globalThis.CSSOS_I18N.getCurrentLocale&&globalThis.CSSOS_I18N.getCurrentLocale()||"en";return/^zh/i.test(String(locale))&&zh?zh:en}var STYLE_ID="cssos-person-mv-festival-shelf-style";function injectStyle(){if(!document.getElementById(STYLE_ID)){var s=document.createElement("style");s.id=STYLE_ID,s.textContent=[".cssos-festival-shelf{margin:24px auto 8px;max-width:min(100%,920px);padding:0 12px;width:100%;box-sizing:border-box;}",".cssos-festival-hero{position:relative;border-radius:14px;overflow:hidden;padding:18px 20px;color:#fff;margin:0 4px 12px;}",".cssos-festival-hero::before{content:'';position:absolute;inset:0;background:var(--festival-bg,#7a1313);opacity:.92;}",".cssos-festival-hero::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.08),transparent 60%);}",".cssos-festival-hero > *{position:relative;z-index:1;}",".cssos-festival-hero .emoji{font-size:32px;line-height:1;}",".cssos-festival-hero h2{margin:6px 0 4px;font:800 20px/1.2 -apple-system,system-ui,sans-serif;}",".cssos-festival-hero p{margin:0;font:500 13px/1.5 -apple-system,system-ui,sans-serif;color:rgba(255,255,255,.92);max-width:640px;}",".cssos-festival-row{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding:4px 4px 12px;scrollbar-width:none;}",".cssos-festival-row::-webkit-scrollbar{display:none;}",".cssos-festival-card{flex:0 0 168px;height:220px;border-radius:12px;overflow:hidden;position:relative;cursor:pointer;scroll-snap-align:start;background:rgba(20,12,4,0.65);border:1px solid rgba(255,180,80,0.22);transition:transform .15s ease, border-color .15s ease;}",".cssos-festival-card:hover{transform:translateY(-2px);border-color:rgba(255,180,80,0.6);}",".cssos-festival-card .cover{position:absolute;inset:0;background-size:cover;background-position:center;background-color:rgba(40,20,8,0.7);}",".cssos-festival-card .cover::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(0,0,0,0.78) 100%);}",".cssos-festival-card .info{position:absolute;left:10px;right:10px;bottom:10px;color:#ffeccc;text-shadow:0 1px 4px rgba(0,0,0,0.7);}",".cssos-festival-card .name{font:700 15px/1.2 -apple-system,system-ui,sans-serif;}",".cssos-festival-card .meta{font:500 10px/1.3 ui-monospace,monospace;color:rgba(255,236,200,0.7);margin-top:3px;}",".cssos-festival-card *{pointer-events:none;}"].join(""),document.head.appendChild(s)}}function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,function(c){return c==="&"?"&amp;":c==="<"?"&lt;":c===">"?"&gt;":c==='"'?"&quot;":"&#39;"})}function render(festivals){var shelf=document.getElementById("person-mv-festival-shelf");if(shelf){if(!festivals||!festivals.length){shelf.hidden=!0;return}var f=festivals[0],locale=globalThis.CSSOS_I18N&&globalThis.CSSOS_I18N.getCurrentLocale&&globalThis.CSSOS_I18N.getCurrentLocale()||"en",isZh=/^zh/i.test(String(locale)),name=isZh?f.name_zh||f.name_en:f.name_en||f.name_zh,desc=isZh?f.description_zh||f.description_en||"":f.description_en||f.description_zh||"",color=f.theme_color||"#7a1313",heroHtml='<div class="cssos-festival-hero" style="--festival-bg:'+escapeHtml(color)+'"><div class="emoji">'+escapeHtml(f.emoji||"🎊")+"</div><h2>"+escapeHtml(name)+"</h2><p>"+escapeHtml(desc)+"</p></div>";fetch("/api/person-mv/festivals/"+encodeURIComponent(f.festival_id),{credentials:"include",headers:{Accept:"application/json"}}).then(function(r){return r.ok?r.json():null}).then(function(j){var persons=j&&j.ok&&j.data&&j.data.persons||[],cardsHtml=persons.map(function(p){var cover=p.portrait_url||"",civ=globalThis.civMetaText?globalThis.civMetaText([p.civilization||"",p.era||""],null," · "):[p.civilization||"",p.era||""].filter(Boolean).join(" · "),pname=isZh?p.name_zh||p.name_en:p.name_en||p.name_zh;return'<article class="cssos-festival-card" data-person-id="'+escapeHtml(p.person_id)+'"'+(p.sample_work_id?' data-work-id="'+escapeHtml(p.sample_work_id)+'"':"")+' tabindex="0" role="button" aria-label="'+escapeHtml(pname)+'"><div class="cover"'+(cover?` style="background-image:url('`+String((globalThis.cssosThumb||function(u){return u})(cover,400)).replace(/'/g,"%27")+`')"`:"")+'></div><div class="info"><div class="name">'+escapeHtml(pname)+'</div><div class="meta">'+escapeHtml(civ)+"</div></div></article>"}).join("");shelf.innerHTML=heroHtml+'<div class="cssos-festival-row">'+cardsHtml+"</div>",shelf.hidden=!1,shelf.addEventListener("click",function(ev){var card=ev.target&&ev.target.closest&&ev.target.closest("[data-person-id]");if(card){var pid=card.getAttribute("data-person-id");pid&&(location.hash="#person-mv/"+encodeURIComponent(pid))}})}).catch(function(){shelf.hidden=!0})}}function load(){injectStyle(),fetch("/api/person-mv/festivals/today",{credentials:"include",headers:{Accept:"application/json"}}).then(function(r){return r.ok?r.json():null}).then(function(j){var festivals=j&&j.ok&&j.data&&j.data.festivals||[];render(festivals)}).catch(function(){var shelf=document.getElementById("person-mv-festival-shelf");shelf&&(shelf.hidden=!0)})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",load,{once:!0}):load()})(),(function(){"use strict";var STORAGE_KEY="cssos.personMv.aiChat.history.v1",MAX_HISTORY=40;function tr(en,zh){if(typeof globalThis.CSSOS_I18N?.tr=="function")try{return String(globalThis.CSSOS_I18N.tr(en))}catch{}var locale=globalThis.CSSOS_I18N&&globalThis.CSSOS_I18N.getCurrentLocale&&globalThis.CSSOS_I18N.getCurrentLocale()||"en";return/^zh/i.test(String(locale))&&zh?zh:en}function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,function(c){return c==="&"?"&amp;":c==="<"?"&lt;":c===">"?"&gt;":c==='"'?"&quot;":"&#39;"})}function loadHistory(){try{var raw=localStorage.getItem(STORAGE_KEY);if(!raw)return[];var parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed:[]}catch{return[]}}function saveHistory(list){try{var trimmed=list.slice(-MAX_HISTORY);localStorage.setItem(STORAGE_KEY,JSON.stringify(trimmed))}catch{}}var STYLE_ID="cssos-person-mv-ai-chat-style";function injectStyle(){if(!document.getElementById(STYLE_ID)){var s=document.createElement("style");s.id=STYLE_ID,s.textContent=[".cssos-ai-chat-bubble{position:fixed;right:20px;bottom:120px;width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#00f5a0,#00c280);color:#001b14;font-size:24px;line-height:50px;text-align:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.4);z-index:9998;border:none;transition:transform .15s ease;user-select:none;}",".cssos-ai-chat-bubble:hover{transform:scale(1.08);}",".cssos-ai-chat-bubble[data-open='1']{display:none;}",".cssos-ai-chat-panel{position:fixed;right:20px;bottom:120px;width:320px;height:500px;max-height:75vh;background:rgba(15,10,5,0.97);border:1px solid rgba(255,180,80,0.3);border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,0.5);display:flex;flex-direction:column;z-index:9999;overflow:hidden;color:#ffeccc;font:14px/1.4 -apple-system,system-ui,sans-serif;}",".cssos-ai-chat-panel[hidden]{display:none;}",".cssos-ai-chat-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,180,80,0.18);background:linear-gradient(135deg,rgba(0,245,160,0.12),transparent);}",".cssos-ai-chat-head .title{font:700 14px/1.2 -apple-system,system-ui,sans-serif;}",".cssos-ai-chat-head .close{background:none;border:none;color:rgba(255,236,200,0.7);font-size:18px;cursor:pointer;padding:4px 8px;}",".cssos-ai-chat-body{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;}",".cssos-ai-chat-msg{max-width:85%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.5;word-wrap:break-word;}",".cssos-ai-chat-msg.user{align-self:flex-end;background:rgba(0,245,160,0.18);color:#dffff1;border:1px solid rgba(0,245,160,0.3);}",".cssos-ai-chat-msg.ai{align-self:flex-start;background:rgba(255,180,80,0.10);color:rgba(255,236,200,0.94);border:1px solid rgba(255,180,80,0.18);}",".cssos-ai-chat-msg.action{align-self:flex-start;background:rgba(0,245,160,0.10);color:#dffff1;border:1px dashed rgba(0,245,160,0.4);font-size:12px;}",".cssos-ai-chat-msg.action a{color:#00f5a0;text-decoration:underline;cursor:pointer;}",".cssos-ai-chat-suggestions{padding:6px 14px 0;display:flex;flex-wrap:wrap;gap:6px;}",".cssos-ai-chat-suggestions .chip{font-size:11px;padding:5px 10px;border-radius:14px;background:rgba(255,180,80,0.10);border:1px solid rgba(255,180,80,0.25);color:rgba(255,236,200,0.88);cursor:pointer;}",".cssos-ai-chat-suggestions .chip:hover{background:rgba(255,180,80,0.22);}",".cssos-ai-chat-foot{padding:10px 14px 12px;border-top:1px solid rgba(255,180,80,0.18);display:flex;gap:8px;}",".cssos-ai-chat-foot input{flex:1;background:rgba(0,0,0,0.4);border:1px solid rgba(255,180,80,0.25);border-radius:18px;padding:8px 14px;color:#ffeccc;font:14px -apple-system,system-ui,sans-serif;outline:none;}",".cssos-ai-chat-foot input:focus{border-color:rgba(0,245,160,0.6);}",".cssos-ai-chat-foot button{background:linear-gradient(135deg,#00f5a0,#00c280);color:#001b14;border:none;border-radius:18px;padding:8px 16px;font-weight:700;cursor:pointer;}",".cssos-ai-chat-foot button:disabled{opacity:.5;cursor:not-allowed;}","@media (max-width:640px){.cssos-ai-chat-panel{right:0;bottom:0;left:0;width:100%;height:80vh;border-radius:14px 14px 0 0;}}"].join(""),document.head.appendChild(s)}}var SUGGESTIONS=[{en:"Make a 60th birthday MV for my mom",zh:"为我妈做支 60 大寿 MV"},{en:"Cyberpunk version for Socrates",zh:"送给苏格拉底的赛博朋克版"},{en:"Li Bai on a Mid-Autumn night",zh:"中秋夜的李白"}];function mount(){if(document.getElementById("cssos-ai-chat-bubble"))return;injectStyle();var bubble=document.createElement("button");bubble.id="cssos-ai-chat-bubble",bubble.className="cssos-ai-chat-bubble",bubble.type="button",bubble.setAttribute("aria-label",tr("Open AI creator chat","打开 AI 创作助手")),bubble.textContent="💬",document.body.appendChild(bubble);var panel=document.createElement("div");panel.id="cssos-ai-chat-panel",panel.className="cssos-ai-chat-panel",panel.hidden=!0,panel.innerHTML='<div class="cssos-ai-chat-head"><div class="title">✨ '+escapeHtml(tr("AI Creator","AI 创作助手"))+'</div><div style="display:flex;gap:6px;align-items:center;"><button class="memclear" type="button" title="'+escapeHtml(tr("Clear my memory","清空记忆"))+'" aria-label="'+escapeHtml(tr("Clear my memory","清空记忆"))+'" style="background:none;border:none;color:rgba(255,236,200,0.7);font-size:14px;cursor:pointer;padding:4px 6px;">⚙</button><button class="close" type="button" aria-label="'+escapeHtml(tr("Close","关闭"))+'">×</button></div></div><div class="cssos-ai-chat-memory" id="cssos-ai-chat-memory" style="font-size:11px;padding:6px 14px;color:rgba(255,236,200,0.55);border-bottom:1px solid rgba(255,180,80,0.10);display:none;"></div><div class="cssos-ai-chat-body" id="cssos-ai-chat-body"></div><div class="cssos-ai-chat-suggestions" id="cssos-ai-chat-suggestions"></div><form class="cssos-ai-chat-foot" id="cssos-ai-chat-form"><input type="text" id="cssos-ai-chat-input" autocomplete="off" placeholder="'+escapeHtml(tr("Tell me who & how…","想为谁做一支 MV?"))+'" maxlength="600" /><button type="submit">'+escapeHtml(tr("Send","发送"))+"</button></form>",document.body.appendChild(panel);var body=panel.querySelector("#cssos-ai-chat-body"),input=panel.querySelector("#cssos-ai-chat-input"),form=panel.querySelector("#cssos-ai-chat-form"),sendBtn=form.querySelector("button"),suggestionsEl=panel.querySelector("#cssos-ai-chat-suggestions"),closeBtn=panel.querySelector(".close"),memBtn=panel.querySelector(".memclear"),memEl=panel.querySelector("#cssos-ai-chat-memory"),memState={preferences:null,recent_conversations:[]};async function loadMemory(){try{var r=await fetch("/api/ai-chat/memory",{credentials:"include"});if(r.status===401){memEl.style.display="none";return}var j=await r.json();if(!j||!j.ok)return;memState=j.data||memState;var p=memState&&memState.preferences||{},bits=[];p.favorite_styles&&p.favorite_styles.length&&bits.push(tr("you like ","你喜欢 ")+p.favorite_styles.slice(0,3).join("、")),p.favorite_persons&&p.favorite_persons.length&&bits.push(tr("often create for ","常为 ")+p.favorite_persons.slice(0,3).join("、")+tr(""," 创作")),p.language_pref&&bits.push(tr("prefer ","偏好 ")+(p.language_pref==="zh"?tr("Chinese","中文"):"English")),bits.length?(memEl.innerHTML="🧠 "+escapeHtml(tr("I remember: ","我记得:")+bits.join(" · ")),memEl.style.display="block"):memEl.style.display="none";for(var rc=memState.recent_conversations||[],i=rc.length-1;i>=0;i--){var t=rc[i];if(t&&t.role==="user"&&t.content){var hit=(p.favorite_persons||[]).find(function(n){return t.content.indexOf(n)!==-1});if(hit){input.placeholder=tr("Continue your last topic about "+hit+" ✨","继续聊聊「"+hit+"」 ✨");break}}}}catch{}}memBtn&&memBtn.addEventListener("click",async function(){if(confirm(tr("Clear all AI chat memory? This cannot be undone.","清空 AI 记忆?此操作不可恢复。")))try{var r=await fetch("/api/ai-chat/memory/clear",{method:"POST",credentials:"include"});r.ok&&(memEl.style.display="none",memState={preferences:null,recent_conversations:[]},input.placeholder=tr("Tell me who & how…","想为谁做一支 MV?"),appendMsg("ai",tr("Memory cleared. Fresh start ✨","记忆已清空,重新开始 ✨")))}catch{}});function rerender(){var hist=loadHistory();body.innerHTML=hist.map(function(m){var cls=m.role==="user"?"user":m.kind==="action"?"action":"ai";return'<div class="cssos-ai-chat-msg '+cls+'">'+(m.html||escapeHtml(m.text||""))+"</div>"}).join(""),body.scrollTop=body.scrollHeight,suggestionsEl.style.display=hist.length>0?"none":"flex"}function appendMsg(role,text,opts){var hist=loadHistory();hist.push(Object.assign({role,text,ts:Date.now()},opts||{})),saveHistory(hist),rerender()}function renderSuggestions(){var locale=globalThis.CSSOS_I18N&&globalThis.CSSOS_I18N.getCurrentLocale&&globalThis.CSSOS_I18N.getCurrentLocale()||"en",isZh=/^zh/i.test(String(locale));suggestionsEl.innerHTML=SUGGESTIONS.map(function(s){var label=isZh?s.zh:s.en;return'<button type="button" class="chip" data-prompt="'+escapeHtml(label)+'">'+escapeHtml(label)+"</button>"}).join("")}suggestionsEl.addEventListener("click",function(ev){var chip=ev.target&&ev.target.closest&&ev.target.closest(".chip");if(chip){var p=chip.getAttribute("data-prompt")||"";input.value=p,input.focus()}});function open(){bubble.setAttribute("data-open","1"),panel.hidden=!1,renderSuggestions(),rerender(),loadMemory(),setTimeout(function(){input.focus()},50)}function close(){bubble.removeAttribute("data-open"),panel.hidden=!0}bubble.addEventListener("click",open),closeBtn.addEventListener("click",close);async function ask(message){appendMsg("user",message),input.value="",sendBtn.disabled=!0;var pendingHist=loadHistory();pendingHist.push({role:"ai",text:"…",html:'<span style="opacity:.6">…</span>',ts:Date.now(),pending:!0}),saveHistory(pendingHist),rerender();try{var r=await fetch("/api/person-mv/ai-assistant",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({message})}),j=null;try{j=await r.json()}catch{}var hist=loadHistory();if(hist.length&&hist[hist.length-1].pending&&hist.pop(),saveHistory(hist),!j||!j.ok||!j.data){appendMsg("ai",tr("Sorry, something went wrong. Try again.","出错了,稍后再试。"));return}var d=j.data;if(d.action==="create_mv"&&d.target_name)appendMsg("ai",d.message||tr("Got it — creating now.","收到 — 这就为你创建。")),await triggerCreateMv(d.target_name,d.occasion,d.style_hint);else if(d.action==="search_person"&&d.target_name){var label=tr("Open "+d.target_name+" in the codex →","在文明库打开「"+d.target_name+"」→");appendMsg("ai","",{kind:"action",html:escapeHtml(d.message||tr("Let's open the codex.","为你打开档案。"))+' <a data-search="'+escapeHtml(d.target_name)+'">'+escapeHtml(label)+"</a>"})}else appendMsg("ai",d.message||tr("How can I help with your MV today?","今天想做支什么样的 MV?"))}catch{var hist2=loadHistory();hist2.length&&hist2[hist2.length-1].pending&&hist2.pop(),saveHistory(hist2),appendMsg("ai",tr("Network error. Try again.","网络出错,请重试。"))}finally{sendBtn.disabled=!1}}async function triggerCreateMv(targetName,occasion,styleHint){var hint=[occasion||"",styleHint||""].filter(Boolean).join(" · ");try{var r=await fetch("/api/person-mv/persons",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({name:targetName,hint})});if(r.status===401){appendMsg("ai","",{kind:"action",html:escapeHtml(tr("Sign in to create an MV →","请先登录再创建 →"))+' <a href="/login.html">'+escapeHtml(tr("Sign in","登录"))+"</a>"});return}var txt=await r.text(),j=null;try{j=JSON.parse(txt)}catch{var trimmed=txt.replace(/^\s+/,"");try{j=JSON.parse(trimmed)}catch{}}if(!j||!j.ok||!j.person_id){appendMsg("ai",tr("Couldn't create the person. Try again.","创建失败,请稍后再试。"));return}var pid=j.person_id,safeName=escapeHtml(targetName);appendMsg("ai","",{kind:"action",html:"✨ "+tr('Created page for "<b>'+safeName+'</b>", generating MV…',"已为「<b>"+safeName+"</b>」创建专页,正在生成 MV…")+' <a data-open-pid="'+escapeHtml(pid)+'">'+escapeHtml(tr("Open cinema →","进入影院 →"))+"</a>"});try{globalThis.openPersonMvPanel?.()}catch{}try{globalThis.openPersonMvCodex?.(pid,{autoCinema:!0})}catch{}try{history.replaceState(null,"","#person-mv/codex/"+encodeURIComponent(pid))}catch{}}catch{appendMsg("ai",tr("Network error while creating.","创建时网络出错。"))}}body.addEventListener("click",function(ev){var t=ev.target;if(t){var openPid=t.getAttribute&&t.getAttribute("data-open-pid");if(openPid){try{globalThis.openPersonMvPanel?.()}catch{}try{globalThis.openPersonMvCodex?.(openPid,{autoCinema:!0})}catch{}try{history.replaceState(null,"","#person-mv/codex/"+encodeURIComponent(openPid))}catch{}return}var search=t.getAttribute&&t.getAttribute("data-search");if(search){location.hash="#person-mv?q="+encodeURIComponent(search);return}}}),form.addEventListener("submit",function(ev){ev.preventDefault();var msg=(input.value||"").trim();msg&&ask(msg)})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",mount,{once:!0}):mount()})(),(function(){"use strict";function tt(en,zh){if(typeof globalThis.CSSOS_I18N?.tr=="function")try{return String(globalThis.CSSOS_I18N.tr(en))}catch{}if(typeof globalThis.loginCopy=="function")try{return globalThis.loginCopy(en,zh)}catch{}var lang=(navigator.language||"en").toLowerCase();return lang.indexOf("zh")===0&&zh?zh:en}function isZh(){return(navigator.language||"en").toLowerCase().indexOf("zh")===0}function localizedName(p){return p?isZh()?p.name_zh||p.name_en||p.person_id||"":p.name_en||p.name_zh||p.person_id||"":""}var STYLE_ID="cssos-civ-era-page-style";function ensureStyle(){if(!document.getElementById(STYLE_ID)){var s=document.createElement("style");s.id=STYLE_ID,s.textContent=["#cssos-civ-era-page{position:fixed;inset:0;z-index:9000;","  background:rgba(8,16,12,0.96);color:#daffee;overflow:auto;","  font-family:inherit;padding:48px 24px 64px;}","#cssos-civ-era-page .cssos-cep-inner{max-width:1100px;margin:0 auto;}","#cssos-civ-era-page .cssos-cep-close{position:fixed;top:16px;right:20px;","  background:rgba(0,160,100,0.12);color:#daffee;border:1px solid #0a8;","  border-radius:999px;padding:6px 14px;cursor:pointer;font-size:14px;}","#cssos-civ-era-page h1{font-size:38px;margin:0 0 8px;color:#daffee;}","#cssos-civ-era-page .cssos-cep-meta{opacity:0.75;margin-bottom:24px;}","#cssos-civ-era-page h2{font-size:20px;margin:24px 0 12px;color:#daffee;}","#cssos-civ-era-page .cssos-cep-grid{display:grid;","  grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;}","#cssos-civ-era-page .cssos-cep-card{background:rgba(0,160,100,0.08);","  border:1px solid rgba(0,160,100,0.25);border-radius:14px;padding:14px;","  cursor:pointer;transition:transform 120ms ease, background 120ms ease;}","#cssos-civ-era-page .cssos-cep-card:hover{transform:translateY(-2px);","  background:rgba(0,160,100,0.16);}","#cssos-civ-era-page .cssos-cep-card .cep-name{font-size:16px;font-weight:600;}","#cssos-civ-era-page .cssos-cep-card .cep-sub{opacity:0.7;font-size:12px;margin-top:4px;}","#cssos-civ-era-page .cssos-cep-empty{opacity:0.6;font-size:14px;}",'html[data-theme="light"] #cssos-civ-era-page{',"  background:rgba(245,250,247,0.98);color:#0f3a2a;}",'html[data-theme="light"] #cssos-civ-era-page h1,','html[data-theme="light"] #cssos-civ-era-page h2,','html[data-theme="light"] #cssos-civ-era-page .cssos-cep-close{color:#0f3a2a;}','html[data-theme="light"] #cssos-civ-era-page .cssos-cep-close{',"  background:rgba(0,160,100,0.10);border-color:#00a060;}",'html[data-theme="light"] #cssos-civ-era-page .cssos-cep-card{',"  background:rgba(0,160,100,0.06);border-color:rgba(0,160,100,0.30);}",'html[data-theme="light"] #cssos-civ-era-page .cssos-cep-card:hover{',"  background:rgba(0,160,100,0.14);}"].join(`
`),document.head.appendChild(s)}}function el(tag,cls,text){var n=document.createElement(tag);return cls&&(n.className=cls),text!=null&&(n.textContent=text),n}function cepEmpty(icon,title,sub){var ems=globalThis.cssosEmptyStateMarkup;if(ems){var box=el("div","cssos-cep-empty");return box.innerHTML=ems({icon,title,sub}),box}return el("div","cssos-cep-empty",title)}function getOrMakeRoot(){var root=document.getElementById("cssos-civ-era-page");return root||(root=document.createElement("div"),root.id="cssos-civ-era-page",root.style.display="none",document.body.appendChild(root),root)}function show(){ensureStyle();var root=getOrMakeRoot();root.style.display="block"}function hide(){var root=document.getElementById("cssos-civ-era-page");root&&(root.style.display="none")}async function fetchJSON(url){var r=await fetch(url,{credentials:"include",headers:{Accept:"application/json"}});if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}function renderDetail(kind,payload){var root=getOrMakeRoot();root.replaceChildren();var inner=el("div","cssos-cep-inner"),close=el("button","cssos-cep-close",tt("Close","关闭"));close.addEventListener("click",function(){try{history.replaceState(null,"","#")}catch{}hide()}),root.appendChild(close);var emoji=kind==="civ"?"🏛️":"📜",name=kind==="civ"?payload.civ:payload.era,h1=el("h1");h1.textContent=emoji+"  "+name,inner.appendChild(h1);var meta=el("div","cssos-cep-meta");meta.textContent=tt("Members","成员")+": "+(payload.person_count||0)+"  ·  "+tt("MVs","音乐影像")+": "+(payload.mv_count||0),inner.appendChild(meta),inner.appendChild(el("h2",null,tt("Top members","重要人物")));var pgrid=el("div","cssos-cep-grid"),persons=Array.isArray(payload.persons)?payload.persons:[];persons.length?persons.forEach(function(p){var card=el("div","cssos-cep-card");card.appendChild(el("div","cep-name",localizedName(p)));var sub=[];p.era&&sub.push(p.era),p.lifespan&&sub.push(p.lifespan),typeof p.mv_count=="number"&&sub.push(tt("MVs","MV")+": "+p.mv_count),card.appendChild(el("div","cep-sub",sub.join(" · "))),card.addEventListener("click",function(){location.hash="#person-mv/"+encodeURIComponent(p.person_id),hide()}),pgrid.appendChild(card)}):pgrid.appendChild(cepEmpty("👤",tt("No members yet.","暂无成员。"),tt("Figures from this era will appear here.","这个时代的人物会出现在这里。"))),inner.appendChild(pgrid),inner.appendChild(el("h2",null,tt("Recent MVs","最近作品")));var mgrid=el("div","cssos-cep-grid"),mvs=Array.isArray(payload.mvs)?payload.mvs:[];mvs.length?mvs.forEach(function(m){var card=el("div","cssos-cep-card");card.appendChild(el("div","cep-name",isZh()?m.name_zh||m.name_en||"":m.name_en||m.name_zh||""));var sub=[];typeof m.view_count=="number"&&sub.push("👁 "+m.view_count),typeof m.like_count=="number"&&sub.push("❤ "+m.like_count),m.scenario_seed&&sub.push(String(m.scenario_seed).slice(0,40)),card.appendChild(el("div","cep-sub",sub.join(" · "))),card.addEventListener("click",function(){location.hash="#person-mv/"+encodeURIComponent(m.person_id)+"/mv/"+encodeURIComponent(m.mv_id),hide()}),mgrid.appendChild(card)}):mgrid.appendChild(cepEmpty("🎬",tt("No MVs yet.","暂无作品。"),tt("Be the first to create one for this era.","来为这个时代创作第一支吧。"))),inner.appendChild(mgrid),root.appendChild(inner),show()}async function loadAndRender(kind,name){show();try{var url=kind==="civ"?"/api/person-mv/civs/"+encodeURIComponent(name):"/api/person-mv/eras/"+encodeURIComponent(name),j=await fetchJSON(url);if(!j.ok)throw new Error(j.code||"fetch_failed");renderDetail(kind,j.data||{})}catch(err){var root=getOrMakeRoot();root.replaceChildren();var inner=el("div","cssos-cep-inner");inner.appendChild(el("h1",null,tt("Failed to load","加载失败"))),inner.appendChild(el("div","cssos-cep-meta",String(err&&err.message||err)));var back=el("button","cssos-cep-close",tt("Close","关闭"));back.addEventListener("click",hide),root.appendChild(back),root.appendChild(inner)}}function parseHash(){var h=String(location.hash||"").replace(/^#/,""),civ=h.match(/^civ\/(.+)$/);if(civ)return{kind:"civ",name:decodeURIComponent(civ[1])};var era=h.match(/^era\/(.+)$/);return era?{kind:"era",name:decodeURIComponent(era[1])}:null}function onHash(){var p=parseHash();if(!p){hide();return}loadAndRender(p.kind,p.name)}window.addEventListener("hashchange",onHash),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",onHash,{once:!0}):onHash(),window.addEventListener("cssos-civ-era-open",function(ev){var d=ev&&ev.detail||{};!d.kind||!d.name||(location.hash="#"+d.kind+"/"+encodeURIComponent(d.name))})})(),(function(){"use strict";function tt(en,zh){if(typeof globalThis.CSSOS_I18N?.tr=="function")try{return String(globalThis.CSSOS_I18N.tr(en))}catch{}if(typeof globalThis.loginCopy=="function")try{return globalThis.loginCopy(en,zh)}catch{}var lang=(navigator.language||"en").toLowerCase();return lang.indexOf("zh")===0&&zh?zh:en}function isZh(){return(navigator.language||"en").toLowerCase().indexOf("zh")===0}function isAdmin(){try{var me=globalThis.CSSOS_ME||{};return me.role==="admin"||me.tier==="admin"}catch{return!1}}var STYLE_ID="cssos-tutorials-style";function ensureStyle(){if(!document.getElementById(STYLE_ID)){var s=document.createElement("style");s.id=STYLE_ID,s.textContent=["#cssos-tutorials-page{position:fixed;inset:0;z-index:9000;","  background:rgba(8,16,12,0.96);color:#daffee;overflow:auto;","  font-family:inherit;padding:48px 24px 64px;}","#cssos-tutorials-page .cssos-tut-inner{max-width:900px;margin:0 auto;}","#cssos-tutorials-page .cssos-tut-close{position:fixed;top:16px;right:20px;","  background:rgba(0,160,100,0.12);color:#daffee;border:1px solid #0a8;","  border-radius:999px;padding:6px 14px;cursor:pointer;font-size:14px;}","#cssos-tutorials-page h1{font-size:32px;margin:0 0 8px;color:#daffee;}","#cssos-tutorials-page .cssos-tut-meta{opacity:0.75;margin-bottom:24px;}","#cssos-tutorials-page .cssos-tut-grid{display:grid;","  grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}","#cssos-tutorials-page .cssos-tut-card{background:rgba(0,160,100,0.08);","  border:1px solid rgba(0,160,100,0.25);border-radius:14px;padding:16px;","  cursor:pointer;transition:transform 120ms ease, background 120ms ease;}","#cssos-tutorials-page .cssos-tut-card:hover{transform:translateY(-2px);","  background:rgba(0,160,100,0.16);}","#cssos-tutorials-page .cssos-tut-card .tut-emoji{font-size:30px;}","#cssos-tutorials-page .cssos-tut-card .tut-title{font-size:16px;","  font-weight:600;margin-top:6px;}","#cssos-tutorials-page .cssos-tut-card .tut-sub{opacity:0.7;","  font-size:12px;margin-top:6px;display:flex;gap:8px;}","#cssos-tutorials-page .cssos-tut-badge{background:rgba(0,160,100,0.25);","  border-radius:6px;padding:2px 8px;font-size:11px;}","#cssos-tutorials-page .cssos-tut-body{line-height:1.6;font-size:15px;}","#cssos-tutorials-page .cssos-tut-body h1,","#cssos-tutorials-page .cssos-tut-body h2,","#cssos-tutorials-page .cssos-tut-body h3{margin-top:24px;}","#cssos-tutorials-page .cssos-tut-body code{background:rgba(0,160,100,0.16);","  padding:2px 6px;border-radius:4px;font-size:13px;}","#cssos-tutorials-page .cssos-tut-body pre{background:rgba(0,0,0,0.30);","  padding:12px;border-radius:8px;overflow:auto;}","#cssos-tutorials-page .cssos-tut-body a{color:#7fffd4;}","#cssos-tutorials-page .cssos-tut-cta{position:sticky;bottom:16px;display:flex;","  justify-content:center;margin-top:32px;}","#cssos-tutorials-page .cssos-tut-cta button{background:#00a060;color:#fff;","  border:none;border-radius:999px;padding:12px 28px;font-size:15px;","  font-weight:600;cursor:pointer;box-shadow:0 8px 24px rgba(0,160,100,0.4);}","#cssos-tutorials-page .cssos-tut-admin{margin:8px 0 24px;}","#cssos-tutorials-page .cssos-tut-admin button{background:rgba(0,160,100,0.18);","  color:#daffee;border:1px solid #0a8;border-radius:8px;padding:6px 14px;cursor:pointer;}","#cssos-tutorials-page .cssos-tut-form{display:flex;flex-direction:column;gap:8px;","  background:rgba(0,160,100,0.06);border:1px solid rgba(0,160,100,0.25);","  border-radius:12px;padding:16px;margin-bottom:24px;}","#cssos-tutorials-page .cssos-tut-form input,","#cssos-tutorials-page .cssos-tut-form textarea,","#cssos-tutorials-page .cssos-tut-form select{background:rgba(0,0,0,0.25);","  color:#daffee;border:1px solid rgba(0,160,100,0.40);border-radius:6px;","  padding:8px;font-family:inherit;font-size:14px;}","#cssos-tutorials-page .cssos-tut-form textarea{min-height:200px;font-family:monospace;}",'html[data-theme="light"] #cssos-tutorials-page{',"  background:rgba(245,250,247,0.98);color:#0f3a2a;}",'html[data-theme="light"] #cssos-tutorials-page h1,','html[data-theme="light"] #cssos-tutorials-page .cssos-tut-close{color:#0f3a2a;}','html[data-theme="light"] #cssos-tutorials-page .cssos-tut-close{',"  background:rgba(0,160,100,0.10);border-color:#00a060;}",'html[data-theme="light"] #cssos-tutorials-page .cssos-tut-card{',"  background:rgba(0,160,100,0.06);border-color:rgba(0,160,100,0.30);}",'html[data-theme="light"] #cssos-tutorials-page .cssos-tut-card:hover{',"  background:rgba(0,160,100,0.14);}",'html[data-theme="light"] #cssos-tutorials-page .cssos-tut-body code{',"  background:rgba(0,160,100,0.14);color:#0f3a2a;}",'html[data-theme="light"] #cssos-tutorials-page .cssos-tut-body pre{',"  background:rgba(0,0,0,0.06);}",'html[data-theme="light"] #cssos-tutorials-page .cssos-tut-body a{color:#00a060;}','html[data-theme="light"] #cssos-tutorials-page .cssos-tut-admin button{',"  background:rgba(0,160,100,0.10);color:#0f3a2a;border-color:#00a060;}",'html[data-theme="light"] #cssos-tutorials-page .cssos-tut-form{',"  background:rgba(0,160,100,0.04);border-color:rgba(0,160,100,0.30);}",'html[data-theme="light"] #cssos-tutorials-page .cssos-tut-form input,','html[data-theme="light"] #cssos-tutorials-page .cssos-tut-form textarea,','html[data-theme="light"] #cssos-tutorials-page .cssos-tut-form select{',"  background:#fff;color:#0f3a2a;border-color:rgba(0,160,100,0.40);}"].join(`
`),document.head.appendChild(s)}}function el(tag,cls,text){var n=document.createElement(tag);return cls&&(n.className=cls),text!=null&&(n.textContent=text),n}function getOrMakeRoot(){var root=document.getElementById("cssos-tutorials-page");return root||(root=document.createElement("div"),root.id="cssos-tutorials-page",root.style.display="none",document.body.appendChild(root),root)}function show(){ensureStyle(),getOrMakeRoot().style.display="block"}function hide(){var r=document.getElementById("cssos-tutorials-page");r&&(r.style.display="none")}async function fetchJSON(url,opts){var r=await fetch(url,Object.assign({credentials:"include",headers:{Accept:"application/json"}},opts||{})),j;try{j=await r.json()}catch{j=null}if(!r.ok)throw new Error(j&&j.code||"HTTP "+r.status);return j}function diffBadge(d){return d==="advanced"?tt("Advanced","进阶"):d==="intermediate"?tt("Intermediate","中级"):tt("Beginner","入门")}function renderList(items){var root=getOrMakeRoot();root.replaceChildren();var inner=el("div","cssos-tut-inner"),close=el("button","cssos-tut-close",tt("Close","关闭"));if(close.addEventListener("click",function(){try{history.replaceState(null,"","#")}catch{}hide()}),root.appendChild(close),inner.appendChild(el("h1",null,tt("Tutorials","教程"))),inner.appendChild(el("div","cssos-tut-meta",tt("Step-by-step guides for building MVs.","一步一步带你做出 MV。"))),isAdmin()){var bar=el("div","cssos-tut-admin"),btn=el("button",null,tt("+ New tutorial","+ 新建教程"));btn.addEventListener("click",function(){renderEditor(null)}),bar.appendChild(btn),inner.appendChild(bar)}var grid=el("div","cssos-tut-grid");items.length||grid.appendChild(el("div",null,tt("No tutorials yet.","暂无教程。"))),items.forEach(function(t){var card=el("div","cssos-tut-card");card.appendChild(el("div","tut-emoji",t.emoji||"📘")),card.appendChild(el("div","tut-title",isZh()?t.title_zh||t.title_en:t.title_en||t.title_zh));var sub=el("div","tut-sub");sub.appendChild(el("span","cssos-tut-badge",diffBadge(t.difficulty))),sub.appendChild(el("span",null,"👁 "+(t.view_count||0))),card.appendChild(sub),card.addEventListener("click",function(){location.hash="#tutorials/"+encodeURIComponent(t.tutorial_id)}),grid.appendChild(card)}),inner.appendChild(grid),root.appendChild(inner),show()}function renderDetail(t){var root=getOrMakeRoot();root.replaceChildren();var inner=el("div","cssos-tut-inner"),close=el("button","cssos-tut-close",tt("Close","关闭"));close.addEventListener("click",function(){location.hash="#tutorials"}),root.appendChild(close);var title=isZh()?t.title_zh||t.title_en:t.title_en||t.title_zh;inner.appendChild(el("h1",null,(t.emoji||"📘")+"  "+title));var meta=el("div","cssos-tut-meta");if(meta.textContent=diffBadge(t.difficulty)+"  ·  👁 "+(t.view_count||0),inner.appendChild(meta),isAdmin()){var bar=el("div","cssos-tut-admin"),editBtn=el("button",null,tt("Edit","编辑"));if(editBtn.addEventListener("click",function(){renderEditor(t)}),bar.appendChild(editBtn),!t.published_at){var pubBtn=el("button",null,tt("Publish","发布"));pubBtn.style.marginLeft="8px",pubBtn.addEventListener("click",async function(){try{await fetchJSON("/api/admin/tutorials/"+encodeURIComponent(t.tutorial_id)+"/publish",{method:"POST"}),alert(tt("Published.","已发布。")),loadDetail(t.tutorial_id)}catch(err){alert(String(err))}}),bar.appendChild(pubBtn)}inner.appendChild(bar)}var body=el("div","cssos-tut-body"),html=isZh()?t.body_html||t.body_en_html||"":t.body_en_html||t.body_html||"";if(body.innerHTML=html,inner.appendChild(body),t.template_id){var cta=el("div","cssos-tut-cta"),useBtn=el("button",null,tt("Use this template","使用此模板"));useBtn.addEventListener("click",function(){location.hash="#person-mv/template/"+encodeURIComponent(t.template_id)+"/fork"}),cta.appendChild(useBtn),inner.appendChild(cta)}root.appendChild(inner),show()}function renderEditor(existing){var root=getOrMakeRoot();root.replaceChildren();var inner=el("div","cssos-tut-inner"),close=el("button","cssos-tut-close",tt("Close","关闭"));close.addEventListener("click",function(){location.hash="#tutorials"}),root.appendChild(close),inner.appendChild(el("h1",null,existing?tt("Edit tutorial","编辑教程"):tt("New tutorial","新建教程")));var form=el("div","cssos-tut-form");function row(labelEn,labelZh,input){var lbl=el("label",null,tt(labelEn,labelZh));form.appendChild(lbl),form.appendChild(input)}var titleZh=el("input");titleZh.type="text",titleZh.value=existing&&existing.title_zh||"";var titleEn=el("input");titleEn.type="text",titleEn.value=existing&&existing.title_en||"";var emoji=el("input");emoji.type="text",emoji.maxLength=4,emoji.value=existing?existing.emoji||"":"📘";var tplId=el("input");tplId.type="text",tplId.value=existing&&existing.template_id||"";var diff=el("select");[["beginner","入门"],["intermediate","中级"],["advanced","进阶"]].forEach(function(p){var o=document.createElement("option");o.value=p[0],o.textContent=isZh()?p[1]:p[0],existing&&existing.difficulty===p[0]&&(o.selected=!0),diff.appendChild(o)});var bodyZh=el("textarea");bodyZh.value=existing&&existing.body_md||"";var bodyEn=el("textarea");bodyEn.value=existing&&existing.body_en_md||"",row("Title (中文)","标题（中文）",titleZh),row("Title (English)","标题（英文）",titleEn),row("Emoji","表情",emoji),row("Template ID (optional)","模板 ID（可选）",tplId),row("Difficulty","难度",diff),row("Body — Chinese (markdown)","正文 — 中文（Markdown）",bodyZh),row("Body — English (markdown, optional)","正文 — 英文（可选）",bodyEn);var save=el("button",null,tt("Save","保存"));save.style.alignSelf="flex-start",save.style.background="#00a060",save.style.color="#fff",save.style.border="none",save.style.borderRadius="8px",save.style.padding="8px 18px",save.style.cursor="pointer",save.addEventListener("click",async function(){var body={title_zh:titleZh.value.trim(),title_en:titleEn.value.trim(),emoji:emoji.value.trim()||null,difficulty:diff.value,template_id:tplId.value.trim()||null,body_md:bodyZh.value,body_en_md:bodyEn.value||null};try{if(existing)await fetchJSON("/api/admin/tutorials/"+encodeURIComponent(existing.tutorial_id),{method:"PATCH",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(body)}),location.hash="#tutorials/"+encodeURIComponent(existing.tutorial_id);else{var j=await fetchJSON("/api/admin/tutorials",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(body)}),id=j&&j.data&&j.data.tutorial_id;id?location.hash="#tutorials/"+encodeURIComponent(id):location.hash="#tutorials"}}catch(err){alert(String(err))}}),form.appendChild(save),inner.appendChild(form),root.appendChild(inner),show()}async function loadList(){show();try{var j=await fetchJSON("/api/tutorials"),items=j&&j.data&&j.data.tutorials||[];renderList(items)}catch(err){var root=getOrMakeRoot();root.replaceChildren();var inner=el("div","cssos-tut-inner");inner.appendChild(el("h1",null,tt("Failed to load","加载失败"))),inner.appendChild(el("div","cssos-tut-meta",String(err&&err.message||err))),root.appendChild(inner)}}async function loadDetail(id){show();try{var j=await fetchJSON("/api/tutorials/"+encodeURIComponent(id));renderDetail(j&&j.data||{})}catch(err){var root=getOrMakeRoot();root.replaceChildren();var inner=el("div","cssos-tut-inner");inner.appendChild(el("h1",null,tt("Failed to load","加载失败"))),inner.appendChild(el("div","cssos-tut-meta",String(err&&err.message||err))),root.appendChild(inner)}}function onHash(){var h=String(location.hash||"").replace(/^#/,"");if(h==="tutorials"){loadList();return}var m=h.match(/^tutorials\/(.+)$/);if(m){loadDetail(decodeURIComponent(m[1]));return}hide()}window.addEventListener("hashchange",onHash),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",onHash,{once:!0}):onHash()})(),(function(){"use strict";const STORAGE_KEY="cssmv.slideshow.intensity";let intensity=.85;try{const v=parseFloat(localStorage.getItem(STORAGE_KEY)||"");Number.isFinite(v)&&v>=0&&v<=1&&(intensity=v)}catch{}const computeTimings=level=>{const totalMs=Math.round(6e4-57e3*level),each=Math.max(800,Math.floor(totalMs/3));return{FADE_IN_MS:each,MAIN_MS:each,FADE_OUT_MS:each,TICK_MS:each*3}};let{FADE_IN_MS,MAIN_MS,FADE_OUT_MS,TICK_MS}=computeTimings(intensity);const state={slides:[],mvIndex:0,musicIndex:0,mvTimer:null,musicTimer:null,mvActive:!1,musicActive:!1};globalThis.cssmvSetSlideshowIntensity=function(level){const v=Math.max(0,Math.min(1,Number(level)||0));intensity=v;try{localStorage.setItem(STORAGE_KEY,String(v))}catch{}const t=computeTimings(v);FADE_IN_MS=t.FADE_IN_MS,MAIN_MS=t.MAIN_MS,FADE_OUT_MS=t.FADE_OUT_MS,TICK_MS=t.TICK_MS;const old=document.getElementById("cssmv-cover-slideshow-styles");return old&&old.remove(),typeof ensureStyles=="function"&&ensureStyles(),{intensity:v,frameMs:TICK_MS}},globalThis.cssmvGetSlideshowIntensity=function(){return intensity},ensureStyles();function ensureStyles(){if(document.getElementById("cssmv-cover-slideshow-styles"))return;const st=document.createElement("style");st.id="cssmv-cover-slideshow-styles";const totalMs=FADE_IN_MS+MAIN_MS+FADE_OUT_MS;st.textContent=`
/* --- zoom-in to corner --- */
@keyframes cssmv-kb-0  { from{transform:scale(1.00)translate( 0%,  0%)} to{transform:scale(1.14)translate(-3%,-3%)} }
@keyframes cssmv-kb-1  { from{transform:scale(1.00)translate( 0%,  0%)} to{transform:scale(1.14)translate( 3%,-3%)} }
@keyframes cssmv-kb-2  { from{transform:scale(1.00)translate( 0%,  0%)} to{transform:scale(1.14)translate(-3%, 3%)} }
@keyframes cssmv-kb-3  { from{transform:scale(1.00)translate( 0%,  0%)} to{transform:scale(1.14)translate( 3%, 3%)} }
/* --- zoom-out from corner (特写→全图) --- */
@keyframes cssmv-kb-4  { from{transform:scale(1.16)translate(-4%,-4%)} to{transform:scale(1.00)translate( 0%,  0%)} }
@keyframes cssmv-kb-5  { from{transform:scale(1.16)translate( 4%,-4%)} to{transform:scale(1.00)translate( 0%,  0%)} }
@keyframes cssmv-kb-6  { from{transform:scale(1.16)translate(-4%, 4%)} to{transform:scale(1.00)translate( 0%,  0%)} }
@keyframes cssmv-kb-7  { from{transform:scale(1.16)translate( 4%, 4%)} to{transform:scale(1.00)translate( 0%,  0%)} }
/* --- horizontal pan --- */
@keyframes cssmv-kb-8  { from{transform:scale(1.07)translate( 3%, 0%)} to{transform:scale(1.07)translate(-3%,  0%)} }
@keyframes cssmv-kb-9  { from{transform:scale(1.07)translate(-3%, 0%)} to{transform:scale(1.07)translate( 3%,  0%)} }
/* --- vertical pan --- */
@keyframes cssmv-kb-10 { from{transform:scale(1.07)translate(0%,  3%)} to{transform:scale(1.07)translate(  0%,-3%)} }
@keyframes cssmv-kb-11 { from{transform:scale(1.07)translate(0%, -3%)} to{transform:scale(1.07)translate(  0%, 3%)} }
/* --- WAVE_446: focal-point smart zoom (transform-origin set per-element) --- */
/* zoom-in: wide → 特写 (pull viewer toward subject) */
@keyframes cssmv-kb-focal-in  { from{transform:scale(1.00)} to{transform:scale(1.26)} }
/* zoom-out: 特写 → wide (cinematic reveal, "real video" feel) */
@keyframes cssmv-kb-focal-out { from{transform:scale(1.26)} to{transform:scale(1.00)} }

.cssmv-cover-slide {
  position: absolute;
  inset: 0;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  opacity: 0;
  transition: opacity ${FADE_IN_MS}ms ease-in-out;
  pointer-events: none;
  border-radius: inherit;
  z-index: 0;
  will-change: transform, opacity;
}
.cssmv-cover-slide.is-visible {
  opacity: 1;
  animation-duration: ${totalMs}ms;
  animation-timing-function: ease-in-out;
  animation-fill-mode: both;
}
.cssmv-cover-slide.cssmv-kb-0.is-visible  { animation-name: cssmv-kb-0;  }
.cssmv-cover-slide.cssmv-kb-1.is-visible  { animation-name: cssmv-kb-1;  }
.cssmv-cover-slide.cssmv-kb-2.is-visible  { animation-name: cssmv-kb-2;  }
.cssmv-cover-slide.cssmv-kb-3.is-visible  { animation-name: cssmv-kb-3;  }
.cssmv-cover-slide.cssmv-kb-4.is-visible  { animation-name: cssmv-kb-4;  }
.cssmv-cover-slide.cssmv-kb-5.is-visible  { animation-name: cssmv-kb-5;  }
.cssmv-cover-slide.cssmv-kb-6.is-visible  { animation-name: cssmv-kb-6;  }
.cssmv-cover-slide.cssmv-kb-7.is-visible  { animation-name: cssmv-kb-7;  }
.cssmv-cover-slide.cssmv-kb-8.is-visible  { animation-name: cssmv-kb-8;  }
.cssmv-cover-slide.cssmv-kb-9.is-visible  { animation-name: cssmv-kb-9;  }
.cssmv-cover-slide.cssmv-kb-10.is-visible { animation-name: cssmv-kb-10; }
.cssmv-cover-slide.cssmv-kb-11.is-visible { animation-name: cssmv-kb-11; }
.cssmv-cover-slide.cssmv-kb-focal-in.is-visible  { animation-name: cssmv-kb-focal-in;  }
.cssmv-cover-slide.cssmv-kb-focal-out.is-visible { animation-name: cssmv-kb-focal-out; }
.cssmv-cover-slide.is-fading-out { transition: opacity ${FADE_OUT_MS}ms ease-in-out; opacity: 0; }
#watch-music-art.cssmv-slideshow-host,
#watch-music-disc.cssmv-slideshow-host {
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
#watch-svg.cssmv-slideshow-host { position: relative; overflow: hidden; }
`,document.head.appendChild(st)}globalThis.cssmvSetCoverSlides=function(list){if(!Array.isArray(list))return;const cleaned=list.map(u=>typeof u=="string"?u.trim():"").filter(u=>!!u),seen=new Set,newSlides=cleaned.filter(u=>seen.has(u)?!1:(seen.add(u),!0));!newSlides.length||newSlides.length===state.slides.length&&newSlides.every((u,i)=>u===state.slides[i])||(state.slides=newSlides,_prefetchFocal(newSlides),state.mvActive&&renderMvFrame(state.mvIndex%state.slides.length),state.musicActive&&renderMusicFrame(state.musicIndex%state.slides.length))},globalThis.cssmvAddCoverSlide=function(url){if(typeof url!="string")return;const u=url.trim();u&&(state.slides.includes(u)||(state.slides.push(u),state.slides.length===1&&(state.mvActive&&renderMvFrame(0),state.musicActive&&renderMusicFrame(0))))},globalThis.cssmvClearCoverSlides=function(){state.slides=[],state.mvIndex=0,state.musicIndex=0},globalThis.cssmvStartCoverSlideshow=function(opts={}){const wantMv=opts.mv!==!1,wantMusic=opts.music!==!1;wantMv&&startMv(),wantMusic&&startMusic()},globalThis.cssmvStopCoverSlideshowMvOnly=function(){stopMv()},globalThis.cssmvStopCoverSlideshow=function(){stopMv(),stopMusic()};function _slideshowVisible(host){try{if(document.hidden||!host||host.offsetParent===null&&host.tagName!=="BODY"&&(!host.getClientRects||host.getClientRects().length===0))return!1;var wp=document.getElementById("watch-panel");if(wp&&wp.classList.contains("hidden"))return!1}catch{}return!0}function mvHost(){return document.getElementById("watch-svg")}function startMv(){const host=mvHost();host&&(state.mvActive||(host.tagName!=="IMG"&&host.classList.add("cssmv-slideshow-host"),state.mvActive=!0,state.mvIndex=state.slides.length?Math.floor(Math.random()*state.slides.length):0,state.slides.length&&renderMvFrame(state.mvIndex),_ensureAudioRefitHook(),state.mvTimer=setInterval(()=>{state.slides.length&&_slideshowVisible(mvHost())&&(state.mvIndex=(state.mvIndex+1)%state.slides.length,renderMvFrame(state.mvIndex))},_fittedFrameMs())))}function stopMv(){state.mvTimer&&(clearInterval(state.mvTimer),state.mvTimer=null),state.mvActive=!1;const host=mvHost();host&&(host.tagName==="IMG"?(host.style.display="none",host.style.opacity="",host.removeAttribute("src")):(host.querySelectorAll(".cssmv-cover-slide").forEach(el=>el.remove()),host.classList.remove("cssmv-slideshow-host")))}function renderMvFrame(idx){const host=mvHost();if(!host||!state.slides.length)return;const url=state.slides[idx%state.slides.length];if(url){if(host.tagName==="IMG"){host.getAttribute("src")!==url&&(host.src=url),host.style.display="block",host.style.opacity="1";return}injectSlide(host,url)}}function _fittedFrameMs(){try{const a=document.getElementById("watch-audio-preview"),durMs=a&&isFinite(a.duration)&&a.duration>1?a.duration*1e3:0,n=state.slides.length||1;if(durMs&&n){const loops=Math.max(1,Math.round(durMs/(TICK_MS*n)));return Math.max(2500,Math.min(45e3,durMs/(n*loops)))}}catch{}return TICK_MS}function _refitActiveTimers(){try{state.mvActive&&state.mvTimer&&(clearInterval(state.mvTimer),state.mvTimer=setInterval(()=>{state.slides.length&&_slideshowVisible(mvHost())&&(state.mvIndex=(state.mvIndex+1)%state.slides.length,renderMvFrame(state.mvIndex))},_fittedFrameMs())),state.musicActive&&state.musicTimer&&(clearInterval(state.musicTimer),state.musicTimer=setInterval(()=>{state.slides.length&&_slideshowVisible(musicHosts()[0])&&(state.musicIndex=(state.musicIndex+1)%state.slides.length,renderMusicFrame(state.musicIndex))},_fittedFrameMs()))}catch{}}function _ensureAudioRefitHook(){try{const a=document.getElementById("watch-audio-preview");if(!a||a.__cssosSlideshowRefitHooked)return;a.__cssosSlideshowRefitHooked=!0,a.addEventListener("loadedmetadata",_refitActiveTimers),a.addEventListener("durationchange",_refitActiveTimers)}catch{}}function musicHosts(){const a=document.getElementById("watch-music-art"),d=document.getElementById("watch-music-disc");return[a,d].filter(Boolean)}function startMusic(){const hosts=musicHosts();hosts.length&&(state.musicActive||(hosts.forEach(h=>h.classList.add("cssmv-slideshow-host")),state.musicActive=!0,state.musicIndex=state.slides.length?Math.floor(Math.random()*state.slides.length):0,state.slides.length&&renderMusicFrame(state.musicIndex),_ensureAudioRefitHook(),state.musicTimer=setInterval(()=>{state.slides.length&&_slideshowVisible(musicHosts()[0])&&(state.musicIndex=(state.musicIndex+1)%state.slides.length,renderMusicFrame(state.musicIndex))},_fittedFrameMs())))}function stopMusic(){state.musicTimer&&(clearInterval(state.musicTimer),state.musicTimer=null),state.musicActive=!1,musicHosts().forEach(host=>{host.querySelectorAll(".cssmv-cover-slide").forEach(el=>el.remove()),host.classList.remove("cssmv-slideshow-host")})}function renderMusicFrame(idx){const hosts=musicHosts();if(!hosts.length||!state.slides.length)return;const url=state.slides[idx%state.slides.length];if(!url)return;hosts.forEach(h=>injectSlide(h,url));const stage=document.getElementById("watch-music-stage");if(stage){const cssUrl=`url("${url.replace(/"/g,'\\"')}")`;stage.style.setProperty("--watch-music-art-image",cssUrl),stage.style.setProperty("--watch-music-backdrop-image",cssUrl)}}let __kbCounter=0;const focalCache=new Map,FOCAL_DEFAULT={x:50,y:38};function _focalClamp(v,lo,hi){return Math.max(lo,Math.min(hi,v))}async function _detectFocalPoint(url){if(focalCache.has(url))return focalCache.get(url);try{if(new URL(url,location.href).origin!==location.origin)return focalCache.set(url,FOCAL_DEFAULT),FOCAL_DEFAULT}catch{}let img;try{img=new Image,img.crossOrigin="anonymous",await new Promise((res,rej)=>{img.onload=res,img.onerror=rej,img.src=url})}catch{return focalCache.set(url,FOCAL_DEFAULT),FOCAL_DEFAULT}if(typeof FaceDetector<"u")try{const faces=await new FaceDetector({maxDetectedFaces:1,fastMode:!0}).detect(img);if(faces.length>0){const b=faces[0].boundingBox,x=_focalClamp(Math.round((b.x+b.width*.5)/img.naturalWidth*100),10,90),y=_focalClamp(Math.round((b.y+b.height*.4)/img.naturalHeight*100),10,85),result={x,y};return focalCache.set(url,result),result}}catch{}try{const canvas=document.createElement("canvas");canvas.width=32,canvas.height=32;const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,32,32);const{data}=ctx.getImageData(0,0,32,32);let sumL=0,sumS=0;const N=1024;for(let i=0;i<N*4;i+=4){const r=data[i],g=data[i+1],b=data[i+2];sumL+=(.299*r+.587*g+.114*b)/255,sumS+=(Math.max(r,g,b)-Math.min(r,g,b))/255}const meanL=sumL/N,meanS=sumS/N;let maxSal=-1,bx=4,by=4;for(let gy=0;gy<8;gy++)for(let gx=0;gx<8;gx++){let cL=0,cS=0;for(let py=0;py<4;py++)for(let px=0;px<4;px++){const i=((gy*4+py)*32+(gx*4+px))*4,r=data[i],g=data[i+1],b=data[i+2];cL+=(.299*r+.587*g+.114*b)/255,cS+=(Math.max(r,g,b)-Math.min(r,g,b))/255}cL/=16,cS/=16;const contrast=Math.abs(cL-meanL)*.6+Math.abs(cS-meanS)*.4,cx=7/2,cy=7/2,dist=Math.sqrt((gx-cx)**2+(gy-cy)**2)/(8*.7),sal=contrast+.08*Math.max(0,1-dist);sal>maxSal&&(maxSal=sal,bx=gx,by=gy)}const x=_focalClamp(Math.round((bx+.5)/8*100),5,95),y=_focalClamp(Math.round((by+.5)/8*100),5,95),result={x,y};return focalCache.set(url,result),result}catch{}return focalCache.set(url,FOCAL_DEFAULT),FOCAL_DEFAULT}function _prefetchFocal(urls){for(const url of urls)focalCache.has(url)||_detectFocalPoint(url).catch(()=>{})}function injectSlide(host,url){host.querySelectorAll(".cssmv-cover-slide").forEach(el=>{try{el.remove()}catch{}});const next=document.createElement("div"),focal=focalCache.get(url)||null;let kbClass;focal?(kbClass=__kbCounter%2===0?"cssmv-kb-focal-out":"cssmv-kb-focal-in",next.style.transformOrigin=`${focal.x}% ${focal.y}%`):kbClass="cssmv-kb-"+__kbCounter%12,__kbCounter++,next.className="cssmv-cover-slide "+kbClass,next.style.backgroundImage=`url("${url.replace(/"/g,'\\"')}")`,host.appendChild(next),next.offsetWidth,next.classList.add("is-visible"),setTimeout(()=>{next.isConnected&&next.classList.contains("is-visible")&&(next.classList.remove("is-visible"),next.classList.add("is-fading-out"),setTimeout(()=>{try{next.remove()}catch{}},FADE_OUT_MS+200))},FADE_IN_MS+MAIN_MS)}document.addEventListener("DOMContentLoaded",wireVideoHandoff,{once:!0}),(document.readyState==="interactive"||document.readyState==="complete")&&void 0;function wireVideoHandoff(){}function _currentCoverUrl(){var cands=[];try{cands.push(globalThis.cssmvPipelineLastResult&&globalThis.cssmvPipelineLastResult.coverUrl)}catch{}try{cands.push(globalThis.currentPreviewCoverUrl)}catch{}try{cands.push(globalThis.currentWatchPreviewWork&&(globalThis.currentWatchPreviewWork.cover_image_url||globalThis.currentWatchPreviewWork.cover_image||globalThis.currentWatchPreviewWork.preview_image_url))}catch{}for(var i=0;i<cands.length;i++){var u=typeof cands[i]=="string"?cands[i].trim():"";if(u)return u}return""}function _watchVisible(){if(document.hidden)return!1;var wp=document.getElementById("watch-panel");return!!(wp&&!wp.classList.contains("hidden")&&wp.dataset.minimized!=="true")}function _videoShowingPicture(){var v=document.getElementById("watch-video");if(!v)return!1;var hasSrc=!!String(v.currentSrc||v.src||"").trim(),visible=!0;try{visible=getComputedStyle(v).opacity!=="0"&&v.style.opacity!=="0"}catch{}return hasSrc&&v.readyState>=2&&visible}setInterval(function(){try{if(document.hidden||!_watchVisible()||_videoShowingPicture())return;try{var _wv=document.getElementById("watch-video");_wv&&!String(_wv.currentSrc||_wv.src||"").trim()&&(_wv.style.opacity="0")}catch{}var cover=_currentCoverUrl();if(!cover)return;state.mvActive&&state.slides.length===1&&state.slides[0]===cover||globalThis.cssmvSetCoverSlides([cover]),startMv()}catch{}},1500)})(),(function(){"use strict";const SVG_NS="http://www.w3.org/2000/svg",STAGES=["lyrics","cover","music","video","subtitles","compose"];function panelRadiusPx(){var isApp=!1;try{isApp=document.documentElement.classList.contains("cssos-app")}catch{}if(!isApp)return 24;try{var v=parseFloat(localStorage.getItem("cssos_mv_corner_radius"));if(isFinite(v)&&v>=0&&v<=200)return v}catch{}try{var ua=navigator.userAgent||"",isIPad=/iPad/i.test(ua)||/Macintosh/i.test(ua)&&(navigator.maxTouchPoints||0)>1;if(/Android/i.test(ua)||isIPad)return 20;if(/iPhone|iPod/i.test(ua))return 40;var minSide=Math.min(window.innerWidth||0,window.innerHeight||0);return minSide>=768?20:40}catch{}return 40}const TRAIL_STROKE_PX=5,HUE_OFFSETS=[0,36,90,180,270,360],STOP_OFFSETS=[0,.22,.44,.66,.88,1],STOP_LIGHT=[62,60,58,58,60,62],STOP_SATURATION=92,ROTATION_MS=5e3,STAGE_HUE={cover:320,lyrics:145,music:210,video:290,subtitles:36,compose:0},HUE_FLOW_MS=1800,TRAIL_TRANSITION_MS_RENDER=380,FADE_MS=600,END_BURST_MS=820,state={wired:!1,panel:null,svg:null,trail:null,gradientId:"",gradientStops:[],perimeter:0,mode:"idle",timeSource:null,rafId:0,resizeObserver:null,endBurstTimer:0,perStage:{},done:{},rotationIndex:0,rotationTimer:0};STAGES.forEach(k=>{state.perStage[k]=0,state.done[k]=!1}),ensureStyles(),document.addEventListener("DOMContentLoaded",wireWhenReady,{once:!0}),(document.readyState==="interactive"||document.readyState==="complete")&&wireWhenReady();function ensureStyles(){if(document.getElementById("cssmv-border-single-styles"))return;const st=document.createElement("style");st.id="cssmv-border-single-styles",st.textContent=`
.cssmv-border-bar {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  /* Sit above the panel's own .panel-active::before border-flow layer
     (z-index: 2) so the bar reads on top. */
  z-index: 3;
  opacity: 0;
  transition: opacity ${FADE_MS}ms ease-in-out;
}
.cssmv-border-bar.is-active { opacity: 1; }
.cssmv-border-bar.is-fading { opacity: 0; }
/* CSSOS_WAVE_372 20260523 — Jing「进度条钉到屏幕边」: App 全屏里把这条边框进度环
   从【面板坐标系】解放到【视口坐标系】—— position:fixed + 挂到 document.body(避开
   面板的 transform 把 fixed 困住), inset:0 即真·屏幕四边. 不再追求"面板边=屏幕边",
   直接沿屏幕走. z 抬到媒体(10060)之上、卡拉OK(10070)之下. */
html.cssos-app .cssmv-border-bar.is-viewport {
  position: fixed;
  inset: 0;
  z-index: 10065;
}

.cssmv-trail {
  fill: none;
  stroke-width: ${TRAIL_STROKE_PX};
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  /* Drop-shadow glow — the seed hue is overwritten per-stage via a
     CSS custom property so the glow tints with the active stage. */
  filter: drop-shadow(0 0 8px hsl(var(--cssmv-bar-hue, 210), 92%, 62%));
  transition: stroke-dasharray ${TRAIL_TRANSITION_MS_RENDER}ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* During playback the bar must stay pixel-synced with currentTime, so we
   skip the smoothing transition — timeupdate is the animation. */
.cssmv-border-bar.mode-playback .cssmv-trail {
  transition: none;
}

/* CSSOS_PHASE2_MV_END_BURST 20260420 — 820ms "flash-then-gone" finale. */
@keyframes cssmvBorderEndBurst {
  0% {
    filter: drop-shadow(0 0 8px hsl(var(--cssmv-bar-hue, 210), 92%, 62%)) brightness(1) saturate(1);
    transform: scale(1);
    opacity: 1;
  }
  35% {
    filter: drop-shadow(0 0 22px hsl(55, 100%, 72%)) brightness(2.4) saturate(1.6);
    transform: scale(1.06);
    opacity: 1;
  }
  70% {
    filter: drop-shadow(0 0 16px hsl(300, 100%, 68%)) brightness(1.9) saturate(1.4);
    transform: scale(1.10);
    opacity: 0.85;
  }
  100% {
    filter: drop-shadow(0 0 4px hsl(var(--cssmv-bar-hue, 210), 92%, 62%)) brightness(1) saturate(1);
    transform: scale(1.12);
    opacity: 0;
  }
}

.cssmv-border-bar.is-end-burst .cssmv-trail {
  animation: cssmvBorderEndBurst 820ms cubic-bezier(0.2, 0.6, 0.2, 1) forwards;
  transition: none;
}

/* CSSOS_PHASE2_BORDER_WAITING_DOT_REMOVED 20260420 — Jing:
   "之前我说的输出未开始时，显示一个点随机颜色呼吸，现在你放在了媒体框
    上边框中间，太惹眼，请删除掉。"
   Kill the waiting-dot entirely. Keep the <circle> element in the DOM
   (removing it would require DOM surgery mid-render) but force-hide it
   and disable its animations/opacity under any state. */
.cssmv-border-dot,
.cssmv-border-bar.is-waiting .cssmv-border-dot {
  display: none !important;
  opacity: 0 !important;
  animation: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
/* When the ring is in the "waiting" state (pre-start, pct=0), show nothing
   at all — no ring, no dot. The panel stays quiet until output actually
   starts. */
.cssmv-border-bar.is-waiting .cssmv-trail {
  stroke-dasharray: 0 99999 !important;
  opacity: 0 !important;
}
@keyframes cssmvBorderDotPulse {
  0%, 100% { transform: scale(0.85); }
  50%      { transform: scale(1.25); }
}
@keyframes cssmvBorderDotHue {
  0%   { fill: hsl(0,   92%, 62%); filter: drop-shadow(0 0 10px hsl(0,   92%, 62%)); }
  16%  { fill: hsl(60,  92%, 62%); filter: drop-shadow(0 0 10px hsl(60,  92%, 62%)); }
  33%  { fill: hsl(120, 92%, 62%); filter: drop-shadow(0 0 10px hsl(120, 92%, 62%)); }
  50%  { fill: hsl(180, 92%, 62%); filter: drop-shadow(0 0 10px hsl(180, 92%, 62%)); }
  66%  { fill: hsl(240, 92%, 62%); filter: drop-shadow(0 0 10px hsl(240, 92%, 62%)); }
  83%  { fill: hsl(300, 92%, 62%); filter: drop-shadow(0 0 10px hsl(300, 92%, 62%)); }
  100% { fill: hsl(360, 92%, 62%); filter: drop-shadow(0 0 10px hsl(360, 92%, 62%)); }
}

/* CSSOS_PHASE2_BORDER_DONE_STATIC 20260420 — Jing: when a stage finishes
   (done=true) the ring should persist as a closed loop but stop flashing
   and stop the random-color wave. Swap the gradient stroke for a solid
   stage-seed HSL color (set from JS) and cancel any transition. */
.cssmv-border-bar.is-done-static .cssmv-trail {
  transition: none !important;
  filter: drop-shadow(0 0 6px hsl(var(--cssmv-bar-hue, 210), 82%, 58%));
}
/* CSSOS_WAVE_386 — desktop ⛶ true-fullscreen toggle (web only). */
.cssmv-fs-btn {
  position: absolute;
  top: 12px;
  right: 60px;
  z-index: 30;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.22);
  background: rgba(8,18,16,0.42);
  color: rgba(255,255,255,0.92);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  opacity: 0;
  transition: opacity 0.18s ease;
  pointer-events: auto;
}
.watch-screen:hover .cssmv-fs-btn,
.cssmv-fs-btn:focus-visible { opacity: 1; }
/* When the watch panel is the browser-fullscreen element, fill the whole
   screen with a black cinema mat; the media letterboxes inside (ultrawide
   → top/bottom black bars are expected). The ring (is-viewport) traces the
   real screen edge from inside the fullscreened panel. */
#watch-panel:fullscreen,
#watch-panel:-webkit-full-screen {
  width: 100vw !important;
  height: 100vh !important;
  max-width: none !important;
  max-height: none !important;
  inset: 0 !important;
  border-radius: 0 !important;
  background: #000 !important;
}
#watch-panel:fullscreen .watch-screen,
#watch-panel:-webkit-full-screen .watch-screen {
  position: absolute !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  border-radius: 0 !important;
  background: #000 !important;
}
#watch-panel:fullscreen .cssmv-fs-btn { opacity: 0.6; }
`,document.head.appendChild(st)}function wireWhenReady(){if(state.wired)return;const panel=document.getElementById("watch-panel");if(!panel)return;const legacyLine=document.getElementById("watch-panel-progress-line");legacyLine&&(legacyLine.hidden=!0);const svg=document.createElementNS(SVG_NS,"svg");svg.classList.add("cssmv-border-bar"),svg.setAttribute("aria-hidden","true"),svg.setAttribute("preserveAspectRatio","none");const defs=document.createElementNS(SVG_NS,"defs"),gradientId=`cssmv-wave-${Math.random().toString(36).slice(2,8)}`,lg=document.createElementNS(SVG_NS,"linearGradient");lg.setAttribute("id",gradientId),lg.setAttribute("gradientUnits","userSpaceOnUse");const PERIOD_PX_X=520,PERIOD_PX_Y=310;lg.setAttribute("x1","0"),lg.setAttribute("y1","0"),lg.setAttribute("x2",String(PERIOD_PX_X)),lg.setAttribute("y2",String(PERIOD_PX_Y)),lg.setAttribute("spreadMethod","repeat");const stops=[];for(let i=0;i<STOP_OFFSETS.length;i+=1){const stop=document.createElementNS(SVG_NS,"stop");stop.setAttribute("offset",String(STOP_OFFSETS[i])),stop.setAttribute("stop-color",`hsl(0, ${STOP_SATURATION}%, ${STOP_LIGHT[i]}%)`),lg.appendChild(stop),stops.push(stop)}state.gradientStops=stops;const anim=document.createElementNS(SVG_NS,"animateTransform");anim.setAttribute("attributeName","gradientTransform"),anim.setAttribute("type","translate"),anim.setAttribute("from","0 0"),anim.setAttribute("to",`${PERIOD_PX_X} ${PERIOD_PX_Y}`),anim.setAttribute("dur",`${HUE_FLOW_MS}ms`),anim.setAttribute("repeatCount","indefinite"),anim.setAttribute("additive","replace"),lg.appendChild(anim),defs.appendChild(lg),svg.appendChild(defs);const trail=document.createElementNS(SVG_NS,"rect");trail.classList.add("cssmv-trail"),trail.setAttribute("fill","none"),trail.setAttribute("stroke",`url(#${gradientId})`),trail.setAttribute("stroke-dasharray","0 99999"),svg.appendChild(trail);const dot=document.createElementNS(SVG_NS,"circle");dot.classList.add("cssmv-border-dot"),dot.setAttribute("r",String(TRAIL_STROKE_PX*1.4)),svg.appendChild(dot),state.panel=panel,state.svg=svg,state.trail=trail,state.dot=dot,state.gradientId=gradientId,state.wired=!0,attachSvgForMode(),applyStageHue(STAGE_HUE[STAGES[0]]);const ro=new ResizeObserver(()=>{resize(),render()});ro.observe(panel),state.resizeObserver=ro;const onVp=()=>{resize(),render()};window.addEventListener("resize",onVp,{passive:!0}),window.addEventListener("orientationchange",onVp,{passive:!0}),state._vpResize=onVp;const onFs=()=>{attachSvgForMode(),resize(),render()};document.addEventListener("fullscreenchange",onFs),document.addEventListener("webkitfullscreenchange",onFs),state._fsHandler=onFs,ensureFullscreenButton(panel),resize(),render(),wireMediaSources()}function fullscreenElementSafe(){return document.fullscreenElement||document.webkitFullscreenElement||null}function isViewportMode(){if(document.documentElement.classList.contains("cssos-app"))return!0;const fsEl=fullscreenElementSafe();return!fsEl||!state.panel?!1:fsEl===state.panel||fsEl.contains(state.panel)||state.panel.contains(fsEl)}function attachSvgForMode(){if(!state.svg)return;const vp=isViewportMode();if(state.viewport=vp,vp){state.svg.classList.add("is-viewport");const fsEl=fullscreenElementSafe();let host=document.body;fsEl&&(host=state.panel&&fsEl.contains(state.panel)?state.panel:fsEl),state.svg.parentNode!==host&&host.appendChild(state.svg)}else state.svg.classList.remove("is-viewport"),state.panel&&state.svg.parentNode!==state.panel&&state.panel.appendChild(state.svg)}function toggleDesktopFullscreen(panel){try{if(fullscreenElementSafe()){(document.exitFullscreen||document.webkitExitFullscreen||function(){}).call(document);return}const req=panel.requestFullscreen||panel.webkitRequestFullscreen;if(req){const r=req.call(panel,{navigationUI:"hide"});r&&typeof r.catch=="function"&&r.catch(function(){})}}catch{}}function ensureFullscreenButton(panel){try{panel.querySelectorAll&&panel.querySelectorAll(".cssmv-fs-btn").forEach(function(b){b.remove()})}catch{}}function applyStageHue(seedHue){if(!state.gradientStops.length)return;const seed=((Number(seedHue)||0)%360+360)%360;for(let i=0;i<state.gradientStops.length;i+=1){const hue=(seed+HUE_OFFSETS[i])%360;state.gradientStops[i].setAttribute("stop-color",`hsl(${hue}, ${STOP_SATURATION}%, ${STOP_LIGHT[i]}%)`)}state.svg&&state.svg.style.setProperty("--cssmv-bar-hue",String(seed))}function safeTopPx(){if(!state.viewport)return 0;try{const p=document.createElement("div");p.style.cssText="position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none;",document.body.appendChild(p);const v=p.getBoundingClientRect().height||0;return p.remove(),Math.max(0,Math.round(v))}catch{return 0}}function computeGeometry(){const w=state.viewport?window.innerWidth:state.panel.clientWidth,h=state.viewport?window.innerHeight:state.panel.clientHeight;if(!w||!h)return null;const inset=TRAIL_STROKE_PX/2,topPad=0,top=inset+topPad,rw=Math.max(0,w-TRAIL_STROKE_PX),rh=Math.max(0,h-TRAIL_STROKE_PX-topPad),rx=Math.max(0,panelRadiusPx()-inset),perimeter=2*(rw+rh)-2*rx*(4-Math.PI);return{w,h,inset,top,rw,rh,rx,perimeter}}function resize(){if(!state.wired||!state.panel||!state.svg)return;const g=computeGeometry();g&&(state.perimeter=g.perimeter,state.svg.setAttribute("viewBox",`0 0 ${g.w} ${g.h}`),state.trail.setAttribute("x",g.inset),state.trail.setAttribute("y",g.top),state.trail.setAttribute("width",g.rw),state.trail.setAttribute("height",g.rh),state.trail.setAttribute("rx",g.rx),state.trail.setAttribute("ry",g.rx),state.dot&&(state.dot.setAttribute("cx",String(g.w/2)),state.dot.setAttribute("cy",String(g.top))))}function computeRenderCurrentPct(){const key=STAGES[state.rotationIndex%STAGES.length];if(state.done[key])return 100;const raw=Number(state.perStage[key]||0);return Math.max(0,Math.min(100,raw))}function computeCurrentPct(){if(state.mode==="playback"&&state.timeSource){const el=state.timeSource,d=Number(el.duration),t=Number(el.currentTime||0);return!isFinite(d)||d<=0?0:Math.max(0,Math.min(100,t/d*100))}return state.mode==="render"?computeRenderCurrentPct():0}function render(){if(!state.wired||!state.perimeter)return;const key=STAGES[state.rotationIndex%STAGES.length],isDone=!!state.done[key],pct=computeCurrentPct(),isWaiting=state.mode==="render"&&!isDone&&pct===0;if(state.svg.classList.toggle("mode-playback",state.mode==="playback"),state.svg.classList.toggle("is-waiting",isWaiting),state.svg.classList.toggle("is-done-static",state.mode==="render"&&isDone),isWaiting){state.trail.setAttribute("stroke-dasharray","0 99999");return}if(state.mode==="render"&&isDone){const hue=((Number(STAGE_HUE[key])||0)%360+360)%360;state.trail.setAttribute("stroke",`hsl(${hue}, ${STOP_SATURATION}%, 58%)`)}else state.trail.getAttribute("stroke")!==`url(#${state.gradientId})`&&state.trail.setAttribute("stroke",`url(#${state.gradientId})`);const visibleLen=pct/100*state.perimeter,rest=Math.max(0,state.perimeter-visibleLen);state.trail.setAttribute("stroke-dasharray",`${visibleLen} ${rest}`)}function advanceRotation(){state.rotationIndex=(state.rotationIndex+1)%STAGES.length;const key=STAGES[state.rotationIndex];applyStageHue(STAGE_HUE[key]),render()}function startRotation(){if(state.rotationTimer)return;const key=STAGES[state.rotationIndex%STAGES.length];applyStageHue(STAGE_HUE[key]),render(),state.rotationTimer=setInterval(advanceRotation,ROTATION_MS)}function stopRotation(){state.rotationTimer&&(clearInterval(state.rotationTimer),state.rotationTimer=0)}function startPlaybackLoop(){stopPlaybackLoop();const tick=()=>{if(state.mode!=="playback"||!state.timeSource){state.rafId=0;return}try{var _wp=document.getElementById("watch-panel");!(_wp&&_wp.classList.contains("hidden"))&&!document.hidden&&render()}catch{render()}state.rafId=requestAnimationFrame(tick)};state.rafId=requestAnimationFrame(tick)}function stopPlaybackLoop(){state.rafId&&(cancelAnimationFrame(state.rafId),state.rafId=0)}function wireMediaSources(){const video=document.getElementById("watch-video"),audio=document.getElementById("watch-audio-preview");[video,audio].forEach(el=>{if(!el)return;const onPlay=()=>{state.mode="playback",state.timeSource=el,cancelEndBurst(),show(),startRotation(),render(),el.paused||startPlaybackLoop()},onPause=()=>{state.timeSource===el&&(render(),stopPlaybackLoop())},onEnded=()=>{state.timeSource===el&&(stopPlaybackLoop(),state.perimeter>0&&state.trail.setAttribute("stroke-dasharray",`${state.perimeter} 0`),triggerEndBurst())};el.addEventListener("play",onPlay),el.addEventListener("playing",onPlay),el.addEventListener("timeupdate",()=>{state.mode==="playback"&&state.timeSource===el&&render()}),el.addEventListener("pause",onPause),el.addEventListener("ended",onEnded),el.addEventListener("seeking",()=>{state.mode==="playback"&&state.timeSource===el&&render()}),el.addEventListener("seeked",()=>{state.mode==="playback"&&state.timeSource===el&&render()})})}function triggerEndBurst(){!state.wired||!state.svg||(cancelEndBurst(),state.svg.classList.remove("is-end-burst"),state.svg.getBoundingClientRect(),state.svg.classList.add("is-end-burst"),state.endBurstTimer=setTimeout(()=>{state.endBurstTimer=0,!(!state.wired||!state.svg)&&(state.svg.classList.remove("is-end-burst"),hide(),state.mode="idle",state.timeSource=null)},END_BURST_MS+40))}function cancelEndBurst(){state.endBurstTimer&&(clearTimeout(state.endBurstTimer),state.endBurstTimer=0),state.svg&&state.svg.classList.remove("is-end-burst")}function show(){state.wired&&(state.svg.classList.remove("is-fading"),state.svg.classList.add("is-active"),state.mode==="render"&&startRotation())}function hide(){state.wired&&(state.svg.classList.remove("is-active"),state.svg.classList.add("is-fading"),stopPlaybackLoop(),stopRotation())}function reset(){state.wired&&(STAGES.forEach(k=>{state.perStage[k]=0,state.done[k]=!1}),state.mode="idle",state.timeSource=null,state.rotationIndex=0,stopRotation(),stopPlaybackLoop(),state.svg.classList.remove("is-fading"),state.svg.classList.remove("is-waiting"),state.svg.classList.remove("is-done-static"),state.trail&&state.trail.setAttribute("stroke",`url(#${state.gradientId})`),applyStageHue(STAGE_HUE[STAGES[0]]),render())}function setProgress(stageKey,pct){if(!state.wired||!STAGES.includes(stageKey)||state.mode==="playback")return;const firstRenderCall=state.mode!=="render";state.mode="render",state.perStage[stageKey]=Math.max(0,Math.min(100,Number(pct)||0)),show(),firstRenderCall&&startRotation(),render()}function setDone(stageKey){if(!state.wired||!STAGES.includes(stageKey)||state.mode==="playback")return;const firstRenderCall=state.mode!=="render";state.mode="render",state.done[stageKey]=!0,state.perStage[stageKey]=100,show(),firstRenderCall&&startRotation(),render()}globalThis.cssmvStageBarsShow=show,globalThis.cssmvStageBarsHide=hide,globalThis.cssmvStageBarsReset=reset,globalThis.cssmvStageBarsSetProgress=setProgress,globalThis.cssmvStageBarsSetDone=setDone,globalThis.cssmvStageBarsStageList=()=>STAGES.slice()})(),(function(){"use strict";const SVG_NS="http://www.w3.org/2000/svg",PERIMETER=2*Math.PI*94,TIME_TEXT_RADIUS=94+10*.55,TIME_TEXT_SIZE=9.2,GRADIENT_HUE_COUNT=7,HUE_FLOW_MS=4200,FADE_MS=260,END_BURST_MS=820,UID=Math.random().toString(36).slice(2,8);function injectStyles(){if(document.getElementById("cssos-music-ring-style"))return;const style=document.createElement("style");style.id="cssos-music-ring-style",style.textContent=`
.watch-music-ring.has-cssmv-music-ring {
  background: transparent !important;
}
.watch-music-ring.has-cssmv-music-ring::before {
  display: none !important;
}

.cssmv-music-ring-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  opacity: 0;
  transition: opacity ${FADE_MS}ms ease-in-out;
}
.cssmv-music-ring-overlay.is-visible {
  opacity: 1;
}
.cssmv-music-ring-overlay > svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.cssmv-music-ring-trail {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
  transform-origin: 100px 100px;
  transform: rotate(-90deg);
  filter: drop-shadow(0 0 8px hsl(210, 92%, 62%));
  transition: stroke-dasharray 280ms cubic-bezier(0.4, 0, 0.2, 1);
}
.cssmv-music-ring-overlay.is-playback .cssmv-music-ring-trail {
  transition: none;
}

.cssmv-music-ring-time {
  font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace;
  font-size: ${TIME_TEXT_SIZE}px;
  font-weight: 600;
  letter-spacing: 0.08em;
  fill: rgba(255, 255, 255, 0.92);
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.55);
  stroke-width: 0.8;
}

/* CSSOS_PHASE2_MV_FLASH_EXPLODE 20260420 — flash-explode burst applied to
 * trail + both text elements when playback ends. */
.cssmv-music-ring-overlay.is-end-burst .cssmv-music-ring-trail,
.cssmv-music-ring-overlay.is-end-burst .cssmv-music-ring-time {
  animation: cssmvMusicRingBurst ${END_BURST_MS}ms cubic-bezier(0.2, 0.8, 0.3, 1) 1 forwards;
}
@keyframes cssmvMusicRingBurst {
  0%   { filter: brightness(1)   saturate(1)   drop-shadow(0 0 8px hsl(210, 92%, 62%)); opacity: 1; transform-origin: 100px 100px; }
  25%  { filter: brightness(2.6) saturate(1.8) drop-shadow(0 0 22px hsl(60, 100%, 70%)); opacity: 1; }
  55%  { filter: brightness(1.9) saturate(1.4) drop-shadow(0 0 18px hsl(300, 90%, 70%));  opacity: 0.75; }
  100% { filter: brightness(1)   saturate(1)   drop-shadow(0 0 0 transparent);           opacity: 0; }
}
.cssmv-music-ring-overlay.is-end-burst .cssmv-music-ring-trail {
  transform: rotate(-90deg) scale(1.08);
}
`,document.head.appendChild(style)}function buildGradient(defs){const grad=document.createElementNS(SVG_NS,"linearGradient"),gid=`cssmv-music-rainbow-${UID}`;grad.setAttribute("id",gid),grad.setAttribute("gradientUnits","userSpaceOnUse");const PERIOD=200/2;grad.setAttribute("x1","0"),grad.setAttribute("y1","0"),grad.setAttribute("x2",String(PERIOD)),grad.setAttribute("y2",String(PERIOD)),grad.setAttribute("spreadMethod","repeat");for(let i=0;i<GRADIENT_HUE_COUNT;i++){const stop=document.createElementNS(SVG_NS,"stop"),offset=i/(GRADIENT_HUE_COUNT-1),hue=Math.round(i*360/(GRADIENT_HUE_COUNT-1));stop.setAttribute("offset",String(offset)),stop.setAttribute("stop-color",`hsl(${hue}, 92%, 60%)`),grad.appendChild(stop)}const anim=document.createElementNS(SVG_NS,"animateTransform");return anim.setAttribute("attributeName","gradientTransform"),anim.setAttribute("type","rotate"),anim.setAttribute("from","0 100 100"),anim.setAttribute("to","360 100 100"),anim.setAttribute("dur",`${HUE_FLOW_MS}ms`),anim.setAttribute("repeatCount","indefinite"),anim.setAttribute("additive","replace"),grad.appendChild(anim),defs.appendChild(grad),gid}function buildSharedTimePath(defs){const r=TIME_TEXT_RADIUS,path=document.createElementNS(SVG_NS,"path"),pid=`cssmv-music-timepath-shared-${UID}`;path.setAttribute("id",pid),path.setAttribute("fill","none"),path.setAttribute("stroke","none");const top={x:100,y:100-r},bottom={x:100,y:100+r};return path.setAttribute("d",`M ${top.x} ${top.y.toFixed(3)} A ${r} ${r} 0 1 1 ${bottom.x} ${bottom.y.toFixed(3)} A ${r} ${r} 0 1 1 ${top.x} ${top.y.toFixed(3)}`),defs.appendChild(path),pid}function buildSvg(){const svg=document.createElementNS(SVG_NS,"svg");svg.setAttribute("viewBox","0 0 200 200"),svg.setAttribute("preserveAspectRatio","xMidYMid meet"),svg.setAttribute("aria-hidden","true");const defs=document.createElementNS(SVG_NS,"defs"),gid=buildGradient(defs),pidShared=buildSharedTimePath(defs);svg.appendChild(defs);const circle=document.createElementNS(SVG_NS,"circle");circle.setAttribute("class","cssmv-music-ring-trail"),circle.setAttribute("cx",String(100)),circle.setAttribute("cy",String(100)),circle.setAttribute("r",String(94)),circle.setAttribute("stroke",`url(#${gid})`),circle.setAttribute("stroke-dasharray",`0 ${PERIMETER}`),circle.setAttribute("vector-effect","non-scaling-stroke"),svg.appendChild(circle);const mkText=(pid,initialOffsetPct,extraClass)=>{const text=document.createElementNS(SVG_NS,"text");text.setAttribute("class","cssmv-music-ring-time"+(extraClass?" "+extraClass:"")),text.setAttribute("dy","3.2");const tp=document.createElementNS(SVG_NS,"textPath");return tp.setAttribute("href",`#${pid}`),tp.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",`#${pid}`),tp.setAttribute("startOffset",initialOffsetPct+"%"),tp.setAttribute("text-anchor","middle"),tp.textContent="0:00",text.appendChild(tp),{text,tp}},dur=mkText(pidShared,0,"is-total"),cur=mkText(pidShared,0,"is-current");return svg.appendChild(dur.text),svg.appendChild(cur.text),{svg,trail:circle,curText:cur.tp,durText:dur.tp}}const state={wired:!1,ring:null,overlay:null,trail:null,curText:null,durText:null,audio:null,rafId:0,playing:!1,burstTimer:0};function fmtTime(sec){(!Number.isFinite(sec)||sec<0)&&(sec=0);const total=Math.floor(sec),m=Math.floor(total/60),s=total%60;return`${m}:${s.toString().padStart(2,"0")}`}function computePct(){const a=state.audio;if(!a)return 0;const d=a.duration,t=a.currentTime;return!Number.isFinite(d)||d<=0?0:Math.max(0,Math.min(100,t/d*100))}function render(){if(!state.trail)return;const pct=computePct(),visible=pct/100*PERIMETER,rest=Math.max(0,PERIMETER-visible);pct>=99.98?(state.trail.setAttribute("stroke-dasharray",`${PERIMETER} 0`),state.trail.style.opacity="1"):pct<.05?(state.trail.setAttribute("stroke-dasharray",`0 ${PERIMETER}`),state.trail.style.opacity="0"):(state.trail.setAttribute("stroke-dasharray",`${visible.toFixed(3)} ${rest.toFixed(3)}`),state.trail.style.opacity="1");const a=state.audio;state.curText&&(state.curText.textContent=fmtTime(a?a.currentTime:0),state.curText.setAttribute("startOffset",pct.toFixed(3)+"%")),state.durText&&(state.durText.textContent=fmtTime(a&&Number.isFinite(a.duration)?a.duration:0),state.durText.setAttribute("startOffset","0%"))}function startLoop(){if(state.rafId)return;const tick=()=>{state.rafId=0,render(),state.playing&&(state.rafId=requestAnimationFrame(tick))};state.rafId=requestAnimationFrame(tick)}function stopLoop(){state.rafId&&(cancelAnimationFrame(state.rafId),state.rafId=0)}function triggerEndBurst(){state.overlay&&(state.trail&&(state.trail.setAttribute("stroke-dasharray",`${PERIMETER} 0`),state.trail.style.opacity="1"),state.curText&&state.curText.setAttribute("startOffset","0%"),state.overlay.classList.remove("is-end-burst"),state.overlay.offsetWidth,state.overlay.classList.add("is-end-burst"),state.burstTimer&&clearTimeout(state.burstTimer),state.burstTimer=setTimeout(()=>{state.burstTimer=0,state.overlay.classList.remove("is-end-burst"),state.overlay.classList.remove("is-visible"),state.trail&&(state.trail.setAttribute("stroke-dasharray",`0 ${PERIMETER}`),state.trail.style.opacity="0"),state.curText&&state.curText.setAttribute("startOffset","0%")},END_BURST_MS+40))}function wireAudio(){if(!state.audio||state.audio.__cssmvMusicRingWired)return;state.audio.__cssmvMusicRingWired=!0;const onPlay=()=>{state.playing=!0,state.overlay&&(state.overlay.classList.add("is-playback"),state.overlay.classList.remove("is-end-burst"),state.overlay.classList.add("is-visible")),state.burstTimer&&(clearTimeout(state.burstTimer),state.burstTimer=0),show(),startLoop()},onPause=()=>{state.playing=!1,state.overlay&&state.overlay.classList.remove("is-playback"),render(),stopLoop()},onEnded=()=>{state.playing=!1,state.overlay&&state.overlay.classList.remove("is-playback"),stopLoop(),triggerEndBurst()},onTime=()=>{render()},onMeta=()=>{render()};state.audio.addEventListener("play",onPlay),state.audio.addEventListener("playing",onPlay),state.audio.addEventListener("pause",onPause),state.audio.addEventListener("ended",onEnded),state.audio.addEventListener("timeupdate",onTime),state.audio.addEventListener("seeking",onTime),state.audio.addEventListener("seeked",onTime),state.audio.addEventListener("durationchange",onMeta),state.audio.addEventListener("loadedmetadata",onMeta),state.audio.addEventListener("emptied",()=>{state.playing=!1,render()})}function show(){state.overlay&&state.overlay.classList.add("is-visible")}function hide(){state.overlay&&state.overlay.classList.remove("is-visible")}function reset(){state.playing=!1,state.overlay&&(state.overlay.classList.remove("is-playback"),state.overlay.classList.remove("is-end-burst")),state.trail&&state.trail.setAttribute("stroke-dasharray",`0 ${PERIMETER}`),state.curText&&(state.curText.textContent="0:00",state.curText.setAttribute("startOffset","0%")),state.durText&&(state.durText.textContent="0:00",state.durText.setAttribute("startOffset","0%")),stopLoop()}function init(){if(state.wired)return;const ring=document.getElementById("watch-music-ring");if(!ring)return;const audio=document.getElementById("watch-audio-preview");if(!audio)return;injectStyles();const overlay=document.createElement("div");overlay.className="cssmv-music-ring-overlay";const built=buildSvg();overlay.appendChild(built.svg),ring.appendChild(overlay),ring.classList.add("has-cssmv-music-ring"),state.wired=!0,state.ring=ring,state.overlay=overlay,state.trail=built.trail,state.curText=built.curText,state.durText=built.durText,state.audio=audio,wireAudio(),reset(),show()}window.cssmvMusicRingInit=init,window.cssmvMusicRingShow=show,window.cssmvMusicRingHide=hide,window.cssmvMusicRingReset=reset;function whenReady(fn){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",fn,{once:!0}):fn()}whenReady(()=>{init(),setTimeout(init,1e3),setTimeout(init,2500)})})(),(function(){"use strict";const CONFIG={BUTTON_IDLE_HIDE_MS:2500,END_GLOW_MS:1600,HUE_FLOW_MS:2400},VIDEO_ID="watch-video",AUDIO_ID="watch-audio-preview";function formatTimecode(secs){(!Number.isFinite(secs)||secs<0)&&(secs=0);const s=Math.floor(secs),mm=Math.floor(s/60),ss=s%60;if(mm<60)return`${mm}:${String(ss).padStart(2,"0")}`;const hh=Math.floor(mm/60),mRem=mm%60;return`${hh}:${String(mRem).padStart(2,"0")}:${String(ss).padStart(2,"0")}`}function ensureStyles(){if(document.getElementById("cssmv-media-chrome-styles"))return;const st=document.createElement("style");st.id="cssmv-media-chrome-styles",st.textContent=`
/* ===== MV media frame linear progress bar (flowing rainbow) =====
 *   CSSOS_PHASE2_MV_CHROME_CLEANUP 20260420
 *   Uses a scrolling rainbow gradient so the color "flows" (游动) rather
 *   than stepping discretely. Length of fill still tracks playback frac. */
.cssmv-mv-frame-progress {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 3px;
  pointer-events: none;
  z-index: 6;
  overflow: hidden;
  opacity: 0;
  transition: opacity 400ms ease;
}
.cssmv-mv-frame-progress.is-active { opacity: 1; }
.cssmv-mv-frame-progress-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0%;
  background: linear-gradient(90deg,
    hsl(0,  82%, 62%),
    hsl(45, 82%, 62%),
    hsl(90, 82%, 62%),
    hsl(160,82%, 62%),
    hsl(210,82%, 62%),
    hsl(280,82%, 62%),
    hsl(330,82%, 62%),
    hsl(0,  82%, 62%));
  background-size: 200% 100%;
  background-repeat: repeat-x;
  animation: cssmvMvFrameHueFlow ${CONFIG.HUE_FLOW_MS}ms linear infinite;
  box-shadow: 0 0 10px rgba(255,255,255,0.45);
  transition: width 0.18s linear;
}
@keyframes cssmvMvFrameHueFlow {
  0%   { background-position:   0% 50%; }
  100% { background-position: 200% 50%; }
}
/* CSSOS_PHASE2_MV_FLASH_EXPLODE 20260420 — flash-explode-fade on media end.
 * Shared keyframe used by MV frame bar + timecode + (wired separately by
 * app.watch-stage-bars and app.watch-music-ring for their own elements). */
.cssmv-mv-frame-progress.is-end-burst .cssmv-mv-frame-progress-fill,
.cssmv-mv-timecode.is-end-burst {
  animation: cssmvEndBurst 820ms cubic-bezier(0.2, 0.8, 0.3, 1) 1 forwards;
}
@keyframes cssmvEndBurst {
  0%   { filter: brightness(1)   saturate(1);   opacity: 1; transform: scale(1); }
  30%  { filter: brightness(2.4) saturate(1.6); opacity: 1; transform: scale(1.05); }
  60%  { filter: brightness(1.8) saturate(1.3); opacity: 0.85; transform: scale(1.08); }
  100% { filter: brightness(1)   saturate(1);   opacity: 0; transform: scale(1.12); }
}

/* ===== MV time-code overlay (total fixed at start, remaining trails playhead) ===== */
.cssmv-mv-timecode {
  position: absolute;
  left: 10px;
  bottom: 8px;
  z-index: 8;
  pointer-events: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 0 6px rgba(0, 0, 0, 0.8), 0 0 2px rgba(0, 0, 0, 0.9);
  mix-blend-mode: screen;
  opacity: 0;
  transition: opacity 400ms ease;
}
.cssmv-mv-timecode.is-active { opacity: 1; }
.cssmv-mv-timecode-total,
.cssmv-mv-timecode-remaining {
  position: absolute;
  left: 0;
  top: 0;
  white-space: nowrap;
}
.cssmv-mv-timecode-remaining {
  transition: transform 0.18s linear;
  color: rgba(255,255,255,0.98);
}
.cssmv-mv-timecode.is-ended .cssmv-mv-timecode-remaining {
  transform: translateX(0) !important;
}

/* ===== Hollow/镂空 play button override ===== */
#watch-overlay-play.cssmv-hollow,
#watch-music-play.cssmv-hollow {
  background: transparent !important;
  border: 2px solid currentColor !important;
  color: rgba(255,255,255,0.95);
  box-shadow: 0 0 12px rgba(255,255,255,0.25), inset 0 0 10px rgba(255,255,255,0.08);
  backdrop-filter: blur(2px);
  transition: opacity 400ms ease, transform 200ms ease;
}
#watch-overlay-play.cssmv-hollow:hover,
#watch-music-play.cssmv-hollow:hover {
  color: #fff;
  box-shadow: 0 0 18px rgba(255,255,255,0.45), inset 0 0 14px rgba(255,255,255,0.14);
  transform: scale(1.04);
}
#watch-overlay-play.cssmv-auto-hidden,
#watch-music-play.cssmv-auto-hidden {
  opacity: 0;
  pointer-events: none;
}

/* Remove audio element native UI since we're providing our own chrome. */
audio#watch-audio-preview.cssmv-headless {
  display: none !important;
}
audio#watch-audio-preview.cssmv-headless-visible {
  display: block;
  width: 1px; height: 1px;
  opacity: 0;
  pointer-events: none;
}

/* CSSOS_PHASE2_MV_BOTTOM_BAR_REMOVED 20260420 — Jing:
   "播放媒体时，进度条也有随机颜色流动，就像输出时那样，取消掉媒体框
    底部的播放时进度条，我们已经有了边框进度条，再来一条的话，太花眼了。"
   The border-ring from app.watch-stage-bars.js (MV) and the circular ring
   from app.watch-music-ring.js (Music) now handle playback progress in
   both modes. The 3px bottom linear bar + timecode pills are redundant
   chrome that crowds the frame. Force-hide them in every state so they
   never render, but leave the JS wiring in place to avoid a null-element
   cascade. */
.cssmv-mv-frame-progress,
.cssmv-mv-frame-progress.is-active,
.cssmv-mv-frame-progress.is-end-burst,
.cssmv-mv-frame-progress-fill,
.cssmv-mv-timecode,
.cssmv-mv-timecode.is-active,
.cssmv-mv-timecode.is-ended,
.cssmv-mv-timecode.is-end-burst,
.cssmv-mv-timecode-total,
.cssmv-mv-timecode-remaining {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
  animation: none !important;
}
`,document.head.appendChild(st)}function $id(id){return document.getElementById(id)}function ensureRelativePositioned(el){if(!el)return;getComputedStyle(el).position==="static"&&(el.style.position="relative")}let mvFrameProgress=null,mvTimecode=null,mvTimecodeTotalEl=null,mvTimecodeRemainingEl=null;function ensureMvFrameChrome(){const screen=document.querySelector(".watch-frame .watch-screen")||document.querySelector(".watch-frame");if(screen){if(ensureRelativePositioned(screen),!mvFrameProgress||!mvFrameProgress.isConnected){const bar=document.createElement("div");bar.className="cssmv-mv-frame-progress";const fill=document.createElement("div");fill.className="cssmv-mv-frame-progress-fill",bar.appendChild(fill),screen.appendChild(bar),mvFrameProgress=bar}if(!mvTimecode||!mvTimecode.isConnected){const tc=document.createElement("div");tc.className="cssmv-mv-timecode";const total=document.createElement("span");total.className="cssmv-mv-timecode-total",total.textContent="0:00";const rem=document.createElement("span");rem.className="cssmv-mv-timecode-remaining",rem.textContent="0:00",tc.appendChild(total),tc.appendChild(rem),screen.appendChild(tc),mvTimecode=tc,mvTimecodeTotalEl=total,mvTimecodeRemainingEl=rem}}}function setMvFrameProgress(frac,currentTime,duration){const pct=Math.max(0,Math.min(1,frac))*100,fill=mvFrameProgress?.querySelector(".cssmv-mv-frame-progress-fill");if(fill&&(fill.style.width=pct+"%"),mvTimecode){const total=Number.isFinite(duration)?duration:0,playhead=Number.isFinite(currentTime)?currentTime:0,remaining=Math.max(0,total-playhead);mvTimecodeTotalEl&&(mvTimecodeTotalEl.textContent=formatTimecode(total)),mvTimecodeRemainingEl&&(mvTimecodeRemainingEl.textContent=formatTimecode(remaining));const screen=mvTimecode.parentElement;if(screen){const w=screen.getBoundingClientRect().width,tx=Math.max(0,w-20*2)*(total>0?playhead/total:0);mvTimecodeRemainingEl&&(mvTimecodeRemainingEl.style.transform=`translateX(${tx.toFixed(1)}px)`)}}}function showMvFrameChrome(on){mvFrameProgress&&mvFrameProgress.classList.toggle("is-active",!!on),mvTimecode&&mvTimecode.classList.toggle("is-active",!!on)}function markMvEnded(ended){!mvTimecode||!mvFrameProgress||(mvTimecode.classList.toggle("is-ended",!!ended),ended?(mvFrameProgress.classList.add("is-end-burst"),mvTimecode.classList.add("is-end-burst"),setTimeout(()=>{mvFrameProgress?.classList.remove("is-end-burst","is-active"),mvTimecode?.classList.remove("is-end-burst","is-active");const fill=mvFrameProgress?.querySelector(".cssmv-mv-frame-progress-fill");fill&&(fill.style.width="0%")},900)):(mvFrameProgress.classList.remove("is-end-burst"),mvTimecode.classList.remove("is-end-burst")))}function applyHollowButtons(){const ov=$id("watch-overlay-play"),mp=$id("watch-music-play");[ov,mp].forEach(btn=>{btn&&btn.classList.add("cssmv-hollow")})}function removeNativeControls(){const audio=$id(AUDIO_ID);audio&&(audio.hasAttribute("controls")&&audio.removeAttribute("controls"),audio.controls=!1,audio.classList.add("cssmv-headless"));const video=$id(VIDEO_ID);if(video){video.hasAttribute("controls")&&video.removeAttribute("controls"),video.controls=!1;try{video.disablePictureInPicture=!1}catch{}try{video.disableRemotePlayback=!0}catch{}video.setAttribute("controlslist","nodownload noplaybackrate nofullscreen")}}let overlayIdleTimer=null,musicBtnIdleTimer=null;function resetIdleHide(which){const btn=$id(which==="mv"?"watch-overlay-play":"watch-music-play");if(!btn)return;btn.classList.remove("cssmv-auto-hidden"),which==="mv"&&overlayIdleTimer&&clearTimeout(overlayIdleTimer),which==="music"&&musicBtnIdleTimer&&clearTimeout(musicBtnIdleTimer);const t=setTimeout(()=>{const media=$id(which==="mv"?VIDEO_ID:AUDIO_ID);media&&!media.paused&&!media.ended&&btn.classList.add("cssmv-auto-hidden")},CONFIG.BUTTON_IDLE_HIDE_MS);which==="mv"?overlayIdleTimer=t:musicBtnIdleTimer=t}function wireAutoHide(){const video=$id(VIDEO_ID),audio=$id(AUDIO_ID),panel=$id("watch-panel"),wake=which=>()=>resetIdleHide(which);["mousemove","pointermove","pointerdown","touchstart","keydown"].forEach(evt=>{panel?.addEventListener(evt,wake("mv")),panel?.addEventListener(evt,wake("music"))}),video?.addEventListener("play",wake("mv")),video?.addEventListener("pause",()=>{$id("watch-overlay-play")?.classList.remove("cssmv-auto-hidden")}),audio?.addEventListener("play",wake("music")),audio?.addEventListener("pause",()=>{$id("watch-music-play")?.classList.remove("cssmv-auto-hidden")})}let pbRAF=null;function playbackLoop(){const video=$id(VIDEO_ID);if(video&&!video.paused&&!video.ended&&(video.duration||0)>0){const currentTime=video.currentTime||0,duration=video.duration||0,frac=duration>0?currentTime/duration:0;ensureMvFrameChrome(),showMvFrameChrome(!0),setMvFrameProgress(frac,currentTime,duration)}pbRAF=requestAnimationFrame(playbackLoop)}function startPlaybackLoop(){pbRAF==null&&(pbRAF=requestAnimationFrame(playbackLoop))}function wireEndHandlers(){const video=$id(VIDEO_ID);video?.addEventListener("ended",()=>{video.duration>0&&setMvFrameProgress(1,video.duration,video.duration),markMvEnded(!0),$id("watch-overlay-play")?.classList.remove("cssmv-auto-hidden")}),video?.addEventListener("play",()=>markMvEnded(!1)),video?.addEventListener("playing",()=>markMvEnded(!1))}function boot(){ensureStyles(),ensureMvFrameChrome(),applyHollowButtons(),removeNativeControls(),wireAutoHide(),wireEndHandlers(),startPlaybackLoop()}document.readyState==="complete"||document.readyState==="interactive"?setTimeout(boot,0):document.addEventListener("DOMContentLoaded",boot,{once:!0}),globalThis.cssmvRefreshMediaChrome=function(){ensureMvFrameChrome(),applyHollowButtons(),removeNativeControls()}})(),(function(){"use strict";const CONFIG={MV_TITLE_FONT_SIZE_RATIO:.072,MV_TITLE_MAX_WIDTH_RATIO:.88,MV_TITLE_MAX_LINES:1,MV_TITLE_LINE_HEIGHT:1.12,MV_TITLE_MIN_FONT_PX:13,MV_TITLE_MAX_FONT_PX:84,MV_TITLE_APPEAR_DELAY_MS:120,ENTRY_STAGGER_MS:52,ENTRY_DURATION_MS:720,ENTRY_RANDOMIZE_MOTIONS:!0,MOTIONS:["fall","drift-left","drift-right","typewriter","zoom-pop"],MAX_GLYPHS_STAGGER:120,AUTO_ROTATE_DEFAULT_MIN:2,AUTO_ROTATE_OPTIONS_MIN:[0,1,3,5,10,15,30,60],AUTO_ROTATE_STORAGE_KEY:"cssmv.watchFontAutoRotateMin",SCRIPT_POOLS_ENABLED_KEY:"cssmv.watchFontScriptPools",EMOTION_FONT_FOLLOW_KEY:"cssmv.watchEmotionFontFollow",STEM_STORAGE_KEY:"cssmv.stemPreference",STEM_DEFAULT:"vocals",PER_TOKEN_MODE_KEY:"cssmv.watchFontPerTokenMode",PER_TOKEN_MODE_DEFAULT:"word",PER_TOKEN_PRESET_KEY:"cssmv.watchFontPerTokenPreset",PER_TOKEN_PRESET_DEFAULT:"chaos",PER_TOKEN_SEED_KEY:"cssmv.watchFontPerTokenSeed"};function tr(en,zh){try{if(typeof globalThis.loginCopy=="function")return globalThis.loginCopy(en,zh)}catch{}return String(globalThis.currentLocale||"").toLowerCase().startsWith("zh")?zh:en}function toast(en,zh){try{typeof globalThis.showToast=="function"&&globalThis.showToast(tr(en,zh))}catch{}}const IDS={screen:"watch-panel",frame:null,styleShift:"watch-style-shift",subtitle:"watch-subtitle",karaoke:"watch-karaoke-line",audio:"watch-audio-preview",video:"watch-video"};function qFrame(){return document.querySelector("#watch-pane-mv .watch-screen")||document.querySelector(".watch-screen")||null}function ensureStyles(){if(document.getElementById("cssmv-watch-media-overlays-styles"))return;const st=document.createElement("style");st.id="cssmv-watch-media-overlays-styles",st.textContent=`
/* ---------- P2-28b MV Art Title ---------- */
.cssmv-mv-title {
  position: absolute;
  left: 50%;
  top: 8%;
  transform: translate(-50%, 0);
  max-width: ${CONFIG.MV_TITLE_MAX_WIDTH_RATIO*100}%;
  /* CSSOS_PHASE2_NO_TITLE_SAFE_ZONE 20260504 — Jing
     "媒体框就是'安全区'". Allow the title to occupy the full frame
     height; the only boundary is the frame itself. The auto-fit loop
     downstream still scales font-size to keep the title from
     overflowing the frame. */
  max-height: 100%;
  overflow: visible;
  text-align: center;
  font-family: var(--watch-title-font-family, "CSSTitleBoldC", "Syne", system-ui, sans-serif);
  font-weight: 800;
  line-height: ${CONFIG.MV_TITLE_LINE_HEIGHT};
  color: var(--cssmv-mv-title-color, rgba(255, 255, 255, 0.98));
  text-shadow:
    0 0 12px rgba(0, 0, 0, 0.55),
    0 0 24px color-mix(in srgb, var(--watch-frame-accent-1, #00f5a0) 45%, transparent),
    0 0 44px color-mix(in srgb, var(--watch-frame-accent-2, #0bf7ff) 28%, transparent);
  pointer-events: none;
  z-index: 6;
  opacity: 0;
  letter-spacing: 0.01em;
  /* CSSOS_WAVE_419 20260525 — Jing「真机游客视角:标题被拆词换行(Welcom/e、
     Jerusal/em)很丑」根因: overflow-wrap:anywhere 让浏览器把每个词拆成竖排碎片
     来填满宽度 → scrollWidth 永远不溢出 → 下面那个【按宽度收缩字号】的循环永远
     不触发, 于是字号巨大 + 词被拆碎竖排. 改成 normal: 拉丁词整词只在空格处换行,
     单词太宽时 scrollWidth 溢出 → 触发收缩循环把字号缩到整词刚好放下. CJK 仍按字
     换行(word-break:normal). 永不再拆词. */
  word-break: keep-all;
  overflow-wrap: normal;
  transition: opacity 0.36s ease-in-out;
  /* CSSOS_PHASE2_NO_TITLE_SAFE_ZONE 20260504 — drop the 4% inner
     padding; the anchor rule pins us to the frame edge directly. */
  padding: 0;
  /* CSSOS_WAVE_445 20260526 — Jing「标题不要掉行; 安全区=媒体框宽; 按框宽自动缩小」
     根因: 此前 white-space:normal + MAX_LINES:3 允许标题在词/字之间换行(JERU/SALE/M
     竖排碎片), 收缩循环只要塞进 3 行就停手, 字号没真正按【单行宽度】缩。改为
     white-space:nowrap → 整个标题强制单行(无论 per-word/per-char 包装), scrollWidth
     = 整行真实宽度 → 下面 fitMvTitleFontSize 以【媒体框宽】为唯一安全区, 把字号缩到
     刚好放进一行。彻底告别掉行。 */
  white-space: nowrap;
  /* No max-width safe-zone either — the media frame is the bound. */
  max-width: 100%;
}
.cssmv-mv-title.is-visible { opacity: 1; }
.cssmv-mv-title.is-hidden  { opacity: 0; }
/* P2-42: while video is playing, keep the title visible but quieter and
   pinned to the top — never fully hide. */
.cssmv-mv-title.is-visible.is-playing {
  opacity: 0.62;
  top: 5%;
  transform: translate(-50%, 0) scale(0.78);
  transform-origin: top center;
  text-shadow:
    0 0 10px rgba(0, 0, 0, 0.72),
    0 0 22px color-mix(in srgb, var(--watch-frame-accent-1, #00f5a0) 28%, transparent);
  transition: opacity 0.42s ease, transform 0.42s ease, top 0.42s ease;
}

/* ---------- P2-28c entry animations ---------- */
.cssmv-anim-glyph {
  display: inline-block;
  opacity: 0;
  will-change: transform, opacity, filter;
  animation-duration: ${CONFIG.ENTRY_DURATION_MS}ms;
  animation-timing-function: cubic-bezier(0.22, 1.12, 0.36, 1);
  animation-fill-mode: both;
}
.cssmv-anim-glyph.is-space { display: inline; }
/* CSSOS_WAVE_426 20260525 — Jing: word wrapper keeps a word's per-letter glyphs
   ATOMIC (never wrap mid-word like "Welco/me"); line breaks happen only between
   words (at the spaces). */
.cssmv-anim-word { display: inline-block; white-space: nowrap; vertical-align: baseline; }

@keyframes cssmvEntryFall {
  0%   { opacity: 0; transform: translateY(-1.1em) rotate(-8deg); filter: blur(4px); }
  60%  { opacity: 1; transform: translateY(0.08em) rotate(0); filter: blur(0); }
  100% { opacity: 1; transform: translateY(0) rotate(0); filter: blur(0); }
}
@keyframes cssmvEntryDriftLeft {
  0%   { opacity: 0; transform: translateX(-1em) translateY(-0.4em); filter: blur(3px); }
  70%  { opacity: 1; transform: translateX(0.04em) translateY(0); filter: blur(0); }
  100% { opacity: 1; transform: translateX(0) translateY(0); filter: blur(0); }
}
@keyframes cssmvEntryDriftRight {
  0%   { opacity: 0; transform: translateX(1em) translateY(-0.3em); filter: blur(3px); }
  70%  { opacity: 1; transform: translateX(-0.03em) translateY(0); filter: blur(0); }
  100% { opacity: 1; transform: translateX(0) translateY(0); filter: blur(0); }
}
@keyframes cssmvEntryTypewriter {
  0%   { opacity: 0; transform: translateY(0); }
  1%   { opacity: 1; }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes cssmvEntryZoomPop {
  0%   { opacity: 0; transform: scale(0.2); filter: blur(6px); }
  60%  { opacity: 1; transform: scale(1.08); filter: blur(0); }
  100% { opacity: 1; transform: scale(1); filter: blur(0); }
}
.cssmv-anim-fall         { animation-name: cssmvEntryFall; }
.cssmv-anim-drift-left   { animation-name: cssmvEntryDriftLeft; }
.cssmv-anim-drift-right  { animation-name: cssmvEntryDriftRight; }
.cssmv-anim-typewriter   { animation-name: cssmvEntryTypewriter; animation-duration: 40ms; animation-timing-function: steps(1, end); }
.cssmv-anim-zoom-pop     { animation-name: cssmvEntryZoomPop; }

/* ---------- P2-28d vocals/instrumental toggle button ---------- */
.cssmv-stem-toggle {
  position: absolute;
  top: 14px;
  right: 64px;              /* sits left of ✦ (which is right:14px, w:44) */
  z-index: 8;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 1px solid rgba(218, 255, 242, 0.28);
  background: linear-gradient(180deg, rgba(7, 14, 12, 0.42), rgba(5, 10, 9, 0.24));
  color: rgba(242, 255, 248, 0.98);
  font-size: 17px;
  box-shadow:
    0 0 24px rgba(0, 245, 160, 0.16),
    0 0 52px rgba(11, 247, 255, 0.08);
  backdrop-filter: blur(12px) saturate(1.08);
  -webkit-backdrop-filter: blur(12px) saturate(1.08);
  opacity: 0.72;
  pointer-events: auto;
  transition: opacity 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  cursor: pointer;
}
.watch-screen:hover .cssmv-stem-toggle,
.watch-screen:focus-within .cssmv-stem-toggle { opacity: 1; }
.cssmv-stem-toggle:hover { transform: scale(1.05); border-color: rgba(218, 255, 242, 0.55); }
.cssmv-stem-toggle.is-instrumental .cssmv-stem-icon::before { content: "🎤"; font-size: 14px; }
.cssmv-stem-toggle.is-vocals       .cssmv-stem-icon::before { content: "🎵"; font-size: 14px; }
.cssmv-stem-icon { pointer-events: none; line-height: 1; }
/* CSSOS_WAVE_672 ① — 卡拉 OK 标示: 切到伴奏(instrumental)时, 麦克风按钮变绿+展开"卡拉 OK"字样,
 * 一眼知道"该你唱了"; 原唱态只显图标。 */
.cssmv-stem-ktv {
  display: none; pointer-events: none; font-weight: 800; font-size: 11px;
  letter-spacing: 0.04em; white-space: nowrap; line-height: 1;
}
.cssmv-stem-toggle.is-instrumental {
  width: auto; padding: 0 12px; gap: 6px;
  background: rgba(0, 200, 120, 0.32);
  border-color: rgba(0, 245, 160, 0.6);
  color: #eafff4;
}
.cssmv-stem-toggle.is-instrumental .cssmv-stem-ktv { display: inline; }

/* ---------- P2-75 ✦ button facelift — actually visible this time ---------- */
.cssmv-star-emphasized {
  opacity: 0.96 !important;
  font-size: 20px !important;
  width: 46px !important;
  height: 46px !important;
  border-color: rgba(236, 255, 248, 0.42) !important;
  box-shadow:
    0 0 30px rgba(0, 245, 160, 0.34),
    0 0 62px rgba(11, 247, 255, 0.18) !important;
  animation: cssmvStarPulse 3.6s ease-in-out infinite;
}
.cssmv-star-emphasized:hover {
  animation: none;
  transform: scale(1.06) rotate(10deg);
}
@keyframes cssmvStarPulse {
  0%   { box-shadow: 0 0 24px rgba(0, 245, 160, 0.28), 0 0 52px rgba(11, 247, 255, 0.14); }
  50%  { box-shadow: 0 0 38px rgba(0, 245, 160, 0.46), 0 0 84px rgba(11, 247, 255, 0.24); }
  100% { box-shadow: 0 0 24px rgba(0, 245, 160, 0.28), 0 0 52px rgba(11, 247, 255, 0.14); }
}

/* Multi-line friendly: allow glyph spans to flow naturally (each word/char can wrap) */
.cssmv-anim-glyph { word-break: keep-all; }
.watch-subtitle,
.watch-karaoke-line,
.watch-karaoke-current,
.watch-karaoke-prev,
.watch-karaoke-next {
  white-space: normal !important;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* ---------- CSSOS_PHASE2_P2_96_SUBTITLE_WEIGHT 20260424 #96 ----------
   Jing's spec (verbatim): "樱花/盛开/季节属于权重大的词/字,
   在那/的属于权重小。权重大的词/字和权重小的词/字不能在同一行,
   必须另起一行。" Split karaoke line into runs of high-weight (content)
   vs low-weight (function) words; each run is its own block-level row
   so high and low weight never share a line. High = large bold; low =
   small muted. Emphasis glow / per-word font from #85/#93 still work
   because the <span class="watch-karaoke-word"> inside the row retains
   its existing inline styles and classes. */
.watch-karaoke-row {
  display: block;
  width: 100%;
  line-height: 1.14;
  margin: 0.06em 0;
  text-align: inherit;
}
.watch-karaoke-row.is-weight-high {
  font-size: 1.28em;
  font-weight: 700;
  letter-spacing: 0.015em;
}
.watch-karaoke-row.is-weight-low {
  font-size: 0.72em;
  font-weight: 400;
  letter-spacing: 0.01em;
  opacity: 0.82;
}
.watch-karaoke-row.is-weight-high .watch-karaoke-word { font-weight: inherit; }
.watch-karaoke-row.is-weight-low  .watch-karaoke-word { font-weight: inherit; }

/* ---------- P2-28a auto-rotate settings popover ---------- */
.cssmv-font-settings-menu {
  position: fixed;
  z-index: 10055; /* CSSOS_WAVE_351 z-index 收敛: 99999 → 10055 (watch popover) */
  min-width: 220px;
  padding: 10px 12px;
  background: rgba(14, 22, 20, 0.96);
  color: rgba(242, 255, 248, 0.98);
  border: 1px solid rgba(218, 255, 242, 0.22);
  border-radius: 10px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(11, 247, 255, 0.06);
  backdrop-filter: blur(12px) saturate(1.1);
  -webkit-backdrop-filter: blur(12px) saturate(1.1);
  font-size: 13px;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
.cssmv-font-settings-menu h4 {
  margin: 0 0 8px 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(182, 220, 205, 0.78);
  font-weight: 600;
}
.cssmv-font-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
}
.cssmv-font-settings-row label {
  flex: 1 1 auto;
  color: rgba(242, 255, 248, 0.92);
}
.cssmv-font-settings-row select,
.cssmv-font-settings-row input[type="checkbox"] {
  accent-color: #00f5a0;
  background: rgba(5, 10, 9, 0.6);
  color: inherit;
  border: 1px solid rgba(218, 255, 242, 0.22);
  border-radius: 6px;
  padding: 3px 6px;
  font: inherit;
}
.cssmv-font-settings-hint {
  font-size: 11px;
  color: rgba(178, 200, 190, 0.72);
  margin-top: 6px;
  line-height: 1.35;
}

/* ---------- P2-76 ✦ relocate top-right + kill center play button ----------
   Jing 2026-04-20:
     "图1，看，星星还在中间那里呢，应该放到右上角话筒按钮那里并排，UI也类似，
      顺便取消中间的播放按钮（双圆圈那个）。Music标签页，也是。"
   Fix:
     1. Force both ✦ buttons (#watch-style-shift in MV pane and
        #watch-music-style-shift in Music pane) to the top-right corner with
        circular UI identical to the 🎤 .cssmv-stem-toggle mic button, so they
        can never drift to the middle again no matter what other rule or
        JS style poke may have pushed them there.
     2. Move the mic button left to right:70px so the ✦ can claim the
        outermost right:14px slot and the two buttons sit neatly side-by-side.
     3. display:none the center double-ring .watch-overlay-play and
        .watch-music-play buttons entirely — the SVG border ring (MV) and
        music ring (Music) handle progress/flash already; those two center
        buttons were only adding visual noise over the composition. */
#watch-style-shift.watch-style-shift,
#watch-music-style-shift.watch-style-shift,
#watch-music-style-shift.watch-music-style-shift,
#watch-music-style-shift {
  position: absolute !important;
  top: 14px !important;
  right: 14px !important;
  left: auto !important;
  bottom: auto !important;
  transform: none !important;
  width: 44px !important;
  height: 44px !important;
  min-width: 44px !important;
  min-height: 44px !important;
  max-width: 44px !important;
  max-height: 44px !important;
  padding: 0 !important;
  margin: 0 !important;
  z-index: 9 !important;
  display: grid !important;
  place-items: center !important;
  border-radius: 999px !important;
  border: 1px solid rgba(218, 255, 242, 0.28) !important;
  background: linear-gradient(180deg, rgba(7, 14, 12, 0.42), rgba(5, 10, 9, 0.24)) !important;
  color: rgba(242, 255, 248, 0.98) !important;
  font-size: 17px !important;
  line-height: 1 !important;
  box-shadow:
    0 0 24px rgba(0, 245, 160, 0.16),
    0 0 52px rgba(11, 247, 255, 0.08) !important;
  backdrop-filter: blur(12px) saturate(1.08) !important;
  -webkit-backdrop-filter: blur(12px) saturate(1.08) !important;
  opacity: 0.78 !important;
  pointer-events: auto !important;
  cursor: pointer !important;
  transition: opacity 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease,
              border-color 0.22s ease !important;
}
.watch-screen:hover #watch-style-shift.watch-style-shift,
.watch-screen:focus-within #watch-style-shift.watch-style-shift,
.watch-music-stage:hover #watch-music-style-shift,
.watch-music-stage:focus-within #watch-music-style-shift {
  opacity: 1 !important;
}
#watch-style-shift.watch-style-shift:hover,
#watch-music-style-shift:hover {
  transform: scale(1.05) rotate(8deg) !important;
  border-color: rgba(236, 255, 248, 0.5) !important;
  box-shadow:
    0 0 32px rgba(0, 245, 160, 0.28),
    0 0 74px rgba(11, 247, 255, 0.18) !important;
}

/* Slide the mic button left so the ✦ claims right:14px. Together the two
   circular buttons stand side-by-side at the top-right corner. */
.cssmv-stem-toggle {
  right: 70px !important;
}

/* P2-75 emphasis keeps its pulse but no longer resizes beyond the 44px
   circle so both buttons stay visually harmonious. */
.cssmv-star-emphasized {
  width: 44px !important;
  height: 44px !important;
  font-size: 17px !important;
}

/* Kill the center double-ring play buttons on both panes — they duplicate
   the rounded-rect/ring SVG progress UIs and sit in the middle blocking
   composition. */
#watch-overlay-play,
.watch-overlay-play,
#watch-music-play,
.watch-music-play {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
`,document.head.appendChild(st)}const CJK_RE=/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uff66-\uff9f]/;function hasCjk(s){return CJK_RE.test(String(s||""))}function hasLatin(s){return/[A-Za-z]/.test(String(s||""))}function classifyText(s){const c=hasCjk(s),l=hasLatin(s);return c&&l?"mixed":c?"cjk":l?"latin":"other"}const __BRACKETS={"(":")","（":"）","[":"]","【":"】","「":"」","『":"』","《":"》"};function preGroupBrackets(str){const groups=[];let i=0;for(;i<str.length;){const ch=str[i],close=__BRACKETS[ch];if(close){const closeIdx=str.indexOf(close,i+1);if(closeIdx>i&&closeIdx-i-1<=12){groups.push({start:i,end:closeIdx+1}),i=closeIdx+1;continue}}i+=1}if(!groups.length)return null;const out=[];let cursor=0;for(const g of groups)g.start>cursor&&out.push({text:str.slice(cursor,g.start),isGroup:!1}),out.push({text:str.slice(g.start,g.end),isGroup:!0}),cursor=g.end;return cursor<str.length&&out.push({text:str.slice(cursor),isGroup:!1}),out}function segmentForEntry(text){const out=[],str=String(text||"");if(!str)return out;const pre=preGroupBrackets(str);if(pre){for(const seg of pre)if(seg.isGroup)out.push(seg.text);else{const sub=segmentForEntry(seg.text);for(const s of sub)out.push(s)}return out}if(typeof Intl<"u"&&typeof Intl.Segmenter=="function")try{const seg=new Intl.Segmenter(void 0,{granularity:"word"});for(const piece of seg.segment(str)){const chunk=piece.segment;if(hasCjk(chunk)&&chunk.length>1)for(const ch of Array.from(chunk))out.push(ch);else out.push(chunk)}return out}catch{}let buf="",bufKind="";const flush=()=>{buf&&(out.push(buf),buf="",bufKind="")};for(const ch of Array.from(str)){const kind=CJK_RE.test(ch)?"cjk":/[A-Za-z0-9]/.test(ch)?"latin":"other";if(kind==="cjk"){flush(),out.push(ch);continue}if(kind==="latin"){bufKind&&bufKind!=="latin"&&flush(),bufKind="latin",buf+=ch;continue}flush(),out.push(ch)}return flush(),out}let currentMotion=CONFIG.MOTIONS[0];function pickMotion(){if(!CONFIG.ENTRY_RANDOMIZE_MOTIONS)return currentMotion;const list=Array.isArray(CONFIG.MOTIONS)?CONFIG.MOTIONS:["fall"];return currentMotion=list[Math.floor(Math.random()*list.length)]||"fall",currentMotion}let __cssmvFontCatalogCache=null,__cssmvFontCatalogStamp=0;const __CSSMV_PLAIN_FAMILY_RE=/^(?:system-ui|ui-(?:sans|serif|mono|rounded)|sans-serif|serif|monospace|cursive|fantasy|Helvetica(?:\s+Neue)?|Arial(?:\s+Black|\s+Narrow)?|Times(?:\s+New\s+Roman)?|Georgia|Verdana|Tahoma|Trebuchet(?:\s+MS)?|Courier(?:\s+New)?|Roboto(?:\s+(?:Mono|Slab|Condensed))?|Inter|Lato|Open\s+Sans|Source\s+Sans(?:\s+Pro)?|Source\s+Serif(?:\s+Pro)?|Source\s+Code(?:\s+Pro)?|Noto\s+Sans(?:\s+CJK)?|Noto\s+Serif(?:\s+CJK)?|PingFang(?:\s+SC|\s+TC|\s+HK)?|Hiragino\s+Sans(?:\s+GB)?|Microsoft\s+YaHei|Microsoft\s+JhengHei|SimSun|SimHei|Heiti(?:\s+SC|\s+TC)?|Songti(?:\s+SC|\s+TC)?|Apple\s+SD\s+Gothic\s+Neo|Malgun\s+Gothic|Yu\s+Gothic|Meiryo|MS\s+(?:Gothic|Mincho|PGothic|PMincho))$/i;function classifyFamily(fam){const t=String(fam||"").trim().replace(/^["']|["']$/g,"");return t&&__CSSMV_PLAIN_FAMILY_RE.test(t)?"plain":"fancy"}function loadFontPools(){const now=Date.now();if(__cssmvFontCatalogCache&&now-__cssmvFontCatalogStamp<1e3)return __cssmvFontCatalogCache;let cjk=[],latin=[];try{const entries=typeof globalThis.buildWatchFontCatalogModule=="function"?globalThis.buildWatchFontCatalogModule():[];if(Array.isArray(entries)&&entries.length)for(const e of entries){const fam=String(e?.family||"").trim();if(!fam)continue;const g=String(e?.group||"").toLowerCase();(g?g==="cjk":CJK_RE.test(fam))?cjk.push(fam):latin.push(fam)}}catch{}if(!cjk.length&&!latin.length)try{const manifest=Array.isArray(globalThis.CSSOS_WATCH_FONT_MANIFEST)?globalThis.CSSOS_WATCH_FONT_MANIFEST:[];for(const e of manifest){const fam=String(e?.family||"").trim(),src=String(e?.src||"").trim().toLowerCase();if(!fam)continue;CJK_RE.test(fam)||src.startsWith("fonts/")||src.startsWith("fonts_cn2/")?cjk.push(fam):latin.push(fam)}}catch{}const cjkFancy=[],cjkPlain=[];for(const f of cjk)(classifyFamily(f)==="fancy"?cjkFancy:cjkPlain).push(f);const latinFancy=[],latinPlain=[];for(const f of latin)(classifyFamily(f)==="fancy"?latinFancy:latinPlain).push(f);const pools={cjk,latin,cjkFancy,cjkPlain,latinFancy,latinPlain};if(__cssmvFontCatalogCache=pools,__cssmvFontCatalogStamp=now,!globalThis.__cssmvFancyLogged){globalThis.__cssmvFancyLogged=!0;try{console.info("%c[font-pools] cjk fancy=%d plain=%d · latin fancy=%d plain=%d (90/10 weighting active)","color:#d2a; font-weight:bold",cjkFancy.length,cjkPlain.length,latinFancy.length,latinPlain.length)}catch{}}return pools}function pickWeightedFromBuckets(fancy,plain,fancyWeight){const w=typeof fancyWeight=="number"?fancyWeight:.9,bucket=Math.random()<w&&fancy.length>0?fancy:plain.length?plain:fancy;return bucket.length&&bucket[Math.floor(Math.random()*bucket.length)]||""}globalThis.cssmvPickWeightedFontFamily=function(script,fancyWeight){const pools=loadFontPools(),isCjk=String(script||"").toLowerCase()==="cjk",fancy=isCjk?pools.cjkFancy:pools.latinFancy,plain=isCjk?pools.cjkPlain:pools.latinPlain;return pickWeightedFromBuckets(fancy,plain,fancyWeight)};function perTokenMode(){try{const v=String(localStorage.getItem(CONFIG.PER_TOKEN_MODE_KEY)||"").trim().toLowerCase();if(v==="off"||v==="word"||v==="char")return v}catch{}return CONFIG.PER_TOKEN_MODE_DEFAULT}function setPerTokenMode(v){const next=v==="off"||v==="word"||v==="char"?v:CONFIG.PER_TOKEN_MODE_DEFAULT;try{localStorage.setItem(CONFIG.PER_TOKEN_MODE_KEY,next)}catch{}return next}function currentPreset(){try{const v=String(localStorage.getItem(CONFIG.PER_TOKEN_PRESET_KEY)||"").trim().toLowerCase();if(v==="chaos"||v==="rhythm"||v==="line"||v==="single")return v}catch{}return CONFIG.PER_TOKEN_PRESET_DEFAULT}function setCurrentPreset(v){const next=new Set(["chaos","rhythm","line","single"]).has(v)?v:CONFIG.PER_TOKEN_PRESET_DEFAULT;try{localStorage.setItem(CONFIG.PER_TOKEN_PRESET_KEY,next)}catch{}return next}function bumpShuffleSeed(){try{const n=parseInt(localStorage.getItem(CONFIG.PER_TOKEN_SEED_KEY)||"0",10)||0;localStorage.setItem(CONFIG.PER_TOKEN_SEED_KEY,String(n+1))}catch{}}function randomFromPool(pool){return!Array.isArray(pool)||!pool.length?"":pool[Math.floor(Math.random()*pool.length)]||""}function pickFontsForTokens(pieces,preset,mode){const len=pieces.length,out=new Array(len).fill("");if(mode==="off"||preset==="single")return out;const{cjk,latin}=loadFontPools();if(!cjk.length&&!latin.length)return out;const pools=loadFontPools(),drawCjk=()=>pickWeightedFromBuckets(pools.cjkFancy,pools.cjkPlain,.9)||pickWeightedFromBuckets(pools.latinFancy,pools.latinPlain,.9),drawLat=()=>pickWeightedFromBuckets(pools.latinFancy,pools.latinPlain,.9)||pickWeightedFromBuckets(pools.cjkFancy,pools.cjkPlain,.9);if(preset==="line"){const oneCjk=drawCjk(),oneLat=drawLat();for(let i=0;i<len;i++){const p=pieces[i];!p||/^\s+$/.test(p)||(out[i]=CJK_RE.test(p)?oneCjk:oneLat)}return out}if(preset==="rhythm"){let flip=0;for(let i=0;i<len;i++){const p=pieces[i];if(!p||/^\s+$/.test(p))continue;const wantCjk=CJK_RE.test(p),useCjk=wantCjk?flip++%2===0:!1;out[i]=wantCjk&&useCjk?drawCjk():drawLat()}return out}for(let i=0;i<len;i++){const p=pieces[i];!p||/^\s+$/.test(p)||(out[i]=CJK_RE.test(p)?drawCjk():drawLat())}return out}function wrapGlyphs(text,motion,opts){const rawPieces=segmentForEntry(text);if(!rawPieces.length)return"";const use=motion||pickMotion(),cap=Math.max(1,CONFIG.MAX_GLYPHS_STAGGER),mode=opts&&typeof opts.mode=="string"?opts.mode:perTokenMode(),preset=opts&&typeof opts.preset=="string"?opts.preset:currentPreset();let pieces=rawPieces;if(mode==="char"){const expanded=[];for(const p of rawPieces){if(!p||/^\s+$/.test(p)||p.length===1){expanded.push(p);continue}for(const ch of Array.from(p))expanded.push(ch)}pieces=expanded}const fonts=pickFontsForTokens(pieces,preset,mode),out=[];let wordOpen=!1;const closeWord=()=>{wordOpen&&(out.push("</span>"),wordOpen=!1)};return pieces.forEach((piece,idx)=>{const delay=Math.min(idx,cap)*CONFIG.ENTRY_STAGGER_MS;if(/^\s+$/.test(piece)){closeWord(),out.push(escapeHtml(piece));return}wordOpen||(out.push('<span class="cssmv-anim-word">'),wordOpen=!0);const cls=["cssmv-anim-glyph",`cssmv-anim-${use}`].join(" "),fam=fonts[idx]||"",famCss=fam?`font-family:"${String(fam).replace(/"/g,'\\"')}", var(--watch-title-font-family, inherit);`:"";out.push(`<span class="${cls}" style="animation-delay:${delay}ms;${famCss}">${escapeHtml(piece)}</span>`)}),closeWord(),out.join("")}function escapeHtml(str){return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}globalThis.cssmvApplyTextEntry=function(el,text,opts){if(!(el instanceof HTMLElement))return;const motion=opts?.motion||pickMotion();el.innerHTML=wrapGlyphs(String(text||""),motion)};const observed=new WeakMap;function shouldEnhance(el){return!(!(el instanceof HTMLElement)||el.querySelector?.(".cssmv-anim-glyph")||el.querySelector?.(".watch-karaoke-word")||!(el.textContent||"").trim())}function enhanceIfPlainText(el){if(!(el instanceof HTMLElement))return;const info=observed.get(el),now=Date.now();if(info&&now-info.lastAt<60)return;const rawTxt=(el.textContent||"").trim();if(!rawTxt){observed.set(el,{lastText:"",lastAt:now});return}const hasGlyphs=!!el.querySelector?.(".cssmv-anim-glyph");if(info&&info.lastText===rawTxt&&hasGlyphs)return;if(el.querySelector?.(".watch-karaoke-current, .watch-karaoke-prev, .watch-karaoke-next")){Array.from(el.querySelectorAll(".watch-karaoke-current, .watch-karaoke-prev, .watch-karaoke-next")).forEach(node=>{const t=(node.textContent||"").trim();t&&!node.querySelector(".cssmv-anim-glyph")&&Array.from(node.childNodes).every(c=>c.nodeType===3||c.nodeType===1&&!c.classList?.contains("karaoke-word"))&&(node.innerHTML=wrapGlyphs(t))}),observed.set(el,{lastText:rawTxt,lastAt:now});try{fitSubtitleFontSize(el)}catch{}return}el.innerHTML=wrapGlyphs(rawTxt),observed.set(el,{lastText:rawTxt,lastAt:now});try{fitSubtitleFontSize(el)}catch{}}function attachObservers(){const subtitle=document.getElementById(IDS.subtitle),karaoke=document.getElementById(IDS.karaoke);[subtitle,karaoke].filter(Boolean).forEach(el=>{if(el.__cssmvObserved)return;el.__cssmvObserved=!0,new MutationObserver(()=>{el.__cssmvRaf||(el.__cssmvRaf=requestAnimationFrame(()=>{el.__cssmvRaf=0,shouldEnhance(el)&&enhanceIfPlainText(el)}))}).observe(el,{childList:!0,characterData:!0,subtree:!0}),shouldEnhance(el)&&enhanceIfPlainText(el)})}let mvTitleEl=null,mvTitleCachedText="";function ensureMvTitle(){const frame=qFrame();if(!frame)return null;if(!mvTitleEl||!mvTitleEl.isConnected){const fresh=document.createElement("div");if(fresh.id="cssmv-mv-title",fresh.className="cssmv-mv-title",frame.appendChild(fresh),mvTitleEl=fresh,mvTitleCachedText)try{mvTitleEl.innerHTML=wrapGlyphs(mvTitleCachedText,pickMotion()),fitMvTitleFontSize(mvTitleEl,frame),mvTitleEl.__cssmvLastText=mvTitleCachedText,requestAnimationFrame(()=>{if(!(!mvTitleEl||!mvTitleEl.isConnected))try{showMvArtTitleForFlash()}catch{mvTitleEl.classList.remove("is-hidden"),mvTitleEl.classList.add("is-visible")}})}catch{}}return mvTitleEl}function fitMvTitleFontSize(el,frame){if(!(el instanceof HTMLElement)||!(frame instanceof HTMLElement))return;const rect=frame.getBoundingClientRect(),basis=Math.min(rect.width||0,rect.height||0)||320;let px=Math.round(basis*CONFIG.MV_TITLE_FONT_SIZE_RATIO);px=Math.max(CONFIG.MV_TITLE_MIN_FONT_PX,Math.min(CONFIG.MV_TITLE_MAX_FONT_PX,px)),el.style.fontSize=px+"px";const maxHeight=px*CONFIG.MV_TITLE_LINE_HEIGHT*CONFIG.MV_TITLE_MAX_LINES+2,maxWidth=Math.max(40,(rect.width||basis)-4);let guard=0;for(;(el.scrollHeight>maxHeight||el.scrollWidth>maxWidth)&&px>CONFIG.MV_TITLE_MIN_FONT_PX&&guard<40;)px=Math.max(CONFIG.MV_TITLE_MIN_FONT_PX,Math.round(px*.94)),el.style.fontSize=px+"px",guard+=1}function fitSubtitleFontSize(el){if(!(el instanceof HTMLElement)||!el.isConnected)return;const frame=qFrame(),frameRect=frame?frame.getBoundingClientRect():null,frameW=frameRect&&frameRect.width||el.parentElement?.clientWidth||320,avail=Math.max(80,frameW-64),sig=(el.textContent||"").trim()+"|"+Math.round(avail)+"|"+(el.style.fontFamily||getComputedStyle(el).fontFamily||"").slice(0,40);if(el.__cssmvFitSig===sig)return;el.__cssmvFitSig=sig,el.style.whiteSpace="nowrap",el.style.maxWidth=avail+"px";let px=parseFloat(getComputedStyle(el).fontSize)||20;const MAXP=26,MINP=11;px=Math.max(MINP,Math.min(MAXP,px)),el.style.fontSize=px+"px";let guard=0;for(;el.scrollWidth>avail&&px>MINP&&guard<48;)px=Math.max(MINP,Math.round(px*.94*10)/10),el.style.fontSize=px+"px",guard+=1}globalThis.cssmvFitSubtitleFontSize=fitSubtitleFontSize;function refitOverlaysAfterFonts(){try{const frame=qFrame();mvTitleEl&&mvTitleLastText&&frame&&fitMvTitleFontSize(mvTitleEl,frame);const sub=document.getElementById(IDS.subtitle);sub&&fitSubtitleFontSize(sub);const kara=document.getElementById(IDS.karaoke);kara&&fitSubtitleFontSize(kara)}catch{}}globalThis.cssmvRefitOverlaysAfterFonts=refitOverlaysAfterFonts;try{document.fonts&&document.fonts.ready&&(document.fonts.ready.then(refitOverlaysAfterFonts).catch(()=>{}),document.fonts.addEventListener?.("loadingdone",refitOverlaysAfterFonts))}catch{}let mvTitleLastText="";function renderMvArtTitle(text){const frame=qFrame(),clean=String(text||"").trim();if(mvTitleCachedText=clean,mvTitleLastText=clean,!frame)return;const el=ensureMvTitle();if(el){if(!clean){el.classList.remove("is-visible","is-playing"),el.classList.add("is-hidden"),el.innerHTML="",mvTitleLastText="",mvTitleCachedText="",el.__cssmvLastText="";return}if(clean===el.__cssmvLastText&&el.innerHTML){el.classList.contains("is-visible")||(el.classList.remove("is-hidden"),el.classList.add("is-visible"));return}mvTitleLastText=clean,mvTitleCachedText=clean,el.__cssmvLastText=clean,el.innerHTML=wrapGlyphs(clean,pickMotion()),fitMvTitleFontSize(el,frame),setTimeout(()=>{const live=mvTitleEl;if(!(!live||!live.isConnected))try{showMvArtTitleForFlash()}catch{live.classList.remove("is-hidden"),live.classList.add("is-visible")}},CONFIG.MV_TITLE_APPEAR_DELAY_MS)}}function hideMvArtTitle(){mvTitleEl&&(mvTitleEl.classList.remove("is-visible","is-playing"),mvTitleEl.classList.add("is-hidden"))}let __cssmvTitleFlashTimer=0,__cssmvTitleAnchorIdx=0;const TITLE_ANCHORS=["anchor-tl","anchor-tr","anchor-bl","anchor-br","anchor-tc","anchor-bc","anchor-ml","anchor-mr"];function pickFaceSafeAnchor(){try{if(globalThis.cssosFaceSafe&&typeof globalThis.cssosFaceSafe.titleAnchor=="function"){const a=globalThis.cssosFaceSafe.titleAnchor();if(a&&TITLE_ANCHORS.indexOf(a)>=0)return __cssmvTitleAnchorIdx=TITLE_ANCHORS.indexOf(a),a}}catch{}const next=(__cssmvTitleAnchorIdx+1+Math.floor(Math.random()*3))%TITLE_ANCHORS.length;return __cssmvTitleAnchorIdx=next,TITLE_ANCHORS[next]}function inferTitleEmotionFromText(s){const t=String(s||"").toLowerCase();return/fire|burn|燃|怒|爆|火/.test(t)?"ignite":/love|heart|爱|心|怀/.test(t)?"intimate":/dream|moon|night|梦|月|夜|星/.test(t)?"resolve":/joy|smile|喜|笑|乐|阳光/.test(t)?"joy":/grief|tear|cry|悲|失|泪/.test(t)?"grief":/calm|peace|静|安|宁|海/.test(t)?"calm":""}function showMvArtTitleForFlash(durationMs){if(!mvTitleEl)return;const flashMs=Math.max(2e3,Math.min(6e4,Number(durationMs)||1e4));TITLE_ANCHORS.forEach(c=>mvTitleEl.classList.remove(c));const anchor=pickFaceSafeAnchor();mvTitleEl.classList.add(anchor),["ignite","resolve","intimate","joy","calm","grief"].forEach(k=>{mvTitleEl.classList.remove("title-emotion-"+k)});const emo=inferTitleEmotionFromText(mvTitleLastText);emo&&mvTitleEl.classList.add("title-emotion-"+emo),mvTitleEl.classList.remove("is-hidden"),mvTitleEl.classList.add("is-visible"),mvTitleEl.classList.add("is-flash"),__cssmvTitleFlashTimer&&clearTimeout(__cssmvTitleFlashTimer),__cssmvTitleFlashTimer=setTimeout(()=>{mvTitleEl&&(mvTitleEl.classList.remove("is-visible","is-flash"),mvTitleEl.classList.add("is-hidden"),__cssmvTitleFlashTimer=0)},flashMs)}globalThis.cssmvShowMvArtTitleForFlash=showMvArtTitleForFlash;function wireMvTitleResize(){const frame=qFrame();if(!frame||!mvTitleEl||frame.__cssmvMvTitleRO)return;const ro=new ResizeObserver(()=>{mvTitleEl&&mvTitleLastText&&fitMvTitleFontSize(mvTitleEl,frame);try{const sub=document.getElementById(IDS.subtitle);sub&&fitSubtitleFontSize(sub);const kara=document.getElementById(IDS.karaoke);kara&&fitSubtitleFontSize(kara)}catch{}});ro.observe(frame),frame.__cssmvMvTitleRO=ro}globalThis.cssmvRenderMvArtTitle=renderMvArtTitle,globalThis.cssmvHideMvArtTitle=hideMvArtTitle;function markMvTitlePlaying(playing){if(mvTitleEl)if(playing){if(!mvTitleEl.__cssmvLastText)return;mvTitleEl.classList.contains("is-visible")||(mvTitleEl.classList.remove("is-hidden"),mvTitleEl.classList.add("is-visible")),mvTitleEl.classList.add("is-playing")}else mvTitleEl.classList.remove("is-playing")}function wireMvTitleAutoHide(){const v=document.getElementById(IDS.video);if(!v||v.__cssmvMvTitleAutoHide)return;v.__cssmvMvTitleAutoHide=!0;const enterPlay=()=>markMvTitlePlaying(!0),leavePlay=()=>markMvTitlePlaying(!1);v.addEventListener("play",enterPlay),v.addEventListener("playing",enterPlay),v.addEventListener("pause",leavePlay),v.addEventListener("ended",leavePlay),v.addEventListener("emptied",leavePlay)}let autoRotateTimer=null;function currentAutoRotateMin(){try{const raw=localStorage.getItem(CONFIG.AUTO_ROTATE_STORAGE_KEY),n=parseInt(raw,10);if(Number.isFinite(n)&&n>=0)return n}catch{}return CONFIG.AUTO_ROTATE_DEFAULT_MIN}function setAutoRotateMin(mins){const n=Math.max(0,Math.min(1440,parseInt(mins,10)||0));try{localStorage.setItem(CONFIG.AUTO_ROTATE_STORAGE_KEY,String(n))}catch{}return restartAutoRotate(),n}function scriptPoolsEnabled(){try{const raw=localStorage.getItem(CONFIG.SCRIPT_POOLS_ENABLED_KEY);return raw==null?!0:raw==="1"||raw==="true"}catch{return!0}}function setScriptPoolsEnabled(on){try{localStorage.setItem(CONFIG.SCRIPT_POOLS_ENABLED_KEY,on?"1":"0")}catch{}}function emotionFontFollowEnabled(){try{const raw=localStorage.getItem(CONFIG.EMOTION_FONT_FOLLOW_KEY);return raw==null?!0:raw==="1"||raw==="true"}catch{return!0}}function setEmotionFontFollow(on){try{localStorage.setItem(CONFIG.EMOTION_FONT_FOLLOW_KEY,on?"1":"0")}catch{}try{globalThis.cssosEmotionFontFollow=!!on}catch{}}try{globalThis.cssosEmotionFontFollow=emotionFontFollowEnabled()}catch{}function restartAutoRotate(){autoRotateTimer&&(clearInterval(autoRotateTimer),autoRotateTimer=null);const mins=currentAutoRotateMin();mins<=0||(autoRotateTimer=setInterval(()=>{try{typeof globalThis.cycleWatchTypographyPresetModule=="function"&&globalThis.cycleWatchTypographyPresetModule()}catch{}try{shuffleTokenFonts()}catch{}},mins*60*1e3))}function installFontPoolSplit(){if(!scriptPoolsEnabled())return;const orig=globalThis.pickWatchRandomFontModule;if(typeof orig!="function"||orig.__cssmvPatched)return;let flip=0;const patched=function(entries,fallback){try{if(!scriptPoolsEnabled()||!Array.isArray(entries)||entries.length<2)return orig(entries,fallback);const pref=flip++%2===0?"cjk":"latin",pool=entries.filter(e=>{const g=String(e?.group||"").toLowerCase();if(g)return g===pref;const fam=String(e?.family||"");return pref==="cjk"?CJK_RE.test(fam):!CJK_RE.test(fam)});if(pool.length)return orig(pool,fallback)}catch{}return orig(entries,fallback)};patched.__cssmvPatched=!0,globalThis.pickWatchRandomFontModule=patched}let menuEl=null;function closeMenu(){menuEl&&menuEl.parentNode&&menuEl.parentNode.removeChild(menuEl),menuEl=null,document.removeEventListener("pointerdown",onOutsideMenu,!0)}function onOutsideMenu(ev){menuEl&&(menuEl.contains(ev.target)||closeMenu())}function openFontSettingsMenu(clientX,clientY){closeMenu();const m=document.createElement("div");m.className="cssmv-font-settings-menu";const currentMin=currentAutoRotateMin(),poolsOn=scriptPoolsEnabled(),mode=perTokenMode(),preset=currentPreset(),rotateOpts=CONFIG.AUTO_ROTATE_OPTIONS_MIN.map(n=>`<option value="${n}" ${n===currentMin?"selected":""}>${n===0?tr("Off","关闭"):tr(`${n} min`,`${n} 分钟`)}</option>`).join(""),modeOpts=[["word",tr("Per word (EN) / per char (CN)","每词(英) / 每字(中)")],["char",tr("Per character (every letter)","每字符（逐字母）")],["off",tr("Off (one font for all)","关闭（整段一种字体）")]].map(([val,lbl])=>`<option value="${val}" ${val===mode?"selected":""}>${lbl}</option>`).join(""),presetOpts=[["chaos",tr("Chaos — fully random","百家争鸣 · 完全随机")],["rhythm",tr("Rhythm — CN/EN pools","中英轮抽 · 分池")],["line",tr("Line — one font per script","整段统一 · 每script一款")],["single",tr("Single — legacy one-font","原样 · 整MV一款")]].map(([val,lbl])=>`<option value="${val}" ${val===preset?"selected":""}>${lbl}</option>`).join("");m.innerHTML=`
      <h4>${tr("Typography","字体设置")}</h4>
      <div class="cssmv-font-settings-row">
        <label for="cssmv-font-mode-sel">${tr("Randomize granularity","随机粒度")}</label>
        <select id="cssmv-font-mode-sel">${modeOpts}</select>
      </div>
      <div class="cssmv-font-settings-row">
        <label for="cssmv-font-preset-sel">${tr("Preset","预设风格")}</label>
        <select id="cssmv-font-preset-sel">${presetOpts}</select>
      </div>
      <div class="cssmv-font-settings-row">
        <label for="cssmv-font-rotate-sel">${tr("Auto-shuffle every","自动切换")}</label>
        <select id="cssmv-font-rotate-sel">${rotateOpts}</select>
      </div>
      <div class="cssmv-font-settings-row">
        <label for="cssmv-font-pools-chk">${tr("CN / EN split pool (preset ✦)","中英字体分池 (预设 ✦)")}</label>
        <input id="cssmv-font-pools-chk" type="checkbox" ${poolsOn?"checked":""} />
      </div>
      <div class="cssmv-font-settings-row">
        <label for="cssmv-font-emofollow-chk">${tr("Emotion subtitle follows font shuffle","情绪字幕跟随换字体")}</label>
        <input id="cssmv-font-emofollow-chk" type="checkbox" ${emotionFontFollowEnabled()?"checked":""} />
      </div>
      <div class="cssmv-font-settings-row">
        <label>${tr("Shuffle now","立即切换")}</label>
        <button id="cssmv-font-shuffle-now" type="button" style="padding:3px 10px;border-radius:6px;border:1px solid rgba(218,255,242,0.28);background:rgba(5,10,9,0.6);color:inherit;cursor:pointer;">✦</button>
      </div>
      <div class="cssmv-font-settings-hint">${tr("Left-click ✦ to reshuffle per-token fonts. Right-click opens this menu.","左键 ✦ 立即重抽每字/每词字体；右键打开本菜单。")}</div>
    `,document.body.appendChild(m);const mw=m.offsetWidth,mh=m.offsetHeight,vw=window.innerWidth,vh=window.innerHeight,x=Math.max(8,Math.min(vw-mw-8,clientX||40)),y=Math.max(8,Math.min(vh-mh-8,clientY||40));m.style.left=x+"px",m.style.top=y+"px",menuEl=m,m.querySelector("#cssmv-font-mode-sel")?.addEventListener("change",ev=>{const v=setPerTokenMode(ev.target.value);toast(v==="off"?"Per-token fonts off":v==="char"?"Per-character shuffling":"Per-word shuffling",v==="off"?"已关闭逐字字体":v==="char"?"逐字符随机字体":"逐词/字随机字体"),shuffleTokenFonts()}),m.querySelector("#cssmv-font-preset-sel")?.addEventListener("change",ev=>{const v=setCurrentPreset(ev.target.value);toast("Preset: "+v,"预设: "+v),shuffleTokenFonts()}),m.querySelector("#cssmv-font-rotate-sel")?.addEventListener("change",ev=>{const v=parseInt(ev.target.value,10)||0,n=setAutoRotateMin(v);toast(n>0?`Auto-shuffle every ${n} min`:"Auto-shuffle off",n>0?`每 ${n} 分钟自动切换字体`:"已关闭自动切换")}),m.querySelector("#cssmv-font-pools-chk")?.addEventListener("change",ev=>{setScriptPoolsEnabled(!!ev.target.checked),toast(ev.target.checked?"CN / EN pool split on":"Pool split off",ev.target.checked?"中英分池已开":"中英分池已关")}),m.querySelector("#cssmv-font-emofollow-chk")?.addEventListener("change",ev=>{setEmotionFontFollow(!!ev.target.checked),toast(ev.target.checked?"Emotion subtitle follows shuffle":"Emotion subtitle font frozen",ev.target.checked?"情绪字幕跟随换字体已开":"情绪字幕字体已冻结");try{shuffleTokenFonts()}catch{}}),m.querySelector("#cssmv-font-shuffle-now")?.addEventListener("click",()=>{shuffleTokenFonts()}),setTimeout(()=>document.addEventListener("pointerdown",onOutsideMenu,!0),0)}const __cssmvPieceFontMap=new Map;function cssmvAssignFontForPiece(text){const t=String(text||"").trim();if(!t)return"";if(__cssmvPieceFontMap.has(t))return __cssmvPieceFontMap.get(t)||"";const pools=loadFontPools();if(!pools.cjk.length&&!pools.latin.length)return __cssmvPieceFontMap.set(t,""),"";const wantCjk=CJK_RE.test(t);let fancy=wantCjk?pools.cjkFancy:pools.latinFancy;fancy.length||(fancy=wantCjk?pools.latinFancy:pools.cjkFancy);let plain=wantCjk?pools.cjkPlain:pools.latinPlain;plain.length||(plain=wantCjk?pools.latinPlain:pools.cjkPlain);const fam=pickWeightedFromBuckets(fancy,plain,.9);if(__cssmvPieceFontMap.size>=4e3){const firstKey=__cssmvPieceFontMap.keys().next().value;firstKey&&__cssmvPieceFontMap.delete(firstKey)}return __cssmvPieceFontMap.set(t,fam),fam}globalThis.cssmvAssignFontForPiece=cssmvAssignFontForPiece,globalThis.cssmvClearPieceFontMap=function(){__cssmvPieceFontMap.clear(),__cssmvFontCatalogCache=null,__cssmvFontCatalogStamp=0};function shuffleTokenFonts(){if(bumpShuffleSeed(),__cssmvFontCatalogCache=null,__cssmvFontCatalogStamp=0,__cssmvPieceFontMap.clear(),(()=>{try{return localStorage.getItem("cssmv.debugShuffle")==="1"}catch{return!1}})())try{const{cjk,latin}=loadFontPools();console.info("[cssmv] shuffleTokenFonts fired",{mvTitleEl:!!mvTitleEl,mvTitleLastText,pools:{cjk:cjk.length,latin:latin.length},mode:perTokenMode(),preset:currentPreset()})}catch{}if(mvTitleEl&&mvTitleLastText){const frame=qFrame();mvTitleEl.innerHTML=wrapGlyphs(mvTitleLastText,pickMotion());try{mvTitleEl.__cssmvLastText=""}catch{}frame&&fitMvTitleFontSize(mvTitleEl,frame);try{showMvArtTitleForFlash()}catch{}}const subtitle=document.getElementById(IDS.subtitle),karaoke=document.getElementById(IDS.karaoke);[subtitle,karaoke].filter(Boolean).forEach(el=>{const txt=(el.textContent||"").trim();if(!txt)return;el.querySelector?.(".watch-karaoke-current, .watch-karaoke-prev, .watch-karaoke-next")?Array.from(el.querySelectorAll(".watch-karaoke-current, .watch-karaoke-prev, .watch-karaoke-next")).forEach(node=>{const t=(node.textContent||"").trim();t&&(node.innerHTML=wrapGlyphs(t))}):el.innerHTML=wrapGlyphs(txt),observed.set(el,{lastText:txt,lastAt:Date.now()});try{fitSubtitleFontSize(el)}catch{}});try{document.fonts&&document.fonts.ready&&document.fonts.ready.then(()=>{try{refitOverlaysAfterFonts()}catch{}}).catch(()=>{})}catch{}try{document.querySelectorAll(".watch-karaoke-word").forEach(wordEl=>{const t=String(wordEl.textContent||"").trim();if(!t)return;const fam=cssmvAssignFontForPiece(t);if(fam)try{wordEl.style.fontFamily=`"${String(fam).replace(/"/g,'\\"')}", var(--watch-title-font-family, inherit)`}catch{}})}catch{}try{["watch-music-title-overlay","watch-music-subtitle-overlay"].forEach(id=>{const el=document.getElementById(id),txt=(el?.textContent||"").trim();el&&txt&&(el.innerHTML=wrapGlyphs(txt),observed.set(el,{lastText:txt,lastAt:Date.now()}))})}catch{}try{window.dispatchEvent(new CustomEvent("cssmv:font-shuffle",{detail:{at:Date.now()}}))}catch{}}globalThis.cssmvShuffleTokenFonts=shuffleTokenFonts,globalThis.cssmvPerTokenMode=perTokenMode,globalThis.cssmvSetPerTokenMode=setPerTokenMode,globalThis.cssmvCurrentPreset=currentPreset,globalThis.cssmvSetCurrentPreset=setCurrentPreset;function wireStyleShiftMenu(){const btn=document.getElementById(IDS.styleShift);btn&&!btn.__cssmvFontSettings&&(btn.__cssmvFontSettings=!0,btn.addEventListener("contextmenu",ev=>{ev.preventDefault(),ev.stopPropagation(),openFontSettingsMenu(ev.clientX,ev.clientY)},!0),btn.addEventListener("click",ev=>{try{shuffleTokenFonts()}catch{}},!1),btn.classList.add("cssmv-star-emphasized"));const musicBtn=document.getElementById("watch-music-style-shift");musicBtn&&!musicBtn.__cssmvFontSettings&&(musicBtn.__cssmvFontSettings=!0,musicBtn.addEventListener("click",ev=>{ev.preventDefault(),ev.stopPropagation();try{globalThis.cycleWatchTypographyPresetModule?.()}catch{}try{shuffleTokenFonts()}catch{}}),musicBtn.addEventListener("contextmenu",ev=>{ev.preventDefault(),ev.stopPropagation(),openFontSettingsMenu(ev.clientX,ev.clientY)},!0),musicBtn.classList.add("cssmv-star-emphasized"))}function currentStemPref(){try{const v=localStorage.getItem(CONFIG.STEM_STORAGE_KEY);if(v==="vocals"||v==="instrumental")return v}catch{}return CONFIG.STEM_DEFAULT}function setStemPref(v){const next=v==="instrumental"?"instrumental":"vocals";try{localStorage.setItem(CONFIG.STEM_STORAGE_KEY,next)}catch{}return next}globalThis.cssmvCurrentStemPreference=currentStemPref;function resolveStemUrls(){const vocals=String(globalThis.currentPreviewAudioOriginalUrl||"").trim()||String(globalThis.currentPreviewAudioUrl||"").trim()||"",instrumental=String(globalThis.currentPreviewAudioInstrumentalUrl||"").trim()||"";return{vocals,instrumental}}function applyStemToAudio(which){const audio=document.getElementById(IDS.audio);if(!(audio instanceof HTMLMediaElement))return!1;const urls=resolveStemUrls(),target=which==="instrumental"?urls.instrumental:urls.vocals,fallback=which==="instrumental"?urls.vocals:urls.instrumental,pick=target||fallback||"";if(!pick)return toast("No audio stem available yet","暂无可切换的音频分轨"),!1;const wasPlaying=!audio.paused,tt=audio.currentTime||0;return audio.src!==pick&&(audio.src=pick,audio.load?.(),audio.addEventListener("loadedmetadata",function once(){try{audio.currentTime=Math.min(tt,audio.duration||tt)}catch{}wasPlaying&&audio.play?.().catch(()=>{}),audio.removeEventListener("loadedmetadata",once)})),!target&&fallback?toast(which==="instrumental"?"No instrumental — using original":"No vocals — using instrumental",which==="instrumental"?"暂无伴奏，回退为原唱":"暂无原唱，回退为伴奏"):toast(which==="instrumental"?"Instrumental":"Vocals (original)",which==="instrumental"?"伴奏":"原唱"),!0}function ensureStemToggleBtn(){const frame=qFrame();if(!frame)return null;let btn=document.getElementById("cssmv-stem-toggle");return btn&&btn.isConnected||(btn=document.createElement("button"),btn.type="button",btn.id="cssmv-stem-toggle",btn.className="cssmv-stem-toggle",btn.setAttribute("aria-label",tr("Toggle vocals / instrumental","切换原唱/伴奏")),btn.innerHTML=`<span class="cssmv-stem-icon"></span><span class="cssmv-stem-ktv">${tr("KARAOKE","卡拉 OK")}</span>`,frame.appendChild(btn),syncStemToggleUi(btn,currentStemPref()),btn.addEventListener("click",ev=>{ev.preventDefault(),ev.stopPropagation();const next=currentStemPref()==="vocals"?"instrumental":"vocals";setStemPref(next),syncStemToggleUi(btn,next),applyStemToAudio(next)})),btn}function syncStemToggleUi(btn,pref){btn&&(btn.classList.toggle("is-vocals",pref==="vocals"),btn.classList.toggle("is-instrumental",pref==="instrumental"),btn.title=pref==="vocals"?tr("Vocals (original). Click for instrumental.","原唱。点击切到伴奏。"):tr("Instrumental. Click for vocals.","伴奏。点击切到原唱。"))}function pickBootTitle(){try{const titleInput=document.getElementById("title-input");if(titleInput&&typeof titleInput.value=="string"&&titleInput.value.trim())return titleInput.value.trim()}catch{}try{const watchState=globalThis.__watchState||globalThis.watchState;if(watchState&&typeof watchState.title=="string"&&watchState.title.trim())return watchState.title.trim()}catch{}try{if(typeof globalThis.currentWorkTitle=="function"){const t=String(globalThis.currentWorkTitle()||"").trim();if(t)return t}}catch{}return""}function renderBootTitleIfAvailable(){try{const t=pickBootTitle();t&&renderMvArtTitle(t)}catch{}}function boot(){ensureStyles(),setTimeout(()=>{installFontPoolSplit(),wireStyleShiftMenu(),ensureMvTitle(),wireMvTitleResize(),wireMvTitleAutoHide(),renderBootTitleIfAvailable(),ensureStemToggleBtn(),attachObservers(),restartAutoRotate()},0);let __cssmvRewireTid=0;new MutationObserver(()=>{__cssmvRewireTid||(__cssmvRewireTid=setTimeout(()=>{__cssmvRewireTid=0,wireStyleShiftMenu(),ensureMvTitle(),wireMvTitleResize(),wireMvTitleAutoHide(),mvTitleLastText||renderBootTitleIfAvailable(),ensureStemToggleBtn(),attachObservers()},200))}).observe(document.body,{childList:!0,subtree:!0})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot,{once:!0}):boot(),globalThis.cssmvRefreshMediaOverlays=function(){wireStyleShiftMenu(),ensureMvTitle(),wireMvTitleAutoHide(),ensureStemToggleBtn(),attachObservers(),restartAutoRotate()}})(),(function(){"use strict";if(window.__cssosDeadMediaInstalled)return;window.__cssosDeadMediaInstalled=!0;var STYLE_ID="cssmv-deadmedia-style";function injectStyle(){if(!document.getElementById(STYLE_ID)){var st=document.createElement("style");st.id=STYLE_ID,st.textContent=["#watch-panel .watch-screen .cssmv-deadmedia{","  position:absolute;inset:0;z-index:3;display:none;","  align-items:center;justify-content:center;flex-direction:column;gap:10px;","  background:radial-gradient(120% 120% at 50% 30%,","    color-mix(in srgb, var(--watch-frame-accent-1, #00f5a0) 22%, #0a1512) 0%,","    #0a1512 70%);","  pointer-events:none;text-align:center;padding:24px;","}","#watch-panel .watch-screen .cssmv-deadmedia.is-on{display:flex;}",".cssmv-deadmedia-logo{font-size:54px;line-height:1;filter:drop-shadow(0 2px 12px rgba(0,0,0,0.5));}",'.cssmv-deadmedia-text{font:700 17px/1.3 "Syne",system-ui,sans-serif;',"  color:rgba(255,255,255,0.92);letter-spacing:0.04em;text-shadow:0 1px 8px rgba(0,0,0,0.6);}",".cssmv-deadmedia-sub{font:500 12px/1.4 system-ui,sans-serif;color:rgba(255,255,255,0.62);max-width:240px;}"].join(`
`),document.head.appendChild(st)}}function screenEl(){return document.querySelector("#watch-panel .watch-screen")}function ensurePlaceholder(){var screen=screenEl();if(!screen)return null;var p=screen.querySelector(".cssmv-deadmedia");if(!p){injectStyle(),p=document.createElement("div"),p.className="cssmv-deadmedia";var t1="CSS Studio",sub="Preview unavailable — tap ✨ to make one like this";try{typeof globalThis.loginCopy=="function"?sub=globalThis.loginCopy("Preview unavailable — tap ✨ to make one like this"):typeof globalThis.tr=="function"&&(sub=globalThis.tr("Preview unavailable — tap ✨ to make one like this"))}catch{}p.innerHTML='<div class="cssmv-deadmedia-logo">🪞</div><div class="cssmv-deadmedia-text">'+t1+'</div><div class="cssmv-deadmedia-sub">'+sub+"</div>",screen.appendChild(p)}return p}function setPlaceholder(on){var p=ensurePlaceholder();p&&p.classList.toggle("is-on",!!on)}function videoHasPixels(v){return!!(v&&!v.error&&v.videoWidth>0&&v.style.display!=="none")}function svgHasPixels(s){return!!(s&&s.style.display!=="none"&&s.getAttribute("src")&&(s.naturalWidth>0||s.complete===!1))}function reassess(){var v=document.getElementById("watch-video"),s=document.getElementById("watch-svg"),videoOk=videoHasPixels(v),svgOk=!!(s&&s.naturalWidth>0&&s.style.display!=="none");if(videoOk||svgOk){setPlaceholder(!1);return}var videoLoading=!!(v&&v.currentSrc&&!v.error&&v.readyState<2&&v.style.display!=="none"),svgSrc=s&&s.getAttribute("src"),svgLoading=!!(svgSrc&&s&&!s.complete);if(!(videoLoading||svgLoading)){var videoDead=!v||v.error||!v.currentSrc||v.style.display==="none";videoDead&&!svgOk&&setPlaceholder(!0)}}function bind(){var v=document.getElementById("watch-video"),s=document.getElementById("watch-svg");v&&!v.__cssosDeadBound&&(v.__cssosDeadBound=!0,v.addEventListener("error",function(){try{v.style.display="none"}catch{}if(s)try{s.style.display=""}catch{}setTimeout(reassess,50)},!0),v.addEventListener("playing",function(){setPlaceholder(!1)}),v.addEventListener("loadeddata",function(){videoHasPixels(v)&&setPlaceholder(!1)})),s&&!s.__cssosDeadBound&&(s.__cssosDeadBound=!0,s.addEventListener("error",function(){setTimeout(reassess,50)},!0),s.addEventListener("load",function(){s.naturalWidth>0&&setPlaceholder(!1)}))}var pending=0;function schedule(){pending||(pending=setTimeout(function(){pending=0;try{bind(),reassess()}catch{}},400))}function boot(){bind();var host=document.getElementById("watch-panel")||document.body;try{var mo=new MutationObserver(schedule);mo.observe(host,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["src","style"]})}catch{}[600,1800,4e3].forEach(function(ms){setTimeout(function(){try{bind(),reassess()}catch{}},ms)})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot,{once:!0}):boot()})(),(function(){"use strict";if(document.getElementById("cssmv-watch-layout-p2100-styles"))return;const st=document.createElement("style");st.id="cssmv-watch-layout-p2100-styles",st.textContent=`
/* Equal padding on media frame */
#watch-panel .watch-frame { padding: 14px !important; }

/* Tabs: default hidden, ONLY reveal via info button click (+ auto-hide 3s) */
#watch-panel .watch-tabs {
  max-height: 0 !important;
  overflow: hidden !important;
  opacity: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  transition: max-height .25s ease, opacity .25s ease, padding .25s ease, margin .25s ease !important;
  pointer-events: none !important;
}
#watch-panel.cssmv-info-open .watch-tabs {
  max-height: 120px !important;
  opacity: 1 !important;
  overflow: visible !important;
  padding: 6px 0 !important;
  margin: 0 0 6px 0 !important;
  pointer-events: auto !important;
}

/* Default-hide ALL bottom-overlay chrome — only shown when info button is open */
#watch-panel .watch-frame-progress-copy,
#watch-panel .watch-frame-progress,
#watch-panel .watch-commerce-actions,
#watch-panel .watch-engine-grid,
#watch-panel .kara-runtime-board {
  display: none !important;
}
#watch-panel.cssmv-info-open .watch-frame-progress,
#watch-panel.cssmv-info-open .watch-commerce-actions,
#watch-panel.cssmv-info-open .watch-engine-grid,
#watch-panel.cssmv-info-open .kara-runtime-board {
  display: revert !important;
}

/* Jing 2026-04-25 #102r — soft slideshow fade for ✦ font reshuffle.
   When .cssmv-p2100-fade is present, the element transitions opacity
   smoothly. .cssmv-p2100-fading sets opacity:0; removing it fades back
   to 1. Each leg ≈400ms so total ≈800ms slideshow feel. */
#watch-panel .cssmv-p2100-fade {
  transition: opacity 0.42s cubic-bezier(0.4, 0, 0.2, 1) !important;
  will-change: opacity !important;
}
#watch-panel .cssmv-p2100-fading {
  opacity: 0 !important;
}
/* Per-glyph subtle pop-in so each new random font feels gentle, not a hard
   cut. Combined with the parent's opacity fade this gives a smooth
   "slideshow" feel. */
#watch-panel .cssmv-p2100-glyph {
  transition: filter 0.6s ease, transform 0.6s ease, opacity 0.6s ease !important;
}

/* CSSMV_STATUS_VS_SUBTITLE_SPLIT 20260425 #110 — Jing
 * "提示信息另外用一个新的标签，不要和普通字幕混在一起，不然会把孩子和
 *  脏水一起泼出去。即：保留普通字幕随机字体切换，另外添加一个标签显示
 *  输出信息."
 *
 * Previously I'd CSS-reset .watch-subtitle to plain text because it
 * was being repurposed for status messages ("CSS is composing…",
 * "KaraOKe MV · Painting the cover now", etc.). That nuked the real
 * subtitle styling (tone-/emotion-/style- variants in style.watch.css).
 *
 * New rule: .watch-subtitle is ONLY for actual subtitle text and keeps
 * its full design. Status messages go to a separate element
 * #watch-status-info that we inject below. The redirect is wired in
 * the JS block "STATUS-INFO REDIRECT" further down. The CSS reset is
 * gone — .watch-subtitle inherits its native style from style.watch.css.
 */
/* CSSOS_PHASE2_TITLE_BAR_LIVE_PCT 20260426 #128/#130 — Jing
   "请把Watch面板媒体框底部中间的输出信息（那里不再显示，留出位置显示普通字幕），
    移动到标题上"
   Status pill that used to float at bottom-center has moved to the panel
   title bar (driven by cssmvPipelineActiveStage in app.watch-ui.js).
   #watch-status-info is now invisible but still EXISTS because the
   redirect MutationObserver below uses it as a sink to strip
   status-shaped text out of #watch-subtitle. Keeping it
   display:none !important is load-bearing: removing the element entirely
   would force a refactor of the observer; hiding it keeps the
   side-channel intact while freeing the bottom-center for real subtitles. */
#watch-panel #watch-status-info,
#watch-panel #watch-status-info.is-active {
  display: none !important;
  opacity: 0 !important;
  pointer-events: none !important;
  position: absolute;
  left: -9999px;
  top: -9999px;
}

/* CSSMV_LYRIC_SINGLE_LINE 20260426 #120 — Jing
   "恢复普通字幕，不要多行显示，只能一句歌词一行显示，可以保留逐字随机切换。
    字幕标题保持多行显示。"
   Title (.cssmv-mv-title) keeps the multi-line heavy/light weight treatment.
   Karaoke lyric line (#watch-karaoke-line) and #watch-subtitle revert to
   single-line: each lyric phrase on its OWN line, ellipsis if it overflows
   the frame width. Per-glyph random fonts still apply via .cssmv-p2100-glyph. */
#watch-panel .cssmv-mv-title {
  white-space: normal !important;
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
  max-width: min(92%, 1100px) !important;
  line-height: 1.18 !important;
  max-height: 86% !important;
  overflow: hidden !important;
}
#watch-panel #watch-karaoke-line,
#watch-panel #watch-subtitle {
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  word-break: keep-all !important;
  overflow-wrap: normal !important;
  /* CSSOS_PHASE2_SUBTITLE_BOTTOM_LEFT 20260504 — Jing: shrink the
   * max-width so the bottom-left anchored subtitle leaves space on
   * the right for commerce / action chips and per-take pills. */
  max-width: min(62%, 720px) !important;
  line-height: 1.2 !important;
}
/* The karaoke line wraps each cue in .watch-karaoke-prev / -current /
   -next sub-rows. Each row stays single-line; the parent stack remains
   vertical (prev / current / next), but no row of lyrics ever wraps. */
#watch-panel #watch-karaoke-line .watch-karaoke-prev,
#watch-panel #watch-karaoke-line .watch-karaoke-current,
#watch-panel #watch-karaoke-line .watch-karaoke-next {
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  display: block !important;
  max-width: 100% !important;
}
/* Suppress the heavy/light multi-line wrap rows when they show up on
   the karaoke line. The .watch-karaoke-row class is emitted by the
   subtitle weight-wrap path; flatten them into inline-block so the
   row ends up on ONE line. */
#watch-panel #watch-karaoke-line .watch-karaoke-row {
  display: inline-block !important;
  white-space: nowrap !important;
}
#watch-panel .cssmv-mv-title .cssmv-p2100-glyph,
#watch-panel #watch-karaoke-line .cssmv-p2100-glyph,
#watch-panel #watch-subtitle .cssmv-p2100-glyph {
  display: inline-block !important;
}
/* When p2100 glyph spans are present, cap each glyph's font-size so heavy
   tokens (1em) never grow past the screen height proportionally. We scale
   via inline style in JS too, but provide a CSS clamp baseline. */
#watch-panel .cssmv-mv-title .cssmv-w-heavy {
  font-size: clamp(1em, 7vh, 4em) !important;
}
#watch-panel .cssmv-mv-title .cssmv-w-light {
  font-size: clamp(0.6em, 4.5vh, 2.4em) !important;
}
/* Heavy = bold lead. Light = smaller, dimmer. Force visibility because some
   parents (.cssmv-anim-glyph) had opacity:0 baseline; our spans need
   opacity:1 unconditionally. */
#watch-panel .cssmv-p2100-glyph {
  opacity: 1 !important;
  visibility: visible !important;
  display: inline-block !important;
  animation: none !important;
  color: inherit !important;
}
#watch-panel .cssmv-w-heavy {
  font-weight: 800 !important;
  font-size: 1em !important;
  letter-spacing: 0.01em !important;
  opacity: 1 !important;
}
#watch-panel .cssmv-w-light {
  font-weight: 400 !important;
  font-size: 0.66em !important;
  opacity: 0.7 !important;
  letter-spacing: 0.02em !important;
}
/* Title random-position rule — only on .cssmv-mv-title (song title), NOT
   on .watch-subtitle (status text). */
#watch-panel .cssmv-mv-title {
  max-width: min(92%, 1100px) !important;
}

/* Vertical writing mode for CJK-dominant text (Jing 2026-04-25 #102h —
   "对于中文/日文/韩文等方块字的字幕标题，甚至可以竖排"). When applied, the
   <br> emitted between heavy/light groups becomes a column break — runs of
   CJK chars stack vertically and weight groups split into adjacent columns. */
#watch-panel .cssmv-p2100-vertical-rl {
  writing-mode: vertical-rl !important;
  -webkit-writing-mode: vertical-rl !important;
  text-orientation: upright !important;
  -webkit-text-orientation: upright !important;
  max-height: 80% !important;
  margin: 0 auto !important;
}
#watch-panel .cssmv-p2100-vertical-lr {
  writing-mode: vertical-lr !important;
  -webkit-writing-mode: vertical-lr !important;
  text-orientation: upright !important;
  -webkit-text-orientation: upright !important;
  max-height: 80% !important;
  margin: 0 auto !important;
}
#watch-panel .cssmv-p2100-vertical-rl .cssmv-p2100-glyph,
#watch-panel .cssmv-p2100-vertical-lr .cssmv-p2100-glyph {
  display: block !important;
  /* In vertical mode, each glyph takes its own line naturally; the explicit
     <br>s become column breaks. */
}
/* Info popover — anchored BELOW .watch-frame, full width of frame */
.cssmv-info-popover-fixed {
  /* keep position: fixed default for fullscreen, but reposition will set
     left/top below the frame's bottom edge */
}

/* Aggressive spacing inside .watch-screen too — the ENJOY/LISTEN/BUYOUT/TIP
   buttons + WORK COST BILL row + "No matched billable..." line + Privileged
   preview text all sit overlaid on the video. They need their own gaps. */
#watch-panel.cssmv-info-open .watch-screen > * {
  margin-block: 14px !important;
}
#watch-panel.cssmv-info-open .watch-screen .watch-commerce-actions {
  display: flex !important;
  flex-wrap: wrap !important;
  justify-content: center !important;
  gap: 16px !important;
  padding: 14px 0 !important;
}
#watch-panel.cssmv-info-open .watch-screen .watch-commerce-actions > * {
  margin: 6px !important;
}

/* Bottom info chrome spacing when info is open (Jing #102j) — apply layout
   gaps to every top-level descendant inside the frame area so cards don't
   clump together. Generic stretch + gap so any structure stays readable. */
#watch-panel.cssmv-info-open .watch-pane.active { gap: 24px !important; }
#watch-panel.cssmv-info-open .watch-pane.active > * { margin-block: 16px !important; }
#watch-panel.cssmv-info-open .watch-frame-progress { margin: 22px 0 !important; padding: 16px 0 !important; }
#watch-panel.cssmv-info-open .watch-frame-progress-copy { padding: 10px 0 !important; }
#watch-panel.cssmv-info-open .watch-commerce-actions {
  margin: 22px 0 !important;
  gap: 18px !important;
  display: flex !important;
  flex-wrap: wrap !important;
  justify-content: center !important;
  padding: 12px 0 !important;
}
#watch-panel.cssmv-info-open .watch-commerce-actions > * { margin: 8px !important; }
#watch-panel.cssmv-info-open .watch-engine-grid { margin: 26px 0 !important; gap: 18px !important; padding: 14px 0 !important; }
/* Jing 2026-04-25 #102p — kara-runtime cards (CURRENT STAGE / STRUCTURE /
   SUBTITLE LOAD): gap between SIBLING cards = 12px; gap between the BLACK
   info-popover and the FIRST card = also 12px (was 26px+ — too far). */
#watch-panel.cssmv-info-open .kara-runtime-board {
  margin: 12px 0 !important;
  padding: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
}
.kara-runtime-board { display: flex !important; flex-direction: column !important; gap: 12px !important; }
.kara-runtime-card { margin: 0 !important; }
.kara-runtime-card + .kara-runtime-card { margin-top: 0 !important; }
.kara-runtime-board > * { margin: 0 !important; }
/* The .cssmv-info-popover-fixed sits at top:(frame.bottom + 8). The first
   card after it should sit close — match the 12px sibling spacing. */
body > .cssmv-info-popover-fixed { margin-bottom: 12px !important; }
#watch-panel.cssmv-info-open .watch-info-card { margin: 22px 0 !important; padding: 14px 18px !important; }
#watch-panel.cssmv-info-open .watch-screen-backdrop { padding-bottom: 16px !important; }
.cssmv-info-popover-fixed { padding: 16px 18px !important; line-height: 1.65 !important; gap: 12px !important; }

/* ================================================================
   Jing 2026-04-25 #102v — Advanced Settings panel cleanup:
   • Hide "设为默认" button (values are random/derived, not user-fixed)
   • Empty hardcoded duration default ("180" placeholder) — duration is
     auto-derived from lyrics output
   • Empty hardcoded music-style / vocal-style / instrumentation /
     ensemble pre-fills — these come from civilization-driven random
   ================================================================ */
#creation-set-defaults { display: none !important; }
/* ================================================================
   Jing 2026-04-25 #102n — For You / Works Center card spacing +
   pointer cursor + click-to-switch fix.
   ================================================================ */
#foryou-panel .work-card,
#foryou-panel .foryou-card,
#works-panel .work-card,
#works-panel .works-card,
#works-panel .works-section .work-card,
.foryou-works-list .work-card,
.works-grid .work-card {
  margin: 14px 0 !important;
  padding: 14px !important;
  border-radius: 14px !important;
  cursor: pointer !important;
  transition: transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease !important;
}
#foryou-panel .work-card:hover,
#foryou-panel .foryou-card:hover,
#works-panel .work-card:hover,
.foryou-works-list .work-card:hover,
.works-grid .work-card:hover {
  cursor: pointer !important;
  transform: translateY(-2px) !important;
  background: rgba(218,255,242,0.08) !important;
  border-color: rgba(218,255,242,0.55) !important;
  box-shadow: 0 8px 28px rgba(0,245,160,0.16), 0 0 0 1px rgba(218,255,242,0.45) !important;
}
/* Section wrappers in Works Center should also have breathing room */
#works-panel .works-section { margin: 22px 0 !important; padding: 12px 0 !important; }
#works-panel .works-section + .works-section { border-top: 1px solid rgba(218,255,242,0.12); }
/* Make sure inner thumb / meta / actions inherit the pointer so the whole
   card surface feels tappable, not just the Enjoy button. */
.foryou-works-list .work-card *, .works-grid .work-card * { cursor: pointer !important; }
/* But keep buttons themselves explicit so their text stays readable */
.foryou-works-list .work-card button, .works-grid .work-card button { cursor: pointer !important; }

/* 4 bottom-right buttons, all transparent default */
#watch-panel .cssmv-stem-toggle {
  top: auto !important; bottom: 14px !important; right: 172px !important;
  background: transparent !important; border-color: transparent !important;
  box-shadow: none !important; backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important; opacity: 0 !important;
  transition: opacity .22s ease, transform .22s ease, background .22s ease, border-color .22s ease, box-shadow .22s ease !important;
}
#watch-panel #watch-style-shift {
  top: auto !important; bottom: 14px !important; right: 120px !important;
  background: transparent !important; border-color: transparent !important;
  box-shadow: none !important; backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important; opacity: 0 !important;
  transition: opacity .22s ease, transform .22s ease, background .22s ease, border-color .22s ease !important;
}
.cssmv-fr-btn {
  position: absolute; bottom: 14px; z-index: 8;
  width: 44px; height: 44px;
  display: grid; place-items: center;
  border-radius: 999px;
  border: 1px solid transparent; background: transparent;
  color: rgba(242,255,248,0.98);
  font-family: "CSSTitleBoldC","Syne",system-ui,sans-serif;
  font-size: 18px; line-height: 1;
  cursor: pointer; opacity: 0; pointer-events: auto;
  transition: opacity .22s ease, transform .22s ease, background .22s ease, border-color .22s ease;
  user-select: none; -webkit-user-select: none;
}
.cssmv-info-btn { right: 68px; font-style: italic; font-weight: 600; font-size: 20px; }
.cssmv-fs-btn   { right: 14px; font-size: 19px; }

#watch-panel .watch-screen:hover .cssmv-stem-toggle,
#watch-panel .watch-screen:focus-within .cssmv-stem-toggle,
#watch-panel .watch-screen:hover #watch-style-shift,
#watch-panel .watch-screen:focus-within #watch-style-shift,
.watch-screen:hover .cssmv-fr-btn,
.watch-screen:focus-within .cssmv-fr-btn { opacity: 0.72 !important; }

#watch-panel .cssmv-stem-toggle:hover, #watch-panel .cssmv-stem-toggle:focus-visible,
#watch-panel #watch-style-shift:hover, #watch-panel #watch-style-shift:focus-visible,
.cssmv-fr-btn:hover, .cssmv-fr-btn:focus-visible, .cssmv-info-btn.is-open {
  opacity: 1 !important; transform: scale(1.05) !important;
  background: linear-gradient(180deg, rgba(7,14,12,0.42), rgba(5,10,9,0.24)) !important;
  border-color: rgba(218,255,242,0.55) !important;
  backdrop-filter: blur(12px) saturate(1.08) !important;
  -webkit-backdrop-filter: blur(12px) saturate(1.08) !important;
  box-shadow: 0 0 24px rgba(0,245,160,0.16), 0 0 52px rgba(11,247,255,0.08) !important;
}

#watch-panel.is-cssmv-fullscreen {
  /* CSSOS_WAVE_351 z-index 收敛: 99999 → 10052 (watch fullscreen sits just
     above watch base 10050, and crucially BELOW cinema-stage 10060 so
     Create MV always covers a fullscreen watch — the W343 bug). */
  position: fixed !important; inset: 0 !important; z-index: 10052 !important;
  width: 100vw !important; height: 100vh !important;
  max-width: none !important; max-height: none !important;
}
/* Jing 2026-04-25 #102l — TRUE fullscreen vertical centering. Strip ALL
   padding/margin/min-height from every container in the chain, hide every
   sibling that's NOT the active pane (kara-progress-shell, watch-tabs,
   etc), and put the .watch-pane.active directly under the panel header
   filling 100vh - header. Frame uses align-items:center; justify-content:
   center so the .watch-screen sits dead-center vertically. */
#watch-panel.is-cssmv-fullscreen .panel-body,
#watch-panel.is-cssmv-fullscreen .watch-body {
  width: 100vw !important;
  max-width: 100vw !important;
  height: calc(100vh - 52px) !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  overflow: hidden !important;
}
/* Hide every direct child of .watch-body that isn't the active pane —
   kills empty <div class="watch-tabs"> reserved space, hidden but not
   display:none progress shells, etc. */
#watch-panel.is-cssmv-fullscreen .watch-body > *:not(.watch-pane) {
  display: none !important;
}
#watch-panel.is-cssmv-fullscreen .watch-pane { display: none !important; }
#watch-panel.is-cssmv-fullscreen .watch-pane.active {
  display: flex !important;
  width: 100vw !important;
  max-width: 100vw !important;
  height: calc(100vh - 52px) !important;
  min-height: calc(100vh - 52px) !important;
  margin: 0 !important;
  padding: 0 !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
}
/* Hide auxiliary children of the active pane (engine-progress-shell,
   engine-grid, runtime-board) when info is closed — they otherwise add
   empty rows that shift the frame upward. */
#watch-panel.is-cssmv-fullscreen .watch-pane.active > *:not(.watch-frame) {
  display: none !important;
}
#watch-panel.is-cssmv-fullscreen.cssmv-info-open .watch-pane.active > * {
  display: revert !important;
}
#watch-panel.is-cssmv-fullscreen .watch-frame {
  width: 100vw !important;
  max-width: 100vw !important;
  margin: 0 !important;
  padding: 0 !important;
  /* center the screen if it's shorter than the viewport */
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
#watch-panel.is-cssmv-fullscreen .watch-screen {
  width: 100vw !important;
  height: auto !important;
  /* If the screen has its own aspect-ratio set (16/9, 21/9, 32/9, …) the
     browser computes height = width / aspect. We clamp height so it never
     overflows the viewport — when clamped, max-height wins and width
     auto-shrinks back to keep the aspect ratio. */
  max-width: 100vw !important;
  max-height: calc(100vh - 52px) !important;
  margin: 0 !important;
  /* Force the picker's chosen ratio (overridden inline by JS below) */
}
/* Inner video / image must FILL the screen — no left-right whitespace, no
   distortion. Cropping is acceptable (cover semantics), per Jing 2026-04-25:
   "撑满屏幕的左右，不要左右留白，封面图也不能变形，只要撑满左右，能显示多少
    就显示多少". The cover slideshow div (.cssmv-cover-slide) uses
   background-size: cover from app.cover-slideshow.js — keep it consistent. */
#watch-panel.is-cssmv-fullscreen .watch-video,
#watch-panel.is-cssmv-fullscreen .watch-svg,
#watch-panel.is-cssmv-fullscreen .watch-screen-backdrop {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
#watch-panel.is-cssmv-fullscreen .cssmv-cover-slide {
  background-size: cover !important;
  background-position: center !important;
}

/* CSSMV_COVER_FILL_VW 20260425 #102 — Jing
   Even outside fullscreen, the cover (placeholder before video plays) must
   fill the available media-frame width responsively. The base watch-screen
   already has width:100% + aspect-ratio:16/9, but if any parent has padding
   we want zero on left/right so the cover hugs the viewport. */
#watch-panel:not(.is-cssmv-fullscreen) .watch-frame {
  padding-left: 14px !important;
  padding-right: 14px !important;
}
#watch-panel:not(.is-cssmv-fullscreen) .watch-screen {
  width: 100% !important;
  max-width: 100% !important;
}
#watch-panel:not(.is-cssmv-fullscreen) .watch-svg,
#watch-panel:not(.is-cssmv-fullscreen) .watch-video,
#watch-panel:not(.is-cssmv-fullscreen) .cssmv-cover-slide {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  background-size: cover !important;
  background-position: center !important;
}

/* Music tab: art disc + music-stage host should fill horizontally too —
   the art image inside #watch-music-art uses background-size: cover already
   but the disc itself was capped. Keep cropping behaviour, just make sure
   the host fills its container left-right. */
#watch-panel .watch-music-stage,
#watch-panel .watch-music-ring {
  width: 100% !important;
  max-width: 100% !important;
}
#watch-panel .watch-music-art,
#watch-panel.is-cssmv-fullscreen .watch-music-art {
  background-size: cover !important;
  background-position: center !important;
}

/* Info popover lives in document.body with fixed positioning so nothing can trap it */
.cssmv-info-popover-fixed {
  position: fixed;
  max-width: 380px; min-width: 220px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(5,10,9,0.92);
  border: 1px solid rgba(218,255,242,0.38);
  backdrop-filter: blur(16px) saturate(1.1);
  -webkit-backdrop-filter: blur(16px) saturate(1.1);
  color: rgba(242,255,248,0.96);
  font-size: 13px; line-height: 1.5;
  white-space: pre-wrap;
  opacity: 0; pointer-events: none;
  transform: translateY(6px);
  transition: opacity .16s ease, transform .16s ease;
  z-index: 2147483647; /* max int32 — above fullscreen overlays */
  box-shadow: 0 12px 40px rgba(0,0,0,0.6);
}
.cssmv-info-popover-fixed.is-open { opacity: 1; transform: translateY(0); pointer-events: auto; }

/* WAVE_445 20260526 — Portrait / mobile subtitle safe-zone fix.
 * On a 390px phone, min(62%, 720px) = 241px — far too narrow. Most
 * subtitle lines exceed that and get clipped by text-overflow:ellipsis,
 * making it look like words dropped off. Fix: use almost the full screen
 * width. Font-size auto-fit is handled by the JS fitSubtitleFont() below. */
@media (orientation: portrait), (max-width: 540px) {
  #watch-panel #watch-subtitle {
    max-width: calc(100vw - 48px) !important;
    /* left is 32px (style.css anchor); right clearance 16px */
    font-size: clamp(11px, 3.8vw, 16px) !important;
  }
}
`,document.head.appendChild(st),(function(){var FONT_STEPS=[18,16,15,14,13,12,11,10],raf=null;function fitSubtitleFont(){var el=document.getElementById("watch-subtitle");if(el){var isNarrow=window.matchMedia&&(window.matchMedia("(orientation: portrait)").matches||window.matchMedia("(max-width: 540px)").matches);if(!isNarrow){el.style.removeProperty("font-size");return}el.style.removeProperty("font-size");for(var i=0;i<FONT_STEPS.length&&!(el.scrollWidth<=el.offsetWidth+2);i++)el.style.fontSize=FONT_STEPS[i]+"px"}}function schedFit(){raf&&cancelAnimationFrame(raf),raf=requestAnimationFrame(function(){raf=null,fitSubtitleFont()})}function attachObserver(){var target=document.getElementById("watch-subtitle");if(target){var obs=new MutationObserver(schedFit);obs.observe(target,{childList:!0,characterData:!0,subtree:!0}),schedFit()}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",attachObserver,{once:!0}):attachObserver(),window.addEventListener("orientationchange",function(){setTimeout(schedFit,200)},{passive:!0}),window.addEventListener("resize",schedFit,{passive:!0})})();function primeFontMode(){try{const KEY="cssmv.watchFontPerTokenMode",cur=(localStorage.getItem(KEY)||"").trim().toLowerCase();(!cur||cur==="off")&&localStorage.setItem(KEY,"word");const KEYP="cssmv.watchFontPerTokenPreset";(localStorage.getItem(KEYP)||"").trim().toLowerCase()||localStorage.setItem(KEYP,"chaos")}catch{}}primeFontMode();const LATIN_FONTS=["Georgia, serif","'Times New Roman', serif","'Courier New', monospace","Impact, sans-serif","'Arial Black', sans-serif","'Trebuchet MS', sans-serif","'Brush Script MT', cursive","Verdana, sans-serif","Palatino, serif","Garamond, serif","Tahoma, sans-serif","'Lucida Sans', sans-serif","'Comic Sans MS', cursive"],CJK_FONTS=["'PingFang SC', sans-serif","'PingFang TC', sans-serif","'STSong', serif","'STKaiti', cursive","'STFangsong', serif","'Heiti SC', sans-serif","'Hiragino Sans GB', sans-serif","'KaiTi', cursive","'FangSong', serif","'Microsoft YaHei', sans-serif","'SimSun', serif","'SimHei', sans-serif"],CJK_RE=/[　-鿿豈-﫿぀-ヿ가-힯]/,LIGHT_CN=new Set("的了和与是在一就不也都而或若之以为被所其而且然但虽则若您下上中前后里外内这那什么又还吗呢吧呀啊哦嗯哈嘿哟唉".split("")),LIGHT_EN=new Set(["a","an","the","of","in","on","at","to","for","by","with","and","or","but","is","am","are","was","were","be","been","being","my","your","his","her","its","our","their","this","that","these","those","i","we","you","he","she","it","they","do","does","did","not","no","yes","so","as","if","than","then","when","while","because","just","also","very"]);function pieceWeight(p){if(!p||/^\s+$/.test(p))return"ws";if(CJK_RE.test(p))return p.length===1&&LIGHT_CN.has(p)?"light":"heavy";const lw=p.toLowerCase();return LIGHT_EN.has(lw)||lw.length<=2?"light":"heavy"}function escapeHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function tokenize(text){const out=[];let buf="",bufKind=null;function flush(){buf&&(out.push(buf),buf="",bufKind=null)}for(const ch of String(text||"")){const isSpace=/\s/.test(ch),isCjk=CJK_RE.test(ch);if(isSpace){flush(),out.push(ch);continue}if(isCjk){flush(),out.push(ch);continue}bufKind&&bufKind!=="latin"&&flush(),buf+=ch,bufKind="latin"}return flush(),out}let __p2100PoolCache=null,__p2100PoolStamp=0;function loadPools(){const now=Date.now();if(__p2100PoolCache&&now-__p2100PoolStamp<2e3)return __p2100PoolCache;let cjk=[],latin=[],latinExt=[];function ingest(family,hint,external){const fam=String(family||"").trim();if(!fam)return;const h=String(hint||""),isCjk=!(/fonts_en\/|\/en\/|latin|english|^en$/i.test(h)||/^[\x20-\x7E]+$/.test(fam)&&!CJK_RE.test(fam))&&(/cjk|fonts_cn|\/cn\/|\/zh\/|\/kr\/|\/jp\//i.test(h)||h.startsWith("fonts/")&&!h.startsWith("fonts_en")||CJK_RE.test(fam)),css="'"+fam.replace(/'/g,"\\'")+"', sans-serif";isCjk?cjk.push(css):(latin.push(css),external&&latinExt.push(css))}function isExternalEntry(e){return!!e&&(e.format==="external"||!e.src&&(e.group==="latin"||e.group==="external"))}try{const fn=globalThis.buildWatchFontCatalogModule;if(typeof fn=="function"){const entries=fn()||[];for(const e of entries)ingest(e?.family,e?.group||e?.src,isExternalEntry(e))}}catch{}try{const m=globalThis.CSSOS_WATCH_FONT_MANIFEST;if(Array.isArray(m))for(const e of m)ingest(e?.family,e?.src||e?.group,isExternalEntry(e))}catch{}if(latinExt.length&&(latin=latinExt),latin.length===0)for(const f of LATIN_FONTS)latin.push(f);if(cjk.length===0)for(const f of CJK_FONTS)cjk.push(f);return cjk=Array.from(new Set(cjk)),latin=Array.from(new Set(latin)),__p2100PoolCache={cjk,latin},__p2100PoolStamp=now,__p2100PoolCache}const __p2100FontReady=new Map;function isFontReady(css){if(__p2100FontReady.has(css))return __p2100FontReady.get(css);let ok=!0;try{const m=css.match(/^'([^']+)'/)||css.match(/^"([^"]+)"/),fam=m?m[1]:css.split(",")[0].trim().replace(/^['"]|['"]$/g,"");fam&&document.fonts&&document.fonts.check&&(ok=document.fonts.check("16px '"+fam+"'"))}catch{ok=!0}return __p2100FontReady.set(css,ok),ok}function pickFont(piece){const{cjk,latin}=loadPools(),pool=CJK_RE.test(piece)?cjk.length?cjk:latin:latin.length?latin:cjk;return pool.length?pool[Math.floor(Math.random()*pool.length)]:"sans-serif"}try{globalThis.cssosPickFontForChar=pickFont}catch{}function prewarmFontBatch(){}function buildWeightedHtml(pieces,opts){const skipBr=!!(opts&&opts.skipBr);let html="",prevW=null;html+='<span class="cssmv-anim-glyph cssmv-p2100-marker" aria-hidden="true" style="display:none;width:0;height:0;"></span>';for(let i=0;i<pieces.length;i++){const p=pieces[i],w=pieceWeight(p);if(w==="ws"){html+=escapeHtml(p);continue}!skipBr&&prevW&&prevW!==w&&(prevW==="heavy"||prevW==="light")&&(html+="<br>");const fam=pickFont(p),safe=escapeHtml(p),cls="cssmv-p2100-glyph cssmv-w-"+w;html+=`<span class="${cls}" style="font-family:${fam};opacity:1;">${safe}</span>`,prevW=w}return html}function applyShuffle(el,opts){if(!el)return;const text=(el.textContent||"").trim();if(!text)return;const animate=!!(opts&&opts.animate);if(opts&&opts.recover&&el.__cssmvShuffleSnap&&el.__cssmvShuffleSnap.text===text){const s=el.__cssmvShuffleSnap;el.innerHTML=s.html,el.style.textAlign=s.align||"",el.classList.remove("cssmv-p2100-vertical-rl","cssmv-p2100-vertical-lr"),s.vClass&&el.classList.add(s.vClass);return}function writeContent(){const pieces=tokenize(text),isTitle=el.classList&&el.classList.contains("cssmv-mv-title");el.innerHTML=buildWeightedHtml(pieces,{skipBr:!isTitle});const aligns=["left","center","right"];el.style.textAlign=aligns[Math.floor(Math.random()*aligns.length)];let cjkCount=0,totalCount=0;for(const ch of text)/\s/.test(ch)||(totalCount++,CJK_RE.test(ch)&&cjkCount++);const cjkRatio=totalCount?cjkCount/totalCount:0;if(el.classList.remove("cssmv-p2100-vertical-rl","cssmv-p2100-vertical-lr"),isTitle&&cjkRatio>=.6&&Math.random()<.4){const cls=Math.random()<.5?"cssmv-p2100-vertical-rl":"cssmv-p2100-vertical-lr";el.classList.add(cls)}el.__cssmvShuffleSnap={text,html:el.innerHTML,align:el.style.textAlign||"",vClass:el.classList.contains("cssmv-p2100-vertical-rl")?"cssmv-p2100-vertical-rl":el.classList.contains("cssmv-p2100-vertical-lr")?"cssmv-p2100-vertical-lr":""}}function fitTitleToFrame(){if(!el.classList.contains("cssmv-mv-title"))return;const screen=el.closest(".watch-screen");if(!screen)return;const screenH=screen.clientHeight||600,screenW=screen.clientWidth||360;requestAnimationFrame(function(){try{el.style.transform="",el.style.transformOrigin="";const usedH=el.scrollHeight||el.offsetHeight||0,usedW=el.scrollWidth||el.offsetWidth||0,capH=Math.floor(screenH*.86),capW=Math.floor(screenW*.96);let scale=1;usedH>capH&&capH>80&&(scale=Math.min(scale,capH/usedH)),usedW>capW&&capW>80&&(scale=Math.min(scale,capW/usedW)),scale=Math.max(.4,scale),scale<.999&&(el.style.transform="scale("+scale.toFixed(3)+")",el.style.transformOrigin="center center")}catch{}})}if(!animate){writeContent(),fitTitleToFrame();return}el.classList.add("cssmv-p2100-fade"),el.offsetHeight,el.classList.add("cssmv-p2100-fading"),setTimeout(function(){writeContent(),fitTitleToFrame(),requestAnimationFrame(function(){requestAnimationFrame(function(){el.classList.remove("cssmv-p2100-fading")})})},420)}function forceShuffle(opts){const title=document.querySelector(".cssmv-mv-title");title&&applyShuffle(title,opts);const kara=document.getElementById("watch-karaoke-line");kara&&!kara.querySelector(".watch-karaoke-word")&&!kara.querySelector(".watch-karaoke-current, .watch-karaoke-prev, .watch-karaoke-next")&&applyShuffle(kara,opts)}function wireStarBtnExtra(){const btn=document.getElementById("watch-style-shift");btn&&!btn.dataset.cssmvP2100Wired&&(btn.dataset.cssmvP2100Wired="1",btn.addEventListener("click",function(){setTimeout(()=>forceShuffle({animate:!0}),30)},!1))}let infoBtn,fsBtn;const infoPopover=document.createElement("div");infoPopover.className="cssmv-info-popover-fixed",infoPopover.setAttribute("role","tooltip");function appendPopoverToBody(){infoPopover.parentNode!==document.body&&document.body&&document.body.appendChild(infoPopover)}function pickInfoSource(){const parts=[],progCopy=document.getElementById("watch-frame-progress-copy");progCopy&&progCopy.textContent.trim()&&parts.push(progCopy.textContent.trim());const subtitle=document.getElementById("watch-subtitle");subtitle&&subtitle.textContent.trim()&&parts.push(subtitle.textContent.trim());const kara=document.getElementById("watch-karaoke-line");return kara&&kara.textContent.trim()&&parts.push(kara.textContent.trim()),parts.join(`

`)||"—"}function positionPopover(){const screen=document.querySelector("#watch-panel .watch-screen"),frame=document.querySelector("#watch-panel .watch-frame"),target=screen||frame;if(!target)return;const rect=target.getBoundingClientRect(),vw=window.innerWidth||document.documentElement.clientWidth;let left=rect.left,width=rect.width,top=rect.bottom+8;const popH=infoPopover.offsetHeight||200,vh=window.innerHeight||document.documentElement.clientHeight;top+popH>vh-8&&(top=Math.max(8,vh-popH-8)),width>=vw-4&&(width=Math.min(720,vw-32),left=(vw-width)/2),infoPopover.style.left=left+"px",infoPopover.style.width=width+"px",infoPopover.style.maxWidth=width+"px",infoPopover.style.top=top+"px"}let infoIdleTimer=null;function clearIdle(){infoIdleTimer&&(clearTimeout(infoIdleTimer),infoIdleTimer=null)}function armIdle(){clearIdle(),infoIdleTimer=setTimeout(function(){closeInfo()},3e3)}function openInfo(){if(!infoBtn)return;infoPopover.textContent=pickInfoSource(),infoBtn.classList.add("is-open"),infoPopover.classList.add("is-open");const panel=document.getElementById("watch-panel");panel&&panel.classList.add("cssmv-info-open"),requestAnimationFrame(positionPopover),armIdle()}function closeInfo(){clearIdle(),infoBtn&&infoBtn.classList.remove("is-open"),infoPopover.classList.remove("is-open");const panel=document.getElementById("watch-panel");panel&&panel.classList.remove("cssmv-info-open")}function bumpIdleIfOpen(){infoPopover.classList.contains("is-open")&&armIdle()}function toggleInfo(e){e&&(e.preventDefault(),e.stopPropagation()),infoPopover.classList.contains("is-open")?closeInfo():openInfo()}document.addEventListener("click",function(e){infoPopover.classList.contains("is-open")&&(infoBtn&&(e.target===infoBtn||infoBtn.contains(e.target))||e.target===infoPopover||infoPopover.contains(e.target)||closeInfo())}),window.addEventListener("scroll",function(){infoPopover.classList.contains("is-open")&&positionPopover()},!0),window.addEventListener("resize",function(){infoPopover.classList.contains("is-open")&&positionPopover()});function installButtons(){const screen=document.querySelector("#watch-panel .watch-screen");if(!screen)return!1;if(screen.querySelector(".cssmv-info-btn"))return!0;infoBtn=document.createElement("button"),infoBtn.type="button",infoBtn.className="cssmv-fr-btn cssmv-info-btn",infoBtn.setAttribute("aria-label","Info"),infoBtn.textContent="i",infoBtn.addEventListener("click",function(e){e&&typeof e.stopPropagation=="function"&&e.stopPropagation(),toggleInfo()}),fsBtn=document.createElement("button"),fsBtn.type="button",fsBtn.className="cssmv-fr-btn cssmv-fs-btn",fsBtn.setAttribute("aria-label","Fullscreen"),fsBtn.textContent="⛶";function applyScreenAspectRatio(){const screen2=document.querySelector("#watch-panel .watch-screen");if(!screen2)return;let aspect="16 / 9";try{const cs=globalThis.creationState,ar=cs&&(cs.aspectRatio||cs.aspect_ratio||cs.aspect);if(typeof ar=="string"){const m=ar.match(/^\s*([\d.]+)\s*[:\/x×]\s*([\d.]+)\s*$/);m&&(aspect=`${m[1]} / ${m[2]}`)}else cs&&cs.outputWidth&&cs.outputHeight&&(aspect=`${cs.outputWidth} / ${cs.outputHeight}`)}catch{}screen2.style.aspectRatio=aspect}fsBtn.addEventListener("click",async function(e){e.preventDefault(),e.stopPropagation();const panel=document.getElementById("watch-panel");if(!panel)return;var isApp314=!1;try{isApp314=document.documentElement.classList.contains("cssos-app")}catch{}const inFS=!!document.fullscreenElement;try{if(isApp314){applyScreenAspectRatio();var nowOn=!panel.classList.contains("is-cssmv-fullscreen");panel.classList.toggle("is-cssmv-fullscreen",nowOn),document.body.classList.toggle("cssos-cinema-mode",nowOn),nowOn||document.body.classList.remove("cssos-watch-theater","cssos-watch-idle");return}inFS?(await document.exitFullscreen(),panel.classList.remove("is-cssmv-fullscreen"),document.body.classList.remove("cssos-cinema-mode","cssos-watch-theater","cssos-watch-idle")):panel.requestFullscreen?(applyScreenAspectRatio(),await panel.requestFullscreen(),panel.classList.add("is-cssmv-fullscreen"),document.body.classList.add("cssos-cinema-mode")):(applyScreenAspectRatio(),panel.classList.toggle("is-cssmv-fullscreen"),document.body.classList.toggle("cssos-cinema-mode",panel.classList.contains("is-cssmv-fullscreen")))}catch{applyScreenAspectRatio(),panel.classList.toggle("is-cssmv-fullscreen"),document.body.classList.toggle("cssos-cinema-mode",panel.classList.contains("is-cssmv-fullscreen"))}setTimeout(function(){infoPopover.classList.contains("is-open")&&positionPopover()},100)}),window.__cssmvResizeAspectBound||(window.__cssmvResizeAspectBound=!0,window.addEventListener("resize",function(){const panel=document.getElementById("watch-panel");panel&&panel.classList.contains("is-cssmv-fullscreen")&&applyScreenAspectRatio()},{passive:!0})),document.addEventListener("fullscreenchange",function(){}),globalThis.cssosEnterCinemaLayout||(globalThis.cssosEnterCinemaLayout=function(){const panel=document.getElementById("watch-panel");if(panel&&!panel.classList.contains("is-cssmv-fullscreen")){try{applyScreenAspectRatio()}catch{}panel.classList.add("is-cssmv-fullscreen"),document.body.classList.add("cssos-cinema-mode")}}),globalThis.cssosRequestBrowserFullscreen||(globalThis.cssosRequestBrowserFullscreen=async function(){const panel=document.getElementById("watch-panel");if(!panel)return;const _ua=String(navigator?.userAgent||"").toLowerCase(),_isVisionOS=/vision\s?os|xros|applevision|vision pro|\bvision\b/.test(_ua);let _immersiveNative=!1;try{var _qs=String(location.search||"");if(/[?&]immersive=css\b/.test(_qs))try{localStorage.setItem("cssos.immersive.forcecss","1"),localStorage.removeItem("cssos.immersive.native")}catch{}else if(/[?&]immersive=1\b/.test(_qs))try{localStorage.setItem("cssos.immersive.native","1"),localStorage.removeItem("cssos.immersive.forcecss")}catch{}else if(/[?&]immersive=0\b/.test(_qs))try{localStorage.removeItem("cssos.immersive.native"),localStorage.removeItem("cssos.immersive.forcecss")}catch{}try{if(localStorage.getItem("cssos.immersive.forcecss")==="1")return}catch{}_immersiveNative=localStorage.getItem("cssos.immersive.native")==="1"}catch{}try{if(document.documentElement.classList.contains("cssos-app"))return}catch{}if(!_immersiveNative)try{if(/iphone|ipod|ipad/.test(_ua)||/macintosh/.test(_ua)&&typeof navigator?.maxTouchPoints=="number"&&navigator.maxTouchPoints>1||_isVisionOS)return}catch{}if(document.fullscreenElement)return;const v=document.getElementById("watch-video"),a=document.getElementById("watch-audio-preview"),snap={vMuted:v?.muted,vVolume:v?.volume,aMuted:a?.muted,aVolume:a?.volume},restore=()=>{try{v&&snap.vMuted!==void 0&&(v.muted=snap.vMuted,typeof snap.vVolume=="number"&&(v.volume=snap.vVolume)),a&&snap.aMuted!==void 0&&(a.muted=snap.aMuted,typeof snap.aVolume=="number"&&(a.volume=snap.aVolume))}catch{}};try{const fn=panel.requestFullscreen||panel.webkitRequestFullscreen||panel.mozRequestFullScreen||panel.msRequestFullscreen;var _uaFs=typeof navigator<"u"&&navigator.userActivation,_noGestureFs=!!(_uaFs&&_uaFs.isActive===!1);fn&&!_noGestureFs&&await fn.call(panel),[50,200,600,1200,2500].forEach(function(ms){setTimeout(restore,ms)}),[v,a].filter(Boolean).forEach(function(el){var onMute=function(){el.muted!==!1&&(snap.vMuted===!1||snap.aMuted===!1)&&restore()};el.addEventListener("volumechange",onMute),setTimeout(function(){el.removeEventListener("volumechange",onMute)},3e3)})}catch(err){console.info("[cssos-cinema] requestFullscreen rejected:",err?.name||err),restore()}}),globalThis.cssosSetImmersiveNative||(globalThis.cssosSetImmersiveNative=function(on){try{localStorage.setItem("cssos.immersive.native",on===!1?"0":"1")}catch{}return on!==!1}),globalThis.cssosEnterCinemaMode||(globalThis.cssosEnterCinemaMode=async function(){const panel=document.getElementById("watch-panel");if(!panel||panel.classList.contains("is-cssmv-fullscreen")&&document.fullscreenElement)return;try{applyScreenAspectRatio()}catch{}panel.classList.add("is-cssmv-fullscreen"),document.body.classList.add("cssos-cinema-mode");const v=document.getElementById("watch-video"),a=document.getElementById("watch-audio-preview"),snapshot={vMuted:v?.muted,vVolume:v?.volume,aMuted:a?.muted,aVolume:a?.volume},restoreAudio=()=>{try{v&&snapshot.vMuted!==void 0&&(v.muted=snapshot.vMuted,typeof snapshot.vVolume=="number"&&(v.volume=snapshot.vVolume)),a&&snapshot.aMuted!==void 0&&(a.muted=snapshot.aMuted,typeof snapshot.aVolume=="number"&&(a.volume=snapshot.aVolume))}catch{}};var isApp314b=!1;try{isApp314b=document.documentElement.classList.contains("cssos-app")}catch{}if(!isApp314b&&!document.fullscreenElement)try{const fn=panel.requestFullscreen||panel.webkitRequestFullscreen||panel.mozRequestFullScreen||panel.msRequestFullscreen;fn&&await fn.call(panel),setTimeout(restoreAudio,50),setTimeout(restoreAudio,400)}catch(err){console.info("[cssos-cinema] requestFullscreen rejected:",err?.name||err),restoreAudio()}},document.addEventListener("fullscreenchange",function(){})),screen.appendChild(infoBtn),fsBtn&&fsBtn.parentNode&&fsBtn.parentNode.removeChild(fsBtn);const staleOverflow=screen.querySelector(".cssmv-overflow-btn");return staleOverflow&&staleOverflow.parentNode&&staleOverflow.parentNode.removeChild(staleOverflow),screen.classList.remove("cssmv-overflow-open"),!0}function installIdleTracking(){const panel=document.getElementById("watch-panel");return panel?(panel.dataset.cssmvIdleBound==="1"||(panel.dataset.cssmvIdleBound="1",["mousemove","touchstart","touchmove","wheel","pointerdown","keydown","click"].forEach(function(ev){panel.addEventListener(ev,bumpIdleIfOpen,{passive:!0})}),infoPopover.addEventListener("mousemove",bumpIdleIfOpen),infoPopover.addEventListener("scroll",bumpIdleIfOpen,{passive:!0})),!0):!1}function installMediaFrameClickToggle(){const screen=document.querySelector("#watch-panel .watch-screen");return screen?(screen.dataset.cssmvFrameToggleBound==="1"||(screen.dataset.cssmvFrameToggleBound="1",screen.addEventListener("click",function(e){const t=e.target,v=document.getElementById("watch-video");if(!(t===screen||t===v||t&&t.classList&&(t.classList.contains("watch-screen")||t.classList.contains("watch-video")||t.classList.contains("watch-frame")))||t&&typeof t.closest=="function"&&(t.closest("button,a,input,select,textarea,[role='button'],[contenteditable]")||t.closest("[data-no-frame-toggle]")))return;const a=document.getElementById("watch-audio-preview"),primary=v&&v.src&&v.readyState>0?v:a&&a.src&&a.readyState>0?a:v||a;if(!primary)return;const rect=screen.getBoundingClientRect(),dx=e.clientX-rect.left,dy=e.clientY-rect.top,BORDER_PX=16,nearTop=dy<=BORDER_PX,nearBottom=dy>=rect.height-BORDER_PX,nearLeft=dx<=BORDER_PX,nearRight=dx>=rect.width-BORDER_PX;if(nearTop||nearBottom||nearLeft||nearRight){const dur=Number(primary.duration||0);if(Number.isFinite(dur)&&dur>0){let frac;const dTop=dy,dBottom=rect.height-dy,dLeft=dx,dRight=rect.width-dx,minD=Math.min(dTop,dBottom,dLeft,dRight);minD===dTop||minD===dBottom?frac=Math.max(0,Math.min(1,dx/rect.width)):frac=Math.max(0,Math.min(1,dy/rect.height));const target=frac*dur;try{if(primary.currentTime=target,primary===v&&a&&a.src&&Number.isFinite(Number(a.duration)))try{a.currentTime=target}catch{}screen.dataset.cssosSeekFrac=frac.toFixed(3),console.info("[watch-frame] border-seek → %s (frac %s)",new Date(target*1e3).toISOString().substr(11,8),frac.toFixed(3))}catch{}}e.preventDefault(),e.stopPropagation();return}var __now=Date.now();if(!(__now<(globalThis.__cssosWatchToggleLockUntil||0))){globalThis.__cssosWatchToggleLockUntil=__now+350;try{if(primary.paused||primary.ended){var __hasSepAudio=primary===v&&a&&a.src;try{primary.muted=!!__hasSepAudio}catch{}const p=primary.play();if(p&&typeof p.catch=="function"&&p.catch(function(){}),__hasSepAudio){try{a.muted=!1,a.play().catch(function(){})}catch{}if(typeof globalThis.cssosAudioReferee=="function")try{globalThis.cssosAudioReferee(a)}catch{}}}else if(primary.pause(),primary===v&&a&&!a.paused)try{a.pause()}catch{}}catch{}}},!1),console.info("%c[watch-frame] click-to-toggle play/pause installed","color:#0a8;font-weight:bold")),!0):!1}function boot(){appendPopoverToBody();const ok1=installButtons(),ok2=installIdleTracking();if(installMediaFrameClickToggle(),!(ok1&&ok2)){let tries=0;const iv=setInterval(function(){appendPopoverToBody();const a=installButtons(),b=installIdleTracking();wireStarBtnExtra(),(a&&b||++tries>40)&&clearInterval(iv)},200)}wireStarBtnExtra(),setTimeout(forceShuffle,200),setTimeout(forceShuffle,900),setTimeout(forceShuffle,2200),setTimeout(prewarmFontBatch,600);function findRunIdFromCard(card){const tries=["runId","workId","audioRunId","pipelineRunId","cssosRunId","cssosWorkId","deliveryRunId","id","key"];for(const k of tries){const v=card.dataset[k];if(v)return String(v).trim()}const child=card.querySelector("[data-run-id], [data-work-id], [data-audio-run-id]");return child?String(child.dataset.runId||child.dataset.workId||child.dataset.audioRunId||"").trim():""}function switchWatchToWork(runId,card){try{runId&&(typeof globalThis.activePipelineRunId<"u"&&(globalThis.activePipelineRunId=runId),typeof globalThis.currentWatchAudioRunId<"u"&&(globalThis.currentWatchAudioRunId=runId),window.dispatchEvent(new CustomEvent("cssos:open-watch-for-run",{detail:{run_id:runId,source:"card-click"}})),window.dispatchEvent(new CustomEvent("cssos:title_resolved",{detail:{title:"",run_id:runId,source:"card-click"}})));const watchPanel=document.getElementById("watch-panel");watchPanel&&watchPanel.classList.add("cssmv-p2100-rebooting");const openers=[()=>globalThis.openWatchPreviewFlowModule?.({run_id:runId,force:!0}),()=>globalThis.openWatchMusicPlaybackSurfaceModule?.({run_id:runId,autoplay:!1}),()=>globalThis.openWatchPanelShellModule?.({run_id:runId}),()=>globalThis.openWatchPanel?.(runId)];for(const fn of openers)try{if(fn&&fn())break}catch{}watchPanel&&setTimeout(()=>watchPanel.classList.remove("cssmv-p2100-rebooting"),200)}catch{}}document.addEventListener("click",function(e){const t=e.target;if(!(t instanceof Element))return;const card=t.closest(".work-card, .foryou-card, .works-card, [data-source-run-id], [data-run-id]");if(!card||t.closest("[data-work-toggle], [data-market-toggle]")||!!!t.closest("[data-work-open-watch], [data-market-action='open-watch'], [data-work-action='watch'], [data-market-action='preview'], [data-market-action='listen']"))return;function readId(node){if(!node)return"";const ds=node.dataset||{};return(ds.sourceRunId||ds.runId||ds.workId||ds.deliveryId||ds.audioRunId||ds.id||"").toString().trim()}const runId=readId(t.closest("[data-source-run-id], [data-run-id], [data-work-id]"))||readId(card);if(runId)try{"activePipelineRunId"in globalThis&&(globalThis.activePipelineRunId=runId),"currentWatchAudioRunId"in globalThis&&(globalThis.currentWatchAudioRunId=runId)}catch{}const watchPanel=document.getElementById("watch-panel");watchPanel&&!watchPanel.classList.contains("hidden")&&(window.dispatchEvent(new CustomEvent("cssos:watch-force-close",{detail:{reason:"card-switch",at:Date.now()}})),watchPanel.dataset.cssmvPendingReinit=String(Date.now()),runId&&(watchPanel.dataset.cssmvNextRunId=runId)),runId&&window.dispatchEvent(new CustomEvent("cssos:open-watch-for-run",{detail:{run_id:runId,source:"card-click",at:Date.now()}}))},!0);function trackedText(el){try{return(el&&el.textContent?el.textContent:"").trim()}catch{return""}}function watchTextChanges(el,key){if(!el||el.dataset[key+"TextObs"]==="1")return;el.dataset[key+"TextObs"]="1",el.dataset[key+"LastText"]=trackedText(el),new MutationObserver(function(){const cur=trackedText(el);if(cur){if(cur===el.dataset[key+"LastText"]){el.querySelector(".cssmv-p2100-glyph")||applyShuffle(el,{recover:!0});return}el.dataset[key+"LastText"]=cur,applyShuffle(el)}}).observe(el,{childList:!0,characterData:!0,subtree:!0}),trackedText(el)&&applyShuffle(el)}function attachTextWatchers(){const title=document.querySelector(".cssmv-mv-title");title&&watchTextChanges(title,"p2100Tit");const kara=document.getElementById("watch-karaoke-line");return kara&&watchTextChanges(kara,"p2100Kara"),!0}attachTextWatchers();let titleTries=0;const titleIv=setInterval(function(){attachTextWatchers(),++titleTries>30&&clearInterval(titleIv)},400)}document.readyState==="complete"||document.readyState==="interactive"?boot():document.addEventListener("DOMContentLoaded",boot);function emptyAdvancedDefaults(){const ids=["creation-tempo","creation-duration","creation-instrumentation","creation-vocal-style","creation-ensemble-style","creation-licensed-style-pack","creation-external-audio-adapter","creation-arrangement-density"];for(const id of ids){const el=document.getElementById(id);if(!el||el.dataset.cssmvP2100UserTyped==="1")continue;const v=(el.value||"").trim(),defaults={"creation-tempo":["88"],"creation-duration":["180"]};defaults[id]&&defaults[id].includes(v)&&(el.value=""),el.dataset.cssmvP2100Bound||(el.dataset.cssmvP2100Bound="1",el.addEventListener("input",function(){el.dataset.cssmvP2100UserTyped="1"},{once:!0}))}}setTimeout(emptyAdvancedDefaults,800),document.addEventListener("cssmv:advanced-panel-opened",emptyAdvancedDefaults),setTimeout(emptyAdvancedDefaults,5e3);let __cssmvPipelineRunning=!1,__cssmvPipelineRunningSince=0;function setPipelineRunning(running){__cssmvPipelineRunning=!!running,__cssmvPipelineRunningSince=running?Date.now():0;const root=document.documentElement;running?root.classList.add("cssmv-pipeline-running"):root.classList.remove("cssmv-pipeline-running"),window.dispatchEvent(new CustomEvent(running?"cssos:pipeline-locked":"cssos:pipeline-unlocked",{detail:{at:Date.now()}}))}function showPipelineToast(message){let toast=document.getElementById("cssmv-pipeline-toast");toast||(toast=document.createElement("div"),toast.id="cssmv-pipeline-toast",toast.style.cssText="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(5,10,9,0.92);color:rgba(242,255,248,0.96);padding:14px 22px;border-radius:14px;border:1px solid rgba(218,255,242,0.32);backdrop-filter:blur(16px);font-size:14px;line-height:1.4;box-shadow:0 12px 40px rgba(0,0,0,0.6);opacity:0;pointer-events:none;transition:opacity 0.3s ease;",document.body.appendChild(toast)),toast.textContent=message,toast.style.opacity="1",clearTimeout(toast.__hideTimer),toast.__hideTimer=setTimeout(()=>{toast.style.opacity="0"},2200)}const TRIGGER_SELECTORS=["#watch-btn","[data-action='cast-spell']","[data-action='generate']",".dock-spell","#cssmv-spell-btn",".cssmv-cast-btn","#start-pipeline",".start-pipeline-btn"];document.addEventListener("click",function(e){if(!__cssmvPipelineRunning)return;const t=e.target;if(t instanceof Element){for(const sel of TRIGGER_SELECTORS)if(t.closest&&t.closest(sel)){e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation(),showPipelineToast("正在生成中… 请等当前作品完成");return}}},!0);try{if(!window.fetch.__cssmvPipelineWrapped){const origFetch=window.fetch.bind(window);window.fetch=function(input,init){const url=typeof input=="string"?input:input&&input.url||"";/\/api\/mv\/lyrics(\?|$)/.test(url)&&!__cssmvPipelineRunning&&setPipelineRunning(!0);const promise=origFetch(input,init);return/\/api\/mv\/compose(\?|$)|\/api\/mv\/commit(\?|$)/.test(url)&&promise.finally(()=>{setTimeout(()=>setPipelineRunning(!1),2500)}),promise},window.fetch.__cssmvPipelineWrapped=!0}}catch{}setInterval(function(){__cssmvPipelineRunning&&Date.now()-__cssmvPipelineRunningSince>300*1e3&&setPipelineRunning(!1)},3e4),window.addEventListener("cssos:pipeline-complete",()=>setPipelineRunning(!1)),window.addEventListener("cssos:pipeline-finished",()=>setPipelineRunning(!1)),(function(){const ALL_STAGES=["lyrics","cover","music","video","subtitles","compose"];let _autoPlayed=!1,_allDoneAt=0;function readProgress(){const eng=typeof window.engineProgressState=="object"&&window.engineProgressState||{},lyricsPct=typeof window.currentLyricsProgressPercentModule=="function"?Number(window.currentLyricsProgressPercentModule()||0):Number(eng.lyrics||0);return{cover:Math.max(0,Math.min(100,Number(eng.cover||eng.thumbnail||0))),lyrics:Math.max(0,Math.min(100,lyricsPct)),music:Math.max(0,Math.min(100,Number(eng.music||0))),video:Math.max(0,Math.min(100,Number(eng.video||0))),subtitles:Math.max(0,Math.min(100,Number(eng.subtitles||0))),compose:Math.max(0,Math.min(100,Number(eng.compose||eng.kara||0)))}}function isAllDone(map){return ALL_STAGES.every(k=>Number(map[k]||0)>=100)}let _patchAttempts=0;function patchRotator(){if(_patchAttempts+=1,typeof globalThis.getActiveWatchProgressCardModule!="function"){_patchAttempts<50&&setTimeout(patchRotator,200);return}if(globalThis.getActiveWatchProgressCardModule.__cssmv6stage)return;const original=globalThis.getActiveWatchProgressCardModule,safeT=key=>{try{if(typeof globalThis.t=="function"){const v=globalThis.t(key);if(v&&!/^TODO_i18n/.test(v))return v}}catch{}return null},labelFor=key=>safeT(`watch.progress.${key}`)||safeT(`engine.${key}`)||key.charAt(0).toUpperCase()+key.slice(1),patched=function(){const map=readProgress(),liveCards=ALL_STAGES.map(key=>({key,label:String(labelFor(key)||key).replace(/\s*0%$/,""),progress:Math.round(map[key]||0),done:Number(map[key]||0)>=100})).filter(c=>!c.done);if(!liveCards.length)return null;const started=liveCards.filter(c=>Number(c.progress||0)>0),pool=started.length?started:liveCards,ROTATE_MS=Number(globalThis.WATCH_PROGRESS_ROTATE_MS)||5e3,idx=Math.floor(Date.now()/ROTATE_MS)%pool.length;return pool[idx]||pool[0]||null};patched.__cssmv6stage=!0,patched.__cssmvOriginal=original,globalThis.getActiveWatchProgressCardModule=patched}setTimeout(patchRotator,80);function scrubTitleCompleteText(){const el=document.querySelector("#watch-panel .panel-title");if(!el)return;const txt=el.textContent||"",cleaned=txt.replace(/\s*·\s*(Complete|已完成|完成)\s*$/u,"");cleaned!==txt&&(el.textContent=cleaned)}const stageDoneHueAssigned=Object.create(null);function assignDoneHues(map){ALL_STAGES.forEach(key=>{Number(map[key]||0)<100||stageDoneHueAssigned[key]||(stageDoneHueAssigned[key]=Math.floor(Math.random()*360))}),document.querySelector(".cssmv-border-bar")}function tryAutoPlayMv(){if(_autoPlayed)return;const map=readProgress();if(!isAllDone(map)){_allDoneAt=0;return}if(!_allDoneAt){_allDoneAt=Date.now();return}if(!(Date.now()-_allDoneAt<800)){_autoPlayed=!0;try{const v=document.getElementById("watch-video");if(v&&typeof v.play=="function"){v.playsInline=!0,globalThis.__cssosWatchAudioUnlocked||(v.muted=!0,globalThis.__cssosWatchPendingUnmute=!0);const p=v.play();p&&typeof p.catch=="function"&&p.catch(()=>{try{v.style.opacity="0";try{const w0=globalThis.currentStructuredWatchQueue?.items?.[0],persistedPool=(Array.isArray(w0?.cover_slides)?w0.cover_slides:[]).map(u=>typeof u=="string"?u.trim():"").filter(u=>u&&(/(^|\/\/|\.)cssstudio\.app\//.test(u)||u.startsWith("data:")));if(persistedPool.length>=2&&typeof globalThis.cssmvSetCoverSlides=="function"){const shuffled=persistedPool.slice().sort(()=>Math.random()-.5);globalThis.cssmvSetCoverSlides(shuffled)}else{let stableCover=String(globalThis.currentResolvedWatchArtworkDataUrl||globalThis.currentPreviewFrameDataUrl||"").trim();stableCover||(stableCover=String(w0?.cover_image||w0?.preview_image_url||w0?.cover_url||w0?.cover_slides?.[0]||v?.poster||"").trim()),stableCover&&typeof globalThis.cssmvSetCoverSlides=="function"&&globalThis.cssmvSetCoverSlides([stableCover])}}catch{}globalThis.cssmvStartCoverSlideshow?.({mv:!0,music:!1}),v.addEventListener("playing",function __cssosRestoreVideo(){v.removeEventListener("playing",__cssosRestoreVideo),v.style.opacity="";try{globalThis.cssmvStopCoverSlideshowMvOnly?.()}catch{}},{once:!0})}catch{}})}}catch{}}}setInterval(()=>{const map=readProgress();assignDoneHues(map),scrubTitleCompleteText(),tryAutoPlayMv()},600);function resetAutoPlay(){_autoPlayed=!1,_allDoneAt=0,Object.keys(stageDoneHueAssigned).forEach(k=>delete stageDoneHueAssigned[k])}window.addEventListener("cssos:open-watch-for-run",resetAutoPlay),document.addEventListener("cssos:open-watch-for-run",resetAutoPlay),window.addEventListener("cssos:pipeline-start",resetAutoPlay)})(),(function(){function findWorkByRunId(runId){if(!runId)return null;try{const works=globalThis.watchCommerceState&&globalThis.watchCommerceState.payload&&globalThis.watchCommerceState.payload.ownership&&Array.isArray(globalThis.watchCommerceState.payload.ownership.works)&&globalThis.watchCommerceState.payload.ownership.works||[],stack=[];for(works.forEach(w=>stack.push(w));stack.length;){const w=stack.shift();if(!w)continue;if([w.source_run_id,w.run_id,w.id,w.delivery_id].map(v=>String(v||"").trim()).filter(Boolean).includes(String(runId)))return w;Array.isArray(w.children)&&w.children.forEach(c=>stack.push(c))}}catch{}const registries=[globalThis.foryouSeedPreviewCache,globalThis.worksCenterCache,globalThis.currentStructuredWatchQueue&&globalThis.currentStructuredWatchQueue.items,globalThis.lastForyouWorks,globalThis.lastWorksCenterWorks].filter(Boolean);for(const reg of registries)try{const list=Array.isArray(reg)?reg:Array.isArray(reg.items)?reg.items:[];for(const w of list)if([w?.source_run_id,w?.run_id,w?.id,w?.delivery_id].map(v=>String(v||"").trim()).filter(Boolean).includes(String(runId)))return w}catch{}return null}let _switchInFlight=!1;async function handleOpenWatchForRun(ev){if(_switchInFlight)return;const runId=String(ev&&ev.detail&&ev.detail.run_id||"").trim(),source=String(ev&&ev.detail&&ev.detail.source||"").trim();if(runId&&source==="card-click"){_switchInFlight=!0;try{try{"activePipelineRunId"in globalThis&&(globalThis.activePipelineRunId=runId),"currentWatchAudioRunId"in globalThis&&(globalThis.currentWatchAudioRunId=runId),"pendingFinalAudioRunId"in globalThis&&(globalThis.pendingFinalAudioRunId=runId)}catch{}const work=findWorkByRunId(runId);if(work){try{globalThis.currentWatchPreviewWork=work}catch{}try{globalThis.cssosBindToWorkId?.(work)}catch{}}try{const v=document.getElementById("watch-video");if(v){try{v.pause&&v.pause()}catch{}v.removeAttribute("src");try{v.load&&v.load()}catch{}v.style.display="none"}}catch{}try{const panel=document.getElementById("watch-panel");panel&&panel.classList.remove("cssmv-info-open")}catch{}if(typeof globalThis.hydrateWatchFromRunPayloadModule=="function")try{await globalThis.hydrateWatchFromRunPayloadModule(runId)}catch{}if(work&&typeof globalThis.renderMarketWorkPreviewIntoWatchModule=="function"){const seed=typeof globalThis.buildMarketPreviewSeedModule=="function"?globalThis.buildMarketPreviewSeedModule(work):typeof globalThis.buildMarketPreviewSeed=="function"?globalThis.buildMarketPreviewSeed(work):{title:work.title||"",lyrics:""};try{await globalThis.renderMarketWorkPreviewIntoWatchModule({work,seed,previewUnlimited:!1})}catch{}}else if(typeof globalThis.openWatchPreviewFlowModule=="function")try{await globalThis.openWatchPreviewFlowModule({preferredTab:"mv",clearLimit:!0})}catch{}}finally{setTimeout(()=>{_switchInFlight=!1},600)}}}window.addEventListener("cssos:open-watch-for-run",handleOpenWatchForRun),document.addEventListener("cssos:open-watch-for-run",handleOpenWatchForRun)})(),(function(){const STATUS_PATTERNS=[/CSS is composing/i,/CSS\s+正在/,/^KaraOKe\s+MV\s*[·•]/i,/Composing music now/i,/Rendering video now/i,/Rendering subtitle/i,/Writing the first line/i,/Painting the cover/i,/Privileged preview/i,/Buyer preview/i,/Preview ended/i,/Recovering lyrics/i,/requesting.*music\s+engine/i,/waiting.*lyrics/i,/generating/i,/loading/i,/preparing/i,/(正在|准备|加载|生成|渲染|输出|稍候|等待)/,/^—$/];function looksLikeStatus(text){const s=String(text||"").trim();return!s||/[。，、！？；：…\n]/.test(s)&&s.length>24?!1:STATUS_PATTERNS.some(re=>re.test(s))}let statusEl=null;function ensureStatusEl(){if(statusEl&&document.body.contains(statusEl))return statusEl;const sub=document.getElementById("watch-subtitle");if(!sub)return null;const screen=sub.closest(".watch-screen")||sub.parentNode;return screen?(statusEl=document.getElementById("watch-status-info"),statusEl||(statusEl=document.createElement("div"),statusEl.id="watch-status-info",statusEl.className="watch-status-info",statusEl.setAttribute("aria-live","polite"),screen.appendChild(statusEl)),statusEl):null}function setStatus(text){const el=ensureStatusEl();if(!el)return;const s=String(text||"").trim();if(!s){el.textContent="",el.classList.remove("is-active");return}el.textContent!==s&&(el.textContent=s),el.classList.add("is-active")}let redirecting=!1;function maybeRedirect(){if(redirecting)return;const sub=document.getElementById("watch-subtitle");if(!sub)return;if(sub.dataset.cssmvOrigin==="lyric"){delete sub.dataset.cssmvOrigin;return}const text=String(sub.textContent||"").trim();if(text&&looksLikeStatus(text)){redirecting=!0;try{setStatus(text),sub.textContent=""}finally{setTimeout(()=>{redirecting=!1},0)}}}function attachObserver(){const sub=document.getElementById("watch-subtitle");return sub?(sub.dataset.cssmvStatusSplit==="1"||(sub.dataset.cssmvStatusSplit="1",ensureStatusEl(),maybeRedirect(),new MutationObserver(()=>maybeRedirect()).observe(sub,{childList:!0,characterData:!0,subtree:!0})),!0):!1}function boot2(){if(!attachObserver()){let tries=0;const iv=setInterval(()=>{(attachObserver()||++tries>40)&&clearInterval(iv)},200)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot2,{once:!0}):boot2(),globalThis.cssmvSetWatchStatusInfo=setStatus})(),(function(){const css=`
      /* Position the mirrored karaoke + subtitle inside the music stage,
         not relative to .watch-screen (which the music pane doesn't have). */
      #watch-pane-music .watch-music-karaoke-line,
      #watch-pane-music .watch-music-subtitle {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        z-index: 6;
        pointer-events: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: min(86%, 920px);
      }
      #watch-pane-music .watch-music-karaoke-line {
        bottom: 14%;
      }
      #watch-pane-music .watch-music-subtitle {
        bottom: 6%;
      }
      /* Hide if empty so we don't get a phantom box on first paint. */
      #watch-pane-music .watch-music-karaoke-line:empty,
      #watch-pane-music .watch-music-subtitle:empty {
        display: none;
      }
      /* Anchor the music stage so the absolutely-positioned mirrors land
         relative to it. The existing layout already gives .watch-music-stage
         a defined height, but be explicit. */
      #watch-pane-music .watch-music-stage {
        position: relative;
      }
    `,style=document.createElement("style");style.id="cssmv-music-tab-subtitle-css",style.textContent=css,document.head.appendChild(style);function mirrorOnce(){const srcK=document.getElementById("watch-karaoke-line"),dstK=document.getElementById("watch-music-karaoke-line");srcK&&dstK&&dstK.innerHTML!==srcK.innerHTML&&(dstK.innerHTML=srcK.innerHTML);const srcS=document.getElementById("watch-subtitle"),dstS=document.getElementById("watch-music-subtitle");srcS&&dstS&&dstS.innerHTML!==srcS.innerHTML&&(dstS.innerHTML=srcS.innerHTML)}function attach(){const srcK=document.getElementById("watch-karaoke-line"),srcS=document.getElementById("watch-subtitle"),dstK=document.getElementById("watch-music-karaoke-line"),dstS=document.getElementById("watch-music-subtitle");if(!srcK||!srcS||!dstK||!dstS)return!1;if(srcK.dataset.cssmvMusicMirror==="1")return!0;srcK.dataset.cssmvMusicMirror="1",srcS.dataset.cssmvMusicMirror="1",mirrorOnce();const mo=new MutationObserver(mirrorOnce);return mo.observe(srcK,{childList:!0,characterData:!0,subtree:!0}),mo.observe(srcS,{childList:!0,characterData:!0,subtree:!0}),!0}function boot2(){if(!attach()){let tries=0;const iv=setInterval(()=>{(attach()||++tries>40)&&clearInterval(iv)},200)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot2,{once:!0}):boot2()})()})();
