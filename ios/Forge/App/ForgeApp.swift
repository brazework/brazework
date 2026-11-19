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
      // The same five places as the web, each answering one question: what needs me, what am I
      // making, what's my team doing, what have I done and who signed it, who's reaching out.
      Tab("Home", systemImage: "house", value: AppTab.feed) { FeedView() }
        .badge(session.unreadAlerts)
      Tab("Projects", systemImage: "hammer", value: AppTab.build) { BuildView() }
      Tab("Clubs", systemImage: "person.3", value: AppTab.clubs) { ClubsView() }
      Tab("Record", systemImage: "checkmark.seal", value: AppTab.me) { MeView() }
      Tab("Inbox", systemImage: "tray", value: AppTab.messages) { MessagesView() }
        .badge(session.unreadMessages)
    }
    .tabBarMinimizeBehavior(.onScrollDown)
    .environment(nav)
    .onChange(of: phase) { if phase == .active { Task { await session.refreshBadges() } } }
    .task { while !Task.isCancelled { try? await Task.sleep(for: .seconds(30)); await session.refreshBadges() } }
  }
}
