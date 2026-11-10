import Foundation
import Supabase

// Every read and write the app makes, in one place: the views call these, and ForgeKitTests run
// them against the local test stack. Same tables and rules as the web app (row-level security
// decides what each member can see and do).
enum MediaError: LocalizedError {
  case tooBig, unreadable
  var errorDescription: String? {
    switch self {
    case .tooBig: "Videos can be up to 50 MB. Trim it and try again."
    case .unreadable: "Couldn't read that file. Try another."
    }
  }
}

enum ExtrasError: LocalizedError {
  case tooLate
  var errorDescription: String? { "You can unsend a message for 15 minutes after sending it." }
}

enum PostError: LocalizedError {
  case notYours
  var errorDescription: String? { "You can only change your own posts." }
}

enum API {
  private struct PostRow: Encodable { let body: String; let kind: String; let tags: [String]; let media: [MediaItem]?; let mentions: [Mention]? }
  private struct CommentRow: Encodable { let postId: String; let body: String }
  private struct PostRef: Encodable { let postId: String }
  private struct MessageRow: Encodable { let conversationId: String; let body: String; let replyTo: String? }
  private struct ReactionRow: Encodable { let messageId: String; let emoji: String }
  private struct JoinRow: Encodable { let communityId: String; let uid: UUID; let role: String }
  private struct ClubRef: Encodable { let communityId: String }
  private struct EventRef: Encodable { let eventId: String }
  private struct FollowRow: Encodable { let target: UUID }
  private struct Role: Decodable { let role: String }
  private struct ChatRow: Encodable { let chatId: String; let body: String; let announcement: Bool; let replyTo: String? }
  private struct Membership: Decodable { let communities: Club? }

  // MARK: Posts
  // The database re-checks each mention (a real member, named in the text) and notifies those who
  // can see the post. Before mentions.sql, the post goes out without them.
  static func createPost(body: String, kind: String, media: [MediaItem] = [], mentions: [Mention] = []) async throws {
    let kept = Mentions.keep(body, mentions)
    do {
      try await supabase.from("posts").insert(PostRow(body: body, kind: kind, tags: [], media: media.isEmpty ? nil : media, mentions: kept.isEmpty ? nil : kept)).execute()
    } catch where !kept.isEmpty && "\(error)".contains("mentions") {
      try await supabase.from("posts").insert(PostRow(body: body, kind: kind, tags: [], media: media.isEmpty ? nil : media, mentions: nil)).execute()
    }
  }

  // Who you can @mention: people you follow first, then anyone on Forge whose name matches.
  static func mentionSuggestions(_ query: String, me: UUID) async -> [MentionPerson] {
    struct F: Decodable { let target: UUID }
    struct Row: Decodable { let id: UUID; let firstName: String; let lastName: String; let headline: String; let avatarPath: String? }
    let words = query.split(separator: " ").map { $0.filter { $0.isLetter || $0.isNumber || $0 == "'" || $0 == "-" } }.filter { !$0.isEmpty }.prefix(2)
    let followed = ((try? await supabase.from("follows").select("target").eq("follower", value: me).order("created_at", ascending: false).limit(500).execute().value as [F]) ?? []).map(\.target)
    var q = supabase.from("profiles").select("id, first_name, last_name, headline, avatar_path").eq("onboarded", value: true).neq("id", value: me)
    if !words.isEmpty { for w in words { q = q.or("first_name.ilike.\(w)*,last_name.ilike.\(w)*") } }
    else if !followed.isEmpty { q = q.in("id", values: followed.prefix(50).map { $0.uuidString.lowercased() }) }
    else { return [] }
    let rows: [Row] = (try? await q.limit(30).execute().value) ?? []
    let mine = Set(followed)
    return rows.filter { !"\($0.firstName) \($0.lastName)".trimmingCharacters(in: .whitespaces).isEmpty }
      .map { MentionPerson(id: $0.id, first: $0.firstName, last: $0.lastName, headline: $0.headline, avatarPath: $0.avatarPath, follows: mine.contains($0.id)) }
      .sorted { $0.follows && !$1.follows }
      .prefix(6).map { $0 }
  }

