const LOSSLESS_RETENTION_HOURS = 24;

function finalAudioArtifactUrl(runId, artifactPath) {
  const safeRunId = String(runId || "").trim();
  const safePath = String(artifactPath || "").trim();
  if (!safeRunId || !safePath) return "";
  return `/cssapi/v1/runs/${encodeURIComponent(safeRunId)}/music-delivery-artifact?path=${encodeURIComponent(safePath)}`;
}

function isLosslessMusicArtifactPath(path) {
  const lower = String(path || "").trim().toLowerCase();
  return [".wav", ".flac"].some((suffix) => lower.endsWith(suffix));
}

function canDownloadLosslessMusicArtifact(tier = getAccessTier()) {
  return isProPlusTier(tier);
}

async function requestMusicArtifactDownloadTicket(runId, artifactPath, fileName = "", options = {}) {
  const safeRunId = String(runId || "").trim();
  const safePath = String(artifactPath || "").trim();
  const safeAssetKey = String(options?.assetKey || "").trim();
  if (!safeRunId || (!safePath && !safeAssetKey)) return null;
  try {
    const response = await fetch("/api/music-artifacts/ticket", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        run_id: safeRunId,
        path: safePath || undefined,
        asset_key: safeAssetKey || undefined,
        file_name: String(fileName || "").trim() || undefined
      })
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object") return null;
    return typeof getApiData === "function" ? getApiData(payload) : payload?.data || payload;
  } catch (_err) {
    return null;
  }
}

async function downloadMusicArtifact(runId, artifactPath, fileName = "", options = {}) {
  const safePath = String(artifactPath || "").trim();
  const safeLossyPath = String(
    options?.lossyPath ||
      (/\.wav$/i.test(safePath) ? safePath.replace(/\.wav$/i, ".mp3") : /\.flac$/i.test(safePath) ? safePath.replace(/\.flac$/i, ".mp3") : "")
  ).trim();
  if (safePath && isLosslessMusicArtifactPath(safePath) && !canDownloadLosslessMusicArtifact()) {
    if (safeLossyPath) {
      showToast(loginCopy("WAV is for Pro+ members. Downloading MP3 instead."));
      return downloadMusicArtifact(runId, safeLossyPath, artifactDownloadName(safeLossyPath, fileName || "artifact"), {
        assetKey: String(options?.lossyAssetKey || "").trim()
      });
    }
    showToast(loginCopy("WAV is for Pro+ members. Please use the MP3 download instead."));
    return false;
  }
  const ticket = await requestMusicArtifactDownloadTicket(runId, artifactPath, fileName, options);
  if (!ticket?.download_url) {
    showToast(loginCopy("Download link is not ready yet."));
    return false;
  }
  if (safePath && isLosslessMusicArtifactPath(safePath) && canDownloadLosslessMusicArtifact()) {
    showToast(
      loginCopy(
        `WAV is temporary server storage. Please download it within ${LOSSLESS_RETENTION_HOURS} hours before automatic cleanup.`
      )
    );
  }
  if (ticket?.downgraded_from_lossless) {
    showToast(loginCopy("WAV is for Pro+ members. MP3 access has been prepared instead."));
  }
  try {
    const response = await fetch(String(ticket.download_url || ""), {
      headers: { accept: "*/*" }
    });
    if (!response.ok) {
      throw new Error(`download ${response.status}`);
    }
    const blob = await response.blob();
    triggerDownloadBlob(blob, String(ticket.file_name || fileName || "artifact"));
    return true;
  } catch (_err) {
    showToast(loginCopy("Download failed. Please try again from the system button."));
    return false;
  }
}

function isMediaDeliveryArtifactPath(path) {
  const lower = String(path || "").trim().toLowerCase();
  return [".wav", ".mp3", ".m4a", ".flac", ".ogg", ".mp4", ".webm", ".mov"].some((suffix) => lower.endsWith(suffix));
}

function artifactDownloadName(path, fallback = "artifact") {
  const safePath = String(path || "").trim();
  if (!safePath) return fallback;
  const name = safePath.split("/").pop();
  return String(name || fallback).trim() || fallback;
}

function buildExternalArtifactOpenControl(url, label, options = {}) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) return "";
  return `<a class="${escapeHtml(
    String(options.className || "report-export-action is-muted")
  )}" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
    String(label || loginCopy("Open Artifact"))
  )}</a>`;
}

