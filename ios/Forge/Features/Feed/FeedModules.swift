import SwiftUI

// The pieces around the posts in the feed: a place to post, your messages, filters, and the
// people, clubs and events worth finding (what makes a network grow).

// "What are you building?" with one-tap starts for a photo, a question or a result.
struct ComposerPrompt: View {
  var onCompose: (_ kind: String, _ photo: Bool) -> Void
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p

  var body: some View {
    VStack(spacing: 12) {
      Button { onCompose("update", false) } label: {
        HStack(spacing: 10) {
          Avatar(first: session.profile?.firstName ?? "", last: session.profile?.lastName ?? "", path: session.profile?.avatarPath, size: 36)
          Text("What are you building?").font(.subheadline).foregroundStyle(p.faint)
          Spacer()
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(p.surface2, in: Capsule())
      }
      .buttonStyle(PressStyle())
      HStack(spacing: 8) {
        quick("Photo", "photo.on.rectangle.angled", Color(hex: 0x6366F1)) { onCompose("update", true) }
        quick("Question", "questionmark.bubble", Color(hex: 0xF59E0B)) { onCompose("question", false) }
        quick("Result", "checkmark.seal", Color(hex: 0x10B981)) { onCompose("result", false) }
      }
    }
    .padding(14)
    .background(p.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(p.border, lineWidth: 0.5))
  }

  private func quick(_ title: String, _ icon: String, _ tint: Color, run: @escaping () -> Void) -> some View {
    Button(action: run) {
      Label(title, systemImage: icon).font(.footnote.weight(.semibold)).foregroundStyle(p.text2)
        .frame(maxWidth: .infinity, minHeight: 36)
        .background(tint.opacity(0.12), in: Capsule())
    }
    .buttonStyle(PressStyle())
    .tint(tint)
  }
}

// Your messages, inline and collapsible: unread first, tap one to open it. Remembers open/closed.
struct MessagesCard: View {
  let entries: [InboxEntry]?
  @AppStorage("forge-feed-messages-open") private var open = true
  @Environment(AppNav.self) private var nav
  @Environment(\.palette) private var p

  private var unread: Int { entries?.filter(\.unread).count ?? 0 }
  private var shown: [InboxEntry] {
    let list = entries ?? []
    return Array((list.filter(\.unread) + list.filter { !$0.unread }).prefix(4))
  }