  // MARK: Media
  // Same bucket, folder rule and limits as the web (supabase/media.sql): your own folder only,
  // photos and video up to 50 MB, a fresh name per file.
  static let maxUploadBytes = 50 * 1024 * 1024
  static func upload(_ data: Data, contentType: String, ext: String, me: UUID) async throws -> String {
    guard data.count <= maxUploadBytes else { throw MediaError.tooBig }
    let path = "\(me.uuidString.lowercased())/\(UUID().uuidString.lowercased()).\(ext)"
    try await supabase.storage.from("media").upload(path, data: data, options: FileOptions(cacheControl: "31536000", contentType: contentType, upsert: false))
    return path
  }
  static func removeUpload(_ path: String) async { _ = try? await supabase.storage.from("media").remove(paths: [path]) }
  static func setLike(_ postId: String, _ on: Bool, me: UUID) async throws {
    do {
      if on { try await supabase.from("likes").insert(PostRef(postId: postId)).execute() }
      else { try await supabase.from("likes").delete().eq("post_id", value: postId).eq("user_id", value: me).execute() }
    } catch where "\(error)".contains("23505") {} // already liked (another device): fine
  }
  static func setSaved(_ postId: String, _ on: Bool, me: UUID) async throws {
    do {
      if on { try await supabase.from("saved").insert(PostRef(postId: postId)).execute() }
      else { try await supabase.from("saved").delete().eq("post_id", value: postId).eq("user_id", value: me).execute() }
    } catch where "\(error)".contains("23505") {}
  }
  static func comments(_ postId: String) async throws -> [Comment] {
    try await supabase.from("comments").select().eq("post_id", value: postId).order("created_at").limit(200).execute().value
  }
  static func addComment(_ postId: String, body: String) async throws {
    try await supabase.from("comments").insert(CommentRow(postId: postId, body: body)).execute()
  }
  // Your own post's text (the database marks it edited). Photos, video and mentions stay as posted.
  static func editPost(_ id: String, body: String, me: UUID) async throws {
    struct Body: Encodable { let body: String }
    struct Ref: Decodable { let id: String }
    let rows: [Ref] = try await supabase.from("posts").update(Body(body: body)).eq("id", value: id).eq("author_id", value: me).select("id").execute().value
    if rows.isEmpty { throw PostError.notYours }
  }
  // Deleting a post also removes its likes, replies and saves.
  static func deletePost(_ id: String) async throws {
    struct Ref: Decodable { let id: String }
    let rows: [Ref] = try await supabase.from("posts").delete().eq("id", value: id).select("id").execute().value
    if rows.isEmpty { throw PostError.notYours }
  }

  static func post(_ id: String) async throws -> Post {
    try await supabase.from("posts").select().eq("id", value: id).single().execute().value
  }
  static func posts(by author: UUID, limit: Int = 20) async throws -> [Post] {
    try await supabase.from("posts").select().eq("author_id", value: author).order("created_at", ascending: false).limit(limit).execute().value
  }
  static func clubPosts(_ clubId: String) async throws -> [Post] {
    try await supabase.from("posts").select().eq("community_id", value: clubId).eq("status", value: "visible").order("created_at", ascending: false).limit(30).execute().value
  }

  // MARK: People
  static func profile(_ id: UUID) async throws -> Profile {
    try await supabase.from("profiles").select(Session.profileColumns).eq("id", value: id).single().execute().value
  }
  static func isFollowing(_ id: UUID, me: UUID) async -> Bool {
    let n = try? await supabase.from("follows").select("target", head: true, count: .exact).eq("follower", value: me).eq("target", value: id).execute().count
    return (n ?? 0) > 0
  }
  static func setFollow(_ id: UUID, _ on: Bool, me: UUID) async throws {
    do {
      if on { try await supabase.from("follows").insert(FollowRow(target: id)).execute() }
      else { try await supabase.from("follows").delete().eq("follower", value: me).eq("target", value: id).execute() }
    } catch where "\(error)".contains("23505") {}
  }
  // Opens (or creates) the conversation with someone. People who don't know you land in Requests.
  static func startConversation(with other: UUID) async throws -> String {
    try await supabase.rpc("start_conversation", params: ["p_other": other.uuidString.lowercased()]).execute().value
  }
  static func conversation(_ id: String) async throws -> Conversation {
    try await supabase.from("conversations").select().eq("id", value: id).single().execute().value
  }

