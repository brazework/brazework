import SwiftUI

struct PostDetailView: View {
  let post: Post
  let feed: FeedStore
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @State private var comments: [Comment]?
  @State private var draft = ""
  @State private var sending = false
  @State private var error: String?
  @FocusState private var focused: Bool
  @Environment(\.dismiss) private var dismiss
  @State private var reporting: ReportTarget?

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        PostCard(item: RankedPost(post: current, reason: "", score: 0), store: feed)
        Text(post.kind == "question" ? "Answers" : "Replies").font(.headline).foregroundStyle(p.text).padding(.top, 6)
        if comments == nil { ProgressView().frame(maxWidth: .infinity) }
        if comments?.isEmpty == true {
          Text(post.kind == "question" ? "No answers yet. Help them out." : "No replies yet.").font(.subheadline).foregroundStyle(p.muted)
        }
        ForEach(comments ?? []) { c in
          HStack(alignment: .top, spacing: 10) {
            NavigationLink(value: PersonRoute(id: c.authorId)) { Avatar(first: c.authorFirst, last: c.authorLast, size: 32) }
            VStack(alignment: .leading, spacing: 3) {
              HStack(spacing: 6) {
                Text(c.authorName).font(.subheadline.weight(.semibold)).foregroundStyle(p.text)
                Text(timeAgo(c.createdAt)).font(.caption).foregroundStyle(p.faint)
              }
              Text(c.body).font(.subheadline).foregroundStyle(p.text2).fixedSize(horizontal: false, vertical: true)
            }
          }
          .padding(12)
          .frame(maxWidth: .infinity, alignment: .leading)
          .background(p.surface2.opacity(0.6), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
          .contextMenu {
            Button("Copy", systemImage: "doc.on.doc") { UIPasteboard.general.string = c.body }
            if c.authorId != session.userId { Button("Report reply", systemImage: "flag") { reporting = ReportTarget(kind: .comment, id: c.id, title: "Report reply") } }
          }
        }
      }
      .padding(16)
    }
    .background(p.bg)
    .navigationTitle(post.kind == "question" ? "Question" : "Post")
    .navigationBarTitleDisplayMode(.inline)
    .safeAreaInset(edge: .bottom) { composer }
    .task { await load() }
    .sheet(item: $reporting) { ReportSheet(kind: $0.kind, targetId: $0.id, title: $0.title) }
    .onChange(of: feed.items.contains { $0.id == post.id }) { _, stillThere in if !stillThere && deletedHere { dismiss() } }
  }

  // Deleted from this screen (not just absent from a list that never had it).
  private var deletedHere: Bool { feed.deleted.contains(post.id) }

  private var current: Post { feed.items.first { $0.id == post.id }?.post ?? post }

  private var composer: some View {
    VStack(spacing: 6) {
      if let error { Text(error).font(.caption).foregroundStyle(p.danger).frame(maxWidth: .infinity, alignment: .leading) }
      HStack(alignment: .bottom, spacing: 8) {
        TextField(post.kind == "question" ? "Write an answer" : "Write a reply", text: $draft, axis: .vertical)
          .lineLimit(1...5)
          .focused($focused)
          .padding(.horizontal, 14).padding(.vertical, 10)
          .background(p.surface2, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        Button { Task { await send() } } label: {
          Image(systemName: "arrow.up").font(.body.weight(.bold)).foregroundStyle(p.onAccent).frame(width: 40, height: 40).background(p.accent, in: Circle())
        }
        .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || sending)
        .accessibilityLabel("Send")
      }
    }
    .padding(.horizontal, 12).padding(.vertical, 8)
    .background(.bar)
  }

  private func load() async {
    do {
      comments = try await API.comments(post.id)
    } catch { comments = []; self.error = friendly(error) }
  }

  private func send() async {
    let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty, text.count <= 1000 else { error = "Replies can be up to 1,000 characters."; return }
    sending = true; error = nil
    defer { sending = false }
    do {
      try await API.addComment(post.id, body: text)
      draft = ""; focused = false
      await load()
      if let mine = comments?.last(where: { $0.authorId == session.userId }) { feed.addedReply(mine) } else { feed.bumpComments(post.id) }
    } catch { self.error = friendly(error) }
  }
}

// Opens a post by id (from an alert or a link).
struct PostLoader: View {
  let id: String
  @State private var feed = FeedStore()
  @State private var post: Post?
  @State private var failed = false
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  var body: some View {
    Group {
      if let post { PostDetailView(post: post, feed: feed) }
      else if failed { EmptyState(icon: "eye.slash", title: "Post unavailable", message: "It was deleted, or it's in a club you're not in.") }
      else { ProgressView() }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(p.bg)
    .task {
      do {
        let p = try await API.post(id)
        if let me = session.userId { await feed.show([p], me: me) }
        post = p
      } catch { failed = true }
    }
  }
}
