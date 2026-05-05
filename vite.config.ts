/* CSSOS_PHASE_A1_VITE_TS_BOOTSTRAP 20260505 — Jing
 *
 * Vite config for the new TypeScript frontend, parallel to the legacy
 * vanilla-JS frontend in `public/`. The live site continues to be served
 * from `public/` by `src/index.ts` (Express) — nothing here changes that.
 *
 * What this enables (today):
 *   - `npm run web:dev`   → vite dev server at :5173 serving web/
 *   - `npm run web:build` → builds web/ to dist-web/ (not deployed yet)
 *
 * Migration path (future sessions):
 *   1. Move panel-by-panel from public/app.*.js → web/src/<panel>/*.ts
 *   2. When everything is ported, point Express static at dist-web/
 *      and delete public/app*.js
 *   3. Drop src/index.ts in favor of rust-api/ once parity is verified
 *
 * Rationale: a single-shot 89-script consolidation would break every
 * file that declares top-level `function foo()` expecting it to land on
 * `window` — ES modules scope those to the module. So we set up the
 * infrastructure, leave public/ untouched, and migrate file-by-file.
 */
import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "web"),
  publicDir: path.resolve(__dirname, "web/public"),
  build: {
    outDir: path.resolve(__dirname, "dist-web"),
    emptyOutDir: true,
    target: "es2020",
    sourcemap: true
  },
  server: {
    port: 5173,
    strictPort: true,
    open: false
  }
});