  // MARK: Messages
  // With replies where chat-extras.sql has run; without them otherwise.
  static func messages(_ conversationId: String) async throws -> [Message] {
    let cols = "id, conversation_id, sender_id, body, created_at"
    let list: [Message]
    do { list = try await supabase.from("messages").select(cols + ", reply_to").eq("conversation_id", value: conversationId).order("created_at", ascending: false).limit(200).execute().value }
    catch { list = try await supabase.from("messages").select(cols).eq("conversation_id", value: conversationId).order("created_at", ascending: false).limit(200).execute().value }
    return list.reversed()
  }
  static func send(_ conversationId: String, body: String, replyTo: String? = nil) async throws {
    try await supabase.from("messages").insert(MessageRow(conversationId: conversationId, body: body, replyTo: replyTo)).execute()
  }
  // Your own message, within 15 minutes; it's removed for both of you.
  static func unsend(_ messageId: String) async throws {
    let gone: [Message] = try await supabase.from("messages").delete().eq("id", value: messageId).select("id, conversation_id, sender_id, body, created_at").execute().value
    if gone.isEmpty { throw ExtrasError.tooLate }
  }

  // MARK: Reactions (direct messages: kind "dm"; group chats: "group")
  private static func reactionTable(_ kind: String) -> String { kind == "dm" ? "message_reactions" : "chat_message_reactions" }
  static func reactions(_ kind: String, messageIds: [String]) async -> [Reaction] {
    guard !messageIds.isEmpty else { return [] }
    return (try? await supabase.from(reactionTable(kind)).select("message_id, user_id, emoji").in("message_id", values: messageIds).execute().value) ?? []
  }
  static func setReaction(_ kind: String, messageId: String, emoji: String, on: Bool, me: UUID) async throws {
    do {
      if on { try await supabase.from(reactionTable(kind)).insert(ReactionRow(messageId: messageId, emoji: emoji)).execute() }
      else { try await supabase.from(reactionTable(kind)).delete().eq("message_id", value: messageId).eq("user_id", value: me).eq("emoji", value: emoji).execute() }
    } catch where "\(error)".contains("23505") {}
  }
  static func markRead(_ conversationId: String) async {
    _ = try? await supabase.rpc("mark_conversation_read", params: ["p_cid": conversationId]).execute()
  }
  static func accept(_ conversationId: String) async throws {
    try await supabase.rpc("accept_conversation", params: ["p_cid": conversationId]).execute()
  }
  static func decline(_ conversationId: String) async throws {
    try await supabase.from("conversations").delete().eq("id", value: conversationId).execute()
  }

