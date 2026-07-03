"use strict";(function(){"use strict";if(globalThis.__cssosTouchHardened)return;globalThis.__cssosTouchHardened=!0;try{const css=`
      /* Stop iOS rubber-band → pull-to-refresh on the document. Panels
         keep their own scrolling intact because the rule only applies
         to html/body. */
      html, body {
        overscroll-behavior: contain;
        overscroll-behavior-y: contain;
        overscroll-behavior-x: contain;
        -webkit-overflow-scrolling: auto;
      }
      /* Eliminate double-tap-to-zoom on interactive elements — that
         300ms hold is the same window where a stray second tap turns
         into a refresh trigger. */
      button, a, [role="button"], .icon-btn,
      .dock-icon, .cssos-act-tab, .login-card,
      .panel-actions .icon-btn, .mini-btn, .chip {
        touch-action: manipulation;
        -webkit-tap-highlight-color: rgba(0,245,160,0.18);
      }
      /* Prevent iOS text-selection callout on rapid taps */
      .icon-btn, .dock-icon, .cssos-act-tab {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
      }
    `,s=document.createElement("style");s.id="cssos-touch-hardening-style",s.textContent=css,(document.head||document.documentElement).appendChild(s)}catch{}document.addEventListener("click",ev=>{const a=ev.target&&ev.target.closest&&ev.target.closest("a");if(!(a instanceof HTMLAnchorElement))return;const raw=a.getAttribute("href");if(raw==null)return;const trimmed=String(raw).trim().toLowerCase();(trimmed===""||trimmed==="#"||trimmed.startsWith("javascript:")||trimmed==="javascript:void(0)")&&ev.preventDefault()},!0);const DEBOUNCE_MS=280,lastClickByEl=new WeakMap;document.addEventListener("click",ev=>{const t=ev.target;if(!(t instanceof Element))return;const action=t.closest("button, a, [role='button'], .icon-btn, .dock-icon, .cssos-act-tab, [data-action], [data-msrc-apply], [data-msrc-clear]")||t;if(t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement||t.isContentEditable)return;const now=Date.now(),prev=lastClickByEl.get(action)||0;if(now-prev<DEBOUNCE_MS){ev.stopImmediatePropagation(),ev.preventDefault();return}lastClickByEl.set(action,now)},!0);function hasPendingInput(){const els=document.querySelectorAll("input, textarea");for(const el of els)if(!(el.type==="hidden"||el.type==="password")&&el.dataset.cssmvNoPersist!=="1"&&String(el.value||"").trim().length>0)return!0;return!1}document.addEventListener("keydown",ev=>{if((ev.key==="F5"||(ev.metaKey||ev.ctrlKey)&&(ev.key==="r"||ev.key==="R"))&&hasPendingInput()){ev.preventDefault();try{typeof globalThis.showToast=="function"&&globalThis.showToast(/^zh/i.test(String(document.documentElement.lang||"en"))?"已拦截一次刷新 — 输入内容已自动保存，按住 Shift+⌘R 强制刷新":"Refresh blocked — your input is auto-saved. Shift-⌘R to force.")}catch{}}},!0);function tagMobile(){const isMobile=window.matchMedia&&window.matchMedia("(max-width: 480px) and (orientation: portrait)").matches;document.documentElement.dataset.cssosMobile=isMobile?"1":"0"}tagMobile();try{window.matchMedia("(max-width: 480px)").addEventListener("change",tagMobile),window.addEventListener("orientationchange",tagMobile)}catch{}})();
