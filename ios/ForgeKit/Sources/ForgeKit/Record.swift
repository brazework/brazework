import Foundation
import Supabase

// The signed record on iPhone: your milestones and who stood behind each (the web's Record,
// web/src/app/(app)/u/[id]/page.tsx and lib/record-years.ts), adding a project
// (lib/projects.ts saveProject), logging a milestone and asking your club to verify it
// (lib/milestones.ts addMilestone), and officers verifying (review_milestone()). The database
// enforces every rule (supabase/milestones.sql, verification.sql, backed.sql, project-access.sql);
// the checks here mirror them so the form says what's wrong before the round trip. Asking a person
// to sign stays on the web: it mails them a private link only the server may hold (lib/vouches.ts).

/// The three kinds of proof, one colour each everywhere (green signed, blue backed, amber waiting).
enum ProofKind: String, Sendable { case signed, backed, waiting, draft, refused, other }

struct RecordItem: Identifiable, Hashable, Sendable, Decodable {
  struct ProjectRef: Decodable, Hashable, Sendable { var title: String }
  struct Backing: Decodable, Hashable, Sendable { var kind: String?; var repoFullName: String?; var url: String?; var approvers: [String]? }
  let id: String
  var projectId: String
  var communityId: String?
  var communityName: String?
  var title: String
  var detail: String?
  var evidence: String?
  var achievedOn: String
  var status: String
  var reviewerName: String?
  var reviewerRole: String?
  var vouchedBy: String?
  var `private`: Bool?
  var project: ProjectRef?
  var backing: Backing?

  enum CodingKeys: String, CodingKey { case id, projectId, communityId, communityName, title, detail, evidence, achievedOn, status, reviewerName, reviewerRole, vouchedBy, `private`, project, milestoneBackings }

  init(from d: Decoder) throws {
    let c = try d.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    projectId = try c.decode(String.self, forKey: .projectId)
    communityId = try c.decodeIfPresent(String.self, forKey: .communityId)
    communityName = try c.decodeIfPresent(String.self, forKey: .communityName)
    title = try c.decode(String.self, forKey: .title)
    detail = try c.decodeIfPresent(String.self, forKey: .detail)
    evidence = try c.decodeIfPresent(String.self, forKey: .evidence)
    achievedOn = try c.decode(String.self, forKey: .achievedOn)
    status = try c.decode(String.self, forKey: .status)
    reviewerName = try c.decodeIfPresent(String.self, forKey: .reviewerName)
    reviewerRole = try c.decodeIfPresent(String.self, forKey: .reviewerRole)
    vouchedBy = try c.decodeIfPresent(String.self, forKey: .vouchedBy)
    `private` = try c.decodeIfPresent(Bool.self, forKey: .private)
    project = try c.decodeIfPresent(ProjectRef.self, forKey: .project)
    // A one-to-one embed comes back as an object, or as a list on older PostgREST: take either.
    backing = (try? c.decodeIfPresent(Backing.self, forKey: .milestoneBackings)) ?? (try? c.decodeIfPresent([Backing].self, forKey: .milestoneBackings))?.first
  }

  init(id: String, projectId: String = "p", communityId: String? = nil, communityName: String? = nil, title: String, achievedOn: String, status: String, reviewerName: String? = nil, reviewerRole: String? = nil, vouchedBy: String? = nil, backing: Backing? = nil) {
    self.id = id; self.projectId = projectId; self.communityId = communityId; self.communityName = communityName; self.title = title
    self.achievedOn = achievedOn; self.status = status; self.reviewerName = reviewerName; self.reviewerRole = reviewerRole; self.vouchedBy = vouchedBy; self.backing = backing
  }

  var kind: ProofKind { RecordLogic.kind(status: status, backed: backing != nil) }
  /// Who stood behind it, in the web's words.
  var by: String { RecordLogic.by(self) }
  var year: Int { Int(achievedOn.prefix(4)) ?? 0 }
}

/// A pending milestone in a club's verify queue (the web's /c/<id>/manage?tab=verify).
struct QueueItem: Identifiable, Hashable, Sendable, Decodable {
  struct ProjectRef: Decodable, Hashable, Sendable { var title: String; var summary: String? }
  struct Owner: Decodable, Hashable, Sendable { var firstName: String; var lastName: String; var headline: String? }
  let id: String
  var ownerId: UUID
  var title: String
  var detail: String?
  var evidence: String?
  var achievedOn: String
  var project: ProjectRef?
  var owner: Owner?
  var ownerName: String { owner.map { "\($0.firstName) \($0.lastName)".trimmingCharacters(in: .whitespaces) } ?? "A member" }
}

