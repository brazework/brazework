import XCTest
@testable import ForgeKit

// The record's rules on iPhone, the same as the web's: which kind of proof a milestone is
// (lib/record-years.ts, record-timeline.ts), who stood behind it, and the form checks the
// database enforces (supabase/projects.sql, milestones.sql, backed.sql).
final class RecordTests: XCTestCase {
  func testKindsFollowTheWeb() {
    XCTAssertEqual(RecordLogic.kind(status: "verified", backed: false), .signed)
    XCTAssertEqual(RecordLogic.kind(status: "logged", backed: true), .backed)
    XCTAssertEqual(RecordLogic.kind(status: "logged", backed: false), .draft, "logged without a backing is only yours to see")
    XCTAssertEqual(RecordLogic.kind(status: "pending", backed: false), .waiting)
    XCTAssertEqual(RecordLogic.kind(status: "disputed", backed: false), .waiting)
    XCTAssertEqual(RecordLogic.kind(status: "refused", backed: false), .refused)
  }

  func testWhoStoodBehindIt() {
    XCTAssertEqual(RecordItem(id: "a", title: "t", achievedOn: "2026-11-01", status: "verified", vouchedBy: "Dana Ruiz, Lead · acme.com").by, "Signed by Dana Ruiz, Lead · acme.com")
    XCTAssertEqual(RecordItem(id: "b", communityId: "rkt", communityName: "Rocketry Club", title: "t", achievedOn: "2026-11-01", status: "verified", reviewerName: "Maya P.", reviewerRole: "admin").by, "Verified by Maya P. (admin), Rocketry Club")
    XCTAssertEqual(RecordItem(id: "c", communityId: "rkt", communityName: "Rocketry Club", title: "t", achievedOn: "2026-11-01", status: "pending").by, "Waiting for Rocketry Club")
    XCTAssertEqual(RecordItem(id: "d", title: "t", achievedOn: "2026-11-01", status: "pending").by, "Waiting for a vouch")
    let pr = RecordItem.Backing(kind: "pull_request", repoFullName: "me/app", url: "https://github.com/me/app/pull/1", approvers: ["sam"])
    XCTAssertEqual(RecordItem(id: "e", title: "t", achievedOn: "2026-11-01", status: "logged", backing: pr).by, "Backed by GitHub, approved by @sam")
  }

  func testByYearShowsProofAndWaitingNewestFirst() {
    let items = [
      RecordItem(id: "1", title: "a", achievedOn: "2025-03-01", status: "verified"),
      RecordItem(id: "2", title: "b", achievedOn: "2026-02-01", status: "verified"),
      RecordItem(id: "3", title: "c", achievedOn: "2026-09-01", status: "pending"),
      RecordItem(id: "4", title: "d", achievedOn: "2026-10-01", status: "draft"),
      RecordItem(id: "5", title: "e", achievedOn: "2026-10-02", status: "refused"),
    ]
    let years = RecordLogic.byYear(items)
    XCTAssertEqual(years.map(\.year), [2026, 2025])
    XCTAssertEqual(years[0].items.map(\.id), ["3", "2"], "drafts and declined work stay off the record")
    let c = RecordLogic.counts(items)
    XCTAssertEqual([c.signed, c.backed, c.waiting], [2, 0, 1])
  }

  func testShortDays() {
    let now = ISO8601DateFormatter().date(from: "2026-11-21T12:00:00Z")!
    XCTAssertEqual(RecordLogic.shortDay("2026-11-21", now: now), "Nov 21")
    XCTAssertEqual(RecordLogic.shortDay("2025-03-03", now: now), "Mar 3, 2025")
    XCTAssertEqual(RecordLogic.shortDay("soon", now: now), "soon")
  }

  func testProjectChecks() {
    var p = ProjectDraft(title: "Thrust stand", summary: "A load-cell stand.")
    XCTAssertNil(RecordLogic.problem(p))
    p.link = "http://example.com"; XCTAssertEqual(RecordLogic.problem(p), "The link needs to start with https://")
    p.link = "https://github.com/me/stand"; XCTAssertNil(RecordLogic.problem(p))
    p.completed = true; p.year = "26"; XCTAssertEqual(RecordLogic.problem(p), "The year should look like 2026.")
    p.year = "2026"; XCTAssertNil(RecordLogic.problem(p))
    XCTAssertEqual(RecordLogic.problem(ProjectDraft(title: " ", summary: "x")), "Give it a name.")
    XCTAssertEqual(RecordLogic.problem(ProjectDraft(title: String(repeating: "a", count: 121), summary: "x")), "Keep the name under 120 characters.")
    XCTAssertEqual(RecordLogic.problem(ProjectDraft(title: "a", summary: "")), "Say in a line what it is.")
  }

  func testNoEvidenceNoRequest() {
    let now = ISO8601DateFormatter().date(from: "2026-11-21T12:00:00Z")!
    var m = MilestoneDraft(projectId: "p1", clubId: "rkt", title: "Measured lift on 3 fin shapes", evidence: "", achievedOn: now)
    XCTAssertEqual(RecordLogic.problem(m, now: now), "Add evidence first: a link to the commit, video, photo or doc.")
    m.evidence = "drive.google.com/x"; XCTAssertEqual(RecordLogic.problem(m, now: now), "The evidence link needs to start with https://")
    m.evidence = "https://youtu.be/abc"; XCTAssertNil(RecordLogic.problem(m, now: now))
    m.achievedOn = now.addingTimeInterval(3 * 86_400); XCTAssertEqual(RecordLogic.problem(m, now: now), "Pick the day you did it.")
    m.achievedOn = now; m.clubId = ""; XCTAssertEqual(RecordLogic.problem(m, now: now), "Pick the club that saw it.")
    m.clubId = "rkt"; m.projectId = ""; XCTAssertEqual(RecordLogic.problem(m, now: now), "Pick the project it's part of.")
  }
}
