import Observation
import SwiftUI

// The five places, as on the web: Today (feed), Build, Club (clubs), Proof (me), Inbox (messages).
// Alerts are the bell on Today, not a tab.
enum AppTab: String { case feed, build, clubs, me, messages }

// Which tab is showing, shared so any screen can send you to another tab.
@MainActor @Observable
final class AppNav {
  var tab: AppTab
  init() {
    #if DEBUG
    if let t = ProcessInfo.processInfo.environment["FORGE_TEST_TAB"], let tab = AppTab(rawValue: t) { self.tab = tab; return }
    #endif
    tab = .feed
  }
}
