# Meilisearch Setup (Wave 96)

cssOS uses **Meilisearch** as the primary engine for `/api/person-mv/search`.
Postgres `tsvector` + bigram (Wave 25 / Wave 70) remains as the automatic
fallback when Meilisearch is unreachable or unset.

## Why

Meilisearch gives us:

- Typo tolerance (1 typo per 4 chars, 2 per 8+).
- Better Chinese-word matching (no IME quirks vs. PG bigram).
- Faceting / filtering by `civilization`, `era`, `person_id`.
- Sub-50ms p99 latency at our scale.

## Deployment options

### Option A — managed (recommended)

Use [Meilisearch Cloud](https://cloud.meilisearch.com/) Build plan ($30/mo).
Copy the project URL + master key into the cssOS env:

```
MEILISEARCH_HOST=https://edge.meilisearch.com
MEILISEARCH_API_KEY=mk-xxxxxxxxxxxxxxx
```

### Option B — self-host on api-vm

```bash
# install
curl -L https://install.meilisearch.com | sh
sudo mv ./meilisearch /usr/local/bin/

# systemd unit
sudo tee /etc/systemd/system/meilisearch.service <<'EOF'
[Unit]
Description=Meilisearch
After=network.target

[Service]
ExecStart=/usr/local/bin/meilisearch \
  --master-key REPLACE_ME \
  --http-addr 127.0.0.1:7700 \
  --db-path /var/lib/meilisearch/data
Restart=on-failure
User=meili

[Install]
WantedBy=multi-user.target
EOF

sudo useradd -r -s /bin/false meili || true
sudo mkdir -p /var/lib/meilisearch/data && sudo chown -R meili /var/lib/meilisearch
sudo systemctl enable --now meilisearch
```

Front it with nginx behind https. Set `MEILISEARCH_HOST=https://meili.cssstudio.app`.

## Initial setup

```bash
MEILISEARCH_HOST=... MEILISEARCH_API_KEY=... \
  node scripts/setup-meilisearch.mjs
```

That creates the three indexes (`persons`, `mvs`, `comments`) with the right
searchable attributes, Chinese stop words, and typo tolerance.

To also auto-trigger the initial reindex, also set `CSSOS_ADMIN_COOKIE` to a
valid admin session cookie.

## Manual reindex

```
POST /api/admin/search/reindex?kind=persons|mvs|comments|all
```

Admin auth required. Run after a deploy or whenever an index drifts.

## Fallback behavior

If `MEILISEARCH_HOST` is unset OR Meilisearch errors at query time, the API
logs:

```
[search] meili unavailable, falling back to PG
```

…and silently serves the request via PG full-text. PG triggers + tokenized
columns stay active so the fallback path is always warm.
