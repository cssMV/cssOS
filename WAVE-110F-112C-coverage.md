# Wave 110F + 112C — Civilization Universe Data Expansion

**Date**: 2026-05-11
**Status**: ✅ Deployed to https://cssstudio.app
**Build**: `dist/index.js` + `dist/person_mv_seed.js` + `dist/landmark_mv_seed.js`

## Counts

| Layer | Before | After | Delta |
|---|---:|---:|---:|
| Person profiles | 22 | **76** | **+54** |
| Landmark profiles | 29 | **64** | **+35** |

## 🎯 Three Priority Dialogue MV Pairs — VERIFIED LIVE

| Person | × | Landmark | Status |
|---|---|---|---|
| Confucius / 孔子 | × | 杏坛 / Apricot Altar | ✅ codex returns pair |
| Napoleon / 拿破仑 | × | Arc de Triomphe / 凯旋门 | ✅ codex returns pair |
| Beethoven / 贝多芬 | × | Musikverein / 维也纳金色大厅 | ✅ codex returns pair |

Bonus pairs that fell out for free:

| Person | × | Landmark |
|---|---|---|
| Confucius | × | Mount Tai / 泰山 |
| Beethoven | × | Beethoven-Haus Bonn / 波恩故居 |
| Mozart | × | Musikverein |
| Mozart | × | Salzburg birthplace |
| Chopin | × | Musikverein |
| Victor Hugo | × | Arc de Triomphe |
| Victor Hugo | × | Notre-Dame de Paris |
| Newton, Darwin | × | Westminster Abbey |
| Michelangelo | × | Sistine Chapel |
| Goethe | × | Weimar Goethehaus |
| Louis XIV | × | Versailles |
| Shakespeare | × | Stratford-upon-Avon |
| Yongle Emperor | × | Temple of Heaven, Forbidden City |
| Zhuge Liang | × | Wuhou Shrine |
| Du Fu / Su Shi | × | Yueyang Tower |
| Hokusai / Bashō | × | Mount Fuji |
| Tokugawa Ieyasu | × | Edo Castle |
| Pericles / Plato / Socrates | × | Acropolis |
| Socrates | × | Delphi |
| Hadrian | × | Hadrian's Wall, Pantheon |
| Caesar / Cicero / Augustus | × | Roman Forum |
| Vespasian / Titus / Nero | × | Colosseum |
| Ramesses II / Akhenaten | × | Karnak, Valley of the Kings, Abu Simbel |
| Cyrus the Great / Darius I | × | Persepolis |
| Nebuchadnezzar II | × | Ishtar Gate |
| Buddha | × | Nalanda, Borobudur, Bodh Gaya (existing) |
| Shah Jahan | × | Taj Mahal |
| Akbar | × | (Fatehpur Sikri future) |

## New persons by civilization

### 中华文明 (+9)
`meng-tian`, `sun-tzu`, `sima-qian`, `cao-cao`, `zhuge-liang`,
`du-fu`, `su-shi`, `yongle-emperor`, `zheng-he`

### 日本古典 (+4)
`murasaki-shikibu`, `matsuo-basho`, `tokugawa-ieyasu`, `hokusai`

### 古希腊文明 (+7)
`homer`, `sappho`, `pythagoras`, `archimedes`, `euclid`,
`hippocrates`, `pericles`

### 古罗马文明 (+5)
`cicero`, `virgil`, `marcus-aurelius`, `hadrian`, `vespasian`

### 古埃及文明 (+5)
`imhotep`, `ramesses-ii`, `akhenaten`, `nefertiti`, `cleopatra-vii`

### 美索不达米亚文明 (+3)
`hammurabi`, `nebuchadnezzar-ii`, `sargon-of-akkad`

### 波斯文明 (+3)
`cyrus-the-great`, `darius-i`, `rumi`

### 古印度 / 莫卧儿 (+3)
`patanjali`, `akbar`, `shah-jahan`

### 文艺复兴 → 启蒙 → 浪漫 → 古典主义 欧洲 (+11)
`michelangelo`, `galileo`, `voltaire`, `rousseau`, `kant`,
`bach`, `mozart`, `chopin`, `goethe`, `victor-hugo`, `louis-xiv`

