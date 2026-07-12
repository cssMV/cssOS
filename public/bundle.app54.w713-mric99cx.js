"use strict";(function(global){"use strict";function injectStyles(){if(document.getElementById("cssmv-popups-theme-fix-styles"))return;const st=document.createElement("style");st.id="cssmv-popups-theme-fix-styles",st.textContent=`
/* ---------- Light theme: popups + toasts ------------------------- */
html[data-theme="light"] .toast {
  background: var(--panel-strong) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  box-shadow: var(--shadow) !important;
}

html[data-theme="light"] .cssmv-info-popover-fixed {
  background: var(--panel-strong) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  box-shadow: var(--shadow) !important;
  /* Soft frosted look reads better on cream than the dark blur */
  backdrop-filter: blur(14px) saturate(1.04) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.04) !important;
}

html[data-theme="light"] #cssmv-pipeline-toast {
  background: var(--panel-strong) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  box-shadow: var(--shadow) !important;
}

/* The version menu uses a stacked dark gradient — replace with a
   single theme-aware fill in light mode. */
html[data-theme="light"] .version-menu {
  background: var(--panel-strong) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  box-shadow: var(--shadow) !important;
}
html[data-theme="light"] .version-menu .version-title,
html[data-theme="light"] .version-menu .version-current {
  color: var(--muted) !important;
}

/* Dock settings popover sits over a dark gradient too; same fix. */
html[data-theme="light"] .dock-settings-popover {
  background: var(--panel-strong) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  box-shadow: var(--shadow) !important;
}

/* Generic catch-all: any element styled with a fixed dark rgba bg via
   inline style won't be reachable here, but most legacy popovers use
   class-based styles. The font-shuffle right-click menu in
   app.watch-media-overlays.js sets background via .menuEl CSS — give
   it the same treatment by class. */
html[data-theme="light"] .cssmv-font-settings-menu,
html[data-theme="light"] .cssmv-font-settings-menu * {
  background-color: var(--panel-strong) !important;
  color: var(--text) !important;
  border-color: var(--border) !important;
}
html[data-theme="light"] .cssmv-font-settings-menu select,
html[data-theme="light"] .cssmv-font-settings-menu button,
html[data-theme="light"] .cssmv-font-settings-menu input {
  background: rgba(255, 252, 247, 0.84) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
}

/* Subscription / billing modals + pay-method picker also fall here. */
html[data-theme="light"] .pay-method-picker-overlay,
html[data-theme="light"] .pay-method-picker-modal,
html[data-theme="light"] .generation-boost-prompt-modal,
html[data-theme="light"] .mv-tier-picker-modal,
html[data-theme="light"] .pricing-modal {
  background: var(--panel-strong) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  box-shadow: var(--shadow) !important;
}
`,document.head.appendChild(st)}function clearPopupsAndToasts(){try{const toast=document.getElementById("toast");toast&&toast.classList.contains("show")&&(toast.classList.remove("show"),toast.textContent="")}catch{}try{const pop=document.querySelector(".cssmv-info-popover-fixed");pop&&pop.classList.remove("is-open");const panel=document.getElementById("watch-panel");panel&&panel.classList.remove("cssmv-info-open")}catch{}try{const ptoast=document.getElementById("cssmv-pipeline-toast");ptoast&&(ptoast.style.opacity="0",clearTimeout(ptoast.__hideTimer))}catch{}try{const fsMenu=document.querySelector(".cssmv-font-settings-menu");fsMenu&&fsMenu.parentNode&&fsMenu.parentNode.removeChild(fsMenu)}catch{}}function isWatchPanelVisible(){const panel=document.getElementById("watch-panel");if(!panel||panel.hidden||panel.classList.contains("is-hidden")||panel.style.display==="none")return!1;const cs=window.getComputedStyle(panel);return!(cs.display==="none"||cs.visibility==="hidden")}function watchPanelObserver(){const panel=document.getElementById("watch-panel");if(!panel)return;let lastVisible=isWatchPanelVisible();new MutationObserver(()=>{const nowVisible=isWatchPanelVisible();lastVisible&&!nowVisible&&clearPopupsAndToasts(),lastVisible=nowVisible}).observe(panel,{attributes:!0,attributeFilter:["class","hidden","style"]})}function attachExplicitCloseListeners(){const handler=()=>setTimeout(clearPopupsAndToasts,0);["cssos:watch-force-close","cssos:watch-close","cssos:open-watch-for-run"].forEach(evt=>{try{document.addEventListener(evt,handler),window.addEventListener(evt,handler)}catch{}}),document.addEventListener("click",ev=>{const t=ev.target;!(t instanceof Element)||!t.closest("#watch-panel .panel-actions .icon-btn[aria-label='Close'],#watch-panel .panel-actions .icon-btn[data-i18n-aria='action.close']")||(setTimeout(clearPopupsAndToasts,0),setTimeout(clearPopupsAndToasts,350))},!0)}function boot(){injectStyles(),watchPanelObserver(),attachExplicitCloseListeners()}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot,{once:!0}):boot(),global.CSSMV_clearPopupsAndToasts=clearPopupsAndToasts})(typeof globalThis<"u"?globalThis:window);
