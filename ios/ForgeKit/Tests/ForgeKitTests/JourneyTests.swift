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

  func testPhotoPostAndFolderRule() async throws {
    let me = try await signIn("cara")
    // A real PNG (1×1), uploaded the way the composer does it.
    let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==")!
    let path = try await API.upload(png, contentType: "image/png", ext: "png", me: me)
    XCTAssertTrue(path.hasPrefix(me.uuidString.lowercased() + "/"))
    let (bytes, resp) = try await URLSession.shared.data(from: XCTUnwrap(mediaURL(path)))
    XCTAssertEqual((resp as? HTTPURLResponse)?.statusCode, 200)
    XCTAssertEqual(bytes, png)

    let body = "First light on the spectrometer \(Self.stamp)"
    try await API.createPost(body: body, kind: "result", media: [MediaItem(type: "image", path: path, w: 1, h: 1, alt: "Spectrometer")])
    let mine = try await API.posts(by: me)
    let post = try XCTUnwrap(mine.first { $0.body == body })
    XCTAssertEqual(post.media?.first?.path, path)
    XCTAssertEqual(post.media?.first?.alt, "Spectrometer")

    // Someone else's file can't go in your post (the database checks the folder).
    do {
      try await API.createPost(body: "Not mine \(Self.stamp)", kind: "update", media: [MediaItem(type: "image", path: "00000000-0000-0000-0000-000000000000/x.png")])
      XCTFail("a post with someone else's file should be refused")
    } catch {
      XCTAssertEqual(friendly(error), "Something's wrong with those attachments. Remove them and try again.")
    }
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

  func testClubChatAndAnnouncements() async throws {
    // Josh (a member) talks in Rocketry Club's chat.
    _ = try await signIn("josh")
    let chatId = try await API.openClubChat("rkt")
    try await API.sendChat(chatId, body: "Who has the launch controller? \(Self.stamp)")
    // Members can't post announcements.
    do { try await API.sendChat(chatId, body: "Not allowed \(Self.stamp)", announcement: true); XCTFail("members can't announce") }
    catch { XCTAssertTrue("\(error)".contains("Only club officers"), "\(error)") }

    // Ben (the owner) sees it unread, reads it, and announces.
    _ = try await signIn("ben")
    let bensChats = try await API.myChats()
    let row = try XCTUnwrap(bensChats.first { $0.id == chatId })
    XCTAssertEqual(row.kind, "club")
    XCTAssertEqual(row.title, "Rocketry Club")
    XCTAssertTrue(row.unread)
    XCTAssertTrue(row.preview.hasPrefix("Josh: Who has the launch controller?"))
    let before = await API.unreadChats()
    XCTAssertGreaterThanOrEqual(before, 1)
    await API.markChatRead(chatId)
    let after = await API.unreadChats()
    XCTAssertEqual(after, before - 1)
    try await API.sendChat(chatId, body: "Launch moved to Sunday \(Self.stamp)", announcement: true)
    let thread = try await API.chatMessages(chatId)
    let last = try XCTUnwrap(thread.last)
    XCTAssertTrue(last.announcement)
    XCTAssertEqual(last.senderFirst, "Ben")
    let ben = try await supabase.auth.session.user.id
    let role = await API.role(in: "rkt", me: ben)
    XCTAssertTrue(API.isOfficer(role))

    // Josh sees the announcement; Cara (not a member) can't open the chat or read it.
    _ = try await signIn("josh")
    let joshSees = try await API.chatMessages(chatId)
    XCTAssertEqual(joshSees.last?.body, "Launch moved to Sunday \(Self.stamp)")
    _ = try await signIn("cara")
    do { _ = try await API.openClubChat("rkt"); XCTFail("non-members can't open a club's chat") } catch {}
    let peek = try await API.chatMessages(chatId)
    XCTAssertTrue(peek.isEmpty, "row-level security hides the chat")
  }

  func testEventChatForPeopleGoing() async throws {
    let me = try await signIn("maya")
    guard let e = try await API.upcomingEvents().first else { throw XCTSkip("no upcoming events") }
    try await API.setGoing(e.id, true, me: me)
    let chatId = try await API.openEventChat(e.id)
    try await API.sendChat(chatId, body: "Carpool from campus? \(Self.stamp)")
    let mayasChats = try await API.myChats()
    let row = try XCTUnwrap(mayasChats.first { $0.id == chatId })
    XCTAssertEqual(row.kind, "event")
    XCTAssertEqual(row.title, e.title)
  }

  func testReactionsRepliesAndUnsend() async throws {
    // Ben and Josh (an active conversation, so both can send).
    let ben = try await signIn("ben")
    let found: [Profile] = try await supabase.from("profiles").select(Session.profileColumns).eq("first_name", value: "Josh").limit(1).execute().value
    let josh = try XCTUnwrap(found.first?.id)
    let cid = try await API.startConversation(with: josh)
    try await API.send(cid, body: "Motor casing is machined \(Self.stamp)")
    let firstList = try await API.messages(cid)

    let first = try XCTUnwrap(firstList.last)

    _ = try await signIn("josh")
    let conv = try await API.conversation(cid)
    if conv.status == "request" { try await API.accept(cid) }
    try await API.setReaction("dm", messageId: first.id, emoji: "🔥", on: true, me: josh)
    try await API.send(cid, body: "Looks clean \(Self.stamp)", replyTo: first.id)
    let replyList = try await API.messages(cid)

    let reply = try XCTUnwrap(replyList.last)
    XCTAssertEqual(reply.replyTo, first.id, "the reply points at Ben's message")
    try await API.send(cid, body: "typo \(Self.stamp)")
    let typoList = try await API.messages(cid)

    let typo = try XCTUnwrap(typoList.last)
    try await API.unsend(typo.id)
    let afterUnsend = try await API.messages(cid)
    XCTAssertFalse(afterUnsend.contains { $0.id == typo.id })

    // Ben sees the 🔥 and can't unsend Josh's message.
    _ = try await signIn("ben")
    let seen = await API.reactions("dm", messageIds: [first.id])
    XCTAssertEqual(seen, [Reaction(messageId: first.id, userId: josh, emoji: "🔥")])
    do { try await API.unsend(reply.id); XCTFail("can't unsend someone else's message") } catch { XCTAssertEqual(friendly(error), "You can unsend a message for 15 minutes after sending it.") }
    try await API.setReaction("dm", messageId: first.id, emoji: "👀", on: true, me: ben)
    try await API.setReaction("dm", messageId: first.id, emoji: "👀", on: false, me: ben)
    let after = await API.reactions("dm", messageIds: [first.id])
    XCTAssertEqual(after.count, 1)

    // Group chats too.
    let chatId = try await API.openClubChat("rkt")
    try await API.sendChat(chatId, body: "Pad booked \(Self.stamp)")
    let padList = try await API.chatMessages(chatId)

    let pad = try XCTUnwrap(padList.last)
    try await API.setReaction("group", messageId: pad.id, emoji: "🚀", on: true, me: ben)
    try await API.sendChat(chatId, body: "for 9am \(Self.stamp)", replyTo: pad.id)
    let chatAfter = try await API.chatMessages(chatId)
    XCTAssertEqual(chatAfter.last?.replyTo, pad.id)
    let chatReactions = await API.reactions("group", messageIds: [pad.id])
    XCTAssertEqual(chatReactions.first?.emoji, "🚀")
  }

  func testMentionNotifiesThem() async throws {
    let me = try await signIn("maya")
    let found = await API.mentionSuggestions("Be", me: me)
    let ben = try XCTUnwrap(found.first { $0.first == "Ben" })
    let body = "Great burn data from @\(ben.name) today \(Self.stamp)"
    try await API.createPost(body: body, kind: "update", mentions: [Mention(id: ben.id, name: ben.name), Mention(id: UUID(), name: "Nobody Here")])
    let mine = try await API.posts(by: me)
    let post = try XCTUnwrap(mine.first { $0.body == body })
    XCTAssertEqual(post.mentions, [Mention(id: ben.id, name: ben.name)], "only people named in the text are kept")

    _ = try await signIn("ben")
    let benId = try await supabase.auth.session.user.id
    let alerts = try await API.notifications(me: benId)
    let n = try XCTUnwrap(alerts.first { $0.kind == "mention" && $0.postId == post.id })
    XCTAssertEqual(n.sentence, "mentioned you in a post")
    XCTAssertEqual(n.actorFirst, "Maya")
  }

  func testEditAndDeleteYourOwnPostsOnly() async throws {
    let me = try await signIn("cara")
    try await API.createPost(body: "Bridge truss holds 40 kg \(Self.stamp)", kind: "result")
    let mine = try await API.posts(by: me)
    let post = try XCTUnwrap(mine.first { $0.body.hasPrefix("Bridge truss") })
    XCTAssertNil(post.editedAt)
    try await API.editPost(post.id, body: "Bridge truss holds 45 kg \(Self.stamp)", me: me)
    let edited = try await API.post(post.id)
    XCTAssertEqual(edited.body, "Bridge truss holds 45 kg \(Self.stamp)")
    XCTAssertNotNil(edited.editedAt, "readers see it was edited")

    // Someone else can't edit or delete it.
    let josh = try await signIn("josh")
    do { try await API.editPost(post.id, body: "hijacked", me: josh); XCTFail("edited someone else's post") } catch { XCTAssertEqual(friendly(error), "You can only change your own posts.") }
    do { try await API.deletePost(post.id); XCTFail("deleted someone else's post") } catch { XCTAssertEqual(friendly(error), "You can only change your own posts.") }
    try await API.setLike(post.id, true, me: josh)

    // The author deletes it, likes and all.
    _ = try await signIn("cara")
    try await API.deletePost(post.id)
    do { _ = try await API.post(post.id); XCTFail("post still there") } catch {}
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
    XCTAssertEqual(list.first { $0.kind == "follow" }?.sentence, "started following you")
  }
}
