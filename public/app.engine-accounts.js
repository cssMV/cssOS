// CSSOS_PHASE2_BYOK_FRONTEND 20260420 — Task #70 Runway BYOK pilot
//
// Engine Accounts (BYOK = Bring Your Own Key) frontend module.
//
// Lets users paste their own Runway / ElevenLabs / Stability / (Suno later)
// API keys into CSS Studio. When a user-key is on file, the Rust pipeline
// dispatches with *their* key and we only charge a small orchestration fee
// instead of the platform-key base price.
//
// Backend routes (see rust-api/src/engine_credentials/api.rs):
//   GET    /api/settings/engine-keys                    — list user keys
//   POST   /api/settings/engine-keys                    — upsert { engine, api_key }
//   DELETE /api/settings/engine-keys/:engine            — revoke (soft)
//   POST   /api/settings/engine-keys/:engine/test       — validate via whoami
//
// The plaintext API key NEVER leaves the user's browser except on the
// POST upsert/test calls. We only ever render the last-4 suffix.
//
// This file is intentionally standalone — it exposes three globals:
//   renderEngineAccountsCard(apiBody)  — mount the section into the API panel
//   openEngineAccountsModal()          — standalone modal fallback (not yet
//                                        wired into UI, reserved for later)
//   engineAccountsState                — read-only cached payload
//
// No re-declaration of `tr`/`escapeHtml`/`showToast`/`authState`/`setButtonBusy`;
// those live in app.js / i18n / api-billing.js and are available at runtime.

if (typeof globalThis.tr !== "function") {
  globalThis.tr = function trFallback(english, vars) {
    const source = typeof english === "string" ? english : String(english == null ? "" : english);
    if (vars && typeof vars === "object") {
      return source.replace(/\{(\w+)\}/g, (_m, key) =>
        vars[key] != null ? String(vars[key]) : `{${key}}`
      );
    }
    return source;
  };
}

if (!globalThis.engineAccountsState) {
  globalThis.engineAccountsState = {
    loaded: false,
    loading: false,
    byokEnabled: false,
    supportedEngines: ["runway", "elevenlabs", "stability", "suno"],
    // map keyed by engine_key → { key_suffix, status, last_validated_at, last_used_at, ... }
    credentials: {},
    // last test-result per engine for UI feedback (balance, error, etc.)
    testResults: {},
    // local overlay of status updates from Test buttons (so we don't need a full refetch)
    statusOverrides: {}
  };
}

const ENGINE_ACCOUNTS_PRESETS = [
  {
    key: "runway",
    label: () => tr("Runway Gen-4 (video)"),
    placeholder: "runway_...",
    supportsTest: true,
    note: () => tr("Paste the Organization API key from https://app.runwayml.com → Developer. When a valid key is on file, video generations draw from your own Runway credits and CSS Studio only charges a small orchestration fee."),
    helpUrl: "https://docs.dev.runwayml.com"
  },
  {
    key: "elevenlabs",
    label: () => tr("ElevenLabs (voice / music)"),
    placeholder: "sk_...",
    // CSSOS_PHASE2_BYOK 20260420 — Task #71: whoami hits GET /v1/user and
    // surfaces character_balance + tier so the settings card renders
    // "ElevenLabs · 42,318 / 100,000 chars · creator · valid".
    supportsTest: true,
    note: () => tr("From https://elevenlabs.io → Profile → API Keys. When a valid key is on file, voice and music generations use your own ElevenLabs quota."),
    helpUrl: "https://elevenlabs.io/docs/api-reference"
  },
  {
    key: "stability",
    label: () => tr("Stability AI (Stable Audio / image)"),
    placeholder: "sk-...",
    supportsTest: true,
    note: () => tr("From https://platform.stability.ai → API Keys. When a valid key is on file, Stable Audio and Stability image calls use your own Stability credits."),
    helpUrl: "https://platform.stability.ai/docs/api-reference"
  },
  {
    key: "suno",
    label: () => tr("Suno (music) — pending public API"),
    placeholder: "",
    supportsTest: false,
    disabled: true,
    note: () => tr("Suno has not yet released a public third-party API. This slot is reserved so we can flip BYOK on for Suno the moment they ship."),
    helpUrl: ""
  }
];

