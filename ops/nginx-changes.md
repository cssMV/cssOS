# nginx changes log (api-vm)

The nginx config lives on api-vm at `/etc/nginx/sites-enabled/cssstudio.app` and is **not** tracked in git. This file records changes applied by hand so reproducing the box from scratch works.

## 2026-05-06 — Phase C.3.c — retire `/artifacts/mv/` alias

Backup: `/etc/nginx/sites-available/cssstudio.app.bak.20260506-c3c`

### Before

```nginx
location ^~ /artifacts/mv/ {
  alias /var/lib/cssos/mv/;
  add_header Cache-Control "public, max-age=3600";
  add_header X-Cssos-Artifact "mv";
  ...
}
```

### After

```nginx
# CSSOS_PHASE_C_3_C 20260506 — Jing — retire bare alias.
# All client URLs now go through /secure/artifacts/<wid>/<file>?t=…
# signed by Express. The bare /artifacts/mv/ path is 410 Gone so
# scrapers and stale page-source links can't grab raw media.
location ^~ /artifacts/mv/ {
  add_header Cache-Control "no-store" always;
  add_header X-Cssos-Reason "signed-url-required" always;
  return 410 'This URL has been retired. Reload the work to get a fresh signed URL.';
  default_type text/plain;
}
```

Verified post-reload:

```
bare URL  /artifacts/mv/dummy.mp4              → 410
site root /                                    → 200
bad-token /secure/artifacts/<wid>/x.mp4?t=AAA  → 403
```

## 2026-05-06 — sites-enabled cleanup

Stale backup `/etc/nginx/sites-enabled/cssstudio.app.bak.1777230780` was being loaded by nginx (because anything matching `sites-enabled/*` is loaded), causing a duplicate `server_name cssstudio.app` and intermittent unsigned-route hits. Moved to `sites-available/` so it's preserved but not active.

## How to apply changes safely

1. `sudo cp /etc/nginx/sites-enabled/cssstudio.app /etc/nginx/sites-available/cssstudio.app.bak.$(date +%Y%m%d-%H%M%S)`
2. Edit the file
3. `sudo nginx -t` — fail closed if syntax is bad
4. `sudo systemctl reload nginx` — reload, NOT restart, to keep TLS sessions warm
5. Smoke test affected paths

## Related

- Phase C.1: signed URL helper + `/secure/artifacts/:wid/:file` route in `src/index.ts`
- Phase C.2: ffmpeg preview-clip cache at `/srv/cssos/shared/preview-cache/`
- Phase C.3.a/b: every client-facing API response now signs media URLs
