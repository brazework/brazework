import SwiftUI

// One search across Forge: people, clubs, events and posts (people who share your interests first).
struct SearchView: View {
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @State private var query: String = {
    #if DEBUG
    return ProcessInfo.processInfo.environment["FORGE_TEST_SEARCH"] ?? ""
    #else
    return ""
    #endif
  }()
  @State private var results = API.SearchResults()
  @State private var searching = false
  @State private var feed = FeedStore()

  var body: some View {
    List {
      if query.trimmingCharacters(in: .whitespaces).count < 2 {
        Section {
          EmptyState(icon: "magnifyingglass", title: "Find people, clubs and events", message: "Search by name, field, club or topic: \"rocketry\", \"Maya\", \"machine learning\".")
            .listRowBackground(Color.clear)
        }
      } else if results.isEmpty && !searching {
        Section { EmptyState(icon: "questionmark.circle", title: "No matches", message: "Try a shorter word, or a club or field.").listRowBackground(Color.clear) }
      }
      if !results.people.isEmpty {
        Section("People") {
          let mine = Set(session.profile?.interests ?? [])
          ForEach(results.people) { u in
            NavigationLink(value: PersonRoute(id: u.id)) {
              HStack(spacing: 12) {
                Avatar(first: u.firstName, last: u.lastName, path: u.avatarPath, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                  Text(u.name).font(.body.weight(.semibold)).foregroundStyle(p.text)
                  let shared = u.interests.filter(mine.contains)
                  Text(shared.isEmpty ? [u.headline, u.field].filter { !$0.isEmpty }.joined(separator: " · ") : "Also into \(shared.prefix(2).joined(separator: ", "))")
                    .font(.caption).foregroundStyle(p.muted).lineLimit(1)
                }
              }
            }
          }
        }
        .listRowBackground(p.surface)
      }
      if !results.clubs.isEmpty {
        Section("Clubs") {
          ForEach(results.clubs) { c in
            NavigationLink(value: c) {
              HStack(spacing: 12) {
                ClubMark(name: c.name)
                VStack(alignment: .leading, spacing: 2) {
                  Text(c.name).font(.body.weight(.semibold)).foregroundStyle(p.text)
                  Text("\(c.memberCount) members\(c.field.isEmpty ? "" : " · \(c.field)")").font(.caption).foregroundStyle(p.muted)
                }
              }
            }
          }
        }
        .listRowBackground(p.surface)
      }
      if !results.events.isEmpty {
        Section("Events") {
          ForEach(results.events) { e in
            NavigationLink(value: e) {
              HStack(spacing: 12) {
                DateTile(date: e.startsAt, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                  Text(e.title).font(.body.weight(.semibold)).foregroundStyle(p.text)
                  Text(e.startsAt.formatted(.dateTime.weekday(.abbreviated).month().day().hour().minute())).font(.caption).foregroundStyle(p.muted)
                }
              }
            }
          }
        }
        .listRowBackground(p.surface)
      }
      if !results.posts.isEmpty {
        Section("Posts") {
          ForEach(results.posts) { post in
            NavigationLink(value: post) {
              VStack(alignment: .leading, spacing: 4) {
                Text(post.authorName).font(.caption.weight(.semibold)).foregroundStyle(p.muted)
                Text(post.body).font(.subheadline).foregroundStyle(p.text).lineLimit(3)
              }
            }
          }
        }
        .listRowBackground(p.surface)
      }
    }
    .listStyle(.insetGrouped)
    .scrollContentBackground(.hidden)
    .background(p.bg)
    .navigationTitle("Search")
    .navigationBarTitleDisplayMode(.inline)
    .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "People, clubs, events, posts")
    .overlay { if searching && results.isEmpty { ProgressView() } }
    .navigationDestination(for: Post.self) { PostDetailView(post: $0, feed: feed) }
    .task(id: query) {
      try? await Task.sleep(for: .milliseconds(250))
      guard !Task.isCancelled, let me = session.userId else { return }
      searching = true
      let r = await API.search(query, me: me, interests: session.profile?.interests ?? [], field: session.profile?.field ?? "")
      if !Task.isCancelled { withAnimation(.snappy) { results = r }; feed.items = r.posts.map { RankedPost(post: $0, reason: "", score: 0) } }
      searching = false
    }
  }
}
