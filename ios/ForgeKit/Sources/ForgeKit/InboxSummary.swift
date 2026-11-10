import Foundation

// Direct messages and group chats in one list, newest first: the feed's messages card.
struct InboxEntry: Identifiable, Hashable, Sendable {
  enum Target: Hashable, Sendable { case dm(InboxItem), chat(GroupChat) }
  let target: Target
  var id: String { switch target { case .dm(let d): "dm:\(d.id)"; case .chat(let c): "chat:\(c.id)" } }
  var title: String { switch target { case .dm(let d): d.name.isEmpty ? "Forge member" : d.name; case .chat(let c): c.title } }
  var preview: String { switch target { case .dm(let d): d.preview.isEmpty ? "No messages yet" : d.preview; case .chat(let c): c.preview } }
  var at: Date? { switch target { case .dm(let d): d.at; case .chat(let c): c.lastAt } }
  var unread: Bool { switch target { case .dm(let d): d.unread; case .chat(let c): c.unread } }
  var isRequest: Bool { if case .dm(let d) = target { d.isRequestToMe } else { false } }
}

enum InboxSummary {
  @MainActor
  static func load(me: UUID) async -> [InboxEntry] {
    let dms = InboxStore()
    async let chats = (try? await API.myChats()) ?? []
    await dms.load(me: me)
    let all = (dms.items ?? []).map { InboxEntry(target: .dm($0)) } + (await chats).map { InboxEntry(target: .chat($0)) }
    return all.sorted { ($0.at ?? .distantPast) > ($1.at ?? .distantPast) }
  }
}
