import XCTest
@testable import ForgeKit

// Ember on iPhone reads the same stream and offers the same one-tap actions as the web
// (web/src/lib/copilot-agent.ts parseStream, web/tests/ember-actions.test.ts).
final class EmberTests: XCTestCase {
  private let rs = "\u{1E}"
  private func frame(_ json: String) -> String { rs + json + rs }

  func testTextOutsideFramesToolsAndCardsInside() {
    let raw = "Let me look." + frame(#"{"tool":"search_clubs"}"#) + " Rocketry Club fits." + frame(#"{"proposal":{"id":"p1","kind":"join","club_id":"rkt","club_name":"Rocketry Club","privacy":"public"}}"#)
    let r = EmberLogic.parse(raw)
    XCTAssertEqual(r.text, "Let me look. Rocketry Club fits.")
    XCTAssertEqual(r.tools, ["search_clubs"])
    XCTAssertEqual(r.cards.map(\.kind), ["join"])
    XCTAssertEqual(r.cards.first?.title, "Join Rocketry Club")
    XCTAssertEqual(r.cards.first?.native, true)
  }

  func testAFrameStillArrivingIsSkippedUntilItsDone() {
    let half = "Checking." + rs + #"{"proposal":{"id":"p1","ki"#
    XCTAssertEqual(EmberLogic.parse(half).text, "Checking.")
    XCTAssertTrue(EmberLogic.parse(half).cards.isEmpty)
  }

  func testCardsKeepTheirFieldsAsWords() {
    let p = EmberLogic.parse(frame(#"{"proposal":{"id":"r1","kind":"rsvp","event_id":"e1","title":"Static fire","starts_at":"2026-11-22T15:00:00Z","where":"Field B","going":12,"cancel":false}}"#)).cards[0]
    XCTAssertEqual(p["going"], "12")
    XCTAssertEqual(p.confirmLabel, "Save my spot")
    XCTAssertEqual(p.title, "RSVP: Static fire")
    let post = EmberLogic.parse(frame(#"{"proposal":{"id":"x","kind":"post","body":"Hit 2 kN","postKind":"result","tags":["rocketry","test"]}}"#)).cards[0]
    XCTAssertEqual(post["tags"], "rocketry, test")
    XCTAssertEqual(post.detail, "Hit 2 kN")
  }

  func testMilestonesSignaturesAndReviewsFinishOnTheWebForNow() {
    let m = EmberLogic.card(["id": "m", "kind": "milestone", "club_id": "rkt", "club_name": "Rocketry Club", "title": "Measured lift"])!
    XCTAssertFalse(m.native)
    XCTAssertEqual(m.title, "Ask Rocketry Club to verify")
    XCTAssertEqual(m.webPath, "/projects")
    let review = EmberLogic.card(["id": "r", "kind": "review", "club_id": "rkt", "member": "Josh", "verify": false])!
    XCTAssertEqual(review.title, "Decline Josh's milestone")
    XCTAssertEqual(review.webPath, "/c/rkt/manage?tab=verify")
  }

  // web/tests/ember-actions.test.ts: "someone who works is never sent to a club to get work signed"
  func testSomeoneWhoWorksIsNeverSentToAClub() {
    let work = EmberLogic.actions(field: "Mechanical", student: false)
    XCTAssertEqual(work.first { $0.id == "sign" }?.label, "Get it signed")
    XCTAssertFalse(work.contains { $0.text.contains("club") })
    XCTAssertEqual(EmberLogic.actions(field: "", student: true).first { $0.id == "sign" }?.label, "Get it verified")
  }

  // "the field goes into the ask, and a missing one still reads"
  func testTheFieldGoesIntoTheAsk() {
    XCTAssertEqual(EmberLogic.actions(field: "Aerospace", student: true).last?.text, "Find someone in Aerospace worth meeting and draft an intro message.")
    XCTAssertEqual(EmberLogic.actions(field: "  ", student: true).last?.text, "Find someone in my field worth meeting and draft an intro message.")
    XCTAssertEqual(EmberLogic.actions(field: "", student: true).count, 8)
  }

  func testGreetingAndHistoryAsTheRouteAcceptsIt() {
    XCTAssertEqual(EmberLogic.greeting("Josh"), "Hi Josh, what are we getting done?")
    XCTAssertEqual(EmberLogic.greeting(""), "What are we getting done?")
    let turns = (0..<20).map { (user: $0 % 2 == 0, text: "turn \($0)") }
    let h = EmberLogic.history(turns + [(user: false, text: "")])
    XCTAssertEqual(h.count, 12, "the route takes at most 12")
    XCTAssertEqual(h.last?["content"], "turn 19")
    XCTAssertEqual(h.first?["role"], "user")
    XCTAssertEqual(EmberLogic.history([(user: true, text: String(repeating: "a", count: 7000))])[0]["content"]?.count, 6000)
  }
}
