/* CSSOS_PERSON_MV_WAVE11 20260508 — Jing
 * User homepage panel mounted on URL hash `#u/{username|id}`.
 * Lightweight self-contained module — no build step, no deps. */
(function () {
  "use strict";
  function tr(en, zh) {
    if (typeof globalThis.CSSOS_I18N?.tr === "function") {
      try { return String(globalThis.CSSOS_I18N.tr(en)); } catch (_e) {}
    }
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    return /^zh/i.test(String(locale)) && zh ? zh : en;
  }

  var STYLE_ID = "cssos-user-homepage-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      "#cssos-user-homepage{position:fixed;inset:0;z-index:9300;background:rgba(4,10,8,0.96);overflow-y:auto;color:#daffee;font:14px/1.45 -apple-system,system-ui,sans-serif;}",
      "#cssos-user-homepage .uhp-inner{max-width:920px;margin:0 auto;padding:32px 20px 80px;}",
      "#cssos-user-homepage .uhp-close{position:fixed;top:16px;right:18px;background:rgba(0,245,160,0.12);color:#00f5a0;border:1px solid rgba(0,245,160,0.4);border-radius:999px;padding:6px 14px;cursor:pointer;font-weight:600;}",
      "#cssos-user-homepage .uhp-hero{display:flex;gap:20px;align-items:center;margin-bottom:20px;}",
      "#cssos-user-homepage .uhp-avatar{width:96px;height:96px;border-radius:50%;background:#0c1d16;border:2px solid rgba(0,245,160,0.4);object-fit:cover;flex-shrink:0;}",
      "#cssos-user-homepage .uhp-name{font-size:22px;font-weight:700;margin:0 0 4px;color:#fff;}",
      "#cssos-user-homepage .uhp-handle{font-size:13px;color:rgba(0,245,160,0.7);margin-bottom:6px;}",
      "#cssos-user-homepage .uhp-bio{font-size:13px;color:rgba(218,255,238,0.78);margin:6px 0 8px;}",
      "#cssos-user-homepage .uhp-follow{background:#00f5a0;color:#06100b;border:0;border-radius:999px;padding:6px 18px;font-weight:700;cursor:pointer;}",
      "#cssos-user-homepage .uhp-follow.is-following{background:transparent;color:#00f5a0;border:1px solid #00f5a0;}",
      "#cssos-user-homepage .uhp-stats{display:flex;flex-wrap:wrap;gap:14px;margin:14px 0 26px;padding:10px 14px;background:rgba(0,245,160,0.06);border-radius:10px;font-size:13px;}",
      "#cssos-user-homepage .uhp-stats span{white-space:nowrap;}",
      "#cssos-user-homepage h2.uhp-section{font-size:15px;font-weight:700;margin:24px 0 10px;color:rgba(218,255,238,0.92);}",
      "#cssos-user-homepage .uhp-mv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;}",
      "#cssos-user-homepage .uhp-mv-card{aspect-ratio:3/4;background:#0c1d16;border:1px solid rgba(0,245,160,0.18);border-radius:10px;overflow:hidden;position:relative;cursor:pointer;}",
      "#cssos-user-homepage .uhp-mv-card img{width:100%;height:100%;object-fit:cover;}",
      "#cssos-user-homepage .uhp-mv-meta{position:absolute;left:0;right:0;bottom:0;padding:8px;background:linear-gradient(transparent,rgba(0,0,0,0.85));font-size:12px;}",
      "#cssos-user-homepage .uhp-mv-meta strong{display:block;color:#fff;font-size:13px;}",
      "#cssos-user-homepage .uhp-mv-meta em{font-style:normal;color:rgba(0,245,160,0.85);}",
      "#cssos-user-homepage .uhp-person-row{display:flex;flex-wrap:wrap;gap:10px;}",
      "#cssos-user-homepage .uhp-person-card{flex:0 0 140px;padding:10px;background:rgba(0,245,160,0.05);border:1px solid rgba(0,245,160,0.18);border-radius:10px;cursor:pointer;}",
      "#cssos-user-homepage .uhp-person-card strong{display:block;font-size:13px;color:#fff;}",
      "#cssos-user-homepage .uhp-person-card span{font-size:11px;color:rgba(218,255,238,0.65);}",
      "#cssos-user-homepage .uhp-tabs{display:flex;gap:8px;margin:8px 0;}",
      "#cssos-user-homepage .uhp-tabs button{background:transparent;color:rgba(218,255,238,0.65);border:1px solid rgba(0,245,160,0.18);border-radius:999px;padding:4px 12px;cursor:pointer;font-size:12px;}",
      "#cssos-user-homepage .uhp-tabs button.is-active{background:rgba(0,245,160,0.18);color:#00f5a0;}",
      "#cssos-user-homepage .uhp-follow-list{display:flex;flex-direction:column;gap:8px;margin:8px 0;}",
      "#cssos-user-homepage .uhp-follow-item{display:flex;gap:10px;align-items:center;padding:8px;background:rgba(0,245,160,0.04);border-radius:8px;cursor:pointer;}",
      "#cssos-user-homepage .uhp-follow-item img{width:32px;height:32px;border-radius:50%;}",
      "#cssos-user-homepage .uhp-loading,#cssos-user-homepage .uhp-error{padding:60px 20px;text-align:center;color:rgba(218,255,238,0.6);}",
    ].join("");
    document.head.appendChild(s);
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "style" && typeof attrs[k] === "object") Object.assign(n.style, attrs[k]);
      else if (k === "onclick") n.addEventListener("click", attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function defaultAvatar() {
    return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><rect width='96' height='96' fill='%230c1d16'/><circle cx='48' cy='38' r='18' fill='%2300f5a0' opacity='0.4'/><ellipse cx='48' cy='84' rx='30' ry='18' fill='%2300f5a0' opacity='0.4'/></svg>";
  }

  async function fetchProfile(handle) {
    var r = await fetch("/api/users/" + encodeURIComponent(handle) + "/profile", { credentials: "include" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    var j = await r.json();
    if (!j.ok) throw new Error(j.code || "FAILED");
    return j;
  }

  async function toggleFollow(handle) {
    var r = await fetch("/api/users/" + encodeURIComponent(handle) + "/follow", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    var j = await r.json();
    if (!j.ok) throw new Error(j.code || "FAILED");
    return j;
  }

  async function fetchFollows(handle, dir) {
    var r = await fetch("/api/users/" + encodeURIComponent(handle) + "/" + dir + "?limit=20", { credentials: "include" });
    if (!r.ok) return [];
    var j = await r.json();
    return j.ok ? (j.items || []) : [];
  }

  function close() {
    var node = document.getElementById("cssos-user-homepage");
    if (node) node.remove();
    if (/^#u\//.test(location.hash)) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  function navUser(h) {
    location.hash = "#u/" + h;
  }

  function openMv(workId) {
    if (!workId) return;
    if (typeof globalThis.openCssMV === "function") {
      try { globalThis.openCssMV(workId); return; } catch (_e) {}
    }
    location.search = "?cssMV=" + encodeURIComponent(workId);
  }

  function openCodex(personId) {
    if (typeof globalThis.openPersonMvCodex === "function") {
      try { globalThis.openPersonMvCodex(personId); return; } catch (_e) {}
    }
  }

  function renderError(handle, msg) {
    var root = document.getElementById("cssos-user-homepage");
    if (!root) return;
    root.innerHTML = "";
    root.appendChild(el("button", { class: "uhp-close", onclick: close }, [tr("Close", "关闭")]));
    root.appendChild(el("div", { class: "uhp-inner" }, [
      el("div", { class: "uhp-error" }, [tr("Could not load user.", "无法加载用户。") + " " + (msg || "")]),
    ]));
  }

  async function render(handle) {
    injectStyle();
    var existing = document.getElementById("cssos-user-homepage");
    if (existing) existing.remove();
    var root = el("div", { id: "cssos-user-homepage" }, [
      el("button", { class: "uhp-close", onclick: close }, [tr("Close", "关闭")]),
      el("div", { class: "uhp-inner" }, [
        el("div", { class: "uhp-loading" }, [tr("Loading…", "加载中…")]),
      ]),
    ]);
    document.body.appendChild(root);

    var data;
    try { data = await fetchProfile(handle); }
    catch (e) { renderError(handle, e && e.message); return; }

    var u = data.user || {};
    var st = data.stats || {};
    var fc = data.follow_counts || { followers: 0, following: 0 };
    var inner = el("div", { class: "uhp-inner" }, []);

    var avatar = el("img", { class: "uhp-avatar", src: u.avatar_url || defaultAvatar(), alt: "" });
    var hero = el("div", { class: "uhp-hero" }, [avatar]);
    var heroText = el("div", {}, [
      el("h1", { class: "uhp-name" }, [u.display_name || u.username || tr("Anonymous", "匿名")]),
      u.username ? el("div", { class: "uhp-handle" }, ["@" + u.username]) : null,
      u.bio ? el("div", { class: "uhp-bio" }, [u.bio]) : null,
    ]);
    if (!data.is_self) {
      var followBtn = el("button", {
        class: "uhp-follow" + (data.viewer_follows ? " is-following" : ""),
      }, [data.viewer_follows ? tr("Following", "已关注") : tr("Follow", "关注")]);
      followBtn.addEventListener("click", async function () {
        followBtn.disabled = true;
        try {
          var r = await toggleFollow(handle);
          followBtn.classList.toggle("is-following", !!r.following);
          followBtn.textContent = r.following ? tr("Following", "已关注") : tr("Follow", "关注");
          render(handle); // refresh counts
        } catch (e) { /* noop */ }
        followBtn.disabled = false;
      });
      heroText.appendChild(followBtn);
    }
    hero.appendChild(heroText);
    inner.appendChild(hero);

    var credits = data.credits || { balance: 0, lifetime_earned: 0 };
    inner.appendChild(el("div", { class: "uhp-stats" }, [
      el("span", {}, ["🎬 " + (st.total_mvs || 0) + " " + tr("MVs", "作品")]),
      el("span", {}, ["👁 " + (st.total_views || 0) + " " + tr("views", "观看")]),
      el("span", {}, ["❤️ " + (st.total_likes || 0) + " " + tr("likes", "点赞")]),
      el("span", {}, ["🏛 " + (st.persons_created || 0) + " " + tr("persons", "人物")]),
      el("span", { title: tr("Earned " + (credits.lifetime_earned || 0) + " lifetime", "累计获得 " + (credits.lifetime_earned || 0)) },
        ["💎 " + (credits.balance || 0) + " " + tr("credits", "积分")]),
      el("span", {}, ["👥 " + fc.followers + " " + tr("followers", "粉丝") + " · " + fc.following + " " + tr("following", "关注中")]),
    ]));

    // CSSOS_PERSON_MV_WAVE33 — GDPR data export, only on the owner's
    // own homepage. Kicks off /api/user/export and polls every 5s.
    if (data.is_self) {
      var exportRow = el("div", { class: "uhp-export-row", style: "margin:8px 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap;" }, []);
      var exportBtn = el("button", { class: "uhp-export-btn" }, ["📦 " + tr("Download my data", "导出我的数据")]);
      var exportStatus = el("span", { style: "font-size:12px;opacity:0.8" }, [""]);
      var pollTimer = null;
      function setExportStatus(text) { exportStatus.textContent = text; }
      function pollJob(jobId) {
        if (pollTimer) clearTimeout(pollTimer);
        pollTimer = setTimeout(async function () {
          try {
            var res = await fetch("/api/user/export/" + encodeURIComponent(jobId), { credentials: "include" });
            var j = await res.json();
            var status = j && j.job && j.job.status;
            if (status === "done" && j.job.download_url) {
              setExportStatus("");
              var link = el("a", {
                href: j.job.download_url,
                style: "color:#0f0;text-decoration:underline;",
                download: "cssos-export.zip",
              }, ["⬇ " + tr("Download ZIP", "下载 ZIP")]);
              exportRow.appendChild(link);
              exportBtn.disabled = false;
            } else if (status === "failed") {
              setExportStatus(tr("Export failed.", "导出失败。"));
              exportBtn.disabled = false;
            } else {
              setExportStatus(tr("Building… (" + (status || "pending") + ")", "构建中…(" + (status || "pending") + ")"));
              pollJob(jobId);
            }
          } catch (e) {
            setExportStatus(tr("Status check failed.", "状态查询失败。"));
            exportBtn.disabled = false;
          }
        }, 5000);
      }
      exportBtn.addEventListener("click", async function () {
        exportBtn.disabled = true;
        setExportStatus(tr("Starting…", "启动中…"));
        try {
          var res = await fetch("/api/user/export", { method: "POST", credentials: "include" });
          var j = await res.json();
          if (j && j.ok && j.job_id) {
            setExportStatus(tr("Building your archive…", "正在构建你的数据包…"));
            pollJob(j.job_id);
          } else {
            setExportStatus(tr("Could not start export.", "无法启动导出。"));
            exportBtn.disabled = false;
          }
        } catch (e) {
          setExportStatus(tr("Network error.", "网络错误。"));
          exportBtn.disabled = false;
        }
      });
      exportRow.appendChild(exportBtn);
      exportRow.appendChild(exportStatus);
      // CSSOS_PERSON_MV_WAVE64A 20260508 — link to creation timeline.
      var historyBtn = el("button", { class: "uhp-export-btn", onclick: function () { location.hash = "#creation-timeline"; } }, [
        "📜 " + tr("Creation history", "创作历史"),
      ]);
      exportRow.appendChild(historyBtn);
      // CSSOS_PERSON_MV_WAVE64C 20260508 — birth-year input (locked after first submit).
      var birthRow = el("div", { class: "uhp-export-row", style: "margin:6px 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;" }, []);
      var birthLabel = el("span", {}, ["🎂 " + tr("Birth year (sets max content rating)", "出生年份（用于设定最高分级）") + ":"]);
      var birthInput = el("input", { type: "number", min: "1900", max: String(new Date().getFullYear()), placeholder: "YYYY", style: "width:84px;" }, []);
      var birthBtn = el("button", { class: "uhp-export-btn", onclick: function () {
        var y = Number(birthInput.value);
        if (!Number.isFinite(y) || y < 1900) { birthStatus.textContent = tr("Invalid year.", "年份无效。"); return; }
        if (!confirm(tr("Birth year is locked once set. Continue?", "提交后年份将被锁定。是否继续？"))) return;
        birthBtn.disabled = true;
        fetch("/api/user/birth-year", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year: y }),
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (rj) {
            if (rj.ok && rj.j && rj.j.ok) {
              birthStatus.textContent = tr("Saved (locked).", "已保存（已锁定）。");
              birthInput.disabled = true;
            } else if (rj.j && rj.j.code === "BIRTH_YEAR_LOCKED") {
              birthStatus.textContent = tr("Already locked: ", "已锁定: ") + (rj.j.birth_year || "");
              birthInput.disabled = true;
            } else {
              birthStatus.textContent = tr("Failed: ", "失败: ") + ((rj.j && rj.j.code) || "?");
              birthBtn.disabled = false;
            }
          })
          .catch(function () { birthStatus.textContent = tr("Network error.", "网络错误。"); birthBtn.disabled = false; });
      } }, [tr("Save", "保存")]);
      var birthStatus = el("span", { style: "opacity:0.8;" }, [""]);
      // Pre-fill from /api/user/age-gate.
      fetch("/api/user/age-gate", { credentials: "include" })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok && j.data && j.data.birth_year) {
            birthInput.value = String(j.data.birth_year);
            birthInput.disabled = true;
            birthBtn.disabled = true;
            birthStatus.textContent = tr("Locked.", "已锁定。");
          }
        })
        .catch(function () {});
      birthRow.appendChild(birthLabel);
      birthRow.appendChild(birthInput);
      birthRow.appendChild(birthBtn);
      birthRow.appendChild(birthStatus);
      inner.appendChild(exportRow);
      inner.appendChild(birthRow);
    }

    // Recent MVs
    inner.appendChild(el("h2", { class: "uhp-section" }, ["🔥 " + tr("Latest creations", "最新创作")]));
    var grid = el("div", { class: "uhp-mv-grid" }, []);
    (data.recent_mvs || []).forEach(function (mv) {
      var card = el("div", { class: "uhp-mv-card", "data-content-rating": (mv.content_rating || ""), onclick: function () { openMv(mv.work_id); } }, [
        mv.cover_image ? el("img", { src: mv.cover_image, alt: "" }) : null,
        el("div", { class: "uhp-mv-meta" }, [
          el("strong", {}, [mv.person_zh || mv.title || ""]),
          el("em", {}, ["👁 " + (mv.view_count || 0) + " · ❤️ " + (mv.like_count || 0)]),
        ]),
      ]);
      grid.appendChild(card);
    });
    if (!(data.recent_mvs || []).length) {
      grid.appendChild(el("div", { class: "uhp-loading" }, [tr("No MVs yet.", "还没有作品。")]));
    }
    inner.appendChild(grid);

    // Top persons
    inner.appendChild(el("h2", { class: "uhp-section" }, ["🏛 " + tr("Favorite persons", "最爱人物")]));
    var personRow = el("div", { class: "uhp-person-row" }, []);
    (data.top_persons || []).forEach(function (p) {
      personRow.appendChild(el("div", { class: "uhp-person-card", onclick: function () { close(); openCodex(p.person_id); } }, [
        el("strong", {}, [p.name_zh || p.name_en]),
        el("span", {}, [p.civilization + " · " + (p.mv_count || 0) + " MVs"]),
      ]));
    });
    if (!(data.top_persons || []).length) {
      personRow.appendChild(el("div", { class: "uhp-loading" }, [tr("None yet.", "暂无。")]));
    }
    inner.appendChild(personRow);

    // Followers / Following tabs (collapsed: only render on tab click)
    inner.appendChild(el("h2", { class: "uhp-section" }, ["👥 " + tr("Followers / Following", "粉丝 / 关注")]));
    var tabs = el("div", { class: "uhp-tabs" }, []);
    var listHost = el("div", { class: "uhp-follow-list" }, []);
    var btnFollowers = el("button", {}, [tr("Followers", "粉丝") + " (" + fc.followers + ")"]);
    var btnFollowing = el("button", {}, [tr("Following", "关注中") + " (" + fc.following + ")"]);
    function loadTab(dir, btn) {
      [btnFollowers, btnFollowing].forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      listHost.innerHTML = "";
      listHost.appendChild(el("div", { class: "uhp-loading" }, [tr("Loading…", "加载中…")]));
      fetchFollows(handle, dir).then(function (rows) {
        listHost.innerHTML = "";
        if (!rows.length) {
          listHost.appendChild(el("div", { class: "uhp-loading" }, [tr("None.", "无。")]));
          return;
        }
        rows.forEach(function (item) {
          listHost.appendChild(el("div", {
            class: "uhp-follow-item",
            onclick: function () { navUser(item.username || item.id); },
          }, [
            el("img", { src: item.avatar_url || defaultAvatar(), alt: "" }),
            el("div", {}, [
              el("strong", {}, [item.display_name || item.username || ""]),
              item.username ? el("div", { style: "font-size:11px;color:rgba(0,245,160,0.7)" }, ["@" + item.username]) : null,
            ]),
          ]));
        });
      });
    }
    btnFollowers.addEventListener("click", function () { loadTab("followers", btnFollowers); });
    btnFollowing.addEventListener("click", function () { loadTab("following", btnFollowing); });
    tabs.appendChild(btnFollowers);
    tabs.appendChild(btnFollowing);
    inner.appendChild(tabs);
    inner.appendChild(listHost);

    root.querySelector(".uhp-inner").replaceWith(inner);
  }

  function maybeMount() {
    var m = /^#u\/([^/?&]+)/.exec(location.hash || "");
    if (m && m[1]) {
      render(decodeURIComponent(m[1]));
    } else {
      var node = document.getElementById("cssos-user-homepage");
      if (node) node.remove();
    }
  }

  window.addEventListener("hashchange", maybeMount);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", maybeMount);
  } else {
    maybeMount();
  }

  globalThis.openUserHomepage = function (handle) { navUser(handle); };
})();
