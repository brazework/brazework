import Foundation
import Observation

// A thread's reactions: loaded with its messages, toggled optimistically, rolled back if refused.
@MainActor @Observable
final class ReactionsModel {
  let kind: String // "dm" or "group"
  private(set) var list: [Reaction] = []
  var error: String?

  init(kind: String) { self.kind = kind }

  func load(_ messageIds: [String]) async { list = await API.reactions(kind, messageIds: messageIds) }

  func on(_ messageId: String) -> [Reaction] { list.filter { $0.messageId == messageId } }

  func toggle(_ messageId: String, emoji: String, me: UUID) async {
    let mine = Reaction(messageId: messageId, userId: me, emoji: emoji)
    let on = !list.contains(mine)
    if on { list.append(mine) } else { list.removeAll { $0 == mine } }
    do { try await API.setReaction(kind, messageId: messageId, emoji: emoji, on: on, me: me) }
    catch {
      if on { list.removeAll { $0 == mine } } else { list.append(mine) }
      self.error = friendly(error)
    }
  }
}
