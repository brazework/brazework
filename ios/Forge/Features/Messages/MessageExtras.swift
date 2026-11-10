import SwiftUI

// Reactions, replies and unsend for direct messages and group chats, as on the web.

// Reaction chips under a message: one per emoji with a count; yours is highlighted; tap to toggle.
struct ReactionChips: View {
  let list: [Reaction]
  let me: UUID?
  let mine: Bool
  let onToggle: (String) -> Void
  @Environment(\.palette) private var p

  var body: some View {
    let groups = ChatExtras.reactions.compactMap { e -> (String, Int, Bool)? in
      let n = list.filter { $0.emoji == e }.count
      return n > 0 ? (e, n, list.contains { $0.emoji == e && $0.userId == me }) : nil
    }
    if !groups.isEmpty {
      HStack(spacing: 4) {
        ForEach(groups, id: \.0) { e, n, byMe in
          Button { onToggle(e) } label: {
            Text("\(e) \(n)").font(.caption.monospacedDigit()).foregroundStyle(p.text2)
              .padding(.horizontal, 8).padding(.vertical, 3)
              .background(byMe ? p.accent.opacity(0.18) : p.surface, in: Capsule())
              .overlay(Capsule().strokeBorder(byMe ? p.accent : p.border, lineWidth: 1))
          }
          .buttonStyle(.plain)
          .accessibilityLabel("\(e) \(n)\(byMe ? ", including you" : "")")
        }
      }
      .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
    }
  }
}

// The quoted message at the top of a reply.
struct ReplyQuote: View {
  let name: String?
  let text: String?
  let mine: Bool
  @Environment(\.palette) private var p
  var body: some View {
    HStack(spacing: 6) {
      Rectangle().fill(mine ? p.onAccent.opacity(0.5) : p.faint).frame(width: 2)
      VStack(alignment: .leading, spacing: 1) {
        if let text {
          Text(name ?? "").font(.caption.weight(.semibold))
          Text(text).font(.caption).lineLimit(2)
        } else {
          Text("Original message was removed").font(.caption).italic()
        }
      }
      .foregroundStyle(mine ? p.onAccent.opacity(0.85) : p.muted)
    }
    .fixedSize(horizontal: false, vertical: true)
  }
}

// "Replying to …" above the composer.
struct ReplyBar: View {
  let name: String
  let text: String
  let onCancel: () -> Void
  @Environment(\.palette) private var p
  var body: some View {
    HStack(alignment: .top, spacing: 8) {
      Image(systemName: "arrowshape.turn.up.left").font(.caption).foregroundStyle(p.faint).padding(.top, 2)
      VStack(alignment: .leading, spacing: 1) {
        Text("Replying to \(name)").font(.caption.weight(.semibold)).foregroundStyle(p.text)
        Text(text).font(.caption).foregroundStyle(p.muted).lineLimit(1)
      }
      Spacer()
      Button(action: onCancel) { Image(systemName: "xmark.circle.fill").foregroundStyle(p.faint) }.accessibilityLabel("Cancel reply")
    }
    .padding(10)
    .background(p.surface2.opacity(0.7), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
  }
}

// Long-press menu on a message: react, reply, copy, and unsend/delete your own.
struct MessageMenu: View {
  let text: String
  let onReact: (String) -> Void
  let onReply: () -> Void
  var removeLabel: String? = nil
  var onRemove: (() -> Void)? = nil

  var body: some View {
    ControlGroup {
      ForEach(ChatExtras.reactions.prefix(4), id: \.self) { e in Button(e) { onReact(e) } }
    }
    .controlGroupStyle(.compactMenu)
    Menu("More reactions", systemImage: "face.smiling") {
      ForEach(ChatExtras.reactions.dropFirst(4), id: \.self) { e in Button(e) { onReact(e) } }
    }
    Button("Reply", systemImage: "arrowshape.turn.up.left", action: onReply)
    Button("Copy", systemImage: "doc.on.doc") { UIPasteboard.general.string = text }
    if let removeLabel, let onRemove { Button(removeLabel, systemImage: "arrow.uturn.backward", role: .destructive, action: onRemove) }
  }
}
