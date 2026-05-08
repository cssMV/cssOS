// CSSOS Phase 2 Module 1 — Live Activity attributes.
//
// Shared Codable model used by the host app (CssosLiveActivity plugin)
// AND by the widget extension target (CssosCinemaWidget) to render the
// lock-screen + Dynamic Island UI. Add this file to BOTH targets in
// Xcode so the symbols line up.

import Foundation
#if canImport(ActivityKit)
import ActivityKit

@available(iOS 16.1, *)
public struct CssosCinemaAttributes: ActivityAttributes {
  public typealias ContentState = CinemaContentState

  public struct CinemaContentState: Codable, Hashable {
    // Pipeline stage: "cover" | "lyrics" | "music" | "video" | "compose".
    public var stage: String
    public var pct: Int        // 0..100
    public var etaSecs: Int    // best-effort remaining seconds

    public init(stage: String, pct: Int, etaSecs: Int) {
      self.stage = stage
      self.pct = pct
      self.etaSecs = etaSecs
    }
  }

  public var personName: String
  public var runId: String

  public init(personName: String, runId: String) {
    self.personName = personName
    self.runId = runId
  }
}
#endif
