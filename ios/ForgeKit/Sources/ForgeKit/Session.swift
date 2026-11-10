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

  nonisolated static let profileColumns = "id, first_name, last_name, headline, field, bio, interests, account_type, onboarded, avatar_path"

  func start() async {
    #if DEBUG
    await debugFreshSignIn()
    #endif
    for await (event, session) in supabase.auth.authStateChanges {
      switch event {
      case .initialSession, .signedIn, .tokenRefreshed, .userUpdated:
        if let session, !session.isExpired {
          if userId != session.user.id || state != .signedIn {
            userId = session.user.id
            // An account that no longer exists (deleted, or a reset test database) signs out.
            if case .missing = await loadProfile() {
              await signOut()
              state = .signedOut
              continue
            }
            state = .signedIn
            await refreshBadges()
          }
        } else if event == .initialSession {
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

  // Signs out here even when the server can't be told (offline, or the account is gone).
  func signOut() async {
    do { try await supabase.auth.signOut() } catch { try? await supabase.auth.signOut(scope: .local) }
  }

  enum ProfileLoad { case loaded, missing, failed }
  @discardableResult
  func loadProfile() async -> ProfileLoad {
    guard let userId else { return .failed }
    do {
      let rows: [Profile] = try await supabase.from("profiles").select(Self.profileColumns).eq("id", value: userId).limit(1).execute().value
      profile = rows.first
      return rows.isEmpty ? .missing : .loaded
    } catch { return .failed }
  }

  // Unread messages (conversations with something newer than your last read) and alerts.
  func refreshBadges() async {
    guard let me = userId else { return }
    async let convs: [Conversation] = (try? await supabase.from("conversations").select().or("user_a.eq.\(me),user_b.eq.\(me)").order("last_message_at", ascending: false).limit(100).execute().value) ?? []
    async let reads: [ConversationRead] = (try? await supabase.from("conversation_reads").select("conversation_id, read_at").eq("user_id", value: me).execute().value) ?? []
    async let alerts: Int = (try? await supabase.from("notifications").select("id", head: true, count: .exact).eq("user_id", value: me).eq("read", value: false).execute().count) ?? 0
    async let chats = API.unreadChats()
    let readAt = Dictionary((await reads).map { ($0.conversationId, $0.readAt) }, uniquingKeysWith: max)
    unreadMessages = (await convs).filter { c in
      guard let at = c.lastMessageAt, c.lastSender != me else { return false }
      return at > (readAt[c.id] ?? .distantPast)
    }.count + (await chats)
    unreadAlerts = await alerts
  }

  #if DEBUG
  // For automated screenshots and tests: with FORGE_TEST_EMAIL / FORGE_TEST_PASSWORD set, start from
  // a clean sign-in as that member (whatever session was stored, even one from a reset database).
  private func debugFreshSignIn() async {
    let env = ProcessInfo.processInfo.environment
    if env["FORGE_TEST_SIGNOUT"] != nil { try? await supabase.auth.signOut(scope: .local); return }
    guard let email = env["FORGE_TEST_EMAIL"], let password = env["FORGE_TEST_PASSWORD"] else { return }
    try? await supabase.auth.signOut(scope: .local)
    _ = try? await signIn(email: email, password: password)
  }
  #endif
}
