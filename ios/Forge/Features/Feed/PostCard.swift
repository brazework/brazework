import SwiftUI

struct PostCard: View {
  let item: RankedPost
  let store: FeedStore
  @Environment(\.palette) private var p
  @Environment(Session.self) private var session
  @State private var editing = false
  @State private var confirmDelete = false
  @State private var error: String?
  private var post: Post { item.post }
  private var liked: Bool { store.liked.contains(item.id) }
  private var saved: Bool { store.saved.contains(item.id) }
  private var mine: Bool { post.authorId == session.userId }
  private func onLike() { if let me = session.userId { Task { await store.toggleLike(post, me: me) } } }
  private func onSave() { if let me = session.userId { Task { await store.toggleSave(post, me: me) } } }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if !item.reason.isEmpty {
        Label(item.reason, systemImage: "sparkles").font(.caption).foregroundStyle(p.faint).labelStyle(.titleAndIcon)
      }
      HStack(spacing: 10) {
        NavigationLink(value: PersonRoute(id: post.authorId)) {
          HStack(spacing: 10) {
        Avatar(first: post.authorFirst, last: post.authorLast, path: post.avatarPath, size: 40)
        VStack(alignment: .leading, spacing: 1) {
          HStack(spacing: 6) {
            Text(post.authorName.isEmpty ? "Forge member" : post.authorName).font(.subheadline.weight(.semibold)).foregroundStyle(p.text).lineLimit(1)
            Text("· \(timeAgo(post.createdAt))\(post.editedAt != nil ? " · edited" : "")").font(.caption).foregroundStyle(p.faint)
          }
          let club = post.communityName ?? ""
          // The club, unless the headline already names it.
          let sub = [post.authorHeadline, post.authorHeadline.localizedCaseInsensitiveContains(club) ? "" : club].filter { !$0.isEmpty }.joined(separator: " · ")
          if !sub.isEmpty { Text(sub).font(.caption).foregroundStyle(p.muted).lineLimit(1) }
        }
          }
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens their profile")
        Spacer(minLength: 0)
        KindLabel(kind: post.kind)
        if mine {
          Menu {
            Button("Edit", systemImage: "pencil") { editing = true }
            Button("Delete", systemImage: "trash", role: .destructive) { confirmDelete = true }
          } label: {
            Image(systemName: "ellipsis").font(.subheadline.weight(.semibold)).foregroundStyle(p.muted).frame(width: 32, height: 32).contentShape(Rectangle())
          }
          .accessibilityLabel("Post options")
        }
      }
      if let error { Text(error).font(.caption).foregroundStyle(p.danger) }
      MentionText(text: post.body, mentions: post.mentions).font(.body).foregroundStyle(p.text2).fixedSize(horizontal: false, vertical: true)
      if let media = post.media, !media.isEmpty { MediaView(items: media, postId: post.id) }
      if !post.tags.isEmpty {
        HStack(spacing: 6) { ForEach(post.tags, id: \.self) { Text("#\($0)").font(.caption).foregroundStyle(p.muted) } }
      }
      HStack(spacing: 4) {
        action(liked ? "heart.fill" : "heart", post.likeCount, tint: liked ? Color(hex: 0xF43F5E) : p.muted, label: liked ? "Unlike" : "Like", run: onLike)
          .sensoryFeedback(.impact(weight: .light), trigger: liked)
        NavigationLink(value: post) {
          Label { Text(post.commentCount > 0 ? "\(post.commentCount)" : (post.kind == "question" ? "Answer" : "Reply")).monospacedDigit() } icon: { Image(systemName: "bubble.left") }
            .font(.subheadline).foregroundStyle(p.muted).padding(.horizontal, 10).frame(minHeight: 44)
        }
        .accessibilityLabel(post.kind == "question" ? "Answer" : "Reply")
        Spacer()
        if post.kind == "question" && post.commentCount == 0 {
          Text("Unanswered").font(.caption2.weight(.semibold)).foregroundStyle(Color(hex: 0xF59E0B)).padding(.horizontal, 8).padding(.vertical, 3).background(Color(hex: 0xF59E0B).opacity(0.12), in: Capsule())
        }
        action(saved ? "bookmark.fill" : "bookmark", nil, tint: saved ? p.accent : p.muted, label: saved ? "Unsave" : "Save", run: onSave)
        ShareLink(item: Env.web("post/\(post.id)")) { Image(systemName: "square.and.arrow.up").font(.subheadline).foregroundStyle(p.muted).frame(width: 44, height: 44) }
          .accessibilityLabel("Share")
      }
      .padding(.top, -4)
    }
    .padding(16)
    .background(p.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(p.border, lineWidth: 0.5))
    .sheet(isPresented: $editing) { EditPostView(post: post) { store.edited(post.id, body: $0) }.presentationDetents([.medium, .large]) }
    .confirmationDialog("Delete this post?", isPresented: $confirmDelete, titleVisibility: .visible) {
      Button("Delete", role: .destructive) { Task { await delete() } }
    } message: { Text("Its likes, replies and saves go with it. This can't be undone.") }
  }

  private func delete() async {
    error = nil
    do { try await API.deletePost(post.id); withAnimation(.snappy) { store.removed(post.id) } }
    catch { self.error = friendly(error) }
  }

  private func action(_ icon: String, _ count: Int?, tint: Color, label: String, run: @escaping () -> Void) -> some View {
    Button(action: run) {
      HStack(spacing: 5) {
        Image(systemName: icon).contentTransition(.symbolEffect(.replace))
        if let count, count > 0 { Text("\(count)").monospacedDigit().contentTransition(.numericText()) }
      }
      .font(.subheadline).foregroundStyle(tint).padding(.horizontal, 10).frame(minHeight: 44)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(label)
  }
}

