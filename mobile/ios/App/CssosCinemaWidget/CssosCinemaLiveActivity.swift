// CSSOS Phase 2 Module 1 — Live Activity widget bundle.
//
// SwiftUI views for the cinema MV pipeline Live Activity. Lives in the
// widget extension target (CssosCinemaWidget) so it can render on the
// lock screen and inside the Dynamic Island. Shares the Codable
// attributes type with the host app via CssosCinemaAttributes.swift.

import SwiftUI
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit

@available(iOS 16.1, *)
struct CssosCinemaLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: CssosCinemaAttributes.self) { context in
      // Lock-screen / banner presentation.
      LockScreenView(
        personName: context.attributes.personName,
        state: context.state
      )
      .padding(16)
      .activityBackgroundTint(Color.black.opacity(0.85))
      .activitySystemActionForegroundColor(Color.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(context.attributes.personName)
            .font(.headline)
            .foregroundColor(.white)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(stageLabel(context.state.stage))
            .font(.subheadline)
            .foregroundColor(.white.opacity(0.8))
        }
        DynamicIslandExpandedRegion(.bottom) {
          ProgressView(value: Double(context.state.pct) / 100.0)
            .tint(.white)
          Text("ETA \(context.state.etaSecs)s")
            .font(.caption)
            .foregroundColor(.white.opacity(0.7))
        }
      } compactLeading: {
        Image(systemName: "film.fill")
      } compactTrailing: {
        Text("\(context.state.pct)%")
      } minimal: {
        Text("\(context.state.pct)")
      }
      .keylineTint(.white)
    }
  }
}

@available(iOS 16.1, *)
private struct LockScreenView: View {
  let personName: String
  let state: CssosCinemaAttributes.CinemaContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Image(systemName: "film.fill")
          .foregroundColor(.white)
        Text(personName)
          .font(.headline)
          .foregroundColor(.white)
        Spacer()
        Text(stageLabel(state.stage))
          .font(.subheadline)
          .foregroundColor(.white.opacity(0.8))
      }
      ProgressView(value: Double(state.pct) / 100.0)
        .tint(.white)
      HStack {
        Text("\(state.pct)%")
          .font(.caption)
          .foregroundColor(.white.opacity(0.8))
        Spacer()
        Text("ETA \(state.etaSecs)s")
          .font(.caption)
          .foregroundColor(.white.opacity(0.6))
      }
    }
  }
}

@available(iOS 16.1, *)
private func stageLabel(_ stage: String) -> String {
  // Localized at the JS layer where possible; native fallback stays English.
  switch stage {
  case "cover": return "Cover"
  case "lyrics": return "Lyrics"
  case "music": return "Music"
  case "video": return "Video"
  case "compose": return "Compose"
  default: return stage.capitalized
  }
}
#endif
