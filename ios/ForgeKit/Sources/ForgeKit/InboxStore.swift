import Foundation
import Observation
import Supabase

// Your conversations, newest first; empty ones you didn't start are left out (as on the web).
@MainActor @Observable
final class InboxStore {
  var items: [InboxItem]?
  var error: String?

  func load(me: UUID) async {
    do {
      async let c: [Conversation] = supabase.from("conversations").select().or("user_a.eq.\(me),user_b.eq.\(me)").order("last_message_at", ascending: false).limit(200).execute().value
      async let r: [ConversationRead] = supabase.from("conversation_reads").select("conversation_id, read_at").eq("user_id", value: me).execute().value
      let reads = Dictionary(((try? await r) ?? []).map { ($0.conversationId, $0.readAt) }, uniquingKeysWith: max)
      items = (try await c).compactMap { conv in
        let (oid, person) = conv.other(of: me)
        let mineStarted = conv.startedBy == me
        guard conv.lastMessageAt != nil || mineStarted else { return nil }
        let unread = conv.lastMessageAt.map { $0 > (reads[conv.id] ?? .distantPast) && conv.lastSender != me } ?? false
        return InboxItem(id: conv.id, otherId: oid, name: "\(person.firstName ?? "") \(person.lastName ?? "")".trimmingCharacters(in: .whitespaces),
                         headline: person.headline ?? "", preview: (conv.lastSender == me ? "You: " : "") + conv.lastBody, at: conv.lastMessageAt,
                         unread: unread, isRequestToMe: conv.status == "request" && !mineStarted, status: conv.status, startedByMe: mineStarted)
      }
    } catch { self.error = friendly(error); if items == nil { items = [] } }
  }
}
