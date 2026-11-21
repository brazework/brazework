import Foundation
import Supabase

// Ember on iPhone: the same assistant as the web's /copilot, asked through the same route
// (web/src/app/api/copilot/route.ts) with the app's sign-in, so the rules, the tools, the daily
// limit and the Claude key all stay on the server. The answer streams as plain text with frames
// between Record Separators for "Searching clubs…" and for cards Ember prepared
// (web/src/lib/copilot-agent.ts frame/parseStream). The pure parts are tested in EmberTests.swift.

/// Something Ember prepared for the member to confirm (the web's Proposal), kept as its fields.
struct EmberCard: Identifiable, Hashable, Sendable {
  let id: String
  let kind: String
  let fields: [String: String]
  subscript(_ key: String) -> String { fields[key] ?? "" }

  /// What the card is, in a few words.
  var title: String {
    switch kind {
    case "post": "Post"
    case "club_post": "Post to \(self["club_name"])"
    case "milestone": "Ask \(self["club_name"]) to verify"
    case "signature": "Ask someone to sign"
    case "join": "Join \(self["club_name"])"
    case "follow": "Follow \(self["name"])"
    case "event": "Club event: \(self["title"])"
    case "project": "Add project: \(self["title"])"
    case "project_edit": "Update \(self["project_title"])"
    case "review": "\(self["verify"] == "false" ? "Decline" : "Verify") \(self["member"])'s milestone"
    case "rsvp": self["cancel"] == "true" ? "Cancel RSVP: \(self["title"])" : "RSVP: \(self["title"])"
    case "message": "Message \(self["name"])"
    case "invite": "Join \(self["club_name"])"
    case "teammate": "Add \(self["name"]) to \(self["project_title"])"
    default: "Ember's suggestion"
    }
  }

  /// The words the member checks before saying yes.
  var detail: String {
    switch kind {
    case "post", "club_post", "message": self["body"]
    case "milestone", "signature": [self["title"], self["evidence"]].filter { !$0.isEmpty }.joined(separator: "\n")
    case "follow": self["headline"]
    case "project": self["summary"]
    case "review": self["title"]
    case "rsvp": self["where"]
    case "event": self["description"]
    default: ""
    }
  }

  /// Cards the iPhone can carry out itself; the rest finish on the web (verifying, signatures and
  /// projects come to iPhone with the record).
  var native: Bool { ["post", "join", "follow", "rsvp", "message"].contains(kind) }

  /// Where a web-only card is finished.
  var webPath: String {
    switch kind {
    case "review": "/c/\(self["club_id"])/manage?tab=verify"
    case "event", "club_post", "join", "invite": "/c/\(self["club_id"])"
    default: "/projects"
    }
  }

  var confirmLabel: String {
    switch kind {
    case "post": "Post it"
    case "join": "Join"
    case "follow": "Follow"
    case "rsvp": self["cancel"] == "true" ? "Cancel RSVP" : "Save my spot"
    case "message": "Send"
    default: "Finish on the web"
    }
  }
}

/// One of the one-tap things in Ember's composer (web/src/lib/ember-actions.ts, word for word).
struct EmberAction: Identifiable, Hashable, Sendable {
  let id: String
  let label: String
  let text: String
  /// Set when the action only starts the sentence and the member finishes it.
  var finish: String?
}

enum EmberLogic {
  static let rs: Character = "\u{1E}"

  /// The web's TOOL_LABEL "doing" words, so a lookup shows the same line on both.
  static let toolLabel: [String: String] = [
    "search_clubs": "Searching clubs", "upcoming_events": "Checking upcoming events", "find_people": "Finding people",
    "my_profile": "Reading your profile", "my_record": "Reading your signed work", "whats_new": "Checking what's new",
    "propose_project_edit": "Drafting a project update", "club_overview": "Looking at your club", "propose_post": "Drafting a post",
    "propose_milestone": "Drafting a milestone", "propose_signature": "Drafting an ask to sign", "propose_join_club": "Preparing to join",
    "propose_follow": "Preparing a follow", "propose_event": "Drafting an event", "club_report": "Reading this week's club report",
    "verify_queue": "Checking the verification queue", "propose_club_post": "Drafting a club post", "propose_review": "Preparing a review",
    "github_repo": "Reading the GitHub repo", "github_user": "Looking at their GitHub", "propose_project": "Drafting a project",
    "propose_rsvp": "Saving you a spot", "propose_message": "Drafting a message",
  ]

  static func doing(_ tool: String) -> String { toolLabel[tool] ?? "Looking things up" }

  /// The web's parseStream: text outside the separators, frames inside. A frame still arriving
  /// (half its JSON) is skipped until the rest comes.
  static func parse(_ raw: String) -> (text: String, tools: [String], cards: [EmberCard]) {
    var text = "", tools: [String] = [], cards: [EmberCard] = []
    for (i, part) in raw.split(separator: rs, omittingEmptySubsequences: false).enumerated() {
      if i % 2 == 0 { text += part; continue }
      guard let obj = (try? JSONSerialization.jsonObject(with: Data(part.utf8))) as? [String: Any] else { continue }
      if let tool = obj["tool"] as? String { tools.append(tool) }
      if let p = obj["proposal"] as? [String: Any], let card = card(p) { cards.append(card) }
    }
    return (text, tools, cards)
  }

