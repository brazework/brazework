import SwiftUI
import Supabase

private struct Membership: Decodable { let role: String; let communities: Club? }
private struct JoinRow: Encodable { let communityId: String; let uid: UUID; let role: String }
private struct RequestRow: Encodable { let communityId: String }

struct ClubsView: View {
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @State private var mine: [Club]?
  @State private var discover: [Club] = []
  @State private var query = ""

  var body: some View {
    NavigationStack {
      List {
        if let mine, !mine.isEmpty {
          Section("Your clubs") { ForEach(filtered(mine)) { row($0) } }
        }
        Section(mine?.isEmpty == false ? "Discover" : "Find your club") {
          ForEach(filtered(discover.filter { c in !(mine ?? []).contains { $0.id == c.id } })) { row($0) }
        }
      }
      .listStyle(.insetGrouped)
      .scrollContentBackground(.hidden)
      .background(p.bg)
      .overlay { if mine == nil { ProgressView() } }
      .navigationTitle("Clubs")
      .searchable(text: $query, prompt: "Search clubs")
      .navigationDestination(for: Club.self) { ClubView(club: $0) }
      .refreshable { await load() }
      .task { await load() }
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
    async let m: [Membership] = supabase.from("community_members").select("role, communities(id, name, about, field, privacy, member_count, topics)").eq("uid", value: me).execute().value
    async let d: [Club] = supabase.from("communities").select("id, name, about, field, privacy, member_count, topics").order("member_count", ascending: false).limit(30).execute().value
    mine = ((try? await m) ?? []).compactMap(\.communities).sorted { $0.name < $1.name }
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
        ForEach(posts ?? []) { post in
          PostCard(item: RankedPost(post: post, reason: "", score: 0), liked: feed.liked.contains(post.id), saved: feed.saved.contains(post.id),
                   onLike: { Task { await feed.toggleLike(post, me: session.userId!) } }, onSave: { Task { await feed.toggleSave(post, me: session.userId!) } })
        }
      }
      .padding(16)
    }
    .background(p.bg)
    .navigationBarTitleDisplayMode(.inline)
    .navigationDestination(for: Post.self) { PostDetailView(post: $0, feed: feed) }
    .task { await load() }
  }

  @ViewBuilder private var joinButton: some View {
    if let role {
      Label(role == "member" ? "You're a member" : "You're \(role == "admin" ? "an" : "a") \(role)", systemImage: "checkmark.circle.fill")
        .font(.subheadline.weight(.medium)).foregroundStyle(p.muted)
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
    struct R: Decodable { let role: String }
    role = (try? await supabase.from("community_members").select("role").eq("community_id", value: club.id).eq("uid", value: me).single().execute().value as R)?.role
    do {
      let list: [Post] = try await supabase.from("posts").select().eq("community_id", value: club.id).eq("status", value: "visible").order("created_at", ascending: false).limit(30).execute().value
      posts = list
      feed.items = list.map { RankedPost(post: $0, reason: "", score: 0) }
    } catch { posts = [] }
  }

  private func join() async {
    guard let me = session.userId else { return }
    working = true; error = nil
    defer { working = false }
    do {
      if club.isPublic {
        try await supabase.from("community_members").insert(JoinRow(communityId: club.id, uid: me, role: "member")).execute()
        role = "member"
        await load()
      } else {
        try await supabase.from("community_requests").insert(RequestRow(communityId: club.id)).execute()
        requested = true
      }
    } catch { self.error = friendly(error) }
  }
}