// Photos page sideways; a video plays as you scroll.
struct MediaView: View {
  let items: [MediaItem]
  let postId: String
  @Environment(\.palette) private var p

  var body: some View {
    if let v = items.first(where: \.isVideo) {
      FeedVideo(item: v, playerId: "\(postId):\(v.path)")
    } else if items.count == 1, let i = items.first {
      photo(i).aspectRatio(min(max(i.aspect ?? 4 / 3, 0.75), 2), contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    } else {
      TabView { ForEach(items, id: \.path) { photo($0) } }
        .tabViewStyle(.page)
        .aspectRatio(4 / 3, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
  }

  private func photo(_ i: MediaItem) -> some View {
    AsyncImage(url: mediaURL(i.path)) { phase in
      switch phase {
      case .success(let img): img.resizable().scaledToFill()
      case .failure: ZStack { p.surface2; Image(systemName: "photo").foregroundStyle(p.faint) }
      default: p.surface2
      }
    }
    .frame(maxWidth: .infinity)
    .clipped()
    .accessibilityLabel(i.alt ?? "Photo")
  }
}

// Edit your post's text. Photos, video and mentions stay as they were posted (as on the web).
struct EditPostView: View {
  let post: Post
  var onSaved: (String) -> Void
  @Environment(\.dismiss) private var dismiss
  @Environment(\.palette) private var p
  @Environment(Session.self) private var session
  @State private var text: String
  @State private var saving = false
  @State private var error: String?

  init(post: Post, onSaved: @escaping (String) -> Void) { self.post = post; self.onSaved = onSaved; _text = State(initialValue: post.body) }
  private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

  var body: some View {
    NavigationStack {
      VStack(alignment: .leading, spacing: 12) {
        TextField("Your post", text: $text, axis: .vertical).lineLimit(4...16).font(.body)
        if let error { Text(error).font(.footnote).foregroundStyle(p.danger) }
        Spacer()
        HStack { Spacer(); Text("\(3000 - text.count)").font(.caption.monospacedDigit()).foregroundStyle(text.count > 3000 ? p.danger : p.faint) }
      }
      .padding(16)
      .background(p.bg)
      .navigationTitle("Edit post")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) {
          Button { Task { await save() } } label: { if saving { ProgressView() } else { Text("Save").bold() } }
            .disabled(trimmed.isEmpty || trimmed == post.body || text.count > 3000 || saving)
        }
      }
    }
  }

  private func save() async {
    guard let me = session.userId else { return }
    saving = true; error = nil
    defer { saving = false }
    do { try await API.editPost(post.id, body: trimmed, me: me); onSaved(trimmed); dismiss() }
    catch { self.error = friendly(error) }
  }
}