function engineAccountsSafeEscape(value) {
  if (typeof escapeHtml === "function") return escapeHtml(value == null ? "" : String(value));
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function engineAccountsSafeToast(message) {
  if (typeof showToast === "function") {
    showToast(String(message || ""));
  } else {
    // eslint-disable-next-line no-console
    console.info(`[engine-accounts] ${message}`);
  }
}

function engineAccountsSafeSetBusy(button, busy) {
  if (!(button instanceof HTMLElement)) return;
  if (typeof setButtonBusy === "function") {
    setButtonBusy(button, !!busy);
    return;
  }
  button.disabled = !!busy;
  if (busy) button.setAttribute("data-busy", "1");
  else button.removeAttribute("data-busy");
}

function engineAccountsIsLoggedIn() {
  const auth = globalThis.authState;
  return !!(auth && auth.user);
}

function engineAccountsMaskedSuffix(suffix) {
  const clean = String(suffix || "").trim();
  if (!clean) return tr("(hidden)");
  return "••••" + clean;
}

function engineAccountsFormatTimestamp(value) {
  if (!value) return "";
  try {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  } catch (_) {
    return String(value);
  }
}

function engineAccountsBadgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "success";
  if (s === "invalid") return "warning";
  if (s === "revoked") return "neutral";
  return "neutral";
}

function engineAccountsBadgeText(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return tr("Active");
  if (s === "invalid") return tr("Invalid");
  if (s === "revoked") return tr("Revoked");
  return tr("Not set");
}

// CSSMV_CONSOLE_CLEANUP 20260424 #92 — Jing: silence "祖国江山一片红". When the
// BYOK endpoint 404s (backend not yet shipped in this environment), persist
// an "unavailable" flag in localStorage (was sessionStorage) so we stop
// hitting the network on every page reload AND across browser sessions.
// Auto-expires after 6h so the app self-heals when the endpoint ships.
const ENGINE_KEYS_SS_DISABLED_UNTIL = "cssos.engineKeys.disabledUntil";
const ENGINE_KEYS_DISABLED_TTL_MS = 6 * 60 * 60 * 1000;
const ENGINE_KEYS_STORE = (typeof localStorage !== "undefined") ? localStorage : null;

function engineKeysEndpointDisabled() {
  try {
    if (!ENGINE_KEYS_STORE) return false;
    const raw = ENGINE_KEYS_STORE.getItem(ENGINE_KEYS_SS_DISABLED_UNTIL);
    const until = raw ? parseInt(raw, 10) : 0;
    if (until && Date.now() < until) return true;
    if (raw) ENGINE_KEYS_STORE.removeItem(ENGINE_KEYS_SS_DISABLED_UNTIL);
  } catch (_err) { /* ignore */ }
  return false;
}

function engineKeysTripBreaker() {
  try {
    if (ENGINE_KEYS_STORE) {
      ENGINE_KEYS_STORE.setItem(
        ENGINE_KEYS_SS_DISABLED_UNTIL,
        String(Date.now() + ENGINE_KEYS_DISABLED_TTL_MS)
      );
    }
  } catch (_err) { /* ignore */ }
}

async function engineAccountsFetchList() {
  const state = globalThis.engineAccountsState;
  if (!engineAccountsIsLoggedIn()) {
    state.loaded = true;
    state.credentials = {};
    return state;
  }
  // CSSMV_CONSOLE_CLEANUP 20260423 #92 — session-scoped breaker.
  if (engineKeysEndpointDisabled()) {
    state.loaded = true;
    state.credentials = {};
    state.byokEnabled = false;
    return state;
  }
  state.loading = true;
  try {
    const res = await fetch("/api/settings/engine-keys", {
      method: "GET",
      credentials: "include"
    });
    if (!res.ok) {
      // 401/403 → leave state empty but mark loaded so the card can render a guest notice.
      if (res.status === 404 || res.status === 501 ||
          res.status === 502 || res.status === 503) {
        engineKeysTripBreaker();
      }
      state.loaded = true;
      state.credentials = {};
      state.byokEnabled = false;
      return state;
    }
    const payload = await res.json().catch(() => null);
    const data = payload?.data || payload || {};
    const list = Array.isArray(data.credentials) ? data.credentials : [];
    const byEngine = {};
    list.forEach((row) => {
      if (row && row.engine_key) {
        byEngine[String(row.engine_key).toLowerCase()] = row;
      }
    });
    state.credentials = byEngine;
    state.byokEnabled = !!data.byok_enabled;
    if (Array.isArray(data.supported_engines) && data.supported_engines.length) {
      state.supportedEngines = data.supported_engines.map((x) => String(x).toLowerCase());
    }
    state.loaded = true;
    return state;
  } catch (_err) {
    // Network-level failure — trip the breaker too (same as HTTP 404/5xx).
    engineKeysTripBreaker();
    state.loaded = true;
    state.credentials = {};
    state.byokEnabled = false;
    return state;
  } finally {
    state.loading = false;
  }
}

