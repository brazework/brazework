import Foundation

// @mentions in post text (supabase/mentions.sql), ported from web/src/lib/mention-text.ts.
// A post stores who it mentions as [{ id, name }]; the text keeps the plain "@First Last".
struct Mention: Codable, Hashable, Sendable {
  let id: UUID
  let name: String
}

enum Mentions {
  // Only the people whose "@Name" is still in the text (they may have been deleted while editing).
  static func keep(_ body: String, _ picked: [Mention]) -> [Mention] {
    var seen = Set<UUID>()
    return Array(picked.filter { body.contains("@\($0.name)") && seen.insert($0.id).inserted }.prefix(10))
  }

  enum Part: Hashable { case text(String), mention(Mention) }

  // The text split into plain pieces and mentions, longest names first so "@Ana Lee" wins over "@Ana".
  static func parts(_ body: String, _ mentions: [Mention]?) -> [Part] {
    let list = (mentions ?? []).filter { !$0.name.isEmpty }
    guard !list.isEmpty else { return [.text(body)] }
    let byName = Dictionary(list.map { ($0.name, $0) }, uniquingKeysWith: { a, _ in a })
    let names = byName.keys.sorted { $0.count > $1.count }.map(NSRegularExpression.escapedPattern(for:)).joined(separator: "|")
    guard let re = try? NSRegularExpression(pattern: "@(\(names))(?![\\p{L}\\p{N}])") else { return [.text(body)] }
    var out: [Part] = []
    var last = body.startIndex
    for m in re.matches(in: body, range: NSRange(body.startIndex..., in: body)) {
      guard let whole = Range(m.range, in: body), let name = Range(m.range(at: 1), in: body), let who = byName[String(body[name])] else { continue }
      if whole.lowerBound > last { out.append(.text(String(body[last..<whole.lowerBound]))) }
      out.append(.mention(who))
      last = whole.upperBound
    }
    if last < body.endIndex { out.append(.text(String(body[last...]))) }
    return out
  }

  // The "@query" being typed right before the caret, if any: a word or two after an "@" that starts
  // the text or follows a space. `start` is where the "@" is.
  static func query(_ text: String, caret: String.Index? = nil) -> (start: String.Index, q: String)? {
    let before = String(text[..<(caret ?? text.endIndex)])
    guard let re = try? NSRegularExpression(pattern: "(^|\\s)@([\\p{L}'-]{0,30}(?: [\\p{L}'-]{0,30})?)$"),
          let m = re.firstMatch(in: before, range: NSRange(before.startIndex..., in: before)),
          let at = Range(m.range(at: 2), in: before) else { return nil }
    let atSign = text.index(before: text.index(text.startIndex, offsetBy: before.distance(from: before.startIndex, to: at.lowerBound)))
    return (atSign, String(before[at]))
  }

  // Replaces the "@query" with "@First Last " and returns the new text.
  static func insert(_ person: Mention, into text: String, caret: String.Index? = nil) -> String? {
    guard let q = query(text, caret: caret) else { return nil }
    let end = caret ?? text.endIndex
    return String(text[..<q.start]) + "@\(person.name) " + String(text[end...])
  }
}

struct MentionPerson: Identifiable, Hashable, Sendable {
  let id: UUID
  let first: String
  let last: String
  let headline: String
  let avatarPath: String?
  let follows: Bool
  var name: String { "\(first) \(last)".trimmingCharacters(in: .whitespaces) }
}
