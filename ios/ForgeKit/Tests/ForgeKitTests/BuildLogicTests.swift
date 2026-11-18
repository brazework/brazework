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

  func testSignedByLine() {
    let p = ProofItem(id: "1", title: "Held 1.4 kN", communityName: "Formula SAE", reviewerName: "Luis O.", reviewedAt: nil, project: nil)
    XCTAssertEqual(p.signedBy, "Verified by Luis O. · Formula SAE")
    XCTAssertEqual(ProofItem(id: "2", title: "x", communityName: nil, reviewerName: "", reviewedAt: nil, project: nil).signedBy, "Verified")
  }
}