  static func card(_ p: [String: Any]) -> EmberCard? {
    guard let kind = p["kind"] as? String else { return nil }
    var fields: [String: String] = [:]
    for (k, v) in p {
      switch v {
      case let s as String: fields[k] = s
      case let b as Bool: fields[k] = b ? "true" : "false"
      case let n as NSNumber: fields[k] = n.stringValue
      case let a as [Any]: fields[k] = a.compactMap { $0 as? String }.joined(separator: ", ")
      default: break
      }
    }
    return EmberCard(id: fields["id"] ?? UUID().uuidString, kind: kind, fields: fields)
  }

  static func actions(field: String, student: Bool) -> [EmberAction] {
    let f = field.trimmingCharacters(in: .whitespaces)
    return [
      .init(id: "log", label: "Log what I did", text: "Today I ", finish: "Say what you finished, with a number if you have one. Ember turns it into a milestone for you to check."),
      .init(id: "post", label: "Write a post", text: "Turn these notes into a post: ", finish: "Paste your notes. Ember writes the post and shows it to you first."),
      .init(id: "github", label: "Add from GitHub", text: "Add my GitHub repo to my record: github.com/", finish: "Finish the address. Ember reads the README and drafts the project."),
      student ? .init(id: "sign", label: "Get it verified", text: "Help me get my latest milestone verified by my club.")
              : .init(id: "sign", label: "Get it signed", text: "Help me ask someone who saw my latest milestone to sign it."),
      student ? .init(id: "review", label: "Résumé bullets", text: "Write résumé bullets from my verified work.")
              : .init(id: "review", label: "Prep my review", text: "Write my self-review for the last six months from my signed work."),
      .init(id: "story", label: "Tell my story", text: "Tell the story of my record so far, year by year."),
      .init(id: "event", label: "Find an event", text: "Find an event this week that fits me and RSVP me."),
      .init(id: "people", label: "Meet people", text: "Find someone in \(f.isEmpty ? "my field" : f) worth meeting and draft an intro message."),
    ]
  }

  static func greeting(_ first: String) -> String {
    let f = first.trimmingCharacters(in: .whitespaces)
    return f.isEmpty ? "What are we getting done?" : "Hi \(f), what are we getting done?"
  }

  /// The chat so far, as the route accepts it: the last 12 turns, each at most 6,000 characters.
  static func history(_ turns: [(user: Bool, text: String)]) -> [[String: String]] {
    turns.filter { !$0.text.isEmpty }.suffix(12).map { ["role": $0.user ? "user" : "assistant", "content": String($0.text.prefix(6000))] }
  }
}

enum EmberError: LocalizedError {
  case server(String)
  var errorDescription: String? { if case .server(let m) = self { m } else { nil } }
}

extension API {
  /// Asks Ember and calls `onRaw` with everything received so far, as it streams.
  /// Returns how many questions are left today (the route's X-Copilot-Remaining), if it said.
  @discardableResult
  static func askEmber(_ input: String, history: [[String: String]], onRaw: @Sendable @escaping (String) async -> Void) async throws -> Int? {
    var req = URLRequest(url: Env.web("api/copilot"))
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer \(try await supabase.auth.session.accessToken)", forHTTPHeaderField: "Authorization")
    var body: [String: Any] = ["task": "ask", "input": String(input.prefix(4000))]
    if !history.isEmpty { body["history"] = history }
    req.httpBody = try JSONSerialization.data(withJSONObject: body)
    req.timeoutInterval = 120

    let (bytes, response) = try await URLSession.shared.bytes(for: req)
    let http = response as? HTTPURLResponse
    if http?.statusCode != 200 {
      var data = Data()
      for try await b in bytes { data.append(b) }
      let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["message"] as? String
      throw EmberError.server(message ?? "Ember isn't available right now. Try again in a minute.")
    }
    let left = (http?.value(forHTTPHeaderField: "X-Copilot-Remaining")).flatMap(Int.init)
    var data = Data(), last = Date.distantPast
    for try await b in bytes {
      data.append(b)
      // Redraw about 20 times a second, not per byte.
      if Date.now.timeIntervalSince(last) > 0.05 { last = .now; await onRaw(String(decoding: data, as: UTF8.self)) }
    }
    await onRaw(String(decoding: data, as: UTF8.self))
    return left
  }

  /// Join a club Ember suggested: public clubs at once, the others as a request.
  static func joinClub(id: String, privacy: String, me: UUID) async throws {
    struct Member: Encodable { let communityId: String; let uid: UUID; let role: String }
    struct Request: Encodable { let communityId: String }
    if privacy == "public" { try await supabase.from("community_members").insert(Member(communityId: id, uid: me, role: "member")).execute() }
    else { try await supabase.from("community_requests").insert(Request(communityId: id)).execute() }
  }
}
