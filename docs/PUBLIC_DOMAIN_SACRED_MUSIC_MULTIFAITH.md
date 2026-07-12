# Public-Domain Sacred Music — Multi-Faith Sourcing List

> Sourcing research for the cssOS **Sacred Music / 圣乐** feature.
> Goal: find PUBLIC-DOMAIN sacred music across faith traditions, with an emphasis
> on **machine-readable notation** (MusicXML preferred, MIDI acceptable) so our
> engine can transcribe it faithfully.
>
> Research date: 2026-07-10. Compiled by automated research pass — **verify every
> individual file's license before ingesting.** URLs and dates below were checked
> against live search results; where a claim could not be confirmed it is flagged.

---

## Executive summary — who is "ready to collect" vs "notation-blocked"

**Ready to collect NOW (machine-readable notation genuinely exists in the PD):**

- **Christian** — the single richest, cleanest source. CPDL, IMSLP, Mutopia,
  Hymnary.org, and shapenote.net hold thousands of PD works already in MusicXML /
  MIDI / LilyPond. Gregorian chant, Genevan Psalter, Lutheran chorales, Sacred
  Harp / shape-note, English hymnody are all directly downloadable.
- **Jewish** — strong for the 19th-century notated cantorial repertoire. Sulzer,
  Lewandowski, and Idelsohn are all long-PD as *compositions*, and Lewandowski
  sits on IMSLP with synthesized/typeset editions. Notation is mostly PDF scans
  (needs OMR or manual entry), but some IMSLP items ship MusicXML/MIDI.

**Partly ready (PD melodies exist, but notation is thin — mostly PDF scans or
crowd-sourced MuseScore of uncertain license):**

- **Islamic (nasheed only)** — a *handful* of ancient, pre-copyright melodies
  (above all *Tala' al-Badru 'Alayna*) exist, but almost all available notation is
  modern crowd-sourced arrangement with its own copyright. **Qur'anic recitation
  and the Adhan are excluded entirely — see the red-line note in that section.**
- **Hindu** — the *texts* and many melodies are ancient/PD, and Tagore's
  Rabindra Sangeet is PD as composition in the US (pre-1931) and in India, but
  clean machine-readable notation is scarce; most is oral or modern.

**Notation-blocked (largely oral tradition; little or no PD machine-readable
notation):**

- **Buddhist** (shōmyō, Tibetan, Chinese chant) — notated in specialized neumes
  that are memory aids, not pitch-exact scores; transcriptions live in
  copyrighted ethnomusicology monographs. Largely oral.
- **Sikh** (Gurbani kirtan) — overwhelmingly oral/discipular; the major notated
  collection (*Gurbani Sangeet: Prachin Reet Ratnavali*) is a modern copyrighted
  academic publication.
- **Taoist & Confucian ritual music** — historical gongche-notation collections
  exist inside the Taoist canon and Confucian rites, but pitch-exact PD
  transcriptions in MusicXML/MIDI essentially do not exist; sources are scholarly
  and copyrighted.
- **Baháʼí** — faith is modern (1844+); virtually all musical settings are under
  active copyright. Not a PD source.

**Bottom line:** build the first Sacred Music batch almost entirely from
**Christian** and **Jewish** sources, seed **one or two** ancient Islamic nasheed
melodies with hand-verified PD provenance, and treat Buddhist / Hindu / Sikh /
Taoist / Confucian / Baháʼí as *research-and-commission* traditions rather than
download-now traditions. A concrete 10–20 item next batch is at the end.

---

## Notation-source cheat sheet (formats you can expect)