struct ProjectDraft: Sendable {
  var title = ""
  var summary = ""
  var details = ""
  var link = ""
  var completed = false
  var year = ""
  var isPrivate = false
}

struct MilestoneDraft: Sendable {
  var projectId = ""
  /// The club asked to verify it.
  var clubId = ""
  var title = ""
  var detail = ""
  var evidence = ""
  var achievedOn = Date.now
  var showOnProfile = true
  /// Asking a person who saw it instead of a club: their email and how they know the work.
  var byPerson = false
  var signerEmail = ""
  var relationship = "mentor"
  /// A working account's LinkedIn link, when the ask needs one first.
  var linkedin = ""
}

/// How a signer knows the work, in the web's words (web/src/lib/vouch-email.ts RELATIONSHIPS).
enum Signers {
  static let relationships: [(id: String, label: String)] = [("professor", "Professor"), ("ta", "TA"), ("pi", "Lab PI"), ("manager", "Manager"), ("mentor", "Mentor"), ("other", "Someone else who saw it")]
}

enum RecordLogic {
  static func kind(status: String, backed: Bool) -> ProofKind {
    switch status {
    case "verified": .signed
    case "logged": backed ? .backed : .draft
    case "pending", "disputed": .waiting
    case "draft": .draft
    case "refused", "declined": .refused
    default: .other
    }
  }

  /// The web's "by": the person's own words for a person signature ("Dana Ruiz, Lead · acme.com"),
  /// else the officer and the club, else GitHub.
  static func by(_ m: RecordItem) -> String {
    switch m.kind {
    case .signed:
      if let v = m.vouchedBy, !v.isEmpty { return "Signed by \(v)" }
      // "Maya P. (admin)", as the web shows the officer who verified it.
      let officer = m.reviewerName.flatMap { $0.isEmpty ? nil : $0 + (m.reviewerRole.map { $0.isEmpty ? "" : " (\($0))" } ?? "") }
      let who = [officer, m.communityName].compactMap { $0?.isEmpty == false ? $0 : nil }
      return who.isEmpty ? "Verified" : "Verified by " + who.joined(separator: ", ")
    case .backed:
      let approvers = m.backing?.approvers ?? []
      return "Backed by GitHub" + (approvers.isEmpty ? "" : ", approved by " + approvers.map { "@\($0)" }.joined(separator: ", "))
    case .waiting:
      return m.communityId != nil ? "Waiting for \(m.communityName ?? "your club")" : "Waiting for a vouch"
    case .refused: return "Not verified"
    case .draft: return "Draft"
    case .other: return m.status.capitalized
    }
  }

  /// Your record by year, newest first: what was signed or backed, plus what's still waiting.
  static func byYear(_ items: [RecordItem]) -> [(year: Int, items: [RecordItem])] {
    let shown = items.filter { [.signed, .backed, .waiting].contains($0.kind) }
    return Dictionary(grouping: shown, by: \.year).map { (year: $0.key, items: $0.value.sorted { $0.achievedOn > $1.achievedOn }) }.sorted { $0.year > $1.year }
  }

  static func counts(_ items: [RecordItem]) -> (signed: Int, backed: Int, waiting: Int) {
    (items.filter { $0.kind == .signed }.count, items.filter { $0.kind == .backed }.count, items.filter { $0.kind == .waiting }.count)
  }

