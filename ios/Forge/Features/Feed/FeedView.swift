import SwiftUI

struct FeedView: View {
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @Environment(\.scenePhase) private var phase
  @State private var store = FeedStore()
  @State private var compose: ComposeStart?
  @State private var path = NavigationPath()
  @State private var inbox: [InboxEntry]?
  @State private var events: [ForgeEvent] = []
  @State private var going: Set<String> = []
  @State private var people: [Profile] = []
  @State private var clubs: [Club] = []

  struct SearchRoute: Hashable {}
  struct ComposeStart: Identifiable { let id = UUID(); let kind: String; let photo: Bool }

  var body: some View {
    NavigationStack(path: $path) {
      ScrollViewReader { proxy in
        ScrollView {
          LazyVStack(spacing: 12) {
            Color.clear.frame(height: 0).id("top")
            ComposerPrompt { kind, photo in compose = ComposeStart(kind: kind, photo: photo) }
            MessagesCard(entries: inbox)
            FeedFilterBar(store: store).padding(.top, 4)
            if let error = store.error {
              Label(error, systemImage: "exclamationmark.triangle").font(.footnote).foregroundStyle(p.danger).frame(maxWidth: .infinity, alignment: .leading)
            }
            if !store.loaded && store.items.isEmpty {
              ForEach(0..<3, id: \.self) { _ in SkeletonCard() }
            } else if store.visible.isEmpty {
              empty
            }
            ForEach(Array(store.visible.enumerated()), id: \.element.id) { i, item in
              PostCard(item: item, store: store)
                .transition(.asymmetric(insertion: .opacity.combined(with: .move(edge: .top)), removal: .opacity))
              module(after: i)
            }
            if store.canLoadMore {
              ProgressView().frame(maxWidth: .infinity).padding(.vertical, 20)
                .onAppear { Task { if let me = session.userId { await store.loadMore(me: me) } } }
            } else if store.loaded && !store.visible.isEmpty {
              caughtUp
            }
          }
          .padding(.horizontal, 16)
          .padding(.top, 4)
          .padding(.bottom, 24)
          .animation(.snappy, value: store.visible.map(\.id))
        }
        .overlay(alignment: .top) {
          if store.newCount > 0 {
            NewPostsPill(count: store.newCount) {
              withAnimation(.snappy) { proxy.scrollTo("top", anchor: .top) }
              Task { await reload() }
            }
            .padding(.top, 8)
            .transition(.move(edge: .top).combined(with: .opacity))
          }
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: store.newCount > 0)
        #if DEBUG
        // For screenshots: FORGE_TEST_SCROLL=events|people|clubs scrolls to that strip once loaded.
        .task(id: store.items.count + events.count + people.count) {
          if let target = ProcessInfo.processInfo.environment["FORGE_TEST_SCROLL"], store.loaded { try? await Task.sleep(for: .milliseconds(400)); proxy.scrollTo(target, anchor: .top) }
        }
        #endif
      }
      .background(p.bg)
      .navigationTitle("Forge")
      .toolbarTitleDisplayMode(.inlineLarge)
      .toolbar {
        ToolbarItem(placement: .primaryAction) {
          NavigationLink { SearchView() } label: { Image(systemName: "magnifyingglass") }
            .accessibilityLabel("Search")
        }
        ToolbarItem(placement: .primaryAction) {
          Button { compose = ComposeStart(kind: "update", photo: false) } label: { Image(systemName: "square.and.pencil") }
            .accessibilityLabel("New post")
        }
      }
      .navigationDestination(for: Post.self) { PostDetailView(post: $0, feed: store) }
      .navigationDestination(for: PersonRoute.self) { ProfileView(id: $0.id) }
      .navigationDestination(for: InboxItem.self) { ThreadView(item: $0) }
      .navigationDestination(for: ChatRoute.self) { GroupThreadView(route: $0) }
      .navigationDestination(for: ForgeEvent.self) { EventDetailView(event: $0) }
      .navigationDestination(for: Club.self) { ClubView(club: $0) }
      .navigationDestination(for: SearchRoute.self) { _ in SearchView() }
      .refreshable { await reload(); await loadModules() }
      .task(id: store.tab) { await reload() }
      .task { await loadModules() }
      // New posts and messages, while the feed is open.
      .task {
        while !Task.isCancelled {
          try? await Task.sleep(for: .seconds(30))
          guard phase == .active, let me = session.userId else { continue }
          await store.checkForNew(me: me)
          inbox = await InboxSummary.load(me: me)
        }
      }
      #if DEBUG
      .task {
        let env = ProcessInfo.processInfo.environment
        if env["FORGE_TEST_COMPOSE"] != nil { compose = ComposeStart(kind: "update", photo: false) }
        if env["FORGE_TEST_SEARCH"] != nil, path.isEmpty { path.append(SearchRoute()) }
        if let id = env["FORGE_TEST_PROFILE"].flatMap(UUID.init(uuidString:)), path.isEmpty { path.append(PersonRoute(id: id)) }
      }
      #endif
      .onChange(of: compose == nil) { VideoCoordinator.shared.suspended = compose != nil }
      .sheet(item: $compose) { start in
        ComposerView(initialKind: start.kind, openPicker: start.photo) { Task { store.tab = .forYou; await reload() } }
          .presentationDetents([.medium, .large])
      }
    }
  }

