function revokeMusicDeliveryPreviewUrlBridge() {
  if (deliveryDashboardState.previewUrl) {
    URL.revokeObjectURL(deliveryDashboardState.previewUrl);
    deliveryDashboardState.previewUrl = "";
  }
}

function formatFileBytesBridge(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseZipEntriesBridge(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const minOffset = Math.max(0, bytes.length - 65557);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= minOffset; i -= 1) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error("ZIP central directory was not found");
  }
  const view = new DataView(arrayBuffer);
  const totalEntries = view.getUint16(eocd + 10, true);
  const centralDirOffset = view.getUint32(eocd + 16, true);
  let cursor = centralDirOffset;
  const decoder = new TextDecoder("utf-8");
  const entries = [];
  for (let index = 0; index < totalEntries && cursor + 46 <= bytes.length; index += 1) {
    if (
      bytes[cursor] !== 0x50 ||
      bytes[cursor + 1] !== 0x4b ||
      bytes[cursor + 2] !== 0x01 ||
      bytes[cursor + 3] !== 0x02
    ) {
      break;
    }
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLen;
    const name = decoder.decode(bytes.slice(nameStart, nameEnd));
    entries.push({
      name,
      compressedSize,
      uncompressedSize
    });
    cursor = nameEnd + extraLen + commentLen;
  }
  return entries;
}

async function buildWavPreviewBridge(item, response) {
  const arrayBuffer = await response.arrayBuffer();
  revokeMusicDeliveryPreviewUrlBridge();
  const blob = new Blob([arrayBuffer], { type: item?.mime || "audio/wav" });
  const previewUrl = URL.createObjectURL(blob);
  let waveform = [];
  let duration = 0;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const channel = decoded.getChannelData(0);
      duration = decoded.duration || 0;
      const buckets = 48;
      const bucketSize = Math.max(1, Math.floor(channel.length / buckets));
      waveform = Array.from({ length: buckets }, (_, idx) => {
        const start = idx * bucketSize;
        const end = Math.min(channel.length, start + bucketSize);
        let peak = 0;
        for (let i = start; i < end; i += 1) {
          peak = Math.max(peak, Math.abs(channel[i] || 0));
        }
        return peak;
      });
      await ctx.close().catch(() => {});
    }
  } catch {}
  deliveryDashboardState.previewUrl = previewUrl;
  return { kind: "wav", item, duration, waveform };
}

async function buildTextPreviewBridge(item, response) {
  const text = await response.text();
  return {
    kind: item?.mime?.includes("json") ? "json" : "text",
    item,
    text,
    pretty: item?.mime?.includes("json")
      ? JSON.stringify(JSON.parse(text), null, 2)
      : text
  };
}

async function buildZipPreviewBridge(item, response) {
  const arrayBuffer = await response.arrayBuffer();
  return {
    kind: "zip",
    item,
    entries: parseZipEntriesBridge(arrayBuffer)
  };
}

async function previewMusicDeliveryArtifactBridge(item) {
  if (!item) return;
  const nextKey = musicDeliveryPreviewKey(item);
  if (
    deliveryDashboardState.previewKey === nextKey &&
    deliveryDashboardState.previewData &&
    !deliveryDashboardState.previewLoading
  ) {
    return;
  }
  revokeMusicDeliveryPreviewUrlBridge();
  deliveryDashboardState.previewKey = nextKey;
  deliveryDashboardState.previewLoading = true;
  deliveryDashboardState.previewError = "";
  deliveryDashboardState.previewData = null;
  globalThis.renderMusicDeliveryDashboard?.();
  try {
    const accessUrl = resolveDeliveryArtifactAccessUrl(item);
    if (!accessUrl) {
      throw new Error("preview request failed: missing access url");
    }
    const response = await fetch(accessUrl, {
      method: "GET",
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`preview request failed: ${response.status}`);
    }
    const mime = String(item?.mime || "");
    const artifactLocator = globalThis.deliveryArtifactLocator?.(item) || "";
    if (mime.includes("audio/wav") || artifactLocator.endsWith(".wav")) {
      deliveryDashboardState.previewData = await buildWavPreviewBridge(item, response);
    } else if (mime.includes("application/json") || artifactLocator.endsWith(".json")) {
      deliveryDashboardState.previewData = await buildTextPreviewBridge(item, response);
    } else if (mime.includes("text/plain") || artifactLocator.endsWith(".txt")) {
      deliveryDashboardState.previewData = await buildTextPreviewBridge(item, response);
    } else if (mime.includes("application/zip") || artifactLocator.endsWith(".zip")) {
      deliveryDashboardState.previewData = await buildZipPreviewBridge(item, response);
    } else {
      throw new Error("Preview is not supported for this file type yet");
    }
  } catch (error) {
    deliveryDashboardState.previewError = String(error);
  } finally {
    deliveryDashboardState.previewLoading = false;
    globalThis.renderMusicDeliveryDashboard?.();
  }
}

Object.assign(globalThis, {
  revokeMusicDeliveryPreviewUrlBridge,
  formatFileBytesBridge,
  parseZipEntriesBridge,
  buildWavPreviewBridge,
  buildTextPreviewBridge,
  buildZipPreviewBridge,
  previewMusicDeliveryArtifactBridge
});
