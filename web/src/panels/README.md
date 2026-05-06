# Panel migration template (A2)

Each panel ported from the legacy vanilla-JS frontend lives under its own folder here. The first port is `logo/`.

## Pattern

```
web/src/panels/<name>/
  types.ts      # ambient declarations for legacy globals this panel reads
  index.ts      # ES-module export of attach…() / mount() / etc.
  README.md     # (optional) per-panel notes
```

## Rules

1. **Self-contained.** A panel folder imports nothing from app.js / `globalThis.foo` directly without first declaring the type in its own `types.ts`.
2. **Idempotent attach.** Functions exported from `index.ts` must check a per-element bound-flag (e.g. `dataset.<name>Bound`) and bail on re-entry. Boot calls them; `ensurePanel()` for dynamically-created panels calls them too.
3. **Keep the legacy file alive until cutover.** The TS port writes its hook back to `window.attach<Name>Bridge` so the existing `app.boot.js` chain still resolves. When the Vite bundle is served live, the legacy `public/app.<name>.js` is deleted in one mechanical commit.
4. **Type checks must pass.** `npm run web:check` is the gate. CI deploy will eventually run this.

## Migration order

1. **logo** — done, 138 lines, simplest, used as the template.
2. **dock-runtime** — small, mostly DOM wiring (next).
3. **panel-shell-actions** — 3-button bar bridge (already idempotent).
4. **panel-drag** — drag handler.
5. **panel-focus** — focus / z-index management.
6. **watch-ui** — biggest, defer until 1-5 prove stable.

## Verifying a port

```bash
npm run web:check     # tsc no-emit on web/tsconfig.json
npm run web:build     # produces dist-web/ — only for parity testing
```

Live site is unaffected until the bundle is wired into `index.html`.
