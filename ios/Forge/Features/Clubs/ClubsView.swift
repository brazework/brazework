import SwiftUI

// Clubs and events: where members meet. One tab, two lists.
struct ClubsView: View {
  enum Section: String, CaseIterable { case clubs = "Clubs", events = "Events" }
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @State private var section: Section = {
    #if DEBUG
    if ProcessInfo.processInfo.environment["FORGE_TEST_SECTION"] == "events" { return .events }
    #endif
    return .clubs
  }()
  @State private var mine: [Club]?
  @State private var discover: [Club] = []
  @State private var query = ""
  @State private var path = NavigationPath()

  var body: some View {
    NavigationStack(path: $path) {
      Group {
        if section == .events { EventsList() } else { clubList }
      }
      .safeAreaInset(edge: .top) {
        Picker("Show", selection: $section) { ForEach(Section.allCases, id: \.self) { Text($0.rawValue) } }
          .pickerStyle(.segmented).padding(.horizontal, 16).padding(.bottom, 6)
      }
      .background(p.bg)
      .navigationTitle(section.rawValue)
      .navigationDestination(for: Club.self) { ClubView(club: $0) }
      .navigationDestination(for: ForgeEvent.self) { EventDetailView(event: $0) }
      .navigationDestination(for: Post.self) { PostLoader(id: $0.id) }
      .navigationDestination(for: PersonRoute.self) { ProfileView(id: $0.id) }
      .navigationDestination(for: InboxItem.self) { ThreadView(item: $0) }
    }
  }

  private var clubList: some View {
    List {
      if let mine, !mine.isEmpty {
        SwiftUI.Section("Your clubs") { ForEach(filtered(mine)) { row($0) } }
      }
      SwiftUI.Section(mine?.isEmpty == false ? "Discover" : "Find your club") {
        ForEach(filtered(discover.filter { c in !(mine ?? []).contains { $0.id == c.id } })) { row($0) }
      }
    }
    .listStyle(.insetGrouped)
    .scrollContentBackground(.hidden)
    .overlay { if mine == nil { ProgressView() } }
    .searchable(text: $query, prompt: "Search clubs")
    .refreshable { await load() }
    .task {
      await load()
      #if DEBUG
      // For screenshots: FORGE_TEST_CLUB=<club id> opens that club.
      if let id = ProcessInfo.processInfo.environment["FORGE_TEST_CLUB"], path.isEmpty, let c = (mine ?? []).first(where: { $0.id == id }) ?? discover.first(where: { $0.id == id }) { path.append(c) }
      #endif
    }
  }

  private func filtered(_ list: [Club]) -> [Club] {
    let q = query.trimmingCharacters(in: .whitespaces).lowercased()
    return q.isEmpty ? list : list.filter { $0.name.lowercased().contains(q) || $0.field.lowercased().contains(q) }
  }

  private func row(_ c: Club) -> some View {
    NavigationLink(value: c) {
      HStack(spacing: 12) {
        ClubMark(name: c.name)
        VStack(alignment: .leading, spacing: 2) {
          Text(c.name).font(.body.weight(.semibold)).foregroundStyle(p.text)
          Text("\(c.memberCount) member\(c.memberCount == 1 ? "" : "s")\(c.field.isEmpty ? "" : " · \(c.field)")").font(.caption).foregroundStyle(p.muted)
        }
      }
      .padding(.vertical, 2)
    }
    .listRowBackground(p.surface)
  }

  private func load() async {
    guard let me = session.userId else { return }
    async let m = API.myClubs(me: me)
    async let d = API.discoverClubs()
    mine = (try? await m) ?? []
    discover = (try? await d) ?? []
  }
}

struct ClubMark: View {
  var name: String
  var size: CGFloat = 40
  @Environment(\.palette) private var p
  var body: some View {
    Text(String(name.prefix(1)).uppercased())
      .font(.system(size: size * 0.42, weight: .bold, design: .rounded))
      .foregroundStyle(p.onAccent)
      .frame(width: size, height: size)
      .background(p.gradient, in: RoundedRectangle(cornerRadius: size * 0.3, style: .continuous))
      .accessibilityHidden(true)
  }
}

