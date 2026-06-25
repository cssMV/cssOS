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

## Project lives IN this repo (W1230)

The buildable Xcode project is **`tvos/cssTV.xcodeproj`** with sources under **`tvos/cssTV/`**
(Xcode 16 file-system-synchronized group → drop a `.swift` in the folder, it's in the target).
The old throwaway copy in `~/Downloads/cssTV` is **abandoned** — single source of truth is here.

Files (`tvos/cssTV/`):
- `CSSOSTVApp.swift` — `@main` SwiftUI App.
- `ContentView.swift` — home **rails** (For You / Fresh / by work_type) + navigation to player.
- `PlayerView.swift` — AVPlayer cinema; **audio master clock** drives video; 2.39 letterbox.
- `CSSBackend.swift` — API client (`baseURL = https://cssstudio.app`): feed + `buildRails` + hydrate + flagship.
- `Models.swift` — `CSSWork` (`final_mv_url`/`audio_track_1_url`/`cover_image`/`duration_secs`/`work_type`) + `CSSRail`.

## Build & install to the Apple TV

Xcode: open `tvos/cssTV.xcodeproj`, scheme **cssTV**, destination **Living AppleTV Room** → ▶ Run.

CLI (paired device `Living AppleTV Room`, signs with your Apple Development cert):
```sh
cd tvos
xcodebuild build -project cssTV.xcodeproj -scheme cssTV \
  -destination 'platform=tvOS,id=<DEVICE_ID>' -allowProvisioningUpdates
APP=$(xcodebuild -project cssTV.xcodeproj -scheme cssTV \
  -destination 'platform=tvOS,id=<DEVICE_ID>' -showBuildSettings \
  | awk -F' = ' '/ TARGET_BUILD_DIR/{d=$2}/ FULL_PRODUCT_NAME/{n=$2}END{print d"/"n}')
xcrun devicectl device install app --device <DEVICE_ID> "$APP"
xcrun devicectl device process launch --device <DEVICE_ID> --terminate-existing CSSStudio.cssTV
```
Get `<DEVICE_ID>` from `xcrun devicectl list devices`. Bundle id: `CSSStudio.cssTV`.
No App Transport Security changes needed — all media URLs are `https`.

## Roadmap (5 steps)
1. ✅ **音频主时钟同步**（W1229）— audio periodic observer drives video; `audio.ended` 切歌; short video loops.
2. ⏳ **逐字情绪字幕** on the big screen — fetch subtitle JSON, render per-word emotion bursts in SwiftUI by `audioPlayer.currentTime`.
3. ⏳ **Sign in** (device-code / QR) + **聆听/观赏** entitlement, mirroring iOS commerce + staff rules.
4. ✅ **For-You rails**（W1227）— For You / Fresh / by work_type. TODO: by civilization / festival, Top Shelf.
5. ⏳ App Store: separate bundle, screenshots, submit.