### 近现代 (+4)
`darwin`, `tesla`, `lincoln`, `mandela`

## New landmarks by region

### 三大 Dialogue MV 锚点 (S-tier)
`apricot-altar` · `arc-de-triomphe` · `musikverein-vienna`

### 中华文明 (+5)
`temple-of-heaven`, `mount-tai`, `wuhou-shrine`, `yueyang-tower`, `summer-palace`

### 日本古典 (+3)
`mount-fuji`, `kinkaku-ji`, `edo-castle`

### 古希腊 (+2)
`acropolis-athens`, `delphi`

### 古罗马 (+2)
`hadrians-wall`, `roman-forum`

### 古埃及 (+2)
`karnak-temple`, `valley-of-the-kings`

### 美索不达米亚 / 波斯 (+2)
`babylon-ishtar`, `persepolis`

### 古印度 (+2)
`nalanda`, `khajuraho`

### 东南亚 (+2)
`angkor-wat`, `borobudur`

### 中东 / 圣地 (+2)
`kaaba-mecca`, `western-wall-jerusalem`

### 欧洲 (+7)
`versailles`, `sistine-chapel`, `westminster-abbey`,
`stratford-upon-avon`, `weimar-goethe-haus`,
`salzburg-mozart-haus`, `bonn-beethoven-haus`, `mont-saint-michel`, `lascaux-caves`

### 美洲 / 非洲 (+2)
`teotihuacan`, `great-zimbabwe`

## Cross-reference health

Every new landmark has `related_persons[]` populated where applicable.
Every new person has discoverable landmarks via the codex endpoint's
reverse SQL lookup (`SELECT … FROM landmark_profiles WHERE $1 = ANY(related_persons)`).

## Endpoint verification (all 200 OK)

- `GET /api/person-mv/persons?limit=2` → 76 personas
- `GET /api/landmark-mv/landmarks?limit=2` → 64 landmarks
- `GET /api/person-mv/persons/confucius/codex` → returns `[apricot-altar, mount-tai]` in `related_landmarks`
- `GET /api/person-mv/persons/napoleon/codex` → returns `[arc-de-triomphe]`
- `GET /api/person-mv/persons/beethoven/codex` → returns `[musikverein-vienna, bonn-beethoven-haus]`
- `GET /api/landmark-mv/landmarks/apricot-altar` → 200
- `GET /api/landmark-mv/landmarks/arc-de-triomphe` → 200
- `GET /api/landmark-mv/landmarks/musikverein-vienna` → 200

## Notes / Known follow-ups

1. **Some existing landmark `related_persons` reference person IDs not yet seeded**
   (e.g. `phidias`, `khufu`, `pachacuti`, `justinian-i`, `bartholdi`, `eiffel`,
   `jorn-utzon`, `kangxi-emperor`, `puyi`, `titus`, `nero`, `dalai-lama-5`,
   `songtsen-gampo`, `mumtaz-mahal`, `brunelleschi`).
   The `related_persons` column has no FK constraint — dangling refs simply
   return no profile via codex reverse-lookup. Adding these in a follow-up
   batch closes more pairs (e.g. Khufu × Pyramids of Giza).

2. **The `seedLandmarkProfilesOnce` `ON CONFLICT DO UPDATE` clause currently
   only refreshes `name_native`, `name_latin`, `coordinates`, `notable_events`,
   `curation_tier`**. It does NOT refresh `related_persons[]` or `visual_symbols[]`.
   So if I edit an EXISTING landmark's related_persons in the seed file, it
   won't propagate to an already-seeded DB row. New landmarks insert cleanly,
   but for editing existing rows we either (a) extend the conflict clause to
   include those columns, or (b) run a manual UPDATE. Will fix in 112D.

3. **Wave 114 (queued)**: `realm` column on both tables, mythological /
   literary / folkloric personas + landmarks. Cross-realm Dialogue MV
   (Sun Wukong × 凌霄宝殿, Harry Potter × Hogwarts Great Hall).
