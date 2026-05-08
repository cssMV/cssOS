// CSSOS Phase 2 Module 1 — Widget extension bundle entry point.
//
// Registers the Live Activity widget. Add this file (and the rest of
// the CssosCinemaWidget folder) to a new Widget Extension target in
// Xcode. See docs/PHASE2_LIVE_ACTIVITY.md for full setup steps.

import SwiftUI
import WidgetKit

@main
struct CssosCinemaWidgetBundle: WidgetBundle {
  var body: some Widget {
    if #available(iOS 16.1, *) {
      CssosCinemaLiveActivity()
    }
  }
}