  // Discovery between posts: events after the 3rd, people after the 7th, clubs after the 12th.
  @ViewBuilder private func module(after i: Int) -> some View {
    if i == 2, !events.isEmpty {
      Strip(title: "Upcoming events") { ForEach(events.prefix(8)) { EventCard(event: $0, going: going.contains($0.id)) } }.id("events")
    } else if i == 6, !people.isEmpty {
      Strip(title: "People to follow") {
        let mine = Set(session.profile?.interests ?? [])
        ForEach(people) { PersonCard(person: $0, shared: $0.interests.filter(mine.contains)) }
      }
      .id("people")
    } else if i == 11, !clubs.isEmpty {
      Strip(title: "Clubs to join") { ForEach(clubs) { ClubCard(club: $0) } }.id("clubs")
    }
  }

  private var empty: some View {
    VStack(spacing: 16) {
      EmptyState(icon: store.tab == .following ? "person.2" : store.filter == .all ? "sparkles" : "line.3.horizontal.decrease.circle",
                 title: store.filter != .all ? "No \(store.filter.rawValue.lowercased()) here yet" : store.tab == .following ? "No one followed yet" : "Nothing here yet",
                 message: store.filter != .all ? "Try All, or another tab." : store.tab == .following ? "Follow builders to see their work here." : "Be the first to share what you're building.")
      if store.tab == .following, !people.isEmpty {
        Strip(title: "People to follow") {
          let mine = Set(session.profile?.interests ?? [])
          ForEach(people) { PersonCard(person: $0, shared: $0.interests.filter(mine.contains)) }
        }
      }
    }
  }

  private var caughtUp: some View {
    VStack(spacing: 8) {
      Image(systemName: "checkmark.circle").font(.title2).foregroundStyle(p.faint)
      Text("You're all caught up").font(.subheadline.weight(.semibold)).foregroundStyle(p.text2)
      Text(clubs.isEmpty ? "Post something, or check back later." : "Find more in Clubs and Events.").font(.footnote).foregroundStyle(p.muted)
    }
    .padding(.vertical, 28)
    .frame(maxWidth: .infinity)
  }

  private func reload() async {
    guard let me = session.userId else { return }
    await store.load(me: me, interests: session.profile?.interests ?? [])
  }

  private func loadModules() async {
    guard let me = session.userId else { return }
    async let i = InboxSummary.load(me: me)
    async let e = (try? await API.upcomingEvents()) ?? []
    async let g = API.goingTo(me: me)
    async let pp = API.suggestedPeople(me: me, interests: session.profile?.interests ?? [], field: session.profile?.field ?? "")
    async let mine = (try? await API.myClubs(me: me)) ?? []
    async let all = (try? await API.discoverClubs()) ?? []
    let (inboxNow, eventsNow, goingNow, peopleNow) = await (i, e, g, pp)
    let mineIds = Set(await mine.map(\.id))
    let clubsNow = await all.filter { !mineIds.contains($0.id) }
    withAnimation(.snappy) { inbox = inboxNow; events = eventsNow; going = goingNow; people = peopleNow; clubs = clubsNow }
  }
}

private struct SkeletonCard: View {
  @Environment(\.palette) private var p
  @State private var shimmer = false
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack { Circle().frame(width: 40, height: 40); VStack(alignment: .leading) { Capsule().frame(width: 120, height: 10); Capsule().frame(width: 80, height: 8) } }
      Capsule().frame(height: 10); Capsule().frame(height: 10); Capsule().frame(width: 180, height: 10)
    }
    .foregroundStyle(p.surface2)
    .opacity(shimmer ? 0.5 : 1)
    .padding(16)
    .background(p.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    .onAppear { withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { shimmer = true } }
    .accessibilityHidden(true)
  }
}
