# CSS Studio Mobile (Capacitor)

## First-time setup
```bash
cd mobile
npm install
npx cap add ios
npx cap add android
```

## Build & run
```bash
npx cap sync ios
bash scripts/post-sync.sh        # merges Info.plist privacy strings (REQUIRED)
npx cap open ios                 # Xcode
```

```bash
npx cap sync android
npx cap open android             # Android Studio
```

## App Store submission checklist (iOS)

- [ ] **Apple Developer account** ($99/year) — https://developer.apple.com
- [ ] **Bundle ID** `app.cssstudio.css` registered:
      https://developer.apple.com/account/resources/identifiers/list
      — enable **Push Notifications** capability
- [ ] In Xcode → **Signing & Capabilities**:
      - Team: select your Apple Developer team
      - Add capability: **Push Notifications**
      - Add capability: **Background Modes** → check **Remote notifications**
- [ ] **Info.plist privacy strings** — run `bash scripts/post-sync.sh`
      after every `npx cap sync ios` (script in `mobile/scripts/`).
      Source of truth: `mobile/ios-info-additions.plist`.
- [ ] **App Icon** — 1024×1024 PNG → drop into Xcode's
      `Assets.xcassets/AppIcon.appiconset/` (Xcode 14+ auto-fills the
      18 sub-sizes from one master). Currently a placeholder is shipped.
- [ ] **Launch Screen** — customise `App/Base.lproj/LaunchScreen.storyboard`
      to match brand (currently default Capacitor template).
- [ ] **App Store Connect** record:
      - Privacy policy URL (CSS Studio currently lacks one — required)
      - 3 screenshots per device family
      - Description / keywords / support URL
- [ ] **APNs cert / Auth Key** — Apple Developer → Keys → register an APNs
      key, save the .p8 + key ID + team ID. Configure these in your push
      provider (web-push handles browser; native APNs needs a separate
      worker — Capacitor's `@capacitor/push-notifications` plugin uses
      Firebase/APNs tokens that get POSTed to `/api/push/subscribe-native`.
      That backend route is **not yet implemented** — TODO before native
      push works on installed iOS apps.)

## Native push notifications
iOS: configure APNs cert in Apple Developer + entitlements.
Android: add `google-services.json` from Firebase console.

## Server config
`capacitor.config.json` points to https://cssstudio.app — the app ships
as a thin webview wrapper. Native features (push, splash) overlay.
