"use server";
import { type Community, type Role } from "@/lib/communities";
import { dbFeatures } from "@/lib/db-features";
import { avatarSrc } from "@/lib/media";
import type { Relationship } from "@/lib/network";
import { getViewer } from "@/lib/supabase/server";

// One search across Forge: members and communities. Used by the search bar at the top of every
// signed-in page (live suggestions) and by /search (full results). Row-level security decides what
// each person can see; this only matches and ranks.
//
// Ranking follows Forge's interests-first rule: people and clubs that share your interests or your
// field come first, then closer name matches.

export type PersonHit = {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  field: string;
  avatar: string | null;
  shared: string[]; // interests you have in common
  relationship: Relationship;
};

export type CommunityHit = {
  community: Community;
  role: Role | null; // your role if you're a member
  requested: boolean; // you've asked to join
  shared: string[];
};

export type SearchResults = { query: string; people: PersonHit[]; communities: CommunityHit[] };

const empty = (query: string): SearchResults => ({ query, people: [], communities: [] });

// Words to match. Only letters, numbers and a few joiners survive, so nothing can change the shape
// of the database filter (commas, dots and brackets have meaning there).
function terms(q: string) {
  return q
    .slice(0, 80)
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}'+#-]/gu, ""))
    .filter((t) => t.length > 0)
    .slice(0, 4);
}

export async function searchForge(rawQuery: string, limit = 5): Promise<SearchResults> {
  const query = String(rawQuery ?? "").trim();
  const words = terms(query);
  if (!words.length) return empty(query);
  const max = Math.min(Math.max(1, Math.floor(limit)), 25);

  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) return empty(query);
  const mine = new Set<string>(profile.interests ?? []);
  const myField: string = profile.field ?? "";
  const { media } = await dbFeatures();

  // Every word has to match somewhere (name, headline, field); words can match different places.
  let people = supabase
    .from("profiles")
    .select(`id, first_name, last_name, headline, field, interests${media ? ", avatar_path" : ""}`)
    .eq("onboarded", true)
    .neq("id", user.id);
  let clubs = supabase.from("communities").select("*");
  for (const w of words) {
    people = people.or(`first_name.ilike.*${w}*,last_name.ilike.*${w}*,headline.ilike.*${w}*,field.ilike.*${w}*`);
    clubs = clubs.or(`name.ilike.*${w}*,about.ilike.*${w}*,field.ilike.*${w}*`);
  }
  const [p, c] = await Promise.all([people.limit(40), clubs.limit(40)]);

  type Row = { id: string; first_name: string; last_name: string; headline: string; field: string; interests: string[] | null; avatar_path?: string | null };
  const lowerQ = query.toLowerCase();
  const nameScore = (name: string) => (name.toLowerCase().startsWith(lowerQ) ? 3 : name.toLowerCase().includes(lowerQ) ? 1 : 0);

  const personRows = ((p.data ?? []) as unknown as Row[])
    .map((r) => {
      const shared = (r.interests ?? []).filter((t) => mine.has(t));
      const score = shared.length * 2 + (myField && r.field === myField ? 2 : 0) + nameScore(`${r.first_name} ${r.last_name}`);
      return { r, shared, score };
    })
    .sort((a, b) => b.score - a.score || `${a.r.first_name} ${a.r.last_name}`.localeCompare(`${b.r.first_name} ${b.r.last_name}`))
    .slice(0, max);

  const clubRows = ((c.data ?? []) as unknown as Community[])
    .map((cm) => {
      const shared = (cm.topics ?? []).filter((t) => mine.has(t));
      const score = shared.length * 2 + (myField && cm.field === myField ? 2 : 0) + nameScore(cm.name);
      return { cm, shared, score };
    })
    .sort((a, b) => b.score - a.score || b.cm.member_count - a.cm.member_count)
    .slice(0, max);

  // Where you stand with each person, and with each club, in four small reads.
  const pids = personRows.map((x) => x.r.id);
  const cids = clubRows.map((x) => x.cm.id);
  const [conns, follows, memberships, requests] = await Promise.all([
    pids.length ? supabase.from("connections").select("id, from_id, to_id, users, status, note").contains("users", [user.id]).limit(1000) : Promise.resolve({ data: [] }),
    pids.length ? supabase.from("follows").select("target").eq("follower", user.id).in("target", pids) : Promise.resolve({ data: [] }),
    cids.length ? supabase.from("community_members").select("community_id, role").eq("uid", user.id).in("community_id", cids) : Promise.resolve({ data: [] }),
    cids.length ? supabase.from("community_requests").select("community_id").eq("uid", user.id).in("community_id", cids) : Promise.resolve({ data: [] }),
  ]);
  type Conn = { id: string; from_id: string; to_id: string; users: string[]; status: string; note: string };
  const connWith = new Map<string, Conn>();
  for (const cn of (conns.data ?? []) as Conn[]) {
    const other = (cn.users ?? []).find((u) => u !== user.id);
    if (other) connWith.set(other, cn);
  }
  const following = new Set(((follows.data ?? []) as { target: string }[]).map((f) => f.target));
  const roles = new Map(((memberships.data ?? []) as { community_id: string; role: Role }[]).map((m) => [m.community_id, m.role]));
  const asked = new Set(((requests.data ?? []) as { community_id: string }[]).map((r) => r.community_id));

  return {
    query,
    people: personRows.map(({ r, shared }) => {
      const cn = connWith.get(r.id);
      const status: Relationship["status"] = !cn ? "none" : cn.status === "accepted" ? "connected" : cn.from_id === user.id ? "sent" : "received";
      return {
        id: r.id,
        firstName: r.first_name ?? "",
        lastName: r.last_name ?? "",
        headline: r.headline ?? "",
        field: r.field ?? "",
        avatar: avatarSrc(r),
        shared,
        relationship: { status, connId: cn?.id ?? null, note: cn?.note ?? "", following: following.has(r.id) },
      };
    }),
    communities: clubRows.map(({ cm, shared }) => ({ community: cm, role: roles.get(cm.id) ?? null, requested: asked.has(cm.id), shared })),
  };
}
