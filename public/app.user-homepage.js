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
    // CSSOS_PERSON_MV_WAVE71 20260508 — link to stats deep page.
    var statsBtn = el("button", {
      class: "uhp-follow",
      style: "margin-left:8px;background:transparent;color:#00f5a0;border:1px solid #00f5a0;",
      onclick: function () { location.hash = "#u/" + (u.username || u.id) + "/stats"; },
    }, ["📊 " + tr("Stats", "数据")]);
    heroText.appendChild(statsBtn);
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

      // CSSOS_WAVE105 20260508 — Jing — Tax & Payouts (creator KYC).
      inner.appendChild(el("h2", { class: "uhp-section" }, ["💰 " + tr("Tax & Payouts", "税务与支付")]));
      var taxRoot = el("div", { class: "uhp-tax-root", style: "display:flex;flex-direction:column;gap:8px;font-size:12px;" }, []);
      var taxStatus = el("div", { style: "opacity:0.85;" }, [tr("Loading…", "加载中…")]);
      taxRoot.appendChild(taxStatus);
      var taxForm = el("div", { style: "display:none;flex-wrap:wrap;gap:6px;align-items:center;" }, []);
      function mkTaxField(name, ph, w) {
        return el("input", { type: "text", placeholder: ph, "data-tax-field": name, style: "padding:4px 6px;background:rgba(0,0,0,0.4);color:#cfe;border:1px solid rgba(0,245,160,0.35);border-radius:4px;width:" + (w || 160) + "px;" }, []);
      }
      var fCountry = mkTaxField("country_code", "US/CN/JP", 80);
      var fLegal   = mkTaxField("legal_name", tr("Legal name", "法定姓名"), 200);
      var fTaxId   = mkTaxField("tax_id", tr("Tax ID (encrypted)", "税号（加密）"), 200);
      var fTaxType = el("select", { "data-tax-field": "tax_id_type", style: "padding:4px;background:rgba(0,0,0,0.4);color:#cfe;border:1px solid rgba(0,245,160,0.35);border-radius:4px;" }, [
        el("option", { value: "individual" }, ["individual"]),
        el("option", { value: "ssn" }, ["ssn"]),
        el("option", { value: "ein" }, ["ein"]),
        el("option", { value: "vat" }, ["vat"]),
        el("option", { value: "other" }, ["other"]),
      ]);
      var fLine1   = mkTaxField("address_line1", tr("Address line 1", "地址 1"), 240);
      var fCity    = mkTaxField("city", tr("City", "城市"), 140);
      var fState   = mkTaxField("state_region", tr("State/Region", "省/州"), 100);
      var fPostal  = mkTaxField("postal_code", tr("Postal code", "邮编"), 100);
      var fEmail   = mkTaxField("email_for_tax", tr("Tax email", "税务邮箱"), 220);
      var fBusType = el("select", { "data-tax-field": "business_type", style: "padding:4px;background:rgba(0,0,0,0.4);color:#cfe;border:1px solid rgba(0,245,160,0.35);border-radius:4px;" }, [
        el("option", { value: "individual" }, ["individual"]),
        el("option", { value: "sole_proprietor" }, ["sole_proprietor"]),
        el("option", { value: "llc" }, ["llc"]),
        el("option", { value: "corp" }, ["corp"]),
      ]);
      var fCert    = el("input", { type: "checkbox" }, []);
      var certLabel = el("label", { style: "display:flex;align-items:center;gap:4px;" }, [fCert, tr("I certify the above is correct.", "我确认上述信息真实准确。")]);
      var saveBtn = el("button", { class: "uhp-export-btn" }, ["💾 " + tr("Save tax info", "保存税务信息")]);
      var saveStatus = el("span", { style: "opacity:0.85;" }, [""]);
      [fCountry, fLegal, fTaxId, fTaxType, fLine1, fCity, fState, fPostal, fEmail, fBusType, certLabel, saveBtn, saveStatus].forEach(function (n) { taxForm.appendChild(n); });
      taxRoot.appendChild(taxForm);
      var encNote = el("div", { style: "opacity:0.7;font-size:11px;" }, [
        "🔒 " + tr("Your tax ID is encrypted at rest. We share with payment processor only when issuing payout.",
                   "你的税号已加密存储，仅在发起支付时分享给支付处理方。"),
      ]);
      taxRoot.appendChild(encNote);
      var payoutHost = el("div", { class: "uhp-payouts", style: "margin-top:6px;" }, []);
      taxRoot.appendChild(payoutHost);
      inner.appendChild(taxRoot);

      function renderPayouts(rows) {
        payoutHost.innerHTML = "";
        payoutHost.appendChild(el("h3", { style: "font-size:13px;font-weight:700;margin:8px 0 4px;color:rgba(218,255,238,0.92);" }, [tr("Payout history", "支付历史")]));
        if (!rows || !rows.length) {
          payoutHost.appendChild(el("div", { style: "opacity:0.7;" }, [tr("No payouts yet.", "暂无支付记录。")]));
          return;
        }
        var tbl = el("table", { style: "width:100%;font-size:11px;border-collapse:collapse;" }, []);
        var thead = el("thead", {}, [el("tr", {}, [
          el("th", { style: "text-align:left;padding:3px 4px;" }, [tr("Period", "周期")]),
          el("th", { style: "text-align:right;padding:3px 4px;" }, [tr("Amount", "金额")]),
          el("th", { style: "text-align:left;padding:3px 4px;" }, [tr("Source", "来源")]),
          el("th", { style: "text-align:left;padding:3px 4px;" }, [tr("Status", "状态")]),
        ])]);
        tbl.appendChild(thead);
        var tbody = el("tbody", {}, []);
        rows.forEach(function (p) {
          tbody.appendChild(el("tr", {}, [
            el("td", { style: "padding:3px 4px;" }, [String(p.period_start || "").slice(0, 10) + " — " + String(p.period_end || "").slice(0, 10)]),
            el("td", { style: "padding:3px 4px;text-align:right;" }, ["$" + (Number(p.amount_usd_cents || 0) / 100).toFixed(2)]),
            el("td", { style: "padding:3px 4px;" }, [String(p.source || "")]),
            el("td", { style: "padding:3px 4px;" }, [String(p.status || "")]),
          ]));
        });
        tbl.appendChild(tbody);
        payoutHost.appendChild(tbl);
      }

      function loadTax() {
        fetch("/api/user/tax-info", { credentials: "include" })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (!j || !j.ok) {
              taxStatus.textContent = tr("Could not load tax info.", "无法加载税务信息。");
              return;
            }
            var ti = (j.data && j.data.tax_info) || null;
            var required = !!(j.data && j.data.required);
            taxStatus.textContent = ti
              ? (tr("Tax info on file", "已登记税务信息") + (ti.certified_at ? " ✓" : "") + (ti.tax_id_masked ? " · " + ti.tax_id_masked : ""))
              : (required
                  ? tr("⚠️ Required: earnings exceed payout threshold. Fill below to release payouts.",
                       "⚠️ 已超出免税务登记额度，请完善以下信息以解锁支付。")
                  : tr("Not on file (optional until earnings exceed $20).",
                       "未登记（收入超过 $20 后必填）。"));
            taxForm.style.display = "flex";
            if (ti) {
              fCountry.value = ti.country_code || "";
              fLegal.value = ti.legal_name || "";
              if (ti.tax_id_type) fTaxType.value = ti.tax_id_type;
              fLine1.value = ti.address_line1 || "";
              fCity.value = ti.city || "";
              fState.value = ti.state_region || "";
              fPostal.value = ti.postal_code || "";
              fEmail.value = ti.email_for_tax || "";
              if (ti.business_type) fBusType.value = ti.business_type;
            }
          })
          .catch(function () { taxStatus.textContent = tr("Network error.", "网络错误。"); });

        fetch("/api/user/payouts", { credentials: "include" })
          .then(function (r) { return r.json(); })
          .then(function (j) { if (j && j.ok) renderPayouts((j.data && j.data.payouts) || []); })
          .catch(function () {});
      }
      loadTax();

      saveBtn.addEventListener("click", function () {
        if (!fCert.checked) {
          saveStatus.textContent = tr("Please certify first.", "请先勾选确认。");
          return;
        }
        var body = {
          country_code: fCountry.value,
          legal_name: fLegal.value,
          tax_id: fTaxId.value,
          tax_id_type: fTaxType.value,
          address_line1: fLine1.value,
          city: fCity.value,
          state_region: fState.value,
          postal_code: fPostal.value,
          email_for_tax: fEmail.value,
          business_type: fBusType.value,
          certified: true,
        };
        saveBtn.disabled = true;
        saveStatus.textContent = tr("Saving…", "保存中…");
        fetch("/api/user/tax-info", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (rj) {
            saveBtn.disabled = false;
            if (rj.ok && rj.j && rj.j.ok) {
              saveStatus.textContent = tr("Saved (encrypted).", "已保存（加密）。");
              fTaxId.value = "";
              loadTax();
            } else if (rj.j && rj.j.code === "KYC_KEY_MISSING") {
              saveStatus.textContent = tr("Server missing KYC key — contact admin.", "服务器缺少 KYC 密钥，请联系管理员。");
            } else {
              saveStatus.textContent = tr("Failed: ", "失败: ") + ((rj.j && rj.j.code) || "?");
            }
          })
          .catch(function () { saveBtn.disabled = false; saveStatus.textContent = tr("Network error.", "网络错误。"); });
      });
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
    var tabs = el("div", { class: "uhp-tabs", "data-segmented": "2" }, []);
    var listHost = el("div", { class: "uhp-follow-list" }, []);
    var btnFollowers = el("button", {}, [tr("Followers", "粉丝") + " (" + fc.followers + ")"]);
    var btnFollowing = el("button", {}, [tr("Following", "关注中") + " (" + fc.following + ")"]);
    function loadTab(dir, btn) {
      [btnFollowers, btnFollowing].forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
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
    var h = location.hash || "";
    // CSSOS_PERSON_MV_WAVE71 — defer to stats deep page when path is #u/{handle}/stats.
    if (/^#u\/[^/?&]+\/stats(?:[/?&].*)?$/.test(h)) {
      var node0 = document.getElementById("cssos-user-homepage");
      if (node0) node0.remove();
      return;
    }
    var m = /^#u\/([^/?&]+)$/.exec(h);
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
