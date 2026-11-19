import XCTest
@testable import ForgeKit

// The one next step on a build, and how far it has got: the same answers as the web
// (web/tests/build-step.test.ts), so the iPhone and the site never disagree.
final class BuildLogicTests: XCTestCase {
  func testNextStepFollowsTheBuildsRealState() {
    XCTAssertEqual(BuildLogic.next(.init()).label, "Log your first update")
    XCTAssertEqual(BuildLogic.next(.init(updates: 2)).label, "Get it verified")
    XCTAssertEqual(BuildLogic.next(.init(updates: 2)).kind, .verify)
    XCTAssertEqual(BuildLogic.next(.init(updates: 2, waiting: 1)).kind, .waiting)
    XCTAssertEqual(BuildLogic.next(.init(updates: 2, verified: 3)).label, "Log an update")
    XCTAssertEqual(BuildLogic.next(.init(verified: 1)).label, "Log an update")
  }

  func testStageBuiltThenSigned() {
    XCTAssertEqual(BuildLogic.stage(.init()), 0)
    XCTAssertEqual(BuildLogic.stage(.init(updates: 1)), 1)
    XCTAssertEqual(BuildLogic.stage(.init(updates: 1, waiting: 2)), 1)
    XCTAssertEqual(BuildLogic.stage(.init(verified: 2)), 2)
  }

  // The three steps on a project card: logged, asked, signed (web/tests/build-step.test.ts).
  func testPathLoggedAskedSigned() {
    func done(_ b: BuildCounts) -> [Bool] { BuildLogic.path(b).map(\.done) }
    XCTAssertEqual(done(.init()), [false, false, false])
    XCTAssertEqual(done(.init(updates: 2)), [true, false, false])
    XCTAssertEqual(done(.init(updates: 1, waiting: 1)), [true, true, false])
    XCTAssertEqual(done(.init(verified: 1)), [true, true, true], "a signed result means it was logged and asked for")
    let p = BuildLogic.path(.init(updates: 1, waiting: 1))
    XCTAssertEqual(p.map(\.label), ["Logged", "Asked", "Signed"])
    XCTAssertEqual(p[0].note, "1 update")
    XCTAssertEqual(p[1].note, "1 waiting")
    XCTAssertEqual(BuildLogic.path(.init(updates: 3, verified: 2))[2].note, "2 signed")
    XCTAssertEqual(BuildLogic.path(.init(verified: 1))[0].note, "1 result", "a result with no update still counts as logged, and says what it is")
    XCTAssertEqual(BuildLogic.path(.init())[0].note, "nothing yet")
    XCTAssertEqual(BuildLogic.path(.init())[1].note, "nobody yet")
    XCTAssertEqual(BuildLogic.path(.init(verified: 1))[1].note, "answered")
    XCTAssertEqual(BuildLogic.path(.init())[2].note, "not yet")
  }

  func testSignedByLine() {
    let p = ProofItem(id: "1", title: "Held 1.4 kN", communityName: "Formula SAE", reviewerName: "Luis O.", reviewedAt: nil, project: nil)
    XCTAssertEqual(p.signedBy, "Verified by Luis O. · Formula SAE")
    XCTAssertEqual(ProofItem(id: "2", title: "x", communityName: nil, reviewerName: "", reviewedAt: nil, project: nil).signedBy, "Verified")
  }
}
