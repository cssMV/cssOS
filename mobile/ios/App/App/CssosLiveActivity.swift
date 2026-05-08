// CSSOS Phase 2 Module 1 — Live Activity native plugin.
//
// Bridges the cinema MV pipeline progress (cover → lyrics → music →
// video → compose) into an iOS Live Activity so users see progress on
// the lock screen and Dynamic Island even when the app is backgrounded.
//
// Wired into Capacitor as `CssosLiveActivity` with three methods:
//   start(personName, runId) -> { activityId, pushToken }
//   update(activityId, stage, pct, etaSecs)
//   end(activityId)
//
// Requires iOS 16.1+. On older systems the plugin returns AVAILABILITY
// errors so the JS bridge can degrade gracefully.

import Foundation
import Capacitor
#if canImport(ActivityKit)
import ActivityKit
#endif

@objc(CssosLiveActivity)
public class CssosLiveActivity: CAPPlugin {

  @objc func start(_ call: CAPPluginCall) {
    if #available(iOS 16.1, *) {
      let personName = call.getString("personName") ?? "?"
      let runId = call.getString("runId") ?? UUID().uuidString

      let attrs = CssosCinemaAttributes(personName: personName, runId: runId)
      let initial = CssosCinemaAttributes.CinemaContentState(
        stage: "cover",
        pct: 0,
        etaSecs: 60
      )

      do {
        if #available(iOS 16.2, *) {
          let activity = try Activity<CssosCinemaAttributes>.request(
            attributes: attrs,
            content: .init(state: initial, staleDate: nil),
            pushType: .token
          )
          let token = activity.pushToken?.map { String(format: "%02x", $0) }.joined() ?? ""
          call.resolve([
            "activityId": activity.id,
            "pushToken": token
          ])
        } else {
          // iOS 16.1 — older API surface (no ActivityContent wrapper).
          let activity = try Activity<CssosCinemaAttributes>.request(
            attributes: attrs,
            contentState: initial,
            pushType: .token
          )
          let token = activity.pushToken?.map { String(format: "%02x", $0) }.joined() ?? ""
          call.resolve([
            "activityId": activity.id,
            "pushToken": token
          ])
        }
      } catch {
        call.reject("live-activity start failed: \(error.localizedDescription)")
      }
    } else {
      call.reject("LIVE_ACTIVITY_UNAVAILABLE")
    }
  }

  @objc func update(_ call: CAPPluginCall) {
    if #available(iOS 16.1, *) {
      guard let activityId = call.getString("activityId") else {
        call.reject("MISSING_ACTIVITY_ID"); return
      }
      let stage = call.getString("stage") ?? "cover"
      let pct = call.getInt("pct") ?? 0
      let etaSecs = call.getInt("etaSecs") ?? 0

      let state = CssosCinemaAttributes.CinemaContentState(
        stage: stage, pct: pct, etaSecs: etaSecs
      )

      Task {
        for activity in Activity<CssosCinemaAttributes>.activities
        where activity.id == activityId {
          if #available(iOS 16.2, *) {
            await activity.update(.init(state: state, staleDate: nil))
          } else {
            await activity.update(using: state)
          }
        }
        call.resolve()
      }
    } else {
      call.reject("LIVE_ACTIVITY_UNAVAILABLE")
    }
  }

  @objc func end(_ call: CAPPluginCall) {
    if #available(iOS 16.1, *) {
      guard let activityId = call.getString("activityId") else {
        call.reject("MISSING_ACTIVITY_ID"); return
      }
      Task {
        for activity in Activity<CssosCinemaAttributes>.activities
        where activity.id == activityId {
          if #available(iOS 16.2, *) {
            let final = CssosCinemaAttributes.CinemaContentState(
              stage: "compose", pct: 100, etaSecs: 0
            )
            await activity.end(.init(state: final, staleDate: nil), dismissalPolicy: .default)
          } else {
            await activity.end(dismissalPolicy: .default)
          }
        }
        call.resolve()
      }
    } else {
      call.reject("LIVE_ACTIVITY_UNAVAILABLE")
    }
  }
}
