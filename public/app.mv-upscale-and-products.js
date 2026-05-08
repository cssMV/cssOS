/* CSSOS_PERSON_MV_WAVE45_48 20260508 — Jing
 * Wave 45 (upscale) + Wave 48 (product attachments) frontend wiring.
 *
 * Locality (per Jing's preference: where you use it is where you change
 * it): the "Upgrade quality" dropdown lives ON the watch panel itself
 * (not in a centralized settings page), and the product chip lives in
 * the cinema bottom strip next to the existing controls.
 *
 * This file is a small attach-on-demand helper. It exposes:
 *   window.cssosUpscaleAttach(workId, host)        — render upscale UI
 *   window.cssosProductsAttach(workId, host, opts) — render products UI
 * Other scripts (app.watch-ui.js, market panels) call these where the
 * MV is mounted.
 */
(function () {
  "use strict";

  function el(tag, attrs, kids) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        if (k === "style" && typeof attrs[k] === "object") {
          Object.assign(node.style, attrs[k]);
        } else if (k === "onclick" || k === "onmouseenter" || k === "onmouseleave") {
          node.addEventListener(k.slice(2), attrs[k]);
        } else if (k in node) {
          try { node[k] = attrs[k]; } catch (_) { node.setAttribute(k, attrs[k]); }
        } else {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    if (kids) {
      for (const kid of [].concat(kids)) {
        if (kid == null) continue;
        node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
      }
    }
    return node;
  }

  async function postJson(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body || {}),
    });
    return r.json().catch(() => ({ ok: false }));
  }
  async function getJson(url) {
    const r = await fetch(url, { credentials: "same-origin" });
    return r.json().catch(() => ({ ok: false }));
  }

  function pollUpscale(jobId, onUpdate) {
    let alive = true;
    let delay = 4000;
    (async function tick() {
      while (alive) {
        await new Promise((r) => setTimeout(r, delay));
        if (!alive) return;
        const j = await getJson("/api/upscale-jobs/" + encodeURIComponent(jobId));
        if (j && j.ok && j.job) {
          onUpdate(j.job);
          if (j.job.status === "done" || j.job.status === "failed") return;
        }
        delay = Math.min(delay + 2000, 15000);
      }
    })();
    return () => { alive = false; };
  }

  /** Wave 45 — upscale dropdown.
   *  host: an element to append the dropdown into (e.g. a toolbar).
   *  Pass {video} option to swap the <video> src on completion. */
  window.cssosUpscaleAttach = function (workId, host, opts) {
    if (!workId || !host) return;
    opts = opts || {};
    const wrap = el("div", { className: "cssos-upscale-wrap", style: { display: "inline-flex", gap: "6px", alignItems: "center" } });
    const sel = el("select", { className: "cssos-upscale-select", title: "Upgrade quality" });
    sel.appendChild(el("option", { value: "" }, "🔍 Upgrade quality"));
    sel.appendChild(el("option", { value: "1080p" }, "1080p (30 💎)"));
    sel.appendChild(el("option", { value: "4k" }, "4K (100 💎)"));
    const status = el("span", { className: "cssos-upscale-status", style: { fontSize: "12px", opacity: "0.8" } });
    sel.addEventListener("change", async () => {
      const target = sel.value;
      if (!target) return;
      sel.disabled = true;
      status.textContent = "Submitting…";
      const j = await postJson("/api/works/" + encodeURIComponent(workId) + "/upscale", {
        target_resolution: target,
        source_resolution: opts.source_resolution || "720p",
      });
      if (!j || !j.ok) {
        status.textContent = (j && j.code) ? ("Failed: " + j.code) : "Failed";
        sel.disabled = false;
        sel.value = "";
        return;
      }
      status.textContent = "Upscaling… ⏳";
      pollUpscale(j.job_id, (job) => {
        if (job.status === "done") {
          status.textContent = "Done ✓";
          if (opts.video && job.output_url) {
            try { opts.video.src = job.output_url; opts.video.load && opts.video.load(); } catch (_) {}
          }
        } else if (job.status === "failed") {
          status.textContent = "Failed (refunded)";
          sel.disabled = false;
          sel.value = "";
        }
      });
    });
    wrap.appendChild(sel);
    wrap.appendChild(status);
    host.appendChild(wrap);
    return wrap;
  };

  /** Wave 48 — product attachments.
   *  Renders a "🛍 N products" chip; click expands a panel.
   *  Click product → POST /click then opens URL in new tab.
   *  When opts.video is provided, hover pauses the video. */
  window.cssosProductsAttach = async function (workId, host, opts) {
    if (!workId || !host) return;
    opts = opts || {};
    const data = await getJson("/api/works/" + encodeURIComponent(workId) + "/products");
    const products = (data && data.ok && Array.isArray(data.products)) ? data.products : [];
    if (!products.length && !opts.alwaysShow) return null;

    const chip = el("button", {
      type: "button",
      className: "cssos-products-chip",
      style: {
        display: "inline-flex", gap: "4px", alignItems: "center",
        padding: "4px 10px", borderRadius: "999px",
        border: "1px solid rgba(255,255,255,0.4)",
        background: "rgba(0,0,0,0.4)", color: "#fff",
        fontSize: "12px", cursor: "pointer",
      },
    }, "🛍 " + products.length + " product" + (products.length === 1 ? "" : "s"));
    const panel = el("div", {
      className: "cssos-products-panel",
      style: {
        position: "absolute", bottom: "60px", right: "16px",
        maxWidth: "320px", padding: "10px", borderRadius: "10px",
        background: "rgba(15,15,20,0.92)", color: "#fff",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)", display: "none",
        zIndex: "9999", fontSize: "13px",
      },
    });
    products.sort((a, b) => (a.position || 0) - (b.position || 0));
    for (const p of products) {
      const card = el("a", {
        href: p.url,
        target: "_blank",
        rel: "noopener noreferrer",
        style: {
          display: "flex", gap: "8px", padding: "6px 4px",
          color: "inherit", textDecoration: "none",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        },
        onmouseenter: () => { if (opts.video) try { opts.video.pause(); } catch (_) {} },
        onmouseleave: () => {},
        onclick: (ev) => {
          // Fire-and-forget click record. Don't block navigation.
          fetch("/api/works/" + encodeURIComponent(workId) + "/products/" +
                encodeURIComponent(p.attachment_id) + "/click",
                { method: "POST", credentials: "same-origin" }).catch(() => {});
        },
      });
      if (p.image_url) {
        card.appendChild(el("img", {
          src: p.image_url, alt: "",
          style: { width: "48px", height: "48px", objectFit: "cover", borderRadius: "6px" },
        }));
      }
      const meta = el("div", { style: { flex: "1", minWidth: "0" } });
      meta.appendChild(el("div", { style: { fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis" } }, p.title));
      if (p.price_text) meta.appendChild(el("div", { style: { opacity: "0.8" } }, p.price_text));
      card.appendChild(meta);
      panel.appendChild(card);
    }
    chip.addEventListener("click", () => {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    });
    host.appendChild(chip);
    host.appendChild(panel);
    return { chip, panel, products };
  };
})();
