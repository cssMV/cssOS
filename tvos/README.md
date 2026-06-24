# cssOS — Apple TV (tvOS) native app · skeleton

**Why native (not the web app):** tvOS has **no WebKit / no WKWebView**, so the Capacitor web-wrapper
(`ios/App`) cannot run on Apple TV. This is a separate native target: SwiftUI + AVKit, talking to the
same cssOS backend APIs. No WebView.

## What the skeleton does (W1172)
- Home grid of public works (`GET /api/works/market`), each card = cover + title + ♪ duration.
  Falls back to the flagship 《混沌の海 · The Sea of Chaos》 if the feed can't load → **always playable**.
- Tap a work → full-screen cinema: **video = muted visuals** (AVPlayerLayer, fills screen) +
  **audio = independent track** (separate AVPlayer) → 画音分层铁律. Title overlay auto-fades after 5s.
- Menu key on the Siri Remote exits the player (SwiftUI default).

## Files (`tvos/CSSOSTV/`)
- `CSSOSTVApp.swift` — `@main` SwiftUI App.
- `ContentView.swift` — home grid + navigation to player.
- `PlayerView.swift` — AVPlayer cinema (video + separate audio).
- `CSSBackend.swift` — API client (`baseURL = https://cssstudio.app`), feed + hydrate + flagship sample.
- `Models.swift` — `CSSWork` (maps `final_mv_url` / `audio_track_1_url` / `cover_image` / `duration_secs`).

## How to add the tvOS target in Xcode (one time)
1. Open `ios/App/App.xcworkspace` (or `App.xcodeproj`).
2. **File ▸ New ▸ Target… ▸ tvOS ▸ App**. Product Name: `CSSOSTV`. Interface: **SwiftUI**, Language: **Swift**.
   Bundle id suggestion: `app.cssstudio.tv` (Apple TV needs its **own** App Store record, like visionOS).
3. Xcode generates a `CSSOSTVApp.swift` + `ContentView.swift` in the new target — **delete those two**,
   then **drag the 5 files from `tvos/CSSOSTV/` into the CSSOSTV group** (check "Copy items if needed"
   and target = **CSSOSTV** only).
4. Scheme selector → **CSSOSTV**; destination → **Living AppleTV Room** (already network-paired) or a
   tvOS Simulator. ▶ Run.

No App Transport Security changes needed — all media URLs are `https`.

## Next milestones (after iOS approval)
1. **音频主时钟同步** — drive video off the audio clock (reuse the web app's audio-master approach) so
   picture & song never drift on long tracks.
2. **逐字情绪字幕** on the big screen — fetch `aligned_lyrics`, render per-word emotion text in SwiftUI.
3. **Sign in** (device-code / QR) + **聆听/观赏** entitlement, mirroring iOS commerce + the staff rules.
4. **For-You rails** (by civilization / festival), Top Shelf extension, Siri Remote focus polish.
5. App Store: separate bundle `app.cssstudio.tv`, screenshots, submit.
