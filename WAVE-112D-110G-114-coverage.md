# Wave 112D + 110G + 114 — Repairs + Realm Expansion

**Date**: 2026-05-11
**Status**: ✅ Deployed to https://cssstudio.app
**Migration**: `migrations/061_realm_column.sql` applied

## Counts after this round

| Layer | After 110F+112C | After this round | Delta |
|---|---:|---:|---:|
| Person profiles | 76 | **123** | **+47** |
| Landmark profiles | 64 | **80** | **+16** |

Of these, **30 personas + 16 landmarks** are now tagged with non-`historical` realm.

## Wave 112D — ON CONFLICT refresh extended

`seedPersonProfilesOnce` and `seedLandmarkProfilesOnce` now refresh **all editable fields** (`related_persons`, `visual_symbols`, `music_style_hint`, `influence_score`, etc.) when re-seeding an existing row. Previously only `name_native`/`name_latin`/`coordinates`/`notable_events`/`curation_tier` propagated, so edits to other fields silently dropped. **Curated seed is now truly the source of truth.**

## Wave 110G — 15 dangling person IDs filled

Existing `landmark.related_persons[]` references that previously hit nothing now resolve to real profiles:

| New person | Closes Dialogue MV pair with |
|---|---|
| `khufu` | Pyramids of Giza |
| `khafre` | Pyramids of Giza · Great Sphinx |
| `menkaure` | Pyramids of Giza |
| `phidias` | Parthenon |
| `titus` | Colosseum (opening games 80 AD) |
| `nero` | Colosseum / Domus Aurea |
| `justinian-i` | Hagia Sophia |
| `songtsen-gampo` | Potala Palace (foundation) |
| `dalai-lama-5` | Potala Palace (white-palace rebuild) |
| `kangxi-emperor` | Forbidden City |
| `puyi` | Forbidden City (last emperor) |
| `mumtaz-mahal` | Taj Mahal |
| `brunelleschi` | Florence Cathedral |
| `pachacuti` | Machu Picchu |
| `bartholdi` / `eiffel` | Statue of Liberty / Eiffel Tower |
| `jorn-utzon` | Sydney Opera House |

## Wave 114 — `realm` column + cross-realm pairs

### Migration `061_realm_column.sql`
Adds `realm TEXT NOT NULL DEFAULT 'historical'` to both `person_profiles` and `landmark_profiles`, with btree indexes on each.

### Realm taxonomy
- **historical** — real history / real geography (default)
- **mythological** — myth / religion / cosmology
- **literary** — written fiction's personas & places
- **folkloric** — folk tales / oral tradition

### New personas by realm

**Mythological (24)**:
- Chinese 中华神话: `pangu`, `nuwa`, `sun-wukong`, `change`, `houyi`, `jade-emperor`, `guanyin`, `maitreya`
- Greek 古希腊神话: `zeus`, `athena`, `apollo`
- Norse 北欧神话: `odin`, `thor`, `loki`
- Egyptian 古埃及神话: `ra`, `anubis`, `isis`
- Indian 印度教神话: `shiva`, `krishna`
- Mesopotamian 美索不达米亚神话: `gilgamesh`

**Literary (6)**:
- `harry-potter`, `hermione-granger`, `sherlock-holmes`, `frodo-baggins`, `odysseus`, `monkey-king-journey` (唐三藏), `jia-baoyu` (贾宝玉)

**Folkloric (3)**:
- `niulang-zhinu`, `bai-suzhen`, `mulan`

### New landmarks by realm

**Mythological (12)**:
- `lingxiao-palace` 凌霄宝殿, `moon-palace` 月宫, `huaguo-mountain` 花果山
- `mount-olympus`, `underworld-hades`
- `asgard`, `valhalla`
- `duat` 杜阿特冥界
- `mount-meru` 须弥山

**Folkloric (2)**:
- `que-qiao` 鹊桥, `leifeng-pagoda` 雷峰塔

**Literary (4)**:
- `hogwarts-great-hall`, `diagon-alley`, `221b-baker-street`, `mount-doom`, `daguanyuan` 大观园

## 🎯 Nine cross-realm Dialogue MV pairs — VERIFIED LIVE

Direct curl tests against production endpoints:

```
sun-wukong × lingxiao-palace      →  孙悟空 × 凌霄宝殿
harry-potter × hogwarts-great-hall →  哈利·波特 × 霍格沃茨大礼堂
zeus × mount-olympus              →  宙斯 × 奥林匹斯山
change × moon-palace              →  嫦娥 × 月宫（广寒宫）
niulang-zhinu × que-qiao          →  牛郎织女 × 鹊桥
odin × asgard                     →  奥丁 × 阿斯加德
frodo-baggins × mount-doom        →  弗罗多·巴金斯 × 末日山口
sherlock-holmes × 221b-baker-street → 夏洛克·福尔摩斯 × 贝克街 221B
jia-baoyu × daguanyuan            →  贾宝玉 × 大观园
```

Plus all 110F+112C pairs from prior round (Confucius × 杏坛, Napoleon × Arc de Triomphe, Beethoven × Musikverein, etc.) remain live.

## Endpoint verification

- `[person-mv] seed loaded — 123 profiles` (server log)
- `[landmark-mv] seed loaded — 80 landmarks` (server log)
- 9 sample `/api/person-mv/persons/{id}/codex` calls return correctly cross-referenced `related_landmarks`
- 9 sample `/api/landmark-mv/landmarks/{id}` calls return the expected mythological/literary profile

## Pending follow-ups

1. **Frontend realm filter pill** — the data now carries `realm` but the People/Landmarks panel doesn't filter by it yet. Add a 4-way pill (历史 · 神话 · 文学 · 民间). Not blocking — historical-only users see no difference; mythological queries already work via direct ID.
2. **Frontend Dialogue MV button labeling** — the existing "🤝 Dialogue MV" button works identically across realms; consider a small visual cue for cross-realm pairs (e.g. a faint colored border) so users know they're mixing positions.
3. **More literary/mythological coverage** — natural batch 2 candidates: 林黛玉, 武则天's mythologized form, 玄奘 (separate from Tang Sanzang), Athena × Acropolis (already historical landmark — cross-realm-link Athena would unlock this), Zeus × Delphi (Apollo's domain — could be cross-realm), Dante × Inferno (Divine Comedy).
4. **Wave 111 parsers** still queued — next round's headline.
