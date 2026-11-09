import Foundation
import Observation
import Supabase

// Who's signed in, their profile, and the unread badges. One per app.
@MainActor @Observable
final class Session {
  enum State: Equatable { case loading, signedOut, signedIn }
  var state: State = .loading
  var userId: UUID?
  var profile: Profile?
  var unreadMessages = 0
  var unreadAlerts = 0

  static let profileColumns = "id, first_name, last_name, headline, field, bio, interests, account_type, onboarded, avatar_path"

  func start() async {
    for await (event, session) in supabase.auth.authStateChanges {
      switch event {
      case .initialSession, .signedIn, .tokenRefreshed, .userUpdated:
        if let session, !session.isExpired {
          if userId != session.user.id || state != .signedIn {
            userId = session.user.id
            await loadProfile()
            state = .signedIn
            await refreshBadges()
          }
        } else if event == .initialSession {
          #if DEBUG
          if await debugSignIn() { continue }
          #endif
          state = .signedOut
        }
      case .signedOut:
        userId = nil; profile = nil; unreadMessages = 0; unreadAlerts = 0
        state = .signedOut
      default: break
      }
    }
  }

  func signIn(email: String, password: String) async throws {
    try await supabase.auth.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
  }

  func signOut() async { try? await supabase.auth.signOut() }

  func loadProfile() async {
    guard let userId else { return }
    profile = try? await supabase.from("profiles").select(Self.profileColumns).eq("id", value: userId).single().execute().value
  }

  // Unread messages (conversations with something newer than your last read) and alerts.
  func refreshBadges() async {
    guard let me = userId else { return }
    async let convs: [Conversation] = (try? await supabase.from("conversations").select().or("user_a.eq.\(me),user_b.eq.\(me)").order("last_message_at", ascending: false).limit(100).execute().value) ?? []
    async let reads: [ConversationRead] = (try? await supabase.from("conversation_reads").select("conversation_id, read_at").eq("user_id", value: me).execute().value) ?? []
    async let alerts: Int = (try? await supabase.from("notifications").select("id", head: true, count: .exact).eq("user_id", value: me).eq("read", value: false).execute().count) ?? 0
    let readAt = Dictionary((await reads).map { ($0.conversationId, $0.readAt) }, uniquingKeysWith: max)
    unreadMessages = (await convs).filter { c in
      guard let at = c.lastMessageAt, c.lastSender != me else { return false }
      return at > (readAt[c.id] ?? .distantPast)
    }.count
    unreadAlerts = await alerts
  }

  #if DEBUG
  // For automated screenshots and UI tests: FORGE_TEST_EMAIL / FORGE_TEST_PASSWORD sign in on launch.
  private func debugSignIn() async -> Bool {
    let env = ProcessInfo.processInfo.environment
    guard let email = env["FORGE_TEST_EMAIL"], let password = env["FORGE_TEST_PASSWORD"] else { return false }
    return (try? await signIn(email: email, password: password)) != nil
  }
  #endif
}
