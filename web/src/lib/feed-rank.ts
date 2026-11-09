// "For you": one ranked feed from everything that's relevant to you, so it's never empty.
// Posts from your clubs, people you follow, your interests and the newest on Forge are merged,
// deduped and scored; each item says why it's there. Club-verified milestones ("proof") rank in
// alongside posts. Pure, so it can be tested without a database.

export type RankPost = { id: string; author_id: string; kind: string; tags: string[]; like_count: number; comment_count: number; created_at: string; community_id?: string | null; community_name?: string | null };
export type Source = "club" | "follow" | "interest" | "mine" | "recent";
export type Ranked<T> = { item: T; reason: string; score: number };

const HOUR = 36e5;

export function scorePost(p: RankPost, src: Set<Source>, interests: Set<string>, now: number) {
  const age = Math.max(0, (now - Date.parse(p.created_at)) / HOUR);
  const matches = p.tags.filter((t) => interests.has(t)).length;
  // What you just posted goes first (for 3 hours), so you see it land on any screen.
  if (src.has("mine") && age < 3) return 1e6 - age;
  let s = -age;
  s += matches * 36; // 1.5 days per matching topic (as before)
  if (src.has("club")) s += 48;
  if (src.has("follow")) s += 30;
  if (p.kind === "result") s += 18;
  if (p.kind === "question" && p.comment_count === 0 && age < 72) s += 16; // fresh, unanswered: someone can help
  s += Math.log2(1 + p.like_count + 2 * p.comment_count) * 6;
  return s;
}

export function reasonFor(p: RankPost, src: Set<Source>, interests: Set<string>, names: { follow?: string } = {}) {
  if (src.has("mine")) return "";
  if (src.has("club") && p.community_name) return `From your club ${p.community_name}`;
  if (src.has("follow")) return names.follow ? `Because you follow ${names.follow}` : "From someone you follow";
  const m = p.tags.find((t) => interests.has(t));
  if (m) return `Matches your interest: ${m}`;
  if (p.kind === "question" && p.comment_count === 0) return "Unanswered question";
  if (p.like_count + p.comment_count >= 5) return "Popular on Forge";
  return "New on Forge";
}

// Merge sources (a post can come from several), score, sort. `followNames` names the people you follow.
export function rankForYou<T extends RankPost>(sources: Partial<Record<Source, T[]>>, interests: string[], followNames: Map<string, string>, now: number): Ranked<T>[] {
  const mine = new Set(interests);
  const byId = new Map<string, { item: T; src: Set<Source> }>();
  for (const [s, list] of Object.entries(sources) as [Source, T[]][]) {
    for (const p of list ?? []) {
      const e = byId.get(p.id) ?? { item: p, src: new Set<Source>() };
      e.src.add(s);
      byId.set(p.id, e);
    }
  }
  return [...byId.values()]
    .map(({ item, src }) => ({ item, score: scorePost(item, src, mine, now), reason: reasonFor(item, src, mine, { follow: followNames.get(item.author_id) }) }))
    .sort((a, b) => b.score - a.score);
}

// A verified milestone scored on the same scale: proof counts for a lot, and fades like a post.
export function scoreProof(reviewedAt: string, fromMyClub: boolean, now: number) {
  return -Math.max(0, (now - Date.parse(reviewedAt)) / HOUR) + 40 + (fromMyClub ? 48 : 0);
}
