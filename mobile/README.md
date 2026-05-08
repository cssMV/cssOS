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
npx cap sync
npx cap open ios     # Xcode
npx cap open android # Android Studio
```

## Native push notifications
iOS: configure APNs cert in Apple Developer + entitlements.
Android: add `google-services.json` from Firebase console.

## Server config
`capacitor.config.json` points to https://cssstudio.app — the app ships
as a thin webview wrapper. Native features (push, splash) overlay.
