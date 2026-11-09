import SwiftUI

struct PostCard: View {
  let item: RankedPost
  var liked: Bool
  var saved: Bool
  var onLike: () -> Void
  var onSave: () -> Void
  @Environment(\.palette) private var p
  private var post: Post { item.post }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if !item.reason.isEmpty {
        Label(item.reason, systemImage: "sparkles").font(.caption).foregroundStyle(p.faint).labelStyle(.titleAndIcon)
      }
      HStack(spacing: 10) {
        Avatar(first: post.authorFirst, last: post.authorLast, path: post.avatarPath, size: 40)
        VStack(alignment: .leading, spacing: 1) {
          HStack(spacing: 6) {
            Text(post.authorName.isEmpty ? "Forge member" : post.authorName).font(.subheadline.weight(.semibold)).foregroundStyle(p.text).lineLimit(1)
            Text("· \(timeAgo(post.createdAt))").font(.caption).foregroundStyle(p.faint)
          }
          let club = post.communityName ?? ""
          // The club, unless the headline already names it.
          let sub = [post.authorHeadline, post.authorHeadline.localizedCaseInsensitiveContains(club) ? "" : club].filter { !$0.isEmpty }.joined(separator: " · ")
          if !sub.isEmpty { Text(sub).font(.caption).foregroundStyle(p.muted).lineLimit(1) }
        }
        Spacer(minLength: 0)
        KindLabel(kind: post.kind)
      }
      Text(post.body).font(.body).foregroundStyle(p.text2).fixedSize(horizontal: false, vertical: true).textSelection(.enabled)
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
