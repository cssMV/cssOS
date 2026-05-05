/* CSSOS_PHASE_A1_VITE_TS_BOOTSTRAP 20260505 — Jing
 *
 * Entry point for the new TypeScript frontend.
 *
 * For now this is just a sanity check that Vite + TS + strict mode all
 * work end-to-end. Subsequent sessions will migrate panels from the
 * legacy `public/app.*.js` files into `web/src/<panel>/*.ts` and import
 * them here.
 */

const status = document.getElementById("status");
if (status) {
  status.textContent = `Vite + TypeScript ready · ${new Date().toISOString()}`;
}

export {};
