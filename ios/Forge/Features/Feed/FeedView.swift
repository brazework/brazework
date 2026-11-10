import SwiftUI

struct FeedView: View {
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @State private var store = FeedStore()
  @State private var composing = false
  @State private var path = NavigationPath()

  var body: some View {
    NavigationStack(path: $path) {
      ScrollView {
        LazyVStack(spacing: 12) {
          Picker("Feed", selection: $store.tab) { ForEach(FeedTab.allCases) { Text($0.rawValue).tag($0) } }
            .pickerStyle(.segmented)
            .padding(.bottom, 4)
          if let error = store.error {
            Label(error, systemImage: "exclamationmark.triangle").font(.footnote).foregroundStyle(p.danger).frame(maxWidth: .infinity, alignment: .leading)
          }
          if !store.loaded && store.items.isEmpty {
            ForEach(0..<3, id: \.self) { _ in SkeletonCard() }
          } else if store.items.isEmpty {
            EmptyState(icon: store.tab == .following ? "person.2" : "sparkles",
                       title: store.tab == .following ? "No one followed yet" : "Nothing here yet",
                       message: store.tab == .following ? "Follow builders from their profile to see their work here." : "Be the first to share what you're building.")
          }
          ForEach(store.items) { item in
            PostCard(item: item, store: store)
          }
          if store.loaded && !store.items.isEmpty {
            Text("You're all caught up").font(.footnote).foregroundStyle(p.faint).padding(.vertical, 24)
          }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
      }
      .background(p.bg)
      .navigationTitle("Forge")
      .toolbarTitleDisplayMode(.inlineLarge)
      .toolbar {
        ToolbarItem(placement: .primaryAction) {
          Button { composing = true } label: { Image(systemName: "square.and.pencil") }
            .accessibilityLabel("New post")
        }
      }
      .navigationDestination(for: Post.self) { PostDetailView(post: $0, feed: store) }
      .navigationDestination(for: PersonRoute.self) { ProfileView(id: $0.id) }
      .navigationDestination(for: InboxItem.self) { ThreadView(item: $0) }
      .refreshable { await reload() }
      .task(id: store.tab) { await reload() }
      #if DEBUG
      .task {
        if ProcessInfo.processInfo.environment["FORGE_TEST_COMPOSE"] != nil { composing = true }
        if let id = ProcessInfo.processInfo.environment["FORGE_TEST_PROFILE"].flatMap(UUID.init(uuidString:)), path.isEmpty { path.append(PersonRoute(id: id)) }
      }
      #endif
      .onChange(of: composing) { VideoCoordinator.shared.suspended = composing }
      .sheet(isPresented: $composing) {
        ComposerView { Task { store.tab = .forYou; await reload() } }
          .presentationDetents([.medium, .large])
      }
    }
  }

  private func reload() async {
    guard let me = session.userId else { return }
    await store.load(me: me, interests: session.profile?.interests ?? [])
  }
}

private struct SkeletonCard: View {
  @Environment(\.palette) private var p
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack { Circle().frame(width: 40, height: 40); VStack(alignment: .leading) { Capsule().frame(width: 120, height: 10); Capsule().frame(width: 80, height: 8) } }
      Capsule().frame(height: 10); Capsule().frame(height: 10); Capsule().frame(width: 180, height: 10)
    }
    .foregroundStyle(p.surface2)
    .padding(16)
    .background(p.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    .redacted(reason: .placeholder)
    .accessibilityHidden(true)
  }
}
