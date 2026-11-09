import XCTest
@testable import ForgeKit

final class FeedRankTests: XCTestCase {
  private let now = Date(timeIntervalSince1970: 1_800_000_000)
  private func post(_ id: String, hoursAgo: Double, kind: String = "update", tags: [String] = [], likes: Int = 0, comments: Int = 0, club: String? = nil) -> Post {
    Post(id: id, authorId: UUID(), authorFirst: "A", authorLast: "B", authorHeadline: "", communityId: club.map { _ in "c1" }, communityName: club,
         body: "x", kind: kind, tags: tags, likeCount: likes, commentCount: comments, createdAt: now.addingTimeInterval(-hoursAgo * 3600), media: nil, author: nil)
  }

  func testYourNewPostGoesFirst() {
    let ranked = FeedRank.rank([.mine: [post("mine", hoursAgo: 2)], .club: [post("club", hoursAgo: 0.1, club: "Rocketry")]], interests: [], now: now)
    XCTAssertEqual(ranked.first?.id, "mine")
    XCTAssertEqual(ranked.first?.reason, "")
  }

  func testClubBeatsNewerRandomPostAndSaysWhy() {
    let ranked = FeedRank.rank([.recent: [post("new", hoursAgo: 1)], .club: [post("club", hoursAgo: 20, club: "Rocketry")]], interests: [], now: now)
    XCTAssertEqual(ranked.map(\.id), ["club", "new"])
    XCTAssertEqual(ranked.first?.reason, "From your club Rocketry")
  }

  func testInterestReasonAndDedupe() {
    let p = post("p", hoursAgo: 5, tags: ["Robotics"])
    let ranked = FeedRank.rank([.recent: [p], .interest: [p]], interests: ["Robotics"], now: now)
    XCTAssertEqual(ranked.count, 1)
    XCTAssertEqual(ranked.first?.reason, "Matches your interest: Robotics")
  }

  func testMatchesWebScoring() {
    // Same numbers as web/src/lib/feed-rank.ts: -age + 48 (club) + 18 (result) + log2(1 + 3 + 2*1) * 6.
    let s = FeedRank.score(post("r", hoursAgo: 10, kind: "result", likes: 3, comments: 1), sources: [.club], interests: [], now: now)
    XCTAssertEqual(s, -10 + 48 + 18 + log2(6) * 6, accuracy: 1e-9)
  }

  func testPostgresDates() {
    XCTAssertNotNil(ForgeJSON.parseDate("2026-11-09T21:35:48.123456+00:00"))
    XCTAssertNotNil(ForgeJSON.parseDate("2026-11-09T21:35:48+00:00"))
    XCTAssertNotNil(ForgeJSON.parseDate("2026-11-09 21:35:48.1+00"))
    XCTAssertEqual(ForgeJSON.parseDate("2026-11-09T21:35:48.500+00:00")?.timeIntervalSince1970.truncatingRemainder(dividingBy: 1) ?? 0, 0.5, accuracy: 0.001)
  }

  func testTimeAgo() {
    XCTAssertEqual(timeAgo(now.addingTimeInterval(-30), now: now), "now")
    XCTAssertEqual(timeAgo(now.addingTimeInterval(-300), now: now), "5m")
    XCTAssertEqual(timeAgo(now.addingTimeInterval(-3 * 3600), now: now), "3h")
    XCTAssertEqual(timeAgo(now.addingTimeInterval(-2 * 86400), now: now), "2d")
  }
}