struct ClubView: View {
  let club: Club
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @State private var feed = FeedStore()
  @State private var posts: [Post]?
  @State private var role: String?
  @State private var requested = false
  @State private var working = false
  @State private var error: String?
  @State private var chat: ChatRoute?
  @State private var newTeam = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        HStack(spacing: 14) {
          ClubMark(name: club.name, size: 60)
          VStack(alignment: .leading, spacing: 4) {
            Text(club.name).font(.title2.weight(.bold)).foregroundStyle(p.text)
            Text("\(club.memberCount) members · \(club.isPublic ? "Public" : "Approval to join")").font(.subheadline).foregroundStyle(p.muted)
          }
        }
        if !club.about.isEmpty { Text(club.about).font(.body).foregroundStyle(p.text2) }
        joinButton
        if let error { Text(error).font(.footnote).foregroundStyle(p.danger) }
        Text("Posts").font(.headline).foregroundStyle(p.text).padding(.top, 8)
        if posts == nil { ProgressView().frame(maxWidth: .infinity) }
        if posts?.isEmpty == true { EmptyState(icon: "text.bubble", title: "No posts yet", message: role == nil ? "Join to see and share what members are building." : "Share the first update.") }
        ForEach(feed.items) { item in
          PostCard(item: item, store: feed)
        }
      }
      .padding(16)
    }
    .background(p.bg)
    .navigationBarTitleDisplayMode(.inline)
    .navigationDestination(for: Post.self) { PostDetailView(post: $0, feed: feed) }
    .navigationDestination(item: $chat) { GroupThreadView(route: $0) }
    .sheet(isPresented: $newTeam) { NewTeamChatView(club: club) { route in chat = route } }
    .task {
      await load()
      #if DEBUG
      if ProcessInfo.processInfo.environment["FORGE_TEST_NEW_TEAM"] != nil { newTeam = true }
      #endif
    }
  }

  private func openChat() async {
    working = true; error = nil
    defer { working = false }
    do { chat = ChatRoute(id: try await API.openClubChat(club.id), title: club.name, kind: "club", communityId: club.id) }
    catch { self.error = friendly(error) }
  }

  @ViewBuilder private var joinButton: some View {
    if let role {
      Label(role == "member" ? "You're a member" : "You're \(role == "admin" ? "an" : "a") \(role)", systemImage: "checkmark.circle.fill")
        .font(.subheadline.weight(.medium)).foregroundStyle(p.muted)
      HStack(spacing: 10) {
        Button { Task { await openChat() } } label: { Label("Club chat", systemImage: "bubble.left.and.bubble.right.fill") }
          .buttonStyle(PrimaryButtonStyle())
        Button { newTeam = true } label: {
          Label("Team chat", systemImage: "person.2.badge.plus").font(.body.weight(.semibold)).foregroundStyle(p.text)
            .frame(maxWidth: .infinity, minHeight: 50).background(p.surface2, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
      }
      .disabled(working)
    } else if requested {
      Label("Request sent", systemImage: "clock").font(.subheadline.weight(.medium)).foregroundStyle(p.muted)
    } else {
      Button { Task { await join() } } label: { Text(club.isPublic ? "Join club" : "Ask to join") }
        .buttonStyle(PrimaryButtonStyle())
        .disabled(working)
    }
  }

  private func load() async {
    guard let me = session.userId else { return }
    role = await API.role(in: club.id, me: me)
    do {
      let list = try await API.clubPosts(club.id)
      await feed.show(list, me: me)
      posts = list
    } catch { posts = [] }
  }

  private func join() async {
    guard let me = session.userId else { return }
    working = true; error = nil
    defer { working = false }
    do {
      try await API.join(club, me: me)
      if club.isPublic { role = "member"; await load() } else { requested = true }
    } catch { self.error = friendly(error) }
  }
}