  private static let day: DateFormatter = { let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "UTC"); f.dateFormat = "yyyy-MM-dd"; return f }()
  static func dayString(_ d: Date) -> String { day.string(from: d) }

  /// "Nov 21" this year, "Mar 3, 2025" before it (the day a milestone was achieved, "2026-11-21").
  static func shortDay(_ s: String, now: Date = .now) -> String {
    guard let d = day.date(from: String(s.prefix(10))) else { return s }
    let f = DateFormatter(); f.locale = Locale(identifier: "en_US"); f.timeZone = TimeZone(identifier: "UTC")
    f.dateFormat = s.prefix(4) == dayString(now).prefix(4) ? "MMM d" : "MMM d, yyyy"
    return f.string(from: d)
  }

  static func isHTTPS(_ s: String) -> Bool {
    guard let u = URL(string: s), u.scheme == "https", let host = u.host(), host.contains(".") else { return false }
    return true
  }

  /// What's wrong with a project before it's saved (projects.sql checks), or nil.
  static func problem(_ p: ProjectDraft) -> String? {
    let title = p.title.trimmingCharacters(in: .whitespacesAndNewlines), summary = p.summary.trimmingCharacters(in: .whitespacesAndNewlines)
    if title.isEmpty { return "Give it a name." }
    if title.count > 120 { return "Keep the name under 120 characters." }
    if summary.isEmpty { return "Say in a line what it is." }
    if summary.count > 600 { return "Keep the summary under 600 characters." }
    if p.details.count > 5000 { return "Keep the write-up under 5,000 characters." }
    let link = p.link.trimmingCharacters(in: .whitespaces)
    if !link.isEmpty, !isHTTPS(link) { return "The link needs to start with https://" }
    if p.completed, !p.year.isEmpty, !(Int(p.year).map { (1950...2100).contains($0) } ?? false) { return "The year should look like 2026." }
    return nil
  }

  /// What's wrong with a milestone before it's sent (milestones.sql and backed.sql checks), or nil.
  /// Evidence is required: "no evidence, no request".
  static func problem(_ m: MilestoneDraft, now: Date = .now) -> String? {
    let title = m.title.trimmingCharacters(in: .whitespacesAndNewlines), evidence = m.evidence.trimmingCharacters(in: .whitespaces)
    if m.projectId.isEmpty { return "Pick the project it's part of." }
    if title.isEmpty { return "Say what you did, with a number if you have one." }
    if title.count > 120 { return "Keep it under 120 characters." }
    if m.detail.count > 600 { return "Keep the detail under 600 characters." }
    if evidence.isEmpty { return "Add evidence first: a link to the commit, video, photo or doc." }
    if !isHTTPS(evidence) { return "The evidence link needs to start with https://" }
    if evidence.count > 300 { return "That link is too long (300 characters at most)." }
    let d = dayString(m.achievedOn)
    if d < "2000-01-01" || d > dayString(now.addingTimeInterval(86_400)) { return "Pick the day you did it." }
    if m.byPerson {
      let e = m.signerEmail.trimmingCharacters(in: .whitespaces)
      if e.isEmpty { return "Enter the email of the person who saw it." }
      if !(e.contains("@") && e.split(separator: "@").last?.contains(".") == true) { return "Enter their email address." }
      if !Signers.relationships.contains(where: { $0.id == m.relationship }) { return "Pick how they know your work." }
      return nil
    }
    if m.clubId.isEmpty { return "Pick the club that saw it." }
    return nil
  }
}

extension API {
  /// Everything on your record, newest first (the web's milestoneCols, minus what iPhone doesn't show).
  static func record(of owner: UUID) async throws -> [RecordItem] {
    try await supabase.from("milestones")
      .select("id, project_id, community_id, community_name, title, detail, evidence, achieved_on, status, reviewer_name, reviewer_role, vouched_by, private, project:projects(title), milestone_backings(kind, repo_full_name, url, approvers)")
      .eq("owner_id", value: owner).order("achieved_on", ascending: false).limit(300).execute().value
  }

  /// A project's milestones, newest first.
  static func milestones(project: String) async throws -> [RecordItem] {
    try await supabase.from("milestones")
      .select("id, project_id, community_id, community_name, title, detail, evidence, achieved_on, status, reviewer_name, reviewer_role, vouched_by, private, milestone_backings(kind, repo_full_name, url, approvers)")
      .eq("project_id", value: project).order("achieved_on", ascending: false).limit(100).execute().value
  }

