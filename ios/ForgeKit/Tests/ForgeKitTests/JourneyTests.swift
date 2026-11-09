import Foundation
import Supabase
import XCTest
@testable import ForgeKit

// The app's real reads and writes against the local test stack (web/e2e/local-supabase.sh up;
// scripts/test-kit.sh sets FORGE_SUPABASE_URL and the key). Skipped when the stack isn't set.
// Maya is the member under test; Josh is on the other end of messages.
@MainActor
final class JourneyTests: XCTestCase {
  private static let stamp = String(Int(Date().timeIntervalSince1970) % 100_000)

  override func setUp() async throws {
    try XCTSkipIf(ProcessInfo.processInfo.environment["FORGE_SUPABASE_ANON_KEY"] == nil, "local stack not configured")
  }

  private func signIn(_ who: String) async throws -> UUID {
    try await supabase.auth.signIn(email: "\(who)@forge.test", password: "forge-test-pass-1")
    return try await supabase.auth.session.user.id
  }

  func testPostShowsFirstThenLikeSaveAndReply() async throws {
    let me = try await signIn("maya")
    let body = "Telemetry board talks to the ground station \(Self.stamp)"
    try await API.createPost(body: body, kind: "result")

    let feed = FeedStore()
    await feed.load(me: me, interests: ["Robotics"])
    XCTAssertNil(feed.error)
    XCTAssertEqual(feed.items.first?.post.body, body, "your new post should rank first")
    let post = try XCTUnwrap(feed.items.first?.post)

    await feed.toggleLike(post, me: me)
    await feed.toggleSave(post, me: me)
    XCTAssertNil(feed.error)
    let again = FeedStore()
    await again.load(me: me, interests: [])
    XCTAssertTrue(again.liked.contains(post.id))
    XCTAssertTrue(again.saved.contains(post.id))
    XCTAssertEqual(again.items.first { $0.id == post.id }?.post.likeCount, 1)

    let profileList = FeedStore()
    await profileList.show(try await API.posts(by: me), me: me)
    XCTAssertTrue(profileList.liked.contains(post.id), "a profile's posts show what you've liked")

    try await API.addComment(post.id, body: "Range test next week \(Self.stamp)")
    let comments = try await API.comments(post.id)
    XCTAssertTrue(comments.contains { $0.body == "Range test next week \(Self.stamp)" })
  }

  func testMessageSomeoneFromTheirProfile() async throws {
    let maya = try await signIn("maya")
    let found: [Profile] = try await supabase.from("profiles").select(Session.profileColumns).eq("first_name", value: "Josh").limit(1).execute().value
    let josh = try XCTUnwrap(found.first?.id)
    let cid = try await API.startConversation(with: josh)
    XCTAssertFalse(cid.isEmpty)
    let conv = try await API.conversation(cid)
    let canSend = conv.status == "active" || conv.startedBy == maya
    XCTAssertTrue(canSend)
    try await API.send(cid, body: "Want to pair on the IMU code? \(Self.stamp)")
    let thread = try await API.messages(cid)
    XCTAssertEqual(thread.last?.body, "Want to pair on the IMU code? \(Self.stamp)")

    // Josh sees it in his inbox, unread.
    let joshId = try await signIn("josh")
    let inbox = InboxStore()
    await inbox.load(me: joshId)
    let row = try XCTUnwrap(inbox.items?.first { $0.id == cid })
    XCTAssertTrue(row.unread)
    if row.isRequestToMe { try await API.accept(cid) }
    try await API.send(cid, body: "Yes, tomorrow after lab \(Self.stamp)")
    await API.markRead(cid)
    await inbox.load(me: joshId)
    XCTAssertEqual(inbox.items?.first { $0.id == cid }?.unread, false)
  }

  func testFollowAndClubs() async throws {
    let me = try await signIn("maya")
    let found: [Profile] = try await supabase.from("profiles").select(Session.profileColumns).eq("first_name", value: "Cara").limit(1).execute().value
    let cara = try XCTUnwrap(found.first)
    try await API.setFollow(cara.id, true, me: me)
    let following = await API.isFollowing(cara.id, me: me)
    XCTAssertTrue(following)
    try await API.setFollow(cara.id, false, me: me)
    let stillFollowing = await API.isFollowing(cara.id, me: me)
    XCTAssertFalse(stillFollowing)

    let mine = try await API.myClubs(me: me)
    let other = try await API.discoverClubs().first { c in c.isPublic && !mine.contains { $0.id == c.id } }
    if let other {
      try await API.join(other, me: me)
      let role = await API.role(in: other.id, me: me)
      XCTAssertEqual(role, "member")
    }
    let posts = try await API.clubPosts((mine.first ?? other)!.id)
    XCTAssertNotNil(posts)
  }

  func testEventsAndGoing() async throws {
    let me = try await signIn("josh")
    let events = try await API.upcomingEvents()
    guard let e = events.first else { throw XCTSkip("no upcoming events in the seed") }
    let wasGoing = await API.goingTo(me: me).contains(e.id)
    try await API.setGoing(e.id, !wasGoing, me: me)
    let now = await API.goingTo(me: me).contains(e.id)
    XCTAssertEqual(now, !wasGoing)
    try await API.setGoing(e.id, wasGoing, me: me)
  }

  func testAlerts() async throws {
    let me = try await signIn("ben")
    let list = try await API.notifications(me: me)
    XCTAssertFalse(list.isEmpty, "Ben has seeded follow notifications")
    XCTAssertEqual(list.first?.sentence, "started following you")
  }
}