  var body: some View {
    VStack(spacing: 0) {
      Button { withAnimation(.spring(response: 0.38, dampingFraction: 0.86)) { open.toggle() } } label: {
        HStack(spacing: 10) {
          Image(systemName: "bubble.left.and.bubble.right.fill").font(.subheadline).foregroundStyle(p.text2)
          Text("Messages").font(.subheadline.weight(.semibold)).foregroundStyle(p.text)
          if unread > 0 {
            Text("\(unread) new").font(.caption2.weight(.bold)).foregroundStyle(p.onAccent)
              .padding(.horizontal, 7).padding(.vertical, 2).background(p.accent, in: Capsule())
              .transition(.scale.combined(with: .opacity))
          }
          Spacer()
          if !open, !shown.isEmpty { faces }
          Image(systemName: "chevron.down").font(.caption.weight(.bold)).foregroundStyle(p.faint)
            .rotationEffect(.degrees(open ? 0 : -90))
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Messages, \(unread) unread")
      .accessibilityHint(open ? "Collapses your messages" : "Shows your messages")
      .sensoryFeedback(.selection, trigger: open)

      if open {
        VStack(spacing: 0) {
          if entries == nil { ProgressView().padding(14) }
          else if shown.isEmpty {
            Text("No conversations yet. Message someone from their profile, or open your club's chat.").font(.footnote).foregroundStyle(p.muted).padding(14).frame(maxWidth: .infinity, alignment: .leading)
          }
          ForEach(shown) { e in
            Divider().padding(.leading, 60)
            row(e)
          }
          Divider()
          Button { nav.tab = .messages } label: {
            HStack { Text("Open Messages").font(.footnote.weight(.semibold)); Image(systemName: "arrow.right").font(.caption.weight(.bold)) }
              .foregroundStyle(p.text2).frame(maxWidth: .infinity, minHeight: 40)
          }
          .buttonStyle(.plain)
        }
        .transition(.opacity.combined(with: .move(edge: .top)))
      }
    }
    .background(p.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(p.border, lineWidth: 0.5))
    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
  }

  // Up to 3 faces of who's waiting on you, when collapsed.
  private var faces: some View {
    HStack(spacing: -8) {
      ForEach(shown.prefix(3)) { e in icon(e, size: 24).overlay(Circle().strokeBorder(p.surface, lineWidth: 2)) }
    }
  }

  @ViewBuilder private func icon(_ e: InboxEntry, size: CGFloat) -> some View {
    switch e.target {
    case .dm(let d):
      let parts = d.name.split(separator: " ")
      Avatar(first: parts.first.map(String.init) ?? "", last: parts.dropFirst().first.map(String.init) ?? "", size: size)
    case .chat(let c):
      Image(systemName: c.kind == "event" ? "calendar" : "person.3.fill").font(.system(size: size * 0.4, weight: .semibold)).foregroundStyle(p.onAccent)
        .frame(width: size, height: size).background(p.gradient, in: Circle())
    }
  }

  @ViewBuilder private func row(_ e: InboxEntry) -> some View {
    let label = HStack(spacing: 12) {
      icon(e, size: 36)
      VStack(alignment: .leading, spacing: 2) {
        HStack {
          Text(e.title).font(.subheadline.weight(e.unread ? .bold : .semibold)).foregroundStyle(p.text).lineLimit(1)
          if e.isRequest { Text("Request").font(.caption2).foregroundStyle(p.muted).padding(.horizontal, 6).background(p.surface2, in: Capsule()) }
          Spacer()
          if let at = e.at { Text(timeAgo(at)).font(.caption2).foregroundStyle(p.faint) }
        }
        Text(e.preview).font(.footnote).foregroundStyle(e.unread ? p.text2 : p.muted).lineLimit(1)
      }
      if e.unread { Circle().fill(p.accent).frame(width: 8, height: 8) }
    }
    .padding(.horizontal, 14).padding(.vertical, 10)
    .contentShape(Rectangle())
    switch e.target {
    case .dm(let d): NavigationLink(value: d) { label }.buttonStyle(.plain)
    case .chat(let c): NavigationLink(value: ChatRoute(id: c.id, title: c.title, kind: c.kind, communityId: c.communityId)) { label }.buttonStyle(.plain)
    }
  }
}

// For you / Latest / Following, and what kind of posts.
struct FeedFilterBar: View {
  @Bindable var store: FeedStore
  @Environment(\.palette) private var p
  @Namespace private var tabs

  var body: some View {
    VStack(spacing: 10) {
      HStack(spacing: 4) {
        ForEach(FeedTab.allCases) { t in
          Button { withAnimation(.snappy) { store.tab = t } } label: {
            Text(t.rawValue).font(.subheadline.weight(store.tab == t ? .semibold : .regular))
              .foregroundStyle(store.tab == t ? p.onAccent : p.muted)
              .frame(maxWidth: .infinity, minHeight: 36)
              .background {
                if store.tab == t { Capsule().fill(p.accent).matchedGeometryEffect(id: "tab", in: tabs) }
              }
          }
          .buttonStyle(.plain)
          .accessibilityAddTraits(store.tab == t ? .isSelected : [])
        }
      }
      .padding(4)
      .background(p.surface2, in: Capsule())
      .sensoryFeedback(.selection, trigger: store.tab)
      ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 6) {
          ForEach(FeedFilter.allCases) { f in
            Button { withAnimation(.snappy) { store.filter = f } } label: { Chip(text: f.rawValue, selected: store.filter == f) }
              .buttonStyle(.plain)
              .accessibilityAddTraits(store.filter == f ? .isSelected : [])
          }
        }
      }
      .scrollClipDisabled()
    }
  }
}

// A titled horizontal strip of cards.
struct Strip<Content: View>: View {
  let title: String
  var action: (String, () -> Void)? = nil
  @ViewBuilder var content: Content
  @Environment(\.palette) private var p
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Text(title).font(.headline).foregroundStyle(p.text)
        Spacer()
        if let action { Button(action.0, action: action.1).font(.footnote.weight(.semibold)).foregroundStyle(p.muted) }
      }
      ScrollView(.horizontal, showsIndicators: false) {
        LazyHStack(spacing: 10) { content }.scrollTargetLayout()
      }
      .scrollTargetBehavior(.viewAligned)
      .scrollClipDisabled()
    }
    .padding(.vertical, 6)
  }
}

