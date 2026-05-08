# Phase 2 Module 1 — iOS Live Activity for cinema MV pipeline

The cinema MV pipeline runs in 5 stages (cover → lyrics → music → video →
compose, ~30–90s). On iOS 16.1+ we surface that progress as a **Live
Activity** so the user keeps seeing it on the lock screen and Dynamic
Island even when they background the cssOS app.

This document is a build-and-test reference. The shipped scaffold is in:

- `mobile/ios/App/App/CssosLiveActivity.swift` — Capacitor plugin (host app target)
- `mobile/ios/App/App/CssosCinemaAttributes.swift` — Codable model (shared by host + widget targets)
- `mobile/ios/App/CssosCinemaWidget/CssosCinemaLiveActivity.swift` — SwiftUI views (widget target)
- `mobile/ios/App/CssosCinemaWidget/CssosCinemaWidgetBundle.swift` — Widget bundle entry (widget target)
- `mobile/src/live-activity-plugin.ts` — TS bridge with web/Android fallback
- `migrations/057_live_activity_tokens.sql` — server-side token table
- `src/index.ts` — `sendLiveActivityUpdate()` + `/api/push/live-activity-token`

## What the user sees

**Lock screen card** — black 16pt rounded card with: person name +
filmstrip icon on the leading edge, current stage label trailing, a
white progress bar, and `<pct>%  ETA <secs>s` underneath.

**Dynamic Island compact** — leading: filmstrip glyph; trailing: `<pct>%`.

**Dynamic Island expanded** — leading: person name; trailing: stage
label; bottom: progress bar + ETA caption.

**Dynamic Island minimal (multiple activities)** — bare percentage.

## Required Xcode steps

The Capacitor `npx cap sync ios` does not create extension targets, so a
human has to do this once per machine clone:

1. Open `mobile/ios/App/App.xcworkspace` in Xcode.
2. **File → New → Target → Widget Extension**.
   - Product Name: `CssosCinemaWidget`
   - Bundle Identifier: `<host-bundle>.CssosCinemaWidget`
   - Language: Swift, Include Live Activity: **YES**, Include Configuration App Intent: **NO**.
3. Delete the boilerplate files Xcode generated inside the new target.
4. Drag the four files in `mobile/ios/App/CssosCinemaWidget/` into the
   new target (uncheck "Copy items if needed", check the
   `CssosCinemaWidget` target only).
5. Drag `mobile/ios/App/App/CssosCinemaAttributes.swift` into the Xcode
   project and check **BOTH** the `App` target and the
   `CssosCinemaWidget` target — the `ActivityAttributes` type must be
   identical in both binaries.
6. Drag `mobile/ios/App/App/CssosLiveActivity.swift` into the `App`
   target only.
7. In the host `App` target's `Info.plist`, add
   `NSSupportsLiveActivities` = `YES` (Boolean).
8. Build for a **real device** running iOS 16.1+. Live Activities do
   not appear in the simulator until iOS 17 and even then are flaky.

## Native plugin contract

```ts
// mobile/src/live-activity-plugin.ts
startCinemaActivity({ personName, runId })  // -> { activityId, pushToken } | null
updateCinemaActivity(activityId, { stage, pct, etaSecs })
endCinemaActivity(activityId)
```

`pushToken` is a per-Activity ephemeral hex token. Send it to the
server immediately so the backend can drive updates while the app is
backgrounded:

```ts
import { startCinemaActivity, endCinemaActivity } from "./live-activity-plugin";
import { Capacitor } from "@capacitor/core";
// CSSOS_I18N.tr() for any visible labels rendered on the JS side.

const res = await startCinemaActivity({ personName, runId });
if (res) {
  await fetch("/api/push/live-activity-token", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      run_id: runId,
      push_token: res.pushToken,
      bundle_id: Capacitor.getPlatform() === "ios" ? "app.cssstudio.app" : null,
    }),
  });
}
// ... when the run ends:
await endCinemaActivity(res?.activityId || "");
await fetch("/api/push/live-activity-token", {
  method: "DELETE",
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ run_id: runId }),
});
```

On non-iOS platforms `startCinemaActivity` returns `null` and the
in-app progress chips remain the only UI — exactly the existing
behaviour.

## ActivityAttributes (Swift)

```swift
struct CssosCinemaAttributes: ActivityAttributes {
  typealias ContentState = CinemaContentState
  struct CinemaContentState: Codable, Hashable {
    var stage: String   // "cover" | "lyrics" | "music" | "video" | "compose"
    var pct: Int        // 0-100
    var etaSecs: Int
  }
  var personName: String
  var runId: String
}
```

The wire JSON in the server's APNs payload must match this exactly
(snake-case `etaSecs` is the camelCase the Swift Codable expects).

## Server-side APNs push

`sendLiveActivityUpdate(runId, { stage, pct, etaSecs })` reuses the
Wave 98b APNs HTTP/2 plumbing — same `apnsJwt()` ES256 cache, same
`getApnsSession()` pool — but with these differences:

| header | value |
|---|---|
| `apns-topic` | `app.cssstudio.app.push-type.liveactivity` (host bundle id + suffix) |
| `apns-push-type` | `liveactivity` |
| `apns-priority` | `5` for ticks, `10` for `end` |

Payload shape:

```json
{
  "aps": {
    "timestamp": 1715200000,
    "event": "update",
    "content-state": { "stage": "video", "pct": 72, "etaSecs": 14 }
  }
}
```

For the final tick, send `"event": "end"` with priority 10 — the
helper does this automatically when the JS bridge calls `DELETE
/api/push/live-activity-token`.

The cinema pipeline progress emitter calls
`globalThis.__cssosNotifyRunProgress(runId, state)` (set in
`src/index.ts`) on every stage tick so each registered Live Activity
gets an APNs push alongside the existing in-app progress UI and web
push fan-out.

## Server env vars

Reuses the existing APNs vars — no new secrets:

- `APPLE_TEAM_ID`
- `APNS_KEY_ID`
- `APNS_KEY_PATH`
- `APNS_TOPIC` (set to host bundle id, e.g. `app.cssstudio.app`)

When any of these is missing the helper degrades to a no-op log line,
matching the Wave 98b pattern. The widget runs locally without server
pushes — first 1–2 stages can be driven by `update()` from JS before
the app backgrounds; after that the server takes over.

## Migration

Additive — no destructive change.

```sql
-- migrations/057_live_activity_tokens.sql
CREATE TABLE IF NOT EXISTS live_activity_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  run_id TEXT NOT NULL,
  push_token TEXT NOT NULL,
  bundle_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  UNIQUE (user_id, run_id, push_token)
);
```

## Testing matrix

| surface | iOS | device | expected |
|---|---|---|---|
| Lock screen | 16.1+ | real device | card with progress + ETA |
| Dynamic Island compact | 16.1+ | iPhone 14 Pro+ | filmstrip + `<pct>%` |
| Dynamic Island expanded (long press) | 16.1+ | iPhone 14 Pro+ | name + stage + bar |
| Background pushes | 16.1+ | real device, app backgrounded | server APNs ticks update UI |
| Simulator | any | n/a | flaky / not supported — do not rely on it |
| iOS 16.0 and below | <16.1 | real device | plugin rejects, JS bridge no-ops, in-app chips remain |
| Android / web | n/a | any | bridge returns `null`, existing in-app UI unchanged |

## Iron rules

- All visible JS strings go through `CSSOS_I18N.tr()`.
- Any new web CSS includes a light-theme override (none added in this
  module — the Live Activity card is iOS-rendered SwiftUI).
- All edits land in `/Users/jing/cssOS` directly (main repo only).
