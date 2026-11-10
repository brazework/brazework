import XCTest
@testable import ForgeKit

final class MentionTests: XCTestCase {
  private let ana = Mention(id: UUID(), name: "Ana")
  private let anaLee = Mention(id: UUID(), name: "Ana Lee")

  func testPartsPreferLongestName() {
    let parts = Mentions.parts("Thanks @Ana Lee and @Ana!", [ana, anaLee])
    XCTAssertEqual(parts, [.text("Thanks "), .mention(anaLee), .text(" and "), .mention(ana), .text("!")])
  }

  func testNoPartialNameMatch() {
    XCTAssertEqual(Mentions.parts("@Anastasia hi", [ana]), [.text("@Anastasia hi")])
  }

  func testKeepOnlyNamedOnce() {
    XCTAssertEqual(Mentions.keep("hi @Ana", [ana, anaLee, ana]), [ana])
  }

  func testQueryWhileTyping() {
    XCTAssertEqual(Mentions.query("Shout out to @Be")?.q, "Be")
    XCTAssertEqual(Mentions.query("@Ben Ch")?.q, "Ben Ch")
    XCTAssertNil(Mentions.query("email me@ben"), "an @ inside a word isn't a mention")
    XCTAssertNil(Mentions.query("done @Ben Cho and"), "two words at most")
  }

  func testInsertReplacesQuery() {
    let ben = Mention(id: UUID(), name: "Ben Cho")
    XCTAssertEqual(Mentions.insert(ben, into: "Shout out to @Be"), "Shout out to @Ben Cho ")
    XCTAssertEqual(Mentions.insert(ben, into: "@be"), "@Ben Cho ")
  }
}
