/* CSSOS_PHASE_A1_VITE_TS_BOOTSTRAP 20260505 — Jing
 * CSSOS_PHASE_A2_PANEL_LOGO 20260506 — Jing — wires first migrated panel.
 *
 * Entry point for the new TypeScript frontend. As panels are ported
 * from public/app.*.js → web/src/panels/<name>/, they're imported here
 * for side-effect (each panel attaches its own globalThis hook so the
 * legacy app.boot.js chain still resolves at runtime).
 *
 * Live site is unaffected: no <script type="module" src="/dist-web/...">
 * has been wired into public/index.html yet. Cutover happens panel-by-
 * panel once the migrations cover everything boot.js expects.
 */
import { attachLogoPanelActionsBridge } from "./panels/logo";
import "./panels/dock-settings"; // side-effect: installs window.toggleDockSettingsPopoverModule etc.
import "./panels/panel-shell-actions"; // 3-button bar + 8-way resize bridges
import "./panels/panel-drag"; // pointer-drag with logo hold-mic disambiguation

const status = document.getElementById("status");
if (status) {
  status.textContent = `Vite + TypeScript ready · ${new Date().toISOString()}`;
}

// Side-effect: re-export to globalThis is already done inside the panel
// module, so importing it is enough to install the bridge. We also call
// it once here in case this bundle is the live entry (no boot.js then).
if (typeof window !== "undefined" && document.getElementById("logo-panel")) {
  attachLogoPanelActionsBridge();
}

export {};