function buildRunArtifactOpenControl(runId, path, label, options = {}) {
  const safeRunId = String(runId || "").trim();
  const safePath = String(path || "").trim();
  const safeAssetKey = String(options.assetKey || "").trim();
  const mediaPath = safePath || safeAssetKey;
  const losslessLocked = mediaPath && isLosslessMusicArtifactPath(mediaPath) && !canDownloadLosslessMusicArtifact();
  const safeLabel = escapeHtml(
    String(
      losslessLocked
        ? loginCopy("Download WAV (Pro+)")
        : label || loginCopy("Open Artifact")
    )
  );
  const className = escapeHtml(String(options.className || "report-export-action is-muted"));
  if (!safeRunId || (!safePath && !safeAssetKey)) return "";
  const downloadTargetPath = mediaPath;
  if (isMediaDeliveryArtifactPath(mediaPath)) {
    return `<button class="${className}" type="button" data-run-artifact-download="${escapeHtml(
      downloadTargetPath
    )}" data-run-artifact-id="${escapeHtml(safeRunId)}" data-run-artifact-name="${escapeHtml(
      artifactDownloadName(mediaPath, "media-artifact")
    )}" data-run-artifact-key="${escapeHtml(safeAssetKey)}">${safeLabel}</button>`;
  }
  if (safeAssetKey && !safePath) {
    return `<a class="${className}" href="${escapeHtml(
      `${apiBase()}/cssapi/v1/runs/${encodeURIComponent(safeRunId)}/music-delivery-artifact?asset_key=${encodeURIComponent(safeAssetKey)}`
    )}" target="_blank" rel="noopener">${safeLabel}</a>`;
  }
  return `<a class="${className}" href="${escapeHtml(
    `${apiBase()}/cssapi/v1/runs/${encodeURIComponent(safeRunId)}/music-delivery-artifact?path=${encodeURIComponent(safePath)}`
  )}" target="_blank" rel="noopener">${safeLabel}</a>`;
}

function buildDeliveryArtifactOpenControl(runId, item, label, options = {}) {
  const safeRunId = String(runId || "").trim();
  const safePath = String(item?.relative_path || "").trim();
  const safeAssetKey = String(item?.asset_key || options?.assetKey || "").trim();
  if (safeRunId && (safePath || safeAssetKey)) {
    return buildRunArtifactOpenControl(safeRunId, safePath, label, { ...options, assetKey: safeAssetKey });
  }
  return buildExternalArtifactOpenControl(String(item?.download_url || ""), label, options);
}

function resolveDeliveryArtifactAccessUrl(item) {
  const safeRunId = String(item?.run_id || item?.runId || deliveryDashboardState?.runId || "").trim();
  const safePath = String(item?.relative_path || "").trim();
  const safeAssetKey = String(item?.asset_key || "").trim();
  if (safeRunId && (safePath || safeAssetKey)) {
    const params = new URLSearchParams();
    if (safePath) params.set("path", safePath);
    if (safeAssetKey) params.set("asset_key", safeAssetKey);
    return `${apiBase()}/cssapi/v1/runs/${encodeURIComponent(safeRunId)}/music-delivery-artifact?${params.toString()}`;
  }
  return String(item?.download_url || "").trim();
}

function openDeliveryArtifactInNewTab(item) {
  const url = resolveDeliveryArtifactAccessUrl(item);
  if (!url) return false;
  window.open(url, "_blank", "noopener");
  return true;
}

async function fetchDeliveryArtifact(item, responseType = "text") {
  const url = resolveDeliveryArtifactAccessUrl(item);
  if (!url) {
    throw new Error("artifact_url_missing");
  }
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`artifact request failed: ${response.status}`);
  }
  if (responseType === "arrayBuffer") {
    return response.arrayBuffer();
  }
  if (responseType === "json") {
    return response.json();
  }
  if (responseType === "blob") {
    return response.blob();
  }
  return response.text();
}

function musicPlanArtifactUrl(runId) {
  return finalAudioArtifactUrl(runId, "./build/music.plan.json");
}

function deliveryArtifactDisplayPath(item) {
  return String(item?.relative_path || item?.asset_key || item?.download_url || "").trim();
}

function deliveryArtifactLabel(item, fallback = "artifact") {
  return String(item?.label || deliveryArtifactDisplayPath(item) || fallback).trim();
}

function deliveryArtifactLocator(item) {
  return String(item?.relative_path || item?.asset_key || "").trim().toLowerCase();
}

function deliveryArtifactStemBaseName(item, index = 0) {
  return String(item?.label || item?.relative_path || item?.asset_key || `stem-${index + 1}`)
    .replace(/\.(wav|wave)$/i, "")
    .trim();
}

function musicDeliveryPreviewKey(item) {
  return `${String(item?.category || "")}:${deliveryArtifactDisplayPath(item)}`;
}

