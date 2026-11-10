import Observation
import SwiftUI

enum AppTab: String { case feed, clubs, messages, alerts, me }

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
