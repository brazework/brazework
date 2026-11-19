import Foundation

// Your builds and your proof on iPhone (the web's Projects and Record places). A build is a project of
// yours with where it stands on the way from built to signed; the one next step is the same rule
// the web uses (web/src/lib/build-step.ts), ported so both say the same thing. Reads only: logging
// an update uses the composer, and asking for a signature opens the project on the web for now.

struct BuildCounts: Hashable, Sendable {
  var updates = 0, verified = 0, waiting = 0
}

struct BuildStep: Hashable, Sendable {
  enum Kind: Sendable { case log, verify, waiting }
  let kind: Kind
  let label: String
  let hint: String
}

enum BuildLogic {
  private static func plural(_ n: Int, _ one: String) -> String { "\(n) \(one)\(n == 1 ? "" : "s")" }

  /// The one thing worth doing next on a build.
  static func next(_ b: BuildCounts) -> BuildStep {
    if b.waiting > 0 { return .init(kind: .waiting, label: "Waiting on a signature", hint: "\(plural(b.waiting, "result")) with the people you asked. Keep logging in the meantime.") }
    if b.verified > 0 { return .init(kind: .log, label: "Log an update", hint: "Signed work reads best next to steady progress.") }
    if b.updates > 0 { return .init(kind: .verify, label: "Get it verified", hint: "Pick a result and ask someone who saw it to sign it.") }
    return .init(kind: .log, label: "Log your first update", hint: "What you built, tested or learned. One line is enough.")
  }

  /// How far a build has got: 0 started, 1 logged, 2 signed.
  static func stage(_ b: BuildCounts) -> Int { b.verified > 0 ? 2 : (b.updates > 0 || b.waiting > 0) ? 1 : 0 }
}

struct Build: Identifiable, Hashable, Sendable {
  let id: String
  var title: String
  var summary: String
  var status: String
  var isPrivate: Bool
  var updatedAt: Date
  var counts = BuildCounts()
  var completed: Bool { status == "completed" }
}

// A result someone signed: the strongest thing on a profile.
struct ProofItem: Codable, Identifiable, Hashable, Sendable {
  struct ProjectRef: Codable, Hashable, Sendable { var title: String }
  let id: String
  var title: String
  var communityName: String?
  var reviewerName: String?
  var reviewedAt: Date?
  var project: ProjectRef?
  /// "Verified by Maya P. · Rocketry Club"
  var signedBy: String {
    let who = (reviewerName ?? "").isEmpty ? nil : reviewerName
    let club = (communityName ?? "").isEmpty ? nil : communityName
    return "Verified" + (who.map { " by \($0)" } ?? "") + (club.map { " · \($0)" } ?? "")
  }
}

extension API {
  /// Your projects, newest activity first, each with its updates, signed results and results waiting.
  static func myBuilds(me: UUID) async throws -> [Build] {
    struct P: Decodable { let id: String; let title: String; let summary: String; let status: String; let `private`: Bool; let updatedAt: Date }
    struct M: Decodable { let projectId: String; let status: String }
    struct U: Decodable { let projectId: String? }
    let ps: [P] = try await supabase.from("projects").select("id, title, summary, status, private, updated_at").eq("owner_id", value: me).order("updated_at", ascending: false).limit(20).execute().value
    guard !ps.isEmpty else { return [] }
    let ids = ps.map(\.id)
    let ms: [M] = (try? await supabase.from("milestones").select("project_id, status").in("project_id", values: ids).limit(2000).execute().value) ?? []
    let us: [U] = (try? await supabase.from("posts").select("project_id").in("project_id", values: ids).limit(2000).execute().value) ?? []
    return ps.map { p in
      var c = BuildCounts()
      c.verified = ms.filter { $0.projectId == p.id && $0.status == "verified" }.count
      c.waiting = ms.filter { $0.projectId == p.id && ($0.status == "pending" || $0.status == "disputed") }.count
      c.updates = us.filter { $0.projectId == p.id }.count
      return Build(id: p.id, title: p.title, summary: p.summary, status: p.status, isPrivate: p.private, updatedAt: p.updatedAt, counts: c)
    }
  }

  /// The results of yours (or anyone's) that someone signed, newest first.
  static func proof(of owner: UUID) async -> [ProofItem] {
    (try? await supabase.from("milestones").select("id, title, community_name, reviewer_name, reviewed_at, project:projects(title)").eq("owner_id", value: owner).eq("status", value: "verified").order("reviewed_at", ascending: false).limit(50).execute().value) ?? []
  }
}