  /// Adds a project of yours; returns its id. The write-up and link go in project_details, as on the web.
  @discardableResult
  static func createProject(_ p: ProjectDraft) async throws -> String {
    struct Row: Encodable { let title: String; let summary: String; let status: String; let year: Int?; let tags: [String]; let `private`: Bool }
    struct Details: Encodable { let projectId: String; let details: String; let link: String }
    struct Made: Decodable { let id: String }
    let year = p.completed ? Int(p.year) : nil
    let made: Made = try await supabase.from("projects")
      .insert(Row(title: p.title.trimmingCharacters(in: .whitespacesAndNewlines), summary: p.summary.trimmingCharacters(in: .whitespacesAndNewlines), status: p.completed ? "completed" : "in_progress", year: year, tags: [], private: p.isPrivate))
      .select("id").single().execute().value
    let details = p.details.trimmingCharacters(in: .whitespacesAndNewlines), link = p.link.trimmingCharacters(in: .whitespaces)
    if !details.isEmpty || !link.isEmpty {
      try await supabase.from("project_details").insert(Details(projectId: made.id, details: details, link: link)).execute()
    }
    return made.id
  }

  /// Logs a milestone and asks your club to verify it. The database copies the club's name, tells its
  /// officers, and refuses it without evidence or past 20 open asks.
  static func askClub(_ m: MilestoneDraft) async throws {
    struct Row: Encodable { let projectId: String; let communityId: String; let title: String; let detail: String; let evidence: String; let achievedOn: String; let `private`: Bool }
    try await supabase.from("milestones").insert(Row(
      projectId: m.projectId, communityId: m.clubId, title: m.title.trimmingCharacters(in: .whitespacesAndNewlines),
      detail: m.detail.trimmingCharacters(in: .whitespacesAndNewlines), evidence: m.evidence.trimmingCharacters(in: .whitespaces),
      achievedOn: RecordLogic.dayString(m.achievedOn), private: !m.showOnProfile)).execute()
  }

  /// Asks a person who saw it to sign a new milestone, through the website (web/src/app/api/signatures):
  /// the signer's private link is made and mailed there, so the member never holds it. Throws the
  /// website's sentence; `.needsLinkedin` when a working account must add its LinkedIn link first.
  static func askPerson(_ m: MilestoneDraft) async throws {
    var req = URLRequest(url: Env.web("api/signatures"))
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer \(try await supabase.auth.session.accessToken)", forHTTPHeaderField: "Authorization")
    var body: [String: Any] = [
      "email": m.signerEmail.trimmingCharacters(in: .whitespaces), "relationship": m.relationship,
      "milestone": ["project_id": m.projectId, "title": m.title.trimmingCharacters(in: .whitespacesAndNewlines), "detail": m.detail.trimmingCharacters(in: .whitespacesAndNewlines),
                    "evidence": m.evidence.trimmingCharacters(in: .whitespaces), "achieved_on": RecordLogic.dayString(m.achievedOn), "show_on_profile": m.showOnProfile],
    ]
    if !m.linkedin.isEmpty { body["linkedin"] = m.linkedin.trimmingCharacters(in: .whitespaces) }
    req.httpBody = try JSONSerialization.data(withJSONObject: body)
    let (data, response) = try await URLSession.shared.data(for: req)
    let reply = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    guard (response as? HTTPURLResponse)?.statusCode == 200 else {
      let message = reply?["message"] as? String ?? "We couldn't send the ask. Try again in a minute."
      throw reply?["linkedin"] as? Bool == true ? SignatureError.needsLinkedin(message) : SignatureError.refused(message)
    }
  }

  /// What's waiting for a club's officers to verify, oldest first.
  static func verifyQueue(club: String) async throws -> [QueueItem] {
    try await supabase.from("milestones")
      .select("id, owner_id, title, detail, evidence, achieved_on, project:projects(title, summary), owner:profiles!milestones_owner_id_fkey(first_name, last_name, headline)")
      .eq("community_id", value: club).eq("status", value: "pending").order("created_at").limit(100).execute().value
  }

  /// Verify or decline (review_milestone): returns "verified", "pending" (a second officer is
  /// needed) or "refused". The database refuses your own team's work and caps approvals per week.
  static func review(_ id: String, verify: Bool, note: String = "") async throws -> String {
    try await supabase.rpc("review_milestone", params: ["p_id": AnyJSON.string(id), "p_verify": .bool(verify), "p_note": .string(String(note.prefix(300)))]).execute().value
  }
}

enum SignatureError: LocalizedError {
  case needsLinkedin(String), refused(String)
  var errorDescription: String? { switch self { case .needsLinkedin(let m), .refused(let m): m } }
}
