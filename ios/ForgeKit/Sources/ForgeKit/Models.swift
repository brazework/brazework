import Foundation

struct MediaItem: Codable, Hashable, Sendable {
  init(type: String, path: String, w: Double? = nil, h: Double? = nil, alt: String? = nil) { self.type = type; self.path = path; self.w = w; self.h = h; self.alt = alt }
  var type: String
  var path: String
  var w: Double?
  var h: Double?
  var alt: String?
  var isVideo: Bool { type == "video" }
  var aspect: Double? { if let w, let h, w > 0, h > 0 { return w / h } else { return nil } }
}

struct AvatarRef: Codable, Hashable, Sendable { var avatarPath: String? }

struct Post: Codable, Identifiable, Hashable, Sendable {
  let id: String
  let authorId: UUID
  var authorFirst: String
  var authorLast: String
  var authorHeadline: String
  var communityId: String?
  var communityName: String?
  var body: String
  var kind: String
  var tags: [String]
  var likeCount: Int
  var commentCount: Int
  var createdAt: Date
  var media: [MediaItem]?
  var author: AvatarRef?

  var authorName: String { "\(authorFirst) \(authorLast)".trimmingCharacters(in: .whitespaces) }
  var avatarPath: String? { author?.avatarPath }
}

struct Comment: Codable, Identifiable, Hashable, Sendable {
  let id: String
  let postId: String
  let authorId: UUID
  var authorFirst: String
  var authorLast: String
  var body: String
  var createdAt: Date
  var authorName: String { "\(authorFirst) \(authorLast)".trimmingCharacters(in: .whitespaces) }
}

struct Profile: Codable, Identifiable, Hashable, Sendable {
  let id: UUID
  var firstName: String
  var lastName: String
  var headline: String
  var field: String
  var bio: String
  var interests: [String]
  var accountType: String
  var onboarded: Bool
  var avatarPath: String?
  var name: String { "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces) }
}

struct Club: Codable, Identifiable, Hashable, Sendable {
  let id: String
  var name: String
  var about: String
  var field: String
  var privacy: String
  var memberCount: Int
  var topics: [String]
  var isPublic: Bool { privacy == "public" }
  static let columns = "id, name, about, field, privacy, member_count, topics"
}

struct HostName: Codable, Hashable, Sendable { var name: String }

struct ForgeEvent: Codable, Identifiable, Hashable, Sendable {
  let id: String
  var title: String
  var description: String
  var type: String
  var format: String
  var location: String
  var link: String
  var startsAt: Date
  var endsAt: Date
  var rsvpCount: Int
  var communityId: String?
  var organizations: HostName?
  var communities: HostName?

  static let columns = "id, title, description, type, format, location, link, starts_at, ends_at, rsvp_count, community_id, organizations(name), communities(name)"
  static let orgColumns = "id, title, description, type, format, location, link, starts_at, ends_at, rsvp_count, organizations(name)"
  var host: String { communities?.name ?? organizations?.name ?? "" }
  var inPerson: Bool { format != "Online" && !location.trimmingCharacters(in: .whitespaces).isEmpty }
}

struct Person: Codable, Hashable, Sendable {
  var firstName: String?
  var lastName: String?
  var headline: String?
}

struct Conversation: Codable, Identifiable, Hashable, Sendable {
  let id: String
  let userA: UUID
  let userB: UUID
  let startedBy: UUID
  var status: String
  var people: [String: Person]?
  var lastMessageAt: Date?
  var lastBody: String
  var lastSender: UUID?

  func other(of me: UUID) -> (id: UUID, person: Person) {
    let o = userA == me ? userB : userA
    return (o, people?[o.uuidString.lowercased()] ?? Person())
  }
}

struct ConversationRead: Codable, Sendable { let conversationId: String; let readAt: Date }

struct Message: Codable, Identifiable, Hashable, Sendable {
  let id: String
  let conversationId: String
  let senderId: UUID
  var body: String
  var createdAt: Date
}

struct ForgeNotification: Codable, Identifiable, Hashable, Sendable {
  let id: Int
  var actorId: UUID?
  var actorFirst: String
  var actorLast: String
  var kind: String
  var postId: String?
  var communityId: String?
  var communityName: String
  var snippet: String
  var read: Bool
  var createdAt: Date

  var actorName: String { "\(actorFirst) \(actorLast)".trimmingCharacters(in: .whitespaces) }
  // Same wording as the web's notifications page.
  var sentence: String {
    switch kind {
    case "like": "liked your post"
    case "comment": "commented on your post"
    case "mention": "mentioned you in a post"
    case "follow": "started following you"
    case "connect_request": "wants to connect"
    case "connect_accepted": "accepted your connection"
    case "community_request": "asked to join \(communityName)"
    case "community_approved": "approved you to join \(communityName)"
    case "milestone_request": "asked \(communityName.isEmpty ? "your club" : communityName) to verify a milestone"
    case "milestone_verified": "verified your milestone"
    case "milestone_declined": "didn't verify your milestone"
    default: "sent you an update"
    }
  }
}

// Unread inbox row, shaped for the list.
struct InboxItem: Identifiable, Hashable, Sendable {
  let id: String
  let otherId: UUID
  let name: String
  let headline: String
  let preview: String
  let at: Date?
  let unread: Bool
  let isRequestToMe: Bool
  let status: String
  let startedByMe: Bool
}

// A group chat (supabase/group-chats.sql): a club's chat, an event's attendees, or a team. As
// my_chats() returns it, with whether there's something you haven't read.
struct GroupChat: Codable, Identifiable, Hashable, Sendable {
  let id: String
  var kind: String
  var communityId: String?
  var eventId: String?
  var title: String
  var subtitle: String
  var lastAt: Date?
  var lastBody: String
  var lastSenderName: String
  var lastFromMe: Bool
  var unread: Bool
  // A chat with no messages yet has null flags (NULL = uuid is NULL in SQL): read them as false.
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    kind = try c.decode(String.self, forKey: .kind)
    communityId = try c.decodeIfPresent(String.self, forKey: .communityId)
    eventId = try c.decodeIfPresent(String.self, forKey: .eventId)
    title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
    subtitle = try c.decodeIfPresent(String.self, forKey: .subtitle) ?? ""
    lastAt = try c.decodeIfPresent(Date.self, forKey: .lastAt)
    lastBody = try c.decodeIfPresent(String.self, forKey: .lastBody) ?? ""
    lastSenderName = try c.decodeIfPresent(String.self, forKey: .lastSenderName) ?? ""
    lastFromMe = try c.decodeIfPresent(Bool.self, forKey: .lastFromMe) ?? false
    unread = try c.decodeIfPresent(Bool.self, forKey: .unread) ?? false
  }

  var preview: String { lastBody.isEmpty ? "No messages yet" : "\(lastFromMe ? "You" : lastSenderName.isEmpty ? "Someone" : lastSenderName): \(lastBody)" }
}

struct ChatMessage: Codable, Identifiable, Hashable, Sendable {
  let id: String
  let chatId: String
  let senderId: UUID
  var senderFirst: String
  var senderLast: String
  var body: String
  var announcement: Bool
  var ember: Bool
  var createdAt: Date
  var senderName: String { "\(senderFirst) \(senderLast)".trimmingCharacters(in: .whitespaces) }
}

// Navigation targets shared by every tab.
struct PersonRoute: Hashable, Sendable { let id: UUID }
struct PostRoute: Hashable, Sendable { let id: String }