| Source | Typical formats | License posture |
|---|---|---|
| **CPDL / ChoralWiki** (cpdl.org) | **MusicXML**, MIDI, PDF, often Sibelius/Finale/LilyPond source | Scores released free; most editions CPDL-licensed or PD. Check each page's copyright box. |
| **IMSLP** (imslp.org) | Mostly **PDF scans**; a growing minority ship MusicXML/MIDI + synthesized audio | Per-file tags: "Public Domain", "CC", or country-specific. Read the tag. |
| **Mutopia Project** (mutopiaproject.org) | **LilyPond source, MIDI, PDF** | All PD or CC; ~2,100 pieces. LilyPond → MusicXML via `musicxml2ly`/export. |
| **Hymnary.org** (hymnary.org) | **MusicXML**, MIDI, PDF for "fully treated" tunes | Public-domain hymn tunes flagged; MusicXML opens directly in MuseScore. |
| **shapenote.net** (Sacred Harp.mus) | **.mxl (MusicXML)**, .mus (Myriad), PDF, MIDI playback | Tunes themselves PD; the *engravings* are volunteer-made, generally free. |
| **Wikimedia Commons** | Mixed; some MusicXML/LilyPond, many PDF/image | Per-file license; look for PD-old / CC0. |
| **MuseScore.com** | MusicXML, MIDI, PDF | **Caution:** user uploads carry the *arranger's* copyright even for a PD melody. Only use uploads explicitly marked PD/CC0. |

**Universal caveat (applies to every tradition below):** an old melody being PD
does **not** make a modern *edition/engraving/arrangement* PD. Prefer clearly-free
editions (CPDL PD-tagged, IMSLP "Public Domain" scans, Mutopia, Wikimedia PD).
Flag anything uncertain and hand-verify before ingest.

---

## 1. Christian (brief — we already have 22 Bach chorales)

We already hold 22 Bach chorales. This section only notes where **more** PD
Christian notation lives. This is the most abundant and cleanest tradition —
thousands of pieces are directly downloadable as MusicXML/MIDI.

| Repertoire | Approx date | Language | Notation source | Format | PD status |
|---|---|---|---|---|---|
| **Gregorian chant** (Kyriale, Requiem/Missa pro defunctis, antiphons) | pre-1000 melodies; modern editions vary | Latin | CPDL `Category:Gregorian chant compositions`; CPDL `Gregorian chant` page | MusicXML + MIDI + PDF | Melodies PD; use CPDL PD-tagged editions (avoid in-copyright Solesmes engravings) |
| **Genevan Psalter** (126 tunes; Bourgeois/Goudimel harmonizations 1564–66) | 1539–1562 | French / metrical | genevanpsalter.com (states all music is PD); Hymnary.org per-tune (GENEVAN 1, 42, 51, 89, 100, 150…); IMSLP collection list | MusicXML + MIDI (Hymnary); PDF | **Explicitly PD** (site states music + recordings PD) |
| **Lutheran chorales** (beyond the 22 Bach — Praetorius, Crüger, Walther, plain chorale tunes) | 16th–18th c. | German | CPDL; Mutopia; Hymnary.org | MusicXML / MIDI / LilyPond | PD melodies; use PD editions |
| **Sacred Harp / shape-note** (1991 Revision, Cooper 2000, Southern Harmony, Christian Harmony, Harmonia Sacra) | 1844+ tunes; PD | English | **shapenote.net** ("Sacred Harp.mus") — per-tune .mxl + MIDI; IMSLP scan of *The Sacred Harp* | **MusicXML (.mxl) + MIDI** | Tunes PD; engravings volunteer/free — verify per file |
| **English hymnody** (Tallis, Gibbons, Wesley/Watts tunes, "Old Hundredth", *Hymns A&M* PD tunes) | 16th–19th c. | English | Hymnary.org (browse Tunes; most-published list); CPDL | MusicXML + MIDI + PDF | Pre-1929 tunes PD; verify edition |

**Verdict: MusicXML readily available.** This is the anchor tradition for the
first batch. **Caveat:** modern critical editions (e.g. current Solesmes chant
books, some 20th-c. hymnal harmonizations) carry fresh editorial copyright —
stick to CPDL PD tags, Mutopia, Hymnary PD tunes, and IMSLP PD scans.