  // MARK: Group chats
  // Your chats, newest first (this also opens the chat of any club you're in that doesn't have one yet).
  static func myChats() async throws -> [GroupChat] {
    try await supabase.rpc("my_chats").execute().value
  }
  static func openClubChat(_ clubId: String) async throws -> String {
    try await supabase.rpc("open_club_chat", params: ["p_community": clubId]).execute().value
  }
  static func openEventChat(_ eventId: String) async throws -> String {
    try await supabase.rpc("open_event_chat", params: ["p_event": eventId]).execute().value
  }
  static func chat(_ id: String) async throws -> GroupChat? {
    try await myChats().first { $0.id == id }
  }
  static func chatMessages(_ chatId: String) async throws -> [ChatMessage] {
    let cols = "id, chat_id, sender_id, sender_first, sender_last, body, announcement, ember, created_at"
    let list: [ChatMessage]
    do { list = try await supabase.from("chat_messages").select(cols + ", reply_to").eq("chat_id", value: chatId).order("created_at", ascending: false).limit(200).execute().value }
    catch { list = try await supabase.from("chat_messages").select(cols).eq("chat_id", value: chatId).order("created_at", ascending: false).limit(200).execute().value }
    return list.reversed()
  }
  // Officers (moderator and up) can post an announcement in their club's chat; the database checks.
  static func sendChat(_ chatId: String, body: String, announcement: Bool = false, replyTo: String? = nil) async throws {
    try await supabase.from("chat_messages").insert(ChatRow(chatId: chatId, body: body, announcement: announcement, replyTo: replyTo)).execute()
  }
  static func deleteChatMessage(_ id: String) async throws {
    try await supabase.from("chat_messages").delete().eq("id", value: id).execute()
  }
  static func markChatRead(_ chatId: String) async {
    _ = try? await supabase.rpc("mark_chat_read", params: ["p_chat": chatId]).execute()
  }
  static func unreadChats() async -> Int {
    (try? await supabase.rpc("unread_chats").execute().value as Int) ?? 0
  }
  static func isOfficer(_ role: String?) -> Bool { ["owner", "admin", "moderator"].contains(role ?? "") }

  // MARK: Clubs
  static func myClubs(me: UUID) async throws -> [Club] {
    let rows: [Membership] = try await supabase.from("community_members").select("communities(\(Club.columns))").eq("uid", value: me).execute().value
    return rows.compactMap(\.communities).sorted { $0.name < $1.name }
  }
  static func discoverClubs() async throws -> [Club] {
    try await supabase.from("communities").select(Club.columns).order("member_count", ascending: false).limit(30).execute().value
  }
  static func role(in clubId: String, me: UUID) async -> String? {
    let rows: [Role]? = try? await supabase.from("community_members").select("role").eq("community_id", value: clubId).eq("uid", value: me).limit(1).execute().value
    return rows?.first?.role
  }
  // Public clubs: you're in. Approval clubs: a request the officers see.
  static func join(_ club: Club, me: UUID) async throws {
    if club.isPublic { try await supabase.from("community_members").insert(JoinRow(communityId: club.id, uid: me, role: "member")).execute() }
    else { try await supabase.from("community_requests").insert(ClubRef(communityId: club.id)).execute() }
  }

  // MARK: Events
  static func upcomingEvents() async throws -> [ForgeEvent] {
    let now = ISO8601DateFormatter().string(from: .now)
    do {
      return try await supabase.from("events").select(ForgeEvent.columns).eq("status", value: "published").gt("ends_at", value: now).order("starts_at").limit(50).execute().value
    } catch {
      // Before club-events.sql, events have no club host.
      return try await supabase.from("events").select(ForgeEvent.orgColumns).eq("status", value: "published").gt("ends_at", value: now).order("starts_at").limit(50).execute().value
    }
  }
  static func goingTo(me: UUID) async -> Set<String> {
    struct R: Decodable { let eventId: String }
    let rows: [R]? = try? await supabase.from("event_rsvps").select("event_id").eq("user_id", value: me).execute().value
    return Set((rows ?? []).map(\.eventId))
  }
  static func setGoing(_ eventId: String, _ on: Bool, me: UUID) async throws {
    do {
      if on { try await supabase.from("event_rsvps").insert(EventRef(eventId: eventId)).execute() }
      else { try await supabase.from("event_rsvps").delete().eq("event_id", value: eventId).eq("user_id", value: me).execute() }
    } catch where "\(error)".contains("23505") {}
  }

  // MARK: Alerts
  static func notifications(me: UUID) async throws -> [ForgeNotification] {
    try await supabase.from("notifications").select().eq("user_id", value: me).order("created_at", ascending: false).limit(100).execute().value
  }
  static func markAlertsRead() async { _ = try? await supabase.rpc("mark_notifications_read").execute() }
}
