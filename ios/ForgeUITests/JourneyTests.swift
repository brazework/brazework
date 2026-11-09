import XCTest

// Real journeys against the local test stack (scripts/test.sh seeds what these need).
// Signed in through the app's DEBUG test hook, as the web e2e suite's seeded members.
final class JourneyTests: XCTestCase {
  private func launch(_ email: String, tab: String = "feed") -> XCUIApplication {
    let app = XCUIApplication()
    app.launchEnvironment = ["FORGE_TEST_EMAIL": email, "FORGE_TEST_PASSWORD": "forge-test-pass-1", "FORGE_TEST_TAB": tab]
    app.launch()
    return app
  }

  override func setUp() { continueAfterFailure = false }

  func testPostLandsFirstThenLikeAndReply() {
    let app = launch("josh@forge.test")
    let stamp = String(Int(Date().timeIntervalSince1970) % 100_000)
    let body = "Static fire went clean \(stamp)"

    app.buttons["New post"].tap()
    app.buttons["Result"].tap()
    let field = app.textViews.firstMatch.exists ? app.textViews.firstMatch : app.textFields.firstMatch
    XCTAssertTrue(field.waitForExistence(timeout: 5))
    field.typeText(body)
    app.buttons["Post"].tap()

    // Your new post shows first.
    XCTAssertTrue(app.staticTexts[body].waitForExistence(timeout: 10))
    let like = app.buttons.matching(identifier: "Like").firstMatch
    like.tap()
    XCTAssertTrue(app.buttons["Unlike"].waitForExistence(timeout: 5))

    app.buttons.matching(identifier: "Reply").firstMatch.tap()
    let reply = app.textFields["Write a reply"].exists ? app.textFields["Write a reply"] : app.textViews.firstMatch
    XCTAssertTrue(reply.waitForExistence(timeout: 5))
    reply.tap()
    reply.typeText("Nice, what was the chamber pressure? \(stamp)")
    app.buttons["Send"].tap()
    XCTAssertTrue(app.staticTexts["Nice, what was the chamber pressure? \(stamp)"].waitForExistence(timeout: 10))
  }

  func testMessageThreadSendAndReceive() {
    let app = launch("josh@forge.test", tab: "messages")
    let row = app.staticTexts["Maya Patel"]
    XCTAssertTrue(row.waitForExistence(timeout: 10))
    row.tap()
    XCTAssertTrue(app.staticTexts["Are you coming to launch day?"].waitForExistence(timeout: 10))
    let stamp = String(Int(Date().timeIntervalSince1970) % 100_000)
    let field = app.textFields["Message"].exists ? app.textFields["Message"] : app.textViews.firstMatch
    field.tap()
    field.typeText("Yes, bringing the rail \(stamp)")
    app.buttons["Send"].tap()
    XCTAssertTrue(app.staticTexts["Yes, bringing the rail \(stamp)"].waitForExistence(timeout: 10))
  }

  func testJoinAClub() {
    let app = launch("josh@forge.test", tab: "clubs")
    let club = app.staticTexts["Robotics Society"]
    XCTAssertTrue(club.waitForExistence(timeout: 10))
    club.tap()
    let join = app.buttons["Join club"]
    if join.waitForExistence(timeout: 5) { join.tap() }
    XCTAssertTrue(app.staticTexts["You're a member"].waitForExistence(timeout: 10))
  }
}
