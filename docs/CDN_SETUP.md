# CDN setup — Cloudflare R2 (Wave 97)

cssOS mirrors `/srv/cssos/artifacts/*` (covers, fallback images, MV mp4s,
audio) to a Cloudflare R2 bucket served via a custom CDN domain. Local files
remain the source of truth; R2 is a write-through mirror so the public site
can serve traffic from the edge.

When the `R2_*` env vars are unset, all helpers no-op — the server keeps
serving `/artifacts/*` from local disk exactly as before.

## 1. Create the R2 bucket

1. Cloudflare dashboard → **R2** → **Create bucket**
2. Name: `cssos-artifacts`, location: Automatic
3. **Settings → Public access** → enable, then attach a custom domain

## 2. DNS — custom CDN domain

Add a CNAME on `cssstudio.app`:

```
Type:   CNAME
Name:   cdn
Target: cssos-artifacts.<account>.r2.dev   (or the public bucket hostname)
Proxy:  Proxied (orange cloud) — gives you Cloudflare cache + TLS
```

Result: `https://cdn.cssstudio.app/artifacts/<key>` serves any uploaded
object.

## 3. API token — IAM scopes

Cloudflare dashboard → **My Profile → API Tokens → Create Token** with
template **R2 Token**, then narrow:

- Permissions: `Object Read & Write`
- Resources: bucket `cssos-artifacts` only

Copy the **Access Key ID** and **Secret Access Key** — they cannot be
retrieved again.

## 4. Env vars on api-vm

Add to `/etc/cssos/env` (or systemd `EnvironmentFile`):

```
R2_ACCOUNT_ID=<32-hex cloudflare account id>
R2_ACCESS_KEY_ID=<from step 3>
R2_SECRET_ACCESS_KEY=<from step 3>
R2_BUCKET=cssos-artifacts
R2_PUBLIC_URL=https://cdn.cssstudio.app
```

Restart the api service. New cover/audio/MV writes will mirror to R2 within
a few seconds (fire-and-forget; never blocks the user-facing pipeline).

## 5. Backfill historical artifacts

```
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
R2_BUCKET=cssos-artifacts R2_PUBLIC_URL=https://cdn.cssstudio.app \
DATABASE_URL=postgres://... \
node scripts/migrate-artifacts-to-r2.mjs --dry-run
```

The script is idempotent: it skips keys already present in R2 and DB rows
already pointing at the CDN URL. Drop `--dry-run` to actually upload + write.

## 6. WebP + thumbnail variants

Every PNG/JPEG cover written through `persistBase64Cover` now also gets:

- `<basename>.webp`        — full-resolution WebP @ q=80
- `<basename>.thumb.webp`  — 400px-wide thumbnail @ q=75

DB columns `user_works.cover_image_webp`, `cover_thumb_url`,
`person_profiles.portrait_webp`, `portrait_thumb_url` (migration `049`)
hold the CDN URLs for `<picture>` `srcset` rendering.

## 7. Rollback

Unset the `R2_*` env vars and restart. The server falls back to serving
`/artifacts/*` locally; the legacy nginx alias was deliberately preserved.