struct EventCard: View {
  let event: ForgeEvent
  let going: Bool
  @Environment(\.palette) private var p
  var body: some View {
    NavigationLink(value: event) {
      VStack(alignment: .leading, spacing: 10) {
        HStack(alignment: .top) {
          DateTile(date: event.startsAt, size: 44)
          Spacer()
          if going { Image(systemName: "checkmark.circle.fill").foregroundStyle(Color(hex: 0x10B981)).accessibilityLabel("Going") }
        }
        Text(event.title).font(.subheadline.weight(.semibold)).foregroundStyle(p.text).lineLimit(2, reservesSpace: true).multilineTextAlignment(.leading)
        Text(event.startsAt.formatted(.dateTime.weekday(.abbreviated).hour().minute())).font(.caption).foregroundStyle(p.text2)
        Text(event.host.isEmpty ? event.format : event.host).font(.caption).foregroundStyle(p.muted).lineLimit(1)
      }
      .padding(14)
      .frame(width: 190, alignment: .leading)
      .background(p.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(p.border, lineWidth: 0.5))
    }
    .buttonStyle(PressStyle())
  }
}

struct PersonCard: View {
  let person: Profile
  let shared: [String]
  @State private var following = false
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p

  var body: some View {
    VStack(spacing: 8) {
      NavigationLink(value: PersonRoute(id: person.id)) {
        VStack(spacing: 6) {
          Avatar(first: person.firstName, last: person.lastName, path: person.avatarPath, size: 56)
          Text(person.name).font(.subheadline.weight(.semibold)).foregroundStyle(p.text).lineLimit(1)
          Text(shared.first.map { "Into \($0)" } ?? (person.headline.isEmpty ? person.field : person.headline))
            .font(.caption).foregroundStyle(p.muted).lineLimit(2, reservesSpace: true).multilineTextAlignment(.center)
        }
      }
      .buttonStyle(.plain)
      Button { Task { await toggle() } } label: {
        Text(following ? "Following" : "Follow").font(.footnote.weight(.semibold))
          .foregroundStyle(following ? p.text : p.onAccent)
          .frame(maxWidth: .infinity, minHeight: 34)
          .background(following ? AnyShapeStyle(p.surface2) : AnyShapeStyle(p.accent), in: Capsule())
          .contentTransition(.interpolate)
      }
      .buttonStyle(PressStyle())
      .sensoryFeedback(.success, trigger: following) { _, new in new }
    }
    .padding(14)
    .frame(width: 160)
    .background(p.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(p.border, lineWidth: 0.5))
  }

  private func toggle() async {
    guard let me = session.userId else { return }
    let on = !following
    withAnimation(.snappy) { following = on }
    do { try await API.setFollow(person.id, on, me: me) } catch { withAnimation { following = !on } }
  }
}

struct ClubCard: View {
  let club: Club
  @Environment(\.palette) private var p
  var body: some View {
    NavigationLink(value: club) {
      VStack(alignment: .leading, spacing: 8) {
        ClubMark(name: club.name, size: 44)
        Text(club.name).font(.subheadline.weight(.semibold)).foregroundStyle(p.text).lineLimit(1)
        Text(club.about.isEmpty ? club.field : club.about).font(.caption).foregroundStyle(p.muted).lineLimit(2, reservesSpace: true).multilineTextAlignment(.leading)
        Text("\(club.memberCount) member\(club.memberCount == 1 ? "" : "s")").font(.caption2.weight(.medium)).foregroundStyle(p.faint)
      }
      .padding(14)
      .frame(width: 180, alignment: .leading)
      .background(p.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(p.border, lineWidth: 0.5))
    }
    .buttonStyle(PressStyle())
  }
}

// "3 new posts": floats at the top; tap to see them.
struct NewPostsPill: View {
  let count: Int
  let action: () -> Void
  @Environment(\.palette) private var p
  var body: some View {
    Button(action: action) {
      Label("\(count) new post\(count == 1 ? "" : "s")", systemImage: "arrow.up")
        .font(.footnote.weight(.semibold)).foregroundStyle(p.onAccent)
        .padding(.horizontal, 14).padding(.vertical, 9)
        .background(p.accent, in: Capsule())
        .shadow(color: .black.opacity(0.25), radius: 12, y: 6)
    }
    .buttonStyle(PressStyle())
    .sensoryFeedback(.impact(weight: .light), trigger: count)
  }
}

// A soft press: scales down a touch while held.
struct PressStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .scaleEffect(configuration.isPressed ? 0.97 : 1)
      .opacity(configuration.isPressed ? 0.9 : 1)
      .animation(.snappy(duration: 0.18), value: configuration.isPressed)
  }
}
