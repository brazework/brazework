import SwiftUI

struct ProfileView: View {
  let id: UUID
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @State private var profile: Profile?
  @State private var feed = FeedStore()
  @State private var following = false
  @State private var thread: InboxItem?
  @State private var busy = false
  @State private var error: String?

  private var isMe: Bool { id == session.userId }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        if let profile {
          header(profile)
        } else if error == nil {
          ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
        }
        if let error { Text(error).font(.footnote).foregroundStyle(p.danger) }
        if profile != nil {
          Text(isMe ? "Your posts" : "Posts").font(.headline).foregroundStyle(p.text).padding(.top, 4)
          if feed.items.isEmpty && feed.loaded { Text("Nothing posted yet.").font(.subheadline).foregroundStyle(p.muted) }
          ForEach(feed.items) { item in
            PostCard(item: item, store: feed)
          }
        }
      }
      .padding(16)
    }
    .background(p.bg)
    .navigationBarTitleDisplayMode(.inline)
    .toolbar { ToolbarItem(placement: .primaryAction) { ShareLink(item: Env.web("u/\(id.uuidString.lowercased())")) } }
    .navigationDestination(item: $thread) { ThreadView(item: $0) }
    .task { await load() }
  }

  private func header(_ u: Profile) -> some View {
    VStack(alignment: .leading, spacing: 12) {
      Avatar(first: u.firstName, last: u.lastName, path: u.avatarPath, size: 84)
      VStack(alignment: .leading, spacing: 4) {
        Text(u.name).font(.title.weight(.bold)).foregroundStyle(p.text)
        if !u.headline.isEmpty { Text(u.headline).font(.body).foregroundStyle(p.text2) }
        Text([u.field, u.accountType == "student" ? "Student" : "Professional"].filter { !$0.isEmpty }.joined(separator: " · ")).font(.subheadline).foregroundStyle(p.muted)
      }
      if !u.bio.isEmpty { Text(u.bio).font(.body).foregroundStyle(p.text2) }
      if !u.interests.isEmpty {
        ScrollView(.horizontal, showsIndicators: false) { HStack(spacing: 6) { ForEach(u.interests.prefix(12), id: \.self) { Chip(text: $0) } } }
      }
      if !isMe {
        HStack(spacing: 10) {
          Button { Task { await message() } } label: { Label("Message", systemImage: "paperplane.fill") }
            .buttonStyle(PrimaryButtonStyle())
          Button { Task { await toggleFollow() } } label: {
            Text(following ? "Following" : "Follow").font(.body.weight(.semibold)).frame(maxWidth: .infinity, minHeight: 50)
              .foregroundStyle(p.text)
              .background(p.surface2, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
          }
          .buttonStyle(.plain)
          .sensoryFeedback(.selection, trigger: following)
        }
        .disabled(busy)
      }
    }
  }

  private func load() async {
    guard let me = session.userId else { return }
    do {
      profile = try await API.profile(id)
      let posts = try await API.posts(by: id)
      await feed.show(posts, me: me)
      if !isMe { following = await API.isFollowing(id, me: me) }
    } catch { self.error = friendly(error) }
  }

  private func toggleFollow() async {
    guard let me = session.userId else { return }
    let on = !following
    following = on
    do { try await API.setFollow(id, on, me: me) } catch { following = !on; self.error = friendly(error) }
  }

  // Opens your conversation with them (new ones they haven't accepted land in their Requests).
  private func message() async {
    guard let me = session.userId, let u = profile else { return }
    busy = true; error = nil
    defer { busy = false }
    do {
      let cid = try await API.startConversation(with: id)
      let c = try await API.conversation(cid)
      thread = InboxItem(id: cid, otherId: id, name: u.name, headline: u.headline, preview: c.lastBody, at: c.lastMessageAt,
                         unread: false, isRequestToMe: c.status == "request" && c.startedBy != me, status: c.status, startedByMe: c.startedBy == me)
    } catch { self.error = friendly(error) }
  }
}
