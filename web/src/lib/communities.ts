// Communities: roles, permissions, labels and auto-moderation. Ported from public/js/communities.js.
// Pure helpers only (safe on the server and in the browser). The database rules in supabase/schema.sql
// enforce the same limits; this file decides what the UI offers and what server actions pre-check.
import { FIELDS, friendlyError, type Post } from "@/lib/forge";

export type Role = "owner" | "admin" | "moderator" | "helper" | "member";
export type CommunityType = "field" | "study" | "project" | "school";
export type Privacy = "public" | "approval";
export type AutoMod = { words: string[]; holdNewLinks: boolean };

export type Community = {
  id: string;
  name: string;
  about: string;
  field: string;
  type: CommunityType;
  privacy: Privacy;
  topics: string[];
  rules: string;
  owner_id: string | null;
  owner_name: string;
  member_count: number;
  automod: AutoMod | null;
  created_at: string;
  cover_path?: string;
};

export type Member = {
  community_id: string;
  uid: string;
  role: Role;
  first_name: string;
  last_name: string;
  headline: string;
  joined_at: string;
};

export type JoinRequest = {
  community_id: string;
  uid: string;
  first_name: string;
  last_name: string;
  headline: string;
  at: string;
};

export type Ban = { community_id: string; uid: string; name: string; banned_by: string | null; at: string };

export type CommunityPost = Post & { community_id: string | null; status: "visible" | "held" };

// "*" so cover_path comes along once supabase/media.sql has run (communities are readable in full).
export const COMMUNITY_COLS = "*";
export const POST_COLS = "id, author_id, author_first, author_last, author_headline, body, kind, tags, like_count, comment_count, created_at, community_id, status";

export const ROLES: Role[] = ["owner", "admin", "moderator", "helper", "member"];
export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", moderator: "Moderator", helper: "Helper", member: "Member" };
export const RANK: Record<Role, number> = { owner: 5, admin: 4, moderator: 3, helper: 2, member: 1 };
export const rank = (role: string | null | undefined) => (role && role in RANK ? RANK[role as Role] : 0);
export const isRole = (r: unknown): r is Role => typeof r === "string" && r in RANK;

// What each role can do: [key, label, minimum rank].
export const PERMS = [
  ["approve", "Approve join requests", 2],
  ["removePosts", "Remove posts and comments", 3],
  ["review", "Review held posts", 3],
  ["verify", "Verify members' milestones", 3],
  ["removeMembers", "Remove and ban members below them", 3],
  ["roles", "Assign roles below their own", 4],
  ["editInfo", "Edit community info and rules", 4],
  ["hostEvents", "Host club events", 4],
  ["automod", "Set up auto-moderation", 4],
] as const;
export type Perm = (typeof PERMS)[number][0];
export const can = (role: string | null | undefined, perm: Perm) => {
  const row = PERMS.find((p) => p[0] === perm);
  return !!row && rank(role) >= row[2];
};

export const TYPES: { id: CommunityType; label: string }[] = [
  { id: "field", label: "Field community" },
  { id: "study", label: "Study group" },
  { id: "project", label: "Project team" },
  { id: "school", label: "School & alumni" },
];
export const TYPE_LABEL: Record<CommunityType, string> = Object.fromEntries(TYPES.map((t) => [t.id, t.label])) as Record<CommunityType, string>;

export const PRIVACY: { id: Privacy; label: string; hint: string }[] = [
  { id: "public", label: "Public", hint: "Anyone on Forge can find it, read it and join." },
  { id: "approval", label: "Approval required", hint: "Anyone can find it; posts are for members, and you approve who joins." },
];
export const PRIVACY_LABEL: Record<Privacy, string> = { public: "Public", approval: "Approval required" };

// The community's main field: any Forge field, or all of STEM.
export const COMMUNITY_FIELDS: string[] = [...FIELDS, "All of STEM"];

export const LIMITS = { name: 60, about: 500, rules: 1500, topics: 3, words: 50, wordsText: 2000, members: 500 } as const;

export function cInitials(name: string) {
  return (
    String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "C"
  );
}

export const fmtCount = (v: number | null | undefined) => {
  const n = Number(v || 0);
  return n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);
};
export const membersLabel = (n: number | null | undefined) => `${fmtCount(n)} ${Number(n) === 1 ? "member" : "members"}`;

// "You're the owner" / "You're an admin" / "You're a moderator".
export const roleSentence = (role: Role) => (role === "owner" ? "the owner" : `${role === "admin" ? "an" : "a"} ${ROLE_LABEL[role].toLowerCase()}`);

// Collapses whitespace in a community name, like the vanilla create/settings forms.
export const cleanName = (s: string) => s.trim().replace(/\s+/g, " ");

// Auto-moderation words: one per line or comma separated, de-duplicated, at most 50.
export function parseWords(text: string) {
  return [...new Set(text.split(/[\n,]/).map((w) => w.trim()).filter(Boolean))].slice(0, LIMITS.words);
}

export const normalizeAutomod = (am: Partial<AutoMod> | null | undefined): AutoMod => ({
  words: Array.isArray(am?.words) ? am.words.filter((w): w is string => typeof w === "string") : [],
  holdNewLinks: !!am?.holdNewLinks,
});

const WEEK = 7 * 86_400_000;
const LINK_RE = /https?:\/\/|www\./i;

// Auto-moderation runs when someone posts. Matching posts are held for a moderator.
// Same rules as autoModVerdict() in public/js/communities.js; `now` is passed in so this stays pure.
export function autoModVerdict(
  automod: Partial<AutoMod> | null | undefined,
  membership: { role: string; joined_at?: string | null } | null,
  text: string,
  now: number,
): { status: "visible" | "held"; note?: string } {
  const am = normalizeAutomod(automod);
  if (rank(membership?.role) >= 3) return { status: "visible" }; // moderators and above are never held
  const lower = text.toLowerCase();
  const hit = am.words.find((w) => w && lower.includes(w.toLowerCase()));
  if (hit) return { status: "held", note: "Your post is waiting for a moderator's review because it matched one of this community's filters." };
  if (am.holdNewLinks && LINK_RE.test(text)) {
    const joined = membership?.joined_at ? Date.parse(membership.joined_at) : now;
    if (now - joined < WEEK) return { status: "held", note: "Posts with links from members who joined this week are reviewed first. A moderator will look at it soon." };
  }
  return { status: "visible" };
}

// Database errors in community wording (the shared friendlyError doesn't know these codes yet).
export function communityError(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code ?? "";
  const msg = e?.message ?? "";
  if (code === "23505") return /communit|name/i.test(msg) ? "A community with that name already exists. Try another name." : "That's already done.";
  if (code === "23503") return "That post was removed.";
  if (code === "P0002") return msg || "That request was withdrawn.";
  if (code === "23514") return "Some of that is too long or isn't allowed.";
  if (/failed to fetch|network/i.test(msg)) return "Can't reach Forge right now. Check your connection.";
  // Messages raised by the database functions are already written for people.
  if (code === "42501" && msg && !/row-level security|permission denied/i.test(msg)) return msg;
  return friendlyError(err);
}
