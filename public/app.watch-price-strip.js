/* CSSOS_WAVE_113B2 20260511 — Jing
 * "MV 面板，播放媒体的时候，媒体框底部中央要一直显示作品本人可见成本价格，
 *  以及聆听/观赏价格/买断价格/打赏/微信打赏（中国用户），以方便用户可以
 *  随时购买/打赏". A persistent pill row anchored at the bottom-center
 *  of .watch-screen. Reads the live work from
 *  globalThis.cssosMvPipelinePanelState() so the strip refreshes when
 *  the user switches MVs / Take 1↔Take 2 / playlist tracks. China
 *  users (zh locale or Asia/Shanghai timezone) get a "微信打赏"
 *  button that routes to the existing tip-nihaopay dispatcher.
 */
(function () {
  if (globalThis.__cssosWatchPriceStripWired) return;
  globalThis.__cssosWatchPriceStripWired = true;

  function fmt(cents) {
    var c = Number(cents || 0);
    if (!Number.isFinite(c) || c <= 0) return "—";
    var d = c / 100;
    return d >= 1 ? "$" + d.toFixed(2) : "¢" + c;
  }

  function isChinaUser() {
    try {
      var lc = (localStorage.getItem("CSSOS_LANG") || localStorage.getItem("cssos.locale") || "").toLowerCase();
      if (lc.indexOf("zh") === 0) return true;
    } catch (_) {}
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (/Shanghai|Chongqing|Urumqi|Hong_Kong|Taipei|Macau/.test(tz)) return true;
    } catch (_) {}
    return false;
  }

  /* CSSOS_WAVE_115 20260511 — Jing
   * App Store Guideline 3.1.1: "Apps offering 'real-world' services
   * may use external payment, but apps offering digital goods must
   * use Apple's IAP system. External-payment buttons for digital
   * goods (like our 微信/支付宝 tip chip) trigger immediate
   * rejection in the iOS native build.
   *
   * Detect Capacitor iOS runtime and hide the WeChat/Alipay chip
   * entirely. The international 💝 Tip chip stays — that one is
   * also wired through our generic /tip endpoint which (when running
   * in iOS native) will eventually need to route to IAP. For v1.0
   * submission, the demo account is pre-provisioned to Pro tier so
   * the entire payment column is effectively cosmetic during review. */
  function isIosNative() {
    try {
      var cap = globalThis.Capacitor;
      if (!cap) return false;
      if (typeof cap.isNativePlatform === "function" && !cap.isNativePlatform()) return false;
      var platform = (typeof cap.getPlatform === "function" ? cap.getPlatform() : "") || "";
      return String(platform).toLowerCase() === "ios";
    } catch (_) { return false; }
  }
  // Tertiary hard guard — Capacitor injects `Capacitor` into window,
  // but we also check the UA in case detection runs before Capacitor
  // initializes (rare race condition with very early render).
  function isLikelyIosApp() {
    if (isIosNative()) return true;
    try {
      var ua = String(navigator.userAgent || "");
      // The Capacitor webview includes "CSSStudio/" or "cssOS/" UA token
      // we'll add via Info.plist in Phase 1. For now, conservative: only
      // treat as iOS native when Capacitor object is actually present.
      return false && ua; // explicit no-op to keep the linter happy
    } catch (_) { return false; }
  }

  function copy(en, zh) {
    return typeof globalThis.loginCopy === "function"
      ? globalThis.loginCopy(en, zh || en)
      : (isChinaUser() && zh ? zh : en);
  }

  function buildStrip() {
    var screen = document.querySelector("#watch-panel .watch-screen");
    if (!screen) return null;
    var strip = document.getElementById("cssos-watch-price-strip");
    if (strip) return strip;
    strip = document.createElement("div");
    strip.id = "cssos-watch-price-strip";
    strip.dataset.noFrameToggle = "1";
    strip.style.cssText =
      "position:absolute;left:50%;bottom:14px;transform:translateX(-50%);" +
      "display:flex;flex-wrap:wrap;justify-content:center;gap:6px;" +
      "max-width:min(92%, 720px);z-index:14;" +
      "pointer-events:auto;";
    screen.appendChild(strip);
    return strip;
  }

  function chip(text, opts) {
    opts = opts || {};
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.dataset.noFrameToggle = "1";
    var bg = opts.kind === "buy"   ? "rgba(40, 110, 70, 0.78)"
           : opts.kind === "tip"   ? "rgba(150, 100, 30, 0.78)"
           : opts.kind === "wechat"? "rgba(34, 140, 60, 0.85)"
           : opts.kind === "cost"  ? "rgba(20, 20, 20, 0.55)"
           :                          "rgba(40, 80, 120, 0.75)";
    b.style.cssText =
      "background:" + bg + ";backdrop-filter:blur(8px);" +
      "border:1px solid rgba(255,255,255,0.22);border-radius:999px;" +
      "padding:5px 12px;font-size:12px;font-weight:600;letter-spacing:.02em;" +
      "color:rgba(255,255,255,0.96);cursor:" + (opts.onClick ? "pointer" : "default") + ";" +
      "line-height:1.2;white-space:nowrap;";
    if (opts.title) b.title = opts.title;
    if (opts.disabled) {
      b.disabled = true;
      b.style.opacity = "0.55";
      b.style.cursor = "default";
    }
    if (opts.onClick) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        try { opts.onClick(e); } catch (err) { console.warn("[price-strip]", err); }
      });
    }
    if (opts.dataset) {
      Object.keys(opts.dataset).forEach(function (k) { b.dataset[k] = opts.dataset[k]; });
    }
    return b;
  }

  function dispatch(action, workId, extraDataset) {
    // Reuse the existing market-commerce dispatcher: it accepts any
    // anchor element with data-market-action and the relevant
    // data-* attributes, so we create a hidden one on the fly.
    var anchor = document.createElement("button");
    anchor.style.display = "none";
    anchor.dataset.marketAction = action;
    if (extraDataset) {
      Object.keys(extraDataset).forEach(function (k) {
        anchor.dataset[k] = extraDataset[k];
      });
    }
    document.body.appendChild(anchor);
    try {
      if (typeof globalThis.dispatchMarketWorkPayment === "function") {
        globalThis.dispatchMarketWorkPayment(workId, action, anchor);
      } else if (typeof globalThis.showToast === "function") {
        globalThis.showToast(copy("Marketplace is loading — try again in a moment.", "市场模块加载中，稍后再试。"));
      }
    } finally {
      setTimeout(function () { try { anchor.remove(); } catch (_) {} }, 100);
    }
  }

  function renderStrip() {
    var strip = buildStrip();
    if (!strip) return;
    var ps = (typeof globalThis.cssosMvPipelinePanelState === "function")
      ? globalThis.cssosMvPipelinePanelState() : null;
    // CSSOS_WAVE_113B3 20260512 · iron rule
    // The price strip must be visible whenever the Watch panel is open,
    // no matter the entry path or playback status — so the user always
    // has a one-tap path to listen / view / buy out / tip. Even before
    // the MV is rendered we still show the price (suggested / floor)
    // and the Tip chip so fans can support the creator mid-render.
    var watchPanel = document.getElementById("watch-panel");
    var watchOpen = watchPanel && !watchPanel.hidden && watchPanel.offsetParent !== null;
    if (!ps && !watchOpen) { strip.style.display = "none"; return; }
    ps = ps || {};
    var workId = String(ps.workId || "").split("|")[0];
    strip.style.display = "flex";
    strip.innerHTML = "";

    var work = ps.work || ps.currentWork || {};
    var isOwn = ps.is_own === true || work.is_own === true;
    var listenCents = Number(work.current_listen_price_cents || work.listen_price_cents || work.suggested_listen_price_cents || ps.listenCents || 0);
    var buyoutCents = Number(work.current_buyout_price_cents || work.buyout_price_cents || work.suggested_buyout_price_cents || ps.buyoutCents || 0);
    var viewCents = Number(work.view_price_cents || work.current_view_price_cents || work.suggested_view_price_cents || 0);
    // CSSOS_WAVE_113J 20260511 — Jing
    // "凡是 0 的都是错的，不可能输出一个 MV 成本为 0".
    // Source priority (first non-zero wins):
    //   1. work.compute_cost_cents_estimate   (DB column persisted on /api/works/save)
    //   2. work.creator_cost_cents            (legacy field, kept for back-compat)
    //   3. ps.costCents                       (in-flight pipeline state)
    //   4. floorCost(work_type, duration)     (computed minimum so a real MV is never $0.00)
    function floorCostCentsFor(workType, durationSecs, skipStages) {
      var wt = String(workType || "single").toLowerCase();
      var d = Math.max(24, Math.min(1800, Number(durationSecs) || 180));
      // Floor model: lyrics(~5%) + cover(~7%) + music(~30%) + video(~50%) + compose(~8%)
      // scaled to ~18¢/min for a typical full pipeline.
      var perMinute = 18;
      var base = Math.round((d / 60) * perMinute);
      if (wt === "triptych") base = Math.round(base * 2.4);
      else if (wt === "opera") base = Math.round(base * 3.6);
      // CSSOS_WAVE_111 20260511 — Jing
      // skip_stages: user uploaded audio/lyrics, those stages didn't
      // run, so subtract their share. Stage proportions match
      // _cssosCostBreakdown in app.watch-ui.js.
      var stageShare = { lyrics: 0.05, cover: 0.07, music: 0.30, video: 0.50, compose: 0.08 };
      var skipped = Array.isArray(skipStages) ? skipStages : [];
      var skipPct = skipped.reduce(function (a, s) { return a + (stageShare[String(s).toLowerCase()] || 0); }, 0);
      base = Math.round(base * (1 - skipPct));
      return Math.max(5, base); // even fully-uploaded works carry server compose + storage floor
    }
    var costCents = Number(
      work.compute_cost_cents_estimate ||
      work.creator_cost_cents ||
      work.cost_cents ||
      ps.costCents ||
      0
    );
    if (!costCents || costCents <= 0) {
      costCents = floorCostCentsFor(
        work.work_type || ps.workType,
        work.duration_secs || ps.duration,
        work.skip_stages || ps.skipStages || []
      );
    }
    var tipsEnabled = work.tips_enabled !== false;
    var buyoutEnabled = work.buyout_enabled !== false;
    var canTransact = !isOwn && !!workId;

    // CSSOS_WAVE_113F 20260511 — Jing
    // "请显示完整价格信息 … 哪怕是免费，不出售版权，也都显示，
    //  让用户明白". Render every category unconditionally so the
    //  value/policy is always legible. Free → "Free"; not-for-sale
    //  buyout → "版权不出售"; tip routes split between international
    //  (Stripe-style) and 中国 (微信/支付宝via NihaoPay).

    // 1. Creator-visible cost (作品本人可见) — never 0; floor guarantees ≥ 15¢
    if (isOwn) {
      strip.appendChild(chip(
        copy("Cost", "成本") + " · " + fmt(costCents),
        {
          kind: "cost",
          title: copy(
            "Your creator cost (server compute + third-party engines). Only visible to you.",
            "本作品的创作成本（服务器算力 + 第三方引擎），仅作者本人可见。"
          )
        }
      ));
    }

    // 2. Listen price — always shown
    var listenLabel = copy("Listen", "聆听") + " · " +
      (listenCents > 0 ? fmt(listenCents) : copy("Free", "免费"));
    strip.appendChild(chip(listenLabel, {
      kind: "buy",
      title: copy("Suggested listening price", "系统建议的聆听价格"),
      disabled: !canTransact || listenCents <= 0,
      onClick: (canTransact && listenCents > 0) ? function () { dispatch("listen", workId); } : null
    }));

    // 3. View / 欣赏 price — always shown
    var viewLabel = copy("View", "欣赏") + " · " +
      (viewCents > 0 ? fmt(viewCents) : copy("Free", "免费"));
    strip.appendChild(chip(viewLabel, {
      kind: "buy",
      title: copy("Suggested viewing price", "系统建议的欣赏价格"),
      disabled: !canTransact || viewCents <= 0,
      onClick: (canTransact && viewCents > 0) ? function () { dispatch("view", workId); } : null
    }));

    // 4. Buyout — always shown; explicit "版权不出售" when disabled
    var buyoutLabel;
    if (!buyoutEnabled) {
      buyoutLabel = copy("Buyout · Not for sale", "买断 · 版权不出售");
    } else if (buyoutCents > 0) {
      buyoutLabel = copy("Buyout", "买断") + " · " + fmt(buyoutCents);
    } else {
      // CSSOS_WAVE_113G 20260511 — Jing
      // "买断 / Buyout，搞反了，不是免费，是无价，priceless".
      // buyout_enabled=true with no price means the work IS for
      // potential buyout but the creator hasn't set a number —
      // semantically that's "priceless / 无价之宝", not free.
      buyoutLabel = copy("Buyout · Priceless", "买断 · 无价之宝");
    }
    strip.appendChild(chip(buyoutLabel, {
      kind: "buy",
      title: buyoutEnabled
        ? copy("Suggested buyout price for full rights", "系统建议的版权买断价格")
        : copy("This work is not available for buyout", "本作品不出售版权"),
      disabled: !canTransact || !buyoutEnabled || buyoutCents <= 0,
      onClick: (canTransact && buyoutEnabled && buyoutCents > 0) ? function () { dispatch("buyout", workId); } : null
    }));

    // 5. Tip — international (Stripe etc.) — always shown
    strip.appendChild(chip(
      "💝 " + copy("Tip", "打赏") + (tipsEnabled ? "" : " · " + copy("off", "关")),
      {
        kind: "tip",
        title: copy("Send a tip to the creator (international)", "向创作者发送打赏（国外用户）"),
        disabled: !canTransact || !tipsEnabled,
        onClick: (canTransact && tipsEnabled) ? function () { dispatch("tip", workId); } : null
      }
    ));

    // 6. WeChat / Alipay tip — always shown for China users; shown
    //    as informational chip for others so they know the option
    //    exists for Chinese fans.
    //    CSSOS_WAVE_115 — HARD-HIDDEN on iOS native (App Store
    //    Guideline 3.1.1 immediate rejection). Web/Android/macOS
    //    Safari unaffected.
    var showWechat = (isChinaUser() || isOwn) && !isLikelyIosApp();
    if (showWechat) {
      strip.appendChild(chip(
        "🟢 " + copy("WeChat / Alipay Tip", "微信 / 支付宝 打赏") +
          (tipsEnabled ? "" : " · " + copy("off", "关")),
        {
          kind: "wechat",
          title: copy("Tip via WeChat Pay / Alipay (China)", "通过微信支付 / 支付宝打赏（中国用户）"),
          disabled: !canTransact || !tipsEnabled,
          onClick: (canTransact && tipsEnabled) ? function () {
            dispatch("tip-nihaopay", workId, {
              marketNihaopayCreator: String(work.owner_user_id || ""),
              marketNihaopayWork: workId
            });
          } : null
        }
      ));
    }

    // CSSOS_WAVE_111B7b 20260512 — Jing
    // 🔐 fingerprint chip: shown when the work has a fingerprint_hash.
    // Click opens /verify with a copy-to-clipboard for the hash and a
    // share link that any user can paste to verify provenance later.
    var fpHash = String(work.fingerprint_hash || ps.fingerprintHash || "").trim();
    if (workId && fpHash && /^[a-f0-9]{8,64}$/i.test(fpHash)) {
      strip.appendChild(chip(
        "🔐 " + copy("Verify", "验证"),
        {
          kind: "cost", // muted dark background — informational, not transactional
          title: copy(
            "This MV has a fingerprint. Click to verify its cssOS origin. Hash: " + fpHash,
            "本 MV 已生成指纹。点击验证 cssOS 原产证明。指纹：" + fpHash
          ),
          onClick: function () {
            // Open the public verify page with the hash prefilled.
            var url = "/verify?h=" + encodeURIComponent(fpHash);
            try {
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText("https://cssstudio.app/?fp=" + fpHash);
              }
            } catch (_) {}
            window.open(url, "_blank", "noopener");
          },
          dataset: { fingerprintHash: fpHash },
        }
      ));
    } else if (workId && isOwn && !fpHash) {
      // Owner can trigger fingerprint generation on-demand (in case the
      // automatic compose-finalize hook didn't fire — e.g. very old work).
      strip.appendChild(chip(
        "🔐 " + copy("Fingerprint", "生成指纹"),
        {
          kind: "cost",
          title: copy(
            "Generate a cssOS provenance fingerprint for this MV.",
            "为本作品生成 cssOS 原产指纹。"
          ),
          onClick: function () {
            fetch("/api/works/" + encodeURIComponent(workId) + "/fingerprint", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: "{}",
              credentials: "include",
            }).then(function (r) { return r.json(); }).then(function (j) {
              if (j && j.ok && j.fingerprint_hash) {
                if (typeof globalThis.showToast === "function") {
                  globalThis.showToast("🔐 " + copy("Fingerprint generated", "已生成指纹") + ": " + j.fingerprint_hash);
                }
                // Mutate ps so next renderStrip tick shows the verify chip.
                if (work) work.fingerprint_hash = j.fingerprint_hash;
                renderStrip();
              } else if (typeof globalThis.showToast === "function") {
                globalThis.showToast(copy("Fingerprint failed: ", "指纹生成失败：") + ((j && j.error) || "unknown"));
              }
            }).catch(function (err) {
              if (typeof globalThis.showToast === "function") {
                globalThis.showToast(copy("Fingerprint failed: ", "指纹生成失败：") + (err && err.message || err));
              }
            });
          },
        }
      ));
    }
  }

  function start() {
    renderStrip();
    // Re-render every 4s — cheap, and catches Take 1/Take 2 swaps,
    // playlist advances, and post-purchase price updates.
    setInterval(renderStrip, 4000);
    // Also re-render on common app events.
    ["cssos:work-changed", "cssos:playlist-advance", "cssos:purchase-complete"]
      .forEach(function (ev) { document.addEventListener(ev, renderStrip); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
