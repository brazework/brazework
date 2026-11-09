import Foundation

// "For you", ported from web/src/lib/feed-rank.ts so both apps rank the same way: posts from your
// clubs, people you follow, your interests and the newest on Forge, merged, scored, and each one
// says why it's there. Pure, so it's unit tested.
enum FeedSource: String, Sendable { case club, follow, interest, mine, recent }

struct RankedPost: Identifiable, Sendable {
  var post: Post
  var reason: String
  var score: Double
  var id: String { post.id }
}

enum FeedRank {
  static func score(_ p: Post, sources: Set<FeedSource>, interests: Set<String>, now: Date) -> Double {
    let age = max(0, now.timeIntervalSince(p.createdAt) / 3600)
    // What you just posted goes first (for 3 hours), so you see it land.
    if sources.contains(.mine) && age < 3 { return 1e6 - age }
    var s = -age
    s += Double(p.tags.filter { interests.contains($0) }.count) * 36
    if sources.contains(.club) { s += 48 }
    if sources.contains(.follow) { s += 30 }
    if p.kind == "result" { s += 18 }
    if p.kind == "question" && p.commentCount == 0 && age < 72 { s += 16 }
    s += log2(1 + Double(p.likeCount) + 2 * Double(p.commentCount)) * 6
    return s
  }

  static func reason(_ p: Post, sources: Set<FeedSource>, interests: Set<String>, followName: String? = nil) -> String {
    if sources.contains(.mine) { return "" }
    if sources.contains(.club), let c = p.communityName, !c.isEmpty { return "From your club \(c)" }
    if sources.contains(.follow) { return followName.map { "Because you follow \($0)" } ?? "From someone you follow" }
    if let m = p.tags.first(where: { interests.contains($0) }) { return "Matches your interest: \(m)" }
    if p.kind == "question" && p.commentCount == 0 { return "Unanswered question" }
    if p.likeCount + p.commentCount >= 5 { return "Popular on Forge" }
    return "New on Forge"
  }

  static func rank(_ sources: [FeedSource: [Post]], interests: [String], now: Date) -> [RankedPost] {
    let mine = Set(interests)
    var byId: [String: (post: Post, src: Set<FeedSource>)] = [:]
    var order: [String] = []
    for (s, list) in sources {
      for p in list {
        if byId[p.id] == nil { order.append(p.id); byId[p.id] = (p, []) }
        byId[p.id]!.src.insert(s)
      }
    }
    return order.compactMap { byId[$0] }
      .map { RankedPost(post: $0.post, reason: reason($0.post, sources: $0.src, interests: mine), score: score($0.post, sources: $0.src, interests: mine, now: now)) }
      .sorted { $0.score > $1.score }
  }
}

// "now", "5m", "3h", "2d", then a date, like the web app.
func timeAgo(_ date: Date, now: Date = .now) -> String {
  let s = max(0, now.timeIntervalSince(date))
  if s < 60 { return "now" }
  if s < 3600 { return "\(Int(s / 60))m" }
  if s < 86_400 { return "\(Int(s / 3600))h" }
  if s < 7 * 86_400 { return "\(Int(s / 86_400))d" }
  return date.formatted(.dateTime.month(.abbreviated).day())
}
