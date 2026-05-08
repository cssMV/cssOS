# person-candidates roadmap — 1000-target plan

`data/person-candidates.csv` seeds the person-mv bulk-generate flow. Each row is
idempotent: re-running bulk-generate keys on `person_id` (Wave 58) so duplicates
collapse.

## Phases

### Phase 1 — Starter 20 (✅ Wave 58, done)
Hand-curated 20 rows covering the canonical S/A/B exemplars across 中华 / 西方 /
印度 / 现代科技. Used to validate the bulk-generate contract end-to-end.

### Phase 2 — Curated 200 (✅ Wave 85, current)
Expanded to 207 rows. Distribution:

| Civilization | Count |
|---|---|
| 中华文明 | 65 |
| 西方文明 (incl. 古希腊/古罗马) | 79 |
| 印度文明 | 22 |
| 阿拉伯伊斯兰文明 | 20 |
| 日本文明 | 7 |
| 俄罗斯文明 | 6 |
| 拉美文明 | 4 |
| 韩国文明 | 2 |
| 非洲文明 | 2 |

Tiers: ~72 S, ~133 A, ~2 B (B intentionally light — Phase 3 fills the long tail).

S coverage now includes all the must-haves called out in Wave 85: 韩非子, 朱熹,
王阳明, 拉斐尔, 伽利略, 笛卡尔, 康德, 黑格尔, 罗素, 图灵, 牛顿, 达尔文,
爱因斯坦, 莎士比亚, 巴赫, 莫扎特, 释迦牟尼, 穆罕默德, 伊本·西那, etc.

### Phase 3 — 1000 via LLM-driven expansion (⏳ planned)
B-tier (the remaining ~600+) is filled by a nightly admin cron that calls the
existing bulk-generate endpoint with `?expand_tier=B`. The expander:

1. Reads current civilization × era distribution from `person_mv`.
2. Computes "diversity gaps" — under-represented (civ, era) buckets relative to
   target weights (中华 35%, 西方 30%, 印度 10%, 阿拉伯 10%, 其他 15%).
3. Asks an LLM for N new B-tier names that fill the largest gap, returning the
   same 7-column row schema.
4. Appends to `person-candidates.csv` and runs bulk-generate. The Wave 58
   `person_id` collision check makes this idempotent.

Run cadence: nightly, capped at +50/day until total ≈ 1000, then off.

## Row format

```
tier,name_zh,name_en,civilization,era,lifespan,hint
```

- `tier`: `S | A | B`
- `civilization`: stable Chinese label (e.g. `中华文明`, `西方文明`,
  `阿拉伯伊斯兰文明`). Used for grouping in the codex UI.
- `era`: short Chinese era token (e.g. `战国`, `文艺复兴`, `黄金时代`).
- `lifespan`: free-form human string; engine parses for sort order only.
- `hint`: short English clue, ≤ 120 chars, no commas.

## Constraints

- **Idempotent:** bulk-generate dedupes via `person_id` (slug from `name_en` +
  civilization). Don't worry about appending duplicates.
- **Don't break Phase 1:** the original 20 must remain — they are referenced by
  golden tests.
