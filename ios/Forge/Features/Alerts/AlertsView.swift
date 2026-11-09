import SwiftUI

enum AlertTarget: Hashable { case post(String), person(UUID), nothing }

struct AlertsView: View {
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @State private var list: [ForgeNotification]?

  var body: some View {
    NavigationStack {
      List(list ?? []) { n in
        NavigationLink(value: n.postId.map { AlertTarget.post($0) } ?? n.actorId.map { AlertTarget.person($0) } ?? .nothing) {
        HStack(alignment: .top, spacing: 12) {
          ZStack(alignment: .bottomTrailing) {
            Avatar(first: n.actorFirst, last: n.actorLast, size: 44)
            Image(systemName: icon(n.kind)).font(.system(size: 10, weight: .bold)).foregroundStyle(.white)
              .frame(width: 20, height: 20).background(color(n.kind), in: Circle()).overlay(Circle().strokeBorder(p.bg, lineWidth: 2)).offset(x: 4, y: 4)
          }
          VStack(alignment: .leading, spacing: 3) {
            (Text(n.actorName.isEmpty ? "Someone" : n.actorName).bold() + Text(" \(n.sentence)")).font(.subheadline).foregroundStyle(p.text)
            if !n.snippet.isEmpty { Text(n.snippet).font(.footnote).foregroundStyle(p.muted).lineLimit(2) }
            Text(timeAgo(n.createdAt)).font(.caption).foregroundStyle(p.faint)
          }
          Spacer(minLength: 0)
          if !n.read { Circle().fill(p.accent).frame(width: 8, height: 8).padding(.top, 6).accessibilityLabel("New") }
        }
        .padding(.vertical, 4)
        }
        .listRowBackground(n.read ? Color.clear : p.surface2.opacity(0.5))
      }
      .listStyle(.plain)
      .scrollContentBackground(.hidden)
      .background(p.bg)
      .overlay {
        if list == nil { ProgressView() }
        else if list?.isEmpty == true { EmptyState(icon: "bell", title: "You're all caught up", message: "Likes, replies, mentions and club news show up here.") }
      }
      .navigationTitle("Alerts")
      .navigationDestination(for: AlertTarget.self) { t in
        switch t {
        case .post(let id): PostLoader(id: id)
        case .person(let id): ProfileView(id: id)
        case .nothing: EmptyView()
        }
      }
      .navigationDestination(for: PersonRoute.self) { ProfileView(id: $0.id) }
      .navigationDestination(for: InboxItem.self) { ThreadView(item: $0) }
      .refreshable { await load() }
      .task {
        await load()
        // Seen once they've been on screen a moment, like the web.
        try? await Task.sleep(for: .seconds(1.5))
        await API.markAlertsRead()
        await session.refreshBadges()
      }
    }
  }

  private func load() async {
    guard let me = session.userId else { return }
    list = (try? await API.notifications(me: me)) ?? []
  }

  private func icon(_ kind: String) -> String {
    switch kind {
    case "like": "heart.fill"
    case "comment": "bubble.left.fill"
    case "mention": "at"
    case "follow", "connect_request", "connect_accepted": "person.fill"
    case "milestone_verified", "milestone_request", "milestone_declined": "checkmark.seal.fill"
    default: "person.3.fill"
    }
  }
  private func color(_ kind: String) -> Color {
    switch kind {
    case "like": Color(hex: 0xF43F5E)
    case "mention", "comment": Color(hex: 0x6366F1)
    case "milestone_verified": Color(hex: 0x10B981)
    default: Color(hex: 0x71717A)
    }
  }
}