Sources: [CPDL Gregorian chant](https://www.cpdl.org/wiki/index.php/Gregorian_chant) ·
[CPDL Cat:Gregorian chant](https://www.cpdl.org/wiki/index.php/Category:Gregorian_chant_compositions) ·
[genevanpsalter.com](https://genevanpsalter.com/) ·
[Hymnary GENEVAN 150](https://hymnary.org/tune/genevan_150) ·
[shapenote.net](https://www.shapenote.net/) ·
[IMSLP The Sacred Harp](https://imslp.org/wiki/The_Sacred_Harp_(Various)) ·
[Mutopia Project](https://www.mutopiaproject.org/) ·
[Hymnary tunes](https://hymnary.org/tunes)

---

## 2. Jewish

The 19th-century **notated** cantorial repertoire is the strong entry point: it
was written *in staff notation* by trained musicians (Sulzer, Lewandowski,
Naumbourg), and all three composers died before 1929 — the compositions are
solidly PD. Idelsohn's *Thesaurus* is a scholarly transcription corpus of much
older oral melodies. Notation is mostly **PDF scans** (needs OMR / manual entry),
though some IMSLP Lewandowski items now ship typeset MusicXML/MIDI.

| Piece / collection | Date | Composer / compiler | Language | Notation source | Format | PD status |
|---|---|---|---|---|---|---|
| **Schir Zion** (complete synagogue service, 2 vols) | 1838–40, 1865–66 | Salomon Sulzer (1804–1890) | Hebrew | [IMSLP: Schir Zion (Sulzer)](https://imslp.org/wiki/Schir_Zion_(Sulzer,_Salomon)) | PDF scans | PD (composer d.1890) |
| **Kol Nidrei, Op. 6** | 19th c. | Louis Lewandowski (1821–1894) | Hebrew/Aramaic | [IMSLP: Kol Nidrei Op.6 (Lewandowski)](https://imslp.org/wiki/Kol_Nidrei,_Op.6_(Lewandowski,_Louis)) | PDF + synthesized audio | PD |
| **Todah W'Simrah** (2-vol choral synagogue collection) | 1876–82 | Louis Lewandowski | Hebrew | [IMSLP: Todah W'Simrah](https://imslp.org/wiki/Todah_W'Simrah_(Lewandowski,_Louis)) | PDF; some typeset | PD |
| **Kol Rinnah u'T'fillah** (1-/2-voice synagogue) | 1871 | Louis Lewandowski | Hebrew | [IMSLP: Kol Rinnah uT'fillah](https://imslp.org/wiki/Kol_Rinnah_uT'fillah_(Lewandowski,_Louis)) | PDF | PD |
| **Thesaurus of Hebrew-Oriental Melodies** (10 vols: Yemenite, Babylonian, Persian, Bukharan, Sephardi, Moroccan, German, E-European, Hassidic) | 1914–1932 | A.Z. Idelsohn (1882–1938) | Hebrew + vernaculars | [IMSLP: Thesaurus of Oriental Hebrew Melodies](https://imslp.org/wiki/Thesaurus_of_Oriental_Hebrew_Melodies_(Idelsohn,_Abraham_Zevi)); [archive.org copy](https://archive.org/details/thesaurusoforien00idel) | PDF scans (staff notation) | Vols pre-1929 PD in US; **later vols (1929–32) verify per-volume** |
| **Sabbath zmirot** (table hymns: *Tzur Mishelo*, *Yom Zeh L'Yisrael*, *Yah Ribon*, *Deror Yikra*, *Menucha V'Simcha*) | melodies trad.; many notated in Idelsohn & early bentchers | Hebrew/Aramaic | Idelsohn Thesaurus; Wikimedia Commons; CPDL (search per title) | PDF; occasional MusicXML | Melodies PD; verify edition |
| **Naumbourg, *Zemirot Yisrael*** (French synagogue repertoire) | 1847 | Samuel Naumbourg (1815–1880) | Hebrew | IMSLP (search "Naumbourg") | PDF scans | PD |

**Verdict: PD status strong; notation mostly PDF scans (needs OMR / manual
entry).** Lewandowski on IMSLP is the best "already-somewhat-machine-readable"
entry. Idelsohn is a goldmine of *older* melodies but delivered as scanned staff
notation — budget OMR or manual transcription. **Caveat:** confirm each Idelsohn
volume's year (vols published 1929–1932 need per-volume US-PD confirmation);
avoid modern re-typeset cantorial anthologies that carry fresh copyright.

Sources: [Idelsohn on IMSLP](https://imslp.org/wiki/Thesaurus_of_Oriental_Hebrew_Melodies_(Idelsohn,_Abraham_Zevi)) ·
[Idelsohn on archive.org](https://archive.org/details/thesaurusoforien00idel) ·
[Sulzer Schir Zion](https://imslp.org/wiki/Schir_Zion_(Sulzer,_Salomon)) ·
[Lewandowski category on IMSLP](https://imslp.org/wiki/Category:Lewandowski,_Louis)

---

## 3. Buddhist

Buddhist liturgical music **is** notated in several traditions, but the notation
is **neumatic / graphic memory-aid**, not pitch-exact staff notation. Systems for
Japanese **shōmyō** have existed since at least the 11th century but "serve
nowadays primarily as memory-aids"; pitch-exact transcriptions exist only inside
modern, copyrighted ethnomusicology monographs. Tibetan (*dbyangs* / yang) and
Chinese Buddhist chant are similar. **This tradition is largely oral.**

| Repertoire | Notation reality | Where any transcription lives | Verdict |
|---|---|---|---|
| **Japanese shōmyō** (Tendai / Shingon liturgical chant) | Sino-Japanese neumes ("vocal graphs"), memory-aids not pitch-exact | Academic work only (e.g. NeumeScribe encoding project; ethnomusicology papers on Academia.edu / ResearchGate); Smithsonian Folkways *recordings* (not scores) | **Largely oral — little/no PD machine-readable notation** |
| **Tibetan Buddhist chant** (*dbyangs*, yang-yig curved notation) | Graphic contour notation, not Western pitch | Scholarly transcriptions in copyrighted monographs | **Largely oral** |
| **Chinese Buddhist chant** (fanbai 梵呗) | Gongche or oral | Transcriptions in modern anthologies (copyrighted) | **Largely oral** |

**Verdict: largely oral — little/no PD machine-readable notation.** Do not expect
a download-now pipeline here. If cssOS wants Buddhist material, the realistic
paths are (a) commissioning transcriptions of specific chants from
ethnomusicologists, or (b) sourcing recordings (many on Smithsonian Folkways) and
treating them as audio references — **not** as notation. **Sensitivity note:**
avoid any depiction of the Buddha's form; chant text is scripture — treat with
restraint.

Sources: [Shōmyō — Wikipedia](https://en.wikipedia.org/wiki/Sh%C5%8Dmy%C5%8D) ·
[Chinese Hymns in Japanese Buddhist Liturgy (paper)](https://www.academia.edu/44801699/Chinese_Hymns_in_Japanese_Buddhist_Liturgy_Structure_and_Ornament) ·
[Japan: Shōmyō Buddhist Ritual — Smithsonian Folkways](https://folkways.si.edu/japan-shomyo-buddhist-ritual-dai-hannya-ceremony/world/music/album/smithsonian)

---

## 4. Hindu

The devotional *texts* and many *melodies* are ancient and PD, and there is one
unusually clean modern-composer case: **Rabindranath Tagore (1861–1941)** —
Rabindra Sangeet is PD as *composition* in the US for works published before 1931,
and Tagore's works are reported to be in the public domain in India as well. But
outside Tagore, machine-readable devotional notation is scarce: bhajan/kirtan is
overwhelmingly oral, taught by ear, and improvisatory around raga frameworks.
Historical **swaralipi** (Bengali/Indian cipher notation) collections exist but
are PDF scans in a non-Western notation system that our engine cannot ingest as
MusicXML without heavy manual conversion.

| Repertoire | Date | Language | Notation reality | Verdict |
|---|---|---|---|---|
| **Rabindra Sangeet** (Tagore's devotional/Brahmo songs, e.g. from *Gitabitan*, *Swarabitanchunk* swaralipi vols) | 1880s–1941 | Bengali | Published in **swaralipi** (Bengali cipher notation) — PDF scans; no clean MusicXML corpus | Composition **PD in US (pre-1931) and reportedly in India**; but notation = swaralipi PDF (manual conversion) |
| **Traditional bhajans** (*Raghupati Raghava*, *Vaishnava Jana To*, *Om Jai Jagdish Hare*) | 15th–19th c. melodies | Hindi/Gujarati/Sanskrit | Oral; occasional modern harmonium/staff transcriptions (copyright of arranger) | Texts/melodies PD; **notation largely oral / modern** |
| **Kirtan / Sankirtan** (Bengali Vaishnava, Meera bhajans) | trad. | Bengali/Braj/Hindi | Oral, raga-based, improvisatory | **Largely oral** |
| **Old harmonium/notation instruction books** (early 20th-c. Indian "notation" primers) | ~1900–1930 | Bengali/Hindi/English | Cipher notation, PDF scans on archive.org | PD if pre-1929; **not MusicXML** |

**Verdict: largely oral; PD melodies exist but clean machine-readable notation is
scarce.** Tagore is the most viable single source *if* we can convert swaralipi →
MusicXML (a manual/OCR project, not a download). For a fast batch, a few
universally-known PD bhajan melodies (*Raghupati Raghava*, *Vaishnava Jana To*)
could be transcribed by hand from public lead-sheets — but any MuseScore.com
upload carries the arranger's copyright, so hand-entry from the PD melody is
safer. **Flag:** raga/tala nuance and microtonal ornament will not survive naive
MusicXML; note this as an engine-fidelity limitation.

Sources: [Tagore on Wikisource](https://en.wikisource.org/wiki/Author:Rabindranath_Tagore) ·
[SpicyIP on Rabindrasangeet copyright](https://spicyip.com/2015/01/guest-post-iprs-indian-railways-rabindrasangeet.html) ·
[Tagore in LoC public-domain archive](https://loc.getarchive.net/topics/tagore)

---

## 5. Islamic (nasheed ONLY)

### ⚠️ HARD RED-LINE — read before touching this section

- **Qur'anic recitation (tajwīd / tilāwa) is NOT music, is oral, and must NEVER be
  machine-rendered, notated, or ingested.** It is categorically excluded.
- **The Adhan (call to prayer) is likewise excluded.**
- Only **nasheed** (vocal devotional song, traditionally voice + optional
  percussion / *duff*, no melodic instruments in many traditions) is in scope.
- No depiction of the Prophet or other central holy figures.

### Reality of the notation

Nasheed is predominantly an **oral and modern** tradition. The overwhelming
majority of nasheed audio is recent (late-20th/21st-c.) and **copyrighted**.
Machine-readable notation that is genuinely PD is essentially limited to a small
number of **ancient, pre-copyright melodies**, of which one is canonical:

| Piece | Date | Language | Notation availability | PD status |
|---|---|---|---|---|
| **Tala' al-Badru 'Alayna** (طلع البدر علينا, "The full moon rose over us") | traditional, associated with 622 CE (Hijra welcome) | Arabic | Melody is ancient/short (4 lines); notation available only as **modern crowd-sourced arrangements** (MuseScore, Flat.io, MusicaNeo) | **Melody: almost certainly PD** (pre-modern, pre-copyright). **Any specific engraving/arrangement: NOT PD** unless the uploader marks it CC0/PD. |

Beyond *Tala' al-Badru*, a few other old devotional poems (e.g. *Qasida
Burda*-derived melodies) circulate, but their notated forms are modern and
copyrighted.

**Verdict: largely oral; PD is limited to a very small set of ancient melodies,
and even those exist only as modern (copyrighted) notation.** Practical path:
hand-transcribe *Tala' al-Badru 'Alayna* from the ancient melody itself (not from
a copyrighted MuseScore upload), keeping it voice + percussion only. Treat this as
a **one-item, carefully-vetted** contribution, not a batch. **Re-confirm the
Qur'an and Adhan exclusions in any UI copy for this feature.**

Sources: [Tala' al Badru 'Alayna on MuseScore](https://musescore.com/song/tala_al_badru_alayna_tl_albdr_lyna-2340376) ·
[muslimsongs.org entry](https://muslimsongs.org/tala-al-badru-alayna) — *(note: verify individual-file license; do not assume PD from these listings.)*

---

## 6. Sikh

Gurbani kirtan (shabad kirtan / Gurmat Sangeet) is central to Sikh worship and is
organized by **raga** (the Guru Granth Sahib's compositions carry raga
headings; the Ragmala lists the raga framework). But the tradition is transmitted
**orally and discipular**, generation to generation among *ragi* families. The one
landmark *notated* collection is **modern and copyrighted**:

| Repertoire | Date | Language | Notation reality | Verdict |
|---|---|---|---|---|
| ***Gurbani Sangeet: Prachin Reet Ratnavali*** (500 shabad "reets" + notations, from ragis Gurcharan Singh & Bhai Avtar Singh) | 20th c. (Punjabi University, Patiala) | Punjabi/Gurmukhi | Academic notation — **copyrighted modern publication** | **Not PD** |
| **Traditional shabad reets** (raga-based, e.g. Asa di Var, Sohila) | old melodies | Gurmukhi | Oral; some modern "notation" videos (Kirtan College etc.) — copyrighted | **Largely oral** |
| **Gurmat Sangeet Project archive** | modern | Gurmukhi | Recordings + some notation online; **not a PD notation source** | Reference audio only |

**Verdict: largely oral — little/no PD machine-readable notation.** The
authoritative notation is a copyrighted academic work; older material is oral.
Realistic paths are commissioning transcriptions of specific raga-based shabads,
or using recordings as references. **Flag:** raga + tabla-tala structure won't
render faithfully in plain MusicXML. **Sensitivity note:** Gurbani is scripture;
handle with restraint, and note that many Sikhs regard the raga associations
(Ragmala) as integral.

Sources: [Sikh music — Wikipedia](https://en.wikipedia.org/wiki/Sikh_music) ·
[Gurmat Sangeet Project](http://www.gurmatsangeetproject.com/) ·
[Shabad Kirtan — SikhiWiki](https://www.sikhiwiki.org/index.php/Shabad_Kirtan)

---

## 7. Taoist & Confucian (Chinese ritual music)

Both traditions **were** notated historically — **yayue** (雅乐, Confucian
ceremonial/court music) and Taoist ritual chant were transmitted in **gongche
notation** (工尺谱) and *lülü* pitch-pipe systems — and the Taoist canon contains
two notated chant collections (*Yuyin fashi* 玉音法事; *Da Ming yuzhi xuanjiao
yuezhang* 大明御制玄教乐章). But:

- Gongche is a **non-Western solmization** notation; it needs manual conversion to
  MusicXML and is often rhythmically under-specified.
- Pitch-exact modern transcriptions live in **scholarly / cipher-notation
  anthologies** (e.g. the *Anthology of Chinese folk/ritual music*) that are
  **copyrighted**.
- Genuinely PD, pitch-exact, machine-readable transcriptions essentially **do not
  exist** as a downloadable corpus.

| Repertoire | Date | Language | Notation reality | Verdict |
|---|---|---|---|---|
| **Yayue / Confucian rites** (文庙祭孔乐, ancestral/temple music; ba yin instrumentation) | codified across dynasties | Chinese | Historical gongche/lülü; modern transcriptions copyrighted | **Notation-blocked** — no PD MusicXML |
| **Taoist ritual music** (Zhengyi / Quanzhen liturgical suites, e.g. Macao ~500-item corpus) | canon + 20th-c. field transcriptions | Chinese | Gongche + oral lineage; cipher-notation transcriptions copyrighted | **Notation-blocked** |
| **Baishidaoren Gequ** (白石道人歌曲, Jiang Kui's songs w/ side-notation) | 1202 (Song dynasty) | Chinese | **Rare surviving old score with pitch notation**; scholarly decipherments exist (e.g. silkqin.com) | Source PD as artifact; usable transcriptions are scholarly (verify license) — *the most promising single Chinese case* |

**Verdict: largely notation-blocked for PD MusicXML.** The Confucian/Taoist ritual
corpus is either in gongche (needs conversion) or locked in copyrighted
transcriptions. The **one** genuinely interesting lead is **Jiang Kui's
*Baishidaoren Gequ* (1202)** — one of the few pre-modern Chinese song collections
that survives *with* its own pitch notation, and decipherments have been published
(e.g. silkqin.com). Even there, a specific modern transcription may carry the
transcriber's copyright — verify. **Sensitivity note:** these are living ritual
musics; frame respectfully.

Sources: [Yayue — Wikipedia](https://en.wikipedia.org/wiki/Yayue) ·
[Gongche notation overview](https://en.wikipedia.org/wiki/Gongche_notation) ·
[Baishidaoren Gequ — silkqin.com](https://www.silkqin.com/05poet/jkgequ.htm) ·
[Constructing a digital database of Chinese ancient music notation (Oxford DLfM paper, PDF)](https://dlfm.web.ox.ac.uk/sites/default/files/dlfm/documents/media/zhao-database-of-chinese-ancient-notation.pdf)

---

## 8. Baháʼí

The Baháʼí Faith is **modern** (founded 1844; Bahá'u'lláh's writings mostly
1852–1892). Consequences for PD:

- The **sacred texts** (Hidden Words, prayers, tablets) and their authoritative
  **English translations** (largely by Shoghi Effendi, d. 1957) are **under
  copyright**, administered by Baháʼí institutions.
- Virtually **all musical settings** — the large body of choral and popular
  Baháʼí song, including *Hidden Words* settings — are **20th/21st-century
  compositions under active copyright**.
- There is **no meaningful corpus of PD Baháʼí notation.**

**Verdict: not a PD source.** Do not plan to collect Baháʼí music for the
public-domain Sacred Music feature. Any inclusion would require explicit licensing
from the copyright holders (composers and/or Baháʼí publishing trusts). Note this
honestly in the feature rather than searching for PD material that does not exist.

*(No reliable PD Baháʼí notation source was found; the general music-copyright
results returned by search do not change this conclusion.)*

---

## Recommended NEXT BATCH — 10–20 pieces to download this week

Drawn from the two ready traditions (Christian, Jewish) plus one carefully-vetted
Islamic item. **Every item still needs a per-file license check before ingest.**

### Christian (anchor — cleanest MusicXML/MIDI)

1. **Genevan Psalter — Psalm 42** ("As the hart") — Hymnary.org MusicXML+MIDI. PD.
2. **Genevan Psalter — Psalm 100** (Old Hundredth) — Hymnary.org MusicXML. PD.
3. **Genevan Psalter — Psalm 134 / GENEVAN 134** — Hymnary.org. PD.
4. **Gregorian — *Requiem* (Missa pro defunctis), Introit "Requiem aeternam"** — CPDL MusicXML. PD melody; use CPDL PD edition.
5. **Gregorian — *Veni Creator Spiritus*** — CPDL MusicXML. PD.
6. **Gregorian — *Pange Lingua*** — CPDL MusicXML. PD.
7. **Sacred Harp — "New Britain" (Amazing Grace)** — shapenote.net .mxl + MIDI. PD.
8. **Sacred Harp — "Wondrous Love"** — shapenote.net .mxl. PD.
9. **Sacred Harp — "Idumea"** — shapenote.net .mxl. PD.
10. **Lutheran chorale — "Ein feste Burg" (Luther)** — CPDL/Hymnary MusicXML. PD.
11. **Lutheran chorale — "Wachet auf" tune (Nicolai)** — CPDL/Hymnary MusicXML. PD.
12. **English hymnody — Tallis's Canon / "The Third Tune"** — CPDL MusicXML. PD.
13. **English hymnody — "Old Hundredth" (Bourgeois) harmonization** — Hymnary MusicXML. PD.

### Jewish (strong PD; expect PDF → OMR for some)

14. **Lewandowski — *Kol Nidrei*, Op. 6** — IMSLP (PDF + synthesized). PD. *(OMR/manual if no MusicXML on the page.)*
15. **Lewandowski — selection from *Todah W'Simrah*** (e.g. *Ma Tovu* setting) — IMSLP. PD.
16. **Sulzer — a *Schir Zion* movement** (e.g. *Sh'ma Yisrael*) — IMSLP PDF → OMR. PD.
17. **Sabbath zmira — *Tzur Mishelo*** (traditional melody, Idelsohn/Wikimedia) — PDF → transcribe. PD melody.
18. **Idelsohn Thesaurus — one Yemenite melody** (Vol. 1) — IMSLP/archive.org PDF → OMR. PD (Vol. 1 pre-1929).

### Islamic (single hand-vetted item — nasheed only)

19. **Tala' al-Badru 'Alayna** — **hand-transcribe the ancient melody** (voice + duff only); do **not** import a copyrighted MuseScore upload. PD melody; new clean engraving.

### Optional stretch (Chinese, if we want one non-Abrahamic seed)

20. **Jiang Kui — one song from *Baishidaoren Gequ* (1202)** via a scholarly decipherment (silkqin.com) — verify transcription license before use; the 1202 source is PD but a modern transcription may not be.

**Process reminder:** for each item, open the source page, confirm the license
box says PD/CC0 (or the melody is clearly pre-1929 and the *edition* is free),
download MusicXML where offered, and OMR/hand-enter where only a PDF scan exists.
Keep a provenance note (source URL + license) per file so any later takedown or
audit is traceable.
