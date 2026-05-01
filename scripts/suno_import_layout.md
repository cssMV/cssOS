# Suno Bulk Import Layout

Put raw Suno exports under:

`/Users/jing/cssOS/data/music_raw/`

Recommended layout:

```text
data/music_raw/
  suno/
    album_or_batch_name/
      song-title-001.mp3
      song-title-001.lyrics.txt
      song-title-001.mid
      song-title-001.chords.json
      song-title-001.vocal_timing.json
      song-title-001_stems/
        vocals.wav
        drums.wav
        bass.wav
        other.wav
```

Naming rules:

- Keep the same basename for audio and all sidecars.
- Prefer lowercase ASCII names with `a-z`, `0-9`, `-`, `_`, and `.` only.
- Avoid spaces, trailing dots, double dots, and mixed sidecar basenames.
- Put stems in a sibling directory named `<basename>_stems/`.

Recognized audio files:

- `.mp3`
- `.wav`
- `.flac`
- `.m4a`
- `.aac`
- `.ogg`

Recognized sidecars:

- Lyrics: `.lyrics.txt`, `.txt`, `.lrc`
- Melody MIDI: `.mid`, `.midi`
- Chords: `.chords.json`, `.chords.txt`
- Vocal timing: `.timing.json`, `.timing.csv`, `.vocal_timing.json`
- Stems directory: `<basename>_stems/`

Recommended priority for training readiness:

1. Lyrics
2. Melody MIDI
3. Stems
4. Vocal timing
5. Chords
6. Section tags in lyrics

Minimal "foundation-ready" sample:

- audio
- lyrics
- melody MIDI

Better "training-ready" sample:

- audio
- lyrics
- section labels
- melody MIDI
- chords
- vocal timing
- stems
