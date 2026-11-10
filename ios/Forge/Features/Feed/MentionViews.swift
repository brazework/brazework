import SwiftUI

// Post text with @mentions as links; tapping one opens their profile.
struct MentionText: View {
  let text: String
  let mentions: [Mention]?
  @Environment(\.palette) private var p
  @State private var person: SheetPerson?

  struct SheetPerson: Identifiable { let id: UUID }

  var body: some View {
    Text(attributed)
      .environment(\.openURL, OpenURLAction { url in
        if url.scheme == "forge-mention", let id = UUID(uuidString: url.host() ?? "") { person = SheetPerson(id: id); return .handled }
        return .systemAction
      })
      .sheet(item: $person) { who in NavigationStack { ProfileView(id: who.id) } }
  }

  private var attributed: AttributedString {
    var out = AttributedString()
    for part in Mentions.parts(text, mentions) {
      switch part {
      case .text(let t): out += AttributedString(t)
      case .mention(let m):
        var a = AttributedString("@\(m.name)")
        a.link = URL(string: "forge-mention://\(m.id.uuidString.lowercased())")
        a.foregroundColor = p.accent
        a.font = .body.weight(.semibold)
        out += a
      }
    }
    return out
  }
}

// Suggestions while typing "@…" in the composer: people you follow first.
struct MentionSuggestions: View {
  let people: [MentionPerson]
  let onPick: (MentionPerson) -> Void
  @Environment(\.palette) private var p

  var body: some View {
    VStack(spacing: 0) {
      ForEach(people) { u in
        Button { onPick(u) } label: {
          HStack(spacing: 10) {
            Avatar(first: u.first, last: u.last, path: u.avatarPath, size: 32)
            VStack(alignment: .leading, spacing: 1) {
              Text(u.name).font(.subheadline.weight(.semibold)).foregroundStyle(p.text)
              if !u.headline.isEmpty { Text(u.headline).font(.caption).foregroundStyle(p.muted).lineLimit(1) }
            }
            Spacer()
            if u.follows { Text("Following").font(.caption2).foregroundStyle(p.faint) }
          }
          .padding(.horizontal, 12).padding(.vertical, 8)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Mention \(u.name)")
        if u.id != people.last?.id { Divider().padding(.leading, 54) }
      }
    }
    .background(p.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(p.border, lineWidth: 0.5))
  }
}
