# Commit History Notes

Wave 92 cleanup pass. Several recent commits had `git add -A` race conditions
where parallel agents' work landed under unrelated commit messages. We chose
NOT to rewrite history (force-push risk vs. negligible benefit) and instead
document the actual content here so `grep` finds the wave a feature shipped in.

Backup branch: `backup-pre-cleanup` at `586000a` (pushed to origin) — preserves
exact pre-cleanup tree as a safety net.

## Commits where the message understates the diff

| SHA       | Message says                                                  | Actually contains                                                                                                                                                |
|-----------|---------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 9aa917e   | "fix(home): leaderboard pill not flex-stretch + diag log"     | wave 81 ops keys docs, wave 82 server error log + admin errors panel, wave 83 web-vitals/observability, wave 84 e2e CI auth setup (full Playwright suite + signed-in tests), wave 86 remix collections migration, plus the pill fix. 28 files. |
| 87dffa3   | "wave 84 e2e CI auth + wave 85 starter CSV → 200"             | Only `data/person-candidates-roadmap.md` — the real wave 84 e2e work shipped earlier under 9aa917e; this commit is the roadmap update for wave 85.                |
| 00bd1e5   | "wave 79 playwright e2e + wave 80 sentry+web-vitals"          | 24 files — also includes wave 76 premium migration (`044_premium_and_referrals.sql`), wave 73 template parameters migration, wave 74 tutorials migration. |
| ed78cfc   | "wave 71 — personal stats deep page"                          | Also includes wave 67 DM groups migration, wave 68 contest LLM scores migration, wave 69 plaza migration, wave 70 chinese segmentation migration, plus user admin/homepage changes. 8 files. |
| f50a26c   | "wave 64 timeline+engines+rating UI + wave 65 shortcuts"      | Also touches `app.person-mv-panel.js` for timeline integration — fine, but worth noting the UI surface is broader than the message implies. |
| d2feef1   | "wave 51/52/54/55 audit + completeness fixes"                 | Single-file `public/index.html` audit pass — message is accurate that it's an umbrella audit, just unusual for a 4-wave label on one file. |
| 0cded18   | "fix(person-mv): SQL bug + light-theme codex action bar + auth gate" | Two parallel migration files numbered `038_*` (creation_history_and_recommendations and engine_usage_and_content_rating) plus the fix — migration naming collision worth flagging. |

## Migration number collisions (informational)

Multiple `038_*.sql` and `044_*.sql` files exist in different commits because
agents picked the next free number in parallel. They do not conflict at apply
time (different filenames, different content) but future devs reading by number
should expect more than one file per prefix.

- `038_creation_history_and_recommendations.sql`
- `038_engine_usage_and_content_rating.sql`
- `038_embed_credit_and_webhooks.sql`
- `044_premium_and_referrals.sql`
- `044_template_parameters.sql`
- `044_tutorials.sql`
- `047_remix_collections.sql`
- `047_server_error_log.sql`

## Rule going forward

Agents working in parallel branches should `git add <explicit paths>` rather
than `git add -A` to avoid sweeping up sibling agents' staged work. See the
fewer-permission-prompts and per-feature commit guidance.
