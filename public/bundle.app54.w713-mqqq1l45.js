"use strict";(function(global){"use strict";function injectStyles(){if(document.getElementById("cssmv-panel-dock-order-styles"))return;const st=document.createElement("style");st.id="cssmv-panel-dock-order-styles",st.textContent=`
/* CSSMV_PANEL_SETTINGS_THEME 20260425 #116 — restore light-theme paint
 * so the flyout doesn't read as a black-on-black empty bar. */
html[data-theme="light"] .panel-settings {
  background: var(--panel-strong) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  box-shadow: var(--shadow) !important;
  backdrop-filter: blur(14px) saturate(1.04) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.04) !important;
}
html[data-theme="light"] .panel-settings .panel-settings-title {
  color: rgba(28, 25, 20, 0.55) !important;
}
html[data-theme="light"] .panel-settings label {
  color: rgba(28, 25, 20, 0.74) !important;
}
html[data-theme="light"] .panel-settings input[type="text"],
html[data-theme="light"] .panel-settings input[type="number"],
html[data-theme="light"] .panel-settings input[type="range"],
html[data-theme="light"] .panel-settings select,
html[data-theme="light"] .panel-settings textarea {
  background: rgba(255, 252, 247, 0.84) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
}
/* Even on dark theme, make sure the inner content is actually visible —
 * some legacy CSS leftovers occasionally hide labels via opacity:0. */
.panel-settings * { visibility: visible; }

/* Dock-order slot styling — discreet number input next to existing
 * shortcut/voice fields. */
.cssmv-dock-order-block {
  display: grid !important;
  gap: 6px !important;
  font-size: 11px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.2em !important;
  color: var(--muted) !important;
}
.cssmv-dock-order-block .cssmv-dock-order-row {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}
.cssmv-dock-order-block input[type="number"] {
  width: 72px !important;
  padding: 6px 8px !important;
  border-radius: 8px !important;
  border: 1px solid var(--border, rgba(0,245,160,0.25)) !important;
  background: rgba(255,255,255,0.06) !important;
  color: inherit !important;
  text-align: center !important;
}
html[data-theme="light"] .cssmv-dock-order-block input[type="number"] {
  background: rgba(255, 252, 247, 0.84) !important;
}
.cssmv-dock-order-readout {
  font-size: 10px !important;
  letter-spacing: 0.16em !important;
  color: rgba(180, 200, 195, 0.72) !important;
}
html[data-theme="light"] .cssmv-dock-order-readout {
  color: rgba(28, 25, 20, 0.5) !important;
}
.cssmv-dock-order-admin-default {
  font-size: 10px !important;
  letter-spacing: 0.12em !important;
  color: rgba(0, 245, 160, 0.72) !important;
}
html[data-theme="light"] .cssmv-dock-order-admin-default {
  color: rgba(13, 143, 103, 0.78) !important;
}
`,document.head.appendChild(st)}function isAdmin(){try{const u=global.authState&&global.authState.user;if(!u)return!1;const role=String(u.role||u.user_role||"").toLowerCase();if(role==="admin"||role==="owner"||role==="superadmin")return!0;if(typeof global.hasPermission=="function")try{if(global.hasPermission("admin.panel")||global.hasPermission("admin"))return!0}catch{}if(Array.isArray(u.permissions)&&u.permissions.includes("admin")||Array.isArray(u.roles)&&u.roles.includes("admin"))return!0}catch{}return!1}function userKey(panelId){return`cssos.dock.userOrder.${panelId}`}function adminKey(panelId){return`cssos.dock.adminOrder.${panelId}`}function readOrder(panelId){try{const u=localStorage.getItem(userKey(panelId));if(u!==null&&u.trim()!==""){const n=Number(u);if(Number.isFinite(n))return{kind:"user",value:n}}const a=localStorage.getItem(adminKey(panelId));if(a!==null&&a.trim()!==""){const n=Number(a);if(Number.isFinite(n))return{kind:"admin",value:n}}}catch{}return null}function writeUserOrder(panelId,value){try{if(value==null||value===""){localStorage.removeItem(userKey(panelId));return}const n=Number(value);if(!Number.isFinite(n))return;localStorage.setItem(userKey(panelId),String(Math.round(n)))}catch{}}function writeAdminOrder(panelId,value){try{if(value==null||value===""){localStorage.removeItem(adminKey(panelId));return}const n=Number(value);if(!Number.isFinite(n))return;localStorage.setItem(adminKey(panelId),String(Math.round(n)))}catch{}}const ACTION_TO_PANEL=Object.freeze({mic:"logo-panel",foryou:"foryou-panel",cssmv:"cssmv-panel",lyrics:"lyrics-panel",music:"music-panel",video:"video-panel",watch:"watch-panel",notifications:"notifications-panel",about:"about-panel",api:"api-panel",reports:"delivery-reports-panel","delivery-ops":"delivery-ops-panel",login:"login-panel",subscription:"subscription-panel",credit:"credit-panel",workspaces:"workspaces-panel",users:"user-admin-panel","user-admin":"user-admin-panel",settings:"settings-panel",language:"language-panel",profile:"profile-panel",search:"search-panel"});function panelIdFromDockItem(item){if(!item)return null;const action=String(item.dataset.action||"").trim().toLowerCase();return action&&ACTION_TO_PANEL[action]||null}let _reorderScheduled=!1;function applyDockOrder(){_reorderScheduled=!1;const dock=document.getElementById("dock")||document.querySelector(".dock");if(!dock)return;const items=Array.from(dock.querySelectorAll("[data-pill-key]"));items.length&&(items.forEach((el,i)=>{el.dataset.cssmvOrigIndex=String(i)}),items.sort((a,b)=>{const pa=panelIdFromDockItem(a),pb=panelIdFromDockItem(b),oa=pa?readOrder(pa):null,ob=pb?readOrder(pb):null,va=oa?oa.value:Number(a.dataset.cssmvOrigIndex)+1e3,vb=ob?ob.value:Number(b.dataset.cssmvOrigIndex)+1e3;return va!==vb?va-vb:Number(a.dataset.cssmvOrigIndex)-Number(b.dataset.cssmvOrigIndex)}),items.forEach(el=>dock.appendChild(el)))}function scheduleApplyDockOrder(){_reorderScheduled||(_reorderScheduled=!0,setTimeout(applyDockOrder,0))}function injectDockOrderField(panelSettings){if(!panelSettings||panelSettings.dataset.cssmvDockOrderInjected==="1")return;const panel=panelSettings.closest(".panel");if(!panel||!panel.id)return;const panelId=panel.id;panelSettings.dataset.cssmvDockOrderInjected="1";const block=document.createElement("label");block.className="cssmv-dock-order-block";const isAdminUser=isAdmin(),adminLabel=isAdminUser?" (admin default)":"";block.innerHTML=`
      <span>Dock position (0,1,2,…)${adminLabel}</span>
      <span class="cssmv-dock-order-row">
        <input type="number" min="0" step="1" placeholder="—"
               data-cssmv-dock-order-input="${panelId}" />
        <button type="button" class="cssmv-dock-order-clear"
                data-cssmv-dock-order-clear="${panelId}"
                style="padding:4px 10px;border-radius:6px;border:1px solid var(--border,rgba(0,245,160,0.25));background:transparent;color:inherit;cursor:pointer;font-size:10px;">
          Clear
        </button>
      </span>
      <span class="cssmv-dock-order-readout" data-cssmv-dock-order-readout="${panelId}"></span>
    `,panelSettings.appendChild(block);const input=block.querySelector("[data-cssmv-dock-order-input]"),clearBtn=block.querySelector("[data-cssmv-dock-order-clear]"),readout=block.querySelector("[data-cssmv-dock-order-readout]");function refresh(){const cur=readOrder(panelId);cur?(input.value=String(cur.value),cur.kind==="admin"&&!isAdminUser?(readout.textContent=`Default ${cur.value} (system)`,readout.classList.add("cssmv-dock-order-admin-default")):(readout.textContent=cur.kind==="admin"?`Default ${cur.value} (system)`:`Yours · ${cur.value}`,readout.classList.toggle("cssmv-dock-order-admin-default",cur.kind==="admin"))):(input.value="",readout.textContent="Original dock order",readout.classList.remove("cssmv-dock-order-admin-default"))}refresh(),input.addEventListener("input",()=>{const v=input.value.trim();isAdminUser?writeAdminOrder(panelId,v):writeUserOrder(panelId,v),refresh(),scheduleApplyDockOrder()}),clearBtn.addEventListener("click",()=>{isAdminUser?writeAdminOrder(panelId,""):writeUserOrder(panelId,""),refresh(),scheduleApplyDockOrder()})}function injectIntoExistingPanels(){document.querySelectorAll(".panel .panel-settings").forEach(injectDockOrderField)}function attachBlurClose(){document.body.dataset.cssmvSettingsBlurBound!=="1"&&(document.body.dataset.cssmvSettingsBlurBound="1",document.addEventListener("pointerdown",ev=>{const t=ev.target;t instanceof Element&&(t.closest(".panel-settings")||t.closest(".panel-actions")||document.querySelectorAll(".panel.show-settings").forEach(panel=>{if(panel.contains(t)){panel.classList.remove("show-settings");const settings2=panel.querySelector(".panel-settings");settings2&&(settings2.hidden=!0,settings2.setAttribute("aria-hidden","true")),panel.dataset.settingsOpen="false";return}panel.classList.remove("show-settings");const settings=panel.querySelector(".panel-settings");settings&&(settings.hidden=!0,settings.setAttribute("aria-hidden","true")),panel.dataset.settingsOpen="false"}))},!0))}function attachMutationWatcher(){let tid=0;new MutationObserver(()=>{tid||(tid=setTimeout(()=>{tid=0,injectIntoExistingPanels()},250))}).observe(document.body,{childList:!0,subtree:!0})}function boot(){injectStyles(),injectIntoExistingPanels(),attachMutationWatcher(),attachBlurClose(),applyDockOrder(),window.addEventListener("storage",ev=>{!ev||!ev.key||(ev.key.startsWith("cssos.dock.userOrder.")||ev.key.startsWith("cssos.dock.adminOrder."))&&scheduleApplyDockOrder()})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot,{once:!0}):boot(),global.CSSMV_applyDockOrder=applyDockOrder,global.CSSMV_setPanelDockOrder=(panelId,value)=>{isAdmin()?writeAdminOrder(panelId,value):writeUserOrder(panelId,value),scheduleApplyDockOrder()},global.CSSMV_clearPanelDockOrder=panelId=>{isAdmin()?writeAdminOrder(panelId,""):writeUserOrder(panelId,""),scheduleApplyDockOrder()}})(typeof globalThis<"u"?globalThis:window);