function musicDeliveryMixerKey(items) {
  return Array.isArray(items)
    ? items
        .map((item) => deliveryArtifactDisplayPath(item))
        .sort()
        .join("|")
    : "";
}

function musicDeliveryArrangementKey(item) {
  return item ? deliveryArtifactDisplayPath(item) : "";
}

function findMusicDeliveryArrangementItem(items, pattern) {
  const safePattern = String(pattern || "").trim();
  if (!safePattern) return null;
  return (Array.isArray(items) ? items : []).find((item) =>
    String(deliveryArtifactDisplayPath(item) || "").includes(safePattern)
  ) || null;
}

function buildRewritePromotionArtifactItem(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  return {
    run_id: String(deliveryDashboardState?.runId || "").trim(),
    relative_path:
      String(
        source.relative_path ||
          source.promotion_relative_path ||
          source.provider_promotion_relative_path ||
          ""
      ).trim(),
    asset_key:
      String(
        source.asset_key ||
          source.promotion_asset_key ||
          source.provider_promotion_asset_key ||
          ""
      ).trim(),
    download_url: String(source.download_url || "").trim()
  };
}

function buildRewriteBundleHistoryArtifactItem(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  return {
    run_id: String(deliveryDashboardState?.runId || "").trim(),
    relative_path: String(
      source.relative_path || source.bundle_relative_path || source.json_relative_path || ""
    ).trim(),
    asset_key: String(
      source.asset_key || source.bundle_asset_key || source.json_asset_key || ""
    ).trim(),
    download_url: String(source.download_url || "").trim()
  };
}

function resolveComplianceAckArtifactPath(revision) {
  const source = revision && typeof revision === "object" ? revision : {};
  return String(source.compliance_ack_relative_path || source.compliance_ack_asset_key || "").trim();
}

function revisionFilesMatchArrangementModule(cueItem, phraseItem, promotion) {
  const revisions = Array.isArray(promotion?.apply_back_result?.revision_files)
    ? promotion.apply_back_result.revision_files
    : [];
  const cueRevision = String(revisions[0] || "").split("/").pop() || "";
  const phraseRevision = String(revisions[1] || "").split("/").pop() || "";
  const cuePath = deliveryArtifactDisplayPath(cueItem);
  const phrasePath = deliveryArtifactDisplayPath(phraseItem);
  return (!!cueRevision && cuePath.includes(cueRevision)) || (!!phraseRevision && phrasePath.includes(phraseRevision));
}

function stemMixerDisplayNameModule(item, index) {
  return deliveryArtifactStemBaseName(item, index);
}

function stemMixerRoleModule(item, index) {
  const path = String(item?.relative_path || item?.asset_key || item?.label || `stem-${index + 1}`).toLowerCase();
  if (path.includes("vocal") || path.includes("lead")) return "lead";
  if (path.includes("string")) return "strings";
  if (path.includes("brass")) return "brass";
  if (path.includes("bass")) return "bass";
  if (path.includes("perc") || path.includes("drum")) return "perc";
  if (path.includes("choir") || path.includes("backing")) return "choir";
  return "stem";
}

Object.assign(globalThis, {
  revisionFilesMatchArrangement: revisionFilesMatchArrangementModule,
  stemMixerDisplayName: stemMixerDisplayNameModule,
  stemMixerRole: stemMixerRoleModule
});

function buildDeliveryPreviewHeaderMarkup(preview) {
  const item = preview?.item || null;
  return `<div class="report-card-copy">${escapeHtml(deliveryArtifactDisplayPath(item))}</div>`;
}

function buildDeliveryPreviewWavMarkup(preview, previewUrl) {
  const waveform = Array.isArray(preview?.waveform) ? preview.waveform : [];
  return `
      ${buildDeliveryPreviewHeaderMarkup(preview)}
      <div class="report-card-copy">${escapeHtml(
        `${formatFileBytes(preview?.item?.bytes || 0)} · ${Number(preview?.duration || 0).toFixed(1)}s`
      )}</div>
      <audio controls preload="metadata" src="${escapeHtml(String(previewUrl || ""))}" style="width:100%; margin-top:8px;"></audio>
      <div style="display:flex;align-items:end;gap:2px;height:72px;margin-top:10px;">
        ${waveform.length
          ? waveform
              .map(
                (value) =>
                  `<div style="flex:1;min-width:2px;border-radius:999px;background:linear-gradient(180deg, rgba(255,255,255,0.92), rgba(120,180,255,0.48));height:${Math.max(6, Math.round(Number(value || 0) * 72))}px;"></div>`
              )
              .join("")
          : `<div class="report-empty">${escapeHtml(
              dashboardCopy("Waveform preview is unavailable for this file.", "这个文件暂时无法生成波形预览。")
            )}</div>`}
      </div>
    `;
}

