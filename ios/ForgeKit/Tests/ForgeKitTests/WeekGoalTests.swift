import XCTest
@testable import ForgeKit

// Home's next step: the same answers as the web's weekGoal (web/tests/week.test.ts), so the iPhone
// and the site never suggest different things.
final class WeekGoalTests: XCTestCase {
  private let quiet = WeekInput(toVerify: nil, quietProject: nil, hasClub: true, hasProject: true)

  // web/tests/week.test.ts: "the week's goal: others first, then what makes your work verifiable, then the streak"
  func testOthersFirstThenWhatMakesYourWorkVerifiableThenTheStreak() {
    var base = quiet; base.hasMilestone = true
    func with(_ change: (inout WeekInput) -> Void) -> WeekInput { var w = base; change(&w); return w }

    XCTAssertEqual(WeekLogic.goal(with { $0.toVerify = .init(clubId: "rkt", n: 2) }, shownThisWeek: true).text, "Verify 2 milestones for your club")
    XCTAssertEqual(WeekLogic.goal(with { $0.hasClub = false }, shownThisWeek: false).id, "join")
    XCTAssertEqual(WeekLogic.goal(with { $0.hasProject = false }, shownThisWeek: false).id, "project")
    XCTAssertEqual(WeekLogic.goal(with { $0.hasMilestone = false }, shownThisWeek: false).id, "ask")
    XCTAssertEqual(WeekLogic.goal(base, shownThisWeek: true), WeekGoal(id: "done", text: "You've shown your work this week", href: "/profile", action: "", done: true))
    XCTAssertEqual(WeekLogic.goal(with { $0.quietProject = .init(id: "p1", title: "Test stand", days: 9) }, shownThisWeek: false).text, "Post an update on Test stand")
    XCTAssertEqual(WeekLogic.goal(base, shownThisWeek: false).href, "/feed#composer")
  }

  // The rest of each goal, word for word, so the buttons say what the web's do.
  func testWordingLinksAndActionsMatchTheWeb() {
    var base = quiet; base.hasMilestone = true
    let one = WeekLogic.goal({ var w = base; w.toVerify = .init(clubId: "rkt", n: 1); return w }(), shownThisWeek: false)
    XCTAssertEqual(one, WeekGoal(id: "verify", text: "Verify 1 milestone for your club", href: "/c/rkt/manage?tab=verify", action: "Review", done: false))
    XCTAssertEqual(WeekLogic.goal({ var w = base; w.hasClub = false; return w }(), shownThisWeek: false),
                   WeekGoal(id: "join", text: "Join your club, so its officers can verify your work", href: "/communities?tab=discover", action: "Find it", done: false))
    XCTAssertEqual(WeekLogic.goal({ var w = base; w.hasProject = false; return w }(), shownThisWeek: false),
                   WeekGoal(id: "project", text: "Add what you're building", href: "/projects", action: "Add", done: false))
    XCTAssertEqual(WeekLogic.goal(quiet, shownThisWeek: false),
                   WeekGoal(id: "ask", text: "Ask your club to verify your first milestone", href: "/projects", action: "Ask", done: false), "never asked counts as no milestone, as the web's undefined does")
    XCTAssertEqual(WeekLogic.goal({ var w = base; w.quietProject = .init(id: "p1", title: "Test stand", days: 0); return w }(), shownThisWeek: false),
                   WeekGoal(id: "update", text: "Post an update on Test stand", href: "/feed?project=p1#composer", action: "Post", done: false), "any active project, however recent")
    XCTAssertEqual(WeekLogic.goal(base, shownThisWeek: false),
                   WeekGoal(id: "share", text: "Share what you built this week", href: "/feed#composer", action: "Post", done: false))
  }

