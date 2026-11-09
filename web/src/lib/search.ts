"use server";
import { type Community, type Role } from "@/lib/communities";
import { dbFeatures } from "@/lib/db-features";
import { avatarSrc } from "@/lib/media";
import type { Relationship } from "@/lib/network";
import { getViewer } from "@/lib/supabase/server";
import { matchTopics } from "@/lib/connectors/github";
import { ALL_TOPICS, requestTime } from "@/lib/forge";

// One search across Forge: members, communities, projects, events and posts. Used by the search bar at the top of every
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

export type ProjectHit = { id: string; ownerId: string; owner: string; title: string; summary: string; status: string; tags: string[] };
export type EventHit = { id: string; title: string; type: string; format: string; starts_at: string };
export type PostHit = { id: string; author: string; body: string; kind: string; created_at: string };

export type SearchResults = { query: string; topics: string[]; question: boolean; people: PersonHit[]; communities: CommunityHit[]; projects: ProjectHit[]; events: EventHit[]; posts: PostHit[] };

const empty = (query: string): SearchResults => ({ query, topics: [], question: looksLikeQuestion(query), people: [], communities: [], projects: [], events: [], posts: [] });

// Questions read better as a Copilot conversation than as a list of matches.
function looksLikeQuestion(q: string) {
  return /\?\s*$/.test(q) || /^(how|what|which|who|why|when|where|should|can|could|is|are|do|does|help|find me|recommend)\b/i.test(q.trim());
}