function buildDeliveryPreviewTextMarkup(preview) {
  return `
      ${buildDeliveryPreviewHeaderMarkup(preview)}
      <pre class="report-preview-code">${escapeHtml(preview?.pretty || preview?.text || "")}</pre>
    `;
}

function buildDeliveryPreviewZipMarkup(preview) {
  const entries = Array.isArray(preview?.entries) ? preview.entries : [];
  return `
      ${buildDeliveryPreviewHeaderMarkup(preview)}
      <div class="report-card-copy">${escapeHtml(`${entries.length} entries · ${formatFileBytes(preview?.item?.bytes || 0)}`)}</div>
      <div class="report-list">
        ${
          entries.length
            ? entries
                .slice(0, 80)
                .map(
                  (entry) => `
                    <div class="report-list-item">
                      <div class="report-preview-title">${escapeHtml(entry.name || "entry")}</div>
                      <div class="report-card-copy">${escapeHtml(
                        `${formatFileBytes(entry.uncompressedSize || 0)} uncompressed · ${formatFileBytes(entry.compressedSize || 0)} compressed`
                      )}</div>
                    </div>
                  `
                )
                .join("")
            : `<div class="report-empty">${escapeHtml(
                dashboardCopy("No ZIP entries were found.", "没有读取到 ZIP 条目。")
              )}</div>`
        }
      </div>
    `;
}

function buildDeliveryBrowserGroupMarkup(category, items, runId) {
  const safeCategory = String(category || "").trim();
  const list = Array.isArray(items) ? items : [];
  if (!safeCategory || !list.length) return "";
  return `
    <div class="report-section-title">${escapeHtml(safeCategory)}</div>
    <div class="report-list">
      ${list
        .map(
          (item) => `
            <div class="report-list-item">
              <div class="report-preview-title">${escapeHtml(deliveryArtifactLabel(item))}</div>
              <div class="report-card-copy">${escapeHtml(deliveryArtifactDisplayPath(item))}</div>
              <div class="report-card-copy">${escapeHtml(`${item?.mime || "application/octet-stream"} · ${formatFileBytes(item?.bytes || 0)}`)}</div>
              <div class="report-export-actions">
                <button class="report-export-action is-muted" type="button" data-delivery-preview='${escapeHtml(JSON.stringify(item))}'>Preview</button>
                ${buildDeliveryArtifactOpenControl(runId, item, "Open", {
                  className: "report-export-action"
                })}
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function buildPublishedRevisionArtifactActions(runId, revision) {
  const safeRunId = String(runId || "").trim();
  const entry = revision && typeof revision === "object" ? revision : {};
  const controls = [
    ["release_manifest_relative_path", "release_manifest_asset_key", "Open Release Manifest"],
    ["immutable_handoff_relative_path", "immutable_handoff_asset_key", "Open Immutable Handoff"],
    ["release_approval_relative_path", "release_approval_asset_key", "Open Release Approval"],
    ["release_signoff_relative_path", "release_signoff_asset_key", "Open Sign-Off"],
    ["delivery_certificate_relative_path", "delivery_certificate_asset_key", "Open Delivery Certificate"],
    ["release_audit_trail_relative_path", "release_audit_trail_asset_key", "Open Audit Trail"],
    ["notarized_receipt_relative_path", "notarized_receipt_asset_key", "Open Notarized Receipt"],
    ["downstream_compliance_feed_relative_path", "downstream_compliance_feed_asset_key", "Open Compliance Feed"],
    ["compliance_ack_relative_path", "compliance_ack_asset_key", "Open Compliance Ack"],
    ["regulator_receipt_relative_path", "regulator_receipt_asset_key", "Open Regulator Receipt"],
    ["audit_timeline_relative_path", "audit_timeline_asset_key", "Open Audit Timeline"]
  ];
  const markup = controls
    .map(([pathKey, assetKeyKey, label]) => {
      const artifactPath = String(entry?.[pathKey] || "").trim();
      const assetKey = String(entry?.[assetKeyKey] || "").trim();
      if (!artifactPath && !assetKey) return "";
      return buildRunArtifactOpenControl(safeRunId, artifactPath, label, { assetKey });
    })
    .filter(Boolean)
    .join("");
  return markup ? `<div class="report-export-actions" style="flex-wrap:wrap;">${markup}</div>` : "";
}
