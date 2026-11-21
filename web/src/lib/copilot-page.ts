import type { createClient } from "@/lib/supabase/server";
import type { PageRef } from "@/lib/ember-bar";

// The page the member asked Ember from (the Ask Ember bar sends its id; lib/ember-bar.ts pageContext),
// as one paragraph for Ember's instructions. Read with the member's own client, so row-level security
// decides: a project, club or event they can't see adds nothing.

type DB = Awaited<ReturnType<typeof createClient>>;
const q = (s: string) => JSON.stringify(s);

export async function pageLine(db: DB, userId: string, page: PageRef | undefined): Promise<string> {
  if (!page) return "";
  try {
    if (page.kind === "project") {
      const { data: p } = await db.from("projects").select("id, title, owner_id").eq("id", page.id).maybeSingle();
      if (!p) return "";
      if (p.owner_id !== userId) return `The member is looking at the project ${q(p.title)} (id ${p.id}), which someone else owns. Don't propose milestones on it.`;
      const [repos, clubs] = await Promise.all([
        db.from("project_repos").select("full_name").eq("project_id", p.id).limit(3),
        db.from("community_members").select("communities(id, name)").eq("uid", userId).limit(10),
      ]);
      type C = { id: string; name: string };
      const mine = ((clubs.data ?? []) as unknown as { communities: C | C[] | null }[]).flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []));
      const linked = ((repos.data ?? []) as { full_name: string }[]).map((r) => r.full_name);
      return [
        `The member is on the page of their project ${q(p.title)} (id ${p.id})${linked.length ? `, linked to GitHub: ${linked.join(", ")}` : ""}.`,
        mine.length ? `Clubs that can sign it: ${mine.map((c) => `${c.name} (id ${c.id})`).join(", ")}.` : "They aren't in a club, so a person who saw the work signs it: prepare it with propose_signature.",
        "When they tell you what they did, prepare it as a milestone on this project: with propose_milestone for the club that fits (ask if more than one could), or with propose_signature when a person saw it (a manager, tech lead, professor or client). For evidence, read the linked repo with github_repo and use the https link of the commit, release or pull request that matches; if nothing matches, ask them for a link. Keep their words for the title. It's a card they approve, so never say it's done.",
      ].join(" ");
    }
    if (page.kind === "club") {
      const { data: c } = await db.from("communities").select("id, name").eq("id", page.id).maybeSingle();
      if (!c) return "";
      const { data: m } = await db.from("community_members").select("role").eq("community_id", c.id).eq("uid", userId).maybeSingle();
      const role = (m as { role?: string } | null)?.role;
      return `The member is on the page of the club ${q(c.name)} (id ${c.id}); ${role ? `they're ${role === "member" ? "a member" : `its ${role}`}` : "they aren't a member"}. Questions about "this club" mean this one.`;
    }
    const { data: e } = await db.from("events").select("id, title, starts_at").eq("id", page.id).maybeSingle();
    if (!e) return "";
    return `The member is on the page of the event ${q(e.title)} (id ${e.id}, starts ${e.starts_at}). Questions about "this event" mean this one; propose_rsvp takes this id.`;
  } catch {
    return "";
  }
}