// Forge topics the query is about: a topic's name (or part of it), or a common alias (ros2, pytorch…).
function queryTopics(query: string, words: string[]) {
  const q = query.toLowerCase();
  const byName = ALL_TOPICS.filter((t) => {
    const name = t.toLowerCase();
    return name.includes(q) || words.some((w) => w.length >= 4 && name.split(/[\s&-]+/).some((part) => part.startsWith(w.toLowerCase())));
  });
  return [...new Set([...byName, ...matchTopics([q, ...words])])].slice(0, 3);
}

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
  const topics = queryTopics(query, words);
  // Projects, events and posts: fewer in the live suggestions, more on /search.
  const more = max >= 10 ? 10 : 3;

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
  // Projects, events and public posts: every word in the title or text; topic matches join in below.
  let projects = supabase.from("projects").select("id, owner_id, title, summary, status, tags, owner:profiles!projects_owner_id_fkey(first_name, last_name)");
  let events = supabase.from("events").select("id, title, type, format, starts_at, topic").eq("status", "published").gt("ends_at", new Date(requestTime()).toISOString());
  let posts = supabase.from("posts").select("id, author_first, author_last, body, kind, tags, created_at").is("community_id", null).eq("status", "visible");
  for (const w of words) {
    projects = projects.or(`title.ilike.*${w}*,summary.ilike.*${w}*`);
    events = events.or(`title.ilike.*${w}*,description.ilike.*${w}*,topic.ilike.*${w}*`);
    posts = posts.ilike("body", `%${w}%`);
  }
  const byTopic = topics.length;
  const [p, c, pj, ev, po, pt, ct, pjt, evt, pot] = await Promise.all([
    people.limit(40), clubs.limit(40),
    projects.order("updated_at", { ascending: false }).limit(more * 2),
    events.order("starts_at", { ascending: true }).limit(more * 2),
    posts.order("created_at", { ascending: false }).limit(more * 2),
    // The same, by topic: "robotics" finds people and clubs tagged Robotics & Autonomy.
    byTopic ? supabase.from("profiles").select(`id, first_name, last_name, headline, field, interests${media ? ", avatar_path" : ""}`).eq("onboarded", true).neq("id", user.id).overlaps("interests", topics).limit(30) : Promise.resolve({ data: [] }),
    byTopic ? supabase.from("communities").select("*").overlaps("topics", topics).limit(30) : Promise.resolve({ data: [] }),
    byTopic ? supabase.from("projects").select("id, owner_id, title, summary, status, tags, owner:profiles!projects_owner_id_fkey(first_name, last_name)").overlaps("tags", topics).order("updated_at", { ascending: false }).limit(more) : Promise.resolve({ data: [] }),
    byTopic ? supabase.from("events").select("id, title, type, format, starts_at, topic").eq("status", "published").gt("ends_at", new Date(requestTime()).toISOString()).in("topic", topics).order("starts_at").limit(more) : Promise.resolve({ data: [] }),
    byTopic ? supabase.from("posts").select("id, author_first, author_last, body, kind, tags, created_at").is("community_id", null).eq("status", "visible").overlaps("tags", topics).order("created_at", { ascending: false }).limit(more) : Promise.resolve({ data: [] }),
  ]);
  const uniq = <T extends { id: string }>(...lists: T[][]) => { const seen = new Set<string>(); return lists.flat().filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true))); };

  type Row = { id: string; first_name: string; last_name: string; headline: string; field: string; interests: string[] | null; avatar_path?: string | null };
  const lowerQ = query.toLowerCase();
  const nameScore = (name: string) => (name.toLowerCase().startsWith(lowerQ) ? 3 : name.toLowerCase().includes(lowerQ) ? 1 : 0);

  const topicSet = new Set(topics);
  const personRows = uniq((p.data ?? []) as unknown as Row[], (pt.data ?? []) as unknown as Row[])
    .map((r) => {
      const shared = (r.interests ?? []).filter((t) => mine.has(t));
      const onTopic = (r.interests ?? []).some((t) => topicSet.has(t)) ? 3 : 0;
      const score = shared.length * 2 + onTopic + (myField && r.field === myField ? 2 : 0) + nameScore(`${r.first_name} ${r.last_name}`);
      return { r, shared, score };
    })
    .sort((a, b) => b.score - a.score || `${a.r.first_name} ${a.r.last_name}`.localeCompare(`${b.r.first_name} ${b.r.last_name}`))
    .slice(0, max);

  const clubRows = uniq((c.data ?? []) as unknown as Community[], (ct.data ?? []) as unknown as Community[])
    .map((cm) => {
      const shared = (cm.topics ?? []).filter((t) => mine.has(t));
      const onTopic = (cm.topics ?? []).some((t) => topicSet.has(t)) ? 3 : 0;
      const score = shared.length * 2 + onTopic + (myField && cm.field === myField ? 2 : 0) + nameScore(cm.name);
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

  type PJ = { id: string; owner_id: string; title: string; summary: string; status: string; tags: string[] | null; owner: { first_name: string; last_name: string } | null };
  type EV = { id: string; title: string; type: string; format: string; starts_at: string };
  type PO = { id: string; author_first: string; author_last: string; body: string; kind: string; created_at: string };
  const projectHits: ProjectHit[] = uniq((pj.data ?? []) as unknown as PJ[], (pjt.data ?? []) as unknown as PJ[]).slice(0, more)
    .map((x) => ({ id: x.id, ownerId: x.owner_id, owner: x.owner ? `${x.owner.first_name} ${x.owner.last_name}`.trim() : "", title: x.title, summary: x.summary.slice(0, 160), status: x.status, tags: x.tags ?? [] }));
  const eventHits: EventHit[] = uniq((ev.data ?? []) as EV[], (evt.data ?? []) as EV[]).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, more)
    .map((x) => ({ id: x.id, title: x.title, type: x.type, format: x.format, starts_at: x.starts_at }));
  const postHits: PostHit[] = uniq((po.data ?? []) as PO[], (pot.data ?? []) as PO[]).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, more)
    .map((x) => ({ id: x.id, author: `${x.author_first} ${x.author_last}`.trim(), body: x.body.replace(/\s+/g, " ").slice(0, 160), kind: x.kind, created_at: x.created_at }));

  return {
    query,
    topics,
    question: looksLikeQuestion(query),
    projects: projectHits,
    events: eventHits,
    posts: postHits,
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
