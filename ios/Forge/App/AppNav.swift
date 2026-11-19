import Observation
import SwiftUI

// The five places, as on the web (web/src/lib/places.ts): Home (feed), Projects (build), Clubs (clubs),
// Record (me), Inbox (messages). The case names are the old ones so FORGE_TEST_TAB and links keep
// working; only the labels changed. Alerts are the bell on Home, not a tab.
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
