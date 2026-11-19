import Foundation

// Home's one next step on iPhone: the web's weekly goal (web/src/lib/week.ts weekGoal, loaded by
// loadLoop in web/src/lib/week-load.ts), ported so the phone and the site suggest the same thing.
// Others waiting on you first, then what makes your work verifiable, then keeping your weekly
// streak. Done as soon as you've shown work this week. Pure, so it's tested (WeekGoalTests.swift
// mirrors web/tests/week.test.ts); API.weekGoal(me:) reads the same rows the web does.

/// The parts of the web's WeekInput that the goal reads.
struct WeekInput: Hashable, Sendable {
  struct Waiting: Hashable, Sendable { var clubId: String; var n: Int }
  struct Quiet: Hashable, Sendable { var id: String; var title: String; var days: Int }
  /// Milestones waiting for you to verify, in the club (where you're an officer) with the most.
  var toVerify: Waiting?
  /// Your active project with the longest gap since its last update.
  var quietProject: Quiet?
  var hasClub = false
  var hasProject = false
  /// Whether you've ever asked your club to verify a milestone (any status).
  var hasMilestone = false
}

struct WeekGoal: Hashable, Sendable {
  /// verify, join, project, ask, done, update or share (the web's ids).
  let id: String
  let text: String
  /// The web's link for it, a path on the site ("/projects", "/c/rkt/manage?tab=verify").
  let href: String
  let action: String
  let done: Bool
}

enum WeekLogic {
  private static func plural(_ n: Int, _ one: String) -> String { "\(n) \(n == 1 ? one : one + "s")" }

  /// This week's goal: the one action most worth taking, from the member's real state.
  static func goal(_ w: WeekInput, shownThisWeek: Bool) -> WeekGoal {
    if let v = w.toVerify, v.n > 0 {
      return .init(id: "verify", text: "Verify \(plural(v.n, "milestone")) for your club", href: "/c/\(v.clubId)/manage?tab=verify", action: "Review", done: false)
    }
    if !w.hasClub { return .init(id: "join", text: "Join your club, so its officers can verify your work", href: "/communities?tab=discover", action: "Find it", done: false) }
    if !w.hasProject { return .init(id: "project", text: "Add what you're building", href: "/projects", action: "Add", done: false) }
    if !w.hasMilestone { return .init(id: "ask", text: "Ask your club to verify your first milestone", href: "/projects", action: "Ask", done: false) }
    if shownThisWeek { return .init(id: "done", text: "You've shown your work this week", href: "/profile", action: "", done: true) }
    if let q = w.quietProject { return .init(id: "update", text: "Post an update on \(q.title)", href: "/feed?project=\(q.id)#composer", action: "Post", done: false) }
    return .init(id: "share", text: "Share what you built this week", href: "/feed#composer", action: "Post", done: false)
  }

  // MARK: The pieces loadLoop works out from rows, kept pure so they're tested too.

  private static let day: TimeInterval = 86_400
  private static let utc: Calendar = { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "UTC")!; return c }()

  /// Monday 00:00 UTC of the week holding `t`, like the rest of the app (web/src/lib/streak.ts weekStart).
  static func weekStart(_ t: Date) -> Date {
    let midnight = utc.startOfDay(for: t)
    let mondayIndex = (utc.component(.weekday, from: t) + 5) % 7 // Sunday = 1 → 6, Monday = 2 → 0
    return midnight.addingTimeInterval(-Double(mondayIndex) * day)
  }

  /// Whether you've shown work (a post or a milestone) this week: the streak's thisWeek (buildStreak).
  static func shownThisWeek(_ times: [Date], now: Date) -> Bool {
    let current = weekStart(now)
    return times.contains { $0 <= now && weekStart($0) == current }
  }

  /// The club with the most milestones waiting for you (one entry per pending milestone, in row
  /// order); ties go to the club seen first, as the web's stable sort does.
  static func topWaiting(_ clubIds: [String]) -> WeekInput.Waiting? {
    var counts: [String: Int] = [:], order: [String] = []
    for id in clubIds { if counts[id] == nil { order.append(id) }; counts[id, default: 0] += 1 }
    var best: WeekInput.Waiting?
    for id in order where counts[id]! > (best?.n ?? 0) { best = .init(clubId: id, n: counts[id]!) }
    return best
  }

  struct ProjectRow: Hashable, Sendable { var id: String; var title: String; var status: String; var updatedAt: Date }

  /// Your active project with the longest gap since its last update post (or since it changed).
  /// `projects` are your newest five by update; `lastPost` is each project's newest post of yours.
  static func quietest(_ projects: [ProjectRow], lastPost: [String: Date], now: Date) -> WeekInput.Quiet? {
    let gaps = projects.filter { $0.status != "completed" }.map { p in
      let last = max(lastPost[p.id] ?? .distantPast, p.updatedAt)
      return WeekInput.Quiet(id: p.id, title: p.title, days: Int((now.timeIntervalSince(last) / day).rounded(.down)))
    }
    // Stable: the first of equal gaps wins, like the web's sort.
    return gaps.enumerated().max { a, b in a.element.days != b.element.days ? a.element.days < b.element.days : a.offset > b.offset }?.element
  }
}