  // Order matters past the first: no club beats no project, which beats never asking.
  func testOrderWhenSeveralApply() {
    let none = WeekInput(toVerify: nil, quietProject: nil, hasClub: false, hasProject: false, hasMilestone: false)
    XCTAssertEqual(WeekLogic.goal(none, shownThisWeek: true).id, "join", "a week's posts don't skip joining a club")
    XCTAssertEqual(WeekLogic.goal({ var w = none; w.hasClub = true; return w }(), shownThisWeek: true).id, "project")
    XCTAssertEqual(WeekLogic.goal({ var w = none; w.toVerify = .init(clubId: "c", n: 0); return w }(), shownThisWeek: false).id, "join", "zero waiting isn't waiting")
  }

  // Weeks start Monday 00:00 UTC (web/src/lib/streak.ts weekStart, tests/streak.test.ts).
  func testWeekStartsMondayUTC() {
    let iso = ISO8601DateFormatter()
    let monday = iso.date(from: "2026-11-16T00:00:00Z")!
    XCTAssertEqual(WeekLogic.weekStart(iso.date(from: "2026-11-19T15:30:00Z")!), monday, "Thursday")
    XCTAssertEqual(WeekLogic.weekStart(iso.date(from: "2026-11-22T23:59:59Z")!), monday, "Sunday night is still the same week")
    XCTAssertEqual(WeekLogic.weekStart(monday), monday)
    XCTAssertEqual(WeekLogic.weekStart(iso.date(from: "2026-11-23T00:00:00Z")!), iso.date(from: "2026-11-23T00:00:00Z")!)
  }

  func testShownThisWeekCountsOnlyThisWeeksWorkUpToNow() {
    let iso = ISO8601DateFormatter()
    let now = iso.date(from: "2026-11-19T12:00:00Z")!
    XCTAssertFalse(WeekLogic.shownThisWeek([], now: now))
    XCTAssertTrue(WeekLogic.shownThisWeek([iso.date(from: "2026-11-16T00:00:01Z")!], now: now))
    XCTAssertFalse(WeekLogic.shownThisWeek([iso.date(from: "2026-11-15T23:59:59Z")!], now: now), "last Sunday is last week")
    XCTAssertFalse(WeekLogic.shownThisWeek([iso.date(from: "2026-11-20T09:00:00Z")!], now: now), "a future time doesn't count")
  }

  // week-load.ts: the club with the most waiting; ties to the first seen.
  func testTopWaitingPicksTheBusiestClub() {
    XCTAssertNil(WeekLogic.topWaiting([]))
    XCTAssertEqual(WeekLogic.topWaiting(["a", "b", "b", "a", "b"]), .init(clubId: "b", n: 3))
    XCTAssertEqual(WeekLogic.topWaiting(["a", "b", "b", "a"]), .init(clubId: "a", n: 2))
  }

  // week-load.ts: the active project with the longest gap since its last post or change.
  func testQuietestActiveProject() {
    let now = ISO8601DateFormatter().date(from: "2026-11-19T12:00:00Z")!
    func ago(_ days: Double) -> Date { now.addingTimeInterval(-days * 86_400) }
    let rows: [WeekLogic.ProjectRow] = [
      .init(id: "a", title: "Arm", status: "active", updatedAt: ago(2)),
      .init(id: "b", title: "Bench", status: "active", updatedAt: ago(20)),
      .init(id: "c", title: "Cansat", status: "completed", updatedAt: ago(90)),
    ]
    XCTAssertEqual(WeekLogic.quietest(rows, lastPost: [:], now: now), .init(id: "b", title: "Bench", days: 20), "completed projects aren't nagged")
    XCTAssertEqual(WeekLogic.quietest(rows, lastPost: ["b": ago(1)], now: now), .init(id: "a", title: "Arm", days: 2), "a recent post counts as an update")
    XCTAssertEqual(WeekLogic.quietest(rows, lastPost: ["a": ago(30)], now: now)?.id, "b", "an old post doesn't beat a newer change")
    XCTAssertEqual(WeekLogic.quietest([rows[0], .init(id: "d", title: "Drone", status: "active", updatedAt: ago(2))], lastPost: [:], now: now)?.id, "a", "ties to the first")
    XCTAssertNil(WeekLogic.quietest([rows[2]], lastPost: [:], now: now))
  }
}
