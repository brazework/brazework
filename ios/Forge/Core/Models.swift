import Foundation

struct MediaItem: Codable, Hashable, Sendable {
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
