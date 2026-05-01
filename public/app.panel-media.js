async function uploadLogoMediaFileModule(file, slot, trigger = null) {
  if (!(file instanceof File)) return "";
  try {
    setButtonBusy(trigger, true);
    const dataUrl = await fileToDataUrl(file);
    const res = await fetch("/api/panel-media/logo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        slot,
        file_name: file.name || `${slot}.bin`,
        data_url: dataUrl
      })
    });
    const payload = await res.json().catch(() => null);
    const data = getApiData(payload);
    if (!res.ok || payload?.ok === false || !data?.url) {
      throw new Error(payload?.code || `logo_media_upload_failed:${res.status}`);
    }
    return String(data.url || "");
  } catch {
    showToast(loginCopy("Failed to upload logo media."));
    return "";
  } finally {
    setButtonBusy(trigger, false);
  }
}

globalThis.uploadLogoMediaFileModule = uploadLogoMediaFileModule;
