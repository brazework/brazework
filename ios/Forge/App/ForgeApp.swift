import SwiftUI

@main
struct ForgeApp: App {
  @State private var session = Session()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(session)
        .modifier(Themed())
        .task { await session.start() }
    }
  }
}

struct RootView: View {
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p

  var body: some View {
    Group {
      switch session.state {
      case .loading: ZStack { p.bg.ignoresSafeArea(); ProgressView() }
      case .signedOut: SignInView()
      case .signedIn:
        if session.profile?.onboarded == false { OnboardingView() } else { MainTabs() }
      }
    }
    .animation(.smooth, value: session.state)
  }
}

struct MainTabs: View {
  @Environment(Session.self) private var session
  @Environment(\.scenePhase) private var phase
  @State private var nav = AppNav()

  var body: some View {
    TabView(selection: $nav.tab) {
      Tab("Feed", systemImage: "house", value: AppTab.feed) { FeedView() }
      Tab("Clubs", systemImage: "person.3", value: AppTab.clubs) { ClubsView() }
      Tab("Messages", systemImage: "bubble.left.and.bubble.right", value: AppTab.messages) { MessagesView() }
        .badge(session.unreadMessages)
      Tab("Alerts", systemImage: "bell", value: AppTab.alerts) { AlertsView() }
        .badge(session.unreadAlerts)
      Tab("You", systemImage: "person.crop.circle", value: AppTab.me) { MeView() }
    }
    .tabBarMinimizeBehavior(.onScrollDown)
    .environment(nav)
    .onChange(of: phase) { if phase == .active { Task { await session.refreshBadges() } } }
    .task { while !Task.isCancelled { try? await Task.sleep(for: .seconds(30)); await session.refreshBadges() } }
  }
}
