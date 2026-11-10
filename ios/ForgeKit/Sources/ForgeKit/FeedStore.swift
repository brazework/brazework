import Foundation
import Observation
import Supabase

private struct PostRef: Decodable { let postId: String }
private struct ClubRef: Decodable { let communityId: String }
private struct FollowRef: Decodable { let target: UUID }

enum FeedTab: String, CaseIterable, Identifiable { case forYou = "For you", latest = "Latest", following = "Following"; var id: String { rawValue } }

@MainActor @Observable
final class FeedStore {
  var tab: FeedTab = .forYou
  var items: [RankedPost] = []
  var liked: Set<String> = []
  var saved: Set<String> = []
  var loading = false
  var loaded = false
  var error: String?
  private var withAvatars: Bool?
  typealias Query = @Sendable (PostgrestFilterBuilder) -> PostgrestTransformBuilder

  // Posts with the author's photo (media.sql) where that's set up, plain posts otherwise.
  nonisolated private static func fetch(_ avatars: Bool, _ build: Query) async throws -> [Post] {
    try await build(supabase.from("posts").select(avatars ? "*, author:profiles!posts_author_id_fkey(avatar_path)" : "*")).execute().value
  }
  nonisolated private static func fetchIf(_ cond: Bool, _ avatars: Bool, _ build: Query) async throws -> [Post] {
    guard cond else { return [] }
    return try await fetch(avatars, build)
  }

  func load(me: UUID, interests: [String]) async {
    loading = true; error = nil
    defer { loading = false; loaded = true }
    do {
      if withAvatars == nil {
        do { _ = try await Self.fetch(true) { $0.limit(1) }; withAvatars = true } catch { withAvatars = false }
      }
      let av = withAvatars ?? false
      async let clubRows: [ClubRef] = supabase.from("community_members").select("community_id").eq("uid", value: me).limit(200).execute().value
      async let followRows: [FollowRef] = supabase.from("follows").select("target").eq("follower", value: me).limit(500).execute().value
      let clubs = (try? await clubRows)?.map(\.communityId) ?? []
      let follows = (try? await followRows)?.map { $0.target.uuidString } ?? []
      let meId = me.uuidString

      var sources: [FeedSource: [Post]] = [:]
      switch tab {
      case .latest:
        sources[.recent] = try await Self.fetch(av) { $0.order("created_at", ascending: false).limit(40) }
      case .following:
        sources[.follow] = try await Self.fetchIf(!follows.isEmpty, av) { $0.in("author_id", values: follows).order("created_at", ascending: false).limit(40) }
      case .forYou:
        async let recent = Self.fetch(av) { $0.order("created_at", ascending: false).limit(30) }
        async let mine = Self.fetch(av) { $0.eq("author_id", value: meId).order("created_at", ascending: false).limit(5) }
        async let club = Self.fetchIf(!clubs.isEmpty, av) { $0.in("community_id", values: clubs).order("created_at", ascending: false).limit(30) }
        async let followed = Self.fetchIf(!follows.isEmpty, av) { $0.in("author_id", values: follows).order("created_at", ascending: false).limit(30) }
        async let interest = Self.fetchIf(!interests.isEmpty, av) { $0.overlaps("tags", value: interests).order("created_at", ascending: false).limit(30) }
        sources = [.recent: try await recent, .mine: (try? await mine) ?? [], .club: (try? await club) ?? [], .follow: (try? await followed) ?? [], .interest: (try? await interest) ?? []]
      }
      let ranked = tab == .forYou
        ? FeedRank.rank(sources, interests: interests, now: .now)
        : (sources.values.first ?? []).map { RankedPost(post: $0, reason: "", score: 0) }
      await loadMarks(ranked.map(\.id), me: me)
      items = ranked
    } catch {
      self.error = friendly(error)
    }
  }

  // A fixed list (a profile's or a club's posts), with what you've liked and saved.
  func show(_ posts: [Post], me: UUID) async {
    await loadMarks(posts.map(\.id), me: me)
    items = posts.map { RankedPost(post: $0, reason: "", score: 0) }
    loaded = true
  }

  private func loadMarks(_ ids: [String], me: UUID) async {
    guard !ids.isEmpty else { return }
    async let l: [PostRef] = supabase.from("likes").select("post_id").eq("user_id", value: me).in("post_id", values: ids).execute().value
    async let s: [PostRef] = supabase.from("saved").select("post_id").eq("user_id", value: me).in("post_id", values: ids).execute().value
    liked = Set(((try? await l) ?? []).map(\.postId))
    saved = Set(((try? await s) ?? []).map(\.postId))
  }

  // Optimistic: flips at once, rolls back if the database says no.
  func toggleLike(_ post: Post, me: UUID) async {
    let on = !liked.contains(post.id)
    apply(post.id, like: on)
    do { try await API.setLike(post.id, on, me: me) } catch { apply(post.id, like: !on); self.error = friendly(error) }
  }

  func toggleSave(_ post: Post, me: UUID) async {
    let on = !saved.contains(post.id)
    if on { saved.insert(post.id) } else { saved.remove(post.id) }
    do { try await API.setSaved(post.id, on, me: me) } catch { if on { saved.remove(post.id) } else { saved.insert(post.id) }; self.error = friendly(error) }
  }

  private func apply(_ id: String, like: Bool) {
    if like { liked.insert(id) } else { liked.remove(id) }
    if let i = items.firstIndex(where: { $0.id == id }) { items[i].post.likeCount += like ? 1 : -1 }
  }

  func edited(_ id: String, body: String) {
    if let i = items.firstIndex(where: { $0.id == id }) { items[i].post.body = body; items[i].post.editedAt = .now }
  }
  private(set) var deleted: Set<String> = []
  func removed(_ id: String) { deleted.insert(id); items.removeAll { $0.id == id } }

  func bumpComments(_ id: String, by n: Int = 1) {
    if let i = items.firstIndex(where: { $0.id == id }) { items[i].post.commentCount += n }
  }

}
