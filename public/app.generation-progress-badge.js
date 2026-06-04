/* CSSOS_WAVE_614 20260604 — Jing「不能让用户傻等, 要看得到进度」: 后台生成进度角标。
 * 轮询 GET /api/works/:id/generation-progress → {total, ready, pending, generating}
 * 在多部作品(三部曲/歌剧/连续剧/电影)卡片上显示「🎼 后台生成中 · ready/total」+ 进度条。
 * 完成(pending=0)自动消失。轮询自带退避 + 上限, 极轻量。公开: globalThis.cssosMountGenProgress(workId, hostEl)。 */
(function () {
  "use strict";
  if (globalThis.cssosMountGenProgress) return;

  function tr(en, zh) {
    try {
      if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh);
      var l = String(document.documentElement.lang || navigator.language || "").toLowerCase();
      return l.indexOf("zh") === 0 ? zh : en;
    } catch (_e) { return en; }
  }

  function injectStyle() {
    if (document.getElementById("cssos-genprog-style")) return;
    var st = document.createElement("style"); st.id = "cssos-genprog-style";
    st.textContent = [
      ".cssos-genprog{display:flex;align-items:center;gap:6px;margin:6px 0;padding:4px 9px;border-radius:999px;",
      "background:rgba(0,245,160,0.10);border:1px solid rgba(0,245,160,0.30);font:600 11px/1.2 -apple-system,system-ui,sans-serif;color:#5effc9;}",
      ".cssos-genprog[hidden]{display:none;}",
      ".cssos-genprog .gp-ic{font-size:12px;line-height:1;}",
      ".cssos-genprog .gp-txt{white-space:nowrap;}",
      ".cssos-genprog .gp-bar{flex:1;min-width:40px;height:5px;border-radius:999px;background:rgba(255,255,255,0.12);overflow:hidden;}",
      ".cssos-genprog .gp-bar>span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#00f5a0,#00b87a);transition:width .5s ease;}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  globalThis.cssosMountGenProgress = function (workId, host) {
    workId = String(workId || "").trim();
    if (!workId || !/^[0-9a-f-]{36}$/i.test(workId)) return;
    if (!host || host.__genProgMounted) return;
    host.__genProgMounted = true;
    injectStyle();
    var badge = document.createElement("div");
    badge.className = "cssos-genprog";
    badge.hidden = true;
    host.appendChild(badge);

    var tries = 0, timer = null, stopped = false;
    function stop() { stopped = true; if (timer) { clearTimeout(timer); timer = null; } }

    async function poll() {
      if (stopped) return;
      tries += 1;
      // 宿主已从 DOM 移除 → 停止轮询(防泄漏)。
      if (!badge.isConnected) { stop(); return; }
      try {
        var r = await fetch("/api/works/" + encodeURIComponent(workId) + "/generation-progress", { credentials: "include" });
        var j = await r.json();
        if (j && j.ok && Number(j.total) > 0 && Number(j.pending) > 0) {
          var ready = Number(j.ready), total = Number(j.total);
          var pct = total > 0 ? Math.round((ready / total) * 100) : 0;
          badge.hidden = false;
          badge.innerHTML =
            '<span class="gp-ic">🎼</span>' +
            '<span class="gp-txt">' + tr("Generating in background", "后台生成中") + " · " + ready + "/" + total + "</span>" +
            '<span class="gp-bar"><span style="width:' + pct + '%"></span></span>';
        } else {
          badge.hidden = true;
          // 完成(total>0 且 pending=0) → 停止轮询。
          if (j && j.ok && Number(j.total) > 0 && Number(j.pending) === 0) { stop(); return; }
        }
      } catch (_e) { /* transient — keep polling */ }
      // 退避: 前期快(6s), 之后慢(15s); 总轮询上限 ~50 次后停(超大作品由再次打开卡片续轮询)。
      if (tries > 50) { stop(); return; }
      timer = setTimeout(poll, tries < 6 ? 6000 : 15000);
    }
    poll();
  };
})();