async function engineAccountsUpsert(engineKey, apiKey) {
  const res = await fetch("/api/settings/engine-keys", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ engine: engineKey, api_key: apiKey })
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.ok === false) {
    const msg = String(payload?.error || payload?.message || `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return payload?.data || payload || {};
}

async function engineAccountsRevoke(engineKey) {
  const res = await fetch(`/api/settings/engine-keys/${encodeURIComponent(engineKey)}`, {
    method: "DELETE",
    credentials: "include"
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.ok === false) {
    const msg = String(payload?.error || payload?.message || `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return payload?.data || payload || {};
}

async function engineAccountsTest(engineKey) {
  const res = await fetch(`/api/settings/engine-keys/${encodeURIComponent(engineKey)}/test`, {
    method: "POST",
    credentials: "include"
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.ok === false) {
    const msg = String(payload?.error || payload?.message || `HTTP ${res.status}`);
    const err = new Error(msg);
    err.payload = payload;
    throw err;
  }
  return payload?.data || payload || {};
}

function engineAccountsBuildCardMarkup(preset, row, testResult) {
  const status = row?.status || "not_set";
  const badgeClass = engineAccountsBadgeClass(status);
  const badgeText = engineAccountsBadgeText(status);
  const suffix = row ? engineAccountsMaskedSuffix(row.key_suffix) : tr("(not configured)");
  const validatedAt = row?.last_validated_at ? engineAccountsFormatTimestamp(row.last_validated_at) : "";
  const usedAt = row?.last_used_at ? engineAccountsFormatTimestamp(row.last_used_at) : "";

  const testLine = testResult
    ? (testResult.ok
        ? `<div class="works-note" style="color:#4caf50;">${engineAccountsSafeEscape(testResult.message || tr("Key validated."))}</div>`
        : `<div class="works-note" style="color:#ff6b6b;">${engineAccountsSafeEscape(testResult.message || tr("Key validation failed."))}</div>`)
    : "";

  const hasKey = !!row && status !== "revoked";
  const canTest = preset.supportsTest && hasKey && status === "active";
  const isDisabled = !!preset.disabled;

  const primaryLabel = hasKey ? tr("Update key") : tr("Add key");
  const primaryClass = hasKey ? "mini-btn ghost" : "mini-btn";

  return `
    <article class="workspace-card engine-account-card" data-engine-account-card="${engineAccountsSafeEscape(preset.key)}">
      <div class="workspace-card-head">
        <div>
          <div class="work-title">${engineAccountsSafeEscape(preset.label())}</div>
          <div class="work-tags">${engineAccountsSafeEscape(suffix)}</div>
          ${validatedAt ? `<div class="works-note">${engineAccountsSafeEscape(tr("Validated: {ts}", { ts: validatedAt }))}</div>` : ""}
          ${usedAt ? `<div class="works-note">${engineAccountsSafeEscape(tr("Last used: {ts}", { ts: usedAt }))}</div>` : ""}
        </div>
        <div class="report-badge ${badgeClass}">${engineAccountsSafeEscape(badgeText)}</div>
      </div>
      <div class="works-note">${engineAccountsSafeEscape(preset.note())}</div>
      ${testLine}
      <div class="work-actions" style="gap:8px; flex-wrap:wrap;">
        ${isDisabled
          ? `<button class="mini-btn ghost" type="button" disabled>${engineAccountsSafeEscape(tr("Not yet available"))}</button>`
          : `
            <button class="${primaryClass}" type="button" data-engine-accounts-add="${engineAccountsSafeEscape(preset.key)}">
              ${engineAccountsSafeEscape(primaryLabel)}
            </button>
            ${canTest
              ? `<button class="mini-btn ghost" type="button" data-engine-accounts-test="${engineAccountsSafeEscape(preset.key)}">${engineAccountsSafeEscape(tr("Test"))}</button>`
              : ""}
            ${hasKey
              ? `<button class="mini-btn ghost" type="button" data-engine-accounts-remove="${engineAccountsSafeEscape(preset.key)}">${engineAccountsSafeEscape(tr("Remove"))}</button>`
              : ""}
          `}
      </div>
    </article>
  `;
}

function engineAccountsEnsureModal() {
  let modal = document.getElementById("engine-accounts-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "engine-accounts-modal";
  modal.className = "provider-login-modal hidden engine-accounts-modal";
  modal.innerHTML = `
    <div class="provider-login-dialog engine-accounts-dialog" style="max-width:520px;">
      <div class="subscription-plan-header" style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
        <div>
          <div class="advanced-panel-card-title" data-engine-accounts-title>${engineAccountsSafeEscape(tr("Engine API key"))}</div>
          <div class="advanced-panel-note" data-engine-accounts-subtitle></div>
        </div>
        <button class="mini-btn ghost tiny" type="button" data-engine-accounts-close>${engineAccountsSafeEscape(tr("Close"))}</button>
      </div>
      <div class="advanced-panel-card-body" style="display:grid; gap:10px; margin-top:12px;">
        <label style="display:grid; gap:6px;">
          <span class="work-tags">${engineAccountsSafeEscape(tr("API key"))}</span>
          <input type="password" autocomplete="off" spellcheck="false" data-engine-accounts-input
            style="font-family:ui-monospace, Menlo, Consolas, monospace; padding:8px 10px; border-radius:8px; background:rgba(0,0,0,0.35); color:#fff; border:1px solid rgba(255,255,255,0.12);" />
        </label>
        <div class="works-note" data-engine-accounts-help></div>
        <div class="works-note" data-engine-accounts-error style="color:#ff6b6b;"></div>
        <div class="work-actions" style="justify-content:flex-end; gap:8px;">
          <button class="mini-btn ghost" type="button" data-engine-accounts-cancel>${engineAccountsSafeEscape(tr("Cancel"))}</button>
          <button class="mini-btn" type="button" data-engine-accounts-save>${engineAccountsSafeEscape(tr("Save"))}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-engine-accounts-close]") || event.target.closest("[data-engine-accounts-cancel]")) {
      modal.classList.add("hidden");
    }
  });
  return modal;
}

function engineAccountsOpenAddModal(engineKey, onSaved) {
  const preset = ENGINE_ACCOUNTS_PRESETS.find((p) => p.key === engineKey);
  if (!preset || preset.disabled) return;
  const modal = engineAccountsEnsureModal();
  const title = modal.querySelector("[data-engine-accounts-title]");
  const subtitle = modal.querySelector("[data-engine-accounts-subtitle]");
  const input = modal.querySelector("[data-engine-accounts-input]");
  const help = modal.querySelector("[data-engine-accounts-help]");
  const errorLine = modal.querySelector("[data-engine-accounts-error]");
  const saveBtn = modal.querySelector("[data-engine-accounts-save]");
  if (title) title.textContent = tr("{engine} API key", { engine: preset.label() });
  if (subtitle) {
    subtitle.textContent = tr("The key is encrypted at rest with AES-256-GCM before it touches the database. It never leaves this browser except on save and test.");
  }
  if (input instanceof HTMLInputElement) {
    input.value = "";
    input.placeholder = preset.placeholder || "";
    setTimeout(() => input.focus(), 30);
  }
  if (help) help.textContent = preset.note();
  if (errorLine) errorLine.textContent = "";

  modal.classList.remove("hidden");

  const closeModal = () => {
    modal.classList.add("hidden");
  };

  const handleSave = async () => {
    const raw = input instanceof HTMLInputElement ? input.value : "";
    const trimmed = String(raw || "").trim();
    if (errorLine) errorLine.textContent = "";
    if (trimmed.length < 8) {
      if (errorLine) errorLine.textContent = tr("That API key looks too short. Please paste the full value.");
      return;
    }
    engineAccountsSafeSetBusy(saveBtn, true);
    try {
      await engineAccountsUpsert(preset.key, trimmed);
      engineAccountsSafeToast(tr("Saved. The key is now on file."));
      closeModal();
      if (typeof onSaved === "function") await onSaved();
    } catch (err) {
      if (errorLine) errorLine.textContent = String(err?.message || err || tr("Save failed."));
    } finally {
      engineAccountsSafeSetBusy(saveBtn, false);
    }
  };

  // Rebind save button with a fresh closure (avoid stacking old listeners).
  const newSave = saveBtn?.cloneNode(true);
  if (newSave && saveBtn?.parentNode) {
    saveBtn.parentNode.replaceChild(newSave, saveBtn);
    newSave.addEventListener("click", handleSave);
  }

  if (input instanceof HTMLInputElement) {
    input.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleSave();
        }
      },
      { once: true }
    );
  }
}

async function engineAccountsHandleTestClick(engineKey, button, refreshFn) {
  const preset = ENGINE_ACCOUNTS_PRESETS.find((p) => p.key === engineKey);
  if (!preset || !preset.supportsTest) return;
  engineAccountsSafeSetBusy(button, true);
  try {
    const data = await engineAccountsTest(preset.key);
    // Backend wraps the per-engine whoami payload under `detail` (see
    // rust-api/src/engine_credentials/api.rs::test_key). Per-engine shape:
    //   • runway → RunwayOrgInfo { id, email, creditBalance, tier, raw }
    //   • elevenlabs → ElevenUserInfo { first_name, tier, character_balance,
    //     character_count, character_limit, raw }
    // Fall back to top-level fields so we stay forward-compatible with
    // engines that haven't been wrapped yet.
    const detail = (data && typeof data === "object" && data.detail && typeof data.detail === "object")
      ? data.detail
      : data;
    const engineName = preset.label();
    let message = "";
    if (engineKey === "elevenlabs") {
      // CSSOS_PHASE2_BYOK 20260420 — Task #71 render "42,318 / 100,000 chars · creator".
      const balance = Number(detail?.character_balance ?? 0);
      const limit = Number(detail?.character_limit ?? 0);
      const tier = String(detail?.tier || "").trim();
      const budget = limit > 0
        ? `${balance.toLocaleString()} / ${limit.toLocaleString()}`
        : `${balance.toLocaleString()}`;
      const tail = tier ? ` · ${tier}` : "";
      message = tr("{engine} ok · {budget} chars{tail}", { engine: engineName, budget, tail });
    } else if (engineKey === "stability") {
      // CSSOS_PHASE2_BYOK 20260420 — Task #72 render "12,345 credits · acme-org".
      // Stability's /v1/user/balance returns credits as a float; round to the
      // nearest whole number for display since sub-credit precision is noise.
      const credits = Number.isFinite(Number(detail?.credits))
        ? Math.round(Number(detail.credits))
        : null;
      const org = String(detail?.organization || "").trim();
      const email = String(detail?.email || "").trim();
      const creditsStr = credits !== null ? credits.toLocaleString() : "—";
      const tailBits = [];
      if (org) tailBits.push(org);
      else if (email) tailBits.push(email);
      const tail = tailBits.length ? ` · ${tailBits.join(" · ")}` : "";
      message = tr("{engine} ok · {credits} credits{tail}", { engine: engineName, credits: creditsStr, tail });
    } else {
      // Runway / others: credit-balance + optional email.
      const balance = Number(detail?.credit_balance ?? detail?.creditBalance ?? 0);
      const email = String(detail?.email || "");
      message = email
        ? tr("{engine} ok: {email} · balance {balance}", { engine: engineName, email, balance })
        : tr("{engine} ok · balance {balance}", { engine: engineName, balance });
    }
    globalThis.engineAccountsState.testResults[preset.key] = { ok: true, message, data };
    globalThis.engineAccountsState.statusOverrides[preset.key] = "active";
    engineAccountsSafeToast(message);
  } catch (err) {
    const message = String(err?.message || err || tr("Test failed."));
    globalThis.engineAccountsState.testResults[preset.key] = { ok: false, message };
    globalThis.engineAccountsState.statusOverrides[preset.key] = "invalid";
    engineAccountsSafeToast(message);
  } finally {
    engineAccountsSafeSetBusy(button, false);
    if (typeof refreshFn === "function") await refreshFn();
  }
}

async function engineAccountsHandleRemoveClick(engineKey, button, refreshFn) {
  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    const confirmed = window.confirm(tr("Remove this engine key? Generations will fall back to the platform key (at full price)."));
    if (!confirmed) return;
  }
  engineAccountsSafeSetBusy(button, true);
  try {
    await engineAccountsRevoke(engineKey);
    engineAccountsSafeToast(tr("Key removed."));
    delete globalThis.engineAccountsState.testResults[engineKey];
    delete globalThis.engineAccountsState.statusOverrides[engineKey];
  } catch (err) {
    engineAccountsSafeToast(String(err?.message || err || tr("Remove failed.")));
  } finally {
    engineAccountsSafeSetBusy(button, false);
    if (typeof refreshFn === "function") await refreshFn();
  }
}

function engineAccountsBuildSectionInner(container, state) {
  if (!(container instanceof HTMLElement)) return;
  const state2 = state || globalThis.engineAccountsState;
  const creds = state2.credentials || {};
  const cards = ENGINE_ACCOUNTS_PRESETS
    .filter((p) => state2.supportedEngines.indexOf(p.key) !== -1 || p.key === "suno")
    .map((preset) => {
      const row = creds[preset.key] || null;
      // Apply local override (set after Test click, before refresh)
      if (row && state2.statusOverrides[preset.key]) {
        row.status = state2.statusOverrides[preset.key];
      }
      const testResult = state2.testResults[preset.key] || null;
      return engineAccountsBuildCardMarkup(preset, row, testResult);
    })
    .join("");

  const introNote = state2.byokEnabled
    ? tr("When a valid user key is on file, generations run on YOUR third-party quota and CSS Studio only charges a small orchestration fee.")
    : tr("BYOK is not yet enabled on this environment. Please check back after ENGINE_CRED_MASTER_KEY is configured.");

  container.innerHTML = `
    <strong>${engineAccountsSafeEscape(tr("Engine accounts (BYOK)"))}</strong>
    <div class="works-note">${engineAccountsSafeEscape(introNote)}</div>
    <div class="works-list engine-accounts-grid" style="display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); margin-top:12px;">
      ${cards}
    </div>
  `;
}

async function renderEngineAccountsCard(apiBody) {
  if (!(apiBody instanceof Element)) return;
  let card = apiBody.querySelector(".api-engine-accounts-card");
  if (!card) {
    card = document.createElement("div");
    card.className = "api-guest-notice api-engine-accounts-card";
    apiBody.appendChild(card);
  }

  if (!engineAccountsIsLoggedIn()) {
    card.innerHTML = `
      <strong>${engineAccountsSafeEscape(tr("Engine accounts (BYOK)"))}</strong>
      <div>${engineAccountsSafeEscape(tr("Sign in to manage your own third-party API keys (Runway, ElevenLabs, Stability...)."))}</div>
    `;
    return;
  }

  // Initial skeleton while we fetch.
  if (!globalThis.engineAccountsState.loaded) {
    card.innerHTML = `
      <strong>${engineAccountsSafeEscape(tr("Engine accounts (BYOK)"))}</strong>
      <div class="works-note">${engineAccountsSafeEscape(tr("Loading your engine keys..."))}</div>
    `;
  }

  await engineAccountsFetchList();
  engineAccountsBuildSectionInner(card, globalThis.engineAccountsState);

  const refreshFn = async () => {
    await engineAccountsFetchList();
    engineAccountsBuildSectionInner(card, globalThis.engineAccountsState);
    engineAccountsBindCardActions(card, refreshFn);
  };

  engineAccountsBindCardActions(card, refreshFn);
}

function engineAccountsBindCardActions(card, refreshFn) {
  if (!(card instanceof Element)) return;
  card.querySelectorAll("[data-engine-accounts-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const engineKey = String(button.getAttribute("data-engine-accounts-add") || "").trim().toLowerCase();
      if (!engineKey) return;
      engineAccountsOpenAddModal(engineKey, refreshFn);
    });
  });
  card.querySelectorAll("[data-engine-accounts-test]").forEach((button) => {
    button.addEventListener("click", async () => {
      const engineKey = String(button.getAttribute("data-engine-accounts-test") || "").trim().toLowerCase();
      if (!engineKey) return;
      await engineAccountsHandleTestClick(engineKey, button, refreshFn);
    });
  });
  card.querySelectorAll("[data-engine-accounts-remove]").forEach((button) => {
    button.addEventListener("click", async () => {
      const engineKey = String(button.getAttribute("data-engine-accounts-remove") || "").trim().toLowerCase();
      if (!engineKey) return;
      await engineAccountsHandleRemoveClick(engineKey, button, refreshFn);
    });
  });
}

function openEngineAccountsModal() {
  // Reserved for a future standalone opener (e.g. from a settings button).
  // For now, just scroll the API panel and call the inline renderer.
  if (typeof openPanel === "function" && typeof apiPanel !== "undefined" && apiPanel) {
    openPanel(apiPanel);
  }
  if (typeof renderApiBillingPanel === "function") renderApiBillingPanel();
  setTimeout(() => {
    const card = document.querySelector(".api-engine-accounts-card");
    if (card instanceof HTMLElement) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 120);
}

globalThis.renderEngineAccountsCard = renderEngineAccountsCard;
globalThis.openEngineAccountsModal = openEngineAccountsModal;
globalThis.engineAccountsFetchList = engineAccountsFetchList;
